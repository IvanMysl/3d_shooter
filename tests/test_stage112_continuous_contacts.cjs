'use strict';
// Stage112: continuous circle contacts, real human clearance, exact direct paths.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.STAGE_SOURCE_ROOT||path.resolve(__dirname,'..');
const src=n=>fs.readFileSync(path.join(root,'src',n),'utf8');
const N=15;let checks=0,draw=[];
const check=(v,label)=>{assert.ok(v,label);checks++;};
const c={Math,Number,console,Set,Map,Float32Array,Int8Array,Int16Array,Int32Array,Uint8Array,
 touchOnly:false,mapSize:N,mapCells:Array.from({length:N},()=>Array(N).fill(0)),glReady:true,
 worldSolidGrid:[],worldSolidCount:0,game:null,mpMatch:null,sectorStyle:14,worldMapBoss:false,SPRINT_ENERGY_DRAIN:1.8,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
 save:{settings:{audio:false}},sound:()=>{},toast:()=>{},burst:()=>{},box:(...a)=>draw.push(a),
 input:{},addEventListener:()=>{},useAbility:()=>{},toggleArsenal:()=>{},switchWeapon:()=>{},arsenalOpened:false,navField:null,navClock:0};
vm.createContext(c);
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js',
 '13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js','14-combat-raycast.js','15-mission-system.js','21d-multiplayer-movement.js','21g-multiplayer-flight-abilities.js'])
 vm.runInContext(src(n),c,{filename:n});
const ev=s=>vm.runInContext(s,c);
function reset(){
 c.mapCells=Array.from({length:N},()=>Array(N).fill(0));
 ev(`heightCells=new Float32Array(${N*N});deckCells=new Float32Array(${N*N});
   resetWorldSolids();enemyNavMask=null;navField=null;
   if(typeof groundChassisRevision!=='undefined'){
     groundChassisRevision=null;groundChassisCache.clear();
   }`);
 c.game={nodes:[],devices:[],nodesDestroyed:0,mission:{type:'purge'},enemies:[],
  p:{x:10.5,z:5.5,feetY:0},t:0};draw=[];
}
const scout=(x=4.5,z=5.5)=>({id:1,x,z,feetY:0,type:'scout',radius:.48,airborne:false});
const brute=(x=4.5,z=5.5)=>({id:2,x,z,feetY:0,type:'brute',radius:1.1,airborne:false});
const boss=(x=4.5,z=5.5)=>({id:3,x,z,feetY:0,type:'boss',radius:1.2,boss:true,airborne:false});
const index=(x,z)=>z*N+x;
// Genuine two-millimetre steel at a near-tangent trajectory. Endpoints
// are clear, but its short overlap interval must not be skipped.
const steel=(...b)=>c.worldSolidBox([], ...b,[1,1,1]);
reset();steel(5.55,0,5.7299,5.552,2.2,5.76);
let p={x:5.5,z:5.5,feetY:0,grounded:true,flying:false,vy:0,energy:100};c.game.p=p;
check(c.worldSolidBodyCollision(5.551,5.5,.23,0,1.95),'midpoint overlaps real steel');
check(!c.worldSolidBodyCollision(5.5,5.5,.23,0,1.95)&&!c.worldSolidBodyCollision(5.6,5.5,.23,0,1.95),'both endpoints clear');
c.tryMoveEntity(p,.1,0,.23);check(p.x<5.55,'continuous solo move stops before steel');
// Exactly tangent, or just outside the circle: no invented wall.
reset();steel(5.55,0,5.73,5.552,2.2,5.76);p={...p,x:5.5,z:5.5};c.game.p=p;
c.tryMoveEntity(p,.1,0,.23);check(Math.abs(p.x-5.6)<1e-9,'tangent remains passable');
// The identical issue for an airborne actor and a low-but-solid threshold.
reset();steel(5.55,0,5.7299,5.552,.12,5.76);p={...p,x:5.5,z:5.5,feetY:.02,grounded:false,flying:true};c.game.p=p;
c.tryMoveEntity(p,.1,0,.23);check(p.x<5.55,'airborne cannot auto-step through low steel');
p={...p,x:5.5,z:5.5,feetY:0,grounded:true,flying:false};c.game.p=p;c.tryMoveEntity(p,.1,0,.23);
check(Math.abs(p.x-5.6)<1e-9&&Math.abs(p.feetY)<1e-9,'grounded can step onto and off genuine low steel');
// Diagonal grazing corner between the old evenly spaced probes.
reset();const r=c.enemyBodyRadius(scout()),d=(r-.0001)/Math.SQRT2,cx=5.555-d,cz=5.555+d;
steel(cx-.002,0,cz,cx,2.2,cz+.002);
const bot=scout(5.5,5.5),goal={x:6.5,z:6.5,feetY:0};
check(c.worldSolidBodyCollision(5.555,5.555,r,0,c.enemyBodyHeight(bot)),'diagonal short corner actually intersects');
check(!c.enemyPathClear(bot,goal.x,goal.z),'diagonal shortcut detects tiny interval');
check(!c.enemyDirectRoute(bot,goal),'direct route blocks');
check(c.enemyDirectRoute(bot,{x:6.5,z:6.45,feetY:0}),'shifted endpoint avoids narrow obstacle even in same old memo window');
check(!c.enemyDirectRoute(bot,goal),'cache may not reuse shifted endpoint');
check(!c.enemyPathClear({...bot,x:goal.x,z:goal.z},bot.x,bot.z),'reverse diagonal blocks');
// PvP walking is a real independent movement call; not a mocked collision.
reset();steel(5.55,0,5.7499,5.552,2.2,5.78);p={x:5.5,z:5.5,feetY:0,grounded:true,flying:false,vy:0,energy:100};c.game=null;
c.mpMatchMove(p,{mx:0,mz:1,yaw:Math.PI/2,pitch:0,s:false,j:false},1/30);
check(p.x<5.55,'PvP swept movement stops at short corner');
// Dash moves diagonally using the same segment guard.
reset();const R=.25,dd=(R-.0001)/Math.SQRT2,xx=5.55-dd,zz=5.55+dd;
steel(xx-.002,0,zz,xx,2.2,zz+.002);
p={x:5.5,z:5.5,feetY:0,grounded:true,flying:false,vy:0,energy:100,yaw:Math.PI/4,weapon:0};
const actor={id:1,p};c.game=null;c.testActor=actor;ev('mpMatch={actors:new Map([[1,testActor]])}');c.mpCombatEmit=()=>{};
c.mp6Dash(actor,{mx:0,mz:1});check(Math.hypot(p.x-5.5,p.z-5.5)<.077&& !c.worldSolidBodyCollision(p.x,p.z,.25,p.feetY,1.95),'PvP diagonal dash stops before actual grazing corner');ev('mpMatch=null');
// Distinct human vs robot geometry. The scout fits below a 1.8m beam,
// the player must take an alternative route through open space.
reset();steel(5.9,1.8,5,6.1,2.2,6);
check(c.enemyNavEdge(5,5,6,5),'scout headroom actually sufficient');
check(!c.playerNavEdge(5,5,6,5),'player headroom insufficient');
check(c.missionGroundField(5.5,5.5)[index(6,5)]>1,'human mission BFS avoids low beam');
const route=c.missionRouteTo({x:5.5,z:5.5},{x:6.5,z:5.5});
check(route.length>2,'guide detours');
for(let i=1;i<route.length;i++)check(c.playerNavEdge(Math.floor(route[i-1].x),Math.floor(route[i-1].z),Math.floor(route[i].x),Math.floor(route[i].z)),'route edge uses real human geometry');
reset();steel(5.9,0,5.745,6.1,2.2,6);
check(!c.enemyNavEdge(5,5,6,5)&&c.playerNavEdge(5,5,6,5),'narrower human footprint not artificially blocked by scout radius');
reset();let mf=c.missionGroundField(5.5,5.5);check(mf[index(6,5)]===1,'open mission edge');
steel(5.9,1.8,5,6.1,2.2,6);check(c.missionGroundField(5.5,5.5)[index(6,5)]>1,'new metal invalidates player graph');
// Independent convex distance minimization (not rounded rectangle union).
let seed=0x12345678;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
for(let k=0;k<5000;k++){
 const x=random()*8-4,z=random()*8-4,X=random()*8-4,Z=random()*8-4,r=.05+random()*.7;
 const lx=random()*4-2,lz=random()*4-2,hx=lx+.001+random()*2,hz=lz+.001+random()*2,b=[lx,0,lz,hx,2,hz];
 const dist=t=>{const px=x+(X-x)*t,pz=z+(Z-z)*t;return Math.max(lx-px,0,px-hx)**2+Math.max(lz-pz,0,pz-hz)**2;};
 let lo=0,hi=1;for(let j=0;j<64;j++){const a=(2*lo+hi)/3,d=(lo+2*hi)/3;if(dist(a)<dist(d))hi=d;else lo=a;}
 const minimum=Math.min(dist(0),dist(1),dist((lo+hi)/2)),rr=r*r-1e-7;
 if(Math.abs(minimum-rr)<1e-10)continue;
 const result=c.worldCircleRectInterval(x,z,X,Z,r,b);
 check(!!result===(minimum<rr),'independent convex overlap test '+k);
 if(result){const [a,b]=result;check(a>=0&&b<=1&&a<b,'ordered clipped interval');check(dist((a+b)/2)<rr+1e-10,'midpoint inside');
  if(a>1e-8)check(Math.abs(dist(a)-rr)<1e-8,'entry boundary');if(b<1-1e-8)check(Math.abs(dist(b)-rr)<1e-8,'exit boundary');}
}
console.log(`Stage112 continuous movement and player routes: ${checks} PASS`);
