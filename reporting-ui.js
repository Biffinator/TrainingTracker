import {periodRange,rangeSummary,shiftAnchor,isCurrentPeriod,NAVIGABLE,PERIODS} from './reporting.js?v=3.17.2';
import {sessions,statistics,duration} from './plunge.js?v=3.17.2';
import {deletePlunge} from './deletion.js?v=3.17.2';
import {addDays} from './core.js?v=3.17.2';
import {daySummary} from './wellness.js?v=3.17.2';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const weekday=d=>new Date(d+'T12:00:00').toLocaleDateString(undefined,{weekday:'short'});
const monthLabel=d=>new Date(d+'T12:00:00').toLocaleDateString(undefined,{month:'long',year:'numeric'});
export function mountReporting(h){
 let anchor=h.today();
 let box=document.getElementById('report-panel');
 if(!box){
  box=document.createElement('section');box.id='report-panel';box.className='card';box.hidden=true;box.setAttribute('aria-label','Training reports');
  box.innerHTML=`<h2>Reporting</h2><label>Period<select id="report-period">${PERIODS.map(([v,t])=>`<option value="${v}">${esc(t)}</option>`).join('')}</select></label><div class="bar" id="report-nav" hidden><button id="report-prev" aria-label="Previous period">←</button><h3 id="report-range-label"></h3><button id="report-next" aria-label="Next period">→</button></div><button id="report-today-btn" hidden>Back to current</button><p id="report-range" class="muted"></p><div class="plunge-stats" id="report-stats"></div><p class="muted">Actual minutes and effort come from checking workouts complete on the Day view. Unlogged sessions are not counted as zero.</p><hr><h3>Cold plunge</h3><div class="plunge-stats" id="report-plunge-stats"></div><div id="report-daily"></div><details id="report-chart-details"><summary>Activity chart</summary><div id="report-plunge-chart" class="plunge-chart"></div></details><details><summary>Session feed</summary><div id="report-plunge-feed"></div></details>`;
  document.querySelector('.layout').after(box);
  let saved=null;try{saved=localStorage.getItem('hybridReportPeriod');}catch{}
  if(saved&&PERIODS.some(p=>p[0]===saved))box.querySelector('#report-period').value=saved;
  box.querySelector('#report-period').onchange=e=>{try{localStorage.setItem('hybridReportPeriod',e.target.value);}catch{}refresh();};
  box.querySelector('#report-prev').onclick=()=>{anchor=shiftAnchor($('#report-period').value,anchor,-1);refresh();};
  box.querySelector('#report-next').onclick=()=>{anchor=shiftAnchor($('#report-period').value,anchor,1);refresh();};
  box.querySelector('#report-today-btn').onclick=()=>{anchor=h.today();refresh();};
 }
 const $=id=>box.querySelector(id.startsWith('#')?id:'#'+id);
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
  $('#report-stats').innerHTML=`<div><small>Workouts done</small><strong>${s.completed} / ${s.planned}</strong></div><div><small>Actual minutes</small><strong>${s.logged?s.minutes:'—'}</strong></div><div><small>Effort units</small><strong>${s.rated?s.load:'—'}</strong></div>`;
  const rows=sessions(db).filter(r=>r.date>=start&&r.date<=end),unit='F',stats=statistics(rows,unit);
  const byDate={};rows.forEach(r=>(byDate[r.date]||=[]).push(r));
  $('#report-plunge-stats').innerHTML=`<div><small>Sessions</small><strong>${stats.count}</strong></div><div><small>Total time</small><strong>${duration(stats.total)}</strong></div><div><small>Average temperature</small><strong>${stats.temperature===null?'—':stats.temperature.toFixed(1)+'°'+unit}</strong></div>`;
  $('#report-chart-details').hidden=navigable;
  if(navigable){
   let dayRows='';
   for(let d=start;d<=end;d=addDays(d,1)){
    const ds=daySummary(db,d),dayPlunges=byDate[d]||[],dayStats=statistics(dayPlunges,unit);
    dayRows+=`<tr><td>${weekday(d)} ${d.slice(5)}</td><td>${ds.planned?ds.completed+' / '+ds.planned:'—'}</td><td>${ds.logged?ds.minutes:'—'}</td><td>${ds.rated?ds.load:'—'}</td><td>${dayStats.count||'—'}</td><td>${dayStats.count?duration(dayStats.total):'—'}</td><td>${dayStats.temperature===null?'—':dayStats.temperature.toFixed(0)+'°'}</td></tr>`;
   }
   $('#report-daily').innerHTML=`<div class="table-scroll"><table><thead><tr><th>Date</th><th>Done/Planned</th><th>Min</th><th>Effort</th><th>Plunges</th><th>Plunge time</th><th>Avg °F</th></tr></thead><tbody>${dayRows}</tbody></table></div>`;
  }else{
   $('#report-daily').innerHTML='';
   const counts={};rows.forEach(s=>counts[s.date]=(counts[s.date]||0)+1);
   $('#report-plunge-chart').innerHTML=Object.keys(counts).sort().map(d=>{const dayStats=statistics(byDate[d],unit);return `<div><small>${esc(d)}</small><span style="width:${Math.min(100,counts[d]*20)}%">${counts[d]} session${counts[d]===1?'':'s'} · ${duration(dayStats.total)}${dayStats.temperature===null?'':' · '+dayStats.temperature.toFixed(0)+'°'+unit}</span></div>`;}).join('')||'<p>No sessions yet.</p>';
  }
  $('#report-plunge-feed').innerHTML=rows.length?rows.map(s=>`<article class="plunge-feed-item"><b>${esc(s.date)} ${esc(s.time)}</b><p>${duration(s.total)} · ${s.temperature!==''&&s.temperature!=null?esc(s.unit==='C'?+(Number(s.temperature)*9/5+32).toFixed(2):s.temperature)+'°F':'Temperature not recorded'}</p><button data-delete-date="${esc(s.date)}" data-delete-task="${esc(s.task)}" data-delete-index="${s.index}" ${h.blocked()?'disabled':''}>Delete session</button></article>`).join(''):'<p>No sessions recorded in this period.</p>';
  $('#report-plunge-feed').querySelectorAll('[data-delete-date]').forEach(b=>b.onclick=()=>{if(h.blocked()||!confirm('Delete this cold-plunge session? If it is the last session for this activity, its completion check will clear.'))return;const r=h.db().days[b.dataset.deleteDate];if(r&&deletePlunge(r,b.dataset.deleteTask,Number(b.dataset.deleteIndex))){h.save();h.refresh();}});
 }
 refresh();
 return refresh;
}
