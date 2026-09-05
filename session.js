export const SESSION_KEY='hybridTrackerSession';
export function createSessionStore(local,tab){
 function clear(){local.removeItem(SESSION_KEY);tab.removeItem(SESSION_KEY);}
 function read(){for(const [storage,remember] of [[local,true],[tab,false]]){const raw=storage.getItem(SESSION_KEY);if(!raw)continue;try{const s=JSON.parse(raw);if(typeof s.access_token!=='string'||typeof s.refresh_token!=='string'||!Number.isFinite(s.expires_at)||typeof s.user?.id!=='string')throw Error();return {session:s,remember};}catch{storage.removeItem(SESSION_KEY);}}return null;}
 function write(s,remember){const safe={access_token:s.access_token,refresh_token:s.refresh_token,expires_at:s.expires_at,user:{id:s.user.id,email:s.user.email}};(remember?local:tab).setItem(SESSION_KEY,JSON.stringify(safe));(remember?tab:local).removeItem(SESSION_KEY);}
 return {read,write,clear};
}
