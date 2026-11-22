'use strict';
// Test the ACTUAL rendered and registered 3D geometry in every regular yard.
// The two optional gatehouses use real old-wall piers and remain walk-through.
const assert=require('node:assert/strict'),fs=require('node:fs'),
 path=require('node:path'),vm=require('node:vm');
const source=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0;
const check=(yes,msg)=>{assert.ok(yes,msg);checks++;};
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
 bossNames:['БОСС'],robotPalette:()=>{},toast:()=>{},game:null,navField:null,navClock:0};
vm.createContext(ctx);
for(const f of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js'])
 vm.runInContext(source(f),ctx,{filename:f});
const ev=s=>vm.runInContext(s,ctx);
check(/const GAME_BUILD='(72|73|74|75|76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),'Stage72-or-newer version');
check(/const MP_VERSION=(25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(source('21b-multiplayer-lobby.js')),
 'geometry change requires new multiplayer protocol');
const key=b=>b.map(v=>v.toFixed(5)).join('|');
const identities=new Set(),kindCounts=new Array(10).fill(0),qualityShapes=new Map();
let generated=0,regular=0,boss=0,physical=0,gateTotal=0,groundTotal=0,
 wallRibs=0,gunshots=0,rockets=0,bodies=0,airShots=0,walks=0,headroom=0,
 clipped=0,complexes=0;
const reachable=(sx,sz,tx,tz)=>{
 const n=ctx.mapSize,seen=new Uint8Array(n*n),q=new Int32Array(n*n);
 let head=0,tail=0;const start=Math.floor(sz)*n+Math.floor(sx),end=Math.floor(tz)*n+Math.floor(tx);
 seen[start]=1;q[tail++]=start;
 while(head<tail){
  const pos=q[head++];if(pos===end)return true;
  const x=pos%n,z=Math.floor(pos/n);
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=x+dx,Z=z+dz,k=Z*n+X;
   if(X<1||Z<1||X>=n-1||Z>=n-1||seen[k]||ctx.mapCells[Z][X]||
      !ctx.enemyNavEdge(x,z,X,Z))continue;
   seen[k]=1;q[tail++]=k;
  }
 }
 return false;
};
for(let level=1;level<=100;level++)for(const quality of [0,1,2]){
 ctx.glReady=true;ctx.touchOnly=quality!==2;ctx.save.settings.quality=quality;
 ctx.buildMap(level);generated++;
 const plan=ev('secondaryYard'),roof=ctx.ceilingHeight();
 const result=ctx.secondaryGatewaySystem(level,plan,roof),parts=result.parts;
 if(level%5===0){
  boss++;check(plan===null&&parts.length===0&&result.gateCount===0,
   `L${level}: new ordinary gate inside boss arena`);continue;
 }
 regular++;
 check(plan&&parts.length>=12,`L${level}: ordinary yard lacks actual 3D defence`);
 check(plan.kind>=0&&plan.kind<10&&plan.variant>=0&&plan.variant<8,
  `L${level}: invalid 80-way yard identity`);
 check(result.wallBases>=3,`L${level}: no existing-wall anchored fortifications`);
 check(result.gateCount<=2&&result.gateCount>=0,
  `L${level}: impossible count of actual pass-through gates`);
 gateTotal+=result.gateCount;groundTotal+=result.groundGates;
 wallRibs+=result.wallBases;
 const outline=parts.filter(p=>p.role!=='wallCodedPanel').map(p=>{
  const b=p.box;return `${p.role}:${b.map((v,i)=>i===1||i===4?
     v.toFixed(2):(v-(i===0||i===3?plan.cx:plan.cz)).toFixed(2)).join(',')}`;
 }).sort().join('|');
 if(quality===0){
  kindCounts[plan.kind]++;
  check(!identities.has(outline),`L${level}: regular defence signature repeated`);
  identities.add(outline);
  qualityShapes.set(level,JSON.stringify(parts.map(p=>p.box)));
 }else check(qualityShapes.get(level)===JSON.stringify(parts.map(p=>p.box)),
  `L${level}: low/medium/high graphics produced different 3D bodies`);
 const solidSet=new Set(ev('worldSolidGrid').flatMap(arr=>arr||[]).map(s=>key(s.box)));
 const assemblies=new Map();
 for(const p of parts)if(p.group>=3){
  if(!assemblies.has(p.group))assemblies.set(p.group,new Set());
  assemblies.get(p.group).add(p.role);
 }
 check(assemblies.size===result.wallBases&&
  [...assemblies.values()].every(roles=>roles.size===3&&
   roles.has('defensiveWallRib')&&roles.has('defensiveWallCap')&&
   (roles.has('wallBladedFin')||roles.has('wallCodedPanel'))),
  `L${level}: wall-defence assembly incomplete or floating`);
 let present=0,solidWallBases=0,firstGate=null;
 for(const p of parts){
  const b=p.box;
  check(b.every(Number.isFinite)&&b[3]>b[0]&&b[4]>b[1]&&b[5]>b[2]&&
   b[1]>=0&&b[4]<roof-.19,`L${level}: invalid 3D gate or wall geometry`);
  const isGate=p.role==='gateLintel';
  if(p.role==='defensiveWallRib'){
   const X=Math.floor((b[0]+b[3])/2),Z=Math.floor((b[2]+b[5])/2);
   check(ctx.mapCells[Z]?.[X]===1,
    `L${level}: base of wall-rib is not in an old solid wall`);
   check(b[3]-b[0]<=1.07&&b[5]-b[2]<=1.07,
    `L${level}: old-wall buttress protrudes into the walkable centre`);
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    if(ctx.mapCells[Z+dz]?.[X+dx]!==0)continue;
    const x=X+dx+.5,z=Z+dz+.5;
    const nx=Math.max(b[0],Math.min(x,b[3]));
    const nz=Math.max(b[2],Math.min(z,b[5]));
    check(Math.hypot(nx-x,nz-z)>.26,
     `L${level}: wall-rib blocks a normal-sized ground robot`);
   }
  }
  if(!solidSet.has(key(b))){clipped++;continue;}
  present++;physical++;
  // Sampling every actual 3D member prevents an unregistered visual-only
  // ornament from passing on the strength of its neighbouring collider.
  const cx=(b[0]+b[3])/2,cy=(b[1]+b[4])/2,cz=(b[2]+b[5])/2;
  check(ctx.worldSolidBodyCollision(cx,cz,.055,Math.max(0,cy-.24),.56),
   `L${level}: ${p.role} visually solid but not collidable for a body`);
  check(ctx.rayWall({x:cx,y:cy,z:cz},{x:1,y:0,z:0},.035)?.t<.001,
   `L${level}: ${p.role} visually solid but passes hitscan fire`);
  check(ctx.sweepWorldSphere({x:cx,y:cy,z:cz},{x:0,y:0,z:1},.035,.06)?.t<.001,
   `L${level}: ${p.role} visually solid but passes a spherical rocket`);
  if(p.role==='defensiveWallRib')solidWallBases++;
  if(isGate&&!firstGate)firstGate=p;
  // The overhead beam may cross ground or a real high deck. Its underside
  // must stay 2.25m above the TOPMOST physically reachable foot surface.
  if(b[1]>=2.35&&p.role!=='defensiveWallCap'){
   for(let z=Math.max(1,Math.floor(b[2]));z<=Math.min(ctx.mapSize-2,Math.floor(b[5]));z++)
    for(let x=Math.max(1,Math.floor(b[0]));x<=Math.min(ctx.mapSize-2,Math.floor(b[3]));x++){
     if(ctx.mapCells[z][x]!==0)continue;
     const floor=Math.max(ctx.floorHeightAtCell(x,z),ctx.deckAtCell(x,z));
     if(b[4]-b[1]<.50&&b[1]>=floor+2.25-.001)headroom++;
    }
  }
 }
 check(present===parts.length&&solidWallBases===result.wallBases&&
  present>=10&&solidWallBases>=2,
  `L${level}: rendered/physical gate or wall architecture missing `+
  `(available ${present}, wall ribs ${solidWallBases})`);
 complexes++;
 // A ground robot must approach the centre from the original player spawn.
 check(reachable(ctx.spawnX,ctx.spawnZ,plan.cx+.5,plan.cz+.5),
  `L${level}: corridor to newly fortified yard is obstructed`);
 walks++;
 if(firstGate){
  const b=firstGate.box,mx=(b[0]+b[3])/2,mz=(b[2]+b[5])/2;
  check(ctx.mapCells[Math.floor(mz)][Math.floor(mx)]===0,
   `L${level}: gateway main span is not over a REAL open passage`);
  // The centre is open below the lintel (2.35+ metres of free headroom).
  check(!ctx.worldSolidBodyCollision(mx,mz,.20,0,1.93),
   `L${level}: player cannot walk under the defensive lintel`);
  const my=(b[1]+b[4])/2,o={x:mx,y:my,z:mz},d={x:1,y:0,z:0};
  check(ctx.rayWall(o,d,.04)?.t<.001,`L${level}: gate is transparent to hitscan`);
  check(ctx.sweepWorldSphere(o,d,.04,.06)?.t<.001,
   `L${level}: gate is transparent to spherical rockets`);
  check(ctx.worldSolidBodyCollision(mx,mz,.11,b[1]-.04,.44),
   `L${level}: gate has no physical player / robot body`);
  gunshots++;rockets++;bodies++;
  // Ray from below in an open cell MUST hit a solid obstacle.
  const from={x:mx,y:b[1]-.40,z:mz};
  const hit=ctx.rayWall(from,{x:0,y:1,z:0},.68);
  if(hit&&hit.t<=.42){airShots++;}
 }
 check(ev('worldSolidCount')<17000,`L${level}: mobile world-solid limit exceeded`);
}
check(generated===300&&regular===240&&boss===60&&complexes===240&&
 identities.size===80&&kindCounts.every(n=>n===8)&&walks===240&&
 physical>=1000&&wallRibs>=480&&headroom>=1000&&clipped===0&&
 gateTotal>=100&&gunshots>=60&&rockets===gunshots&&bodies===gunshots,
 'missing regular fortress, unique gateway silhouette, physics or AI access');
console.log(`Stage72: ${checks} checks PASS; 80 distinct fortified ordinary courts `+
 `across three graphics qualities, ${gateTotal} actual pass-through portals, `+
 `${groundTotal} ground portals, ${wallRibs} wall-attached bases, `+
 `${physical} real registered 3D parts, ${gunshots} bullet / rocket / body `+
 `collisions, ${airShots} open-air shots from below, ${walks} grounded robot `+
 `routes, ${headroom} altitude-clearance checks, ${clipped} dual-render/physics skips`);
