export const URL='https://cgfddevbwgcvnenwzvfn.supabase.co';
export const PUBLIC_KEY='sb_publishable_z24k5MBTEqyiR7V5VRZa6A_AvBkHQ3k';
export async function request(path,{token,body,method='GET',fetcher=fetch}={}){
  const response=await fetcher(URL+path,{method,cache:'no-store',headers:{apikey:PUBLIC_KEY,...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const e=new Error(data.msg||data.message||data.error_description||'Cloud request failed ('+response.status+').');e.status=response.status;e.code=data.code;throw e;}return data;
}
export const changed=(a,b)=>JSON.stringify(a)!==JSON.stringify(b);
export function decision(local,remote,revision,dirty){
  if(!remote)return revision===0?'push':'conflict';
  if(!changed(local,remote.payload))return 'equal';
  if(remote.revision===revision)return dirty?'push':'pull';
  return dirty?'conflict':'pull';
}
