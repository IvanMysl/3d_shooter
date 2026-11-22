'use strict';
// V61: four first-wave replacement architectures, true climbable 3D terrain,
// boss-only monumental height, no ghost walls, same visual/physics volumes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
let checks=0;const check=(condition,message)=>{assert.ok(condition,message);checks++;};
const drawn=[];
const ctx={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],
 legacyResumeSector:-1,legacyResumeDivisor:18,glReady:false,touchOnly:false,
 gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:(dst,...args)=>{drawn.push(args.slice(0,6));},
 quad:()=>{},rcolor:c=>c,save:{settings:{quality:0,audio:false}},
 sound:()=>{},burst:()=>{},input:{jumpQueued:false},arsenalOpened:false,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['БОСС'],robotPalette:()=>({}),toast:()=>{},game:null,
 navField:null,navClock:0};
vm.createContext(ctx);
for(const file of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js'])
 vm.runInContext(source(file),ctx,{filename:file});
const ev=expr=>vm.runInContext(expr,ctx);
const near=(a,b,t=.001)=>Math.abs(a-b)<=t;
check(/const GAME_BUILD='(61|62|63|64|65|66|67|68|69|70|71|72|73|74|75|76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),'V61+ build id');
check(/const MP_VERSION=(14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(source('21b-multiplayer-lobby.js')),
 'new terrain must reject old multiplayer map protocol');
const kinds=new Map([[0,'citadel'],[1,'reactor'],[3,'docks'],[5,'shipyard']]);
const shapeByKind=new Map();
let visited=0,risers=0,walks=0,bosses=0;
function walk(actor,target,robot){
 for(let i=0;i<650;i++){
  const len=Math.hypot(target.x-actor.x,target.z-actor.z);
  if(len<.03)break;
  const dx=(target.x-actor.x)/len*Math.min(.04,len);
  const dz=(target.z-actor.z)/len*Math.min(.04,len);
  if(robot)ctx.enemyMove(actor,dx,dz,.23);
  else{ctx.moveEntity(actor,dx,dz,.23);ctx.updateVertical(actor,1/60);}
 }
 return Math.hypot(target.x-actor.x,target.z-actor.z);
}
for(let level=1;level<=100;level++)for(const quality of [0,2]){
 ctx.glReady=true;ctx.touchOnly=quality===0;ctx.save.settings.quality=quality;
 drawn.length=0;ctx.buildMap(level);visited++;
 const style=(level-1)%18,kind=kinds.get(style),isBoss=level%5===0;
 check(ev('worldMapBoss')===isBoss,`L${level} q${quality}: boss flag drift`);
 if(isBoss){
  bosses++;
  check(ctx.ceilingHeight()>=17.5,`L${level}: boss skyline too low`);
  check(!ctx.worldSolidBodyCollision(ctx.spawnX,ctx.spawnZ,.23,0,1.95),
   `L${level}: boss monument blocks the arena spawn`);
  for(const dx of [-14.3,14.3])for(const dz of [-14.3,14.3]){
   const x=ctx.spawnX+dx,z=ctx.spawnZ+dz;
   check(ctx.worldSolidBodyCollision(x,z,.17,0,1.95),
    `L${level}: boss pier is not a solid`);
   const hit=ctx.rayWall({x,y:ctx.ceilingHeight()-1.0,z},
    {x:1,y:0,z:0},.08);
   check(hit?.t<=1e-7,`L${level}: boss steel pier is not bullet proof`);
  }
 }else check(ctx.ceilingHeight()<=12,`L${level}: regular floor too tall`);
 const specs=ev('landmarkSpecs');
 // V62 intentionally adds six *new* families; this older test still owns
 // its original four without claiming that the newer six are absent.
 if(!kind){if(![7,8,10,11,12,13,14,15,16,17].includes(style))
  check(specs.length===0,`L${level}: unwanted copied landmark`);continue;}
 check(specs.length===1&&specs[0].kind===kind,`L${level}: missing ${kind} architecture`);
 const spec=specs[0],cells=ev('landmarkCells(landmarkSpecs[0])');
 check(cells.length>65,`L${level}: collapsed 3D landmark`);
 const fingerprint=cells.filter(p=>near(p.h,1.32)).map(p=>
  `${p.x-spec.cx},${p.z-spec.cz}`).sort().join(';');
 const previous=shapeByKind.get(kind);
 if(previous)check(fingerprint===previous,`${kind}: nondeterministic geometry`);
 else shapeByKind.set(kind,fingerprint);
 for(const p of cells){
  check(near(ctx.floorHeightAtCell(p.x,p.z),p.h,.00005),
   `L${level} q${quality}: actual step not physically raised at ${p.x},${p.z}`);
  if(!near(p.h,1.32)){
   const ray=ctx.rayWall({x:p.x+.5,y:p.h+.14,z:p.z+.5},
    {x:0,y:-1,z:0},.35);
   check(ray&&near(ray.y,p.h,.012),
    `L${level} q${quality}: projectile passes through a real stair ${p.x},${p.z}`);
   risers++;
  }
 }
 const edge=kind==='citadel'?5:kind==='docks'?5:6;
 const start=kind==='docks'?{x:spec.cx+.5,z:spec.cz-edge-7+.5}:
  {x:spec.cx+edge+7+.5,z:spec.cz+.5};
 const dest=kind==='docks'?{x:spec.cx+.5,z:spec.cz-edge+1+.5}:
  {x:spec.cx+edge-1+.5,z:spec.cz+.5};
 for(const robot of [false,true]){
  const actor={id:61,...start,feetY:0,grounded:true,vy:0,
   ...(robot?{type:'scout',maxhp:100,radius:.48,orbit:1,airborne:false}:{})};
  ctx.game={p:robot?{x:ctx.spawnX,z:ctx.spawnZ,feetY:0}:actor,
   enemies:robot?[actor]:[],particles:[],t:0};
  const gap=walk(actor,dest,robot);
  check(gap<.12&&near(actor.feetY,1.32,.05),
   `L${level} q${quality}: ${robot?'robot':'player'} cannot climb ${kind}, gap=${gap}, feet=${actor.feetY}`);
  walks++;
 }
}
check(shapeByKind.size===4,'did not visit four landmark families');
check(new Set(shapeByKind.values()).size===4,
 'landmarks have different labels but exactly the same geometry');
check(visited===200&&bosses===40,'100 levels x 2 qualities or boss count wrong');
console.log(`Stage61: ${checks} checks passed: ${visited} worlds, ${shapeByKind.size} unique climbable landmarks, ${risers} stair impacts, ${walks} real human/robot ascents, ${bosses} majestic boss scenes`);
