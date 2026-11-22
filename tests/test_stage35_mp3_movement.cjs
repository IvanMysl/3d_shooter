'use strict';
// Real MP-1/MP-2/MP-3 application functions run across two simulated browser
// contexts with fake Metered + two interconnected RTCDataChannels. The map,
// DOM and WebGL calls are replaced with deterministic geometry/UI stubs.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {FakeMetered,app,setup,enter,state}=require('./test_stage33_mp1_lobby.cjs');
const {FakeRTC}=require('./test_stage34_mp2_peer.cjs');
const folder=path.join(__dirname,'../src');
const source=['21b-multiplayer-lobby.js','21c-multiplayer-webrtc.js','21d-multiplayer-movement.js']
 .map(n=>fs.readFileSync(path.join(folder,n),'utf8')).join('\n')
 .replace(/const MP_PUBLISHABLE_KEY='[^']+'/,"const MP_PUBLISHABLE_KEY='pk_live_TESTONLY1234567890abcdef'");
let assertions=0;function check(value,label){assert.ok(value,label);assertions++;}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=1500){const begin=Date.now();while(Date.now()-begin<ms){if(fn())return;await wait(5);}throw Error('MP-3 simulated condition not reached');}

function createBrowser(server,combat=false,rounds=false,special=false,smoothing=false,recovery=false){
 const changes={draws:0,solids:0,nodes:new Map()};
 const weaponSource=fs.readFileSync(path.join(folder,'12-arsenal-and-game.js'),'utf8');
 const weapons=vm.runInNewContext(weaponSource.slice(0,weaponSource.indexOf('const enemies='))+'\nweapons');
 let browserContext;
 const extra={RTCPeerConnection:FakeRTC,GAME_BUILD:'35',TAU:Math.PI*2,
  weapons,MAX_WALL_MARKS:230,decalDirty:false,touchOnly:false,
  clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),hypot:Math.hypot,
  mapSize:30,mapCells:Array.from({length:30},()=>Array(30).fill(0)),floorHeightAtCell:()=>0,deckAtCell:()=>0,spawnX:15,spawnZ:15,PLAYER_SOLID_HEIGHT:1.8,
  JUMP_VELOCITY:5.2,JUMP_GRAVITY:15.0,SPRINT_ENERGY_DRAIN:1.8,
  glReady:true,externalCameraEnabled:()=>false,legacyResumeSector:-1,arsenalOpened:false,
  input:{keys:{},mx:0,mz:0,fire:false,jumpQueued:false,jumpHeld:false,sprint:false,mobileSprint:false},
  rand:(a,b)=>a+Math.random()*(b-a),sound(){},
  game:null,closeArsenal(){},refreshFlightButtons(){},useAbility(){},toggleFlight(){},toggleArsenal(){},switchWeapon(n){browserContext.game.p.weapon=n;},console,
  addEventListener(){},
  freshGame(){return {state:'playing',sector:1,t:0,sectorTime:0,p:{x:15,z:15,yaw:0,pitch:0,feetY:0,
   vy:0,grounded:true,energy:100,maxEnergy:100,bodyArmorType:-1,bodyArmor:0,bodyArmorMax:0,
   weapon:0,walk:0,shotGlow:0},enemies:[],nodes:[],devices:[],bullets:[],particles:[],projectiles:[],tracers:[],impactFx:[],decals:[],scorch:[]};},
  enterSector(){},buildMap(){},sectorArchitecture:'',
  supportHeight:()=>0,deckHeight:()=>0,ceilingHeight:()=>9,
  collide:(x,z,r)=>x-r<1||x+r>29||z-r<1||z+r>29||x+r>23,
  worldSolidBodyCollision:()=>false,worldSolidStandingSupport:()=>null,
  worldSolidHeadBarrier:()=>null,worldSolidFeetBarrier:()=>null,
  worldDeckStandingSupport:()=>null,worldDeckStepSupport:()=>null,worldDeckHeadBarrier:()=>null,
  worldDeckFeetBarrier:()=>null,
  worldLowestContact:(a,b)=>a===null?b:b===null?a:Math.min(a,b),
  worldHighestContact:(a,b)=>a===null?b:b===null?a:Math.max(a,b),
  rayWall(o,d,range){if(d.x<=0||o.x>=23)return null;const t=(23-o.x)/d.x;return t>=0&&t<=range?{t}:null;},
  sweepWorldSphere(o,d,range,r=0){if(d.x<=0||o.x>=23)return null;const t=(23-r-o.x)/d.x;return t>=0&&t<=range?{t}:null;},
  rayEllipsoid(o,d,c,rx,ry,rz,limit){
   const x=(o.x-c.x)/rx,y=(o.y-c.y)/ry,z=(o.z-c.z)/rz;
   const vx=d.x/rx,vy=d.y/ry,vz=d.z/rz;
   const a=vx*vx+vy*vy+vz*vz,b=x*vx+y*vy+z*vz,q=x*x+y*y+z*z-1;
   const det=b*b-a*q;if(det<0)return null;
   const t=q<=0?.001:(-b-Math.sqrt(det))/a;
   return t>=0&&t<=limit?t:null;
  },
  renderOperator(){changes.draws++;},
  pauseResumeGraceUntil:0,lastFrame:0,
 };
 const particleSource=fs.readFileSync(path.join(folder,'13-enemy-navigation-spawn.js'),'utf8');
 const pulseSource=particleSource.slice(particleSource.indexOf('function burst('));
 const fxSource=fs.readFileSync(path.join(folder,'17-weapon-combat.js'),'utf8');
 const impactSource=combat?fxSource.slice(0,fxSource.indexOf('function makeTracer(')):'';
 const combatSource=combat?fs.readFileSync(path.join(folder,'21e-multiplayer-combat.js'),'utf8'):'';
 // PvP combat shares the real third-person muzzle placement with the game.
 // Load that small pure helper section into this simulated browser too.
 const operatorFile=fs.readFileSync(path.join(folder,'09a-player-third-person.js'),'utf8');
 const muzzleSource=combat?operatorFile.slice(operatorFile.indexOf('function operatorMuzzleLocal('),
  operatorFile.indexOf('// A third-person weapon uses')):'';
 const viewFile=fs.readFileSync(path.join(folder,'10-first-person-render.js'),'utf8');
 const viewMuzzleSource=combat?viewFile.slice(0,viewFile.indexOf('function renderHeldWeapon(')):'';
 const roundSource=rounds?fs.readFileSync(path.join(folder,'21f-multiplayer-round.js'),'utf8'):'';
 const specialSource=special?fs.readFileSync(path.join(folder,'21g-multiplayer-flight-abilities.js'),'utf8'):'';
 const smoothingSource=smoothing?fs.readFileSync(path.join(folder,'21h-multiplayer-smoothing.js'),'utf8'):'';
 const recoverySource=recovery?fs.readFileSync(path.join(folder,'21i-multiplayer-recovery.js'),'utf8'):'';
 const trafficSource=fs.readFileSync(path.join(folder,'21j-multiplayer-traffic.js'),'utf8');
 const terrainSource=fs.readFileSync(path.join(folder,'03-height-and-collision.js'),'utf8');
 const sharedMotion='function worldTerrainFootprint(x,z,r){return supportHeight(null,x,z);}\n'+terrainSource.slice(terrainSource.indexOf('function worldActorGround('),terrainSource.indexOf('function makeStairHeights('));
 const a=app(server,source+'\n'+sharedMotion+'\n'+muzzleSource+'\n'+viewMuzzleSource+'\n'+pulseSource+'\n'+impactSource+'\n'+combatSource+'\n'+roundSource+'\n'+specialSource+'\n'+smoothingSource+'\n'+recoverySource+'\n'+trafficSource,extra);
 browserContext=a.ctx;
 a.ctx.save.settings={quality:0};
 const decorate=el=>{
  if(!el.classList){const values=new Set();el.classList={add(...xs){xs.forEach(x=>values.add(x));},remove(...xs){xs.forEach(x=>values.delete(x));},contains(x){return values.has(x);}};}
  if(!el.style)el.style={};if(!el.setAttribute)el.setAttribute=()=>{};
  // Chat UI uses real DOM replaceChildren/append in production. Mock those
  // primitives so the unchanged PvP tests can still run their network logic.
  if(!el.replaceChildren)el.replaceChildren=(...items)=>{el.children=items;};
  if(!el.append)el.append=(...items)=>{el.children=(el.children||[]).concat(items);};
  if(!el.focus)el.focus=()=>{};
  if(!el.scrollHeight)el.scrollHeight=0;if(!el.clientHeight)el.clientHeight=0;
  if(!el.remove)el.remove=()=>{changes.nodes.delete(el.id);};
  return el;
 };
 const original=a.ctx.$;
 a.ctx.$=id=>decorate(changes.nodes.get(id)||original(id));
 const doc=a.ctx.document;
 doc.body={classList:decorate({}).classList,appendChild(el){changes.nodes.set(el.id,el);}};
 doc.createElement=()=>decorate({id:'',setAttribute(){},textContent:''});
 doc.createTextNode=text=>({nodeType:3,textContent:String(text)});
 doc.exitPointerLock=()=>{};
 doc.pointerLockElement=null;
 a.ctx.document=doc;
 return {...a,changes,get html(){return a.html;}};
}
const active=a=>a.run('mpMatch?.active===true');
const actor=(a,id)=>a.run('mpMatch?.actors.get('+id+')?.p');
const close=a=>a.run('mpShutdown()');

async function main(){
 const server=new FakeMetered();server.iceServers=[{urls:'stun:stun.example.invalid'}];
 const host=createBrowser(server);setup(host,'HOST');await host.run('mpCreateRoom()');
 const code=state(host).code;
 const guest=createBrowser(server);enter(guest,code,'GUEST');await guest.run('mpJoinRoom()');
 await until(()=>host.run('mpRtcLinks.size===1')&&guest.run('mpRtcLinks.size===1')&&
  host.run('[...mpRtcLinks.values()][0].fast?.readyState==="open"')&&
  guest.run('[...mpRtcLinks.values()][0].control?.readyState==="open"'));
 
 check(host.run('mpMatchCanStart()'),'connected guests allow host start with no ready toggle');
 const signalCount=server.frameLog.length;
 host.run('mpMatchStartTraining()');
 await until(()=>active(host)&&active(guest));
 check(host.run('mpMatch.host')&&!guest.run('mpMatch.host'),'host/guest roles retained in match');
 check(host.run('mpMatch.token')===guest.run('mpMatch.token'),'same unpredictable match token');
 check(host.run('mpMatch.actors.size')===2&&guest.run('mpMatch.actors.size')===2,'both devices have both operators');
 check(host.run('mpMatch.self')===0&&guest.run('mpMatch.self')===1,'local players are correctly identified');
 check(!host.run('mpMatchCanStart()'),'second start forbidden during active match');
 check(host.run('game.sector')===guest.run('game.sector'),'both load the same sector');
 check(Math.hypot(actor(host,0).x-actor(host,1).x,actor(host,0).z-actor(host,1).z)>1,
  'two players spawn without overlap');
 check(host.saves===0&&guest.saves===0,'no solo save writes during room or start');

 const startHost={x:actor(host,0).x,z:actor(host,0).z};
 const startGuest={x:actor(host,1).x,z:actor(host,1).z};
 guest.run('game.p.yaw=0;input.keys.KeyW=true');
 for(let i=0;i<120;i++){
  guest.run('mpMatchUpdate(1/30)');await wait(0);host.run('mpMatchUpdate(1/30)');await wait(0);
 }
 const moved=actor(host,1);
 check(Math.hypot(moved.x-startGuest.x,moved.z-startGuest.z)>2.0,'guest input moves authoritative host actor');
 check(Math.hypot(actor(host,0).x-startHost.x,actor(host,0).z-startHost.z)<.1,'guest cannot displace stationary host');
 check(Math.hypot(actor(guest,0).x-actor(host,0).x,actor(guest,0).z-actor(host,0).z)<.15,
  'guest renders host position from authoritative snapshots');
 check(Math.hypot(actor(guest,1).x-moved.x,actor(guest,1).z-moved.z)<1.3,
  'guest local prediction remains close to host simulation');
 check(server.frameLog.length===signalCount,'movement and snapshots generate no Metered signalling');
 check(guest.run('mpMatch.lastSnapshot')>=20,'unreliable state channel receives continuous snapshots');
 check(guest.run('mpMatch.actors.get(0).samples.length')>=1,'remote interpolation has a sample buffer');
 check(host.run('mpMatch.tick')>=119,'host advances fixed-step authoritative simulation');
 guest.run('input.keys.KeyW=false');

 // Inject malformed and forged traffic; host never uses remote coordinates.
 const stable=actor(host,1).x;
 check(host.run('mpMatchSafeInput({seq:5,mx:1.1,mz:0,yaw:0,pitch:0,j:false,s:false})===null'),
  'overspeed guest input is rejected');
 check(host.run('mpMatchSafeInput({seq:5,mx:0,mz:0,yaw:Infinity,pitch:0,j:false,s:false})===null'),
  'non-finite view heading is rejected');
 host.run('mpMatchFast(mpRoom.players[1].peerId,{v:1,kind:"mp3-input",token:mpMatch.token,seq:9999,mx:0,mz:0,j:false,s:false,yaw:0,pitch:0,x:9999,z:9999})');
 check(actor(host,1).x===stable,'client-supplied position is not accepted by host');
 check(host.run('mpMatch.actors.get(1).seq')===9999,'latest command sequence stored by host');
 host.run('mpMatchFast(mpRoom.players[1].peerId,{v:1,kind:"mp3-input",token:mpMatch.token,seq:1,mx:1,mz:0,j:false,s:false,yaw:0,pitch:0})');
 check(host.run('mpMatch.actors.get(1).seq')===9999,'out-of-order input ignored');
 check(guest.run('mpMatchSafeState({tick:1e8,actors:[null,null]})===null'),'null actors rejected without exception');
 check(guest.run('mpMatchSafeState({tick:1e8,actors:[{id:0,x:99,z:1,h:0,yaw:0,pitch:0,vy:0,e:100,g:1,w:0},{id:1,x:1,z:1,h:0,yaw:0,pitch:0,vy:0,e:100,g:1,w:0}]})===null'),
  'impossible out-of-map snapshots rejected');
 const snapTick=guest.run('mpMatch.lastSnapshot');
 guest.run('mpMatchFast(mpRoom.hostPeer,{kind:"mp3-state",token:"WRONG",tick:999999,actors:[]})');
 check(guest.run('mpMatch.lastSnapshot')===snapTick,'wrong match token ignored');

 // Deterministic wall and body collision, jumping, two-camera rendering.
 const p=host.run('mpMatch.actors.get(1).p');
 p.x=22.2;p.z=12;p.feetY=0;p.grounded=true;
 const cmd={mx:-1,mz:0,j:false,s:false,yaw:0,pitch:0};
 for(let i=0;i<30;i++)host.run('mpMatchMove(mpMatch.actors.get(1).p, '+JSON.stringify(cmd)+', 1/30, [])');
 check(actor(host,1).x<=22.76,'wall collision cannot be crossed by repeated movement');
 const jump={mx:0,mz:0,j:true,s:false,yaw:0,pitch:0};
 host.run('mpMatch.actors.get(1).p.grounded=true;mpMatch.actors.get(1).p.feetY=0');
 host.run('mpMatchMove(mpMatch.actors.get(1).p,'+JSON.stringify(jump)+',1/30,[])');
 check(actor(host,1).feetY>0&&!actor(host,1).grounded,'jump begins with upward motion');
 for(let i=0;i<100;i++)host.run('mpMatchMove(mpMatch.actors.get(1).p,'+JSON.stringify({...jump,j:false})+',1/30,[])');
 check(actor(host,1).grounded&&Math.abs(actor(host,1).feetY)<.01,'jump lands on floor');
 host.run('mpMatchRenderOperators(game)');guest.run('mpMatchRenderOperators(game)');
 check(host.changes.draws===1&&guest.changes.draws===1,'existing 3D operator model draws the remote player');
 check(host.run('mpMatchActors().length')===1,'actor render list never duplicates the local player');

 // Host can stop; both leave the rehearsal without closing the room or saves.
 host.run('mpMatchStop()');await until(()=>!active(host)&&!active(guest));
 check(host.run('mpRoom!==null')&&guest.run('mpRoom!==null'),'room stays open after match stops');
 check(host.run('mpRoom.players.every(p=>!Object.hasOwn(p,"ready"))'),'room contains no readiness flags after battle');
 check(host.run('game===null')&&guest.run('game===null'),'transient game worlds are released');
 check(host.saves===0&&guest.saves===0,'single-player save is never modified');
 // Exercise the *actual* campaign checkpoint function with the network gate,
 // including the short interval while a procedural map is being built.
 const saveSource=fs.readFileSync(path.join(folder,'20-minimap-and-checkpoint.js'),'utf8');
 const actualSave=/function saveRun\(\)\{[\s\S]*?\n\}\n(?=function restoreLiveCheckpoint)/.exec(saveSource)?.[0];
 check(!!actualSave,'actual autosave implementation was extracted');
 const journal={writes:0};
 const saveContext={mpMatch:{active:true},mpMatchStarting:false,game:{state:'playing'},
  save:{},persist(){journal.writes++;return true;}};
 vm.createContext(saveContext);vm.runInContext(actualSave,saveContext);
 check(vm.runInContext('saveRun()',saveContext)===false&&journal.writes===0,'autosave refuses active multiplayer game');
 saveContext.mpMatch=null;saveContext.mpMatchStarting=true;
 check(vm.runInContext('saveRun()',saveContext)===false&&journal.writes===0,'autosave refuses game during map initialization');
 await guest.run('mpLeave()');await host.run('mpLeave()');
 check(host.run('mpRtcLinks.size')===0&&guest.run('mpRtcLinks.size')===0,'all RTC peers cleaned after leaving');
 console.log('STAGE35 MP-3 MOVEMENT: '+assertions+' assertions passed');
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={createBrowser,active,actor,until,wait,FakeMetered,setup,enter,state};
