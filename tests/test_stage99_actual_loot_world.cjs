'use strict';
// Stage99 real level test: all physical loot checks query the ACTUAL 100
// procedurally generated maps, real reactor + station hulls and actual
// suspended deck heights. No mocked collision oracle is used.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
const levels=process.env.LEVELS?process.env.LEVELS.split(',').map(Number):Array.from({length:100},(_,i)=>i+1);
let checks=0,worlds=0,generated=0,stationRims=0,blocked=0,deckCases=0,meshCases=0;
const ok=(v,msg)=>{assert.ok(v,msg);checks++;};
const c={Math,console,Number,Set,Map,Array,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),distance:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),
 mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],legacyResumeSector:-1,legacyResumeDivisor:18,
 glReady:false,touchOnly:false,gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:v=>v,
 save:{settings:{quality:0,audio:false},credits:0},sound:()=>{},burst:()=>{},saveRun:()=>{},
 damagePlayer:()=>{},input:{jumpQueued:false},arsenalOpened:false,navField:null,navClock:0,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['Босс'],robotPalette:()=>{},toast:()=>{},game:null,
 robotNearArea:()=>false,enemyBlastSamples:()=>({points:[],hullDist:1}),hurtEnemy:()=>{},
 pick:a=>a[0], '$':()=>({style:{},textContent:''})};
vm.createContext(c);
for(const name of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js','15-mission-system.js','16-mission-devices.js'])
 vm.runInContext(src(name),c,{filename:name});
for(const level of levels){
 c.game=null;c.glReady=[1,8,35,70,99].includes(level);
 c.save.settings.quality=level%2;c.buildMap(level);
 const g={state:'playing',sector:level,p:{x:c.spawnX,z:c.spawnZ,feetY:c.floorHeight(c.spawnX,c.spawnZ),
  maxhp:100,hp:100,armor:100,maxArmor:100,maxEnergy:100,energy:100,grounded:true,shield:5,damage:1},
  t:1,sectorTime:0,spawned:0,target:8,enemies:[],particles:[],score:0,kills:0,
  nodes:[],devices:[],portalReady:false,nodesDestroyed:0,impactFx:[],scorch:[],loot:[],idCounter:0,robotDebris:[]};
 c.game=g;c.spawnPowerNodes(level);c.startMission(g);c.initDevices(g);
 const source={x:c.spawnX,z:c.spawnZ,feetY:c.floorHeight(c.spawnX,c.spawnZ)};
 const open=c.worldLootSpawn(source,'credits',18,.21,.13);
 ok(!!open,`L${level}: spawn floor must allow safe resource drop`);
 ok(!c.collide(open.x,open.z,.17),`L${level}: start drop intersects wall`);
 ok(!c.worldSolidBodyCollision(open.x,open.z,.17,open.feetY+.1,.72),`L${level}: start drop inside metal`);
 ok(c.worldLootPickupClear({...source,magnet:1.7},open),`L${level}: start drop unreachable behind real structure`);
 generated++;
 for(const d of g.devices){
  const feet=c.floorHeight(d.x,d.z);
  ok(c.worldSolidBodyCollision(d.x,d.z,.20,feet,1.65),`L${level}: metal device lacks physical center`);
  // The actually rendered steel base spans x +/- .36: the previous box
  // ended at +/- .34, leaving visible-but-intangible metal on both sides.
  ok(c.worldSolidBodyCollision(d.x+.356,d.z,.01,feet+.01,1.0),
   `L${level}: right visible steel rim has no physical volume`);
  ok(c.worldSolidBodyCollision(d.x-.356,d.z,.01,feet+.01,1.0),
   `L${level}: left visible steel rim has no physical volume`);
  stationRims+=2;
  const left={x:d.x-.91,z:d.z,feetY:feet,magnet:4};
  const right={x:d.x+.91,z:d.z,feetY:feet,type:'credits',life:8};
  if(!c.collide(left.x,left.z,.17)&&!c.collide(right.x,right.z,.17)&&
     !c.worldSolidBodyCollision(left.x,left.z,.17,feet+.10,1.0)&&
     !c.worldSolidBodyCollision(right.x,right.z,.17,feet+.10,1.0)){
   ok(!c.worldLootPickupClear(left,right),`L${level}: vacuum through intact metal station`);
   blocked++;
  }
 }
 // Old destroyed container drops were generated from the DEAD source,
 // which no longer has a visible or physical hull. They must be safe.
 const container=g.nodes.find(n=>n.type===2);
 if(container){
  container.dead=true;g.nodesDestroyed++;
  const drop=c.worldLootSpawn(container,'heal',25,.3,0);
  if(drop){
   ok(!c.collide(drop.x,drop.z,.17),`L${level}: container drop inside wall`);
   ok(!c.worldSolidBodyCollision(drop.x,drop.z,.16,drop.feetY+.1,.7),
    `L${level}: container drop inside neighboring equipment`);
   generated++;
  }
 }
 // At least on some worlds, a robot may perish ON a bridge. The reward
 // must remain on that physical platform, not appear on the floor beneath.
 let elevated=false;
 for(let z=2;z<c.mapSize-2&&!elevated;z++)for(let x=2;x<c.mapSize-2&&!elevated;x++){
  if(c.mapCells[z][x]!==0)continue;
  const deck=c.deckAtCell(x,z),px=x+.5,pz=z+.5;
  if(deck<.8||c.worldSolidBodyCollision(px,pz,.2,deck+.1,.7))continue;
  const source={x:px,z:pz,feetY:deck};
  const drop=c.worldLootSpawn(source,'energy',16);
  if(!drop)continue;
  ok(Math.abs(drop.feetY-deck)<.02,`L${level}: loot fell through bridge when enemy died on it`);
  ok(!c.worldSolidBodyCollision(drop.x,drop.z,.16,drop.feetY+.1,.7),
   `L${level}: elevated drop intersects metal`);
  elevated=true;deckCases++;
 }
 if(c.glReady){ok(!!c.worldMesh||c.worldChunks.length>0,`L${level}: WebGL mesh build missing`);meshCases++;}
 worlds++;
}
console.log(`Stage99 real physical loot: ${checks} PASS / ${worlds} maps / ${generated} drops / ${stationRims} steel rim probes / ${blocked} intact-station blockers / ${deckCases} raised-deck cases / ${meshCases} 3D meshes`);
