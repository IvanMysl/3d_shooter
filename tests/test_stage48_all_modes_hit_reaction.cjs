'use strict';
// Real solo damage + shared player model. Tests front/back and mobile variants;
// Stage47 network regression separately tests both PvP directions.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0;
function check(ok,msg){assert.ok(ok,msg);checks++;}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const palette={primary:[.3,.4,.5],shadow:[.1,.2,.3],fabric:[.17,.2,.25],
 light:[.6,.7,.8],black:[.1,.1,.1],joint:[.22,.3,.4],visor:[.2,.8,1],
 accent:[.5,.9,1],grade:0};
const draws=[],bars=new Set(),flash={style:{opacity:'0'}};
let deaths=0;
const state={Math,console,TAU:Math.PI*2,clamp,touchOnly:false,
 glReady:true,geom:{bevel:'bevel',rounded:'rounded',ring:'ring',orb:'orb',cylinder:'cylinder'},
 weapons:Array.from({length:10},()=>({color:[1,.8,.4]})),
 BODY_ARMOR_CATALOG:[],save:{bodyArmor:{owned:{}},settings:{cameraMode:'second',quality:2}},
 draw:(...args)=>draws.push(args),game:null,mpMatch:null,
 document:{body:{classList:{toggle(){}}}},
 sweepWorldSphere:()=>null,rayWall:()=>null,rayNode:()=>null,rayEnemy:()=>null,
 $:id=>id==='viewTouch'?null:id==='bars'?{classList:{add:s=>bars.add(s),remove:s=>bars.delete(s)}}:flash,
 setTimeout:()=>0,sound:()=>{},gameOver:()=>{deaths++;},
 operatorPalette:()=>palette};
 vm.createContext(state);
 vm.runInContext(source('09a-player-third-person.js'),state);
 const damage=source('13-enemy-navigation-spawn.js');
 vm.runInContext(damage.slice(damage.indexOf('function damagePlayer('),damage.indexOf('function burst(')),state);
const p={x:14,z:15,feetY:0,yaw:0,pitch:0,weapon:0,bodyArmorType:-1,
 bodyArmorMax:0,bodyArmor:0,armor:30,armorTier:0,hp:100,maxhp:100,
 maxArmor:30,shield:0,iframes:0,walk:0,hitFlash:0};
const g={p,t:2.0,state:'playing',impactFx:[],particles:[],tracers:[],enemies:[]};
state.game=g;

// From the second-person front camera the own model MUST render.
const front=state.secondPersonCameraPose(p);
check(front.drawActor&&front.distance>2.5,'second-person mode exposes own actor');
check(front.dir[2]<-.5,'front camera looks back at player, not down rifle sights');
check(state.externalCameraEnabled(),'second-person camera enables actor rendering');
const hp=p.hp;
state.damagePlayer(30,{x:p.x,z:p.z+3});
check(p.hp<hp&&p.armor<30,'solo real damage occurs with armor mitigation');
check(p.hitFlash>=.44,'solo damage activates visible player pulse');
check(p.hitBlocked===false,'solo armor hit is a damaging, not shielded, impact');
check(g.impactFx.length===1,'solo damage places world-space impact');
check(g.impactFx[0].z>p.z+.4,'impact faces attacker on correct side');
check(g.particles.length===5,'high-quality desktop solo produces five sparks');
const hitColor=g.impactFx[0].col;
check(hitColor[0]===1&&hitColor[1]<.5,'normal player hit uses reddish tint');
const actorDraws=()=>{draws.length=0;state.renderOperator(g,p);return draws.slice();};
p.hitFlash=0;const idle=actorDraws();
p.hitFlash=.44;const impact=actorDraws();
check(impact.length===idle.length+6,'desktop model adds six inexpensive impact meshes');
check(impact.some(d=>d[0]==='ring'&&d[2]>1&&d[4]>1),
 'WebGL operator has large surrounding damage halo');
// The back plate and front plate must straddle the avatar, for all headings.
for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
 p.yaw=yaw;const d=actorDraws();
 const frontPlate=d.find(s=>s[0]==='bevel'&&s[4]===.48&&s[5]===.40);
 check(!!frontPlate,`WebGL impact armor overlay present at yaw ${yaw}`);
 check(d.some(s=>s[0]==='ring'&&Math.abs(s[1]-p.x)<.001&&
  Math.abs(s[3]-p.z)<.001),`surrounding halo follows player at yaw ${yaw}`);
}
// A second hit should refresh the pulse without unbounded particle allocations.
g.t+=.01;const oldSparks=g.particles.length;
state.operatorHitReaction(p,{x:p.x+3,z:p.z});
check(g.particles.length===oldSparks,'rapid repeat refreshes visual pulse but not spark count');
check(g.impactFx.length===2,'distinct rapid impacts still have visible contact glow');

// In god/energy shield mode, a hit shows cyan but does not deal real damage.
p.shield=2;p.iframes=0;g.t+=1;
const shieldHp=p.hp,shieldArmor=p.armor;
state.damagePlayer(65,{x:p.x-3,z:p.z});
check(p.hp===shieldHp&&p.armor===shieldArmor,'shield stops solo HP/armor damage');
check(p.hitBlocked===true,'shield hit remains visible on actor');
check(g.impactFx.at(-1).col[2]===1,'shield hit has cyan impact');
const count=g.impactFx.length;
state.damagePlayer(65,{x:p.x-3,z:p.z});
check(g.impactFx.length===count,'shield pulse throttles repeated contacts');

// Mobile + low quality: no five-spark fountain; still visible from all sides.
state.save.settings.quality=0;state.touchOnly=true;
p.shield=0;p.iframes=0;g.t+=1;g.particles=[];p.hitFlash=0;
state.damagePlayer(15,{x:p.x+3,z:p.z});
check(g.particles.length===3,'mobile solo hit limits to three sparks');
p.hitFlash=0;const mobileIdle=actorDraws();p.hitFlash=.44;
check(actorDraws().length===mobileIdle.length+4,'mobile 3D uses four simple extras');
state.save.settings.cameraMode='third';
const third=state.thirdPersonCameraPose(p);
check(third.drawActor,'third person also exposes own damaged character');

// Canvas fallback keeps the visible silhouette pulse without WebGL.
const canvas={};let ellipse=0;
for(const k of ['beginPath','moveTo','lineTo','quadraticCurveTo','closePath',
 'fill','stroke','save','restore','scale','translate','rotate'])canvas[k]=()=>{};
canvas.ellipse=()=>{ellipse++;};
state.drawFallbackOperator(canvas,p,180);
check(ellipse===1,'mobile Canvas fallback draws visible hit overlay');
p.hitFlash=0;state.drawFallbackOperator(canvas,p,180);
check(ellipse===1,'Canvas idle avatar adds no hit drawing');

// No player flash on immune hits, during game menus, or after expiry.
g.state='paused';p.iframes=0;const frozen=g.impactFx.length;
state.damagePlayer(20,{x:p.x+3,z:p.z});
check(g.impactFx.length===frozen,'paused solo game never generates hits');
g.state='playing';p.iframes=.2;
state.damagePlayer(20,{x:p.x+3,z:p.z});
check(g.impactFx.length===frozen,'iframes suppress repeated solo damage effects');
check(deaths===0,'visual effects do not trigger game over');
const update=source('19-gameplay-update.js');
check(update.includes('p.hitFlash=Math.max(0,(p.hitFlash||0)-dt)'),
 'real solo frame update decays the visible player pulse');
const mp=source('21d-multiplayer-movement.js');
check(mp.includes('a.p.hitFlash=Math.max(0,(a.p.hitFlash||0)-dt)'),
 'real PvP update also decays the same shared pulse');
console.log(`STAGE48 SOLO + PC + SECOND-PERSON HIT FX: ${checks} assertions passed`);
