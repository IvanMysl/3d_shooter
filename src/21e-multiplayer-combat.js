// MP-4: small-room authoritative combat. The host alone decides shots, damage,
// scoring, deaths, respawn and weapon cooldowns; peers send controls only.
// Solo upgrades/purchased suits are deliberately NOT used in PvP: a browser
// cannot prove ownership of an offline save. No ranked anti-cheat is claimed.
const MP4_RESPAWN_TICKS=90,MP4_SPAWN_SHIELD_TICKS=45;

function mpCombatInit(){
 const m=mpMatch;if(!m)return;
 for(const a of m.actors.values()){
  a.kills=0;a.deaths=0;a.respawnAt=0;a.invulnUntil=m.tick+MP4_SPAWN_SHIELD_TICKS;
  a.bursts=[];a.spawn={x:a.p.x,z:a.p.z};
 }
 const el=document.createElement('div');el.id='mpCombatScore';el.setAttribute('role','status');
 document.body.appendChild(el);
 mpCombatSyncHud();
}
function mpCombatSyncHud(){
 const m=mpMatch,el=$('mpCombatScore');if(!m?.active||!el)return;
 const team=m.settings.mode==='teams';
 const rows=[...m.actors.values()].sort((a,b)=>(b.kills||0)-(a.kills||0)||a.id-b.id);
 const scores=rows.map(a=>`${a.id===m.self?'▶ ':''}${a.nick}: ${a.kills||0}/${a.deaths||0}`+
  `${a.respawnAt>m.tick?' ⏳':a.invulnUntil>m.tick?' 🛡':''}`);
 const teamScore=team?'🔵 '+rows.filter(a=>a.team===0).reduce((v,a)=>v+(a.kills||0),0)+
  ' : '+rows.filter(a=>a.team===1).reduce((v,a)=>v+(a.kills||0),0)+' 🟠 · ':'';
 const p=m.actors.get(m.self)?.p;
 el.textContent=teamScore+scores.join(' · ')+(p?' · ♥ '+Math.ceil(p.hp)+' / ◇ '+Math.ceil(p.armor):'');
}
function mpCombatSelect(a,requested){
 const m=mpMatch,p=a.p;
 const next=m.settings.equipment==='equal'?m.settings.weapon:requested;
 if(Number.isInteger(next)&&next>=0&&next<weapons.length&&p.weapon!==next){
  p.weapon=next;p.cooldown=Math.max(p.cooldown,.15);a.bursts.length=0;
 }
}
function mpCombatOrigin(p){return {x:p.x,y:p.feetY+1.47,z:p.z};}
function mpCombatDirection(p,spread=0){
 const yaw=p.yaw+(Math.random()-.5)*spread*2;
 const pitch=clamp(p.pitch+(Math.random()-.5)*spread*2,-1.1,1.04);
 return {x:Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:Math.cos(yaw)*Math.cos(pitch)};
}
function mpCombatPoint(o,d,t){return {x:o.x+d.x*t,y:o.y+d.y*t,z:o.z+d.z*t};}
function mpCombatTarget(shooter,o,d,limit){
 let best=null;
 for(const a of mpMatch.actors.values()){
  if(a===shooter||a.p.hp<=0||a.respawnAt>mpMatch.tick)continue;
  const p=a.p,head={x:p.x,y:p.feetY+1.58,z:p.z},
   chest={x:p.x,y:p.feetY+.89,z:p.z};
  const h=rayEllipsoid(o,d,head,.245,.255,.245,limit);
  const b=rayEllipsoid(o,d,chest,.36,.70,.34,limit);
  const t=h===null?b:b===null?h:Math.min(h,b);
  if(t!==null&&(!best||t<best.t))best={actor:a,t,head:h!==null&&h<=t+.0001};
 }
 return best;
}
function mpCombatHit(shooter,target,raw,head=false){
 const m=mpMatch;if(!m?.host||target.p.hp<=0||target.respawnAt>m.tick||target.invulnUntil>m.tick)return false;
 if((target.p.shield||0)>0)return false;
 const p=target.p,amount=Math.max(0,Math.min(350,raw*(head?1.42:1)));
 const shield=Math.min(p.armor,amount*.72);
 p.armor=Math.max(0,p.armor-shield);
 p.hp=Math.max(0,p.hp-(amount-shield));
 if(p.hp<=0){
  target.deaths++;target.respawnAt=m.tick+MP4_RESPAWN_TICKS;
  if(shooter===target)shooter.kills--;
  else if(m.settings.mode==='teams'&&shooter.team===target.team)
   shooter.kills--; // Friendly fire damages; team kills penalize even at zero.
  else shooter.kills++;
  mpCombatEmit('down',mpCombatOrigin(p),mpCombatOrigin(p),shooter.p.weapon,target.id);
 }
 return true;
}
function mpCombatVisible(from,to){
 const dx=to.x-from.x,dy=to.y-from.y,dz=to.z-from.z,dist=Math.hypot(dx,dy,dz);
 if(dist<.001)return true;
 const d={x:dx/dist,y:dy/dist,z:dz/dist};
 const hit=rayWall(from,d,Math.max(0,dist-.16));
 return !hit||hit.t>=dist-.17;
}
function mpCombatBlast(shooter,point,w,direct=null,wall=null){
 const r=w.blast||1.15;
 const hits=[];
 for(const a of mpMatch.actors.values()){
  if(a.p.hp<=0||a.respawnAt>mpMatch.tick)continue;
  const center={x:a.p.x,y:a.p.feetY+1.02,z:a.p.z};
  const distance=Math.max(0,Math.hypot(center.x-point.x,center.y-point.y,center.z-point.z)-.33);
  if(distance>r||(a!==direct&&!mpCombatVisible(point,center)))continue;
  const factor=a===direct?1:.24+.60*Math.pow(1-distance/r,1.3);
  const damaged=mpCombatHit(shooter,a,w.damage*factor);
  hits.push(a.id*4+(damaged?0:1));
 }
 const gun=weapons.findIndex(v=>v===w||v.name===w.name);
 mpCombatEmit('blast',point,point,gun>=0?gun:shooter.p.weapon,direct?.id??-1,hits,shooter.id,wall);
}
function mpCombatWallDataValid(a){
 return Array.isArray(a)&&a.length===12&&a.every(n=>Number.isFinite(n)&&Math.abs(n)<1000)&&
  a.slice(3,6).every(n=>Math.abs(n)<=1.001)&&Math.hypot(...a.slice(3,6))>.5&&
  [0,1,2].every(i=>a[i+6]<=a[i+9]&&a[i]>=a[i+6]-.04&&a[i]<=a[i+9]+.04);
}
function mpCombatEmit(type,start,end,weapon,targetId=-1,hits=null,shooterId=-1,wall=null,repair=null){
 const m=mpMatch;if(!m?.host)return;
 const event={v:MP_VERSION,kind:'mp3-effect',token:m.token,
  type,gun:weapon,id:targetId,
  a:[+start.x.toFixed(2),+start.y.toFixed(2),+start.z.toFixed(2)],
  b:[+end.x.toFixed(2),+end.y.toFixed(2),+end.z.toFixed(2)]};
 // Hit metadata rides in the EXISTING shot/blast event: no extra RTC packets.
 // Up to eight actors; two flags per actor: headshot and absorbed/invulnerable.
 if(hits?.length){event.h=hits;if(shooterId>=0)event.s=shooterId;}
 if((type==='shot'||type==='blast')&&wall){
  const bounds=wall.solid?.box||wall.box;
  if(bounds?.length===6){const data=[wall.x,wall.y,wall.z,wall.nx,wall.ny,wall.nz,...bounds].map(n=>Number.isFinite(n)?+n.toFixed(4):NaN);if(mpCombatWallDataValid(data)){if(type==='shot')event.wall=data;else event.surface=data;}}
 }
 if(type==='heal'&&['hp','armor'].includes(repair))event.repair=repair;
 mpCombatReceiveEffect(event);
 for(const a of m.actors.values())if(!a.host)mpRtcFastSend(a.peerId,event);
}
function mpCombatPlayerHitFx(code,source){
 const m=mpMatch,g=game,id=code>>2,actor=m?.actors.get(id);
 if(!actor||!g)return;
 const p=actor.p,head=!!(code&2),blocked=!!(code&1);
 operatorHitReaction(p,source,{head,blocked});
 if(id===m.self&&!blocked)m.hurtPulse=Math.max(m.hurtPulse||0,.14);
}
function mpCombatReceiveEffect(data){
 if(!mpMatch?.active||data.token!==mpMatch.token||!['shot','blast','down','spawn','dash','pulse','shield','heal'].includes(data.type)||
  !Number.isInteger(data.gun)||data.gun<0||data.gun>=weapons.length||
  !Array.isArray(data.a)||data.a.length!==3||!Array.isArray(data.b)||data.b.length!==3||
  (data.h!==undefined&&(!['shot','blast'].includes(data.type)||!Array.isArray(data.h)||
   data.h.length>MP_CAP||!data.h.every(code=>Number.isInteger(code)&&code>=0&&code<MP_CAP*4)))||
  (data.s!==undefined&&(!Number.isInteger(data.s)||!mpMatch.actors.has(data.s)))||
  (data.wall!==undefined&&(data.type!=='shot'||!mpCombatWallDataValid(data.wall)))||
  (data.surface!==undefined&&(data.type!=='blast'||!mpCombatWallDataValid(data.surface)))||
  (data.repair!==undefined&&(data.type!=='heal'||!['hp','armor'].includes(data.repair)))||
  ![...data.a,...data.b].every(n=>Number.isFinite(n)&&Math.abs(n)<1000))return;
 const listener=game.p,w=weapons[data.gun];
 const gainAt=(x,y,z)=>Math.max(0,1-Math.hypot(x-listener.x,y-((listener.feetY||0)+1.1),z-listener.z)/24);
 if(data.type==='shot'&&Number.isInteger(data.id)){
  // The existing event's id field now identifies the shooter. No extra
  // network message is needed to animate each peer's visible weapon.
  const actor=mpMatch.actors.get(data.id);
  if(actor){
   // Each shotgun pellet has a tracer, but only one sound/recoil per volley.
   const now=mpMatch.host?mpMatch.tick*(1000/30):Date.now(),self=data.id===mpMatch.self;
   if(now-(actor.lastShotFxAt??-Infinity)>=25||actor.lastShotFxGun!==data.gun){
    actor.lastShotFxAt=now;actor.lastShotFxGun=data.gun;
    applyWeaponShotPose(actor.p,w);
    if(self){
     if(typeof muzzleVisual==='function')muzzleVisual(w);else emitWeaponSound(w);
    }else emitWeaponSound(w,gainAt(data.a[0],data.a[1],data.a[2]));
   }
  }
 }
 const localView=data.type==='shot'&&data.id===mpMatch.self&&!externalCameraEnabled();
 // The host keeps authoritative collision/projectile positions at the actual
 // world avatar's barrel. Only this client's first-person tracer is moved to
 // its screen-space viewmodel muzzle; packet size and hit logic stay intact.
 const a=localView&&glReady?heldWeaponMuzzleWorld(game,game.p):
  {x:data.a[0],y:data.a[1],z:data.a[2]};
 let b={x:data.b[0],y:data.b[1],z:data.b[2]};
 if(localView&&weapons[data.gun].mode==='projectile'){
  // Locally display the launch line and first frames of the projectile at
  // the viewmodel barrel. The host's real projectile remains untouched.
  const world={x:data.a[0],y:data.a[1],z:data.a[2]};
  const vx=b.x-world.x,vy=b.y-world.y,vz=b.z-world.z;
  const length=Math.hypot(vx,vy,vz);
  if(length>.001){
   const dir={x:vx/length,y:vy/length,z:vz/length};
   b={x:a.x+dir.x*length,y:a.y+dir.y*length,z:a.z+dir.z*length};
   (mpMatch.localLaunches||(mpMatch.localLaunches=[])).push({
    gun:data.gun,world,view:a,dir,at:Date.now()});
   if(mpMatch.localLaunches.length>8)mpMatch.localLaunches.shift();
  }
 }
 if(data.type==='shot'&&Number.isInteger(data.id)){
  if(data.wall&&typeof addImpact==='function'){
   const [x,y,z,nx,ny,nz,...bounds]=data.wall;
   addImpact({x,y,z,nx,ny,nz,kind:'solid',solid:{box:bounds}},w,w.pierce?1.8:.85);
  }
 }
 if(data.type==='shot'){
  // Projectile launch packets carry a direction for muzzle interpolation,
  // not a visible extra laser. Campaign also renders only the actual orb.
  if(w.mode!=='projectile')emitShotTracer(a,b,w,w.shots>1?.48:1,localView);
 }
 else if(data.type==='dash'){
  // The network dash path is intentionally visible to other participants.
  game.tracers.push({a,b,localView:false,life:.24,maxLife:.24,r:.10,col:[.3,1,.97]});
  const cap=typeof touchOnly!=='undefined'&&touchOnly?35:65;
  if(game.tracers.length>cap)game.tracers.splice(0,game.tracers.length-cap);
  emitDashFx(b.x,b.y-.7,b.z,data.id===mpMatch.self?1:gainAt(b.x,b.y,b.z));
 }
 else if(data.type==='pulse'){
  // An EMI event is not a bullet impact. Use the campaign particle emitter
  // at the authoritative actor position, including airborne pulses.
  const p=game.p,dist=Math.hypot(b.x-p.x,b.y-((p.feetY||0)+1.1),b.z-p.z);
  emitPulseFx(b.x,b.y,b.z,data.id===mpMatch.self?.2:.2*Math.max(0,1-dist/24));
 }else if(data.type==='shield')emitShieldFx(b.x,b.y,b.z,data.id===mpMatch.self?1:gainAt(b.x,b.y,b.z));
 else if(data.type==='heal')emitRepairFx(b.x,b.y-.1,b.z,data.repair||'hp',data.id===mpMatch.self?1:gainAt(b.x,b.y,b.z));
 else if(data.type==='blast'){
  // Surface contact is visual metadata only. The authoritative blast center
  // and damage/cover calculation are deliberately NOT displaced.
  let visual=b;
  if(data.surface){
   const [x,y,z,nx,ny,nz,...bounds]=data.surface;
   visual=projectileSurfaceFx({x,y,z,nx,ny,nz,kind:'solid',solid:{box:bounds}},w);
  }
  emitExplosionFx(visual.x,visual.y,visual.z,w,w.blast||1.15,gainAt(visual.x,visual.y,visual.z));
 }
 else game.impactFx.push({x:b.x,y:b.y,z:b.z,life:.35,maxLife:.35,r:.27,col:w.color});
 if((data.type==='down'||data.type==='spawn')&&game.impactFx.length>35)game.impactFx.splice(0,game.impactFx.length-35);
 if(data.h?.length){
  const shooter=data.type==='shot'?data.id:data.s;
  let actualHit=false;
  for(const code of new Set(data.h)){
   if(!(code&1))actualHit=true;
   mpCombatPlayerHitFx(code,{x:data.a[0],y:data.a[1],z:data.a[2]});
  }
  if(shooter===mpMatch.self&&actualHit){
   mpMatch.hitConfirm=Math.max(mpMatch.hitConfirm||0,.16);
   mpMatch.lastHitConfirm=mpMatch.hitConfirm;
   $('crosshair')?.classList.add('hit');
  }
 }
}
// Keep host-authoritative collision and each client's displayed projectile
// at the SAME physical radius as the single-player ordnance (Stage78).
// Covers close grazing hits on brackets, railings, shutters and gunport edges.
function mpProjectileRadius(w){return w?.name?.includes('ГРОМ')?.20:.13;}
function mpCombatOrdnance(){
 return mpMatch.projectiles.slice(0,72).map(s=>({x:+s.pos.x.toFixed(2),y:+s.pos.y.toFixed(2),
  z:+s.pos.z.toFixed(2),vx:+s.v.x.toFixed(1),vy:+s.v.y.toFixed(1),vz:+s.v.z.toFixed(1),
  gun:weapons.indexOf(s.w)}));
}
function mpCombatApplyOrdnance(list){
 if(!Array.isArray(list)||list.length>(mpMatch?.host?72:48))return;
 const display=[];
 // A tiny visual-only offset bridges the avatar barrel and first-person
 // model for about 220 ms; host collision positions are never modified.
 const now=Date.now(),launches=(mpMatch?.localLaunches||[]).filter(r=>now-r.at<220);
 if(mpMatch)mpMatch.localLaunches=launches;
 const used=new Set();
 for(const obj of list){
  if(!obj||![obj.x,obj.y,obj.z,obj.vx,obj.vy,obj.vz].every(n=>Number.isFinite(n)&&Math.abs(n)<1000)||
   !Number.isInteger(obj.gun)||weapons[obj.gun]?.mode!=='projectile')return;
  const shot={x:obj.x,y:obj.y,z:obj.z,vx:obj.vx,vy:obj.vy,vz:obj.vz,
   w:weapons[obj.gun],rad:mpProjectileRadius(weapons[obj.gun])};
  let match=null,score=Infinity;
  for(const r of launches){
   if(r.gun!==obj.gun||used.has(r))continue;
   const age=Math.max(0,(now-r.at)/1000),speed=weapons[obj.gun].speed;
   const err=Math.hypot(obj.x-r.world.x-r.dir.x*speed*age,
    obj.y-r.world.y-r.dir.y*speed*age,obj.z-r.world.z-r.dir.z*speed*age);
   if(err<2.5+speed*age*.5&&err<score){match=r;score=err;}
  }
  if(match){
   used.add(match);
   const fade=Math.max(0,1-(now-match.at)/220);
   shot.localView=true;shot.localLaunchFade=fade;
   shot.visualPoint={x:shot.x+(match.view.x-match.world.x)*fade,
    y:shot.y+(match.view.y-match.world.y)*fade,
    z:shot.z+(match.view.z-match.world.z)*fade};
  }
  display.push(shot);
 }
 game.projectiles=display;
}
function mpCombatShot(shooter,w){
 const o=mpCombatOrigin(shooter.p),d=mpCombatDirection(shooter.p,w.spread||0);
 const index=weapons.findIndex(v=>v===w||v.name===w.name),gun=index>=0?index:shooter.p.weapon;
 const muzzle=operatorMuzzlePoint(shooter.p,gun);
 if(w.mode==='projectile'){
  const m=mpMatch;
  const wall=rayWall(o,d,w.range),limit=wall?Math.min(w.range,wall.t):w.range;
  const target=mpCombatTarget(shooter,o,d,limit);
  const direction=directionFromMuzzle(o,d,muzzle,target?.t??limit);
  if(m.projectiles.length<72)m.projectiles.push({shooter:shooter.id,w,
   rad:mpProjectileRadius(w),
   pos:muzzle,v:{x:direction.x*w.speed,y:direction.y*w.speed,z:direction.z*w.speed},life:w.range/w.speed});
  mpCombatEmit('shot',muzzle,mpCombatPoint(muzzle,direction,Math.min(1.5,w.range)),gun,shooter.id);
  return;
 }
 const wall=rayWall(o,d,w.range),stop=wall?Math.min(w.range,wall.t):w.range;
 let limit=stop,penetrations=Math.max(1,Math.min(4,w.pierce||1));
 const struck=new Set(),hits=[];
 while(penetrations-->0){
  let target=null;
  for(const a of mpMatch.actors.values()){
   if(a===shooter||struck.has(a.id)||a.p.hp<=0||a.respawnAt>mpMatch.tick)continue;
   const p=a.p,head=rayEllipsoid(o,d,{x:p.x,y:p.feetY+1.58,z:p.z},.245,.255,.245,limit);
   const chest=rayEllipsoid(o,d,{x:p.x,y:p.feetY+.89,z:p.z},.36,.70,.34,limit);
   const t=head===null?chest:chest===null?head:Math.min(head,chest);
   if(t!==null&&(!target||t<target.t))target={a,t,head:head!==null&&head<=t+.0001};
  }
  if(!target)break;
  struck.add(target.a.id);
  const damaged=mpCombatHit(shooter,target.a,w.damage,target.head);
  hits.push(target.a.id*4+(target.head?2:0)+(damaged?0:1));
  if(!w.pierce)break;
 }
 mpCombatEmit('shot',muzzle,mpCombatPoint(o,d,stop),gun,shooter.id,hits,-1,wall);
}
function mpCombatProjectileStep(dt){
 const m=mpMatch;
 for(const s of m.projectiles){
  const shooter=m.actors.get(s.shooter);
  if(!shooter){s.life=0;continue;}
  const old=s.pos,travel=Math.hypot(s.v.x,s.v.y,s.v.z)*dt;
  if(travel<=.00001){s.life=0;continue;}
  const dir={x:s.v.x*dt/travel,y:s.v.y*dt/travel,z:s.v.z*dt/travel};
  // The ray-only path missed real visible obstacles grazed by a rocket's
  // rim. The host must use the exact continuous sphere-vs-world collision
  // already used in solo play, including solids inside wall-map cells.
  const wall=sweepWorldSphere(old,dir,travel,s.rad??mpProjectileRadius(s.w));
  const limit=wall?Math.min(travel,wall.t):travel;
  const impact=mpCombatTarget(shooter,old,dir,limit);
  if(impact){s.pos=mpCombatPoint(old,dir,impact.t);mpCombatBlast(shooter,s.pos,s.w,impact.actor);s.life=0;}
  else if(wall){s.pos=mpCombatPoint(old,dir,wall.t);mpCombatBlast(shooter,s.pos,s.w,null,wall);s.life=0;}
  else{s.pos=mpCombatPoint(old,dir,travel);s.v.y-=(s.w.gravity||0)*dt;s.life-=dt;
   if(s.life<=0)mpCombatBlast(shooter,s.pos,s.w);}
 }
 m.projectiles=m.projectiles.filter(s=>s.life>0);
}
function mpCombatRespawn(a){
 const m=mpMatch,others=[...m.actors.values()].filter(x=>x!==a&&x.p.hp>0);
 const center=a.spawn,candidates=[center];
 for(let ring=2;ring<=8;ring+=2)for(let j=0;j<24;j++){
  const angle=j*TAU/24;candidates.push({x:center.x+Math.sin(angle)*ring,z:center.z+Math.cos(angle)*ring});
 }
 let best=null,bestScore=-Infinity;
 for(const q of candidates){
  const y=supportHeight(a.p,q.x,q.z);
  if(collide(q.x,q.z,.35)||worldSolidBodyCollision(q.x,q.z,.35,y,PLAYER_SOLID_HEIGHT))continue;
  const distance=o=>Math.hypot(q.x-o.p.x,q.z-o.p.z);
  const separation=Math.min(99,...others.map(distance));
  if(separation<1.35)continue;
  const enemies=m.settings.mode==='teams'?others.filter(o=>o.team!==a.team):others;
  const allies=m.settings.mode==='teams'?others.filter(o=>o.team===a.team):[];
  const enemyDistance=Math.min(99,...enemies.map(distance));
  const allyDistance=Math.min(99,...allies.map(distance));
  // Prefer distance from enemies, nearby cover, and (in teams) a rally point
  // within support range of an ally without spawning on top of anyone.
  let score=Math.min(30,enemyDistance);
  if(allies.length)score+=Math.max(0,4-Math.abs(allyDistance-4))*.45;
  if(enemies.length&&enemyDistance<15){
   const from={x:q.x,y:y+1.2,z:q.z};
   if(enemies.every(o=>!mpCombatVisible(from,{x:o.p.x,y:o.p.feetY+1.2,z:o.p.z})))score+=2;
  }
  if(score>bestScore){best=q;bestScore=score;}
 }
 if(!best){a.respawnAt=m.tick+15;return;}
 const p=a.p;p.x=best.x;p.z=best.z;p.feetY=supportHeight(p,p.x,p.z);
 p.vy=0;p.grounded=true;p.flying=false;p.shield=0;p.energy=100;
 p.hp=100;p.armor=30;p.heat=0;p.heatLock=0;p.cooldown=.5;p.recoil=0;p.equipAnim=0;
 if(a.id===m.self)refreshFlightButtons();
 a.respawnAt=0;a.invulnUntil=m.tick+MP4_SPAWN_SHIELD_TICKS;
 a.cmd.f=false;a.bursts.length=0;
 mpCombatEmit('spawn',mpCombatOrigin(p),mpCombatOrigin(p),p.weapon,a.id);
}
// A warning belongs to the owner of the overheated weapon only. A guest
// observes authoritative lock transitions, not its locally predicted timer.
function mpCombatThermalFeedback(actor,lock){
 if(actor.id!==mpMatch.self)return;
 const active=lock>.001;
 if(active&&!actor.overheatFxActive)emitOverheatFx();
 actor.overheatFxActive=active;
}
function mpCombatStep(dt){
 const m=mpMatch;if(!m?.host)return;
 for(const a of m.actors.values()){
  const p=a.p;
  const command=a.liveCmd||a.cmd;
  // A burst queued before link loss must not keep shooting offline.
  if(typeof mp7InputTimeout==='function'&&!a.host&&
   Date.now()-a.lastInputAt>mp7InputTimeout(a))a.bursts.length=0;
  if(a.respawnAt){if(m.tick>=a.respawnAt)mpCombatRespawn(a);else continue;}
  p.cooldown=Math.max(0,(p.cooldown||0)-dt);
  p.heatLock=Math.max(0,(p.heatLock||0)-dt);
  mpCombatThermalFeedback(a,p.heatLock);
  p.heat=Math.max(0,(p.heat||0)-dt*(p.heatLock>0?22:25));
  // Reject client-provided equipment changes to equal-loadout matches.
  mpCombatSelect(a,command.w);
  for(const burst of a.bursts){burst.delay-=dt;if(burst.delay<=0){
   mpCombatShot(a,burst.w);burst.done=true;
  }}
  a.bursts=a.bursts.filter(x=>!x.done);
  if(!command.f||a.paused||p.cooldown>0||p.heatLock>0||p.hp<=0)continue;
  const w=weapons[p.weapon];if(p.heat>=97){p.heatLock=.9;mpCombatThermalFeedback(a,p.heatLock);continue;}
  p.cooldown=Math.max(.035,w.rate);p.heat=Math.min(105,p.heat+w.heat);
  p.shots=(p.shots||0)+1;
  const pellets=Math.min(12,w.shots||1);
  for(let i=0;i<pellets;i++)mpCombatShot(a,w);
  if(w.burst)for(let i=1;i<w.burst;i++)a.bursts.push({w,delay:i*w.burstGap});
 }
 mpCombatProjectileStep(dt);
 mpCombatApplyOrdnance(mpCombatOrdnance());
}
function mpCombatTapFire(){
 if(!mpMatch?.active||mpMatch.paused||!game||arsenalOpened)return;
 mpMatch.fireUntil=Date.now()+160;
}
