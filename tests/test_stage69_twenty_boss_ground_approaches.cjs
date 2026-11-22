'use strict';
// Physical ground-space identity for ALL 20 bosses: five structural plans,
// four different genuine approach shapes per plan, no teleporting AI.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
let checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++;};
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
check(/const GAME_BUILD='(69|70|71|72|73|74|75|76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),'V69+ build stamp');
check(/const MP_VERSION=(22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(source('21b-multiplayer-lobby.js')),
 'multiplayer clients with different map geometry must be rejected');
const signatures=new Map(),allShapes=new Set(),bossMaps=new Set();
const kindCount=new Array(5).fill(0);
let generated=0,bossCount=0,normalCount=0,realPaths=0,realBarriers=0;
function reachable(sx,sz,gx,gz){
 const n=ctx.mapSize,visited=new Uint8Array(n*n),q=new Int32Array(n*n);
 let first=0,last=0;
 const start=Math.floor(sz)*n+Math.floor(sx),finish=Math.floor(gz)*n+Math.floor(gx);
 q[last++]=start;visited[start]=1;
 while(first<last){
  const key=q[first++];if(key===finish)return true;
  const x=key%n,z=Math.floor(key/n);
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=x+dx,Z=z+dz,k=Z*n+X;
   if(X<1||Z<1||X>=n-1||Z>=n-1||visited[k]||ctx.mapCells[Z][X]||
      !ctx.enemyNavEdge(x,z,X,Z))continue;
   visited[k]=1;q[last++]=k;
  }
 }
 return false;
}
for(let level=1;level<=100;level++)for(const quality of [0,2]){
 ctx.glReady=true;ctx.touchOnly=quality===0;ctx.save.settings.quality=quality;
 ctx.buildMap(level);generated++;
 const plan=ev('bossApproachPlan');
 if(level%5!==0){
  normalCount++;
  check(plan===null,`L${level}: boss approach leaked into regular arena`);
  continue;
 }
 bossCount++;
 const order=level/5-1,kind=order%5,variant=Math.floor(order/5);
 check(plan!==null,`L${level}: new boss ground plan missing`);
 check(plan.kind===kind&&plan.variant===variant,
  `L${level}: wrong boss approach family or construction variant`);
 check(plan.name===ev(`bossApproachNames[${kind}]`),
  `L${level}: boss approach name does not match its shape`);
 const cells=ctx.bossApproachCells(plan),n=ctx.mapSize;
 check(cells.length>=36,`L${level}: boss approach is a miniature`);
 const local=new Set(cells.map(p=>p.z*n+p.x));
 const seen=new Set([cells[0].z*n+cells[0].x]),q=[cells[0]];
 for(let i=0;i<q.length;i++)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const X=q[i].x+dx,Z=q[i].z+dz,key=Z*n+X;
  if(local.has(key)&&!seen.has(key)){seen.add(key);q.push({x:X,z:Z});}
 }
 check(seen.size===cells.length,`L${level}: disconnected boss ground pockets`);
 for(const p of cells)
  check(ctx.mapCells[p.z]?.[p.x]===0,`L${level}: real approach cell is blocked`);
 const signature=cells.map(p=>{
  const v=ctx.tacticalRotate(p.x-plan.cx,p.z-plan.cz,(4-plan.orientation)%4);
  return `${v.x},${v.z}`;
 }).sort().join('|');
 const seenKind=signatures.get(kind)||new Set();
 seenKind.add(signature);signatures.set(kind,seenKind);
 if(quality===0){
  kindCount[kind]++;
  check(!allShapes.has(signature),`L${level}: repeated boss ground silhouette`);
  allShapes.add(signature);
  const map=ctx.mapCells.map(row=>row.join('')).join('');
  check(!bossMaps.has(map),`L${level}: identical boss ground map`);
  bossMaps.add(map);
 }
 check(ctx.ceilingHeight()>=17.5,`L${level}: lost boss ceiling height`);
 check(ctx.bossSkylineBoxes(level,ctx.spawnX,ctx.spawnZ,ctx.ceilingHeight()).length>=8,
  `L${level}: lost monumental boss sky structure`);
 const approachFeet=ctx.floorHeight(plan.cx+.5,plan.cz+.5);
 check(Number.isFinite(approachFeet)&&approachFeet<=3.08,
  `L${level}: assault gate is suspended on an unreachable high platform at ${plan.cx},${plan.cz}, feet=${approachFeet}`);
 check(reachable(ctx.spawnX,ctx.spawnZ,plan.cx+.5,plan.cz+.5),
  `L${level}: robots cannot walk from central boss hall to approach`);
 check(reachable(plan.cx+.5,plan.cz+.5,ev('tacticalZone.cx')+.5,ev('tacticalZone.cz')+.5),
  `L${level}: boss approach cannot reach the old tactical flank`);
 realPaths++;
 let shot=false;
 const nearby=[];
 for(let z=Math.max(2,plan.cz-12);z<Math.min(n-2,plan.cz+13);z++)
  for(let x=Math.max(2,plan.cx-12);x<Math.min(n-2,plan.cx+13);x++)
   if(!ctx.mapCells[z][x]&&Math.hypot(x-plan.cx,z-plan.cz)<=12)
    nearby.push({x,z});
 nearby.sort((a,b)=>Math.hypot(a.x-plan.cx,a.z-plan.cz)-
  Math.hypot(b.x-plan.cx,b.z-plan.cz));
 for(const t of nearby){
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=t.x+dx,Z=t.z+dz;
   if(X<2||Z<2||X>=n-2||Z>=n-2||
     Math.hypot(X-plan.cx,Z-plan.cz)>12||
     !ctx.mapCells[Z][X]||
     !reachable(plan.cx+.5,plan.cz+.5,t.x+.5,t.z+.5))continue;
   const hit=ctx.rayWall({x:t.x+.5,y:1,z:t.z+.5},{x:dx,y:0,z:dz},1);
   check(hit&&hit.t<=.58,`L${level}: a remaining wall does not stop bullets`);
   check(ctx.worldSolidBodyCollision(X+.5,Z+.5,.15,0,1.95),
    `L${level}: a remaining wall is only visual`);
   shot=true;realBarriers++;break;
  }
  if(shot)break;
 }
 check(shot,`L${level}: no reachable real wall within twelve tiles of boss flank`);
}
check(generated===200&&bossCount===40&&normalCount===160&&
 realPaths===40&&realBarriers===40&&signatures.size===5&&
 allShapes.size===20&&bossMaps.size===20&&
 kindCount.every(k=>k===4)&&[...signatures.values()].every(s=>s.size===4),
 'campaign is missing some of the twenty distinct physical boss approaches');
console.log(`Stage69: ${checks} checks PASS; 20 distinct boss ground silhouettes in five families, 40 tested walking AI routes, 40 real ballistic cover impacts, and 160 untouched normal-world builds`);
