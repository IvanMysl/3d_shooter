'use strict';
// Physical hazard LOS on the actual generated campaign. Unlike synthetic
// cover tests, rays here traverse the original wall cells, stair geometry,
// stage83 fortifications and optional full WebGL static solid registry.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0,blocked=0,clear=0,coils=0,webgl=0;
const check=(v,msg)=>{assert.ok(v,msg);checks++;};
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
for(const name of ['03-height-and-collision.js','04a-static-world-solids.js','04-map-generation.js',
 '05-world-mesh.js','13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js',
 '14-combat-raycast.js','15-mission-system.js','16-mission-devices.js'])
 vm.runInContext(src(name),c,{filename:name});
const first=Math.max(1,Number(process.env.FIRST||1)),last=Math.min(100,Number(process.env.LAST||100));
const full=new Set((process.env.WEBGL||'1,14,35,70,99').split(',').map(Number));
const dirs=[[1,0],[0,1]];
for(let level=first;level<=last;level++){
 c.glReady=full.has(level);c.save.settings.quality=level%2?0:2;c.game=null;c.buildMap(level);
 if(c.glReady)webgl++;
 const g={state:'playing',sector:level,p:{x:c.spawnX,z:c.spawnZ,feetY:c.floorHeight(c.spawnX,c.spawnZ),
  hp:100,maxhp:100,armor:100,maxArmor:100,energy:100,maxEnergy:100,grounded:true,shield:0},
  t:2.1,sectorTime:0,spawned:0,target:10,enemies:[],particles:[],score:0,kills:0,nodes:[],devices:[],portalReady:false};
 c.game=g;c.spawnPowerNodes(level);c.startMission(g);c.initDevices(g);
 const n=c.mapSize,tiles=c.mapCells;
 // Inspect a real full-height map wall between two accessible neighboring
 // floor cells. A pulse must NEVER pass through this authored structure.
 let coverFound=false,openFound=false;
 for(let z=3;z<n-3&&(!coverFound||!openFound);z++)for(let x=3;x<n-3&&(!coverFound||!openFound);x++){
  for(const [dx,dz] of dirs){
   if(!coverFound && tiles[z][x]===1 &&tiles[z-dz][x-dx]===0&&tiles[z+dz][x+dx]===0){
    const a={x:x-dx+.5,y:c.floorHeight(x-dx+.5,z-dz+.5)+.85,z:z-dz+.5};
    const p={x:x+dx+.5,z:z+dz+.5,feetY:c.floorHeight(x+dx+.5,z+dz+.5)};
    if(Math.abs((a.y-.85)-p.feetY)<.28){
     const exposure=c.missionHazardPlayerExposure(a,p);
     check(exposure===0,`L${level}: real full-height wall leaks hazard (${x},${z})`);
     coverFound=true;blocked++;
    }
   }
   if(!openFound&&tiles[z][x]===0&&tiles[z+dz]?.[x+dx]===0){
    const a={x:x+.5,y:c.floorHeight(x+.5,z+.5)+.85,z:z+.5};
    const p={x:x+dx+.5,z:z+dz+.5,feetY:c.floorHeight(x+dx+.5,z+dz+.5)};
    if(Math.abs((a.y-.85)-p.feetY)<.28 &&
       !c.rayWall(a,{x:dx,y:0,z:dz},.75)){
     check(c.missionHazardPlayerExposure(a,p)>0,`L${level}: false ghost cover in clear aisle`);
     openFound=true;clear++;
    }
   }
  }
 }
 check(openFound,`L${level}: no demonstrable open 3D line`);
 // At least one normal equipment pulse site must have a physically viable
 // exposed approach. This exercises the true dynamic AABB and local altitude.
 const activeCoils=g.devices.filter(d=>d.kind==='coil');
 for(const device of activeCoils.slice(0,1)){
  let usable=false;
  const ix=Math.floor(device.x),iz=Math.floor(device.z);
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=ix+dx,Z=iz+dz;if(!c.enemyNavTile(X,Z))continue;
   const actor={x:X+.5,z:Z+.5,feetY:c.floorHeight(X+.5,Z+.5)};
   if(c.missionInteractionClear(actor,device,'device')&&
      c.missionCoilPulseExposure(device,actor)>0){usable=true;break;}
  }
  check(usable,`L${level}: coil cannot emit to any real free approach`);
  coils++;
 }
 // Actual steel hulls remain active throughout hazard handling; this code
 // never removes world obstacles or bypasses physical navigation.
 check(c.worldEquipmentStats().bodies===g.nodes.length+g.devices.length+g.mission.caches.length,
  `L${level}: hazard check drifted from real equipment hulls`);
}
check(blocked>0,`L${first}-${last}: no real blocked wall face checked`);
console.log(`Stage94 actual solid-cover hazards: ${checks} PASS / L${first}-${last} (${last-first+1} worlds) / ${blocked} real blocking walls / ${clear} clear corridors / ${coils} actual coil devices / ${webgl} 3D-mesh worlds`);
