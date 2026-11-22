'use strict';
// Real 100-level audit: extraction at the true map portal must be reachable
// from its own physical floor; equipment and other storeys may not shortcut it.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
const levels=process.env.LEVELS?process.env.LEVELS.split(',').map(Number):Array.from({length:100},(_,i)=>i+1);
let checks=0,worlds=0,probes=0,devices=0,decks=0,mesh=0;
const check=(value,msg)=>{assert.ok(value,msg);checks++;};
const c={Math,console,Number,Set,Map,Array,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),distance:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),
 mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],legacyResumeSector:-1,legacyResumeDivisor:18,
 glReady:false,touchOnly:false,gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:v=>v,
 save:{settings:{quality:0,audio:false},credits:0},sound:()=>{},burst:()=>{},saveRun:()=>{},
 damagePlayer:()=>{},input:{jumpQueued:false},arsenalOpened:false,navField:null,navClock:0,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['Босс'],robotPalette:()=>{},toast:()=>{},game:null,
 robotNearArea:()=>false,enemyBlastSamples:()=>({points:[],hullDist:1}),hurtEnemy:()=>{},
 pick:a=>a[0], '$':()=>({style:{},textContent:''})};
vm.createContext(c);
for(const name of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js','15-mission-system.js','16-mission-devices.js'])
 vm.runInContext(src(name),c,{filename:name});
const s=src('19-gameplay-update.js'),begin=s.indexOf('function physicalPortalContact('),end=s.indexOf('function portalNext(',begin);
check(begin>=0&&end>begin,'real production physical portal contact helper present');
vm.runInContext(s.slice(begin,end),c,{filename:'physicalPortalContact'});
for(const level of levels){
 c.game=null;c.glReady=[1,8,35,70,99].includes(level);c.save.settings.quality=level%2;c.buildMap(level);
 const g={state:'playing',sector:level,p:{x:c.spawnX,z:c.spawnZ,feetY:0},t:1,sectorTime:0,
  spawned:0,target:6,enemies:[],particles:[],score:0,kills:0,nodes:[],devices:[],mission:{caches:[]},
  portalReady:false,nodesDestroyed:0,impactFx:[],scorch:[],loot:[],idCounter:0,robotDebris:[]};
 c.game=g;c.spawnPowerNodes(level);c.startMission(g);c.initDevices(g);
 const goal=c.portal,ground=c.floorHeight(goal.x,goal.z);
 check(Number.isFinite(ground),`L${level}: physical portal floor must exist`);
 const p={x:goal.x,z:goal.z,feetY:ground};
 check(!c.collide(p.x,p.z,.2),`L${level}: portal centre itself is inside wall`);
 check(!c.worldSolidBodyCollision(p.x,p.z,.20,ground+.12,1.55),`L${level}: portal centre inside physical steel`);
 check(c.physicalPortalContact(p),`L${level}: valid physically entered portal should complete`);
 check(!c.physicalPortalContact({...p,feetY:ground+2.5}),`L${level}: wrong-storey shortcut into portal`);
 check(!c.physicalPortalContact({...p,x:goal.x+1.31}),`L${level}: distant horizontal shortcut`);
 // Putting a genuine steel station at the portal must NOT grant extraction.
 // No new world decorations are built; this is a temporary entity state used
 // only for the collision audit and then discarded before the next map.
 const oldDevices=g.devices;g.devices=[...oldDevices,{x:goal.x,z:goal.z,kind:'repair',used:false}];
 check(!c.physicalPortalContact(p),`L${level}: portal inside real steel must be unavailable`);
 g.devices=oldDevices;
 check(c.physicalPortalContact(p),`L${level}: restoring the real portal removes fake gate blocker`);
 devices++;
 // Several near-centre approaches provide a fully physical next step.
 let found=0;
 for(const [dx,dz] of [[.38,0],[-.38,0],[0,.38],[0,-.38]]){
  const candidate={x:goal.x+dx,z:goal.z+dz,feetY:ground};
  if(!c.collide(candidate.x,candidate.z,.20)&&
     !c.worldSolidBodyCollision(candidate.x,candidate.z,.20,ground+.12,1.55)&&
     c.physicalPortalContact(candidate))found++;
 }
 check(found>0,`L${level}: no physical adjacent portal approach`);
 probes+=found;
 if(c.glReady)mesh++;
 if(c.deckAtCell(Math.floor(goal.x),Math.floor(goal.z))>0)decks++;
 worlds++;
}
console.log(`Stage100 real 3D portal extraction: ${checks} PASS, ${worlds} real worlds, ${devices} steel blockers, ${probes} accessible approaches, ${mesh} WebGL meshes, ${decks} portal deck cells`);
