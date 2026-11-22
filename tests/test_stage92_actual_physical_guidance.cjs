'use strict';
// Stage92: each generated level has a physically walkable extraction route,
// not merely a 2D wall-grid route. The mission HUD and portal HUD also
// release navigation after destroyed reactors. Test BOTH 3D-scenes and Canvas.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0,worlds=0,steps=0,reactors=0,glWorlds=0,missionPaths=0;
function check(v,msg){assert.ok(v,msg);checks++;}
const c={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),distance:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),
 mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],legacyResumeSector:-1,legacyResumeDivisor:18,
 glReady:false,touchOnly:false,gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:v=>v,
 save:{settings:{quality:0,audio:false},credits:0},sound:()=>{},burst:()=>{},saveRun:()=>{},
 input:{jumpQueued:false},arsenalOpened:false,navField:null,navClock:0,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['БОСС'],robotPalette:()=>{},toast:()=>{},game:null};
vm.createContext(c);
for(const file of ['03-height-and-collision.js','04a-static-world-solids.js','04-map-generation.js',
 '05-world-mesh.js','13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js',
 '14-combat-raycast.js','15-mission-system.js','16-mission-devices.js'])
 vm.runInContext(src(file),c,{filename:file});
const src19=src('19-gameplay-update.js'),i0=src19.indexOf('function portalFlow(){'),i1=src19.indexOf('function navArrow(',i0);
check(i0>=0&&i1>i0,'production portal extraction functions found');
vm.runInContext(src19.slice(i0,i1),c,{filename:'stage92 real portal route'});
const from=Math.max(1,Number(process.env.FIRST||1)),to=Math.min(100,Number(process.env.LAST||100));
const glSet=new Set((process.env.WEBGL||'1,14,35,70,99').split(',').map(Number));
function checkPath(level,points,tag){
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],x=Math.floor(a.x),z=Math.floor(a.z),X=Math.floor(b.x),Z=Math.floor(b.z);
  check(Math.abs(x-X)+Math.abs(z-Z)===1,`L${level}/${tag}: nonadjacent route ${i}`);
  check(c.playerNavEdge(x,z,X,Z),`L${level}/${tag}: route crosses physical obstruction: ${x},${z} to ${X},${Z}`);
  steps++;
 }
}
for(let level=from;level<=to;level++){
 c.glReady=glSet.has(level);c.save.settings.quality=level%2?0:2;
 c.game=null;c.buildMap(level);if(c.glReady)glWorlds++;
 const g={state:'playing',sector:level,p:{x:c.spawnX,z:c.spawnZ,feetY:c.floorHeight(c.spawnX,c.spawnZ),
  maxhp:100,hp:100,armor:100,maxArmor:100,maxEnergy:100,energy:100,grounded:true,shield:0},
  t:1,sectorTime:0,spawned:0,target:10,enemies:[],particles:[],score:0,kills:0,nodes:[],devices:[],
  portalReady:true,nodesDestroyed:0};
 c.game=g;c.spawnPowerNodes(level);c.startMission(g);c.initDevices(g);
 const player=g.p,sz=c.mapSize,origin=Math.floor(player.z)*sz+Math.floor(player.x);
 let field=c.portalFlow();
 check(field[origin]<32767,`L${level}: no ground extraction route from spawn with live equipment`);
 const cold=c.portalRoute(player,sz*sz);
 check(cold.length>1,`L${level}: extraction route empty`);checkPath(level,cold,'extraction');
 check(field===c.portalFlow(),`L${level}: stable equipment route should use cached flow`);
 // The actual mission route must agree about real equipment and 3D bars.
 const wp=c.missionWaypoint(g);
 if(wp){
  const mfield=c.missionField(wp),travel=c.missionRouteTo(player,wp,sz*sz);
  check(mfield[origin]<32767,`L${level}: actual objective not reachable by physical route`);
  check(travel.length>1,`L${level}: empty mission route`);checkPath(level,travel,'mission');missionPaths++;
 }
 // Destroy a real node. Neither the mission HUD nor the extraction HUD may
 // continue using their original topology (same mapCells reference).
 if(g.nodes.length){
  const node=g.nodes[0];check(!node.dead,`L${level}: already destroyed node`);
  const live=c.portalFlow();node.dead=true;g.nodesDestroyed++;
  check(!c.worldSolidBodyCollision(node.x,node.z,.23,0,1.7),
    `L${level}: destroyed reactor leaves a physical collider`);
  const freed=c.portalFlow();
  check(live!==freed,`L${level}: extraction guidance did not invalidate after destruction`);
  check(freed[origin]<32767,`L${level}: extraction lost after reactor destruction`);
  const later=c.portalRoute(player,sz*sz);checkPath(level,later,'after destruction');
  check(c.portalFlow()===freed,`L${level}: flow re-built without topology changes`);
  reactors++;
 }
 worlds++;
}
console.log(`Stage92 REAL physical mission/extraction guidance PASS: ${checks} assertions / ${worlds} maps L${from}-${to} / ${reactors} reactors / ${missionPaths} mission routes / ${steps} verified real nav edges / ${glWorlds} WebGL-style built scenes`);
