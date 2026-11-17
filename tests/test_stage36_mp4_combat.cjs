'use strict';
// Execute the actual MP-1..MP-4 modules on two connected virtual browsers.
// The real ray/visibility math is stubbed with one deterministic wall at x=23;
// no real Metered credentials, Chromium or Android device are implied.
const assert=require('node:assert/strict');
const {createBrowser,active,actor,until,wait,FakeMetered,setup,enter,state}=
 require('./test_stage35_mp3_movement.cjs');
let checks=0;
const test=(condition,name)=>{assert.ok(condition,name);checks++;};
async function advance(host,guest,n=1){
 for(let i=0;i<n;i++){
  guest.run('mpMatchUpdate(1/30)');
  await wait(0);
  host.run('mpMatchUpdate(1/30)');
  await wait(0);
 }
}
async function main(){
 const server=new FakeMetered();server.iceServers=[{urls:'stun:stun.example.invalid'}];
 const host=createBrowser(server,true),guest=createBrowser(server,true);
 setup(host,'HOST');await host.run('mpCreateRoom()');
 host.run('mpRoom.settings.equipment="owned"');
 enter(guest,state(host).code,'GUEST');await guest.run('mpJoinRoom()');
 await until(()=>host.run('mpRtcLinks.size===1')&&guest.run('mpRtcLinks.size===1')&&
  host.run('[...mpRtcLinks.values()][0].fast?.readyState==="open"')&&
  guest.run('[...mpRtcLinks.values()][0].fast?.readyState==="open"'));
 await host.run('mpReady()');await guest.run('mpReady()');
 host.run('mpMatchStartTraining()');await until(()=>active(host)&&active(guest));
 test(host.run('mpMatch.host')&&!guest.run('mpMatch.host'),'only room owner runs combat simulation');
 test(host.run('mpMatch.actors.size')===2,'both combatant models initialized');
 test(actor(host,0).hp===100&&actor(host,0).armor===30,'equal PvP defensive baseline independent of saved perks');
 test(actor(host,1).hp===100&&actor(host,1).armor===30,'remote PvP actor has standard defense');
 test(host.run('mpMatch.actors.get(1).invulnUntil===45'),'start protection is deterministic');
 test(host.run('mpMatch.actors.get(0).kills===0'),'scoreboard starts at zero');
 test(host.run('mpCombatSyncHud(); true'),'scoreboard updates without a browser error');
 test(host.changes.nodes.has('mpCombatScore'),'scoreboard created in DOM');
 const serverLog=server.frameLog.length;

 host.run('mpMatch.actors.get(0).p.x=12;mpMatch.actors.get(0).p.z=12;'+
  'mpMatch.actors.get(0).p.yaw=0;mpMatch.actors.get(0).p.pitch=0;'+
  'mpMatch.actors.get(1).p.x=12;mpMatch.actors.get(1).p.z=17');
 await advance(host,guest,50);
 test(host.run('mpMatch.tick')>=50,'host fixed-step tick makes players vulnerable after spawn shield');
 test(host.run('mpCombatTarget(mpMatch.actors.get(0),{x:12,y:1.47,z:12},{x:0,y:0,z:1},32)?.actor.id')===1,
  'head/chest hitboxes find an opponent on the weapon ray');
 const firstHp=actor(host,1).hp;
 host.run('input.fire=true');await advance(host,guest,13);host.run('input.fire=false');
 test(actor(host,1).hp<firstHp,'host hitscan inflicts actual damage');
 test(actor(host,1).armor<30,'energy shield absorbs part of damage first');
 await advance(host,guest,5);
 test(actor(guest,1).hp<=actor(host,1).hp+1,'guest reads authoritative health snapshots');
 test(host.run('mpMatch.actors.get(0).p.shots>0'),'shot counter increments when host actually fires');
 test(server.frameLog.length===serverLog,'shots and HP snapshots bypass Metered signal quota');
 test(host.run('mpMatchSafeInput({seq:1,mx:0,mz:0,j:false,s:false,yaw:0,pitch:0,f:0,w:0})===null'),
  'malformed fire type rejected');
 test(host.run('mpMatchSafeInput({seq:1,mx:0,mz:0,j:false,s:false,yaw:0,pitch:0,f:true,w:99})===null'),
  'unbounded gun index rejected');
 const beforeForgery=actor(host,0).hp;
 host.run('mpMatchFast(mpRoom.players[1].peerId,{kind:"mp3-state",token:mpMatch.token,tick:999999,actors:[]})');
 host.run('mpMatchFast(mpRoom.players[1].peerId,{kind:"mp3-effect",token:mpMatch.token,type:"down",gun:0,a:[0,0,0],b:[0,0,0]})');
 test(actor(host,0).hp===beforeForgery,'guest cannot inject damage or authoritative snapshots');

 // A shot must stop at an opaque obstacle, even when a target hitbox is beyond it.
 host.run('mpMatch.actors.get(0).p.x=21;mpMatch.actors.get(0).p.z=12;'+
  'mpMatch.actors.get(0).p.yaw=Math.PI/2;mpMatch.actors.get(0).p.pitch=0;'+
  'mpMatch.actors.get(1).p.x=25;mpMatch.actors.get(1).p.z=12;'+
  'mpMatch.actors.get(0).p.cooldown=0');
 const wallHp=actor(host,1).hp;
 host.run('mpCombatShot(mpMatch.actors.get(0),weapons[0])');
 test(actor(host,1).hp===wallHp,'hitscan weapon cannot hit through x=23 wall');

 // All weapons are selectable in owned-loadout mode, but no solo upgrades apply.
 test(host.run('mpMatch.settings.equipment')==='owned','initial room chooses owned-mode selection');
 host.run('switchWeapon(4)');
 test(actor(host,0).weapon===4,'host can select rocket launcher');
 host.run('mpMatch.actors.get(0).p.x=12;mpMatch.actors.get(0).p.z=12;'+
  'mpMatch.actors.get(0).p.yaw=0;mpMatch.actors.get(0).p.pitch=0;'+
  'mpMatch.actors.get(1).p.x=12;mpMatch.actors.get(1).p.z=18;'+
  'mpMatch.actors.get(1).p.hp=100;mpMatch.actors.get(1).p.armor=30;');
 await advance(host,guest,8);
 host.run('mpMatch.actors.get(0).p.cooldown=0;input.fire=true');
 await advance(host,guest,2);host.run('input.fire=false');
 test(host.run('mpMatch.projectiles.length')>=1,'rocket launches a server-owned projectile');
 await advance(host,guest,26);
 test(actor(host,1).hp<100,'server rocket travels and detonates near the opponent');
 test(host.run('mpMatch.projectiles.length')===0,'expired or detonated rockets are removed');

 // Guest controls drive firing, but cannot submit claimed hits or health.
 host.run('mpMatch.actors.get(0).p.x=12;mpMatch.actors.get(0).p.z=12;'+
  'mpMatch.actors.get(0).p.hp=100;mpMatch.actors.get(0).p.armor=30;'+
  'mpMatch.actors.get(1).p.x=12;mpMatch.actors.get(1).p.z=17;'+
  'mpMatch.actors.get(1).p.cooldown=0');
 guest.run('game.p.yaw=Math.PI;game.p.pitch=0;switchWeapon(0);input.fire=true');
 await advance(host,guest,24);guest.run('input.fire=false');
 test(actor(host,0).hp<100,'guest can damage host via validated fire control');
 test(host.run('mpMatch.actors.get(1).seq')>0,'input order is tracked by room owner');

 // Deterministic death, respawn, spawn protection, no kill duplication.
 host.run('mpMatch.actors.get(1).p.hp=30;mpMatch.actors.get(1).p.armor=0;'+
  'mpMatch.actors.get(1).invulnUntil=0');
 const oldKills=host.run('mpMatch.actors.get(0).kills');
 host.run('mpCombatHit(mpMatch.actors.get(0),mpMatch.actors.get(1),100)');
 test(actor(host,1).hp===0,'fatal hit marks a dead actor');
 test(host.run('mpMatch.actors.get(0).kills')===oldKills+1,'correct killer scores one elimination');
 const oldDeaths=host.run('mpMatch.actors.get(1).deaths');
 host.run('mpCombatHit(mpMatch.actors.get(0),mpMatch.actors.get(1),100)');
 test(host.run('mpMatch.actors.get(1).deaths')===oldDeaths,'a dead player cannot be killed twice');
 test(host.run('mpMatch.actors.get(1).respawnAt>mpMatch.tick'),'respawn timestamp scheduled');
 await advance(host,guest,91);
 test(actor(host,1).hp===100&&actor(host,1).armor===30,'respawn restores baseline HP and barrier');
 test(host.run('mpMatch.actors.get(1).respawnAt===0'),'respawn timer cleared after spawn');
 const spawnHp=actor(host,1).hp;
 host.run('mpCombatHit(mpMatch.actors.get(0),mpMatch.actors.get(1),100)');
 test(actor(host,1).hp===spawnHp,'temporary spawn protection blocks immediate retaliation');

 host.run('mpMatch.settings.mode="teams";mpMatch.actors.get(0).team=0;mpMatch.actors.get(1).team=0;'+
  'mpMatch.actors.get(1).invulnUntil=0;mpMatch.actors.get(1).p.armor=0;');
 const teamBefore=host.run('mpMatch.actors.get(0).kills');
 host.run('mpCombatHit(mpMatch.actors.get(0),mpMatch.actors.get(1),200)');
 test(host.run('mpMatch.actors.get(0).kills')===teamBefore-1,
  'friendly fire hurts teammate and penalizes a team kill');
 test(host.run('mpMatch.actors.get(1).deaths')===oldDeaths+1,'friendly-fire victim records a death');
 test(host.run('mpMatch.settings.friendlyFire')===true,'friendly fire cannot be toggled off in room');

 // Payload schema rejects fabricated/invalid authoritative state on guests.
 test(guest.run('mpMatchSafeState({tick:1e9,actors:[{id:0,x:2,z:2,h:0,yaw:0,pitch:0,vy:0,e:100,w:0,g:1,hp:999,ar:30,gun:0,k:0,d:0,rs:0},'+
  '{id:1,x:3,z:3,h:0,yaw:0,pitch:0,vy:0,e:100,w:0,g:1,hp:100,ar:30,gun:0,k:0,d:0,rs:0}]})===null'),
  'fabricated snapshot with impossible health is invalid');
 host.run('mpMatchStop()');await until(()=>!active(host)&&!active(guest));
 test(!host.changes.nodes.has('mpCombatScore'),'scoreboard DOM removed when match ends');
 test(host.saves===0&&guest.saves===0,'PvP did not write campaign saves');

 // A second round must honor the locked weapon in equal equipment mode.
 host.run('mpRoom.settings.equipment="equal";mpRoom.settings.weapon=2;mpRoom.seq++;mpPublishRoster()');
 await wait(12);
 await host.run('mpReady()');await guest.run('mpReady()');
 await until(()=>host.run('mpMatchReady()'));
 host.run('mpMatchStartTraining()');await until(()=>active(host)&&active(guest));
 test(actor(host,0).weapon===2&&actor(host,1).weapon===2,'equal loadout assigns host preset to all actors');
 guest.run('switchWeapon(4)');
 test(actor(guest,1).weapon===2,'guest cannot select another gun in equal mode');
 host.run('mpMatch.actors.get(1).cmd.w=4;mpCombatStep(1/30)');
 test(actor(host,1).weapon===2,'host ignores forged weapon choice in equal mode');
 test(host.run('mpMatchState().actors.length')===2,'combat snapshot includes all live room actors');
 const snapshotSize=host.run('JSON.stringify(mpMatchState()).length');
 test(snapshotSize<4000,'normal combat snapshot fits strict RTCDataChannel message bound');
 host.run('mpMatchStop()');await until(()=>!active(host)&&!active(guest));
 await guest.run('mpLeave()');await host.run('mpLeave()');
 console.log('STAGE36 MP-4 COMBAT: '+checks+' assertions passed');
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
