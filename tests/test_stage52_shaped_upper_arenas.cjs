'use strict';
// Stage52: true hollow overlook rings, three theatre wings, L-shaped
// courtyards and canyon ledges. Actual geometry/collision on 100 levels.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const file=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
let count=0;
const check=(v,message)=>{assert.ok(v,message);count++;};
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
for(const f of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js'])vm.runInContext(file(f),ctx);
const ev=code=>vm.runInContext(code,ctx);
const expected={2:1,4:3,6:2,9:2};
const MP=fs.readFileSync(path.resolve(__dirname,'../src/21b-multiplayer-lobby.js'),'utf8');
check(/const MP_VERSION=(6|7|8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(MP),'shaped arenas require a new multiplayer geometry version');

function route(from,to,y){
 const size=ctx.mapSize,at=(x,z)=>z*size+x;
 const start=at(Math.floor(from.x),Math.floor(from.z)),goal=at(Math.floor(to.x),Math.floor(to.z));
 const prev=new Int32Array(size*size);prev.fill(-1);
 const q=new Int32Array(size*size);let head=0,tail=0;q[tail++]=start;prev[start]=start;
 while(head<tail&&prev[goal]===-1){
  const k=q[head++],x=k%size,z=(k/size)|0;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=x+dx,Z=z+dz,K=at(X,Z);
   if(X<1||Z<1||X>=size-1||Z>=size-1||ctx.mapCells[Z][X]||
      prev[K]!==-1||Math.abs(ctx.deckHeight(X+.5,Z+.5)-y)>.05)continue;
   prev[K]=k;q[tail++]=K;
  }
 }
 if(prev[goal]<0)return null;
 const nodes=[];
 for(let k=goal;;k=prev[k]){
  nodes.push({x:k%size+.5,z:Math.floor(k/size)+.5});
  if(k===start)break;
 }
 return nodes.reverse();
}
function movePlayer(p,to,y,label){
 for(let k=0;k<8;k++){
  ctx.moveEntity(p,(to.x-p.x)/(8-k),(to.z-p.z)/(8-k),.23);
  ctx.updateVertical(p,1/60);
  check(p.feetY>y-.06,`${label}: player fell from a real elevated platform`);
 }
 check(Math.hypot(p.x-to.x,p.z-to.z)<.25,`${label}: blocked by structure or railing`);
}
for(let level=1;level<=100;level++){
 ctx.glReady=false;ctx.buildMap(level);
 const style=(level-1)%18,features=ev('skyFeatureSpecs'),plans=ev('skyFeaturePlans');
 const wanted=expected[style]||0;
 check(features.length===wanted,`sector ${level}: ${features.length}/${wanted} elevated shapes installed`);
 check(plans.length===wanted,`sector ${level}: a shaped platform plan was lost`);
 const galleries=ev('gallerySpecs');
 for(const f of features){
  check(galleries[f.galleryIndex]&&Math.abs(galleries[f.galleryIndex].y-f.y)<.05,
   `sector ${level}: shape has no valid raised gallery entrance`);
  check(f.newCells>=18,`sector ${level}: shape is only a decorative fragment`);
  check(f.spawns.length>=2,`sector ${level}: no safe robot spawn locations on platform`);
  const cells=ev(`skyFeatureCells(skyFeaturePlans[${plans.indexOf(plans.find(s=>s.kind===f.kind&&s.cx===f.cx&&s.cz===f.cz))}])`);
  for(const {x,z} of cells){
   check(ctx.mapCells[z][x]===0,`sector ${level}: ground blocked beneath upper feature`);
   check(Math.abs(ctx.deckHeight(x+.5,z+.5)-f.y)<.05,
    `sector ${level}: broken upper deck cell (${x},${z})`);
  }
  const start=galleries[f.galleryIndex].spawns[0];
  const end=f.spawns[f.spawns.length-1];
  check(route(start,end,f.y)?.length>=2,`sector ${level}: elevated shape unreachable`);
  if(f.kind==='ring'){
   check(ctx.mapCells[f.cz][f.cx]===0,`sector ${level}: ring lightwell blocks ground`);
   check(ctx.deckHeight(f.cx+.5,f.cz+.5)===0,
    `sector ${level}: ring is a solid fake disk, not a hollow upper walkway`);
   for(const [dx,dz] of [[0,4],[0,-4],[4,0],[-4,0]]){
    check(Math.abs(ctx.deckHeight(f.cx+dx+.5,f.cz+dz+.5)-f.y)<.05,
     `sector ${level}: missing part of observation ring`);
   }
  }
 }
}

function physical(style,quality){
 ctx.glReady=true;ctx.touchOnly=quality===0;ctx.save.settings.quality=quality;
 ctx.buildMap(style+1);
 const features=ev('skyFeatureSpecs'),galleries=ev('gallerySpecs');
 const first=features[0],parent=galleries[first.galleryIndex];
 const target=first.spawns[first.spawns.length-1];
 const source=parent.spawns.reduce((best,p)=>
  Math.hypot(p.x-target.x,p.z-target.z)>Math.hypot(best.x-target.x,best.z-target.z)?p:best,
  parent.spawns[0]);
 const path=route(source,target,first.y);
 check(path&&path.length>=7,`style ${style}, quality ${quality}: shape not reachable by walking`);
 const p={x:path[0].x,z:path[0].z,feetY:first.y,grounded:true,vy:0};
 ctx.game={p,enemies:[],particles:[],t:0,idCounter:0,sector:style+1,spawned:0};
 for(let i=1;i<path.length;i++)movePlayer(p,path[i],first.y,`style ${style}, quality ${quality}, tile ${i}`);
 check(!ctx.worldSolidBodyCollision(p.x,p.z,.23,p.feetY,1.95),
  `style ${style}, quality ${quality}: platform collides with the player body`);
 check(!ctx.worldSolidBodyCollision(target.x,target.z,.23,0,1.95),
  `style ${style}, quality ${quality}: blocked lower floor beneath a platform`);
 check(ev('worldSolidCount')<15000,
  `style ${style}, quality ${quality}: too many static colliders for mobile`);

 // Real robots can spawn inside newly shaped combat zones, not just old bridges.
 ctx.game.p={x:ctx.spawnX,z:ctx.spawnZ,feetY:0};
 const positions=features.flatMap(f=>f.spawns);
 let spawned=0;
 for(let i=0;i<90;i++){
  const bot=ctx.randBalconySpawn(6,.48,1.9);
  if(bot&&positions.some(t=>Math.hypot(t.x-bot.x,t.z-bot.z)<.2)){
   spawned++;
   check(!ctx.worldSolidBodyCollision(bot.x,bot.z,.48,bot.feetY,1.9),
    `style ${style}, quality ${quality}: robot spawns inside rail`);
  }
 }
 check(spawned>=10,`style ${style}, quality ${quality}: no upper robot spawns on new shapes`);
 ctx.game.p=p;

 // A bot begins on the older gallery and pursues the player inside the new
 // upper room using the exact same physics and enemy pathfinding as gameplay.
 const e={id:9,x:source.x,z:source.z,feetY:first.y,type:'scout',maxhp:100,
  radius:.45,orbit:1,airborne:false};
 ctx.game.enemies=[e];let reached=false,lowest=first.y;
 for(let i=0;i<1350;i++){
  const h=ctx.enemyHeading(e,p);
  ctx.enemyMove(e,h.dx*.075,h.dz*.075,.23);
  ctx.game.t+=.033;lowest=Math.min(lowest,e.feetY);
  if(Math.hypot(e.x-p.x,e.z-p.z)<1.15){reached=true;break;}
 }
 check(reached&&lowest>first.y-.3,
  `style ${style}, quality ${quality}: robot cannot pursue player in upper room `+
  `(enemy ${e.x.toFixed(1)},${e.z.toFixed(1)},${e.feetY.toFixed(2)})`);
 if(first.kind==='ring'){
  // Traverse a full closed circuit around the actual 5x5 open shaft.
  const way=[];
  for(let dx=-4;dx<=4;dx++)way.push({x:first.cx+dx+.5,z:first.cz-4+.5});
  for(let dz=-3;dz<=4;dz++)way.push({x:first.cx+4+.5,z:first.cz+dz+.5});
  for(let dx=3;dx>=-4;dx--)way.push({x:first.cx+dx+.5,z:first.cz+4+.5});
  for(let dz=3;dz>=-4;dz--)way.push({x:first.cx-4+.5,z:first.cz+dz+.5});
  p.x=way[0].x;p.z=way[0].z;p.feetY=first.y;p.grounded=true;p.vy=0;
  ctx.game.enemies=[];
  for(let i=1;i<way.length;i++)movePlayer(p,way[i],first.y,
   `style ${style}, quality ${quality}, ring circuit ${i}`);
  // Vault the inward-facing rail into the real lightwell and land below.
  p.x=first.cx+3.35;p.z=first.cz+.5;p.feetY=first.y;p.grounded=true;p.vy=0;
  ctx.input.jumpQueued=true;
  for(let i=0;i<12;i++)ctx.updateVertical(p,1/60);
  for(let i=0;i<105;i++){
   ctx.moveEntity(p,-.045,0,.23);ctx.updateVertical(p,1/60);
  }
  check(p.x<first.cx+2.6&&p.feetY<first.y-.7,
   `style ${style}, quality ${quality}: cannot jump into hollow ring centre `+
   `at x=${p.x.toFixed(2)}, z=${p.z.toFixed(2)}, feet=${p.feetY.toFixed(2)}, `+
   `ring=${first.cx},${first.cz}, y=${first.y}, `+
   `deck=${ctx.deckHeight(p.x,p.z)}, floor=${ctx.floorHeight(p.x,p.z)}, `+
   `beam=${ctx.worldSolidStandingSupport(p.x,p.z,.23,p.feetY)}, `+
   `boxes=${JSON.stringify(ev(`worldSolidGrid[${Math.floor(p.z)}*mapSize+${Math.floor(p.x)}]`)
    .filter(s=>Math.abs(s.box[4]-p.feetY)<.055).map(s=>s.box).slice(0,3))}`);
 }
}
for(const style of [2,4,6,9])for(const quality of [0,2])physical(style,quality);
console.log(`Stage52: ${count} shaped maps, rings, pathfinding, spawns and real-physics checks passed`);
