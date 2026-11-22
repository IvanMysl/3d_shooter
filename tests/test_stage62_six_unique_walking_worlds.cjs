'use strict';
// V62: six more original tactical silhouettes that replace identical
// labyrinth-platform play with genuinely different walkable 3D routes.
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
for(const file of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js'])
 vm.runInContext(source(file),ctx,{filename:file});
const ev=s=>vm.runInContext(s,ctx),near=(a,b,e=.002)=>Math.abs(a-b)<=e;
check(/const GAME_BUILD='(62|63|64|65|66|67|68|69|70|71|72|73|74|75|76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),'V62+ release');
check(/const MP_VERSION=(15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(source('21b-multiplayer-lobby.js')),
 'new world geometry must reject V61 multiplayer clients');
const newFamilies=new Map([[7,'flood'],[8,'observatory'],[10,'harbor'],
 [11,'forge'],[12,'vertical'],[13,'stairkeep']]);
const oldFamilies=new Map([[0,'citadel'],[1,'reactor'],[3,'docks'],[5,'shipyard']]);
const fingerprints=new Map();let scenes=0,riserImpacts=0,ascents=0,decorationHits=0;
function moveTo(actor,target,robot){
 for(let i=0;i<850;i++){
  const remaining=Math.hypot(target.x-actor.x,target.z-actor.z);
  if(remaining<.035)break;
  const d=Math.min(remaining,.035),dx=(target.x-actor.x)/remaining*d,
   dz=(target.z-actor.z)/remaining*d;
  if(robot)ctx.enemyMove(actor,dx,dz,.23);
  else{ctx.moveEntity(actor,dx,dz,.23);ctx.updateVertical(actor,1/60);}
 }
 return Math.hypot(target.x-actor.x,target.z-actor.z);
}
function pathFor(kind,spec){
 const edge={flood:6,observatory:9,harbor:6,forge:7,vertical:6,stairkeep:8}[kind];
 const start=kind==='stairkeep'?edge+1:edge+7;
 const dest=kind==='stairkeep'?3:edge-1;
 return [{x:spec.cx+start+.5,z:spec.cz+.5},
  {x:spec.cx+dest+.5,z:spec.cz+.5}];
}
function decorationAt(kind,spec){
 const {cx,cz,y}=spec;
 return {flood:{x:cx-9+.5,z:cz-5+.5,feet:0},
  observatory:{x:cx+.5,z:cz+.5,feet:y},
  harbor:{x:cx-8.4,z:cz-5+.5,feet:0},
  forge:{x:cx-9+.5,z:cz-4.8,feet:0},
  vertical:{x:cx-9+.5,z:cz-4+.5,feet:0},
  stairkeep:{x:cx-10+.5,z:cz-9+.5,feet:0}}[kind];
}
for(let level=1;level<=100;level++)for(const quality of [0,2]){
 ctx.glReady=true;ctx.touchOnly=quality===0;ctx.save.settings.quality=quality;
 ctx.buildMap(level);scenes++;
 const style=(level-1)%18,kind=newFamilies.get(style)||oldFamilies.get(style),
  specs=ev('landmarkSpecs');
 if(!kind){if(![14,15,16,17].includes(style))
  check(specs.length===0,`L${level}: duplicated landmark on unrelated map`);continue;}
 check(specs.length===1&&specs[0].kind===kind,
  `L${level} q${quality}: expected a real ${kind} blueprint`);
 const spec=specs[0],cells=ev('landmarkCells(landmarkSpecs[0])');
 check(cells.length>=65,`L${level}: tiny or missing ${kind} footprint`);
 const geometry=cells.map(p=>`${p.x-spec.cx}:${p.z-spec.cz}:${Math.round(p.h*100)}`)
  .sort().join('|');
 if(fingerprints.has(kind))check(fingerprints.get(kind)===geometry,
  `L${level}: unrepeatable ${kind} physics geometry`);
 else fingerprints.set(kind,geometry);
 for(const p of cells){
  check(ctx.mapCells[p.z]?.[p.x]===0,`L${level}: solid map wall buries a ${kind} tread`);
  check(near(ctx.floorHeightAtCell(p.x,p.z),p.h,.00005),
   `L${level}: ${kind} visible tread lacks corresponding floor physics at ${p.x},${p.z}`);
 }
 if(!newFamilies.has(style))continue;
 const probe=decorationAt(kind,spec);
 check(ctx.worldSolidBodyCollision(probe.x,probe.z,.17,probe.feet,1.9),
  `L${level} q${quality}: visible ${kind} machine is a ghost obstacle`);
 decorationHits++;
 if(level%5===0)check(ctx.worldSolidBodyCollision(probe.x,probe.z,.14,6,1.8),
  `L${level} q${quality}: the ${kind} boss monument is not tall and physical`);
 for(const p of cells.filter(p=>p.h<1.32-.001)){
  const shot=ctx.rayWall({x:p.x+.5,y:p.h+.13,z:p.z+.5},
   {x:0,y:-1,z:0},.34);
  check(shot&&near(shot.y,p.h,.015),
   `L${level} q${quality}: bullet passed through ${kind} riser at ${p.x},${p.z}`);
  riserImpacts++;
 }
 const [start,end]=pathFor(kind,spec);
 check(near(ctx.floorHeight(start.x,start.z),0,.001),
  `L${level}: stair approach starts in the air`);
 check(near(ctx.floorHeight(end.x,end.z),1.32,.002),
  `L${level}: accessible upper route does not reach 1.32m`);
 for(const robot of [false,true]){
  const actor={id:62,...start,feetY:0,vy:0,grounded:true,
   ...(robot?{type:'scout',maxhp:100,radius:.48,orbit:1,airborne:false}:{})};
  ctx.game={p:robot?{x:ctx.spawnX,z:ctx.spawnZ,feetY:0}:actor,
   enemies:robot?[actor]:[],particles:[],t:0};
  const gap=moveTo(actor,end,robot);
  check(gap<.11&&near(actor.feetY,1.32,.06),
   `L${level} q${quality}: ${robot?'robot':'player'} cannot climb ${kind}; gap=${gap}; feet=${actor.feetY}`);
  check(!ctx.worldSolidBodyCollision(actor.x,actor.z,.23,actor.feetY,1.95),
   `L${level}: untraversable decorative block at upper ${kind} path`);
  ascents++;
 }
}
check(fingerprints.size===10,'expected all ten individually planned physical families');
check(new Set(fingerprints.values()).size===10,'two different themes have identical architectural geometry');
check(scenes===200&&ascents>50&&riserImpacts>1000&&decorationHits>20,
 'missing campaign coverage of six new map families');
console.log(`Stage62: ${checks} assertions PASSED: ${scenes} world variants, ${fingerprints.size} distinct tangible silhouettes, ${riserImpacts} ballistic stair contacts, ${ascents} real player/robot ascents, ${decorationHits} solid themed machines`);
