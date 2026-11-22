'use strict';
// Ground movement must not route a wide/tall robot through solid steel which
// only a scout can pass. The regression fails on Stage102 production source.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.STAGE_SOURCE_ROOT||path.resolve(__dirname,'..');
const src=n=>fs.readFileSync(path.join(root,'src',n),'utf8');
const N=15;let checks=0,draw=[];
const check=(v,label)=>{assert.ok(v,label);checks++;};
const c={Math,Number,console,Set,Map,Float32Array,Int8Array,Int16Array,Int32Array,Uint8Array,
 touchOnly:false,mapSize:N,mapCells:Array.from({length:N},()=>Array(N).fill(0)),glReady:true,
 worldSolidGrid:[],worldSolidCount:0,game:null,mpMatch:null,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
 save:{settings:{audio:false}},sound:()=>{},toast:()=>{},burst:()=>{},box:(...a)=>draw.push(a),
 input:{},arsenalOpened:false,navField:null,navClock:0};
vm.createContext(c);
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js',
 '13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js','14-combat-raycast.js'])
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
reset();
// Offset steel strip leaves a scout-sized path along row5; heavy frames must
// go around the end. The same AABB was ACTUALLY drawn by the world mesh.
c.worldSolidBox([],6.38,.05,5.82,6.62,2.6,6.15,[1,1,1]);
check(draw.length===1&&ev('worldSolidCount')===1,'metal is both visible and physical');
const s=scout(),b=brute(),p=c.game.p;
const ps=c.upperDeckProfile(s),pb=c.upperDeckProfile(b);
check(ps.radius<.25&&pb.radius>.45,'genuine different moving footprints');
check(!c.worldSolidBodyCollision(6.5,5.5,ps.radius,0,ps.height),'scout fits');
check(c.worldSolidBodyCollision(6.5,5.5,pb.radius,0,pb.height),'brute hits visible metal');
// The user's actual enemy-heading path must avoid metal, not just an isolated
// helper. Stage102 fails HERE: its scout flow steers the brute straight east.
c.rebuildNavigation();
const primary=c.enemyHeading(b,p);
check(primary&&Math.abs(primary.dz)>.25,
 'real heavy enemy heading must turn away from a scout-only steel passage');
const sf=c.groundChassisField(s,p),bf=c.groundChassisField(b,p);
check(sf[index(4,5)]===6,'scout ground path is direct');
check(bf[index(4,5)]>6&&bf[index(4,5)]<32767,'brute must detour around the physical strip');
const eh=c.enemyHeading(b,p);
check(eh&&eh.dz!==0,'actual heavy heading must choose the safe detour');
check(c.groundChassisField(b,p)===bf,'same-world field cached for performance');
// A low steel lintel is above a scout but blocks a taller moving chassis.
reset();
c.worldSolidBox([],6.1,1.85,5.1,6.9,2.08,5.9,[1,1,1]);
const below=c.groundChassisField(s,c.game.p),tall=c.groundChassisField(b,c.game.p);
check(below[index(4,5)]===6,'short scout moves under a low real beam');
check(tall[index(4,5)]>6,'tall brute must avoid head contact');
// Source centre must be included; reverse edge cache must not admit a hit.
reset();
c.worldSolidBox([],4.49,.1,5.49,4.51,2.0,5.51,[1,1,1]);
const profile=c.upperDeckProfile(s),edges=new Int8Array(N*N*4);
check(!c.groundChassisEdge(4,5,5,5,profile,edges),'origin centre is physical');
check(!c.groundChassisEdge(5,5,4,5,profile,edges),'reverse edge same collision');
// A new obstacle registered in-place must invalidate a previously cached BFS.
reset();
let f=c.groundChassisField(b,c.game.p);
check(f[index(4,5)]===6,'empty heavy ground field is direct');
c.worldSolidBox([],6.05,.05,5.05,6.95,2.7,5.95,[1,1,1]);
f=c.groundChassisField(b,c.game.p);
check(f[index(4,5)]>6,'registered real metal invalidates old path');
// Dynamic living reactors are physical, dead ones truly disappear.
reset();
c.game.nodes=[{x:6.5,z:5.5,dead:false}];
f=c.groundChassisField(b,c.game.p);
check(f[index(4,5)]>6,'live reactor forces a detour');
c.game.nodes[0].dead=true;c.game.nodesDestroyed++;
f=c.groundChassisField(b,c.game.p);
check(f[index(4,5)]===6,'destroyed reactor immediately reopens navigation');
// The player's own tile can be too tight for a boss. Its BFS must stop at a
// physically permitted nearby attack position, rather than entering steel.
reset();
c.worldSolidBox([],10.20,.05,5.2,10.80,2.8,5.8,[1,1,1]);
const chief=boss(),bc=c.groundChassisField(chief,c.game.p);
check(bc[index(4,5)]<32767,'blocked player tile has reachable nearby approach');
check(bc[index(10,5)]===32767,'boss must never be told to occupy blocked goal');
check(c.enemyHeading(chief,c.game.p).dx!==0||c.enemyHeading(chief,c.game.p).dz!==0,
 'boss gets a physically safe heading');
// Physics tracks the true ±.245m tread limit; a drop is not a ground edge.
reset();
ev('heightCells[5*mapSize+6]=1.1');
const ew=new Int8Array(N*N*4);
check(!c.groundChassisEdge(5,5,6,5,pb,ew),'no route over high step');
// Airborne robots use their 3D movement and do not enter this ground grid.
check(c.groundChassisField({...s,airborne:true},c.game.p)===null,'fliers unaffected');
console.log(`Stage103 chassis-aware ground navigation: ${checks} checks PASS`);
