'use strict';
// Stage60: the FULL procedural world, not merely the most recently introduced
// structures. For every level and either visual quality, audit every rendered
// box and registered volume, then fire sampled hitscan and spherical projectiles
// from INSIDE world solids. A tunnel through any physical sample fails the build.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
let checks=0;
const check=(condition,description)=>{assert.ok(condition,description);checks++;};
const drawings=[];
const horizontalRoofFaces=new Map();
const ctx={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:2*Math.PI,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],
 legacyResumeSector:-1,legacyResumeDivisor:18,glReady:false,touchOnly:false,
 gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:(dst,...args)=>{drawings.push(args.slice(0,6));},
 quad:(dst,a,b,c,d)=>{
  if(Math.min(a[1],b[1],c[1],d[1])<3.5)return;
  if(Math.max(a[1],b[1],c[1],d[1])-Math.min(a[1],b[1],c[1],d[1])>1e-8)return;
  const x0=Math.min(a[0],b[0],c[0],d[0]),x1=Math.max(a[0],b[0],c[0],d[0]);
  const z0=Math.min(a[2],b[2],c[2],d[2]),z1=Math.max(a[2],b[2],c[2],d[2]);
  horizontalRoofFaces.set(`${x0}|${z0}|${x1}|${z1}`,a[1]);
 },rcolor:c=>c,save:{settings:{quality:0,audio:false}},
 sound:()=>{},burst:()=>{},input:{jumpQueued:false},arsenalOpened:false,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['БОСС'],robotPalette:()=>({}),toast:()=>{},game:null,
 navField:null,navClock:0};
vm.createContext(ctx);
for(const file of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js']){
 vm.runInContext(source(file),ctx,{filename:file});
}
const ev=expr=>vm.runInContext(expr,ctx);
check(/const GAME_BUILD='(60|61|62|63|64|65|66|67|68|69|70|71|72|73|74|75|76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),'stage60+ build identifier');
check(/const MP_VERSION=(13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(source('21b-multiplayer-lobby.js')),
 'geometry changes require a new multiplayer map protocol');
const key=b=>b.join('|');
const isPaint=b=>{
 const dy=Math.abs(b[4]-b[1]);
 return (Math.max(b[1],b[4])<=.15&&dy<.09)||dy<=.02;
};
const allLevels=100;
let drawnTotal=0,solidTotal=0,bulletChecks=0,rocketChecks=0;
let paintTotal=0,mostSolids=0;
const printLimit=10;
const sampleCount=120;
for(let level=1;level<=allLevels;level++)for(const quality of [0,2]){
 ctx.glReady=true;
 ctx.touchOnly=quality===0;
 ctx.save.settings.quality=quality;
 drawings.length=0;
 horizontalRoofFaces.clear();
 ctx.buildMap(level);
 const grid=ev('worldSolidGrid');
 const solids=[...new Set(grid.flatMap(s=>s||[]))];
 const registered=new Set(solids.map(s=>key(s.box)));
 const drawn=new Set(drawings.map(key));
 const prefix=`level=${level},q=${quality}`;
 check(ev('worldSolidCount')===solids.length,
  `${prefix}: static grid has duplicate/missing solid records`);
 check(solids.length>50,`${prefix}: missing world geometry`);
 for(const solid of solids){
  check(solid.box.length===6&&solid.box.every(Number.isFinite),
   `${prefix}: invalid physical solid`);
  const b=solid.box;
  const faceY=horizontalRoofFaces.get(`${b[0]}|${b[2]}|${b[3]}|${b[5]}`);
  const isVisibleRoof=solid.kind==='ceiling'&&faceY!==undefined&&
   Math.abs(faceY-(b[1]+b[4])*.5)<.015;
  check(drawn.has(key(b))||isVisibleRoof,
   `${prefix}: invisible collider (neither box nor roof face): ${solid.kind} ${b}`);
 }
 const undeclared=[];
 for(const b of drawings){
  check(b.length===6&&b.every(Number.isFinite),`${prefix}: invalid visual geometry`);
  if(registered.has(key(b)))continue;
  if(isPaint(b)){paintTotal++;continue;}
  undeclared.push(b);
  if(undeclared.length>=printLimit)break;
 }
 check(!undeclared.length,`${prefix}: ${undeclared.length} substantial visible boxes lack projectile physics: ${JSON.stringify(undeclared)}`);
 // Map walls/floors are rasterized as quads, not registered as extra AABBs.
 // They are tested by dedicated stage3/6 solid-wall and staircase regressions.
 // Deterministic strata cover first and last solids plus interior geometry,
 // without an excessive 200 x every-object raycast cost on mobile CI.
 const selected=new Set();
 for(let j=0;j<Math.min(sampleCount,solids.length);j++)
  selected.add(Math.floor((j+.5)*solids.length/Math.min(sampleCount,solids.length)));
 for(const i of selected){
  const s=solids[i],b=s.box;
  const p={x:(b[0]+b[3])/2,y:(b[1]+b[4])/2,z:(b[2]+b[5])/2};
  const direction={x:1,y:0,z:0};
  // Origin embedded in solid => impact distance MUST be zero, rather than
  // escaping through a visually solid object on its first simulation step.
  const bullet=ctx.rayWall(p,direction,.08);
  check(bullet&&bullet.t<=1e-7,
   `${prefix}: hitscan tunneled from inside registered ${b}`);
  const rocket=ctx.sweepWorldSphere(p,direction,.08,.025);
  check(rocket&&rocket.t<=1e-7,
   `${prefix}: volume projectile tunneled from inside registered ${b}`);
  bulletChecks++;rocketChecks++;
 }
 drawnTotal+=drawings.length;solidTotal+=solids.length;
 mostSolids=Math.max(mostSolids,solids.length);
}
check(drawnTotal>solidTotal,'unexpected absence of visible surface paint');
check(paintTotal>0,'all decorative paint is unexpectedly registered as solid');
check(bulletChecks===allLevels*2*sampleCount,'incomplete hitscan coverage');
check(rocketChecks===bulletChecks,'incomplete rocket coverage');
console.log(`Stage60: ${checks} checks passed for all ${allLevels} levels x 2 qualities: `+
 `${drawnTotal} rendered boxes, ${solidTotal} exact registered volumes, `+
 `${paintTotal} intentionally non-solid paint boxes, max ${mostSolids} solids/map; `+
 `${bulletChecks} hitscan + ${rocketChecks} swept-sphere physical impacts`);
