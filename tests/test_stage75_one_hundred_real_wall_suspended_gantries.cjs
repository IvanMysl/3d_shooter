'use strict';
// Stage75: all aerial engineering shapes must be load-bearing, visible and
// registered as the EXACT same AABBs that body/rocket/raycast systems use.
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
const ev=s=>vm.runInContext(s,ctx),key=b=>b.map(v=>v.toFixed(5)).join('|');
check(/const GAME_BUILD='(75|76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),
 'Stage75 version');
check(/const MP_VERSION=(28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(source('21b-multiplayer-lobby.js')),
 'New 3D geometry requires an isolated multiplayer version');
const touch=(a,b)=>[0,1,2].every(i=>a[i]<=b[i+3]+1e-6&&
 b[i]<=a[i+3]+1e-6);
function route(sx,sz,tx,tz){
 const n=ctx.mapSize,start=Math.floor(sz)*n+Math.floor(sx),
  end=Math.floor(tz)*n+Math.floor(tx),seen=new Uint8Array(n*n),
  queue=new Int32Array(n*n);let head=0,tail=0;
 if(!ctx.enemyNavTile(start%n,(start/n)|0)||
    !ctx.enemyNavTile(end%n,(end/n)|0))return false;
 queue[tail++]=start;seen[start]=1;
 while(head<tail){
  const p=queue[head++];if(p===end)return true;
  const x=p%n,z=(p/n)|0;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=x+dx,Z=z+dz,k=Z*n+X;
   if(X<1||Z<1||X>=n-1||Z>=n-1||seen[k]||
    !ctx.enemyNavEdge(x,z,X,Z))continue;
   seen[k]=1;queue[tail++]=k;
  }
 }
 return false;
}
const identities=new Set(),qualityShapes=new Map(),families=Array(10).fill(0),
 variants=Array(10).fill(0);
let maps=0,unique=0,groups=0,solidParts=0,shots=0,rockets=0,bodies=0,
  anchors=0,solidBeams=0,airLanding=0,clearance=0,routes=0,
  phantoms=0,maximum=0,minimum=100,bossGroups=0,
  belowHits=0,belowRockets=0,headHits=0;
for(let level=1;level<=100;level++)for(const quality of [0,1,2]){
 ctx.glReady=true;ctx.touchOnly=quality!==2;
 ctx.save.settings.quality=quality;
 ctx.buildMap(level);maps++;
 const plan=ev('tacticalZone'),roof=ctx.ceilingHeight(),
  res=ev('lastTacticalOverhangs'),parts=res.parts;
 check(plan&&plan.cx>0&&plan.cz>0,
  `L${level}: tactical annex missing`);
 check(res.family===(level-1)%10&&res.variant===Math.floor((level-1)/10),
  `L${level}: 100-way geometry indexing not deterministic`);
 check(res.sites.length>=1&&res.sites.length<=4,
  `L${level}: missing wall-anchored gantry, ${res.sites.length} sites`);
 minimum=Math.min(minimum,res.sites.length);
 if(quality===0){
  families[res.family]++;variants[res.variant]++;
  const first=parts.filter(p=>p.group===res.sites[0].group),
   site=res.sites[0];
  const sig=first.map(p=>`${p.role}:${p.box.map((v,i)=>
   (i===1||i===4?v:v-(i===0||i===3?site.x:site.z)).toFixed(4))
   .join(':')}`).sort().join('|');
  check(!identities.has(sig),`L${level}: repeated 3D engineering geometry`);
  identities.add(sig);unique++;
  qualityShapes.set(level,JSON.stringify(parts.map(p=>p.box)));
  if(level%5===0)bossGroups+=res.sites.length;
 }else check(qualityShapes.get(level)===JSON.stringify(parts.map(p=>p.box)),
   `L${level}: GPU quality changed real obstacle geometry`);
 const register=new Set(ev('worldSolidGrid').flatMap(a=>a||[])
  .map(s=>key(s.box))),byGroup=new Map();
 for(const p of parts){
  if(!byGroup.has(p.group))byGroup.set(p.group,[]);
  byGroup.get(p.group).push(p);
 }
 check(byGroup.size===res.sites.length,
  `L${level}: unsupported/incomplete gantry groups`);
 for(const [group,items] of byGroup){
  const site=res.sites.find(s=>s.group===group),
   mast=items.findIndex(p=>p.role==='overhangMast');
  check(site&&mast>=0&&['overhangCollar','overhangSpine',
   'overhangCrossbar','individualBadge'].every(role=>
   items.some(p=>p.role===role)),
   `L${level}: cantilever lacks its load-bearing chain`);
  const seen=new Set([mast]),queue=[mast];
  for(let i=0;i<queue.length;i++)for(let j=0;j<items.length;j++){
   if(!seen.has(j)&&touch(items[queue[i]].box,items[j].box)){
    seen.add(j);queue.push(j);
   }
  }
  check(seen.size===items.length,
   `L${level}: an overhead 3D plate is floating independently`);
  check(ctx.mapCells[site.Z]?.[site.X]===1&&
   touch(items[mast].box,site.originalPier),
   `L${level}: cantilever not physically connected to old solid wall pier`);
  anchors++;
  const outward=site.dx!==0?site.dx:site.dz,
   axis=site.dx!==0?0:2,
   spine=items.find(p=>p.role==='overhangSpine'),
   beam=items.find(p=>p.role==='overhangCrossbar').box,
   front=site.dx>0?spine.box[3]-(site.X+1):
     site.dx<0?site.X-spine.box[0]:
     site.dz>0?spine.box[5]-(site.Z+1):site.Z-spine.box[2];
  check(outward!==0&&(axis===0||axis===2)&&front>=2.3,
   `L${level}: engineering structure hidden inside old stone wall`);
  check(Math.max(beam[3]-beam[0],beam[5]-beam[2])>=2.0,
   `L${level}: cantilever crossbar too short to change skyline`);
  // Test a guaranteed EXPOSED piece, not the far crossbar, which may embed
  // in the opposite old wall when this gantry spans a narrow walled channel.
  const pX=site.x+site.dx*.85,pZ=site.z+site.dz*.85,
   top=spine.box[4],under=spine.box[1];
  check(ctx.mapCells[Math.floor(pZ)]?.[Math.floor(pX)]===0,
   `L${level}: projected spine misses the actual open combat passage`);
  check(ctx.worldSolidStandingSupport(pX,pZ,.10,top,.015)!==null,
   `L${level}: flying player passes through an exposed upper beam landing`);
  airLanding++;
  // An older physical wire, antenna or wall shoulder can correctly intercept
  // the first attempt. Probe a few points in the EXPOSED span, accepting
  // ONLY an impact whose exact registered box belongs to THIS new gantry.
  const own=new Set(items.map(p=>key(p.box))),up={x:0,y:1,z:0},
   tx=-site.dz,tz=site.dx;
  let ingress=null;
  for(const d of [.78,.95,1.12,1.26]){
   if(ingress)break;
   for(const u of [0,.11,-.11]){
    if(ingress)break;
    const x=site.x+site.dx*d+tx*u,z=site.z+site.dz*d+tz*u;
    if(ctx.mapCells[Math.floor(z)]?.[Math.floor(x)]!==0)continue;
    for(const side of ['below','above']){
     if(ingress)break;
     for(const gap of side==='below'?[.24,.39,.56]:[.18,.27]){
      const direction=side==='below'?up:{x:0,y:-1,z:0},
       start={x,y:side==='below'?under-gap:top+gap,z},
       maxDist=gap+.36,
       bullet=ctx.rayWall(start,direction,maxDist),
       rocket=ctx.sweepWorldSphere(start,direction,maxDist,.08);
      if(bullet&&rocket&&bullet.t>.025&&rocket.t>.025&&
         own.has(key(bullet.solid?.box||[]))&&
         own.has(key(rocket.solid?.box||[]))){
        ingress={x,z,side,bullet,rocket};break;
      }
     }
    }
    if(ingress)break;
   }
  }
  check(ingress!==null,
   `L${level}: no open-air bullet/rocket approach to the new real gantry`);
  belowHits++;
  belowRockets++;
  check(ctx.worldSolidHeadBarrier(pX,pZ,.15,under-.36,
    top+.12)!==null,
   `L${level}: jumping head tunnels through the physical roofline`);
  headHits++;
  groups++;
 }
 for(const p of parts){
  const b=p.box;
  check(b.every(Number.isFinite)&&b[3]>b[0]&&b[4]>b[1]&&
   b[5]>b[2]&&b[1]>=0&&b[4]<roof-.19,
   `L${level}: invalid ${p.role} real 3D solid`);
  if(!register.has(key(b))){phantoms++;continue;}
  solidParts++;
  const x=(b[0]+b[3])/2,y=(b[1]+b[4])/2,z=(b[2]+b[5])/2;
  check(ctx.worldSolidBodyCollision(x,z,.06,Math.max(0,y-.19),.43),
   `L${level}: player passes through ${p.role}`);bodies++;
  check(ctx.rayWall({x,y,z},{x:1,y:0,z:0},.04)?.t<.001,
   `L${level}: hitscan passed through ${p.role}`);shots++;
  check(ctx.sweepWorldSphere({x,y,z},{x:0,y:0,z:1},.04,.08)?.t<.001,
   `L${level}: rocket passed through ${p.role}`);rockets++;
  if(p.role==='overhangMast')continue;
  solidBeams++;
  const loX=Math.max(1,Math.floor(b[0]-.26)),
   hiX=Math.min(ctx.mapSize-2,Math.floor(b[3]+.26)),
   loZ=Math.max(1,Math.floor(b[2]-.26)),
   hiZ=Math.min(ctx.mapSize-2,Math.floor(b[5]+.26));
  for(let Z=loZ;Z<=hiZ;Z++)for(let X=loX;X<=hiX;X++){
   if(ctx.mapCells[Z][X]!==0)continue;
   const floor=Math.max(ctx.floorHeightAtCell(X,Z),ctx.deckAtCell(X,Z));
   if(floor>.15){
    check(b[1]>=floor+2.25-.001||b[4]<=floor+.16,
     `L${level}: new suspended beam blocks existing elevated robot route`);
    clearance++;
   }else{
    check(b[1]>=2.25,
     `L${level}: new suspended beam strikes the walking player's head`);
    clearance++;
   }
  }
 }
 check(phantoms===0,`L${level}: rendered physical overhang absent from collider registry`);
 check(route(ctx.spawnX,ctx.spawnZ,plan.cx+.5,plan.cz+.5),
  `L${level}: suspended structure severed existing robot approach`);
 routes++;
 const total=ev('worldSolidCount');maximum=Math.max(maximum,total);
 check(total<17000,`L${level}: excessive 3D solid budget for Android`);
}
check(maps===300&&identities.size===100&&unique===100&&minimum>=1&&
 families.every(n=>n===10)&&variants.every(n=>n===10)&&
 anchors===groups&&groups>=300&&solidParts===bodies&&bodies===shots&&
 shots===rockets&&routes===300&&airLanding===groups&&
 bossGroups>=20&&phantoms===0&&belowHits===groups&&
 belowRockets===groups&&headHits===groups,
 'Stage75 physical gantry full regression');
console.log(`Stage75: ${checks} checks PASS; ${unique} unique `+
 `physical roofline systems, ${groups} wall-anchored connected assemblies `+
 `(${bossGroups} in boss maps), ${solidParts} identical visible/solid AABBs, `+
 `${shots} exact hitscan + ${rockets} rocket + ${bodies} body collisions, `+
 `${belowHits} live incoming bullet + ${belowRockets} rocket approaches, `+
 `${headHits} jumping-head barriers, ${airLanding} beam landings, `+
 `${clearance} 3D headroom `+
 `checks, ${routes} intact bot routes; min ${minimum} groups/level, `+
 `max ${maximum} registered volumes, ${phantoms} visual-only obstacles`);
