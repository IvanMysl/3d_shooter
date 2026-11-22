'use strict';
// End-to-end MP-8 blackout / recovery using actual networking and movement.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createBrowser,active,actor,until,wait,FakeMetered,setup,enter,state}=
 require('./test_stage35_mp3_movement.cjs');
let assertions=0;
function check(value,label){assert.ok(value,label);assertions++;}
async function step(host,guest,n=1){
 for(let i=0;i<n;i++){
  guest.run('mpMatchUpdate(1/30)');await wait(0);
  host.run('mpMatchUpdate(1/30)');await wait(0);
 }
}
async function main(){
 const css=fs.readFileSync(path.join(__dirname,'../styles/55-multiplayer.css'),'utf8');
 check(css.includes('#mpReconnectNow[hidden]{display:none!important}'),
  'manual reconnect button is fully hidden in healthy matches');
 check(css.includes('touch-action:manipulation'),
  'recovery control remains tappable on touchscreen devices');
 const server=new FakeMetered();server.iceServers=[{urls:'stun:example.invalid'}];
 const host=createBrowser(server,true,true,true,true,true);
 const guest=createBrowser(server,true,true,true,true,true);
 setup(host,'HOST');await host.run('mpCreateRoom()');
 enter(guest,state(host).code,'GUEST');await guest.run('mpJoinRoom()');
 await until(()=>host.run('mpRtcLinks.size===1')&&guest.run('mpRtcLinks.size===1')&&
  host.run('[...mpRtcLinks.values()][0]?.fast?.readyState==="open"')&&
  guest.run('[...mpRtcLinks.values()][0]?.control?.readyState==="open"'));
 
 host.run('mpMatchStartTraining()');await until(()=>active(host)&&active(guest));
 check(host.run('MP_VERSION')>=3,'wire format retains v3 features or later');
 check(host.run('mpMatch.actors.size')===2,'both actors remain authoritative on host');
 check(guest.run('mpMatch.recoveryAttempts')===0,'auto-recovery budget initialized');
 check(guest.run('mp8GuestState()')==='ok','guest begins with a healthy snapshot stream');
 check(guest.run('!!$("mpReconnectNow")'),'guest match creates reconnect button');
 check(guest.run('$("mpReconnectNow").hidden')===true,
  'reconnect button does not obscure HUD on a healthy link');
 check(host.run('mp8GuestState()')==='ok','host does not enter guest freeze state');
 check(host.changes.nodes.has('mpReconnectNow')===false,
  'host does not need guest-only recovery control');
 check(host.saves===0&&guest.saves===0,'initializing MP-8 does not write campaign saves');

 // Deterministic health thresholds without waiting seconds on the wall clock.
 check(guest.run(`mp8GuestState(mpMatch.lastFromHost+599)`)==='ok',
  'normal <600ms packet gap leaves input responsive');
 check(guest.run(`mp8GuestState(mpMatch.lastFromHost+600)`)==='lag',
  '600ms state gap explicitly warns about latency');
 check(guest.run(`mp8GuestState(mpMatch.lastFromHost+1049)`)==='lag',
  'warning threshold remains below freeze threshold');
 check(guest.run(`mp8GuestState(mpMatch.lastFromHost+1050)`)==='frozen',
  '1050ms without host snapshots freezes local prediction');
 check(guest.run(`mp8GuestState(mpMatch.lastFromHost+90000)`)==='frozen',
  'an arbitrarily long outage cannot unfreeze unauthenticated prediction');
 check(guest.run(`(()=>{const c={mx:1,mz:-.6,j:true,s:true,f:true,u:true,dn:true,
  yaw:1,pitch:.4,ft:8,ad:2,aq:7,ac:1,ah:6};const n=mp8NeutralInput(c);
  return n!==c&&n.mx===0&&n.mz===0&&!n.j&&!n.s&&!n.f&&!n.u&&!n.dn&&
  n.yaw===1&&n.pitch===.4&&n.ft===8&&n.ah===6&&c.f===true})()`),
  'neutral input cancels all holds without mutating controls or event counters');

 // Actual normal movement must work before the blackout.
 guest.run('input.keys.KeyW=true');
 const beforeMove={x:actor(guest,1).x,z:actor(guest,1).z};
 await step(host,guest,18);
 check(Math.hypot(actor(guest,1).x-beforeMove.x,actor(guest,1).z-beforeMove.z)>.1,
  'local prediction moves normally while authoritative snapshots arrive');
 check(host.run('mpMatch.actors.get(1).seq')>0,'host accepts authenticated movement before outage');
 check(guest.run('mpMatch.lastSnapshot')>0,'guest receives new host snapshots');

 // Simulate host-state channel blackout without dropping guest input/control.
 host.run(`(()=>{const ch=[...mpRtcLinks.values()][0].fast;
  ch._mp8Send=ch.send.bind(ch);ch.send=data=>{if(JSON.parse(data).kind==='mp3-state')return;
   return ch._mp8Send(data)};})()`);
 guest.run('mpMatch.lastFromHost=Date.now()-2000');
 check(guest.run('mp8GuestFrozen()')===true,'guest detects interrupted host snapshot stream');
 const fixed={x:actor(guest,1).x,z:actor(guest,1).z};
 guest.run('input.fire=true;input.flyUp=true;input.mobileSprint=true');
 check(guest.run('useAbility("dash")')===false,
  'dash request cannot start during an unresolved network blackout');
 check(guest.run('toggleFlight()')===false,
  'flight toggles cannot start during an unresolved network blackout');
 check(guest.run('mpMatch.special.ad===0&&mpMatch.special.ft===0'),
  'blocked abilities do not increment untrusted counters');
 await step(host,guest,12);
 check(Math.hypot(actor(guest,1).x-fixed.x,actor(guest,1).z-fixed.z)<.001,
  'real client update stops local walking prediction during blackout');
 check(host.run('mpMatch.actors.get(1).cmd.mx===0&&mpMatch.actors.get(1).cmd.mz===0'),
  'real guest packets tell host to stop moving while snapshots are missing');
 check(host.run('mpMatch.actors.get(1).cmd.f===false&&mpMatch.actors.get(1).cmd.u===false'),
  'real guest packets stop shooting and ascent during snapshot blackout');
 guest.run('mpMatchStatus()');
 check(guest.run('$("mpTrainingBadge").textContent.includes("УПРАВЛЕНИЕ ПРИОСТАНОВЛЕНО")'),
  'on-screen match badge explains why controls are paused');
 check(guest.run('$("mpReconnectNow").hidden')===false,
  'manual reconnect button appears during sustained blackout');
 check(guest.run('typeof $("mpReconnectNow").onclick')==='function',
  'manual recovery button has an active click handler');

 // The host warns about input silence, without falsely ending the round.
 check(host.run(`(()=>{const a=mpMatch.actors.get(1);a.lastInputAt=Date.now()-1500;
  return mp8HostWarning(mpMatch).includes('НЕТ ВВОДА')})()`),
  'host displays missing guest input warning after 1.2 seconds');
 check(host.run('mpMatch.round.ended===false'),
  'long silence does not falsely declare the match over');

 // If a host snapshot finally arrives, discard stale smoothing samples and
 // use the signed authoritative position/energy/height exactly once.
 guest.run(`(()=>{const a=mpMatch.actors.get(0);
  a.samples=[{at:performance.now()-6000,tick:1,x:9,z:9,h:0}];a.jitter=130;
  const p=mpMatch.actors.get(1).p;p.x=15;p.z=15;p.feetY=2;p.energy=4;
  mpMatch.lastFromHost=Date.now()-2500})()`);
 host.run('mpMatch.tick+=20');
 const validState=host.run('mpMatchState()');
 guest.run('mpMatchFast(mpRoom.hostPeer,'+JSON.stringify(validState)+')');
 const serverSelf=validState.actors.find(x=>x.id===1);
 check(guest.run('mpMatch.recoveredAfterSilence')===false,
  'one-time forced reconciliation completes after the verified snapshot');
 check(Math.abs(actor(guest,1).x-serverSelf.x)<.0001&&
  Math.abs(actor(guest,1).z-serverSelf.z)<.0001,
  'post-blackout position snaps exactly to host coordinates');
 check(Math.abs(actor(guest,1).feetY-serverSelf.h)<.0001,
  'post-blackout altitude snaps exactly to host position');
 check(Math.abs(actor(guest,1).energy-serverSelf.e)<.0001,
  'post-blackout energy immediately matches host authority');
 check(guest.run('mpMatch.actors.get(0).samples.length')===1,
  'stale interpolation samples are removed after recovery');
 check(guest.run('mpMatch.actors.get(0).jitter')===0,
  'jitter estimate resets after a long state blackout');
 check(guest.run('mp8GuestState()')==='ok',
  'a validated fresh snapshot restores guest control state');
 guest.run('mpMatchStatus()');
 check(guest.run('$("mpReconnectNow").hidden'),
  'reconnect button disappears when authoritative snapshots resume');

 // Restore host channel, ensure normal simulated movement resumes.
 host.run(`(()=>{const ch=[...mpRtcLinks.values()][0].fast;ch.send=ch._mp8Send})()`);
 guest.run('input.fire=false;input.flyUp=false;input.mobileSprint=false;input.keys.KeyW=true');
 const afterRecovery={x:actor(guest,1).x,z:actor(guest,1).z};
 await step(host,guest,10);
 check(Math.hypot(actor(guest,1).x-afterRecovery.x,actor(guest,1).z-afterRecovery.z)>.08,
  'normal predicted controls resume after receiving a valid host frame');

 // No automatic retry for short delays or hidden documents. Exactly one
 // recovery request is permitted per match after 4.8s without snapshots.
 check(guest.run(`(()=>{const m=mpMatch;m.recoveryAttempts=0;
  m.lastFromHost=Date.now()-3000;mp8Update(m);return m.recoveryAttempts===0})()`),
  'a 3-second outage does not consume automatic retry quota');
 check(guest.run(`(()=>{const m=mpMatch,old=document.hidden;
  document.hidden=true;m.lastFromHost=Date.now()-6000;mp8Update(m);
  document.hidden=old;return m.recoveryAttempts===0})()`),
  'background tab does not initiate unsolicited network reconnection');
 check(guest.run(`(()=>{const m=mpMatch;mpRtcManualAt=Date.now()-1200;
  mp8Update(m);const ignored=m.recoveryAttempts===0;mpRtcManualAt=0;
  return ignored})()`),
  'cooldown-blocked reconnect does not consume the single automatic attempt');
 const priorSid=host.run('[...mpRtcLinks.values()][0].sid');
 const priorRetryCount=server.frameLog.filter(x=>x.data?.kind==='rtc-retry').length;
 host.run('mpRtcAttempts.set(mpRoom.players[1].peerId,MP_RTC_TRIES)');
 guest.run('mpMatch.lastFromHost=Date.now()-6000;mp8Update(mpMatch)');
 check(guest.run('mpMatch.recoveryAttempts')===1,'one automatic recovery attempt is recorded');
 await until(()=>host.run('[...mpRtcLinks.values()][0]?.sid')!==priorSid&&
  guest.run('[...mpRtcLinks.values()][0]?.fast?.readyState==="open"'),6000);
 check(host.run('mpRtcAttempts.get(mpRoom.players[1].peerId)')<=3,
  'explicit retry restores exhausted automatic RTC attempt budget');
 check(server.frameLog.filter(x=>x.data?.kind==='rtc-retry').length===priorRetryCount+1,
  'auto-recovery sends only one room-signaling retry request');
 guest.run('mp8Update(mpMatch)');guest.run('mp8Update(mpMatch)');
 check(server.frameLog.filter(x=>x.data?.kind==='rtc-retry').length===priorRetryCount+1,
  'long-lasting outage cannot trigger a repeated signaling flood');
 check(active(host)&&active(guest),'new RTC channel preserves active round');
 await step(host,guest,8);
 check(guest.run('mpMatch.lastSnapshot')>=validState.tick,
  'authoritative snapshots resume on replaced WebRTC channel');
 guest.run('mpMatchPause()');
 check(guest.html.includes('mpRetryInGame'),
  'pause screen also offers a manual network recovery button');
 guest.run('mpMatchPause()');
 check(guest.run('mpMatch.paused')===false,'gameplay can resume from recovery menu');

 // Finish the match and verify cleanup / no persistent solo writes.
 host.run('mpMatch.round.endsAt=Date.now()-1;mpRoundCheck()');
 await until(()=>guest.run('mpMatch.round.ended'));
 check(guest.run('mp8GuestState()')==='ok','round results never appear as a connection freeze');
 check(host.run('mpMatch.round.ended')&&guest.run('mpMatch.round.ended'),
  'authoritative match result survives a reconnection');
 host.run('mpMatchStop()');await until(()=>!active(host)&&!active(guest));
 check(guest.changes.nodes.has('mpReconnectNow')===false,
  'temporary recovery UI is removed with the multiplayer match');
 await guest.run('mpLeave()');await host.run('mpLeave()');
 check(host.run('mpRtcLinks.size')===0&&guest.run('mpRtcLinks.size')===0,
  'all temporary RTC connections are released after leaving the room');
 check(host.saves===0&&guest.saves===0,
  'Stage40 blackout/recovery never overwrites single-player campaign saves');
 console.log('STAGE40 MP-8 BLACKOUT + RECOVERY: '+assertions+' assertions passed');
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
