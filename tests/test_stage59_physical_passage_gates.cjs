'use strict';
// Stage59: each elevated guard-post gate must be a physical arch, not a
// painted obstruction. We check every seed / both quality tiers, then walk
// actual player and robot bodies through its central gap.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
let checks=0;
const check=(v,msg)=>{assert.ok(v,msg);checks++;};
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
for(const name of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js'])vm.runInContext(source(name),ctx);
const ev=x=>vm.runInContext(x,ctx);
check(/const GAME_BUILD='(59|60|61|62|63|64|65|66|67|68|69|70|71|72|73|74|75|76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),'V59+ version');
check(/const MP_VERSION=(13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(source('21b-multiplayer-lobby.js')),
 'new physical gate geometry must reject old network peers');
const near=(a,b,t=.0001)=>Math.abs(a-b)<t;
const same=(a,b)=>a.length===b.length&&a.every((v,i)=>near(v,b[i]));
const registered=b=>{
 const grid=ev('worldSolidGrid');
 const x=Math.floor((b[0]+b[3])*.5),z=Math.floor((b[2]+b[5])*.5);
 for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)
  if((grid[(z+dz)*ctx.mapSize+x+dx]||[]).some(s=>same(s.box,b)))return true;
 return false;
};
const local=(s,u,v)=>s.axis==='x'?
 {x:s.cx+u,z:s.cz+v*s.wing+(s.wing<0?1:0)}:
 {x:s.cx+v*s.wing+(s.wing<0?1:0),z:s.cz+u};
const dir=(s,du,dv)=>s.axis==='x'?{x:du,z:dv*s.wing,y:0}:
 {x:dv*s.wing,z:du,y:0};
function walk(a,target,robot){
 for(let n=0;n<160;n++){
  const l=Math.hypot(target.x-a.x,target.z-a.z);
  if(l<.027)break;
  const d=Math.min(.045,l),dx=(target.x-a.x)/l*d,dz=(target.z-a.z)/l*d;
  if(robot)ctx.enemyMove(a,dx,dz,.22);
  else{ctx.moveEntity(a,dx,dz,.23);ctx.updateVertical(a,1/60);}
 }
 return Math.hypot(a.x-target.x,a.z-target.z);
}
const active=new Set([2,4,6,9]);
let gates=0,blocked=0,open=0,passages=0;
for(let level=1;level<=100;level++){
 const style=(level-1)%18;if(!active.has(style))continue;
 for(const quality of [0,2]){
  ctx.glReady=true;ctx.touchOnly=quality===0;ctx.save.settings.quality=quality;
  drawn.length=0;ctx.buildMap(level);
  for(const spec of ev('midlevelSpecs')){
   const gate=ev(`midlevelGuardGateBoxes(midlevelSpecs.find(s=>s.cx===${spec.cx}&&s.cz===${spec.cz}))`);
   gates++;
   check(gate.length===3,`level${level},q${quality}: gate needs two posts and one lintel`);
   check(new Set(gate.map(p=>p.role)).size===3,'duplicate gate role');
   for(const part of gate){
    check(part.box.every(Number.isFinite),'invalid arch AABB');
    check(drawn.some(box=>same(box,part.box)),
     `level${level},q${quality}: invisible physical gate part ${part.role}`);
    check(registered(part.box),
     `level${level},q${quality}: visible gate part lets shots pass ${part.role}`);
    const b=part.box,x=(b[0]+b[3])/2,z=(b[2]+b[5])/2;
    check(ctx.worldSolidBodyCollision(x,z,.035,b[1]+.01,Math.max(.12,b[4]-b[1]-.02)),
     `level${level},q${quality}: body passes physical gate part ${part.role}`);
   }
   const at=local(spec,.5,2.5);
   check(!ctx.worldSolidBodyCollision(at.x,at.z,.23,spec.y,1.95),
    `level${level},q${quality}: arch traps standing player`);
   ctx.game={p:{x:ctx.spawnX,z:ctx.spawnZ,feetY:0},enemies:[],particles:[],t:0};
   check(ctx.enemySpawnSpaceClear(at.x,at.z,.48,1.9,spec.y),
    `level${level},q${quality}: bot cannot fit through open gateway`);
   const beam=ctx.worldSolidHeadBarrier(at.x,at.z,.2,spec.y+1.97,spec.y+2.52);
   check(near(beam,spec.y+2.34,.02),
    `level${level},q${quality}: jumping body flies through visible lintel`);
   const D=dir(spec,0,1),origin=local(spec,.5,2.04);
   for(const [name,uu,alt,shouldHit] of [
     ['open',.5,1.35,false],['lintel',.5,2.44,true],
     ['leftPier',-.88,1.25,true],['rightPier',1.88,1.25,true]]){
    const p=local(spec,uu,2.04),o={x:p.x,z:p.z,y:spec.y+alt};
    const bullet=ctx.rayWall(o,D,.72),rocket=ctx.sweepWorldSphere(o,D,.72,.025);
    check(shouldHit?bullet?.kind==='structure':!bullet,
     `level${level},q${quality}: bullet ${name} misses physical gate`);
    check(shouldHit?rocket?.kind==='structure':!rocket,
     `level${level},q${quality}: rocket ${name} misses physical gate`);
    shouldHit?blocked+=2:open+=2;
   }
   // The only permitted through-route is actually walkable, not just a
   // clear hitscan ray. It must connect terrace to the old guardhouse door.
   const first=local(spec,.5,1.48),dest=local(spec,.5,3.48);
   const player={...first,feetY:spec.y,grounded:true,vy:0};
   ctx.game={p:player,enemies:[],particles:[],t:0};
   check(walk(player,dest,false)<.10&&near(player.feetY,spec.y,.04),
    `level${level},q${quality}: player cannot walk under gate`);
   const robot={id:59,...first,feetY:spec.y,type:'scout',maxhp:100,
    radius:.48,orbit:1,airborne:false};
   // Isolate gate passage: the preceding player is standing at the destination
   // and would correctly block the robot in Stage113+.
   ctx.game={p:{x:ctx.spawnX,z:ctx.spawnZ,feetY:0},enemies:[robot],particles:[],t:0};
   check(walk(robot,dest,true)<.10&&near(robot.feetY,spec.y,.04),
    `level${level},q${quality}: bot cannot walk under gate`);
   passages+=2;
  }
 }
}
check(gates===96,`expected two gates in 24 sectors × two WebGL tiers, got ${gates}`);
console.log(`Stage59: ${checks} real arch geometry, hitscan, rocket, head collision and walk-through checks passed (${gates} gates; ${blocked} blocked shots, ${open} open shots, ${passages} physical passages)`);
