
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
 requestAnimationFrame(frame);
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
 if(state==='playing')update(dt);
 const willDraw=shouldRenderFpsFrame(elapsedMs,cap);
 if(game&&willDraw){
  render();
  if(state==='playing'&&game?.state==='playing'){fpsSamples++;framesRenderedTotal++;}
 }
 if(state==='playing'){
  uiTick+=dt;
  if(uiTick>.08){uiTick=0;updateHud();}
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
 setBossPhase3:()=>{if(!game)return false;if(!game.boss)spawnEnemy('boss',true);game.boss.hp=game.boss.maxhp*.18;updateEnemies(.016);return true},
 simulateJump:()=>{queueJump();return game?.p.grounded},
 completeHoldout:()=>{if(game?.mission?.type!=='holdout')return false;game.mission.surviveRemaining=0;maybeFinishMission(game);return game.portalReady},
 mapNames:()=>sectorArchitecture
};
window.__neonMissionTest={current:()=>game&&({sector:game.sector,mission:game.mission,portal:game.portalReady,spawned:game.spawned,target:game.target,enemies:game.enemies.length,event:game.arenaEvent}),forceClear:()=>{if(!game)return false;game.spawned=game.target;game.enemies=[];if(game.mission){game.mission.done=game.mission.required;for(const c of game.mission.caches)c.got=true;}maybeFinishMission(game);return game.portalReady},defeatEnemiesOnly:()=>{if(!game)return false;game.spawned=game.target;game.enemies=[];return maybeFinishMission(game)},missionTick:(dt=.016)=>updateMission(dt),collectOneCache:(i=0)=>{if(!game?.mission?.caches?.[i])return false;const c=game.mission.caches[i];game.p.x=c.x;game.p.z=c.z;game.p.feetY=floorHeight(c.x,c.z);updateMission(.016);return c.got;},selectStage:(n)=>{save.campaign.highestUnlocked=Math.max(save.campaign.highestUnlocked,n);startGame(false,n);},killCommander:()=>{if(!game?.mission)return;game.mission.done=1;maybeFinishMission(game)},collectAll:()=>{if(!game?.mission)return;for(const c of game.mission.caches)c.got=true;game.mission.done=game.mission.required;maybeFinishMission(game);},nextEvent:()=>{if(game?.arenaEvent){game.arenaEvent.phase='quiet';game.arenaEvent.countdown=.01;}},missionFor:missionType,checkpoint:()=>save.checkpoint};
window.__neonTest={debugDrone:()=>{if(!game)return null;const e=spawnEnemy('drone',false);e.x=game.p.x+5;e.z=game.p.z+4;e.feetY=floorHeight(e.x,e.z)+.8;return {type:e.type,y:e.feetY,hp:e.hp};},debugEnemyClimb:(frames=560)=>{if(!game||!bridgeSpecs.length)return null;const c=Math.floor(mapSize/2);game.p.x=c+.5;game.p.z=c+.5;game.p.feetY=BRIDGE_Y;game.p.vy=0;game.p.grounded=true;game.p.iframes=9999;game.spawned=game.target;game.enemies=[];const e=spawnEnemy('charger',false);e.x=c+14.5;e.z=c+.5;e.feetY=0;e.speed=2.8;e.attack=999;const samples=[];for(let k=0;k<frames;k++){updateEnemies(.016);if(k%45===0)samples.push([k,+e.x.toFixed(2),+e.feetY.toFixed(2)]);}return {enemy:{x:e.x,z:e.z,feetY:e.feetY},samples};},debugStart:()=>startGame(false),debugSector:(n)=>{if(!game)startGame(false);game.sector=n;enterSector(n);return {sector:game.sector,style:sectorStyle,architecture:sectorArchitecture};},debugUnder:()=>{if(!game||!bridgeSpecs.length)return null;const c=Math.floor(mapSize/2);game.p.x=c+.5;game.p.z=c+.5;game.p.feetY=0;game.p.vy=0;game.p.grounded=true;updateVertical(game.p,.016);return {surface:supportHeight(game.p,game.p.x,game.p.z),floor:floorHeight(game.p.x,game.p.z),deck:deckHeight(game.p.x,game.p.z),feet:game.p.feetY};},debugTop:()=>{if(!game||!bridgeSpecs.length)return null;const c=Math.floor(mapSize/2);game.p.x=c+.5;game.p.z=c+.5;game.p.feetY=BRIDGE_Y;game.p.vy=0;game.p.grounded=true;updateVertical(game.p,.016);return {surface:supportHeight(game.p,game.p.x,game.p.z),floor:floorHeight(game.p.x,game.p.z),deck:deckHeight(game.p.x,game.p.z),feet:game.p.feetY};},debugTraverse:(frames=360)=>{if(!game||!bridgeSpecs.length)return null;const c=Math.floor(mapSize/2),p=game.p;p.x=c+14.5;p.z=c+.5;p.feetY=0;p.vy=0;p.grounded=true;p.yaw=-Math.PI/2;game.waveDelay=1e6;input.keys.KeyW=true;const samples=[];for(let k=0;k<frames&&game.state==='playing';k++){update(.016);if(k%30===0)samples.push([k,p.x,p.feetY]);}input.keys.KeyW=false;return {x:p.x,z:p.z,y:p.feetY,grounded:p.grounded,samples};},debugDrop:(frames=190)=>{if(!game||!bridgeSpecs.length)return null;const c=Math.floor(mapSize/2),p=game.p;p.x=c+.5;p.z=c+.5;p.feetY=BRIDGE_Y;p.vy=0;p.grounded=true;p.yaw=0;game.waveDelay=1e6;input.keys.KeyW=true;const samples=[];for(let k=0;k<frames&&game.state==='playing';k++){update(.016);if(k%30===0)samples.push([k,p.z,p.feetY]);}input.keys.KeyW=false;return {z:p.z,y:p.feetY,grounded:p.grounded,samples};},debugLevelInfo:()=>({sector:game?.sector,player:game?{x:game.p.x,z:game.p.z,y:game.p.feetY,armor:game.p.armor}:null,mapSchema:save.checkpoint?.mapSchema}),bridge:()=>({specs:bridgeSpecs.map(x=>({...x})),cells:Array.from(deckCells).filter(x=>x>0).length,ceiling:ceilingHeight()}),bridgeAt:deckHeight,teleportBridge:()=>{if(!game||!bridgeSpecs.length)return false;const c=Math.floor(mapSize/2);game.p.x=c+.5;game.p.z=c+.5;game.p.feetY=BRIDGE_Y;game.p.vy=0;game.p.grounded=true;saveRun();return true;},vertical:()=>game?{feetY:game.p.feetY,vy:game.p.vy,grounded:game.p.grounded,ground:floorHeight(game.p.x,game.p.z),stages:stairStages.length,steps:[...new Set(Array.from(heightCells).map(h=>h.toFixed(2)))].sort()}:null,jump:queueJump,stairStages:()=>stairStages.map(s=>({...s})),groundHeight:floorHeight,setYaw:(a)=>{if(game)game.p.yaw=a;},playerPos:()=>game?{x:game.p.x,z:game.p.z,yaw:game.p.yaw}:null,currentStyle:()=>({sector:game?.sector,style:sectorStyle,arch:sectorArchitecture,themes:themes.length}),setDamage:(v=22)=>{if(game){game.p.armorDelay=0;game.p.armor=Math.max(0,game.p.armor-v);}},saveNow:()=>saveRun(),saveSummary:()=>({available:storageAvailable,snapshot:save.checkpoint&&{version:save.checkpoint.version,sector:save.checkpoint.sector,state:save.checkpoint.state,spawned:save.checkpoint.live?.spawned,player:save.checkpoint.player},credits:save.credits,kills:save.kills}),setPosition:(x,z)=>{if(game&&!collide(x,z,.22)){game.p.x=x;game.p.z=z;game.p.feetY=floorHeight(x,z);game.p.vy=0;game.p.grounded=true;saveRun();return true;}return false;},debugBuild:(n)=>{buildMap(n);if(game){game.p.x=spawnX;game.p.z=spawnZ;}},debugPortalReady:()=>{if(game)game.portalReady=true;},route:()=>game?.portalReady?portalRoute(game.p,500):[],mapInfo:()=>({mapCells:mapCells.map(row=>row.slice()),spawn:[spawnX,spawnZ],portal:[portal.x,portal.z],features:mapFeatures.map(f=>({x:f.x,z:f.z})),arch:sectorArchitecture,style:sectorStyle,size:mapSize,rooms:mapRooms.length,meshes:meshStats,webgl:glReady}),getState:()=>game&&({state:game.state,sector:game.sector,enemies:game.enemies.length,kills:game.kills,spawned:game.spawned,portalReady:game.portalReady,hp:game.p.hp,score:game.score,weapon:game.p.weapon,shots:game.p.shots,yaw:game.p.yaw,pitch:game.p.pitch}),nextSector:()=>{if(game){game.portalReady=true;game.p.x=portal.x;game.p.z=portal.z;portalNext()}},fire:shoot,weaponSelect:to=>switchWeapon(to),weaponList:()=>weapons.map(w=>({name:w.name,mode:w.mode,shots:w.shots})),nodes:()=>game?.nodes.map(n=>({x:n.x,z:n.z,type:n.type,hp:n.hp,dead:n.dead})),testAimNode:(i=0)=>{if(!game)return false;const n=game.nodes[i];if(!n||n.dead)return false;let p=game.p;const offsets=[[2,0],[-2,0],[0,2],[0,-2]];let pos=offsets.map(([x,z])=>({x:n.x+x,z:n.z+z})).find(q=>!collide(q.x,q.z,.24)&&lineClear(q.x,q.z,n.x,n.z));if(!pos)return false;p.x=pos.x;p.z=pos.z;p.yaw=Math.atan2(n.x-p.x,n.z-p.z);p.pitch=Math.atan2(1.3-1.47,hypot(n.x-p.x,n.z-p.z));return true;},damageNode:(i,d)=>game&&damagePowerNode(game.nodes[i],d),arsenal:()=>({opened:arsenalOpened,items:$('weaponDrawer').querySelectorAll('[data-wpn]').length}),effectCounts:()=>game&&({decals:game.decals.length,projectiles:game.projectiles.length,impacts:game.impactFx.length,tracers:game.tracers.length,scorch:game.scorch.length}),testAimWall:()=>{if(!game)return;const p=game.p;for(let i=0;i<48;i++){let a=TAU*i/48;const wall=rayWall({x:p.x,y:1.47,z:p.z},{x:Math.sin(a),y:0,z:Math.cos(a)},36);if(wall&&wall.t>1&&wall.t<34){p.yaw=a;p.pitch=0;return wall;}}},killAll:()=>{if(game){game.spawned=game.target;for(const e of [...game.enemies]){e.dead=true;awardKill(e)}game.enemies=[];game.portalReady=true}},boss:()=>{if(game){spawnEnemy('boss',true)}},campaign:()=>({...save.campaign}),campaignMap:()=>showCampaignMap(),campaignStart:(n)=>startGame(false,n),campaignClear:()=>{if(game){game.spawned=game.target;game.enemies=[];game.portalReady=true;portalNext();}},campaignPage:(p)=>showCampaignMap(p)};