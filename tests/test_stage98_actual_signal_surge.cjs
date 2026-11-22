'use strict';
// Real procedurally generated 3D campaign worlds, no mocked objective sites.
// Prove both new two-phase operations stay physically navigable and completable.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
const selected=process.env.LEVELS?process.env.LEVELS.split(',').map(Number):
 Array.from({length:100},(_,i)=>i+1).filter(l=>(l>=13&&l%10===3)||(l>=17&&l%10===7));
let checks=0,worlds=0,sites=0,terminals=0,reactors=0,mesh=0,events=[];
function ok(v,m){assert.ok(v,m);checks++;}
const c={console,Math,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),distance:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),
 mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],legacyResumeSector:-1,legacyResumeDivisor:18,
 glReady:false,touchOnly:false,gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:v=>v,
 save:{settings:{quality:0,audio:false},credits:0},sound:()=>{},burst:()=>{},saveRun:()=>{},
 damagePlayer:()=>{},input:{jumpQueued:false},arsenalOpened:false,navField:null,navClock:0,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['БОСС'],robotPalette:()=>{},toast:()=>{},game:null,
 robotNearArea:()=>false,enemyBlastSamples:()=>({points:[],hullDist:1}),hurtEnemy:()=>{},
 pick:a=>a[0],bossNames:['Босс'], '$':()=>({style:{},textContent:''})};
vm.createContext(c);
for(const name of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js','15-mission-system.js',
 '16-mission-devices.js']) vm.runInContext(src(name),c,{filename:name});
function siteApproach(g,site){
 const sx=Math.floor(site.x),sz=Math.floor(site.z),field=c.missionGroundField(c.spawnX,c.spawnZ);
 for(const [dx,dz] of [[1,0],[0,1],[-1,0],[0,-1]]){
  const x=sx+dx,z=sz+dz;if(x<1||z<1||x>=c.mapSize-1||z>=c.mapSize-1)continue;
  const p={x:x+.5,z:z+.5,feetY:c.floorHeight(x+.5,z+.5)};
  if(field[z*c.mapSize+x]>=0&&c.missionInteractionClear(p,site,site.kind==='coil'?'device':'device')&&
     !c.worldSolidBodyCollision(p.x,p.z,.23,p.feetY,1.65))return p;
 }
 return null;
}

for(const level of selected){
 c.game=null;c.glReady=[13,27,43,67,93].includes(level);c.save.settings.quality=level%2;c.buildMap(level);
 const g={state:'playing',sector:level,p:{x:c.spawnX,z:c.spawnZ,feetY:c.floorHeight(c.spawnX,c.spawnZ),
  maxhp:100,hp:100,armor:100,maxArmor:100,maxEnergy:100,energy:100,grounded:true,shield:5,damage:1,crit:0,vamp:0},
  t:1,sectorTime:0,spawned:10,target:10,enemies:[],particles:[],score:0,kills:10,
  nodes:[],devices:[],portalReady:false,nodesDestroyed:0,impactFx:[],scorch:[],loot:[],idCounter:0,robotDebris:[]};
 c.game=g;c.spawnPowerNodes(level);c.startMission(g);c.initDevices(g);
 const kind=level%10===3?'signal':'surge';
 ok(g.mission.type===kind,`L${level} expected ${kind}`);
 const m=g.mission,physicalNodes=g.nodes.filter(n=>!n.dead&&n.type!==2);
 const ids=kind==='signal'?m.signalIds:m.surgeIds;
 ok(ids.length>0,`L${level}: no physical terminal chosen`);
 ok(ids.every(id=>g.devices.some(d=>d.id===id&&d.kind==='battery')),`L${level}: objective must be a real battery terminal`);
 for(const id of ids){
  const d=g.devices.find(v=>v.id===id),p=siteApproach(g,d);
  ok(!!p,`L${level}: terminal ${id} has no WALKABLE outside interaction face`);
  ok(c.worldSolidBodyCollision(d.x,d.z,.23,c.floorHeight(d.x,d.z),1.65),`L${level}: decorative-only terminal ${id}`);
  if(!p)continue;
  terminals++;sites++;
  Object.assign(g.p,p);g.p.grounded=true;g.p.shield=5;
  for(let k=0;k<11&&!d.used;k++)c.updateDevices(.16);
  ok(d.used,`L${level}: normal contact failed for terminal ${id}`);
 }
 if(kind==='signal'){
  ok(m.signalDone===m.signalRequired&&m.done===m.signalDone,`L${level}: scan progress wrong`);
  // Use the normal wave spawner, not a mock commander. It must probe the
  // final elite silhouette against physical equipment BEFORE placement.
  g.spawned=Math.floor(g.target*.48);g.waveDelay=0;
  c.spawnWave(.8);
  const e=g.enemies.find(v=>v.id===m.sentinelId);
  ok(!!e,`L${level}: real marked elite commander not spawned`);
  if(e){
   const r=Math.max(c.enemyBodyRadius(e),c.enemyCrowdRadius(e));
   ok(e.elite&&e.radius>0,`L${level}: commander was not elite on creation`);
   ok(!c.worldSolidBodyCollision(e.x,e.z,r,e.feetY,c.enemyBodyHeight(e)),`L${level}: commander intersects metal`);
   ok(!c.collide(e.x,e.z,r),`L${level}: commander intersects wall`);
   reactors+=0; // tracked reactor totals independently
   e.dead=true;m.commanderKilled=true;c.missionRefreshCombinedProgress(m);
   g.spawned=g.target;g.enemies=[];c.maybeFinishMission(g);
   ok(g.portalReady&&m.done===m.required,`L${level}: radio interception cannot finish`);
  }
 }else{
  ok(physicalNodes.length>=m.nodesRequired&&m.nodesRequired>0,`L${level}: no physical reactors`);
  ok(m.surgeReady&&m.surgeRequired===1,`L${level}: station did not energize resonance`);
  const battery=g.devices.find(d=>d.id===ids[0]);
  const preserved=m.surgeRemaining;
  c.updateMission(preserved+.25);
  ok(!m.surgeReady&&!battery.used&&!g.portalReady,`L${level}: no timed repeatable battery reset`);
  // Walk back to the same real metal terminal for a second attempt.
  const p=siteApproach(g,battery);ok(!!p,`L${level}: retry station became unreachable`);
  Object.assign(g.p,p);g.p.grounded=true;g.p.shield=5;
  for(let k=0;k<11&&!battery.used;k++)c.updateDevices(.16);
  ok(battery.used&&m.surgeReady&&m.surgeActivations===2,`L${level}: cannot restart resonance`);
  for(const node of physicalNodes.slice(0,m.nodesRequired)){
   const ground=c.floorHeight(node.x,node.z);
   ok(c.worldSolidBodyCollision(node.x,node.z,.23,ground,1.65),`L${level}: reactor not physical`);
   reactors++;c.damagePowerNode(node,node.hp+1);
   ok(!c.worldSolidBodyCollision(node.x,node.z,.23,ground,1.65),`L${level}: ghost collider after destruction`);
  }
  g.spawned=g.target;g.enemies=[];c.maybeFinishMission(g);
  ok(g.portalReady&&m.done===m.required,`L${level}: surge cannot finish`);
 }
 if([13,27,43,67,93].includes(level)){
  mesh++;ok(!!c.worldMesh||c.worldChunks.length>0,`L${level}: 3D mesh missing`);
 }
 events.push(`L${level}:${kind}:${ids.length} terminals`);worlds++;
}
console.log(`Stage98 real operations: ${checks} PASS / ${worlds} maps / ${terminals} metal terminal activations / ${reactors} real reactors / ${mesh} 3D meshes; ${events.join(', ')}`);
