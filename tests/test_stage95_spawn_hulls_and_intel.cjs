'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
const N=26,grid=()=>Array.from({length:N},(_,z)=>Array.from({length:N},(_,x)=>x===0||z===0||x===N-1||z===N-1?1:0));
let checks=0;function check(a,m){assert.ok(a,m);checks++;}
const eTypes={scout:{radius:.48,hp:100,speed:2,damage:7,range:9,color:[1,.4,.2],score:1},
 brute:{radius:.76,hp:200,speed:1,damage:12,range:6,color:[.6,.3,.2],score:2},
 drone:{radius:.63,hp:100,speed:2,damage:7,range:9,color:[.3,.7,1],score:2}};
const c={Math,console,Number,Array,Set,Map,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 mapSize:N,mapCells:grid(),mapRooms:[],glReady:false,touchOnly:false,worldMesh:null,worldChunks:[],mapFeatures:[],
 mapSizeValid:()=>true,TAU:Math.PI*2,sectorStyle:0,portal:{x:23.5,z:23.5},
 hypot:Math.hypot,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),rand:(a,b)=>(a+b)/2,
 pick:v=>v[0],enemies:eTypes,bossNames:['BOSS'],themes:[{accent:[1,.7,.3]}],
 save:{settings:{audio:false}},input:{jumpQueued:false},
 '$':()=>({textContent:'',style:{}}),sound:()=>{},toast:()=>{},
 game:{p:{x:2.5,z:2.5,feetY:0},enemies:[],nodes:[],devices:[],mission:{type:'purge',caches:[]},
  nodesDestroyed:0,sector:7,spawned:0,target:12,idCounter:0,portalReady:false},
 floorHeight:()=>0,floorHeightAtCell:()=>0,deckAtCell:()=>0,deckHeight:()=>0,supportHeight:()=>0,
 balconySpecs:[],midlevelSpecs:[],gallerySpecs:[],skyFeatureSpecs:[]};
vm.createContext(c);
for(const f of ['03-height-and-collision.js','04a-static-world-solids.js','13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js','14-combat-raycast.js'])
 vm.runInContext(src(f),c,{filename:f});
// The real equipment index and exact 3D solid collision are used; no stubs.
c.game.nodes=[{x:9.5,z:9.5,dead:false,type:0}];
c.game.devices=[{x:12.5,z:9.5,kind:'repair',used:false}];
c.game.mission={type:'recovery',caches:[{id:1,x:15.5,z:9.5,got:false}]};
for(const gl of [false,true]){
 c.glReady=gl;
 check(c.worldSolidBodyCollision(9.5,9.5,.45,0,1.9),'real reactor chassis must be solid');
 for(const [x,label] of [[9.5,'reactor'],[12.5,'station'],[15.5,'archive plinth']]){
  check(!c.enemySpawnSpaceClear(x,9.5,.48,1.9,0),`Canvas/WebGL robot spawned inside ${label}`);
  check(c.enemySpawnSpaceClear(x,9.5,.48,1.9,2.5),`${label} must not block a separate elevated body interval`);
 }
 check(c.enemySpawnSpaceClear(19.5,9.5,.48,1.9,0),'unobstructed spawn should stay valid');
}
// A destroyed reactor ceases to be a physical obstacle immediately.
c.glReady=false;c.game.nodes[0].dead=true;c.game.nodesDestroyed++;
check(c.enemySpawnSpaceClear(9.5,9.5,.48,1.9,0),'dead reactor has phantom spawn collision');
// Spawn creation must probe a real heavy/elite/boss body, never a scout proxy.
let shape=null;
const randFloor=c.randFloor,balcony=c.randBalconySpawn;
c.randFloor=(min,r,h)=>{shape={min,r,h};return {x:20.5,z:17.5,feetY:0};};
c.randBalconySpawn=()=>null;
const types=[['scout',false,4],['brute',false,4],['drone',false,4],['scout',true,0]];
for(const [type,boss,spawned] of types){
 c.game.enemies=[];c.game.spawned=spawned;
 const bot=c.spawnEnemy(type,boss);check(!!bot,'spawnEnemy returned null');
 const required=Math.max(c.enemyBodyRadius(bot),c.enemyCrowdRadius(bot));
 check(shape.r+1e-7>=required,`${type} elite/boss physical radius underreserved ${shape.r} < ${required}`);
 check(shape.h+1e-7>=c.enemyBodyHeight(bot),`${type} elite/boss vertical body underreserved`);
 if(!boss&&spawned===4)check(bot.radius>=eTypes[type].radius*1.13-1e-8,'elite radius not accounted before placement');
 if(boss)check(shape.r>=.8,'boss clearance should exceed tiny scout footprint');
}
c.game.enemies=[];c.game.sector=13;c.game.spawned=1;
const commander=c.spawnEnemy('brute',false,true);
check(commander?.elite===true,'marked commander must already be elite during spawn selection');
check(shape.r+1e-7>=Math.max(c.enemyBodyRadius(commander),c.enemyCrowdRadius(commander)),
 'forced commander silhouette underreserved during spawn');
check(commander.radius>=eTypes.brute.radius*1.13-1e-8,
 'early elite promotion after spawn loses the real physical radius');
c.randFloor=randFloor;c.randBalconySpawn=balcony;
// Target HUD helper is extracted from the actual shipped source function and
// tested with real rayWall, so no mock visibility oracle is involved.
const cinematic=src('24-cinematic-hooks.js'),start=cinematic.indexOf('function dcTargetPhysicallyVisible('),
 end=cinematic.indexOf('function dcBadge(',start);
check(start>=0&&end>start,'physical target visibility helper missing');
vm.runInContext(cinematic.slice(start,end),c);
const see=(p,e)=>c.dcTargetPhysicallyVisible(p,e);
c.game.nodes[0].dead=false;c.game.nodesDestroyed++;
const player={x:7.5,z:9.5,feetY:0},robot={x:11.5,z:9.5,feetY:0,radius:.48,type:'scout'};
check(see(player,robot),'an exposed upper robot silhouette above a low chassis must remain visible');
c.game.nodes[0].dead=true;c.game.nodesDestroyed++;
check(see(player,robot),'HUD keeps phantom cover after reactor destroyed');
c.game.nodes=[];c.game.devices=[];c.game.mission={type:'purge',caches:[]};
c.mapCells[9][9]=1;
check(!see(player,robot),'HUD sees through floor-to-ceiling map wall');
c.mapCells[9][9]=0;
check(see(player,robot),'HUD suppresses visible target in clear corridor');
const high={x:11.5,z:9.5,feetY:2.8,radius:.48,type:'scout'};
check(see(player,high),'HUD incorrectly rejects exposed high-altitude target');
console.log(`Stage95 synthetic robot spawn & 3D target HUD: ${checks} checks PASS`);
