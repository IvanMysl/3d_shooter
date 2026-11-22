'use strict';
// Regression: Stage101 used a .22m/1.68m upper flow for every chassis and
// skipped the physical footprint at the beginning of a cached deck edge.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.STAGE_SOURCE_ROOT||path.resolve(__dirname,'..');
const src=n=>fs.readFileSync(path.join(root,'src',n),'utf8');
const N=15;
let checks=0,draws=[];
const check=(v,m)=>{assert.ok(v,m);checks++;};
const c={Math,Number,console,Float32Array,Int8Array,Int16Array,Int32Array,Uint8Array,Map,Set,
 mapSize:N,mapCells:Array.from({length:N},()=>Array(N).fill(0)),glReady:true,
 touchOnly:false,worldSolidGrid:[],worldSolidCount:0,game:null,mpMatch:null,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
 save:{settings:{audio:false}},sound:()=>{},burst:()=>{},toast:()=>{},
 input:{},arsenalOpened:false,box:(...a)=>draws.push(a)};
vm.createContext(c);
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js',
 '13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js','14-combat-raycast.js'])
 vm.runInContext(src(n),c,{filename:n});
const ev=s=>vm.runInContext(s,c);
function reset(){
 c.mapCells=Array.from({length:N},()=>Array(N).fill(0));
 ev(`heightCells=new Float32Array(${N*N});deckCells=new Float32Array(${N*N});
  for(let z=2;z<=12;z++)for(let x=2;x<=12;x++)deckCells[z*mapSize+x]=2.2;
  resetWorldSolids();upperDeckNavCache.clear();upperDeckEdgeCache.clear();
  upperDeckNavMap=null;upperDeckNavDecks=null;`);
 c.game={nodes:[],devices:[],mission:{type:'purge'},nodesDestroyed:0,
  enemies:[],p:{x:10.5,z:6.5,feetY:2.2},t:0};draws=[];
}
const scout=(x,z)=>({id:12,x,z,feetY:2.2,type:'scout',radius:.48,maxhp:100});
const heavy=(x,z)=>({id:13,x,z,feetY:2.2,type:'brute',radius:1.10,maxhp:300});
const boss=(x,z)=>({...heavy(x,z),boss:true,radius:1.2});
reset();
// A real solid strip, visibly drawn AND registered as the exact collision AABB,
// is offset 0.38m from the centre of a direct upper-deck corridor. A scout's
// .22m chassis passes, but a large NPC must route around it.
c.worldSolidBox([],6.38,2.2,5.87,6.62,4.5,6.1,[1,1,1]);
check(draws.length===1&&ev("worldSolidCount")===1,'steel strip must render and have a real collider');
const s=scout(4.5,5.5),b=heavy(4.5,5.5);
const profile=e=>c.upperDeckProfile?c.upperDeckProfile(e):
 {radius:c.enemyBodyRadius(e),height:c.enemyBodyHeight(e),key:'legacy'};
const ps=profile(s),pb=profile(b);
check(ps.radius<.25&&pb.radius>.45,'profiles must reflect actual dimensions');
check(c.worldSolidBodyCollision(6.5,5.5,pb.radius,2.2,pb.height),'heavy chassis collides with visible metal');
check(!c.worldSolidBodyCollision(6.5,5.5,ps.radius,2.2,ps.height),'scout chassis fits the corridor');
let small=c.upperDeckField(9.5,5.5,2.2,ps),large=c.upperDeckField(9.5,5.5,2.2,pb);
check(small[5*N+4]===5,'scout should take the physical direct corridor');
check(large[5*N+4]>small[5*N+4]&&large[5*N+4]<32767,
 'heavy robot must have a physically safe detour distinct from the scout');
check(c.upperDeckEdgeClear(5,5,6,5,2.2,ps),'small chassis traverses the metal-sided edge');
check(!c.upperDeckEdgeClear(5,5,6,5,2.2,pb),'large chassis cannot traverse the same edge');
const h=c.upperDeckHeading(b,9.5,5.5,2.2);
check(h&&Math.abs(h.dz)>.40,'large NPC should steer to the real open bypass');
check(c.upperDeckHeading(s,9.5,5.5,2.2)?.dx>.9,'scout should continue straight');
// A small upright right at the SOURCE centre previously went undetected at
// t=.25..1, and that incorrect result was cached for the reverse direction.
reset();
c.worldSolidBox([],4.49,2.2,5.49,4.51,4.5,5.51,[1,1,1]);
check(c.worldSolidBodyCollision(4.5,5.5,.22,2.2,1.68),'tiny post is a physical obstacle');
check(!c.upperDeckEdgeClear(4,5,5,5,2.2),'origin centre collision must block forward edge');
check(!c.upperDeckEdgeClear(5,5,4,5,2.2),'reverse cache must not reopen the blocked edge');
// A steel overhead crossbeam can admit 1.68m scouts but block taller brutes
// even where their XZ radii are otherwise clear.
reset();
c.worldSolidBox([],6.16,3.95,5.15,6.84,4.17,5.85,[1,1,1]);
small=c.upperDeckField(9.5,5.5,2.2,ps);
large=c.upperDeckField(9.5,5.5,2.2,pb);
check(small[5*N+4]===5,'short scout should fit below overhead steel');
check(large[5*N+4]>5,'taller heavy robot must detour below the beam');
check(!c.upperDeckEdgeClear(5,5,6,5,2.2,pb),'tall chassis blocked by real 3D head clearance');
check(c.upperDeckEdgeClear(5,5,6,5,2.2,ps),'short chassis passes under the beam');
// A cached field must be re-evaluated if new world solids are registered
// without replacing the spatial bucket array (dynamic scene assembly).
reset();
small=c.upperDeckField(9.5,5.5,2.2,ps);
check(small[5*N+4]===5,'empty deck route direct');
c.worldSolidBox([],6.1,2.2,5.1,6.9,4.5,5.9,[1,1,1]);
small=c.upperDeckField(9.5,5.5,2.2,ps);
check(small[5*N+4]>5,'adding physical geometry must invalidate stale deck flow');
// Physical equipment stays solid while active and reopens on destruction.
reset();
ev('heightCells[5*mapSize+6]=2.2');
c.game.nodes=[{x:6.5,z:5.5,dead:false}];
const chief=boss(4.5,5.5),q=profile(chief);
check(q.radius>=chief.radius*.50, 'boss navigation must fit its ACTUAL movement radius');
large=c.upperDeckField(9.5,5.5,2.2,q);
check(large[5*N+4]>5,'boss correctly navigates around a live reactor');
c.game.nodes[0].dead=true;c.game.nodesDestroyed++;
large=c.upperDeckField(9.5,5.5,2.2,q);
check(large[5*N+4]===5,'destroyed reactor reopens correct boss-sized path');
console.log(`Stage102 chassis-specific upper-deck navigation: ${checks} checks PASS`);
