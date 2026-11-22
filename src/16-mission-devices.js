
// Interactive mechanisms are native game-state data (saved with the encounter).
//  - repair/battery = one-off support; relay = mission objective;
//  - coil = pulsing area-denial emitter which can be disarmed by standing near it.
function initDevices(g){
 g.devices=[];
 const relay=g.mission?.type==='relay';
 const wanted=relay?7:g.sector>=3?6:3;
 const loc=missionLocations(g,wanted,relay?'relay':'support');
 let madeRelays=0;
 for(let i=0;i<loc.length;i++){
  const p=loc[i];
  let kind;
  if(relay&&madeRelays<2){kind='relay';madeRelays++;}
  else if(g.sector>=3&&i%3===0)kind='coil';
  else kind=i%2===0?'repair':'battery';
  g.devices.push({id:i+1,x:p.x,z:p.z,kind,used:false,charge:0,phase:i*2.31,
    cooldown:0,cycles:0});
 }
 enemyNavMask=null;enemyNavEdges=null;missionGuideCache=null;
 if(relay){g.mission.required=madeRelays;missionPlanOrder(g,g.devices.filter(d=>d.kind==='relay'));}
 // Two more operation families use only physically reachable existing metal
 // stations; no newly decorative or invisible objectives are generated.
 if(g.mission?.type==='signal'){
  const stations=g.devices.filter(d=>d.kind==='battery').slice(0,2);
  const m=g.mission;m.signalIds=stations.map(d=>d.id);m.signalRequired=stations.length;
  m.required=m.signalRequired+1;missionRefreshCombinedProgress(m);
 }
 if(g.mission?.type==='surge'){
  const stations=g.devices.filter(d=>d.kind==='battery').slice(0,1);
  const m=g.mission;m.surgeIds=stations.map(d=>d.id);m.surgeRequired=stations.length;
  if(!stations.length)m.surgeReady=true; // rare cramped stage: no impossible prerequisite
  m.required=m.nodesRequired+m.surgeRequired;missionRefreshCombinedProgress(m);
 }
 if(g.mission?.type==='conduit'){
  // These are the ACTUAL metal/active coil housings, with the same physical
  // contact checks as optional disarming. On a cramped legacy arena, reduce
  // the quota to the number of physically placeable coils, never soft-lock.
  const coils=g.devices.filter(d=>d.kind==='coil').slice(0,2);
  g.mission.coilIds=coils.map(d=>d.id);g.mission.coilsRequired=coils.length;
  g.mission.required=g.mission.coilsRequired+g.mission.nodesRequired;
 }

}
function deviceColor(d){return d.kind==='relay'?[.99,.76,.34]:d.kind==='repair'?[.34,1,.64]:d.kind==='coil'?[1,.35,.21]:[.3,.84,1];}
function completeDevice(g,d){
 if(d.used)return;
 d.used=true;d.charge=0;d.cooldown=0;
 const p=g.p,quality=(p.devicePower||1);
 if(d.kind==='relay'){
  g.mission.done=Math.min(g.mission.required,g.mission.done+1);g.score+=260;
  toast('⌁ РЕТРАНСЛЯТОР АКТИВИРОВАН · '+g.mission.done+'/'+g.mission.required,2);
 }else if(d.kind==='repair'){
  p.hp=Math.min(p.maxhp,p.hp+35*quality);
  p.armor=Math.min(p.maxArmor,p.armor+22*quality);
  // Repair the *physical* suit as well as the renewable energy barrier.
  // This is the player's deliberate, map-limited way to rescue a worn suit.
  p.bodyArmor=Math.min(p.bodyArmorMax||0,(p.bodyArmor||0)+(p.bodyArmorMax||0)*.18*quality);
  g.score+=85;
  toast('✚ РЕМОНТ · КОРПУС, ЭНЕРГОБАРЬЕР И КОСТЮМ',1.6);
 }else if(d.kind==='battery'){
  p.energy=Math.min(p.maxEnergy,p.energy+55*quality);p.heat=0;p.heatLock=0;
  const m=g.mission,scan= m?.type==='signal'&&(m.signalIds||[]).includes(d.id),
   surge=m?.type==='surge'&&(m.surgeIds||[]).includes(d.id);
  // Recharging the same resonance station after a timed failure must not
  // become an infinite score exploit. The first use rewards normally.
  const repeat=surge&&(m.surgeActivations||0)>0;
  if(!repeat)g.score+=85;
  if(scan){m.signalDone=Math.min(m.signalRequired,(m.signalDone||0)+1);
   missionRefreshCombinedProgress(m);
   toast('⌁ ПЕРЕХВАТ СИГНАЛА '+m.signalDone+'/'+m.signalRequired,1.5);
  }else if(surge){
   m.surgeReady=true;m.surgeRemaining=Math.min(26,17+g.sector*.08);m.surgeActivations++;
   missionRefreshCombinedProgress(m);
   toast('ϟ ПЕРЕГРУЗКА ЗАПУЩЕНА · '+Math.ceil(m.surgeRemaining)+' СЕКУНД',1.6);
  }else toast('ϟ ЭНЕРГОСТАНЦИЯ · ЗАРЯД И ОХЛАЖДЕНИЕ',1.5);
 }else if(d.kind==='coil'){
  g.score+=160;save.credits+=3;
  const m=g.mission;
  if(m?.type==='conduit'&&(m.coilIds||[]).includes(d.id)){
   m.coilsDisabled=Math.min(m.coilsRequired,(m.coilsDisabled||0)+1);
   // Reactor kills made BEFORE disarming must not soft-lock stage 2.
   m.done=m.coilsDisabled+(m.coilsDisabled>=m.coilsRequired?
    Math.min(m.nodesDisabled||0,m.nodesRequired||0):0);
   toast('ϟ КОНТУР ОБЕСТОЧЕН '+m.coilsDisabled+'/'+m.coilsRequired,1.7);
  }else toast('✓ ИМПУЛЬСНЫЙ ИЗЛУЧАТЕЛЬ ОТКЛЮЧЁН',1.5);
 }
 burst(d.x,.55+floorHeight(d.x,d.z),d.z,deviceColor(d),19);
 sound(d.kind==='coil'?210:650,.17,'triangle',.11);
 saveRun();
 maybeFinishMission(g);
}
function updateDevices(dt){
 const g=game;if(!g||g.state!=='playing')return;
 const p=g.p;
 for(const d of (g.devices||[])){
  if(d.used)continue;
  // The dormant relay has no interaction charge until the preceding stage.
  // Its visible metal chassis stays physically solid even when inactive.
  if(d.kind==='relay'&&!missionItemActive(g,d,'relay')){d.charge=0;continue;}
  const dist=distance(p,d);
  const y=floorHeight(d.x,d.z);
  const sameFloor=Math.abs((p.feetY||0)-y)<1.2;
  // Steel rails and walls are meaningful gameplay cover, not transparent
  // activation shortcuts. Cache the clearance once per device per tick.
  const canInteract=dist<1.25&&sameFloor&&missionInteractionClear(p,d,'device');
  if(d.kind==='coil'){
   // 1.7 s warning, 2.3 s danger, 2.7 s cooldown. Jumping clears the ground pulse.
   const cycle=(g.t+d.phase)%6.7;
   const active=cycle>=1.7&&cycle<4.0;
   d.active=active;
   d.cooldown=Math.max(0,(d.cooldown||0)-dt);
   if(active&&d.cooldown<=0&&dist<2.15&&sameFloor&&p.grounded&&p.shield<=0){
    const exposure=missionCoilPulseExposure(d,p);
    if(exposure>0){damagePlayer((7+Math.min(14,g.sector*.28))*exposure,d);d.cooldown=1.35;}
   }
   // Safely disarm at the emitter by remaining next to it briefly.
   d.charge=canInteract&&dist<1.12?Math.min(1.2,d.charge+dt):Math.max(0,d.charge-dt*.75);
   if(d.charge>=1.1){completeDevice(g,d);continue;}
  }else{
   d.charge=canInteract?Math.min(1.1,d.charge+dt):Math.max(0,d.charge-dt*.70);
   if(d.charge>=(d.kind==='relay'?.82:(g.mission?.type==='signal'&&(g.mission.signalIds||[]).includes(d.id))?1.02:.48))completeDevice(g,d);
  }
 }
}
function drawDevices(g){
 if(!glReady||!g?.devices)return;
 const low=save.settings.quality===0;
 for(const d of g.devices){
  if(distance(g.p,d)>24)continue;
  const ground=floorHeight(d.x,d.z),active=missionItemActive(g,d,'relay'),c=d.kind==='relay'&&!active?[.34,.40,.43]:deviceColor(d),off=d.used;
  const shell=[.13,.18,.22],steel=[.33,.38,.41],dark=[.045,.067,.084];
  draw(geom.bevel,d.x,ground+.24,d.z,.72,.40,.72,0,shell,0);
  draw(geom.cylinder,d.x,ground+.58,d.z,.39,.45,.39,0,steel,.01);
  draw(geom.pylon,d.x,ground+.96,d.z,.24,.54,.24,0,shell,0);
  draw(geom.cube,d.x,ground+1.23,d.z,.47,.13,.47,0,dark,.01);
  if(!off){
   draw(geom.octa,d.x,ground+1.14+Math.sin(g.t*2+d.phase)*.05,d.z,.22,.31,.22,g.t*.55,c,1.7);
   draw(geom.ring,d.x,ground+.13,d.z,.68,.045,.68,g.t*.55,c,.48);
   if(!low&&d.charge>0)draw(geom.ring,d.x,ground+1.08,d.z,.55,.55,.55,g.t*1.1,c,1.05);
   if(d.kind==='coil'){
    const r=2.15;
    const isActive=d.active;
    draw(geom.ring,d.x,ground+.055,d.z,r*2,.045,r*2,g.t*.27,isActive?[1,.30,.18]:[1,.61,.18],isActive?1.1:.31);
    if(!low&&isActive)draw(geom.ring,d.x,ground+.11,d.z,r*1.2,.025,r*1.2,-g.t*.32,c,.42);
   }
  }else{
   draw(geom.cube,d.x,ground+1.20,d.z,.22,.03,.22,0,[.13,.29,.24],.05);
  }
 }
}
function spawnPowerNodes(level){
 if(!game)return;
 const n=Math.min(6,3+Math.floor(level/5));
 // Static reactor bases are solid-looking world equipment. Choose genuine
 // collision-free, ground-reachable sites; do not hide a required sabotage
 // target behind a wall, balcony rail, or disconnected stair landing.
 const loc=missionLocations(game,n,'power');
 const hp=39+level*6;
 game.nodes=loc.map((p,i)=>({x:p.x,z:p.z,type:i%3,hp,maxhp:hp,
  dead:false,flash:0,phase:((level*31+i*17)%71)/71*TAU,radius:.61}));
 enemyNavMask=null;enemyNavEdges=null;missionGuideCache=null;
}

function rayNode(o,d,maxDist,assist=0){
 if(!game)return null;let result=null,best=maxDist;
 for(const node of game.nodes){
  if(node.dead)continue;
  const ox=o.x-node.x,oy=o.y-(1.3+floorHeight(node.x,node.z)),oz=o.z-node.z;
  const radius=node.radius+Math.max(0,assist);
  const b=ox*d.x+oy*d.y+oz*d.z,c=ox*ox+oy*oy+oz*oz-radius*radius,disc=b*b-c;
  if(disc<0)continue;
  const t=c<=0?.001:-b-Math.sqrt(disc);
  if(t<0||t>=best)continue;best=t;
  result={kind:'node',node,t,x:o.x+d.x*t,y:o.y+d.y*t,z:o.z+d.z*t,nx:(o.x+d.x*t-node.x)/radius,ny:(o.y+d.y*t-1.3-floorHeight(node.x,node.z))/radius,nz:(o.z+d.z*t-node.z)/radius};
 }
 return result;
}
function damagePowerNode(node,amount,depth=0){
 if(!node||node.dead||!game)return false;
 node.hp-=amount;node.flash=.19;
 if(node.hp>0){sound(400,.045,'triangle',.033);return false;}
 node.dead=true;
 // A destroyed metal housing is removed from robot navigation and collision.
 enemyNavMask=null;enemyNavEdges=null;
 const g=game,kind=NODE_TYPES[node.type];g.nodesDestroyed++;
 const m=g.mission;
 if(m?.type==='sabotage'&&node.type!==2&&m.done<m.required){
  m.done++;toast('ϟ ЭНЕРГОУЗЕЛ ОТКЛЮЧЁН · '+m.done+'/'+m.required,1.5);
 }else if((m?.type==='containment'||m?.type==='conduit'||m?.type==='surge')&&node.type!==2){
  m.nodesDisabled=Math.min(m.nodesRequired,(m.nodesDisabled||0)+1);
  m.done=m.type==='containment'?m.nodesDisabled:
   m.type==='surge'?(missionRefreshCombinedProgress(m),m.done):
   (m.coilsDisabled||0)+((m.coilsDisabled||0)>=(m.coilsRequired||0)?m.nodesDisabled:0);
  toast('ϟ РЕАКТОР ОТКЛЮЧЁН · '+m.nodesDisabled+'/'+m.nodesRequired,1.5);
 }
 g.score+=125+g.sector*12;
 const center={x:node.x,y:floorHeight(node.x,node.z)+1.3,z:node.z};
 g.impactFx.push({...center,life:.66,maxLife:.66,r:kind.radius*.9,col:kind.color,explosion:true});
 burst(node.x,1.2,node.z,kind.color,save.settings.quality===0?22:42);
 g.scorch.push({x:node.x,z:node.z,life:30,r:kind.radius*.57});if(g.scorch.length>32)g.scorch.shift();
 if(node.type===2){
  for(const [type,dx,dz] of [['heal',.3,0],['energy',-.3,0],['credits',.7,-.3],['plates',-.55,.35]]){
   const drop=worldLootSpawn(node,type,25,dx,dz);if(drop)g.loot.push(drop);
  }
  toast('✚ КОНТЕЙНЕР ОТКРЫТ · СОБЕРИ РЕСУРСЫ',1.35);
 }else{
  const r=kind.radius;
  // The reactor blast is a real 3D effect: solid cover and a different
  // altitude shield the target. Reuse the same robot hull/cover sampler that
  // already protects targets from rockets and the player's EMP burst.
  for(const e of [...g.enemies])if(!e.dead&&robotNearArea(e,center,r)){
   const body=enemyBlastSamples(e,center);
   if(body.hullDist>r+e.radius)continue;
   // Unlike the legacy rocket end tolerance, a thin metal wall just
   // in front of a robot accessory still blocks an environmental blast.
   const exposure=body.points.reduce((count,point)=>
    count+Number(missionHazardRayClear(center,point)),0)/body.points.length;
   if(exposure<=0)continue;
   const dist=Math.hypot(e.x-node.x,e.z-node.z,
    (Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z))+1.0-center.y);
   hurtEnemy(e,(node.type===0?115:56)*(1-.45*Math.min(1,dist/r))*exposure);
   if(node.type===1)e.stun=Math.max(e.stun,2.7*exposure);
  }
  const pd=Math.hypot(g.p.x-node.x,g.p.z-node.z,
   (Number.isFinite(g.p.feetY)?g.p.feetY:floorHeight(g.p.x,g.p.z))+.9-center.y);
  if(node.type===0&&pd<r*.55){
   const exposure=missionHazardPlayerExposure(center,g.p);
   if(exposure>0)damagePlayer(12*(1-pd/(r*.75))*exposure);
  }
  if(depth<3)for(const other of g.nodes)if(!other.dead){
   const y=floorHeight(other.x,other.z)+.95;
   const dist=Math.hypot(other.x-node.x,y-center.y,other.z-node.z);
   if(dist<r*1.15&&missionHazardRayClear(center,{x:other.x,y,z:other.z},other))
    damagePowerNode(other,other.hp+1,depth+1);
  }
  toast(node.type===0?'✹ ТЕРМОРЕАКТОР ВЗОРВАН':'ϟ ЭМИ-ИМПУЛЬС · ВРАГИ ОГЛУШЕНЫ',1.3);
 }
 sound(node.type===0?85:node.type===1?160:550,.31,'sawtooth',.12);
 maybeFinishMission(g);saveRun();return true;
}
