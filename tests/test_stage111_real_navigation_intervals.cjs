'use strict';
// Audit true production map + 3D solids on ALL 100 maps. Small/heavy/boss
// profiles must NEVER advertise a walkable edge that intersects any visible
// physical AABB, tall step or a metal item. Split using LEVELS=1,2,...
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
const levels=process.env.LEVELS?process.env.LEVELS.split(',').map(Number):Array.from({length:100},(_,i)=>i+1);
let checks=0,worlds=0,meshes=0,admitted=0,blocked=0,motions=0,low=0;
const check=(v,m)=>{assert.ok(v,m);checks++};
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
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js','04-map-generation.js',
 '05-world-mesh.js','13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js',
 '14-combat-raycast.js'])vm.runInContext(src(n),c,{filename:n});
const ev=s=>vm.runInContext(s,c);
const webgl=new Set((process.env.WEBGL_LEVELS||'1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18').split(',').map(Number));
const dirs=[[1,0],[0,1]];
for(const level of levels){
 c.game=null;c.glReady=webgl.has(level);c.save.settings.quality=level%3;c.buildMap(level);
 if(c.glReady)meshes++;
 c.game={p:{x:c.spawnX,z:c.spawnZ,feetY:c.floorHeight(c.spawnX,c.spawnZ)},nodes:[],devices:[],nodesDestroyed:0,mission:{type:'purge'},enemies:[],t:0};
 const n=c.mapSize,all=[];
 for(let z=1;z<n-1;z++)for(let x=1;x<n-1;x++)if(!c.mapCells[z][x])for(const [dx,dz] of dirs){
  const X=x+dx,Z=z+dz;if(X>=n-1||Z>=n-1||c.mapCells[Z][X])continue;
  all.push([x,z,X,Z]);
 }
 const chosen=new Map();const pick=(x,z,X,Z)=>{if(Math.min(x,z,X,Z)>=1&&Math.max(x,z,X,Z)<n-1&&!c.mapCells[z][x]&&!c.mapCells[Z][X])chosen.set([x,z,X,Z].join(','),[x,z,X,Z]);};
 for(let i=0;i<Math.min(30,all.length);i++)pick(...all[Math.floor((i+.5)*all.length/Math.min(30,all.length))]);
 // In full WebGL mesh scenes deliberately add edges near visible low details.
 if(c.glReady){
  const solids=[...new Set(ev('worldSolidGrid').flatMap(a=>a||[]))].filter(s=>{
   const b=s.box,x=(b[0]+b[3])/2,z=(b[2]+b[5])/2,h=c.floorHeight(x,z);
   return b[4]>h+.005&&b[4]<=h+.245;
  });
  for(let i=0;i<Math.min(16,solids.length);i++){
   const b=solids[Math.floor((i+.5)*solids.length/Math.min(16,solids.length))].box,x=Math.floor((b[0]+b[3])/2),z=Math.floor((b[2]+b[5])/2);
   pick(x-1,z,x,z);pick(x,z,x+1,z);pick(x,z-1,x,z);pick(x,z,x,z+1);low++;
  }
 }
 for(const [type,radius,boss] of [['scout',.48,false],['brute',1.1,false],['boss',1.2,true]]){
  const bot={id:7,type,radius,boss,maxhp:100,airborne:false};const profile=c.upperDeckProfile(bot),edges=new Int8Array(n*n*4);
  for(const [x,z,X,Z] of chosen.values()){
   const forward=c.groundChassisEdge(x,z,X,Z,profile,edges),reverse=c.groundChassisEdge(X,Z,x,z,profile,edges);
   check(forward===reverse,`L${level} ${type}: inconsistent edge reverse cache`);
   if(!forward){blocked++;continue;}admitted++;
   for(const [ax,az,bx,bz] of [[x,z,X,Z],[X,Z,x,z]]){
    const a={...bot,x:ax+.5,z:az+.5,feetY:c.navStandingFeet(ax+.5,az+.5,profile)};
    check(a.feetY!==null,`L${level} ${type}: no physical standing pose`);
    for(let k=0;k<20;k++){
     c.tryMoveEntity(a,(bx-ax)/20,(bz-az)/20,profile.radius);
     check(!c.worldSolidBodyCollision(a.x,a.z,profile.radius,a.feetY,c.enemyBodyHeight(a)),`L${level} ${type}: moving body intersects visible solid`);
    }
    check(Math.hypot(a.x-bx-.5,a.z-bz-.5)<1e-6,`L${level} ${type}: admitted edge stalls at ${a.x},${a.z} (${ax},${az} -> ${bx},${bz})`);
    motions++;
   }
  }
 }
 worlds++;
}
console.log(JSON.stringify({stage:111,status:'PASS',checks,worlds,meshes,admitted,blocked,motions,low}));
