
let uiTick=0,perfTick=0,fpsSamples=0,fpsTotal=0;
let frameBudgetMs=0,fpsLoopState='',lastMeasuredFps=0,framesRenderedTotal=0;
function resetFpsPacing(){frameBudgetMs=0;fpsSamples=0;fpsTotal=0;perfTick=0;lastMeasuredFps=0;}
// Accumulated time produces 45 real draws/sec on a stable 60 Hz panel
// (3 of every 4 callbacks), rather than incorrectly dropping to 30.
function shouldRenderFpsFrame(elapsedMs,limit){
 if(limit===0){frameBudgetMs=0;return true;}
 const interval=1000/limit;
 frameBudgetMs=Math.min(interval*2,frameBudgetMs+Math.max(0,elapsedMs));
 if(frameBudgetMs+0.25<interval)return false;
 frameBudgetMs=Math.max(0,frameBudgetMs-interval);
 return true;
}
function frame(now){
 // While in menus/pause, do not wake the compositor at the monitor refresh
 // rate merely to discover that there is nothing to render. A short timer
 // checks for a return to combat; gameplay itself retains full-rate RAF.
 if(game?.state==='playing')requestAnimationFrame(frame);
 else setTimeout(()=>requestAnimationFrame(frame),125);
 const elapsedMs=lastFrame>0?Math.max(0,now-lastFrame):16.6667;
 const actual=Math.min(.25,elapsedMs/1000);
 const dt=Math.min(.035,actual);
 lastFrame=now;
 const state=game?.state||'menu';
 const cap=save.settings.fpsLimit;
 if(fpsLoopState!==state||elapsedMs>500){
  fpsLoopState=state;
  resetFpsPacing();
  frameBudgetMs=cap?1000/cap:0; // Render immediately after pause/resume/tab switch.
  $('fpsMeter').textContent='— FPS';
  $('fpsCorner').className='';
 }
 // Update movement, collisions, enemy AI, and gun cooldowns every browser tick.
 // Rendering is capped independently, so lowering FPS does not slow gameplay.
 if(state==='playing'){
  if(game?.preview)mpPreviewUpdate(dt);
  else if(typeof mpMatch!=='undefined'&&mpMatch?.active)mpMatchUpdate(dt);
  else update(dt);
 }
 // No WebGL draw calls outside actual combat. Menus, pause, victory and the
 // campaign map keep the last frozen frame; the GPU is never fed a new one.
 const willDraw=state==='playing'&&shouldRenderFpsFrame(elapsedMs,cap);
 if(game&&state==='playing'&&willDraw){
  render();
  if(state==='playing'&&game?.state==='playing'){fpsSamples++;framesRenderedTotal++;}
 }
 if(state==='playing'){
  uiTick+=dt;
  if(uiTick>.08){uiTick=0;if(game?.preview)mpPreviewHud();else updateHud();}
  const sampleTime=Math.min(.25,elapsedMs/1000);
  fpsTotal+=sampleTime;
  perfTick+=sampleTime;
  if(perfTick>=.75){
    const fps=fpsSamples/Math.max(.001,fpsTotal);
    lastMeasuredFps=fps;
    $('fpsMeter').textContent=Math.round(fps)+' FPS';
    $('fpsCorner').title=(cap?`Лимит: ${cap} FPS`:'Без ограничения FPS')+` · Фактически: ${fps.toFixed(1)} FPS`;
    const reference=Math.min(cap||60,60);
    $('fpsCorner').className=fps<reference*.55?'fpsLow':fps<reference*.80?'fpsWarn':'';
    // Dynamic mobile resolution should compare against the selected cap, not hard-coded 60.
    if(glReady&&touchOnly&&save.settings.quality===1){
      performanceSlow=fps<Math.max(16,reference*.72)?performanceSlow+.75:Math.max(0,performanceSlow-.75);
      performanceFast=fps>Math.max(19,reference*.88)?performanceFast+.75:0;
      if(performanceSlow>3&&adaptiveScale>.73){adaptiveScale=.72;performanceSlow=0;resize();}
      if(performanceFast>9&&adaptiveScale<1){adaptiveScale=1;performanceFast=0;resize();}
    }
    perfTick=0;fpsTotal=0;fpsSamples=0;
  }
 }
}
// Developer-only telemetry, useful for checking live FPS limits without touching save data.
window.__fpsDiagnostics={get:()=>({limit:save.settings.fpsLimit,actualFps:lastMeasuredFps,rendered:framesRenderedTotal,state:game?.state||'menu'}),
 setLimit:v=>{save.settings.fpsLimit=normalizeFpsLimit(v);persist();resetFpsPacing();},
 simulate:(limit,refresh=60,seconds=10)=>{
  const n=Math.round(refresh*seconds),step=1000/refresh,interval=limit?1000/limit:0;let budget=0,draws=0;
  for(let i=0;i<n;i++){if(!limit){draws++;continue;}
    budget=Math.min(interval*2,budget+step);
    if(budget+.25>=interval){draws++;budget=Math.max(0,budget-interval);}
  }
  return draws/seconds;
 }};
try{if(glReady)initGL()}catch(err){glReady=false;console.error(err)}if(!glReady){document.body.classList.remove('webgl');fallCtx=glCanvas.getContext('2d',{alpha:false})||glCanvas.getContext('2d');console.warn('Using Canvas 3D fallback')}resize();menu();requestAnimationFrame(frame);
window.__neonOperationsTest={
 selectStage:n=>{startGame(false,n);return game?.sector},
 state:()=>game&&({sector:game.sector,state:game.state,mission:structuredClone(game.mission),devices:structuredClone(game.devices||[]),portalReady:game.portalReady,boss:game.boss&&{hp:game.boss.hp,phase3:game.boss.phase3,ultWarn:game.boss.ultWarn},enemies:game.enemies.map(e=>e.type)}),
 activateDevice:i=>{const d=game?.devices?.[i];if(!d)return false;completeDevice(game,d);return true},
 setBossPhase3:()=>{if(!game)return false;if(!game.boss&&!spawnEnemy('boss',true))return false;game.boss.hp=game.boss.maxhp*.18;updateEnemies(.016);return true},
 simulateJump:()=>{queueJump();return game?.p.grounded},
 completeHoldout:()=>{if(game?.mission?.type!=='holdout')return false;game.mission.surviveRemaining=0;maybeFinishMission(game);return game.portalReady},
 mapNames:()=>sectorArchitecture
};
window.__neonMissionTest={current:()=>game&&({sector:game.sector,mission:game.mission,portal:game.portalReady,spawned:game.spawned,target:game.target,enemies:game.enemies.length,event:game.arenaEvent}),forceClear:()=>{if(!game)return false;game.spawned=game.target;game.enemies=[];if(game.mission){game.mission.done=game.mission.required;for(const c of game.mission.caches)c.got=true;}maybeFinishMission(game);return game.portalReady},defeatEnemiesOnly:()=>{if(!game)return false;game.spawned=game.target;game.enemies=[];return maybeFinishMission(game)},missionTick:(dt=.016)=>updateMission(dt),collectOneCache:(i=0)=>{if(!game?.mission?.caches?.[i])return false;const c=game.mission.caches[i];game.p.x=c.x;game.p.z=c.z;game.p.feetY=floorHeight(c.x,c.z);updateMission(.016);return c.got;},selectStage:(n)=>{save.campaign.highestUnlocked=Math.max(save.campaign.highestUnlocked,n);startGame(false,n);},killCommander:()=>{if(!game?.mission)return;game.mission.done=1;maybeFinishMission(game)},collectAll:()=>{if(!game?.mission)return;for(const c of game.mission.caches)c.got=true;game.mission.done=game.mission.required;maybeFinishMission(game);},nextEvent:()=>{if(game?.arenaEvent){game.arenaEvent.phase='quiet';game.arenaEvent.countdown=.01;}},missionFor:missionType,checkpoint:()=>save.checkpoint};

// Stage97 read-only metadata plus opt-in QA exercise. Runs genuine mission
// device contact and reactor damage, no detached mock map or invisible walls.
window.__neonMissionTest.stage97Inspect=()=>{
 const g=game,m=g?.mission;if(!m)return null;
 const coils=(g.devices||[]).filter(d=>(m.coilIds||[]).includes(d.id));
 return {sector:g.sector,type:m.type,version:m.version,required:m.required,done:m.done,
  timer:m.surviveRemaining,coilIds:[...(m.coilIds||[])],coilsRequired:m.coilsRequired||0,
  nodesRequired:m.nodesRequired||0,coilsDisabled:m.coilsDisabled||0,
  nodesDisabled:m.nodesDisabled||0,portal:g.portalReady,
  physicalCoils:coils.every(d=>worldSolidBodyCollision(d.x,d.z,.20,floorHeight(d.x,d.z),1.5)),
  coilCount:coils.length,remainingNodes:g.nodes.filter(n=>!n.dead&&n.type!==2).length};
};
window.__neonMissionTest.stage97Exercise=()=>{
 const g=game,m=g?.mission;if(!m||!['containment','conduit'].includes(m.type))return null;
 g.spawned=g.target;g.enemies=[];
 const before=window.__neonMissionTest.stage97Inspect(),available=g.nodes.filter(n=>!n.dead&&n.type!==2);
 if(m.type==='containment'){
  const timer=m.surviveRemaining;
  updateMission(.10);
  const beforeDisable=m.surviveRemaining===timer&&!g.portalReady;
  for(const node of available.slice(0,m.required))damagePowerNode(node,node.hp+1);
  const beforeSiege=!g.portalReady&&m.done===m.required;
  updateMission(.16);
  const started=m.containmentStarted&&m.surviveRemaining<timer;
  updateMission(timer+1);
  return {before,after:window.__neonMissionTest.stage97Inspect(),beforeDisable,beforeSiege,
   started,completed:g.portalReady,physical:available.slice(0,m.required).every(n=>n.dead&&
    !worldSolidBodyCollision(n.x,n.z,.20,floorHeight(n.x,n.z),1.5))};
 }
 const path=missionGroundField(spawnX,spawnZ),n=mapSize;
 const contacts=[];
 const early=g.sector%20===16&&available.length>0;
 if(early)damagePowerNode(available[0],available[0].hp+1);
 const beforeCoils=!g.portalReady&&(m.coilsDisabled||0)===0;
 for(const id of [...m.coilIds]){
  const device=g.devices.find(d=>d.id===id);
  const x=Math.floor(device.x),z=Math.floor(device.z);
  let approach=null;
  for(const [dx,dz] of [[1,0],[0,1],[-1,0],[0,-1]]){
   const X=x+dx,Z=z+dz;if(X<1||Z<1||X>=n-1||Z>=n-1||path[Z*n+X]<0)continue;
   const p={x:X+.5,z:Z+.5,feetY:floorHeight(X+.5,Z+.5)};
   if(missionInteractionClear(p,device,'device')&&
     !worldSolidBodyCollision(p.x,p.z,.23,p.feetY,PLAYER_SOLID_HEIGHT)){
    approach=p;break;
   }
  }
  if(!approach){contacts.push(false);continue;}
  g.p.x=approach.x;g.p.z=approach.z;g.p.feetY=approach.feetY;
  g.p.grounded=true;g.p.shield=6;
  for(let k=0;k<11&&!device.used;k++)updateDevices(.16);
  contacts.push(device.used);
 }
 const afterCoils=m.coilsDisabled===m.coilsRequired;
 if(!early&&available.length)damagePowerNode(available[0],available[0].hp+1);
 return {before,after:window.__neonMissionTest.stage97Inspect(),beforeCoils,contacts,
  afterCoils,completed:g.portalReady&&m.done===m.required,
  physical:before.physicalCoils};
};
window.__neonMissionTest.stage97SaveRoundtrip=()=>{
 const g=game,m=g?.mission;if(!m||m.type!=='conduit'||!m.coilIds?.length)return null;
 const first=g.devices.find(d=>d.id===m.coilIds[0]);
 // Test the precise serialized state after legitimately disabling one coil.
 const n=mapSize,path=missionGroundField(spawnX,spawnZ),x=Math.floor(first.x),z=Math.floor(first.z);
 let face=null;
 for(const [dx,dz] of [[1,0],[0,1],[-1,0],[0,-1]]){
  const X=x+dx,Z=z+dz;if(X<1||Z<1||X>=n-1||Z>=n-1||path[Z*n+X]<0)continue;
  const q={x:X+.5,z:Z+.5,feetY:floorHeight(X+.5,Z+.5)};
  if(missionInteractionClear(q,first,'device')&&!worldSolidBodyCollision(q.x,q.z,.23,q.feetY,PLAYER_SOLID_HEIGHT)){
   face=q;break;
  }
 }
 if(!face)return {face:false};
 Object.assign(g.p,face);g.p.grounded=true;g.p.shield=6;
 for(let k=0;k<11&&!first.used;k++)updateDevices(.16);
 const count=m.coilsDisabled,done=first.used;
 saveRun();startGame(true);
 const after=window.__neonMissionTest.stage97Inspect(),restored=game?.devices?.find(d=>d.id===first.id);
 return {face:true,done,count,after,restored:!!restored?.used,
  valid:!!(after?.type==='conduit'&&after.coilsDisabled===count&&restored?.used&&
   after.coilIds.includes(first.id)&&after.physicalCoils)};
};

window.__neonTest={debugDrone:()=>{if(!game)return null;const e=spawnEnemy('drone',false);if(!e)return null;e.x=game.p.x+5;e.z=game.p.z+4;e.feetY=floorHeight(e.x,e.z)+.8;return {type:e.type,y:e.feetY,hp:e.hp};},debugEnemyClimb:(frames=560)=>{if(!game||!bridgeSpecs.length)return null;const c=Math.floor(mapSize/2);game.p.x=c+.5;game.p.z=c+.5;game.p.feetY=BRIDGE_Y;game.p.vy=0;game.p.grounded=true;game.p.iframes=9999;game.spawned=game.target;game.enemies=[];const e=spawnEnemy('charger',false);if(!e)return null;e.x=c+14.5;e.z=c+.5;e.feetY=0;e.speed=2.8;e.attack=999;const samples=[];for(let k=0;k<frames;k++){updateEnemies(.016);if(k%45===0)samples.push([k,+e.x.toFixed(2),+e.feetY.toFixed(2)]);}return {enemy:{x:e.x,z:e.z,feetY:e.feetY},samples};},debugStart:()=>startGame(false),debugSector:(n)=>{if(!game)startGame(false);game.sector=n;enterSector(n);return {sector:game.sector,style:sectorStyle,architecture:sectorArchitecture};},debugUnder:()=>{if(!game||!bridgeSpecs.length)return null;const c=Math.floor(mapSize/2);game.p.x=c+.5;game.p.z=c+.5;game.p.feetY=0;game.p.vy=0;game.p.grounded=true;updateVertical(game.p,.016);return {surface:supportHeight(game.p,game.p.x,game.p.z),floor:floorHeight(game.p.x,game.p.z),deck:deckHeight(game.p.x,game.p.z),feet:game.p.feetY};},debugTop:()=>{if(!game||!bridgeSpecs.length)return null;const c=Math.floor(mapSize/2);game.p.x=c+.5;game.p.z=c+.5;game.p.feetY=BRIDGE_Y;game.p.vy=0;game.p.grounded=true;updateVertical(game.p,.016);return {surface:supportHeight(game.p,game.p.x,game.p.z),floor:floorHeight(game.p.x,game.p.z),deck:deckHeight(game.p.x,game.p.z),feet:game.p.feetY};},debugTraverse:(frames=360)=>{if(!game||!bridgeSpecs.length)return null;const c=Math.floor(mapSize/2),p=game.p;p.x=c+14.5;p.z=c+.5;p.feetY=0;p.vy=0;p.grounded=true;p.yaw=-Math.PI/2;game.waveDelay=1e6;input.keys.KeyW=true;const samples=[];for(let k=0;k<frames&&game.state==='playing';k++){update(.016);if(k%30===0)samples.push([k,p.x,p.feetY]);}input.keys.KeyW=false;return {x:p.x,z:p.z,y:p.feetY,grounded:p.grounded,samples};},debugDrop:(frames=190)=>{if(!game||!bridgeSpecs.length)return null;const c=Math.floor(mapSize/2),p=game.p;p.x=c+.5;p.z=c+.5;p.feetY=BRIDGE_Y;p.vy=0;p.grounded=true;p.yaw=0;game.waveDelay=1e6;input.keys.KeyW=true;const samples=[];for(let k=0;k<frames&&game.state==='playing';k++){update(.016);if(k%30===0)samples.push([k,p.z,p.feetY]);}input.keys.KeyW=false;return {z:p.z,y:p.feetY,grounded:p.grounded,samples};},debugLevelInfo:()=>({sector:game?.sector,player:game?{x:game.p.x,z:game.p.z,y:game.p.feetY,armor:game.p.armor}:null,mapSchema:save.checkpoint?.mapSchema}),bridge:()=>({specs:bridgeSpecs.map(x=>({...x})),cells:Array.from(deckCells).filter(x=>x>0).length,ceiling:ceilingHeight()}),bridgeAt:deckHeight,teleportBridge:()=>{if(!game||!bridgeSpecs.length)return false;const c=Math.floor(mapSize/2);game.p.x=c+.5;game.p.z=c+.5;game.p.feetY=BRIDGE_Y;game.p.vy=0;game.p.grounded=true;saveRun();return true;},vertical:()=>game?{feetY:game.p.feetY,vy:game.p.vy,grounded:game.p.grounded,ground:floorHeight(game.p.x,game.p.z),stages:stairStages.length,steps:[...new Set(Array.from(heightCells).map(h=>h.toFixed(2)))].sort()}:null,jump:queueJump,stairStages:()=>stairStages.map(s=>({...s})),groundHeight:floorHeight,setYaw:(a)=>{if(game)game.p.yaw=a;},playerPos:()=>game?{x:game.p.x,z:game.p.z,yaw:game.p.yaw}:null,currentStyle:()=>({sector:game?.sector,style:sectorStyle,arch:sectorArchitecture,themes:themes.length}),setDamage:(v=22)=>{if(game){game.p.armorDelay=0;game.p.armor=Math.max(0,game.p.armor-v);}},saveNow:()=>saveRun(),saveSummary:()=>({available:storageAvailable,snapshot:save.checkpoint&&{version:save.checkpoint.version,sector:save.checkpoint.sector,state:save.checkpoint.state,spawned:save.checkpoint.live?.spawned,player:save.checkpoint.player},credits:save.credits,kills:save.kills}),setPosition:(x,z)=>{if(game&&!collide(x,z,.22)){game.p.x=x;game.p.z=z;game.p.feetY=floorHeight(x,z);game.p.vy=0;game.p.grounded=true;saveRun();return true;}return false;},debugBuild:(n)=>{buildMap(n);if(game){game.p.x=spawnX;game.p.z=spawnZ;}},debugPortalReady:()=>{if(game)game.portalReady=true;},route:()=>game?.portalReady?portalRoute(game.p,500):[],mapInfo:()=>({mapCells:mapCells.map(row=>row.slice()),spawn:[spawnX,spawnZ],portal:[portal.x,portal.z],features:mapFeatures.map(f=>({x:f.x,z:f.z})),arch:sectorArchitecture,style:sectorStyle,size:mapSize,rooms:mapRooms.length,meshes:meshStats,webgl:glReady}),getState:()=>game&&({state:game.state,sector:game.sector,enemies:game.enemies.length,kills:game.kills,spawned:game.spawned,portalReady:game.portalReady,hp:game.p.hp,score:game.score,weapon:game.p.weapon,shots:game.p.shots,yaw:game.p.yaw,pitch:game.p.pitch}),nextSector:()=>{if(game){game.portalReady=true;game.p.x=portal.x;game.p.z=portal.z;portalNext()}},fire:shoot,weaponSelect:to=>switchWeapon(to),weaponList:()=>weapons.map(w=>({name:w.name,mode:w.mode,shots:w.shots})),nodes:()=>game?.nodes.map(n=>({x:n.x,z:n.z,type:n.type,hp:n.hp,dead:n.dead})),testAimNode:(i=0)=>{if(!game)return false;const n=game.nodes[i];if(!n||n.dead)return false;let p=game.p;const offsets=[[2,0],[-2,0],[0,2],[0,-2]];let pos=offsets.map(([x,z])=>({x:n.x+x,z:n.z+z})).find(q=>!collide(q.x,q.z,.24)&&lineClear(q.x,q.z,n.x,n.z));if(!pos)return false;p.x=pos.x;p.z=pos.z;p.yaw=Math.atan2(n.x-p.x,n.z-p.z);p.pitch=Math.atan2(1.3-1.47,hypot(n.x-p.x,n.z-p.z));return true;},damageNode:(i,d)=>game&&damagePowerNode(game.nodes[i],d),arsenal:()=>({opened:arsenalOpened,items:$('weaponDrawer').querySelectorAll('[data-wpn]').length}),effectCounts:()=>game&&({decals:game.decals.length,projectiles:game.projectiles.length,impacts:game.impactFx.length,tracers:game.tracers.length,scorch:game.scorch.length}),testAimWall:()=>{if(!game)return;const p=game.p;for(let i=0;i<48;i++){let a=TAU*i/48;const wall=rayWall({x:p.x,y:1.47,z:p.z},{x:Math.sin(a),y:0,z:Math.cos(a)},36);if(wall&&wall.t>1&&wall.t<34){p.yaw=a;p.pitch=0;return wall;}}},killAll:()=>{if(game){game.spawned=game.target;for(const e of [...game.enemies]){e.dead=true;awardKill(e)}game.enemies=[];game.portalReady=true}},boss:()=>{if(game){spawnEnemy('boss',true)}},campaign:()=>({...save.campaign}),campaignMap:()=>showCampaignMap(),campaignStart:(n)=>startGame(false,n),campaignClear:()=>{if(game){game.spawned=game.target;game.enemies=[];game.portalReady=true;portalNext();}},campaignPage:(p)=>showCampaignMap(p)};// Stage 3 diagnostics: inspect active world geometry on a real WebGL device.
Object.assign(window.__neonTest,{
 worldSolids:()=>({webgl:glReady,...worldSolidStats()}),
 traceWorld:(x,y,z,dx,dy,dz,len=10,r=0)=>{
  const magnitude=Math.hypot(dx,dy,dz)||1;
  const o={x,y,z},d={x:dx/magnitude,y:dy/magnitude,z:dz/magnitude};
  const h=r>0?sweepWorldSphere(o,d,len,r):rayWall(o,d,len);
  return h&&{t:h.t,x:h.x,y:h.y,z:h.z,kind:h.kind,nx:h.nx,ny:h.ny,nz:h.nz};
 }
});

// Stage 5 diagnostics: compare a visible robot attachment with its hit volume.
// Geometry comes from the active combat raycast, not a test-only duplicate.
Object.assign(window.__neonTest,{
 traceRobot:(x,y,z,dx,dy,dz,len=10)=>{
  const mag=Math.hypot(dx,dy,dz)||1;
  const h=rayEnemy({x,y,z},{x:dx/mag,y:dy/mag,z:dz/mag},len);
  return h&&{id:h.enemy.id,type:h.enemy.type,boss:!!h.enemy.boss,part:h.part,
    distance:h.t,x:h.x,y:h.y,z:h.z};
 }
});

// Stage 8 diagnostics: evaluate real 3D cover without spawning or damaging
// anything. Coordinates are foot positions in game world units (x, y, z).
Object.assign(window.__neonTest,{
 coverBetween:(x,y,z,X,Y,Z)=>enemyCombatClear(
  {x,z,feetY:y},{x:X,z:Z,feetY:Y}),
});

// Stage 9: device-side diagnostics to compare map navigation and 3D body
// clearance. Pure read-only probes; no weapon, score or save mutation.
Object.assign(window.__neonTest,{
 npcNav:(x,z,feetY=0,type='scout',radius=.55)=>{
  if(!game||![x,z,feetY,radius].every(Number.isFinite))return null;
  const e={x,z,feetY,type,radius,maxhp:100,boss:type==='boss',orbit:1,id:11};
  const tx=Math.floor(x),tz=Math.floor(z);
  return {at:[x,z,feetY],type,bodyHeight:enemyBodyHeight(e),
   canOccupy:enemyCanOccupy(e,x,z),tile:enemyNavTile(tx,tz),
   direct:enemyDirectRoute(e,game.p),
   distance:Math.hypot(game.p.x-x,game.p.z-z),
   webgl:glReady,solids:worldSolidCount,
   field:navField&&tx>=0&&tz>=0&&tx<mapSize&&tz<mapSize?
    navField[tz*mapSize+tx]:null};
 }
});

// Stage 10: read-only measurements of living robot spacing in the current scene.
// Unlike the route debugger this never inserts actors or modifies navigation.
Object.assign(window.__neonTest,{
 npcCrowd:()=>{
  if(!game)return null;
  const living=game.enemies.filter(e=>!e.dead);
  let overlapPairs=0,closestGap=null;
  for(let i=0;i<living.length;i++)for(let j=i+1;j<living.length;j++){
   const a=living[i],b=living[j],ay=Number.isFinite(a.feetY)?a.feetY:0,
         by=Number.isFinite(b.feetY)?b.feetY:0;
   if(ay+enemyBodyHeight(a)<=by+.03||by+enemyBodyHeight(b)<=ay+.03)continue;
   const gap=Math.hypot(a.x-b.x,a.z-b.z)-enemyCrowdRadius(a)-enemyCrowdRadius(b);
   if(closestGap===null||gap<closestGap)closestGap=gap;
   if(gap<-.02)overlapPairs++;
  }
  return {living:living.length,overlapPairs,closestGap,webgl:glReady};
 }
});

// Stage 11: read-only spawn-space probe for real-device diagnosis.
// In particular, a valid empty map cell is not necessarily an empty 3D
// volume when a boss, player, handrail or elevated robot occupies it.
Object.assign(window.__neonTest,{
 npcSpawnCheck:(x,z,r=.48,height=1.9)=>{
  if(!game||![x,z,r,height].every(Number.isFinite)||r<.1||height<.1)return null;
  return enemySpawnSpaceClear(x,z,r,height);
 }
});

// Stage 13: read-only status for camera, stamina and permanent upgrades.
Object.assign(window.__neonTest,{
 expansionStatus:()=>({camera:save.settings.cameraMode,
  perkLevels:save.perms.slice(),perkMaximum:PERM_MAX_LEVEL,
  energy:game?.p.energy??null,maxEnergy:game?.p.maxEnergy??null,
  dashRange:game?.p.dashRange??null,
  jumpHeld:input.jumpHeld,sprintTired:!!game?.p.sprintTired})
});

// Stage 14: public, read-only QA state. Never expose the password digest.
Object.assign(window.__neonTest,{
 developerFlightStatus:()=>({
  developerMode:devMode,creditsShown:developerCredits(),
  campaignAccessibleMaximum:devMode?CAMPAIGN_MAX_LEVEL:save.campaign.highestUnlocked,
  armorOwnedCount:Object.keys(save.bodyArmor.owned).length,
  equippedArmor:save.bodyArmor.equipped,
  equippedArmorLevel:save.bodyArmor.owned[save.bodyArmor.equipped]??null,
  flightUnlocked:!!game?.p.flightUnlocked,flying:!!game?.p.flying,
  flightAltitude:game?.p.feetY??null,ceilingHeight:game?ceilingHeight():null,
  skyPlatforms:game?skyDeckSpecs.length:null
 })
});

// Stage 15: inspect altitude on real hardware. Only the authenticated local
// developer sandbox can summon test robots; normal campaigns are unaffected.
Object.assign(window.__neonTest,{
 airRobotStatus:()=>game?game.enemies.filter(e=>e.airborne&&!e.dead).map(e=>({
  id:e.id,type:e.type,altitude:+e.feetY.toFixed(3),
  x:+e.x.toFixed(2),z:+e.z.toFixed(2),hp:+e.hp.toFixed(1),
  blocked:+(e.airLiftBlocked||0).toFixed(2)
 })):[],
 developerSummonFlyer:type=>{
  if(!devMode||game?.state!=='playing'||
    !['drone','skyhunter','skyguard','stormray'].includes(type))return null;
  const e=spawnEnemy(type,false);
  return e?{id:e.id,type:e.type,altitude:e.feetY}:null;
 }
});
// Stage87: read-only physical-vs-rendered archive diagnostic for real devices.
// Useful for browser QA: never changes the game, inventory or checkpoints.
Object.assign(window.__neonMissionTest,{
 archivePedestals:()=>{
  if(!game?.mission?.caches?.length)return [];
  return game.mission.caches.map(c=>{
   const x=Math.floor(c.x),z=Math.floor(c.z),feet=floorHeight(c.x,c.z);
   const hull=worldEquipmentCell(x,z).find(s=>s.kind==='archive'&&s.entity===c);
   const ray=rayWall({x:c.x-.46,y:feet+.18,z:c.z},{x:1,y:0,z:0},.30);
   const ball=sweepWorldSphere({x:c.x-.46,y:feet+.18,z:c.z},{x:1,y:0,z:0},.30,.13);
   return {id:c.id,got:!!c.got,box:hull?.box||null,
    blocksBody:worldSolidBodyCollision(c.x,c.z,.23,feet,1.68),
    blocksBullet:ray?.kind==='archive',blocksRocket:ball?.kind==='archive'};
  });
 }
});
// Stage88: isolated browser verification of the *real* gameplay integrator.
// The test temporarily swaps in a dummy operator, restores the live player's
// entire object, and never writes a save. No developer mode required because
// this is a local QA probe, not a gameplay enhancement.
Object.assign(window.__neonMissionTest,{
 verticalEquipmentPhysics:()=>{
  if(!game)return null;
  const g=game,p=g.p,oldDown=input.flyDown,oldUp=input.flyUp;
  const oldKeys=input.keys,oldQueued=input.jumpQueued,oldHeld=input.jumpHeld;
  const results=[];
  try{
   const samples=[['archive',g.mission?.caches?.[0]],
    ['equipment',g.devices?.[0]],['node',g.nodes?.find(n=>!n.dead)]];
   for(const [kind,entity] of samples){
    if(!entity)continue;
    const solid=worldEquipmentCell(Math.floor(entity.x),Math.floor(entity.z))
      .find(s=>s.kind===kind&&s.entity===entity&&worldEquipmentActive(s));
    if(!solid)continue;
    const roof=solid.box[4],q={x:entity.x,z:entity.z,
     feetY:roof+1.25,vy:-3.5,flying:false,flightUnlocked:true,grounded:false};
    g.p=q;input.flyDown=false;input.flyUp=false;input.keys={};
    input.jumpQueued=false;input.jumpHeld=false;
    updateVertical(q,.42);
    const fall={feet:q.feetY,grounded:q.grounded};
    q.feetY=roof+1.45;q.vy=0;q.flying=true;q.grounded=false;
    input.flyDown=true;updateVertical(q,.49);
    results.push({kind,roof,fall,flight:{feet:q.feetY}});
   }
   return {render:glReady?'WebGL':'Canvas',results};
  }finally{
   g.p=p;input.flyDown=oldDown;input.flyUp=oldUp;
   input.keys=oldKeys;input.jumpQueued=oldQueued;input.jumpHeld=oldHeld;
  }
 }
});
// Stage89: non-mutating real-scene probe for robots navigating around the
// SAME live equipment AABBs used by the renderer and projectile physics.
// Unlike mock movement, this examines the actual procedural mission sites.
Object.assign(window.__neonTest,{
 equipmentDirectRoutes:()=>{
  if(!game||game.state!=='playing')return null;
  const items=[...(game.nodes||[]).filter(n=>!n.dead),...(game.devices||[]),
   ...((game.mission?.type==='recovery'&&game.mission.caches)||[])];
  const out=[];
  for(const o of items){
   const ground=floorHeight(o.x,o.z);
   for(const [dx,dz] of [[1,0],[0,1]]){
    let accepted=false;
    for(const span of [1.05,.84]){
     const a={x:o.x-dx*span,z:o.z-dz*span},b={x:o.x+dx*span,z:o.z+dz*span};
     if(collide(a.x,a.z,.25)||collide(b.x,b.z,.25)||
        worldSolidBodyCollision(a.x,a.z,.24,ground,1.68)||
        worldSolidBodyCollision(b.x,b.z,.24,ground,1.68)||
        !lineClear(a.x,a.z,b.x,b.z))continue;
     const enemy={id:37,x:a.x,z:a.z,feetY:ground,radius:.48,
      type:'scout',maxhp:100};
     out.push({x:o.x,z:o.z,blocked:!enemyDirectRoute(enemy,b)});
     accepted=true;break;
    }
    if(accepted)break;
   }
  }
  return {bodies:items.length,probes:out.length,
   blocked:out.filter(t=>t.blocked).length,clearThroughSolid:out.filter(t=>!t.blocked)};
 }
});
// Stage92: read-only, browser-side physics audit of real route points.
// Routes are validated against *movement* collision edges, not just rendered
// mapCells. The diagnostic does not modify enemies, geometry or save data.
Object.assign(window.__neonTest,{
 physicalGuidance:()=>{
  if(!game||game.state!=='playing')return null;
  const p=game.p,objective=game.portalReady?null:missionWaypoint(game);
  const field=game.portalReady?portalFlow():objective?missionField(objective):null;
  const route=game.portalReady?portalRoute(p,mapSize*mapSize):
   objective?missionRouteTo(p,objective,mapSize*mapSize):[];
  const cellX=Math.floor(p.x),cellZ=Math.floor(p.z),key=cellZ*mapSize+cellX;
  let broken=0,wallCrossings=0;
  for(let i=1;i<route.length;i++){
   const a=route[i-1],b=route[i],x=Math.floor(a.x),z=Math.floor(a.z),
    X=Math.floor(b.x),Z=Math.floor(b.z);
   if(Math.abs(x-X)+Math.abs(z-Z)!==1||!playerNavEdge(x,z,X,Z))broken++;
   if(mapCells[Z]?.[X]!==0)wallCrossings++;
  }
  return {render:glReady?'WebGL':'Canvas',mode:game.portalReady?'extraction':
   objective?'mission':'none',distance:field?.[key]??null,
   length:route.length,edges:Math.max(0,route.length-1),broken,wallCrossings,
   physical:broken===0&&wallCrossings===0};
 }
});
// Stage93: read-only browser QA of REAL reachable interaction faces and
// graph-distance mission target selection. The source of truth remains the
// same AABB raycast and robot edge graph used by live gameplay.
Object.assign(window.__neonTest,{
 missionContacts:()=>{
  if(!game||game.state!=='playing')return null;
  const g=game,targets=[...(g.mission?.caches||[]),...(g.devices||[])],
   origin=missionGroundField(spawnX,spawnZ),n=mapSize;
  let accessible=0,blocked=0,guided=0;
  for(const o of targets){
   const x=Math.floor(o.x),z=Math.floor(o.z),kind=missionInteractionKind(o);
   let choice=null;
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const X=x+dx,Z=z+dz;
    if(X<1||Z<1||X>=n-1||Z>=n-1||origin[Z*n+X]<0)continue;
    const p={x:X+.5,z:Z+.5,feetY:floorHeight(X+.5,Z+.5)};
    if(missionInteractionClear(p,o,kind)&&
       !worldSolidBodyCollision(p.x,p.z,.23,p.feetY,1.7)){choice=p;break;}
   }
   if(!choice){blocked++;continue;}
   accessible++;
   const field=missionField(o);
   if(field[Math.floor(choice.z)*n+Math.floor(choice.x)]===0)guided++;
  }
  const pool=g.mission?.type==='sabotage'?g.nodes.filter(q=>!q.dead&&q.type!==2):
   g.mission?.type==='recovery'?g.mission.caches.filter(q=>!q.got&&missionItemActive(g,q,'recovery')):
   g.mission?.type==='relay'?g.devices.filter(q=>q.kind==='relay'&&!q.used&&missionItemActive(g,q,'relay')):[];
  const chosen=pool.length>1?missionWaypoint(g):null;
  const fromPlayer=chosen?missionWaypointGroundField(g.p):null;
  let best=Infinity,selected=null;
  if(chosen){
   for(const q of pool){const d=missionApproachDistance(fromPlayer,q);if(d>=0)best=Math.min(best,d);}
   selected=missionApproachDistance(fromPlayer,chosen);
  }
  return {sector:g.sector,render:glReady?'WebGL':'Canvas',targets:targets.length,
   accessible,blocked,guided,source:pool.length,selected,best,
   choiceCorrect:!chosen||selected===best};
 }
});

// Stage94: read-only live audit of hazard cover. The wall and open-corridor
// samples are taken from the actual generated geometry; no invisible test
// blockers, health mutations or forced gameplay transitions are installed.
Object.assign(window.__neonTest,{
 physicalHazardCover:()=>{
  if(!game)return null;
  const n=mapSize,dirs=[[1,0],[0,1]];
  let fullWalls=0,blockedWalls=0,openAisles=0,clearAisles=0,coils=0,coilFaces=0;
  for(let z=3;z<n-3&&(fullWalls<3||openAisles<3);z++)
   for(let x=3;x<n-3&&(fullWalls<3||openAisles<3);x++)
    for(const [dx,dz] of dirs){
     if(fullWalls<3&&mapCells[z][x]===1&&
       mapCells[z-dz][x-dx]===0&&mapCells[z+dz][x+dx]===0){
      const a={x:x-dx+.5,y:floorHeight(x-dx+.5,z-dz+.5)+.85,z:z-dz+.5};
      const p={x:x+dx+.5,z:z+dz+.5,feetY:floorHeight(x+dx+.5,z+dz+.5)};
      if(Math.abs(a.y-.85-p.feetY)<.28){
       fullWalls++;if(missionHazardPlayerExposure(a,p)===0)blockedWalls++;
      }
     }
     if(openAisles<3&&mapCells[z][x]===0&&mapCells[z+dz]?.[x+dx]===0){
      const a={x:x+.5,y:floorHeight(x+.5,z+.5)+.85,z:z+.5};
      const p={x:x+dx+.5,z:z+dz+.5,feetY:floorHeight(x+dx+.5,z+dz+.5)};
      if(Math.abs(a.y-.85-p.feetY)<.28&&!rayWall(a,{x:dx,y:0,z:dz},.75)){
       openAisles++;if(missionHazardPlayerExposure(a,p)>0)clearAisles++;
      }
     }
    }
  for(const d of game.devices||[])if(d.kind==='coil'){
   coils++;
   const ix=Math.floor(d.x),iz=Math.floor(d.z);
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const X=ix+dx,Z=iz+dz;if(!enemyNavTile(X,Z))continue;
    const p={x:X+.5,z:Z+.5,feetY:floorHeight(X+.5,Z+.5)};
    if(missionInteractionClear(p,d,'device')&&missionCoilPulseExposure(d,p)>0){coilFaces++;break;}
   }
  }
  return {level:game.sector,webgl:glReady,fullWalls,blockedWalls,
   openAisles,clearAisles,coils,coilFaces};
 }
});

// Stage95: read-only QA confirms that the actual campaign NPC spawn volume
// rejects all live metal chassis, regardless of Canvas/WebGL renderer.
// The target-HUD probes use the real world raycaster, without mutating actors.
Object.assign(window.__neonTest,{
 physicalSpawnAndTarget:()=>{
  if(!game)return null;
  const entities=[...(game.nodes||[]).filter(n=>!n.dead),
   ...(game.devices||[]),...(game.mission?.caches||[])];
  let blockedHulls=0;
  for(const q of entities){
   if(!enemySpawnSpaceClear(q.x,q.z,.48,1.9,floorHeight(q.x,q.z)))blockedHulls++;
  }
  let shielded=0,wallPairs=0,open=0,openSeen=0;
  const n=mapSize,dirs=[[1,0],[0,1]];
  for(let z=3;z<n-3&&(wallPairs<4||open<4);z++)
   for(let x=3;x<n-3&&(wallPairs<4||open<4);x++)
    for(const [dx,dz] of dirs){
     if(wallPairs<4&&mapCells[z][x]===1&&
        mapCells[z-dz]?.[x-dx]===0&&mapCells[z+dz]?.[x+dx]===0){
      const before={x:x-dx+.5,z:z-dz+.5,
       feetY:floorHeight(x-dx+.5,z-dz+.5)},
       behind={x:x+dx+.5,z:z+dz+.5,
        feetY:floorHeight(x+dx+.5,z+dz+.5),radius:.48,type:'scout'};
      if(Math.abs(before.feetY-behind.feetY)<.26){
       wallPairs++;if(!dcTargetPhysicallyVisible(before,behind))shielded++;
      }
     }
     if(open<4&&mapCells[z][x]===0&&mapCells[z+dz]?.[x+dx]===0){
      const before={x:x+.5,z:z+.5,feetY:floorHeight(x+.5,z+.5)},
       behind={x:x+dx+.5,z:z+dz+.5,
        feetY:floorHeight(x+dx+.5,z+dz+.5),radius:.48,type:'scout'};
      if(Math.abs(before.feetY-behind.feetY)<.26&&
         !rayWall({x:before.x,y:before.feetY+1.47,z:before.z},
          {x:dx,y:0,z:dz},.75)){
       open++;if(dcTargetPhysicallyVisible(before,behind))openSeen++;
      }
     }
    }
  return {level:game.sector,render:glReady?'WebGL':'Canvas',
   hulls:entities.length,blockedHulls,wallPairs,shielded,open,openSeen};
 }
});

// Stage96: explicit QA-only destructive rehearsal of the REAL campaign save
// loader. The test never calls this during ordinary gameplay. Checkpoint data
// and actor values are cloned before deliberately embedding them in metal.
Object.assign(window.__neonTest,{
 checkpointPhysicalRecovery:()=>{
  if(!game)return null;
  const site=(game.nodes||[]).find(n=>!n.dead)||(game.devices||[])[0];
  if(!site)return null;
  game.enemies=[];
  const kinds=game.sector%5===0?['brute','boss']:['brute','scout'];
  const savedEnemies=[];
  for(const kind of kinds){
   const e=spawnEnemy(kind,kind==='boss');
   if(!e)return {level:game.sector,error:'physical spawn unavailable'};
   e.hp=Math.round(e.maxhp*.37);e.attack=.43;
   savedEnemies.push({...e,x:site.x,z:site.z,
    feetY:floorHeight(site.x,site.z)+(e.airborne?.13:0)});
  }
  const cp=JSON.parse(JSON.stringify(save.checkpoint||{}));
  cp.version=4;cp.equipmentPhysicsVersion=1;cp.archivePlinthVersion=1;
  cp.player={...game.p,x:site.x,z:site.z,feetY:floorHeight(site.x,site.z)};
  cp.live={...(cp.live||{}),enemies:savedEnemies,nodes:game.nodes,
   devices:game.devices,mission:game.mission,spawned:savedEnemies.length,
   target:game.target,portalReady:false,nodesDestroyed:game.nodesDestroyed};
  restoreLiveCheckpoint(cp);
  let physical=true,crowd=true,health=true;
  for(const e of game.enemies){
   if(collide(e.x,e.z,enemyBodyRadius(e))||
      worldSolidBodyCollision(e.x,e.z,enemyBodyRadius(e),e.feetY,enemyBodyHeight(e)))
     physical=false;
   const old=savedEnemies.find(o=>o.id===e.id);
   if(!old||e.hp!==old.hp||e.attack!==old.attack)health=false;
   for(const other of game.enemies){
    if(other===e||other.id>=e.id)continue;
    if(e.feetY>=other.feetY+enemyBodyHeight(other)-.03||
       other.feetY>=e.feetY+enemyBodyHeight(e)-.03)continue;
    if(Math.hypot(e.x-other.x,e.z-other.z)<
       enemyCrowdRadius(e)+enemyCrowdRadius(other)-.005)crowd=false;
   }
  }
  return {level:game.sector,restored:game.enemies.length,
   expected:savedEnemies.length,physical,crowd,health,
   boss:game.sector%5===0?!game.boss?false:game.boss.boss:true,
   playerSafe:!collide(game.p.x,game.p.z,.23)&&
    !worldSolidBodyCollision(game.p.x,game.p.z,.23,game.p.feetY,PLAYER_SOLID_HEIGHT),
   playerMoved:Math.hypot(game.p.x-site.x,game.p.z-site.z)>.35};
 }
});
// Validate the complete startGame(resume=true) flow, not just the isolated
// restore function: old builds hid the restored boss bar unconditionally.
Object.assign(window.__neonTest,{
 checkpointBossHudResume:()=>{
  if(!game?.boss)return null;
  const id=game.boss.id,hp=game.boss.hp;
  saveRun();startGame(true);
  return {sector:game?.sector,restored:game?.boss?.id===id,
   health:game?.boss?.hp===hp,visible:$('bossWrap').style.display==='block',
   title:$('bossTitle').textContent};
 }
});
// Version-2 checkpoints use the compact legacy branch in startGame(). They
// have no live enemy state but must still refuse a new solid metal chassis.
Object.assign(window.__neonTest,{
 checkpointLegacyPlayerResume:()=>{
  if(!game)return null;
  const site=(game.nodes||[]).find(n=>!n.dead);
  if(!site)return null;
  const cp=JSON.parse(JSON.stringify(save.checkpoint||{}));
  cp.version=2;cp.sector=game.sector;
  cp.player={...game.p,x:site.x,z:site.z,feetY:floorHeight(site.x,site.z)};
  save.checkpoint=cp;
  startGame(true);
  const safe=!collide(game.p.x,game.p.z,.23)&&
   !worldSolidBodyCollision(game.p.x,game.p.z,.23,game.p.feetY,PLAYER_SOLID_HEIGHT);
  const relocated=Math.hypot(game.p.x-site.x,game.p.z-site.z)>.2;
  // A second legacy checkpoint puts roof-altitude feet inside a 2D wall.
  // The old resume branch once moved (x,z) without resetting feetY.
  let wall=null;
  for(let z=1;z<mapSize-1&&!wall;z++)for(let x=1;x<mapSize-1;x++)
   if(mapCells[z]?.[x]===1){wall={x:x+.5,z:z+.5};break;}
  if(!wall)return {sector:game.sector,safe,relocated,grounded:false};
  const ck2=JSON.parse(JSON.stringify(save.checkpoint||{}));
  ck2.version=2;ck2.player={...game.p,x:wall.x,z:wall.z,feetY:2.2};
  save.checkpoint=ck2;
  startGame(true);
  return {sector:game?.sector,safe,relocated,
   grounded:Math.abs(game.p.feetY-floorHeight(game.p.x,game.p.z))<.005,
   wallReset:Math.hypot(game.p.x-wall.x,game.p.z-wall.z)>.2};
 }
});
// Stage98 opt-in QA: ONLY real staged game actors/devices and real steel rays.
// The mission probes below are not part of the normal frame loop.
function stage98ContactTerminal(d){
 if(!game||!d)return false;
 const n=mapSize,x=Math.floor(d.x),z=Math.floor(d.z),field=missionGroundField(spawnX,spawnZ);
 for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const X=x+dx,Z=z+dz;if(X<1||Z<1||X>=n-1||Z>=n-1||field[Z*n+X]<0)continue;
  const q={x:X+.5,z:Z+.5,feetY:floorHeight(X+.5,Z+.5)};
  if(!missionInteractionClear(q,d,'device')||
     worldSolidBodyCollision(q.x,q.z,.23,q.feetY,PLAYER_SOLID_HEIGHT))continue;
  Object.assign(game.p,q);game.p.grounded=true;game.p.shield=6;
  for(let k=0;k<12&&!d.used;k++)updateDevices(.16);
  return d.used;
 }
 return false;
}
window.__neonMissionTest.stage98Inspect=()=>{
 const g=game,m=g?.mission;if(!m)return null;
 const ids=m.type==='signal'?m.signalIds||[]:m.type==='surge'?m.surgeIds||[]:[];
 const terminals=ids.map(id=>g.devices.find(d=>d.id===id));
 return {sector:g.sector,type:m.type,version:m.version,done:m.done,required:m.required,
  terminals:terminals.length,physical:terminals.every(d=>!!d&&
   worldSolidBodyCollision(d.x,d.z,.23,floorHeight(d.x,d.z),1.65)),
  signalDone:m.signalDone||0,signalRequired:m.signalRequired||0,
  commanderKilled:!!m.commanderKilled,sentinelId:m.sentinelId||0,
  surgeReady:!!m.surgeReady,surgeRemaining:m.surgeRemaining||0,
  surgeActivations:m.surgeActivations||0,nodesDisabled:m.nodesDisabled||0,
  nodesRequired:m.nodesRequired||0,portal:g.portalReady};
};
window.__neonMissionTest.stage98Exercise=()=>{
 const g=game,m=g?.mission;
 if(!m||!['signal','surge'].includes(m.type))return null;
 const before=window.__neonMissionTest.stage98Inspect(),ids=[...(m.type==='signal'?m.signalIds:m.surgeIds)];
 const contacts=[];
 for(const id of ids)contacts.push(stage98ContactTerminal(g.devices.find(d=>d.id===id)));
 if(m.type==='signal'){
  const afterScan=m.signalDone===m.signalRequired;
  g.spawned=Math.floor(g.target*.48);g.waveDelay=0;g.enemies=[];
  spawnWave(.9);
  const e=g.enemies.find(e=>e.id===m.sentinelId);
  const realCommander=!!e&&e.elite&&
   !worldSolidBodyCollision(e.x,e.z,Math.max(enemyBodyRadius(e),enemyCrowdRadius(e)),e.feetY,enemyBodyHeight(e));
  if(e){g.spawned=g.target;e.dead=true;awardKill(e);}
  return {before,after:window.__neonMissionTest.stage98Inspect(),contacts,afterScan,
   realCommander,completed:g.portalReady&&m.done===m.required};
 }
 const windowStarted=m.surgeReady&&m.surgeRemaining>0;
 updateMission((m.surgeRemaining||0)+.5);
 const reset=!m.surgeReady&&ids.every(id=>!g.devices.find(d=>d.id===id)?.used);
 const retry=ids.map(id=>stage98ContactTerminal(g.devices.find(d=>d.id===id)));
 const actualNodes=g.nodes.filter(n=>!n.dead&&n.type!==2).slice(0,m.nodesRequired);
 const physical=actualNodes.every(n=>worldSolidBodyCollision(n.x,n.z,.20,floorHeight(n.x,n.z),1.65));
 g.spawned=g.target;g.enemies=[];
 for(const n of actualNodes)damagePowerNode(n,n.hp+1);
 return {before,after:window.__neonMissionTest.stage98Inspect(),contacts,windowStarted,
  reset,retry,physical,completed:g.portalReady&&m.done===m.required};
};
window.__neonMissionTest.stage98CheckpointRoundtrip=(sector=13)=>{
 if(![13,17].includes(sector))return null;
 window.__neonMissionTest.selectStage(sector);
 const before=window.__neonMissionTest.stage98Inspect(),g=game,m=g.mission;
 const id=(m.type==='signal'?m.signalIds:m.surgeIds)[0],d=g.devices.find(d=>d.id===id);
 const activated=stage98ContactTerminal(d);if(!activated)return {activated:false};
 const checkpointVersion=m.version,progress=m.done,terminalUsed=d.used,remaining=m.surgeRemaining||0;
 saveRun();startGame(true);
 const after=window.__neonMissionTest.stage98Inspect(),device=game?.devices.find(t=>t.id===id);
 return {activated,checkpointVersion,progress,terminalUsed,remaining,after,
  valid:!!after&&after.version===checkpointVersion&&after.type===before.type&&
   after.done===progress&&!!device?.used&&(!remaining||Math.abs(after.surgeRemaining-remaining)<.001)};
};
window.__neonMissionTest.stage98LegacyRecovery=()=>{
 window.__neonMissionTest.selectStage(13);
 saveRun();const cp=JSON.parse(JSON.stringify(save.checkpoint));
 const old=cp.live.mission;
 cp.archivePlinthVersion=0;
 cp.live.mission={...old,version:2,type:'recovery',required:2,done:1,routeMode:'free',
  caches:[{id:0,x:game.nodes[0].x,z:game.nodes[0].z,got:true},
   {id:1,x:game.nodes[1].x,z:game.nodes[1].z,got:false}]};
 const originals=cp.live.mission.caches.map(c=>({x:c.x,z:c.z}));
 save.checkpoint=cp;
 startGame(true);
 const m=game.mission,sites=m.caches||[];
 const moved=sites.some((c,i)=>Math.hypot(c.x-originals[i].x,c.z-originals[i].z)>.5);
 const safe=sites.every(c=>!game.nodes.some(n=>!n.dead&&
  Math.hypot(c.x-n.x,c.z-n.z)<.9)&&!game.devices.some(d=>
  Math.hypot(c.x-d.x,c.z-d.z)<.9));
 return {restored:m.type==='recovery',count:sites.length,preserved:sites[0]?.got===true&&m.done===1,
  moved,safe,physical:sites.every(c=>worldSolidBodyCollision(c.x,c.z,.2,floorHeight(c.x,c.z),1.65))};
};

window.__neonMissionTest.stage98CommanderPhaseGate=()=>{
 window.__neonMissionTest.selectStage(13);
 const g=game,m=g.mission;
 g.spawned=Math.max(0,g.target-1);g.enemies=[];g.waveDelay=0;
 spawnWave(.9);
 const reserved=m.sentinelId===0&&g.spawned===Math.max(0,g.target-1)&&g.enemies.length===0;
 const ids=[...(m.signalIds||[])],contacts=ids.map(id=>stage98ContactTerminal(g.devices.find(d=>d.id===id)));
 g.waveDelay=0;spawnWave(.9);
 const commander=g.enemies.find(e=>e.id===m.sentinelId);
 return {reserved,contacts,linked:m.signalDone===m.signalRequired,
  appeared:!!commander,elite:!!commander?.elite,
  solid:!!commander&&!worldSolidBodyCollision(commander.x,commander.z,
   Math.max(enemyBodyRadius(commander),enemyCrowdRadius(commander)),commander.feetY,enemyBodyHeight(commander))};
};

// Stage99 QA: verify the actual bonus loop without changing the running game,
// permanent credits or save. Real map cells, equipment AABBs and bridge decks
// are used; only a temporary game-state shell is substituted for pickup test.
Object.assign(window.__neonTest,{
 physicalLootAudit:()=>{
  if(!game)return null;
  const original=game,oldCredits=save.credits;
  const source={x:original.p.x,z:original.p.z,feetY:original.p.feetY};
  const start=worldLootSpawn(source,'credits',10,.19,.12);
  let collected=false;
  try{
   const snapshot={...original,p:{...original.p},loot:start?[start]:[],
    bullets:[],particles:[],tracers:[],scorch:[],totalCredits:original.totalCredits||0};
   game=snapshot;
   if(start){updateBullets(.02);
    collected=snapshot.loot.length===0&&snapshot.totalCredits>original.totalCredits;}
  }finally{game=original;save.credits=oldCredits;}
  const d=original.devices?.[0],feet=d?floorHeight(d.x,d.z):0;
  const rim=!!d&&worldSolidBodyCollision(d.x+.355,d.z,.015,feet+.01,1.0);
  const blocked=!!d&&!worldLootPickupClear({x:d.x-.92,z:d.z,feetY:feet,magnet:3},
   {x:d.x+.92,z:d.z,feetY:feet,type:'credits',life:5});
  let decks=0;
  for(let z=1;z<mapSize-1;z++)for(let x=1;x<mapSize-1;x++){
   const y=deckAtCell(x,z);if(y<.9||mapCells[z][x]!==0)continue;
   const q={x:x+.5,z:z+.5,feetY:y};
   if(worldSolidBodyCollision(q.x,q.z,.2,y+.1,.7))continue;
   const elevated=worldLootSpawn(q,'heal',10);
   if(elevated&&Math.abs(elevated.feetY-y)<.02){decks++;break;}
  }
  return {sector:original.sector,build:GAME_BUILD,collection:collected,
   steelRim:rim,steelBlocksPickup:blocked,elevatedDecks:decks};
 }
});

// STAGE100: read-only extraction test on the actual generated geometry. A
// temporary snapshot adds an ACTUAL station AABB, then restores all objects;
// never touches career progress, credits, saves or player coordinates.
Object.assign(window.__neonTest,{
 physicalExtractionAudit:()=>{
  const g=game;if(!g)return null;
  const floor=floorHeight(portal.x,portal.z),at={x:portal.x,z:portal.z,feetY:floor};
  const legitimate=physicalPortalContact(at);
  const upper=physicalPortalContact({...at,feetY:floor+2.50});
  const tooFar=physicalPortalContact({...at,x:portal.x+1.4});
  let insideSteel=false;
  const original=game;
  try{
   game={...g,devices:[...(g.devices||[]),{id:-1000,x:portal.x,z:portal.z,
    kind:'repair',used:false,charge:0}]};
   insideSteel=physicalPortalContact(at);
  }finally{game=original;}
  return {build:GAME_BUILD,sector:g.sector,legitimate,upper,tooFar,insideSteel,
   restored:physicalPortalContact(at),
   physicalEntryClear:!collide(at.x,at.z,.2)&&
    !worldSolidBodyCollision(at.x,at.z,.20,floor+.12,1.55),
   deck:deckAtCell(Math.floor(portal.x),Math.floor(portal.z))};
 }
});
// Stage100 integration probe: execute the real update() portal trigger rather
// than merely inspecting a helper. Only an ephemeral copy of the game is
// ticked; the completion handler is temporarily replaced with a counter so
// NO career records, credits, checkpoints or sector changes can occur.
window.__neonTest.physicalExtractionGameplay=()=>{
 if(!game)return null;
 const original=game,complete=portalNext,clock=navClock,field=navField,
  revision=navFieldDestroyed,splash=dc.splashUntil;
 dc.splashUntil=0;
 const floor=floorHeight(portal.x,portal.z);
 const run=(steel)=>{
  const player={...original.p,x:portal.x,z:portal.z,feetY:floor,
   flying:false,grounded:true,vy:0};
  const machine={id:-999,x:portal.x,z:portal.z,kind:'repair',used:true,charge:0};
  game={...original,state:'playing',p:player,portalReady:true,
   enemies:[],nodes:[],devices:steel?[machine]:[],loot:[],bullets:[],
   projectiles:[],burstQueue:[],robotDebris:[],impactFx:[],decals:[],
   scorch:[],particles:[],spawned:1,target:1,boss:null,
   mission:{type:'purge',done:0,required:0,caches:[],hazardsHit:0,hazardsEvaded:0},
   arenaEvent:null};
  let count=0;
  const before=physicalPortalContact(player);
  portalNext=()=>{count++;};
  update(.016);
  return {count,before,after:physicalPortalContact(game.p),
   pos:{x:game.p.x,z:game.p.z,feetY:game.p.feetY},state:game.state,arsenalOpened};
 };
 try{
  const blocked=run(true),free=run(false);
  return {build:GAME_BUILD,sector:original.sector,blocked,free,
   success:blocked.count===0&&free.count===1};
 }finally{
  game=original;portalNext=complete;navClock=clock;navField=field;
  navFieldDestroyed=revision;dc.splashUntil=splash;
 }
};

// STAGE101: read-only verification of actual upper-deck navigation. On every
// sky gallery, trace the physical flow-field through real rendered metal
// AABBs at the robot's elevated feet, not through the floor far below it.
Object.assign(window.__neonTest,{
 upperDeckPhysics:()=>{
  if(!game)return null;
  const cases=[],n=mapSize;
  for(const gallery of gallerySpecs){
   const a=balconySpecs.find(b=>b.planIndex===gallery.from),
    b=balconySpecs.find(b=>b.planIndex===gallery.to);
   if(!a||!b){cases.push({reachable:false,error:'missing landing'});continue;}
   const field=upperDeckField(b.cx+.5,b.cz+.5,gallery.y);
   let x=a.cx,z=a.cz,dist=field?.[z*n+x]??32767,steps=0,valid=dist>0&&dist<32767;
   while(valid&&dist>0&&steps<n*n){
    let next=null;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
     const X=x+dx,Z=z+dz;
     if(X<1||Z<1||X>=n-1||Z>=n-1||field[Z*n+X]!==dist-1||
        !upperDeckEdgeClear(x,z,X,Z,gallery.y))continue;
     next={x:X,z:Z};break;
    }
    if(!next){valid=false;break;}
    valid=!worldSolidBodyCollision((x+next.x)/2+.5,(z+next.z)/2+.5,
      .22,gallery.y,1.68);
    x=next.x;z=next.z;dist=field[z*n+x];steps++;
   }
   cases.push({reachable:valid&&dist===0,steps,level:gallery.y});
  }
  return {build:GAME_BUILD,sector:game.sector,webgl:glReady,
   galleries:cases.length,routes:cases,allClear:cases.every(c=>c.reachable)};
 }
});

// STAGE102: browser-visible proof that upper navigation uses the exact
// physical body class, rather than trusting a common scout-sized flow. This
// only reads the live map and immutable route fields; it never mutates save,
// enemies, mission status or difficulty settings.
Object.assign(window.__neonTest,{
 upperDeckChassis:()=>{
  if(!game)return null;
  const cases=[],n=mapSize;
  for(const gallery of gallerySpecs){
   const a=balconySpecs.find(b=>b.planIndex===gallery.from),
    b=balconySpecs.find(b=>b.planIndex===gallery.to);
   if(!a||!b){cases.push({ok:false,reason:'missing landing'});continue;}
   for(const sample of [
    {type:'scout',radius:.48,boss:false},
    {type:'brute',radius:1.10,boss:false},
    {type:'warden',radius:1.18,boss:true}]){
    const e={id:13,x:a.cx+.5,z:a.cz+.5,feetY:gallery.y,maxhp:200,...sample};
    const profile=upperDeckProfile(e),field=upperDeckField(b.cx+.5,b.cz+.5,gallery.y,profile);
    let x=a.cx,z=a.cz,dist=field?.[z*n+x]??32767;
    let steps=0,ok=true;
    if(dist===32767){ok=upperDeckHeading(e,b.cx+.5,b.cz+.5,gallery.y)===null;}
    else{
     ok=!worldSolidBodyCollision(e.x,e.z,profile.radius,gallery.y,profile.height);
     while(ok&&dist>0&&steps<n*n){
      let next=null;
      for(const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0]]){
       const X=x+dx,Z=z+dz;
       if(X<1||Z<1||X>=n-1||Z>=n-1||field[Z*n+X]!==dist-1||
          !upperDeckEdgeClear(x,z,X,Z,gallery.y,profile))continue;
       next={x:X,z:Z};break;
      }
      if(!next){ok=false;break;}
      ok=!worldSolidBodyCollision(next.x+.5,next.z+.5,profile.radius,gallery.y,profile.height);
      x=next.x;z=next.z;dist=field[z*n+x];steps++;
     }
     ok=ok&&dist===0;
    }
    cases.push({type:sample.boss?'boss':sample.type,
     radius:profile.radius,height:profile.height,steps,ok});
   }
  }
  return {build:GAME_BUILD,galleries:gallerySpecs.length,
   profiles:cases.length,steps:cases.reduce((s,c)=>s+c.steps,0),
   blocked:cases.filter(c=>c.ok&&c.steps===0).length,
   allClear:cases.every(c=>c.ok),cases};
 }
});
// Stage103: production-map (not mock geometry) audit of each walker chassis
// against its true ground graph. Read-only game state; only memoized fields
// are populated. An inaccessible heavy boss is reported, never routed through
// a visible metal body or across an impossible vertical riser.
Object.assign(window.__neonTest,{
 groundChassisPhysics:()=>{
  const g=game;if(!g||g.state!=='playing')return null;
  const n=mapSize,out={build:GAME_BUILD,render:glReady?'WebGL':'Canvas',
   sector:g.sector,profiles:0,physicalEdges:0,isolated:0,invalid:0,
   cases:[]},p=g.p;
  for(const [type,radius,boss] of [['scout',.48,false],['brute',1.10,false],['boss',1.20,true]]){
   const e={x:spawnX,z:spawnZ,feetY:floorHeight(spawnX,spawnZ),
    airborne:false,type,radius,boss,id:7};
   const profile=upperDeckProfile(e),field=groundChassisField(e,p);
   if(!field){out.invalid++;continue;}
   out.profiles++;
   let count=0,isolated=true;
   const edges=new Int8Array(n*n*4);
   for(let z=2;z<n-2;z+=3)for(let x=2;x<n-2;x+=3){
    const value=field[z*n+x];if(value<=0||value>=32767)continue;
    isolated=false;
    let found=false;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
     const X=x+dx,Z=z+dz;if(field[Z*n+X]!==value-1)continue;
     if(!groundChassisEdge(x,z,X,Z,profile,edges))continue;
     found=true;count++;out.physicalEdges++;break;
    }
    if(!found)out.invalid++;
   }
   if(isolated)out.isolated++;
   out.cases.push({type,radius:profile.radius,height:profile.height,edges:count,isolated});
  }
  out.allClear=out.invalid===0&&out.profiles===3;
  return out;
 }
});

// STAGE104 — genuine live-map fragment collisions, exercised on a disposable
// game snapshot: map walls, the actually rendered steel equipment hull, and
// raised bridge plates. Never alters campaign credits, NPCs or checkpoint.
Object.assign(window.__neonTest,{
 debrisPhysicalContacts:()=>{
  if(!game)return null;
  const old=game,out={build:GAME_BUILD,sector:game.sector,wall:false,
   equipment:false,deck:false,deckAvailable:false,restored:false,checks:0};
  const sh=(x,y,z,vx,vy,vz)=>({x,y,z,vx,vy,vz,size:.14,
   life:3,ttl:3,rested:false,bounces:0,rx:0,rz:0,spin:2});
  const sim=(piece,dt)=>{
   game={...old,robotDebris:[piece]};
   updateRobotDebris(dt);
   out.checks++;
   return game.robotDebris[0];
  };
  try{
   const n=mapSize;
   outer:for(let z=2;z<n-2;z++)for(let x=2;x<n-2;x++){
    if(mapCells[z][x]!==0||floorHeight(x+.5,z+.5)>.01)continue;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
     if(mapCells[z+dz]?.[x+dx]!==1||
        worldSolidBodyCollision(x+.5,z+.5,.07,.30,1.1))continue;
     const piece=sim(sh(x+.5,1.12,z+.5,dx*14,0,dz*14),.12);
     out.wall=!!piece&&(piece.x-(x+.5))*dx+
      (piece.z-(z+.5))*dz<.56;
     break outer;
    }
   }
   for(const d of [...(old.devices||[]),...(old.nodes||[])]){
    if(d.dead)continue;
    const floor=floorHeight(d.x,d.z);
    if(!worldSolidBodyCollision(d.x,d.z,.17,floor+.2,.8))continue;
    for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]){
     const sx=d.x+dx*.9,sz=d.z+dz*.9;
     if(collide(sx,sz,.07)||worldSolidBodyCollision(sx,sz,.07,floor+.2,.8))continue;
     const piece=sim(sh(sx,floor+.91,sz,-dx*12,0,-dz*12),.17);
     out.equipment=!!piece&&
      (piece.x-d.x)*dx+(piece.z-d.z)*dz>.12;
     break;
    }
    if(out.equipment)break;
   }
   outerDeck:for(let z=2;z<n-2;z++)for(let x=2;x<n-2;x++){
    const y=deckAtCell(x,z);
    if(mapCells[z][x]!==0||y<1.5)continue;
    out.deckAvailable=true;
    const piece=sim(sh(x+.5,y+.85,z+.5,0,-6,0),.22);
    out.deck=!!piece&&piece.y>=y-.005;
    break outerDeck;
   }
   out.allClear=out.wall&&out.equipment&&(!out.deckAvailable||out.deck);
  }finally{game=old;out.restored=game===old;}
  return out;
 }
});

// STAGE105: read-only browser verification of FULL visible headroom. Uses the
// actual procedural deck cells, collider and Robot Foundry-scaled body height,
// on the active campaign map; it never teleports enemies or edits saves.
Object.assign(window.__neonTest,{
 robotHeadroomAudit:()=>{
  const g=game;if(!g||g.state!=='playing')return null;
  const scout={type:'scout',radius:.42,boss:false,elite:false,airborne:false};
  const brute={type:'brute',radius:.69,boss:false,elite:false,airborne:false};
  const elite={type:'brute',radius:.69*1.13,boss:false,elite:true,airborne:false};
  const boss={type:'boss',radius:1.03,boss:true,elite:false,airborne:false};
  const group=[scout,brute,elite,boss];
  const out={build:GAME_BUILD,sector:g.sector,render:glReady?'WebGL':'Canvas',
   decks:0,checks:0,blocked:0,scoutOpen:0,failures:0,
   heights:group.map(e=>Number(enemyBodyHeight(e).toFixed(3)))};
  const n=mapSize;
  for(let z=1;z<n-1;z++)for(let x=1;x<n-1;x++){
   const top=deckAtCell(x,z);if(!(top>0)||mapCells[z]?.[x]!==0)continue;
   out.decks++;
   const px=x+.5,pz=z+.5,feet=floorHeight(px,pz),clearance=top-.17-feet;
   for(let i=0;i<group.length;i++){
    const e=group[i],h=enemyBodyHeight(e),r=enemyBodyRadius(e);
    const expected=top>feet+.004&&clearance<h-.004;
    const plate=worldDeckBodyCollision(px,pz,r,feet,h);
    const actual=worldSolidBodyCollision(px,pz,r,feet,h);
    out.checks++;
    if(plate!==expected||(expected&&!actual))out.failures++;
    if(expected)out.blocked++;
    else if(i===0&&clearance>h+.05)out.scoutOpen++;
    // A robot standing on the same deck has its feet on top of the plate,
    // not geometrically embedded into that same plate.
    out.checks++;
    if(worldDeckBodyCollision(px,pz,r,top,h))out.failures++;
   }
  }
  out.allClear=out.failures===0&&out.heights[3]>out.heights[2]&&
   out.heights[2]>out.heights[0];
  return out;
 }
});

// Stage106: render the REAL Canvas fallback from immediately in front of a
// generated solid stair riser. Count actual opaque draw calls rather than
// trusting a static string check. The temporary camera and Canvas method are
// restored; no game progress, mission state, or checkpoint is modified.
Object.assign(window.__neonTest,{
 stairOpaqueAudit:()=>{
  if(!game||game.state!=='playing'||!fallCtx)return null;
  const oldPlayer=game.p,oldFrame=fBackAt,context=fallCtx,original=context.fillRect;
  const oldMethod=Object.getOwnPropertyDescriptor(context,'fillRect');
  const out={build:GAME_BUILD,sector:game.sector,render:glReady?'WebGL':'Canvas',
   candidates:0,painted:0,physics:0,failures:0,samples:[],restored:false};
  let totalPaint=0;
  try{
   context.fillRect=function(x,y,w,h){
    const css=String(this.fillStyle),m=/^rgb\((\d+), (\d+), (\d+)\)$/.exec(css);
    const hex=/^#([0-9a-f]{6})$/i.exec(css);
    const rgb=m?[+m[1],+m[2],+m[3]]:hex?
      [0,2,4].map(k=>parseInt(hex[1].slice(k,k+2),16)):null;
    if(rgb&&rgb[1]===Math.round(rgb[0]*1.28)&&
      rgb[2]===Math.round(rgb[0]*1.46)&&h>10)totalPaint++;
    return original.call(this,x,y,w,h);
   };
   const directions=[[1,0],[-1,0],[0,1],[0,-1]],n=mapSize;
   outer:for(let z=2;z<n-2;z++)for(let x=2;x<n-2;x++){
    const top=floorHeightAtCell(x,z);
    if(top<.65||mapCells[z]?.[x]!==0)continue;
    for(const [dx,dz] of directions){
     if(mapCells[z+dz]?.[x+dx]!==0)continue;
     const low=floorHeightAtCell(x+dx,z+dz);
     if(top-low<.21)continue;
     const h=rayWall({x:x+dx+.5,y:low+(top-low)*.5,z:z+dz+.5},
       {x:-dx,y:0,z:-dz},1.5);
     if(!h||h.kind!=='stairs'||h.t<.49||h.t>.51)continue;
     out.physics++;
     const player={...oldPlayer,x:x+dx+.5,z:z+dz+.5,
      feetY:low,vy:0,grounded:true,yaw:Math.atan2(-dx,-dz),pitch:0};
     game.p=player;
     const start=totalPaint;
     fBackAt=-1000000;
     renderFallback();
     const painted=totalPaint-start;
     out.candidates++;out.painted+=painted;
     if(painted<1)out.failures++;
     out.samples.push({x,z,top:+top.toFixed(3),low:+low.toFixed(3),painted});
     if(out.candidates>=3)break outer;
     break;
    }
   }
   out.allClear=out.candidates>=1&&out.painted>=out.candidates&&out.failures===0;
  }finally{
   if(oldMethod)Object.defineProperty(context,'fillRect',oldMethod);
   else delete context.fillRect;
   game.p=oldPlayer;fBackAt=oldFrame;
   out.restored=game.p===oldPlayer&&context.fillRect===original;
  }
  return out;
 }
});

// Stage107: non-destructive audit of true bridge edges on the currently
// generated level. Real deckCells are authoritative on both render paths.
// No camera, actor, level, mission, save, or geometry mutation is performed.
Object.assign(window.__neonTest,{
 deckEdgeAudit:()=>{
  if(!game||game.state!=='playing')return null;
  const out={build:GAME_BUILD,sector:game.sector,render:glReady?'WebGL':'Canvas',
   edges:0,checks:0,failures:0,underpasses:0,examples:[]};
  const directions=[[1,0],[-1,0],[0,1],[0,-1]],r=.23;
  for(let z=2;z<mapSize-2;z++)for(let x=2;x<mapSize-2;x++){
   const h=deckAtCell(x,z);if(!(h>0)||mapCells[z][x]!==0)continue;
   for(const [dx,dz] of directions){
    if(deckAtCell(x+dx,z+dz)>0||mapCells[z+dz]?.[x+dx]!==0)continue;
    // Outside the visible slab by 0.16m: the .23m circular helmet/boots
    // genuinely overlaps by .07m. At .24m the slab must NOT be hit.
    const px=x+.5+dx*.66,pz=z+.5+dz*.66;
    const fx=x+.5+dx*.74,fz=z+.5+dz*.74;
    const under=worldDeckHeadBarrier(px,pz,r,h-.17-.15,h-.17+.15);
    const land=worldDeckFeetBarrier(px,pz,r,h+.15,h-.15);
    const rest=worldDeckStandingSupport(px,pz,r,h+.004);
    const free=worldDeckHeadBarrier(fx,fz,r,h-.17-.15,h-.17+.15);
    const freeLand=worldDeckFeetBarrier(fx,fz,r,h+.15,h-.15);
    const freeRest=worldDeckStandingSupport(fx,fz,r,h+.004);
    out.edges++;out.checks+=6;
    if(under===null||Math.abs(under-(h-.17))>.0002)out.failures++;
    if(land===null||Math.abs(land-h)>.0002)out.failures++;
    if(rest===null||Math.abs(rest-h)>.0002)out.failures++;
    if(free!==null||freeLand!==null||freeRest!==null)out.failures++;
    if(floorHeight(px,pz)+PLAYER_SOLID_HEIGHT<h-.17-.02)out.underpasses++;
    if(out.examples.length<2)out.examples.push({x,z,height:h,dx,dz});
   }
  }
  out.allClear=out.failures===0;
  return out;
 }
});

// Stage108: non-destructive real-map end-to-end entry/exit audit. The temporary
// actor is isolated; no map tiles, enemies, missions, save slots or progress are
// modified. Works in browser Canvas and WebGL with the same movement function.
Object.assign(window.__neonTest,{
 bridgeStairTransitionAudit:()=>{
  if(!game||game.state!=='playing')return null;
  const current=game.p,report={build:GAME_BUILD,sector:game.sector,
   render:glReady?'WebGL':'Canvas',candidates:0,checked:0,failures:0,
   skipped:0,restored:false,allClear:false};
  try{
   for(let z=2;z<mapSize-2;z++)for(let x=2;x<mapSize-2;x++){
    const top=deckAtCell(x,z);if(!(top>0)||mapCells[z]?.[x]!==0)continue;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
     const ax=x+dx,az=z+dz,base=floorHeightAtCell(ax,az);
     if(mapCells[az]?.[ax]!==0||deckAtCell(ax,az)>0||
        !(top-base>.001&&top-base<=.245)||base<.17)continue;
     report.candidates++;
     const p={...current,x:ax+.5,z:az+.5,feetY:base,vy:0,grounded:true,flying:false};
     if(worldSolidBodyCollision(p.x,p.z,.23,p.feetY,PLAYER_SOLID_HEIGHT)){
      report.skipped++;continue;
     }
     game.p=p;const startX=p.x,startZ=p.z;
     tryMoveEntity(p,-dx*.7,-dz*.7,.23);
     const advanced=(p.x-startX)*(-dx)+(p.z-startZ)*(-dz);
     const high=advanced>.68&&Math.abs(p.feetY-top)<.004;
     tryMoveEntity(p,dx*.7,dz*.7,.23);
     const returned=Math.abs(p.x-startX)<.004&&Math.abs(p.z-startZ)<.004&&
      Math.abs(p.feetY-base)<.004;
     report.checked++;
     if(!high||!returned)report.failures++;
    }
   }
  }finally{
   game.p=current;report.restored=game.p===current;
   report.allClear=report.failures===0&&report.restored;
  }
  return report;
 },
 terrainEdgeAudit:()=>{
  if(!game||game.state!=='playing')return null;
  const original=game.p,r=.23;
  const result={build:GAME_BUILD,sector:game.sector,render:glReady?'WebGL':'Canvas',
   high:0,low:0,footprints:0,failures:0,restored:false,allClear:false};
  try{
   for(let z=2;z<mapSize-2;z++)for(let x=2;x<mapSize-2;x++){
    const h=floorHeightAtCell(x,z);if(h<=0||mapCells[z][x]!==0)continue;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
     const ax=x+dx,az=z+dz,base=floorHeightAtCell(ax,az);
     if(mapCells[az][ax]!==0||h<=base+.001)continue;
     const edgeX=x+.5+dx*.6,edgeZ=z+.5+dz*.6;
     // At the middle of a face this circle touches exactly two cells.
     result.footprints++;
     if(Math.abs(worldTerrainFootprint(edgeX,edgeZ,r)-h)>.0001)result.failures++;
     const tall=h-base>.24501;
     if((tall?result.high:result.low)>=24||deckAtCell(x,z)||deckAtCell(ax,az))continue;
     const px=ax+.5,pz=az+.5;
     if(collide(px,pz,r)||worldSolidBodyCollision(px,pz,r,base,PLAYER_SOLID_HEIGHT))continue;
     // Separate real rail/metal obstructions from the terrain-only climb.
     if(!tall&&[.12,.24,.38].some(d=>{
      const xx=px-dx*d,zz=pz-dz*d,feet=d>.27?h:base;
      return collide(xx,zz,r)||worldSolidBodyCollision(xx,zz,r,feet,PLAYER_SOLID_HEIGHT);
     }))continue;
     const p={...original,x:px,z:pz,feetY:base,grounded:true,vy:0,flying:false};
     game.p=p;tryMoveEntity(p,-dx*.38,-dz*.38,r);
     const moved=(p.x-px)*(-dx)+(p.z-pz)*(-dz);
     if(tall){result.high++;if(moved>.2701||Math.abs(p.feetY-base)>.004)result.failures++;}
     else {result.low++;if(moved<.37||Math.abs(p.feetY-h)>.004)result.failures++;}
    }
   }
  }finally{game.p=original;result.restored=game.p===original;result.allClear=result.failures===0&&result.restored;}
  return result;
 }
});

// Stage110: deterministic browser probe of the actual built movement code.
// Isolated temporary fixture, restored synchronously before the next frame.
// The static registry path is exercised even in Canvas browsers; this is not
// a claim of GPU rendering. No save writes, world mesh changes or real actors.
Object.assign(window.__neonTest,{
 lowMetalContactAudit:()=>{
  if(mpMatch?.active||!game||game.state!=='playing')return null;
  const old={game,mapSize,mapCells,heightCells,deckCells,glReady,worldSolidGrid,
   worldSolidCount,worldSolidIndexed,worldDecorClearance,worldEquipmentIndexCache,
   queued:input.jumpQueued,held:input.jumpHeld,audio:save.settings.audio};
  const out={build:GAME_BUILD,render:glReady?'WebGL':'Canvas',checks:0,failures:[],restored:false};
  const check=(ok,label)=>{out.checks++;if(!ok)out.failures.push(label);};
  const near=(a,b)=>Math.abs(a-b)<.0001;
  const actor=(x=5.5,z=5.5,y=0,extra={})=>({...old.game.p,x,z,feetY:y,vy:0,grounded:true,flying:false,energy:100,...extra});
  const cmd={mx:0,mz:1,yaw:Math.PI/2,pitch:0,j:false,s:false,u:false,dn:false};
  try{
   mapSize=14;mapCells=Array.from({length:14},()=>Array(14).fill(0));
   heightCells=new Float32Array(196);deckCells=new Float32Array(196);
   worldDecorClearance=false;glReady=true;save.settings.audio=false;
   game={state:'playing',p:actor(),nodes:[],devices:[],enemies:[]};
   input.jumpQueued=false;input.jumpHeld=false;resetWorldSolids();
   for(const top of [.055,.12,.24]){
    resetWorldSolids();const verts=[];
    worldSolidBox(verts,6,0,5,6.1,top,6,[.4,.4,.4]);
    check(verts.length>0&&worldSolidCount===1,'closed steel '+top);
    check(worldSolidBodyCollision(5.85,5.5,.23,0,PLAYER_SOLID_HEIGHT),'full foot contact '+top);
    check(!worldSolidBodyCollision(5.76,5.5,.23,0,PLAYER_SOLID_HEIGHT),'free edge '+top);
    let p=actor();game.p=p;tryMoveEntity(p,.4,0,.23);
    check(near(p.x,5.9)&&near(p.feetY,top),'grounded step '+top);
    updateVertical(p,.016);check(near(p.feetY,top)&&p.grounded,'steady support '+top);
    tryMoveEntity(p,-.4,0,.23);check(near(p.feetY,0),'walk off '+top);
    p=actor(5.5,5.5,.01,{grounded:false,flying:true,flightUnlocked:true});game.p=p;tryMoveEntity(p,.4,0,.23);
    check(p.x<=5.771&&near(p.feetY,.01),'airborne side '+top);
    p=actor();for(let i=0;i<4;i++)mpMatchMove(p,cmd,1/30);
    check(p.x>5.85&&near(p.feetY,top),'network step '+top);
   }
   resetWorldSolids();worldSolidBox([],5,1.955,5,6,1.975,6,[.4,.4,.4]);
   let p=actor();game.p=p;input.jumpQueued=true;updateVertical(p,.016);
   check(p.feetY<=.005&&p.vy===0,'5mm ceiling jump');
   p=actor();mpMatchMove(p,{...cmd,mz:0,j:true},1/30);
   check(p.feetY<=.005&&p.vy===0,'network ceiling jump');
   resetWorldSolids();worldSolidBox([],5,2,5,6,2.01,6,[.4,.4,.4],0,[0,0,0,0,1,0]);
   check(worldSolidCount===0,'flat surface no phantom box');
   for(const isGL of [false,true]){
    glReady=isGL;game.devices=[{x:6.5,z:5.5}];
    check(worldSolidBodyCollision(6.5,5.5,.23,1.20,1.95),'equipment solid '+isGL);
    check(!worldSolidBodyCollision(6.5,5.5,.23,1.30,1.95),'equipment top '+isGL);
   }
  }finally{
   ({game,mapSize,mapCells,heightCells,deckCells,glReady,worldSolidGrid,worldSolidCount,
     worldSolidIndexed,worldDecorClearance,worldEquipmentIndexCache}=old);
   input.jumpQueued=old.queued;input.jumpHeld=old.held;save.settings.audio=old.audio;
   out.restored=game===old.game&&mapCells===old.mapCells&&glReady===old.glReady&&worldSolidGrid===old.worldSolidGrid;
   out.allClear=out.failures.length===0&&out.restored;
  }
  return out;
 }
});

// Stage112: exact short interval + human headroom on the built browser code.
// Temporary registry exercise in the Canvas browser is NOT a GPU test.
Object.assign(window.__neonTest,{
 continuousContactAudit:()=>{
  if(mpMatch?.active||!game||game.state!=='playing')return null;
  const old={game,mapSize,mapCells,heightCells,deckCells,glReady,worldSolidGrid,
   worldSolidCount,worldSolidIndexed,worldDecorClearance,worldEquipmentIndexCache,playerNavGraph};
  const result={build:GAME_BUILD,renderer:glReady?'WebGL':'Canvas',checks:0,failures:[]};
  const check=(ok,label)=>{result.checks++;if(!ok)result.failures.push(label);};
  const actor=()=>({...old.game.p,x:5.5,z:5.5,feetY:0,grounded:true,flying:false,vy:0,energy:100});
  try{
   mapSize=14;mapCells=Array.from({length:14},()=>Array(14).fill(0));
   heightCells=new Float32Array(196);deckCells=new Float32Array(196);glReady=true;worldDecorClearance=false;
   game={state:'playing',p:actor(),nodes:[],devices:[],enemies:[],nodesDestroyed:0,t:0,mission:{type:'purge'}};
   resetWorldSolids();worldSolidBox([],5.55,0,5.7299,5.552,2.2,5.76,[.4,.4,.4]);
   check(!worldSolidBodyCollision(5.5,5.5,.23,0,1.95)&&!worldSolidBodyCollision(5.6,5.5,.23,0,1.95),'endpoints clear');
   check(worldSolidBodyCollision(5.551,5.5,.23,0,1.95),'actual interval occupied');
   tryMoveEntity(game.p,.1,0,.23);check(game.p.x<5.55,'short continuous contact');
   resetWorldSolids();worldSolidBox([],5.55,0,5.73,5.552,2.2,5.76,[.4,.4,.4]);
   game.p=actor();tryMoveEntity(game.p,.1,0,.23);check(Math.abs(game.p.x-5.6)<1e-8,'tangent truly free');
   resetWorldSolids();worldSolidBox([],5.9,1.8,5,6.1,2.2,6,[.4,.4,.4]);
   check(enemyNavEdge(5,5,6,5),'scout fits');check(!playerNavEdge(5,5,6,5),'operator cannot fit');
   const guide=missionRouteTo(actor(),{x:6.5,z:5.5});check(guide.length>2,'operator detour');
   for(let i=1;i<guide.length;i++)check(playerNavEdge(Math.floor(guide[i-1].x),Math.floor(guide[i-1].z),Math.floor(guide[i].x),Math.floor(guide[i].z)),'guide physical edge');
   resetWorldSolids();worldSolidBox([],5.9,0,5.745,6.1,2.2,6,[.4,.4,.4]);
   check(!enemyNavEdge(5,5,6,5)&&playerNavEdge(5,5,6,5),'operator radius is not scout radius');
  }finally{
   ({game,mapSize,mapCells,heightCells,deckCells,glReady,worldSolidGrid,worldSolidCount,worldSolidIndexed,worldDecorClearance,worldEquipmentIndexCache,playerNavGraph}=old);
   // These two caches may have held the temporary graph. Force their ordinary
   // lazy rebuild instead of retaining synthetic geometry in live gameplay.
   enemyNavMask=null;enemyNavEdges=null;missionGuideCache=null;
   result.restored=game===old.game&&mapCells===old.mapCells&&worldSolidGrid===old.worldSolidGrid&&glReady===old.glReady;
   result.allClear=result.restored&&result.failures.length===0;
  }
  return result;
 }
});

// Stage113: built game checks, with temporary actual world collision data.
Object.assign(window.__neonTest,{
 dynamicGuidanceAudit:()=>{
  if(mpMatch?.active||!game||game.state!=='playing')return null;
  const old={game,mapSize,mapCells,heightCells,deckCells,glReady,worldSolidGrid,
   worldSolidCount,worldSolidIndexed,worldDecorClearance,worldEquipmentIndexCache,playerNavGraph,missionGuideCache,missionUpperExitCache};
  const result={build:GAME_BUILD,renderer:glReady?'WebGL':'Canvas',checks:0,failures:[]};
  const check=(ok,label)=>{result.checks++;if(!ok)result.failures.push(label);};
  const actor=()=>({...old.game.p,x:5.5,z:5.5,feetY:0,grounded:true,flying:false,vy:0,energy:100});
  try{
   mapSize=16;mapCells=Array.from({length:16},()=>Array(16).fill(0));
   heightCells=new Float32Array(256);deckCells=new Float32Array(256);glReady=true;worldDecorClearance=false;
   game={state:'playing',p:actor(),nodes:[],devices:[],enemies:[],nodesDestroyed:0,t:0,mission:{type:'purge'}};
   resetWorldSolids();worldSolidBox([],6,0,5,6.02,2.2,6,[.4,.4,.4]);
   tryMoveEntity(game.p,1,0,.23);check(game.p.x>5.7698&&game.p.x<5.77001,'accurate real steel stop');
   check(!worldSolidBodyCollision(game.p.x,game.p.z,.23,game.p.feetY,1.95),'safe final pose');
   resetWorldSolids();const a={x:5.5,z:5.5,feetY:0,id:1,type:'scout',radius:.48,maxhp:100},r=enemyCrowdRadius(a)*2-.006,
    b={...a,id:2,x:5.55,z:5.5+r-.0001};
   game.p={...actor(),x:12.5,z:12.5};game.enemies=[a,b];tryMoveEntity(a,.1,0,.23);
   check(a.x<5.55&&Math.hypot(a.x-b.x,a.z-b.z)>=r-1e-8,'dynamic short robot contact');
   game.enemies=[];game.p=actor();
   const o={x:5.55,z:6.1699,feetY:0,hp:100};mpMatchMove(game.p,{mx:0,mz:1,yaw:Math.PI/2,pitch:0,s:false,j:false},1/30,[o]);
   check(game.p.x<5.55,'PvP dynamic contact');
   resetWorldSolids();worldSolidBox([],5.84,0,5.88,5.86,2.2,5.94,[.4,.4,.4]);
   const p={...actor(),z:5.8},target={x:8.5,z:5.5};
   check(!missionRouteLink(p,{x:6.5,z:5.5,feetY:0}),'off-centre obstructed');
   const route=missionRouteTo(p,target);check(route.length>2,'safe alternative route');
   for(let i=1;i<route.length;i++)check(missionRouteLink(route[i-1],route[i]),'safe join');
   resetWorldSolids();for(let x=5;x<=7;x++)deckCells[5*mapSize+x]=2.2;
   for(let x=8;x<=14;x++)heightCells[5*mapSize+x]=Math.max(0,1.98-(x-8)*.22);
   missionGuideCache=null;playerNavGraph=null;
   const upper={...actor(),feetY:2.2},exit={x:13.5,z:5.5};
   const path=missionRouteTo(upper,exit,40);check(path.length>4&&path.some(q=>q.feetY<2.1),'upper deck exit');
   for(let i=1;i<path.length;i++)check(missionRouteLink(path[i-1],path[i]),'upper segment');
   heightCells=new Float32Array(256);missionGuideCache=null;playerNavGraph=null;
   check(missionRouteTo(upper,exit,40).length===1,'no fictitious exit');
  }finally{
   ({game,mapSize,mapCells,heightCells,deckCells,glReady,worldSolidGrid,worldSolidCount,worldSolidIndexed,worldDecorClearance,worldEquipmentIndexCache,playerNavGraph,missionGuideCache,missionUpperExitCache}=old);
   enemyNavMask=null;enemyNavEdges=null;
   result.restored=game===old.game&&mapCells===old.mapCells&&worldSolidGrid===old.worldSolidGrid&&glReady===old.glReady;
   result.allClear=result.restored&&result.failures.length===0;
  }
  return result;
 }
});

// Read-only diagnostic for the common EMI particle system.
window.__neonTest.pulseFxCount=()=>game?.particles.filter(p=>p.col?.[0]===.36&&p.col[1]===.95&&p.col[2]===1).length||0;
