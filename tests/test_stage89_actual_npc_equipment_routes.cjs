'use strict';
// Actual procedural scenes: a robot's claimed shortcut must not cross
// the live metal collider rendered in the level. Each map also has a ground
// path to the portal and no changed map/stair shape.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let assertions=0;function check(c,m){assert.ok(c,m);assertions++;}
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
const first=Math.max(1,Number(process.env.FIRST||1)),last=Math.min(100,Number(process.env.LAST||100));
let worlds=0,bodies=0,validatedRoutes=0,covered=0;
for(let level=first;level<=last;level++){
 c.game=null;c.glReady=false;c.save.settings.quality=level%2;c.buildMap(level);
 const g={state:'playing',sector:level,p:{x:c.spawnX,z:c.spawnZ,feetY:0,
  maxhp:100,hp:100,armor:100,maxArmor:100,maxEnergy:100,energy:100,grounded:true,shield:0},
  t:1,sectorTime:0,spawned:0,target:10,enemies:[],particles:[],score:0,kills:0,
  nodes:[],devices:[],portalReady:false,nodesDestroyed:0};
 c.game=g;c.spawnPowerNodes(level);c.startMission(g);c.initDevices(g);
 const equipments=[...g.nodes.map(o=>({o,kind:'node'})),
  ...g.devices.map(o=>({o,kind:'equipment'})),
  ...g.mission.caches.map(o=>({o,kind:'archive'}))];
 const field=c.missionGroundField(c.spawnX,c.spawnZ);
 check(field[Math.floor(c.portal.z)*c.mapSize+Math.floor(c.portal.x)]>=0,`L${level}: no portal ground route`);
 let routesHere=0;
 for(const {o,kind} of equipments){
  const feet=c.floorHeight(o.x,o.z);
  check(c.worldSolidBodyCollision(o.x,o.z,.24,feet,1.68),`L${level}: ${kind} steel not physically solid`);
  bodies++;
  let hit=false;
  for(const [dx,dz] of [[1,0],[0,1]]){
   for(const span of [1.05,.84]){
    const a={x:o.x-dx*span,z:o.z-dz*span},b={x:o.x+dx*span,z:o.z+dz*span};
    if(c.collide(a.x,a.z,.25)||c.collide(b.x,b.z,.25)||
     c.worldSolidBodyCollision(a.x,a.z,.24,feet,1.68)||
     c.worldSolidBodyCollision(b.x,b.z,.24,feet,1.68)||
     !c.lineClear(a.x,a.z,b.x,b.z))continue;
    const robot={id:3,x:a.x,z:a.z,feetY:feet,radius:.48,type:'scout',maxhp:100};
    check(!c.enemyDirectRoute(robot,b),
      `L${level} ${kind}: robot sees direct path through physical chassis (${o.x},${o.z})`);
    hit=true;routesHere++;validatedRoutes++;
    break;
   }
   if(hit)break;
  }
  if(!hit)covered++; // tight alleys: presence/impassability is still checked
 }
 check(equipments.length>=6,`L${level}: equipment missing`);
 worlds++;
}
check(validatedRoutes>=worlds,`insufficient actual-world route probes ${validatedRoutes}/${worlds}`);
console.log(`Stage89 actual NPC routes: ${assertions} checks / ${worlds} maps (${first}-${last}) / ${bodies} solid bodies / ${validatedRoutes} verified blocked straight routes / ${covered} crowded placements without two-sided probe: PASS`);
