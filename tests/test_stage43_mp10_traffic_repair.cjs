'use strict';
// Stage43 MP-10: uses application code, actual paired fake RTCDataChannels,
// and authoritative match simulation. No fabricated claims about WAN/TURN use.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createBrowser,active,actor,until,wait,FakeMetered,setup,enter,state}=
 require('./test_stage35_mp3_movement.cjs');
let checks=0;
function check(value,message){assert.ok(value,message);checks++;}
async function step(host,guest,n=1){
 for(let i=0;i<n;i++){
  guest.run('mpMatchUpdate(1/30)');await wait(0);
  host.run('mpMatchUpdate(1/30)');await wait(0);
 }
}
async function main(){
 const hostSrc=fs.readFileSync(path.join(__dirname,'../src/21j-multiplayer-traffic.js'),'utf8');
 check(hostSrc.includes('MP10_IDLE_INPUT=.24'),'idle input heartbeat has a bounded cadence');
 const server=new FakeMetered();server.iceServers=[{urls:'stun:stun.example.invalid'}];
 const host=createBrowser(server,true,true,true,true,true);
 const guest=createBrowser(server,true,true,true,true,true);
 setup(host,'HOST');await host.run('mpCreateRoom()');
 enter(guest,state(host).code,'GUEST');await guest.run('mpJoinRoom()');
 await until(()=>host.run('mpRtcLinks.size===1')&&guest.run('mpRtcLinks.size===1')&&
  host.run('[...mpRtcLinks.values()][0].fast?.readyState==="open"')&&
  guest.run('[...mpRtcLinks.values()][0].fast?.readyState==="open"'));
 
 host.run('mpMatchStartTraining()');await until(()=>active(host)&&active(guest));
 check(host.run('MP_VERSION')>=3,'all compact-packet clients require at least protocol v3');
 check(host.run('typeof mp10Encode')==='function'&&guest.run('typeof mp10Decode')==='function',
  'both simulated browsers loaded the production v43 codec');

 // Validate two independent live clients, not just isolated pack/unpack tests.
 await step(host,guest,15);
 check(guest.run('mpMatch.lastSnapshot')>0,'guest accepts compact authoritative snapshots');
 check(host.run('mpMatch.actors.get(1).seq')>0,'host accepts compact controller input');
 check(host.run('mpMatch.netTx')>0&&guest.run('mpMatch.netRx')>0,
  'P2P byte counters measure sent and received payload');
 const normal=host.run(`(()=>{
  const s=mpMatchState(),p=mp10Encode(s,mpRoom.players[1].peerId),d=mp10Decode(p);
  return {original:JSON.stringify(s).length,packed:JSON.stringify(p).length,
   decoded:d.actors.length===2&&d.actors[1].hp===s.actors[1].hp&&
    d.actors[0].x===s.actors[0].x&&d.tick===s.tick};})()`);
 check(normal.packed<normal.original*.72,'compact live snapshot saves at least 28% of JSON payload');
 check(normal.decoded,'packed snapshot restores all authoritative actor fields');

 // Idle snapshots and inputs are throttled. Moving/firing keep the original
 // high-frequency path, with urgent fire-release delivered on the next frame.
 host.run(`(()=>{const c=[...mpRtcLinks.values()][0].fast,c0=c.send.bind(c);
  mpMatch.mp10Packets=[];c.send=str=>{const v=JSON.parse(str);
   if(v.kind==='mp3-state')mpMatch.mp10Packets.push(str.length);return c0(str)};})()`);
 guest.run(`(()=>{const c=[...mpRtcLinks.values()][0].fast,c0=c.send.bind(c);
  mpMatch.mp10Inputs=[];c.send=str=>{if(JSON.parse(str).kind==='mp3-input')mpMatch.mp10Inputs.push(str.length);return c0(str)};})()`);
 await step(host,guest,90);
 const guestIdle=guest.run('mpMatch.mp10Inputs.length'),hostIdle=host.run('mpMatch.mp10Packets.length');
 check(guestIdle>=9&&guestIdle<=18,'idle inputs reduced to ~4 per simulated second');
 check(hostIdle>=9&&hostIdle<=18,'idle world-state packets reduced to ~4 per simulated second');
 guest.run('input.keys.KeyW=true;input.fire=true');
 await step(host,guest,90);
 const guestBusy=guest.run('mpMatch.mp10Inputs.length')-guestIdle;
 const hostBusy=host.run('mpMatch.mp10Packets.length')-hostIdle;
 check(guestBusy>=33,'active combat keeps a high-rate controller stream');
 check(hostBusy>=25,'active combat keeps ~10 host snapshots per second');
 const latency=host.run(`(()=>{
  const p={yaw:0,pitch:0,hp:100,armor:30,weapon:0,grounded:true,energy:100,
   flying:false,shield:0,vy:0,x:0,z:0,feetY:0};
  const m={actors:new Map([[0,{id:0,p,cmd:{mx:0,mz:0}}]]),projectiles:[],tick:10};
  mp10SnapshotSent(m);
  const idle=mp10SnapshotPeriod(m),oldYaw=p.yaw,oldHp=p.hp;
  p.yaw+=.2;const aim=mp10SnapshotPeriod(m);p.yaw=oldYaw;
  p.hp=Math.max(0,p.hp-20);const hit=mp10SnapshotPeriod(m);p.hp=oldHp;
  p.x+=4.5;const dash=mp10SnapshotPeriod(m);
  return {idle,aim,hit,dash};})()`);
 check(latency.idle===.25&&latency.aim===.1&&latency.hit===.1&&latency.dash===.1,
  'stationary aim turns, damage and dash switch immediately to responsive 10Hz snapshots');
 const sampleInput=guest.run(`(()=>{
  const c=mpMatchInput(),packet={v:MP_VERSION,kind:'mp3-input',token:mpMatch.token,seq:100,...c};
  return [JSON.stringify(packet).length,JSON.stringify(mp10Encode(packet,mpRoom.hostPeer)).length];})()`);
 check(sampleInput[1]<sampleInput[0]*.8,'compact controls save over 20% during active combat');
 const roundRecovery=host.run(`(()=>{
  const m=mpMatch,clock=mpRoundState(),packet={...mpMatchState(),tick:30};
  m.round.ended=true;m.round.result={reason:'time',mode:'ffa'};
  packet.round=mpRoundState();
  const decoded=mp10Decode(mp10Encode(packet,mpRoom.players[1].peerId));
  m.round.ended=false;m.round.result=null;
  return decoded.round?.result?.reason==='time';})()`);
 check(roundRecovery,'final result is always in a full snapshot even if reliable result event was lost');
 guest.run('input.keys.KeyW=false;input.fire=false');
 await step(host,guest,1);
 check(host.run('mpMatch.actors.get(1).cmd.f')===false,'fire release reaches host promptly');
 await step(host,guest,10);
 check(Math.abs(actor(guest,1).z-actor(host,1).z)<1.3,
  'compact input preserves local prediction and host position reconciliation');

 // Repair has NO cooldown; low battery must not trigger partial restoration.
 // Full armor and HP do not spend energy.
 host.run(`(()=>{const a=mpMatch.actors.get(0);a.p.hp=10;a.p.armor=15;
  a.p.energy=100;a.p.abilityCooldowns.heal=0;})()`);
 host.run('useAbility("heal")');await step(host,guest,2);
 const first=actor(host,0);
 check(first.hp>47&&first.hp<49,'first tap immediately repairs 38 HP');
 check(first.abilityCooldowns.heal===0,'repair cooldown is exactly zero');
 host.run('useAbility("heal")');await step(host,guest,2);
 const second=actor(host,0);
 check(second.hp>85,'second immediate tap works without any wait');
 check(second.energy<20,'repeated repairs cost energy');
 host.run('mpMatch.actors.get(0).p.energy=10;mpMatch.actors.get(0).p.hp=20');
 const eBefore=actor(host,0).energy;
 host.run('useAbility("heal")');await step(host,guest,1);
 const partial=actor(host,0);
 check(partial.hp===20,'ten energy cannot partially repair 38 HP');
 check(partial.energy>=eBefore,'rejected repair preserves energy (normal regen continues)');
 host.run('mpMatch.actors.get(0).p.energy=0;mpMatch.actors.get(0).p.hp=20');
 const noBattery=host.run('mp6Skill(mpMatch.actors.get(0),"heal")');
 check(noBattery===false&&actor(host,0).hp===20,'zero-energy heal is impossible');
 host.run('mpMatch.actors.get(0).p.energy=45;mpMatch.actors.get(0).p.hp=23');
 host.run('mp6Skill(mpMatch.actors.get(0),"heal")');
 const repaired=actor(host,0).hp;
 check(repaired===61,'full energy restores exactly 38 HP without waiting');
 check(host.run('$("mpCombatScore").textContent').includes('♥ '+Math.ceil(repaired)),
  'host HP scoreboard updates on the same repair operation, without a 350ms UI wait');
 host.run('mpMatch.actors.get(0).p.energy=20;mpMatch.actors.get(0).p.hp=100;mpMatch.actors.get(0).p.armor=30');
 check(host.run('mp6Skill(mpMatch.actors.get(0),"heal")')===false&&actor(host,0).energy===20,
  'full health and armor never consume charge');
 host.run('mpMatch.actors.get(0).p.hp=100;mpMatch.actors.get(0).p.armor=0;mpMatch.actors.get(0).p.energy=10');
 check(host.run('mp6Skill(mpMatch.actors.get(0),"heal")')===false&&actor(host,0).armor===0&&actor(host,0).energy===10,
  'underfunded barrier action also restores nothing and costs nothing');
 host.run('mpMatch.actors.get(0).p.armor=29;mpMatch.actors.get(0).p.energy=10');
 check(host.run('mp6Skill(mpMatch.actors.get(0),"heal")')===true&&actor(host,0).armor===30&&actor(host,0).energy>7,
  'final small barrier remainder is fully repaired for its exact fractional price');

 // High-load wire packet: 8 authoritative actors, 72 projectiles; only
 // nearest 48 visuals are transmitted and mandatory state is never omitted.
 const stress=host.run(`(()=>{
  const m=mpMatch,existing=[...m.actors.entries()],original=m.projectiles;
  try{
   for(let id=2;id<8;id++)m.actors.set(id,{id,peerId:'stress-'+id,
    p:mpMatchActor({x:11+id,z:12}),kills:0,deaths:0,respawnAt:0,invulnUntil:0});
   m.projectiles=[];const w=weapons.find(x=>x.mode==='projectile');
   for(let i=0;i<72;i++)m.projectiles.push({shooter:0,w,
    pos:{x:8+i*.2,y:1.2,z:10+i*.1},v:{x:1,y:0,z:17},life:2});
   const s=mpMatchState(),raw=JSON.stringify(s).length;
   const baseline=JSON.stringify({...s,ordnance:s.ordnance.slice(0,24)}).length;
   const p=mp10Encode(s,mpRoom.players[1].peerId),packed=JSON.stringify(p).length;
   const d=mp10Decode(p);
   return {raw,baseline,packed,actors:d?.actors?.length,visuals:d?.ordnance?.length,
    healthy:!!mpMatchSafeState(d)};
  }finally{m.actors=new Map(existing);m.projectiles=original;}
 })()`);
 check(stress.actors===8&&stress.healthy,'all eight player states survive the compact codec');
 check(stress.visuals>24&&stress.visuals<=48,'up to 48 nearby projectiles render, vs the old 24');
 check(stress.packed<3800&&stress.packed<stress.raw*.65&&stress.packed<stress.baseline,
  'worst-case active wire payload remains bounded and substantially smaller');

 const malformed=guest.run(`(()=>{
  const src=mp10Encode(mpMatchState(),mpRoom.hostPeer),bad=JSON.parse(JSON.stringify(src));
  bad.a[0][16]=999999;const before=mpMatch.lastSnapshot;
  mpRtcFastMessage([...mpRtcLinks.values()][0],{data:JSON.stringify(bad)});
  return mpMatch.lastSnapshot===before;})()`);
 check(malformed,'forged impossible HP is rejected after network decompression');
 check(guest.run('mp10Decode({kind:"mp3-input",c:1,i:[0,0,2]})===null'),
  'malformed compact input is rejected before reaching host');
 check(guest.run('mp10Decode({kind:"mp3-state",c:1,a:new Array(9).fill([])})===null'),
  'oversized actor list is rejected before state validation');
 check(host.saves===0&&guest.saves===0,'PvP traffic and repairs do not write solo saves');
 await guest.run('mpLeave()');await host.run('mpLeave()');
 console.log('STAGE43 MP-10 TRAFFIC + REPAIR: '+checks+' assertions passed');
 console.log('  Realistic 2-player snapshot bytes: '+normal.original+' -> '+normal.packed+
  ' ('+(100*(1-normal.packed/normal.original)).toFixed(1)+'% saved)');
 console.log('  Synthetic 8-player + 72 projectile bytes: '+stress.raw+' -> '+stress.packed+
  ' ('+(100*(1-stress.packed/stress.raw)).toFixed(1)+'% saved; '+stress.visuals+' visuals)');
 console.log('  Comparable V42 8-player/24-projectile baseline: '+stress.baseline+
  ' bytes; V43 '+stress.packed+' bytes and '+stress.visuals+' visible projectiles');
 console.log('  Idle 3 s: '+guestIdle+' guest inputs, '+hostIdle+' host snapshots; active 3 s: '+
  guestBusy+' inputs, '+hostBusy+' snapshots');
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;setTimeout(()=>process.exit(1),30);});
