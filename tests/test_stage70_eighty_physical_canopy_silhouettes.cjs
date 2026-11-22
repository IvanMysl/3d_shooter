'use strict';
// Eighty ordinary maps must differ by ACTUAL elevated physical architecture.
// Rendered solids, bullets and robot/player headroom share one AABB contract.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
let checks=0;
const check=(ok,msg)=>{assert.ok(ok,msg);checks++;};
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
const ev=s=>vm.runInContext(s,ctx);
check(/const GAME_BUILD='(70|71|72|73|74|75|76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),'Stage70+ build stamp');
check(/const MP_VERSION=(23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(source('21b-multiplayer-lobby.js')),
 'changed solid 3D geometry requires a multiplayer protocol bump');
const shapes=new Set(),byKind=new Array(10).fill(0),qualityGeometry=new Map();
let generated=0,bossSamples=0,regularSamples=0,actualSolids=0,shots=0;
const key=b=>b.join('|');
for(let level=1;level<=100;level++)for(const quality of [0,2]){
 ctx.glReady=true;ctx.touchOnly=quality===0;ctx.save.settings.quality=quality;
 ctx.buildMap(level);generated++;
 const plan=ev('secondaryYard'),roof=ctx.ceilingHeight();
 const parts=ctx.secondaryCanopyBoxes(level,plan,roof);
 if(level%5===0){
  bossSamples++;
  check(parts.length===0,`L${level}: ordinary canopy intruded into boss flight arena`);
  continue;
 }
 regularSamples++;
 check(plan!==null&&parts.length>=7,`L${level}: missing substantial regular-level architecture`);
 check(plan.kind>=0&&plan.kind<10&&plan.variant>=0&&plan.variant<8,
  `L${level}: invalid architectural identity`);
 const signature=parts.map(p=>{
  const b=p.box,v0=ctx.tacticalRotate(b[0]-(plan.cx+.5),b[2]-(plan.cz+.5),
   (4-plan.orientation)%4),
   v1=ctx.tacticalRotate(b[3]-(plan.cx+.5),b[5]-(plan.cz+.5),
    (4-plan.orientation)%4);
  return `${p.role}:${[Math.min(v0.x,v1.x),Math.min(v0.z,v1.z),
   Math.max(v0.x,v1.x),Math.max(v0.z,v1.z)].map(v=>v.toFixed(2)).join(',')}`;
 }).sort().join('|');
 if(quality===0){
  byKind[plan.kind]++;
  check(!shapes.has(signature),`L${level}: physical silhouette repeated`);
  shapes.add(signature);
  qualityGeometry.set(level,JSON.stringify(parts.map(p=>p.box)));
 }else check(qualityGeometry.get(level)===JSON.stringify(parts.map(p=>p.box)),
   `L${level}: low and high visual quality produce different solid geometry`);
 const actual=new Set(ev('worldSolidGrid').flatMap(s=>s||[]).map(s=>key(s.box)));
 let present=0;
 for(const part of parts){
  const b=part.box;
  check(b.every(Number.isFinite)&&b[3]>b[0]&&b[4]>b[1]&&b[5]>b[2],
   `L${level}: invalid physical truss AABB`);
  check(b[1]>=3.59&&b[4]<roof-.25,
   `L${level}: canopy threatens roof clearance or protrudes through ceiling`);
  if(!actual.has(key(b)))continue; // renderer also dropped it for clearance
  present++;actualSolids++;
  // Under the BEAM, every covered ground and deck cell must retain at least
  // 2.25m of walking headroom, including on old raised stair landings.
  for(let z=Math.max(1,Math.floor(b[2]));z<=Math.min(ctx.mapSize-2,Math.floor(b[5]));z++)
   for(let x=Math.max(1,Math.floor(b[0]));x<=Math.min(ctx.mapSize-2,Math.floor(b[3]));x++){
    if(ctx.mapCells[z][x]!==0)continue;
    const top=Math.max(ctx.floorHeightAtCell(x,z),ctx.deckAtCell(x,z));
    check(b[1]>=top+2.25-.001,
     `L${level}: truss covers an old walkable upper level at ${x},${z}`);
   }
 }
 check(present>=6,`L${level}: almost all canopy elements were clipped by old routes`);
 const representative=parts.filter(p=>actual.has(key(p.box))).slice(0,3);
 for(const p of representative){
  const b=p.box,mx=(b[0]+b[3])/2,mz=(b[2]+b[5])/2,my=(b[1]+b[4])/2;
  const hit=ctx.rayWall({x:mx,y:my,z:mz},{x:1,y:0,z:0},.05);
  check(hit&&hit.t<=1e-7,`L${level}: visible overhead beam ignores hitscan`);
  check(ctx.worldSolidBodyCollision(mx,mz,.12,b[1]-.05,.45),
   `L${level}: beam has no physical body`);
  shots++;
 }
}
check(generated===200&&bossSamples===40&&regularSamples===160&&
 shapes.size===80&&byKind.every(v=>v===8)&&actualSolids>=900&&shots===480,
 'missing any physical canopy family, level, quality or ballistic impact');
console.log(`Stage70: ${checks} checks PASS; 80 unique overhead 3D silhouettes in 10 families, ${actualSolids} real rendered truss volumes, ${shots} actual bullet impacts, and ${bossSamples} preserved boss worlds`);
