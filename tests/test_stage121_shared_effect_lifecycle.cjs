'use strict';
// The same emitters and frame updates are executed with real swept world
// collision, tagged legacy PvP hit sparks, and both wire representations.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
const arsenal=src('12-arsenal-and-game.js'),weapons=vm.runInNewContext(arsenal.slice(0,arsenal.indexOf('const enemies='))+'\nweapons');
const p={x:10,z:20,feetY:0,weapon:0,hp:100,armor:30,recoil:0,shotGlow:0};
const actors=new Map([[0,{id:0,p,host:true,invulnUntil:999,respawnAt:0}],[1,{id:1,p:{...p,x:15},host:false,peerId:'guest',respawnAt:0,invulnUntil:999}]]);
const sent=[],sounds=[],N=24,mapCells=Array.from({length:N},(_,z)=>Array.from({length:N},(_,x)=>+(x===0||z===0||x===N-1||z===N-1)));
const c={weapons,$:()=>({style:{setProperty(){}}}),setTimeout:()=>0,clearTimeout:()=>{},Math,Number,Date,Map,Set,TAU:Math.PI*2,Float32Array,mapCells,mapSize:N,MP_CAP:8,MP_VERSION:42,MAX_WALL_MARKS:230,decalDirty:false,glReady:false,touchOnly:false,
 rand:(a,b)=>(a+b)/2,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),hypot:Math.hypot,v3:(x,y,z)=>({x,y,z}),save:{settings:{quality:0}},
 ceilingHeight:()=>5,floorHeightAtCell:()=>0,deckAtCell:()=>0,box(){},externalCameraEnabled:()=>true,sound:(...a)=>sounds.push(a),mpRtcFastSend:(peer,e)=>sent.push(e),
 game:{p,t:1,enemies:[],nodes:[],devices:[],particles:[],impactFx:[],decals:[],tracers:[],projectiles:[],scorch:[],burstQueue:[]},
 mpMatch:{active:true,host:true,preview:false,token:'fx121',tick:70,self:0,actors,projectiles:[]},console};
vm.createContext(c);
const part=src('13-enemy-navigation-spawn.js');vm.runInContext(part.slice(part.indexOf('function burst(')),c);
vm.runInContext(src('04a-static-world-solids.js'),c);
const ray=src('14-combat-raycast.js');vm.runInContext(ray.slice(ray.indexOf('function rayAABB('),ray.indexOf('function rayEnemy(')),c);
c.rayEnemy=()=>null;c.rayNode=()=>null;
vm.runInContext(src('17-weapon-combat.js'),c);
const op=src('09a-player-third-person.js');vm.runInContext(op.slice(op.indexOf('function operatorHitReaction('),op.indexOf('// A third-person weapon uses')),c);
vm.runInContext(src('21e-multiplayer-combat.js'),c);vm.runInContext(src('21j-multiplayer-traffic.js'),c);
let checks=0;const check=(b,msg)=>{assert.ok(b,msg);checks++};
const P=(x,y,z)=>({x,y,z});
const clear=()=>{for(const f of ['particles','impactFx','decals','tracers','projectiles','scorch','burstQueue'])c.game[f]=[];sounds.length=sent.length=0;c.mpMatch.projectiles=[];};
const near=(a,b,e=.0002)=>Math.abs(a-b)<=e;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const readFx=()=>JSON.parse(JSON.stringify({particles:c.game.particles,decals:c.game.decals,impact:c.game.impactFx,tracers:c.game.tracers}));
function compare(a,b,label){
 for(const k of Object.keys(a)){
  check(a[k].length===b[k].length,label+' '+k+' count');
  for(let i=0;i<a[k].length;i++)for(const prop of ['x','y','z','vx','vy','vz','life','maxLife','r','nx','ny','nz'])if(typeof a[k][i][prop]==='number')check(near(a[k][i][prop],b[k][i][prop]),label+' '+k+' '+prop);
 }
}
const event=(type,extra={})=>({v:42,kind:'mp3-effect',token:'fx121',type,gun:0,id:0,a:[10,1,20],b:[10,1,20],...extra});
// Identical muzzle pose on all ten weapons, including different recoil values.
for(const w of weapons){
 const a={shotGlow:0,recoil:0};c.applyWeaponShotPose(a,w);
 p.shotGlow=p.recoil=0;c.mpMatch.tick+=4;clear();
 c.mpCombatReceiveEffect(event('shot',{gun:weapons.indexOf(w)}));
 check(a.shotGlow===p.shotGlow&&a.recoil===p.recoil,'same glow and recoil');
 check(c.game.tracers.length===(w.mode==='projectile'?0:1),'projectiles do not create fake rays');
}
// Real impacts: flat wall, floor, raised slab, low metal and grazing corner.
for(const quality of [0,2])for(const preview of [true,false])for(const gun of [4,7,8]){
 c.save.settings.quality=quality;c.mpMatch.preview=preview;
 for(const scene of [
  {o:P(10,1.5,2),d:P(0,0,-1),gl:false},
  {o:P(10,.8,10),d:P(0,-1,0),gl:false},
  {o:P(10,4.6,10),d:P(0,1,0),gl:false},
  {o:P(10.5,1.4,10.5),d:P(0,1,0),gl:false,deck:true},
  {o:P(10.5,3.2,10.5),d:P(0,-1,0),gl:false,deck:true},
  {o:P(8.28,1.4,4.5),d:P(0,0,1),gl:true,metal:true},
  {o:P(8.1,1.4,4.5),d:P(0,0,1),gl:true,metal:true}
 ]){
  const w=weapons[gun],r=c.mpProjectileRadius(w),dt=.1;
  c.glReady=scene.gl;c.deckAtCell=(x,z)=>scene.deck&&x===10&&z===10?2.2:0;c.resetWorldSolids();if(scene.metal)c.worldSolidBox([],8,1,5,8.2,2,5.2,[.5,.6,.7]);
  const {o,d}=scene,v=P(d.x*17,d.y*17,d.z*17),hit=c.sweepWorldSphere(o,d,1.7,r);
  check(hit&&hit.box&&hit.box.length===6,'real surface and actual bounds');
  clear();c.game.projectiles=[{...o,vx:v.x,vy:v.y,vz:v.z,w,rad:r,life:3}];
  c.updatePlayerOrdnance(dt);const solo=readFx();
  check(solo.decals.length===1&&solo.impact.length===2,'solo impact and explosion');
  // Remove frame aging from comparison by applying same impact update after receiving event.
  clear();c.mpMatch.host=true;c.mpMatch.self=0;c.game.p=p;
  c.mpMatch.projectiles=[{shooter:0,w,pos:o,v,rad:r,life:3}];
  c.mpCombatProjectileStep(dt);const pkt=sent.at(-1);
  check(pkt?.type==='blast'&&pkt.surface?.length===12,'host sends true physical surface');
  const expectedCenter=P(o.x+d.x*hit.t,o.y+d.y*hit.t,o.z+d.z*hit.t);
  check(pkt.b.every((v,i)=>near(v,[expectedCenter.x,expectedCenter.y,expectedCenter.z][i],.0051)),'old authoritative damage center preserved');
  c.advanceSharedImpactFx(c.game,dt);compare(solo,readFx(),'local surface parity');
  const packed=c.mp10Encode(pkt,'guest'),decoded=c.mp10Decode(packed);
  check(same(decoded.surface,pkt.surface),'packed surface preserved');
  clear();c.mpMatch.host=false;c.mpMatch.self=1;c.game.p=actors.get(1).p;
  c.mpCombatReceiveEffect(decoded);c.advanceSharedImpactFx(c.game,dt);
  compare(solo,readFx(),'guest surface parity');
  for(const bad of [[],pkt.surface.map((n,i)=>i===0?NaN:n),pkt.surface.map((n,i)=>i===3?2:n)]){
   check(c.mp10Decode({...packed,surface:bad})===null,'bad metadata rejected');
   clear();c.mpCombatReceiveEffect({...decoded,surface:bad});check(c.game.impactFx.length===0,'reject invalid direct effect');
  }
  clear();const legacy={...packed};delete legacy.surface;const old=c.mp10Decode(legacy);
  c.mpCombatReceiveEffect(old);check(c.game.impactFx.length===1&&c.game.decals.length===0,'legacy blast works without fake surface');
  c.mpMatch.host=true;c.mpMatch.self=0;c.game.p=p;
 }
}
// Lifetime parity through 60 frames, not merely birth of particles.
for(const quality of [0,2])for(const touch of [false,true])for(const type of ['pulse','shield','heal','blast','dash']){
 c.save.settings.quality=quality;c.touchOnly=touch;
 const emit=()=>{if(type==='pulse')c.emitPulseFx(10,1,20);if(type==='dash')c.emitDashFx(10,1-.7,20);if(type==='shield')c.emitShieldFx(10,1,20);if(type==='heal')c.emitRepairFx(10,.9,20);if(type==='blast')c.emitExplosionFx(10,1,20,weapons[4]);};
 clear();emit();const frames=[];
 for(let i=0;i<60;i++){c.advanceSharedImpactFx(c.game,1/60);c.advanceSharedWorldFx(c.game,1/60);frames.push(readFx());}
 for(const preview of [false,true]){
  clear();c.mpMatch.preview=preview;c.mpCombatReceiveEffect(event(type,type==='blast'?{gun:4}:{}));
  for(let i=0;i<60;i++){c.advanceSharedImpactFx(c.game,1/60);c.advanceSharedWorldFx(c.game,1/60);const actual=readFx();if(type==='dash')actual.tracers=[];check(same(frames[i],actual),'complete frame-by-frame lifetime parity (network dash line intentionally excluded)');}
 }
}
// The explicitly excluded hit effect keeps its previous .8 gravity, color,
// count and HUD handler; ordinary particles use campaign gravity 2.
clear();c.mpMatch.active=true;p.lastHitSparkAt=-100;c.operatorHitReaction(p,P(11,1,20),{head:false,blocked:false});
check(c.game.particles.length===3||c.game.particles.length===5,'legacy player hit spark count');
const spark=c.game.particles[0],before=spark.vy;check(spark.fxGravity===.8,'old PvP player-hit gravity retained');
c.advanceSharedWorldFx(c.game,.1);check(near(spark.vy,before-.08),'old hit gravity numerically unchanged');
clear();for(let i=0;i<6;i++)c.emitPulseFx(10,1,20);c.advanceSharedWorldFx(c.game,.01);check(c.game.particles.length===140,'common particle pool limit');
for(const touch of [false,true]){clear();c.touchOnly=touch;for(let i=0;i<100;i++)c.emitShotTracer(P(1,1,1),P(2,1,1),weapons[0]);check(c.game.tracers.length===(touch?35:65),'shared tracer budget');}
// Identical overheating warning, only to the local player, never repeated
// by every snapshot while the same lock is active.
clear();const own=actors.get(0),other=actors.get(1);own.overheatFxActive=false;c.mpMatch.self=0;
c.emitOverheatFx();const warning=JSON.stringify(sounds);clear();
c.mpCombatThermalFeedback(own,.9);check(JSON.stringify(sounds)===warning,'owner warning equals campaign');
c.mpCombatThermalFeedback(own,.8);check(sounds.length===1,'duplicate lock warning suppressed');
c.mpCombatThermalFeedback(other,.9);check(sounds.length===1,'other player lock is silent');
c.mpCombatThermalFeedback(own,0);c.mpCombatThermalFeedback(own,.9);check(sounds.length===2,'next genuine overheating sounds again');
console.log(`Stage121 shared effect lifecycle: ${checks} assertions PASS`);
