export function clockState(run,now=Date.now()){
 const elapsed=Math.max(0,Math.floor(((run.stoppedAt??now)-run.startedAt)/1000));
 return {elapsed,over:elapsed>=run.goal,display:elapsed>=run.goal?elapsed-run.goal:run.goal-elapsed};
}
export function duration(seconds){return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}
export function sessions(db){return Object.entries(db.days).flatMap(([date,r])=>Object.entries(r.plunges||{}).flatMap(([task,list])=>list.filter(Boolean).map(s=>({...s,date,task,total:Number(s.minutes||0)*60+Number(s.seconds||0)})))).filter(s=>s.total>0).sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||'')));}
export function statistics(rows,unit='F'){
 const temps=rows.filter(s=>s.temperature!==''&&s.temperature!=null&&Number.isFinite(Number(s.temperature))).map(s=>s.unit==='C'?(unit==='C'?+s.temperature:+s.temperature*9/5+32):(unit==='C'?(+s.temperature-32)*5/9:+s.temperature));
 return {count:rows.length,total:rows.reduce((sum,s)=>sum+s.total,0),temperature:temps.length?temps.reduce((a,b)=>a+b,0)/temps.length:null};
}
