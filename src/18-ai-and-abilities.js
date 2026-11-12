
function useAbility(type){const g=game;if(!g||g.state!=='playing')return;const p=g.p;let costs={dash:p.dashCost,pulse:38,shield:43,heal:50},cost=costs[type];if(p.energy<cost){toast('НЕДОСТАТОЧНО ЭНЕРГИИ',.8);return}if(type==='heal'&&p.hp>=p.maxhp-3)return;p.energy-=cost;if(type==='dash'){const mx=input.mx,mz=input.mz,dy=Math.cos(p.yaw),dx=Math.sin(p.yaw),s=(Math.abs(mx)+Math.abs(mz)>0?p.yaw-Math.atan2(mx,mz):p.yaw);for(let k=0;k<12;k++)moveEntity(p,Math.sin(s)*.21,Math.cos(s)*.21,.24);p.iframes=.45;burst(p.x,.3,p.z,[.33,1,1],14);sound(380,.14)}if(type==='pulse'){let c=0;for(const e of g.enemies)if(!e.dead&&distance(e,p)<5.8){hurtEnemy(e,66*p.shock);e.stun=1.8;c++}for(const n of g.nodes)if(!n.dead&&distance(n,p)<5.6)damagePowerNode(n,45*p.shock);for(let b of g.bullets)if(distance(b,p)<6)b.dead=true;burst(p.x,1.1,p.z,[.36,.95,1],45);sound(190,.28,'sawtooth',.2);toast('ЭМИ-ВОЛНА · '+c+' ЦЕЛЕЙ',1)}if(type==='shield'){p.shield=p.shieldDuration;burst(p.x,1,p.z,[.58,.58,1],18);sound(460,.2,'sine',.13)}if(type==='heal'){p.hp=Math.min(p.maxhp,p.hp+49);burst(p.x,.9,p.z,[.22,1,.66],12);sound(640,.25,'sine',.11);toast('+49 ПРОЧНОСТЬ',1)}}
function enemyFire(e,pattern=0){e.attackPulse=.19;let g=game,p=pattern===8&&e.lockTarget?e.lockTarget:g.p,dx=p.x-e.x,dz=p.z-e.z,base=Math.atan2(dx,dz);
let count=[1,10,5,12,3,8,1,2][pattern]||1,spread=pattern===2?.14:pattern===4?.08:pattern===7?.2:0;
for(let i=0;i<count;i++){let a=base;if(pattern===1||pattern===3||pattern===5)a=i*TAU/count+(pattern===3?g.t*.7:pattern===5?Math.PI/8:0);else if(pattern===2||pattern===4||pattern===7)a=base+(i-(count-1)/2)*spread;let speed=(e.boss?2.7:3.0)*g.p.slowBullets;if(pattern===8)speed*=1.5;if(pattern===6)speed*=.56;if(pattern===3)speed*=.88;if(pattern===7)speed*=1.45;
const eY=1.1+(Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z));
const targetY=1.05+(Number.isFinite(p.feetY)?p.feetY:(Number.isFinite(p.y)?p.y:0));
const vy=(pattern===1||pattern===3||pattern===5)?0:clamp((targetY-eY)/Math.max(.4,hypot(dx,dz)/speed),-speed*.60,speed*.60);
g.bullets.push({x:e.x,y:eY,z:e.z,vx:Math.sin(a)*speed,vy,vz:Math.cos(a)*speed,life:pattern===6?10:7,radius:pattern===6?.27:e.boss?.13:.095,damage:e.damage*(pattern===6?1.5:pattern===7?.8:1),from:'enemy',col:e.color})}sound(100,.09,'sawtooth',.04)}

function updateEnemies(dt){const g=game,p=g.p;for(let e of g.enemies){if(e.dead)continue;e.spawn+=dt;e.flash=Math.max(0,e.flash-dt);e.stun=Math.max(0,e.stun-dt);let d=distance(p,e),heading=enemyHeading(e,p),dx=heading.dx,dz=heading.dz;e.attack-=dt;e.trail+=dt;
 if(e.boss && !e.dead && e.hp<e.maxhp*.24){
  if(!e.phase3){e.phase3=true;e.damage*=1.12;e.ultTimer=3.3;toast('☠ ФАЗА III · УДАР ПО ПЛОЩАДИ · ПРЫГАЙ!',2.6);}
  if((e.ultWarn||0)>0){
   const prev=e.ultWarn;e.ultWarn=Math.max(0,e.ultWarn-dt);
   if(prev>0&&e.ultWarn===0){
    const near=hypot(p.x-e.x,p.z-e.z)<5.15;
    const nearHeight=Math.abs((p.feetY||0)-(e.feetY||0))<1.35;
    if(near&&nearHeight&&p.grounded)damagePlayer(16+Math.min(22,g.sector*.45));
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
if(e.attack<=0&&d<19){let attack=variant===0?(Math.floor(phase/4)%2?4:1):variant===1?(Math.floor(phase/5)%2?2:6):variant===2?2:variant===3?(Math.floor(phase/5)%2?7:5):variant===4?(Math.floor(phase/7)%2?6:2):variant===5?3:variant===6?(Math.floor(phase/5)%2?6:1):Math.floor(phase/4)%7;
enemyFire(e,attack);e.attack=attack===1||attack===3?2.8:attack===6?2.1:variant===2?1.6:1.15;
if(attack===1||attack===3)toast('⚠ РАДИАЛЬНЫЙ ЗАЛП · УКЛОНЯЙСЯ!',1.1);
if(attack===6)toast('⚠ ПЛАЗМЕННАЯ БОМБА!',1.1);
if(variant===6&&d<8){moveEntity(p,-dx*.43,-dz*.43,.25);toast('⚠ ГРАВИТАЦИОННАЯ ВОРОНКА',1)}
if(variant===0&&d>2&&Math.floor(phase/7)!==Math.floor((phase-dt)/7)){moveEntity(e,dx*1.8,dz*1.8,e.radius*.45)}
}
let summonEvery=variant===2?4.2:variant===7?4.5:variant===4?9.3:7.5;
if(phase>summonEvery&&Math.floor(phase/summonEvery)!==Math.floor((phase-dt)/summonEvery)&&g.enemies.filter(z=>!z.dead&&!z.boss).length<6){spawnEnemy(variant===2?'medic':pick(['scout','charger','shooter']),false);if(variant===2||variant===7)spawnEnemy('scout',false)}
if((d>3.5||!lineClear(e.x,e.z,p.x,p.z))&&e.stun<=0)moveEntity(e,dx*e.speed*dt,dz*e.speed*dt,e.radius*.5);else if(d<2&&e.stun<=0)moveEntity(e,-dx*.55*dt,-dz*.55*dt,e.radius*.5);if(d<1.5&&Math.abs((p.feetY||0)-(e.feetY||0))<1.2&&e.attack<=0){damagePlayer(e.damage);e.attack=.9}continue}
if(e.type==='medic'){if(e.trail>.75){e.trail=0;for(let f of g.enemies)if(!f.dead&&f!==e&&distance(e,f)<4)f.hp=Math.min(f.maxhp,f.hp+9)}}if(e.stun>0)continue;let chase=e.type==='scout'||e.type==='brute'||e.type==='charger'||e.type==='raider',stopDist=chase?1.1:e.type==='sniper'?8:5;if(d>stopDist||(!chase&&!lineClear(e.x,e.z,p.x,p.z))){let mul=chase&&e.type==='charger'&&e.attack<.4?1.9:e.type==='raider'&&e.attack<.40?1.7:1;moveEntity(e,dx*e.speed*dt*mul,dz*e.speed*dt*mul,e.radius*.45)}else if(d<2.5&&!chase){moveEntity(e,-dx*e.speed*dt*.7,-dz*e.speed*dt*.7,e.radius*.45)}else if(!chase&&d<e.range&&d>3&&lineClear(e.x,e.z,p.x,p.z)){moveEntity(e,-dz*e.orbit*e.speed*dt*.31,dx*e.orbit*e.speed*dt*.31,e.radius*.45)}if(e.attack<=0){if(chase&&d<1.55&&Math.abs((p.feetY||0)-(e.feetY||0))<1.2){damagePlayer(e.damage);e.attack=.75+(e.type==='brute'?.42:0)}else if(!chase&&d<e.range&&lineClear(e.x,e.z,p.x,p.z)){if(e.type==='sniper'){
  e.telegraph=.86;e.lockTarget={x:p.x,z:p.z,feetY:p.feetY||0};e.attack=2.9;
 }else{enemyFire(e,e.type==='artillery'?6:0);e.attack=e.type==='artillery'?3.15:e.type==='warden'?1.95:1.7}}else{e.attack=.26}}}
for(const e of g.enemies)if(!e.dead&&e.type==='drone'){
  const under=Math.max(floorHeight(e.x,e.z),deckHeight(e.x,e.z));
  e.feetY=under+.80+Math.sin(g.t*2.1+e.id*.7)*.12;
}
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
  const kind=e.boss?'boss':e.type,profile=robotAnimationProfile(kind);
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
     g.particles.push({x:px,y:(Number(e.feetY)||0)+(e.boss?2.25:1.32),z:pz,vx:rand(-.5,.5),vy:rand(.6,1.8),vz:rand(-.5,.5),life:rand(.15,.35),col:[1,.44,.13]});
    }
   }
  }
 }
};

function updateBullets(dt){let g=game,p=g.p;for(let b of g.bullets){if(b.dead)continue;const oldBulletY=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;b.life-=dt;const deck=deckHeight(b.x,b.z);if(deck>0&&((oldBulletY-deck)*(b.y-deck)<=0)){b.dead=true;burst(b.x,deck,b.z,b.col,4);continue;}if(isWall(b.x,b.z)){b.dead=true;burst(b.x,b.y,b.z,b.col,3)}else if(b.from==='enemy'&&hypot(b.x-p.x,b.z-p.z)<.42&&Math.abs(b.y-((p.feetY||0)+1.05))<.86){damagePlayer(b.damage);b.dead=true;burst(b.x,b.y,b.z,b.col,7)}}g.bullets=g.bullets.filter(b=>!b.dead&&b.life>0);for(const e of g.loot){e.life-=dt;if(distance(e,p)<1.0+p.magnet){e.life=0;if(e.type==='heal')p.hp=Math.min(p.maxhp,p.hp+23);if(e.type==='energy')p.energy=Math.min(p.maxEnergy,p.energy+29);if(e.type==='plates'){p.armor=Math.min(p.maxArmor,p.armor+22);toast('БРОНЕПЛАСТИНЫ +22',1.2);}if(e.type==='credits'){save.credits+=8+Math.ceil(g.sector*.5);g.totalCredits+=8+Math.ceil(g.sector*.5)}sound(560,.08,'sine',.07)}}g.loot=g.loot.filter(x=>x.life>0);for(const b of g.particles){b.life-=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;b.vy-=dt*2}g.particles=g.particles.filter(b=>b.life>0);for(const t of (g.tracers||[]))t.life-=dt;g.tracers=(g.tracers||[]).filter(t=>t.life>0);for(const a of(g.scorch||[]))a.life-=dt;g.scorch=(g.scorch||[]).filter(a=>a.life>0);if(g.particles.length>140)g.particles.splice(0,g.particles.length-140)}