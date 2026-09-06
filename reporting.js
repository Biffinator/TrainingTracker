import {addDays} from './core.js?v=3.18.0';
import {daySummary} from './wellness.js?v=3.18.0';
export const PERIODS=[['week','This week'],['month','This month'],['3m','Last 3 months'],['6m','Last 6 months'],['year','Last 12 months'],['ytd','Year to date']];
export const NAVIGABLE=new Set(['week','month']);
export function shiftMonths(monthStart,delta){const d=new Date(monthStart.slice(0,7)+'-01T12:00:00');d.setMonth(d.getMonth()+delta);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;}
export function periodRange(period,anchor,today){
 if(period==='week'){const dt=new Date(anchor+'T12:00:00');const back=(dt.getDay()+6)%7;const start=addDays(anchor,-back);let end=addDays(start,6);if(end>today)end=today;return {start,end};}
 if(period==='month'){const start=anchor.slice(0,7)+'-01';const lastDay=new Date(shiftMonths(start,1)+'T12:00:00');lastDay.setDate(0);let end=anchor.slice(0,7)+'-'+String(lastDay.getDate()).padStart(2,'0');if(end>today)end=today;return {start,end};}
 if(period==='3m')return {start:addDays(today,-89),end:today};
 if(period==='6m')return {start:addDays(today,-181),end:today};
 if(period==='year')return {start:addDays(today,-364),end:today};
 return {start:today.slice(0,4)+'-01-01',end:today};
}
export function shiftAnchor(period,anchor,delta){
 if(period==='week')return addDays(anchor,delta*7);
 if(period==='month')return shiftMonths(anchor,delta);
 return anchor;
}
export function isCurrentPeriod(period,anchor,today){
 if(period==='week')return periodRange('week',anchor,today).start<=today&&addDays(periodRange('week',anchor,today).start,6)>=today;
 if(period==='month')return anchor.slice(0,7)===today.slice(0,7);
 return true;
}
export function sixMonthSpan(anchorMonth){const months=[];for(let i=5;i>=0;i--)months.push(shiftMonths(anchorMonth,-i));return months;}
export function isCurrentSixMonth(anchorMonth,today){return anchorMonth.slice(0,7)===today.slice(0,7);}
export function rangeSummary(db,start,end){
 let planned=0,completed=0,minutes=0,cardio=0,logged=0;
 for(let d=start;d<=end;d=addDays(d,1)){
  const s=daySummary(db,d);
  planned+=s.planned;completed+=s.completed;minutes+=s.minutes;cardio+=s.cardio;logged+=s.logged;
 }
 return {planned,completed,minutes,cardio,logged};
}
