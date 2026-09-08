import {clockState,duration} from './plunge.js?v=3.22.1';
export function mountPlunge(h){
 const $=id=>document.getElementById(id);
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
 function beep(freq,ms,delay=0){if(!audioCtx)return;try{const t0=audioCtx.currentTime+delay/1000,osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type='sine';osc.frequency.value=freq;gain.gain.setValueAtTime(0.0001,t0);gain.gain.exponentialRampToValueAtTime(0.3,t0+0.01);gain.gain.exponentialRampToValueAtTime(0.0001,t0+ms/1000);osc.connect(gain).connect(mediaDest||audioCtx.destination);osc.start(t0);osc.stop(t0+ms/1000+0.02);}catch{}}
 function beepStart(){for(let i=0;i<5;i++)beep(880,120,i*180);}
 function beepComplete(){[523,659,784,1047].forEach((freq,i)=>beep(freq,180,i*140));}
 const dialog=document.createElement('dialog');dialog.id='plunge-timer';dialog.innerHTML=`<h2>Cold plunge</h2><form id="plunge-setup"><div class="plunge-grid"><label>Temperature (°F)<input id="timer-temp" type="number" step="any" inputmode="decimal" placeholder="45.6"></label><label>Goal minutes<input id="timer-min" type="number" min="0" max="1440" step="1" value="3"></label><label>Goal seconds<input id="timer-sec" type="number" min="0" max="59" step="1" value="0" required></label><label>Countdown before start (sec)<input id="timer-countdown" type="number" min="1" max="5" step="1" value="3" required></label></div><button class="primary" type="submit">Start plunge</button></form><div id="plunge-running" hidden><p id="timer-phase"></p><div id="plunge-clock" role="timer"></div><p id="timer-total"></p><button class="primary" id="timer-stop">Stop & save session</button></div><p id="timer-error" role="status"></p><p class="muted">A short countdown gives you time to get in before the timer starts; you'll hear a tone when it begins and again when you reach your goal time, then it continues counting up. Total time runs until you stop. Keep this screen open to watch the timer; it catches up when you return after locking your phone.</p><button id="timer-close">Close</button>`;document.body.append(dialog);
 async function keepAwake(){try{wake=await navigator.wakeLock?.request('screen');}catch{}}
 function release(){wake?.release().catch(()=>{});wake=null;}
 function read(){try{run=JSON.parse(localStorage.getItem(key())||'null');if(run&&(!Number.isFinite(run.startedAt)||!Number.isFinite(run.goal)||run.goal<=0))run=null;}catch{run=null;}goalToneDone=run?clockState(run).over:false;}
 function tick(){
  if(countdownEnd){const remaining=Math.max(0,Math.ceil((countdownEnd-Date.now())/1000));$('timer-phase').textContent='Get ready…';$('plunge-clock').textContent=remaining>0?String(remaining):'Go!';$('timer-total').textContent='';
   if(Date.now()>=countdownEnd){countdownEnd=null;beepStart();const start=new Date();run={id:crypto.randomUUID(),startedAt:start.getTime(),goal:pendingSetup.goal,date:pendingSetup.date,task:pendingSetup.task,temperature:pendingSetup.temperature,unit:'F',time:String(start.getHours()).padStart(2,'0')+':'+String(start.getMinutes()).padStart(2,'0')};pendingSetup=null;goalToneDone=false;try{localStorage.setItem(key(),JSON.stringify(run));}catch{run=null;$('timer-error').textContent='Storage is unavailable. The timer could not start.';}ui();}
   return;
  }
  if(!run)return;const s=clockState(run);if(s.over&&!goalToneDone){goalToneDone=true;beepComplete();}$('plunge-clock').textContent=(s.over?'+':'')+duration(s.display);$('timer-phase').textContent=s.over?'Goal reached · extra time':'Time remaining';$('timer-total').textContent='Total session time '+duration(s.elapsed);
 }
 function ui(){ $('plunge-setup').hidden=!!run||!!countdownEnd;$('plunge-running').hidden=!run&&!countdownEnd;$('timer-stop').textContent=countdownEnd?'Cancel':'Stop & save session';tick();}
 function open(task){read();if(!run){dialog.dataset.task=task;dialog.dataset.date=h.date();}ui();$('timer-error').textContent='';dialog.showModal();ensureAudio();if(run)keepAwake();}
 $('plunge-setup').onsubmit=e=>{e.preventDefault();if(h.blocked()||h.date()!==h.today()){ $('timer-error').textContent='Select today to start a live timer.';return;}const goal=+$('timer-min').value*60+ +$('timer-sec').value;if(goal<=0){$('timer-error').textContent='Enter a goal longer than zero.';return;}read();ensureAudio();if(run){ui();return;}const secs=Math.min(5,Math.max(1,Math.round(+$('timer-countdown').value)||3));pendingSetup={goal,temperature:$('timer-temp').value,task:dialog.dataset.task,date:dialog.dataset.date};countdownEnd=Date.now()+secs*1000;keepAwake();ui();};
 $('timer-stop').onclick=()=>{if(countdownEnd){countdownEnd=null;pendingSetup=null;release();ui();return;}read();if(!run)return;if(h.blocked()){ $('timer-error').textContent='Reload to resolve the changed history, then reopen the timer to save.';return;}run.stoppedAt??=Date.now();localStorage.setItem(key(),JSON.stringify(run));const total=clockState(run).elapsed;if(total<1){$('timer-error').textContent='Session is shorter than one second. Close and discard it.';return;}const db=h.db();const r=db.days[run.date]||{done:{},notes:'',missed:false,sets:{}};r.plunges||={};r.plunges[run.task]||=[];if(!r.plunges[run.task].some(s=>s?.id===run.id))r.plunges[run.task].push({id:run.id,minutes:String(Math.floor(total/60)),seconds:String(total%60),temperature:run.temperature,unit:run.unit,time:run.time,goalSeconds:run.goal});r.done[run.task]=true;r.missed=false;db.days[run.date]=r;if(!h.save()){ $('timer-error').textContent='Could not save. Your stopped timer is retained; try again.';return;}localStorage.removeItem(key());run=null;release();dialog.close();h.refresh();refresh();};
 $('timer-close').onclick=()=>{if(run&&run.stoppedAt&&clockState(run).elapsed<1&&confirm('Discard this empty session?')){localStorage.removeItem(key());run=null;}dialog.close();release();};dialog.addEventListener('close',release);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&dialog.open&&(run||countdownEnd)){tick();keepAwake();}});
 setInterval(tick,250);
 function refresh(){
 document.querySelectorAll('[data-add-session]').forEach(b=>{
  if(!b.parentElement.querySelector('[data-open-plunge]')){const timer=document.createElement('button');timer.dataset.openPlunge=b.dataset.addSession;timer.className='primary';timer.textContent='Start / resume plunge timer';timer.disabled=h.blocked()||h.date()!==h.today();timer.onclick=()=>open(b.dataset.addSession);b.before(timer);}
 });
 }
 refresh();return refresh;
}
