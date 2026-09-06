import {plan,addDays,cycle,validateTasks,replaceTask,resolveLongDay} from './core.js?v=3.17.0';
import {HIIT_CYCLE} from './program.js?v=3.17.0';
export function workload(db,date,replace=''){
 const demanding=t=>t.lift||/long run|long bike|tempo|4×4|basketball/i.test(t.n);
 const today=plan(date,db.start,db.days,resolveLongDay(db,date)).filter(t=>t.id!==replace);
 const recent=[1,2].some(i=>{const d=addDays(date,-i),rec=db.days[d];if(!rec)return false;return plan(d,db.start,db.days,resolveLongDay(db,d)).some(t=>demanding(t)&&(rec.done?.[t.id]||Object.values(rec.sets?.[t.id]||{}).some(sets=>sets.some(s=>s.reps!==''||s.weight!==''))));});
 const tomorrow=plan(addDays(date,1),db.start,db.days,resolveLongDay(db,addDays(date,1))).some(demanding);
 return {busy:today.some(demanding)||recent||tomorrow,deload:cycle(date,db.start)?.week===4};
}
export function suggest(db,date,{type='full',replace=''}={}){
 if(type==='plunge')return {name:'Cold plunge',ex:[],lift:false,optional:false};
 if(type==='hiit')return {name:'HIIT Cycle',ex:HIIT_CYCLE,lift:false};
 const {busy,deload}=workload(db,date,replace),light=busy||deload;
 let name,ex,lift=false;
 if(type==='recovery'){name='Recovery / mobility';ex=['Easy walk or gentle cycling — 15 min, conversational pace','Gentle comfortable mobility — 5 min; avoid painful movements'];}
 else if(type==='run'||type==='bike'){name=type==='run'?'Easy run / walk':'Easy bike';ex=['Warm-up — 5 min easy',`${type==='run'?'Run / walk':'Cycle'} — 20 min at conversational effort`,'Cooldown — 5 min easy'];}
 else{lift=true;name=type==='kettlebell'?'Full-body kettlebell':'Full-body lifting';const moves=type==='kettlebell'?['Kettlebell goblet squat','Kettlebell floor press','Kettlebell supported row','Kettlebell deadlift']:['Leg press','DB press','Chest-supported row','Hamstring curl'];const count=light?2:3,reps=light?'8–10 easy':'8–12';ex=moves.map(n=>`${n} — ${count} × ${reps}`);}
 return {name,ex,lift};
}
export function applySuggestion(record,tasks,draft,replace=''){const next={id:replace||'extra-'+Date.now(),n:draft.name.trim(),ex:draft.ex,lift:draft.lift,optional:draft.optional??!replace};if(replace){const original=tasks.find(t=>t.id===replace);if(!original)throw Error('Workout no longer exists.');next.optional=original.optional;return replaceTask(record,tasks,replace,next);}while(tasks.some(t=>t.id===next.id))next.id+='x';const updated=[...tasks.map(t=>({...t,ex:t.ex||[]})),next];validateTasks(updated);record.tasks=updated;record.done||={};record.done[next.id]=false;return record;}
