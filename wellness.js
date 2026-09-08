import {plan,resolveLongDay} from './core.js?v=3.23.0';
export const isExercise=t=>!/^cold plunge/i.test(t.n);
// Same buckets the calendar icons use; 'strength' also catches lifts added by name.
export const workoutKind=t=>t.lift||/lift|strength|body|kettlebell/i.test(t.n)?'strength':/bike|cycl/i.test(t.n)?'bike':/run|tempo|vo₂|vo2/i.test(t.n)?'run':'other';
export const KINDS=[['all','All workouts'],['run','Run'],['bike','Bike'],['strength','Strength']];
export const kindFilter=kind=>kind==='all'||!kind?()=>true:t=>workoutKind(t)===kind;
export function daySummary(db,d,keep=()=>true){
 const r=db.days[d]||{},tasks=plan(d,db.start,db.days,resolveLongDay(db,d)).filter(t=>isExercise(t)&&keep(t));
 const byKind={};const bucket=k=>byKind[k]||=(byKind[k]={planned:0,completed:0,minutes:0,logged:0});
 let minutes=0,logged=0,cardio=0,required=0,requiredDone=0;
 for(const t of tasks){const b=bucket(workoutKind(t));b.planned++;if(r.done?.[t.id])b.completed++;if(!t.optional){required++;if(r.done?.[t.id])requiredDone++;}}
 const entries=[...tasks.map(t=>({task:t,session:r.sessions?.[t.id]})),...(r.archivedTasks||[]).slice().reverse()];
 for(const entry of entries){const t=entry.task;if(!isExercise(t)||!keep(t))continue;const m=entry.session;if(m?.minutes!==undefined&&m.minutes!==''&&+m.minutes>0){minutes+=+m.minutes;if(!t.lift)cardio+=+m.minutes;logged++;const b=bucket(workoutKind(t));b.minutes+=+m.minutes;b.logged++;}}
 return {date:d,planned:tasks.length,completed:tasks.filter(t=>r.done?.[t.id]).length,required,requiredDone,minutes,cardio,logged,byKind,hard:tasks.filter(t=>t.lift||/long run|long bike|tempo|4×4|basketball/i.test(t.n)).length};
}
