import {createIdleSync} from './idle-sync.js?v=3.17.0';
import {createSessionStore,SESSION_KEY} from './session.js?v=3.17.0';
import {request,decision,changed} from './cloud-api.js?v=3.17.0';
import {validateBackup} from './core.js?v=3.17.0';
export function connectCloud(hooks){
 const $=id=>document.getElementById(id);let session=null,meta=null,busy=false,epoch=0,conflict=null,timer;
 const idle=createIdleSync(()=>sync());
 const sessionStore=createSessionStore(localStorage,sessionStorage);let remember=true;
 const state=s=>$('cloud-status').textContent=s;
 const metaKey=()=>`hybridCloudMeta:${session.user.id}`;
 const persist=()=>localStorage.setItem(metaKey(),JSON.stringify(meta));
 const clone=x=>JSON.parse(JSON.stringify(x));
 function ui(){ $('cloud-sync').hidden=!session;$('cloud-options').hidden=!session; $('cloud-login').hidden=!!session;$('cloud-controls').hidden=!session;$('cloud-account').textContent=session?.user.email||'';}
 async function token(){
  if(!session)throw Error('Sign in to sync.');
  const renew=async()=>{const run=epoch,uid=session?.user.id;if(!uid)throw Error('Signed out.');const stored=sessionStore.read();if(stored?.session.user.id===uid){session=stored.session;remember=stored.remember;}
   if(session.expires_at<Date.now()/1000+60){const result=await request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}});if(run!==epoch)throw Error('Session changed.');if(result.user?.id!==uid)throw Error('Account changed. Sign in again.');session={...result,expires_at:Date.now()/1000+result.expires_in};sessionStore.write(session,remember);}
   return session.access_token;
  };
  return navigator.locks? navigator.locks.request('hybrid-session-refresh',renew):renew();
 }
 async function remote(){const rows=await request('/rest/v1/tracker_state?select=payload,revision,updated_at',{token:await token()});if(!Array.isArray(rows)||rows.length>1)throw Error('Unexpected cloud response.');if(rows[0])validateBackup(rows[0].payload);return rows[0]||null;}
 function queue(){clearTimeout(timer);if(session){state(navigator.onLine?'Saved locally · waiting to sync':'Offline · saved locally');idle.touch();}}
 function dirty(){if(!session)return;try{meta.dirty=true;persist();queue();}catch(e){state('Local sync information could not be saved. Export a backup.');}}
 async function sync(force=false){
  if(!session||busy||conflict||!hooks.available())return;
  if(!navigator.onLine){state('Offline · saved locally. Reconnect to sync.');return;}
  if(document.querySelector('dialog[open]'))return;
  if(!force&&idle.remaining()>0){idle.schedule();return;}
  const editStamp=idle.stamp();
  busy=true;const run=epoch;state('Syncing…');
  try{
   const cloud=await remote();if(run!==epoch)return;if(idle.stamp()!==editStamp){idle.schedule();return;}
   const local=clone(hooks.get()),action=decision(local,cloud,meta.revision,meta.dirty);
   if(action==='conflict'){conflict=cloud||{revision:0,payload:null};$('cloud-conflict').hidden=false;state('Both copies changed. Choose which history to use below.');return;}
   if(action==='pull'){hooks.apply(cloud.payload);meta={revision:cloud.revision,dirty:false};persist();}
   else if(action==='equal'){meta={revision:cloud.revision,dirty:false};persist();}
   else {
    const access=await token();if(idle.stamp()!==editStamp){idle.schedule();return;}const result=await request('/rest/v1/rpc/save_tracker',{token:access,method:'POST',body:{p_payload:local,p_revision:meta.revision}});if(run!==epoch)return;
    meta={revision:result.revision,dirty:changed(local,hooks.get())};persist();
   }
   if(meta.dirty)queue();else state('Saved to cloud · '+new Date().toLocaleTimeString());
  }catch(e){if(run!==epoch)return;if(e.status===401||(e.status===400&&/refresh|token|grant/i.test(e.message))){sessionStore.clear();session=null;epoch++;ui();state('Please sign in again. Your local history is preserved.');return;}state(e.code==='40001'?'Another device saved first. Tap Sync now to review.':e.status===401||e.status===400?'Session needs attention. Disconnect and sign in again; local history is retained.':'Sync unavailable · saved locally. '+e.message);}
  finally{busy=false;}
 }
 $('cloud-login').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;$('cloud-signin').disabled=true;state('Signing in…');try{
  const data=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:$('cloud-email').value.trim(),password:$('cloud-password').value}});
  if(!data.user?.id||!data.access_token)throw Error('No session returned.');session={...data,expires_at:Date.now()/1000+data.expires_in};epoch++;
  const cached=localStorage.getItem(metaKey());meta=cached?JSON.parse(cached):{revision:0,dirty:false};
  if(!Number.isSafeInteger(meta.revision)||meta.revision<0)throw Error('Invalid local sync information.');
  hooks.account(session.user.id);remember=$('cloud-remember').checked;sessionStore.write(session,remember);ui();state('Signed in. Loading your history…');
 }catch(e){session=null;state('Sign-in failed: '+e.message);}finally{$('cloud-password').value='';busy=false;$('cloud-signin').disabled=false;}if(session)sync();};
 $('cloud-sync').onclick=()=>sync(true);
 $('cloud-disconnect').onclick=()=>{if(busy){state('Wait for the current sync to finish.');return;}epoch++;clearTimeout(timer);idle.cancel();const old=session;sessionStore.clear();session=null;conflict=null;meta=null;$('cloud-conflict').hidden=true;hooks.account(null);ui();state('Disconnected. Cloud-account history remains stored locally on this device.');if(old)request('/auth/v1/logout?scope=local',{method:'POST',token:old.access_token}).catch(()=>{});};
 $('cloud-copies').onclick=()=>{hooks.download({local:hooks.get(),cloud:conflict?.payload},'tracker-conflict-copies.json');};
 $('cloud-use-remote').onclick=()=>{if(!conflict||busy)return;if(!conflict.payload){state('The cloud copy was removed. Export both copies or choose Keep this device.');return;}if(!confirm('Use the cloud history? Both current copies will download first.'))return;hooks.download({local:hooks.get(),cloud:conflict.payload},'tracker-before-conflict-resolution.json');hooks.apply(conflict.payload);meta={revision:conflict.revision,dirty:false};persist();conflict=null;$('cloud-conflict').hidden=true;state('Cloud history loaded.');};
 $('cloud-use-local').onclick=()=>{if(!conflict||busy)return;if(!confirm('Replace the cloud history with this device’s history? Both copies will download first.'))return;hooks.download({local:hooks.get(),cloud:conflict.payload},'tracker-before-conflict-resolution.json');meta={revision:conflict.revision,dirty:true};persist();conflict=null;$('cloud-conflict').hidden=true;sync();};
 window.addEventListener('online',()=>sync());window.addEventListener('focus',()=>sync());
 document.addEventListener('input',e=>{if(session&&e.target.matches('#wellness input,#wellness textarea,#wellness select,#tasks input,#tasks select,#notes,#start,#edit-form input,#edit-form textarea,#edit-form select'))idle.touch();});
 document.addEventListener('keydown',e=>{if(session&&e.target.matches('#wellness input,#wellness textarea,#wellness select,#tasks input,#tasks select,#notes,#start,#edit-form input,#edit-form textarea'))idle.touch();});setInterval(()=>{if(!document.hidden)sync();},30000);
 window.addEventListener('storage',e=>{if(e.key===SESSION_KEY&&!e.newValue&&session){epoch++;session=null;clearTimeout(timer);idle.cancel();ui();state('Signed out in another tab. Local history is preserved.');}});
 ui();state('Local mode · sign in to share history across devices.');
 try{const saved=sessionStore.read();if(saved){session=saved.session;remember=saved.remember;const cached=localStorage.getItem(metaKey());meta=cached?JSON.parse(cached):{revision:0,dirty:false};if(!Number.isSafeInteger(meta.revision)||meta.revision<0)throw Error('Invalid sync information');hooks.account(session.user.id);ui();state('Restoring your cloud session…');setTimeout(sync,0);}}catch(e){session=null;sessionStore.clear();ui();state('Please sign in again. Your local history is preserved.');}
 return {dirty};
}

