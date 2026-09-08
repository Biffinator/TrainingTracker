import test from 'node:test';
import assert from 'node:assert/strict';
import {parseIcs,mergeAthletica,isAthleticaTask,stableId} from './athletica.js';
import {plan} from './core.js';
// Synthetic fixture mirroring Athletica's real feed shape: folded lines, escaped \n and \,,
// all-day DTSTART with TZID, both duration formats, and a strength session that must be ignored.
const ICS=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:spatie/icalendar-generator','BEGIN:VEVENT','UID:aaa1','DTSTAMP:20260908T183215Z','SUMMARY:Strength and conditioning - Stength & conditioning','DESCRIPTION:As much rest as needed between reps\\, keep quality\\n\\nDuration: 1:00:00','X-MICROSOFT-CDO-ALLDAYEVENT:TRUE','DTSTART;TZID=America/New_York;VALUE=DATE:20260907','END:VEVENT','BEGIN:VEVENT','UID:bbb2','SUMMARY:Bike - Aerobic Development','DESCRIPTION:The aim of this session is to develop your aerobic base.\\n\\nDur',' ation: 45:00\\nDistance: 12 mi\\n\\nEasy 45:00 L2 [Main Set (MS) | 45:00]','DTSTART;TZID=America/New_York;VALUE=DATE:20260908','END:VEVENT','BEGIN:VEVENT','UID:ccc3','SUMMARY:Run - Aerobic Development','DESCRIPTION:Develop your aerobic base.\\n\\nDuration: 20:00\\nDistance: 1.77 mi','DTSTART;TZID=America/New_York;VALUE=DATE:20260908','END:VEVENT','BEGIN:VEVENT','UID:eee5','SUMMARY:Bike - Aerobic Development','DESCRIPTION:Long steady ride.\\n\\nDuration: 2:00:00','DTSTART;TZID=America/New_York;VALUE=DATE:20260912','END:VEVENT','BEGIN:VEVENT','UID:ddd4','SUMMARY:Run - Build pace tempo','DESCRIPTION:Tempo work.\\n\\nDuration: 1:30:00','DTSTART;TZID=America/New_York;VALUE=DATE:20260915','END:VEVENT','END:VCALENDAR'].join('\r\n');
const fresh=()=>({version:2,start:'2026-08-03',days:{},longDay:'Sat'});
test('parses folded, escaped all-day events with both duration formats',()=>{
 const ev=parseIcs(ICS);
 assert.equal(ev.length,5);
 assert.deepEqual(ev.map(e=>e.date),['2026-09-07','2026-09-08','2026-09-08','2026-09-12','2026-09-15']);
 assert.deepEqual(ev.map(e=>e.sport),['Strength and conditioning','Bike','Run','Bike','Run']);
 assert.equal(ev[1].name,'Aerobic Development');
 assert.equal(ev[0].minutes,60);   // 1:00:00
 assert.equal(ev[1].minutes,45);   // folded across lines: "Dur" + "ation: 45:00"
 assert.equal(ev[2].minutes,20);   // 20:00
 assert.equal(ev[3].minutes,120);  // 2:00:00
 assert.equal(ev[4].minutes,90);   // 1:30:00
 assert.match(ev[0].description,/reps, keep quality\n\nDuration/); // \, and \n unescaped
});
test('merge replaces the Endurance placeholder, adds two sessions, keeps Cold plunge',()=>{
 const db=fresh(),events=parseIcs(ICS);
 assert.equal(mergeAthletica(db,events,'2026-09-08'),2); // 09-08 and 09-12 are inside the 7-day window
 assert.equal(db.days['2026-09-07'],undefined); // yesterday: outside the window
 assert.equal(db.days['2026-09-15'],undefined); // today+7: beyond the window, not pinned yet
 const tue=plan('2026-09-08',db.start,db.days,'Sat');
 assert.deepEqual(tue.map(t=>t.n),['Cold plunge','Aerobic Development — Bike · 45 min','Aerobic Development — Run · 20 min']);
 assert.ok(tue.slice(1).every(t=>isAthleticaTask(t)&&!t.optional&&!t.lift));
 assert.deepEqual(tue[2].ex,['Develop your aerobic base.','Duration: 20:00','Distance: 1.77 mi']);
});
test('on the long day the Athletica session takes the Long run/bike slot; the optional HIIT Cycle stays',()=>{
 const db=fresh();
 const before=plan('2026-09-12',db.start,db.days,'Sat').map(t=>t.n);
 assert.ok(before.some(n=>/^Long (run|bike)/.test(n)),'fixture day should carry a Long run/bike slot');
 mergeAthletica(db,parseIcs(ICS),'2026-09-08');
 const sat=plan('2026-09-12',db.start,db.days,'Sat').map(t=>t.n);
 assert.ok(!sat.some(n=>/^Long (run|bike)/.test(n)),'Long run/bike replaced');
 assert.ok(sat.some(n=>n.startsWith('HIIT Cycle')),'optional HIIT Cycle kept');
 assert.equal(sat[0],'Cold plunge');
 assert.ok(sat.includes('Aerobic Development — Bike · 120 min'));
});
test('window is today through today+6 inclusive',()=>{
 const db=fresh();
 assert.equal(mergeAthletica(db,parseIcs(ICS),'2026-09-09'),2); // 09-12 and 09-15 (today+6) in; 09-08 is past -> out
 assert.ok(db.days['2026-09-15']);
 assert.equal(db.days['2026-09-08'],undefined);
});
test('re-merge keeps completion by stable id and drops sessions removed from the feed',()=>{
 const db=fresh();
 mergeAthletica(db,parseIcs(ICS),'2026-09-08');
 db.days['2026-09-08'].done['ath-ccc3']=true;
 const updated=parseIcs(ICS).filter(e=>e.uid!=='bbb2'); // bike dropped from the plan
 assert.equal(mergeAthletica(db,updated,'2026-09-08'),1);
 const tue=plan('2026-09-08',db.start,db.days,'Sat');
 assert.deepEqual(tue.map(t=>t.id),['0','ath-2026-09-08-run-aerobic-development']);
 assert.equal(db.days['2026-09-08'].done['ath-ccc3'],true);
 assert.equal(mergeAthletica(db,updated,'2026-09-08'),0); // idempotent
});
test('ids come from date + sport + name, not the feed UID; duplicates are suffixed',()=>{
 const ev=parseIcs(ICS);
 assert.equal(stableId(ev[1]),'ath-2026-09-08-bike-aerobic-development');
 const seen=new Set();assert.equal(stableId(ev[1],seen),'ath-2026-09-08-bike-aerobic-development');assert.equal(stableId(ev[1],seen),'ath-2026-09-08-bike-aerobic-development-2');
});
test('a re-fetch with brand-new UIDs keeps the checkmark and logged time',()=>{
 const db=fresh();
 mergeAthletica(db,parseIcs(ICS),'2026-09-08');
 const run=plan('2026-09-08',db.start,db.days,'Sat').find(t=>/Run/.test(t.n));
 db.days['2026-09-08'].done[run.id]=true;db.days['2026-09-08'].sessions={[run.id]:{minutes:21.5}};
 const refetched=parseIcs(ICS.replace(/UID:(\w+)/g,'UID:x$1'));
 assert.equal(mergeAthletica(db,refetched,'2026-09-08'),0); // nothing to change: ids are stable
 assert.equal(db.days['2026-09-08'].done[run.id],true);
 assert.equal(db.days['2026-09-08'].sessions[run.id].minutes,21.5);
});
test('rows saved under the old UID-based ids migrate their completion on the next sync',()=>{
 const db=fresh();
 db.days['2026-09-08']={done:{'0':true,'ath-6aa054afa4faf':true},notes:'',missed:false,sets:{},sessions:{'ath-6aa054afa4faf':{minutes:20}},tasks:[{id:'0',n:'Cold plunge',lift:false,optional:false,ex:[]},{id:'ath-6aa054afa4faf',n:'Aerobic Development — Run · 20 min',lift:false,optional:false,ex:[]},{id:'ath-6aa054afa4fe1',n:'Aerobic Development — Bike · 45 min',lift:false,optional:false,ex:[]}]};
 assert.equal(mergeAthletica(db,parseIcs(ICS),'2026-09-08'),2);
 const r=db.days['2026-09-08'];
 assert.deepEqual(Object.keys(r.done).sort(),['0','ath-2026-09-08-run-aerobic-development']);
 assert.equal(r.done['ath-2026-09-08-run-aerobic-development'],true);
 assert.deepEqual(r.sessions,{'ath-2026-09-08-run-aerobic-development':{minutes:20}});
 assert.ok(!r.tasks.some(t=>t.id.startsWith('ath-6aa')));
});
test('a strength session replaces the day\'s Lift A/B/C and is flagged as a lift',()=>{
 const db=fresh();
 const before=plan('2026-09-07',db.start,db.days,'Sat');
 assert.ok(before.some(t=>t.lift&&/^Lift [ABC]/.test(t.n)),'Monday carries a program lift');
 assert.equal(mergeAthletica(db,parseIcs(ICS),'2026-09-07'),3); // 09-07, 09-08, 09-12
 const mon=plan('2026-09-07',db.start,db.days,'Sat');
 assert.ok(!mon.some(t=>/^Lift [ABC]/.test(t.n)),'program lift replaced');
 const s=mon.find(isAthleticaTask);
 assert.equal(s.n,'Stength & conditioning — Strength and conditioning · 60 min');
 assert.equal(s.lift,true);
 assert.equal(s.id,'ath-2026-09-07-strength-and-conditioning-stength-conditioning');
 assert.equal(mon[0].n,'Cold plunge');
 assert.ok(mon.some(t=>/treadmill/i.test(t.n)),'treadmill day untouched');
});
test('days without an Athletica strength session keep the program lift',()=>{
 const db=fresh();
 mergeAthletica(db,parseIcs(ICS),'2026-09-07');
 const wed=plan('2026-09-09',db.start,db.days,'Sat');
 assert.ok(wed.some(t=>/^Lift [ABC]/.test(t.n)));
});
test('past days with older synced sessions are left untouched',()=>{
 const db=fresh();
 db.days['2026-08-25']={done:{'ath-old':true},notes:'',missed:false,sets:{},tasks:[{id:'0',n:'Cold plunge',lift:false,optional:false,ex:[]},{id:'ath-old',n:'Old — Run · 30 min',lift:false,optional:false,ex:[]}]};
 mergeAthletica(db,parseIcs(ICS),'2026-09-08');
 assert.equal(db.days['2026-08-25'].tasks.length,2);
});
