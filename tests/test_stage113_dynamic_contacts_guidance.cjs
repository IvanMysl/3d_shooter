'use strict';
// Stage113: continuous actor pairs, exact stopping and real route joins.
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

const steel=(...b)=>c.worldSolidBox([], ...b,[1,1,1]);
// Robot crowd: endpoints clear, but the grazing middle of a 0.1m move isn't.
reset();const a={...scout(5.5,5.5),maxhp:100},b={...scout(5.55,5.5+c.enemyCrowdRadius(a)*2-.006-.0001),id:2,maxhp:100};
c.game.enemies=[a,b];const sum=c.enemyCrowdRadius(a)*2-.006;
check(Math.hypot(a.x-b.x,a.z-b.z)>sum&&Math.hypot(5.6-b.x,5.5-b.z)>sum,'both crowd endpoint poses free');
c.tryMoveEntity(a,.1,0,.23);check(a.x<5.55&&Math.hypot(a.x-b.x,a.z-b.z)>=sum-1e-8,'robot does not cross a short dynamic contact');
// Exact prefix, independently calculated face of a 2cm rail.
reset();steel(6,0,5,6.02,2.2,6);let p={x:5.5,z:5.5,feetY:0,grounded:true,flying:false,vy:0,energy:100};c.game.p=p;
c.tryMoveEntity(p,1,0,.23);check(p.x>5.7698&&p.x<5.77001,'precise stop at physical wall');
check(!c.worldSolidBodyCollision(p.x,p.z,.23,p.feetY,1.95),'no penetration at stop');
c.tryMoveEntity(p,0,.3,.23);check(Math.abs(p.z-5.8)<1e-8,'tangential sliding remains');
// Player cannot move through a live robot, and can pass a dead one.
reset();p={...p,x:5.5,z:5.5};c.game.p=p;b.x=6.5;b.z=5.5;c.game.enemies=[b];
c.tryMoveEntity(p,2,0,.23);check(Math.abs(p.x-(b.x-.23-c.enemyCrowdRadius(b)))<.0002,'player stops at live robot');
b.dead=true;c.tryMoveEntity(p,2,0,.23);check(p.x>7,'dead robot no longer blocks');b.dead=false;
// Both PvP paths use the same exclusion distance and swept overlap.
reset();p={...p,x:5.5,z:5.5,feetY:0,grounded:true,energy:100};const other={x:5.55,z:6.1699,feetY:0,hp:100};
c.mpMatchMove(p,{mx:0,mz:1,yaw:Math.PI/2,pitch:0,s:false,j:false},1/30,[other]);
check(p.x<5.55&&Math.hypot(p.x-other.x,p.z-other.z)>=.67-1e-8,'PvP grazing contact not skipped');
// Exact tangent and vertical clearance; overlap recovery rejects deeper movement.
const o={x:0,z:0,feet:0,height:1.95};
check(c.worldActorPairClear(-1,.5,1,.5,0,0,1.95,o,.5),'true tangent free');
check(!c.worldActorPairClear(-1,.4999,1,.4999,0,0,1.95,o,.5),'grazing cylinder blocked');
check(c.worldActorPairClear(-1,0,1,0,2.2,2.2,1.95,o,.5),'separate body heights free');
check(!c.worldActorPairClear(-1,0,1,0,1.94,1.94,1.95,o,.5),'slightly overlapping vertical bodies block');
check(!c.worldActorPairClear(.2,0,.1,0,0,0,1.95,o,.5),'no deeper initial overlap');
check(c.worldActorPairClear(.2,0,.7,0,0,0,1.95,o,.5),'initial overlap may separate');
// Independent analytic horizontal minimum, 5000 random segments.
let seed=123456;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
for(let i=0;i<5000;i++){
 const x=rand()*4-2,z=rand()*4-2,X=rand()*4-2,Z=rand()*4-2,r=.05+rand()*.8;
 if(Math.hypot(x,z)<r)continue;
 const dist=t=>(x+t*(X-x))**2+(z+t*(Z-z))**2;
 let lo=0,hi=1;for(let j=0;j<60;j++){let u=(2*lo+hi)/3,v=(lo+2*hi)/3;if(dist(u)<dist(v))hi=v;else lo=u;}
 const min=Math.min(dist(0),dist(1),dist((lo+hi)/2));
 check(c.worldActorPairClear(x,z,X,Z,0,0,1.95,o,r)===(min>=r*r-1e-9),'independent convex circle minimum '+i);
}
// A valid centre edge does NOT imply that an off-centre actor can take it.
reset();steel(5.84,0,5.88,5.86,2.2,5.94);
p={x:5.5,z:5.8,feetY:0,grounded:true};const target={x:8.5,z:5.5};
check(c.playerNavEdge(5,5,6,5),'canonical centre route clear');
check(!c.worldActorSweepPlan(p.x,p.z,6.5,5.5,.23,0,true,true,1.95),'actual first shortcut blocked');
let route=c.missionRouteTo(p,target,30);check(route.length>2,'physically valid alternative');
for(let i=1;i<route.length;i++)check(c.missionRouteLink(route[i-1],route[i]),'actual route segment clear');
// Two genuine stories: three upper deck cells and a 22cm stair descent.
reset();ev('for(let x=5;x<=7;x++)deckCells[5*mapSize+x]=2.2;for(let x=8;x<=14;x++)heightCells[5*mapSize+x]=Math.max(0,1.98-(x-8)*.22);');
p={x:5.5,z:5.5,feetY:2.2,grounded:true};route=c.missionRouteTo(p,{x:13.5,z:5.5},40);
check(route.length>4&&route.some(q=>q.feetY<2.1),'true upper-to-ground route found');
for(let i=1;i<route.length;i++)check(c.missionRouteLink(route[i-1],route[i]),'every upper/stair segment physically possible');
// Cut the only staircase; a ground path beneath the deck is NOT an upper exit.
reset();ev('for(let x=5;x<=7;x++)deckCells[5*mapSize+x]=2.2;');
route=c.missionRouteTo(p,{x:13.5,z:5.5},40);check(route.length===1,'isolated deck not given fictitious downstairs path');
check(c.missionRouteTo({...p,grounded:false},{x:13.5,z:5.5},40).length===1,'airborne route not misrepresented as walk');
console.log(`Stage113 dynamic contacts, precise stop and deck guidance: ${checks} PASS`);
