
// BFS flow-field for enemy navigation. Updated <2 Hz; no per-enemy A*.
function rebuildNavigation(){
  if(!game)return;
  const sz=mapSize,px=clamp(Math.floor(game.p.x),0,sz-1),pz=clamp(Math.floor(game.p.z),0,sz-1);
  const val=new Int16Array(sz*sz);val.fill(32767);
  const qx=new Int16Array(sz*sz),qz=new Int16Array(sz*sz);
  let head=0,tail=0;val[pz*sz+px]=0;qx[tail]=px;qz[tail++]=pz;
  while(head<tail){const x=qx[head],z=qz[head++],d=val[z*sz+x]+1;
    for(const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0]]){
      const X=x+dx,Z=z+dz;
      if(X<1||Z<1||X>=sz-1||Z>=sz-1||mapCells[Z][X])continue;
      if(!enemyNavEdge(x,z,X,Z))continue;
      const ix=Z*sz+X;if(d>=val[ix])continue;
      val[ix]=d;qx[tail]=X;qz[tail++]=Z;
    }
  }
  navField=val;navClock=.65;
}
function enemyHeading(e,p){
  if(!e.airborne&&bridgeSpecs.length && p.feetY>BRIDGE_Y-.38 && (e.feetY||0)<BRIDGE_Y-.30){
    const c=Math.floor(mapSize/2);
    if(!e.rampSide)e.rampSide=e.x<c?-1:1;
    const side=e.rampSide;
    const outer={x:c+side*13.5,z:c+.5},inner={x:c+side*2.5,z:c+.5};
    if(e.rampAccess || hypot(e.x-outer.x,e.z-outer.z)<1.4)e.rampAccess=true;
    const target=e.rampAccess?inner:outer;
    const dx=target.x-e.x,dz=target.z-e.z,d=hypot(dx,dz)||1;
    return {dx:dx/d,dz:dz/d};
  }
  if(e.rampAccess&&(e.feetY||0)>BRIDGE_Y-.38)e.rampAccess=false;
  let d=hypot(p.x-e.x,p.z-e.z)||1;
  if(enemyDirectRoute(e,p))return {dx:(p.x-e.x)/d,dz:(p.z-e.z)/d};
  if(!navField)return {dx:(p.x-e.x)/d,dz:(p.z-e.z)/d};
  const x=Math.floor(e.x),z=Math.floor(e.z),sz=mapSize;
  if(x<1||z<1||x>=sz-1||z>=sz-1)return {dx:0,dz:0};
  let best=navField[z*sz+x],targetX=x+.5,targetZ=z+.5;
  const offsets=[[0,1],[0,-1],[1,0],[-1,0]];
  for(const [mx,mz] of offsets){const X=x+mx,Z=z+mz;if(mapCells[Z]?.[X]!==0||!enemyNavEdge(x,z,X,Z))continue;
    let cost=navField[Z*sz+X];if(cost<best){best=cost;targetX=X+.5;targetZ=Z+.5;}
  }
  let dx=targetX-e.x,dz=targetZ-e.z,mag=hypot(dx,dz);
  if(mag<.13)return {dx:(p.x-e.x)/d,dz:(p.z-e.z)/d};
  return {dx:dx/mag,dz:dz/mag};
}
// STAGE 11 — A spawn is a physical placement, not merely a free map tile.
// Stage 10 made moving actors tangible, but the old random generator could
// materialise them inside an existing robot. Never use the portal as an unsafe
// last resort; a temporarily full arena should retry the wave later instead.
function enemySpawnSpaceClear(x,z,bodyRadius=.48,bodyHeight=1.9){
 const g=game;
 if(!g||!Number.isFinite(x)||!Number.isFinite(z)||
    x<1||z<1||x>=mapSize-1||z>=mapSize-1)return false;
 const r=Math.max(.25,Number(bodyRadius)||.48);
 if(collide(x,z,Math.max(.45,r))||
    (glReady&&worldSolidBodyCollision(x,z,r,floorHeight(x,z),bodyHeight)))return false;
 const feet=floorHeight(x,z),top=feet+bodyHeight;
 if(Math.hypot(x-g.p.x,z-g.p.z)<r+.60 &&
    feet<=(g.p.feetY||0)+1.92 && top>=(g.p.feetY||0)+.15)return false;
 for(const e of g.enemies){
  if(e.dead||!Number.isFinite(e.x)||!Number.isFinite(e.z))continue;
  const ef=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
  if(top<=ef+.03||feet>=ef+enemyBodyHeight(e)-.03)continue;
  // A small buffer lets freshly spawned neighbours begin walking freely.
  if(Math.hypot(x-e.x,z-e.z)<r+enemyCrowdRadius(e)+.08)return false;
 }
 return true;
}
function randFloor(minDist=7,bodyRadius=.48,bodyHeight=1.9){
 const g=game;if(!g)return null;
 let backup=null;
 for(let t=0;t<240;t++){
  const x=2+Math.random()*(mapSize-4),z=2+Math.random()*(mapSize-4);
  if(!enemySpawnSpaceClear(x,z,bodyRadius,bodyHeight))continue;
  const d=hypot(x-g.p.x,z-g.p.z);
  if(d<minDist)continue;
  if(d<Math.min(22,mapSize*.38)&&(d>11||!lineClear(g.p.x,g.p.z,x,z)))return {x,z};
  if(!backup)backup={x,z};
 }
 if(backup)return backup;
 // A predictable fallback is vital in a crowded arena: random retries can
 // miss the last free tile. Search cell centres and a small offset grid, but
 // do not summon a robot inside another robot or the portal's structures.
 const offsets=[[.5,.5],[.28,.28],[.72,.72],[.28,.72],[.72,.28]];
 let best=null,bestScore=-Infinity;
 for(let z=1;z<mapSize-1;z++)for(let x=1;x<mapSize-1;x++){
  if(mapCells[z]?.[x]!==0)continue;
  for(const [u,v] of offsets){
   const xx=x+u,zz=z+v,d=hypot(xx-g.p.x,zz-g.p.z);
   if(d<minDist||!enemySpawnSpaceClear(xx,zz,bodyRadius,bodyHeight))continue;
   // Prefer the original spawning band near the player, without depending on
   // PRNG luck. Never sacrifice collision validity for proximity.
   const score=-Math.abs(d-Math.min(15,Math.max(minDist,11)))+.0001*(xx+zz);
   if(score>bestScore){best={x:xx,z:zz};bestScore=score;}
  }
 }
 return best;
}
function spawnEnemy(type,boss=false){let g=game,air=!boss&&['drone','skyhunter','skyguard','stormray'].includes(type);const size=enemies[type]?.radius||.48;const flightHeight=air?Math.max(2.12,2.12*Math.max(.76,Math.min(1.31,size/.51))):1.9;let p=randFloor(boss?11:6,boss ? .78 : air ? .66 : .48,boss ? 3.1 : air ? flightHeight+.18 : 1.9);if(!p)return null;let prop=boss?{name:bossNames[((g.sector/5)|0)-1>=0?(((g.sector/5)|0)-1)%bossNames.length:0],hp:430+g.sector*55,speed:.58,damage:17+g.sector*1.2,range:14,color:[1,.25,.62],radius:1.03,score:1300}:enemies[type];if(!prop)prop=enemies.scout;let scale=1+Math.max(0,g.sector-1)*.055;let obj={id:++g.idCounter,x:p.x,z:p.z,feetY:floorHeight(p.x,p.z),type:boss?'boss':type,boss,airborne:air,elite:!boss&&g.sector>=3&&g.spawned%5===4,orbit:Math.random()<.5?-1:1,telegraph:0,lockTarget:null,variant:boss?((Math.floor(g.sector/5)-1)%bossNames.length):0,hp:prop.hp*scale,maxhp:prop.hp*scale,speed:prop.speed*(1+g.sector*.015),damage:prop.damage*scale,range:prop.range,color:boss?themes[sectorStyle%themes.length].accent:prop.color,radius:prop.radius,score:prop.score,attack:rand(.3,1.7),spawn:0,flash:0,bossPhase:0,trail:0,charge:0,stun:0,dead:false,robotYaw:Math.atan2(g.p.x-p.x,g.p.z-p.z),robotEyeYaw:Math.atan2(g.p.x-p.x,g.p.z-p.z),robotCycle:Math.random()*6.283,robotMotion:0,robotTurn:0,robotLean:0,robotStrafe:0,robotReverse:0,robotInertia:0,robotAttackState:0,robotDamageHeat:0};if(obj.airborne)obj.feetY=floorHeight(p.x,p.z)+.13;if(obj.elite){obj.hp*=2.1;obj.maxhp=obj.hp;obj.damage*=1.28;obj.speed*=1.12;obj.radius*=1.13;obj.score*=2.5;obj.color=[Math.min(1,prop.color[0]*.6+.42),Math.min(1,prop.color[1]*.58+.23),Math.min(1,prop.color[2]*.6+.48)];}const armorKind=boss?'boss':type;
 const armorClasses={boss:[Math.round(obj.maxhp*.80),.74],brute:[145,.56],warden:[200,.69],artillery:[110,.48],skyguard:[145,.56]};
 const armorSpec=armorClasses[armorKind]||(obj.elite?[Math.round(obj.maxhp*.43),.42]:null);
 if(armorSpec){obj.protection=Math.round(armorSpec[0]*(boss?1:scale));obj.maxProtection=obj.protection;obj.protectionRating=armorSpec[1];}
 else {obj.protection=0;obj.maxProtection=0;obj.protectionRating=0;}
 g.enemies.push(obj);if(boss){g.boss=obj;$('bossTitle').textContent=prop.name;$('bossWrap').style.display='block';toast('☠ БОСС: '+prop.name,2.6);sound(85,.28,'sawtooth',.22)}return obj}
function spawnWave(dt){const g=game;if(g.spawned>=g.target||g.portalReady)return;g.waveDelay-=dt;if(g.waveDelay>0)return;if(g.sector%5===0){if(!spawnEnemy('boss',true)){g.waveDelay=.75;return;}g.spawned=1;return}let active=g.enemies.filter(x=>!x.dead).length;if(active>=Math.min(6+g.sector*.4,14)){g.waveDelay=.6;return}let pool=['scout','scout','scout','shooter','charger'];if(g.sector>2)pool.push('brute');if(g.sector>3)pool.push('sniper','medic');if(g.sector>5)pool.push('warden');if(g.sector>8)pool.push('artillery');if(g.sector>11)pool.push('drone');if(g.sector>=14)pool.push('skyhunter');if(g.sector>=20)pool.push('skyguard');if(g.sector>=26)pool.push('stormray');if(sectorStyle>=14&&g.sector>=20)pool.push('skyhunter','stormray');if(g.sector>=8)pool.push('raider');let isHunt=g.mission?.type==='hunt'&&!g.mission.sentinelId&&g.spawned>=Math.floor(g.target*.48);let e=spawnEnemy(isHunt?(g.sector>8?'warden':'brute'):pick(pool));if(!e){g.waveDelay=.75;return;}if(isHunt){e.elite=true;e.maxhp*=2.45;e.hp=e.maxhp;e.damage*=1.35;e.score*=3;e.color=[1,.64,.22];e.maxProtection=Math.max(e.maxProtection||0,Math.round(e.maxhp*.45));e.protection=e.maxProtection;e.protectionRating=Math.max(e.protectionRating||0,.44);g.mission.sentinelId=e.id;toast('♜ КОМАНДИР ОБНАРУЖЕН · ПОВЫШЕННАЯ УГРОЗА',2.4)}g.spawned++;g.waveDelay=rand(.42,.95)*Math.pow(.98,g.sector);}
// A capped, short-lived debris system: no enduring robot shadow / corpse decals.
function spawnRobotArmorDebris(e,count=3,lethal=false){
 const g=game;if(!g)return;
 if(!Array.isArray(g.robotDebris))g.robotDebris=[];
 const cap=touchOnly?34:66;
 const palette=robotPalette(e.boss?'boss':e.type);
 const floor=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
 const level=lethal?1.10:1.36;
 const speed=lethal?3.7:2.1;
 const angle=Number.isFinite(e.robotYaw)?e.robotYaw:0;
 for(let i=0;i<count;i++){
   const a=Math.random()*TAU,side=(i%2?1:-1);
   const r=(lethal?.14:.11)+Math.random()*.16;
   g.robotDebris.push({x:e.x+Math.cos(a)*.15,z:e.z+Math.sin(a)*.15,
     y:floor+level+Math.random()*.38, vx:Math.cos(a)*(speed*.45+Math.random()*speed*.55),
     vy:1.05+Math.random()*(lethal?2.0:1.3),vz:Math.sin(a)*(speed*.45+Math.random()*speed*.55),
     rx:Math.random()*TAU,rz:Math.random()*TAU, spin:(Math.random()-.5)*12,
     size:r, life:lethal?3.4:2.1, ttl:lethal?3.4:2.1,
     color:((i%4)===0?palette.highlight:(i%3===0?RF.iron:palette.base)).slice(),
     glow:(i%7)===0, rested:false, bounces:0});
 }
 if(g.robotDebris.length>cap)g.robotDebris.splice(0,g.robotDebris.length-cap);
}
function updateRobotDebris(dt){
 const g=game;if(!g || !Array.isArray(g.robotDebris) || !g.robotDebris.length)return;
 const out=[];
 for(const sh of g.robotDebris){
   sh.life-=dt;
   if(sh.life<=0 || !Number.isFinite(sh.x)||!Number.isFinite(sh.y)||!Number.isFinite(sh.z))continue;
   if(!sh.rested){
     const oldX=sh.x,oldZ=sh.z;
     sh.vy-=9.5*dt;
     sh.x+=sh.vx*dt;sh.y+=sh.vy*dt;sh.z+=sh.vz*dt;
     if(isWall(sh.x,sh.z)){sh.x=oldX;sh.z=oldZ;sh.vx*=-.25;sh.vz*=-.25;}
     const ground=floorHeight(sh.x,sh.z);
     if(sh.y<ground+sh.size*.3){
       sh.y=ground+sh.size*.3;
       sh.bounces++;
       sh.vy=Math.abs(sh.vy)*.28;
       sh.vx*=.61;sh.vz*=.61;
       if(sh.bounces>=2||Math.abs(sh.vy)<.42){sh.rested=true;sh.vx=0;sh.vy=0;sh.vz=0;}
     }
     sh.rx+=sh.spin*dt;sh.rz-=sh.spin*.67*dt;
   }
   out.push(sh);
 }
 g.robotDebris=out;
}
function awardKill(e){const g=game;spawnRobotArmorDebris(e,e.boss?15:e.elite?9:6,true);g.kills++;g.combo++;g.comboAt=g.t;g.score+=e.score*(1+Math.min(g.combo,15)*.06)|0;g.p.hp=Math.min(g.p.maxhp,g.p.hp+g.p.vamp);save.kills++;if(e.elite){toast('★ ЭЛИТА УНИЧТОЖЕНА · БОНУС ОЧКОВ',1.2);}if(Math.random()<.34||e.boss||e.elite){let type=e.boss?'heal':Math.random()<.20?'heal':Math.random()<.65?'energy':'credits';g.loot.push({x:e.x,z:e.z,type,life:16})}
 if(e.elite||(!e.boss&&Math.random()<.10))g.loot.push({x:e.x+.18,z:e.z-.17,type:'plates',life:23});
 if(g.mission?.type==='hunt'&&e.id===g.mission.sentinelId){g.mission.done=1;g.score+=450;toast('♜ КОМАНДИР УСТРАНЁН',1.5);}burst(e.x,1.2+(e.feetY||0),e.z,e.color,e.boss?34:11);/* Robot deaths should not leave a permanent dark floor shadow.
   Keep kill feedback via particles and loot only; reserve scorch marks for
   weapon and environmental impacts rather than enemy disposal. */if(e.boss)for(let k=0;k<6;k++)g.loot.push({x:e.x+rand(-.8,.8),z:e.z+rand(-.8,.8),type:'credits',life:22});if(g.spawned>=g.target&&!g.enemies.some(x=>!x.dead))maybeFinishMission(g)}
function hurtEnemy(e,damage,options={}){
 if(e.dead||!game)return;
 const crit=Math.random()<game.p.crit;
 let dm=damage*game.p.damage*(crit?game.p.critDamage:1);
 if(e.type!=='warden'&&game.enemies.some(z=>!z.dead&&z.type==='warden'&&z.stun<=0&&distance(z,e)<4.2))dm*=.72;
 const prevHp=e.hp,prevProtection=Math.max(0,Number(e.protection)||0);
 const maxProtection=Math.max(0,Number(e.maxProtection)||0);
 const rating=clamp(Number(e.protectionRating)||0,0,.94);
 const penetration=clamp(Number(options.penetration)||0,0,1);
 let blocked=0;
 if(prevProtection>0&&rating>0){
  // Armor has REAL hit-point durability. Penetrating damage bypasses reduction.
  // If the final plate runs out mid-hit, the uncovered portion hits the chassis.
  const desiredBlock=dm*rating*(1-penetration);
  blocked=Math.min(desiredBlock,prevProtection/1.18);
  e.protection=Math.max(0,prevProtection-blocked*1.18);
 }
 const chassis=Math.max(0,dm-blocked);
 e.hp-=chassis;
 const before=maxProtection>0?prevProtection/maxProtection:prevHp/e.maxhp;
 const after=maxProtection>0?Math.max(0,e.protection)/maxProtection:e.hp/e.maxhp;
 const armorStage=v=>v>.71?0:v>.46?1:v>.29?2:3;
 if(armorStage(after)>armorStage(before)&&e.hp>0)
  spawnRobotArmorDebris(e,(e.boss?6:3)*(armorStage(after)-armorStage(before)));
 e.flash=.13;e.hitReact=.24;
 e.robotDamageHeat=Math.min(1,(Number(e.robotDamageHeat)||0)+Math.min(.6,chassis/Math.max(1,e.maxhp)*3));
 game.score+=Math.ceil(chassis*.4);showDamage(e,Math.round(chassis),crit);
 if(e.hp<=0){e.dead=true;awardKill(e)}else sound(blocked>0?108:170,.055,'triangle',.035);
}
function damagePlayer(d){const p=game.p;if(p.iframes>0||p.shield>0||game.state!=='playing')return;p.armorDelay=0;let amount=d;if(p.armor>0){const fraction=clamp(.72+(p.armorTier||0)*.035,.72,.86),a=Math.min(amount*fraction,p.armor);p.armor-=a;amount-=a;
 const bar=$('bars');bar.classList.add('armorHit');setTimeout(()=>bar.classList.remove('armorHit'),180);
 }
 if((p.bodyArmor||0)>0&&(p.bodyArmorReduction||0)>0){
  const reduced=amount*p.bodyArmorReduction;
  const wear=Number.isFinite(p.bodyArmorWear)&&p.bodyArmorWear>0?p.bodyArmorWear:1.12;
  const absorbed=Math.min(reduced,p.bodyArmor/wear);
  p.bodyArmor=Math.max(0,p.bodyArmor-absorbed*wear);
  amount=Math.max(0,amount-absorbed);
  if(absorbed>0){
   const bar=$('bars');
   bar.classList.add('suitHit');
   setTimeout(()=>bar.classList.remove('suitHit'),240);
  }
 }
 // A fully operational pilot has a one-hit shock limiter. Even a late-boss
 // bomb cannot erase an otherwise healthy character outright when the suit
 // wears out; a *second* mistake is still deadly, so dodging remains vital.
 if(p.hp>=p.maxhp*.80)amount=Math.min(amount,p.maxhp*.72);
 p.hp=Math.max(0,p.hp-amount);p.iframes=.35;$('damageFlash').style.opacity=String(clamp(amount/75,.08,.29));setTimeout(()=>$('damageFlash').style.opacity='0',95);sound(115,.14,'sawtooth',.1);if(p.hp<=0)gameOver()}
function burst(x,y,z,col,count=9){const g=game;for(let i=0;i<count;i++){let a=rand(0,TAU),v=rand(.4,3.5),vy=rand(-.4,2.8),life=rand(.25,.85);g.particles.push({x,y,z,vx:Math.cos(a)*v,vz:Math.sin(a)*v,vy,life,maxLife:life,a:rand(0,TAU),col})}}
