'use strict';
// Stage109: use independent circle/rectangle distances for every real raised edge.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.STAGE_SOURCE_ROOT||path.resolve(__dirname,'..');
const src=n=>fs.readFileSync(path.join(root,'src',n),'utf8');
const c={Math,Number,console,Float32Array,Int8Array,Int16Array,Int32Array,Uint8Array,Map,Set,
 TAU:2*Math.PI,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>(a+b)/2,mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],
 legacyResumeSector:-1,legacyResumeDivisor:18,glReady:false,touchOnly:false,
 gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:v=>v,
 save:{settings:{quality:0,audio:false}},sound:()=>{},burst:()=>{},toast:()=>{},
 input:{jumpQueued:false},arsenalOpened:false,game:null,mpMatch:null,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]}))};
vm.createContext(c);
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js','04-map-generation.js','05-world-mesh.js'])vm.runInContext(src(n),c,{filename:n});
const ev=s=>vm.runInContext(s,c);
const first=Math.max(1,Number(process.env.FIRST||1)),last=Math.min(100,Number(process.env.LAST||100));
let checks=0,interfaces=0,high=0,low=0,levels=0,meshes=0,swept=0;
const check=(v,m)=>{assert.ok(v,m);checks++};
const near=(v,w,m)=>check(Math.abs(v-w)<.0001,`${m}: ${v} != ${w}`);
// Independent local oracle: distance from circle centre to closed rectangle.
function oracle(x,z,r,n,heights){let top=0;for(let j=Math.floor(z)-2;j<=Math.floor(z)+2;j++)for(let i=Math.floor(x)-2;i<=Math.floor(x)+2;i++){
 if(i<0||j<0||i>=n||j>=n)continue;
 const vx=Math.max(i-x,0,x-(i+1)),vz=Math.max(j-z,0,z-(j+1));
 if(Math.hypot(vx,vz)<r-1e-6)top=Math.max(top,heights[j*n+i]);
 }return top;}
for(let level=first;level<=last;level++){
 c.game=null;c.glReady=[1,8,35,70,99].includes(level);c.buildMap(level);levels++;if(c.glReady)meshes++;
 const n=c.mapSize,hs=ev('heightCells'),ds=ev('deckCells');let motion=0;
 for(let z=2;z<n-2;z++)for(let x=2;x<n-2;x++){
  const h=hs[z*n+x];if(!(h>0)||c.mapCells[z][x]!==0)continue;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const ax=x+dx,az=z+dz,foot=hs[az*n+ax];
   if(c.mapCells[az][ax]!==0||h<=foot+.001)continue;
   interfaces++;if(h-foot>.24501)high++;else low++;
   const label=`L${level} [${x},${z}] -> [${ax},${az}]`;
   for(const r of [.23,.25,.58])for(const fraction of [.45,1.1]){
    const px=x+.5+dx*(.5+r*fraction),pz=z+.5+dz*(.5+r*fraction);
    const exact=oracle(px,pz,r,n,hs);
    near(c.worldTerrainFootprint(px,pz,r),exact,label+' circular support');
    if(fraction===.45)check(exact>=h-.0001,label+' physical column reached');
   }
   if(motion<24&&!c.glReady&&!ds[z*n+x]&&!ds[az*n+ax]){
    const r=.23,px=ax+.5,pz=az+.5;
    if(c.collide(px,pz,r)||c.worldSolidBodyCollision(px,pz,r,foot,1.95))continue;
    const p={x:px,z:pz,feetY:foot,grounded:true,vy:0};c.game={p};
    c.tryMoveEntity(p,-dx*.38,-dz*.38,r);
    const moved=(p.x-px)*(-dx)+(p.z-pz)*(-dz);
    if(h-foot>.24501){check(moved<=.27+.0001,label+' real tall edge blocks full body');near(p.feetY,foot,label+' no terrain boost');}
    else {check(moved>.37,label+' real low edge walkable');near(p.feetY,h,label+' edge rise');}
    motion++;swept++;c.game=null;
   }
  }
 }
}
check(levels>0&&interfaces>0&&swept>0,'no real maps or edges');
console.log(JSON.stringify({stage:109,status:'PASS',levels,interfaces,high,low,meshes,swept,checks}));
