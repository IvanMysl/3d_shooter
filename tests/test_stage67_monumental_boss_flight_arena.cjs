'use strict';
// Every boss has a distinct, truly physical 3D flying battleground; ordinary
// stages gain solid edge cover on their already-accessible raised walkways.
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
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js'])
 vm.runInContext(source(n),ctx,{filename:n});
const ev=s=>vm.runInContext(s,ctx);
check(/const GAME_BUILD='(67|68|69|70|71|72|73|74|75|76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),'V67+ build id');
check(/const MP_VERSION=(20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(source('21b-multiplayer-lobby.js')),
 'new world geometry must reject previous multiplayer peers');
const bossShapes=new Set(),versions=new Map(),bossByKind=new Array(5).fill(0);
let bossWorlds=0,regularWorlds=0,railWorlds=0,railShields=0,skyVolumes=0,playerAscents=0;
const neighbour=(plan,u)=>{
 const d=ctx.tacticalRotate(u,0,plan.orientation);
 return {x:plan.cx+d.x,z:plan.cz+d.z};
};
for(let level=1;level<=100;level++)for(const quality of [0,2]){
 ctx.glReady=true;ctx.touchOnly=quality===0;ctx.save.settings.quality=quality;
 ctx.buildMap(level);
 const boss=level%5===0,roof=ctx.ceilingHeight();
 const sky=ctx.bossSkylineBoxes(level,ctx.spawnX,ctx.spawnZ,roof);
 const plan=ev('tacticalRisePlan'),covers=ctx.tacticalRiseEdgeCover(plan,level);
 const blueprint=JSON.stringify([sky.map(s=>s.box),covers.map(s=>s.box)]);
 if(quality===0)versions.set(level,blueprint);
 else check(blueprint===versions.get(level),`L${level}: low and high qualities use different physical boxes`);
 if(boss){
  bossWorlds++;
  const kind=(level/5-1)%5;bossByKind[kind]++;
  check(roof>=17.5,`L${level}: boss arena is not majestic`);
  check(sky.length>=8,`L${level}: a miniature crown is not a boss arena`);
  check(!ctx.worldSolidBodyCollision(ctx.spawnX,ctx.spawnZ,.23,0,1.95),
   `L${level}: new boss structure crushes the spawn`);
  const signature=sky.map(s=>[
   s.role,...s.box.map((v,i)=>Math.round((i===0||i===3?v-ctx.spawnX:
    i===2||i===5?v-ctx.spawnZ:v)*100)/100)
  ].join(',')).sort().join('|');
  if(quality===0){
   check(!bossShapes.has(signature),`L${level}: boss shares an old repeated sky crown`);
   bossShapes.add(signature);
  }
  for(const part of sky){
   const b=part.box;
   check(b[1]>=10.9&&b[4]<roof-.3&&b[4]>b[1]&&
     b[3]>b[0]&&b[5]>b[2],`L${level}: unbounded/ground-blocking high boss beam`);
   skyVolumes++;
  }
  for(const p of sky.slice(0,Math.min(6,sky.length))){
   const b=p.box,x=(b[0]+b[3])/2,z=(b[2]+b[5])/2,y=(b[1]+b[4])/2;
   check(ctx.worldSolidBodyCollision(x,z,.13,b[1]-.06,.65),
    `L${level}: boss high architecture is ghost-only ${p.role}`);
   const hit=ctx.rayWall({x,y,z},{x:1,y:0,z:0},.06);
   check(hit&&hit.t<=.000001,`L${level}: boss high beam fails a bullet impact`);
  }
 }else{
  regularWorlds++;
  check(roof<=12,`L${level}: ordinary stage has an oversized ceiling`);
  check(sky.length===0,`L${level}: boss ceiling accidentally appeared on a regular map`);
 }
 if(!plan){
  check(covers.length===0,`L${level}: guard rails appeared inside a crowded balcony sector`);
 }else{
  railWorlds++;
  check(covers.length>=3,`L${level}: lookout contains no substantial physical cover`);
  const walkable=new Map(ctx.tacticalRiseCells(plan).map(t=>[t.z*ctx.mapSize+t.x,t]));
  for(const part of covers){
   const floor=walkable.get(part.z*ctx.mapSize+part.x);
   check(floor&&floor.u>=7&&Math.abs(floor.h-1.32)<.001,
    `L${level}: physical cover was built across a stair or unrelated ground`);
   const b=part.box;
   check(Math.abs(b[1]-(floor.h+.13))<.001&&
     Math.abs(b[4]-(floor.h+.75))<.001,
    `L${level}: guard rail is floating/invisible`);
   check(ctx.enemyNavTile(part.x,part.z),
    `L${level}: robot cannot stand on the physical upper route`);
   railShields++;
  }
  for(const part of covers.slice(0,Math.min(4,covers.length))){
   const b=part.box,x=(b[0]+b[3])/2,z=(b[2]+b[5])/2;
   check(ctx.worldSolidBodyCollision(x,z,.12,b[1]-.05,.70),
    `L${level}: cover is rendered but not physically solid`);
  }
  for(let u=1;u<=13;u++){
   const a=neighbour(plan,u-1),b=neighbour(plan,u);
   check(ctx.enemyNavEdge(a.x,a.z,b.x,b.z),
    `L${level}: defensive rails obstruct the original climb at segment ${u}`);
  }
  playerAscents++;
 }
}
check(bossWorlds===40&&regularWorlds===160&&bossShapes.size===20&&
 railWorlds===152&&playerAscents===152&&skyVolumes>=450&&railShields>=250&&
 bossByKind.every(v=>v===8),'missing boss families, climb routes or both qualities');
console.log(`Stage67: ${checks} checks PASS; ${bossWorlds} boss worlds / 20 genuinely distinct physical crowns, ${regularWorlds} compact arenas, ${skyVolumes} physical high beams, ${railWorlds} safely traversable raised routes and ${railShields} true bulletproof edge covers`);
