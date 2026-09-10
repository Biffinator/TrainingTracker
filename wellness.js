import {plan,resolveLongDay} from './core.js?v=3.29.0';
export const isExercise=t=>!/^cold plunge/i.test(t.n);
// Same buckets the calendar icons use. Synced names look like "<workout> — <Sport> · <min> min", and the
// sport segment is authoritative: "Strength Endurance — Run" is a run. Only when there is no recognisable
// sport segment (program rows like "Treadmill — 30 min @ …") does the whole name decide.
export const classifyWorkoutText=s=>/lift|strength|body|kettlebell/i.test(s)?'strength':/bike|cycl/i.test(s)?'bike':/run|tempo|vo₂|vo2/i.test(s)?'run':/treadmill|walk|hike/i.test(s)?'walk':'other';
export const sportOf=t=>{const n=String(t?.n||''),i=n.indexOf(' — ');return i>=0?n.slice(i+3).split(' · ')[0]:'';};
export const workoutKind=t=>{if(t.lift)return 'strength';const bySport=classifyWorkoutText(sportOf(t));return bySport!=='other'?bySport:classifyWorkoutText(t.n);};
export const KINDS=[['all','All workouts'],['run','Run'],['bike','Bike'],['strength','Strength']];
export const kindFilter=kind=>kind==='all'||!kind?()=>true:t=>workoutKind(t)===kind;
export function daySummary(db,d,keep=()=>true){
 const r=db.days[d]||{},tasks=plan(d,db.start,db.days,resolveLongDay(db,d)).filter(t=>isExercise(t)&&keep(t));
 const byKind={};const bucket=k=>byKind[k]||=(byKind[k]={planned:0,completed:0,minutes:0,logged:0});
 let minutes=0,logged=0,cardio=0,required=0,requiredDone=0;
 for(const t of tasks){if(t.optional)continue;const b=bucket(workoutKind(t));b.planned++;required++;if(r.done?.[t.id]){b.completed++;requiredDone++;}}
 const entries=[...tasks.map(t=>({task:t,session:r.sessions?.[t.id]})),...(r.archivedTasks||[]).slice().reverse()];
 for(const entry of entries){const t=entry.task;if(!isExercise(t)||!keep(t))continue;const m=entry.session;if(m?.minutes!==undefined&&m.minutes!==''&&+m.minutes>0){minutes+=+m.minutes;if(!t.lift)cardio+=+m.minutes;logged++;const b=bucket(workoutKind(t));b.minutes+=+m.minutes;b.logged++;}}
 return {date:d,planned:required,completed:requiredDone,required,requiredDone,minutes,cardio,logged,byKind,hard:tasks.filter(t=>t.lift||/long run|long bike|tempo|4×4|basketball/i.test(t.n)).length};
}
