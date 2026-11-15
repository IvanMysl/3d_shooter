

// ===== DIRECTOR'S CUT / integrated runtime (same lexical scope as engine) =====
const dc={hitUntil:0,killUntil:0,showBadgeUntil:0,splashUntil:0,weaponUntil:0,shake:0,lastTarget:0,canvasNoise:null,noiseBuffer:null,
  lastHealth:0,splashShown:0};
function dcNamedEnemy(e){
  if(e.boss)return 'ВЛАДЫКА РАЗЛОМА';
  if(e.elite)return 'ЭЛИТНЫЙ БОЕВОЙ РОБОТ';
  return ({scout:'РАЗВЕДЧИК',charger:'ШТУРМОВИК',brute:'ТЯЖЁЛЫЙ ДРОИД',sniper:'СНАЙПЕР',medic:'РЕМОНТНЫЙ ДРОН',shooter:'СТРЕЛОК',warden:'СТРАЖ БАРЬЕРА',artillery:'АРТИЛЛЕРИСТ',raider:'КВАНТОВЫЙ РЕЙДЕР',interceptor:'НЕБЕСНЫЙ ПЕРЕХВАТЧИК',drone:'НЕБЕСНЫЙ ПЕРЕХВАТЧИК',skyhunter:'ФАЗОВЫЙ ОХОТНИК',skyguard:'НЕБЕСНЫЙ СТРАЖ',stormray:'ГРОЗОВОЙ СКАТ'})[e.type]||'БОЕВАЯ МАШИНА';
}
function dcBadge(message,duration=1.05){
  const el=$('combatBadge');if(!el)return;
  el.textContent=message;el.classList.add('visible');
  dc.showBadgeUntil=performance.now()+duration*1000;
}
function dcWeaponFlash(message){
  const el=$('weaponBanner');if(!el)return;
  el.textContent=message;el.classList.add('visible');
  dc.weaponUntil=performance.now()+1000;
}
function dcSplash(level){
  const el=$('missionSplash');
  if(!el)return;
  const mt=missionInfo(level);
  el.querySelector('.dcIndex').textContent='ECLIPSE PROTOCOL  /  ОПЕРАЦИЯ '+String(level).padStart(3,'0');
  el.querySelector('.dcTitle').textContent=stageName(level);
  el.querySelector('.dcSub').textContent=mt.name+'  •  '+mt.hint;
  el.classList.add('visible');
  dc.splashUntil=performance.now()+1900;
}
// Layered audio: subtle buffered transients, synthesized locally without files.
function dcAudioTransient(w){
 if(!ac||!save.settings.audio)return;
 try{
  if(!dc.noiseBuffer){
    const length=Math.ceil(ac.sampleRate*.20),buf=ac.createBuffer(1,length,ac.sampleRate),dat=buf.getChannelData(0);
    for(let i=0;i<length;i++)dat[i]=(Math.random()*2-1)*Math.exp(-i/(length*.17));
    dc.noiseBuffer=buf;
  }
  const src=ac.createBufferSource(),filter=ac.createBiquadFilter(),gain=ac.createGain();
  src.buffer=dc.noiseBuffer;
  const heavy=!!w.blast||!!w.pierce,shotgun=w.shots>1;
  filter.type='bandpass';filter.frequency.value=heavy?590:shotgun?1100:1900;filter.Q.value=0.8;
  const volume=heavy?.076:shotgun?.060:.028;
  gain.gain.setValueAtTime(volume,ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001,ac.currentTime+(heavy?.20:.095));
  src.connect(filter);filter.connect(gain);gain.connect(ac.destination);
  src.start(ac.currentTime);src.stop(ac.currentTime+.20);
 }catch(e){}
}
const dcMuzzleBase=muzzleVisual;
muzzleVisual=function(w){dcMuzzleBase(w);dc.shake=Math.min(.4,dc.shake+(w.recoil||.2)*.10);dcAudioTransient(w);};
const dcDamageBase=damagePlayer;
damagePlayer=function(value){
  const hp=game?.p?.hp,armor=game?.p?.armor;
  const result=dcDamageBase(value);
  if(game && (game.p.hp<hp||game.p.armor<armor)){
    dc.shake=Math.min(.48,dc.shake+.17);
    const el=$('warningFrame');if(el){el.style.opacity=String(clamp(.22+value*.011,.32,.85));}
  }
  return result;
};
const dcDamageNumberBase=showDamage;
showDamage=function(e,amount,critical){
  dcDamageNumberBase(e,amount,critical);
  const now=performance.now(),c=$('crosshair');
  dc.hitUntil=now+170;
  if(c){c.classList.add('dcHit');}
  if(critical && game && Math.random()<.42)dcBadge('◆ КРИТИЧЕСКОЕ ПОПАДАНИЕ',.63);
};
const dcAwardKillBase=awardKill;
awardKill=function(e){
  const result=dcAwardKillBase(e);
  dc.killUntil=performance.now()+290;
  const c=$('crosshair');if(c)c.classList.add('dcKill');
  if(e.boss)dcBadge('✦ ПОВЕЛИТЕЛЬ ПОВЕРЖЕН',2.3);
  else if(e.elite)dcBadge('✦ ЭЛИТНАЯ ЦЕЛЬ УНИЧТОЖЕНА',1.3);
  else if(game && game.combo>1 && game.combo%4===0)dcBadge('✦ СЕРИЯ '+game.combo+' УНИЧТОЖЕНИЙ',1.0);
  return result;
};
const dcSwitchBase=switchWeapon;
switchWeapon=function(to){
  const old=game?.p?.weapon;
  const result=dcSwitchBase(to);
  if(game && old!==game.p.weapon){
    const w=weapons[game.p.weapon];
    dcWeaponFlash('◈ '+w.name+'  ·  '+Math.round(w.damage)+' УРОНА');
  }
  return result;
};
const dcEnterSectorBase=enterSector;
enterSector=function(level){
  const result=dcEnterSectorBase(level);
  if(game){dcSplash(level);dc.shake=0;dc.lastHealth=game.p.hp;}
  return result;
};
const dcRenderBase=render;
render=function(){
  dcRenderBase();
  if(!game)return;
  const g=game,p=g.p,now=performance.now();
  const c=$('crosshair');
  if(c){
    if(dc.hitUntil<now)c.classList.remove('dcHit');
    if(dc.killUntil<now)c.classList.remove('dcKill');
  }
  if(dc.showBadgeUntil<now)$('combatBadge')?.classList.remove('visible');
  if(dc.weaponUntil<now)$('weaponBanner')?.classList.remove('visible');
  if(dc.splashUntil<now)$('missionSplash')?.classList.remove('visible');
  const hit=$('warningFrame');if(hit){hit.style.opacity=String(Math.max(0,Number(hit.style.opacity||0)-.085));}
  // Dynamic target intelligence: only a visible target near the crosshair.
  if(now-dc.lastTarget>90){
    dc.lastTarget=now;
    const intel=$('targetIntel');
    if(intel && g.state==='playing'){
      let target=null,rank=-1;
      for(const e of g.enemies){
        if(e.dead)continue;
        const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz);
        if(d<1||d>22||!lineClear(p.x,p.z,e.x,e.z))continue;
        const a=Math.atan2(dx,dz)-p.yaw;
        const theta=Math.atan2(Math.sin(a),Math.cos(a));
        const center=Math.abs(theta),hY=(Number.isFinite(e.feetY)?e.feetY:0)+1.05-(p.feetY||0)-1.47;
        const pitch=Math.atan2(hY,d);
        const error=center+Math.abs(pitch-p.pitch)*.7;
        if(error<.19&&(rank<0||error<rank)){target=e;rank=error;}
      }
      if(target){
        intel.querySelector('.dcTargetTitle').textContent=dcNamedEnemy(target)+'  ·  '+Math.ceil(target.hp)+' HP';
        intel.querySelector('.dcTargetFill').style.width=(clamp(target.hp/Math.max(1,target.maxhp),0,1)*100)+'%';
        intel.classList.add('visible');
      }else intel.classList.remove('visible');
    }else intel?.classList.remove('visible');
  }
  dc.shake*=.86;
  // Recoil and movement response are non-destructive screen offsets; the
  // actual projection/collision direction stays unchanged.
  if(dc.shake>.012){
    const px=(Math.random()-.5)*dc.shake*7,py=(Math.random()-.5)*dc.shake*5;
    glCanvas.style.transform='translate('+px.toFixed(2)+'px,'+py.toFixed(2)+'px) scale(1.006)';
  }else if(glCanvas.style.transform)glCanvas.style.transform='';
};
// An immersive mission tile in the hub; inherited persistence and campaign logic.
const dcUpgradeBase=showUpgrade;
showUpgrade=function(savedIDs=null){
 dc.splashUntil=0;$('missionSplash')?.classList.remove('visible');
 return dcUpgradeBase(savedIDs);
};
const dcPauseBase=pause;
pause=function(){
 dc.splashUntil=0;$('missionSplash')?.classList.remove('visible');
 return dcPauseBase();
};

const dcUpdateBase=update;
update=function(dt){
  if(game?.state==='playing' && performance.now()<dc.splashUntil){input.jumpQueued=false;return;}
  return dcUpdateBase(dt);
};
