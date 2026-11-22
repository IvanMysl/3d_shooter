'use strict';
// Stage87: the collectible archive is a hologram, but its new STEEL plinth is
// visible AND collidable in WebGL/Canvas, for bodies and continuous projectiles.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0;function check(v,msg){assert.ok(v,msg);checks++;}
const c={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),distance:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),
 mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],legacyResumeSector:-1,legacyResumeDivisor:18,
 glReady:false,touchOnly:false,gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:v=>v,
 save:{settings:{quality:0,audio:false},credits:0},sound:()=>{},burst:()=>{},saveRun:()=>{},
 input:{jumpQueued:false},arsenalOpened:false,navField:null,navClock:0,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['БОСС'],robotPalette:()=>{},toast:()=>{},game:null};
vm.createContext(c);
for(const name of ['03-height-and-collision.js','04a-static-world-solids.js','04-map-generation.js',
 '05-world-mesh.js','13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js',
 '14-combat-raycast.js','15-mission-system.js','16-mission-devices.js'])
 vm.runInContext(src(name),c,{filename:name});
const ev=expr=>vm.runInContext(expr,c);
check(/GAME_BUILD='(?:87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(src('00-core-save.js')),'V87 build stamp');
check(/MP_VERSION=(?:40|41|42)\b/.test(src('21b-multiplayer-lobby.js')),'V87 network stamp');
check(src('10-first-person-render.js').includes('draw(geom.cube,c.x,ground+.17,c.z,.62,.30,.62'),
 'WebGL must draw the exact collidable steel base');
check(src('11-fallback-render.js').includes('if(!ob.got){C.globalAlpha='),
 'Canvas must preserve steel base even after collection');
check(src('20-minimap-and-checkpoint.js').includes('archivePlinthVersion:1'),
 'New checkpoint must carry archive collision-version marker');
let archiveCount=0,worlds=0,webglScenes=0,ballistic=0,nonRecovery=0,routeModes=0;
const first=Math.max(1,Number(process.env.FIRST||1)),last=Math.min(100,Number(process.env.LAST||100));
for(let level=first;level<=last;level++){
 if(process.env.ONLY_RECOVERY==='1' && c.missionType(level)!=='recovery')continue;
 c.game=null;c.glReady=process.env.WITH_MESH==='1'&&[8,28,48,68,88].includes(level);
 c.save.settings.quality=level%2?0:2;
 c.buildMap(level);if(c.glReady)webglScenes++;
 const g={state:'playing',sector:level,p:{x:c.spawnX,z:c.spawnZ,feetY:0,
  maxhp:100,hp:100,armor:100,maxArmor:100,maxEnergy:100,energy:100,grounded:true,shield:0},
  t:0,sectorTime:0,spawned:0,target:10,enemies:[],particles:[],score:0,kills:0,nodes:[],devices:[],portalReady:false};
 c.game=g;c.spawnPowerNodes(level);c.startMission(g);c.initDevices(g);
 const archives=g.mission.caches,active=c.worldEquipmentStats();
 if(g.mission.type!=='recovery'){
  nonRecovery++;check(archives.length===0&&active.archives===0,`L${level}: ghost archive pedestal`);
 }else{
  routeModes++;check(archives.length===3,`L${level}: missing archives`);
  check(active.archives===3,`L${level}: missing archive physics`);
 }
 check(active.bodies===g.nodes.length+g.devices.length+archives.length,
  `L${level}: equipment index missed a body`);
 const field=c.missionGroundField(c.spawnX,c.spawnZ);
 const pk=Math.floor(c.portal.z)*c.mapSize+Math.floor(c.portal.x);
 check(field[pk]>=0,`L${level}: portal cut off by a pedestal`);
 const preCount=active.archives;
 for(const a of archives){
  archiveCount++;
  const ix=Math.floor(a.x),iz=Math.floor(a.z),ground=c.floorHeight(a.x,a.z),cell=iz*c.mapSize+ix;
  const contents=c.worldEquipmentCell(ix,iz).filter(s=>s.kind==='archive'&&s.entity===a);
  check(contents.length===1,`L${level}: archive AABB absent/duplicated`);
  const b=contents[0].box;
  check(Math.abs(b[0]-(a.x-.31))<1e-8&&Math.abs(b[3]-(a.x+.31))<1e-8&&
   Math.abs(b[2]-(a.z-.31))<1e-8&&Math.abs(b[5]-(a.z+.31))<1e-8&&
   Math.abs(b[1]-(ground+.02))<1e-8&&Math.abs(b[4]-(ground+.32))<1e-8,
   `L${level}: visible cube and physical AABB do not coincide`);
  check(c.worldSolidBodyCollision(a.x,a.z,.24,ground,1.68),`L${level}: operator passes through steel`);
  check(!c.enemyNavTile(ix,iz),`L${level}: ground robot passes through steel`);
  check(c.missionApproachDistance(field,a)>=0,`L${level}: archive cannot be approached`);
  check(c.mapCells[iz][ix]===0&& !c.collide(a.x,a.z,.70),`L${level}: pedestal overlaps masonry`);
  let rayHits=0,rocketHits=0,clearAbove=0;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const o={x:a.x+dx*.46,y:ground+.18,z:a.z+dz*.46};
   const d={x:-dx,y:0,z:-dz};
   const ray=c.rayWall(o,d,.30),rocket=c.sweepWorldSphere(o,d,.30,.13);
   if(ray?.kind==='archive'&&ray.t<.19)rayHits++;
   if(rocket?.kind==='archive'&&rocket.t<.19)rocketHits++;
   const above=c.sweepWorldSphere({x:o.x,y:ground+.55,z:o.z},d,.30,.13);
   if(!above||above.kind!=='archive')clearAbove++;
  }
  check(rayHits>=1&&rocketHits>=1,`L${level}: real steel lets bullets or rockets through`);
  check(clearAbove>=1,`L${level}: phantom wall above small pedestal`);
  ballistic+=3;
  // Finishing a mission removes only the data core, not its metal foundation.
  a.got=true;
  check(c.worldEquipmentStats().archives===preCount&&
   c.worldSolidBodyCollision(a.x,a.z,.24,ground,1.68),
   `L${level}: used pedestal becomes an invisible/absent object`);
  a.got=false;
  check(field[cell]<0,`L${level}: path-planner routes through pedestal`);
  // Cardinal neighbour standing places must remain both navigable and close
  // enough for the old 1.04m interaction radius.
  let reachable=false;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=ix+dx,Z=iz+dz;if(X<1||Z<1||X>=c.mapSize-1||Z>=c.mapSize-1)continue;
   if(field[Z*c.mapSize+X]>=0 && !c.worldSolidBodyCollision(X+.5,Z+.5,.23,ground,1.68) &&
      Math.hypot(X+.5-a.x,Z+.5-a.z)<1.04)reachable=true;
  }
  check(reachable,`L${level}: archive has no reachable interaction space`);
 }
 worlds++;
}
console.log(`Stage87: ${checks} assertions / ${worlds} worlds / ${routeModes} recon worlds / ${archiveCount} steel archive plinths / ${ballistic} ballistic sets / ${webglScenes} actual mesh builds / ${nonRecovery} no-archive levels: PASS`);
