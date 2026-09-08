import {plan,resolveLongDay} from './core.js?v=3.25.0';
import {isExercise,workoutKind} from './wellness.js?v=3.25.0';
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
// Treadmill/walk rows are 'other' to Reporting but should still pick up a Strava walk.
const taskKind=t=>/treadmill|walk|hike/i.test(t.n)?'walk':workoutKind(t);
export const activityDate=a=>String(a?.start_date_local||'').slice(0,10);
// Fills in actual time for the day's matching workout and checks it off. Rules:
// - one activity claims at most one task, matched on the day and workout type, earliest first;
// - a time you typed in yourself is never overwritten (only rows that came from Strava update);
// - re-applying the same activity is a no-op, so periodic syncs are idempotent.
export function applyStrava(db,activities,today){
 let applied=0;
 const byDate={};
 for(const a of activities||[]){const d=activityDate(a);if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||d>today||d<db.start||!(+a.moving_time>=60))continue;(byDate[d]||=[]).push(a);}
 for(const [d,list] of Object.entries(byDate)){
  list.sort((x,y)=>String(x.start_date_local).localeCompare(String(y.start_date_local)));
  const tasks=plan(d,db.start,db.days,resolveLongDay(db,d)).filter(isExercise);
  if(!tasks.length)continue;
  const r=db.days[d]||=(db.days[d]={done:{},notes:'',missed:false,sets:{}});
  r.done||={};r.sessions||={};
  const claimed=new Set(Object.values(r.sessions).map(s=>s?.strava).filter(Boolean)),present=new Set(list.map(a=>a.id));
  for(const a of list){
   if(claimed.has(a.id))continue;
   const kind=stravaKind(a);
   // A row keeps its activity while that activity still exists on Strava; if it was deleted there, the row is free again.
   const t=tasks.find(t=>taskKind(t)===kind&&(!r.sessions[t.id]||(r.sessions[t.id].strava&&!present.has(r.sessions[t.id].strava))));
   if(!t)continue;
   r.sessions[t.id]={minutes:+(a.moving_time/60).toFixed(4),strava:a.id};
   r.done[t.id]=true;r.missed=false;claimed.add(a.id);applied++;
  }
 }
 return applied;
}
