'use strict';
// Targeted Stage77 integration audit: all campaign maps at mobile quality,
// plus boss levels at desktop quality. A finite-radius projectile must never register a later collision
// than a centerline hitscan against the same geometry at the same origin.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
const c={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
 rand:(a,b)=>a+Math.random()*(b-a),mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],
 legacyResumeSector:-1,legacyResumeDivisor:18,glReady:true,touchOnly:false,
 gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:c=>c,
 save:{settings:{quality:0,audio:false}},sound:()=>{},burst:()=>{},
 input:{jumpQueued:false},arsenalOpened:false,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['БОСС'],robotPalette:()=>({}),toast:()=>{},game:null,navField:null,navClock:0};
vm.createContext(c);
for(const f of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js'])vm.runInContext(src(f),c,{filename:f});
const ev=s=>vm.runInContext(s,c);
let assertions=0,wallBoxes=0,approaches=0,worlds=0;
const first=Math.max(1,Number(process.env.FIRST||1)),last=Math.min(100,Number(process.env.LAST||100));
for(let level=first;level<=last;level++)for(const quality of (level%5===0?[0,2]:[0])){
 c.glReady=true;c.touchOnly=quality===0;c.save.settings.quality=quality;c.buildMap(level);worlds++;
 const solids=[...new Set(ev('worldSolidGrid').flatMap(x=>x||[]))],sel=[];
 for(const s of solids){
  const b=s.box,ix=Math.max(0,Math.min(c.mapSize-1,Math.floor((b[0]+b[3])*.5))),
        iz=Math.max(0,Math.min(c.mapSize-1,Math.floor((b[2]+b[5])*.5)));
  if(c.mapCells[iz]?.[ix]===1)sel.push(s);
 }
 wallBoxes+=sel.length;
 // Cover the entire ordered set in even strata, rather than checking only
 // the first small room. Samples include ceilings, braces, ribs and gunports.
 const n=Math.min(4,sel.length);
 for(let i=0;i<n;i++){
  const b=sel[Math.floor((i+.5)*sel.length/n)].box;
  const origin={x:(b[0]+b[3])*.5,y:b[4]+.155,z:(b[2]+b[5])*.5},
   d={x:0,y:-1,z:0};
  const bullet=c.rayWall(origin,d,.45),rocket=c.sweepWorldSphere(origin,d,.45,.05);
  assert.ok(bullet,`L${level} q${quality}: sampled solid not raycast (${b})`);
  assert.ok(rocket,`L${level} q${quality}: swept sphere misses raycast solid (${b})`);
  assert.ok(rocket.t<=bullet.t+.00001,
   `L${level} q${quality}: spherical shot late ${rocket.t}>${bullet.t} (${b})`);
  assertions+=3;approaches++;
 }
 assert.ok(solids.length>500,`L${level} q${quality}: world lost solids`);assertions++;
}
assert.ok(wallBoxes>0&&approaches>=4*(last-first+1),'no meaningful wall-cell geometry covered');assertions++;
console.log(`Stage77 world sweep: ${assertions} assertions; ${worlds} scenes, ${wallBoxes} wall-cell solids, ${approaches} bullet-vs-rocket probes PASS`);
