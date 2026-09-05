export function createIdleSync(run,{now=()=>Date.now(),set=setTimeout,clear=clearTimeout,delay=30000}={}){
 let last=-Infinity,timer;
 const remaining=()=>Math.max(0,delay-(now()-last));
 function cancel(){clear(timer);timer=undefined;}
 function schedule(){cancel();timer=set(()=>{timer=undefined;run();},remaining());}
 function touch(){last=now();schedule();}
 return {touch,schedule,cancel,remaining,stamp:()=>last};
}
