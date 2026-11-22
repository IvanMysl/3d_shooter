'use strict';
// Procedural campaign worlds, no mock equipment coordinates. Live reactor
// colliders and robot navigation must agree before AND after destruction.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0,worlds=0,reactors=0;
function check(ok,msg){assert.ok(ok,msg);checks++;}
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
for(const name of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js',
 '15-mission-system.js','16-mission-devices.js'])
 vm.runInContext(src(name),c,{filename:name});
const levels=process.env.LEVELS?(process.env.LEVELS.split(',').map(Number)):
 [1,2,3,4,5,8,14,41];
for(const level of levels){
 c.game=null;c.glReady=false;c.save.settings.quality=level%2;
 c.buildMap(level);
 const g={state:'playing',sector:level,p:{x:c.spawnX,z:c.spawnZ,feetY:0,
  maxhp:100,hp:100,armor:100,maxArmor:100,maxEnergy:100,energy:100,grounded:true,shield:0},
  t:1,sectorTime:0,spawned:0,target:10,enemies:[],particles:[],score:0,kills:0,
  nodes:[],devices:[],portalReady:false,nodesDestroyed:0};
 c.game=g;c.spawnPowerNodes(level);c.startMission(g);c.initDevices(g);
 check(g.nodes.length>0,`L${level} did not create reactors`);
 // A non-recovery campaign must not rebuild its whole equipment bucket array
 // for every single navigation lookup (the Stage90 performance defect).
 const index=c.worldEquipmentGrid();
 check(index===c.worldEquipmentGrid(),`L${level} equipment index rebuilt without any geometry change`);
 for(const reactor of g.nodes){
  const tx=Math.floor(reactor.x),tz=Math.floor(reactor.z),feet=c.floorHeight(reactor.x,reactor.z);
  check(!reactor.dead,`L${level}: initial reactor dead`);
  check(c.worldSolidBodyCollision(reactor.x,reactor.z,.24,feet,1.68),
   `L${level}: live reactor has no physical AABB`);
  check(!c.enemyNavTile(tx,tz),`L${level}: living reactor has no AI tile collision`);
  reactor.dead=true;g.nodesDestroyed++;
  check(!c.worldSolidBodyCollision(reactor.x,reactor.z,.24,feet,1.68),
   `L${level}: reactor ghost AABB after destruction`);
  check(c.enemyNavTile(tx,tz),`L${level}: AI ghost tile after reactor destruction`);
  // Geometry identity must be stable; dead flag is evaluated at query time.
  check(index===c.worldEquipmentGrid(),`L${level}: reactor death needlessly rebuilt unchanged boxes`);
  reactors++;
 }
 // Rebuild should use the refreshed edge mask; every former reactor cell
 // on a walkable level is now a legitimate position in its own right.
 c.rebuildNavigation();
 check(vm.runInContext('navFieldDestroyed',c)===g.nodesDestroyed,`L${level}: stale flow-field revision`);
 worlds++;
}
console.log(`Stage91 actual campaign reactor nav refresh: ${checks} assertions / ${worlds} procedural maps / ${reactors} reactors PASS`);
