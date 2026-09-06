import {addDays} from './core.js?v=3.16.0';
import {daySummary} from './wellness.js?v=3.16.0';
export const PERIODS=[['week','This week'],['month','This month'],['3m','Last 3 months'],['6m','Last 6 months'],['year','Last 12 months'],['ytd','Year to date']];
export function periodRange(period,date){
 if(period==='week'){const dt=new Date(date+'T12:00:00');const back=(dt.getDay()+6)%7;return {start:addDays(date,-back),end:date};}
 if(period==='month')return {start:date.slice(0,7)+'-01',end:date};
 if(period==='3m')return {start:addDays(date,-89),end:date};
 if(period==='6m')return {start:addDays(date,-181),end:date};
 if(period==='year')return {start:addDays(date,-364),end:date};
 return {start:date.slice(0,4)+'-01-01',end:date};
}
export function rangeSummary(db,start,end){
 let planned=0,completed=0,minutes=0,cardio=0,load=0,rated=0,logged=0;const groups={};
 for(let d=start;d<=end;d=addDays(d,1)){
  const s=daySummary(db,d);
  planned+=s.planned;completed+=s.completed;minutes+=s.minutes;cardio+=s.cardio;load+=s.load;rated+=s.rated;logged+=s.logged;
  for(const k in s.groups)groups[k]=(groups[k]||0)+s.groups[k];
 }
 return {planned,completed,minutes,cardio,load,rated,logged,groups};
}
