'use strict';
// Actual preview lifecycle with real seeded geometry and PvP collision.
// DOM-only shell is stubbed; browser tests cover genuine controls/rendering.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
const levels=process.env.LEVELS?process.env.LEVELS.split(',').map(Number):Array.from({length:100},(_,i)=>i+1);
let checks=0,worlds=0,meshes=0;
const check=(v,m)=>{assert.ok(v,m);checks++};
const c={Math,console,Number,Set,Map,Array,Float32Array,Int8Array,Int16Array,Int32Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
 rand:(a,b)=>a+Math.random()*(b-a),mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],
 legacyResumeSector:-1,legacyResumeDivisor:18,glReady:false,touchOnly:false,
 gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:v=>v,
 save:{settings:{quality:0,audio:false,cameraMode:'first'}},sound:()=>{},burst:()=>{},
 input:{jumpQueued:false},arsenalOpened:false,navField:null,navClock:0,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['boss'],robotPalette:()=>{},toast:()=>{},game:null};
vm.createContext(c);
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js','04-map-generation.js',
 '05-world-mesh.js','13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js',
 '14-combat-raycast.js','15-mission-system.js'])vm.runInContext(src(n),c,{filename:n});
const ev=s=>vm.runInContext(s,c);

c.setTimeout=()=>0;vm.runInContext(src('21b-multiplayer-lobby.js'),c);
const elements=new Map();
class Element{
 constructor(id=''){this.id=id;this.textContent='';this.style={};this.attrs={};this.scrollTop=24;this.disabled=false;this.classList={add(){},remove(){},toggle(){}};}
 getAttribute(k){return this.attrs[k]??null;}
 setAttribute(k,v){this.attrs[k]=String(v);}
 removeAttribute(k){delete this.attrs[k];}
 appendChild(e){elements.set(e.id,e);}
 remove(){elements.delete(this.id);}
 focus(){}
}
const $=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);};
Object.assign(c,{$,document:{hidden:false,body:new Element('body'),createElement:()=>new Element(),pointerLockElement:null},
 performance:{now:()=>0},miniZoom:false,lastFrame:0,pauseResumeGraceUntil:0,SPRINT_ENERGY_DRAIN:1.8,
 externalCameraEnabled:()=>true,operatorHitReaction:()=>{},mpMatchStatus:()=>{},updateHud:()=>{},
 closeArsenal:()=>{},refreshCameraInterface:()=>{},refreshFlightButtons:()=>{},drawMinimap:()=>{},
 resetTransientInput:()=>{c.input.keys={};c.input.mx=0;c.input.mz=0;c.input.jumpQueued=false;},
 newPlayer:()=>({x:0,z:0,weapon:0,walk:0,yaw:0,pitch:0,feetY:0,vy:0,grounded:true}),
 legacyResumeSector:-1,legacyResumeDivisor:18});
c.save.perms=Array(12).fill(0);
const core=src('12-arsenal-and-game.js');
vm.runInContext(core.slice(0,core.indexOf('const enemies=')),c);
for(const [id,value] of Object.entries({mpMode:'ffa',mpEquipment:'owned',mpWeapon:'0',mpScoreLimit:'15',mpTimeLimit:'300',mpHostNick:'TEST'}))$(id).value=value;
vm.runInContext(core.slice(core.indexOf('function freshGame('),core.indexOf('function normalizeCheckpointWeapon(')),c);
vm.runInContext(core.slice(core.indexOf('function chooseEntranceYaw(')),c);
const movement=src('21d-multiplayer-movement.js');
vm.runInContext('const MP3_STEP=1/30;let mpMatch=null;',c);
for(const [a,b] of [['function mpMatchSpawnPositions(','function mpMatchOpen('],['let mpPreviewSession=null;','function mpMatchStartTraining('],['function mpMatchInput(','function mpMatchSafeInput('],['function mpMatchMove(','function mpMatchState('],['function mpMatchUpdate(','function mpMatchActors(']])vm.runInContext(movement.slice(movement.indexOf(a),movement.indexOf(b)),c);
const impactSource=src('17-weapon-combat.js');
c.MAX_WALL_MARKS=230;c.decalDirty=false;
vm.runInContext(impactSource.slice(0,impactSource.indexOf('function makeTracer(')),c);
const operator=src('09a-player-third-person.js');
vm.runInContext(operator.slice(operator.indexOf('function operatorMuzzleLocal('),operator.indexOf('// One or two short procedural flashes')),c);
for(const f of ['21e-multiplayer-combat.js','21f-multiplayer-round.js','21g-multiplayer-flight-abilities.js','21h-multiplayer-smoothing.js','21i-multiplayer-recovery.js'])vm.runInContext(src(f),c,{filename:f});
const catalog=ev('MP_MAPS'),crypto=require('node:crypto'),before=JSON.stringify(c.save),signatures=new Set();
const webgl=new Set((process.env.WEBGL_LEVELS||'1,19,50,75,100').split(',').map(Number));
for(const level of levels){
 const map=catalog[level-1];c.glReady=webgl.has(level);const button=new Element('preview');
 check(c.mpPreviewStart(map.id,button),`L${level}: open`);
 const g=c.game,p=g.p;
 check(g.preview&&g.sector===level&&g.state==='playing',`L${level} exact sector`);
 check(g.enemies.length===0&&g.nodes.length===0&&g.devices.length===0&&g.mission===null&&g.arenaEvent===null&&!g.portalReady,`L${level} empty`);
 check(!c.collide(p.x,p.z,.25)&&!c.worldSolidBodyCollision(p.x,p.z,.25,p.feetY,1.95),`L${level} spawn free`);
 const points=c.mpMatchSpawnPositions([{id:0,team:0}],{mode:'ffa'});
 check(p.x===points.get(0).x&&p.z===points.get(0).z,`L${level} match spawn`);
 signatures.add(crypto.createHash('sha256').update(JSON.stringify([c.mapCells,ev('heightCells'),ev('deckCells')])).digest('hex'));
 c.input.keys.KeyW=true;for(let i=0;i<8;i++)c.mpPreviewUpdate(.032);c.input.keys.KeyW=false;
 check(p.energy===100&&[p.x,p.z,p.feetY].every(Number.isFinite),`L${level} valid move and full energy`);
 check(!c.collide(p.x,p.z,.25)&&!c.worldSolidBodyCollision(p.x,p.z,.25,p.feetY,1.95),`L${level} movement free`);
 check(ev('mpMatch.preview && mpMatch.actors.size===1 && mpMatch.actors.get(0).p===game.p'),`L${level} local host`);
 check(c.mp6Request('flight'),`L${level} flight request`);c.mpPreviewUpdate(1/30);c.input.keys.Space=true;for(let i=0;i<6;i++)c.mpPreviewUpdate(.032);c.input.keys.Space=false;
 check(!c.collide(p.x,p.z,.25)&&!c.worldSolidBodyCollision(p.x,p.z,.25,p.feetY,1.95),`L${level} flight clearance`);
 check(c.mp6Request('shield'),`L${level} shield request`);c.mpPreviewUpdate(1/30);check(p.shield>0&&p.energy<100,`L${level} real shield resource cost`);
 if(level===1){
  const m=ev('mpMatch'),a=m.actors.get(0),step=n=>{for(let j=0;j<n;j++)c.mpPreviewUpdate(1/30)};
  p.shield=0;p.energy=100;check(c.mp6Request('dash'),'dash request');step(1);check(p.abilityCooldowns.dash>0&&p.energy<100,'dash actual cost/cooldown');
  p.energy=100;const priorParticles=g.particles.length;check(c.mp6Request('pulse'),'pulse request');step(1);check(p.abilityCooldowns.pulse>0&&p.energy<100&&g.particles.length>=priorParticles+45,'pulse emits real particles');
  p.energy=100;p.hp=50;check(c.mp6Request('heal'),'repair request');step(1);check(p.hp===88&&p.energy<100,'repair restores actual HP');
  p.shield=0;a.invulnUntil=0;p.hp=100;p.armor=30;
  const oldHP=p.hp;ev('mpCombatBlast(mpMatch.actors.get(0),{x:game.p.x,y:game.p.feetY+1.02,z:game.p.z},weapons[4])');check(p.hp<oldHP&&p.armor<30,'self explosion damages actor');
  for(let w=0;w<10;w++){
   p.hp=100;p.armor=30;p.cooldown=0;p.heat=0;p.heatLock=0;p.weapon=w;a.bursts=[];m.projectiles=[];c.input.fire=true;const shots=p.shots;step(1);c.input.fire=false;check(p.shots>shots&&p.heat>0,`real shot gun ${w}`);
   if([4,7,8].includes(w))check(m.projectiles.length>0||g.impactFx.length>0,`projectile or physical impact ${w}`);
  }
  m.projectiles=[];a.bursts=[];p.hp=1;p.armor=0;p.shield=0;a.invulnUntil=0; c.mpCombatHit(a,a,100);check(p.hp===0&&a.deaths===1,'self death');step(91);check(p.hp===100&&p.armor===30&&a.respawnAt===0,'normal respawn');
  m.round.endsAt=Date.now()-1;step(1);check(!m.round.ended&&m.round.endsAt>Date.now(),'timer rolls over without fake winner');
 }
 check(c.mpPreviewEnd()&&c.game===null&&ev('mpPreviewSession')===null,`L${level} closes`);
 check(JSON.stringify(c.save)===before&&ev('mpMatch')===null&&ev('mpWire')===null,`L${level} save/network untouched`);
 worlds++;
 if(c.glReady)meshes++;
}
check(signatures.size===worlds,'distinct map signatures');check(!c.mpPreviewStart('invalid',new Element()),'bad ID rejected');
console.log(JSON.stringify({stage:118,worlds,meshes,checks,distinctGeometry:signatures.size}));
