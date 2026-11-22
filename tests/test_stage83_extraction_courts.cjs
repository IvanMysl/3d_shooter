'use strict';
// V83: 100 genuinely physical extraction defenses, preserving every old
// campaign route and the exact renderer/body/projectile collision agreement.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0;function check(v,msg){assert.ok(v,msg);checks++;}
const draws=[];
const c={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],
 legacyResumeSector:-1,legacyResumeDivisor:18,glReady:false,touchOnly:false,
 gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:(dst,...args)=>{draws.push(args.slice(0,6));},quad:()=>{},rcolor:v=>v,
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
check(/const GAME_BUILD='(83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(src('00-core-save.js')),'wrong build');
check(/const MP_VERSION=(36|37|38|39|40|41|42)\b/.test(src('21b-multiplayer-lobby.js')),'wrong multiplayer geometry version');
let scenes=0,exposed=0,balls=0,min=Infinity,max=0,missing=[];
const profiles=new Set();const types=Array(10).fill(0),variants=Array(10).fill(0);
for(let level=1;level<=100;level++){
 c.glReady=false;c.buildMap(level);
 let plan=ev('extractionCourtPlan');
 check(plan!==null,`L${level}: no portal defenses`);
 check(plan.kind===(level-1)%10,`L${level}: wrong engineering type`);
 check(plan.variant===Math.floor((level-1)/10),`L${level}: wrong design variant`);
 check(plan.tiles.length>=1,`L${level}: no real new cells`);
 types[plan.kind]++;variants[plan.variant]++;
 min=Math.min(min,plan.tiles.length);max=Math.max(max,plan.tiles.length);
 const sz=c.mapSize,idx=(x,z)=>z*sz+x;
 check(c.mapCells[Math.floor(c.portal.z)][Math.floor(c.portal.x)]===0,
   `L${level}: portal obstructed`);
 check(!c.collide(c.spawnX,c.spawnZ,.30),`L${level}: player spawn obstructed`);
 check(!c.collide(c.portal.x,c.portal.z,.28),`L${level}: portal obstructed for player`);
 check(new Set(plan.tiles.map(p=>idx(p.x,p.z))).size===plan.tiles.length,
   `L${level}: duplicate defensive wall`);
 for(const p of plan.tiles){
  check(c.mapCells[p.z]?.[p.x]===1,`L${level}: nonphysical defense`);
  check(c.collide(p.x+.5,p.z+.5,.36),`L${level}: collision missing`);
  check(c.collide(p.x+.5,p.z+.5,1.05),`L${level}: large robot passes through`);
  check(Math.hypot(p.x-plan.portalX,p.z-plan.portalZ)>2.25,
   `L${level}: portal's real approach blocked`);
 }
 // Every reachable floor cell must remain in the same connected component;
 // real terrestrial AI movement to the portal must still work.
 const start=idx(Math.floor(c.spawnX),Math.floor(c.spawnZ)),seen=new Uint8Array(sz*sz),q=[start];seen[start]=1;
 for(let i=0;i<q.length;i++){
  const key=q[i],x=key%sz,z=(key/sz)|0;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=x+dx,Z=z+dz,k=idx(X,Z);
   if(X<1||Z<1||X>=sz-1||Z>=sz-1||seen[k]||c.mapCells[Z][X])continue;
   seen[k]=1;q.push(k);
  }
 }
 for(let z=1;z<sz-1;z++)for(let x=1;x<sz-1;x++)
  if(!c.mapCells[z][x])check(seen[idx(x,z)],`L${level}: stranded floor ${x},${z}`);
 check(seen[idx(Math.floor(c.portal.x),Math.floor(c.portal.z))],`L${level}: portal unreachable`);
 const nav=new Uint8Array(sz*sz),nq=[start];nav[start]=1;
 for(let i=0;i<nq.length;i++){
  const key=nq[i],x=key%sz,z=(key/sz)|0;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=x+dx,Z=z+dz,k=idx(X,Z);
   if(X<1||Z<1||X>=sz-1||Z>=sz-1||nav[k]||c.mapCells[Z][X]||
      !c.enemyNavEdge(x,z,X,Z))continue;
   nav[k]=1;nq.push(k);
  }
 }
 check(nav[idx(Math.floor(c.portal.x),Math.floor(c.portal.z))],
   `L${level}: ground robot cannot reach portal`);
 // Every level's physical footprint has its own name and tile profile.
 // The profile is useful diagnostics, not a false guarantee of 100 totally
 // distinct missions: some restricted corners remove some wall elements.
 const key=plan.tiles.map(p=>`${p.x-plan.portalX},${p.z-plan.portalZ}`).sort().join(';');
 profiles.add(key);
 // All 100 levels are audited above using the EXACT blocked grid.
 // Full 3D construction is expensive, so use 25+ representative scenes
 // spanning all 10 types, every tenth variant, and boss/ordinary levels.
 const qual=(level<=10||level%10===0||level%17===0)?
   ((level===1||level===50)?[0,2]:[0]):[];
 for(const quality of qual){
  c.save.settings.quality=quality;c.touchOnly=quality===0;c.glReady=true;
  draws.length=0;c.buildMap(level);scenes++;
  plan=ev('extractionCourtPlan');
  check(plan!==null,`L${level} q${quality}: missing plan`);
  const render=new Set(draws.map(x=>x.join('|')));
  const grid=ev('worldSolidGrid'),roof=c.ceilingHeight();
  for(const p of plan.tiles){
   if(![[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>c.mapCells[p.z+dz]?.[p.x+dx]===0))continue;
   exposed++;
   const coords=[p.x,0,p.z,p.x+1,roof,p.z+1],k=coords.join('|');
   check(render.has(k),`L${level} q${quality}: wall has no visible 3D box ${k}`);
   check((grid[idx(p.x,p.z)]||[]).some(v=>v.box.join('|')===k),
    `L${level} q${quality}: visible box has no 3D collider ${k}`);
   if(balls<750){
    const [dx,dz]=[[1,0],[-1,0],[0,1],[0,-1]].find(([dx,dz])=>
      c.mapCells[p.z+dz]?.[p.x+dx]===0);
    const o={x:p.x+dx+.5,y:1.45,z:p.z+dz+.5},d={x:-dx,y:0,z:-dz};
    const bullet=c.rayWall(o,d,1.25),rocket=c.sweepWorldSphere(o,d,1.25,.13),
     grenade=c.sweepWorldSphere(o,d,1.25,.2);
    check(bullet&&bullet.t<=1.01,`L${level}: bullets pass through fort`);
    check(rocket&&rocket.t<=bullet.t+1e-5,`L${level}: rockets pass through fort`);
    check(grenade&&grenade.t<=rocket.t+1e-5,`L${level}: grenades pass through fort`);
    balls++;
   }
  }
 }
}
check(exposed>=100,`Too few visual/physical surfaces: ${exposed}`);
check(balls>=100,`Too few ballistic probes: ${balls}`);
check(types.every(n=>n===10),'not all families represented');
check(variants.every(n=>n===10),'not all variants represented');
console.log(JSON.stringify({status:'PASS',checks,scenes,exposed,balls,uniqueProfiles:profiles.size,
  minCells:min,maxCells:max},null,2));
