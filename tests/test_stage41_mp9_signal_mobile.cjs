'use strict';
// Stage41: true in-memory multiplayer transport remains alive when Metered
// signalling is lost; reject paths do not leak slots, and mobile controls move.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createBrowser,active,until,wait,FakeMetered,setup,enter,state}=
 require('./test_stage35_mp3_movement.cjs');
let checks=0;
function check(v,why){assert.ok(v,why);checks++;}
async function connected(server){
 const host=createBrowser(server,true,true,true,true,true);
 const guest=createBrowser(server,true,true,true,true,true);
 setup(host,'HOST');await host.run('mpCreateRoom()');
 enter(guest,state(host).code,'GUEST');await guest.run('mpJoinRoom()');
 await until(()=>host.run('[...mpRtcLinks.values()][0]?.fast?.readyState==="open"')&&
  guest.run('[...mpRtcLinks.values()][0]?.fast?.readyState==="open"'));
 await host.run('mpReady()');await guest.run('mpReady()');
 host.run('mpMatchStartTraining()');await until(()=>active(host)&&active(guest));
 return {host,guest};
}
async function main(){
 const css=fs.readFileSync(path.join(__dirname,'../styles/70-directors-cut.css'),'utf8');
 check(css.includes('Stage41')&&css.includes('#flightControls{top:auto;bottom:calc('),
  'flight controls are no longer pinned immediately under minimap in landscape phones');
 check(css.includes('max(7px, env(safe-area-inset-bottom)) + 117px'),
  'flight strip is anchored above two-row touch action area with Android safe inset');
 check(css.includes('#flightControls #flightUp,#flightControls #flightDown{min-width:40px'),
  'up/down retain individual touch targets, with no overlap with fly toggle');
 check(css.includes('max-height:340px')&&css.includes('min-height:36px'),
  'extremely short landscape displays have dedicated compact control layout');
 check(/GAME_BUILD='(?:41|42|43)'/.test(fs.readFileSync(path.join(__dirname,'../src/00-core-save.js'),'utf8')),
  'user-visible version is incremented without changing save schema');

 const server=new FakeMetered();const {host,guest}=await connected(server);
 const tickBefore=host.run('mpMatch.tick');const snapshotBefore=guest.run('mpMatch.lastSnapshot');
 check(host.run('mpSignalingOnline()')&&guest.run('mpSignalingOnline()'),
  'signalling is initially online');
 // A close emits genuine 'presence.left' to the other party. It must NOT
 // remove that actor when the existing WebRTC game channel remains open.
 host.run('mpWire.ws.close()');
 check(host.run('mpSignalingLost')&&host.run('mpRoom!==null&&mpMatch.active'),
  'host retains active game after WebSocket closes');
 check(guest.run('mpRoom!==null&&mpMatch.active'),
  'guest ignores misleading host signalling departure with live P2P');
 check(guest.run('mpMatch.actors.size')===2,'presence loss does not remove host actor');
 guest.run('mpWire.ws.close()');
 check(guest.run('mpSignalingLost')&&guest.run('mpRoom!==null&&mpMatch.active'),
  'guest also keeps its game after its signalling link fails');
 check(host.run('mpRoom.players.length')===2&&host.run('mpMatch.actors.size')===2,
  'host retains guest in roster even after signalling presence loss');
 check(host.run('mpRtcAnyGameplayOpen()')&&guest.run('mpRtcAnyGameplayOpen()'),
  'host and guest still have open WebRTC fast channels');
 for(let i=0;i<16;i++){
  guest.run('mpMatchUpdate(1/30)');await wait(0);
  host.run('mpMatchUpdate(1/30)');await wait(0);
 }
 check(host.run('mpMatch.tick')>tickBefore,
  'host simulation keeps advancing without signalling');
 check(guest.run('mpMatch.lastSnapshot')>snapshotBefore,
  'P2P state snapshots continue arriving despite both WebSockets lost');
 check(!guest.run('mpRtcManualRetry()'),
  'manual ICE restart is disallowed without live signalling');
 guest.run('mpMatch.lastFromHost=Date.now()-6000;mp8Update(mpMatch)');
 check(guest.run('mpMatch.recoveryAttempts')===0,
  'offline signalling does not consume automatic retry budget');
 check(host.saves===0&&guest.saves===0,
  'signalling outage does not write or alter solo campaign progress');
 await guest.run('mpLeave()');await host.run('mpLeave()');
 check(!active(guest)&&!active(host),'leaving an offline signalling game cleans up');

 // A server error during join acceptance rolls back the atomic slot.
 const srv2=new FakeMetered();const h=createBrowser(srv2);
 setup(h,'LEADER');await h.run('mpCreateRoom()');
 const before=h.run('mpRoom.players.length');
 h.run(`mpHostFrame({type:'message',from:'peer-that-does-not-exist'},
  {kind:'join',nick:'Ghost',nonce:'AAAAAAAAAAAAA'})`);
 await until(()=>h.run('mpRoom.players.length')===before);
 check(h.run('mpRoom.players.length')===1,'failed accept releases reservation');
 check(h.run('$('+'"mpStatus"'+').textContent.includes("не подтверждён")'),
  'host is told that admission confirmation failed');
 check(h.run('mpRoom.seq')>1,'rollback increases roster sequence to invalidate old state');
 await h.run('mpLeave()');

 // Test error-path retry accounting without changing WebRTC state.
 const srv3=new FakeMetered();const a=await connected(srv3);
 a.guest.run('mpWire.send=()=>Promise.reject(Error("simulated signalling failure"))');
 a.guest.run('mpMatch.lastFromHost=Date.now()-6000;mpRtcManualAt=0;mp8Update(mpMatch)');
 check(a.guest.run('mpMatch.recoveryAttempts')===1,
  'pending automatic retry is provisionally counted to prevent immediate duplicates');
 await wait(0);
 check(a.guest.run('mpMatch.recoveryAttempts')===0,
  'failed/undelivered request releases automatic retry budget');
 check(a.guest.run('mpMatch.recoveryNextAt>Date.now()+5000'),
  'failed auto retry applies bounded backoff instead of rapid re-sends');
 a.guest.run('mp8Update(mpMatch)');
 check(a.guest.run('mpMatch.recoveryAttempts')===0,
  'backoff prevents repeated costly signalling requests');
 await a.guest.run('mpLeave()');await a.host.run('mpLeave()');
 console.log('STAGE41 MP-9 SIGNAL + MOBILE HUD: '+checks+' assertions passed');
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
