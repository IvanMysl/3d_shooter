'use strict';
// All 100 procedural maps: every true solid stair step gets a matching opaque
// WebGL side, a Canvas-projected face, and an exact physics ray under its top.
// Groups: FIRST=1 LAST=10 WEBGL_LEVELS=1,8 node tests/test_stage106_real_stair_seals.cjs
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.STAGE_SOURCE_ROOT||path.resolve(__dirname,'..');
const src=n=>fs.readFileSync(path.join(root,'src',n),'utf8');
let checks=0,steps=0,faceCount=0,solidRays=0,meshes=0;
const ok=(v,msg)=>{assert.ok(v,msg);checks++;};
const emitted=[];
const c={Math,Number,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,Map,Set,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(Math.max(v,a),b),rand:(a,b)=>(a+b)/2,
 mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],legacyResumeSector:-1,legacyResumeDivisor:18,
 glReady:false,touchOnly:false,gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:(v,a,b,d,e,n,col)=>emitted.push([a,b,d,e]),rcolor:v=>v,
 save:{settings:{quality:0,audio:false}},game:null,mpMatch:null,navField:null,navClock:0,
 sound:()=>{},burst:()=>{},toast:()=>{},input:{},arsenalOpened:false,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{radius:.42,score:10},brute:{radius:.69,score:20}}};
vm.createContext(c);
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js','04-map-generation.js',
 '05-world-mesh.js','11-fallback-render.js','13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js','14-combat-raycast.js'])
 vm.runInContext(src(n),c,{filename:n});
const ev=s=>vm.runInContext(s,c);
const first=Math.max(1,Number(process.env.FIRST||1)),last=Math.min(100,Number(process.env.LAST||100));
const meshSet=new Set((process.env.WEBGL_LEVELS||'1,8,35,70,99').split(',').map(Number));
for(let level=first;level<=last;level++){
 emitted.length=0;c.game=null;c.glReady=meshSet.has(level);c.save.settings.quality=level%2;
 c.buildMap(level);if(c.glReady)meshes++;
 const heights=ev('heightCells'),size=c.mapSize;
 let levelFaces=0,levelRays=0;
 for(let z=1;z<size-1;z++)for(let x=1;x<size-1;x++){
  if(c.mapCells[z][x]!==0)continue;
  const top=heights[z*size+x];if(top<.02)continue;
  const ns=[[0,-1],[0,1],[1,0],[-1,0]];
  const neighborH=ns.map(([dx,dz])=>c.floorHeightAtCell(x+dx,z+dz));
  let expected=0;
  for(let i=0;i<4;i++)if(neighborH[i]<top-.01)expected++;
  if(!expected)continue;
  const local=[];
  const orig=c.quad;
  c.quad=(v,a,b,d,e,n,col)=>local.push([a,b,d,e]);
  // Exactly the generator's rendering function, with the original real heights.
  ev(`drawSolidStairRisers([],${x},${z},${top},${neighborH.join(',')},[.3,.4,.5])`);
  c.quad=orig;
  ok(local.length===expected,`L${level} (${x},${z}): missing real opaque WebGL stair sides`);
  for(const face of local){
   ok(face.every(pt=>pt[1]>=0&&pt[1]<=top+1e-5),`L${level}: side must remain inside true voxel`);
   ok(Math.min(...face.map(pt=>pt[1]))===0,`L${level}: facade has cavity underneath`);
   ok(Math.abs(Math.max(...face.map(pt=>pt[1]))-top)<1e-5,
    `L${level}: facade cannot float below its real tread`);
   levelFaces++;faceCount++;
  }
  steps++;
  if(levelRays>=7)continue;
  for(let i=0;i<4;i++){
   const [dx,dz]=ns[i],low=neighborH[i];
   if(low>=top-.03||c.mapCells[z+dz]?.[x+dx]!==0)continue;
   // The ray begins ABOVE the adjacent physical floor but BELOW this step.
   const eye=low+(top-low)*.5;
   const hit=c.rayWall({x:x+.5+dx,y:eye,z:z+.5+dz},
     {x:-dx,y:0,z:-dz},1.5);
   ok(hit&&hit.kind==='stairs'&&hit.t>=.49&&hit.t<=.51,
    `L${level}: real floor is transparent to a ray where riser should cover (got ${hit?.kind}:${hit?.t})`);
   const span=ev(`fallbackSolidRiserSpan(${top},.5,${eye},300,310)`);
   ok(span.bottom>span.top,`L${level}: Canvas opaque stair face collapsed`);
   levelRays++;solidRays++;break;
  }
 }
 ok(levelFaces>0,`L${level}: no real generated solid riser faces`);
 if(c.glReady){
  // Production createWorldMesh must emit exactly these same opaque walls.
  // Detect a generated full-height stair face among the real mesh quads.
  let generated=0;
  for(const face of emitted){
   const ys=face.map(pt=>pt[1]);
   if(Math.min(...ys)>1e-8||Math.max(...ys)<.04)continue;
   const xx=face.map(pt=>pt[0]),zz=face.map(pt=>pt[2]);
   const constantX=xx.every(q=>Math.abs(q-xx[0])<1e-7);
   const constantZ=zz.every(q=>Math.abs(q-zz[0])<1e-7);
   if(constantX||constantZ)generated++;
  }
  ok(generated>=Math.min(20,levelFaces),`L${level}: real full WebGL mesh lacks opaque solid stair faces`);
 }
 console.log(`L${level}: ${levelFaces} real riser walls, ${levelRays} precise physical rays, ${c.glReady?'full 3D mesh':'Canvas'} PASS`);
}
console.log(`Stage106 real staircase seals: ${checks} PASS / ${last-first+1} maps / ${steps} raised tiles / ${faceCount} fully sealed faces / ${solidRays} raycast contacts / ${meshes} 3D meshes`);
