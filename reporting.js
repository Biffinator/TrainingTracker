import {addDays,weekday} from './core.js?v=3.26.0';
import {daySummary,kindFilter} from './wellness.js?v=3.26.0';
import {sessions} from './plunge.js?v=3.26.0';
export const PERIODS=[['week','This week'],['month','This month'],['3m','Last 3 months'],['6m','Last 6 months'],['year','Last 12 months'],['ytd','Year to date']];
export const NAVIGABLE=new Set(['week','month']);
export function shiftMonths(monthStart,delta){const d=new Date(monthStart.slice(0,7)+'-01T12:00:00');d.setMonth(d.getMonth()+delta);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;}
export function periodRange(period,anchor,today){
 if(period==='week'){const dt=new Date(anchor+'T12:00:00');const back=(dt.getDay()+6)%7;const start=addDays(anchor,-back);let end=addDays(start,6);if(end>today)end=today;return {start,end};}
 if(period==='month'){const start=anchor.slice(0,7)+'-01';const lastDay=new Date(shiftMonths(start,1)+'T12:00:00');lastDay.setDate(0);let end=anchor.slice(0,7)+'-'+String(lastDay.getDate()).padStart(2,'0');if(end>today)end=today;return {start,end};}
 if(period==='3m')return {start:addDays(today,-89),end:today};
 if(period==='6m')return {start:addDays(today,-181),end:today};
 if(period==='year')return {start:addDays(today,-364),end:today};
 return {start:today.slice(0,4)+'-01-01',end:today};
}
export function shiftAnchor(period,anchor,delta){
 if(period==='week')return addDays(anchor,delta*7);
 if(period==='month')return shiftMonths(anchor,delta);
 return anchor;
}
export function isCurrentPeriod(period,anchor,today){
 if(period==='week')return periodRange('week',anchor,today).start<=today&&addDays(periodRange('week',anchor,today).start,6)>=today;
 if(period==='month')return anchor.slice(0,7)===today.slice(0,7);
 return true;
}
export function sixMonthSpan(anchorMonth){const months=[];for(let i=5;i>=0;i--)months.push(shiftMonths(anchorMonth,-i));return months;}
export function isCurrentSixMonth(anchorMonth,today){return anchorMonth.slice(0,7)===today.slice(0,7);}
export function rangeSummary(db,start,end,kind='all'){
 const keep=kindFilter(kind);let planned=0,completed=0,minutes=0,cardio=0,logged=0;const byKind={};
 for(let d=start;d<=end;d=addDays(d,1)){
  const s=daySummary(db,d,keep);
  planned+=s.planned;completed+=s.completed;minutes+=s.minutes;cardio+=s.cardio;logged+=s.logged;
  for(const [k,b] of Object.entries(s.byKind)){const t=byKind[k]||=(byKind[k]={planned:0,completed:0,minutes:0,logged:0});t.planned+=b.planned;t.completed+=b.completed;t.minutes+=b.minutes;t.logged+=b.logged;}
 }
 return {planned,completed,minutes,cardio,logged,byKind};
}
// One bucket per day for the week view, otherwise one per Monday-start week. Minutes are split by kind.
export function timeSeries(db,start,end,period,kind='all'){
 const keep=kindFilter(kind),buckets=[];let cur=null;
 for(let d=start;d<=end;d=addDays(d,1)){
  const key=period==='week'?d:addDays(d,-weekday(d));
  if(!cur||cur.start!==key){cur={start:key,end:d,total:0,byKind:{}};buckets.push(cur);}
  cur.end=d;const s=daySummary(db,d,keep);
  for(const [k,b] of Object.entries(s.byKind)){if(!b.minutes)continue;cur.byKind[k]=(cur.byKind[k]||0)+b.minutes;cur.total+=b.minutes;}
 }
 return buckets;
}
const longestRun=dates=>{const set=new Set(dates);let best=0;for(const d of set){if(set.has(addDays(d,-1)))continue;let n=1;while(set.has(addDays(d,n)))n++;best=Math.max(best,n);}return best;};
// Days with a plunge session logged, or a Cold plunge task checked. "Current" still counts if today isn't done yet.
export function plungeStreak(db,today){
 const set=new Set(sessions(db).map(r=>r.date));
 for(const [d,r] of Object.entries(db.days||{})){if(!r?.done)continue;const tasks=r.tasks||[];for(const [id,v] of Object.entries(r.done))if(v&&/^cold plunge/i.test(tasks.find(t=>t.id===id)?.n??(id==='0'?'Cold plunge':'')))set.add(d);}
 let current=0,d=set.has(today)?today:addDays(today,-1);
 while(set.has(d)){current++;d=addDays(d,-1);}
 return {current,best:longestRun([...set])};
}
// Consecutive Monday-start weeks where every required (non-optional) workout was checked.
export function weekStreak(db,today){
 if(!db.start)return {current:0,best:0};
 const weeks=[];
 for(let w=addDays(db.start,-weekday(db.start));w<=today;w=addDays(w,7)){
  let required=0,done=0;
  for(let i=0;i<7;i++){const d=addDays(w,i);if(d>today)break;const s=daySummary(db,d);required+=s.required;done+=s.requiredDone;}
  weeks.push({full:required>0&&done===required,partial:addDays(w,6)>today});
 }
 let best=0,n=0;for(const wk of weeks){n=wk.full?n+1:0;best=Math.max(best,n);}
 let current=0;for(let i=weeks.length-1;i>=0;i--){const wk=weeks[i];if(wk.full)current++;else if(wk.partial)continue;else break;}
 return {current,best};
}
