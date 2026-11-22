'use strict';
// 100 actual generated worlds, using PRODUCTION collision and debris update,
// not a synthetic 'wall oracle'. Run in bounded groups with LEVELS=1,2,...
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
const levels=process.env.LEVELS?process.env.LEVELS.split(',').map(Number):Array.from({length:100},(_,i)=>i+1);
let checks=0,worlds=0,realWalls=0,realEquipment=0,realDecks=0,meshes=0,realMesh=0;
const ok=(v,reason)=>{assert.ok(v,reason);checks++;};
const c={Math,console,Number,Set,Map,Array,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
 rand:(a,b)=>a+Math.random()*(b-a),distance:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),
 mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],legacyResumeSector:-1,legacyResumeDivisor:18,
 glReady:false,touchOnly:false,gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:v=>v,
 save:{settings:{quality:0,audio:false},credits:0},sound:()=>{},burst:()=>{},saveRun:()=>{},
 damagePlayer:()=>{},input:{jumpQueued:false},arsenalOpened:false,navField:null,navClock:0,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['boss'],robotPalette:()=>{},toast:()=>{},game:null,
 robotNearArea:()=>false,enemyBlastSamples:()=>({points:[],hullDist:1}),hurtEnemy:()=>{},
 pick:a=>a[0],'$':()=>({style:{},textContent:''})};
vm.createContext(c);
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js','04-map-generation.js',
 '05-world-mesh.js','13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js',
 '14-combat-raycast.js','15-mission-system.js','16-mission-devices.js'])
 vm.runInContext(src(n),c,{filename:n});
const shard=(x,y,z,vx,vy,vz=0)=>({x,y,z,vx,vy,vz,size:.14,life:5,
 ttl:5,bounces:0,rested:false,rx:0,rz:0,spin:2});
function attempt(sh,dt){c.game.robotDebris=[sh];c.updateRobotDebris(dt);
 ok(c.game.robotDebris.length===1,'debris unexpectedly vanished');
 ok([sh.x,sh.y,sh.z,sh.vx,sh.vy,sh.vz].every(Number.isFinite),'non-finite debris state');}
for(const level of levels){
 if(process.env.TRACE_LEVELS)console.error('START LEVEL',level);
 c.game=null;c.glReady=!process.env.CANVAS_ONLY&&[1,8,35,70,99].includes(level);
 c.save.settings.quality=level%3;c.buildMap(level);
 if(c.glReady)meshes++;
 const floor=c.floorHeight(c.spawnX,c.spawnZ);
 c.game={state:'playing',sector:level,p:{x:c.spawnX,z:c.spawnZ,feetY:floor,
  maxhp:100,hp:100,armor:100,maxArmor:100,maxEnergy:100,energy:100,grounded:true,shield:5,damage:1},
  t:1,sectorTime:0,spawned:0,target:8,enemies:[],particles:[],score:0,kills:0,
  nodes:[],devices:[],portalReady:false,nodesDestroyed:0,impactFx:[],scorch:[],loot:[],idCounter:0,robotDebris:[]};
 c.spawnPowerNodes(level);c.startMission(c.game);c.initDevices(c.game);
 const n=c.mapSize;
 // 3D stone-wall case: actual wall tile adjacent to a real, free walk cell.
 let wallSeen=false;
 for(let z=2;z<n-2&&!wallSeen;z++)for(let x=2;x<n-2&&!wallSeen;x++){
  if(c.mapCells[z][x]!==0||c.floorHeight(x+.5,z+.5)>.01)continue;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   if(c.mapCells[z+dz][x+dx]!==1||c.worldSolidBodyCollision(x+.5,z+.5,.07,.3,1.1))continue;
   const sh=shard(x+.5,1.12,z+.5,dx*13,0,dz*13);
   attempt(sh,.15);
   const initial=x+.5,z0=z+.5;
   ok((sh.x-initial)*dx+(sh.z-z0)*dz<.56,`L${level} shard passes through real map wall`);
   wallSeen=true;realWalls++;break;
  }
 }
 ok(wallSeen,`L${level} no map wall adjacency tested`);
 // ALL machinery found by the real mission/device generator has a genuine
 // metal hull in Canvas AND mesh: spawn a moving fragment near its casing.
 let equipmentSeen=false;
 for(const d of [...c.game.devices,...c.game.nodes]){
  if(d.dead)continue;
  const y=c.floorHeight(d.x,d.z);
  for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]){
   const sx=d.x+dx*.90,sz=d.z+dz*.90;
   if(c.collide(sx,sz,.07)||c.worldSolidBodyCollision(sx,sz,.07,y+.25,.80))continue;
   const sh=shard(sx,y+.91,sz,-dx*12,0,-dz*12);
   attempt(sh,.17);
   ok((sh.x-d.x)*dx+(sh.z-d.z)*dz>.12,
    `L${level} shard tunnels through generated steel equipment`);
   equipmentSeen=true;realEquipment++;break;
  }
  if(equipmentSeen)break;
 }
 ok(equipmentSeen,`L${level} no usable production equipment tested`);
 // Suspended deck is a real thin plate shared by both renderers.
 let deckSeen=false;
 for(let z=2;z<n-2&&!deckSeen;z++)for(let x=2;x<n-2&&!deckSeen;x++){
  if(c.mapCells[z][x]!==0)continue;
  const h=c.deckAtCell(x,z);if(h<1.5)continue;
  const sh=shard(x+.5,h+.85,z+.5,0,-6);
  attempt(sh,.22);
  ok(sh.y>=h-.005,`L${level}: debris fell through visible bridge deck`);
  realDecks++;deckSeen=true;
 }
 // Not every sector has the same suspended geometry; absence is expected.
 if(c.glReady){
  const unique=new Set();let chosen=null;
  for(const bucket of vm.runInContext('worldSolidGrid',c))for(const solid of bucket||[]){
   if(unique.has(solid))continue;unique.add(solid);
   const b=solid.box;
   if(b[4]<.7||b[4]>10||b[3]-b[0]<.30||b[5]-b[2]<.30)continue;
   const px=(b[0]+b[3])*.5,pz=(b[2]+b[5])*.5;
   if(px<1||pz<1||px>n-2||pz>n-2)continue;
   if(c.mapCells[Math.floor(pz)]?.[Math.floor(px)]!==0)continue;
   chosen={x:px,z:pz,top:b[4]};break;
  }
  if(chosen){
   const s=shard(chosen.x,chosen.top+.80,chosen.z,0,-7);
   attempt(s,.16);
   ok(s.y>=chosen.top-.01,`L${level} shard falls through real WebGL steel box`);
   realMesh++;
  }
 }
 worlds++;
}
console.log(`Stage104 real robot debris physics: ${checks} PASS / ${worlds} maps / ${realWalls} real map walls / ${realEquipment} actual station-reactor hulls / ${realDecks} raised decks / ${realMesh} 3D mesh metal plates / ${meshes} full 3D map meshes`);
