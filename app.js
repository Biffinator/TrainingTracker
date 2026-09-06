import {deletePlunge,removeActivity} from './deletion.js?v=3.17.1';
import {mountPlunge} from './plunge-ui.js?v=3.17.1';
let refreshPlunge=()=>{},refreshReport=()=>{};
import {connectCloud} from './cloud.js?v=3.17.1';
import {today,weekday,addDays,cycle,plan,status,setCount,previous,migrate,validDate,validateBackup,replaceTask,resolveLongDay,weekSaturday} from './core.js?v=3.17.1';
import {isExercise} from './wellness.js?v=3.17.1';
import {mountReporting} from './reporting-ui.js?v=3.17.1';
import {mountSuggestions} from './suggestions-ui.js?v=3.17.1';
const $=id=>document.getElementById(id); let activeId=localStorage.getItem('hybridActiveAccount')||null; let KEY=activeId?'hybridAccount:'+activeId:'hybridTrackerV2'; let cloud=null;
const message=s=>$('message').textContent=s;
let db,legacy=null,blocked=false;
try{const raw=localStorage.getItem(KEY);legacy=JSON.parse(localStorage.getItem('hybridTrackerV1')||'null');db=raw?validateBackup(JSON.parse(raw)):null;}catch(e){blocked=true;message('Saved data could not be read. It has not been overwritten. Restore a valid backup or export the original storage for recovery.');}
if(!db){let start=validDate(legacy?.start)&&weekday(legacy.start)===0?legacy.start:addDays(today(),(7-weekday(today()))%7);db={version:2,start,days:{},longDay:'Sat',legacySource:legacy};}
let selected=today(),month=selected.slice(0,7)+'-01';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=(s,opts)=>new Date(s+'T12:00:00').toLocaleDateString(undefined,opts);
function save(){if(blocked)return false;try{localStorage.setItem(KEY,JSON.stringify(db));if(activeId){const k='hybridCloudMeta:'+activeId;const m=JSON.parse(localStorage.getItem(k)||'{"revision":0}');m.dirty=true;localStorage.setItem(k,JSON.stringify(m));}cloud?.dirty();$('saved').textContent='V3.17.1 · Saved on this device at '+new Date().toLocaleTimeString();return true;}catch(e){message('Could not save to this browser. Export a backup now to keep your latest changes.');return false;}}
function rec(){return db.days[selected]||(db.days[selected]={done:{},notes:'',missed:false,sets:{}});}
function editable(){return !blocked && selected<=today() && (!!cycle(selected,db.start)||!!db.days[selected]?.tasks?.length);}
const activityKinds=[
 ['plunge','Cold plunge',/^cold|^plunge/i,'M3 7q3-3 6 0t6 0t6 0M3 12q3-3 6 0t6 0t6 0M3 17q3-3 6 0t6 0t6 0'],
 ['lift','Lifting',/lift|strength|body|kettlebell/i,'M6 8v8M3 10v4M18 8v8M21 10v4M6 12h12'],
 ['bike','Bike',/bike|cycl/i,'M8 16a3 3 0 1 1-6 0a3 3 0 1 1 6 0M22 16a3 3 0 1 1-6 0a3 3 0 1 1 6 0M5 16l5-8 5 8H5M10 8h7l2 8M9 5h3'],
 ['run','Run',/run|tempo|vo₂|vo2/i,'M14 4h1M9 20l3-6 4 3 2 4M6 12l4-5 4 2 3 4h4M10 7l2 7'],
 ['walk','Walk / treadmill',/walk|treadmill/i,'M13 4h1M8 21l3-7 4 7M6 13l5-5 4 4 4 1M11 8v6'],
 ['recovery','Recovery / sport',/recovery|mobility|basketball/i,'M12 21s-9-6-9-12a5 5 0 0 1 9-3a5 5 0 0 1 9 3c0 6-9 12-9 12']
];
function activityIcon(t){const k=activityKinds.find(k=>k[2].test(t.n))||['other','Other workout',null,'M5 12l5 5L20 7'];return {kind:k[0],svg:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${k[3]}"/></svg>`};}
function calendar(){
 $('month').textContent=format(month,{month:'long',year:'numeric'});const begin=addDays(month,-weekday(month));const next=new Date(month+'T12:00:00');next.setMonth(next.getMonth()+1);const count=Math.ceil((weekday(month)+new Date(next.getFullYear(),next.getMonth(),0).getDate())/7)*7;let html='';
 for(let i=0;i<count;i++){
 const d=addDays(begin,i),tasks=plan(d,db.start,db.days,resolveLongDay(db,d)),r=db.days[d],s=status(r,tasks,d),symbol={complete:'✓',partial:'◐',missed:'✕',empty:''}[s];
 const descriptions=tasks.map(t=>`${t.n}${t.optional?' (optional)':''}: ${d<=today()&&r?.done?.[t.id]?'complete':'not completed'}`);
 const icons=tasks.map(t=>{const icon=activityIcon(t),done=d<=today()&&r?.done?.[t.id];return `<span class="activity-icon ${icon.kind} ${done?'activity-done':''} ${t.optional?'activity-optional':''}" title="${esc(t.n+(t.optional?' (optional)':'')+(done?' · Complete':' · Planned'))}">${icon.svg}</span>`;}).join('');
 html+=`<button class="day ${d.slice(0,7)!==month.slice(0,7)?'outside':''} ${d===selected?'selected':''} ${d===today()?'today':''}" data-date="${d}" aria-pressed="${d===selected}" aria-label="${esc(format(d,{dateStyle:'full'})+': '+s+'. '+descriptions.join('; '))}"><span class="day-heading"><span>${Number(d.slice(8))}</span><span class="symbol ${s}" aria-hidden="true">${symbol}</span></span><span class="day-activities">${icons}</span></button>`;
 }
 $('calendar').innerHTML=html;$('calendar').querySelectorAll('button').forEach(b=>b.onclick=()=>{selected=b.dataset.date;render();showView('day');$('date').focus();});
}
function showView(view){document.querySelector('.calendar-panel').hidden=view!=='calendar';document.querySelector('.detail').hidden=view!=='day';document.querySelector('.layout').hidden=!(view==='day'||view==='calendar');const report=$('report-panel');if(report)report.hidden=view!=='report';if(view==='report')refreshReport();const utilities=document.querySelector('.utilities');if(utilities)utilities.hidden=view!=='utilities';document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));}
function label(t){if(/^Cold plunge/i.test(t.n))return 'Cold plunge';if(/^Lift [ABC]/.test(t.n))return 'Full-body lifting'+(cycle(selected,db.start)?.week===4?' · Deload':'');return t.n.split(' — ')[0];}
function render(){
 calendar();$('start').value=db.start;$('long-day').value=db.longDay||'Sat';
 const c=cycle(selected,db.start),effLongDay=resolveLongDay(db,selected),tasks=plan(selected,db.start,db.days,effLongDay),r=db.days[selected]||{done:{}};
 const disabled=editable()?'':'disabled';
 $('week-long-day').value=db.longDayOverrides?.[weekSaturday(selected)]||'';$('week-long-day').disabled=blocked||!c;
 $('cycle').textContent=c?.partial?'STARTER WEEK':c?`CYCLE ${c.number} / WEEK ${c.week} · ${['Base','Tempo','VO₂max','Deload'][c.week-1]}`:'BEFORE YOUR CYCLE';
 $('date').textContent=format(selected,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
 $('progress').textContent=!c?'Your program begins '+db.start:selected>today()?'Upcoming workout · logging opens on this date.':r.missed?'Marked missed.':`${tasks.filter(t=>!t.optional&&r.done?.[t.id]).length} / ${tasks.filter(t=>!t.optional).length} required workouts completed`;
 $('logging').hidden=!c&&!tasks.length;$('add-workout').disabled=blocked||!c;
 $('tasks').innerHTML=tasks.map(t=>{const detail=t.n.includes(' — ')?t.n.slice(t.n.indexOf(' — ')+3):'';const steps=(!t.lift&&t.ex&&t.ex.length)?`<ul class="instructions">${t.ex.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'';return `<div class="task"><div class="workout-row"><label class="task-label"><input type="checkbox" data-task="${esc(t.id)}" ${r.done?.[t.id]?'checked':''} ${disabled}><span>${esc(label(t))}${t.optional?' <small>Optional</small>':''}</span></label><button data-edit="${esc(t.id)}" ${blocked?'disabled':''}>Edit</button><button data-remove-activity="${esc(t.id)}" ${blocked?'disabled':''}>Remove</button></div>${detail?`<p class="muted task-detail">${esc(detail)}</p>`:''}${steps}${/^Cold plunge/i.test(t.n)?plungeFields(t,r,disabled):''}</div>`;}).join('');
 $('notes').value=r.notes||'';$('notes').disabled=!editable();['all','miss','clear'].forEach(id=>$(id).disabled=!editable());
 $('tasks').querySelectorAll('[data-task]').forEach(el=>el.onchange=()=>{if(!editable())return;const id=el.dataset.task;if(el.checked){const t=tasks.find(t=>t.id===id);if(t&&isExercise(t)){el.checked=false;openActivityLog(id,t);return;}}rec().done[id]=el.checked;rec().missed=false;save();render();});
 $('tasks').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEditor(b.dataset.edit));
 $('tasks').querySelectorAll('[data-plunge]').forEach(el=>el.oninput=()=>{if(!editable()||!el.validity.valid)return;const r=rec();r.plunges||={};r.plunges[el.dataset.plunge]||=[];r.plunges[el.dataset.plunge][Number(el.dataset.session)]||={};r.plunges[el.dataset.plunge][Number(el.dataset.session)][el.dataset.field]=el.value;if(el.dataset.field==='temperature')r.plunges[el.dataset.plunge][Number(el.dataset.session)].unit='F';save();});
 $('tasks').querySelectorAll('[data-add-session]').forEach(b=>b.onclick=()=>{if(!editable())return;const r=rec();r.plunges||={};r.plunges[b.dataset.addSession]||=[{}];r.plunges[b.dataset.addSession].push({});save();render();});
 $('tasks').querySelectorAll('[data-remove-plunge]').forEach(b=>b.onclick=()=>{if(!editable()||!confirm('Delete this cold-plunge session? If this is the last session, its completion check will clear.'))return;if(deletePlunge(rec(),b.dataset.removePlunge,Number(b.dataset.index))){save();render();}});
 $('tasks').querySelectorAll('[data-remove-activity]').forEach(b=>b.onclick=()=>{if(blocked||!confirm('Remove this activity and its recorded sessions from this date? The recurring program on other dates will stay unchanged.'))return;removeActivity(rec(),plan(selected,db.start,db.days,resolveLongDay(db,selected)),b.dataset.removeActivity);save();render();});
 migration();refreshPlunge();
}
function plungeFields(t,r,disabled){const sessions=r.plunges?.[t.id]||[];return sessions.map((s,i)=>`<fieldset class="plunge-session"><legend>Session ${i+1}</legend><div class="plunge-grid">${[['minutes','Minutes','number','min="0" max="1440" step="1"'],['seconds','Seconds','number','min="0" max="59" step="1"'],['temperature','Temperature (°F)','number','step="any"'],['time','Time of day (optional)','time','']].map(([key,name,type,attrs])=>`<label>${name}<input type="${type}" ${attrs} data-plunge="${esc(t.id)}" data-session="${i}" data-field="${key}" value="${esc(key==='temperature'&&s.unit==='C'&&s[key]!==''&&s[key]!=null?+(Number(s[key])*9/5+32).toFixed(2):s[key]??'')}" ${disabled}></label>`).join('')}</div><button data-remove-plunge="${esc(t.id)}" data-index="${i}" ${disabled}>Delete session</button></fieldset>`).join('')+`<button data-add-session="${esc(t.id)}" ${disabled}>Add another session</button><p class="muted">Saved automatically. Check Cold plunge when complete.</p>`;}
function migration(){const el=$('migration');el.hidden=!legacy||db.migrationResolved||blocked;if(el.hidden)return;el.innerHTML='<h2>Your V1 history is preserved</h2><p>V1 saved week/day labels without dates. You can assign those entries to the first four weeks beginning '+esc(db.start)+'. Single weight/reps entries stay labeled as V1 values, because their individual sets are unknown.</p><div class="actions"><button id="migrate">Place V1 logs in first cycle</button><button id="keep">Keep V1 as backup only</button></div>';$('migrate').onclick=()=>{if(!confirm('Assign V1 entries to the first cycle starting '+db.start+'? Existing V2 dates will take priority.'))return;db.days={...migrate(legacy,db.start),...db.days};db.legacySource=legacy;db.migrationResolved=true;save();render();};$('keep').onclick=()=>{db.legacySource=legacy;db.migrationResolved=true;save();render();};}
$('prev').onclick=()=>{month=addDays(month,-1).slice(0,7)+'-01';calendar();};$('next').onclick=()=>{month=addDays(month,32).slice(0,7)+'-01';calendar();};$('today').onclick=()=>{selected=today();month=selected.slice(0,7)+'-01';render();showView('day');};
$('day-prev').onclick=()=>{selected=addDays(selected,-1);month=selected.slice(0,7)+'-01';render();$('date').focus();};$('day-next').onclick=()=>{selected=addDays(selected,1);month=selected.slice(0,7)+'-01';render();$('date').focus();};
$('notes').oninput=e=>{if(editable()){rec().notes=e.target.value;save();}};
$('all').onclick=()=>{plan(selected,db.start,db.days,resolveLongDay(db,selected)).filter(t=>!t.optional).forEach(t=>rec().done[t.id]=true);rec().missed=false;save();render();};$('miss').onclick=()=>{rec().done={};rec().missed=true;save();render();};$('clear').onclick=()=>{rec().done={};rec().missed=false;save();render();};
$('start').onchange=e=>{const s=e.target.value;if(!validDate(s)){message('Choose a valid start date.');e.target.value=db.start;return;}if(Object.keys(db.days).length && !confirm('Change the cycle start? Logs stay on their original dates, but the scheduled cycle weeks will change. Export a backup first if needed.')){e.target.value=db.start;return;}db.start=s;message(weekday(s)?'Starter week added. Your full Week 1 begins the following Monday.':'');save();render();};
$('long-day').onchange=e=>{const v=e.target.value;if(v!=='Sat'&&v!=='Sun')return;if(Object.keys(db.days).length && !confirm('Change the default long-workout day to '+(v==='Sat'?'Saturday':'Sunday')+'? This is the fallback for weeks without their own override below; logged history stays on its original dates, but unlogged weekend days may show different scheduled content going forward.')){e.target.value=db.longDay||'Sat';return;}db.longDay=v;save();render();};
$('week-long-day').onchange=e=>{const v=e.target.value;if(v!=='' && v!=='Sat' && v!=='Sun')return;const key=weekSaturday(selected);db.longDayOverrides||={};if(v)db.longDayOverrides[key]=v;else delete db.longDayOverrides[key];save();render();};
function download(data,name){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').onclick=()=>{if(blocked){const raw={};try{for(const key of [KEY,'hybridTrackerV1'])raw[key]=localStorage.getItem(key);}catch(e){message('Browser storage is unavailable.');}download(raw,'hybrid-storage-recovery.json');}else download(db,'hybrid-training-v2-'+today()+'.json');};$('import').onclick=()=>$('file').click();$('file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>10000000)throw Error('Backup is too large.');const incoming=validateBackup(JSON.parse(await f.text()));if(!confirm('Replace this device’s V2 history with the backup? A copy of the current history will download first.'))return;download(db,'hybrid-before-restore-'+today()+'.json');localStorage.setItem(KEY,JSON.stringify(incoming));db=incoming;blocked=false;save();message('Backup restored.');render();}catch(err){message('Restore failed: '+err.message);}finally{e.target.value='';}};
window.addEventListener('storage',e=>{if(e.key===KEY||e.key==='hybridActiveAccount'){blocked=true;message('Your history changed in another tab. Reload this page before logging more workouts.');render();}});
if('serviceWorker' in navigator){let reloading=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reloading){reloading=true;location.reload();}});navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{});}
render();


cloud=connectCloud({
 get:()=>db, available:()=>!blocked,
 apply:value=>{const next=validateBackup(JSON.parse(JSON.stringify(value)));localStorage.setItem(KEY,JSON.stringify(next));db=next;render();},
 account:id=>{const nextKey=id?'hybridAccount:'+id:'hybridTrackerV2';const raw=localStorage.getItem(nextKey);let next;try{next=raw?validateBackup(JSON.parse(raw)):{version:2,start:db.start,days:{},migrationResolved:true};}catch(e){next={version:2,start:db.start,days:{},migrationResolved:true};if(id)try{const metaKey='hybridCloudMeta:'+id;const m=JSON.parse(localStorage.getItem(metaKey)||'{"revision":0}');localStorage.setItem(metaKey,JSON.stringify({...m,dirty:false}));}catch{}message('Local cache for this account could not be read and was reset. Syncing your history from the cloud.');}KEY=nextKey;activeId=id;if(id)localStorage.setItem('hybridActiveAccount',id);else localStorage.removeItem('hybridActiveAccount');db=next;blocked=false;render();},
 legacy:()=>{const raw=localStorage.getItem('hybridTrackerV2');return raw?JSON.parse(raw):null;},
 download
});

let editingId=null,editingDate=null;
function openEditor(id=null){if(blocked)return;const t=plan(selected,db.start,db.days,resolveLongDay(db,selected)).find(t=>t.id===id);editingId=id;editingDate=selected;$('edit-name').value=t?label(t):'';$('edit-optional').checked=t?.optional??true;$('edit-heading').textContent=id?'Edit workout':'Add a workout';$('edit-error').textContent='';$('workout-editor').showModal();}
$('add-workout').onclick=()=>openEditor();
$('edit-cancel').onclick=()=>$('workout-editor').close();
$('edit-form').onsubmit=e=>{e.preventDefault();if(blocked||editingDate!==selected)return;const name=$('edit-name').value.trim();if(!name){$('edit-error').textContent='Enter a workout type.';return;}const r=rec();r.tasks||=structuredClone(plan(selected,db.start,db.days,resolveLongDay(db,selected))).map(t=>({...t,ex:t.ex||[]}));if(editingId){const t=r.tasks.find(t=>t.id===editingId);t.n=name;t.optional=$('edit-optional').checked;}else r.tasks.push({id:'custom-'+crypto.randomUUID(),n:name,lift:false,optional:$('edit-optional').checked,ex:[]});save();$('workout-editor').close();render();};

let logId=null,logDate=null;
function openActivityLog(id,t){logId=id;logDate=selected;const existing=rec().sessions?.[id];$('log-activity-name').textContent=label(t);$('log-minutes').value=existing?.minutes??'';$('log-rpe').value=existing?.rpe??'';$('log-activity-error').textContent='';$('log-activity').showModal();}
$('log-activity-cancel').onclick=()=>$('log-activity').close();
$('log-activity-form').onsubmit=e=>{e.preventDefault();if(blocked||logDate!==selected){$('log-activity-error').textContent='This date changed. Close and try again.';return;}const minutes=$('log-minutes').value;if(minutes===''||+minutes<0){$('log-activity-error').textContent='Enter actual minutes (0 or more).';return;}const r=rec();r.sessions||={};r.sessions[logId]={minutes,rpe:$('log-rpe').value};r.done[logId]=true;r.missed=false;save();$('log-activity').close();render();};
$('start-tomorrow').onclick=()=>{if(blocked)return;$('start').value=addDays(today(),1);$('start').dispatchEvent(new Event('change'));selected=$('start').value;month=selected.slice(0,7)+'-01';render();showView('day');};

const handle={db:()=>db,date:()=>selected,today,account:()=>activeId||"local",blocked:()=>blocked,save,refresh:render,commit:(d,record)=>{db.days[d]=record;save();render();}};
refreshPlunge=mountPlunge(handle);
refreshReport=mountReporting(handle);
mountSuggestions(handle);

document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>showView(b.dataset.view));showView("day");

document.querySelector(".activity-key").innerHTML=activityKinds.map(k=>`<span>${activityIcon({n:k[1]}).svg}${esc(k[1])}</span>`).join("");

