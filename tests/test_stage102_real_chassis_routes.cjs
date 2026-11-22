'use strict';
// Stage102: scan EVERY real gallery with the same profile used by the physical
// movement of small, large, and boss robots. No fake predecessors or hull
// crossings may be reported as navigable. Run LEVELS=... for bounded batches.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
const levels=process.env.LEVELS?process.env.LEVELS.split(',').map(Number):Array.from({length:100},(_,i)=>i+1);
let checks=0,worlds=0,segments=0,galleries=0,meshes=0,reachable=0,unreachable=0,large=0;
const check=(value,msg)=>{assert.ok(value,msg);checks++;};
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
 c.game=null;c.glReady=[1,8,35,70,99].includes(level)||
  (process.env.WEBGL_LEVELS||'').split(',').map(Number).includes(level);
 c.save.settings.quality=level%3;c.buildMap(level);
 const n=c.mapSize;
 c.game={p:{x:c.spawnX,z:c.spawnZ,feetY:0},t:0,nodes:[],devices:[],nodesDestroyed:0,
  mission:{type:'purge'},enemies:[]};
 const balconies=ev('balconySpecs'),specs=ev('gallerySpecs');
 if(specs.length&&process.env.VERBOSE)console.log('GALLERY LEVEL',level,specs.length);
 if(c.glReady)meshes++;
 for(const gallery of specs){
  const a=balconies.find(b=>b.planIndex===gallery.from),b=balconies.find(b=>b.planIndex===gallery.to);
  check(!!a&&!!b,`L${level} missing gallery endpoints`);
  for(const variant of [
    {type:'scout',radius:.48,boss:false},
    {type:'brute',radius:1.10,boss:false},
    {type:'warden',radius:1.18,boss:true}]){
   const e={id:13,x:a.cx+.5,z:a.cz+.5,feetY:gallery.y,maxhp:200,...variant};
   const profile=c.upperDeckProfile(e);
   const field=c.upperDeckField(b.cx+.5,b.cz+.5,gallery.y,profile);
   const origin=a.cz*n+a.cx,start=field?.[origin]??32767;
   const physicalOrigin=!c.worldSolidBodyCollision(e.x,e.z,profile.radius,gallery.y,profile.height);
   const physicalGoal=!c.worldSolidBodyCollision(b.cx+.5,b.cz+.5,profile.radius,gallery.y,profile.height);
   if(start>=32767){
    unreachable++;
    const heading=c.upperDeckHeading(e,b.cx+.5,b.cz+.5,gallery.y);
    check(heading===null,`L${level} ${variant.type}: no route yet heading advertises one`);
    continue;
   }
   check(physicalOrigin&&physicalGoal,`L${level} ${variant.type}: route seeds occupied origin/goal`);
   if(variant.type!=='scout')large++;
   let x=a.cx,z=a.cz,d=start;
   for(let i=0;i<start+2&&d>0;i++){
    let next=null;
    for(const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0]]){
     const X=x+dx,Z=z+dz;
     if(X<1||Z<1||X>=n-1||Z>=n-1||field[Z*n+X]!==d-1)continue;
     if(c.upperDeckEdgeClear(x,z,X,Z,gallery.y,profile)){next={x:X,z:Z};break;}
    }
    check(!!next,`L${level} ${variant.type}: nonphysical predecessor at (${x},${z})`);
    check(!c.worldSolidBodyCollision(next.x+.5,next.z+.5,profile.radius,gallery.y,profile.height),
     `L${level} ${variant.type}: robot body intersects real steel`);
    x=next.x;z=next.z;d=field[z*n+x];segments++;
   }
   check(d===0,`L${level} ${variant.type}: route never reaches goal`);
   reachable++;
  }
  galleries++;
 }
 worlds++;
}
console.log(`Stage102 actual chassis-aware galleries: ${checks} checks PASS; ${worlds} maps; ${galleries} galleries; ${segments} real steps; ${reachable} connected profiles; ${unreachable} physically blocked profiles; ${large} heavy/boss connected profiles; ${meshes} full 3D meshes`);
