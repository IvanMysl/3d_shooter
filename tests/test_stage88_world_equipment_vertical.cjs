'use strict';
// Stage88 full-map audit: actual mission entities on every procedural level,
// in the Canvas backend, have impassable vertical metal roofs. No fake walls
// are inserted in mapCells and no heights in the original terrain are changed.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0;const check=(cond,msg)=>{assert.ok(cond,msg);checks++;};
const c={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),distance:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),
 mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],legacyResumeSector:-1,legacyResumeDivisor:18,
 glReady:false,touchOnly:false,gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:v=>v,
 save:{settings:{quality:0,audio:false,flightVertical:1},credits:0},
 sound:()=>{},burst:()=>{},saveRun:()=>{},flightSpeedMultiplier:()=>1,
 normalizeFlightThrottle:()=>1,
 input:{flyDown:false,flyUp:false,jumpQueued:false,jumpHeld:false,keys:{}},
 arsenalOpened:false,navField:null,navClock:0,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['БОСС'],robotPalette:()=>{},toast:()=>{},game:null};
vm.createContext(c);
for(const name of ['03-height-and-collision.js','04a-static-world-solids.js','04-map-generation.js',
 '05-world-mesh.js','13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js',
 '14-combat-raycast.js','15-mission-system.js','16-mission-devices.js'])
 vm.runInContext(src(name),c,{filename:name});
const ev=e=>vm.runInContext(e,c);
const first=Math.max(1,Number(process.env.FIRST||1)),last=Math.min(100,Number(process.env.LAST||100));
let tested=0,bodies=0,falls=0,flights=0,underDeck=0;
for(let level=first;level<=last;level++){
 c.glReady=false;c.save.settings.quality=level%2;c.game=null;c.buildMap(level);
 const g={state:'playing',sector:level,p:{x:c.spawnX,z:c.spawnZ,feetY:0,vy:0,
  maxhp:100,hp:100,armor:100,maxArmor:100,maxEnergy:100,energy:100,
  grounded:true,shield:0,flightUnlocked:true},t:0,sectorTime:0,
  spawned:0,target:10,enemies:[],particles:[],score:0,kills:0,nodes:[],devices:[],portalReady:false};
 c.game=g;c.spawnPowerNodes(level);c.startMission(g);c.initDevices(g);
 const entities=[...g.nodes.map(x=>({kind:'node',entity:x})),
  ...g.devices.map(x=>({kind:'equipment',entity:x})),
  ...g.mission.caches.map(x=>({kind:'archive',entity:x}))];
 check(entities.length>=6,`level ${level}: mission equipment missing`);
 for(const {kind,entity} of entities){
  const box=c.worldEquipmentCell(Math.floor(entity.x),Math.floor(entity.z))
   .find(v=>v.kind===kind && v.entity===entity && c.worldEquipmentActive(v))?.box;
  check(box&&box.length===6,`level ${level}: visible ${kind} has no physical body`);
  const top=box[4],bottom=box[1];
  check(top>bottom,`level ${level}: degenerate ${kind} metal body`);
  const deck=c.deckHeight(entity.x,entity.z);
  // A site below a 2.2m deck can contain a real 1.3m machine with too little
  // helmet clearance for a human to stand atop it. The upper floor, not the
  // machine, correctly catches a fall FROM ABOVE. Probe the equipment face
  // directly instead of inventing a player starting *inside* the bridge.
  if(deck>top && deck<top+2.4){
   const roof=c.worldSolidFeetBarrier(entity.x,entity.z,.23,top+.55,top-.10);
   check(roof!==null && Math.abs(roof-top)<1e-6,
    `level ${level}: covered ${kind} lost its metal roof beneath the deck`);
   underDeck++;bodies++;continue;
  }
  const p={x:entity.x,z:entity.z,feetY:top+1.3,vy:-3.5,
   grounded:false,flying:false,flightUnlocked:true};g.p=p;
  c.input.flyDown=false;
  ev('updateVertical(game.p,.42)');
  check(p.grounded&&Math.abs(p.feetY-top)<.03,
   `level ${level}: fallback fall passed through ${kind} at (${entity.x},${entity.z}), top=${top}, fell=${p.feetY}, grounded=${p.grounded}, terrain=${c.floorHeight(entity.x,entity.z)}`);
  falls++;
  p.feetY=top+1.45;p.vy=0;p.grounded=false;p.flying=true;
  c.input.flyDown=true;
  ev('updateVertical(game.p,.49)');
  check(Math.abs(p.feetY-top)<.03,
   `level ${level}: fallback flight passed through ${kind} at (${entity.x},${entity.z})`);
  c.input.flyDown=false;flights++;bodies++;
 }
 tested++;
}
console.log(`Stage88 actual Canvas levels ${first}-${last}: ${checks} checks / ${tested} maps / ${bodies} physical metal bodies / ${falls} gravity / ${flights} flight / ${underDeck} covered-below-deck: PASS`);
