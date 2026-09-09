import {plan,resolveLongDay} from './core.js?v=3.27.0';
import {isExercise,workoutKind} from './wellness.js?v=3.27.0';
// Strava sport types → the app's workout buckets. Garmin/Strava strength uploads arrive as
// WeightTraining (or the generic Workout), so both count as strength.
export function stravaKind(a){
 const t=String(a?.sport_type||a?.type||'');
 if(/run/i.test(t))return 'run';
 if(/ride|cycl|velomobile/i.test(t))return 'bike';
 if(/weighttraining|crossfit|^workout$|hiit/i.test(t))return 'strength';
 if(/walk|hike/i.test(t))return 'walk';
 return 'other';
}
const taskKind=workoutKind;
export const activityDate=a=>String(a?.start_date_local||'').slice(0,10);
// Fills in actual time for the day's matching workout and checks it off. Rules:
// - one activity claims at most one row, matched on the day and workout type, earliest first;
// - the watch is the record: Strava's moving time replaces a typed time on a row that has no Strava link yet;
// - a row keeps its activity while that activity still exists on Strava, and every sync re-asserts it:
//   checked, with Strava's current time (so an unchecked-by-mistake row comes back and an edited activity
//   updates). If the activity was deleted there, the row is free again.
// Returns {applied, matched, unmatched}: applied = rows changed this pass, matched = activities linked to a row
// (new or previously) with the row they fill, unmatched = activities in range that found no row.
export function applyStrava(db,activities,today){
 let applied=0;const matched=[],unmatched=[];
 const byDate={};
 for(const a of activities||[]){const d=activityDate(a);if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||d>today||d<db.start||!(+a.moving_time>=60))continue;(byDate[d]||=[]).push(a);}
 for(const [d,list] of Object.entries(byDate)){
  list.sort((x,y)=>String(x.start_date_local).localeCompare(String(y.start_date_local)));
  const tasks=plan(d,db.start,db.days,resolveLongDay(db,d)).filter(isExercise);
  const r=db.days[d]||(tasks.length?(db.days[d]={done:{},notes:'',missed:false,sets:{}}):null);
  if(!r){for(const a of list)unmatched.push(describe(a));continue;}
  r.done||={};r.sessions||={};
  const claimed=new Set(Object.values(r.sessions).map(s=>s?.strava).filter(Boolean)),present=new Set(list.map(a=>a.id));
  for(const a of list){
   if(claimed.has(a.id)){
    const t=tasks.find(t=>r.sessions[t.id]?.strava===a.id),minutes=+(a.moving_time/60).toFixed(4);
    if(t){if(!r.done[t.id]){r.done[t.id]=true;r.missed=false;applied++;}if(r.sessions[t.id].minutes!==minutes){r.sessions[t.id].minutes=minutes;applied++;}}
    matched.push({...describe(a),task:t?t.n.split(' — ')[0]:'?',done:!!t});continue;
   }
   const kind=stravaKind(a);
   const t=tasks.find(t=>taskKind(t)===kind&&!(r.sessions[t.id]?.strava&&present.has(r.sessions[t.id].strava)));
   if(!t){unmatched.push(describe(a));continue;}
   r.sessions[t.id]={minutes:+(a.moving_time/60).toFixed(4),strava:a.id};
   r.done[t.id]=true;r.missed=false;claimed.add(a.id);applied++;matched.push({...describe(a),task:t.n.split(' — ')[0],done:true});
  }
 }
 return {applied,matched,unmatched};
}
const describe=a=>({id:a.id,name:String(a.name||'').slice(0,60),type:String(a.sport_type||a.type||''),date:activityDate(a)});
