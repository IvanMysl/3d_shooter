'use strict';
// End-to-end simulated Metered/RTC game with the actual Stage38 PvP modules.
// No remote player coordinates, energy, damage or ability effects are trusted.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createBrowser,active,actor,until,wait,FakeMetered,setup,enter,state}=
 require('./test_stage35_mp3_movement.cjs');
let assertions=0;
function check(ok,name){assert.ok(ok,name);assertions++;}
async function step(host,guest,n=1){
 for(let i=0;i<n;i++){
  guest.run('mpMatchUpdate(1/30)');await wait(0);
  host.run('mpMatchUpdate(1/30)');await wait(0);
 }
}
async function main(){
 const css=fs.readFileSync(path.join(__dirname,'../styles/55-multiplayer.css'),'utf8');
 check(/body\.mpTraining #dashTouch[\s\S]*?#flightDown\{pointer-events:auto;opacity:1\}/.test(css),
  'touch flight and ability buttons remain clickable during PvP on Android');
 const server=new FakeMetered();server.iceServers=[{urls:'stun:stun.example.invalid'}];
 const host=createBrowser(server,true,true,true),guest=createBrowser(server,true,true,true);
 setup(host,'HOST');await host.run('mpCreateRoom()');
 enter(guest,state(host).code,'GUEST');await guest.run('mpJoinRoom()');
 await until(()=>host.run('mpRtcLinks.size===1')&&guest.run('mpRtcLinks.size===1')&&
  host.run('[...mpRtcLinks.values()][0].fast?.readyState==="open"')&&
  guest.run('[...mpRtcLinks.values()][0].control?.readyState==="open"'));
 
 host.run('mpMatchStartTraining()');await until(()=>active(host)&&active(guest));
 check(host.run('MP_VERSION')>=3,'new flight schema requires at least protocol v3');
 check(host.run('mpMatch.actors.size')===2,'both players start in the new physics world');
 check(host.run('[...mpMatch.actors.values()].every(a=>a.p.flightUnlocked)'),
  'every player receives fair baseline flight regardless of owned suits');
 check(guest.run('mpMatch.special.ft')===0,'flight action counter begins at zero');
 check(host.saves===0&&guest.saves===0,'no campaign saves touched when entering air match');
 const g0=actor(host,1);
 check(g0.flying===false,'players begin grounded');
 check(guest.run('toggleFlight()')===true,'existing mobile flight button requests network flight');
 check(guest.run('game.p.flying')===true,'local feedback immediately reflects flight request');
 guest.run('input.flyUp=true');await step(host,guest,36);
 check(actor(host,1).flying===true,'host authorizes guest flight instead of trusting position');
 check(actor(host,1).feetY>3,'held lift moves the guest into the air');
 check(actor(host,1).feetY<7.05,'flight respects the mapped ceiling');
 check(Math.abs(actor(guest,1).feetY-actor(host,1).feetY)<1.35,
  'guest predicts flight near host-authoritative altitude');
 check(actor(host,0).flying===false,'guest toggling does not change host flight');
 guest.run('input.flyUp=false;input.flyDown=true');
 const apex=actor(host,1).feetY;await step(host,guest,32);
 check(actor(host,1).feetY<apex-2,'held descent lowers the flying character');
 check(actor(host,1).feetY>=0,'descent cannot pass below safe floor');
 guest.run('input.flyDown=false');
 check(host.run(`(()=>{const p=mpMatch.actors.get(1).p;p.feetY=6.9;
  mp6FlyVertical(p,{u:true,dn:false},.30,0,[]);return p.feetY<=7.001})()`),
  'vertical movement clamps to the suit-sized ceiling');
 check(host.run(`(()=>{const p=mpMatch.actors.get(1).p,old=worldSolidHeadBarrier;
  p.feetY=1.7;worldSolidHeadBarrier=()=>4;
  mp6FlyVertical(p,{u:true,dn:false},.5,0,[]);worldSolidHeadBarrier=old;
  return p.feetY<2.21&&p.feetY>1.69})()`),
  'solid overhead beam blocks ascent without player clipping');
 check(host.run(`(()=>{const p=mpMatch.actors.get(1).p,old=worldSolidFeetBarrier;
  p.feetY=4;worldSolidFeetBarrier=()=>2.8;
  mp6FlyVertical(p,{u:false,dn:true},.4,0,[]);worldSolidFeetBarrier=old;
  return p.feetY>2.79})()`),
  'solid suspended floor blocks flight descent');
 check(host.run(`(()=>{const a=mpMatch.actors.get(1),p=a.p;
  p.x=22.6;p.z=10;p.feetY=3;p.flying=true;p.grounded=false;
  const cmd={mx:-1,mz:0,yaw:0,pitch:0,j:false,s:false,u:false,dn:false};
  for(let i=0;i<60;i++)mpMatchMove(p,cmd,1/30,[]);
  return p.x<22.76})()`),'flight horizontal speed cannot cross a hard wall');
 check(host.run(`(()=>{const a=mpMatch.actors.get(1),p=a.p,old=supportHeight;
  p.x=17.5;p.z=10;p.feetY=1;p.flying=true;p.grounded=false;
  supportHeight=(p,x,z)=>x>=18?4:0;
  const cmd={mx:-1,mz:0,yaw:0,pitch:0,j:false,s:false,u:false,dn:false};
  for(let i=0;i<30;i++)mpMatchMove(p,cmd,1/30,[]);
  supportHeight=old;return p.x<18&&p.feetY<1.01})()`),
  'horizontal flight cannot teleport onto a higher solid platform');
 check(host.run('mpMatchSafeInput({seq:1,mx:0,mz:0,yaw:0,pitch:0,j:false,s:false,ft:-1})===null'),
  'negative flight counter is rejected');
 check(host.run('mpMatchSafeInput({seq:1,mx:0,mz:0,yaw:0,pitch:0,j:false,s:false,u:"true"})===null'),
  'flight ascent must be a boolean');
 check(host.run('mpMatchSafeInput({seq:1,mx:0,mz:0,yaw:0,pitch:0,j:false,s:false,ad:1e30})===null'),
  'oversized ability request counter is rejected');
 check(guest.run('mp6SafeState({fl:1,sh:1,cd:[0,0,0,99]})')===false,
  'host snapshot with impossible cooldown is rejected');
 check(host.run('mpMatch.actors.get(1).seq')>=0,'host tracks authenticated command sequencing');
 const prior=host.run('mpMatch.actors.get(1).lastSpecial.ft');
 host.run(`mpMatchFast('not-a-room-peer',{kind:'mp3-input',token:mpMatch.token,
   seq:999999,mx:0,mz:0,j:false,s:false,yaw:0,pitch:0,ft:999,ad:999})`);
 check(host.run('mpMatch.actors.get(1).lastSpecial.ft')===prior,
  'unknown peer cannot toggle another player flight');
 guest.run('toggleFlight();toggleFlight()');await step(host,guest,7);
 check(actor(host,1).flying===true,'two flight taps between packets preserve even toggle parity');

 // Dash / phase movement is swept in 15 cm host-side steps; a single remote
 // request cannot teleport through a wall or create unlimited energy.
 guest.run('toggleFlight()');await step(host,guest,8);
 check(actor(host,1).flying===false,'a second toggle disables flight');
 host.run(`(()=>{const a=mpMatch.actors.get(0);a.p.x=10;a.p.z=10;
  a.p.yaw=0;a.p.feetY=0;a.p.grounded=true;a.p.energy=100;
  a.cmd.mx=0;a.cmd.mz=0;mpMatch.actors.get(1).p.x=20;mpMatch.actors.get(1).p.z=20;})()`);
 const start=actor(host,0).z;
 check(host.run('useAbility("dash")')===true,'existing E/touch ability requests network dash');
 await step(host,guest,4);
 check(actor(host,0).z>start+4.2&&actor(host,0).z<start+4.7,
  'authoritative dash moves about 4.5 meters');
 check(actor(host,0).energy<75&&actor(host,0).energy>68,'dash charges a bounded energy cost');
 const afterDash=actor(host,0).z,energy=actor(host,0).energy;
 await step(host,guest,5);
 check(Math.abs(actor(host,0).z-afterDash)<.02,'same counter is never executed twice');
 check(actor(host,0).energy>=energy,'energy starts regenerating after one paid dash');
 host.run('useAbility("dash")');await step(host,guest,2);
 check(Math.abs(actor(host,0).z-afterDash)<.02,'dash cooldown rejects rapid replays');
 host.run(`(()=>{const a=mpMatch.actors.get(0);a.p.x=22.60;a.p.z=12;
  a.p.yaw=Math.PI/2;a.p.energy=100;a.p.abilityCooldowns.dash=0})()`);
 host.run('useAbility("dash")');await step(host,guest,3);
 check(actor(host,0).x<22.76,'dash cannot tunnel through thick walls');
 check(host.run(`(()=>{const a=mpMatch.actors.get(0),p=a.p,old=supportHeight;
  p.x=17.5;p.z=10;p.feetY=1;p.flying=true;p.grounded=false;p.yaw=Math.PI/2;
  a.cmd.mx=0;a.cmd.mz=0;supportHeight=(p,x,z)=>x>=18?4:0;
  mp6Dash(a,a.cmd);supportHeight=old;return p.x<18&&p.feetY<1.01})()`),
  'flying dash cannot teleport through the side of an elevated platform');
 const wallX=actor(host,0).x;
 host.run('mpMatch.actors.get(0).p.energy=0;mpMatch.actors.get(0).p.abilityCooldowns.dash=0');
 host.run('useAbility("dash")');await step(host,guest,2);
 check(Math.abs(actor(host,0).x-wallX)<.001,'dash without energy never changes position');
 check(actor(host,0).energy<2,'rejected dash does not deduct or invent stored energy');

 // Host-controlled shield, line-of-sight pulse and repair.
 host.run(`(()=>{const a=mpMatch.actors.get(0),b=mpMatch.actors.get(1);
  a.p.x=15;a.p.z=12;a.p.feetY=0;a.p.flying=false;a.p.hp=100;a.p.armor=30;
  b.p.x=15;b.p.z=15;b.p.feetY=0;b.p.flying=false;b.p.hp=100;b.p.armor=30;b.p.energy=100;
  a.invulnUntil=0;b.invulnUntil=0;})()`);
 check(guest.run('useAbility("shield")')===true,'guest requests shield via existing control');
 await step(host,guest,6);
 check(actor(host,1).shield>2.6,'host activates three-second shield');
 check(actor(host,1).energy<55,'shield cost is deducted on host');
 const shieldHp=actor(host,1).hp;
 check(host.run('mpCombatHit(mpMatch.actors.get(0),mpMatch.actors.get(1),55)')===false,
  'shield negates host-validated gun damage');
 check(actor(host,1).hp===shieldHp,'immune player loses no hit points');
 await step(host,guest,97);
 check(actor(host,1).shield<.05,'shield expires on fixed simulation clock');
 check(host.run('mpCombatHit(mpMatch.actors.get(0),mpMatch.actors.get(1),20)')===true,
  'ordinary hits work after shield expiration');
 check(actor(host,1).hp<shieldHp,'hit points decrease after protection expires');
 guest.run('useAbility("shield")');await step(host,guest,2);
 check(actor(host,1).shield<.05,'cooldown prevents immediately recasting shield');

 host.run(`(()=>{const a=mpMatch.actors.get(0),b=mpMatch.actors.get(1);
  a.p.hp=100;a.p.armor=30;b.p.energy=100;b.p.hp=100;b.p.armor=30;
  b.p.x=15;b.p.z=15;a.p.x=15;a.p.z=12;a.invulnUntil=0;b.invulnUntil=0;
  b.p.abilityCooldowns.pulse=0;})()`);
 for(const client of [host,guest])client.run('globalThis.pulseEmitted=0;const pulseOriginal=emitPulseFx;emitPulseFx=(...args)=>{const before=game.particles.length;pulseOriginal(...args);globalThis.pulseEmitted+=game.particles.length-before}');
 guest.run('useAbility("pulse")');await step(host,guest,4);
 check(actor(host,0).hp<100||actor(host,0).armor<30,'energy pulse damages a visible opponent');
 check(actor(host,1).energy<60,'pulse costs energy only on host');
 for(const client of [host,guest])check(client.run('globalThis.pulseEmitted===45'),'full EMI particles on both clients');
 const afterPulse=actor(host,0).hp+actor(host,0).armor;
 guest.run('useAbility("pulse")');await step(host,guest,4);
 check(Math.abs(actor(host,0).hp+actor(host,0).armor-afterPulse)<.001,
  'pulse cannot be duplicated during cooldown');
 host.run(`(()=>{const a=mpMatch.actors.get(0),b=mpMatch.actors.get(1),old=mpCombatVisible;
  a.p.hp=100;a.p.armor=30;b.p.energy=100;b.p.abilityCooldowns.pulse=0;
  mpCombatVisible=()=>false;mp6Pulse(b);mpCombatVisible=old;})()`);
 check(actor(host,0).hp===100&&actor(host,0).armor===30,
  'solid cover blocks AoE pulse regardless of radius');
 host.run(`(()=>{const b=mpMatch.actors.get(1);b.p.hp=43;b.p.armor=9;
  b.p.energy=100;b.p.abilityCooldowns.heal=0;})()`);
 guest.run('useAbility("heal")');await step(host,guest,4);
 check(actor(host,1).hp>=80,'repair prioritizes damaged hull');
 check(actor(host,1).armor===9,'repair does not silently heal multiple pools');
 check(actor(host,1).energy<60,'repair pays its own energy cost');
 host.run('mpMatch.actors.get(1).p.hp=100;mpMatch.actors.get(1).p.armor=30;mpMatch.actors.get(1).p.energy=75;mpMatch.actors.get(1).p.abilityCooldowns.heal=0');
 guest.run('useAbility("heal")');await step(host,guest,3);
 check(actor(host,1).energy>=75,'healing full hull and barrier is rejected without spending energy');
 check(actor(host,1).abilityCooldowns.heal===0,'unused repair does not trigger a cooldown');
 host.run(`(()=>{const a=mpMatch.actors.get(1);a.p.flying=true;a.p.shield=2;
  a.p.energy=18;a.respawnAt=mpMatch.tick;mpCombatRespawn(a);})()`);
 check(actor(host,1).flying===false&&actor(host,1).shield===0,
  'respawn clears active air mode and protective sphere');
 check(actor(host,1).energy===100,'respawn restores baseline combat energy');

 // Simulate a dropped/duplicated fast packet and full new WebRTC channels.
 const inputSeq=host.run('mpMatch.actors.get(1).seq');
 host.run(`mpMatchFast(mpRoom.players[1].peerId,{kind:'mp3-input',token:mpMatch.token,
  seq:1,mx:0,mz:0,j:false,s:false,yaw:0,pitch:0,ft:999,ad:999})`);
 check(host.run('mpMatch.actors.get(1).seq')===inputSeq,
  'stale signed-in input packet cannot replay ability counters');
 const sid=host.run('[...mpRtcLinks.values()][0].sid');
 host.run('mpRtcManualRetry()');
 await until(()=>host.run('[...mpRtcLinks.values()][0]?.sid!=='+JSON.stringify(sid))&&
  host.run('[...mpRtcLinks.values()][0]?.fast?.readyState==="open"')&&
  guest.run('[...mpRtcLinks.values()][0]?.control?.readyState==="open"'),6000);
 check(active(host)&&active(guest),'peer reconnection retains the active air match');
 guest.run('toggleFlight()');guest.run('input.flyUp=true');await step(host,guest,15);
 check(actor(host,1).flying&&actor(host,1).feetY>0,
  'flight toggles continue to work after replacing P2P channels');
 guest.run('input.flyUp=false');
 const fullPacket=host.run(`(()=>{const m=mpMatch,w=weapons[4];
  for(let id=2;id<8;id++)m.actors.set(id,{id,team:id%2,peerId:'stress-'+id,
   p:mpMatchActor({x:8+id,z:8}),kills:0,deaths:0,respawnAt:0,invulnUntil:0});
  for(let i=0;i<24;i++)m.projectiles.push({shooter:0,w,
   pos:{x:10+i*.2,y:1.3,z:12},v:{x:1,y:0,z:17},life:2});
  const n=JSON.stringify(mpMatchState()).length;
  for(let id=2;id<8;id++)m.actors.delete(id);
  m.projectiles.length=0;return n;
 })()`);
 check(fullPacket<4000,'8 actors + 24 projectiles and ability states fit 4000-byte WebRTC cap');
 check(guest.run('mpMatch.lastSnapshot')>10,'guest receives authenticated flight/ability snapshots');
 host.run('mpMatch.round.endsAt=Date.now()-1;mpRoundCheck()');
 await until(()=>guest.run('mpMatch.round.ended'));
 check(host.run('useAbility("dash")')===false,'abilities cannot activate after final results');
 check(guest.run('toggleFlight()')===false,'guest cannot toggle flight after match end');
 check(host.saves===0&&guest.saves===0,'PvP abilities never modify campaign storage');
 host.run('mpMatchStop()');await until(()=>!active(host)&&!active(guest));
 await guest.run('mpLeave()');await host.run('mpLeave()');
 console.log('STAGE38 MP-6 FLIGHT + ABILITIES: '+assertions+' assertions passed');
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
