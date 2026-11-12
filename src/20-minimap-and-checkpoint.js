
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
  if(g.mission?.type==='recovery')for(const c of g.mission.caches)if(!c.got){const [x,z]=plot(c.x,c.z);m.fillStyle='#e5f8ff';m.shadowColor='#38dcff';m.shadowBlur=9;m.beginPath();m.moveTo(x,z-4.7);m.lineTo(x+4.7,z);m.lineTo(x,z+4.7);m.lineTo(x-4.7,z);m.closePath();m.fill();m.shadowBlur=0;}
  if(g.arenaEvent?.phase==='warning'){const a=g.arenaEvent;const [x,z]=plot(a.x,a.z);m.strokeStyle=a.kind==='thermal'?'#ff844f':'#73e5ff';m.lineWidth=2;m.beginPath();m.arc(x,z,a.r*scale,0,TAU);m.stroke();}
  for(const d of (g.devices||[]))if(!d.used){
    const [dx,dz]=plot(d.x,d.z),color=d.kind==='coil'?'#ff7257':d.kind==='relay'?'#ffe08c':d.kind==='repair'?'#71f7ad':'#78dfff';
    m.save();m.fillStyle=color;m.shadowColor=color;m.shadowBlur=miniZoom?6:3;
    m.fillRect(dx-(miniZoom?3:2),dz-(miniZoom?3:2),miniZoom?6:4,miniZoom?6:4);m.restore();
  }
  for(const n of g.nodes)if(!n.dead){const [x,z]=plot(n.x,n.z);m.fillStyle=['#ff873f','#65deff','#77ff94'][n.type];m.fillRect(x-2.4,z-2.4,4.8,4.8);}if(g.portalReady){const [x,z]=plot(portal.x,portal.z);m.shadowBlur=10;m.shadowColor='#7affef';m.fillStyle='#76ffed';m.beginPath();m.arc(x,z,miniZoom?5:3,0,TAU);m.fill();m.shadowBlur=0;}
  for(const e of g.enemies){if(e.dead)continue;const [x,z]=plot(e.x,e.z);m.fillStyle=e.boss?'#ffcf7a':'#ff6c96';m.beginPath();m.arc(x,z,e.boss?5:2.1,0,TAU);m.fill();
    if(e.boss&&e.ultWarn>0){m.strokeStyle='#ff8748';m.lineWidth=2;m.beginPath();m.arc(x,z,5.15*scale,0,TAU);m.stroke();}
  }
  const [x,z]=plot(g.p.x,g.p.z);
  m.save();m.translate(x,z);/* Canvas map uses +Z downward while the arrow is drawn pointing upward.
     Rotate by PI-yaw so the arrow points along the actual forward velocity:
     (sin(yaw),cos(yaw)) in map coordinates. */m.rotate(Math.PI-g.p.yaw);m.fillStyle='#eaffff';m.shadowColor='#a9ffff';m.shadowBlur=7;
  m.beginPath();m.moveTo(0,-6);m.lineTo(4,5);m.lineTo(0,2);m.lineTo(-4,5);m.closePath();m.fill();m.restore();m.restore();
  m.fillStyle='#c8f2fa';m.font='bold 13px system-ui';m.textAlign='left';m.fillText(miniZoom?'◈ РАДАР':'◈ ВЕСЬ СЕКТОР',7,15);
  $('radarLabel').textContent=(miniZoom?'КАРТА: ПРИБЛИЖЕНИЕ':'КАРТА: ВЕСЬ СЕКТОР')+(deckHeight(g.p.x,g.p.z)>0&&g.p.feetY>BRIDGE_Y-.3?' · УРОВЕНЬ 2':' · УРОВЕНЬ 1');
}
function pickUpgrades(){let copy=[...upgrades].sort(()=>Math.random()-.5);return copy.slice(0,3)}function saveRun(){
 const g=game;if(!g||g.state==='dead')return false;
 const keys=['sectorTime','t','target','spawned','waveDelay','enemies','bullets','tracers','projectiles','burstQueue','loot','nodes','nodesDestroyed','portalReady','idCounter','combo','comboAt','helpTime','totalCredits','decals','scorch','mission','arenaEvent','devices','robotDebris'];
 const live={};for(const k of keys)live[k]=g[k];
 save.checkpoint={version:3,mapSchema:(g.sector===legacyResumeSector?(legacyResumeDivisor===10?'v10':legacyResumeDivisor===12?'v12':legacyResumeDivisor===14?'v14':'v16'):'v18'),state:g.state==='upgrade'?'upgrade':'playing',sector:g.sector,player:{...g.p},score:g.score,kills:g.kills,upgrades:{...g.upgrades},pendingUpgrade:g.pendingUpgrade||null,live};
 const ok=persist();if(!ok){saveNotice('⚠ БРАУЗЕР ЗАПРЕТИЛ СОХРАНЕНИЕ · ЭКСПОРТИРУЙ РЕЗЕРВНУЮ КОПИЮ');}return ok;
}
function restoreLiveCheckpoint(ck){
 if(!ck||ck.version<3||!ck.live)return;
 const g=game;for(const [k,v] of Object.entries(ck.live)){if(Object.prototype.hasOwnProperty.call(g,k))g[k]=v;}
 Object.assign(g.p,ck.player||{});
 g.p.weapon=clamp(g.p.weapon|0,0,weapons.length-1);
 if(!Number.isFinite(g.p.feetY))g.p.feetY=floorHeight(g.p.x,g.p.z);
 if(!Number.isFinite(g.p.vy))g.p.vy=0;
 if(typeof g.p.grounded!=='boolean')g.p.grounded=true;
 g.p.armor=clamp(Number(g.p.armor)||0,0,g.p.maxArmor||30);
 if(!Number.isFinite(g.p.x)||!Number.isFinite(g.p.z)||collide(g.p.x,g.p.z,.23)){g.p.x=spawnX;g.p.z=spawnZ;}
 g.enemies=(g.enemies||[]).filter(e=>e&&!e.dead);g.boss=g.enemies.find(e=>e.boss)||null;
 g.bullets=g.bullets||[];g.tracers=g.tracers||[];g.projectiles=g.projectiles||[];g.burstQueue=g.burstQueue||[];
 g.loot=g.loot||[];g.nodes=g.nodes||[];g.robotDebris=Array.isArray(g.robotDebris)?g.robotDebris.slice(-72):[];g.decals=g.decals||[];g.scorch=g.scorch||[];g.devices=Array.isArray(g.devices)?g.devices:[];if(!ck.live?.mission||!g.mission||!g.mission.version){g.mission={version:1,type:'purge',done:0,required:0,caches:[],hazardsHit:0,hazardsEvaded:0,sentinelId:0};}g.arenaEvent=g.arenaEvent||{phase:'quiet',countdown:14,kind:'emp',x:0,z:0,r:3.4,warning:0};g.p.armorDelay=Math.max(0,Number(g.p.armorDelay)||0);g.p.armorRegen=Math.max(0,Number(g.p.armorRegen)||2.6);
 g.pendingUpgrade=ck.pendingUpgrade||null;g.state=ck.state==='upgrade'?'upgrade':'playing';
 navField=null;navClock=0;portalRouteField=null;decalDirty=true;
 $('sectorText').textContent=String(g.sector).padStart(2,'0')+' · '+sectorArchitecture;
 $('gun').dataset.gun=String(g.p.weapon);$('bossWrap').style.display=g.boss?'block':'none';
}
// Auto-save during combat and on app/browser lifecycle transitions.
setInterval(()=>{if(game&&game.state!=='dead')saveRun();},2600);
addEventListener('pagehide',()=>{if(game&&game.state!=='dead')saveRun();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game&&game.state!=='dead')saveRun();});

function panel(html){$('panel').innerHTML=html+'<div class="line"></div><div class="row"><button class="secondary" type="button" data-fs>⛶ ПОЛНЫЙ ЭКРАН</button></div>';updateFullscreenButtons();$('overlay').classList.remove('hidden');$('hud').classList.remove('show')}