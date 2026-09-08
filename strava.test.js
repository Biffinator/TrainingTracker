import test from 'node:test';
import assert from 'node:assert/strict';
import {stravaKind,applyStrava} from './strava.js';
import {plan} from './core.js';
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
 assert.equal(applyStrava(db,[ride,run],'2026-09-08'),2);
 const r=db.days['2026-09-08'];
 assert.deepEqual(r.sessions,{'ath-2026-09-08-run-aerobic-development':{minutes:21.25,strava:101},'ath-2026-09-08-bike-aerobic-development':{minutes:45.2,strava:102}});
 assert.equal(r.done['ath-2026-09-08-run-aerobic-development'],true);
 assert.equal(r.done['ath-2026-09-08-bike-aerobic-development'],true);
 assert.equal(r.done['0'],undefined); // cold plunge untouched
});
test('re-applying is a no-op; a second run the same day finds no free row; a deleted activity frees its row',()=>{
 const db=withAthletica(fresh());
 applyStrava(db,[run],'2026-09-08');
 assert.equal(applyStrava(db,[run],'2026-09-08'),0);
 assert.equal(applyStrava(db,[run,{...run,id:103,moving_time:1500}],'2026-09-08'),0); // row held by 101, which is still on Strava
 assert.equal(applyStrava(db,[{...run,id:103,moving_time:1500}],'2026-09-08'),1); // 101 gone from Strava: the row takes 103
 assert.deepEqual(db.days['2026-09-08'].sessions['ath-2026-09-08-run-aerobic-development'],{minutes:25,strava:103});
});
test('a manually entered time is never overwritten',()=>{
 const db=withAthletica(fresh());
 db.days['2026-09-08'].sessions={'ath-2026-09-08-run-aerobic-development':{minutes:22}};
 assert.equal(applyStrava(db,[run],'2026-09-08'),0);
 assert.deepEqual(db.days['2026-09-08'].sessions['ath-2026-09-08-run-aerobic-development'],{minutes:22});
});
test('program days work too: a weight-training upload checks Lift A/B/C, a walk checks the treadmill',()=>{
 const db=fresh();
 const mon=plan('2026-09-07',db.start,db.days,'Sat');
 const lift=mon.find(t=>t.lift),tread=mon.find(t=>/treadmill/i.test(t.n));
 assert.ok(lift&&tread);
 assert.equal(applyStrava(db,[{id:201,sport_type:'WeightTraining',start_date_local:'2026-09-07T06:00:00Z',moving_time:3300},{id:202,sport_type:'Walk',start_date_local:'2026-09-07T12:00:00Z',moving_time:1800}],'2026-09-08'),2);
 const r=db.days['2026-09-07'];
 assert.equal(r.done[lift.id],true);assert.equal(r.sessions[lift.id].minutes,55);
 assert.equal(r.done[tread.id],true);assert.equal(r.sessions[tread.id].minutes,30);
});
test('future dates, pre-start dates, unmatched sports and sub-minute blips are ignored',()=>{
 const db=withAthletica(fresh());
 assert.equal(applyStrava(db,[{...run,start_date_local:'2026-09-09T07:00:00Z'},{...run,id:9,start_date_local:'2026-07-01T07:00:00Z'},{id:5,sport_type:'Swim',start_date_local:'2026-09-08T07:00:00Z',moving_time:1800},{...run,id:6,moving_time:40}],'2026-09-08'),0);
 assert.deepEqual(db.days['2026-09-08'].done,{});
 assert.equal(db.days['2026-09-09'],undefined);
});
