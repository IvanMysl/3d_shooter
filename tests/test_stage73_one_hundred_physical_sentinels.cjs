'use strict';
// The same exact 3D shapes MUST be visible, physically registered and safe
// beside every original tactical passage, on desktop and touch/mobile.
const assert=require('node:assert/strict'),fs=require('node:fs'),
 path=require('node:path'),vm=require('node:vm');
const source=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++;};
const ctx={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),mapSize:0,mapCells:[],mapRooms:[],
 mapFeatures:[],legacyResumeSector:-1,legacyResumeDivisor:18,
 glReady:false,touchOnly:false,gl:{deleteBuffer(){}},worldMesh:null,
 worldChunks:[],meshStats:{},toMesh:v=>({b:{},n:v.length/10}),
 box:()=>{},quad:()=>{},rcolor:c=>c,
 save:{settings:{quality:0,audio:false}},sound:()=>{},burst:()=>{},
 input:{jumpQueued:false},arsenalOpened:false,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],
  floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,
  color:[1,.5,.2],score:5}},bossNames:['БОСС'],robotPalette:()=>{},
 toast:()=>{},game:null,navField:null,navClock:0};
vm.createContext(ctx);
for(const f of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js'])
 vm.runInContext(source(f),ctx,{filename:f});
const ev=s=>vm.runInContext(s,ctx);
check(/const GAME_BUILD='(73|74|75|76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),'stage 73-or-newer version');
check(/const MP_VERSION=(26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(source('21b-multiplayer-lobby.js')),
 'stage 73 protocol must isolate old physical geometry');
const key=b=>b.map(v=>v.toFixed(5)).join('|');
const identities=new Set(),qualityBodies=new Map(),families=new Array(10).fill(0),
 variants=new Array(10).fill(0);
let builds=0,unique=0,physical=0,solidPiers=0,towers=0,bossTowers=0,
 groundTowers=0,gatewaysProtected=0,shots=0,rockets=0,collisions=0,
 safeRoads=0,headroom=0,oldGeometry=0,phantoms=0,mostSolids=0,minTowers=100;
function reachable(sx,sz,tx,tz){
 const n=ctx.mapSize,seen=new Uint8Array(n*n),queue=new Int32Array(n*n);
 const start=Math.floor(sz)*n+Math.floor(sx),end=Math.floor(tz)*n+Math.floor(tx);
 let front=0,back=0;seen[start]=1;queue[back++]=start;
 while(front<back){
  const pos=queue[front++];if(pos===end)return true;
  const x=pos%n,z=(pos/n)|0;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=x+dx,Z=z+dz,k=Z*n+X;
   if(X<1||Z<1||X>=n-1||Z>=n-1||seen[k]||ctx.mapCells[Z][X]||
      !ctx.enemyNavEdge(x,z,X,Z))continue;
   seen[k]=1;queue[back++]=k;
  }
 }
 return false;
}
for(let level=1;level<=100;level++)for(const quality of [0,1,2]){
 ctx.touchOnly=quality!==2;ctx.save.settings.quality=quality;
 ctx.glReady=true;ctx.buildMap(level);builds++;
 const plan=ev('tacticalZone'),roof=ctx.ceilingHeight(),
  res=ctx.tacticalSentinelBoxes(level,plan,roof),parts=res.parts;
 check(plan&&plan.cx>1&&plan.cz>1,`L${level}: tactical site missing`);
 check(res.family===Math.floor((level-1)/10)&&
  res.variant===(level-1)%10,`L${level}: 100-way structural identity`);
 check(res.towers>=3&&res.towers<=7&&parts.length>=res.towers*5,
  `L${level}: missing wall towers: ${res.towers} (${parts.length} parts)`);
 minTowers=Math.min(minTowers,res.towers);
 if(quality===0){
  families[res.family]++;variants[res.variant]++;
  const signature=parts.filter(p=>p.role!=='individualRivet').map(p=>{
   const b=p.box;
   return `${p.role}:${b.map((v,i)=>i===1||i===4?v.toFixed(3):
     (v-(i===0||i===3?plan.cx:plan.cz)).toFixed(3)).join(',')}`;
  }).sort().join('|');
  check(!identities.has(signature),`L${level}: repeat 3D architectural silhouette`);
  identities.add(signature);unique++;
  qualityBodies.set(level,JSON.stringify(parts.map(p=>p.box)));
 }else check(qualityBodies.get(level)===JSON.stringify(parts.map(p=>p.box)),
  `L${level}: GPU quality altered real 3D solids`);
 const registered=new Set(ev('worldSolidGrid').flatMap(v=>v||[]).map(s=>key(s.box)));
 const groups=new Map();
 for(const p of parts){
  if(!groups.has(p.group))groups.set(p.group,[]);
  groups.get(p.group).push(p);
 }
 check(groups.size===res.towers&&[...groups.values()].every(g=>
   ['sentinelPier','sentinelCrown','sentinelShoulder',
    'sentinelUpperBeam','individualCrest'].every(role=>
    g.some(p=>p.role===role))),
  `L${level}: unsupported or incomplete tower assembly`);
 const touching=(a,b)=>[0,1,2].every(i=>
   a[i]<=b[i+3]+1e-5&&b[i]<=a[i+3]+1e-5);
 for(const [group,items] of groups){
  const root=items.findIndex(p=>p.role==='sentinelPier');
  const seen=new Set([root]),queue=[root];
  for(let i=0;i<queue.length;i++){
   const cur=items[queue[i]];
   for(let j=0;j<items.length;j++)if(!seen.has(j)&&
       touching(cur.box,items[j].box)){
    seen.add(j);queue.push(j);
   }
  }
  check(seen.size===items.length,
   `L${level} tower ${group}: floating 3D part detached from supporting wall`);
  const pier=items[root].box,px=(pier[0]+pier[3])/2,
   pz=(pier[2]+pier[5])/2,
   X=Math.floor(px),Z=Math.floor(pz),dx=Math.abs(px-X-.5)>.20?
    Math.sign(px-X-.5):0,dz=dx===0?Math.sign(pz-Z-.5):0;
  const visibleFront=b=>dx>0?b[3]-(X+1):dx<0?X-b[0]:
    dz>0?b[5]-(Z+1):Z-b[2];
  check(dx!==0||dz!==0,`L${level}: sentinel has no exposed wall face`);
  for(const role of ['sentinelCrown','sentinelUpperBeam','individualCrest']){
   const piece=items.find(p=>p.role===role);
   check(visibleFront(piece.box)>.20,
    `L${level}: ${role} is almost fully hidden INSIDE the old wall`);
  }
 }
 let perMapPiers=0;
 for(const p of parts){
  const b=p.box;
  check(b.every(Number.isFinite)&&b[3]>b[0]&&b[4]>b[1]&&
   b[5]>b[2]&&b[1]>=0&&b[4]<roof-.19,
   `L${level}: invalid ${p.role} real 3D bounds`);
  if(!registered.has(key(b))){phantoms++;continue;}
  physical++;
  const x=(b[0]+b[3])/2,y=(b[1]+b[4])/2,z=(b[2]+b[5])/2;
  check(ctx.worldSolidBodyCollision(x,z,.055,Math.max(0,y-.24),.56),
   `L${level}: ${p.role} does not block a body`);collisions++;
  check(ctx.rayWall({x,y,z},{x:1,y:0,z:0},.035)?.t<.001,
   `L${level}: ${p.role} does not block hitscan`);shots++;
  check(ctx.sweepWorldSphere({x,y,z},{x:0,y:0,z:1},.035,.06)?.t<.001,
   `L${level}: ${p.role} does not block rockets`);rockets++;
  if(p.role==='sentinelPier'){
   perMapPiers++;solidPiers++;
   const X=Math.floor(x),Z=Math.floor(z);
   check(ctx.mapCells[Z]?.[X]===1,
    `L${level}: physical pier not attached to a REAL wall`);
   check(b[3]-b[0]<=.52&&b[5]-b[2]<=.52,
    `L${level}: corridor width narrowed excessively`);
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    if(ctx.mapCells[Z+dz]?.[X+dx]!==0)continue;
    const centreX=X+dx+.5,centreZ=Z+dz+.5,
     nearestX=Math.max(b[0],Math.min(b[3],centreX)),
     nearestZ=Math.max(b[2],Math.min(b[5],centreZ));
    check(Math.hypot(centreX-nearestX,centreZ-nearestZ)>.26,
     `L${level}: sentinel base blocks 26cm-radius robot path`);
   }
  }
  if(p.role!=='sentinelPier'&&b[1]>=2.25){
   for(let Z=Math.max(1,Math.floor(b[2]));
       Z<=Math.min(ctx.mapSize-2,Math.floor(b[5]));Z++)
    for(let X=Math.max(1,Math.floor(b[0]));
        X<=Math.min(ctx.mapSize-2,Math.floor(b[3]));X++){
     if(ctx.mapCells[Z][X]!==0)continue;
     const floor=Math.max(ctx.floorHeightAtCell(X,Z),ctx.deckAtCell(X,Z));
     check(b[1]>=floor+2.25-.001,
      `L${level}: 3D sentinel roof blocks an existing upper walkway`);
     headroom++;
    }
  }
 }
 check(perMapPiers===res.towers&&phantoms===0,
  `L${level}: tower not both rendered and collision-registered`);
 check(reachable(ctx.spawnX,ctx.spawnZ,plan.cx+.5,plan.cz+.5),
  `L${level}: old robot route to primary tactical court missing`);
 safeRoads++;
 const ground=ev('worldSolidCount');
 mostSolids=Math.max(ground,mostSolids);
 check(ground<17000,`L${level}: excessive mobile physics volume`);
 towers+=res.towers;groundTowers+=res.groundTowers;
 if(level%5===0)bossTowers+=res.towers;
 if(level%5!==0&&ev('secondaryYard')!==null)gatewaysProtected++;
 oldGeometry++;
}
check(builds===300&&unique===100&&identities.size===100&&
 families.every(n=>n===10)&&variants.every(n=>n===10)&&
 safeRoads===300&&towers>=900&&solidPiers===towers&&
 physical>=6000&&shots===physical&&rockets===physical&&
 collisions===physical&&headroom>=1000&&phantoms===0&&
 gatewaysProtected===240&&bossTowers>=60,
 'Stage73 full 100-scene physical architecture verification');
console.log(`Stage73: ${checks} checks PASS; 100 unique physical tactical sentinels, `+
 `${towers} registered tower roots (${groundTowers} at ground courtyards), `+
 `${physical} 3D solid elements, ${shots} hitscan + ${rockets} rocket + `+
 `${collisions} body collisions, ${headroom} clearances, ${safeRoads} old robot `+
 `routes, ${bossTowers} boss towers, min ${minTowers} towers/level, `+
 `max ${mostSolids} mobile solid budget, ${phantoms} phantom obstacles`);
