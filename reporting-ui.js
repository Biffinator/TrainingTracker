import {periodRange,rangeSummary,shiftAnchor,isCurrentPeriod,NAVIGABLE,PERIODS,monthSpan,shiftMonths,timeSeries,plungeStreak,weekStreak} from './reporting.js?v=3.29.0';
import {sessions,statistics,duration} from './plunge.js?v=3.29.0';
import {deletePlunge} from './deletion.js?v=3.29.0';
import {weekday} from './core.js?v=3.29.0';
import {KINDS} from './wellness.js?v=3.29.0';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hms=m=>{const t=Math.round(m*60),h=Math.floor(t/3600),mm=Math.floor(t%3600/60),ss=t%60;return (h?h+':'+String(mm).padStart(2,'0'):String(mm))+':'+String(ss).padStart(2,'0');};
const monthLabel=d=>new Date(d+'T12:00:00').toLocaleDateString(undefined,{month:'long',year:'numeric'});
const monthShort=d=>new Date(d+'T12:00:00').toLocaleDateString(undefined,{month:'short',year:'2-digit'});
const dayShort=d=>new Date(d+'T12:00:00').toLocaleDateString(undefined,{month:'numeric',day:'numeric'});
const KIND_ORDER=['strength','bike','run','walk','other'],KIND_NAME={run:'Run',bike:'Bike',strength:'Strength',walk:'Treadmill / walk',other:'Other'};
const rateClass=(done,total)=>!total||!done?'none':done>=total?'complete':'partial';
const streakText=s=>`${s.current}<small class="sub">best ${s.best}</small>`;
export function mountReporting(h){
 let anchor=h.today();
 const PLUNGE_SPANS=[2,6,12];let plungeSpan=2;try{const v=+localStorage.getItem('hybridPlungeSpan');if(PLUNGE_SPANS.includes(v))plungeSpan=v;}catch{}
 let selectedDay=null;
 let box=document.getElementById('report-panel');
 if(!box){
  box=document.createElement('section');box.id='report-panel';box.className='card';box.hidden=true;box.setAttribute('aria-label','Training reports');
  box.innerHTML=`<h2>Reporting</h2><h3 class="report-section">Fitness</h3><div class="kind-filter" id="report-kind" role="group" aria-label="Workout type">${KINDS.map(([v,t])=>`<button type="button" data-kind="${v}" aria-pressed="${v==='all'}">${esc(t)}</button>`).join('')}</div><div class="bar" id="report-nav"><button id="report-prev" aria-label="Previous period">←</button><select id="report-period" aria-label="Period">${PERIODS.map(([v,t])=>`<option value="${v}">${esc(t)}</option>`).join('')}</select><button id="report-next" aria-label="Next period">→</button></div><p id="report-range" class="muted"></p><button id="report-today-btn" hidden>Back to current</button><div class="plunge-stats" id="report-stats"></div><div class="breakdown" id="report-breakdown"></div><div class="bars" id="report-chart"></div><div class="bar-labels" id="report-chart-labels"></div><div class="breakdown" id="report-legend"></div><p class="muted">Counts are required workouts (optional ones like HIIT Cycle add time but not count). Actual time comes from checking workouts complete on the Day view; unlogged sessions are not counted as zero. A full week means every required workout was checked.</p><hr><h3 class="report-section">Cold plunge</h3><div class="kind-filter" id="pcal-span" role="group" aria-label="Months shown">${PLUNGE_SPANS.map(n=>`<button type="button" data-span="${n}" aria-pressed="${n===plungeSpan}">${n} months</button>`).join('')}</div><div class="plunge-stats" id="report-plunge-stats"></div><p class="muted pcal-key">Number = minutes in the tub · shade = temperature, darker is colder · tap a day for its sessions</p><div class="pcal-months" id="pcal-months"></div>`;
  document.querySelector('.layout').after(box);
  let saved=null;try{saved=localStorage.getItem('hybridReportPeriod');}catch{}
  if(saved&&PERIODS.some(p=>p[0]===saved))box.querySelector('#report-period').value=saved;
  let kind='all';try{const k=localStorage.getItem('hybridReportKind');if(KINDS.some(p=>p[0]===k))kind=k;}catch{}
  box.dataset.kind=kind;
  box.querySelectorAll('#report-kind button').forEach(b=>b.onclick=()=>{box.dataset.kind=b.dataset.kind;try{localStorage.setItem('hybridReportKind',b.dataset.kind);}catch{}refresh();});
  box.querySelector('#report-period').onchange=e=>{try{localStorage.setItem('hybridReportPeriod',e.target.value);}catch{}anchor=h.today();refresh();};
  box.querySelector('#report-prev').onclick=()=>{anchor=shiftAnchor($('#report-period').value,anchor,-1);refresh();};
  box.querySelector('#report-next').onclick=()=>{anchor=shiftAnchor($('#report-period').value,anchor,1);refresh();};
  box.querySelector('#report-today-btn').onclick=()=>{anchor=h.today();refresh();};
  box.querySelectorAll('#pcal-span button').forEach(b=>b.onclick=()=>{plungeSpan=+b.dataset.span;try{localStorage.setItem('hybridPlungeSpan',String(plungeSpan));}catch{}refresh();});
 }
 const $=id=>box.querySelector(id.startsWith('#')?id:'#'+id);
 function renderMonth(monthStart,byDate,today,db){
  const wd=weekday(monthStart);
  const daysInMonth=new Date(shiftMonths(monthStart,1)+'T12:00:00');daysInMonth.setDate(0);
  const days=daysInMonth.getDate();
  let cells='';
  for(let i=0;i<wd;i++)cells+='<span class="pcal-pad"></span>';
  for(let day=1;day<=days;day++){
   const d=monthStart.slice(0,8)+String(day).padStart(2,'0');
   const e=byDate[d],mins=e?Math.round(e.secs/60):0;
   const tier=!e?'':e.temp===null?'notemp':e.temp<45?'high':e.temp<=52?'mid':'low';
   const future=d>today;
   cells+=`<button type="button" class="pcal-day ${tier} ${d===today?'today':''} ${d===selectedDay?'selected':''}" data-date="${d}" ${future?'disabled':''} title="${esc(d)}${mins?': '+mins+' min':''}${e?.temp!=null?' · '+e.temp+'°F':''}">${day}<small>${mins?mins+'m':''}</small></button>`;
  }
  // The tapped day's sessions pop in right under this month's grid, so nothing is a scroll away.
  let pop='';
  if(selectedDay&&selectedDay.slice(0,7)===monthStart.slice(0,7)){
   const rows=sessions(db).filter(r=>r.date===selectedDay),label=new Date(selectedDay+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
   const item=r=>`<span class="pcal-pop-row">${duration(r.total)}${r.temperature!==''&&r.temperature!=null?' · '+esc(r.unit==='C'?+(Number(r.temperature)*9/5+32).toFixed(1):r.temperature)+'°F':''}${r.time?' · '+esc(fmtTime(r.time)):''} <button type="button" data-delete-date="${esc(r.date)}" data-delete-task="${esc(r.task)}" data-delete-index="${r.index}" ${h.blocked()?'disabled':''} aria-label="Delete this session">Delete</button></span>`;
   pop=`<div class="pcal-pop"><b>${esc(label)}</b>${rows.length?rows.map(item).join(''):'<span class="muted">No plunge logged.</span>'}</div>`;
  }
  return `<div class="pcal-month"><h5>${esc(monthLabel(monthStart))}</h5><div class="pcal-grid">${cells}</div>${pop}</div>`;
 }
 const fmtTime=t=>{const [hh,mm]=String(t).split(':');const h24=+hh;if(!Number.isFinite(h24))return t;return `${h24%12||12}:${mm} ${h24<12?'AM':'PM'}`;};
 function renderChart(series){
  const max=Math.max(0,...series.map(b=>b.total));
  $('#report-chart').classList.toggle('bars-empty',!max);
  if(!max){$('#report-chart').innerHTML='<p class="muted">No logged time in this period yet.</p>';$('#report-chart-labels').innerHTML='';$('#report-legend').innerHTML='';return;}
  $('#report-chart').innerHTML=series.map(b=>{
   const title=`${b.start===b.end?b.start:b.start+' – '+b.end}: ${hms(b.total)}`+KIND_ORDER.filter(k=>b.byKind[k]).map(k=>` · ${KIND_NAME[k]} ${hms(b.byKind[k])}`).join('');
   return `<div class="bar-col" title="${esc(title)}">${KIND_ORDER.filter(k=>b.byKind[k]).map(k=>`<div class="seg k-${k}" style="height:${(b.byKind[k]/max*100).toFixed(1)}%"></div>`).join('')}</div>`;
  }).join('');
  $('#report-chart-labels').className='bar-labels'+(series.length>16?' sparse':'');
  $('#report-chart-labels').innerHTML=series.map(b=>`<span>${esc(dayShort(b.start))}</span>`).join('');
  const used=KIND_ORDER.filter(k=>series.some(b=>b.byKind[k]));
  $('#report-legend').innerHTML=used.map(k=>`<span><span class="dot k-${k}"></span>${KIND_NAME[k]}</span>`).join('');
 }
 function selectDay(d){selectedDay=selectedDay===d?null:d;refresh();}
 function refresh(){
  const db=h.db(),today=h.today(),period=$('#report-period').value,navigable=NAVIGABLE.has(period);
  const {start,end}=periodRange(period,navigable?anchor:today,today);
  $('#report-prev').hidden=$('#report-next').hidden=!navigable;
  $('#report-today-btn').hidden=!navigable||isCurrentPeriod(period,anchor,today);
  if(navigable)$('#report-next').disabled=isCurrentPeriod(period,anchor,today);
  $('#report-range').textContent=period==='week'?`${start} – ${end}`:navigable?`${monthLabel(start)} · ${start} – ${end}`:`${start} – ${end}`;
  const kind=box.dataset.kind||'all';$('#report-kind').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===kind)));
  const s=rangeSummary(db,start,end,kind),pct=s.planned?Math.round(s.completed/s.planned*100):0,wk=weekStreak(db,today);
  $('#report-stats').innerHTML=`<div><small>Required done</small><strong>${s.completed} / ${s.planned}</strong><span class="rate ${rateClass(s.completed,s.planned)}">${s.planned?pct+'%':'—'}</span></div><div><small>Actual time</small><strong>${s.logged?hms(s.minutes):'—'}</strong></div><div><small>Full weeks in a row</small><strong>${streakText(wk)}</strong></div>`;
  $('#report-breakdown').innerHTML=KIND_ORDER.filter(k=>s.byKind[k]).map(k=>{const b=s.byKind[k];return `<span><span class="dot k-${k}"></span>${KIND_NAME[k]} <b>${b.completed}</b>/${b.planned}${b.logged?` · <b>${hms(b.minutes)}</b>`:''}</span>`;}).join('');
  renderChart(timeSeries(db,start,end,period,kind));
  const calAnchor=today.slice(0,7)+'-01',months=monthSpan(calAnchor,plungeSpan);
  $('#pcal-span').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.span===plungeSpan)));
  const calStart=months[0],calEnd=today;
  const plungeRows=sessions(db).filter(r=>r.date>=calStart&&r.date<=calEnd),unit='F',stats=statistics(plungeRows,unit);
  const longest=plungeRows.reduce((m,r)=>Math.max(m,r.total),0);
  const temps=plungeRows.map(r=>r.temperature!==''&&r.temperature!=null&&Number.isFinite(+r.temperature)?(r.unit==='C'?+r.temperature*9/5+32:+r.temperature):null).filter(v=>v!==null);
  const coldest=temps.length?Math.min(...temps):null,ps=plungeStreak(db,today);
  const degf=v=>v.toFixed(v%1?1:0)+'°'+unit;
  $('#report-plunge-stats').innerHTML=`<div><small>Sessions</small><strong>${stats.count}<small class="sub">${duration(stats.total)} total · longest ${longest?duration(longest):'—'}</small></strong></div><div><small>Temperature</small><strong>${stats.temperature===null?'—':degf(stats.temperature)}<small class="sub">average · coldest ${coldest===null?'—':degf(coldest)}</small></strong></div><div><small>Day streak</small><strong>${streakText(ps)}</strong></div>`;
  const byDate={};plungeRows.forEach(r=>{const e=byDate[r.date]||=(byDate[r.date]={secs:0,temp:null});e.secs+=r.total;const t=r.temperature!==''&&r.temperature!=null&&Number.isFinite(+r.temperature)?(r.unit==='C'?+r.temperature*9/5+32:+r.temperature):null;if(t!==null&&(e.temp===null||t<e.temp))e.temp=t;});
  $('#pcal-months').innerHTML=months.slice().reverse().map(m=>renderMonth(m,byDate,today,db)).join('');
  $('#pcal-months').querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>selectDay(b.dataset.date));
  $('#pcal-months').querySelectorAll('[data-delete-date]').forEach(b=>b.onclick=()=>{if(h.blocked()||!confirm('Delete this cold-plunge session? If it is the last session for this activity, its completion check will clear.'))return;const r=h.db().days[b.dataset.deleteDate];if(r&&deletePlunge(r,b.dataset.deleteTask,Number(b.dataset.deleteIndex))){h.save();h.refresh();}});
 }
 refresh();
 return refresh;
}
