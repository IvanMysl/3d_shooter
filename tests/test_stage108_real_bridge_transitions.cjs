'use strict';
// Real 100-map integration: examine every geometrically reachable stair/deck
// boundary and move a grounded human across it in Canvas's exact shared map.
// No extra collision shapes are introduced; map/mesh generators are untouched.
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
let checks=0,entries=0,levels=0,mapsWithSteps=0,entryLevels=[];
const near=(v,w,msg)=>{assert.ok(Math.abs(v-w)<.004,`${msg}: ${v} != ${w}`);checks++;};
for(let level=first;level<=last;level++){
 c.game=null;c.glReady=false;c.buildMap(level);levels++;
 const n=c.mapSize,heights=ev('heightCells'),decks=ev('deckCells');let samples=0;
 for(let z=2;z<n-2;z++)for(let x=2;x<n-2;x++){
  const top=decks[z*n+x];if(!(top>0)||c.mapCells[z][x]!==0)continue;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const ax=x+dx,az=z+dz,foot=heights[az*n+ax];
   if(c.mapCells[az][ax]!==0||decks[az*n+ax]>0||
      !(top-foot>=.001&&top-foot<=.245)||foot<.17)continue;
   // Begin in the real neighbouring tread, walk 70cm into the deck tile.
   const px=ax+.5,pz=az+.5;
   const player={x:px,z:pz,feetY:foot,grounded:true,vy:0};
   c.game={p:player};
   c.tryMoveEntity(player,-dx*.7,-dz*.7,.23);
   const distance=(player.x-px)*(-dx)+(player.z-pz)*(-dz);
   assert.ok(distance>.68,`L${level} bridge [${x},${z}] from [${ax},${az}] stopped at distance ${distance}`);checks++;
   near(player.feetY,top,`L${level} boots on real deck`);
   c.tryMoveEntity(player,dx*.7,dz*.7,.23);
   near(player.x,px,`L${level} return x`);near(player.z,pz,`L${level} return z`);
   near(player.feetY,foot,`L${level} back on real stair`);
   entries++;samples++;
  }
 }
 if(samples>0){mapsWithSteps++;entryLevels.push(level);}
}
assert.ok(levels>0&&entries>0&&mapsWithSteps>0,'no real bridge stair transitions checked');
console.log(`Stage108 real bridge stair transitions: ${checks} PASS; ${entries} complete up/down paths; ${levels} real maps; ${mapsWithSteps} maps with real stair entries; levels=${entryLevels.join(',')}`);
