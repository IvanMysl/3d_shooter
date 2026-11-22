'use strict';
// Ten physically distinct normal-level combat-yard families; eight different
// routes in each family. Validate the ACTUAL grid, robot navigation, and shots.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
let checks=0;
const check=(v,msg)=>{assert.ok(v,msg);checks++;};
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
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js'])
 vm.runInContext(source(n),ctx,{filename:n});
const ev=s=>vm.runInContext(s,ctx);
check(/const GAME_BUILD='(68|69|70|71|72|73|74|75|76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),'V68+ build stamp');
check(/const MP_VERSION=(21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(source('21b-multiplayer-lobby.js')),
 'new game geometry must reject old multiplayer clients');
const familyShapes=new Map(),shapeSignatures=new Set(),campaignShapes=new Set();
const shapeOwners=new Map();
const byKind=new Array(10).fill(0);
let generated=0,normal=0,boss=0,connected=0,blockedShots=0;
function reachable(sx,sz,gx,gz){
 const n=ctx.mapSize,seen=new Uint8Array(n*n),q=new Int32Array(n*n);
 let first=0,last=0;
 const source=Math.floor(sz)*n+Math.floor(sx),goal=Math.floor(gz)*n+Math.floor(gx);
 q[last++]=source;seen[source]=1;
 while(first<last){
  const v=q[first++];if(v===goal)return true;
  const x=v%n,z=Math.floor(v/n);
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=x+dx,Z=z+dz,k=Z*n+X;
   if(X<1||Z<1||X>=n-1||Z>=n-1||seen[k]||ctx.mapCells[Z][X]||
      !ctx.enemyNavEdge(x,z,X,Z))continue;
   seen[k]=1;q[last++]=k;
  }
 }
 return false;
}
for(let level=1;level<=100;level++)for(const quality of [0,2]){
 ctx.glReady=true;ctx.touchOnly=quality===0;ctx.save.settings.quality=quality;
 ctx.buildMap(level);generated++;
 const yard=ev('secondaryYard');
 if(level%5===0){
  boss++;
  check(yard===null,`L${level}: oversized boss map has an ordinary second yard`);
  continue;
 }
 normal++;
 check(yard!==null,`L${level}: no secondary ground combat yard`);
 check(yard.kind===Math.floor((level-1)/10),`L${level}: wrong yard family`);
 const slot=(level-1)%10;
 check(yard.variant===(slot<4?slot:slot-1),`L${level}: wrong flanking identity`);
 const tiles=ctx.secondaryYardCells(yard),n=ctx.mapSize;
 check(tiles.length>=32,`L${level}: combat yard too small`);
 const local=new Set(tiles.map(p=>p.z*n+p.x));
 const seen=new Set([tiles[0].z*n+tiles[0].x]),q=[tiles[0]];
 for(let i=0;i<q.length;i++)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const X=q[i].x+dx,Z=q[i].z+dz,key=Z*n+X;
  if(local.has(key)&&!seen.has(key)){seen.add(key);q.push({x:X,z:Z});}
 }
 check(seen.size===tiles.length,`L${level}: yard has diagonal-only or unreachable tiles`);
 for(const p of tiles)
  check(ctx.mapCells[p.z]?.[p.x]===0,`L${level}: yard passage is a solid wall`);
 const signature=tiles.map(p=>{
  const t=ctx.tacticalRotate(p.x-yard.cx,p.z-yard.cz,(4-yard.orientation)%4);
  return `${t.x},${t.z}`;
 }).sort().join('|');
 const family=familyShapes.get(yard.kind)||new Set();
 family.add(signature);familyShapes.set(yard.kind,family);
 if(quality===0){
  byKind[yard.kind]++;
  check(!shapeSignatures.has(signature),
   `L${level}: new flanking plan repeated from level ${shapeOwners.get(signature)}`);
  shapeSignatures.add(signature);
  shapeOwners.set(signature,level);
  const map=ctx.mapCells.map(row=>row.join('')).join('');
  check(!campaignShapes.has(map),`L${level}: full map repeated`);
  campaignShapes.add(map);
 }
 check(ctx.floorHeight(yard.cx+.5,yard.cz+.5)<=1.32,
  `L${level}: new ground combat yard overlaps an inaccessible rooftop`);
 check(reachable(ctx.spawnX,ctx.spawnZ,yard.cx+.5,yard.cz+.5),
  `L${level}: a walking robot cannot reach the new yard`);
 check(reachable(yard.cx+.5,yard.cz+.5,ev('tacticalZone.cx')+.5,ev('tacticalZone.cz')+.5),
  `L${level}: yard cannot connect to old tactical annex`);
 connected++;
 let shot=false;
 for(const p of tiles){
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=p.x+dx,Z=p.z+dz;
   if(X<2||Z<2||X>=n-2||Z>=n-2||
     Math.abs(X-yard.cx)>7||Math.abs(Z-yard.cz)>7||
     !ctx.mapCells[Z][X]||local.has(Z*n+X))continue;
   const hit=ctx.rayWall({x:p.x+.5,y:1,z:p.z+.5},{x:dx,y:0,z:dz},1);
   check(hit&&hit.t<=.58,`L${level}: bullet passes through yard cover`);
   check(ctx.worldSolidBodyCollision(X+.5,Z+.5,.15,0,1.95),
    `L${level}: yard cover has no physical body`);
   shot=true;blockedShots++;break;
  }
  if(shot)break;
 }
 check(shot,`L${level}: excavation removed all physical cover`);
}
check(generated===200&&normal===160&&boss===40&&connected===160&&
 blockedShots===160&&familyShapes.size===10&&shapeSignatures.size===80&&
 campaignShapes.size===80&&byKind.every(v=>v===8)&&
 [...familyShapes.values()].every(s=>s.size===8),
 'missing any of the ten families or eighty actually unique connected yards');
console.log(`Stage68: ${checks} checks PASS; ${normal} normal-world samples / 80 unique physical yards in 10 families; ${connected} tested robot routes, ${blockedShots} wall impacts, ${boss} unmodified boss samples`);
