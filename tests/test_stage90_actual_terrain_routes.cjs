'use strict';
// Physical terrain regressions on PROCEDURALLY GENERATED maps: validate that
// a non-balcony Canvas robot cannot cut diagonally through a >24.5cm riser.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
const c={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),distance:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),
 mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],legacyResumeSector:-1,legacyResumeDivisor:18,
 glReady:false,touchOnly:false,gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:v=>v,
 save:{settings:{quality:0,audio:false},credits:0},sound:()=>{},burst:()=>{},saveRun:()=>{},
 input:{jumpQueued:false},arsenalOpened:false,navField:null,navClock:0,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['БОСС'],robotPalette:()=>{},toast:()=>{},game:null};
vm.createContext(c);
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js','04-map-generation.js',
 '05-world-mesh.js','13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js',
 '14-combat-raycast.js','15-mission-system.js','16-mission-devices.js'])
 vm.runInContext(src(n),c,{filename:n});
let checks=0,cliffs=0,scenes=0;
for(const level of [1,2,3,4,5,8,14,41]){
 c.game=null;c.glReady=false;c.buildMap(level);
 c.game={t:1,nodesDestroyed:0,nodes:[],devices:[],mission:{type:'purge',caches:[]},enemies:[]};
 const N=c.mapSize;let here=0;
 for(let z=2;z<N-2&&here<15;z++)for(let x=2;x<N-2&&here<15;x++){
  if(c.mapCells[z]?.[x]!==0)continue;
  const a=c.floorHeightAtCell(x,z);
  for(const [dx,dz] of [[1,1],[1,-1],[-1,1],[-1,-1]]){
   const X=x+dx,Z=z+dz;
   if(c.mapCells[Z]?.[X]!==0||Math.abs(c.floorHeightAtCell(X,Z)-a)<=.30)continue;
   const e={id:1,x:x+.5,z:z+.5,feetY:a,radius:.48,type:'scout'},
      p={x:X+.5,z:Z+.5};
   if(!c.lineClear(e.x,e.z,p.x,p.z))continue;
   // An elevation difference of .44m may still be legal when it consists
   // of TWO 22cm risers. Test only actual >24.5cm changes between consecutive
   // swept samples, not a misleading endpoint-height comparison.
   const n=Math.ceil(Math.hypot(p.x-e.x,p.z-e.z)/.24);
   let prev=c.floorHeight(e.x,e.z),steep=false;
   for(let j=1;j<=n;j++){
    const h=c.floorHeight(e.x+(p.x-e.x)*j/n,e.z+(p.z-e.z)*j/n);
    if(Math.abs(h-prev)>.245)steep=true;
    prev=h;
   }
   if(!steep)continue;
   assert.equal(c.enemyDirectRoute(e,p),false,
     `Stage90 L${level}: diagonal shortcut through steep real ground (${x},${z})->(${X},${Z})`);
   checks++;cliffs++;here++;
   break;
  }
 }
 if(here)checks++;
 scenes++;
}
assert.ok(cliffs>0,'No actual unwalkable height discontinuity was exercised');
console.log(`Stage90 actual ground stairs: ${checks} blocked steep shortcuts across ${scenes} procedural scenes: PASS`);
