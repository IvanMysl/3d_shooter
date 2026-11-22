'use strict';
// Real procedurally generated 3D campaign worlds, no mocked objective sites.
// Prove both new two-phase operations stay physically navigable and completable.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
const selected=process.env.LEVELS?process.env.LEVELS.split(',').map(Number):
 Array.from({length:100},(_,i)=>i+1).filter(l=>(l>=12&&l%10===2)||(l>=16&&l%10===6));
let checks=0,worlds=0,sites=0,coils=0,reactors=0,mesh=0,events=[];
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
 robotNearArea:()=>false,enemyBlastSamples:()=>({points:[],hullDist:1}),hurtEnemy:()=>{}};
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
 c.game=null;c.glReady=[16,22,46,72,92].includes(level);c.save.settings.quality=level%2;c.buildMap(level);
 const g={state:'playing',sector:level,p:{x:c.spawnX,z:c.spawnZ,feetY:c.floorHeight(c.spawnX,c.spawnZ),
  maxhp:100,hp:100,armor:100,maxArmor:100,maxEnergy:100,energy:100,grounded:true,shield:1},
  t:1,sectorTime:0,spawned:10,target:10,enemies:[],particles:[],score:0,kills:10,
  nodes:[],devices:[],portalReady:false,nodesDestroyed:0,impactFx:[],scorch:[],loot:[]};
 c.game=g;c.spawnPowerNodes(level);c.startMission(g);c.initDevices(g);
 const kind=level%10===2?'containment':'conduit';
 ok(g.mission.type===kind,`L${level} expected ${kind}, got ${g.mission.type}`);
 ok(g.mission.nodesRequired>0,`L${level} has no reactor objective`);
 ok(g.mission.required>0,`L${level} mission quota empty`);
 const activeNodes=g.nodes.filter(n=>n.type!==2);
 for(const node of activeNodes){
  const h=c.floorHeight(node.x,node.z);
  ok(c.worldSolidBodyCollision(node.x,node.z,.24,h,1.65),`L${level} reactor not physical`);
  reactors++;
 }
 if(kind==='containment'){
  const timer=g.mission.surviveRemaining;
  c.updateMission(.5);ok(g.mission.surviveRemaining===timer&&!g.portalReady,`L${level} countdown before reactor disables`);
  for(const n of activeNodes.slice(0,g.mission.nodesRequired))c.damagePowerNode(n,n.hp+1);
  ok(g.mission.done===g.mission.required&&!g.portalReady,`L${level} reactor kills unexpectedly opened portal`);
  c.updateMission(.25);ok(g.mission.containmentStarted&&g.mission.surviveRemaining<timer,`L${level} siege not started`);
  c.updateMission(timer+1);ok(g.portalReady,`L${level} siege did not end`);
 }else{
  const ids=g.mission.coilIds;
  ok(ids.length===g.mission.coilsRequired,`L${level} mismatch coil quota`);
  ok(ids.every(id=>g.devices.some(d=>d.id===id&&d.kind==='coil')),`L${level} objective isn't a real coil`);
  const early=level%20===16;
  if(early){c.damagePowerNode(activeNodes[0],activeNodes[0].hp+1);
   ok(g.mission.nodesDisabled===1&&!g.portalReady,`L${level} early kill skipped physical coils`);}
  for(const id of ids){
   const device=g.devices.find(d=>d.id===id);
   const p=siteApproach(g,device);
   ok(!!p,`L${level} coil ${id} has no reachable unobstructed INTERACTION face`);
   if(!p)continue;
   sites++;coils++;g.p.x=p.x;g.p.z=p.z;g.p.feetY=p.feetY;g.p.grounded=true;g.p.shield=1;
   ok(c.worldSolidBodyCollision(device.x,device.z,.23,c.floorHeight(device.x,device.z),1.65),`L${level} coil not solid`);
   for(let n=0;n<10&&!device.used;n++)c.updateDevices(.16);
   ok(device.used,`L${level} physically reachable coil ${id} failed normal activation`);
  }
  ok(g.mission.coilsDisabled===ids.length,`L${level} coil progress mismatch`);
  if(!early)c.damagePowerNode(activeNodes[0],activeNodes[0].hp+1);
  ok(g.mission.nodesDisabled>=1&&g.mission.done===g.mission.required,`L${level} phase 2 not credited`);
  ok(g.portalReady,`L${level} finished operation did not open portal`);
 }
 ok(g.nodesDestroyed>0,`L${level} reactor never destroyed`);
 ok(g.nodes.filter(n=>n.dead).every(n=>!c.worldSolidBodyCollision(n.x,n.z,.18,c.floorHeight(n.x,n.z),1.65)),
  `L${level} destroyed reactor left physical ghost`);
 if([16,22,46,72,92].includes(level)){
  // A genuine generated WebGL-style mesh pass, even though execution is headless.
  mesh++;
  ok(!!c.worldMesh||c.worldChunks.length>0,`L${level} generated mesh missing`);
 }
 events.push(`L${level}:${kind}:${idsString(g)}`);worlds++;
}
function idsString(g){return g.mission.type==='conduit'?g.mission.coilIds.length+' coils':'holdout';}
console.log(`Stage97 actual two-phase operations: ${checks} PASS / ${worlds} procedural worlds / ${reactors} physical reactors / ${coils} real coil activations / ${sites} reachable contacts / ${mesh} 3D meshes; ${events.join(', ')}`);
