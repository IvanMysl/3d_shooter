'use strict';
// Four high-altitude industrial worlds now have four DISTINCT, independently
// climbable ground constructions, without touching the pre-existing 2.2m
// crossing or flight-only maintenance platforms.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
let checks=0;const check=(v,msg)=>{assert.ok(v,msg);checks++;};
const ctx={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],
 legacyResumeSector:-1,legacyResumeDivisor:18,glReady:false,touchOnly:false,
 gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:c=>c,
 save:{settings:{quality:0,audio:false}},sound:()=>{},burst:()=>{},
 input:{jumpQueued:false},arsenalOpened:false,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['БОСС'],robotPalette:()=>({}),toast:()=>{},game:null,navField:null,navClock:0};
vm.createContext(ctx);
for(const name of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js'])
 vm.runInContext(source(name),ctx,{filename:name});
const ev=s=>vm.runInContext(s,ctx),near=(a,b,e=.003)=>Math.abs(a-b)<=e;
check(/const GAME_BUILD='(63|64|65|66|67|68|69|70|71|72|73|74|75|76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),'V63 build stamp');
check(/const MP_VERSION=(16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(source('21b-multiplayer-lobby.js')),
 'multiplayer must reject physically incompatible V62 terrain');
const worlds=new Map([[14,'collector'],[15,'atrium'],[16,'cryo'],[17,'gravity']]);
const old=new Map([[0,'citadel'],[1,'reactor'],[3,'docks'],[5,'shipyard'],
 [7,'flood'],[8,'observatory'],[10,'harbor'],[11,'forge'],[12,'vertical'],[13,'stairkeep']]);
let seen=0,ascents=0,rays=0,solids=0,bossScenes=0;
const fingerprints=new Map();
function stepWalk(actor,end,robot){
 for(let i=0;i<900;i++){
  const remaining=Math.hypot(end.x-actor.x,end.z-actor.z);
  if(remaining<.03)break;
  const d=Math.min(.035,remaining),dx=d*(end.x-actor.x)/remaining,
   dz=d*(end.z-actor.z)/remaining;
  if(robot)ctx.enemyMove(actor,dx,dz,.23);
  else{ctx.moveEntity(actor,dx,dz,.23);ctx.updateVertical(actor,1/60);}
 }
 return Math.hypot(end.x-actor.x,end.z-actor.z);
}
function probe(kind,spec){
 const {cx,cz}=spec;
 if(kind==='collector')return {x:cx-9.5,z:cz-7.5};
 if(kind==='atrium')return {x:cx-8.8,z:cz-6.5};
 if(kind==='cryo')return {x:cx-9.5,z:cz-7.5};
 const a=.42;return {x:cx+Math.cos(a)*11.4+.5,z:cz+Math.sin(a)*11.4+.5};
}
for(let level=1;level<=100;level++)for(const quality of [0,2]){
 ctx.glReady=true;ctx.touchOnly=quality===0;ctx.save.settings.quality=quality;
 ctx.buildMap(level);seen++;
 const style=(level-1)%18,kind=worlds.get(style)||old.get(style),
  specs=ev('landmarkSpecs');
 if(!kind){check(specs.length===0,`L${level}: unexpected duplicated landmark`);continue;}
 check(specs.length===1&&specs[0].kind===kind,
  `L${level} q${quality}: lost ${kind} distinct construction`);
 const spec=specs[0],cells=ev('landmarkCells(landmarkSpecs[0])');
 check(cells.length>=68,`L${level}: ${kind} has no substantial raised route`);
 const shape=cells.map(p=>`${p.x-spec.cx}:${p.z-spec.cz}:${Math.round(p.h*100)}`)
  .sort().join('|');
 if(fingerprints.has(kind))check(fingerprints.get(kind)===shape,
  `L${level}: ${kind} identity changed with the campaign seed`);
 else fingerprints.set(kind,shape);
 if(!worlds.has(style))continue;
 check(ev('bridgeSpecs.length')===1,`L${level}: old suspended industrial crossing disappeared`);
 check(near(ctx.deckHeight(ctx.spawnX,ctx.spawnZ),2.2,.002),
  `L${level}: legacy upper deck lost its real 2.2m support`);
 check((level%5===0?ctx.ceilingHeight()>=20.5:near(ctx.ceilingHeight(),12)),
  `L${level}: industrial boss / normal scale mismatch`);
 for(const p of cells){
  check(ctx.mapCells[p.z]?.[p.x]===0,
   `L${level}: ${kind} walkable tile is buried in a maze wall`);
  check(near(ctx.floorHeightAtCell(p.x,p.z),p.h,.00005),
   `L${level} ${kind}: painted-only stair ${p.x},${p.z}`);
  if(p.h<1.32-.001){
   const h=ctx.rayWall({x:p.x+.5,z:p.z+.5,y:p.h+.14},
    {x:0,y:-1,z:0},.35);
   check(h&&near(h.y,p.h,.015),
    `L${level}: bullet passes through real ${kind} riser ${p.x},${p.z}`);
   rays++;
  }
 }
 const core=probe(kind,spec);
 check(ctx.worldSolidBodyCollision(core.x,core.z,.18,0,1.95),
  `L${level}: themed ${kind} sculpture is only visual`);solids++;
 if(level%5===0){
  check(ctx.worldSolidBodyCollision(core.x,core.z,.18,6,1.95),
   `L${level}: majestic ${kind} boss tower is not physically tall`);
  bossScenes++;
 }
 const edge=kind==='gravity'?8:7,
  start={x:spec.cx+edge+7+.5,z:spec.cz+.5},
  end={x:spec.cx+edge-1+.5,z:spec.cz+.5};
 check(near(ctx.floorHeight(start.x,start.z),0,.002),
  `L${level}: ${kind} entry is not ground-accessible`);
 check(near(ctx.floorHeight(end.x,end.z),1.32,.002),
  `L${level}: ${kind} landing is not physically high`);
 for(const robot of [false,true]){
  const actor={id:63,...start,feetY:0,vy:0,grounded:true,
   ...(robot?{type:'scout',maxhp:100,radius:.48,orbit:1,airborne:false}:{})};
  ctx.game={p:robot?{x:ctx.spawnX,z:ctx.spawnZ,feetY:0}:actor,
   enemies:robot?[actor]:[],particles:[],t:0};
  const gap=stepWalk(actor,end,robot);
  check(gap<.12&&near(actor.feetY,1.32,.06),
   `L${level}: ${robot?'robot':'player'} cannot ascend ${kind}, gap=${gap}, feet=${actor.feetY}`);
  check(!ctx.worldSolidBodyCollision(actor.x,actor.z,.23,actor.feetY,1.95),
   `L${level}: low ${kind} landing is blocked by solid equipment`);
  ascents++;
 }
}
check(fingerprints.size===14&&new Set(fingerprints.values()).size===14,
 'architectures 0–13 and 14–17 are not genuinely different');
check(seen===200&&ascents>=40&&rays>=20&&solids>=20&&bossScenes>=8,
 'missing coverage of new multi-height industrial zones');
console.log(`Stage63: ${checks} checks PASS: ${seen} worlds, ${fingerprints.size} distinct climbable signatures, ${rays} stair bullet impacts, ${ascents} player/robot ascents, ${solids} machines, ${bossScenes} tall themed bosses`);
