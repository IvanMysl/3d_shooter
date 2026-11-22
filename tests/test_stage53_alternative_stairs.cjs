'use strict';
// Stage53: seven NEW pedestrian entrances to Stage52 upper rooms. Check
// every seed, entire 10/14-step movement, pursuit, descent and ground access.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
let checks=0;
const check=(value,why)=>{assert.ok(value,why);checks++;};
const ctx={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],
 legacyResumeSector:-1,legacyResumeDivisor:18,glReady:false,touchOnly:false,
 gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:c=>c,
 save:{settings:{quality:0,audio:false}},sound:()=>{},burst:()=>{},
 input:{jumpQueued:false},arsenalOpened:false,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['БОСС'],robotPalette:()=>({}),toast:()=>{},game:null};
vm.createContext(ctx);
for(const file of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js'])vm.runInContext(source(file),ctx);
const ev=script=>vm.runInContext(script,ctx);
const expected={2:1,4:3,6:2,9:1};
const MP=source('21b-multiplayer-lobby.js');
check(/const MP_VERSION=(7|8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(MP),'changed stair geometry must reject V52 peers');
const near=(a,b,limit=.05)=>Math.abs(a-b)<limit;
function farSpawn(feature,x,z){
 return feature.spawns.reduce((best,p)=>
  Math.hypot(p.x-x,p.z-z)>Math.hypot(best.x-x,best.z-z)?p:best,
  feature.spawns[0]);
}

function route(from,to,y){
 const n=ctx.mapSize,first=Math.floor(from.z)*n+Math.floor(from.x);
 const last=Math.floor(to.z)*n+Math.floor(to.x);
 const parent=new Int32Array(n*n);parent.fill(-1);
 const queue=new Int32Array(n*n);let read=0,write=0;
 parent[first]=first;queue[write++]=first;
 while(read<write&&parent[last]===-1){
  const key=queue[read++],x=key%n,z=(key/n)|0;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=x+dx,Z=z+dz,K=Z*n+X;
   if(X<1||Z<1||X>=n-1||Z>=n-1||parent[K]!==-1||ctx.mapCells[Z][X]||
      !near(ctx.deckHeight(X+.5,Z+.5),y))continue;
   parent[K]=key;queue[write++]=K;
  }
 }
 if(parent[last]===-1)return null;
 const reverse=[];
 for(let k=last;;k=parent[k]){
  reverse.push({x:k%n+.5,z:Math.floor(k/n)+.5});
  if(k===first)break;
 }
 return reverse.reverse();
}
// A ground-level route may walk along the staircase but must NEVER cross a
// high side wall. This uses the runtime's enemyNavEdge, not merely mapCells.
function reachableFromHub(tx,tz){
 const n=ctx.mapSize,start=Math.floor(ctx.spawnZ)*n+Math.floor(ctx.spawnX);
 const goal=Math.floor(tz)*n+Math.floor(tx);
 const visited=new Uint8Array(n*n),queue=new Int32Array(n*n);
 let head=0,tail=0;queue[tail++]=start;visited[start]=1;
 while(head<tail){
  const k=queue[head++];if(k===goal)return true;
  const x=k%n,z=(k/n)|0;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=x+dx,Z=z+dz,K=Z*n+X;
   if(X<1||Z<1||X>=n-1||Z>=n-1||visited[K]||ctx.mapCells[Z][X]||
      !ctx.enemyNavEdge(x,z,X,Z))continue;
   queue[tail++]=K;visited[K]=1;
  }
 }
 return false;
}
function foot(b){
 return {x:b.entry.x+.5+(b.axis==='x'?b.side:0),
  z:b.entry.z+.5+(b.axis==='z'?b.side:0)};
}
for(let sector=1;sector<=100;sector++){
 ctx.glReady=false;ctx.buildMap(sector);
 const style=(sector-1)%18,wanted=expected[style]||0;
 const plans=ev('balconyPlans').filter(p=>p.alternate);
 const stairs=ev('balconySpecs').filter(s=>s.alternate);
 const features=ev('skyFeatureSpecs');
 check(plans.length===wanted,`sector ${sector}: wrong number of alternative stair plans`);
 check(stairs.length===wanted,`sector ${sector}: alternative stairs failed geometry checks`);
 if(wanted)check(ctx.floorHeight(ctx.spawnX,ctx.spawnZ)===0,
  `sector ${sector}: main ground-floor spawn is no longer level`);
 for(const b of stairs){
  const feature=features[b.featureIndex];
  check(feature&&near(b.y,feature.y),
   `sector ${sector}: alternative staircase does not meet its upper room`);
  const far=farSpawn(feature,b.cx+.5,b.cz+.5);
  check(route({x:b.cx+.5,z:b.cz+.5},far,b.y)?.length>=2,
   `sector ${sector}: top of stairs cannot access new upper room; `+
   `stair ${b.cx},${b.cz} alt=${b.y}, feature ${feature.kind} `+
   `${feature.cx},${feature.cz} goal=${JSON.stringify(far)}, `+
   `start deck=${ctx.deckHeight(b.cx+.5,b.cz+.5)}`);
  const bottom=foot(b);
  check(ctx.floorHeight(bottom.x,bottom.z)<.01,
   `sector ${sector}: staircase entrance is not on the main ground floor`);
  check(reachableFromHub(bottom.x,bottom.z),
   `sector ${sector}: ground route to alternative entrance is blocked`);
  const edge=b.side>0?2:-1;
  for(let k=1;k<=b.steps;k++){
   const u=edge+b.side*k;
   const x=b.axis==='x'?b.cx+u:b.cx,z=b.axis==='z'?b.cz+u:b.cz;
   check(ctx.mapCells[z][x]===0,`sector ${sector}: closed stair tread`);
   check(near(ctx.floorHeight(x+.5,z+.5),(b.steps+1-k)*.22,.00001),
    `sector ${sector}: missing or overlapping stair ${k}/${b.steps}`);
  }
 }
}

function physical(style,quality){
 ctx.glReady=true;ctx.touchOnly=quality===0;ctx.save.settings.quality=quality;
 ctx.buildMap(style+1);
 const stairs=ev('balconySpecs.filter(s=>s.alternate)');
 const features=ev('skyFeatureSpecs');
 check(ev('worldSolidCount')<15000,
  `style ${style}, quality ${quality}: exceeded mobile static-solid budget`);
 for(const b of stairs){
  const bottom=foot(b),f=features[b.featureIndex];
  const p={x:bottom.x,z:bottom.z,feetY:0,grounded:true,vy:0};
  ctx.game={p,enemies:[],particles:[],t:0,idCounter:0,sector:style+1,spawned:0};
  const landing={x:b.cx+.5,z:b.cz+.5};
  for(let i=0;i<800;i++){
   const remaining=Math.hypot(landing.x-p.x,landing.z-p.z);
   if(remaining<.02)break;
   const stride=Math.min(.047,remaining);
   ctx.moveEntity(p,b.axis==='x'?-b.side*stride:0,
    b.axis==='z'?-b.side*stride:0,.23);
   ctx.updateVertical(p,1/60);
  }
  for(let i=0;i<10;i++)ctx.updateVertical(p,1/60);
  check(near(p.feetY,b.y,.05),
   `style ${style}, quality ${quality}: player cannot ascend new stairs `+
   `(${p.x.toFixed(2)},${p.z.toFixed(2)},feet=${p.feetY.toFixed(2)},target=${b.y}) `+
   `step height=${ctx.floorHeight(p.x,p.z)}`);
  check(Math.hypot(p.x-b.cx-.5,p.z-b.cz-.5)<.75,
   `style ${style}, quality ${quality}: new upper landing unreachable; `+
   `player (${p.x.toFixed(2)},${p.z.toFixed(2)},${p.feetY.toFixed(2)}) `+
   `target (${b.cx+.5},${b.cz+.5},${b.y}), side=${b.side}`);
  check(!ctx.worldSolidBodyCollision(p.x,p.z,.23,p.feetY,1.95),
   `style ${style}, quality ${quality}: upper landing intersects geometry`);

  const path=route({x:b.cx+.5,z:b.cz+.5},farSpawn(f,b.cx+.5,b.cz+.5),b.y);
  check(path&&path.length>=2,`style ${style}, quality ${quality}: cannot enter upper room`);
  for(const destination of path.slice(1)){
   for(let i=0;i<8;i++){
    ctx.moveEntity(p,(destination.x-p.x)/(8-i),(destination.z-p.z)/(8-i),.23);
    ctx.updateVertical(p,1/60);
   }
   check(p.feetY>b.y-.05&&Math.hypot(p.x-destination.x,p.z-destination.z)<.24,
    `style ${style}, quality ${quality}: stuck between stairs and upper arena`);
  }
  // Use the actual AI goal: a ground robot must select an entrance, climb,
  // and be able to reach a standing target on the alternate upper landing.
  const e={id:9,x:bottom.x,z:bottom.z,feetY:0,type:'scout',maxhp:100,
   radius:.48,orbit:1,airborne:false};
  p.x=b.cx+.5;p.z=b.cz+.5;p.feetY=b.y;p.grounded=true;
  ctx.game.enemies=[e];let reached=false;
  for(let i=0;i<780;i++){
   const h=ctx.enemyHeading(e,p);
   ctx.enemyMove(e,h.dx*.07,h.dz*.07,.23);ctx.game.t+=.033;
   if(e.feetY>b.y-.29&&Math.hypot(e.x-p.x,e.z-p.z)<1.12){reached=true;break;}
  }
  check(reached,`style ${style}, quality ${quality}: robot cannot take alternate stairs `+
   `(${e.x.toFixed(2)},${e.z.toFixed(2)},feet=${e.feetY.toFixed(2)})`);
 }
}
for(const style of [2,4,6,9])for(const quality of [0,2])physical(style,quality);
console.log(`Stage53: ${checks} alternative-stair, 100-level, physics, player and robot checks passed`);
