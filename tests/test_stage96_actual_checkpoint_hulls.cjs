'use strict';
// Actual 100 procedural worlds, with damaged robots restored inside formerly
// pass-through machinery, overlapped crowd and invalid player coordinates.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0,bots=0,relocated=0,equipment=0,mesh=0,bosses=0;
function check(x,msg){assert.ok(x,msg);checks++;}
const c={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),distance:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),
 mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],legacyResumeSector:-1,legacyResumeDivisor:18,
 glReady:false,touchOnly:false,gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:v=>v,
 save:{settings:{quality:0,audio:false},credits:0,perms:Array(12).fill(0)},
 sound:()=>{},burst:()=>{},saveRun:()=>{},
 '$':()=>({textContent:'',style:{},dataset:{}}),toast:()=>{},input:{jumpQueued:false},arsenalOpened:false,
 navField:null,navClock:0,game:null,PERM_MAX_LEVEL:40,
 DASH_DISTANCE_BASE:2.52,DASH_UPGRADE_STEP:.30,PLAYER_SOLID_HEIGHT:1.95,
 equippedArmorStats:()=>({id:-1,maxDurability:0,reduction:0,wear:1}),
 weapons:Array.from({length:10},()=>({name:'weapon'})),
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:2.2,damage:8,range:12,color:[1,.5,.2],score:10},
  brute:{hp:200,radius:.76,speed:1.3,damage:16,range:8,color:[1,.3,.1],score:20},
  drone:{hp:100,radius:.61,speed:2,damage:7,range:12,color:[.2,.7,1],score:18}},
 bossNames:['BOSS']};
vm.createContext(c);
for(const f of ['03-height-and-collision.js','04a-static-world-solids.js','04-map-generation.js',
 '05-world-mesh.js','13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js',
 '14-combat-raycast.js','15-mission-system.js','16-mission-devices.js'])
 vm.runInContext(src(f),c,{filename:f});
const a=src('12-arsenal-and-game.js');
vm.runInContext(a.slice(a.indexOf('const PERM_COMPOUND='),a.indexOf('function newPlayer(')),c);
const saved=src('20-minimap-and-checkpoint.js');
vm.runInContext(saved.slice(saved.indexOf('function restoreLiveCheckpoint('),saved.indexOf('// Auto-save during combat')),c);
const start=Math.max(1,Number(process.env.FIRST||1)),end=Math.min(100,Number(process.env.LAST||100));
const glLevels=new Set((process.env.WEBGL||'1,14,35,70,99').split(',').map(Number));
for(let level=start;level<=end;level++){
 c.glReady=glLevels.has(level);c.save.settings.quality=level%2?0:2;c.game=null;
 c.buildMap(level);if(c.glReady)mesh++;
 const p={x:c.spawnX,z:c.spawnZ,feetY:c.floorHeight(c.spawnX,c.spawnZ),
  hp:80,maxhp:100,energy:75,maxEnergy:100,regen:16,damage:1,maxArmor:30,armor:25,
  weapon:0,dashRange:2.52,shieldDuration:3.5,grounded:true,vy:0,abilityCooldowns:{}};
 const g={state:'playing',sector:level,p,t:0,sectorTime:0,spawned:0,target:16,
  waveDelay:1.5,idCounter:0,enemies:[],nodes:[],devices:[],nodesDestroyed:0,portalReady:false,
  score:0,kills:0,upgrades:{},appliedPerms:Array(12).fill(0),particles:[],robotDebris:[]};
 c.game=g;c.spawnPowerNodes(level);c.startMission(g);c.initDevices(g);
 const allEquipment=[...g.nodes,...g.devices,...(g.mission.caches||[])];
 equipment+=allEquipment.length;
 const types=level%5===0?['scout','brute','drone','boss']:['scout','brute','drone'];
 let originals=[];
 for(const type of types){
  g.spawned=type==='drone'?4:0;
  const e=c.spawnEnemy(type,type==='boss');
  check(!!e,`L${level}: could not construct ${type} scenario`);
  e.hp=Math.max(1,Math.floor(e.maxhp*.34));e.attack=.843;
  originals.push({...e});
 }
 const at=allEquipment.find(q=>!q.dead);
 check(!!at,`L${level}: equipment absent`);
 // Recreate legacy saves where formerly decorative machinery was passable.
 for(let i=0;i<originals.length;i++){
  const e=originals[i],q=i%2===0?at:allEquipment[Math.min(1,allEquipment.length-1)];
  e.x=q.x;e.z=q.z;e.feetY=c.floorHeight(q.x,q.z)+(e.airborne?.13:0);
 }
 const oldPositions=originals.map(e=>({id:e.id,x:e.x,z:e.z,feetY:e.feetY}));
 const count=originals.length;g.enemies=originals;g.spawned=count;
 const ck={version:4,sector:level,state:'playing',equipmentPhysicsVersion:1,archivePlinthVersion:1,
  permanentFormula:'compound-v2',barrierFormula:'compound-v2',shieldRechargeModel:'after-duration-5s',
  permanentLevels:Array(12).fill(0),player:{...g.p},
  live:{enemies:g.enemies,nodes:g.nodes,devices:g.devices,mission:g.mission,
   target:g.target,spawned:g.spawned,waveDelay:g.waveDelay,portalReady:false,
   nodesDestroyed:0,idCounter:g.idCounter}};
 c.restoreLiveCheckpoint(ck);
 check(g.enemies.length===count,`L${level}: actors were lost on open map`);
 check(g.spawned===count,`L${level}: wave counter changed despite safe placement`);
 check(!c.worldSolidBodyCollision(g.p.x,g.p.z,.23,g.p.feetY,1.95),`L${level}: player in steel`);
 for(const e of g.enemies){
  check(!c.collide(e.x,e.z,c.enemyBodyRadius(e)),`L${level} ${e.type}: wall overlap`);
  check(!c.worldSolidBodyCollision(e.x,e.z,c.enemyBodyRadius(e),e.feetY,c.enemyBodyHeight(e)),
   `L${level} ${e.type}: overlap metal`);
  check(e.hp===Math.max(1,Math.floor(e.maxhp*.34))&&e.attack===.843,
   `L${level} ${e.type}: HP or attack timer lost`);
  const p0=oldPositions.find(p=>p.id===e.id);
  if(Math.hypot(e.x-p0.x,e.z-p0.z)>.05)relocated++;
  for(const other of g.enemies){
   if(other===e)continue;
   if(e.id>=other.id)continue;
   const vertical=e.feetY<other.feetY+c.enemyBodyHeight(other)-.03&&
    other.feetY<e.feetY+c.enemyBodyHeight(e)-.03;
   if(vertical)check(Math.hypot(e.x-other.x,e.z-other.z)>=
    c.enemyCrowdRadius(e)+c.enemyCrowdRadius(other)-.01,`L${level}: actor crowd overlap`);
  }
  bots++;
  if(e.boss)bosses++;
 }
 check(g.boss===(g.enemies.find(e=>e.boss)||null),`L${level}: stale boss handle`);
}
console.log(`Stage96 checkpoint physical migration ${checks} PASS / L${start}-${end}, ${bots} actors restored (${relocated} moved), ${bosses} bosses, ${equipment} authored equipment bodies, ${mesh} WebGL meshes`);
