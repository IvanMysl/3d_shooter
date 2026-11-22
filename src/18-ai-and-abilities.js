
// F restores the first damaged defense in strict order: hull, physical suit,
// energy barrier. No artificial cooldown; each action is paid from energy.
function restorePriorityDefense(p){
 const stages=[
  {key:'hp',max:'maxhp',perAction:permanentStat(49,PERM_COMPOUND.repairHull,save.perms[8]),cost:50,name:'КОРПУС'},
  {key:'bodyArmor',max:'bodyArmorMax',perAction:(p.bodyArmorMax||0)*permanentStat(.07,PERM_COMPOUND.repairSuit,save.perms[9]),cost:50,name:'КОСТЮМ'},
  {key:'armor',max:'maxArmor',perAction:(p.maxArmor||0)*permanentStat(.30,PERM_COMPOUND.repairBarrier,save.perms[10]),cost:40,name:'ЭНЕРГОБАРЬЕР'}
 ];
 for(const stage of stages){
  const limit=Math.max(0,Number(p[stage.max])||0),value=clamp(Number(p[stage.key])||0,0,limit),missing=limit-value;
  if(limit<=0||missing<=1e-5)continue;
  // F is atomic: restore the full advertised action (or all missing points),
  // or restore nothing. A small final remainder costs only its actual share.
  const added=Math.min(missing,stage.perAction);
  if(added<=1e-8)return false;
  const required=added/stage.perAction*stage.cost;
  if(p.energy+1e-6<required){toast('ВОССТАНОВЛЕНИЕ · НЕДОСТАТОЧНО ЭНЕРГИИ',.8);return false;}
  p.energy=Math.max(0,p.energy-required);
  p[stage.key]=Math.min(limit,value+added);
  if(stage.key==='armor')p.armorDelay=0;
  emitRepairFx(p.x,(p.feetY||0)+.9,p.z,stage.key);
  toast('✚ '+stage.name+' +'+Math.round(added*10)/10,.65);
  return stage.key;
 }
 toast('КОРПУС, КОСТЮМ И БАРЬЕР ПОЛНЫЕ',.8);
 return false;
}
function useAbility(type){const g=game;if(!g||g.state!=='playing')return;const p=g.p;
 if(type==='heal')return restorePriorityDefense(p);
 // Q is energy-limited rather than time-limited: deliberate presses can
 // fire immediately if enough battery charge remains.
 const ABILITY_COOLDOWNS={shield:5};
 const cooldowns=p.abilityCooldowns||(p.abilityCooldowns={});
 if(type==='shield'&&((p.shield||0)>0||(cooldowns.shield||0)>0)){toast((p.shield||0)>0?'ЗАЩИТНАЯ СФЕРА УЖЕ АКТИВНА':'ПЕРЕЗАРЯДКА · '+cooldowns.shield.toFixed(1)+' с',.65);return;}
 // Starter capacity of 100 permits one 52-energy pulse, not two in a row.
 // Later energy research improves the maximum burst rate naturally.
 let costs={dash:p.dashCost,pulse:52,shield:50,heal:50},cost=costs[type];
 if(!Number.isFinite(cost))return;
 if(p.energy<cost){toast('НЕДОСТАТОЧНО ЭНЕРГИИ',.8);return}
 p.energy-=cost;
 // Five seconds of genuine recharge AFTER the sphere expires. Storing the
 // combined timer keeps the existing per-frame update and old saves simple.
 // Temporary/permanent duration perks cannot produce nonstop invulnerability.
 cooldowns[type]=type==='shield'?(p.shieldDuration||3.5)+ABILITY_COOLDOWNS.shield:0;
 if(type==='dash'){
 const mx=input.mx,mz=input.mz,s=(Math.abs(mx)+Math.abs(mz)>0?p.yaw-Math.atan2(mx,mz):p.yaw);
 // The acquired phase-radius upgrade defines the hard upper bound. The
 // chosen distance only shortens this same safe, swept horizontal dash.
 // Neither pitch nor flight altitude is changed by the ability.
 const maximum=clamp(Number(p.dashRange)||DASH_DISTANCE_BASE,DASH_DISTANCE_BASE,DASH_DISTANCE_MAX);
 const configured=save.settings?.dashDistance;
 const range=configured==null?maximum:clamp(Number(configured)||maximum,DASH_DISTANCE_MIN,maximum);
 for(let left=range;left>1e-8;left-=.21){const step=Math.min(.21,left);moveEntity(p,Math.sin(s)*step,Math.cos(s)*step,.24);}
 // Without cooldown, long invulnerability windows would be exploitable.
 // The dash is now a displacement skill with only minimal transition safety.
 p.iframes=Math.max(p.iframes,.055);emitDashFx(p.x,(p.feetY||0)+.3,p.z)
}if(type==='pulse'){
  // Same physical silhouette and cover logic as explosive weapons.
  // In particular, contact-range targets cannot accidentally fall between
  // distance-to-center and hitbox checks, and elevated decks block a wave.
  const origin=v3(p.x,(p.feetY||0)+1.10,p.z);
  const radius=permanentStat(5.8,PERM_COMPOUND.pulseRadius,save.perms[6]);
  const power=permanentStat(1,PERM_COMPOUND.pulseDamage,save.perms[7])*p.shock;
  let count=0,blocked=0;
  for(const e of [...g.enemies]){
   if(e.dead||!robotNearArea(e,origin,radius))continue;
   const body=enemyBlastSamples(e,origin);
   if(body.hullDist>radius)continue;
   const exposure=areaVisibility(origin,body.points);
   if(exposure<=0){blocked++;continue;}
   hurtEnemy(e,66*power,{penetration:.82});
   if(!e.dead)e.stun=Math.max(e.stun||0,1.8);
   count++;
  }
  for(const n of g.nodes)if(!n.dead){
   const ny=(n.feetY||floorHeight(n.x,n.z))+.95;
   if(Math.hypot(n.x-origin.x,ny-origin.y,n.z-origin.z)<=radius+n.radius
      &&areaVisibility(origin,[v3(n.x,ny,n.z)])>0)
    damagePowerNode(n,45*power);
  }
  for(const b of g.bullets){
   if(Math.hypot(b.x-origin.x,b.y-origin.y,b.z-origin.z)>radius)continue;
   if(areaVisibility(origin,[v3(b.x,b.y,b.z)])>0)b.dead=true;
  }
  emitPulseFx(origin.x,origin.y,origin.z);
  toast('ЭМИ-ВОЛНА · '+radius.toFixed(1)+' м · '+count+' ЦЕЛЕЙ'+(blocked?' · УКРЫТО '+blocked:''),1.25);
 }if(type==='shield'){p.shield=p.shieldDuration;emitShieldFx(p.x,(p.feetY||0)+1,p.z)}}
function enemyFire(e,pattern=0){
 e.attackPulse=.19;
 const g=game,p=pattern===8&&e.lockTarget?e.lockTarget:g.p;
 const dx=p.x-e.x,dz=p.z-e.z,base=Math.atan2(dx,dz);
 const count=pattern===9?3:pattern===10?2:([1,10,5,12,3,8,1,2][pattern]||1);
 const spread=pattern===2?.14:pattern===4?.08:pattern===7?.2:pattern===9?.14:pattern===10?.10:0;
 const eY=1.1+(Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z));
 const targetY=1.05+(Number.isFinite(p.feetY)?p.feetY:(Number.isFinite(p.y)?p.y:0));
 const rise=targetY-eY,horizontal=Math.hypot(dx,dz),length3=Math.hypot(horizontal,rise)||1;
 for(let i=0;i<count;i++){
  let a=base;
  if(pattern===1||pattern===3||pattern===5)a=i*TAU/count+(pattern===3?g.t*.7:pattern===5?Math.PI/8:0);
  else if(pattern===2||pattern===4||pattern===7||pattern===9||pattern===10)a=base+(i-(count-1)/2)*spread;
  let speed=(e.boss?2.7:3.0)*g.p.slowBullets;
  if(pattern===8)speed*=1.5;if(pattern===6)speed*=.56;
  if(pattern===3)speed*=.88;if(pattern===7)speed*=1.45;
  if(pattern===9)speed*=1.23;if(pattern===10)speed*=1.14;
  // Flying enemies must fire at true 3D distance. Old ground enemies retain
  // their original bounded vertical aiming to preserve their established balance.
  const vy=e.airborne?rise/length3*speed:
    (pattern===1||pattern===3||pattern===5?0:
      clamp(rise/Math.max(.4,horizontal/speed),-speed*.60,speed*.60));
  const flatSpeed=e.airborne?horizontal/length3*speed:speed;
  g.bullets.push({x:e.x,y:eY,z:e.z,vx:Math.sin(a)*flatSpeed,vy,
   vz:Math.cos(a)*flatSpeed,life:pattern===6?10:7,
   radius:pattern===6?.27:e.boss?.13:.095,
   damage:e.damage*(pattern===6?1.5:pattern===7?.8:1),from:'enemy',col:e.color});
 }
 sound(100,.09,'sawtooth',.04);
}

// Stage 8: damage, healing and targeted attacks obey the same physical cover
// as projectiles. A mere two-dimensional distance is insufficient: a handrail,
// solid cabinet or stair riser may be between two otherwise adjacent actors.
// Trace at the actual torso height to avoid casting from inside the floor.
function enemyCombatClear(e,target,fromHeight=.96,toHeight=.96){
 const a=v3(e.x,(Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z))+fromHeight,e.z);
 const b=v3(target.x,(Number.isFinite(target.feetY)?target.feetY:floorHeight(target.x,target.z))+toHeight,target.z);
 const vx=b.x-a.x,vy=b.y-a.y,vz=b.z-a.z,length=Math.hypot(vx,vy,vz);
 if(!(length>1e-6))return true;
 const hit=rayWall(a,v3(vx/length,vy/length,vz/length),length);
 return !hit||hit.t>=length-.045;
}
function enemyMeleeReach(e,p){
 return Math.abs((e.feetY||0)-(p.feetY||0))<1.2 &&
   enemyCombatClear(e,p,e.boss?1.20:.91,.95);
}
function bossGroundWaveReach(e,p){
 return enemyCombatClear(e,p,.44,.44);
}
// Airborne robots are independently simulated in all arenas. Their height is
// real physics state (not an animation-only offset), used by 3D projectiles,
// cover checks, ray hits and collision; never snap it to a ground support.
function updateFlyingRobot(e,p,dt){
 const time=Number(game?.t)||0;
 const r=enemyBodyRadius(e),height=enemyBodyHeight(e);
 const low=worldTerrainFootprint(e.x,e.z,r)+.13;
 const high=Math.max(low,ceilingHeight()-enemyBodyHeight(e)-.08);
 let feet=Number.isFinite(e.feetY)?e.feetY:low;
 feet=clamp(feet,low,high);
 const variant=e.type;
 const offset=variant==='skyguard'?2.55:variant==='stormray'?1.45:
    variant==='skyhunter'?2.05:1.35;
 const amplitude=variant==='stormray'?.72:variant==='skyhunter'?.47:.27;
 const phase=time*(variant==='stormray'?2.05:1.23)+e.id*.73;
 const target=clamp((Number.isFinite(p.feetY)?p.feetY:0)+offset+
   Math.sin(phase)*amplitude,low,high);
 const speed=variant==='stormray'?3.9:variant==='skyhunter'?3.15:
   variant==='skyguard'?2.2:2.6;
 const desired=clamp(target-feet,-speed*dt,speed*dt);
 let next=clamp(feet+desired,low,high);
 if(next>feet){
  const barrier=worldLowestContact(worldDeckHeadBarrier(e.x,e.z,r,feet+height,next+height),
   worldSolidHeadBarrier(e.x,e.z,r,feet+height,next+height));
  if(barrier!==null)next=Math.min(next,barrier-height-.018);
 }else if(next<feet){
  const barrier=worldHighestContact(worldDeckFeetBarrier(e.x,e.z,r,feet,next),
   worldSolidFeetBarrier(e.x,e.z,r,feet,next));
  if(barrier!==null)next=Math.max(next,barrier+.018);
 }
 next=worldActorVerticalLimit(e.x,e.z,feet,next,height,worldActorBlockers(e,r,false,true));
 next=clamp(next,low,high);
 if(!worldSolidBodyCollision(e.x,e.z,r,next,height))e.feetY=next;
 else e.feetY=feet;
 const blocked=target>(e.feetY||0)+.30&&desired>.001&&
   (e.feetY||0)<feet+desired*.25;
 e.airLiftBlocked=blocked?Math.min(1.6,(e.airLiftBlocked||0)+dt):
   Math.max(0,(e.airLiftBlocked||0)-dt*1.3);
 if(e.stun>0)return;

 const dx=p.x-e.x,dz=p.z-e.z,dist=Math.hypot(dx,dz)||.0001;
 const heightGap=((Number.isFinite(p.feetY)?p.feetY:0)+1.05)-(e.feetY+1.1);
 const dist3=Math.hypot(dist,heightGap);
 const heading=enemyHeading(e,p);
 let vx=0,vz=0;
 if(e.airLiftBlocked>.22 && heightGap>1.2){
  // When beneath a bridge / airborne platform, orbit *out* of its footprint
  // before trying to climb. Vertical collision still prevents clipping through.
  const awayX=-dx/dist,awayZ=-dz/dist;
  vx=awayX*.92+(-awayZ)*e.orbit*.35;
  vz=awayZ*.92+awayX*e.orbit*.35;
 }else if(dist>6.0){vx=heading.dx;vz=heading.dz;}
 else if(dist<3.2){vx=-dx/dist;vz=-dz/dist;}
 else{vx=-dz/dist*e.orbit*.66;vz=dx/dist*e.orbit*.66;}
 const mag=Math.hypot(vx,vz)||1;
 enemyMove(e,vx/mag*e.speed*dt,vz/mag*e.speed*dt,enemyBodyRadius(e));
 // Distances, cover and muzzle height are all 3D; flying enemies do not fire
 // through platforms merely because the player is nearby on the map.
 if(e.attack<=0){
  if(dist3<e.range&&enemyCombatClear(e,p,1.1,1.05)){
   enemyFire(e,variant==='skyhunter'?9:variant==='stormray'?10:0);
   e.attack=variant==='skyguard'?2.5:variant==='skyhunter'?2.18:
     variant==='stormray'?1.65:1.9;
  }else e.attack=.24;
 }
}
function updateEnemies(dt){const g=game,p=g.p;for(let e of g.enemies){if(e.dead)continue;e.spawn+=dt;e.flash=Math.max(0,e.flash-dt);e.stun=Math.max(0,e.stun-dt);
 // Elite-freezing tools should interrupt boss attacks, not lock the boss for
 // the entire encounter. Repeated cryo/ion/pulse/device hits cannot extend a
 // 0.55-s interruption; after that, the boss regains control for 2.55 s.
 if(e.boss){const now=Number(g.t)||0,windowEnd=Number(e.stunWindowEnd)||0,immuneEnd=Number(e.stunImmuneUntil)||0;
  if(now<windowEnd)e.stun=Math.min(e.stun,Math.max(0,windowEnd-now));
  else if(now<immuneEnd)e.stun=0;
  else if(e.stun>0){e.stunWindowEnd=now+.55;e.stunImmuneUntil=now+3.10;e.stun=Math.min(e.stun,.55);}
 }
 let d=distance(p,e),heading=e.airborne?{dx:0,dz:0}:enemyHeading(e,p),dx=heading.dx,dz=heading.dz;e.attack-=dt;e.trail+=dt;
 if(e.boss && !e.dead && e.hp<e.maxhp*.24){
  if(!e.phase3){e.phase3=true;e.damage*=1.12;e.ultTimer=3.3;toast('☠ ФАЗА III · УДАР ПО ПЛОЩАДИ · ПРЫГАЙ!',2.6);}
  if((e.ultWarn||0)>0){
   const prev=e.ultWarn;e.ultWarn=Math.max(0,e.ultWarn-dt);
   if(prev>0&&e.ultWarn===0){
    const near=hypot(p.x-e.x,p.z-e.z)<5.15;
    const nearHeight=Math.abs((p.feetY||0)-(e.feetY||0))<1.35;
    if(near&&nearHeight&&p.grounded&&e.stun<=0&&bossGroundWaveReach(e,p))damagePlayer(16+Math.min(22,g.sector*.45),e);
    burst(e.x,.18+(e.feetY||0),e.z,[1,.4,.12],28);
    sound(92,.32,'sawtooth',.13);
   }
  }else{
   e.ultTimer=(e.ultTimer||8.5)-dt;
   if(e.ultTimer<=0){e.ultTimer=8.5;e.ultWarn=1.85;toast('⚠ БОСС · ВОЛНА ПО ПОЛУ — ПРЫЖОК!',1.65);}
  }
 }

 if(e.telegraph>0){
  if(e.stun>0){e.telegraph=0;e.lockTarget=null;}
  else{e.telegraph-=dt;if(e.telegraph<=0&&e.lockTarget){enemyFire(e,8);e.lockTarget=null;}}
 }
 if(e.boss){if(e.hp<e.maxhp*.35&&!e.enraged){e.enraged=true;e.speed*=1.24;e.damage*=1.22;e.attack=Math.min(.3,e.attack);toast('☠ ФАЗА II · РЕЖИМ БЕШЕНСТВА',2.2);burst(e.x,1.2+(e.feetY||0),e.z,[1,.28,.42],28);}e.bossPhase+=dt;
let variant=e.variant,phase=e.bossPhase;
if(e.attack<=0&&d<19&&e.stun<=0){let attack=variant===0?(Math.floor(phase/4)%2?4:1):variant===1?(Math.floor(phase/5)%2?2:6):variant===2?2:variant===3?(Math.floor(phase/5)%2?7:5):variant===4?(Math.floor(phase/7)%2?6:2):variant===5?3:variant===6?(Math.floor(phase/5)%2?6:1):Math.floor(phase/4)%7;
enemyFire(e,attack);e.attack=attack===1||attack===3?2.8:attack===6?2.1:variant===2?1.6:1.15;
if(attack===1||attack===3)toast('⚠ РАДИАЛЬНЫЙ ЗАЛП · УКЛОНЯЙСЯ!',1.1);
if(attack===6)toast('⚠ ПЛАЗМЕННАЯ БОМБА!',1.1);
if(variant===6&&d<8){moveEntity(p,-dx*.43,-dz*.43,.25);toast('⚠ ГРАВИТАЦИОННАЯ ВОРОНКА',1)}
if(variant===0&&d>2&&Math.floor(phase/7)!==Math.floor((phase-dt)/7)){enemyMove(e,dx*1.8,dz*1.8,e.radius*.45)}
}
let summonEvery=variant===2?4.2:variant===7?4.5:variant===4?9.3:7.5;
if(phase>summonEvery&&Math.floor(phase/summonEvery)!==Math.floor((phase-dt)/summonEvery)&&g.enemies.filter(z=>!z.dead&&!z.boss).length<6){spawnEnemy(variant===2?'medic':pick(['scout','charger','shooter']),false);if(variant===2||variant===7)spawnEnemy('scout',false)}
if((d>3.5||!enemyDirectRoute(e,p))&&e.stun<=0)enemyMove(e,dx*e.speed*dt,dz*e.speed*dt,e.radius*.5);else if(d<2&&e.stun<=0)enemyMove(e,-dx*.55*dt,-dz*.55*dt,e.radius*.5);// Ranged fire and physical melee use separate cooldowns. Previously
 // e.attack was reset by each projectile volley, suppressing boss melee.
 e.meleeTimer=Math.max(0,(e.meleeTimer||0)-dt);
 if(d<1.35&&e.meleeTimer<=0&&e.stun<=0&&enemyMeleeReach(e,p)){
  damagePlayer(e.damage*.72,e);e.meleeTimer=1.65;e.attackPulse=Math.max(e.attackPulse||0,.24);
 }
 continue}
if(e.airborne){updateFlyingRobot(e,p,dt);continue;}
if(e.type==='medic'){if(e.trail>.75){e.trail=0;for(let f of g.enemies)if(!f.dead&&f!==e&&distance(e,f)<4&&enemyCombatClear(e,f,1.1,1.1))f.hp=Math.min(f.maxhp,f.hp+9)}}if(e.stun>0)continue;let chase=e.type==='scout'||e.type==='brute'||e.type==='charger'||e.type==='raider',stopDist=chase?1.1:e.type==='sniper'?8:5;if(d>stopDist||(!chase&&!enemyDirectRoute(e,p))){let mul=chase&&e.type==='charger'&&e.attack<.4?1.9:e.type==='raider'&&e.attack<.40?1.7:1;enemyMove(e,dx*e.speed*dt*mul,dz*e.speed*dt*mul,e.radius*.45)}else if(d<2.5&&!chase){enemyMove(e,-dx*e.speed*dt*.7,-dz*e.speed*dt*.7,e.radius*.45)}else if(!chase&&d<e.range&&d>3&&enemyDirectRoute(e,p)){enemyMove(e,-dz*e.orbit*e.speed*dt*.31,dx*e.orbit*e.speed*dt*.31,e.radius*.45)}if(e.attack<=0){if(chase&&d<1.55&&enemyMeleeReach(e,p)){damagePlayer(e.damage,e);e.attack=.75+(e.type==='brute'?.42:0)}else if(!chase&&d<e.range&&enemyDirectRoute(e,p)&&enemyCombatClear(e,p,1.25,1.05)){if(e.type==='sniper'){
  e.telegraph=.86;e.lockTarget={x:p.x,z:p.z,feetY:p.feetY||0};e.attack=2.9;
 }else{enemyFire(e,e.type==='artillery'?6:0);e.attack=e.type==='artillery'?3.15:e.type==='warden'?1.95:1.7}}else{e.attack=.26}}}
g.enemies=g.enemies.filter(x=>!x.dead);if(g.portalReady)return;if(g.spawned>=g.target&&g.enemies.length===0&&g.target>0)maybeFinishMission(g)}
// Robot animation rig V: movements are driven by measured locomotion rather
// than simply advancing the clock. Turn angular momentum, braking and strafing
// each have their own low-pass signals. All fields are serializable in saves.
const updateEnemiesBeforeRobotRig=updateEnemies;
updateEnemies=function(dt){
 const g=game;if(!g)return;
 const start=new Map();
 for(const e of g.enemies)if(!e.dead)start.set(e.id,[e.x,e.z]);
 updateEnemiesBeforeRobotRig(dt);
 const safeDt=Math.max(.001,Math.min(.045,dt));
 for(const e of g.enemies){
  if(e.dead)continue;
  const kind=e.boss?'boss':e.airborne?'drone':e.type,profile=robotAnimationProfile(kind);
  const from=start.get(e.id);
  const vx=from?(e.x-from[0])/safeDt:0,vz=from?(e.z-from[1])/safeDt:0;
  const speed=Math.hypot(vx,vz),prev=Number(e.robotMotion)||0;
  const motionTarget=clamp(speed/(e.boss?1.1:1.3),0,1);
  e.robotMotion=clamp(prev+(motionTarget-prev)*Math.min(1,safeDt*(motionTarget>prev?8:5)),0,1);
  if(!Number.isFinite(e.robotCycle))e.robotCycle=(e.id||0)*.67;
  // Step phase advances by traveled distance. If robot stops, feet stop.
  e.robotCycle+=speed*safeDt*profile.gait*.78;
  const desired=Math.atan2(g.p.x-e.x,g.p.z-e.z);
  if(!Number.isFinite(e.robotYaw))e.robotYaw=desired;
  if(!Number.isFinite(e.robotEyeYaw))e.robotEyeYaw=desired;
  const oldYaw=e.robotYaw;
  // Body can only turn a limited number of radians per second.
  const remaining=robotWrapAngle(desired-e.robotYaw);
  e.robotYaw+=clamp(remaining,-safeDt*profile.turn,safeDt*profile.turn);
  const yawDelta=robotWrapAngle(e.robotYaw-oldYaw)/safeDt;
  e.robotTurn=clamp((Number(e.robotTurn)||0)*.79+yawDelta*.21,-4.5,4.5);
  // Smaller optical modules acquire target faster than the armored chassis.
  e.robotEyeYaw=robotApproachAngle(e.robotEyeYaw,desired,Math.min(1,safeDt*9));
  const forward=vx*Math.sin(e.robotYaw)+vz*Math.cos(e.robotYaw);
  const lateral=vx*Math.cos(e.robotYaw)-vz*Math.sin(e.robotYaw);
  const sideTarget=clamp(lateral/Math.max(.7,speed),-1,1)*(speed>.025?1:0);
  e.robotStrafe=(Number(e.robotStrafe)||0)*Math.max(0,1-safeDt*6)+sideTarget*Math.min(1,safeDt*6);
  e.robotReverse=(Number(e.robotReverse)||0)*Math.max(0,1-safeDt*7)+(forward<-.06?1:0)*Math.min(1,safeDt*7);
  const accelerating=(motionTarget-prev)/safeDt;
  e.robotInertia=clamp((Number(e.robotInertia)||0)*Math.exp(-safeDt*8)+accelerating*safeDt*.14,-.3,.3);
  e.robotLean=clamp((-e.robotTurn*profile.lean+e.robotStrafe*profile.lean*.72)*e.robotMotion,-.24,.24);
  e.hitReact=Math.max(0,(Number(e.hitReact)||0)-safeDt);
  e.attackPulse=Math.max(0,(Number(e.attackPulse)||0)-safeDt);
  e.robotAttackState=clamp((Number(e.robotAttackState)||0)*Math.exp(-safeDt*8)+((e.telegraph||0)>0?.15:0),0,1);
  e.robotDamageHeat=Math.max(0,(Number(e.robotDamageHeat)||0)-safeDt*.5);
  // No per-frame costly meshes. On heavily damaged nearby enemies only, rare sparks.
  if(e.hp<e.maxhp*.38 && speed>=0 && Math.abs(e.x-g.p.x)+Math.abs(e.z-g.p.z)<12){
   e.robotSparkClock=(Number(e.robotSparkClock)||0)-safeDt;
   if(e.robotSparkClock<=0){
    e.robotSparkClock=.38+Math.random()*.48;
    if(g.particles.length<115){
     const angle=(Number(e.robotYaw)||0),r=e.boss?1.3:.55;
     const px=e.x+Math.sin(angle)*r*.5,pz=e.z+Math.cos(angle)*r*.5;
     const life=rand(.15,.35);
     g.particles.push({x:px,y:(Number(e.feetY)||0)+(e.boss?2.25:1.32),z:pz,vx:rand(-.5,.5),vy:rand(.6,1.8),vz:rand(-.5,.5),life,maxLife:life,col:[1,.44,.13]});
    }
   }
  }
 }
};

function updateBullets(dt){
 let g=game,p=g.p;
 for(const b of g.bullets){
  if(b.dead)continue;
  const o=v3(b.x,b.y,b.z),delta=v3(b.vx*dt,b.vy*dt,b.vz*dt);
  const length=Math.hypot(delta.x,delta.y,delta.z);
  if(length>1e-8){
   const d=v3(delta.x/length,delta.y/length,delta.z/length);
   const solid=sweepWorldSphere(o,d,length,b.radius||0);
   // A standing player's torso is an ellipsoid, with a true segment hit.
   const body=rayEllipsoid(o,d,v3(p.x,(p.feetY||0)+1.03,p.z),.42+b.radius,.89+b.radius,.42+b.radius,length);
   if(body!==null&&(!solid||body<solid.t)){
    b.x=o.x+d.x*body;b.y=o.y+d.y*body;b.z=o.z+d.z*body;
    damagePlayer(b.damage,b);b.dead=true;burst(b.x,b.y,b.z,b.col,7);
   }else if(solid){
    b.x=solid.x;b.y=solid.y;b.z=solid.z;b.dead=true;burst(b.x,b.y,b.z,b.col,4);
   }else{b.x+=delta.x;b.y+=delta.y;b.z+=delta.z;}
  }
  b.life-=dt;
 }
 g.bullets=g.bullets.filter(b=>!b.dead&&b.life>0);
 for(const e of g.loot){
  e.life-=dt;
  if(!worldLootPickupClear(p,e))continue;
  e.life=0;
  if(e.type==='heal')p.hp=Math.min(p.maxhp,p.hp+23);
  if(e.type==='energy')p.energy=Math.min(p.maxEnergy,p.energy+29);
  if(e.type==='plates'){
   p.armor=Math.min(p.maxArmor,p.armor+22);
   p.bodyArmor=Math.min(p.bodyArmorMax||0,(p.bodyArmor||0)+(p.bodyArmorMax||0)*.06);
   toast('БРОНЕПЛАСТИНЫ · БАРЬЕР + РЕМОНТ КОСТЮМА',1.2);
  }
  if(e.type==='credits'){save.credits+=8+Math.ceil(g.sector*.5);g.totalCredits+=8+Math.ceil(g.sector*.5);}
  sound(560,.08,'sine',.07);
 }
 g.loot=g.loot.filter(x=>x.life>0);
 advanceSharedWorldFx(g,dt);
}
