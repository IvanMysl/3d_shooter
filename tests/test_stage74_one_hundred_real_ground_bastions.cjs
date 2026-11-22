'use strict';
// This validates physical combat cover, not merely silhouette generation:
// rendered AABBs, hitscan, explosive projectiles, player/robot bodies, and
// uninterrupted walking detours in ALL 100 procedural arenas and GPU presets.
const assert=require('node:assert/strict'),fs=require('node:fs'),
 path=require('node:path'),vm=require('node:vm');
const source=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0;
const check=(v,m)=>{assert.ok(v,m);checks++;};
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
check(/const GAME_BUILD='(74|75|76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),'Stage74 release');
check(/const MP_VERSION=(27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(source('21b-multiplayer-lobby.js')),
 'Changed physical map geometry needs a separate multiplayer version');

function route(sx,sz,tx,tz){
 const n=ctx.mapSize,s=Math.floor(sz)*n+Math.floor(sx),
  goal=Math.floor(tz)*n+Math.floor(tx),seen=new Uint8Array(n*n),
  q=new Int32Array(n*n);let head=0,tail=0;
 if(!ctx.enemyNavTile(s%n,(s/n)|0)||
    !ctx.enemyNavTile(goal%n,(goal/n)|0))return false;
 q[tail++]=s;seen[s]=1;
 while(head<tail){
  const p=q[head++];if(p===goal)return true;
  const x=p%n,z=(p/n)|0;
  for(const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0]]){
   const X=x+dx,Z=z+dz,k=Z*n+X;
   if(X<1||Z<1||X>=n-1||Z>=n-1||seen[k]||
      !ctx.enemyNavEdge(x,z,X,Z))continue;
   seen[k]=1;q[tail++]=k;
  }
 }
 return false;
}
const touching=(a,b)=>[0,1,2].every(i=>
 a[i]<=b[i+3]+1e-6&&b[i]<=a[i+3]+1e-6);
const identities=new Set(),shapeByQuality=new Map(),siteCount=new Map(),
 sitesByQuality=new Map(),
 families=new Array(10).fill(0),variants=new Array(10).fill(0);
let rendered=0,sites=0,body=0,hitscan=0,rockets=0,aiBlocked=0,
 detours=0,reachableCourts=0,unique=0,maxSolids=0,minSites=100,
 airborneClear=0,bossSites=0,ghosts=0,components=0,approachShots=0,
 approachRockets=0,playerRoutes=0;
for(let level=1;level<=100;level++)for(const quality of [0,1,2]){
 ctx.glReady=true;ctx.touchOnly=quality!==2;
 ctx.save.settings.quality=quality;
 ctx.buildMap(level);rendered++;
 const plan=ev('tacticalZone'),roof=ctx.ceilingHeight(),
  res=ev('lastGroundBastions'),parts=res.parts;
 check(plan&&plan.cx>1&&plan.cz>1,`L${level}: missing tactical court`);
 check(res.family===(level-1)%10&&res.variant===Math.floor((level-1)/10),
  `L${level}: ground cover family/variant differs`);
 check(res.sites.length>=1&&res.sites.length<=4,
  `L${level}: expected 1-4 real combat covers, got ${res.sites.length}`);
 minSites=Math.min(minSites,res.sites.length);
 if(quality===0){
  families[res.family]++;variants[res.variant]++;
  const first=parts.filter(p=>p.group===parts[0].group),site=res.sites[0];
  const signature=first.map(p=>`${p.role}:${p.box.map((v,i)=>
   (i===1||i===4?v:v-(i===0||i===3?site.x:site.z)).toFixed(4))
   .join(':')}`).sort().join('|');
  check(!identities.has(signature),`L${level}: duplicated physical design`);
  identities.add(signature);unique++;
  shapeByQuality.set(level,JSON.stringify(parts.map(p=>p.box)));
  siteCount.set(level,res.sites.length);
  sitesByQuality.set(level,JSON.stringify(res.sites));
  if(level%5===0)bossSites+=res.sites.length;
 }else{
  check(shapeByQuality.get(level)===JSON.stringify(parts.map(p=>p.box)),
   `L${level}: physics differs across GPU quality ${quality}, `+
   `${sitesByQuality.get(level)} / ${JSON.stringify(res.sites)}`);
  check(siteCount.get(level)===res.sites.length,
   `L${level}: graphics preset removed physical cover`);
 }
 const registered=new Set(ev('worldSolidGrid').flatMap(a=>a||[])
  .map(s=>key(s.box)));
 const groups=new Map();
 for(const p of parts){
  if(!groups.has(p.group))groups.set(p.group,[]);
  groups.get(p.group).push(p);
 }
 check(groups.size===res.sites.length,
  `L${level}: detached or missing group, ${groups.size}`);
 const usedSites=new Set();
 for(const [group,items] of groups){
  const hull=items.findIndex(p=>p.role==='bastionHull');
  check(hull>=0&&items.some(p=>p.role==='bastionCrown')&&
   items.some(p=>p.role==='individualArmor')&&items.length>=4,
   `L${level} bastion ${group}: no grounded structural foundation`);
  const queue=[hull],seen=new Set(queue);
  for(let i=0;i<queue.length;i++){
   for(let j=0;j<items.length;j++)if(!seen.has(j)&&
      touching(items[queue[i]].box,items[j].box)){
    seen.add(j);queue.push(j);
   }
  }
  check(seen.size===items.length,
   `L${level} bastion ${group}: floating solid part`);
  components++;
  const h=items[hull].box,X=Math.floor((h[0]+h[3])/2),
   Z=Math.floor((h[2]+h[5])/2);
  usedSites.add(`${X},${Z}`);
  check(ctx.mapCells[Z]?.[X]===0,
   `L${level}: base was placed in a pre-existing wall`);
  check(Math.abs(h[1])<.0001&&h[4]>=.75,
   `L${level}: obstructive base does not actually touch ground`);
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
   check(ctx.mapCells[Z+dz]?.[X+dx]===0&&
    ctx.floorHeightAtCell(X+dx,Z+dz)<=.15&&
    ctx.deckAtCell(X+dx,Z+dz)<=.15,
    `L${level}: covering the only path rather than a bypassable 3x3 court`);
  }
  check(ctx.worldSolidBodyCollision(X+.5,Z+.5,.26,0,1.68),
   `L${level}: robot body walks straight through combat cover`);
  check(ctx.worldSolidBodyCollision(X+.5,Z+.5,.34,0,1.92),
   `L${level}: player body walks straight through combat cover`);
  check(ctx.enemyNavTile(X,Z)===false,
   `L${level}: robot navigation misses combat cover`);
  aiBlocked++;
  const ring=[[X-1,Z-1],[X,Z-1],[X+1,Z-1],
    [X+1,Z],[X+1,Z+1],[X,Z+1],[X-1,Z+1],[X-1,Z]];
  check(ring.every(([x,z])=>ctx.enemyNavTile(x,z)),
   `L${level}: any of the eight physical bypass cells is blocked`);
  const passable=new Set(ring.map((v,i)=>i).filter(i=>{
   const [x,z]=ring[i];
   return !ctx.worldSolidBodyCollision(x+.5,z+.5,.34,0,1.92);
  }));
  check(passable.size>=5,
   `L${level}: less than five player-sized bypass cells remain`);
  const seenRing=new Set([passable.values().next().value]),
   queueRing=[...seenRing];
  for(let k=0;k<queueRing.length;k++){
   const i=queueRing[k];
   for(const j of passable){
    if(seenRing.has(j)||Math.abs(ring[i][0]-ring[j][0])+
      Math.abs(ring[i][1]-ring[j][1])!==1)continue;
    const [ax,az]=ring[i],[bx,bz]=ring[j];let accessible=true;
    for(const t of [.25,.5,.75])if(ctx.worldSolidBodyCollision(
     ax+.5+(bx-ax)*t,az+.5+(bz-az)*t,.34,0,1.92)){
      accessible=false;break;
    }
    if(accessible){seenRing.add(j);queueRing.push(j);}
   }
  }
  check(seenRing.size===passable.size,
   `L${level}: a real player's bypass is physically disconnected`);
  playerRoutes++;
  for(let i=0;i<ring.length;i++){
   const [ax,az]=ring[i],[bx,bz]=ring[(i+1)%ring.length];
   check(ctx.enemyNavEdge(ax,az,bx,bz),
    `L${level}: 3D object blocks its own required detour edge`);
   detours++;
  }
  // The ground bastion is still not an infinite invisible map wall. V76
  // intentionally adds a REAL 2.14m roof lintel, so audit free space ABOVE
  // that new obstacle instead of incorrectly expecting it to be permeable.
  const clearY=/GAME_BUILD='(76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js'))?2.80:2.02;
  check(!ctx.worldSolidBodyCollision(X+.5,Z+.5,.12,clearY,.10),
   `L${level}: phantom wall above the complete physical bastion`);
  const shotFrom={x:X-.7,y:.57,z:Z+.5},direction={x:1,y:0,z:0},
   hit=ctx.rayWall(shotFrom,direction,2.4),
   blast=ctx.sweepWorldSphere(shotFrom,direction,2.4,.10);
  check(hit&&hit.t>.30&&hit.t<1.30&&hit.kind==='structure',
   `L${level}: a REAL incoming bullet does not strike the barricade`);
  approachShots++;
  check(blast&&blast.t>.25&&blast.t<1.30&&blast.kind==='structure',
   `L${level}: an incoming rocket does not strike the barricade`);
  approachRockets++;
  airborneClear++;
 }
 check(usedSites.size===res.sites.length,
  `L${level}: multiple cover assemblies overlap one position`);
 for(let i=0;i<res.sites.length;i++)for(let j=0;j<i;j++){
  const a=res.sites[i],b=res.sites[j];
  check(Math.hypot(a.x-b.x,a.z-b.z)>=3.40-.00001,
   `L${level}: two covers obstruct each other's bypass`);
 }
 for(const p of parts){
  const b=p.box;
  check(b.every(Number.isFinite)&&b[3]>b[0]&&b[4]>b[1]&&
   b[5]>b[2]&&b[1]>=0&&b[4]<roof-.19,
   `L${level}: invalid ${p.role} collision geometry`);
  if(!registered.has(key(b))){ghosts++;continue;}
  sites+=p.role==='bastionHull'?1:0;
  const x=(b[0]+b[3])/2,y=(b[1]+b[4])/2,z=(b[2]+b[5])/2;
  check(ctx.worldSolidBodyCollision(x,z,.055,Math.max(0,y-.24),.56),
   `L${level}: ${p.role} does not obstruct human body`);body++;
  check(ctx.rayWall({x,y,z},{x:1,y:0,z:0},.035)?.t<.001,
   `L${level}: bullets pass through ${p.role}`);hitscan++;
  check(ctx.sweepWorldSphere({x,y,z},{x:0,y:0,z:1},.035,.06)?.t<.001,
   `L${level}: rocket passes through ${p.role}`);rockets++;
 }
 check(ghosts===0,`L${level}: visible cover part lacks physical collider`);
 check(route(ctx.spawnX,ctx.spawnZ,plan.cx+.5,plan.cz+.5),
  `L${level}: bots have NO valid physical route to primary courtyard`);
 reachableCourts++;
 const current=ev('worldSolidCount');
 maxSolids=Math.max(maxSolids,current);
 check(current<17000,`L${level}: too many collision objects for mobile`);
}
check(rendered===300&&unique===100&&identities.size===100&&
 families.every(n=>n===10)&&variants.every(n=>n===10)&&
 reachableCourts===300&&ghosts===0&&body===hitscan&&hitscan===rockets&&
 aiBlocked>=300&&detours===aiBlocked*8&&airborneClear===aiBlocked&&
 sites===aiBlocked&&bossSites>=20&&minSites>=1&&
 playerRoutes===aiBlocked&&approachShots===aiBlocked&&
 approachRockets===aiBlocked,
 'Stage74 all-settings all-scenes reality and route audit');
console.log(`Stage74: ${checks} checks PASS; ${unique} genuinely different 3D `+
 `ground bastions, ${sites} assembled covers (${bossSites} boss covers), `+
 `${components} connected constructions, ${body} body + ${hitscan} bullet + `+
 `${rockets} rocket collisions, ${approachShots} external bullet and `+
 `${approachRockets} external rocket approaches, ${aiBlocked} AI masks, `+
 `${detours} navigable bypass edges, ${reachableCourts} uninterrupted `+
 `spawn→court routes, ${playerRoutes} player detours, `+
 `${airborneClear} clear trajectories over cover, `+
 `min ${minSites} covers/map, max ${maxSolids} solids, ${ghosts} fake walls`);
