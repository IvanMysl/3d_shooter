'use strict';
// Stage54: the entire visible tactical tier is also in player, robot, bullet,
// rocket and blast physics. Test map generation on EVERY campaign level.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
let checks=0;
function check(value,message){assert.ok(value,message);checks++;}
const drawings=[];
const ctx={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],
 legacyResumeSector:-1,legacyResumeDivisor:18,glReady:false,touchOnly:false,
 gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:(dst,...args)=>{drawings.push(args.slice(0,6));},
 quad:()=>{},rcolor:c=>c,save:{settings:{quality:0,audio:false}},
 sound:()=>{},burst:()=>{},input:{jumpQueued:false},arsenalOpened:false,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['БОСС'],robotPalette:()=>({}),toast:()=>{},game:null,
 navField:null,navClock:0};
vm.createContext(ctx);
for(const file of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js'])vm.runInContext(source(file),ctx);
const ev=s=>vm.runInContext(s,ctx);
check(/const GAME_BUILD='(54|55|56|57|58|59|60|61|62|63|64|65|66|67|68|69|70|71|72|73|74|75|76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),'Stage54 build id');
check(/const MP_VERSION=(8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(source('21b-multiplayer-lobby.js')),
 'changed physical terrain must reject clients with old geometry');
const active=new Set([2,4,6,9]);
function foot(s,side){
 const u=side*(4+s.steps);
 return {x:s.axis==='x'?s.cx+u+.5:s.cx+.5,
  z:s.axis==='z'?s.cz+u+.5:s.cz+.5};
}
function reachableFromHub(tx,tz){
 const n=ctx.mapSize,start=Math.floor(ctx.spawnZ)*n+Math.floor(ctx.spawnX);
 const last=Math.floor(tz)*n+Math.floor(tx);
 const queue=new Int32Array(n*n),seen=new Uint8Array(n*n);
 let head=0,tail=0;queue[tail++]=start;seen[start]=1;
 while(head<tail){
  const k=queue[head++];if(k===last)return true;
  const x=k%n,z=Math.floor(k/n);
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=x+dx,Z=z+dz,J=Z*n+X;
   if(X<1||Z<1||X>=n-1||Z>=n-1||seen[J]||ctx.mapCells[Z][X]||
      !ctx.enemyNavEdge(x,z,X,Z))continue;
   seen[J]=1;queue[tail++]=J;
  }
 }
 return false;
}
for(let sector=1;sector<=100;sector++){
 ctx.glReady=false;ctx.buildMap(sector);
 const style=(sector-1)%18,plans=ev('midlevelPlans'),specs=ev('midlevelSpecs');
 const wanted=active.has(style)?2:0;
 check(plans.length===wanted,`sector ${sector}: new tier plans ${plans.length}/${wanted}`);
 check(specs.length===wanted,`sector ${sector}: new tier realization ${specs.length}/${wanted}`);
 if(wanted)check(ctx.floorHeight(ctx.spawnX,ctx.spawnZ)===0,
  `sector ${sector}: ground-level player spawn is no longer flat`);
 for(const s of specs){
  check(s.steps===5||s.steps===7,`sector ${sector}: bad step count`);
  check(Math.abs(s.y-s.steps*.22)<.00001,`sector ${sector}: wrong height`);
  const cells=ev(`midlevelCells(${JSON.stringify({cx:s.cx,cz:s.cz,axis:s.axis,steps:s.steps,wing:s.wing})})`);
  const roofTiles=new Set((ev(`midlevelRoofDeckCells(${JSON.stringify(s)})`)).map(p=>p.z*ctx.mapSize+p.x));
  check(cells.length===s.cells,`sector ${sector}: missing planned steps`);
  for(const c of cells){
   check(ctx.mapCells[c.z]?.[c.x]===0,`sector ${sector}: closed midlevel tile`);
   check(Math.abs(ctx.floorHeight(c.x+.5,c.z+.5)-c.h)<.00001,
    `sector ${sector}: invisible or unphysical raised terrain (${c.x},${c.z})`);
   const expectedRoof=roofTiles.has(c.z*ctx.mapSize+c.x)?s.roofY:0;
   check(Math.abs(ctx.deckHeight(c.x+.5,c.z+.5)-expectedRoof)<.01,
    `sector ${sector}: unexpected upper deck or missing guardhouse roof support`);
  }
  for(const side of [-1,1]){
   const p=foot(s,side);
   check(ctx.floorHeight(p.x,p.z)<.01,
    `sector ${sector}: lower stair entrance floats above the ground`);
   check(reachableFromHub(p.x,p.z),
    `sector ${sector}: disconnected ground entrance (${p.x},${p.z})`);
  }
  check(s.spawns.length>=5&&s.spawns.every(p=>
   Math.abs(ctx.floorHeight(p.x,p.z)-s.y)<.00001),
   `sector ${sector}: robot upper-tier spawns aren't physical`);
  // Walk every generated campaign variant, not just the four showcase maps.
  // This catches procedural sidewalls and partial staircase generation.
  const start=foot(s,-1),walker={x:start.x,z:start.z,feetY:0,grounded:true,vy:0};
  ctx.game={p:walker,enemies:[],particles:[],t:0};
  check(walkTo(walker,{x:s.cx+.5,z:s.cz+.5})<.12&&
     Math.abs(walker.feetY-s.y)<.05,
     `sector ${sector}: genuine player ascent failed on generated midlevel`);
 }
 ctx.game=null;
}
function walkTo(p,target){
 for(let k=0;k<1100;k++){
  const left=Math.hypot(target.x-p.x,target.z-p.z);
  if(left<.025)break;
  const amount=Math.min(.046,left);
  ctx.moveEntity(p,(target.x-p.x)/left*amount,(target.z-p.z)/left*amount,.23);
  ctx.updateVertical(p,1/60);
 }
 for(let t=0;t<8;t++)ctx.updateVertical(p,1/60);
 return Math.hypot(target.x-p.x,target.z-p.z);
}
// Exhaustive real-WebGL-geometry regression for every map seed in all four
// changed families and both quality tiers. Static room dressing varies by
// sector, so a showcase-only physics check could miss a blocked staircase.
for(let sector=1;sector<=100;sector++){
 const style=(sector-1)%18;if(!active.has(style))continue;
 for(const quality of [0,2]){
  ctx.glReady=true;ctx.touchOnly=quality===0;ctx.save.settings.quality=quality;
  drawings.length=0;ctx.buildMap(sector);
  const stairs=ev('midlevelSpecs');
  check(stairs.length===2,`sector ${sector}, q${quality}: lost upper courtyard`);
  for(const s of stairs){
   const start=foot(s,-1),p={x:start.x,z:start.z,feetY:0,grounded:true,vy:0};
   ctx.game={p,enemies:[],particles:[],t:0};
   check(walkTo(p,{x:s.cx+.5,z:s.cz+.5})<.12&&
         Math.abs(p.feetY-s.y)<.05,
    `sector ${sector}, q${quality}: decoration blocks real player ascent`);
   const b=ev(`midlevelCoverBoxes(midlevelSpecs.find(x=>x.cx===${s.cx}&&x.cz===${s.cz}))[0]`);
   const origin={x:b[0]-.055,y:(b[1]+b[4])*.5,z:(b[2]+b[5])*.5};
   const hit=ctx.rayWall(origin,{x:1,y:0,z:0},b[3]-b[0]+.11);
   check(hit?.kind==='structure'&&hit.t<=.056,
    `sector ${sector}, q${quality}: shot penetrates procedural upper cover`);
  }
 }
}
for(const style of [2,4,6,9])for(const quality of [0,2]){
 ctx.glReady=true;ctx.touchOnly=quality===0;ctx.save.settings.quality=quality;
 drawings.length=0;ctx.buildMap(style+1);
 const terraces=ev('midlevelSpecs');
 const original=ev('skyFeatureSpecs.length');
 check(terraces.length===2,`style${style}/${quality}: missing mid-height room`);
 check(original>0,`style${style}/${quality}: older sky architecture was lost`);
 check(ev('worldSolidCount')<17000,`style${style}/${quality}: mobile mesh budget`);
 ctx.game={p:{x:ctx.spawnX,z:ctx.spawnZ,feetY:0},enemies:[],particles:[],t:0};
 const generated=ctx.randMidlevelSpawn(4,.48,1.9);
 check(generated&&terraces.some(t=>Math.abs(generated.feetY-t.y)<.05)&&
  !ctx.worldSolidBodyCollision(generated.x,generated.z,.48,generated.feetY,1.9),
  `style${style}/${quality}: robot cannot safely spawn on a physical terrace`);
 for(const s of terraces){
  const dest={x:s.cx+.5,z:s.cz+.5};
  for(const side of [-1,1]){
   const start=foot(s,side),p={x:start.x,z:start.z,feetY:0,grounded:true,vy:0};
   ctx.game={p,enemies:[],particles:[],t:0,idCounter:0,sector:style+1,spawned:0};
   check(walkTo(p,dest)<.12,
    `style ${style}/${quality}: player stuck on ${s.steps}-step entrance ${side}`);
   check(Math.abs(p.feetY-s.y)<.05,
    `style ${style}/${quality}: player couldn't reach physical upper ground`);
   check(!ctx.worldSolidBodyCollision(p.x,p.z,.23,p.feetY,1.95),
    `style ${style}/${quality}: solid obstructs the top walkway`);
   check(walkTo(p,foot(s,-side))<.12,
    `style ${style}/${quality}: player cannot descend other staircase`);
   check(p.feetY<.05,
    `style ${style}/${quality}: player floats instead of landing on main floor`);
  }
  const covers=ev(`midlevelCoverBoxes(midlevelSpecs.find(x=>x.cx===${s.cx}&&x.cz===${s.cz}))`);
  check(covers.length===3,`style ${style}/${quality}: fewer than 3 physical covers`);
  for(const b of covers){
   const x=(b[0]+b[3])*.5,y=(b[1]+b[4])*.5,z=(b[2]+b[5])*.5;
   check(drawings.some(d=>d.every((v,i)=>Math.abs(v-b[i])<.0001)),
    `style ${style}/${quality}: collision-only invisible barricade`);
   check(ctx.worldSolidBodyCollision(x,z,.2,s.y,1.95),
    `style ${style}/${quality}: player walks through visible steel barricade`);
   // Fire from the SAME open tile, a few cm from the actual cover. Starting
   // farther away may place the muzzle inside an unrelated surrounding wall.
   const o={x:b[0]-.055,y,z},d={x:1,y:0,z:0},length=b[3]-b[0]+.11;
   const hit=ctx.rayWall(o,d,length);
   check(hit&&hit.kind==='structure'&&hit.t<=.056,
    `style ${style}/${quality}: hitscan bullet passed through steel cover ${JSON.stringify({b,hit})}`);
   const shell=ctx.sweepWorldSphere(o,d,length,.025);
   check(shell&&shell.kind==='structure'&&shell.t<=.056,
    `style ${style}/${quality}: rocket/plasma ball passed through steel cover`);
   const above=ctx.rayWall({x:o.x,y:b[4]+1.1,z},d,length);
   check(!above||above.t>length-.001,
    `style ${style}/${quality}: invisible wall exists above short cover`);
  }
  // Ground terrain is also a solid ballistic surface, not a picture:
  // the ramp's vertical riser blocks a low incoming bullet and a sphere.
  const side=-1,p=foot(s,side),u=side*(3+s.steps),
   tread=s.axis==='x'?{x:s.cx+u+.5,z:s.cz+.5}:
                         {x:s.cx+.5,z:s.cz+u+.5};
  const o={x:tread.x,y:.09,z:tread.z};
  const d=s.axis==='x'?{x:-side,y:0,z:0}:{x:0,y:0,z:-side};
  const floorHit=ctx.rayWall(o,d,1.4),sphereHit=ctx.sweepWorldSphere(o,d,1.4,.07);
  check(floorHit?.kind==='stairs'&&floorHit.t<=1.2,
   `style ${style}/${quality}: the first raised stair doesn't stop bullets`);
  check(sphereHit?.kind==='stairs'&&sphereHit.t<=1.2,
   `style ${style}/${quality}: the raised ground doesn't stop missiles`);
  // The real AI must use the accessible stairs, never clip through a side.
  const robot={id:9,x:p.x,z:p.z,feetY:0,type:'scout',maxhp:100,
   radius:.48,orbit:1,airborne:false};
  const target={x:dest.x,z:dest.z,feetY:s.y};
  ctx.game={p:target,enemies:[robot],particles:[],t:0,idCounter:9,sector:style+1};
  ctx.rebuildNavigation();
  let climbed=false;
  for(let frame=0;frame<950;frame++){
   const h=ctx.enemyHeading(robot,target);
   ctx.enemyMove(robot,h.dx*.065,h.dz*.065,.23);ctx.game.t+=.033;
   if(robot.feetY>s.y-.28&&Math.hypot(robot.x-dest.x,robot.z-dest.z)<1.2){climbed=true;break;}
  }
  check(climbed,`style ${style}/${quality}: walking robot cannot reach raised terrace`);
 }
}
console.log(`Stage54: ${checks} 100-level, physical terraces, real obstacles, bullets, projectiles, and AI checks passed`);
