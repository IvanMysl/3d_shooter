'use strict';
// Every roof battlement must be drawn and registered as the EXACT same AABB.
// Bullets, swept projectiles and actors must be stopped by solid parapets,
// while their actual stair entrance and lowered firing slit remain open.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
let checks=0;
const check=(ok,msg)=>{assert.ok(ok,msg);checks++;};
const drawings=[];
const ctx={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],
 legacyResumeSector:-1,legacyResumeDivisor:18,glReady:false,touchOnly:false,
 gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:(dst,...args)=>{drawings.push(args.slice(0,6));},
 quad:()=>{},rcolor:c=>c,save:{settings:{quality:0,audio:false}},
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
check(/const GAME_BUILD='(58|59|60|61|62|63|64|65|66|67|68|69|70|71|72|73|74|75|76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),'V58 build');
check(/const MP_VERSION=(12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(source('21b-multiplayer-lobby.js')),'new 3D geometry version');
// Guard against later stages accidentally adding thick visual-only world
// obstacles via box() instead of worldSolidBox(). The only direct world boxes
// are five paint-thin trims in the mesh and four ground decals in mapgen.
check((source('05-world-mesh.js').match(/\bbox\(v,/g)||[]).length===5,
 'world mesh gained an unregistered visual-only 3D box');
check((source('04-map-generation.js').match(/\bbox\(v,/g)||[]).length===4,
 'map generator gained an unregistered visual-only 3D box');
const near=(a,b,eps=.0001)=>Math.abs(a-b)<eps;
const same=(a,b)=>a.length===b.length&&a.every((v,i)=>near(v,b[i]));
const registered=box=>{
 const solids=ev('worldSolidGrid');
 const x=Math.floor((box[0]+box[3])/2),z=Math.floor((box[2]+box[5])/2);
 for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)
  if((solids[(z+dz)*ctx.mapSize+x+dx]||[]).some(s=>same(s.box,box)))return true;
 return false;
};
const local=(s,u,v)=>{
 const a=s.axis==='x'?{x:s.cx+u,z:s.cz+v*s.wing+(s.wing<0?1:0)}:
  {x:s.cx+v*s.wing+(s.wing<0?1:0),z:s.cz+u};
 return a;
};
const horizontal=(s,du,dv)=>s.axis==='x'?{x:du,z:dv*s.wing}:
 {x:dv*s.wing,z:du};
const ray=(point,dir,dist)=>ctx.rayWall(point,dir,dist);
const shell=(point,dir,dist)=>ctx.sweepWorldSphere(point,dir,dist,.03);
const active=new Set([2,4,6,9]);
let battlements=0,unmodified=0,hardShots=0,openShots=0;
for(let level=1;level<=100;level++){
 const style=(level-1)%18;if(!active.has(style))continue;
 for(const quality of [0,2]){
  ctx.glReady=true;ctx.touchOnly=quality===0;ctx.save.settings.quality=quality;
  drawings.length=0;ctx.buildMap(level);
  for(const s of ev('midlevelSpecs')){
   const parts=ev(`midlevelRoofParapetBoxes(midlevelSpecs.find(p=>p.cx===${s.cx}&&p.cz===${s.cz}))`);
   if(s.roofStairCount!==13){check(parts.length===0,'tight roof mutated');unmodified++;continue;}
   battlements++;
   check(parts.length===7,`level${level},q${quality}: expected seven physical shields`);
   check(new Set(parts.map(x=>x.role)).size===7,'non-unique battlement roles');
   for(const part of parts){
    check(part.box.length===6&&part.box.every(Number.isFinite),
     `level${level},q${quality}: nonfinite parapet geometry`);
    check(drawings.some(box=>same(box,part.box)),
     `level${level},q${quality}: invisible barrier ${part.role}`);
    check(registered(part.box),
     `level${level},q${quality}: drawn ${part.role} doesn't stop bullets`);
    const b=part.box,x=(b[0]+b[3])/2,z=(b[2]+b[5])/2;
    check(ctx.worldSolidBodyCollision(x,z,.035,s.roofY+.08,.35),
     `level${level},q${quality}: character can pass ${part.role}`);
   }
   // The stair arrives from the v=5 side at u=-flank; do not put a wall
   // across the arrival or its entire 1m-wide roof opening.
   const u=-s.roofFlank,entry=local(s,u+.5,4.64),roof=local(s,u+.5,4.36);
   check(!ctx.worldSolidBodyCollision(roof.x,roof.z,.20,s.roofY,1.95),
    `level${level},q${quality}: roof landing blocked`);
   check(!ctx.worldSolidBodyCollision(entry.x,entry.z,.20,s.roofY,1.95),
    `level${level},q${quality}: emergency exit blocked`);
   const entranceDir=horizontal(s,0,-1),start=local(s,u+.5,5.25);
   const fromEntry={x:start.x,y:s.roofY+.42,z:start.z};
   check(!ray(fromEntry,{...entranceDir,y:0},.65),
    `level${level},q${quality}: roof entrance not open to rifle fire`);
   check(!shell(fromEntry,{...entranceDir,y:0},.65),
    `level${level},q${quality}: roof entrance not open to projectile`);
   // At front, side shields stop chest-height bullets; low centre opens
   // a real firing slit above the .38m parapet lip.
   for(const [name,uu,height,blocked] of [
    ['left',-.5,.60,true],['right',1.5,.60,true],
    ['centreLow',.5,.22,true],['centreHigh',.5,.60,false]]){
    const a=local(s,uu,2.55),d=horizontal(s,0,1),origin={x:a.x,z:a.z,y:s.roofY+height};
    const direction={x:d.x,z:d.z,y:0};
    const bullet=ray(origin,direction,.70),rocket=shell(origin,direction,.70);
    check(blocked?bullet?.kind==='structure':!bullet,
     `level${level},q${quality}: bullet ${name} incorrect`);
    check(blocked?rocket?.kind==='structure':!rocket,
     `level${level},q${quality}: rocket ${name} incorrect`);
    blocked?hardShots+=2:openShots+=2;
   }
  }
 }
}
check(battlements===92&&unmodified===4,
 `wrong roof population: new=${battlements},tight=${unmodified}`);
console.log(`Stage58: ${checks} battlement, 3D collision, bullet, rocket and open-route checks passed (${battlements} roofs × 7 shields; ${hardShots} blocked / ${openShots} open shot checks)`);
