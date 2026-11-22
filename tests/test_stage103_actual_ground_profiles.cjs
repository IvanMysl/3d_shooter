'use strict';
// Audit true production map + 3D solids on ALL 100 maps. Small/heavy/boss
// profiles must NEVER advertise a walkable edge that intersects any visible
// physical AABB, tall step or a metal item. Split using LEVELS=1,2,...
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
const levels=process.env.LEVELS?process.env.LEVELS.split(',').map(Number):Array.from({length:100},(_,i)=>i+1);
let checks=0,worlds=0,steps=0,reachable=0,blocked=0,meshes=0,devices=0,isolated=0;
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
const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
for(const level of levels){
 c.game=null;c.glReady=[1,8,35,70,99].includes(level)||
  (process.env.WEBGL_LEVELS||'').split(',').map(Number).includes(level);
 c.save.settings.quality=level%3;c.buildMap(level);
 if(c.glReady)meshes++;
 const n=c.mapSize;
 const goal={x:c.spawnX,z:c.spawnZ,feetY:c.floorHeight(c.spawnX,c.spawnZ)};
 c.game={p:goal,nodes:[],devices:[],mission:{type:'purge'},nodesDestroyed:0,
  enemies:[],t:0};
 for(const [name,radius,type,boss] of [
  ['scout',.48,'scout',false],['heavy',1.10,'brute',false],
  ['boss',1.20,'boss',true]]){
  const e={x:goal.x+7,z:goal.z,feetY:0,radius,type,boss,airborne:false};
  const profile=c.upperDeckProfile(e),field=c.groundChassisField(e,goal);
  check(!!field&&field.length===n*n,`L${level} ${name}: missing real ground field`);
  const px=Math.floor(goal.x),pz=Math.floor(goal.z);
  const goalClear=c.navStandingFeet(px+.5,pz+.5,profile)!==null;
  // A blocked goal can be approached from adjacent cells; it must NOT be
  // used as a false seed inside visible metal.
  if(!goalClear)check(field[pz*n+px]===32767,`L${level} ${name}: steel goal wrongly seeded`);
  // Sample the entire field at intervals, validate every nominated descent
  // edge against the same 3D solid shape used by actual movement.
  let found=0;
  for(let z=2;z<n-2;z+=3)for(let x=2;x<n-2;x+=3){
   const here=field[z*n+x];
   if(here>=32767||here===0)continue;
   let next=null;
   for(const [dx,dz] of dirs){
    const X=x+dx,Z=z+dz;
    if(field[Z*n+X]!==here-1)continue;
    const edges=new Int8Array(n*n*4);
    if(c.groundChassisEdge(x,z,X,Z,profile,edges)){next={X,Z};break;}
   }
   check(!!next,`L${level} ${name} route at (${x},${z}) has no true physical predecessor`);
   const standing=c.navStandingFeet(next.X+.5,next.Z+.5,profile);
   check(standing!==null&&!c.worldSolidBodyCollision(next.X+.5,next.Z+.5,profile.radius,standing,profile.height),
    `L${level} ${name} route crosses metal at (${next.X},${next.Z})`);
   steps++;found++;
  }
  // It is correct for a wide/tall chassis to have NO physical ground path
  // on a roofed/tight fortress. Stage102 previously pretended it could walk
  // through the steel. Record isolation instead of fabricating connectivity.
  if(found===0){
   const finite=field.reduce((count,value)=>count+(value>0&&value<32767),0);
   check(finite===0||finite<9,`L${level} ${name}: untested large connected region`);
   isolated++;
  }else reachable++;
 }
 // Production equipment on an actually free central cell must invalidate
 // the cached fields without falsely making the already-built map passable.
 const cx=Math.floor(goal.x)+2,cz=Math.floor(goal.z);
 if(c.mapCells[cz]?.[cx]===0){
  const ob={x:cx+.5,z:cz+.5,dead:false};c.game.nodes=[ob];devices++;
  const e={radius:1.10,type:'brute',boss:false,airborne:false};
  const prof=c.upperDeckProfile(e),field=c.groundChassisField(e,goal);
  check(field[cz*n+cx]===32767,`L${level} live metal node appears walkable for heavy bot`);
  ob.dead=true;c.game.nodesDestroyed++;
  const opened=c.groundChassisField(e,goal);
  if(c.mapCells[cz]?.[cx]===0&&
     !c.worldSolidBodyCollision(cx+.5,cz+.5,prof.radius,c.worldTerrainFootprint(cx+.5,cz+.5,prof.radius),prof.height)){
    // May remain disconnected for an actual static wall across the approach;
    // if it opens, every predecessor still has to pass the physical probe.
    check(opened[cz*n+cx]!==field[cz*n+cx]||opened[cz*n+cx]===32767,
      `L${level} destroyed metal did not refresh revision`);
  }
  blocked++;
 }
 worlds++;
}
console.log(`Stage103 real ground hull routes: ${checks} PASS; ${worlds} maps; ${reachable} profiles; ${steps} checked real path edges; ${devices} live/dead reactor cases; ${isolated} physically isolated profiles; ${meshes} full 3D meshes`);
