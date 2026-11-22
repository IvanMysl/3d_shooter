'use strict';
// Stage51: sky galleries are physical walkways, not decorative meshes.
// Exercise every campaign layout and real movement/collision on mobile/PC
// graphics settings without requiring a GPU-equipped browser.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const file=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
let checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
const ctx={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,lo,hi)=>Math.min(hi,Math.max(lo,v)),
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
const ev=s=>vm.runInContext(s,ctx);
const selected=new Set([2,4,6,9]);
const MP=fs.readFileSync(path.resolve(__dirname,'../src/21b-multiplayer-lobby.js'),'utf8');
check(/const MP_VERSION=(5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(MP), 'geometry/network protocol must reject Stage50 peers');

// Independently verify connected upper deck surfaces from balcony to
// balcony. Comparing the same authoritative height field as physics/rendering
// prevents false positives from an abstract graphic-only path.
function upperPath(from,to,altitude){
 const n=ctx.mapSize,q=[{x:Math.floor(from.x),z:Math.floor(from.z)}],
  came=new Map([[q[0].z*n+q[0].x,null]]);
 let goal=null;
 for(let head=0;head<q.length;head++){
  const {x,z}=q[head],k=z*n+x;
  if(x===Math.floor(to.x)&&z===Math.floor(to.z)){goal=k;break;}
  for(const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0]]){
   const X=x+dx,Z=z+dz,K=Z*n+X;
   if(X<1||Z<1||X>=n-1||Z>=n-1||came.has(K)||ctx.mapCells[Z][X]||
      Math.abs(ctx.deckHeight(X+.5,Z+.5)-altitude)>.05)continue;
   came.set(K,k);q.push({x:X,z:Z});
  }
 }
 if(goal===null)return null;
 const reverse=[];
 for(let k=goal;k!==null;k=came.get(k))reverse.push({x:k%n+.5,z:Math.floor(k/n)+.5});
 return reverse.reverse();
}
for(let level=1;level<=100;level++){
 ctx.glReady=false;ctx.buildMap(level);
 const style=(level-1)%18;
 const plans=ev('galleryPlans'),galleries=ev('gallerySpecs'),balconies=ev('balconySpecs');
 if(selected.has(style)){
  const expected={2:2,4:2,6:1,9:3}[style];
  check(galleries.length===expected,
    `sector ${level}: expected ${expected} upper galleries, got ${galleries.length}`);
  for(const gallery of galleries){
   const a=balconies.find(b=>b.planIndex===gallery.from),
    b=balconies.find(b=>b.planIndex===gallery.to);
   check(!!a&&!!b,`sector ${level}: gallery is missing a stair-accessible endpoint`);
   check(Math.abs(a.y-b.y)<.01,`sector ${level}: gallery joins mismatched heights`);
   check(gallery.newCells>=20,`sector ${level}: not a substantial elevated span`);
   check(gallery.spawns.length>=3,`sector ${level}: gallery lacks upper robot spawn points`);
   const route=upperPath({x:a.cx+.5,z:a.cz+.5},{x:b.cx+.5,z:b.cz+.5},a.y);
   check(route&&route.length>=14,`sector ${level}: gallery is not a long traversable upper path`);
   for(const {x,z} of route){
    check(ctx.mapCells[Math.floor(z)][Math.floor(x)]===0,
      `sector ${level}: wall interrupts upper path`);
    check(Math.abs(ctx.deckHeight(x,z)-a.y)<.05,
      `sector ${level}: upper path has a missing floor tile`);
   }
  }
  check(plans.length>=galleries.length,`sector ${level}: realized galleries exceed plans`);
 }else check(galleries.length===0&&plans.length===0,
  `sector ${level}: unrelated level acquired gallery geometry`);
}

function activeWorld(style,quality){
 ctx.glReady=true;ctx.save.settings.quality=quality;ctx.buildMap(style+1);
 const g=ev('gallerySpecs[0]'),balconies=ev('balconySpecs');
 const a=balconies.find(b=>b.planIndex===g.from),b=balconies.find(b=>b.planIndex===g.to);
 const path=upperPath({x:a.cx+.5,z:a.cz+.5},{x:b.cx+.5,z:b.cz+.5},g.y);
 check(path.length>=14,`style ${style}, quality ${quality}: missing physical gallery`);
 const p={x:path[0].x,z:path[0].z,feetY:g.y,grounded:true,vy:0};
 ctx.game={p,enemies:[],particles:[],t:0,idCounter:0,sector:style+1,spawned:0};
 for(let i=1;i<path.length;i++){
  const dest=path[i];
  for(let k=0;k<7;k++){
   ctx.moveEntity(p,(dest.x-p.x)/Math.max(1,7-k),(dest.z-p.z)/Math.max(1,7-k),.23);
   ctx.updateVertical(p,1/60);
   check(p.feetY>g.y-.06,
    `style ${style}, quality ${quality}: pedestrian fell through gallery at path ${i}`);
  }
  check(Math.hypot(p.x-dest.x,p.z-dest.z)<.24,
   `style ${style}, quality ${quality}: pedestrian stuck against gallery rail at path ${i}`);
 }
 check(Math.hypot(p.x-b.cx-.5,p.z-b.cz-.5)<.5,
  `style ${style}, quality ${quality}: upper bridge does not reach far balcony`);
 check(!ctx.worldSolidBodyCollision(p.x,p.z,.23,p.feetY,1.95),
  `style ${style}, quality ${quality}: upper player body blocked at destination`);
 // Ground traffic still passes under the high gallery; it is NOT a second
 // entire map floor, and the original single story remains accessible.
 const midway=path[(path.length/2)|0];
 check(!ctx.worldSolidBodyCollision(midway.x,midway.z,.23,0,1.95),
  `style ${style}, quality ${quality}: overhead gallery blocks ground traffic`);
 check(ev('worldSolidCount')<15000,
  `style ${style}, quality ${quality}: excessive draw/collision geometry`);

 // Robots must appear ON the bridges as well as on the balcony landings.
 ctx.game.p={x:ctx.spawnX,z:ctx.spawnZ,feetY:0};
 const galleryPoints=ev('gallerySpecs.flatMap(s=>s.spawns)');
 let onGallery=0;
 for(let i=0;i<80;i++){
  const found=ctx.randBalconySpawn(6,.48,1.9);
  if(found&&galleryPoints.some(s=>Math.hypot(s.x-found.x,s.z-found.z)<.20)){
   onGallery++;
   check(!ctx.worldSolidBodyCollision(found.x,found.z,.48,found.feetY,1.9),
    `style ${style}, quality ${quality}: elevated robot intersects gallery rail`);
  }
 }
 check(onGallery>=10,`style ${style}, quality ${quality}: no practical robot spawns on gallery`);
 ctx.game.p=p;

 // One robot traverses a full multi-tile upper gallery to a standing player.
 // It must retain its raised foot level throughout its route.
 const e={id:7,x:a.cx+.5,z:a.cz+.5,feetY:g.y,type:'scout',maxhp:100,
  radius:.45,orbit:1,airborne:false};
 ctx.game.enemies=[e];
 let reached=false,minY=g.y;
 for(let i=0;i<1600;i++){
  const h=ctx.enemyHeading(e,p);
  ctx.enemyMove(e,h.dx*.075,h.dz*.075,.23);
  ctx.game.t+=.033;
  minY=Math.min(minY,e.feetY);
  if(Math.hypot(e.x-p.x,e.z-p.z)<1.15){reached=true;break;}
 }
 check(minY>g.y-.3,`style ${style}, quality ${quality}: robot fell from connected gallery`);
 check(reached,`style ${style}, quality ${quality}: robot cannot navigate connected gallery`);

 // An enemy starting on the sole lower floor must be able to enter via real
 // stairs and pursue a player in the middle of a high gallery.
 const approach=b.entry;
 e.x=approach.x+.5+(b.axis==='x'?b.side:0);
 e.z=approach.z+.5+(b.axis==='z'?b.side:0);
 e.feetY=0;e.balconyClimb=false;e.balconyGoal=null;
 p.x=midway.x;p.z=midway.z;p.feetY=g.y;
 reached=false;
 for(let i=0;i<1650;i++){
  const h=ctx.enemyHeading(e,p);
  ctx.enemyMove(e,h.dx*.075,h.dz*.075,.23);ctx.game.t+=.033;
  if(Math.hypot(e.x-p.x,e.z-p.z)<1.15&&e.feetY>g.y-.3){reached=true;break;}
 }
 check(reached,`style ${style}, quality ${quality}: robot cannot climb to the middle of a gallery; `+
  `robot (${e.x.toFixed(2)},${e.z.toFixed(2)},${e.feetY.toFixed(2)}), `+
  `player (${p.x.toFixed(2)},${p.z.toFixed(2)},${p.feetY.toFixed(2)}), goal ${e.balconyGoal}`);

 // In reverse, a bot far from the staircase must find the top landing along
 // the elevated network, go down the treads and reach a ground target.
 p.x=approach.x+.5+(b.axis==='x'?b.side:0);
 p.z=approach.z+.5+(b.axis==='z'?b.side:0);p.feetY=0;
 ctx.rebuildNavigation();
 reached=false;
 for(let i=0;i<1650;i++){
  const h=ctx.enemyHeading(e,p);
  ctx.enemyMove(e,h.dx*.075,h.dz*.075,.23);ctx.game.t+=.033;
  if(Math.hypot(e.x-p.x,e.z-p.z)<1.15&&e.feetY<.4){reached=true;break;}
 }
 check(reached,`style ${style}, quality ${quality}: robot cannot descend from a high gallery; `+
  `robot (${e.x.toFixed(2)},${e.z.toFixed(2)},${e.feetY.toFixed(2)}), `+
  `player (${p.x.toFixed(2)},${p.z.toFixed(2)},${p.feetY.toFixed(2)}), `+
  `heading ${JSON.stringify(ctx.enemyHeading(e,p))}`);
}
for(const style of [2,4,6,9])for(const quality of [0,2])activeWorld(style,quality);
console.log(`Stage51: ${checks} connected galleries, movement, robot and 100-sector checks passed`);
