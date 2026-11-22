'use strict';
// Stage84: deterministic objective sites, grounded routes and no accidental
// floating/unreachable devices across ALL 100 existing physical worlds.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0;function check(v,msg){assert.ok(v,msg);checks++;}
const c={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),distance:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],
 legacyResumeSector:-1,legacyResumeDivisor:18,glReady:false,touchOnly:false,
 gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:v=>v,
 save:{settings:{quality:0,audio:false},credits:0},sound:()=>{},burst:()=>{},saveRun:()=>{},
 input:{jumpQueued:false},arsenalOpened:false,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['БОСС'],robotPalette:()=>{},toast:()=>{},game:null,navField:null,navClock:0};
vm.createContext(c);
for(const name of ['03-height-and-collision.js','04a-static-world-solids.js','04-map-generation.js',
 '05-world-mesh.js','13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js',
 '14-combat-raycast.js','15-mission-system.js','16-mission-devices.js'])vm.runInContext(src(name),c,{filename:name});
const ev=e=>vm.runInContext(e,c),distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

const crypto=require('node:crypto');
// Stage85 must not secretly introduce nonphysical world geometry: these six
// source modules remain exactly the Stage84 authored walls/meshes/colliders.
const physics={
 '03-height-and-collision.js':'3987724d1977128017f37002f3efe37809a6fa125a85ef480724e416ab4aa39a',
 '04a-static-world-solids.js':'c8de82c7c8d8b06e9dc6dc2aaff054573a3568dd97b6f6a71e97aa514a8640cb',
 '04-map-generation.js':'28d6d296d70a6d8b38086f336f40bd21e17de7e19de8c8350f8b0f95bf396bd8',
 '05-world-mesh.js':'bd9274a4cfc3419e6bd32c5e5ff5068f8fc803f47e7405d291681d44cbfe1d3f',
 '13a-enemy-world-navigation.js':'fd5864245bfa359ebf1ce40f717d79e3ecbfb320848b862a062f29befaec70f9',
 '14-combat-raycast.js':'9be498ad23d4b91f5b7557c405baf25e7cc945517de6287f40c4248636a9d0ec'
};
// Stage86 deliberately introduces equipment physics, keeping static map
// construction and world-mesh generation identical to Stage85.
// Stage88 intentionally repairs four glReady-gated VERTICAL collision paths
// inside 03. Pin that reviewed new file to its own exact checksum; the map
// generator and world mesh must remain byte-identical to their Stage84 forms.
const stage88Vertical='011a4b19e33bcac88526364c0a70349b167528148c5a8ace201b5cd786faf221';
// Stage105 changes only ground-NPC movement headroom; map generation/mesh remain frozen.
const stage105Motion='5dd61ec0b436e98561b2ac314368e8665b6cdcd6364bdeaa1aaf3a90e713d4f0';
const stage110LowMetalContacts='84bd6bc61bc166c34642bd1588d99e649e1024495a8d8ccd24cb762671aeb249';
const stage109TerrainContacts='884863e8e0162cf5a9333490dc7b2f4d3450a7dfff8e545226496d883c4fb07d';
const stage108DeckStairTransitions='5ba9e34a4c9ca8b32b106721d12383b66ee506a224cac2c46f446a6e7c4faa18';
const stage107DeckEdges='57292197721e3be4e833092ac11d317cad92060453d90bb0d4e9d30a07a71321';
const stage106OpaqueStairs='81bf8ffb8761e7441fba18cd4e5fb6d737d1df8586f304dca2ea4cf2e5c5778d';
for(const name of ['03-height-and-collision.js','04-map-generation.js','05-world-mesh.js']){
 const expected=name==='03-height-and-collision.js'&&/GAME_BUILD='(?:114|115)'/.test(src('00-core-save.js'))
  ?'4567c5ab4a3c199fdac08d8d1e303dc4d16b2130a828e2bc6b7afd7f14a8d50e':name==='03-height-and-collision.js'&&/GAME_BUILD='113'/.test(src('00-core-save.js'))
  ?'da12de32395e2931b9573a610e3e5c15bc0b6f519f3d2b32484648dfa28f6e17':name==='03-height-and-collision.js'&&/GAME_BUILD='112'/.test(src('00-core-save.js'))
  ?'17d1df36d4141eadaf4c5ed22f13aa4dc62ff48d11b8c833f28b9e49999daff7':name==='03-height-and-collision.js'&&/GAME_BUILD='111'/.test(src('00-core-save.js'))
  ?'5e00b9e33d0dbaededf29ed9dc8bc5123c0b2ac73ee979cdb5d6f3113f7d0d0c':name==='03-height-and-collision.js'&&/GAME_BUILD='110'/.test(src('00-core-save.js'))
  ?stage110LowMetalContacts:name==='03-height-and-collision.js'&&/GAME_BUILD='109'/.test(src('00-core-save.js'))
  ?stage109TerrainContacts:name==='03-height-and-collision.js'&&/GAME_BUILD='108'/.test(src('00-core-save.js'))
  ?stage108DeckStairTransitions:name==='03-height-and-collision.js'&&/GAME_BUILD='107'/.test(src('00-core-save.js'))
  ?stage107DeckEdges:name==='05-world-mesh.js'&&/GAME_BUILD='(?:106|107|108|109|110|111|112|113|114|115)'/.test(src('00-core-save.js'))
  ?stage106OpaqueStairs:name==='03-height-and-collision.js'&&/GAME_BUILD='(?:105|106|107|108|109|110|111|112|113|114|115)'/.test(src('00-core-save.js'))
  ?stage105Motion:name==='03-height-and-collision.js'&&
   /GAME_BUILD='(?:88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104)'/.test(src('00-core-save.js'))
  ?stage88Vertical:physics[name];
 check(crypto.createHash('sha256').update(src(name)).digest('hex')===expected,
  `Core authored geometry changed unexpectedly: ${name}`);
}
check(src('04a-static-world-solids.js').includes('function worldEquipmentGrid()'),
 'stage86 equipment bodies are missing');
check(/GAME_BUILD='(?:87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(src('00-core-save.js')),'build tag');
check(/MP_VERSION=(?:40|41|42)\b/.test(src('21b-multiplayer-lobby.js')),'network protocol tag');
const first=Math.max(1,Number(process.env.FIRST||1)),last=Math.min(100,Number(process.env.LAST||100));
let staged=0,free=0,stagedArchives=0,stagedRelays=0,geometricProbes=0;
for(let level=first;level<=last;level++){
 c.glReady=false;c.save.settings.quality=0;c.buildMap(level);
 const g={state:'playing',sector:level,p:{x:c.spawnX,z:c.spawnZ,feetY:c.floorHeight(c.spawnX,c.spawnZ),
  maxhp:100,hp:100,armor:100,maxArmor:100,maxEnergy:100,energy:100,grounded:true,shield:0},
  t:0,sectorTime:0,spawned:0,target:10,enemies:[],particles:[],score:0,kills:0,nodes:[],devices:[],portalReady:false};
 c.game=g;c.spawnPowerNodes(level);c.startMission(g);c.initDevices(g);
 let m=g.mission;
 check(m.version===(m.type==='signal'||m.type==='surge'?4:3),`L${level}: correct Stage97/98 mission protocol version`);
 check(m.routeMode===c.missionRouteMode(level,m.type),`L${level}: protocol determinism`);
 let targets=m.type==='recovery'?m.caches:
  m.type==='relay'?g.devices.filter(d=>d.kind==='relay'):[];
 check(m.required>=0&&m.done===0,`L${level}: mission counters`);
 check(m.routeMode==='free'||targets.length===m.required,`L${level}: route targets count`);
 const idSet=targets.map(q=>q.id);
 const isStaged=targets.length>1&&m.routeMode!=='free';
 check((m.routeOrder.length>0)===isStaged,`L${level}: active stages vs operation mode`);
 if(isStaged){
  staged++;if(m.type==='recovery')stagedArchives++;else stagedRelays++;
  const order=m.routeOrder;
  check(new Set(order).size===targets.length&&order.every(id=>idSet.includes(id)),
   `L${level}: route is not a permutation of objectives`);
  const distances=c.missionGroundField(c.spawnX,c.spawnZ);
  const lengths=order.map(id=>{
   const o=targets.find(x=>x.id===id),k=Math.floor(o.z)*c.mapSize+Math.floor(o.x);
   return c.missionApproachDistance(distances,o);
  });
  check(lengths.every(d=>d>0),`L${level}: target is beyond ground navigation graph`);
  for(let j=1;j<lengths.length;j++)check(m.routeMode==='near-first'?
   lengths[j]>=lengths[j-1]:lengths[j]<=lengths[j-1],`L${level}: wrong graph-aware sort`);
  const blocked=targets.find(q=>q.id===order[order.length-1]);
  check(!c.missionItemActive(g,blocked,m.type),`L${level}: last target falsely active`);
  g.p.x=blocked.x;g.p.z=blocked.z;g.p.feetY=c.floorHeight(blocked.x,blocked.z);
  if(m.type==='recovery'){
   for(let i=0;i<5;i++)c.updateMission(.15);
   check(!blocked.got&&m.done===0,`L${level}: out-of-order archive could be collected`);
  }else{
   for(let i=0;i<15;i++)c.updateDevices(.15);
   check(!blocked.used&&blocked.charge===0&&m.done===0,`L${level}: inactive relay activated`);
  }
  check(c.missionWaypoint(g).id===order[0],`L${level}: HUD guides to inactive objective`);
  check(c.missionSequenceHint(g).length>0,`L${level}: no mission briefing`);
  // The actual objective UI route must use each legal ground edge.
  const active=targets.find(q=>q.id===order[0]);
  const guide=c.missionRouteTo({x:c.spawnX,z:c.spawnZ},active,2*c.mapSize*c.mapSize);
  check(guide.length>1,`L${level}: can't navigate to active stage`);
  for(let k=1;k<guide.length;k++)check(c.playerNavEdge(
   Math.floor(guide[k-1].x),Math.floor(guide[k-1].z),
   Math.floor(guide[k].x),Math.floor(guide[k].z)),`L${level}: waypoint crosses a real wall`);
  // Save/resume after the first stage, keeping EXACT progression and ordering.
  for(let j=0;j<order.length;j++){
   const t=targets.find(q=>q.id===order[j]);
   check(c.missionItemActive(g,t,m.type),`L${level}: next stage disabled`);
   g.p.x=t.x;g.p.z=t.z;g.p.feetY=c.floorHeight(t.x,t.z);
   if(m.type==='recovery')c.updateMission(.016);
   else for(let i=0;i<9&&!t.used;i++)c.updateDevices(.16);
   check((m.type==='recovery'?t.got:t.used)&&m.done===j+1,`L${level}: stage not completed`);
   if(j===0){
    const snapshot=JSON.stringify(m);g.mission=JSON.parse(snapshot);m=g.mission;
    if(m.type==='recovery')targets=m.caches;
    check(JSON.stringify(g.mission)===snapshot,`L${level}: checkpoint lost mission order`);
   }
  }
  check(c.missionWaypoint(g)===null,`L${level}: finished route still points to a target`);
  check(!g.portalReady,`L${level}: portal opened before enemy wave completion`);
  g.spawned=g.target;g.enemies=[];
  check(c.maybeFinishMission(g)&&g.portalReady,`L${level}: route can't finish`);
  check(c.missionSequenceHint(g).includes('Все'),`L${level}: completion guidance stale`);
 }else{
  free++;
  if(['containment','conduit','signal','surge'].includes(m.type))
   check(c.missionSequenceHint(g).includes('Фаза 1/2'),`L${level}: missing real two-phase operation hint`);
  else check(c.missionSequenceHint(g)==='',`L${level}: false sequential hint`);
  if(targets.length>1){
   const reverse=[...targets].reverse();
   for(let j=0;j<reverse.length;j++){
    const t=reverse[j];g.p.x=t.x;g.p.z=t.z;g.p.feetY=c.floorHeight(t.x,t.z);
    if(m.type==='recovery')c.updateMission(.016);
    else for(let k=0;k<9&&!t.used;k++)c.updateDevices(.16);
    check((m.type==='recovery'?t.got:t.used)&&m.done===j+1,
     `L${level}: free objective order unexpectedly locked`);
   }
  }
 }
 // Still no phantom barriers at objective centres; the geometric mesh and
 // hit tests use exactly the same Stage84 static world as before.
 for(const v of targets){
  check(c.mapCells[Math.floor(v.z)][Math.floor(v.x)]===0,`L${level}: objective in wall`);
  check(!c.collide(v.x,v.z,.68),`L${level}: mission site overlaps a physical wall`);
  check(c.worldSolidBodyCollision(v.x,v.z,.27,0,1.75)===(m.type==='relay'||m.type==='recovery'),`L${level}: objective steel body physics mismatch`);
  geometricProbes++;
 }
 // An old checkpoint with no Stage85 fields must retain the historical free
 // interaction rules. Restore logic already assigns mission directly.
 const old=JSON.parse(JSON.stringify(m));delete old.routeMode;delete old.routeOrder;old.version=1;
 const fake={mission:old,sector:level};
 if(targets.length)check(c.missionItemActive(fake,targets[targets.length-1],m.type),
  `L${level}: old checkpoint accidentally locked`);
 check(c.missionSequenceHint(fake)==='',`L${level}: old checkpoint has unwanted hint`);
}
if(first===1&&last===100){
 check(stagedArchives===7,`Stage98 canonical seven sequential recon routes: ${stagedArchives}`);
 check(stagedRelays===5,`Stage98 canonical five sequential relay routes: ${stagedRelays}`);
 check(staged===12&&free===88,'Stage98 campaign must preserve 12 sequential, 88 free routes');
}
console.log(`Stage85: ${checks} assertions / levels ${first}-${last} / ${staged} sequenced operations / ${free} free missions / ${geometricProbes} real-geometry probes PASS`);
