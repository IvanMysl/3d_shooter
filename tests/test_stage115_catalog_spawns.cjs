'use strict';
// Real map samples: actual off-centre links and upper deck exits.
// Compare accepted sweeps to dense direct checks, and walk the accepted
// ground edges with the actual actor controller in both directions.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
const levels=process.env.LEVELS?process.env.LEVELS.split(',').map(Number):Array.from({length:100},(_,i)=>i+1);
let checks=0,worlds=0,meshes=0;
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
 '14-combat-raycast.js','15-mission-system.js'])vm.runInContext(src(n),c,{filename:n});
const ev=s=>vm.runInContext(s,c);

c.setTimeout=()=>0;vm.runInContext(src('21b-multiplayer-lobby.js'),c);
const movement=src('21d-multiplayer-movement.js');
vm.runInContext(movement.slice(movement.indexOf('function mpMatchSpawnPositions('),movement.indexOf('function mpMatchActor(')),c);
const campaign=src('21-campaign-map.js');vm.runInContext(campaign.slice(campaign.indexOf('function stageName('),campaign.indexOf('function mapChapterMaximum(')),c);
const catalog=ev('MP_MAPS'),crypto=require('node:crypto');
check(catalog.length===100,'100 maps');check(new Set(catalog.map(m=>m.name)).size===100,'unique names');check(new Set(catalog.map(m=>m.id)).size===100,'unique IDs');
const signatures=new Set(),webgl=new Set((process.env.WEBGL_LEVELS||'1,18,19,35,50,70,82,90,99,100').split(',').map(Number));let placements=0;
for(const level of levels){
 const m=catalog[level-1];check(m.sector===level&&c.stageName(level)===m.name,'same campaign/PvP name and sector');
 c.glReady=webgl.has(level);c.game=null;c.buildMap(m.sector);
 signatures.add(crypto.createHash('sha256').update(JSON.stringify([c.mapCells,ev('heightCells'),ev('deckCells')])).digest('hex'));
 if(c.glReady)meshes++;
 const roster=Array.from({length:8},(_,id)=>({id,team:id%2}));
 for(const mode of ['ffa','teams']){
  const spawn=c.mpMatchSpawnPositions(roster,{mode});check(spawn.size===8,`L${level} ${mode}: eight spawns`);
  const points=[...spawn.values()];
  for(const [i,q] of points.entries()){
   check(!c.collide(q.x,q.z,.35)&&!c.worldSolidBodyCollision(q.x,q.z,.35,c.supportHeight(q,q.x,q.z),1.95),`L${level}: physical clearance`);
   for(const other of points.slice(0,i))check(Math.hypot(other.x-q.x,other.z-q.z)>1.12,`L${level}: separated spawns`);
   placements++;
  }
  check(JSON.stringify([...c.mpMatchSpawnPositions(roster,{mode})])===JSON.stringify([...spawn]),`L${level}: deterministic positions`);
 }
 worlds++;
}
check(signatures.size===worlds,'distinct physical maps');
console.log(JSON.stringify({stage:115,worlds,meshes,checks,placements,distinctGeometry:signatures.size}));
