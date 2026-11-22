'use strict';
// V82: all 80 ordinary levels must have a REAL, separately accessible
// outer relay fort with render-space and collision-space agreement.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0;
function check(value,why){assert.ok(value,why);checks++;}
const boxes=[];
const c={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],
 legacyResumeSector:-1,legacyResumeDivisor:18,glReady:true,touchOnly:false,
 gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:(dst,...args)=>{boxes.push(args.slice(0,6));},
 quad:()=>{},rcolor:v=>v,
 save:{settings:{quality:0,audio:false}},sound:()=>{},burst:()=>{},
 input:{jumpQueued:false},arsenalOpened:false,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['БОСС'],robotPalette:()=>({}),toast:()=>{},game:null,navField:null,navClock:0};
vm.createContext(c);
for(const name of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js'])
 vm.runInContext(src(name),c,{filename:name});
const ev=e=>vm.runInContext(e,c);
check(/const GAME_BUILD='(82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(src('00-core-save.js')),'correct build number');
check(/const MP_VERSION=(35|36|37|38|39|40|41|42)\b/.test(src('21b-multiplayer-lobby.js')),'physical-world multiplayer version');
const silhouettes=new Set();
const byKind=Array(8).fill(0),byVariant=Array(10).fill(0),radii=new Set();
let scenes=0,exposed=0,projectileSets=0,minimum=999,maximum=0,navigableTiles=0;
for(let level=1;level<=100;level++){
 if(level%5===0){
  c.glReady=false;c.buildMap(level);
  check(ev('relayFortPlan')===null,`L${level}: extra fort on boss map`);
  check(ev('bossCourtPlan')!==null,`L${level}: previous boss fort lost`);
  continue;
 }
 const ordinal=level-1-Math.floor(level/5);
 const kind=ordinal%8,variant=Math.floor(ordinal/8);
 // All ordinary maps at low/medium detail; every seventh at high detail.
 const qualities=level%7===1?[0,2]:[0];
 for(const quality of qualities){
  c.glReady=true;c.touchOnly=quality===0;c.save.settings.quality=quality;
  boxes.length=0;c.buildMap(level);scenes++;
  const p=ev('relayFortPlan');
  check(p!==null,`L${level}: missing relay fort`);
  check(p.kind===kind&&p.variant===variant,`L${level}: wrong relay family/signature`);
  check(p.name===ev(`relayFortNames[${kind}]`),`L${level}: wrong tactical landmark title`);
  check(p.radius>=3&&p.radius<=7,`L${level}: unsupported site radius`);
  check(p.tiles.length>=7,`L${level}: all physical walls rolled back (${p.tiles.length})`);
  minimum=Math.min(minimum,p.tiles.length);maximum=Math.max(maximum,p.tiles.length);
  radii.add(p.radius);
  const n=c.mapSize,r=p.radius,cx=p.cx,cz=p.cz,roof=c.ceilingHeight();
  const keyFor=(x,z)=>z*n+x;
  const wallKeys=new Set(p.tiles.map(q=>keyFor(q.x,q.z)));
  check(wallKeys.size===p.tiles.length,`L${level}: duplicate wall cells`);
  check(!c.collide(cx+.5,cz+.5,.3),`L${level}: outpost spawn trapped`);
  check(!c.collide(c.spawnX,c.spawnZ,.3),`L${level}: main spawn trapped`);
  check(!c.collide(c.portal.x,c.portal.z,.3),`L${level}: portal collides`);
  // The 5-cell-wide axes (3 cells in the microfort) may not become blocked.
  const clearance=p.radius===7?2:1;
  for(let z=-r;z<=r;z++)for(let x=-r;x<=r;x++){
   if(Math.abs(x)<=clearance||Math.abs(z)<=clearance){
    const X=cx+x,Z=cz+z;
    check(c.mapCells[Z][X]===0,`L${level}: supposedly open passage has wall ${X},${Z}`);
   }
  }
  const draw=new Set(boxes.map(b=>b.join('|'))),solid=ev('worldSolidGrid');
  let localExposed=0;
  for(const wall of p.tiles){
   const {x,z}=wall,label=`L${level} q${quality} (${x},${z})`;
   check(c.mapCells[z][x]===1,`${label}: visual-only wall`);
   check(c.collide(x+.5,z+.5,.33),`${label}: player tunnels through`);
   check(c.collide(x+.5,z+.5,.95),`${label}: big robot tunnels through`);
   check(Math.abs(x-cx)<=(r===3?r:r-1)&&Math.abs(z-cz)<=(r===3?r:r-1),
    `${label}: blocked open perimeter/access lane`);
   const side=[[1,0],[-1,0],[0,1],[0,-1]].find(([dx,dz])=>
     c.mapCells[z+dz]?.[x+dx]===0);
   if(!side)continue;
   localExposed++;exposed++;
   const id=[x,0,z,x+1,roof,z+1].join('|');
   check(draw.has(id),`${label}: physical wall lacks visible 3D box`);
   check((solid[keyFor(x,z)]||[]).some(v=>v.box.join('|')===id),
    `${label}: rendered wall has no actual AABB`);
   if(projectileSets<600){
    const [dx,dz]=side,o={x:x+dx+.5,y:1.5,z:z+dz+.5},direction={x:-dx,y:0,z:-dz};
    const bullet=c.rayWall(o,direction,1.2);
    const rocket=c.sweepWorldSphere(o,direction,1.2,.13);
    const grenade=c.sweepWorldSphere(o,direction,1.2,.20);
    check(bullet&&bullet.t<=1.01,`${label}: bullet goes through wall`);
    check(rocket&&rocket.t<=bullet.t+.00001,`${label}: spherical rocket goes through wall`);
    check(grenade&&grenade.t<=rocket.t+.00001,`${label}: grenade goes through wall`);
    projectileSets++;
   }
  }
  check(localExposed>=4,`L${level}: new walls entirely hidden`);
  // Ground connectivity, then the more restrictive real enemy-navigation
  // edges. Validate portal and BOTH tactical destinations plus the new fort.
  const q=[keyFor((n/2)|0,(n/2)|0)],seen=new Uint8Array(n*n);seen[q[0]]=1;
  for(let i=0;i<q.length;i++){
   const t=q[i],x=t%n,z=(t/n)|0;
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const X=x+dx,Z=z+dz,k=keyFor(X,Z);
    if(X<=0||Z<=0||X>=n-1||Z>=n-1||seen[k]||c.mapCells[Z][X])continue;
    seen[k]=1;q.push(k);
   }
  }
  for(let z=1;z<n-1;z++)for(let x=1;x<n-1;x++){
   if(!c.mapCells[z][x])check(seen[keyFor(x,z)],`L${level}: isolated traversable tile ${x},${z}`);
  }
  check(seen[keyFor(cx,cz)],`L${level}: new relay fort not reachable`);
  check(seen[keyFor(Math.floor(c.portal.x),Math.floor(c.portal.z))],`L${level}: portal unreachable`);
  let secondary=ev('secondaryYard'),tactical=ev('tacticalZone');
  if(secondary)check(seen[keyFor(secondary.cx,secondary.cz)],`L${level}: secondary yard unreachable`);
  if(tactical)check(seen[keyFor(tactical.cx,tactical.cz)],`L${level}: tactical yard unreachable`);
  const q2=[q[0]],nav=new Uint8Array(n*n);nav[q2[0]]=1;
  for(let i=0;i<q2.length;i++){
   const t=q2[i],x=t%n,z=(t/n)|0;
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const X=x+dx,Z=z+dz,k=keyFor(X,Z);
    if(X<=0||Z<=0||X>=n-1||Z>=n-1||nav[k]||c.mapCells[Z][X]||
       !c.enemyNavEdge(x,z,X,Z))continue;
    nav[k]=1;q2.push(k);
   }
  }
  check(nav[keyFor(cx,cz)],`L${level}: ground robot cannot reach new fort`);
  check(nav[keyFor(Math.floor(c.portal.x),Math.floor(c.portal.z))],
    `L${level}: ground robot cannot reach portal`);
  if(secondary)check(nav[keyFor(secondary.cx,secondary.cz)],
    `L${level}: robot cannot reach existing secondary yard`);
  if(tactical)check(nav[keyFor(tactical.cx,tactical.cz)],
    `L${level}: robot cannot reach existing tactical yard`);
  navigableTiles+=q2.length;
  if(quality===0){
   // Absolute position is excluded: only the REAL wall geometry may make a
   // variant unique; changing the address of the fort is not a new design.
   const footprint=p.tiles.map(t=>`${t.x-cx},${t.z-cz}`).sort().join('|');
   check(!silhouettes.has(footprint),`L${level}: duplicate physical design`);
   silhouettes.add(footprint);byKind[kind]++;byVariant[variant]++;
   check(ev('ordinaryCourtPlan')!==null,`L${level}: previous centre lost`);
  }
 }
}
check(silhouettes.size===80&&byKind.every(x=>x===10)&&byVariant.every(x=>x===8),
 '80 physical profiles are not present in the complete campaign');
check(projectileSets>=500&&exposed>500&&scenes>=90,
 'insufficient projectile, visible-face or rendering verification');
console.log(`Stage82: ${checks} assertions / ${scenes} full 3D scenes / 80 distinct physical outposts / ${projectileSets} bullet-rocket-grenade trials / ${exposed} visible AABBs / walls ${minimum}-${maximum} / radii ${[...radii].sort()} / ${navigableTiles} robot-reachable tiles: PASS`);
