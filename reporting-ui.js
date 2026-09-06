import {periodRange,rangeSummary,shiftAnchor,isCurrentPeriod,NAVIGABLE,PERIODS,sixMonthSpan,shiftMonths,isCurrentSixMonth} from './reporting.js?v=3.18.0';
import {sessions,statistics,duration} from './plunge.js?v=3.18.0';
import {deletePlunge} from './deletion.js?v=3.18.0';
import {weekday} from './core.js?v=3.18.0';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const monthLabel=d=>new Date(d+'T12:00:00').toLocaleDateString(undefined,{month:'long',year:'numeric'});
const monthShort=d=>new Date(d+'T12:00:00').toLocaleDateString(undefined,{month:'short',year:'2-digit'});
export function mountReporting(h){
 let anchor=h.today();
 let calAnchor=h.today().slice(0,7)+'-01';
 let selectedDay=null;
 let box=document.getElementById('report-panel');
 if(!box){
  box=document.createElement('section');box.id='report-panel';box.className='card';box.hidden=true;box.setAttribute('aria-label','Training reports');
  box.innerHTML=`<h2>Reporting</h2><label>Period<select id="report-period">${PERIODS.map(([v,t])=>`<option value="${v}">${esc(t)}</option>`).join('')}</select></label><div class="bar" id="report-nav" hidden><button id="report-prev" aria-label="Previous period">←</button><h3 id="report-range-label"></h3><button id="report-next" aria-label="Next period">→</button></div><button id="report-today-btn" hidden>Back to current</button><p id="report-range" class="muted"></p><div class="plunge-stats" id="report-stats"></div><p class="muted">Actual minutes come from checking workouts complete on the Day view. Unlogged sessions are not counted as zero.</p><hr><h3>Cold plunge</h3><div class="bar" id="pcal-nav"><button id="pcal-prev" aria-label="Previous 6 months">←</button><h4 id="pcal-range-label"></h4><button id="pcal-next" aria-label="Next 6 months">→</button></div><div class="plunge-stats" id="report-plunge-stats"></div><div class="pcal-months" id="pcal-months"></div><div id="pcal-detail"></div>`;
  document.querySelector('.layout').after(box);
  let saved=null;try{saved=localStorage.getItem('hybridReportPeriod');}catch{}
  if(saved&&PERIODS.some(p=>p[0]===saved))box.querySelector('#report-period').value=saved;
  box.querySelector('#report-period').onchange=e=>{try{localStorage.setItem('hybridReportPeriod',e.target.value);}catch{}refresh();};
  box.querySelector('#report-prev').onclick=()=>{anchor=shiftAnchor($('#report-period').value,anchor,-1);refresh();};
  box.querySelector('#report-next').onclick=()=>{anchor=shiftAnchor($('#report-period').value,anchor,1);refresh();};
  box.querySelector('#report-today-btn').onclick=()=>{anchor=h.today();refresh();};
  box.querySelector('#pcal-prev').onclick=()=>{calAnchor=shiftMonths(calAnchor,-6);selectedDay=null;refresh();};
  box.querySelector('#pcal-next').onclick=()=>{calAnchor=shiftMonths(calAnchor,6);selectedDay=null;refresh();};
 }
 const $=id=>box.querySelector(id.startsWith('#')?id:'#'+id);
 function renderMonth(monthStart,byDate,today){
  const wd=weekday(monthStart);
  const daysInMonth=new Date(shiftMonths(monthStart,1)+'T12:00:00');daysInMonth.setDate(0);
  const days=daysInMonth.getDate();
  let cells='';
  for(let i=0;i<wd;i++)cells+='<span class="pcal-pad"></span>';
  for(let day=1;day<=days;day++){
   const d=monthStart.slice(0,8)+String(day).padStart(2,'0');
   const mins=byDate[d]?Math.round(byDate[d]/60):0;
   const tier=mins<=0?'':mins<10?'low':mins<20?'mid':'high';
   const future=d>today;
   cells+=`<button type="button" class="pcal-day ${tier} ${d===today?'today':''} ${d===selectedDay?'selected':''}" data-date="${d}" ${future?'disabled':''} title="${esc(d)}${mins?': '+mins+' min':''}">${day}</button>`;
  }
  return `<div class="pcal-month"><h5>${esc(monthLabel(monthStart))}</h5><div class="pcal-grid">${cells}</div></div>`;
 }
 function selectDay(d){selectedDay=d;refresh();}
 function refresh(){
  const db=h.db(),today=h.today(),period=$('#report-period').value,navigable=NAVIGABLE.has(period);
  const {start,end}=periodRange(period,navigable?anchor:today,today);
  $('#report-nav').hidden=!navigable;
  $('#report-today-btn').hidden=!navigable||isCurrentPeriod(period,anchor,today);
  if(navigable){
   $('#report-next').disabled=isCurrentPeriod(period,anchor,today);
   $('#report-range-label').textContent=period==='week'?`${start} – ${end}`:monthLabel(start);
  }
  $('#report-range').textContent=start+' to '+end;
  const s=rangeSummary(db,start,end);
  $('#report-stats').innerHTML=`<div><small>Workouts done</small><strong>${s.completed} / ${s.planned}</strong></div><div><small>Actual minutes</small><strong>${s.logged?s.minutes:'—'}</strong></div>`;
  const months=sixMonthSpan(calAnchor);
  $('#pcal-range-label').textContent=`${monthShort(months[0])} – ${monthShort(calAnchor)}`;
  $('#pcal-next').disabled=isCurrentSixMonth(calAnchor,today);
  const calStart=months[0],calEnd=periodRange('month',calAnchor,today).end;
  const plungeRows=sessions(db).filter(r=>r.date>=calStart&&r.date<=calEnd),unit='F',stats=statistics(plungeRows,unit);
  $('#report-plunge-stats').innerHTML=`<div><small>Sessions</small><strong>${stats.count}</strong></div><div><small>Total time</small><strong>${duration(stats.total)}</strong></div><div><small>Average temperature</small><strong>${stats.temperature===null?'—':stats.temperature.toFixed(1)+'°'+unit}</strong></div>`;
  const byDate={};plungeRows.forEach(r=>byDate[r.date]=(byDate[r.date]||0)+r.total);
  $('#pcal-months').innerHTML=months.map(m=>renderMonth(m,byDate,today)).join('');
  $('#pcal-months').querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>selectDay(b.dataset.date));
  if(selectedDay){
   const rows=sessions(db).filter(r=>r.date===selectedDay);
   $('#pcal-detail').innerHTML=`<h4>${esc(selectedDay)}</h4>`+(rows.length?rows.map(r=>`<p class="plunge-feed-item">${duration(r.total)} · ${r.temperature!==''&&r.temperature!=null?esc(r.unit==='C'?+(Number(r.temperature)*9/5+32).toFixed(2):r.temperature)+'°F':'Temperature not recorded'} <button data-delete-date="${esc(r.date)}" data-delete-task="${esc(r.task)}" data-delete-index="${r.index}" ${h.blocked()?'disabled':''}>Delete</button></p>`).join(''):'<p class="muted">No sessions.</p>');
   $('#pcal-detail').querySelectorAll('[data-delete-date]').forEach(b=>b.onclick=()=>{if(h.blocked()||!confirm('Delete this cold-plunge session? If it is the last session for this activity, its completion check will clear.'))return;const r=h.db().days[b.dataset.deleteDate];if(r&&deletePlunge(r,b.dataset.deleteTask,Number(b.dataset.deleteIndex))){h.save();h.refresh();}});
  }else{
   $('#pcal-detail').innerHTML='<p class="muted">Tap a day to see its sessions.</p>';
  }
 }
 refresh();
 return refresh;
}
