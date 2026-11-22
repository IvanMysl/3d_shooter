'use strict';
// All 100 maps traverse the actual lobby -> roster -> P2P connected -> host start protocol.
// Fake Metered and RTC isolate the test from internet; real geometry separately tested.
const assert=require('node:assert/strict');
const {createBrowser,active,until,FakeMetered,setup,enter,state}=require('./test_stage35_mp3_movement.cjs');
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++;};
(async()=>{
 for(let sector=1;sector<=100;sector++){
  const server=new FakeMetered(),host=createBrowser(server),guest=createBrowser(server);
  try{
   setup(host,'HOST');const m=host.run(`MP_MAPS[${sector-1}]`);
   host.ctx.document.querySelector=()=>({value:m.id});
   await host.run('mpCreateRoom()');check(state(host)?.settings.mapId===m.id,`L${sector} selected ID`);
   enter(guest,state(host).code,'GUEST');await guest.run('mpJoinRoom()');
   check(state(guest)?.settings.mapId===m.id,`L${sector} guest roster ID`);
   await until(()=>host.run('[...mpRtcLinks.values()][0]?.fast?.readyState==="open"')&&guest.run('[...mpRtcLinks.values()][0]?.control?.readyState==="open"'));
   check(host.run('mpMatchCanStart()'),`L${sector} host can start`);
   host.run('mpMatchStartTraining()');await until(()=>active(host)&&active(guest));
   check(host.run('game.sector')===sector&&guest.run('game.sector')===sector,`L${sector} exact same loaded map`);
   check(host.run('mpMatch.token')===guest.run('mpMatch.token'),`L${sector} token`);
   check(host.saves===0&&guest.saves===0,`L${sector} campaign untouched`);
  }finally{ guest.run('mpShutdown()');host.run('mpShutdown()');}
 }
 const server=new FakeMetered(),host=createBrowser(server);setup(host,'HOST');host.ctx.document.querySelector=()=>({value:'unknown-map'});await host.run('mpCreateRoom()');check(state(host)===null,'invalid map cannot silently create citadel');host.run('mpShutdown()');
 console.log(`STAGE115 NETWORK CATALOG: 100/100 maps; ${checks} assertions passed`);
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
