'use strict';
// Stage81: every non-boss arena gains differentiated 3D-solid tactical walls.
// The test checks ACTUAL meshes, AABB collision, nav and projectile impacts.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0;
const check=(condition,reason)=>{assert.ok(condition,reason);checks++;};
const drawings=[];
const c={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],
 legacyResumeSector:-1,legacyResumeDivisor:18,glReady:true,touchOnly:false,
 gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:(dst,...args)=>{drawings.push(args.slice(0,6));},quad:()=>{},rcolor:v=>v,
 save:{settings:{quality:0,audio:false}},sound:()=>{},burst:()=>{},
 input:{jumpQueued:false},arsenalOpened:false,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['БОСС'],robotPalette:()=>({}),toast:()=>{},game:null,navField:null,navClock:0};
vm.createContext(c);
for(const name of ['03-height-and-collision.js','04a-static-world-solids.js','04-map-generation.js',
 '05-world-mesh.js','13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js','14-combat-raycast.js'])
 vm.runInContext(src(name),c,{filename:name});
const ev=e=>vm.runInContext(e,c);
check(/const GAME_BUILD='(81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(src('00-core-save.js')),'Stage81 build number');
check(/const MP_VERSION=(34|35|36|37|38|39|40|41|42)\b/.test(src('21b-multiplayer-lobby.js')),'Stage81 synchronized multiplayer protocol');
const footprints=new Map(),maps=new Set(),families=new Array(10).fill(0);
let scenes=0,volumeShots=0,exposed=0,minTiles=1000,maxTiles=0;
for(let level=1;level<=100;level++){
 if(level%5===0){
  c.glReady=false;c.buildMap(level);
  check(ev('ordinaryCourtPlan')===null,`L${level}: ordinary fort leaked into boss level`);
  check(ev('bossCourtPlan')!==null,`L${level}: lost existing boss fort`);
  continue;
 }
 const ordinal=level-1-Math.floor(level/5),kind=ordinal%10,variant=Math.floor(ordinal/10);
 // Test all 80 actual WebGL world meshes; selected ones in the high quality
 // renderer as well. Both modes use the same walls and spherical physics.
 const qualities=level%10===1?[0,2]:[0];
 for(const quality of qualities){
  c.glReady=true;c.touchOnly=quality===0;c.save.settings.quality=quality;
  drawings.length=0;c.buildMap(level);scenes++;
  const court=ev('ordinaryCourtPlan');
  check(!!court,`L${level} q${quality}: no court architecture`);
  check(court.kind===kind&&court.variant===variant,`L${level}: wrong tactical identity`);
  check(court.name===ev(`ordinaryCourtNames[${kind}]`),`L${level}: wrong court name`);
  check(court.tiles.length>=4,`L${level}: too few real cover tiles (${court.tiles.length})`);
  minTiles=Math.min(minTiles,court.tiles.length);
  maxTiles=Math.max(maxTiles,court.tiles.length);
  const n=c.mapSize,center=(n/2)|0,roof=c.ceilingHeight(),
   keys=new Set(court.tiles.map(p=>p.z*n+p.x));
  check(keys.size===court.tiles.length,`L${level}: repeated wall cell`);
  check(!c.collide(c.spawnX,c.spawnZ,.33),`L${level}: enclosed spawn`);
  check(!c.collide(c.portal.x,c.portal.z,.33),`L${level}: blocked portal`);
  const visible=new Set(drawings.map(b=>b.join('|'))),grid=ev('worldSolidGrid');
  for(const p of court.tiles){
   const lbl=`L${level} q${quality} (${p.x},${p.z})`;
   check(c.mapCells[p.z][p.x]===1,`${lbl}: render-only obstacle`);
   check(Math.abs(p.x-center)>2&&Math.abs(p.z-center)>2,`${lbl}: narrow spawn road`);
   check(c.collide(p.x+.5,p.z+.5,.30),`${lbl}: player passes through`);
   check(c.collide(p.x+.5,p.z+.5,1.03),`${lbl}: huge robot passes through`);
   if(![[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>
       c.mapCells[p.z+dz]?.[p.x+dx]===0))continue;
   exposed++;
   const box=[p.x,0,p.z,p.x+1,roof,p.z+1],id=box.join('|');
   check(visible.has(id),`${lbl}: visible 3D wall not drawn`);
   check((grid[p.z*n+p.x]||[]).some(s=>s.box.join('|')===id),
     `${lbl}: visible wall missing real solid volume`);
   if(volumeShots<500){
    const side=[[1,0],[-1,0],[0,1],[0,-1]].find(([dx,dz])=>
      c.mapCells[p.z+dz]?.[p.x+dx]===0);
    const [dx,dz]=side,o={x:p.x+dx+.5,y:1.5,z:p.z+dz+.5},d={x:-dx,y:0,z:-dz};
    const bullet=c.rayWall(o,d,1.2),rocket=c.sweepWorldSphere(o,d,1.2,.13),
     grenade=c.sweepWorldSphere(o,d,1.2,.2);
    check(!!bullet&&bullet.t<=1.01,`${lbl}: bullet passes through`);
    check(!!rocket&&rocket.t<=bullet.t+.000001,`${lbl}: rocket passes through`);
    check(!!grenade&&grenade.t<=rocket.t+.000001,`${lbl}: grenade passes through`);
    volumeShots++;
   }
  }
  // No U-shaped or ring-shaped solid is permitted to make a hidden sealed
  // walking island, even if the portal itself happens to be reachable.
  const q=[center*n+center],visited=new Uint8Array(n*n);visited[q[0]]=1;
  for(let k=0;k<q.length;k++){
   const t=q[k],x=t%n,z=(t/n)|0;
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const X=x+dx,Z=z+dz,key=Z*n+X;
    if(X<=0||Z<=0||X>=n-1||Z>=n-1||c.mapCells[Z][X]||visited[key])continue;
    visited[key]=1;q.push(key);
   }
  }
  for(let z=1;z<n-1;z++)for(let x=1;x<n-1;x++)
   if(!c.mapCells[z][x])check(!!visited[z*n+x],`L${level}: isolated open floor ${x},${z}`);
  for(let d=-8;d<=8;d++){
   check(c.mapCells[center]?.[center+d]===0,`L${level}: horizontal centre aisle is blocked`);
   check(c.mapCells[center+d]?.[center]===0,`L${level}: vertical centre aisle is blocked`);
  }
  // Proof of bot traversability on the real height/solid navigation graph.
  const route=[center*n+center],seen=new Uint8Array(n*n);seen[route[0]]=1;
  for(let k=0;k<route.length;k++){
   const t=route[k],x=t%n,z=(t/n)|0;
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const X=x+dx,Z=z+dz,key=Z*n+X;
    if(X<1||Z<1||X>=n-1||Z>=n-1||c.mapCells[Z][X]||seen[key]||
       !c.enemyNavEdge(x,z,X,Z))continue;
    seen[key]=1;route.push(key);
   }
  }
  check(!!seen[Math.floor(c.portal.z)*n+Math.floor(c.portal.x)],
   `L${level}: bot cannot reach mission portal`);
  const zone=ev('tacticalZone'),yard=ev('secondaryYard');
  check(!!zone&&!!seen[zone.cz*n+zone.cx],`L${level}: disconnected primary tactical grounds`);
  check(!!yard&&!!seen[yard.cz*n+yard.cx],`L${level}: disconnected secondary combat yard`);
  if(quality===0){
   const signature=court.tiles.map(p=>`${p.x-center},${p.z-center}`).sort().join('|');
   check(!footprints.has(signature),`L${level}: identical court as L${footprints.get(signature)}`);
   footprints.set(signature,level);families[kind]++;
   maps.add(c.mapCells.map(row=>row.join('')).join(''));
  }
 }
}
check(scenes===90&&footprints.size===80&&maps.size===80&&families.every(x=>x===8),
 'missing any of 80 unique non-boss tactical courts');
check(volumeShots>100&&exposed>500&&minTiles>=4,
 'insufficient actual 3D-solid ballistic obstacles');
console.log(`Stage81: ${checks} assertions, ${scenes} 3D scenes, 80 unique playable courts, ${volumeShots} bullet/rocket/grenade tests, ${exposed} exposed AABBs, wall-tile range ${minTiles}-${maxTiles}: PASS`);
