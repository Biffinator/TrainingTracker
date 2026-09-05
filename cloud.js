import {request,decision,changed} from './cloud-api.js';
import {validateBackup} from './core.js';
export function connectCloud(hooks){
 const $=id=>document.getElementById(id);let session=null,meta=null,busy=false,epoch=0,conflict=null,timer;
 const state=s=>$('cloud-status').textContent=s;
 const metaKey=()=>`hybridCloudMeta:${session.user.id}`;
 const persist=()=>localStorage.setItem(metaKey(),JSON.stringify(meta));
 const clone=x=>JSON.parse(JSON.stringify(x));
 function ui(){ $('cloud-login').hidden=!!session;$('cloud-controls').hidden=!session;$('cloud-account').textContent=session?.user.email||'';}
 async function token(){if(!session)throw Error('Sign in to sync.');if(session.expires_at<Date.now()/1000+60){const s=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}});session={...s,expires_at:Date.now()/1000+s.expires_in};}return session.access_token;}
 async function remote(){const rows=await request('/rest/v1/tracker_state?select=payload,revision,updated_at',{token:await token()});if(!Array.isArray(rows)||rows.length>1)throw Error('Unexpected cloud response.');if(rows[0])validateBackup(rows[0].payload);return rows[0]||null;}
 function queue(){clearTimeout(timer);if(session){state(navigator.onLine?'Saved locally · waiting to sync':'Offline · saved locally');timer=setTimeout(sync,1600);}}
 function dirty(){if(!session)return;try{meta.dirty=true;persist();queue();}catch(e){state('Local sync information could not be saved. Export a backup.');}}
 async function sync(){
  if(!session||busy||conflict||!hooks.available())return;
  if(!navigator.onLine){state('Offline · saved locally. Reconnect to sync.');return;}
  if(document.activeElement?.matches('input,textarea')){clearTimeout(timer);timer=setTimeout(sync,2000);return;}
  busy=true;const run=epoch;state('Syncing…');
  try{
   const cloud=await remote();if(run!==epoch)return;
   const local=clone(hooks.get()),action=decision(local,cloud,meta.revision,meta.dirty);
   if(action==='conflict'){conflict=cloud||{revision:0,payload:null};$('cloud-conflict').hidden=false;state('Both copies changed. Choose which history to use below.');return;}
   if(action==='pull'){hooks.apply(cloud.payload);meta={revision:cloud.revision,dirty:false};persist();}
   else if(action==='equal'){meta={revision:cloud.revision,dirty:false};persist();}
   else {
    const result=await request('/rest/v1/rpc/save_tracker',{token:await token(),method:'POST',body:{p_payload:local,p_revision:meta.revision}});if(run!==epoch)return;
    meta={revision:result.revision,dirty:changed(local,hooks.get())};persist();
   }
   if(meta.dirty)queue();else state('Saved to cloud · '+new Date().toLocaleTimeString());
  }catch(e){if(run!==epoch)return;state(e.code==='40001'?'Another device saved first. Tap Sync now to review.':e.status===401||e.status===400?'Session needs attention. Disconnect and sign in again; local history is retained.':'Sync unavailable · saved locally. '+e.message);}
  finally{busy=false;}
 }
 $('cloud-login').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;$('cloud-signin').disabled=true;state('Signing in…');try{
  const data=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:$('cloud-email').value.trim(),password:$('cloud-password').value}});
  if(!data.user?.id||!data.access_token)throw Error('No session returned.');session={...data,expires_at:Date.now()/1000+data.expires_in};epoch++;
  const cached=localStorage.getItem(metaKey());meta=cached?JSON.parse(cached):{revision:0,dirty:false};
  if(!Number.isSafeInteger(meta.revision)||meta.revision<0)throw Error('Invalid local sync information.');
  hooks.account(session.user.id);ui();state('Signed in. Loading your history…');
 }catch(e){session=null;state('Sign-in failed: '+e.message);}finally{$('cloud-password').value='';busy=false;$('cloud-signin').disabled=false;}if(session)sync();};
 $('cloud-sync').onclick=sync;
 $('cloud-disconnect').onclick=()=>{if(busy){state('Wait for the current sync to finish.');return;}epoch++;clearTimeout(timer);const old=session;session=null;conflict=null;meta=null;$('cloud-conflict').hidden=true;hooks.account(null);ui();state('Disconnected. Cloud-account history remains stored locally on this device.');if(old)request('/auth/v1/logout?scope=local',{method:'POST',token:old.access_token}).catch(()=>{});};
 $('cloud-import').onclick=()=>{if(busy||conflict)return;const old=hooks.legacy();if(!old){state('No earlier V2 history found on this browser.');return;}if(!confirm('Copy this browser’s earlier V2 history into your signed-in account? Current account history will download as a backup before replacement.'))return;hooks.download(hooks.get(),'before-local-import.json');hooks.apply(validateBackup(old));dirty();};
 $('cloud-copies').onclick=()=>{hooks.download({local:hooks.get(),cloud:conflict?.payload},'tracker-conflict-copies.json');};
 $('cloud-use-remote').onclick=()=>{if(!conflict||busy)return;if(!conflict.payload){state('The cloud copy was removed. Export both copies or choose Keep this device.');return;}if(!confirm('Use the cloud history? Both current copies will download first.'))return;hooks.download({local:hooks.get(),cloud:conflict.payload},'tracker-before-conflict-resolution.json');hooks.apply(conflict.payload);meta={revision:conflict.revision,dirty:false};persist();conflict=null;$('cloud-conflict').hidden=true;state('Cloud history loaded.');};
 $('cloud-use-local').onclick=()=>{if(!conflict||busy)return;if(!confirm('Replace the cloud history with this device’s history? Both copies will download first.'))return;hooks.download({local:hooks.get(),cloud:conflict.payload},'tracker-before-conflict-resolution.json');meta={revision:conflict.revision,dirty:true};persist();conflict=null;$('cloud-conflict').hidden=true;sync();};
 window.addEventListener('online',sync);window.addEventListener('focus',sync);setInterval(()=>{if(!document.hidden)sync();},30000);
 ui();state('Local mode · sign in to share history across devices.');return {dirty};
}
