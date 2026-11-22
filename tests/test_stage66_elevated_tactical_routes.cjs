'use strict';
// Eight actual 1.32m climbable tactical lookouts with 100 distinct upper plans.
// Verify every stair riser, height-map collider, ground robot movement edge,
// walkable branch and formerly protected landmark in BOTH graphics settings.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
let checks=0;const check=(v,msg)=>{assert.ok(v,msg);checks++;};
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
for(const name of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js'])
 vm.runInContext(source(name),ctx,{filename:name});
const ev=s=>vm.runInContext(s,ctx);
check(/const GAME_BUILD='(66|67|68|69|70|71|72|73|74|75|76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),'V66+ build stamp');
check(/const MP_VERSION=(19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(source('21b-multiplayer-lobby.js')),
 'changed map topology must reject old multiplayer peers');
const fingerprints=new Map(),mapSignatures=new Set(),byKind=new Array(8).fill(0),
 elevatedSignatures=new Set();
let samples=0,solidShots=0,reachable=0,retainedLandmarks=0,retainedBalconies=0;
function groundReachable(x,z,usePhysics=true){
 const n=ctx.mapSize,source=Math.floor(ctx.spawnZ)*n+Math.floor(ctx.spawnX);
 const goal=Math.floor(z)*n+Math.floor(x),seen=new Uint8Array(n*n),queue=new Int32Array(n*n);
 let first=0,last=0;queue[last++]=source;seen[source]=1;
 while(first<last){
  const cur=queue[first++];if(cur===goal)return true;
  const xx=cur%n,zz=Math.floor(cur/n);
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=xx+dx,Z=zz+dz,K=Z*n+X;
   if(X<1||Z<1||X>=n-1||Z>=n-1||seen[K]||ctx.mapCells[Z][X]||
      (usePhysics&&!ctx.enemyNavEdge(xx,zz,X,Z)))continue;
   seen[K]=1;queue[last++]=K;
  }
 }
 return false;
}
for(let level=1;level<=100;level++)for(const quality of [0,2]){
 ctx.glReady=true;ctx.touchOnly=quality===0;ctx.save.settings.quality=quality;
 ctx.buildMap(level);samples++;
 const rise=ev('tacticalRisePlan'),installed=ev('tacticalRiseSpecs');
 if([2,4,6,9].includes((level-1)%18)){
  check(rise===null&&installed.length===0,
   `L${level}: a new long lookout overwrote the protected legacy sky bridges`);
 }else{
 check(rise!==null,`L${level} q${quality}: no suitable high lookout site`);
 check(installed.length===1,
  `L${level} q${quality}: lookout was not physically installed (pre-existing geometry overlap)`);
 check(rise.profile===level-1&&rise.kind>=0&&rise.kind<8,
  `L${level}: invalid unique heightmap plan`);
 const elevated=ctx.tacticalRiseCells(rise);
 check(elevated.length>=35,`L${level}: raised span too small`);
 check(ctx.floorHeightAtCell(rise.cx,rise.cz)<.001,
  `L${level}: old flat tactical centre turned into an inaccessible cliff`);
 const localRaised=new Map(elevated.map(c=>[c.z*ctx.mapSize+c.x,c]));
 const raisedVisited=new Set([elevated[0].z*ctx.mapSize+elevated[0].x]);
 const raisedQueue=[elevated[0]];
 for(let i=0;i<raisedQueue.length;i++){
  const at=raisedQueue[i];
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const key=(at.z+dz)*ctx.mapSize+at.x+dx,p=localRaised.get(key);
   if(!p||raisedVisited.has(key)||Math.abs(p.h-at.h)>.245)continue;
   raisedVisited.add(key);raisedQueue.push(p);
  }
 }
 check(raisedVisited.size===elevated.length,
  `L${level}: orphaned elevated firing platforms or excessive step jumps`);
 for(const p of elevated){
  check(ctx.mapCells[p.z]?.[p.x]===0,
   `L${level}: elevated tile embedded in original uncarved wall`);
  check(Math.abs(ctx.floorHeightAtCell(p.x,p.z)-p.h)<.001,
   `L${level}: rendered stairs and physical heightmap disagree`);
  check(ctx.enemyNavTile(p.x,p.z),
   `L${level} q${quality}: a solid boss pier, wall detail or beam blocks an upper firing bay (${p.x},${p.z}, h=${p.h})`);
  check(!ctx.worldSolidBodyCollision(p.x+.5,p.z+.5,.23,p.h,1.95),
   `L${level} q${quality}: operator helmet strikes overhead structure on the tactical lookout (${p.x},${p.z}, h=${p.h})`);
 }
 // A complete walking route from the old zero-height nexus all the way to
 // the farthest upper platform. 22cm steps stay below the bot's 24.5cm limit.
 let previous={x:rise.cx,z:rise.cz};
 for(let u=1;u<=13;u++){
  const d=ctx.tacticalRotate(u,0,rise.orientation),next={x:rise.cx+d.x,z:rise.cz+d.z};
  check(ctx.enemyNavEdge(previous.x,previous.z,next.x,next.z),
   `L${level} q${quality}: robot cannot climb real riser ${u} (${JSON.stringify(next)})`);
  previous=next;
 }
 if(quality===0){
  const fingerprint=elevated.map(p=>`${p.u}:${p.v}:${p.h.toFixed(2)}`).sort().join('|');
  check(!elevatedSignatures.has(fingerprint),
   `L${level}: duplicate raised layout in the 100-level campaign`);
  elevatedSignatures.add(fingerprint);
 }
 }
 const p=ev('tacticalZone');
 check(p&&p.kind>=0&&p.kind<8,`L${level} q${quality}: tactical arena missing`);
 check(p.name===ev(`tacticalNames[${p.kind}]`),`L${level}: tactic name mismatch`);
 check(p.kind===(Math.floor((level-1)/18)*5+((level-1)%18)*3)%8,
  `L${level}: tactical sequence is not level-dependent`);
 const cells=ctx.tacticalCells(p);
 check(cells.length>=38,`L${level}: miniature or invisible tactical arena`);
 const local=new Set(cells.map(q=>q.z*ctx.mapSize+q.x));
 const visited=new Set([cells[0].z*ctx.mapSize+cells[0].x]);
 const q=[cells[0]];
 for(let head=0;head<q.length;head++){
  const cur=q[head];
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=cur.x+dx,Z=cur.z+dz,key=Z*ctx.mapSize+X;
   if(!local.has(key)||visited.has(key))continue;
   visited.add(key);q.push({x:X,z:Z});
  }
 }
 check(visited.size===cells.length,
  `L${level}: orphaned open tiles inside the tactical design`);
 for(const tile of cells){
  check(ctx.mapCells[tile.z]?.[tile.x]===0,
   `L${level}: tactical walkway sealed by a nonphysical wall ${tile.x},${tile.z}`);
 }
 const shape=cells.map(q=>{
  const orig=ctx.tacticalRotate(q.x-p.cx,q.z-p.cz,(4-p.orientation)%4);
  return `${orig.x}:${orig.z}`;
 }).sort().join('|');
 if(fingerprints.has(p.kind))check(fingerprints.get(p.kind)===shape,
  `L${level}: tactical identity changed with RNG`);
 else fingerprints.set(p.kind,shape);
 if(quality===0){
  byKind[p.kind]++;
  const fingerprint=ctx.mapCells.map(row=>row.join('')).join('');
  check(!mapSignatures.has(fingerprint),`L${level}: indistinguishable ground layout`);
  mapSignatures.add(fingerprint);
 }
 const player=ctx.floorHeight(p.cx+.5,p.cz+.5);
 check(Number.isFinite(player)&&player<=1.32,
  `L${level}: tactical entry is embedded in an inaccessible solid roof: ${JSON.stringify(p)}, feet=${player}`);
 check(groundReachable(p.cx+.5,p.cz+.5),
  `L${level}: robots cannot reach the new combat arena ${JSON.stringify(p)}, y=${player}, grid=${groundReachable(p.cx+.5,p.cz+.5,false)}, hubfeet=${ctx.floorHeight(ctx.spawnX,ctx.spawnZ)}, hubnav=${ctx.enemyNavTile(Math.floor(ctx.spawnX),Math.floor(ctx.spawnZ))}`);reachable++;
 const landmark=ev('landmarkSpecs'),balcony=ev('balconySpecs');
 if([2,4,6,9].includes((level-1)%18)){
  check(balcony.length>=4&&ev('midlevelSpecs.length')===2,
   `L${level}: old high-altitude routes broken`);retainedBalconies++;
 }else{
  check(landmark.length===1,`L${level}: existing climbable landmark lost`);
  retainedLandmarks++;
 }
 // Search for true walls beside the newly excavated patterns. A shot from
 // a connected open tile must hit a SOLID volume, even on low-quality mode.
 const set=new Set(cells.map(q=>q.z*ctx.mapSize+q.x));
 let shotFound=false;
 for(const t of cells){
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=t.x+dx,Z=t.z+dz;
   if(Math.abs(X-p.cx)>6||Math.abs(Z-p.cz)>6||
      X<2||Z<2||X>=ctx.mapSize-2||Z>=ctx.mapSize-2||
      !ctx.mapCells[Z][X]||set.has(Z*ctx.mapSize+X))continue;
   const hit=ctx.rayWall({x:t.x+.5,y:1.0,z:t.z+.5},
    {x:dx,y:0,z:dz},1.0);
   check(hit&&hit.t<=.58,`L${level}: bullet passes through tactical barrier`);
   check(ctx.worldSolidBodyCollision(X+.5,Z+.5,.15,0,1.95),
    `L${level}: tactical barrier is visual-only`);
   solidShots++;shotFound=true;break;
  }
  if(shotFound)break;
 }
 check(shotFound,`L${level}: no real cover survived inside the tactical arena`);
}
check(samples===200&&reachable===200&&mapSignatures.size===100&&
 elevatedSignatures.size>=70&&
 fingerprints.size===8&&new Set(fingerprints.values()).size===8&&
 retainedLandmarks>=130&&retainedBalconies>=40&&solidShots===200,
 'missing eight-family / vertical route / physical-cover coverage');
check(byKind.every(v=>v>=6),'the campaign never uses some tactical concept');
console.log(`Stage66: ${checks} checks PASS; ${samples} worlds, ${elevatedSignatures.size} distinct real elevated plans, ${fingerprints.size} tactical concepts, ${reachable} preserved ground paths, ${solidShots} ballistic covers`);
