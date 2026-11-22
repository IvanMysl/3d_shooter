'use strict';
// Stage56: continuous physical fire escapes rise around each guardhouse to
// the existing real roof. No fake passable walls or invisible step proxies.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
let checks=0;
const check=(ok,msg)=>{assert.ok(ok,msg);checks++;};
const treads=[],drawn=[];
const ctx={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],
 legacyResumeSector:-1,legacyResumeDivisor:18,glReady:false,touchOnly:false,
 gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:(dst,...args)=>{drawn.push(args.slice(0,6));},
 quad:(dst,a,b,c,d,n)=>{if(n[1]>.9&&a[1]>.01)treads.push([a,b,c,d]);},
 rcolor:c=>c,save:{settings:{quality:0,audio:false}},
 sound:()=>{},burst:()=>{},input:{jumpQueued:false},arsenalOpened:false,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['БОСС'],robotPalette:()=>({}),toast:()=>{},game:null,
 navField:null,navClock:0};
vm.createContext(ctx);
for(const file of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js'])vm.runInContext(source(file),ctx);
const ev=s=>vm.runInContext(s,ctx);
const close=(a,b,e=.04)=>Math.abs(a-b)<e;
const active=new Set([2,4,6,9]);
const xy=(s,u,v)=>s.axis==='x'?
 {x:s.cx+u+.5,z:s.cz+s.wing*v+.5}:
 {x:s.cx+s.wing*v+.5,z:s.cz+u+.5};
const roofInterior=s=>xy(s,-s.roofFlank,4);
const startCell=s=>xy(s,s.roofFlank*3,2);
function walk(actor,target,robot=false){
 for(let step=0;step<160;step++){
  const len=Math.hypot(target.x-actor.x,target.z-actor.z);
  if(len<.025)break;
  const move=Math.min(len,.047),dx=(target.x-actor.x)/len*move,
   dz=(target.z-actor.z)/len*move;
  if(robot)ctx.enemyMove(actor,dx,dz,.22);
  else {ctx.moveEntity(actor,dx,dz,.23);ctx.updateVertical(actor,1/60);}
 }
 if(!robot)for(let i=0;i<5;i++)ctx.updateVertical(actor,1/60);
 return Math.hypot(actor.x-target.x,actor.z-target.z);
}
check(/const GAME_BUILD='(56|57|58|59|60|61|62|63|64|65|66|67|68|69|70|71|72|73|74|75|76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),'V56 release');
check(/const MP_VERSION=(10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(source('21b-multiplayer-lobby.js')),
 'changed roof access must reject old peer geometry');

let roofed=0,unroofed=0,activeLevels=0;
for(let level=1;level<=100;level++){
 ctx.glReady=false;ctx.buildMap(level);
 const specs=ev('midlevelSpecs'),wanted=active.has((level-1)%18)?2:0;
 check(specs.length===wanted,`level${level}: changed maps have missing terraces`);
 if(!wanted)continue;
 activeLevels++;
 for(const spec of specs){
  const stairs=ev(`midlevelRoofStairCells(${JSON.stringify(spec)})`),
   roof=ev(`midlevelRoofDeckCells(${JSON.stringify(spec)})`);
  check(spec.roofStairCount===stairs.length,`level${level}: stair count drift`);
  check(close(spec.roofY,spec.y+2.84,.002),`level${level}: real roof altitude`);
  check(roof.length===6,`level${level}: incomplete roof deck support`);
  for(const p of roof){
   check(ctx.mapCells[p.z]?.[p.x]===0,`level${level}: roof above solid map wall`);
   check(close(ctx.deckHeight(p.x+.5,p.z+.5),spec.roofY,.002),
    `level${level}: unsupported roof navigation tile`);
   check(close(ctx.floorHeight(p.x+.5,p.z+.5),spec.y,.002),
    `level${level}: house floor disappeared under roof`);
  }
  if(!stairs.length){
   unroofed++;
   check(spec.roofFlank===0,`level${level}: an omitted route isn't marked`);
   continue;
  }
  roofed++;
  check(stairs.length===13,`level${level}: expected 13 real roof treads`);
  check(spec.roofFlank===1||spec.roofFlank===-1,
   `level${level}: staircase mirror orientation absent`);
  let before=spec.y,prev=startCell(spec);
  check(close(ctx.floorHeight(prev.x,prev.z),spec.y),
   `level${level}: fire escape begins off the original terrace`);
  for(const p of stairs){
   check(ctx.mapCells[p.z]?.[p.x]===0,
    `level${level}: stair is buried in existing procedural wall`);
   check(close(ctx.floorHeight(p.x+.5,p.z+.5),p.h,.002),
    `level${level}: drawn riser doesn't have physical height`);
   check(ctx.deckHeight(p.x+.5,p.z+.5)<.01,
    `level${level}: stair collides with a higher suspended gallery`);
   check(close(p.h-before,.22,.002),
    `level${level}: staircase has unwalkable rise ${p.index}`);
   check(Math.hypot(p.x+.5-prev.x,p.z+.5-prev.z)===1,
    `level${level}: broken staircase topological edge`);
   before=p.h;prev={x:p.x+.5,z:p.z+.5};
  }
  check(close(stairs.at(-1).h-spec.roofY,.02,.002),
   `level${level}: final stair doesn't actually join the roof`);
  const landing=roofInterior(spec);
  check(Math.hypot(landing.x-prev.x,landing.z-prev.z)===1,
   `level${level}: stair top isn't adjacent to physical roof`);
 }
}
check(roofed>15,`only ${roofed} accessible guardhouse roofs across 100 maps`);
check(unroofed<10,`too many (${unroofed}) unsafe/missing roof routes`);

// The actual WebGL mesh is inspected at both quality settings for every
// raised map seed. All 13 risers are verified in the visible mesh, and shots
// hit their real height surfaces before reaching the higher tile.
let ascents=0;
for(let level=1;level<=100;level++){
 if(!active.has((level-1)%18))continue;
 for(const quality of [0,2]){
  ctx.glReady=true;ctx.touchOnly=quality===0;ctx.save.settings.quality=quality;
  treads.length=0;drawn.length=0;ctx.buildMap(level);
  for(const spec of ev('midlevelSpecs')){
   const stairs=ev(`midlevelRoofStairCells(${JSON.stringify(spec)})`);
   if(!stairs.length)continue;
   const roof=ev(`midlevelShelterBoxes(${JSON.stringify(spec)})`).find(p=>p.role==='roof').box;
   check(drawn.some(b=>b.every((n,i)=>close(n,roof[i],.0001))),
    `level${level}, q${quality}: roof collision has no visible shape`);
   const p0=startCell(spec),actor={...p0,feetY:spec.y,grounded:true,vy:0};
   ctx.game={p:actor,enemies:[],particles:[],t:0};
   let prev={...p0},prevHeight=spec.y;
   for(const tile of stairs){
    check(treads.some(q=>q.every(v=>close(v[1],tile.h,.002))&&
      q.some(v=>close(v[0],tile.x,.001)&&close(v[2],tile.z+1,.001))),
     `level${level}, q${quality}: stair tread ${tile.index} is invisible`);
    const target={x:tile.x+.5,z:tile.z+.5},len=Math.hypot(target.x-prev.x,target.z-prev.z);
    const direction={x:(target.x-prev.x)/len,y:0,z:(target.z-prev.z)/len};
    const origin={...prev,y:prevHeight+.07};
    const hit=ctx.rayWall(origin,direction,len);
    check(hit?.kind==='stairs'&&hit.t<len,
     `level${level}, q${quality}: roof stair riser ${tile.index} blocked by ${hit?.kind||'no hit'} at ${hit?.t}; origin=${JSON.stringify(origin)}, target=${JSON.stringify(target)}, spec=${JSON.stringify({cx:spec.cx,cz:spec.cz,axis:spec.axis,wing:spec.wing})}`);
    const blast=ctx.sweepWorldSphere(origin,direction,len,.03);
    check(blast?.kind==='stairs'&&blast.t<len,
     `level${level}, q${quality}: rocket penetrates roof stair riser ${tile.index}`);
    check(walk(actor,target)<.10&&close(actor.feetY,tile.h,.04),
     `level${level}, q${quality}: human cannot climb rooftop step ${tile.index}`);
    prev=target;prevHeight=tile.h;
   }
   const target=roofInterior(spec);
   check(walk(actor,target)<.12&&close(actor.feetY,spec.roofY,.06),
    `level${level}, q${quality}: stairs cannot reach real walkable roof`);
   check(close(ctx.supportHeight(actor,actor.x,actor.z),spec.roofY,.04),
    `level${level}, q${quality}: roof doesn't support standing player`);
   check(!ctx.worldSolidBodyCollision(actor.x,actor.z,.23,actor.feetY,1.95),
    `level${level}, q${quality}: invisible obstacle on landing`);
   ctx.game={p:{x:ctx.spawnX,z:ctx.spawnZ,feetY:0},enemies:[],particles:[],t:0};
   check(ctx.enemySpawnSpaceClear(target.x,target.z,.48,1.9,spec.roofY),
    `level${level}, q${quality}: safe robot cannot spawn on actual roof`);
   const upward=ctx.rayWall({x:target.x,y:spec.y+2.20,z:target.z},
    {x:0,y:1,z:0},1.2);
   check(upward?.kind==='structure'||upward?.kind==='bridge',
    `level${level}, q${quality}: shot passes through walkable roof`);
   ascents++;
  }
  const roofs=ev('midlevelSpecs').filter(s=>s.roofStairCount===13);
  const spawned=ctx.randRoofSpawn(0,.48,1.9);
  check(roofs.length===0?!spawned:
   spawned&&roofs.some(s=>close(spawned.feetY,s.roofY,.02))&&
   close(ctx.deckHeight(spawned.x,spawned.z),spawned.feetY,.02),
   `level${level}, q${quality}: rooftop-spawn selection is unsafe`);
 }
}

// Robot physics route: the small scout can physically follow each riser and
// stand on the roof without falling through or walking through an obstruction.
for(const style of [2,4,6,9]){
 const level=style===4?23:style+1;
 for(const quality of [0,2]){
  ctx.glReady=true;ctx.touchOnly=quality===0;ctx.save.settings.quality=quality;
  ctx.buildMap(level);
  for(const spec of ev('midlevelSpecs')){
   const stairs=ev(`midlevelRoofStairCells(${JSON.stringify(spec)})`);
   if(!stairs.length)continue;
   const initial=startCell(spec),robot={id:17,x:initial.x,z:initial.z,
    feetY:spec.y,type:'scout',maxhp:100,radius:.48,orbit:1,airborne:false};
   ctx.game={p:{x:ctx.spawnX,z:ctx.spawnZ,feetY:0},enemies:[robot],particles:[],t:0};
   for(const tile of stairs){
    check(walk(robot,{x:tile.x+.5,z:tile.z+.5},true)<.10&&
      close(robot.feetY,tile.h,.06),
     `style${style}, q${quality}: robot cannot climb fire escape tread ${tile.index}`);
   }
   check(walk(robot,roofInterior(spec),true)<.13&&
    close(robot.feetY,spec.roofY,.06),
    `style${style}, q${quality}: robot falls through rooftop`);
  }
 }
}
console.log(`Stage56: ${checks} checks passed; ${roofed} real roof routes, ${unroofed} preserved tight sites, ${ascents} physical ascents`);
