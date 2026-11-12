
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
      const ix=Z*sz+X;if(d>=val[ix])continue;
      val[ix]=d;qx[tail]=X;qz[tail++]=Z;
    }
  }
  navField=val;navClock=.65;
}
function enemyHeading(e,p){
  if(bridgeSpecs.length && p.feetY>BRIDGE_Y-.38 && (e.feetY||0)<BRIDGE_Y-.30){
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
  if(lineClear(e.x,e.z,p.x,p.z))return {dx:(p.x-e.x)/d,dz:(p.z-e.z)/d};
  if(!navField)return {dx:(p.x-e.x)/d,dz:(p.z-e.z)/d};
  const x=Math.floor(e.x),z=Math.floor(e.z),sz=mapSize;
  if(x<1||z<1||x>=sz-1||z>=sz-1)return {dx:0,dz:0};
  let best=navField[z*sz+x],targetX=x+.5,targetZ=z+.5;
  const offsets=[[0,1],[0,-1],[1,0],[-1,0]];
  for(const [mx,mz] of offsets){const X=x+mx,Z=z+mz;if(mapCells[Z]?.[X]!==0)continue;
    let cost=navField[Z*sz+X];if(cost<best){best=cost;targetX=X+.5;targetZ=Z+.5;}
  }
  let dx=targetX-e.x,dz=targetZ-e.z,mag=hypot(dx,dz);
  if(mag<.13)return {dx:(p.x-e.x)/d,dz:(p.z-e.z)/d};
  return {dx:dx/mag,dz:dz/mag};
}
function randFloor(minDist=7){
  let saved=null;
  for(let t=0;t<240;t++){
    let x=2+Math.random()*(mapSize-4),z=2+Math.random()*(mapSize-4),d=hypot(x-game.p.x,z-game.p.z);
    if(!collide(x,z,.7)&&d>minDist){
      if(d<Math.min(22,mapSize*.38)&&(d>11||!lineClear(game.p.x,game.p.z,x,z)))return {x,z};
      if(!saved)saved={x,z};
    }
  }
  return saved||{x:portal.x,z:portal.z};
}
function spawnEnemy(type,boss=false){let g=game,p=randFloor(boss?11:6),prop=boss?{name:bossNames[((g.sector/5)|0)-1>=0?(((g.sector/5)|0)-1)%bossNames.length:0],hp:430+g.sector*125,speed:.58,damage:17+g.sector*1.2,range:14,color:[1,.25,.62],radius:1.03,score:1300}:enemies[type];if(!prop)prop=enemies.scout;let scale=1+Math.max(0,g.sector-1)*.09;let obj={id:++g.idCounter,x:p.x,z:p.z,feetY:floorHeight(p.x,p.z),type:boss?'boss':type,boss,elite:!boss&&g.sector>=3&&g.spawned%5===4,orbit:Math.random()<.5?-1:1,telegraph:0,lockTarget:null,variant:boss?((Math.floor(g.sector/5)-1)%bossNames.length):0,hp:prop.hp*scale,maxhp:prop.hp*scale,speed:prop.speed*(1+g.sector*.015),damage:prop.damage*scale,range:prop.range,color:boss?themes[sectorStyle%themes.length].accent:prop.color,radius:prop.radius,score:prop.score,attack:rand(.3,1.7),spawn:0,flash:0,bossPhase:0,trail:0,charge:0,stun:0,dead:false,robotYaw:Math.atan2(g.p.x-p.x,g.p.z-p.z),robotEyeYaw:Math.atan2(g.p.x-p.x,g.p.z-p.z),robotCycle:Math.random()*6.283,robotMotion:0,robotTurn:0,robotLean:0,robotStrafe:0,robotReverse:0,robotInertia:0,robotAttackState:0,robotDamageHeat:0};if(type==='drone'&&!boss)obj.feetY=floorHeight(p.x,p.z)+.80;if(obj.elite){obj.hp*=2.1;obj.maxhp=obj.hp;obj.damage*=1.28;obj.speed*=1.12;obj.radius*=1.13;obj.score*=2.5;obj.color=[Math.min(1,prop.color[0]*.6+.42),Math.min(1,prop.color[1]*.58+.23),Math.min(1,prop.color[2]*.6+.48)];}g.enemies.push(obj);if(boss){g.boss=obj;$('bossTitle').textContent=prop.name;$('bossWrap').style.display='block';toast('☠ БОСС: '+prop.name,2.6);sound(85,.28,'sawtooth',.22)}return obj}
function spawnWave(dt){const g=game;if(g.spawned>=g.target||g.portalReady)return;g.waveDelay-=dt;if(g.waveDelay>0)return;if(g.sector%5===0){spawnEnemy('boss',true);g.spawned=1;return}let active=g.enemies.filter(x=>!x.dead).length;if(active>=Math.min(6+g.sector*.4,14)){g.waveDelay=.6;return}let pool=['scout','scout','scout','shooter','charger'];if(g.sector>2)pool.push('brute');if(g.sector>3)pool.push('sniper','medic');if(g.sector>5)pool.push('warden');if(g.sector>8)pool.push('artillery');if(g.sector>11)pool.push('drone');if(g.sector>=8)pool.push('raider');let isHunt=g.mission?.type==='hunt'&&!g.mission.sentinelId&&g.spawned>=Math.floor(g.target*.48);let e=spawnEnemy(isHunt?(g.sector>8?'warden':'brute'):pick(pool));if(isHunt){e.elite=true;e.maxhp*=2.45;e.hp=e.maxhp;e.damage*=1.35;e.score*=3;e.color=[1,.64,.22];g.mission.sentinelId=e.id;toast('♜ КОМАНДИР ОБНАРУЖЕН · ПОВЫШЕННАЯ УГРОЗА',2.4)}g.spawned++;g.waveDelay=rand(.42,.95)*Math.pow(.98,g.sector);}
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
function hurtEnemy(e,damage){if(e.dead||!game)return;let crit=Math.random()<game.p.crit;let dm=damage*game.p.damage*(crit?game.p.critDamage:1);if(e.type!=='warden'&&game.enemies.some(z=>!z.dead&&z.type==='warden'&&z.stun<=0&&distance(z,e)<4.2))dm*=.72;const prevHp=e.hp;e.hp-=dm;
 const oldArmorStage=prevHp/e.maxhp>.71?0:prevHp/e.maxhp>.46?1:prevHp/e.maxhp>.29?2:3;
 const newArmorStage=e.hp/e.maxhp>.71?0:e.hp/e.maxhp>.46?1:e.hp/e.maxhp>.29?2:3;
 if(newArmorStage>oldArmorStage && e.hp>0)spawnRobotArmorDebris(e,(e.boss?6:3)*(newArmorStage-oldArmorStage));
 e.flash=.13;e.hitReact=.24;e.robotDamageHeat=Math.min(1,(Number(e.robotDamageHeat)||0)+Math.min(.6,dm/Math.max(1,e.maxhp)*3));game.score+=Math.ceil(dm*.4);showDamage(e,Math.round(dm),crit);if(e.hp<=0){e.dead=true;awardKill(e)}else sound(170,.055,'triangle',.035)}
function damagePlayer(d){const p=game.p;p.armorDelay=5.0;if(p.iframes>0||p.shield>0||game.state!=='playing')return;let amount=d;if(p.armor>0){const fraction=clamp(.72+(p.armorTier||0)*.035,.72,.86),a=Math.min(amount*fraction,p.armor);p.armor-=a;amount-=a;
 const bar=$('bars');bar.classList.add('armorHit');setTimeout(()=>bar.classList.remove('armorHit'),180);
 }p.hp=Math.max(0,p.hp-amount);p.iframes=.35;$('damageFlash').style.opacity=String(clamp(amount/75,.08,.29));setTimeout(()=>$('damageFlash').style.opacity='0',95);sound(115,.14,'sawtooth',.1);if(p.hp<=0)gameOver()}
function burst(x,y,z,col,count=9){const g=game;for(let i=0;i<count;i++){let a=rand(0,TAU),v=rand(.4,3.5);g.particles.push({x,y,z,vx:Math.cos(a)*v,vz:Math.sin(a)*v,vy:rand(-.4,2.8),life:rand(.25,.85),a:rand(0,TAU),col})}}