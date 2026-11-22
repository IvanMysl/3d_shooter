'use strict';
// Stage50: real map generation, human stairs/jumps, upper-level robot paths,
// and low/high-quality WebGL static collision. No browser or network needed.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const file=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
let checks=0;
const check=(pass,why)=>{assert.ok(pass,why);checks++;};
const ctx={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(a,b,c)=>Math.min(c,Math.max(b,a)),
 rand:(a,b)=>a+Math.random()*(b-a),
 mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],legacyResumeSector:-1,
 legacyResumeDivisor:18,glReady:false,touchOnly:false,gl:{deleteBuffer(){}},
 worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:a=>a,
 save:{settings:{quality:0,audio:false}},sound:()=>{},burst:()=>{},
 input:{jumpQueued:false},arsenalOpened:false,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['БОСС'],robotPalette:()=>({}),toast:()=>{},game:null};
vm.createContext(ctx);
for(const f of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js'])vm.runInContext(file(f),ctx);
const ev=s=>vm.runInContext(s,ctx);
const styles=[2,4,6,9];
const lobbySource=fs.readFileSync(path.resolve(__dirname,'../src/21b-multiplayer-lobby.js'),'utf8');
check(/const MP_VERSION=(4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(lobbySource),
 'changed map geometry must reject pre-Stage50 multiplayer clients');

// All 100 campaign sectors, not just the four screenshots or first seed.
const first=Math.max(1,Number(process.env.FIRST||1)),last=Math.min(100,Number(process.env.LAST||100));
for(let level=first;level<=last;level++){
 ctx.glReady=false;ctx.buildMap(level);
 const style=(level-1)%18;
 const decks=ev('balconySpecs');
 const plans=ev('balconyPlans');
 if(styles.includes(style)){
  check(decks.length>=4,`level ${level} has fewer than four real balconies`);
  check(plans.length>=decks.length,`level ${level} lost its authored balcony plans`);
  check(decks.some(d=>d.y>3),`level ${level} missing high (3.08 m) balcony`);
  for(const b of decks){
   check(Math.abs(b.y-b.steps*.22)<.00001,`level ${level} altitude mismatch`);
   check(Math.abs(ctx.deckHeight(b.cx+.5,b.cz+.5)-b.y)<.00001,
     `level ${level} deck support mismatch`);
   const edge=b.side>0?2:-1;
   for(let i=1;i<=b.steps;i++){
    const u=edge+b.side*i;
    const x=b.axis==='x'?b.cx+u:b.cx,z=b.axis==='z'?b.cz+u:b.cz;
    check(Math.abs(ctx.floorHeight(x+.5,z+.5)-(b.steps+1-i)*.22)<.00001,
      `level ${level} stair ${i} is missing or too tall`);
   }
  }
 }else check(decks.length===0,`level ${level} accidentally changed old map style`);
 // The square grid is just ONE fully connected ground storey.
 const m=ctx.mapCells,n=ctx.mapSize,c=Math.floor(n/2);
 const seen=new Set([c*n+c]),q=[c*n+c];
 for(let head=0;head<q.length;head++){
  const key=q[head],x=key%n,z=(key/n)|0;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=x+dx,Z=z+dz,k=Z*n+X;
   if(X<0||Z<0||X>=n||Z>=n||m[Z][X]||seen.has(k))continue;
   seen.add(k);q.push(k);
  }
 }
 const opened=m.reduce((s,row)=>s+row.filter(v=>v===0).length,0);
 check(seen.size===opened,`level ${level} has disconnected walkable ground cells`);
 if(styles.includes(style))check(ctx.floorHeight(ctx.spawnX,ctx.spawnZ)===0,
   `level ${level} cannot enter new balcony maps from a flat main floor`);
}

function runWorld(style,quality){
 ctx.glReady=true;ctx.save.settings.quality=quality;
 const level=style+1;
 ctx.buildMap(level);
 const b=ev('balconySpecs[0]');
 const u=(b.side>0?2:-1)+b.side*(b.steps+1);
 const x=b.axis==='x'?b.cx+u+.5:b.cx+.5;
 const z=b.axis==='z'?b.cz+u+.5:b.cz+.5;
 const p={x,z,feetY:0,grounded:true,vy:0};
 ctx.game={p,enemies:[],particles:[],t:0,idCounter:0,sector:level,spawned:0};
 const step=-b.side*.05;
 for(let i=0;i<(b.steps+3)*20;i++){
  ctx.moveEntity(p,b.axis==='x'?step:0,b.axis==='z'?step:0,.23);
  ctx.updateVertical(p,1/60);
 }
 check(Math.abs(p.feetY-b.y)<.045,
  `style ${style}, quality ${quality}: cannot walk upstairs (${p.x.toFixed(2)},${p.z.toFixed(2)}, y=${p.feetY.toFixed(2)} vs ${b.y})`);
 check(Math.hypot(p.x-(b.cx+.5),p.z-(b.cz+.5))<.65,
  `style ${style}, quality ${quality}: balcony landing unreachable`);
 check(!ctx.worldSolidBodyCollision(p.x,p.z,.23,p.feetY,1.95),
  `style ${style}, quality ${quality}: solid blocks upstairs player`);
 check(!ctx.worldSolidBodyCollision(p.x,p.z,.23,0,1.95),
  `style ${style}, quality ${quality}: lower underpass not free`);
 check(ev('worldSolidCount')>1000,`style ${style}, quality ${quality}: 3D geometry absent`);
 check(ev('worldSolidCount')<15000,`style ${style}, quality ${quality}: excessive static collision objects`);

 // A pedestrian robot has an actual path UP, even with physical rails.
 const e={x,z,feetY:0,type:'scout',maxhp:100,radius:.48,orbit:1,airborne:false};
 e.x=x;e.z=z;
 p.x=b.cx+.5;p.z=b.cz+.5;p.feetY=b.y;p.grounded=true;
 ctx.game.enemies=[e];
 for(let k=0;k<420;k++){
  const h=ctx.enemyHeading(e,p);
  ctx.enemyMove(e,h.dx*.055,h.dz*.055,.23);
  ctx.game.t+=.033;
 }
 check(e.feetY>b.y-.3,`style ${style}, quality ${quality}: enemy never climbed`);
 check(Math.hypot(e.x-p.x,e.z-p.z)<1.1,
  `style ${style}, quality ${quality}: enemy trapped below balcony`);

 // Descending robots can use the same ordinary staircase in reverse.
 p.x=x;p.z=z;p.feetY=0;
 for(let k=0;k<420;k++){
  const h=ctx.enemyHeading(e,p);
  ctx.enemyMove(e,h.dx*.055,h.dz*.055,.23);
  ctx.game.t+=.033;
 }
 check(e.feetY<.4,`style ${style}, quality ${quality}: upper robot cannot descend stairs`);

 // Elevated spawn is safe and uses the *upper* floor as real actor feet.
 ctx.game.p={x:ctx.spawnX,z:ctx.spawnZ,feetY:0};
 ctx.game.enemies=[];
 const high=ctx.randBalconySpawn(6,.48,1.9);
 check(high&&high.feetY>2.15,`style ${style}, quality ${quality}: no upper robot spawn`);
 check(!ctx.worldSolidBodyCollision(high.x,high.z,.48,high.feetY,1.9),
  `style ${style}, quality ${quality}: upper robot spawn collides`);
 let elevated=0;
 for(let attempt=0;attempt<90;attempt++){
  ctx.game.enemies=[];
  const spawned=ctx.spawnEnemy('scout');
  if(spawned?.feetY>2.15)elevated++;
 }
 check(elevated>=6&&elevated<=65,
  `style ${style}, quality ${quality}: real robot spawning does not diversify height`);

 // Leaving a high platform initiates gravity; only its main ground remains.
 const fall={x:b.cx+.5,z:b.cz+.5,feetY:b.y,grounded:true,vy:0};
 ctx.game.p=fall;
 const away=b.side*.06;
 for(let i=0;i<125;i++){
  ctx.moveEntity(fall,b.axis==='x'?away:0,b.axis==='z'?away:0,.23);
  ctx.updateVertical(fall,1/60);
 }
 check(fall.feetY<b.y-.35,
  `style ${style}, quality ${quality}: no descent from balcony (x=${fall.x.toFixed(2)}, z=${fall.z.toFixed(2)}, y=${fall.feetY.toFixed(2)}, deck=${b.y})`);

 // A side edge WITHOUT a connecting sky gallery still permits a deliberate
 // jump. Stage51 connects some old "open" edges to an upper walkway.
 const across=b.axis==='x'?'z':'x';
 const origin=b.axis==='x'?b.cz:b.cx;
 const side=([-1,1].find(s=>{
  const x=b.axis==='x'?b.cx:b.cx+s*3.5;
  const z=b.axis==='x'?b.cz+s*3.5:b.cz;
  return ctx.deckHeight(x+.5,z+.5)<.05;
 }))||-1;
 const lip=origin+(side<0?-2:3);
 const initial=origin+(side<0?-1.35:2.35);
 const jumper={x:across==='x'?initial:b.cx+.5,
  z:across==='z'?initial:b.cz+.5,feetY:b.y,grounded:true,vy:0};
 ctx.game.p=jumper;ctx.input.jumpQueued=true;
 for(let i=0;i<12;i++)ctx.updateVertical(jumper,1/60);
 const jumpDir=side;
 for(let i=0;i<95;i++){
  ctx.moveEntity(jumper,across==='x'?jumpDir*.075:0,across==='z'?jumpDir*.075:0,.23);
  ctx.updateVertical(jumper,1/60);
 }
 const ended=across==='x'?jumper.x:jumper.z;
 check((ended-lip)*jumpDir>.6,
  `style ${style}, quality ${quality}: jump cannot clear balcony railing (start=${initial.toFixed(2)}, lip=${lip.toFixed(2)}, end=${ended.toFixed(2)}, height=${jumper.feetY.toFixed(2)})`);
 check(jumper.feetY<b.y-.5,
  `style ${style}, quality ${quality}: jumping off balcony never falls`);
}
const selectedStyles=(process.env.WORLD_STYLES||'2,4,6,9').split(',').filter(Boolean).map(Number);
const selectedQualities=(process.env.WORLD_QUALITIES||'0,2').split(',').filter(Boolean).map(Number);
for(const style of selectedStyles)for(const quality of selectedQualities)runWorld(style,quality);
console.log('Stage50 balcony worlds: '+checks+' geometry, stairs, AI, spawn and 100-level checks passed');
