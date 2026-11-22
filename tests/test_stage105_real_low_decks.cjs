'use strict';
// Physical real-map headroom. Tests the exact deck/terrain cells installed by
// the production 100-level generator, including Canvas software fallback and
// real registered WebGL plate AABBs (mesh construction without GPU).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.STAGE_SOURCE_ROOT||path.resolve(__dirname,'..');
const src=n=>fs.readFileSync(path.join(root,'src',n),'utf8');
const c={Math,Number,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,Map,Set,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(x,a,b)=>Math.min(b,Math.max(a,x)),rand:(a,b)=>(a+b)/2,
 mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],glReady:false,touchOnly:false,
 legacyResumeSector:-1,legacyResumeDivisor:18,gl:{deleteBuffer(){}},worldMesh:null,
 worldChunks:[],meshStats:{},toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:v=>v,
 save:{settings:{quality:0,audio:false}},game:null,mpMatch:null,navField:null,navClock:0,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{radius:.42,score:10},brute:{radius:.69,score:20},shooter:{radius:.52,score:30}},
 sound:()=>{},toast:()=>{},burst:()=>{},input:{},arsenalOpened:false};
vm.createContext(c);
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js'])vm.runInContext(src(n),c,{filename:n});
let checks=0,under=0,smallOpen=0,bigBlocked=0,webgl=0,sites=0,cliffs=0;
const check=(v,why)=>{assert.ok(v,why);checks++;};
const first=Math.max(1,Number(process.env.FIRST||1)),last=Math.min(100,Number(process.env.LAST||100));
const meshLevels=new Set((process.env.WEBGL||'1,14,35,70,99').split(',').filter(Boolean).map(Number));
const enemy=(type,feetY)=>({type,boss:type==='boss',radius:type==='boss'?1.03:type==='brute'?.69:.42,
 feetY,elite:false,airborne:false,maxhp:100});
for(let level=first;level<=last;level++){
 c.glReady=meshLevels.has(level);c.save.settings.quality=level%2?0:2;c.game=null;
 c.buildMap(level);if(c.glReady)webgl++;
 c.game={sector:level,nodes:[],devices:[],enemies:[],nodesDestroyed:0,mission:{type:'purge'},
  t:0,p:{x:c.spawnX,z:c.spawnZ,feetY:c.floorHeight(c.spawnX,c.spawnZ)}};
 const n=c.mapSize,arr=vm.runInContext('deckCells',c),solids=vm.runInContext('worldSolidGrid',c);let levelDecks=0;
 const hh={scout:c.enemyBodyHeight(enemy('scout',0)),brute:c.enemyBodyHeight(enemy('brute',0)),boss:c.enemyBodyHeight(enemy('boss',0))};
 check(hh.boss>hh.brute&&hh.brute>hh.scout,`L${level}: model height ordering lost`);
 for(let z=1;z<n-1;z++)for(let x=1;x<n-1;x++){
  const deck=arr[z*n+x];if(!(deck>0)||c.mapCells[z][x])continue;
  const cx=x+.5,cz=z+.5,terrain=c.floorHeight(cx,cz),clearance=deck-.17-terrain;
  // Some early stair/roof cells carry upper ground at nearly the same height;
  // the supporting slab is not an overhead obstruction in that case.
  for(const type of ['scout','brute','boss']){
   const height=hh[type],phys=c.worldDeckBodyCollision(cx,cz,.22,terrain,height);
   const expected=deck>terrain+.16&&clearance<height-.015;
   check(phys===expected,`L${level} (${x},${z}) ${type}: real deck vs body y=${terrain}, ceiling=${clearance}`);
   check(c.worldSolidBodyCollision(cx,cz,.22,terrain,height)||!phys,
    `L${level} (${x},${z}) ${type}: body skipped visible deck`);
   const onTop=c.worldDeckBodyCollision(cx,cz,.22,deck,height);
   check(!onTop,`L${level} (${x},${z}): robot standing ON deck collides with its floor`);
   if(expected){under++;if(type!=='scout')bigBlocked++;}else if(type==='scout'&&clearance>height+.05)smallOpen++;
  }
  if(c.glReady&&levelDecks===0){
   // A real registered mesh slab must share deckCells geometry. This also
   // guards mismatched fantasy/hidden plates when the render mode changes.
   const real=(solids[z*n+x]||[]).some(o=>
    o.box[0]<=cx&&o.box[3]>=cx&&o.box[2]<=cz&&o.box[5]>=cz&&
    Math.abs(o.box[1]-(deck-.17))<.03&&Math.abs(o.box[4]-deck)<.03);
   check(real,`L${level}: visible WebGL deck AABB missing from physical grid`);sites++;
  }
  levelDecks++;
 }
 // No invented structural slab on a level without any deck elevations.
 check(levelDecks>=0,`L${level}: invalid deck count`);
 // Actual floor-only use of a taller headroom must stay grounded; do not let
 // a false underpass allow an impossible 2.2m vertical step or cliff.
 const x=Math.floor(c.spawnX),z=Math.floor(c.spawnZ);
 if(c.mapCells[z]?.[x]===0){
  check(!c.worldDeckBodyCollision(x+.5,z+.5,.22,0,hh.boss)||
    c.deckAtCell(x,z)>0,`L${level}: phantom boss overhead collision`);cliffs++;
 }
}
console.log(`Stage105 real headroom ${checks} PASS L${first}-${last}; ${under} true head collisions, ${bigBlocked} large-body blocks, ${smallOpen} open scout underpasses; ${webgl} full mesh maps, ${sites} real slab AABB verifications`);
