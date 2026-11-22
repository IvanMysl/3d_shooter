'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0,bots=0,bosses=0,equipment=0,mesh=0;
function check(value,message){assert.ok(value,message);checks++;}
const c={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),distance:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),
 mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],legacyResumeSector:-1,legacyResumeDivisor:18,
 glReady:false,touchOnly:false,gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:v=>v,
 save:{settings:{quality:0,audio:false},credits:0},sound:()=>{},burst:()=>{},saveRun:()=>{},
 '$':()=>({textContent:'',style:{}}),toast:()=>{},input:{jumpQueued:false},arsenalOpened:false,
 navField:null,navClock:0,game:null,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:2.2,damage:8,range:12,color:[1,.5,.2],score:10},
  brute:{hp:200,radius:.76,speed:1.3,damage:16,range:8,color:[1,.3,.1],score:20},
  drone:{hp:100,radius:.61,speed:2,damage:7,range:12,color:[.2,.7,1],score:18}},
 bossNames:['BOSS']};
vm.createContext(c);
for(const f of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js','15-mission-system.js','16-mission-devices.js'])
 vm.runInContext(src(f),c,{filename:f});
const first=Math.max(1,Number(process.env.FIRST||1)),last=Math.min(100,Number(process.env.LAST||100));
const glLevels=new Set((process.env.WEBGL||'1,14,35,70,99').split(',').map(Number));
for(let level=first;level<=last;level++){
 c.glReady=glLevels.has(level);c.save.settings.quality=level%2?0:2;c.game=null;
 c.buildMap(level);if(c.glReady)mesh++;
 const g={state:'playing',sector:level,p:{x:c.spawnX,z:c.spawnZ,feetY:c.floorHeight(c.spawnX,c.spawnZ),
  hp:100,maxhp:100,energy:100,maxEnergy:100,armor:100,maxArmor:100,grounded:true},
  t:0,sectorTime:0,spawned:0,target:16,waveDelay:0,idCounter:0,enemies:[],
  particles:[],nodes:[],devices:[],nodesDestroyed:0,portalReady:false,score:0,kills:0};
 c.game=g;c.spawnPowerNodes(level);c.startMission(g);c.initDevices(g);
 equipment+=c.worldEquipmentStats().bodies;
 // Actual authored metal housings block a robot even if no WebGL context.
 const before=c.worldEquipmentGrid();
 check(before===c.worldEquipmentGrid(),`L${level}: equipment index unstable`);
 for(const o of [...g.nodes,...g.devices,...(g.mission.caches||[])]){
  const y=c.floorHeight(o.x,o.z);
  check(!c.enemySpawnSpaceClear(o.x,o.z,.48,1.9,y),`L${level}: spawn would overlap ${o.kind||o.type||'archive'} metal`);
 }
 const requested=level%5===0?['scout','brute','drone','boss']:['scout','brute','drone'];
 for(const kind of requested){
  g.spawned=kind==='brute'||kind==='drone'?4:0;
  const e=c.spawnEnemy(kind,kind==='boss');
  check(!!e,`L${level}: ${kind} could not find a safe initial location`);
  check(!c.collide(e.x,e.z,c.enemyBodyRadius(e)),`L${level}: ${kind} spawned in map wall`);
  check(!c.worldSolidBodyCollision(e.x,e.z,c.enemyBodyRadius(e),e.feetY,c.enemyBodyHeight(e)),
   `L${level}: ${kind} body embedded in steel/mesh`);
  for(const other of g.enemies){
   if(other===e||other.dead)continue;
   const a=c.enemyCrowdRadius(e),b=c.enemyCrowdRadius(other);
   const d=Math.hypot(e.x-other.x,e.z-other.z);
   const vertical=e.feetY<other.feetY+c.enemyBodyHeight(other)-.03&&
    e.feetY+c.enemyBodyHeight(e)>other.feetY+.03;
   if(vertical)check(d>=a+b-.008,`L${level}: ${kind} created overlapping other robot`);
  }
  bots++;if(e.boss)bosses++;
 }
 // If free space truly does not exist, the normal wave must defer rather
 // than increment spawned (covered by the old Stage11 focused regression).
 check(c.worldEquipmentGrid()===before,`L${level}: bot wave invalidated static equipment`);
}
console.log(`Stage95 spawn physical audit ${checks} PASS / L${first}-${last} (${last-first+1} maps), ${bots} live bots, ${bosses} boss spawns, ${equipment} physical equipment, ${mesh} 3D meshes`);
