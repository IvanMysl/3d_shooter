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
function mpCombatBlast(shooter,point,w,direct=null){
 const r=w.blast||1.15;
 for(const a of mpMatch.actors.values()){
  if(a.p.hp<=0||a.respawnAt>mpMatch.tick)continue;
  const center={x:a.p.x,y:a.p.feetY+1.02,z:a.p.z};
  const distance=Math.max(0,Math.hypot(center.x-point.x,center.y-point.y,center.z-point.z)-.33);
  if(distance>r||(a!==direct&&!mpCombatVisible(point,center)))continue;
  const factor=a===direct?1:.24+.60*Math.pow(1-distance/r,1.3);
  mpCombatHit(shooter,a,w.damage*factor);
 }
 mpCombatEmit('blast',point,point,shooter.p.weapon,direct?.id??-1);
}
function mpCombatEmit(type,start,end,weapon,targetId=-1){
 const m=mpMatch;if(!m?.host)return;
 const event={v:MP_VERSION,kind:'mp3-effect',token:m.token,
  type,gun:weapon,id:targetId,
  a:[+start.x.toFixed(2),+start.y.toFixed(2),+start.z.toFixed(2)],
  b:[+end.x.toFixed(2),+end.y.toFixed(2),+end.z.toFixed(2)]};
 mpCombatReceiveEffect(event);
 for(const a of m.actors.values())if(!a.host)mpRtcFastSend(a.peerId,event);
}
function mpCombatReceiveEffect(data){
 if(!mpMatch?.active||data.token!==mpMatch.token||!['shot','blast','down','spawn','dash','pulse','shield','heal'].includes(data.type)||
  !Number.isInteger(data.gun)||data.gun<0||data.gun>=weapons.length||
  !Array.isArray(data.a)||!Array.isArray(data.b)||
  ![...data.a,...data.b].every(n=>Number.isFinite(n)&&Math.abs(n)<1000))return;
 const a={x:data.a[0],y:data.a[1],z:data.a[2]},b={x:data.b[0],y:data.b[1],z:data.b[2]};
 if(data.type==='shot'||data.type==='dash')game.tracers.push({a,b,
  life:data.type==='dash'?.24:.14,maxLife:data.type==='dash'?.24:.14,
  r:data.type==='dash'?.10:.018,col:data.type==='dash'?[.3,1,.97]:weapons[data.gun].color});
 else game.impactFx.push({x:b.x,y:b.y,z:b.z,
  life:data.type==='pulse'?.55:.35,maxLife:data.type==='pulse'?.55:.35,
  r:data.type==='pulse'?1.1:data.type==='blast'?.50:.27,
  col:data.type==='shield'?[.60,.58,1]:data.type==='heal'?[.3,1,.55]:weapons[data.gun].color});
 if(game.tracers.length>60)game.tracers.splice(0,game.tracers.length-60);
 if(game.impactFx.length>35)game.impactFx.splice(0,game.impactFx.length-35);
}
function mpCombatOrdnance(){
 return mpMatch.projectiles.slice(0,24).map(s=>({x:+s.pos.x.toFixed(2),y:+s.pos.y.toFixed(2),
  z:+s.pos.z.toFixed(2),vx:+s.v.x.toFixed(1),vy:+s.v.y.toFixed(1),vz:+s.v.z.toFixed(1),
  gun:weapons.indexOf(s.w)}));
}
function mpCombatApplyOrdnance(list){
 if(!Array.isArray(list)||list.length>24)return;
 const display=[];
 for(const obj of list){
  if(!obj||![obj.x,obj.y,obj.z,obj.vx,obj.vy,obj.vz].every(n=>Number.isFinite(n)&&Math.abs(n)<1000)||
   !Number.isInteger(obj.gun)||weapons[obj.gun]?.mode!=='projectile')return;
  display.push({x:obj.x,y:obj.y,z:obj.z,vx:obj.vx,vy:obj.vy,vz:obj.vz,
   w:weapons[obj.gun],rad:obj.gun===8?.13:.10});
 }
 game.projectiles=display;
}
function mpCombatShot(shooter,w){
 const o=mpCombatOrigin(shooter.p),d=mpCombatDirection(shooter.p,w.spread||0);
 if(w.mode==='projectile'){
  const m=mpMatch;
  if(m.projectiles.length<72)m.projectiles.push({shooter:shooter.id,w,
   pos:o,v:{x:d.x*w.speed,y:d.y*w.speed,z:d.z*w.speed},life:w.range/w.speed});
  mpCombatEmit('shot',o,mpCombatPoint(o,d,Math.min(1.5,w.range)),shooter.p.weapon);
  return;
 }
 const wall=rayWall(o,d,w.range),stop=wall?Math.min(w.range,wall.t):w.range;
 let limit=stop,penetrations=Math.max(1,Math.min(4,w.pierce||1));
 const struck=new Set();
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
  struck.add(target.a.id);mpCombatHit(shooter,target.a,w.damage,target.head);
  if(!w.pierce)break;
 }
 mpCombatEmit('shot',o,mpCombatPoint(o,d,stop),shooter.p.weapon);
}
function mpCombatProjectileStep(dt){
 const m=mpMatch;
 for(const s of m.projectiles){
  const shooter=m.actors.get(s.shooter);
  if(!shooter){s.life=0;continue;}
  const old=s.pos,travel=Math.hypot(s.v.x,s.v.y,s.v.z)*dt;
  if(travel<=.00001){s.life=0;continue;}
  const dir={x:s.v.x*dt/travel,y:s.v.y*dt/travel,z:s.v.z*dt/travel};
  const wall=rayWall(old,dir,travel),limit=wall?Math.min(travel,wall.t):travel;
  const impact=mpCombatTarget(shooter,old,dir,limit);
  if(impact){s.pos=mpCombatPoint(old,dir,impact.t);mpCombatBlast(shooter,s.pos,s.w,impact.actor);s.life=0;}
  else if(wall){s.pos=mpCombatPoint(old,dir,wall.t);mpCombatBlast(shooter,s.pos,s.w);s.life=0;}
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
 p.hp=100;p.armor=30;p.heat=0;p.heatLock=0;p.cooldown=.5;
 if(a.id===m.self)refreshFlightButtons();
 a.respawnAt=0;a.invulnUntil=m.tick+MP4_SPAWN_SHIELD_TICKS;
 a.cmd.f=false;a.bursts.length=0;
 mpCombatEmit('spawn',mpCombatOrigin(p),mpCombatOrigin(p),p.weapon,a.id);
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
  p.heat=Math.max(0,(p.heat||0)-dt*(p.heatLock>0?22:25));
  // Reject client-provided equipment changes to equal-loadout matches.
  mpCombatSelect(a,command.w);
  for(const burst of a.bursts){burst.delay-=dt;if(burst.delay<=0){
   mpCombatShot(a,burst.w);burst.done=true;
  }}
  a.bursts=a.bursts.filter(x=>!x.done);
  if(!command.f||a.paused||p.cooldown>0||p.heatLock>0||p.hp<=0)continue;
  const w=weapons[p.weapon];if(p.heat>=97){p.heatLock=.9;continue;}
  p.cooldown=Math.max(.035,w.rate);p.heat=Math.min(105,p.heat+w.heat);
  p.shotGlow=.14;p.shots=(p.shots||0)+1;
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
