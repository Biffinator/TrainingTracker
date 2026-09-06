import {plan,resolveLongDay} from './core.js?v=3.15.4';
import {deletePlunge} from './deletion.js?v=3.15.4';
import {clockState,duration,sessions,statistics} from './plunge.js?v=3.15.4';
export function mountPlunge(h){
 const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const key=()=> 'hybridPlungeTimer:'+h.account();let run=null,wake=null,countdownEnd=null,pendingSetup=null,goalToneDone=false,audioCtx=null,mediaDest=null,alarmVideo=null;
 function ensureAudio(){
  if(!audioCtx){
   try{
    audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    // Route tones through a hidden <video> element instead of straight to the
    // AudioContext destination. iOS Safari mutes plain Web Audio / <audio> output
    // when the hardware silent switch is on, but treats <video> playback as a
    // different audio session category that ignores the switch. Feeding the
    // oscillator into a MediaStream and playing it back through a <video> tag
    // (even with no visible video track) gets alarms to sound in silent mode.
    mediaDest=audioCtx.createMediaStreamDestination();
    alarmVideo=document.createElement('video');
    alarmVideo.srcObject=mediaDest.stream;
    alarmVideo.setAttribute('playsinline','');
    alarmVideo.setAttribute('webkit-playsinline','');
    alarmVideo.muted=false;
    alarmVideo.style.cssText='position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(alarmVideo);
   }catch{audioCtx=null;mediaDest=null;alarmVideo=null;}
  }
  if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});
  if(alarmVideo&&alarmVideo.paused)alarmVideo.play().catch(()=>{});
 }
 function beep(freq,ms){if(!audioCtx)return;try{const t0=audioCtx.currentTime,osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(0.0001,t0);gain.gain.exponentialRampToValueAtTime(0.3,t0+0.01);gain.gain.exponentialRampToValueAtTime(0.0001,t0+ms/1000);osc.connect(gain).connect(mediaDest||audioCtx.destination);osc.start(t0);osc.stop(t0+ms/1000+0.02);}catch{}}
 const dialog=document.createElement('dialog');dialog.id='plunge-timer';dialog.innerHTML=`<h2>Cold plunge</h2><form id="plunge-setup"><div class="plunge-grid"><label>Temperature (°F)<input id="timer-temp" type="number" step="any" inputmode="decimal" placeholder="45.6"></label><label>Goal minutes<input id="timer-min" type="number" min="0" max="1440" step="1" value="3"></label><label>Goal seconds<input id="timer-sec" type="number" min="0" max="59" step="1" value="0" required></label><label>Countdown before start (sec)<input id="timer-countdown" type="number" min="1" max="5" step="1" value="3" required></label></div><button class="primary" type="submit">Start plunge</button></form><div id="plunge-running" hidden><p id="timer-phase"></p><div id="plunge-clock" role="timer"></div><p id="timer-total"></p><button class="primary" id="timer-stop">Stop & save session</button></div><p id="timer-error" role="status"></p><p class="muted">A short countdown gives you time to get in before the timer starts; you'll hear a tone when it begins and again when you reach your goal time, then it continues counting up. Total time runs until you stop. Keep this screen open to watch the timer; it catches up when you return after locking your phone.</p><button id="timer-close">Close</button>`;document.body.append(dialog);
 const panel=document.createElement('section');panel.className='card';panel.id='plunge-history';panel.innerHTML=`<h2>Cold plunge history</h2><div class="actions"><label>Period<select id="plunge-period"><option value="week">This week</option><option value="month">This month</option><option value="year">This year</option><option value="all">All time</option></select></label><button id="manual-plunge">Add past session</button></div><div id="plunge-stats" class="plunge-stats"></div><details><summary>Activity chart</summary><div id="plunge-chart" class="plunge-chart"></div></details><details><summary>Session feed</summary><div id="plunge-feed"></div></details>`;document.querySelector('footer').before(panel);
 async function keepAwake(){try{wake=await navigator.wakeLock?.request('screen');}catch{}}
 function release(){wake?.release().catch(()=>{});wake=null;}
 function read(){try{run=JSON.parse(localStorage.getItem(key())||'null');if(run&&(!Number.isFinite(run.startedAt)||!Number.isFinite(run.goal)||run.goal<=0))run=null;}catch{run=null;}goalToneDone=run?clockState(run).over:false;}
 function tick(){
  if(countdownEnd){const remaining=Math.max(0,Math.ceil((countdownEnd-Date.now())/1000));$('timer-phase').textContent='Get ready…';$('plunge-clock').textContent=remaining>0?String(remaining):'Go!';$('timer-total').textContent='';
   if(Date.now()>=countdownEnd){countdownEnd=null;beep(880,150);const start=new Date();run={id:crypto.randomUUID(),startedAt:start.getTime(),goal:pendingSetup.goal,date:pendingSetup.date,task:pendingSetup.task,temperature:pendingSetup.temperature,unit:'F',time:String(start.getHours()).padStart(2,'0')+':'+String(start.getMinutes()).padStart(2,'0')};pendingSetup=null;goalToneDone=false;try{localStorage.setItem(key(),JSON.stringify(run));}catch{run=null;$('timer-error').textContent='Storage is unavailable. The timer could not start.';}ui();}
   return;
  }
  if(!run)return;const s=clockState(run);if(s.over&&!goalToneDone){goalToneDone=true;beep(660,300);}$('plunge-clock').textContent=(s.over?'+':'')+duration(s.display);$('timer-phase').textContent=s.over?'Goal reached · extra time':'Time remaining';$('timer-total').textContent='Total session time '+duration(s.elapsed);
 }
 function ui(){ $('plunge-setup').hidden=!!run||!!countdownEnd;$('plunge-running').hidden=!run&&!countdownEnd;$('timer-stop').textContent=countdownEnd?'Cancel':'Stop & save session';tick();}
 function open(task){read();if(!run){dialog.dataset.task=task;dialog.dataset.date=h.date();}ui();$('timer-error').textContent='';dialog.showModal();ensureAudio();if(run)keepAwake();}
 $('plunge-setup').onsubmit=e=>{e.preventDefault();if(h.blocked()||h.date()!==h.today()){ $('timer-error').textContent='Select today to start a live timer.';return;}const goal=+$('timer-min').value*60+ +$('timer-sec').value;if(goal<=0){$('timer-error').textContent='Enter a goal longer than zero.';return;}read();ensureAudio();if(run){ui();return;}const secs=Math.min(5,Math.max(1,Math.round(+$('timer-countdown').value)||3));pendingSetup={goal,temperature:$('timer-temp').value,task:dialog.dataset.task,date:dialog.dataset.date};countdownEnd=Date.now()+secs*1000;keepAwake();ui();};
 $('timer-stop').onclick=()=>{if(countdownEnd){countdownEnd=null;pendingSetup=null;release();ui();return;}read();if(!run)return;if(h.blocked()){ $('timer-error').textContent='Reload to resolve the changed history, then reopen the timer to save.';return;}run.stoppedAt??=Date.now();localStorage.setItem(key(),JSON.stringify(run));const total=clockState(run).elapsed;if(total<1){$('timer-error').textContent='Session is shorter than one second. Close and discard it.';return;}const db=h.db();const r=db.days[run.date]||{done:{},notes:'',missed:false,sets:{}};r.plunges||={};r.plunges[run.task]||=[];if(!r.plunges[run.task].some(s=>s?.id===run.id))r.plunges[run.task].push({id:run.id,minutes:String(Math.floor(total/60)),seconds:String(total%60),temperature:run.temperature,unit:run.unit,time:run.time,goalSeconds:run.goal});r.done[run.task]=true;r.missed=false;db.days[run.date]=r;if(!h.save()){ $('timer-error').textContent='Could not save. Your stopped timer is retained; try again.';return;}localStorage.removeItem(key());run=null;release();dialog.close();h.refresh();refresh();};
 $('timer-close').onclick=()=>{if(run&&run.stoppedAt&&clockState(run).elapsed<1&&confirm('Discard this empty session?')){localStorage.removeItem(key());run=null;}dialog.close();release();};dialog.addEventListener('close',release);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&dialog.open&&(run||countdownEnd)){tick();keepAwake();}});
 setInterval(tick,250);
 function refresh(){
 document.querySelectorAll('[data-add-session]').forEach(b=>{if(b.parentElement.querySelector('[data-open-plunge]'))return;const timer=document.createElement('button');timer.dataset.openPlunge=b.dataset.addSession;timer.className='primary';timer.textContent='Start / resume plunge timer';timer.disabled=h.blocked()||h.date()!==h.today();timer.onclick=()=>open(b.dataset.addSession);b.before(timer);});
 const now=h.today(),period=$('plunge-period').value;const date=new Date(now+'T12:00:00');date.setDate(date.getDate()-((date.getDay()+6)%7));const monday=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');const lower=period==='week'?monday:period==='month'?now.slice(0,7)+'-01':period==='year'?now.slice(0,4)+'-01-01':'0000';const rows=sessions(h.db()).filter(s=>s.date>=lower&&s.date<=now),unit='F',stats=statistics(rows,unit);
 $('plunge-stats').innerHTML=`<div><small>Sessions</small><strong>${stats.count}</strong></div><div><small>Total time</small><strong>${duration(stats.total)}</strong></div><div><small>Average temperature</small><strong>${stats.temperature===null?'—':stats.temperature.toFixed(1)+'°'+unit}</strong></div>`;
 $('plunge-feed').innerHTML=rows.length?rows.map(s=>`<article class="plunge-feed-item"><b>${esc(s.date)} ${esc(s.time)}</b><p>${duration(s.total)} · ${s.temperature!==''&&s.temperature!=null?esc(s.unit==='C'?+(Number(s.temperature)*9/5+32).toFixed(2):s.temperature)+'°F':'Temperature not recorded'}</p><button data-delete-date="${esc(s.date)}" data-delete-task="${esc(s.task)}" data-delete-index="${s.index}" ${h.blocked()?'disabled':''}>Delete session</button></article>`).join(''):'<p>No sessions recorded in this period.</p>';
 $('plunge-feed').querySelectorAll('[data-delete-date]').forEach(b=>b.onclick=()=>{if(h.blocked()||!confirm('Delete this cold-plunge session? If it is the last session for this activity, its completion check will clear.'))return;const r=h.db().days[b.dataset.deleteDate];if(r&&deletePlunge(r,b.dataset.deleteTask,Number(b.dataset.deleteIndex))){h.save();h.refresh();}});
 $('manual-plunge').disabled=h.blocked();
 const counts={};rows.forEach(s=>counts[s.date]=(counts[s.date]||0)+1);$('plunge-chart').innerHTML=Object.keys(counts).sort().map(d=>`<div><small>${esc(d)}</small><span style="width:${Math.min(100,counts[d]*20)}%">${counts[d]} session${counts[d]===1?'':'s'}</span></div>`).join('')||'<p>No sessions yet.</p>';
 }
 const manual=document.createElement('dialog');manual.id='manual-plunge-dialog';manual.innerHTML=`<form id="manual-plunge-form"><h2>Add past plunge</h2><label>Date<input id="manual-date" type="date" required></label><label>Time<input id="manual-time" type="time" required></label><label>Temperature (°F)<input id="manual-temp" type="number" step="any" inputmode="decimal" required></label><div class="plunge-grid"><label>Minutes<input id="manual-min" type="number" min="0" max="1440" step="1" required></label><label>Seconds<input id="manual-sec" type="number" min="0" max="59" step="1" value="0" required></label></div><p id="manual-error" role="status"></p><button class="primary" type="submit">Save session</button><button id="manual-cancel" type="button">Cancel</button></form>`;document.body.append(manual);
 $('manual-plunge').onclick=()=>{if(h.blocked())return;$('manual-date').value=h.today();$('manual-date').max=h.today();$('manual-error').textContent='';manual.showModal();};$('manual-cancel').onclick=()=>manual.close();
 $('manual-plunge-form').onsubmit=e=>{e.preventDefault();if(h.blocked())return;const date=$('manual-date').value,minutes=$('manual-min').value,seconds=$('manual-sec').value,time=$('manual-time').value,temperature=$('manual-temp').value;if(date>h.today()||+minutes*60+ +seconds<=0){$('manual-error').textContent='Choose a past date or today and a duration longer than zero.';return;}
 const db=h.db();const r=db.days[date]||{done:{},notes:'',missed:false,sets:{}};const tasks=plan(date,db.start,db.days,resolveLongDay(db,date));let task=tasks.find(t=>/^Cold plunge/i.test(t.n));if(!task){task={id:'plunge-'+crypto.randomUUID(),n:'Cold plunge',lift:false,optional:false,ex:[]};r.tasks=[...structuredClone(tasks),task];}
 const existing=Object.values(r.plunges||{}).flat().some(s=>s&&s.time===time&&Number(s.minutes||0)*60+Number(s.seconds||0)===+minutes*60+ +seconds&&Number(s.unit==='C'?Number(s.temperature)*9/5+32:s.temperature)===+temperature);if(existing){$('manual-error').textContent='A matching session already exists for this date.';return;}
 r.plunges||={};r.plunges[task.id]||=[];r.plunges[task.id].push({id:crypto.randomUUID(),minutes,seconds,time,temperature,unit:'F'});r.done[task.id]=true;r.missed=false;db.days[date]=r;if(h.save()){manual.close();h.refresh();}else $('manual-error').textContent='Could not save. Export a backup to keep this entry.';
 };
 $('plunge-period').onchange=refresh;refresh();return refresh;
}
