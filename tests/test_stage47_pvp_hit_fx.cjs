'use strict';
// Stage47 real two-browser PvP and rendering regressions (no external account).
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createBrowser,active,actor,until,wait,FakeMetered,setup,enter,state}=
 require('./test_stage35_mp3_movement.cjs');
let checks=0;
function check(ok,label){assert.ok(ok,label);checks++;}
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
async function start(){
 const server=new FakeMetered();server.iceServers=[{urls:'stun:stun.example.invalid'}];
 const host=createBrowser(server,true),guest=createBrowser(server,true);
 setup(host,'HOST');await host.run('mpCreateRoom()');
 enter(guest,state(host).code,'GUEST');await guest.run('mpJoinRoom()');
 await until(()=>host.run('mpRtcLinks.size===1')&&guest.run('mpRtcLinks.size===1')&&
  host.run('[...mpRtcLinks.values()][0].fast?.readyState==="open"')&&
  guest.run('[...mpRtcLinks.values()][0].fast?.readyState==="open"'));
 
 host.run('mpMatchStartTraining()');await until(()=>active(host)&&active(guest));
 host.run('mpMatch.tick=70;for(const a of mpMatch.actors.values()){a.invulnUntil=0;a.respawnAt=0;}');
 host.run('mpMatch.fxPackets=[];const oldSend=mpRtcFastSend;'+
  'mpRtcFastSend=function(peer,event){if(event.kind==="mp3-effect")'+
  'mpMatch.fxPackets.push({event,encoded:mp10Encode(event,peer)});return oldSend(peer,event);};');
 return {server,host,guest};
}
async function main(){
 const {server,host,guest}=await start();
 const baseline=server.frameLog.length;
 check(host.run('mpMatch.fxPackets.length')===0,'no synthetic hit events on room start');
 host.run('(()=>{const a=mpMatch.actors.get(0).p,b=mpMatch.actors.get(1).p;'+
  'a.x=12;a.z=12;a.yaw=0;a.pitch=0;b.x=12;b.z=17;b.hp=100;b.armor=30;'+
  'a.hp=100;a.armor=30;})()');
 host.run('mpCombatShot(mpMatch.actors.get(0),{...weapons[0],spread:0})');
 await wait(5);
 const info=host.run('mpMatch.fxPackets.at(-1)');
 check(info.event.type==='shot','actual hit uses existing shot event');
 check(info.event.h?.length===1,'one authoritative hit encoded in same packet');
 check((info.event.h[0]>>2)===1,'hit metadata identifies victim, not shooter');
 check(info.event.h[0]%2===0,'normal hit distinguished from shield blocking');
 check(info.encoded.h?.[0]===info.event.h[0],'MP10 compression preserves hit code');
 check(info.encoded.i.length===9,'packed event retains old compact nine-number base');
 check(actor(host,1).hp<100&&actor(host,1).armor<30,'damage unchanged and host authoritative');
 check(host.run('mpMatch.actors.get(1).p.hitFlash')>.1,'host sees glowing victim armor');
 check(guest.run('mpMatch.actors.get(1).p.hitFlash')>.1,'guest sees own impact');
 check(guest.run('mpMatch.hurtPulse')>.05,'victim sees faint damage-screen pulse');
 check(host.run('mpMatch.hitConfirm')>.05,'shooter sees hit confirmation');
 check(host.el('crosshair').classList.contains('hit'),'shooter crosshair highlights');
 check(host.run('game.impactFx.length')>=1&&guest.run('game.impactFx.length')>=1,
  'impact orb visible on BOTH clients');
 check(host.run('game.particles.length')>=1&&guest.run('game.particles.length')>=1,
  'impact sparks visible on BOTH clients');
 check(server.frameLog.length===baseline,'hit metadata costs no Metered signalling');
 const size=host.run('mpMatch.fxPackets.at(-1).encoded');
 const lengths=[JSON.stringify(size).length,JSON.stringify({...size,h:undefined}).length];
 check(lengths[0]-lengths[1]<12,'single-player hit adds under 12 compressed bytes');

 // Armor/HP immunity: still show cyan shield collision, never false damage.
 host.run('(()=>{const b=mpMatch.actors.get(1).p;b.shield=2;b.hp=96;b.armor=20;})()');
 const before=actor(host,1).hp;
 host.run('mpCombatShot(mpMatch.actors.get(0),{...weapons[0],spread:0})');
 await wait(5);
 check(actor(host,1).hp===before,'shielded player takes no damage');
 check(host.run('mpMatch.fxPackets.at(-1).event.h[0]&1')===1,'blocked-hit flag transmitted');
 check(guest.run('mpMatch.actors.get(1).p.hitBlocked')===true,'guest shows absorbed hit');
 check(host.run('game.impactFx.at(-1).col[2]')===1,'cyan shield-impact color used');

 // Headshot exact collision: brighter helmet response, not chest only.
 host.run('(()=>{const b=mpMatch.actors.get(1).p;b.shield=0;b.hp=100;b.armor=30;'+
  'const a=mpMatch.actors.get(0).p;a.pitch=.033;})()');
 host.run('mpCombatShot(mpMatch.actors.get(0),{...weapons[0],spread:0})');
 await wait(5);
 check(host.run('mpMatch.fxPackets.at(-1).event.h[0]&2')===2,'head collision encoded in existing shot');
 check(guest.run('mpMatch.actors.get(1).p.hitHead')===true,'helmet flash shown on guest');
 check(host.run('game.impactFx.at(-1).y')>1.5,'head impact orb placed near helmet');

 // Explosions include several affected players in ONE existing blast packet.
 host.run('(()=>{const a=mpMatch.actors.get(0).p,b=mpMatch.actors.get(1).p;'+
  'a.hp=100;a.armor=30;b.hp=100;b.armor=30;'+
  'mpCombatBlast(mpMatch.actors.get(0),{x:12,y:1.2,z:15},'+
  '{...weapons[4],blast:7,damage:17},mpMatch.actors.get(1));})()');
 await wait(5);
 check(host.run('mpMatch.fxPackets.at(-1).event.type')==='blast','explosion emits blast');
 check(host.run('mpMatch.fxPackets.at(-1).event.h.length')===2,'one blast tags two victims');
 check(host.run('mpMatch.fxPackets.at(-1).event.s')===0,'blast explicitly carries shooter id');
 check(guest.run('mpMatch.actors.get(0).p.hitFlash')>.1,'spectator sees host blast victim');
 check(host.run('mpMatch.hitConfirm')>.05,'blast confirms PvP damage to shooter');
 check(host.run('mpMatch.fxPackets.at(-1).encoded.s')===0,'compressed blast keeps shooter id');
 check(server.frameLog.length===baseline,'explosions still avoid signalling relay');

 // Both directions matter: guests may be shooters, hosts may be victims.
 host.run('(()=>{const a=mpMatch.actors.get(0).p,b=mpMatch.actors.get(1).p;'+
  'a.z=17;a.hp=100;a.armor=30;a.shield=0;b.z=12;b.yaw=0;b.pitch=0;'+
  'b.hp=100;b.armor=30;})()');
 host.run('mpCombatShot(mpMatch.actors.get(1),{...weapons[0],spread:0})');
 await wait(5);
 check(host.run('mpMatch.fxPackets.at(-1).event.h[0]>>2')===0,
  'guest shooter hits host actor on authoritative ray');
 check(host.run('mpMatch.actors.get(0).p.hitFlash')>.1,'host victim flashes on impact');
 check(host.run('mpMatch.hurtPulse')>.05,'host victim gets red screen feedback');
 check(guest.run('mpMatch.hitConfirm')>.05,'guest shooter sees hit confirmation');
 check(guest.el('crosshair').classList.contains('hit'),'guest shooter crosshair animates');
 check(server.frameLog.length===baseline,'guest PvP effects still send no signalling');

 // Real network decoding rejects malformed optional payloads.
 check(guest.run('mp10Decode({kind:"mp3-effect",c:1,i:[0,0,0,0,0,0,0,0,0],h:[99]})')===null,
  'invalid packed hit actor id rejected');
 check(guest.run('mp10Decode({kind:"mp3-effect",c:1,i:[0,0,0,0,0,0,0,0,0],h:new Array(9).fill(0)})')===null,
  'oversized hit list rejected');
 const impacts=guest.run('game.impactFx.length');
 guest.run('mpCombatReceiveEffect({token:mpMatch.token,type:"shot",gun:0,id:0,'+
  'a:[12,1,12],b:[12,1,17],h:[999]})');
 check(guest.run('game.impactFx.length')===impacts,'malformed effects cannot allocate particles');
 check(guest.run('mp10Decode(mp10Encode(mpMatch.fxPackets?.at(-1)?.event||'+
  '{kind:"mp3-effect",v:3,token:mpMatch.token,type:"shot",gun:0,id:0,a:[1,2,3],b:[4,5,6],h:[4]},'+
  'mpRoom.hostPeer))?.h?.[0]')===4,'optional field round-trips through real MP10 codec');

 // Lost fast-channel effects: authoritative HP decrease independently lights victim.
 guest.run('mpMatch.actors.get(1).p.hitFlash=0');
 const pre=actor(guest,1).hp;
 host.run('mpMatch.tick+=3;mpMatch.actors.get(1).p.hp=45;'+
  'mpRtcFastSend(mpRoom.players[1].peerId,mpMatchState())');
 await wait(5);
 check(actor(guest,1).hp<pre,'new authoritative snapshot received');
 check(guest.run('mpMatch.actors.get(1).p.hitFlash')>.1,
  'snapshot fallback restores hit FX after simulated lost event');

 // Per-device quotas, animation decay, and idle packet size.
 for(const quality of [0,2]){
  host.run('save.settings={quality:'+quality+'};game.particles=[];game.impactFx=[];'+
   'mpMatch.actors.get(1).p.lastHitSparkAt=-100;'+
   'mpCombatPlayerHitFx(4,{x:12,y:1.2,z:12})');
  check(host.run('game.particles.length')===(quality===0?3:5),
   `quality ${quality}: sparks capped to mobile/desktop budget`);
 }
 host.run('game.particles=[];game.impactFx=[];'+
  'for(let j=0;j<200;j++){game.t+=.1;mpCombatPlayerHitFx(4,{x:12,y:1.2,z:12});}');
 check(host.run('game.particles.length')<=48,'global player-impact spark pool bounded');
 check(host.run('game.impactFx.length')<=35,'impact orb pool bounded');
 host.run('mpMatchUpdate(1)');
 check(host.run('mpMatch.hitConfirm')===0,'hit confirmation decays naturally');
 check(!host.el('crosshair').classList.contains('hit'),'crosshair returns to normal');
 check(host.run('mpMatch.actors.get(1).p.hitFlash')===0,'armor flash expires');

 // Test real 3D/Canvas actor renderers, including low-quality Android path.
 const operator=src('09a-player-third-person.js');
 const body=operator.slice(operator.indexOf('function renderOperator(g,p){'),
  operator.indexOf('// The same grade/shape'));
 const fallback=operator.slice(operator.indexOf('function drawFallbackOperator(ctx,p,size){'),
  operator.indexOf('// Reflect saved camera mode'));
 const draws=[],canvas={};for(const name of ['beginPath','moveTo','lineTo','quadraticCurveTo',
  'closePath','fill','stroke','save','restore','scale','translate','rotate'])canvas[name]=()=>{};
 let ellipses=0;canvas.ellipse=()=>{ellipses++;};
 const palette={grade:0,primary:[.2,.3,.4],light:[.4,.6,.7],shadow:[.1,.2,.3],
  fabric:[.3,.35,.4],joint:[.2,.2,.2],black:[0,0,0],visor:[.1,.9,1],accent:[.4,1,1]};
 const view={Math,console,save:{settings:{quality:0},bodyArmor:{owned:{}}},touchOnly:true,
  glReady:true,geom:{bevel:'bevel',rounded:'rounded',cylinder:'cylinder',ring:'ring',orb:'orb'},
  TAU:Math.PI*2,weapons:Array.from({length:10},()=>({color:[1,.6,.3]})),
  operatorPalette:()=>palette,operatorHeadPose:(_p,x,y,z)=>({x,y,z,tilt:0}),
  renderOperatorWeapon:()=>{},clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),
  draw:(...args)=>draws.push(args)};
 vm.createContext(view);vm.runInContext(body+'\n'+fallback,view);
 const p={x:12,z:17,feetY:0,yaw:0,pitch:0,weapon:0,bodyArmorType:-1,
  walk:0,shield:0,hitFlash:0};
 view.renderOperator({t:1},p);const idle=draws.length;draws.length=0;
 p.hitFlash=.25;p.hitBlocked=false;
 view.renderOperator({t:1},p);
 check(draws.length===idle+4,'mobile WebGL adds a bounded omnidirectional pulse for chest hit');
 p.hitHead=true;draws.length=0;view.renderOperator({t:1},p);
 check(draws.length===idle+4,'mobile WebGL helmet hit also adds bounded omnidirectional pulse');
 view.drawFallbackOperator(canvas,{...p,hitHead:false},200);
 check(ellipses===1,'Canvas/Android fallback shows chest flash');
 view.drawFallbackOperator(canvas,{...p,hitHead:true,hitBlocked:true},200);
 check(ellipses===2,'Canvas/Android fallback shows absorbed helmet flash');
 p.hitFlash=0;draws.length=0;view.renderOperator({t:1},p);
 check(draws.length===idle,'no additional WebGL rendering overhead when not hit');
 const idleEvent=host.run('mp10Encode({v:MP_VERSION,kind:"mp3-effect",token:mpMatch.token,'+
  'type:"shot",gun:0,id:0,a:[12,1,12],b:[12,1,17]},mpRoom.players[1].peerId)');
 check(idleEvent.h===undefined,'missed shots never carry extra bytes');
 await host.run('mpLeave()');await guest.run('mpLeave()');
 check(host.saves===0&&guest.saves===0,'PvP FX never writes solo save');
 console.log('STAGE47 PvP HIT FX: '+checks+' assertions passed');
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
