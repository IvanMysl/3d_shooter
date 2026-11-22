'use strict';
// Stage101: scan real authored campaign geometry. The upper-deck guidance must
// use the same 3D steel that physically collides with a ground walker.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
const levels=process.env.LEVELS?process.env.LEVELS.split(',').map(Number):Array.from({length:100},(_,i)=>i+1);
let checks=0,worlds=0,fields=0,edges=0,bridges=0,webgl=0,falls=0,blocked=0;
const check=(yes,message)=>{assert.ok(yes,message);checks++;};
const c={Math,console,Number,Set,Map,Array,Float32Array,Int8Array,Int16Array,Int32Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
 rand:(a,b)=>a+Math.random()*(b-a),mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],
 legacyResumeSector:-1,legacyResumeDivisor:18,glReady:false,touchOnly:false,
 gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:v=>v,
 save:{settings:{quality:0,audio:false}},sound:()=>{},burst:()=>{},
 input:{jumpQueued:false},arsenalOpened:false,navField:null,navClock:0,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['boss'],robotPalette:()=>{},toast:()=>{},game:null};
vm.createContext(c);
for(const name of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js'])
 vm.runInContext(src(name),c,{filename:name});
const ev=s=>vm.runInContext(s,c);
for(const level of levels){
 c.game=null;c.glReady=[1,8,35,70,99].includes(level);c.save.settings.quality=level%3;
 c.buildMap(level);const n=c.mapSize;
 c.game={p:{x:c.spawnX,z:c.spawnZ,feetY:0},t:0,nodes:[],devices:[],nodesDestroyed:0,
  mission:{type:'purge'},enemies:[]};
 const balconies=ev('balconySpecs'),galleries=ev('gallerySpecs');
 if(c.glReady)webgl++;
 for(const gallery of galleries){
  const a=balconies.find(b=>b.planIndex===gallery.from),
    b=balconies.find(b=>b.planIndex===gallery.to);
  check(!!a&&!!b,`L${level}: missing balcony for genuine sky gallery`);
  const field=c.upperDeckField(b.cx+.5,b.cz+.5,gallery.y);
  const start=field?.[a.cz*n+a.cx]??32767;
  check(start>0&&start<32767,
   `L${level}: steel geometry closed every route along real gallery (${a.cx},${a.cz})->(${b.cx},${b.cz}), distance=${start}`);
  // Trace the exact predecessor choices; each drop in flow distance must be
  // a real collision-free transition at the same elevated foot altitude.
  let x=a.cx,z=a.cz,dist=start;
  for(let i=0;i<start+2&&dist>0;i++){
   const old=dist;let best=null;
   for(const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0]]){
    const X=x+dx,Z=z+dz;if(X<1||Z<1||X>=n-1||Z>=n-1)continue;
    if(field[Z*n+X]!==dist-1)continue;
    if(c.upperDeckEdgeClear(x,z,X,Z,gallery.y)){best={x:X,z:Z};break;}
   }
   check(!!best,`L${level}: upper route has a fake/blocked predecessor`);
   const midX=(x+best.x)/2+.5,midZ=(z+best.z)/2+.5;
   check(!c.worldSolidBodyCollision(midX,midZ,.22,gallery.y,1.68),
    `L${level}: sky route crosses a real metal barrier at ${midX},${midZ}`);
   x=best.x;z=best.z;dist=field[z*n+x];edges++;
   check(dist===old-1,`L${level}: upper flow never decreases`);
  }
  check(dist===0,`L${level}: upper flow cannot reach the goal`);
  fields++;bridges++;
 }
 // At a selected upper-deck lip, the robot must NEVER instantly shift to
 // the lower floor by moving horizontally one tile without a staircase.
 let sampled=false;
 for(let z=2;z<n-2&&!sampled;z++)for(let x=2;x<n-2&&!sampled;x++){
  const h=c.deckAtCell(x,z);if(h<1.5||c.mapCells[z][x])continue;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=x+dx,Z=z+dz;
   if(c.mapCells[Z]?.[X]||c.deckAtCell(X,Z)>0||
      c.floorHeight(X+.5,Z+.5)>h-.50)continue;
   const e={id:101,x:x+.5,z:z+.5,feetY:h,maxhp:100,type:'scout',radius:.48,orbit:1};
   c.game.enemies=[e];c.moveEntity(e,dx*.95,dz*.95,.22);
   check(e.feetY>=h-.245-1e-6,`L${level}: walking robot teleported vertically from ${h} to ${e.feetY}`);
   sampled=true;falls++;break;
  }
 }
 worlds++;
}
console.log(`Stage101 actual 3D upper navigation: ${checks} PASS; worlds=${worlds}; connected physical galleries=${bridges}; verified edges=${edges}; cliff-guard probes=${falls}; WebGL meshes=${webgl}`);
