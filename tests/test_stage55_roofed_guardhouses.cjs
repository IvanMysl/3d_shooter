'use strict';
// Stage55: windows must REALLY be holes, frames/roof/door must block every
// relevant physics system, and geometry must agree for all procedural seeds.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
let checks=0;
function check(ok,message){assert.ok(ok,message);checks++;}
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
const active=new Set([2,4,6,9]);
check(/const GAME_BUILD='(55|56|57|58|59|60|61|62|63|64|65|66|67|68|69|70|71|72|73|74|75|76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),'V55+ build stamp');
check(/const MP_VERSION=(9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(source('21b-multiplayer-lobby.js')),
 'V55 map physics must be incompatible with previous netmaps');

const position=(s,u,v)=>s.axis==='x'?
 {x:s.cx+u+.5,z:s.cz+s.wing*v+(s.wing<0?1:0)}:
 {x:s.cx+s.wing*v+(s.wing<0?1:0),z:s.cz+u+.5};
const horizontal=(s,du,dv)=>s.axis==='x'?
 {x:du,z:s.wing*dv}:
 {x:s.wing*dv,z:du};
const close=(a,b,tol=.0001)=>Math.abs(a-b)<tol;
const sameBox=(a,b)=>a.every((v,i)=>close(v,b[i]));
const boxInPhysicalMesh=b=>{
 const grid=ev('worldSolidGrid');
 const x=Math.floor((b[0]+b[3])*.5),z=Math.floor((b[2]+b[5])*.5);
 for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)
  if((grid[(z+dz)*ctx.mapSize+x+dx]||[]).some(s=>sameBox(b,s.box)))return true;
 return false;
};
const ray=(p,d,L)=>ctx.rayWall({x:p.x,y:p.y,z:p.z},d,L);
const projectile=(p,d,L)=>ctx.sweepWorldSphere({x:p.x,y:p.y,z:p.z},d,L,.025);
function walk(p,target){
 for(let step=0;step<800;step++){
  const len=Math.hypot(target.x-p.x,target.z-p.z);
  if(len<.03)break;
  const q=Math.min(.045,len);
  ctx.moveEntity(p,(target.x-p.x)/len*q,(target.z-p.z)/len*q,.23);
  ctx.updateVertical(p,1/60);
 }
 for(let t=0;t<10;t++)ctx.updateVertical(p,1/60);
 return Math.hypot(target.x-p.x,target.z-p.z);
}
// Map topology is deterministic across the entire hundred-level campaign.
for(let level=1;level<=100;level++){
 ctx.glReady=false;ctx.buildMap(level);
 const specs=ev('midlevelSpecs'),expected=active.has((level-1)%18)?2:0;
 check(specs.length===expected,`level${level}: ${specs.length}/${expected} guardhouses`);
 for(const spec of specs){
  const houses=ev(`midlevelShelterBoxes(midlevelSpecs.find(s=>s.cx===${spec.cx}&&s.cz===${spec.cz}))`);
  check(houses.length===9,`level${level}: nine physical pieces are required`);
  check(new Set(houses.map(x=>x.role)).size===9,`level${level}: unique roles`);
  const fireEscape=new Map(ev(`midlevelRoofStairCells(${JSON.stringify(spec)})`)
   .map(p=>[p.z*ctx.mapSize+p.x,p.h]));
  for(const p of ev(`midlevelShelterBufferCells(midlevelSpecs.find(s=>s.cx===${spec.cx}&&s.cz===${spec.cz}))`)){
   check(ctx.mapCells[p.z]?.[p.x]===0,`level${level}: window exits into a concrete wall`);
   const expected=fireEscape.get(p.z*ctx.mapSize+p.x)||0;
   check(close(ctx.floorHeight(p.x+.5,p.z+.5),expected),
    `level${level}: exterior buffer overlaps unrelated stairs at ${p.x}/${p.z}`);
   check(ctx.deckHeight(p.x+.5,p.z+.5)<.01,
    `level${level}: shelter exterior overlaps a suspended gallery at ${p.x}/${p.z}`);
  }
  for(const piece of houses){
   const b=piece.box;
   check(b.length===6&&b.every(Number.isFinite)&&b[0]<b[3]&&b[1]<b[4]&&b[2]<b[5],
    `level${level}: invalid guardhouse wall ${piece.role}`);
   check(b[1]>=spec.y-.001&&b[4]<ctx.ceilingHeight(),
    `level${level}: wall below terrain or above world ceiling`);
  }
  check(spec.spawns.some(p=>{const inside=position(spec,0,3.5);
   return Math.hypot(inside.x-p.x,inside.z-p.z)<.1;}),
   `level${level}: enemies never spawn inside guarded wing`);
 }
}
// In every real WebGL mesh, match EVERY visible physical piece to the precise
// AABB used by both hitscan and moving projectiles on high and low graphics.
for(let level=1;level<=100;level++){
 if(!active.has((level-1)%18))continue;
 for(const quality of [0,2]){
  ctx.glReady=true;ctx.touchOnly=quality===0;ctx.save.settings.quality=quality;
  drawings.length=0;ctx.buildMap(level);
  const specs=ev('midlevelSpecs');
  check(specs.length===2,`level${level}, q${quality}: missing houses`);
  for(const spec of specs){
   const pieces=ev(`midlevelShelterBoxes(midlevelSpecs.find(s=>s.cx===${spec.cx}&&s.cz===${spec.cz}))`);
   for(const piece of pieces){
    check(drawings.some(b=>sameBox(b,piece.box)),
     `level${level}, q${quality}: invisible collision wall ${piece.role}`);
    check(boxInPhysicalMesh(piece.box),
     `level${level}, q${quality}: drawable ${piece.role} doesn't stop bullets`);
   }
   const p=position(spec,0,3.5),inside={...p,feetY:spec.y,grounded:true,vy:0};
   ctx.game={p:{x:ctx.spawnX,z:ctx.spawnZ,feetY:0},enemies:[],particles:[],t:0};
   check(!ctx.worldSolidBodyCollision(inside.x,inside.z,.23,spec.y,1.95),
    `level${level}, q${quality}: doorway or roof traps player`);
   check(ctx.enemySpawnSpaceClear(inside.x,inside.z,.48,1.9,spec.y),
    `level${level}, q${quality}: robots cannot stand inside guardhouse`);
   // A 1.4m-high beam crosses each transparent OPEN window; the same beam
   // below the sill and above the glass opening must be blocked by STEEL.
   for(const side of [-1,1]){
    const from=position(spec,side<0?-.65:.95,3.5);
    const dv=horizontal(spec,side,0),d={x:dv.x,y:0,z:dv.z},L=1.25;
    for(const [label,h,blocked] of [['sill',.45,true],['window',1.37,false],
     ['header',2.10,true]]){
     const origin={...from,y:spec.y+h};
     const hit=ray(origin,d,L),shot=projectile(origin,d,L);
     check(blocked?hit?.kind==='structure':!hit,
      `level${level}, q${quality}: ${label} hitscan wrong on side${side} (${JSON.stringify(hit)})`);
     check(blocked?shot?.kind==='structure':!shot,
      `level${level}, q${quality}: ${label} moving sphere wrong on side${side} (${JSON.stringify(shot)})`);
    }
    const frame=pieces.find(part=>part.role===(side<0?'leftSill':'rightSill')).box;
    check(ctx.worldSolidBodyCollision((frame[0]+frame[3])*.5,
     (frame[2]+frame[5])*.5,.23,spec.y,1.95),
     `level${level}, q${quality}: operator can step through window sill`);
   }
   // Door is a genuine 2.24m-tall opening with physical overhead lintel.
   const doorApproach=position(spec,0,2.60),forward=horizontal(spec,0,1);
   for(const [h,blocked] of [[1.35,false],[2.40,true]]){
    const o={...doorApproach,y:spec.y+h},d={x:forward.x,y:0,z:forward.z};
    check(blocked?ray(o,d,1)?.kind==='structure':!ray(o,d,1),
     `level${level}, q${quality}: door opening is not physically ${blocked?'closed':'open'} at ${h}`);
   }
   // Roof stops upward bullets and swept jump heads; just below it the
   // player's body fits. The real upper surface supports a descending suit.
   const up={x:0,y:1,z:0},roofOrigin={...p,y:spec.y+2.32};
   const roofHit=ray(roofOrigin,up,.8),roofShell=projectile(roofOrigin,up,.8);
   check(roofHit?.kind==='structure'&&roofHit.t<.40,
    `level${level}, q${quality}: bullets fly through the guardhouse roof`);
   check(roofShell?.kind==='structure'&&roofShell.t<.40,
    `level${level}, q${quality}: rockets fly through the guardhouse roof`);
   const lowerRoof=pieces.find(part=>part.role==='roof').box[1];
   check(close(ctx.worldSolidHeadBarrier(p.x,p.z,.23,spec.y+2.48,spec.y+2.8),
    lowerRoof),`level${level}, q${quality}: player jumps through roof`);
   check(close(ctx.worldSolidFeetBarrier(p.x,p.z,.23,spec.y+3.06,spec.y+2.70),
    spec.y+2.84),`level${level}, q${quality}: flying player falls through roof`);
   const towardBack=horizontal(spec,0,1),backOrigin={...position(spec,0,4.1),y:spec.y+1.36};
   check(ray(backOrigin,{x:towardBack.x,y:0,z:towardBack.z},1.2)?.kind==='structure',
    `level${level}, q${quality}: back wall cannot stop shots`);
   // Step through the door on foot. Both ground level and the midheight
   // terrace remain accessible without flight, with no invisible blockers.
   const start=position(spec,0,.5),walker={...start,feetY:spec.y,grounded:true,vy:0};
   ctx.game={p:walker,enemies:[],particles:[],t:0};
   check(walk(walker,position(spec,0,3.5))<.13,
    `level${level}, q${quality}: player cannot walk through open guardhouse doorway`);
  }
 }
}
// Actual robot movement, not just pathfinding annotations: a walking enemy
// can enter the door from the main open midheight terrace in either graphics
// mode, in all four map families (including mirrored wings).
for(const style of [2,4,6,9])for(const quality of [0,2]){
 ctx.glReady=true;ctx.touchOnly=quality===0;ctx.save.settings.quality=quality;
 ctx.buildMap(style+1);
 for(const s of ev('midlevelSpecs')){
  const from=position(s,0,.5),target=position(s,0,3.5);
  const robot={id:55,x:from.x,z:from.z,feetY:s.y,type:'scout',maxhp:100,
   radius:.48,orbit:1,airborne:false};
  const player={...target,feetY:s.y};
  ctx.game={p:player,enemies:[robot],particles:[],t:0,idCounter:55,sector:style+1};
  ctx.rebuildNavigation();
  let arrived=false;
  for(let f=0;f<240;f++){
   const direction=ctx.enemyHeading(robot,player);
   ctx.enemyMove(robot,direction.dx*.055,direction.dz*.055,.23);
   ctx.game.t+=.033;
   if(Math.hypot(robot.x-target.x,robot.z-target.z)<.65){arrived=true;break;}
  }
  check(arrived,`style${style}, q${quality}: robot cannot enter the guardhouse door`);
 }
}
console.log(`Stage55: ${checks} map, window, door, roof, robot, ballistic and rendering checks passed`);
