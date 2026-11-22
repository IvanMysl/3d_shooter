'use strict';
// Stage76: old cover acquires REAL 3D armour AND a genuinely EMPTY gun slit.
// Verifies every new visible part is collidable; also verifies deliberate
// openings do not accidentally acquire invisible collision-only proxy walls.
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
const touch=(a,b)=>[0,1,2].every(i=>a[i]<=b[i+3]+1e-6&&
 b[i]<=a[i+3]+1e-6);
check(/const GAME_BUILD='(76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),
 'Stage76 build version');
check(/const MP_VERSION=(29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(source('21b-multiplayer-lobby.js')),
 'Stage76 geometry has a new multiplayer protocol');
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
const identities=new Set(),qualityShapes=new Map(),
 families=Array(10).fill(0),variants=Array(10).fill(0);
let maps=0,groups=0,partsCount=0,bodies=0,hitscan=0,rockets=0,
 openSlits=0,liveShots=0,liveRockets=0,landings=0,jumpHits=0,
 connected=0,routes=0,clearance=0,phantoms=0,maxSolids=0,
 minGroups=100,bossGroups=0;
for(let level=1;level<=100;level++)for(const quality of [0,1,2]){
 ctx.glReady=true;ctx.touchOnly=quality!==2;
 ctx.save.settings.quality=quality;
 ctx.buildMap(level);maps++;
 const plan=ev('tacticalZone'),roof=ctx.ceilingHeight(),
  posts=ev('lastBastionWatchposts'),bastions=ev('lastGroundBastions'),
  parts=posts.parts;
 check(plan&&bastions?.sites?.length>=1,
  `L${level}: predecessor's real ground-cover foundations missing`);
 check(posts.family===Math.floor((level-1)/10)&&
  posts.variant===(level-1)%10,
  `L${level}: not one of the 100 unique engineering configurations`);
 check(posts.sites.length>=1&&posts.sites.length<=bastions.sites.length,
  `L${level}: missing complete armoured watchposts`);
 minGroups=Math.min(minGroups,posts.sites.length);
 if(quality===0){
  families[posts.family]++;variants[posts.variant]++;
  const p=posts.sites[0],one=parts.filter(v=>v.group===p.group),
   identity=one.map(q=>q.role+':'+q.box.map((v,i)=>
    (i===1||i===4?v:v-(i===0||i===3?p.x+.5:p.z+.5))
    .toFixed(4)).join(':')).sort().join('|');
  check(!identities.has(identity),`L${level}: repeated physical firing post`);
  identities.add(identity);
  qualityShapes.set(level,JSON.stringify(parts.map(p=>p.box)));
  if(level%5===0)bossGroups+=posts.sites.length;
 }else check(qualityShapes.get(level)===JSON.stringify(parts.map(p=>p.box)),
  `L${level}: graphics setting altered the physical gunport geometry`);
 const registered=new Set(ev('worldSolidGrid').flatMap(a=>a||[])
  .map(s=>key(s.box))),byGroup=new Map();
 for(const p of parts){
  if(!byGroup.has(p.group))byGroup.set(p.group,[]);
  byGroup.get(p.group).push(p);
 }
 check(byGroup.size===posts.sites.length,
  `L${level}: duplicate or disconnected defence group`);
 for(const [group,items] of byGroup){
  const site=posts.sites.find(p=>p.group===group),
   left=items.findIndex(p=>p.role==='watchLeftPillar'),
   right=items.find(p=>p.role==='watchRightPillar'),
   lintel=items.find(p=>p.role==='watchSolidLintel');
  check(site&&left>=0&&right&&lintel&&
   ['watchFrontLowerArmor','watchRearFootRail','watchIndividualCrest']
    .every(role=>items.some(p=>p.role===role)),
   `L${level}: incomplete load-bearing watchpost`);
  check(touch(items[left].box,site.hull)&&touch(right.box,site.hull),
   `L${level}: gunport supports float above former solid foundation`);
  const seen=new Set([left]),q=[left];
  for(let k=0;k<q.length;k++)for(let j=0;j<items.length;j++){
   if(!seen.has(j)&&touch(items[q[k]].box,items[j].box)){
    seen.add(j);q.push(j);
   }
  }
  check(seen.size===items.length,
   `L${level}: ${items.length-seen.size} unconnected 3D fragments`);
  connected++;
  const cx=site.x+.5,cz=site.z+.5,
   forward=ctx.tacticalRotate(0,1,site.orientation),
   side=ctx.tacticalRotate(-.31,0,site.orientation),
   openingY=1.74,normal={x:forward.x,y:0,z:forward.z};
  // Actual pass-through hole: ray and sphere cannot hit a collision-only
  // invisible centre. Floor-level former cover is below this line of fire.
  const start={x:cx-forward.x*.65,y:openingY,
   z:cz-forward.z*.65};
  const through=ctx.rayWall(start,normal,1.30),
   throughRocket=ctx.sweepWorldSphere(start,normal,1.30,.055);
  check(!through&&!throughRocket,
   `L${level}: supposed firing aperture is filled by invisible geometry`);
  check(!ctx.worldSolidBodyCollision(cx,cz,.06,1.68,.11),
   `L${level}: hidden collision-only box inside gun slit`);
  openSlits++;
  // Aim from the same real open air into an armour pillar. The first hit
  // must be one of THIS new post's own registered boxes, not an old wall.
  const aim={x:cx+side.x-forward.x*.68,y:openingY,
   z:cz+side.z-forward.z*.68},
   shot=ctx.rayWall(aim,normal,.80),
   rocket=ctx.sweepWorldSphere(aim,normal,.80,.055),
   own=new Set(items.map(p=>key(p.box)));
  check(shot&&shot.t>.01&&own.has(key(shot.solid?.box||[])),
   `L${level}: real incoming bullet ignores the solid left shield`);
  check(rocket&&rocket.t>.01&&own.has(key(rocket.solid?.box||[])),
   `L${level}: real incoming rocket ignores the solid left shield`);
  liveShots++;liveRockets++;
  check(ctx.worldSolidHeadBarrier(cx,cz,.08,1.84,2.18)!==null,
   `L${level}: jumping player's head passes through steel lintel`);
  jumpHits++;
  check(ctx.worldSolidStandingSupport(cx,cz,.08,lintel.box[4],.015)!==null,
   `L${level}: flight landing passes through the physical steel lintel`);
  landings++;
  // The former bastion's 3x3 connected ground detour still has generous
  // clearance: no new part can extend beyond its ALREADY blocked home tile.
  for(const p of items){
   const b=p.box;
   check(b[0]>=site.x+.035&&b[3]<=site.x+.965&&
    b[2]>=site.z+.035&&b[5]<=site.z+.965,
    `L${level}: new side armour intrudes into open robot detour`);
  }
  groups++;
 }
 for(const p of parts){
  const b=p.box;
  check(b.every(Number.isFinite)&&b[3]>b[0]&&b[4]>b[1]&&
   b[5]>b[2]&&b[1]>=0&&b[4]<roof-.19,
   `L${level}: illegal solid volume (${p.role})`);
  if(!registered.has(key(b))){phantoms++;continue;}
  partsCount++;
  const x=(b[0]+b[3])/2,y=(b[1]+b[4])/2,z=(b[2]+b[5])/2;
  check(ctx.worldSolidBodyCollision(x,z,.055,Math.max(0,y-.17),.44),
   `L${level}: player passes through ${p.role}`);bodies++;
  check(ctx.rayWall({x,y,z},{x:1,y:0,z:0},.04)?.t<.001,
   `L${level}: hitscan passes through ${p.role}`);hitscan++;
  check(ctx.sweepWorldSphere({x,y,z},{x:0,y:0,z:1},.04,.06)?.t<.001,
   `L${level}: spherical rocket passes through ${p.role}`);rockets++;
  const loX=Math.max(1,Math.floor(b[0]-.26)),
   hiX=Math.min(ctx.mapSize-2,Math.floor(b[3]+.26)),
   loZ=Math.max(1,Math.floor(b[2]-.26)),
   hiZ=Math.min(ctx.mapSize-2,Math.floor(b[5]+.26));
  for(let Z=loZ;Z<=hiZ;Z++)for(let X=loX;X<=hiX;X++){
   if(ctx.mapCells[Z][X]!==0)continue;
   const upper=Math.max(ctx.floorHeightAtCell(X,Z),ctx.deckAtCell(X,Z));
   if(upper>.15){
    check(b[1]>=upper+2.25-.001||b[4]<=upper+.16,
     `L${level}: armour blocks previously traversable elevated gallery`);
    clearance++;
   }
  }
 }
 check(phantoms===0,`L${level}: visual-only solid combat obstacle`);
 check(route(ctx.spawnX,ctx.spawnZ,plan.cx+.5,plan.cz+.5),
  `L${level}: robot route severed by guard emplacements`);routes++;
 maxSolids=Math.max(maxSolids,ev('worldSolidCount'));
 check(ev('worldSolidCount')<17000,
  `L${level}: Android static collision budget exceeded`);
}
check(maps===300&&identities.size===100&&minGroups>=1&&
 families.every(n=>n===10)&&variants.every(n=>n===10)&&
 groups>=300&&openSlits===groups&&connected===groups&&
 liveShots===groups&&liveRockets===groups&&landings===groups&&
 jumpHits===groups&&bodies===partsCount&&hitscan===partsCount&&
 rockets===partsCount&&phantoms===0&&routes===300&&bossGroups>=20,
 'Stage76 100 real armoured slit emplacements regressions');
console.log(`Stage76: ${checks} checks PASS; 100 unique complete physical `+
 `gunport designs, ${groups} grounded connected posts (${bossGroups} `+
 `in boss maps), ${partsCount} identical visible/solid AABBs, `+
 `${hitscan} ray + ${rockets} rocket + ${bodies} body impacts, `+
 `${liveShots} real outside bullet + ${liveRockets} rocket impacts, `+
 `${openSlits} physically OPEN loopholes, ${jumpHits} head barriers, `+
 `${landings} flight landings, ${clearance} elevated clearance checks, `+
 `${routes} intact routes, minimum ${minGroups} posts/map, max `+
 `${maxSolids} registered solids, ${phantoms} phantom obstacles`);
