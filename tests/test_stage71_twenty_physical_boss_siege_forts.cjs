'use strict';
// No visual-only bastions: every new column and aerial siege beam is rendered
// through the SAME AABB as walking-player, AI body, hitscan and rocket physics.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
let checks=0;
const check=(condition,description)=>{assert.ok(condition,description);checks++;};
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
 bossNames:['БОСС'],robotPalette:()=>({}),toast:()=>{},game:null,navField:null,navClock:0};
vm.createContext(ctx);
for(const file of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js'])
 vm.runInContext(source(file),ctx,{filename:file});
const ev=s=>vm.runInContext(s,ctx);
check(/const GAME_BUILD='(71|72|73|74|75|76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),'Stage71-or-newer release');
check(/const MP_VERSION=(24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(source('21b-multiplayer-lobby.js')),
 'changed combat geometry requires an incompatible multiplayer handshake');
const exact=b=>b.map(x=>x.toFixed(5)).join('|');
const identities=new Set(),kinds=new Array(5).fill(0),perLevelGeometry=new Map();
let worlds=0,bossWorlds=0,regularWorlds=0,registered=0,foundations=0;
let impactHits=0,shellHits=0,bodyHits=0,landingHits=0,headHits=0;
let externalHits=0,clipped=0,walkable=0,underpasses=0;
for(let level=1;level<=100;level++)for(const quality of [0,2]){
 ctx.glReady=true;ctx.touchOnly=quality===0;ctx.save.settings.quality=quality;
 ctx.buildMap(level);worlds++;
 const plan=ev('bossApproachPlan'),roof=ctx.ceilingHeight();
 const parts=ctx.bossSiegeBoxes(level,plan,roof);
 if(level%5!==0){
  regularWorlds++;
  check(plan===null&&parts.length===0,
   `L${level}: no fortress should appear in an ordinary 4.25-12m hall`);
  continue;
 }
 bossWorlds++;
 check(plan&&parts.length>=18,`L${level}: grand siege architecture absent (${parts.length} parts)`);
 check(plan.kind>=0&&plan.kind<5&&plan.variant>=0&&plan.variant<4,
  `L${level}: invalid siege identity`);
 check(roof>=17.5,`L${level}: boss hall lost its monumental ceiling`);
 const localSignature=parts.filter(p=>p.role!=='wallFoundation'&&
  p.role!=='foundationCrown').map(p=>{
   const b=p.box;
   const rotated=[ctx.tacticalRotate(b[0]-(plan.cx+.5),b[2]-(plan.cz+.5),
    (4-plan.orientation)%4),
    ctx.tacticalRotate(b[3]-(plan.cx+.5),b[5]-(plan.cz+.5),
     (4-plan.orientation)%4)];
   const x0=Math.min(...rotated.map(r=>r.x));
   const x1=Math.max(...rotated.map(r=>r.x));
   const z0=Math.min(...rotated.map(r=>r.z));
   const z1=Math.max(...rotated.map(r=>r.z));
   return `${p.role}:${[x0,z0,x1,z1].map(v=>v.toFixed(3))}`;
  }).sort().join('|');
 if(quality===0){
  check(!identities.has(localSignature),`L${level}: repeating physical boss skyline`);
  identities.add(localSignature);kinds[plan.kind]++;
  perLevelGeometry.set(level,JSON.stringify(parts.map(p=>p.box)));
 }else check(perLevelGeometry.get(level)===JSON.stringify(parts.map(p=>p.box)),
  `L${level}: physical geometry changed at low quality`);
 const solids=new Set(ev('worldSolidGrid').flatMap(s=>s||[]).map(s=>exact(s.box)));
 let visible=0,bases=0,available=[];
 for(const part of parts){
  const b=part.box;
  check(b.every(Number.isFinite)&&b[3]>b[0]&&b[4]>b[1]&&b[5]>b[2],
   `L${level}: malformed siege AABB`);
  check(b[4]<=roof-.90+1e-7,`L${level}: pier extends through boss ceiling`);
  if(part.role==='wallFoundation'){
   bases++;foundations++;
   const insideX=Math.floor((b[0]+b[3])/2),insideZ=Math.floor((b[2]+b[5])/2);
   check(ctx.mapCells[insideZ]?.[insideX]===1,
    `L${level}: new floor-height column blocks robot-accessible tile`);
   check(b[3]-b[0]<=1.04&&b[5]-b[2]<=1.04,
    `L${level}: column protrudes too far into walking network`);
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    if(ctx.mapCells[insideZ+dz]?.[insideX+dx]!==0)continue;
    const px=insideX+dx+.5,pz=insideZ+dz+.5;
    const cx=Math.max(b[0],Math.min(px,b[3]));
    const cz=Math.max(b[2],Math.min(pz,b[5]));
    check(Math.hypot(px-cx,pz-cz)>.26+1e-6,
     `L${level}: new wall column traps a 26cm grounded robot`);
   }
  }
  if(!solids.has(exact(b))){clipped++;continue;}
  visible++;registered++;available.push(part);
  if(b[1]>3.0){
   // Stage71 never reduces ground-level clearance for walking characters.
   for(let z=Math.max(1,Math.floor(b[2]));z<=Math.min(ctx.mapSize-2,Math.floor(b[5]));z++)
    for(let x=Math.max(1,Math.floor(b[0]));x<=Math.min(ctx.mapSize-2,Math.floor(b[3]));x++){
     if(ctx.mapCells[z][x]!==0)continue;
     const foot=Math.max(ctx.floorHeightAtCell(x,z),ctx.deckAtCell(x,z));
     check(b[1]>=foot+2.25-1e-6,
      `L${level}: fortress clips upper route or player head at ${x},${z}`);
     underpasses++;
    }
  }
 }
 check(visible>=14&&bases>=3,
  `L${level}: large parts of boss fort missing (solid=${visible}, foundations=${bases})`);
 // Build-grid walking routes remain accessible to normal robots, without
 // teleport, flight, or disabling any solid's collision to fake a passage.
 const canReach=(sx,sz,tx,tz)=>{
  const n=ctx.mapSize,visit=new Uint8Array(n*n),q=new Int32Array(n*n);
  let start=0,end=0;
  const a=Math.floor(sz)*n+Math.floor(sx),target=Math.floor(tz)*n+Math.floor(tx);
  visit[a]=1;q[end++]=a;
  while(start<end){
   const pos=q[start++];if(pos===target)return true;
   const x=pos%n,z=Math.floor(pos/n);
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const X=x+dx,Z=z+dz,idx=Z*n+X;
    if(X<1||Z<1||X>=n-1||Z>=n-1||visit[idx]||
      ctx.mapCells[Z][X]||!ctx.enemyNavEdge(x,z,X,Z))continue;
    visit[idx]=1;q[end++]=idx;
   }
  }
  return false;
 };
 check(canReach(ctx.spawnX,ctx.spawnZ,plan.cx+.5,plan.cz+.5),
  `L${level}: AI cannot walk to the new siege fort`);
 walkable++;
 // Representative aerial beams HAVE ballistic, splash-projectile and body
 // collision at the exact points of their rendered geometry.
 const airborne=available.filter(p=>p.box[1]>3.0);
 check(airborne.length>=8,`L${level}: too few physical aerial cover segments`);
 for(const part of airborne.slice(0,5)){
  const b=part.box,mx=(b[0]+b[3])/2,mz=(b[2]+b[5])/2;
  const my=(b[1]+b[4])/2,o={x:mx,y:my,z:mz},d={x:1,y:0,z:0};
  const shot=ctx.rayWall(o,d,.08),shell=ctx.sweepWorldSphere(o,d,.08,.07);
  check(shot&&shot.t<.001,`L${level}: drawn beam is transparent to bullets`);
  impactHits++;
  check(shell&&shell.t<.001,`L${level}: drawn beam is transparent to rockets`);
  shellHits++;
  check(ctx.worldSolidBodyCollision(mx,mz,.11,b[1]-.045,.42),
   `L${level}: drawn beam has no player/robot collision`);
  bodyHits++;
  const stand=ctx.worldSolidStandingSupport(mx,mz,.11,b[4],.02);
  check(stand!==null&&Math.abs(stand-b[4])<.021,
   `L${level}: player cannot stand on the physical beam after landing`);
  landingHits++;
  const down=ctx.worldSolidFeetBarrier(mx,mz,.11,b[4]+.15,b[4]-.15);
  check(down!==null&&down>=b[4]-.02,
   `L${level}: player falls through airborne siege beam`);
  const up=ctx.worldSolidHeadBarrier(mx,mz,.11,b[1]-.26,b[1]+.08);
  check(up!==null&&up<=b[1]+.015,
   `L${level}: operator can jump through underside of siege beam`);
  headHits++;
 }
 // A bullet shot FROM EMPTY AIR into the underside must physically hit the
 // fortress; this is stronger evidence than beginning a test inside a wall.
 let outward=false;
 for(const part of airborne){
  const b=part.box,mx=(b[0]+b[3])/2,mz=(b[2]+b[5])/2;
  const x=Math.floor(mx),z=Math.floor(mz);
  if(ctx.mapCells[z]?.[x]!==0||
     b[1]<Math.max(ctx.floorHeightAtCell(x,z),ctx.deckAtCell(x,z))+2.65)continue;
  const o={x:mx,y:b[1]-.36,z:mz},d={x:0,y:1,z:0};
  const hit=ctx.rayWall(o,d,.60),rocket=ctx.sweepWorldSphere(o,d,.60,.06);
  if(!hit||hit.kind!=='structure'||hit.t>.38||
     !rocket||rocket.t>.38)continue;
  outward=true;externalHits++;
  break;
 }
 check(outward,`L${level}: no accessible beam stops bullets from BELOW in open sky`);
}
check(worlds===200&&bossWorlds===40&&regularWorlds===160&&
 identities.size===20&&kinds.every(n=>n===4)&&walkable===40&&
 impactHits===200&&shellHits===200&&bodyHits===200&&
 landingHits===200&&headHits===200&&externalHits===40&&
 registered>=300&&foundations>=100&&underpasses>=500,
 'missing boss world, unphysical siege module, walkthrough route, or collidable shot');
console.log(`Stage71: ${checks} checks PASS; 20 unique boss siege forts, `+
 `${registered} registered pieces, ${foundations} wall-anchored supports, `+
 `${impactHits} hitscan + ${shellHits} rocket + ${bodyHits} body tests, `+
 `${landingHits} landings + ${headHits} swept head contacts, `+
 `${externalHits} shots from empty air, `+
 `${walkable} grounded robot approaches, ${underpasses} 2.25m headroom audits, `+
 `${clipped} skipped parts (render AND physics).`);
