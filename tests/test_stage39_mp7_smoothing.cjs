'use strict';
// Run actual MP-7 application code in two independent simulated browsers.
// Render prediction never changes authoritative player positions or damage.
const assert=require('node:assert/strict');
const {createBrowser,active,actor,until,wait,FakeMetered,setup,enter,state}=
 require('./test_stage35_mp3_movement.cjs');
let assertions=0;
function check(condition,label){assert.ok(condition,label);assertions++;}
function approx(value,target,epsilon,label){check(Math.abs(value-target)<=epsilon,label);}
async function step(host,guest,n=1){
 for(let i=0;i<n;i++){
  guest.run('mpMatchUpdate(1/30)');await wait(0);
  host.run('mpMatchUpdate(1/30)');await wait(0);
 }
}
async function main(){
 const metered=new FakeMetered();metered.iceServers=[{urls:'stun:invalid.test'}];
 const host=createBrowser(metered,true,true,true,true);
 const guest=createBrowser(metered,true,true,true,true);
 setup(host,'HOST');await host.run('mpCreateRoom()');
 enter(guest,state(host).code,'GUEST');await guest.run('mpJoinRoom()');
 await until(()=>host.run('mpRtcLinks.size===1')&&guest.run('mpRtcLinks.size===1')&&
  host.run('[...mpRtcLinks.values()][0]?.fast?.readyState==="open"')&&
  guest.run('[...mpRtcLinks.values()][0]?.control?.readyState==="open"'));
 
 host.run('mpMatchStartTraining()');await until(()=>active(host)&&active(guest));
 check(host.run('mpMatch.fastDrops')===0,'stage39 initializes host fast-channel drop counter');
 check(guest.run('mpMatch.fastDrops')===0,'guest fast-channel drop counter starts empty');
 check(host.run('MP_VERSION')>=3,'MP-7 requires compact compatible protocol v3 or later');
 check(host.run('mpMatch.actors.size')===2,'host retains complete roster');
 check(guest.run('mpMatch.actors.get(0).jitter')===0,'guest starts with no jitter estimate');
 check(host.saves===0&&guest.saves===0,'MP-7 startup does not alter single-player save');

 // Deliberate unordered-RTC backlog; never queue old fast state/commands.
 check(guest.run(`(()=>{const l=[...mpRtcLinks.values()][0];l.fast.bufferedAmount=9001;
  return mpRtcFastSend(mpRoom.hostPeer,{kind:'ping',v:2})===false})()`),
 'guest drops fast commands if the channel backlog is too large');
 check(guest.run('mpMatch.fastDrops')===1,'guest counts backlog drops');
 check(host.run(`(()=>{const l=[...mpRtcLinks.values()][0];l.fast.bufferedAmount=8193;
  return mpRtcFastSend(l.peer,{kind:'ping',v:2})===false})()`),
 'host drops excess state snapshots instead of piling up stale frames');
 check(host.run('mpMatch.fastDrops')===1,'host counts backpressure drops');
 host.run('[...mpRtcLinks.values()][0].fast.bufferedAmount=0');
 check(guest.run(`(()=>{const l=[...mpRtcLinks.values()][0];l.fast.bufferedAmount=8192;
  return mp7BufferAllowed(l)})()`),'exact queue threshold is allowed');
 check(guest.run(`(()=>{const l=[...mpRtcLinks.values()][0];l.fast.bufferedAmount=0;
  return mp7BufferAllowed(l)})()`),'drained fast channel resumes');
 check(guest.run(`(()=>{const l=[...mpRtcLinks.values()][0];
  l.fast.bufferedAmount=Infinity;const ok=mp7BufferAllowed(l);l.fast.bufferedAmount=0;
  return !ok})()`),'non-finite telemetry never bypasses queue guard');
 check(guest.run(`(()=>{const l=[...mpRtcLinks.values()][0];const ch=l.fast;
  l.fast={readyState:'closed',bufferedAmount:0};const ok=mp7BufferAllowed(l);
  l.fast=ch;return !ok})()`),'closed fast channel is not accepted');
 check(guest.run(`(()=>{const l=[...mpRtcLinks.values()][0];
  return mpRtcSend(l,l.control,{v:2,kind:'mp7-control-smoke'})})()`),
 'reliable control channel is independent of fast-channel backpressure');

 // Jitter/loss in an actual move sequence. Fake RTC sends queueMicrotasks,
 // so optionally swallow every second guest input while remaining connected.
 guest.run(`(()=>{const ch=[...mpRtcLinks.values()][0].fast;
  ch._stage39OriginalSend=ch.send.bind(ch);ch._stage39Attempt=0;
  ch.send=data=>{if(++ch._stage39Attempt%2===0)return;
   return ch._stage39OriginalSend(data)};
  input.keys.KeyW=true;})()`);
 const before={x:actor(host,1).x,z:actor(host,1).z};
 await step(host,guest,70);
 check(Math.hypot(actor(host,1).x-before.x,actor(host,1).z-before.z)>1.2,
 'lost every-second input does not freeze authoritative movement');
 check(host.run('mpMatch.actors.get(1).seq')>=15,
 'host still accepts fresh authenticated commands during packet loss');
 check(guest.run('mpMatch.actors.get(0).samples.length')>=1,
 'guest receives host snapshots despite dropped guest inputs');
 check(guest.run('mpMatch.actors.get(0).samples.length')<=6,
 'remote interpolation sample ring is bounded');
 check(metered.frameLog.length>0,'network lobby used Metered signaling');
 guest.run(`(()=>{const ch=[...mpRtcLinks.values()][0].fast;
  ch.send=ch._stage39OriginalSend;input.keys.KeyW=false;})()`);

 // Adaptive stale timeout and neutralized vertical input after disconnect.
 check(host.run(`(()=>{const a=mpMatch.actors.get(1),l=mpRtcLinks.get(a.peerId);
  l.rtt=0;return mp7InputTimeout(a)===350})()`),'fast links have a 350ms input expiry');
 check(host.run(`(()=>{const a=mpMatch.actors.get(1),l=mpRtcLinks.get(a.peerId);
  l.rtt=400;return mp7InputTimeout(a)===640})()`),'slow links tolerate measured RTT');
 check(host.run(`(()=>{const a=mpMatch.actors.get(1),l=mpRtcLinks.get(a.peerId);
  l.rtt=5000;return mp7InputTimeout(a)===750})()`),'input timeout has a 750ms upper bound');
 check(host.run(`(()=>{const a=mpMatch.actors.get(1),l=mpRtcLinks.get(a.peerId);
  l.rtt=0;const cmd={mx:1,mz:-1,j:true,s:true,f:true,u:true,dn:true};
  a.lastInputAt=Date.now()-2000;
  const safe=mp7SafeStale(a,cmd);return !safe.mx&&!safe.mz&&
   !safe.j&&!safe.s&&!safe.f&&!safe.u&&!safe.dn})()`),
 'stale packets cannot leave any horizontal, vertical or firing control held');
 check(host.run(`(()=>{const a=mpMatch.actors.get(0);
  return mp7SafeStale(a,{u:true,mx:1}).u===true})()`),
 'locally controlled host remains responsive');
 check(host.run(`(()=>{const a=mpMatch.actors.get(1);
  a.lastInputAt=Date.now();return mp7SafeStale(a,{u:true,mx:1}).u===true})()`),
 'recent authenticated input is not suppressed');
 check(host.run(`(()=>{const a=mpMatch.actors.get(1),p=a.p;
  p.x=17;p.z=11;p.feetY=2.5;p.flying=true;p.grounded=false;
  a.cmd={...a.cmd,u:true,dn:false,mx:0,mz:0};a.lastInputAt=Date.now()-3000;
  const before=p.feetY;mpMatchUpdate(1/30);return Math.abs(p.feetY-before)<.01})()`),
 'actual host tick stops vertical climb immediately after input timeout');
 check(host.run(`(()=>{const a=mpMatch.actors.get(1),p=a.p;
  p.cooldown=0;p.heatLock=0;p.hp=100;a.respawnAt=0;
  a.cmd={...a.cmd,f:true};a.lastInputAt=Date.now()-3000;
  a.bursts.push({delay:1,w:weapons[0]});const before=p.shots||0;
  mpMatchUpdate(1/30);return (p.shots||0)===before&&a.bursts.length===0})()`),
 'actual host combat tick cancels firing and queued bursts after link loss');

 // An old queued press cannot trigger abilities after a network blackout.
 check(host.run(`(()=>{const a=mpMatch.actors.get(1);
  a.seq=80;a.lastInputAt=Date.now()-2000;a.lastSpecial.ft=1;
  a.lastSpecial.ad=1;a.lastSpecial.aq=1;a.lastSpecial.ac=1;a.lastSpecial.ah=1;
  const cmd={mx:1,mz:1,j:true,s:true,f:true,u:true,dn:true,ft:10,ad:9,aq:7,ac:5,ah:4};
  const safe=mp7LateCommand(a,cmd);return !safe.mx&&!safe.mz&&!safe.f&&
   !safe.j&&!safe.s&&!safe.u&&!safe.dn&&
   a.lastSpecial.ft===10&&a.lastSpecial.ad===9&&a.lastSpecial.ah===4})()`),
 'first packet after blackout rebases all five event counters and neutralizes input');
 check(host.run(`(()=>{const a=mpMatch.actors.get(1);a.lastInputAt=Date.now();
  const cmd={mx:.7,mz:0,ft:12};return mp7LateCommand(a,cmd)===cmd})()`),
 'subsequent fresh input is admitted without an extra dead period');
 check(host.run(`(()=>{const a=mpMatch.actors.get(1);a.seq=-1;
  const cmd={mx:1,mz:0};return mp7LateCommand(a,cmd)===cmd})()`),
 'first-ever command is never mistaken for a reconnect');
 check(host.run(`(()=>{const a=mpMatch.actors.get(1);a.seq=90;
  a.lastInputAt=Date.now()-5000;a.cmd={...a.cmd,mx:0,mz:0};
  const id=a.peerId,token=mpMatch.token,ft=a.lastSpecial.ft;
  mpMatchFast(id,{v:2,kind:'mp3-input',token,seq:91,mx:1,mz:0,
   yaw:0,pitch:0,j:false,s:false,f:false,u:true,dn:false,ft:ft+2,ad:10,aq:7,ac:5,ah:4});
  return a.seq===91&&a.cmd.mx===0&&!a.cmd.u&&a.lastSpecial.ft===ft+2})()`),
 'real authenticated receive path applies blackout protection');
 // Restore the real guest sequence after the deliberately synthetic seq=91.
 host.run('mpMatch.actors.get(1).seq='+guest.run('mpMatch.inputSeq'));

 // Deterministic position reconstruction from timestamped host frames.
 check(guest.run(`(()=>{const a=mpMatch.actors.get(0);a.samples=[];a.jitter=0;
  mp7ReceiveSample(a,{x:15,z:15,h:0,yaw:0,pitch:0,w:0,g:1},100);
  a.samples[0].at-=195;
  mp7ReceiveSample(a,{x:15,z:15.2,h:0,yaw:0,pitch:0,w:1,g:1},103);
  return a.jitter>0&&a.samples.length===2})()`),
 'arrival jitter is measured relative to authoritative tick deltas');
 check(guest.run(`(()=>{const a=mpMatch.actors.get(0);
  for(let i=0;i<20;i++)mp7ReceiveSample(a,{x:15,z:15,h:0,yaw:0,pitch:0,w:0,g:1},104+i);
  return a.samples.length===6&&a.jitter>=0&&a.jitter<=200})()`),
 'large snapshot bursts maintain bounded timestamps and jitter');
 check(guest.run(`(()=>{const a=mpMatch.actors.get(0),n=performance.now();
  a.jitter=0;a.samples=[{at:n-185,tick:100,x:15,z:12,h:0,yaw:0,pitch:0,w:0,g:1,fl:0,sh:0,cd:[0,0,0,0]},
   {at:n-65,tick:103,x:15,z:13,h:0,yaw:0,pitch:0,w:1,g:1,fl:0,sh:0,cd:[0,0,0,0]}];
  a.p.x=15;a.p.z=12.3;a.p.feetY=0;mp7RenderRemote(a,1/30);
  return a.p.z>12.3&&a.p.z<13})()`),
 'remote player smoothly approaches interpolated position between host samples');
 check(guest.run(`(()=>{const a=mpMatch.actors.get(0),n=performance.now();
  a.jitter=0;a.samples=[{at:n-320,tick:100,x:15,z:12,h:0,yaw:0,pitch:0,w:0,g:1,fl:0,sh:0,cd:[0,0,0,0]},
   {at:n-250,tick:102,x:15,z:12.35,h:0,yaw:0,pitch:0,w:1,g:1,fl:0,sh:0,cd:[0,0,0,0]}];
  a.p.x=15;a.p.z=12.35;mp7RenderRemote(a,1/30);
  return a.p.z>12.35&&a.p.z<12.94})()`),
 'missing recent snapshots allow only short bounded movement prediction');
 check(guest.run(`(()=>{const a=mpMatch.actors.get(0),n=performance.now();
  a.jitter=0;a.samples=[{at:n-500,tick:100,x:22.4,z:12,h:0,yaw:0,pitch:0,w:1,g:1,fl:0,sh:0,cd:[0,0,0,0]},
   {at:n-400,tick:103,x:22.6,z:12,h:0,yaw:0,pitch:0,w:1,g:1,fl:0,sh:0,cd:[0,0,0,0]}];
  a.p.x=22.6;a.p.z=12;mp7RenderRemote(a,1/30);
  return a.p.x<=22.6+.001})()`),
 'prediction cannot move a drawn actor through collision wall');
 check(guest.run(`(()=>{const a=mpMatch.actors.get(0),n=performance.now();
  a.jitter=0;a.samples=[{at:n-250,tick:100,x:15,z:12,h:0,yaw:0,pitch:0,w:0,g:1,fl:0,sh:0,cd:[0,0,0,0]},
   {at:n-110,tick:104,x:15,z:16.5,h:0,yaw:0,pitch:0,w:0,g:1,fl:0,sh:0,cd:[0,0,0,0]}];
  a.p.x=15;a.p.z=12;mp7RenderRemote(a,1/30);
  return a.p.z===16.5})()`),
 'dash-like displacement is snapped, never animated through intervening solids');
 check(guest.run('mp7PositionAllowed(NaN,12,0)===false'),
 'non-finite reconstructed coordinates are rejected');
 check(guest.run('mp7PositionAllowed(24,12,0)===false'),
 'positions outside mapped wall are rejected');
 check(guest.run('mp7PositionAllowed(15,12,15)===false'),
 'positions above available flight ceiling are rejected');
 check(guest.run(`(()=>{const old=supportHeight;supportHeight=()=>4;
  const allowed=mp7PositionAllowed(15,12,1);supportHeight=old;return !allowed})()`),
 'predicted actor cannot enter elevated solid platform');
 check(guest.run('mp7PositionAllowed(15,12,1)===true'),
 'valid midair actor positions remain renderable');

 // Prediction correction should not jerk on minor errors, but must recover
 // immediately from major divergence or altitude discontinuities.
 check(guest.run(`(()=>{const p=mpMatch.actors.get(1).p;p.x=15;p.z=11;p.feetY=0;
  p.energy=10;mp7ReconcileSelf(p,{x:15.4,z:11,h:0,e:90,vy:0,g:1});
  return p.x>15&&p.x<15.4&&p.energy===34})()`),
 'small local misprediction is corrected gradually, energy reconciles to host');
 check(guest.run(`(()=>{const p=mpMatch.actors.get(1).p;p.x=15;p.z=11;p.feetY=0;
  mp7ReconcileSelf(p,{x:20,z:11,h:0,e:90,vy:0,g:1});
  return p.x===20})()`),'large divergence causes bounded hard reconciliation');
 check(guest.run(`(()=>{const p=mpMatch.actors.get(1).p;p.x=15;p.z=11;p.feetY=.2;
  mp7ReconcileSelf(p,{x:15,z:11,h:3,e:90,vy:1,g:0});
  return p.feetY===3&&!p.grounded&&p.vy===1})()`),
 'large altitude mismatch snaps accurately and restores vertical velocity');
 check(guest.run(`(()=>{const p=mpMatch.actors.get(1).p;p.x=15;p.z=11;p.feetY=1;
  mp7ReconcileSelf(p,{x:15,z:11,h:1.6,e:90,vy:0,g:0});
  return p.feetY>1&&p.feetY<1.6})()`),
 'normal flight altitude errors are softly reconciled');
 check(host.saves===0&&guest.saves===0,'smoothing never persists transient multiplayer state');

 // New channels retain match, and a new input sequence can be accepted.
 const oldSid=host.run('[...mpRtcLinks.values()][0].sid');
 const seqBefore=host.run('mpMatch.actors.get(1).seq');
 host.run('mpRtcManualRetry()');
 await until(()=>host.run('[...mpRtcLinks.values()][0]?.sid')!==oldSid&&
  guest.run('[...mpRtcLinks.values()][0]?.fast?.readyState==="open"'),6000);
 check(active(host)&&active(guest),'RTC reconnection does not reset match state');
 await step(host,guest,10);
 check(host.run('mpMatch.actors.get(1).seq')>seqBefore,
 'host accepts sequence advancing on newly established channels');
 check(host.run('mpMatch.fastDrops')>=1&&guest.run('mpMatch.fastDrops')>=1,
 'backpressure statistics survive P2P channel replacement');
 check(guest.run('mpMatch.lastSnapshot')>10,
 'new channels resume authoritative snapshots');
 host.run('mpMatch.round.endsAt=Date.now()-1;mpRoundCheck()');
 await until(()=>guest.run('mpMatch.round.ended'));
 check(host.run('mpMatch.round.ended')&&guest.run('mpMatch.round.ended'),
 'loss/retry scenarios do not prevent authoritative round results');
 host.run('mpMatchStop()');await until(()=>!active(host)&&!active(guest));
 await guest.run('mpLeave()');await host.run('mpLeave()');
 check(host.run('mpRtcLinks.size')===0&&guest.run('mpRtcLinks.size')===0,
 'all network connections close after Stage39 match');
 check(host.saves===0&&guest.saves===0,'entire multiplayer lifecycle leaves campaign saves intact');
 console.log('STAGE39 MP-7 JITTER + RECOVERY: '+assertions+' assertions passed');
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
