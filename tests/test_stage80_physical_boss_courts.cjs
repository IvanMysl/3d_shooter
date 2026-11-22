'use strict';
// V80: all 20 boss centre arenas have REAL new masonry, not only draw calls.
// Exercise the full map build in low and high quality, compare the wall grid,
// rendered AABBs, player/robot body collision, and hitscan/swept projectiles.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0;const check=(condition,reason)=>{assert.ok(condition,reason);checks++;};
const drawings=[];
const c={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],
 legacyResumeSector:-1,legacyResumeDivisor:18,glReady:false,touchOnly:false,
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
check(/const GAME_BUILD='(80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(src('00-core-save.js')),'Stage80 release stamp');
check(/const MP_VERSION=(33|34|35|36|37|38|39|40|41|42)\b/.test(src('21b-multiplayer-lobby.js')),'changed map geometry rejects old PvP clients');
const signatures=new Set(),designs=new Set(),shapeCounts=new Array(5).fill(0);
let scenes=0,fullBlockers=0,ballisticContacts=0;
// All ordinary levels must have no boss-ground plans; fast non-WebGL pass.
for(let level=1;level<=100;level++)if(level%5!==0){
 c.glReady=false;c.buildMap(level);
 check(ev('bossCourtPlan')===null,`L${level}: boss wall leaks into ordinary level`);
}
// The heavyweight geometry/ballistics audit only needs 20 boss arenas.
for(let level=5;level<=100;level+=5)for(const quality of [0,2]){
 c.glReady=true;c.touchOnly=quality===0;c.save.settings.quality=quality;drawings.length=0;
 c.buildMap(level);scenes++;
 const court=ev('bossCourtPlan');
 check(!!court,`L${level} q${quality}: missing 3D boss-ground architecture`);
 const kind=(level/5-1)%5,variant=Math.floor((level/5-1)/5);
 check(court.kind===kind&&court.variant===variant,`L${level}: incorrect motif/variation`);
 check(court.name===ev(`bossCourtNames[${kind}]`),`L${level}: name does not match plan`);
 check(court.tiles.length>=4,`L${level}: boss motif too sparse: ${court.tiles.length}`);
 const n=c.mapSize,center=Math.floor(n/2),roof=c.ceilingHeight();
 check(!c.collide(c.spawnX,c.spawnZ,.3),`L${level}: wall blocks player spawn`);
 check(!c.collide(c.portal.x,c.portal.z,.25),`L${level}: portal is inside solid wall`);
 check(court.tiles.every(p=>c.mapCells[p.z]?.[p.x]===1),`L${level}: ghost-only boss architecture`);
 check(court.tiles.every(p=>Math.hypot(p.x-center,p.z-center)>6.5),`L${level}: inner duel courtyard blocked`);
 for(const p of court.tiles){
  const label=`L${level} q${quality} at (${p.x},${p.z})`;
  check(c.collide(p.x+.5,p.z+.5,.27),`${label}: player passes through boss wall`);
  check(c.collide(p.x+.5,p.z+.5,1.03),`${label}: boss-sized body passes through wall`);
  // Interior wall cells are merged into the opaque maze (not drawn as hidden faces).
  // The grid blocks their bodies even when the renderer culls internal faces.
 }
 const unique=new Set(court.tiles.map(p=>p.z*n+p.x));
 check(unique.size===court.tiles.length,`L${level}: duplicate fortification tiles`);
 // The world builder uses ordinary wall cells, which are batched and
 // registered with exact [x,0,z,x+1,roof,z+1] volumes on exposed faces.
 const visible=new Set(drawings.map(b=>b.join('|')));
 const grid=ev('worldSolidGrid');
 let surface=0;
 for(const p of court.tiles){
  if(![[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>c.mapCells[p.z+dz]?.[p.x+dx]===0))continue;
  surface++;
  const b=[p.x,0,p.z,p.x+1,roof,p.z+1],key=b.join('|');
  check(visible.has(key),`L${level} q${quality}: physical wall missing its drawn mesh ${key}`);
  check((grid[p.z*n+p.x]||[]).some(s=>s.box.join('|')===key),
   `L${level} q${quality}: visible wall missing registered 3D AABB ${key}`);
  if(ballisticContacts<200&&surface<=4){
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    if(c.mapCells[p.z+dz]?.[p.x+dx]!==0)continue;
    const o={x:p.x+dx+.5,y:1.49,z:p.z+dz+.5},d={x:-dx,y:0,z:-dz};
    const bullet=c.rayWall(o,d,1.3),rocket=c.sweepWorldSphere(o,d,1.3,.13);
    check(bullet!==null&&bullet.t<=1.1,`L${level}: bullet tunnels through fort wall`);
    check(rocket!==null&&rocket.t<=bullet.t+.0001,`L${level}: rocket tunnels through fort wall`);
    ballisticContacts++;break;
   }
  }
 }
 check(surface>0,`L${level}: new fort is hidden inside existing walls`);
 fullBlockers+=surface;
 // Three-cell-wide cardinal battle lanes must remain free for the boss and
 // player even where the centre contains old elevated stair structures.
 for(let t=-10;t<=10;t++){
  check(c.mapCells[center]?.[center+t]===0,`L${level}: east-west boss passage closed at ${t}`);
  check(c.mapCells[center+t]?.[center]===0,`L${level}: north-south boss passage closed at ${t}`);
 }
 // Check the ACTUAL navigation edges rather than assuming the map grid's
 // floor cells are automatically climbable by non-flying enemies.
 const q=[center*n+center],seen=new Uint8Array(n*n);seen[q[0]]=1;
 for(let k=0;k<q.length;k++){
  const cell=q[k],x=cell%n,z=(cell/n)|0;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=x+dx,Z=z+dz,key=Z*n+X;
   if(X<1||Z<1||X>=n-1||Z>=n-1||seen[key]||c.mapCells[Z][X]||
     !c.enemyNavEdge(x,z,X,Z))continue;
   seen[key]=1;q.push(key);
  }
 }
 const portalIdx=Math.floor(c.portal.z)*n+Math.floor(c.portal.x);
 check(!!seen[portalIdx],`L${level}: enemy cannot reach boss portal by walking`);
 const approach=ev('bossApproachPlan');
 check(!!approach&&!!seen[approach.cz*n+approach.cx],`L${level}: boss assault route isolated`);
 if(quality===0){
  const sig=court.tiles.map(p=>`${p.x-center},${p.z-center}`).sort().join('|');
  check(!signatures.has(sig),`L${level}: duplicated physical boss arena motif`);
  signatures.add(sig);shapeCounts[kind]++;
  designs.add(c.mapCells.map(row=>row.join('')).join(''));
 }
}
check(scenes===40&&signatures.size===20&&designs.size===20&&
 shapeCounts.every(x=>x===4)&&ballisticContacts>40&&fullBlockers>100,
 'campaign did not get 20 genuinely different, ballistic-solid boss courts');
console.log(`Stage80 physical boss courts: ${checks} assertions, ${scenes} full boss builds + 80 ordinary map checks, ${ballisticContacts} bullet/rocket contact probes, 20 unique 3D wall layouts PASS`);
