// Removed entries remain in exported backups for recovery.
export function deletePlunge(record,task,index){
 const list=record.plunges?.[task];if(!list||!Number.isInteger(index)||index<0||index>=list.length)return false;
 record.deletedEntries||=[];record.deletedEntries.push({kind:'plunge',task,session:structuredClone(list[index]),deletedAt:new Date().toISOString()});list.splice(index,1);
 if(!list.some(s=>Number(s?.minutes||0)*60+Number(s?.seconds||0)>0))record.done[task]=false;
 return true;
}
export function removeActivity(record,tasks,id){
 const task=tasks.find(t=>t.id===id);if(!task)return false;
 record.deletedEntries||=[];record.deletedEntries.push({kind:'activity',task:structuredClone(task),done:!!record.done[id],sets:structuredClone(record.sets?.[id]||{}),session:structuredClone(record.sessions?.[id]||{}),plunges:structuredClone(record.plunges?.[id]||[]),deletedAt:new Date().toISOString()});
 record.tasks=structuredClone(tasks.filter(t=>t.id!==id));delete record.done[id];if(record.sets)delete record.sets[id];if(record.sessions)delete record.sessions[id];if(record.plunges)delete record.plunges[id];return true;
}
