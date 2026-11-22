'use strict';
// End-to-end source geometry: all 100 procedural maps, exact real deck edges.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.STAGE_SOURCE_ROOT||path.resolve(__dirname,'..');
const src=n=>fs.readFileSync(path.join(root,'src',n),'utf8');
const c={Math,Number,console,Float32Array,Int8Array,Int16Array,Int32Array,Uint8Array,Map,Set,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),rand:(a,b)=>(a+b)/2,
 mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],glReady:false,touchOnly:false,
 legacyResumeSector:-1,legacyResumeDivisor:18,gl:{deleteBuffer(){}},worldMesh:null,
 worldChunks:[],meshStats:{},toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:v=>v,
 save:{settings:{quality:0,audio:false}},game:null,mpMatch:null,navField:null,navClock:0,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]}))};
vm.createContext(c);
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js','04-map-generation.js','05-world-mesh.js'])
 vm.runInContext(src(n),c,{filename:n});
const ev=s=>vm.runInContext(s,c);
const first=Math.max(1,Number(process.env.FIRST||1)),last=Math.min(100,Number(process.env.LAST||100));
const webgl=new Set((process.env.WEBGL_LEVELS||'1,14,35,70,99').split(',').filter(Boolean).map(Number));
let checks=0,exposed=0,underpasses=0,meshes=0,levelCount=0;
const check=(v,m)=>{assert.ok(v,m);checks++;};
for(let level=first;level<=last;level++){
 c.glReady=webgl.has(level);c.save.settings.quality=0;c.game=null;
 c.buildMap(level);if(c.glReady)meshes++;
 const n=c.mapSize,deck=ev('deckCells'),r=.23,coords=[[1,0],[-1,0],[0,1],[0,-1]];
 let edges=0;
 for(let z=2;z<n-2;z++)for(let x=2;x<n-2;x++){
  const h=deck[z*n+x];if(!(h>0)||c.mapCells[z][x]!==0)continue;
  for(const [dx,dz] of coords){
   if(deck[(z+dz)*n+x+dx]>0||c.mapCells[z+dz][x+dx]!==0)continue;
   const px=x+.5+dx*.66,pz=z+.5+dz*.66;
   const fx=x+.5+dx*.74,fz=z+.5+dz*.74;
   const h0=c.worldDeckHeadBarrier(px,pz,r,h-.32,h-.02);
   const f0=c.worldDeckFeetBarrier(px,pz,r,h+.15,h-.15);
   const s0=c.worldDeckStandingSupport(px,pz,r,h+.004);
   check(h0!==null&&Math.abs(h0-(h-.17))<.0002,`L${level}: underside at ${x},${z}`);
   check(f0!==null&&Math.abs(f0-h)<.0002,`L${level}: boot collision at ${x},${z}`);
   check(s0!==null&&Math.abs(s0-h)<.0002,`L${level}: edge support at ${x},${z}`);
   check(c.worldDeckHeadBarrier(fx,fz,r,h-.32,h-.02)===null,`L${level}: phantom head at ${x},${z}`);
   check(c.worldDeckFeetBarrier(fx,fz,r,h+.15,h-.15)===null,`L${level}: phantom deck at ${x},${z}`);
   check(c.worldDeckStandingSupport(fx,fz,r,h)===null,`L${level}: phantom support at ${x},${z}`);
   const feet=c.floorHeight(px,pz);
   if(feet+1.95<h-.17-.02){
    check(!c.worldDeckBodyCollision(px,pz,r,feet,1.95),`L${level}: open underpass blocked`);
    underpasses++;
   }
   edges++;exposed++;
  }
 }
 check(edges>0||!deck.some(h=>h>0),`L${level}: nonempty bridge has no open perimeter`);
 levelCount++;
}
console.log(`Stage107 real bridge edges: ${checks} PASS / ${levelCount} real maps / ${exposed} open perimeter edges / ${underpasses} physical underpasses / ${meshes} complete WebGL meshes`);
