
function drawMinimap(){
  const m=mm,w=m.canvas.width,h=m.canvas.height,g=game;if(!g)return;
  m.clearRect(0,0,w,h);m.fillStyle='#040c19';m.fillRect(0,0,w,h);
  const visible=miniZoom?Math.min(mapSize,25):mapSize;
  const x0=miniZoom?clamp(g.p.x-visible/2,0,mapSize-visible):0;
  const z0=miniZoom?clamp(g.p.z-visible/2,0,mapSize-visible):0;
  const scale=w/visible;
  for(let iz=0;iz<=visible;iz++)for(let ix=0;ix<=visible;ix++){
    let x=Math.floor(x0+ix),z=Math.floor(z0+iz);
    if(x>=mapSize||z>=mapSize)continue;
    const elevated=floorHeightAtCell(x,z),upper=deckAtCell(x,z);m.fillStyle=mapCells[z][x]?'#1a293b':upper>0?'#a0b5aa':elevated>1.1?'#726e62':elevated>.65?'#58666b':elevated>.22?'#314858':((x+z)%2?'#0d293d':'#143850');
    m.fillRect((x-x0)*scale,(z-z0)*scale,scale+.15,scale+.15);
  }
  m.save();m.beginPath();m.rect(0,0,w,h);m.clip();
  const plot=(x,z)=>[(x-x0)*scale,(z-z0)*scale];
  if(g.portalReady){
    const path=portalRoute(g.p,Math.ceil(mapSize*mapSize*.75));
    if(path.length>1){
      m.beginPath();path.forEach((q,i)=>{const [xx,zz]=plot(q.x,q.z);if(i===0)m.moveTo(xx,zz);else m.lineTo(xx,zz)});
      m.strokeStyle='#6afde6df';m.lineWidth=miniZoom?2.8:1.7;m.setLineDash([4,3]);m.stroke();m.setLineDash([]);
    }
  }
  // Stair access markers: entrances to the second floor are always visible.
  for(const b of bridgeSpecs){
    for(const side of [-1,1]){
      const [px,pz]=plot(b.x+side*13,b.z);
      if(px>=-6&&pz>=-6&&px<w+6&&pz<h+6){
        m.fillStyle='#ffc97d';m.beginPath();m.arc(px,pz,miniZoom?3.3:2.2,0,TAU);m.fill();
        m.strokeStyle='#ffe5a9';m.lineWidth=1;m.stroke();
      }
    }
  }
  for(const f of mapFeatures){let [x,z]=plot(f.x,f.z);if(x<-3||x>w+3||z<-3||z>h+3)continue;
    m.strokeStyle='#44f6e388';m.lineWidth=miniZoom?1.3:.95;m.beginPath();m.arc(x,z,miniZoom?3:2,0,TAU);m.stroke();
  }
  if(!g.portalReady){const wp=missionWaypoint(g),route=wp?missionRouteTo(g.p,wp,Math.ceil(mapSize*mapSize*.75)):[];
   if(route.length>1){m.beginPath();route.forEach((pt,i)=>{const [xx,zz]=plot(pt.x,pt.z);if(i)m.lineTo(xx,zz);else m.moveTo(xx,zz);});m.strokeStyle='#f8e07cca';m.lineWidth=miniZoom?2.4:1.4;m.setLineDash([3,4]);m.stroke();m.setLineDash([]);}
  }
  if(g.mission?.type==='recovery')for(const c of g.mission.caches)if(!c.got){const [x,z]=plot(c.x,c.z);const active=missionItemActive(g,c,'recovery');m.fillStyle=active?'#e5f8ff':'#687884';m.shadowColor=active?'#38dcff':'#33404b';m.shadowBlur=active?9:0;m.beginPath();m.moveTo(x,z-4.7);m.lineTo(x+4.7,z);m.lineTo(x,z+4.7);m.lineTo(x-4.7,z);m.closePath();m.fill();m.shadowBlur=0;}
  if(g.arenaEvent?.phase==='warning'){const a=g.arenaEvent;const [x,z]=plot(a.x,a.z);m.strokeStyle=a.kind==='thermal'?'#ff844f':'#73e5ff';m.lineWidth=2;m.beginPath();m.arc(x,z,a.r*scale,0,TAU);m.stroke();}
  for(const d of (g.devices||[]))if(!d.used){
    const [dx,dz]=plot(d.x,d.z),color=d.kind==='relay'&&!missionItemActive(g,d,'relay')?'#68737b':d.kind==='coil'?'#ff7257':d.kind==='relay'?'#ffe08c':d.kind==='repair'?'#71f7ad':'#78dfff';
    m.save();m.fillStyle=color;m.shadowColor=color;m.shadowBlur=miniZoom?6:3;
    m.fillRect(dx-(miniZoom?3:2),dz-(miniZoom?3:2),miniZoom?6:4,miniZoom?6:4);m.restore();
  }
  for(const n of g.nodes)if(!n.dead){const [x,z]=plot(n.x,n.z);m.fillStyle=['#ff873f','#65deff','#77ff94'][n.type];m.fillRect(x-2.4,z-2.4,4.8,4.8);}if(g.portalReady){const [x,z]=plot(portal.x,portal.z);m.shadowBlur=10;m.shadowColor='#7affef';m.fillStyle='#76ffed';m.beginPath();m.arc(x,z,miniZoom?5:3,0,TAU);m.fill();m.shadowBlur=0;}
  for(const e of g.enemies){if(e.dead)continue;const [x,z]=plot(e.x,e.z);m.fillStyle=e.boss?'#ffcf7a':e.airborne?'#73ebff':'#ff6c96';m.beginPath();m.arc(x,z,e.boss?5:e.airborne?2.8:2.1,0,TAU);m.fill();
    if(e.airborne&&e.feetY>(g.p.feetY||0)+2){m.strokeStyle='#b5fcff';m.lineWidth=1.2;m.beginPath();m.arc(x,z,miniZoom?5.0:3.9,0,TAU);m.stroke();}
    if(e.boss&&e.ultWarn>0){m.strokeStyle='#ff8748';m.lineWidth=2;m.beginPath();m.arc(x,z,5.15*scale,0,TAU);m.stroke();}
  }
  if(typeof mpMatchActors==='function')for(const other of mpMatchActors()){
   const [rx,rz]=plot(other.x,other.z);m.fillStyle='#67ebff';m.strokeStyle='#061a2a';m.lineWidth=1.2;
   m.beginPath();m.arc(rx,rz,miniZoom?4.2:3.2,0,TAU);m.fill();m.stroke();
  }
  const [x,z]=plot(g.p.x,g.p.z);
  m.save();m.translate(x,z);/* Canvas map uses +Z downward while the arrow is drawn pointing upward.
     Rotate by PI-yaw so the arrow points along the actual forward velocity:
     (sin(yaw),cos(yaw)) in map coordinates. */m.rotate(Math.PI-g.p.yaw);m.fillStyle='#eaffff';m.shadowColor='#a9ffff';m.shadowBlur=7;
  m.beginPath();m.moveTo(0,-6);m.lineTo(4,5);m.lineTo(0,2);m.lineTo(-4,5);m.closePath();m.fill();m.restore();m.restore();
  m.fillStyle='#c8f2fa';m.font='bold 13px system-ui';m.textAlign='left';m.fillText(miniZoom?'◈ РАДАР':'◈ ВЕСЬ СЕКТОР',7,15);
  $('radarLabel').textContent=(miniZoom?'КАРТА: ПРИБЛИЖЕНИЕ':'КАРТА: ВЕСЬ СЕКТОР')+(deckHeight(g.p.x,g.p.z)>0&&g.p.feetY>BRIDGE_Y-.3?' · УРОВЕНЬ 2':' · УРОВЕНЬ 1');
}
// Across a 100-level continuous run, uncapped exponential perks can trivialize
// bosses (rapid fire, stacked shield duration). Caps keep a finite power curve;
// total available picks exceed 99, so the finale never runs out of choices.
const RUN_UPGRADE_CAPS={damage:4,health:12,rapid:4,capacitor:8,armor:10,
 pierce:5,cool:6,dash:5,magnet:6,lifesteal:6,shock:5,energyshield:3,
 bullet:6,repair:12,fieldarmor:5,crit:5,walk:4,regen:8,fieldkit:6,super:4};
function pickUpgrades(){
 const owned=game?.upgrades||{};
 const pool=upgrades.filter(x=>(Number(owned[x.id])||0)<(RUN_UPGRADE_CAPS[x.id]||5));
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 return pool.slice(0,3);
}
function saveRun(){
 if(game?.preview)return false;
 // A network rehearsal never mutates the campaign checkpoint or save journal.
 if((typeof mpMatch!=='undefined'&&mpMatch?.active)||
    (typeof mpMatchStarting!=='undefined'&&mpMatchStarting))return false;
 const g=game;if(!g||g.state==='dead'||g.state==='victory')return false;
 const keys=['sectorTime','t','target','spawned','waveDelay','enemies','bullets','tracers','projectiles','burstQueue','loot','nodes','nodesDestroyed','portalReady','idCounter','combo','comboAt','helpTime','totalCredits','decals','scorch','mission','arenaEvent','devices','robotDebris'];
 const live={};for(const k of keys)live[k]=g[k];
 save.checkpoint={version:4,equipmentPhysicsVersion:1,archivePlinthVersion:1,actorRecoveryVersion:1,permanentFormula:'compound-v2',barrierFormula:'compound-v2',shieldRechargeModel:'after-duration-5s',mapSchema:(g.sector===legacyResumeSector?(legacyResumeDivisor===10?'v10':legacyResumeDivisor===12?'v12':legacyResumeDivisor===14?'v14':'v16'):'v18'),state:g.state==='upgrade'?'upgrade':'playing',sector:g.sector,player:{...g.p},permanentLevels:[...(g.appliedPerms||save.perms)],score:g.score,kills:g.kills,upgrades:{...g.upgrades},pendingUpgrade:g.pendingUpgrade||null,live};
 const ok=persist();if(!ok){saveNotice('⚠ БРАУЗЕР ЗАПРЕТИЛ СОХРАНЕНИЕ · ЭКСПОРТИРУЙ РЕЗЕРВНУЮ КОПИЮ');}return ok;
}
function restoreLiveCheckpoint(ck){
 if(!ck||ck.version<3||!ck.live)return;
 const g=game;
 // Old saves contain pass-through equipment at Stage85 coordinates. Stage86
 // generates safe, physically connected placement before loading the live
 // combat state; migrate the positions while retaining HP, usage and IDs.
 const newNodeSites=(g.nodes||[]).map(n=>({x:n.x,z:n.z}));
 const newDeviceSites=(g.devices||[]).map(d=>({x:d.x,z:d.z}));
 // Stage87 archive pedestals occupy a real ground tile. Checkpoints from
 // earlier versions may contain crystals on a bottleneck which was safe
 // before the plinth existed. Remap just positions, preserving IDs, got
 // flags and the mission's saved completion order.
 let newArchiveSites=(g.mission?.caches||[]).map(c=>({x:c.x,z:c.z}));
 // Stage98: sector 13/23/... now defaults to radio interception, but an
 // older checkpoint may still carry a recovery mission from Stage97 or
 // before. For pre-plinth saves no new archive sites are generated by
 // startMission(signal): reconstruct them against the actual NEW equipment
 // mesh before merging the old mission, preserving progress and ordering.
 if(!ck.archivePlinthVersion&&ck.live?.mission?.type==='recovery'&&
    newArchiveSites.length<(ck.live.mission.caches||[]).length&&
    typeof missionLocations==='function'){
  const oldMission=g.mission;
  try{
   g.mission={...oldMission,caches:[]};
   newArchiveSites=missionLocations(g,ck.live.mission.caches.length,'recovery')
    .map(c=>({x:c.x,z:c.z}));
  }finally{g.mission=oldMission;}
 }

 for(const [k,v] of Object.entries(ck.live)){if(Object.prototype.hasOwnProperty.call(g,k))g[k]=v;}
 if(!ck.archivePlinthVersion&&g.mission?.type==='recovery'){
  for(let i=0;i<(g.mission.caches||[]).length;i++){
   const site=newArchiveSites[i];
   if(site&&g.mission.caches[i])Object.assign(g.mission.caches[i],site);
  }
 }
 if(!ck.equipmentPhysicsVersion){
  if(Array.isArray(g.nodes))for(let i=0;i<g.nodes.length;i++){
   const site=newNodeSites[i];if(site&&g.nodes[i])Object.assign(g.nodes[i],site);
  }
  if(Array.isArray(g.devices))for(let i=0;i<g.devices.length;i++){
   const site=newDeviceSites[i];if(site&&g.devices[i])Object.assign(g.devices[i],site);
  }
 }
 enemyNavMask=null;enemyNavEdges=null;missionGuideCache=null;
 worldEquipmentIndexCache=null;
 Object.assign(g.p,ck.player||{});
 // Persistent purchases are allowed in the hangar between two sectors. A
 // snapshot of the permanent ranks actually applied to the running player
 // prevents both the "new purchase had no effect" bug and double-applying it.
 const current=[...save.perms],previous=Array.isArray(ck.permanentLevels)&&ck.permanentLevels.length>=6?
  ck.permanentLevels.map((v,i)=>clamp(Math.floor(Number(v)||0),0,PERM_MAX_LEVEL)) : null;
 if(previous){
  const diff=i=>current[i]-previous[i],p=g.p;
  // Stage24 had additive upgrades, Stage25/26 used the original compound
  // rates, and Stage27 increases five of them. Decode the checkpoint's own
  // formula before applying the new formula and any newly purchased ranks.
  const oldBase=(base,mult,lv,linear,v1=mult)=>ck.permanentFormula==='compound-v2'?
   permanentStat(base,mult,lv):ck.permanentFormula==='compound-v1'?
   permanentStat(base,v1,lv):base*(1+linear*lv);
  const oldHp=oldBase(100,PERM_COMPOUND.health,previous[0],.12,1.05),newHp=permanentStat(100,PERM_COMPOUND.health,current[0]);
  const oldEnergy=oldBase(100,PERM_COMPOUND.capacity,previous[4],.08,1.035),newEnergy=permanentStat(100,PERM_COMPOUND.capacity,current[4]);
  // Barrier changed independently in Stage26, so keep a separate marker.
  const oldBarrier=ck.barrierFormula==='compound-v2'?
   permanentStat(30,PERM_COMPOUND.barrier,previous[2]):ck.barrierFormula==='compound-v1'?
   permanentStat(30,1.085,previous[2]):30+10*previous[2];
  const newBarrier=permanentStat(30,PERM_COMPOUND.barrier,current[2]);
  const hpIncrease=newHp-oldHp,barrierIncrease=newBarrier-oldBarrier,energyIncrease=newEnergy-oldEnergy;
  // Formula replacements keep the current fill percentage. Ranks genuinely
  // bought after the checkpoint grant their extra capacity at full charge.
  const remapPool=(value,oldMaximum,newMaximum,formulaDelta,rankDelta)=>{
   const fraction=clamp((Number(value)||0)/Math.max(1,Number(oldMaximum)||1),0,1);
   return clamp((Number(value)||0)+formulaDelta*fraction+Math.max(0,rankDelta),0,newMaximum);
  };
  const hpMax=Math.max(1,Number(p.maxhp)||oldHp),energyMax=Math.max(1,Number(p.maxEnergy)||oldEnergy);
  p.maxhp=Math.max(1,hpMax+hpIncrease);
  p.hp=remapPool(p.hp,hpMax,p.maxhp,permanentStat(100,PERM_COMPOUND.health,previous[0])-oldHp,
   newHp-permanentStat(100,PERM_COMPOUND.health,previous[0]));
  p.damage*= permanentStat(1,PERM_COMPOUND.damage,current[1])/oldBase(1,PERM_COMPOUND.damage,previous[1],.08,1.04);
  const savedMax=Math.max(1,Number(p.maxArmor)||30);
  p.maxArmor=Math.max(1,savedMax+barrierIncrease);
  const sameRankBarrier=permanentStat(30,PERM_COMPOUND.barrier,previous[2]);
  p.armor=remapPool(p.armor,savedMax,p.maxArmor,sameRankBarrier-oldBarrier,newBarrier-sameRankBarrier);
  p.armorTier=clamp((p.armorTier||0)+Math.floor(current[2]/2)-Math.floor(previous[2]/2),0,4);
  p.regen*= permanentStat(16,PERM_COMPOUND.regen,current[3])/oldBase(16,PERM_COMPOUND.regen,previous[3],.125,1.03);
  p.maxEnergy=Math.max(1,energyMax+energyIncrease);
  p.energy=remapPool(p.energy,energyMax,p.maxEnergy,
   permanentStat(100,PERM_COMPOUND.capacity,previous[4])-oldEnergy,
   newEnergy-permanentStat(100,PERM_COMPOUND.capacity,previous[4]));
  p.dashRange=Math.max(DASH_DISTANCE_BASE,p.dashRange+DASH_UPGRADE_STEP*diff(5));
  // Duration also carries temporary 25% perks. Rescale only the permanent
  // component, so purchases in the hangar apply exactly once on resume.
  p.shieldDuration=(Number(p.shieldDuration)||3.5)*permanentStat(1,PERM_COMPOUND.shieldDuration,current[11])/permanentStat(1,PERM_COMPOUND.shieldDuration,previous[11]||0);
 }else{
  // Pre-stage24 checkpoints lack a rank snapshot. Conservatively fill only
  // the missing minimum derived from the purchased ranks and acquired perks.
  const p=g.p,u=g.upgrades||{};
  const newHp=permanentStat(100,PERM_COMPOUND.health,current[0])+30*(u.health||0),newBarrier=permanentStat(30,PERM_COMPOUND.barrier,current[2])+30*(u.armor||0);
  const hpAdded=Math.max(0,newHp-p.maxhp),barrierAdded=Math.max(0,newBarrier-p.maxArmor);
  p.maxhp=Math.max(p.maxhp,newHp);p.hp=Math.min(p.maxhp,p.hp+hpAdded);
  p.maxArmor=Math.max(p.maxArmor,newBarrier);p.armor=Math.min(p.maxArmor,p.armor+barrierAdded);
  p.armorTier=Math.max(p.armorTier||0,Math.min(4,Math.floor(current[2]/2)+(u.armor||0)));
  p.damage=Math.max(p.damage,permanentStat(1,PERM_COMPOUND.damage,current[1])*Math.pow(1.18,u.damage||0)*Math.pow(1.12,u.super||0));
  p.shieldDuration=permanentStat(3.5,PERM_COMPOUND.shieldDuration,current[11])*Math.pow(1.25,u.energyshield||0);
 }
 g.appliedPerms=current;
 // Legacy four-perk saves have no permanent capacity/range fields. Restoring
 // a checkpoint must not undo purchases made in the hangar since that run.
 const permanentCapacity=permanentStat(100,PERM_COMPOUND.capacity,save.perms[4]);
 if(!Number.isFinite(g.p.maxEnergy)||g.p.maxEnergy<permanentCapacity){
  const oldCapacity=Number.isFinite(g.p.maxEnergy)?g.p.maxEnergy:100;
  g.p.maxEnergy=permanentCapacity;
  g.p.energy=Math.min(g.p.maxEnergy,Math.max(0,(Number(g.p.energy)||0)+permanentCapacity-oldCapacity));
 }
 g.p.dashRange=Math.max(DASH_DISTANCE_BASE+save.perms[5]*DASH_UPGRADE_STEP,Number(g.p.dashRange)||0);
 g.p.regen=Math.max(permanentStat(16,PERM_COMPOUND.regen,save.perms[3]),Number(g.p.regen)||0);
 {const w=Number(g.p.weapon);g.p.weapon=Number.isInteger(w)&&w>=0&&w<weapons.length?w:0;}
 if(!Number.isFinite(g.p.feetY))g.p.feetY=floorHeight(g.p.x,g.p.z);
 if(!Number.isFinite(g.p.vy))g.p.vy=0;
 if(typeof g.p.grounded!=='boolean')g.p.grounded=true;
 g.p.armor=clamp(Number(g.p.armor)||0,0,g.p.maxArmor||30);
 const suit=equippedArmorStats();
 g.p.bodyArmorType=suit.id;g.p.bodyArmorMax=suit.maxDurability;g.p.bodyArmorReduction=suit.reduction;g.p.bodyArmorWear=suit.wear;
 const oldSuit=Number(ck.player?.bodyArmorType),oldMax=Number(ck.player?.bodyArmorMax);
 // Equipping a *different* newly bought suit gives its fresh durability;
 // upgrading the same suit preserves damage but grants the extra capacity.
 g.p.bodyArmor=oldSuit!==suit.id?suit.maxDurability:
  Number.isFinite(ck.player?.bodyArmor)?clamp(ck.player.bodyArmor+Math.max(0,suit.maxDurability-(Number.isFinite(oldMax)?oldMax:suit.maxDurability)),0,suit.maxDurability):suit.maxDurability;
 // Stage96: a saved position can be invalidated by newly physical metal,
 // changes in solid world geometry or a corrupt legacy checkpoint. If the
 // operator is moved back to the sector entrance, its SAVED feet altitude must
 // be reset too; keeping roof-level feet at the ground spawn can put the
 // player inside an overhead plate.
 const resetCheckpointPlayer=()=>{
  g.p.x=spawnX;g.p.z=spawnZ;g.p.feetY=floorHeight(spawnX,spawnZ);
  g.p.vy=0;g.p.grounded=true;g.p.flying=false;
 };
 if(!Number.isFinite(g.p.x)||!Number.isFinite(g.p.z)||collide(g.p.x,g.p.z,.23))
  resetCheckpointPlayer();
 // Prefer a nearby unobstructed position on the same physical support. A roof
 // and the floor beneath it are different supports even in the same (x,z).
 if(typeof worldSolidBodyCollision==='function'&&
    worldSolidBodyCollision(g.p.x,g.p.z,.23,g.p.feetY||0,PLAYER_SOLID_HEIGHT)){
  const prevX=g.p.x,prevZ=g.p.z,base=g.p.feetY||0;
  let escaped=false;
  for(const radius of [.69,.85,1.05,1.35,1.75,2.25]){
   for(let step=0;step<24;step++){
    const a=step*TAU/24,x=prevX+Math.cos(a)*radius,z=prevZ+Math.sin(a)*radius;
    const surface=supportHeight({feetY:base},x,z);
    if(collide(x,z,.23)||Math.abs(surface-base)>.245||
       worldSolidBodyCollision(x,z,.23,surface,PLAYER_SOLID_HEIGHT))continue;
    g.p.x=x;g.p.z=z;g.p.feetY=surface;g.p.vy=0;escaped=true;break;
   }
   if(escaped)break;
  }
  if(!escaped)resetCheckpointPlayer();
 }
 // A checkpoint stores live robots, not freshly spawned robots. Preserve their
 // identity, damage, attack timer, boss/elite roles and mission sentinel ID;
 // only repair impossible coordinates. All restored actors must use the SAME
 // wall, 3D hull and crowd clearances as Stage95's fresh-spawn system.
 const storedEnemies=Array.isArray(g.enemies)?g.enemies.filter(e=>e&&!e.dead):[];
 // Ancient checkpoints sometimes omit their ID counter. Never reuse a live
 // robot ID when a subsequent wave spawns (mission sentinels depend on IDs).
 g.idCounter=Math.max(0,Number(g.idCounter)||0,
  ...storedEnemies.map(e=>Number.isFinite(e?.id)?e.id:0));
 g.enemies=[]; // The placement test compares against ONLY already restored actors.
 const restoreEnemyClear=(e,x,z,feet,r,height)=>{
  if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(feet))return false;
  if(feet<floorHeight(x,z)+(e.airborne?.115:-.245))return false;
  if(e.airborne&&feet+enemyBodyHeight(e)>ceilingHeight()-.015)return false;
  // Returning melee opponents need only the real player footprint, not
  // the deliberately large distance reserved for newly spawned robots.
  return enemySpawnSpaceClear(x,z,r,height,feet,.26);
 };
 for(const e of storedEnemies){
  if(!e||typeof e!=='object')continue;
  if(!e.boss&&['drone','skyhunter','skyguard','stormray'].includes(e.type))e.airborne=true;
  const r=Math.max(enemyBodyRadius(e),enemyCrowdRadius(e),e.boss?.84:e.airborne?.66:.48);
  const height=enemyBodyHeight(e),originalX=Number.isFinite(e.x)?e.x:spawnX;
  const originalZ=Number.isFinite(e.z)?e.z:spawnZ;
  const originalFeet=Number.isFinite(e.feetY)?e.feetY:
   floorHeight(originalX,originalZ)+(e.airborne?.13:0);
  let placement=null;
  const tryPosition=(x,z,feet)=>{
   if(!restoreEnemyClear(e,x,z,feet,r,height))return false;
   placement={x,z,feetY:feet};return true;
  };
  // Most checkpoints take the zero-displacement path. A pre-Stage15 drone
  // intersecting the underside of a bridge is first lowered at the SAME spot.
  tryPosition(originalX,originalZ,originalFeet);
  const lower=floorHeight(originalX,originalZ)+(e.airborne?.13:0);
  if(!placement&&e.airborne)tryPosition(originalX,originalZ,lower);
  // Small deterministic local searches before considering the rest of the map.
  // Walking robots preserve the actual floor/deck; flyers retain altitude.
  for(const distance of [.7,1.0,1.4,1.9,2.6,3.6,5.0]){
   if(placement)break;
   for(let k=0;k<24;k++){
    const angle=(k+(Number(e.id)||0)%24)*TAU/24;
    const x=originalX+Math.cos(angle)*distance,z=originalZ+Math.sin(angle)*distance;
    const support=e.airborne?originalFeet:supportHeight({feetY:originalFeet},x,z);
    if(!e.airborne&&Math.abs(support-originalFeet)>.245)continue;
    if(tryPosition(x,z,support))break;
   }
  }
  // A crowded or now-obstructed old floor can still contain a valid location
  // farther away. Scan every actual tile deterministically, same layer first.
  for(let pass=0;pass<2&&!placement;pass++){
   for(let z=1;z<mapSize-1&&!placement;z++)for(let x=1;x<mapSize-1;x++){
    if(mapCells[z]?.[x]!==0)continue;
    const cx=x+.5,cz=z+.5;
    const feet=pass===0?(e.airborne?originalFeet:
     supportHeight({feetY:originalFeet},cx,cz)):
     floorHeight(cx,cz)+(e.airborne?.13:0);
    if(pass===0&&!e.airborne&&Math.abs(feet-originalFeet)>.245)continue;
    if(tryPosition(cx,cz,feet))break;
   }
  }
  if(placement){Object.assign(e,placement);g.enemies.push(e);continue;}
  // Never save a robot embedded in metal or invent a wall-free teleport.
  // Release the unplaceable wave slot so the normal safe-spawn retry can run.
  if(e.boss)g.spawned=0;
  else if(g.sector%5!==0)g.spawned=Math.max(0,(g.spawned|0)-1);
  if(g.mission?.sentinelId===e.id)g.mission.sentinelId=0;
  g.waveDelay=Math.min(Number(g.waveDelay)||.6,.6);
 }
 g.boss=g.enemies.find(e=>e.boss)||null;
 g.p.abilityCooldowns=g.p.abilityCooldowns||{};
 // A Stage24 snapshot may carry the obsolete E/F and dash recharge timers.
 // Never reintroduce a cooldown after importing an old save.
 g.p.abilityCooldowns.dash=0;g.p.abilityCooldowns.heal=0;g.p.abilityCooldowns.pulse=0;
 if(ck.shieldRechargeModel!=='after-duration-5s'){
  // Old saved C timers began at activation and could exceed eight seconds.
  // Convert them to five seconds AFTER the remaining active sphere ends.
  const active=Math.max(0,Number(g.p.shield)||0);
  g.p.abilityCooldowns.shield=active>0?active+5:clamp(Number(g.p.abilityCooldowns.shield)||0,0,5);
 }else{
  g.p.abilityCooldowns.shield=Math.max(0,Number(g.p.abilityCooldowns.shield)||0);
 }
 g.bullets=g.bullets||[];g.tracers=g.tracers||[];g.projectiles=g.projectiles||[];g.burstQueue=g.burstQueue||[];
 g.loot=g.loot||[];g.nodes=g.nodes||[];g.robotDebris=Array.isArray(g.robotDebris)?g.robotDebris.slice(-72):[];g.decals=g.decals||[];g.scorch=g.scorch||[];g.devices=Array.isArray(g.devices)?g.devices:[];if(!ck.live?.mission||!g.mission||!g.mission.version){g.mission={version:1,type:'purge',done:0,required:0,caches:[],hazardsHit:0,hazardsEvaded:0,sentinelId:0};}g.arenaEvent=g.arenaEvent||{phase:'quiet',countdown:14,kind:'emp',x:0,z:0,r:3.4,warning:0};g.p.armorDelay=Math.max(0,Number(g.p.armorDelay)||0);g.p.armorRegen=Math.max(0,Number(g.p.armorRegen)||2.6);
 g.p.armorDelay=0;
 g.pendingUpgrade=ck.pendingUpgrade||null;g.state=ck.state==='upgrade'?'upgrade':'playing';
 navField=null;navClock=0;portalRouteField=null;decalDirty=true;
 $('sectorText').textContent=String(g.sector).padStart(2,'0')+' · '+sectorArchitecture;
 $('gun').dataset.gun=String(g.p.weapon);$('bossWrap').style.display=g.boss?'block':'none';
}
// Auto-save during combat and on app/browser lifecycle transitions.
setInterval(()=>{if(game&&game.state!=='dead')saveRun();},2600);
addEventListener('pagehide',()=>{if(game&&game.state!=='dead')saveRun();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game&&game.state!=='dead')saveRun();});

function panel(html){
 if(typeof mpChatClose==='function'&&!html.includes('id="mpLobbyChat"'))mpChatClose(false);
 const content=$('panel');
 const buildLabel=`<div class="buildReleaseStamp" aria-label="Версия игры">NEON RIFT 3D · V${GAME_BUILD} · ${GAME_RELEASE}</div>`;
 const legacyNotice=legacyDiverged&&!game?'<div class="legacySaveWarning" role="status">⚠ Старая версия игры создала более позднее отдельное сохранение. Защищённый прогресс не перезаписан. Если нужны изменения из старой вкладки, экспортируй там JSON и импортируй сюда.</div>':'';
 // A new query-string URL forces a separate HTML cache entry. Keep the same
 // protocol/host: browser localStorage (and all purchases) is unchanged.
 // Never expose a reload link during a live run, including Pause / rewards.
 const releaseLink=!game&&typeof location!=='undefined'&&/^https?:$/.test(location.protocol)?
  `<div class="buildReleaseTools"><a href="?v=${GAME_BUILD}" class="buildReleaseLink">↻ ОТКРЫТЬ ЭТУ ВЕРСИЮ ПО НОВОЙ ССЫЛКЕ</a><small>Для следующего обновления используй ссылку с новым номером версии.</small></div>`:'';
 content.innerHTML=buildLabel+legacyNotice+html+'<div class="line"></div><div class="row"><button class="secondary" type="button" data-fs>⛶ ПОЛНЫЙ ЭКРАН</button></div>'+releaseLink;
 // Different screens must start at their own heading. Otherwise a deeply
 // scrolled campaign map can open the reward screen halfway through its cards.
 content.scrollTop=0;
 updateFullscreenButtons();$('overlay').classList.remove('hidden');$('hud').classList.remove('show');
 if(typeof mpChatRender==='function')mpChatRender();
}
