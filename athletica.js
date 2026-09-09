import {plan,resolveLongDay,validateTasks,addDays} from './core.js?v=3.26.1';
// Athletica publishes a per-user iCalendar feed (Settings → Profile → Plan Settings) of all-day
// events named "<Sport> - <Workout name>" whose DESCRIPTION carries a "Duration: H:MM:SS|MM:SS" line.
export const SYNC_DAYS=7;
const unfold=text=>text.replace(/\r\n/g,'\n').replace(/\n[ \t]/g,'');
const unescapeIcs=s=>s.replace(/\\n/gi,'\n').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\');
export function parseIcs(text){
 const events=[];let cur=null;
 for(const line of unfold(String(text||'')).split('\n')){
  if(line==='BEGIN:VEVENT'){cur={};continue;}
  if(line==='END:VEVENT'){if(cur)events.push(cur);cur=null;continue;}
  if(!cur)continue;
  const i=line.indexOf(':');if(i<0)continue;
  const name=line.slice(0,i).split(';')[0],value=line.slice(i+1);
  if(name==='UID')cur.uid=value.trim();
  else if(name==='SUMMARY')cur.summary=unescapeIcs(value).trim();
  else if(name==='DESCRIPTION')cur.description=unescapeIcs(value);
  else if(name==='DTSTART'){const m=value.match(/^(\d{4})(\d{2})(\d{2})/);if(m)cur.date=`${m[1]}-${m[2]}-${m[3]}`;}
 }
 return events.filter(e=>e.uid&&e.date&&e.summary).map(e=>{
  const [sport,...rest]=e.summary.split(' - ');
  const dm=(e.description||'').match(/Duration:\s*(\d+):(\d{2})(?::(\d{2}))?/);
  const minutes=dm?(dm[3]!==undefined?+dm[1]*60+ +dm[2]:+dm[1]):null;
  return {uid:e.uid,date:e.date,sport:sport.trim(),name:(rest.join(' - ').trim()||e.summary),minutes,description:e.description||''};
 });
}
export const isCardio=e=>!/strength|conditioning/i.test(e.sport);
export const isAthleticaTask=t=>String(t?.id||'').startsWith('ath-');
// Program slots an Athletica session stands in for. Cardio takes the generic Tue/Thu "Endurance"
// placeholder and the long-day "Long run"/"Long bike" slot; strength takes the day's Lift A/B/C.
// Everything else (Cold plunge, the optional HIIT Cycle, treadmill days) is left alone.
export const isPlaceholder=t=>{const n=String(t?.n||'');return n==='Endurance'||/^Long (run|bike)\b/i.test(n);};
export const isProgramLift=t=>!!t?.lift&&!isAthleticaTask(t);
// Athletica regenerates every UID on each feed build (they are uniqid() timestamps), so ids are
// derived from what identifies a session to a person: its date, sport and name. Duplicates get -2, -3…
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
export function stableId(e,seen=new Set()){const base='ath-'+slug(`${e.date} ${e.sport} ${e.name}`);let id=base,i=2;while(seen.has(id))id=`${base}-${i++}`;seen.add(id);return id;}
const sessionKey=t=>String(t.n).split(' · ')[0];
export function athleticaTask(e,seen){
 const detail=[e.sport,e.minutes!=null?e.minutes+' min':null].filter(Boolean).join(' · ');
 const ex=e.description.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,30).map(s=>s.slice(0,500));
 return {id:stableId(e,seen),n:(e.name+(detail?' — '+detail:'')).slice(0,500),lift:!isCardio(e),optional:false,ex};
}
// A synced row whose id changed (older UID-based ids, or a renamed duplicate) hands its checkmark and
// logged time to the incoming row with the same name and sport, so a re-sync never un-completes a workout.
function carryOver(rec,current,incoming){
 if(!rec)return;const claimed=new Set();
 for(const old of current.filter(isAthleticaTask)){
  if(incoming.some(t=>t.id===old.id))continue;
  const match=incoming.find(t=>!claimed.has(t.id)&&!current.some(c=>c.id===t.id)&&sessionKey(t)===sessionKey(old));
  if(!match)continue;claimed.add(match.id);
  if(rec.done&&old.id in rec.done){rec.done[match.id]=rec.done[old.id];delete rec.done[old.id];}
  if(rec.sessions?.[old.id]){rec.sessions[match.id]=rec.sessions[old.id];delete rec.sessions[old.id];}
 }
}
// Materialises each affected day's task list (the same per-day override the Edit dialog uses) so nothing
// else in the app has to know about Athletica. Only a rolling window of `days` starting today is touched -
// plans further out change too often to be worth pinning, and past days keep whatever was logged.
// Completion state survives re-syncs because ids are stable per Athletica event.
export function mergeAthletica(db,events,today,days=SYNC_DAYS){
 const start=today,end=addDays(today,days-1),byDate={};
 for(const e of events){if(e.date<start||e.date>end)continue;(byDate[e.date]||=[]).push(e);}
 const dates=new Set(Object.keys(byDate));
 for(const [d,r] of Object.entries(db.days||{}))if(d>=start&&d<=end&&r?.tasks?.some(isAthleticaTask))dates.add(d);
 let changed=0;
 for(const d of dates){
  const current=plan(d,db.start,db.days,resolveLongDay(db,d)).map(t=>({...t,ex:t.ex||[]}));
  const seen=new Set(),incoming=(byDate[d]||[]).map(e=>athleticaTask(e,seen));
  carryOver(db.days[d],current,incoming);
  const cardio=incoming.some(t=>!t.lift),strength=incoming.some(t=>t.lift);
  const next=[...current.filter(t=>!isAthleticaTask(t)&&!(cardio&&isPlaceholder(t))&&!(strength&&isProgramLift(t))),...incoming];
  if(!next.length||JSON.stringify(next)===JSON.stringify(current))continue;
  validateTasks(next);
  (db.days[d]||=(db.days[d]={done:{},notes:'',missed:false,sets:{}})).tasks=next;changed++;
 }
 return changed;
}
