'use strict';
// Real game code: muzzle positions, local/remote shot origins, cheap animated
// per-weapon flashes, and multiplayer event payloads. No network needed.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
const arsenal=src('12-arsenal-and-game.js');
const weapons=vm.runInNewContext(arsenal.slice(0,arsenal.indexOf('const enemies='))+'\nweapons');
const operator=src('09a-player-third-person.js');
const helpers=operator.slice(operator.indexOf('function operatorMuzzleLocal('),operator.indexOf('function renderOperator('));
const firstPerson=src('10-first-person-render.js');
const heldWeapon=firstPerson.slice(0,firstPerson.indexOf('function drawEnergyTail('));
const geometry={bevel:'bevel',rounded:'rounded',cylinder:'cylinder',spark:'spark',tracer:'tracer',octa:'octa',orb:'orb',ring:'ring'};
const save={settings:{quality:0,aim:0}};
const ctx={weapons,geom:geometry,save,touchOnly:false,Math,console,game:{t:0},
 clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),externalCameraEnabled:()=>true,
 glReady:true,gl:{DEPTH_BUFFER_BIT:0,clear(){},uniform1f(){}},
 u:{uMatOverride:'mat'},draw(){}};
vm.createContext(ctx);
vm.runInContext(helpers+'\n'+heldWeapon,ctx);
let checks=0;
function check(value,description){assert.ok(value,description);checks++;}
function approx(a,b,epsilon=.002){return Math.abs(a-b)<=epsilon;}
const base={x:8,z:9,feetY:0,yaw:0,pitch:0,weapon:0,shots:0,walk:0,recoil:0,shotGlow:.14};
const worldPoint=(p,x,y,z)=>({x:p.x+x*Math.cos(p.yaw)+z*Math.sin(p.yaw),
 y:p.feetY+y,z:p.z-x*Math.sin(p.yaw)+z*Math.cos(p.yaw)});

for(let gun=0;gun<weapons.length;gun++){
 const p={...base,weapon:gun};
 const point=ctx.operatorMuzzlePoint(p);
 check(point.x>p.x+.25&&point.y<p.feetY+1.3&&point.y>p.feetY+.92&&point.z>p.z+.80,
  `gun ${gun}: actual muzzle is right of torso, low and ahead of throat`);
 const draws=[];
 ctx.renderOperatorWeapon(ctx.game,p,(...args)=>draws.push(args),{joint:[0,0,0]});
 const flash=draws.filter(args=>args[7]>1.3);
 check(flash.length===1,`gun ${gun}: low detail draws exactly one world muzzle mesh`);
 const pos=worldPoint(p,flash[0][0],flash[0][1],flash[0][2]);
 check(Math.hypot(point.x-pos.x,point.y-pos.y,point.z-pos.z)<.06,
  `gun ${gun}: world shot origin coincides with rendered muzzle flash`);
 const view=[];
 ctx.draw=(...args)=>view.push(args);
 ctx.renderHeldWeapon(ctx.game,p,[p.x,1.47,p.z],[0,0,1]);
 check(view.filter(args=>args[9]>1.3).length===1,
  `gun ${gun}: FPS viewmodel also has one low-detail flash`);
}
check(weapons.length===10,'all ten weapon types checked');
for(const gun of [0,1,2,3,4,5,6,7,8,9]){
 const p={...base,weapon:gun};
 const signatures=[];
 ctx.drawGunMuzzleFlash(p,gun,ctx.operatorMuzzleLocal(p),(...args)=>signatures.push(args),0);
 check(signatures.length===1,`gun ${gun}: zero particle systems on low quality`);
}
save.settings.quality=2;
for(let gun=0;gun<10;gun++){
 const p={...base,weapon:gun};const effects=[];
 ctx.drawGunMuzzleFlash(p,gun,ctx.operatorMuzzleLocal(p),(...args)=>effects.push(args),0);
 check(effects.length<=3,`gun ${gun}: at most three cheap flash meshes on high quality`);
}
save.settings.quality=0;
for(const gun of [1,8]){
 const p={...base,weapon:gun};const a=ctx.operatorMuzzlePoint(p);
 p.shots=1;const b=ctx.operatorMuzzlePoint(p);
 check(Math.abs(b.x-a.x)>.17&&approx(a.y,b.y),`gun ${gun}: alternate real twin barrels`);
}
{const p={...base,weapon:6};const mouths=[0,1,2].map(n=>ctx.operatorMuzzlePoint({...p,shots:n}));
 check(mouths[0].x<mouths[1].x&&mouths[1].x<mouths[2].x,'triad rotates three real tubes');}
{const p={...base,yaw:Math.PI/2,pitch:.30,recoil:.33,walk:0};
 const muzzle=ctx.operatorMuzzlePoint(p);
 check(muzzle.x>p.x+.8&&muzzle.z<p.z-.25&&muzzle.y>1.20,
  'world muzzle follows yaw, upward pitch and recoil instead of staying at camera');}

// Execute the actual solo fire function with deterministic raycast stubs.
const pellet=src('17-weapon-combat.js').split('function shootPellet(w,burstIndex=0){')[1]
 .split('function fireBurstShot(w){')[0];
const originalGame=ctx.game;
const traces=[],rockets=[];
Object.assign(ctx,{v3:(x,y,z)=>({x,y,z}),rand:()=>0,
 aimFromOperator:()=>({x:0,y:0,z:1}),rayWall:()=>null,rayNode:()=>null,rayEnemy:()=>null,
 makeTracer:(a,b,w)=>traces.push({a,b,w}),shotProjectile:(w,o,d)=>rockets.push({o,d,w})});
vm.runInContext('function shootPellet(w,burstIndex=0){'+pellet,ctx);
ctx.game={...originalGame,state:'playing',p:{...base}};
ctx.shootPellet(weapons[0]);
check(traces.length===1,'solo hitscan actually generates a tracer');
const soloPoint=ctx.operatorMuzzlePoint(ctx.game.p);
check(approx(traces[0].a.x,soloPoint.x)&&approx(traces[0].a.y,soloPoint.y),
 'solo hitscan tracer starts at weapon barrel, not throat');
ctx.game.p.weapon=4;
ctx.shootPellet(weapons[4]);
check(rockets.length===1,'solo rocket actually spawns');
check(approx(rockets[0].o.x,ctx.operatorMuzzlePoint(ctx.game.p).x)&&
 approx(rockets[0].o.y,ctx.operatorMuzzlePoint(ctx.game.p).y),
 'solo rocket starts at the weapon muzzle');
check(rockets[0].d.x<0&&rockets[0].d.y>0,
 'rocket converges towards sight ray without bending hitscan aiming');

// Execute the real authoritative MP fire and effect handlers with no sockets.
const mpEvents=[];
ctx.mpMatch={active:true,host:true,token:'stage45',tick:100,
 actors:new Map(),projectiles:[]};
ctx.MP_VERSION=3;
ctx.mpRtcFastSend=(peer,e)=>mpEvents.push(e);
ctx.mpCombatHit=()=>{};
ctx.rayEllipsoid=()=>null;
ctx.game.tracers=[];ctx.game.impactFx=[];
vm.runInContext(src('21e-multiplayer-combat.js'),ctx);
const shooter={id:0,host:true,p:{...base,shots:1},peerId:'local'};
const remote={id:1,host:false,p:{...base,x:24},peerId:'remote'};
ctx.mpMatch.actors.set(0,shooter);ctx.mpMatch.actors.set(1,remote);
ctx.mpCombatShot(shooter,weapons[0]);
check(mpEvents.length===1&&mpEvents[0].id===0,'MP effect reuses existing shooter id field');
const mpPoint=ctx.operatorMuzzlePoint(shooter.p);
check(approx(mpEvents[0].a[0],mpPoint.x,.01)&&approx(mpEvents[0].a[1],mpPoint.y,.01),
 'network hitscan effect begins at barrel position');
check(shooter.p.shotGlow>.1,'host muzzle flash activates from the existing MP event');
shooter.p.weapon=7;ctx.mpCombatShot(shooter,weapons[7]);
check(ctx.mpMatch.projectiles.length===1,'host spawns authoritative ion projectile');
const ion=ctx.mpMatch.projectiles[0];
check(approx(ion.pos.x,ctx.operatorMuzzlePoint(shooter.p).x)&&
 approx(ion.pos.y,ctx.operatorMuzzlePoint(shooter.p).y),
 'MP projectile begins at barrel, not eye or throat');
check(Object.keys(mpEvents[1]).sort().join(',')==='a,b,gun,id,kind,token,type,v',
 'unchanged event schema: no extra multiplayer traffic fields');

console.log(`STAGE45 MUZZLE & FLASH: ${checks} assertions passed`);
