'use strict';
// Actual lobby/P2P/movement/combat/round modules in two connected VM browsers.
// Covers round transitions, packet validation, lost reliable finish, repeated
// snapshots, late traffic from old matches and no campaign writes.
const assert=require('node:assert/strict');
const {createBrowser,active,actor,until,wait,FakeMetered,setup,enter,state}=
 require('./test_stage35_mp3_movement.cjs');
let count=0;
function check(condition,name){assert.ok(condition,name);count++;}
async function step(host,guest,n=1){
 for(let i=0;i<n;i++){guest.run('mpMatchUpdate(1/30)');await wait(0);
  host.run('mpMatchUpdate(1/30)');await wait(0);}
}
async function startNext(host,guest,changes){
 host.run('Object.assign(mpRoom.settings,'+JSON.stringify(changes)+');mpRoom.seq++;mpPublishRoster()');
 await wait(12);
 await until(()=>host.run('mpMatchCanStart()'));
 host.run('mpMatchStartTraining()');await until(()=>active(host)&&active(guest));
}
async function endToLobby(host,guest){
 host.run('mpMatchStop()');await until(()=>!active(host)&&!active(guest));
}
async function main(){
 const server=new FakeMetered();server.iceServers=[{urls:'stun:stun.example.invalid'}];
 const host=createBrowser(server,true,true),guest=createBrowser(server,true,true);
 setup(host,'HOST');host.el('mpMode').value='ffa';
 host.el('mpScoreLimit').value='5';host.el('mpTimeLimit').value='60';
 await host.run('mpCreateRoom()');
 check(host.run('mpRoom.settings.scoreLimit')===5,'host selects a five-point match');
 check(host.run('mpRoom.settings.timeLimitSec')===60,'host selects one-minute timeout');
 check(host.run('mpSettings({scoreLimit:999,timeLimitSec:-1}).scoreLimit')===15,
  'invalid score limit is normalized');
 check(host.run('mpSettings({scoreLimit:5,timeLimitSec:999}).timeLimitSec')===300,
  'invalid match time is normalized');
 check(host.run('mpSettings({scoreLimit:"5",timeLimitSec:"60"}).scoreLimit')===15,
  'client strings cannot bypass numeric rules');
 enter(guest,state(host).code,'GUEST');await guest.run('mpJoinRoom()');
 await until(()=>host.run('mpRtcLinks.size===1')&&guest.run('mpRtcLinks.size===1')&&
  host.run('[...mpRtcLinks.values()][0].fast?.readyState==="open"')&&
  guest.run('[...mpRtcLinks.values()][0].control?.readyState==="open"'));
 
 host.run('mpMatchStartTraining()');await until(()=>active(host)&&active(guest));
 check(guest.run('mpMatch.round.settings.scoreLimit')===5,'guest receives room score limit');
 check(guest.run('mpMatch.round.settings.timeLimitSec')===60,'guest receives room time limit');
 check(host.run('mpMatch.round.ended')===false,'round starts as live');
 check(host.run('mpRoundClock()')==='01:00','host HUD counts down from one minute');
 check(host.run('mpRoundRemaining()')<=60&&host.run('mpRoundRemaining()')>58,'clock uses real wall time');
 check(host.run('mpRoundLeader("score").winnerId')===-1,'no winner on zero-zero tie');
 const oldToken=host.run('mpMatch.token');
 const signalLog=server.frameLog.length;
 await step(host,guest,6);
 check(guest.run('mpMatch.round.remoteLeft')<=60,'guest receives authoritative remaining time');
 check(server.frameLog.length===signalLog,'round timer updates use WebRTC not Metered');

 // A forged result from an unrelated peer must not finish the game.
 guest.run('mpMatchControl("stranger",{kind:"mp3-result",token:mpMatch.token,result:{}})');
 check(!guest.run('mpMatch.round.ended'),'unrecognized peer cannot announce final standings');
 guest.run('mpMatchControl(mpRoom.hostPeer,{kind:"mp3-result",token:"WRONG",result:{}})');
 check(!guest.run('mpMatch.round.ended'),'old or forged match token rejected');
 check(guest.run('mpRoundSafeResult({reason:"win",mode:"ffa",tick:2,players:[]})===null'),
  'unsupported result reason rejected');

 // Lose the reliable final announcement; guest must still learn results from
 // later state snapshots while host already stopped all gameplay.
 host.run('const beforeDroppedResult=mpRtcSend;mpRtcSend=(l,c,d)=>d.kind==="mp3-result"?false:beforeDroppedResult(l,c,d)');
 host.run('mpMatch.actors.get(0).kills=5;mpRoundCheck()');
 check(host.run('mpMatch.round.ended'),'five kills close match on host');
 check(host.run('mpMatch.round.result.reason')==='score','score cutoff is recorded');
 check(host.run('mpMatch.round.result.winnerId')===0,'host is recognized as FFA winner');
 check(host.html.includes('Победитель'),'results UI contains winner');
 const seqAfterFinish=host.run('mpMatch.actors.get(1).seq');
 host.run('mpMatchFast(mpRoom.players[1].peerId,{kind:"mp3-input",token:mpMatch.token,seq:999999,mx:0,mz:0,j:false,s:false,yaw:0,pitch:0,f:true,w:0})');
 check(host.run('mpMatch.actors.get(1).seq')===seqAfterFinish,
  'finished match rejects subsequent guest controls');
 const stressLength=host.run(`(()=>{
  const m=mpMatch,w=weapons[4];
  for(let id=2;id<8;id++)m.actors.set(id,{id,team:id%2,peerId:'stress-'+id,
   p:mpMatchActor({x:8+id,z:8}),kills:0,deaths:0,respawnAt:0,invulnUntil:0});
  for(let i=0;i<24;i++)m.projectiles.push({shooter:0,w,
   pos:{x:10+i*.2,y:1.3,z:12},v:{x:1,y:0,z:17},life:2});
  const size=JSON.stringify(mpMatchState()).length;
  for(let id=2;id<8;id++)m.actors.delete(id);
  m.projectiles.length=0;return size;
 })()`);
 check(stressLength<4000,'8-player + 24-projectile snapshot stays below 4000-byte channel limit');
 check(!guest.run('mpMatch.round.ended'),'dropped reliable announcement really reached no guest');
 await step(host,guest,40); // Finished rounds throttle fallback snapshots to 1 Hz.
 check(guest.run('mpMatch.round.ended'),'unreliable state fallback closes the guest round');
 check(guest.run('mpMatch.round.result.winnerId')===0,'state fallback preserves exact winner');
 check(guest.html.includes('РЕЗУЛЬТАТЫ'),'guest sees final scoreboard');
 const fixed=actor(host,0).z;
 host.run('input.keys.KeyW=true;input.fire=true');await step(host,guest,10);
 check(actor(host,0).z===fixed,'no movement after final results');
 check(!host.run('mpMatch.projectiles.length'),'no projectiles survive the finish');
 host.run('mpRtcSend=beforeDroppedResult;mpRoundResync(mpRoom.players[1].peerId)');
 await wait(8);
 check(guest.run('mpMatch.round.result.winnerId')===0,'duplicate reliable resync is idempotent');
 const firstSid=host.run('[...mpRtcLinks.values()][0].sid');
 host.run('mpRtcManualRetry()');
 await until(()=>host.run('[...mpRtcLinks.values()][0]?.sid!=='+JSON.stringify(firstSid))&&
  host.run('[...mpRtcLinks.values()][0]?.control?.readyState==="open"')&&
  guest.run('[...mpRtcLinks.values()][0]?.control?.readyState==="open"'),6000);
 check(host.run('mpMatch.round.result.winnerId')===0,'real P2P channel replacement preserves host results');
 check(guest.run('mpMatch.round.result.winnerId')===0,'new control channel replays already-ended match safely');
 check(host.run('mpMatch.active')&&guest.run('mpMatch.active'),'reconnect does not tear down match state');
 check(host.saves===0&&guest.saves===0,'scored match did not persist campaign state');
 await endToLobby(host,guest);

 // Time expiry with equal team scores yields a draw; control channel delivery
 // reaches the guest even before it receives another game snapshot.
 await startNext(host,guest,{mode:'teams',scoreLimit:20,timeLimitSec:60});
 check(host.run('mpMatch.round.ended')===false,'new round resets ended state');
 check(Math.hypot(actor(host,0).x-actor(host,1).x,actor(host,0).z-actor(host,1).z)>3.2,
  'opposing teams receive distinct safe start zones');
 check(host.run('mpMatch.actors.get(0).kills')===0,'new round resets frag count');
 check(host.run('mpRoundLeader("time").winnerTeam')===-1,'equal team scores are tied');
 host.run('mpMatch.round.endsAt=Date.now()-1;mpRoundCheck()');
 await until(()=>guest.run('mpMatch.round.ended'));
 check(host.run('mpMatch.round.result.reason')==='time','deadline ends combat');
 check(host.run('mpMatch.round.result.winnerTeam')===-1,'tied team deadline is draw');
 check(guest.run('mpMatch.round.result.winnerTeam')===-1,'guest receives tied score through control');
 check(guest.html.includes('Ничья'),'draw results shown to the guest');
 check(host.run('mpMatch.round.result.scores.every(x=>x===0)'),'no artificial points at draw');
 await endToLobby(host,guest);

 // Team scoreboard, friendly-fire penalties and exact outcome.
 await startNext(host,guest,{mode:'teams',scoreLimit:10,timeLimitSec:180});
 host.run('mpMatch.actors.get(1).kills=10;mpRoundCheck()');
 await until(()=>guest.run('mpMatch.round.ended'));
 check(host.run('mpMatch.round.result.winnerTeam')===1,'orange team wins on its own frag total');
 check(guest.run('mpMatch.round.result.scores[1]')===10,'guest sees complete authoritative team score');
 check(host.html.includes('оранжевая'),'winning team is named in result UI');
 check(host.run('mpRoundFinish("score")')===false,'second finish attempt cannot alter a finished round');
 await endToLobby(host,guest);

 // A missing opponent terminates ongoing game by forfeit without inventing a
 // victory from saved solo stats, and the host can start another room round.
 await startNext(host,guest,{mode:'ffa',scoreLimit:15,timeLimitSec:300});
 host.run('mpRoom.players=mpRoom.players.filter(p=>p.host);mpMatchRosterChanged()');
 check(host.run('mpMatch.round.ended'),'remaining player gets a forfeit result');
 check(host.run('mpMatch.round.result.reason')==='forfeit','forfeit is distinct from score or time');
 check(host.run('mpMatch.round.result.winnerId')===0,'remaining host wins forfeit');
 check(host.run('mpMatch.round.result.players.length')===1,'departed opponent is excluded from final standings');
 host.run('mpMatchStop()');
 check(!active(host),'host leaves result screen for lobby');
 check(host.saves===0&&guest.saves===0,'all rounds remained separate from campaign saves');
 await guest.run('mpLeave()');await host.run('mpLeave()');
 console.log('STAGE37 MP-5 MATCH RESULTS: '+count+' assertions passed');
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
