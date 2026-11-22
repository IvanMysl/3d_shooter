'use strict';
// Real map sample: player-profile cardinal edges and arbitrary air segments.
// Compare accepted sweeps to dense direct checks, and walk the accepted
// ground edges with the actual actor controller in both directions.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
const levels=process.env.LEVELS?process.env.LEVELS.split(',').map(Number):Array.from({length:100},(_,i)=>i+1);
let checks=0,worlds=0,meshes=0,admitted=0,blocked=0,motions=0,diagonals=0,diagonalBlocked=0,shortBlocked=0;
const check=(v,m)=>{assert.ok(v,m);checks++};
const c={Math,console,Number,Set,Map,Array,Float32Array,Int8Array,Int16Array,Int32Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
 rand:(a,b)=>a+Math.random()*(b-a),mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],
 legacyResumeSector:-1,legacyResumeDivisor:18,glReady:false,touchOnly:false,
 gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:v=>v,
 save:{settings:{quality:0,audio:false}},sound:()=>{},burst:()=>{},
 input:{jumpQueued:false},arsenalOpened:false,navField:null,navClock:0,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['boss'],robotPalette:()=>{},toast:()=>{},game:null};
vm.createContext(c);
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js','04-map-generation.js',
 '05-world-mesh.js','13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js',
 '14-combat-raycast.js'])vm.runInContext(src(n),c,{filename:n});
const ev=s=>vm.runInContext(s,c);
const webgl=new Set((process.env.WEBGL_LEVELS||'1,8,35,70,99,100').split(',').map(Number));
for(const level of levels){
 c.game=null;c.glReady=webgl.has(level);c.save.settings.quality=level%3;c.buildMap(level);
 if(c.glReady)meshes++;
 c.game={p:{x:c.spawnX,z:c.spawnZ,feetY:c.floorHeight(c.spawnX,c.spawnZ)},nodes:[],devices:[],nodesDestroyed:0,mission:{type:'purge'},enemies:[],t:0};
 const n=c.mapSize,all=[];
 for(let z=1;z<n-1;z++)for(let x=1;x<n-1;x++)if(!c.mapCells[z][x]){
  if(!c.mapCells[z]?.[x+1]&&x+1<n-1)all.push([x,z,x+1,z]);
  if(!c.mapCells[z+1]?.[x]&&z+1<n-1)all.push([x,z,x,z+1]);
 }
 const count=Math.min(20,all.length),profile={radius:.23,height:1.95};
 for(let i=0;i<count;i++){
  const [x,z,X,Z]=all[Math.floor((i+.5)*all.length/count)],label=`L${level} ${x},${z}->${X},${Z}`;
  const edge=c.playerNavEdge(x,z,X,Z);check(edge===c.playerNavEdge(X,Z,x,z),label+' reverse cache');
  if(edge){admitted++;for(const [ax,az,bx,bz] of [[x,z,X,Z],[X,Z,x,z]]){
   const a={x:ax+.5,z:az+.5,feetY:c.navStandingFeet(ax+.5,az+.5,profile),grounded:true,flying:false,vy:0};c.game.p=a;
   check(a.feetY!==null,label+' real support');
   for(let k=0;k<12;k++){c.tryMoveEntity(a,(bx-ax)/12,(bz-az)/12,.23);check(!c.worldSolidBodyCollision(a.x,a.z,.23,a.feetY,1.95),label+' physical player movement');}
   check(Math.hypot(a.x-bx-.5,a.z-bz-.5)<1e-6,label+' admitted path stalls');motions++;
  }}else blocked++;
  // A diagonal airborne body at fixed feet height must not sweep through
  // walls, high terrain, metal boxes or a suspended plate. Dense checking
  // is independent of the swept interval calculation; it cannot certify a
  // blocked interval *absent* from the samples, so use one-way implication.
  const ax=x+.5,az=z+.5,bx=x+.5+(i%2?1:-1),bz=z+.5+(i%3?1:-1),feet=c.floorHeight(ax,az)+.08;
  if(c.collide(ax,az,.23)||c.worldSolidBodyCollision(ax,az,.23,feet,1.95))continue;
  const pose=c.worldActorSweepPlan(ax,az,bx,bz,.23,feet,false,false,1.95);diagonals++;
  let denseBlocked=false;
  for(let k=1;k<=160;k++){
   const px=ax+(bx-ax)*k/160,pz=az+(bz-az)*k/160;
   if(c.collide(px,pz,.23)||c.worldSolidBodyCollision(px,pz,.23,feet,1.95)){denseBlocked=true;break;}
  }
  check(!denseBlocked||!pose,label+' accepted path crosses actual physical geometry');
  if(!pose){diagonalBlocked++;if(!denseBlocked)shortBlocked++;}
  else {check(pose.feet===feet&&!pose.grounded,label+' airborne feet fixed');}
 }
 worlds++;
}
console.log(JSON.stringify({stage:112,status:'PASS',checks,worlds,meshes,admitted,blocked,motions,diagonals,diagonalBlocked,shortBlocked}));
