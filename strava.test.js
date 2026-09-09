import test from 'node:test';
import assert from 'node:assert/strict';
import {stravaKind,applyStrava} from './strava.js';
import {plan} from './core.js';
import {workoutKind} from './wellness.js';
const fresh=()=>({version:2,start:'2026-08-03',days:{},longDay:'Sat'});
// Tuesday 2026-09-08 with two synced Athletica rows, as the merge would leave them.
const withAthletica=db=>{db.days['2026-09-08']={done:{},notes:'',missed:false,sets:{},tasks:[{id:'0',n:'Cold plunge',lift:false,optional:false,ex:[]},{id:'ath-2026-09-08-run-aerobic-development',n:'Aerobic Development — Run · 20 min',lift:false,optional:false,ex:[]},{id:'ath-2026-09-08-bike-aerobic-development',n:'Aerobic Development — Bike · 45 min',lift:false,optional:false,ex:[]}]};return db;};
const run={id:101,name:'Morning Run',sport_type:'Run',start_date_local:'2026-09-08T07:02:11Z',moving_time:1275,elapsed_time:1300,distance:2850};
const ride={id:102,name:'Trainer',sport_type:'VirtualRide',start_date_local:'2026-09-08T17:30:00Z',moving_time:2712,elapsed_time:2712,distance:20000};
test('sport types map to the app buckets',()=>{
 assert.deepEqual(['Run','TrailRun','VirtualRun','Ride','VirtualRide','GravelRide','MountainBikeRide','EBikeRide','WeightTraining','Crossfit','Workout','Walk','Hike','Swim'].map(t=>stravaKind({sport_type:t})),
  ['run','run','run','bike','bike','bike','bike','bike','strength','strength','strength','walk','walk','other']);
 assert.equal(stravaKind({type:'Ride'}),'bike'); // older payloads only have `type`
});
test('run and ride fill in their Athletica rows with moving time and check them off',()=>{
 const db=withAthletica(fresh());
 const res=applyStrava(db,[ride,run],'2026-09-08');
 assert.equal(res.applied,2);assert.deepEqual(res.unmatched,[]);
 assert.deepEqual(res.matched.map(m=>[m.type,m.task,m.done]),[['Run','Aerobic Development',true],['VirtualRide','Aerobic Development',true]]);
 const r=db.days['2026-09-08'];
 assert.deepEqual(r.sessions,{'ath-2026-09-08-run-aerobic-development':{minutes:21.25,strava:101},'ath-2026-09-08-bike-aerobic-development':{minutes:45.2,strava:102}});
 assert.equal(r.done['ath-2026-09-08-run-aerobic-development'],true);
 assert.equal(r.done['ath-2026-09-08-bike-aerobic-development'],true);
 assert.equal(r.done['0'],undefined); // cold plunge untouched
});
test('re-applying is a no-op; a second run the same day finds no free row; a deleted activity frees its row',()=>{
 const db=withAthletica(fresh());
 applyStrava(db,[run],'2026-09-08');
 const again=applyStrava(db,[run],'2026-09-08');assert.equal(again.applied,0);assert.equal(again.matched.length,1); // still counts as matched
 const second=applyStrava(db,[run,{...run,id:103,moving_time:1500}],'2026-09-08'); // row held by 101, which is still on Strava
 assert.equal(second.applied,0);assert.equal(second.matched.length,1);assert.deepEqual(second.unmatched.map(u=>u.id),[103]);
 assert.equal(applyStrava(db,[{...run,id:103,moving_time:1500}],'2026-09-08').applied,1); // 101 gone from Strava: the row takes 103
 assert.deepEqual(db.days['2026-09-08'].sessions['ath-2026-09-08-run-aerobic-development'],{minutes:25,strava:103});
});
test('an unchecked linked row is re-checked, and an edited activity updates the time',()=>{
 const db=withAthletica(fresh());const id='ath-2026-09-08-run-aerobic-development';
 applyStrava(db,[run],'2026-09-08');
 db.days['2026-09-08'].done[id]=false; // user unticked it
 assert.equal(applyStrava(db,[run],'2026-09-08').applied,1);
 assert.equal(db.days['2026-09-08'].done[id],true);
 assert.equal(applyStrava(db,[{...run,moving_time:1300}],'2026-09-08').applied,1); // Strava edit
 assert.deepEqual(db.days['2026-09-08'].sessions[id],{minutes:21.6667,strava:101});
 assert.equal(applyStrava(db,[{...run,moving_time:1300}],'2026-09-08').applied,0); // then idempotent
});
test('the watch is the record: a typed time is replaced and the row linked',()=>{
 const db=withAthletica(fresh());
 db.days['2026-09-08'].sessions={'ath-2026-09-08-run-aerobic-development':{minutes:22}};db.days['2026-09-08'].done['ath-2026-09-08-run-aerobic-development']=true;
 assert.equal(applyStrava(db,[run],'2026-09-08').applied,1);
 assert.deepEqual(db.days['2026-09-08'].sessions['ath-2026-09-08-run-aerobic-development'],{minutes:21.25,strava:101});
});
test('program days work too: a weight-training upload checks Lift A/B/C, a walk checks the treadmill',()=>{
 const db=fresh();
 const mon=plan('2026-09-07',db.start,db.days,'Sat');
 const lift=mon.find(t=>t.lift),tread=mon.find(t=>/treadmill/i.test(t.n));
 assert.ok(lift&&tread);
 assert.equal(applyStrava(db,[{id:201,sport_type:'WeightTraining',start_date_local:'2026-09-07T06:00:00Z',moving_time:3300},{id:202,sport_type:'Walk',start_date_local:'2026-09-07T12:00:00Z',moving_time:1800}],'2026-09-08').applied,2);
 const r=db.days['2026-09-07'];
 assert.equal(r.done[lift.id],true);assert.equal(r.sessions[lift.id].minutes,55);
 assert.equal(r.done[tread.id],true);assert.equal(r.sessions[tread.id].minutes,30);
});
test('the sport segment decides the kind, not the workout name',()=>{
 assert.equal(workoutKind({n:'Strength Endurance — Run · 40 min',lift:false}),'run');
 assert.equal(workoutKind({n:'Stength & conditioning — Strength and conditioning · 60 min',lift:true}),'strength');
 assert.equal(workoutKind({n:'Run Prep — Bike · 30 min',lift:false}),'bike');
 assert.equal(workoutKind({n:'Treadmill — 30 min @ 3.0 mph, 13–15% incline',lift:false}),'walk');
 const db=fresh();
 db.days['2026-09-10']={done:{},notes:'',missed:false,sets:{},tasks:[{id:'0',n:'Cold plunge',lift:false,optional:false,ex:[]},{id:'x',n:'Strength Endurance — Run · 40 min',lift:false,optional:false,ex:[]}]};
 assert.equal(applyStrava(db,[{id:301,sport_type:'Run',start_date_local:'2026-09-10T06:30:00Z',moving_time:2400}],'2026-09-10').applied,1);
 assert.equal(db.days['2026-09-10'].done.x,true);
});
test('future dates, pre-start dates, unmatched sports and sub-minute blips are ignored',()=>{
 const db=withAthletica(fresh());
 const res=applyStrava(db,[{...run,start_date_local:'2026-09-09T07:00:00Z'},{...run,id:9,start_date_local:'2026-07-01T07:00:00Z'},{id:5,name:'Pool',sport_type:'Swim',start_date_local:'2026-09-08T07:00:00Z',moving_time:1800},{...run,id:6,moving_time:40}],'2026-09-08');
 assert.equal(res.applied,0);assert.deepEqual(res.unmatched,[{id:5,name:'Pool',type:'Swim',date:'2026-09-08'}]); // only the in-range swim is reported
 assert.deepEqual(db.days['2026-09-08'].done,{});
 assert.equal(db.days['2026-09-09'],undefined);
});
