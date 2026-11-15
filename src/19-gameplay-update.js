
let arsenalOpened=false;
function closeArsenal(){arsenalOpened=false;const el=$('weaponDrawer');el.classList.remove('open');el.replaceChildren();}
function toggleArsenal(){
 if(!game||game.state!=='playing')return;
 if(arsenalOpened){closeArsenal();return;}
 const el=$('weaponDrawer');
 el.innerHTML=`<div class="arsenalTop"><span>⟡ ВЫБЕРИ ОРУЖИЕ</span><button id="arsenalClose" aria-label="Закрыть выбор оружия">✕</button></div><div class="arsenalGrid">${weapons.map((w,i)=>`<button class="arsenalChoice ${game.p.weapon===i?'current':''}" data-wpn="${i}"><b>${w.icon}</b><span>${i+1}. ${w.short}</span></button>`).join('')}</div>`;
 el.classList.add('open');arsenalOpened=true;
 el.querySelector('#arsenalClose').onclick=closeArsenal;
 el.querySelectorAll('[data-wpn]').forEach(b=>b.onclick=()=>{switchWeapon(Number(b.dataset.wpn));closeArsenal()});
}
const input={keys:{},mx:0,mz:0,fire:false,jumpQueued:false,jumpHeld:false,flyUp:false,flyDown:false,lastSpaceAt:-Infinity,looking:false,pid:null,px:0,py:0,joyId:null,tapX:0,tapY:0,tapAt:0,tapMoved:false,sprint:false,mobileSprint:false,lastWAt:-Infinity};function key(k){return input.keys[k]||false}
const SPRINT_ENERGY_DRAIN=1.8;
function maxDashRange(p=game?.p){
 const permanent=DASH_DISTANCE_BASE+(Number(save.perms?.[5])||0)*DASH_UPGRADE_STEP;
 return Number(Math.min(DASH_DISTANCE_MAX,Math.max(DASH_DISTANCE_BASE,Number(p?.dashRange)||permanent)).toFixed(2));
}
function selectedDashRange(p=game?.p){
 const max=maxDashRange(p),choice=normalizeDashDistanceSetting(save.settings.dashDistance);
 return choice===null?max:Math.min(max,choice);
}
function dashDistancePercent(value=selectedDashRange(),max=maxDashRange()){
 return Number((100*(value-DASH_DISTANCE_MIN)/(max-DASH_DISTANCE_MIN)).toFixed(1));
}
function setDashRange(raw,commit=true,flash=false){
 if(!game||!['playing','paused'].includes(game.state))return null;
 const max=maxDashRange(game.p);
 const choice=normalizeDashDistanceSetting(raw);
 const selected=choice===null?max:Number(Math.min(choice,max).toFixed(2));
 save.settings.dashDistance=selected;
 if(commit)persist();
 if(flash)showDashRangeHud();
 return selected;
}
function showDashRangeHud(){
 if(typeof touchOnly!=='undefined'&&touchOnly)return;
 const hud=$('dashRangeHud');if(!hud)return;
 const selected=selectedDashRange(),max=maxDashRange();
 const display=n=>n.toFixed(2).replace('.',',');
 $('dashRangeLabel').textContent=display(selected)+' / '+display(max)+' м';
 $('dashRangeFill').style.height=dashDistancePercent(selected,max)+'%';
 hud.classList.add('visible');
 clearTimeout(showDashRangeHud.tm);
 showDashRangeHud.tm=setTimeout(()=>hud.classList.remove('visible'),1800);
}
function stepDashRange(direction){
 if(!game||game.state!=='playing'||(typeof touchOnly!=='undefined'&&touchOnly))return null;
 return setDashRange(selectedDashRange()+Math.sign(direction)*DASH_DISTANCE_STEP,true,true);
}
function updateDashDistanceWhileHeld(){
 // Browser keyboard auto-repeat can stop while WASD, shooting or sprint
 // keys are also held. Sample the physical key state on every game frame.
 if(typeof touchOnly!=='undefined'&&touchOnly||key('AltLeft')||key('AltRight'))return;
 const up=key('ArrowUp'),down=key('ArrowDown');
 if(up===down)return;
 const now=performance.now();
 if(now-lastDashRangeArrowAt>=170){
  stepDashRange(up?1:-1);
  lastDashRangeArrowAt=now;
 }
}
function sprintMotionState(p,moving,dt,regenApplied=0){
 if(!moving||!(input.sprint||input.mobileSprint&&input.mz>.2))return false;
 if(p.sprintTired){if(p.energy<8)return false;p.sprintTired=false;}
 if(p.energy<=.3){p.sprintTired=true;return false;}
 // The ordinary regeneration was applied earlier in this frame. Remove only
 // the amount ACTUALLY recovered, including when the tank was almost full.
 p.energy=Math.max(0,p.energy-regenApplied-SPRINT_ENERGY_DRAIN*dt);
 if(p.energy<=.3)p.sprintTired=true;
 return true;
}
function update(dt){const g=game,p=g.p;if(g.state!=='playing'||arsenalOpened)return;updateDashDistanceWhileHeld();g.t+=dt;g.sectorTime+=dt;navClock-=dt;if(navClock<=0)rebuildNavigation();p.walk=0;p.cooldown=Math.max(-dt,p.cooldown-dt);p.heatLock=Math.max(0,p.heatLock-dt);p.heat=Math.max(0,p.heat-dt*(p.heatLock>0?22:25));p.recoil=Math.max(0,p.recoil-dt*4);p.shotGlow=Math.max(0,(p.shotGlow||0)-dt);p.equipAnim=Math.max(0,(p.equipAnim||0)-dt*2.2);p.iframes=Math.max(0,p.iframes-dt);p.shield=Math.max(0,p.shield-dt);for(const cd of Object.keys(p.abilityCooldowns||{}))p.abilityCooldowns[cd]=Math.max(0,p.abilityCooldowns[cd]-dt);const energyBeforeRegen=p.energy;p.energy=Math.min(p.maxEnergy,p.energy+p.regen*dt);const regenApplied=p.energy-energyBeforeRegen;p.hp=Math.min(p.maxhp,p.hp+p.healRegen*dt);p.armorDelay=Math.max(0,(p.armorDelay||0)-dt);if(p.armorDelay<=0&&p.armor<p.maxArmor&&p.energy>12){const a=Math.min(p.maxArmor-p.armor,(p.armorRegen||2.6)*dt);p.armor+=a;p.energy=Math.max(0,p.energy-a*.5);}if(g.combo>0&&g.t-g.comboAt>5)g.combo=0;
if(key('ArrowLeft'))p.yaw+=dt*1.95;if(key('ArrowRight'))p.yaw-=dt*1.95;
// Plain ↑/↓ now choose teleport distance. Alt+↑/↓ keeps accessible camera
// pitch controls for players who cannot use a mouse (touch uses swipe).
const pitchArrows=(typeof touchOnly!=='undefined'&&touchOnly)||key('AltLeft')||key('AltRight');
if(pitchArrows&&key('ArrowUp'))p.pitch=clamp(p.pitch+dt*.95,-1.0,1.0);
if(pitchArrows&&key('ArrowDown'))p.pitch=clamp(p.pitch-dt*.95,-1,1);
let mx=(key('KeyD')?1:0)-(key('KeyA')?1:0),mz=(key('KeyW')?1:0)-(key('KeyS')?1:0);mx+=input.mx;mz+=input.mz;let mag=hypot(mx,mz);if(mag>1){mx/=mag;mz/=mag}const sprinting=sprintMotionState(p,mag>0,dt,regenApplied);if(mag){const flightScale=p.flying?flightSpeedMultiplier('horizontal')*normalizeFlightThrottle(save.settings.flightHorizontal):1;let dx=(Math.sin(p.yaw)*mz-Math.cos(p.yaw)*mx)*p.speed*flightScale*(sprinting?1.48:1)*dt;let dz=(Math.cos(p.yaw)*mz+Math.sin(p.yaw)*mx)*p.speed*flightScale*(sprinting?1.48:1)*dt;moveEntity(p,dx,dz);p.walk=1}updateVertical(p,dt);if(input.fire)shoot();spawnWave(dt);updateEnemies(dt);updateRobotDebris(dt);updatePlayerOrdnance(dt);updateBullets(dt);updateDevices(dt);updateMission(dt);if(g.portalReady&&distance(p,portal)<1.18){portalNext()}}
function portalNext(){
 const g=game;if(!g||g.state!=='playing')return;
 recordLevelCompleted(g);
 g.state=g.sector>=CAMPAIGN_MAX_LEVEL?'victory':'upgrade';
 save.best=Math.max(save.best,save.campaign.highestUnlocked);
 save.credits+=10+g.sector*2;
 if(document.pointerLockElement)document.exitPointerLock();
 if(g.state==='victory'){
  save.checkpoint=null;persist();showFinalVictory();return;
 }
 showUpgrade();
}
function recordLevelCompleted(g){
 const level=clamp(Math.floor(g.sector),1,CAMPAIGN_MAX_LEVEL);
 const progress=save.campaign;
 const rec=progress.records[level]||{};
 const firstWin=!(Number(rec.wins)>0)&&level>progress.completedThrough;
 progress.completedThrough=Math.max(progress.completedThrough,level);
 progress.highestUnlocked=Math.max(progress.highestUnlocked,Math.min(CAMPAIGN_MAX_LEVEL,level+1));
 if(Math.floor((progress.highestUnlocked-1)/CAMPAIGN_CHAPTER_SIZE)>campaignPage)campaignPage=Math.floor((progress.highestUnlocked-1)/CAMPAIGN_CHAPTER_SIZE);
 progress.latestCompleted=level;
 progress.totalVictories+=1;
 const score=Math.max(0,Math.floor(Number(g.score)||0));
 const time=Math.max(0,Number(g.sectorTime)||0);
 const hp=Math.max(0,Number(g.p.hp)||0);
 const medal=hp>=g.p.maxhp*.8?'gold':hp>=g.p.maxhp*.4?'silver':'bronze';
 const rank={bronze:1,silver:2,gold:3};
 const medals=rank[medal]>rank[rec.medal||'bronze']?medal:(rec.medal||medal);
 const missionRating=missionStars(g);if(g.mission)save.credits+=4+missionRating*4;
 progress.records[level]={...rec,missionType:g.mission?.type||'purge',bestStars:Math.max(Number(rec.bestStars)||0,missionRating),wins:(Number(rec.wins)||0)+1,bestScore:Math.max(Number(rec.bestScore)||0,score),
   bestTime:rec.bestTime==null?time:Math.min(rec.bestTime,time),medal:medals,lastClearedAt:Date.now()};
 // The later 99%+ armor tiers must be economically reachable without
 // endlessly farming early levels. First-clear bonuses scale by chapter.
 if(firstWin)save.credits+=15+Math.floor(level*1.5)+Math.round(level*20+level*level*.25);
 persist();
}

function toast(txt,time=1.5){const x=$('toast');x.textContent=txt;x.classList.add('show');clearTimeout(toast.id);toast.id=setTimeout(()=>x.classList.remove('show'),time*1000)}
function portalFlow(){
  if(portalRouteField&&portalRouteField.size===mapSize&&portalRouteField.x===Math.floor(portal.x)&&portalRouteField.z===Math.floor(portal.z))return portalRouteField.dist;
  const sz=mapSize,arr=new Int16Array(sz*sz);arr.fill(32767);
  const q=new Int16Array(sz*sz),px=Math.floor(portal.x),pz=Math.floor(portal.z);
  let head=0,tail=0;q[tail++]=pz*sz+px;arr[pz*sz+px]=0;
  while(head<tail){const cell=q[head++],x=cell%sz,z=(cell/sz)|0;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,nz=z+dz,k=nz*sz+nx;
      if(nx<1||nz<1||nx>=sz-1||nz>=sz-1||mapCells[nz][nx]!==0||arr[k]!==32767)continue;
      arr[k]=arr[cell]+1;q[tail++]=k;
    }
  }
  portalRouteField={size:sz,x:px,z:pz,dist:arr};return arr;
}
function portalRoute(p,limit=200){
  if(!game?.portalReady)return[];
  const d=portalFlow(),sz=mapSize,route=[{x:p.x,z:p.z}];
  let x=Math.floor(p.x),z=Math.floor(p.z),cost=d[z*sz+x];
  for(let i=0;i<limit&&cost>0&&cost<32767;i++){
    let bx=x,bz=z,bc=cost;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=sz||nz>=sz)continue;
      const c=d[nz*sz+nx];if(c<bc){bc=c;bx=nx;bz=nz;}
    }
    if(bc===cost)break;
    x=bx;z=bz;cost=bc;route.push({x:x+.5,z:z+.5});
  }
  return route;
}
function navArrow(p,target){let angle=Math.atan2(target.x-p.x,target.z-p.z)-p.yaw;let i=((Math.round(angle*4/Math.PI)%8)+8)%8;return ['↑','↗','→','↘','↓','↙','←','↖'][i]}
function updateHud(force=false){const g=game;if(!g||g.state!=='playing')return;const p=g.p;for(const [ability,id] of [['dash','dashTouch'],['pulse','pulseTouch'],['shield','shieldTouch'],['heal','healTouch']]){const btn=$(id);if(!btn)continue;const left=p.abilityCooldowns?.[ability]||0;btn.dataset.cooldown=left>.1?Math.ceil(left)+'с':'';btn.classList.toggle('recharging',left>.1);}$('hpFill').style.width=(p.hp/p.maxhp*100)+'%';$('energyFill').style.width=(p.energy/p.maxEnergy*100)+'%';$('armorFill').style.width=(p.maxArmor?p.armor/p.maxArmor*100:0)+'%';$('hpLabel').textContent=Math.ceil(p.hp)+'/'+Math.ceil(p.maxhp);$('energyLabel').textContent=Math.ceil(p.energy)+'/'+Math.ceil(p.maxEnergy);$('armorLabel').textContent=Math.round(p.armor)+'/'+Math.round(p.maxArmor)+(p.armorDelay>0?' ⌛':p.armor<p.maxArmor?' ↻':'');
 $('bodyArmorFill').style.width=(p.bodyArmorMax>0?p.bodyArmor/p.bodyArmorMax*100:0)+'%';
 $('bodyArmorLabel').textContent=p.bodyArmorMax>0?Math.ceil(p.bodyArmor)+'/'+Math.ceil(p.bodyArmorMax):'НЕТ';$('altimeter').textContent=p.flying?'✈ ПОЛЁТ · '+(p.feetY||0).toFixed(1)+' м':(p.feetY||0)>.15?'⤒ '+(p.feetY||0).toFixed(1)+' м':'';$('weaponName').textContent=weapons[p.weapon].icon+' '+weapons[p.weapon].short;$('weaponStats').textContent='НАГРЕВ '+Math.round(p.heat)+'% · '+(p.weapon+1)+'/'+weapons.length;$('killText').textContent='УНИЧТОЖЕНО '+g.kills+' · '+g.spawned+'/'+g.target;$('scoreText').textContent='ОЧКИ '+g.score.toLocaleString('ru');$('combo').textContent=g.combo>2?'КОМБО ×'+g.combo:'';const goal=g.portalReady?portal:(g.boss&&!g.boss.dead?g.boss:null);$('zoneText').textContent=sectorArchitecture+' · УЗЛЫ '+(g.nodes.length-g.nodesDestroyed)+'/'+g.nodes.length;const nearDevice=(g.devices||[]).filter(d=>!d.used).sort((a,b)=>distance(a,p)-distance(b,p))[0];
 const devHelp=$('deviceHint');if(devHelp){
  const close=nearDevice&&distance(nearDevice,p)<3.15;
  devHelp.textContent=close?(nearDevice.kind==='relay'?'⌁ РЕТРАНСЛЯТОР':nearDevice.kind==='coil'?'⚠ РАЗРЯДНИК':nearDevice.kind==='repair'?'✚ РЕМОНТНАЯ СТАНЦИЯ':'ϟ ЭНЕРГОСТАНЦИЯ')+' · '+(nearDevice.kind==='coil'?'подойди и удерживайся рядом':'подойди для активации')+(nearDevice.charge>0?' · '+Math.round(nearDevice.charge*100)+'%':''):'';
  devHelp.style.display=close?'block':'none';
 }
 const mi=g.mission,missionBox=$('missionHUD');if(missionBox&&mi){const def=MISSION_TYPES[mi.type]||MISSION_TYPES.purge;missionBox.innerHTML='<b>'+def.icon+' '+def.name+(g.portalReady?' · ✓':'')+'</b><span>'+missionCounter(g)+'</span><small>'+ (g.portalReady?'Портал открыт · следуй по маршруту':def.hint)+'</small>';}
 const from=v3(p.x,1.47+(p.feetY||0),p.z),aim=aimFromOperator(from);
 const wall=rayWall(from,aim,24),node=rayNode(from,aim,wall?wall.t:24);
 const label=$('eventLabel');const foe=node?null:rayEnemy(from,aim,wall?wall.t:24);
 if(node){label.textContent='◇ '+NODE_TYPES[node.node.type].name+' · '+Math.ceil(Math.max(0,node.node.hp))+' HP';label.style.opacity='.92';label.style.color=['#ffd0a0','#a1f1ff','#bbffcb'][node.node.type]}
 else if(foe){const e=foe.enemy;label.textContent='◈ '+(e.boss?'БОСС ':e.type.toUpperCase())+' · КОРПУС '+Math.ceil(Math.max(0,e.hp))+(e.maxProtection>0?' · ЗАЩИТА '+Math.ceil(Math.max(0,e.protection||0))+'/'+e.maxProtection:'');label.style.opacity='.92';label.style.color='#ffc886';}
 else label.style.opacity='0';
 const route=g.portalReady?portalRoute(p,4):[];const next=route[1]||portal;const walk=g.portalReady?portalFlow()[Math.floor(p.z)*mapSize+Math.floor(p.x)]:0;const waypoint=!g.portalReady?missionWaypoint(g):null;const missionWalk=waypoint?missionRouteTo(p,waypoint,5):[];const nextMission=missionWalk[1]||waypoint;const missionDist=waypoint?missionField(waypoint)[Math.floor(p.z)*mapSize+Math.floor(p.x)]:0;$('navSignal').textContent=g.portalReady?'◇ МАРШРУТ '+navArrow(p,next)+' · '+(walk<32767?walk:Math.round(distance(p,portal)))+' м':waypoint?'◆ ЦЕЛЬ '+navArrow(p,nextMission)+' · '+(missionDist<32767?missionDist:Math.round(distance(p,waypoint)))+' м':goal?'☠ БОСС · '+Math.round(distance(p,goal))+' м':'◈ '+sectorArchitecture+' · '+mapSize+'×'+mapSize;$('reticleShield').style.opacity=p.shield>0?.82:0;if(g.boss)$('bossFill').style.width=clamp(g.boss.hp/g.boss.maxhp*100,0,100)+'%';drawMinimap();}
