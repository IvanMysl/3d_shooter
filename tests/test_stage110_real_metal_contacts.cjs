'use strict';
// Sample the actual generated mesh at both quality tiers. Independent local
// geometric oracle tests full-body, head, feet and support against nearby boxes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
const draws=[];
const c={Math,Number,console,Float32Array,Int8Array,Int16Array,Int32Array,Uint8Array,Map,Set,
 TAU:2*Math.PI,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>(a+b)/2,mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],
 legacyResumeSector:-1,legacyResumeDivisor:18,glReady:true,touchOnly:false,
 gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:(dst,...args)=>draws.push(args),quad:()=>{},rcolor:v=>v,
 save:{settings:{quality:0,audio:false}},sound:()=>{},burst:()=>{},toast:()=>{},
 input:{jumpQueued:false},arsenalOpened:false,game:null,mpMatch:null,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]}))};
vm.createContext(c);
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js','04-map-generation.js','05-world-mesh.js','14-combat-raycast.js'])vm.runInContext(src(n),c,{filename:n});
const ev=s=>vm.runInContext(s,c);
let checks=0,scenes=0,volumes=0,paints=0,low=0,nearFeet=0,probeCount=0,rayTests=0;
const ok=(v,m)=>{assert.ok(v,m);checks++};
const levels=(process.env.LEVELS||'1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,35,70,99,100').split(',').map(Number);
const qualities=(process.env.QUALITIES||'0,2').split(',').map(Number);
const key=b=>b.join('|');
const xy=(b,x,z,r)=>Math.hypot(Math.max(b[0]-x,0,x-b[3]),Math.max(b[2]-z,0,z-b[5]))<Math.sqrt(r*r-1e-7);
for(const level of levels)for(const quality of qualities){
 c.glReady=true;c.touchOnly=quality===0;c.save.settings.quality=quality;c.game=null;draws.length=0;c.buildMap(level);scenes++;
 const n=c.mapSize,grid=ev('worldSolidGrid'),hs=ev('heightCells'),ds=ev('deckCells');
 const all=[...new Set(grid.flatMap(x=>x||[]))]; const registered=new Set(all.map(s=>key(s.box)));
 const drawKeys=new Set(draws.map(d=>key(d.slice(0,6))));
 for(const solid of all){const b=solid.box;
  ok(b.every(Number.isFinite)&&b[3]>b[0]&&b[4]>b[1]&&b[5]>b[2],`invalid AABB L${level}`);
  ok(solid.kind==='ceiling'||drawKeys.has(key(b)),`collider without actual drawn box L${level}: ${b}`);
 }
 volumes+=all.length;
 // Surface-only top faces must not become independent 3D volumes. Other
 // actual box calls can share the same coordinates as a physical parent.
 for(const d of draws){
  const b=d.slice(0,6),sides=d[8],dy=Math.abs(b[4]-b[1]);
  const surface=Array.isArray(sides)&&sides[4]&&![0,1,2,3,5].some(i=>sides[i]);
  if(registered.has(key(b)))continue;
  // Existing explicit surface/flush trim in the renderer is not structural.
  ok(surface||dy<=.02||(Math.max(b[1],b[4])<=.15&&dy<.09),`L${level} Q${quality} substantial visual box not registered: ${b}`);
  paints++;
 }
 const nearBoxes=(x,z,r)=>{const set=new Set();for(let j=Math.max(0,Math.floor(z-r));j<=Math.min(n-1,Math.floor(z+r));j++)for(let i=Math.max(0,Math.floor(x-r));i<=Math.min(n-1,Math.floor(x+r));i++)for(const s of grid[j*n+i]||[])if(xy(s.box,x,z,r))set.add(s);return [...set].map(s=>s.box)};
 function oracle(x,z,r,feet,height){
  const boxes=nearBoxes(x,z,r);
  for(let j=Math.max(0,Math.floor(z-r));j<=Math.min(n-1,Math.floor(z+r));j++)for(let i=Math.max(0,Math.floor(x-r));i<=Math.min(n-1,Math.floor(x+r));i++){
   if(!xy([i,0,j,i+1,1,j+1],x,z,r))continue;
   const h=hs[j*n+i],d=ds[j*n+i];
   if(h>feet+.004)return true;
   if(d>0&&d>feet+.004&&d-.17<feet+height-.004)return true;
  }
  return boxes.some(b=>b[4]>feet+.004&&b[1]<feet+height-.004);
 }
 // Low pieces relative to actual ground/decks, plus evenly spaced samples
 // of every class of physical architecture (columns, roofs, rails, beams).
 const lowSolids=all.filter(s=>{const b=s.box,x=(b[0]+b[3])/2,z=(b[2]+b[5])/2,k=Math.floor(z)*n+Math.floor(x),h=hs[k]||0,d=ds[k]||0;
  return (b[4]-h>.005&&b[4]-h<=.245)||(d>0&&b[4]-d>.005&&b[4]-d<=.245);
 });low+=lowSolids.length;
 const select=new Set();for(const a of [all,lowSolids])for(let j=0;j<Math.min(36,a.length);j++)select.add(a[Math.floor((j+.5)*a.length/Math.min(36,a.length))]);
 for(const s of select){const b=s.box,z=(b[2]+b[5])/2;
  for(const r of [.23,.58])for(const frac of [.65,1,1.1]){
   const x=b[0]-r*frac;if(x-r<0||z-r<0||x+r>n||z+r>n)continue;
   const feet=Math.max(0,b[4]-.10),height=r===.23?1.95:3.1;
   const expected=oracle(x,z,r,feet,height),label=`L${level} Q${quality} ${b} r${r} fraction${frac}`;
   ok(c.worldSolidBodyCollision(x,z,r,feet,height)===expected,`${label}: body differs from independent exact geometry`);
   const boxes=nearBoxes(x,z,r),top=b[4],bottom=b[1];
   const maxOrNull=a=>a.length?Math.max(...a):null,minOrNull=a=>a.length?Math.min(...a):null;
   const down=maxOrNull(boxes.map(q=>q[4]).filter(y=>y<=top+.2+.001&&y>top-.2));
   const up=minOrNull(boxes.map(q=>q[1]).filter(y=>y>=bottom-.2-.001&&y<bottom+.2));
   const stand=maxOrNull(boxes.map(q=>q[4]).filter(y=>Math.abs(y-top)<=.045));
   ok(c.worldSolidFeetBarrier(x,z,r,top+.2,top-.2)===down,`${label}: swept boots mismatch`);
   ok(c.worldSolidHeadBarrier(x,z,r,bottom-.2,bottom+.2)===up,`${label}: swept helmet mismatch`);
   ok(c.worldSolidStandingSupport(x,z,r,top)===stand,`${label}: support mismatch`);
   probeCount++;if(frac<1&&b[4]-feet>.004&&b[4]-feet<=.16)nearFeet++;
  }
  const p={x:(b[0]+b[3])/2,y:(b[1]+b[4])/2,z};
  const hit=c.rayWall(p,{x:1,y:0,z:0},.08);
  ok(hit&&hit.t<=1e-7,`L${level} actual steel misses hitscan`);rayTests++;
 }
}
ok(scenes>0&&probeCount>0&&rayTests>0&&paints>0,'empty audit');
console.log(JSON.stringify({stage:110,status:'PASS',levels:levels.length,scenes,checks,volumes,paints,low,nearFeet,probeCount,rayTests}));
