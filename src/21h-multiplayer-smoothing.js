// MP-7: tolerate jitter, packet loss and reconnection without trusting peers.
// Only rendering may extrapolate, for at most 130ms and with collision checks.
const MP7_FAST_PENDING=8192,MP7_GAP_RESET_MS=650;
const MP7_INTERP_MS=105,MP7_MAX_EXTRAP_MS=130;

function mp7Init(){
 const m=mpMatch;if(!m?.active)return;
 m.fastDrops=0;
 for(const a of m.actors.values()){a.jitter=0;a.samples=[];}
}
function mp7BufferAllowed(link){
 if(!link?.fast||link.fast.readyState!=='open')return false;
 const buffer=Number(link.fast.bufferedAmount);
 if(!Number.isFinite(buffer)||buffer<0||buffer>MP7_FAST_PENDING){
  if(mpMatch?.active)mpMatch.fastDrops++;
  return false;
 }
 return true;
}
function mp7InputTimeout(a){
 const rtt=Number(mpRtcLinks.get(a.peerId)?.rtt);
 return Math.max(350,Math.min(750,300+(Number.isFinite(rtt)&&rtt>=0?rtt*.85:0)));
}
function mp7LateCommand(a,cmd,now=Date.now()){
 // First input of a new match is not considered a reconnect. On a long gap,
 // a queued input may describe a button pressed seconds ago. Rebase action
 // counters and accept only a neutral first packet; fresh input resumes next.
 if(a.seq<0||now-a.lastInputAt<=MP7_GAP_RESET_MS)return cmd;
 if(a.lastSpecial)for(const key of ['ft','ad','aq','ac','ah'])
  a.lastSpecial[key]=Math.max(a.lastSpecial[key]||0,cmd[key]||0);
 return {...cmd,mx:0,mz:0,j:false,s:false,f:false,u:false,dn:false};
}
function mp7SafeStale(a,cmd,now=Date.now()){
 if(a.host||now-a.lastInputAt<=mp7InputTimeout(a))return cmd;
 // Clear vertical controls too: without this, a disconnected flyer ascends
 // indefinitely even after the host has frozen horizontal movement.
 return {...cmd,mx:0,mz:0,j:false,s:false,f:false,u:false,dn:false};
}
function mp7ReceiveSample(a,next,tick){
 const now=performance.now(),samples=a.samples;
 const prev=samples[samples.length-1];
 if(prev&&tick>prev.tick){
  const expected=(tick-prev.tick)*(1000/30),observed=Math.max(0,now-prev.at);
  const delta=Math.min(200,Math.abs(observed-expected));
  a.jitter=clamp((a.jitter||0)*.82+delta*.18,0,200);
 }
 samples.push({at:now,tick,...next});
 if(samples.length>6)samples.splice(0,samples.length-6);
}
function mp7PositionAllowed(x,z,h){
 if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(h)||
  x<.3||z<.3||x>=mapSize-.3||z>=mapSize-.3||h<-.01||
  h>ceilingHeight()-PLAYER_SOLID_HEIGHT+.03||collide(x,z,.24))return false;
 const floor=supportHeight({feetY:h,grounded:false},x,z);
 return floor<=h+.25&&!worldSolidBodyCollision(x,z,.24,Math.max(h,floor),PLAYER_SOLID_HEIGHT);
}
function mp7RenderRemote(a,dt){
 const samples=a.samples;if(!samples.length)return;
 const now=performance.now(),delay=clamp(MP7_INTERP_MS+(a.jitter||0)*.9,MP7_INTERP_MS,195);
 const time=now-delay,last=samples[samples.length-1];
 while(samples.length>3&&samples[1].at<time)samples.shift();
 let prev=samples[0],next=samples[0];
 for(let i=1;i<samples.length;i++){
  if(samples[i].at>=time){next=samples[i];break;}
  prev=samples[i];next=samples[i];
 }
 let x=next.x,z=next.z,h=next.h,yaw=next.yaw,pitch=next.pitch;
 const delta=prev===next?0:Math.max(0,Math.min(1,(time-prev.at)/Math.max(1,next.at-prev.at)));
 const span=Math.hypot(next.x-prev.x,next.z-prev.z);
 const teleport=span>1.45;
 if(prev!==next&&!teleport){
  x=prev.x+(next.x-prev.x)*delta;z=prev.z+(next.z-prev.z)*delta;
  h=prev.h+(next.h-prev.h)*delta;
  yaw=prev.yaw+Math.atan2(Math.sin(next.yaw-prev.yaw),Math.cos(next.yaw-prev.yaw))*delta;
  pitch=prev.pitch+(next.pitch-prev.pitch)*delta;
 }
 if(time>last.at&&samples.length>=2){
  const older=samples[samples.length-2],gap=(last.tick-older.tick)/30;
  const distance=Math.hypot(last.x-older.x,last.z-older.z);
  if(gap>=.02&&gap<=.35&&distance<=1.45){
   const seconds=Math.min(MP7_MAX_EXTRAP_MS/1000,(time-last.at)/1000);
   const dx=(last.x-older.x)/gap*seconds,dz=(last.z-older.z)/gap*seconds;
   const dy=(last.h-older.h)/gap*seconds;
   const ratio=Math.min(1,.57/Math.max(1e-9,Math.hypot(dx,dz)),.58/Math.max(1e-9,Math.abs(dy)));
   const X=last.x+dx*ratio,Z=last.z+dz*ratio,H=last.h+dy*ratio;
   // The extrapolated actor is only a drawing prediction, never a hit target.
   // Do not extrapolate through a barrier or raised platform.
   if(mp7PositionAllowed(X,Z,H)&&mp7PositionAllowed((X+last.x)/2,(Z+last.z)/2,(H+last.h)/2)){
    x=X;z=Z;h=H;
   }
  }
 }
 if(!mp7PositionAllowed(x,z,h)){x=last.x;z=last.z;h=last.h;}
 const p=a.p,displacement=Math.hypot(x-p.x,z-p.z),heightError=Math.abs(h-p.feetY);
 const alpha=displacement>2||heightError>1.8||teleport?1:
  1-Math.exp(-Math.min(.09,Math.max(0,dt))*28);
 p.x+=(x-p.x)*alpha;p.z+=(z-p.z)*alpha;p.feetY+=(h-p.feetY)*alpha;
 p.yaw+=Math.atan2(Math.sin(yaw-p.yaw),Math.cos(yaw-p.yaw))*alpha;
 p.pitch+=(pitch-p.pitch)*alpha;
 p.walk=last.w;p.grounded=!!last.g;
 if(typeof mp6ApplyActorState==='function')mp6ApplyActorState(p,last,false);
}
function mp7ReconcileSelf(p,next){
 const dx=next.x-p.x,dz=next.z-p.z,dy=next.h-p.feetY;
 const distance=Math.hypot(dx,dz),height=Math.abs(dy);
 const hard=distance>3||height>1.65;
 const alpha=clamp(.2+distance*.12,.2,.58);
 const x=hard?next.x:p.x+dx*alpha,z=hard?next.z:p.z+dz*alpha;
 const h=hard?next.h:p.feetY+dy*.33;
 if(hard||mp7PositionAllowed(x,z,h)){
  p.x=x;p.z=z;p.feetY=h;
 }else{
  p.x=next.x;p.z=next.z;p.feetY=next.h;
 }
 if(hard||height>.25||!!p.grounded!==!!next.g){
  p.vy=next.vy;p.grounded=!!next.g;
 }
 p.energy+=(next.e-p.energy)*.3;
}
