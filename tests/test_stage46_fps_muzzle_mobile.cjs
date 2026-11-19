'use strict';
// Regression for the screenshot-reported issue: world-avatar muzzle ≠ the
// screen-space first-person viewmodel. Test real render transforms and fire
// functions in desktop, portrait Android and landscape Android viewports.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
const arsenal=src('12-arsenal-and-game.js');
const weapons=vm.runInNewContext(arsenal.slice(0,arsenal.indexOf('const enemies='))+'\nweapons');
const oper=src('09a-player-third-person.js');
const view=src('10-first-person-render.js');
const helpers=oper.slice(oper.indexOf('function operatorMuzzleLocal('),oper.indexOf('function renderOperator('))+
 view.slice(0,view.indexOf('function drawEnergyTail('));
const geom={bevel:'bevel',rounded:'rounded',cylinder:'cylinder',spark:'spark',tracer:'tracer',octa:'octa',orb:'orb',ring:'ring'};
const save={settings:{quality:0,aim:0}};
const ctx={Math,console,weapons,geom,save,touchOnly:false,glReady:true,
 gl:{DEPTH_BUFFER_BIT:0,clear(){},uniform1f(){}},u:{uMatOverride:'mat'},draw(){},
 clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
 externalCameraEnabled:()=>false,game:null};
vm.createContext(ctx);vm.runInContext(helpers,ctx);
let checks=0;
function ok(value,label){assert.ok(value,label);checks++;}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);}
const gun=(weapon,extra={})=>({weapon,x:14,z:16,feetY:0,yaw:.36,pitch:-.12,
 shots:7,walk:1,recoil:.52,equipAnim:.1,shotGlow:.14,...extra});
function camera(g,p){
 const si=Math.sin(p.pitch),co=Math.cos(p.pitch),sy=Math.sin(p.yaw),cy=Math.cos(p.yaw);
 return {eye:[p.x,1.47+p.feetY+Math.sin(g.t*10)*(p.walk?.028:0)+p.recoil*-.045,p.z],
  forward:[sy*co,si,cy*co],right:[-cy,0,sy],up:[-sy*si,co,-cy*si]};
}
function project(point,cam,W,H,mobile){
 const v=[point.x-cam.eye[0],point.y-cam.eye[1],point.z-cam.eye[2]];
 const dot=a=>v[0]*a[0]+v[1]*a[1]+v[2]*a[2];
 const d=dot(cam.forward),vScale=1/(d*Math.tan((mobile&&H>W?79:73)*Math.PI/360));
 return {x:W*(.5+dot(cam.right)*vScale*H/W*.5),
  y:H*(.5-dot(cam.up)*vScale*.5),depth:d};
}
const viewports=[[1316,841,false],[1920,1080,false],[390,844,true],[844,390,true]];
for(const [W,H,mobile] of viewports){
 ctx.touchOnly=mobile;
 for(let i=0;i<10;i++){
  const p=gun(i),g={t:2.34,p};ctx.game=g;
  const cam=camera(g,p),draws=[];
  ctx.draw=(...args)=>draws.push(args);
  ctx.renderHeldWeapon(g,p,cam.eye,cam.forward);
  const flash=draws.filter(args=>args[9]>1.3);
  ok(flash.length===1,`weapon ${i} ${W}x${H}: single first-person muzzle flash`);
  const flashPoint={x:flash[0][1],y:flash[0][2],z:flash[0][3]};
  const muzzle=ctx.heldWeaponMuzzleWorld(g,p);
  ok(dist(muzzle,flashPoint)<.045,`weapon ${i} ${W}x${H}: shot starts at visible flash`);
  const a=project(muzzle,cam,W,H,mobile),b=project(flashPoint,cam,W,H,mobile);
  ok(a.x>0&&a.x<W&&a.y>0&&a.y<H&&a.depth>.2,
   `weapon ${i} ${W}x${H}: muzzle remains onscreen`);
  ok(Math.hypot(a.x-b.x,a.y-b.y)<12,
   `weapon ${i} ${W}x${H}: beam and flash project to same pixels`);
 }
}
const base=gun(0,{walk:0,recoil:0,equipAnim:0,pitch:0,yaw:0});
ctx.game={t:0,state:'playing',p:base};
const fp=ctx.heldWeaponMuzzleWorld(ctx.game,base),world=ctx.operatorMuzzlePoint(base);
ok(dist(fp,world)>.6,'original bug reproduced: FPS and world avatar muzzles differ significantly');

// Actual solo fire in both camera modes, all ten weapons, with deterministic
// aim ray and no geometry. Damage continues to use the old sight origin.
const source17=src('17-weapon-combat.js');
const shootSource='function shootPellet(w,burstIndex=0){'+source17.split('function shootPellet(w,burstIndex=0){')[1].split('function fireBurstShot(w){')[0];
const traces=[],projectiles=[];
Object.assign(ctx,{v3:(x,y,z)=>({x,y,z}),rand:()=>0,
 aimFromOperator:()=>({x:0,y:0,z:1}),rayWall:()=>null,rayNode:()=>null,rayEnemy:()=>null,
 makeTracer:(a,b,w,width,localView)=>traces.push({a,b,w,localView}),
 shotProjectile:(w,o,d,localView)=>projectiles.push({w,o,d,localView})});
vm.runInContext(shootSource,ctx);
for(let gunId=0;gunId<10;gunId++){
 const p=gun(gunId,{yaw:0,pitch:0,walk:0,recoil:0,equipAnim:0});
 ctx.game={t:1.1,state:'playing',p};
 // Force one visible representative pellet for shotgun; spread/sight and
 // muzzle transforms remain from the actual selected weapon.
 const w={...weapons[gunId],shots:1};
 traces.length=0;projectiles.length=0;
 ctx.externalCameraEnabled=()=>false;
 ctx.shootPellet(w);
 const result=weapons[gunId].mode==='projectile'?projectiles.at(-1)?.o:traces.at(-1)?.a;
 ok(!!result,`gun ${gunId}: shot created in first-person mode`);
 ok(dist(result,ctx.heldWeaponMuzzleWorld(ctx.game,p))<.001,
  `gun ${gunId}: shot starts at held weapon, never neck/world gun`);
 if(weapons[gunId].mode==='projectile')ok(projectiles.at(-1).localView,
  `gun ${gunId}: projectile tagged for Canvas mobile fallback`);
 if(weapons[gunId].mode!=='projectile')ok(traces.at(-1).localView,
  `gun ${gunId}: trace tagged for Canvas mobile fallback`);
 ctx.externalCameraEnabled=()=>true;
 traces.length=0;projectiles.length=0;
 ctx.shootPellet(w);
 const third=weapons[gunId].mode==='projectile'?projectiles.at(-1)?.o:traces.at(-1)?.a;
 ok(!!third&&dist(third,ctx.operatorMuzzlePoint(p))<.001,
  `gun ${gunId}: third-person mode still uses real avatar barrel`);
}

// The actual MP host emits the same authoritative world coordinates, while
// the current user's *rendered* local beam uses the first-person muzzle.
ctx.externalCameraEnabled=()=>false;
ctx.game={t:.5,p:gun(3,{yaw:0,pitch:0,walk:0,recoil:0,equipAnim:0}),
 tracers:[],impactFx:[]};
ctx.mpMatch={active:true,host:true,self:0,token:'stage46',tick:100,
 actors:new Map(),projectiles:[]};
ctx.MP_VERSION=3;const packets=[];
ctx.mpRtcFastSend=(peer,event)=>packets.push(event);
ctx.rayEllipsoid=()=>null;
vm.runInContext(src('21e-multiplayer-combat.js'),ctx);
const shooter={id:0,host:true,p:ctx.game.p,peerId:'host'};
const peer={id:1,host:false,p:gun(5,{x:25,z:25}),peerId:'guest'};
ctx.mpMatch.actors.set(0,shooter);ctx.mpMatch.actors.set(1,peer);
ctx.mpCombatShot(shooter,weapons[3]);
const pkt=packets.at(-1),ownTrace=ctx.game.tracers.at(-1);
ok(pkt.id===0&&pkt.type==='shot','MP shot identity carried by unchanged event id');
ok(dist({x:pkt.a[0],y:pkt.a[1],z:pkt.a[2]},ctx.operatorMuzzlePoint(shooter.p))<.01,
 'host emits the real physical multiplayer muzzle');
ok(dist(ownTrace.a,ctx.heldWeaponMuzzleWorld(ctx.game,ctx.game.p))<.001,
 'local MP first-person tracer starts at viewmodel, not host avatar');
ok(ownTrace.localView,'own MP shot flagged for the mobile Canvas renderer');
ctx.mpMatch.self=1;ctx.game.tracers.length=0;
ctx.mpCombatReceiveEffect(pkt);
const otherTrace=ctx.game.tracers.at(-1);
ok(!otherTrace.localView&&dist(otherTrace.a,{x:pkt.a[0],y:pkt.a[1],z:pkt.a[2]})<.001,
 'remote shooter retains avatar muzzle for all other players');
ctx.mpMatch.self=0;ctx.externalCameraEnabled=()=>true;ctx.game.tracers.length=0;
ctx.mpCombatReceiveEffect(pkt);
ok(!ctx.game.tracers.at(-1).localView,'first-person correction never shifts third-person shots');
ok(Object.keys(pkt).sort().join(',')==='a,b,gun,id,kind,token,type,v',
 'no extra network fields or paid relay messages');
ctx.externalCameraEnabled=()=>false;ctx.mpMatch.self=0;
shooter.p.weapon=4;ctx.game.p.weapon=4;
ctx.mpCombatShot(shooter,weapons[4]);
const physicalRocket=ctx.mpMatch.projectiles.at(-1);
const rocketEvent=packets.at(-1),rocketTrace=ctx.game.tracers.at(-1);
ok(rocketEvent.gun===4&&rocketTrace.localView,'own MP rocket receives a local launch marker');
const rocketList=[{x:physicalRocket.pos.x,y:physicalRocket.pos.y,z:physicalRocket.pos.z,
 vx:physicalRocket.v.x,vy:physicalRocket.v.y,vz:physicalRocket.v.z,gun:4}];
ctx.mpCombatApplyOrdnance(rocketList);
const displayRocket=ctx.game.projectiles[0];
ok(!!displayRocket.visualPoint&&
 dist(displayRocket.visualPoint,ctx.heldWeaponMuzzleWorld(ctx.game,ctx.game.p))<.03,
 'own MP rocket first appears at the visible held barrel');
ok(dist(physicalRocket.pos,ctx.operatorMuzzlePoint(shooter.p))<.001,
 'MP rocket authoritative physics remains at the world barrel');
const netDir={x:rocketEvent.b[0]-rocketEvent.a[0],
 y:rocketEvent.b[1]-rocketEvent.a[1],z:rocketEvent.b[2]-rocketEvent.a[2]};
const localDir={x:rocketTrace.b.x-rocketTrace.a.x,
 y:rocketTrace.b.y-rocketTrace.a.y,z:rocketTrace.b.z-rocketTrace.a.z};
ok(dist(netDir,localDir)<.03,'visual rocket tracer follows the same velocity direction');
ctx.mpMatch.localLaunches[0].at=Date.now()-300;
ctx.mpCombatApplyOrdnance(rocketList);
ok(!ctx.game.projectiles[0].visualPoint,
 'short cosmetic offset fades and is completely removed without touching physics');

// Exercise the real Canvas fallback beam-drawing loop in isolation. The gun
// is DOM/CSS geometry at the bottom of the screen and scales with Android
// viewport width, height and devicePixelRatio.
const fallback=src('11-fallback-render.js');
const canvasLoop=fallback.slice(fallback.indexOf('let canvasGunMuzzle;'),
 fallback.indexOf('for(const b of (g.projectiles||[])){'));
const projectileLoop=fallback.slice(fallback.indexOf('for(const b of (g.projectiles||[])){'),
 fallback.indexOf('for(const f of (g.impactFx||[])){'));
for(const [W,H,mobile] of viewports){
 const ratio=mobile?2:1,innerWidth=W,innerHeight=H;
 const capture=[],rect={left:W*.47,top:H*.70,width:W*.18,height:H*.16};
 const C={save(){},restore(){},beginPath(){},moveTo(x,y){capture.push({x,y});},
  lineTo(){},stroke(){}};
 const context={g:{tracers:[{a:{x:0,y:0,z:0},b:{x:1,y:1,z:1},localView:true,
   life:.14,maxLife:.14,r:.017,col:[1,.7,.2]}]},
  pose:null,C,w:W*ratio,h:H*ratio,innerWidth,innerHeight,TAU:Math.PI*2,
  $:()=>({getBoundingClientRect:()=>rect}),
  proj:()=>({x:15,y:25}),clamp:(v,a,b)=>Math.max(a,Math.min(b,v))};
 vm.runInNewContext('{'+canvasLoop+'}',context);
 const expectedX=(rect.left+rect.width*.5)*ratio;
 const expectedY=(rect.top+Math.min(6,rect.height*.035))*ratio;
 ok(capture.length===2&&Math.abs(capture[0].x-expectedX)<.01&&
  Math.abs(capture[0].y-expectedY)<.01,
  `Canvas ${W}x${H} dpr${ratio}: beam begins at real DOM gun muzzle`);
 context.pose={drawActor:true};capture.length=0;
 vm.runInNewContext('{'+canvasLoop+'}',context);
 ok(capture.length===2&&capture[0].x===15&&capture[0].y===25,
  `Canvas ${W}x${H}: external-camera beam stays in world projection`);
 const orbs=[];
 context.pose=null;context.C.arc=(x,y)=>orbs.push({x,y});
 context.C.fill=()=>{};context.focal=150;
 context.zbuffer=Array(W*ratio).fill(100);
 context.proj=()=>({x:15,y:25,d:5});
 context.g.projectiles=[{x:1,y:1,z:1,rad:.13,w:weapons[4],localView:true,launchAge:0}];
 vm.runInNewContext('{'+canvasLoop+projectileLoop+'}',context);
 ok(orbs.length===1&&Math.abs(orbs[0].x-expectedX)<.01&&
  Math.abs(orbs[0].y-expectedY)<.01,
  `Canvas ${W}x${H}: rocket starts at CSS barrel, not in front of avatar`);
 context.g.projectiles[0].launchAge=.3;orbs.length=0;
 vm.runInNewContext('{'+canvasLoop+projectileLoop+'}',context);
 ok(orbs.length===1&&orbs[0].x===15&&orbs[0].y===25,
  `Canvas ${W}x${H}: rocket returns to real projectile position after 220ms`);
}
console.log(`STAGE46 FIRST-PERSON/MOBILE MUZZLE: ${checks} assertions passed`);
