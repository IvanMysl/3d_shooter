'use strict';
// V64: four architecturally different roof facades, all real world solids.
// Existing upper walkways, 5/7-step terraces and 13-step escapes are retained.
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
const ev=s=>vm.runInContext(s,ctx),near=(a,b,e=.025)=>Math.abs(a-b)<=e;
check(/const GAME_BUILD='(64|65|66|67|68|69|70|71|72|73|74|75|76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),'V64+ build stamp');
check(/const MP_VERSION=(17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(source('21b-multiplayer-lobby.js')),
 'network peers must reject different collision geometries');
const styles=new Map([[2,['bastionTower','bastionCrown']],
 [4,['theatreColumn','theatreLintel']],[6,['districtHighrise','districtMidrise']],
 [9,['gorgeWestFin','gorgeEastFin']]]);
let samples=0,sculptures=0,rayContacts=0,existingTerraces=0,majestic=0;
const mapSignatures=new Set();
for(let level=1;level<=100;level++)for(const quality of [0,2]){
 ctx.glReady=true;ctx.touchOnly=quality===0;ctx.save.settings.quality=quality;
 ctx.buildMap(level);samples++;
 const style=(level-1)%18,terraces=ev('midlevelSpecs');
 const sig=ctx.mapCells.map(row=>row.join('')).join('')+'|'+style;
 if(quality===0){check(!mapSignatures.has(sig),`L${level}: repeated complete wall plan`);mapSignatures.add(sig);}
 if(!styles.has(style)){
  check(terraces.length===0,`L${level}: extra guardhouse in unrelated family`);
  continue;
 }
 check(terraces.length===2,`L${level}: one of the old terraces is missing`);
 check(ev('balconySpecs.length')>=4,`L${level}: high original balconies missing`);
 check(ev('gallerySpecs.length')>0,`L${level}: physical suspended galleries missing`);
 existingTerraces+=terraces.length;
 for(const terrace of terraces){
  const boxes=ctx.balconyArchitecturalBoxes(terrace,style,level);
  check(boxes.length>=3,`L${level}: missing themed facade`);
  for(const role of styles.get(style))
   check(boxes.some(p=>p.role===role),`L${level}: missing physical ${role}`);
  for(const part of boxes){
   const [x0,y0,z0,x1,y1,z1]=part.box;
   check(x0<x1&&y0<y1&&z0<z1&&y0>=terrace.roofY-.01&&
    y1<ctx.ceilingHeight(),`L${level}: invalid above-roof sculpture ${part.role}`);
   const x=(x0+x1)/2,z=(z0+z1)/2,y=(y0+y1)/2;
   check(ctx.worldSolidBodyCollision(x,z,.04,y-.06,.12),
    `L${level}: ${part.role} is merely painted, no body collision`);
   const shot=ctx.rayWall({x:x0-.17,z,y},{x:1,y:0,z:0},.45);
   check(shot&&shot.x>=x0-.25&&shot.x<=x1+.02,
    `L${level}: ${part.role} does not stop horizontal bullets`);
   sculptures++;rayContacts++;
   if(level%5===0&&y1>10)majestic++;
  }
 }
}
check(samples===200&&mapSignatures.size===100,
 'all 100 campaigns must have individual structural wall plans');
check(existingTerraces>=90&&sculptures>=300&&rayContacts===sculptures&&majestic>=10,
 'incomplete physical / boss architecture coverage');
console.log(`Stage64: ${checks} checks PASS; ${samples} map builds, ${mapSignatures.size} unique ground plans, ${existingTerraces} preserved terraces, ${sculptures} physically solid sculptural volumes, ${rayContacts} ballistic contacts, ${majestic} high boss shapes`);
