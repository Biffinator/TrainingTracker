import {periodRange,rangeSummary,PERIODS} from './reporting.js?v=3.16.2';
import {sessions,statistics,duration} from './plunge.js?v=3.16.2';
import {deletePlunge} from './deletion.js?v=3.16.2';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountReporting(h){
 let box=document.getElementById('report-panel');
 if(!box){
  box=document.createElement('section');box.id='report-panel';box.className='card';box.hidden=true;box.setAttribute('aria-label','Training reports');
  box.innerHTML=`<h2>Reporting</h2><label>Period<select id="report-period">${PERIODS.map(([v,t])=>`<option value="${v}">${esc(t)}</option>`).join('')}</select></label><p id="report-range" class="muted"></p><div class="plunge-stats" id="report-stats"></div><p class="muted">Actual minutes and effort come from checking workouts complete on the Day view. Unlogged sessions are not counted as zero.</p><details open><summary>Sets by muscle area</summary><div id="report-groups"></div></details><hr><h3>Cold plunge</h3><div class="plunge-stats" id="report-plunge-stats"></div><details><summary>Activity chart</summary><div id="report-plunge-chart" class="plunge-chart"></div></details><details><summary>Session feed</summary><div id="report-plunge-feed"></div></details>`;
  document.querySelector('.layout').after(box);
  let saved=null;try{saved=localStorage.getItem('hybridReportPeriod');}catch{}
  if(saved&&PERIODS.some(p=>p[0]===saved))box.querySelector('#report-period').value=saved;
  box.querySelector('#report-period').onchange=e=>{try{localStorage.setItem('hybridReportPeriod',e.target.value);}catch{}refresh();};
 }
 const $=id=>box.querySelector('#'+id);
 function refresh(){
  const db=h.db(),date=h.today(),period=$('report-period').value,{start,end}=periodRange(period,date);
  $('report-range').textContent=start+' to '+end;
  const s=rangeSummary(db,start,end);
  $('report-stats').innerHTML=`<div><small>Workouts done</small><strong>${s.completed} / ${s.planned}</strong></div><div><small>Actual minutes</small><strong>${s.logged?s.minutes:'—'}</strong></div><div><small>Effort units</small><strong>${s.rated?s.load:'—'}</strong></div>`;
  $('report-groups').innerHTML=Object.keys(s.groups).length?'<ul>'+Object.entries(s.groups).map(([k,v])=>`<li>${esc(k)}: ${v}</li>`).join('')+'</ul>':'<p class="muted">No set reps recorded in this period.</p>';
  const rows=sessions(db).filter(r=>r.date>=start&&r.date<=end),unit='F',stats=statistics(rows,unit);
  $('report-plunge-stats').innerHTML=`<div><small>Sessions</small><strong>${stats.count}</strong></div><div><small>Total time</small><strong>${duration(stats.total)}</strong></div><div><small>Average temperature</small><strong>${stats.temperature===null?'—':stats.temperature.toFixed(1)+'°'+unit}</strong></div>`;
  $('report-plunge-feed').innerHTML=rows.length?rows.map(s=>`<article class="plunge-feed-item"><b>${esc(s.date)} ${esc(s.time)}</b><p>${duration(s.total)} · ${s.temperature!==''&&s.temperature!=null?esc(s.unit==='C'?+(Number(s.temperature)*9/5+32).toFixed(2):s.temperature)+'°F':'Temperature not recorded'}</p><button data-delete-date="${esc(s.date)}" data-delete-task="${esc(s.task)}" data-delete-index="${s.index}" ${h.blocked()?'disabled':''}>Delete session</button></article>`).join(''):'<p>No sessions recorded in this period.</p>';
  $('report-plunge-feed').querySelectorAll('[data-delete-date]').forEach(b=>b.onclick=()=>{if(h.blocked()||!confirm('Delete this cold-plunge session? If it is the last session for this activity, its completion check will clear.'))return;const r=h.db().days[b.dataset.deleteDate];if(r&&deletePlunge(r,b.dataset.deleteTask,Number(b.dataset.deleteIndex))){h.save();h.refresh();}});
  const counts={};rows.forEach(s=>counts[s.date]=(counts[s.date]||0)+1);
  $('report-plunge-chart').innerHTML=Object.keys(counts).sort().map(d=>`<div><small>${esc(d)}</small><span style="width:${Math.min(100,counts[d]*20)}%">${counts[d]} session${counts[d]===1?'':'s'}</span></div>`).join('')||'<p>No sessions yet.</p>';
 }
 refresh();
 return refresh;
}
