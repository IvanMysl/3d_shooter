// MP-3 movement, MP-4 combat, MP-6 abilities and MP-9 link recovery. No campaign writes.
// The host alone integrates all actors against the same seeded level geometry.
// Guests send controls, predict locally and interpolate the other operators.
const MP3_STEP=1/30,MP3_INPUT_EVERY=.05,MP3_SNAPSHOT_EVERY=.10;
let mpMatch=null,mpMatchStarting=false;

function mpMatchReady(){
 if(!mpRoom?.host||!mpWire||mpMatch?.active||mpRoom.players.length<2)return false;
 return mpRoom.players.every(p=>p.ready&&(p.host||(
  mpRtcLinks.get(p.peerId)?.control?.readyState==='open'&&
  mpRtcLinks.get(p.peerId)?.fast?.readyState==='open')));
}
function mpMatchPaintLobbyStart(){
 const btn=$('mpStartTraining');if(!btn)return;
 btn.disabled=!mpMatchReady();
 btn.title=btn.disabled?'Нужно минимум два готовых игрока и два работающих P2P-канала для каждого гостя.':'';
}
function mpMatchEntry(roomPlayers){
 const ids=new Set(),peers=new Set();
 if(!Array.isArray(roomPlayers)||roomPlayers.length<2||roomPlayers.length>MP_CAP)return null;
 const result=[];
 for(const x of roomPlayers){
  if(!Number.isInteger(x.id)||x.id<0||x.id>10000||typeof x.peerId!=='string'||x.peerId.length>128||ids.has(x.id)||peers.has(x.peerId))return null;
  let nick;try{nick=mpNickname(x.nick);}catch(_){return null;}
  ids.add(x.id);peers.add(x.peerId);
  result.push({id:x.id,peerId:x.peerId,nick,team:x.team===1?1:0,host:!!x.host});
 }
 if(result.filter(p=>p.host).length!==1||!result.some(p=>p.peerId===mpWire?.peerId))return null;
 return result;
}
function mpMatchSpawnPositions(roster,settings={}){
 const result=new Map(),candidates=[{x:spawnX,z:spawnZ}];
 for(const radius of [1.9,3.45,4.95,6.2,8.0])for(let i=0;i<24;i++){
  const angle=i*TAU/24+(radius%2)*.1;
  candidates.push({x:spawnX+Math.sin(angle)*radius,z:spawnZ+Math.cos(angle)*radius});
 }
 const viable=candidates.filter(q=>!collide(q.x,q.z,.35)&&
  !worldSolidBodyCollision(q.x,q.z,.35,supportHeight(q,q.x,q.z),PLAYER_SOLID_HEIGHT));
 if(!viable.length)throw Error('На карте нет безопасной стартовой точки.');
 const teams=settings.mode==='teams';
 const blueAnchor=viable.find(q=>hypot(q.x-spawnX,q.z-spawnZ)>2)||viable[0];
 const orangeAnchor=viable.reduce((best,q)=>
  hypot(q.x-blueAnchor.x,q.z-blueAnchor.z)>hypot(best.x-blueAnchor.x,best.z-blueAnchor.z)?q:best,viable[0]);
 const order=[...roster].sort((a,b)=>teams?(a.team-b.team||a.id-b.id):a.id-b.id);
 for(const member of order){
  const available=viable.filter(q=>[...result.values()].every(other=>hypot(other.x-q.x,other.z-q.z)>1.12));
  const anchor=member.team===1?orangeAnchor:blueAnchor;
  const found=teams?available.sort((a,b)=>
   hypot(a.x-anchor.x,a.z-anchor.z)-hypot(b.x-anchor.x,b.z-anchor.z))[0]:available[0];
  if(!found)throw Error('Недостаточно безопасных мест появления на этой карте.');
  result.set(member.id,found);
 }
 return result;
}
function mpMatchActor(spawn){
 return {x:spawn.x,z:spawn.z,feetY:supportHeight(spawn,spawn.x,spawn.z),vy:0,grounded:true,
  yaw:0,pitch:0,walk:0,energy:100,maxEnergy:100,speed:3.05,
  flightUnlocked:true,flying:false,shield:0,abilityCooldowns:{dash:0,pulse:0,shield:0,heal:0},
  weapon:0,bodyArmorType:-1,bodyArmor:0,bodyArmorMax:0,shotGlow:0,
  hp:100,maxhp:100,armor:30,maxArmor:30,cooldown:0,heat:0,heatLock:0};
}
function mpMatchOpen(token,roster,settings){
 if(mpMatch?.active||!mpRoom||!mpWire||!mpMap(settings.mapId))return false;
 // Build the same deterministic map on every device; no startGame(), runs or checkpoint.
 mpMatchStarting=true;
 const oldGame=game;
 try{
  game=freshGame();game.sector=mpMap(settings.mapId).sector;
  legacyResumeSector=-1;enterSector(game.sector);
  game.enemies=[];game.bullets=[];game.particles=[];game.projectiles=[];
  game.nodes=[];game.devices=[];game.mission=null;game.arenaEvent=null;
  game.portalReady=false;game.target=0;game.spawned=0;
  const placements=mpMatchSpawnPositions(roster,settings),me=roster.find(p=>p.peerId===mpWire.peerId);
  if(!me)throw Error('Игрок отсутствует в составе матча.');
  const actors=new Map();
  for(const r of roster){
   const p=r.id===me.id?game.p:mpMatchActor(placements.get(r.id));
   const start=placements.get(r.id);p.x=start.x;p.z=start.z;p.feetY=supportHeight(p,p.x,p.z);
   p.vy=0;p.grounded=true;p.flying=false;p.flightUnlocked=true;
   p.shield=0;p.abilityCooldowns={dash:0,pulse:0,shield:0,heal:0};
   p.walk=0;p.yaw=(r.id%8)*TAU/8;
   p.energy=100;p.maxEnergy=100;p.speed=3.05;
   // Competitive stats are independent of solo permanent upgrades and unverified saves.
   p.hp=100;p.maxhp=100;p.armor=30;p.maxArmor=30;p.armorTier=0;
   p.bodyArmor=0;p.bodyArmorType=-1;p.bodyArmorMax=0;p.bodyArmorReduction=0;
   p.damage=1;p.rate=1;p.heatMod=1;p.cooldown=0;p.heat=0;p.heatLock=0;
   p.weapon=settings.equipment==='equal'?settings.weapon:0;p.shotGlow=0;
   actors.set(r.id,{...r,p,cmd:{mx:0,mz:0,j:false,s:false,yaw:p.yaw,pitch:0},seq:-1,
    lastInputAt:0,samples:[]});
  }
  mpMatch={active:true,token,host:mpRoom.host,self:me.id,actors,roster,
   tick:0,acc:0,sendAcc:0,snapAcc:0,inputSeq:0,lastSnapshot:-1,
   paused:false,lastHud:0,jumpUntil:0,startedAt:Date.now(),lastFromHost:Date.now(),
   settings:mpSettings(settings),projectiles:[],fireUntil:0};
  if(typeof mpCombatInit==='function')mpCombatInit();
  if(typeof mpRoundInit==='function')mpRoundInit();
  if(typeof mp6Init==='function')mp6Init();
  if(typeof mp7Init==='function')mp7Init();
  if(typeof mp8Init==='function')mp8Init();
  const gunEl=$('gun');if(gunEl?.dataset){gunEl.dataset.gun=String(game.p.weapon);
   gunEl.style?.setProperty?.('--weapon-glow',`rgb(${weapons[game.p.weapon].color.map(v=>Math.round(v*255)).join(',')})`);}
  input.fire=false;input.jumpQueued=false;
  closeArsenal();$('overlay').classList.add('hidden');$('hud').classList.add('show');
  document.body.classList.add('mpTraining');
  const hud=document.createElement('div');hud.id='mpTrainingBadge';hud.setAttribute('role','status');
  document.body.appendChild(hud);mpMatchStatus();refreshFlightButtons();
  lastFrame=performance.now();mpMatchStarting=false;return true;
 }catch(e){game=oldGame;mpMatch=null;document.body.classList.remove('mpTraining');
  $('mpCombatScore')?.remove();$('mpTrainingBadge')?.remove();$('mpReconnectNow')?.remove();
  mpMatchStarting=false;console.error('MP-3 map initialization:',e);return false;}
}
function mpMatchStartTraining(){
 if(!mpMatchReady()){mpStatus('Ожидайте готовности игроков и установления прямых каналов.',true);return;}
 const token=mpRandom(8),roster=mpMatchEntry(mpRoom.players);
 if(!roster)return;
 const message={v:MP_VERSION,kind:'mp3-start',token,mapId:mpRoom.settings.mapId,roster};
 const informed=[];
 for(const r of roster)if(!r.host){const link=mpRtcLinks.get(r.peerId);
  if(!link||!mpRtcSend(link,link.control,message)){
   for(const prior of informed)mpRtcSend(prior,prior.control,{v:MP_VERSION,kind:'mp3-stop',token});
   mpStatus('Не удалось известить всех гостей. Проверьте соединение.',true);return;
  }
  informed.push(link);
 }
 if(!mpMatchOpen(token,roster,mpRoom.settings)){
  for(const prior of informed)mpRtcSend(prior,prior.control,{v:MP_VERSION,kind:'mp3-stop',token});
  mpHome('Невозможно загрузить карту.');
 }
}
function mpMatchInput(){
 if(mpMatch?.paused||mpMatch?.round?.ended||document.hidden||arsenalOpened)
  return {mx:0,mz:0,j:false,s:false,yaw:game.p.yaw,pitch:game.p.pitch,f:false,w:game.p.weapon,
   ...(typeof mp6Input==='function'?mp6Input(false):{})};
 if(input.jumpQueued&&mpMatch)mpMatch.jumpUntil=Date.now()+140;
 let mx=Number(!!input.keys.KeyD)-Number(!!input.keys.KeyA)+input.mx;
 let mz=Number(!!input.keys.KeyW)-Number(!!input.keys.KeyS)+input.mz;
 mx=Number.isFinite(mx)?clamp(mx,-1,1):0;mz=Number.isFinite(mz)?clamp(mz,-1,1):0;
 const len=hypot(mx,mz);if(len>1){mx/=len;mz/=len;}
 return {mx,mz,j:!!(input.jumpHeld||input.jumpQueued||input.keys.Space||Date.now()<(mpMatch?.jumpUntil||0)),
  s:!!(input.sprint||input.mobileSprint||input.keys.ShiftLeft||input.keys.ShiftRight)&&!game.p.flying,
  yaw:game.p.yaw,pitch:game.p.pitch,
  f:!!(input.fire||Date.now()<(mpMatch?.fireUntil||0)),w:game.p.weapon,
  ...(typeof mp6Input==='function'?mp6Input(true):{})};
}
function mpMatchSafeInput(data){
 if(!data||!Number.isSafeInteger(data.seq)||data.seq<0||data.seq>1e9)return null;
 for(const field of ['mx','mz','yaw','pitch'])if(!Number.isFinite(data[field]))return null;
 if(Math.abs(data.mx)>1||Math.abs(data.mz)>1||hypot(data.mx,data.mz)>1.02||
   Math.abs(data.yaw)>1e8||Math.abs(data.pitch)>1.11||typeof data.j!=='boolean'||typeof data.s!=='boolean')return null;
 if(data.f!==undefined&&typeof data.f!=='boolean')return null;
 if(data.w!==undefined&&(!Number.isInteger(data.w)||data.w<0||data.w>=weapons.length))return null;
 const special=typeof mp6SafeInput==='function'?mp6SafeInput(data):{};
 if(special===null)return null;
 return {mx:data.mx,mz:data.mz,j:data.j,s:data.s,yaw:data.yaw,pitch:data.pitch,
  f:data.f===true,w:data.w,...special};
}
function mpMatchMove(p,cmd,dt,others=[]){
 if(!Number.isFinite(dt)||dt<=0||dt>MP3_STEP+.00001)return;
 p.yaw=cmd.yaw;p.pitch=clamp(cmd.pitch,-1.1,1.04);
 let mx=cmd.mx,mz=cmd.mz,mag=hypot(mx,mz);if(mag>1){mx/=mag;mz/=mag;mag=1;}
 p.energy=Math.min(100,p.energy+16*dt);
 const running=!!cmd.s&&mag>.1&&p.energy>2;
 if(running)p.energy=Math.max(0,p.energy-SPRINT_ENERGY_DRAIN*dt);
 const speed=(p.flying&&typeof MP6_FLIGHT_HORIZONTAL!=='undefined'?MP6_FLIGHT_HORIZONTAL:3.05)*(running?1.48:1)*dt;
 const dx=(Math.sin(p.yaw)*mz-Math.cos(p.yaw)*mx)*speed;
 const dz=(Math.cos(p.yaw)*mz+Math.sin(p.yaw)*mx)*speed;
 const length=hypot(dx,dz),count=Math.max(1,Math.ceil(length/.12));
 for(let i=0;i<count;i++){
  for(const [ax,az] of [[dx/count,0],[0,dz/count]]){
   const x=p.x+ax,z=p.z+az,floor=supportHeight(p,x,z);
   if(collide(x,z,.25)||floor>p.feetY+.245||
      worldSolidBodyCollision(x,z,.25,Math.max(p.feetY,floor),PLAYER_SOLID_HEIGHT)||
      others.some(o=>o!==p&&Math.abs(o.feetY-p.feetY)<1.65&&hypot(o.x-x,o.z-z)<.67))continue;
   p.x=x;p.z=z;if(p.grounded&&Math.abs(floor-p.feetY)<.246)p.feetY=floor;
  }
 }
 p.walk=mag>.1?1:0;
 const ground=supportHeight(p,p.x,p.z),deck=deckHeight(p.x,p.z);
 const beam=worldSolidStandingSupport(p.x,p.z,.23,p.feetY);
 const floor=Math.max(ground,beam===null?ground:beam);
 if(p.flying&&typeof mp6FlyVertical==='function'){
  mp6FlyVertical(p,cmd,dt,floor,deck);return;
 }
 if(p.grounded){if(p.feetY>floor+.245){p.grounded=false;p.vy=0;}
  else if(floor<=p.feetY+.24)p.feetY=floor;else p.feetY=Math.max(p.feetY,floor);}
 if(cmd.j&&p.grounded){p.grounded=false;p.vy=JUMP_VELOCITY;p.feetY+=.008;}
 if(!p.grounded){
  p.vy-=JUMP_GRAVITY*dt;const from=p.feetY;p.feetY+=p.vy*dt;
  const low=deck-.17-PLAYER_SOLID_HEIGHT;
  if(deck>0&&from<=low+.001&&p.vy>0&&p.feetY>low){p.feetY=Math.max(0,low-.004);p.vy=0;}
  if(p.vy>0&&glReady){const bar=worldSolidHeadBarrier(p.x,p.z,.23,from+PLAYER_SOLID_HEIGHT,p.feetY+PLAYER_SOLID_HEIGHT);
   if(bar!==null){p.feetY=Math.max(from,bar-PLAYER_SOLID_HEIGHT-.004);p.vy=0;}}
  if(p.vy<0&&glReady){const beamFloor=worldSolidFeetBarrier(p.x,p.z,.23,from,p.feetY);
   if(beamFloor!==null){p.feetY=Math.max(p.feetY,beamFloor+.004);p.vy=0;p.grounded=true;}}
  if(p.feetY<=floor){p.feetY=floor;p.vy=0;p.grounded=true;}
 }
 const ceiling=Math.max(floor,ceilingHeight()-PLAYER_SOLID_HEIGHT-.2);
 if(p.feetY>ceiling){p.feetY=ceiling;p.vy=Math.min(0,p.vy);}
}
function mpMatchState(){
 return {v:MP_VERSION,kind:'mp3-state',token:mpMatch.token,tick:mpMatch.tick,
  actors:[...mpMatch.actors.values()].map(({id,p,kills=0,deaths=0,respawnAt=0,invulnUntil=0})=>({id,
   x:+p.x.toFixed(3),z:+p.z.toFixed(3),h:+p.feetY.toFixed(3),
   yaw:+p.yaw.toFixed(3),pitch:+p.pitch.toFixed(3),vy:+p.vy.toFixed(3),
   e:+p.energy.toFixed(2),w:p.walk?1:0,g:p.grounded?1:0,
   ...(typeof mp6ActorState==='function'?mp6ActorState(p):{}),
   hp:+p.hp.toFixed(1),ar:+p.armor.toFixed(1),gun:p.weapon,
   k:kills,d:deaths,rs:Math.max(0,respawnAt-mpMatch.tick),
   iv:Math.max(0,invulnUntil-mpMatch.tick)})),
  ordnance:mpMatch.host&&typeof mpCombatOrdnance==='function'?mpCombatOrdnance():[],
  round:mpMatch.host&&typeof mpRoundState==='function'?mpRoundState():null};
}
function mpMatchSafeState(data){
 if(!mpMatch||!Number.isSafeInteger(data.tick)||data.tick<=mpMatch.lastSnapshot||
  !Array.isArray(data.actors)||data.actors.length!==mpMatch.actors.size)return null;
 const seen=new Set(),out=[];
 for(const p of data.actors){
  if(!p||typeof p!=='object'||!mpMatch.actors.has(p.id)||seen.has(p.id)||![p.x,p.z,p.h,p.yaw,p.pitch,p.vy,p.e].every(Number.isFinite)||
   p.x<0||p.z<0||p.x>=mapSize||p.z>=mapSize||p.h<-.5||p.h>24||p.e<0||p.e>100.01||
   Math.abs(p.yaw)>1e8||Math.abs(p.pitch)>1.11||Math.abs(p.vy)>30||![0,1].includes(p.w)||![0,1].includes(p.g)||
   !Number.isFinite(p.hp)||p.hp<0||p.hp>100||!Number.isFinite(p.ar)||p.ar<0||p.ar>30||
   !Number.isInteger(p.gun)||p.gun<0||p.gun>=weapons.length||
   !Number.isSafeInteger(p.k)||Math.abs(p.k)>1e7||
   ![p.d,p.rs,p.iv].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1e7)||
   (typeof mp6SafeState==='function'&&!mp6SafeState(p)))return null;
  seen.add(p.id);out.push(p);
 }
 return out;
}
function mpMatchFast(peer,data){
 const m=mpMatch;if(!m?.active||data.token!==m.token)return;
 if(m.host&&data.kind==='mp3-input'){
  if(m.round?.ended)return;
  const actor=[...m.actors.values()].find(a=>a.peerId===peer);
  if(!actor||actor.host)return;
  const cmd=mpMatchSafeInput(data);if(!cmd||data.seq<=actor.seq)return;
  actor.cmd=typeof mp7LateCommand==='function'?mp7LateCommand(actor,cmd):cmd;
  actor.seq=data.seq;actor.lastInputAt=Date.now();return;
 }
 if(!m.host&&peer===mpRoom?.hostPeer&&data.kind==='mp3-state'){
  const list=mpMatchSafeState(data);if(!list)return;
  if(typeof mp8OnSnapshot==='function')mp8OnSnapshot(m);
  m.lastSnapshot=data.tick;m.lastFromHost=Date.now();
  for(const next of list){const actor=m.actors.get(next.id),p=actor.p;
   p.hp=next.hp;p.armor=next.ar;p.weapon=next.gun;
   if(typeof mp6ApplyActorState==='function')mp6ApplyActorState(p,next,actor.id===m.self);
   actor.kills=next.k;actor.deaths=next.d;actor.respawnAt=next.rs?m.tick+next.rs:0;
   actor.invulnUntil=next.iv?m.tick+next.iv:0;
   if(actor.id===m.self){
    if(typeof mp8ReconcileRecovered==='function'&&mp8ReconcileRecovered(m,p,next)){}
    else if(typeof mp7ReconcileSelf==='function')mp7ReconcileSelf(p,next);
    else{
     const err=hypot(next.x-p.x,next.z-p.z);
     if(err>1.3){p.x=next.x;p.z=next.z;p.feetY=next.h;p.vy=next.vy;p.grounded=!!next.g;}
     else {p.x+=(next.x-p.x)*.22;p.z+=(next.z-p.z)*.22;
      if(Math.abs(next.h-p.feetY)>.5){p.feetY=next.h;p.vy=next.vy;p.grounded=!!next.g;}}
     p.energy+=(next.e-p.energy)*.22;
    }
   }else{
    if(typeof mp7ReceiveSample==='function')mp7ReceiveSample(actor,next,data.tick);
    else {actor.samples.push({at:performance.now(),...next});
     if(actor.samples.length>3)actor.samples.shift();}
   }
  }
  if(typeof mpCombatSyncHud==='function')mpCombatSyncHud();
  if(typeof mpCombatApplyOrdnance==='function')mpCombatApplyOrdnance(data.ordnance);
  if(typeof mpRoundApplySnapshot==='function')mpRoundApplySnapshot(data);
 }
 if(!m.host&&peer===mpRoom?.hostPeer&&data.kind==='mp3-effect'&&typeof mpCombatReceiveEffect==='function')
  mpCombatReceiveEffect(data);
}
function mpMatchControl(peer,data){
 if(data.kind==='mp3-start'){
  if(mpMatch?.active||mpRoom?.host||peer!==mpRoom?.hostPeer||!mpWire||
   !/^[A-Z2-7]{13}$/.test(data.token||'')||data.mapId!==mpRoom.settings?.mapId)return;
  const roster=mpMatchEntry(data.roster);
  if(!roster||roster.length!==mpRoom.players.length||!roster.every(p=>mpRoom.players.some(x=>x.id===p.id&&x.peerId===p.peerId)))return;
  if(!mpMatchOpen(data.token,roster,mpRoom.settings))mpHome('Не удалось подготовить карту для совместного матча.');
 }else if(data.kind==='mp3-stop'&&mpMatch?.active&&!mpRoom?.host&&peer===mpRoom.hostPeer&&data.token===mpMatch.token){
  mpMatchAbort();mpLobby();mpStatus('Ведущий завершил матч.');
 }else if(data.kind==='mp3-result'&&mpMatch?.active&&!mpRoom?.host&&peer===mpRoom?.hostPeer&&
  data.token===mpMatch.token&&typeof mpRoundAccept==='function'){
  mpRoundAccept(data.result);
 }
}
function mpMatchInterpolate(dt=MP3_STEP){
 if(!mpMatch?.active||mpMatch.host)return;
 if(typeof mp7RenderRemote==='function'){
  for(const a of mpMatch.actors.values())if(a.id!==mpMatch.self&&a.samples.length)
   mp7RenderRemote(a,dt);
  return;
 }
 const now=performance.now()-110;
 for(const a of mpMatch.actors.values())if(a.id!==mpMatch.self&&a.samples.length){
  const samples=a.samples;
  while(samples.length>2&&samples[1].at<now)samples.shift();
  const newest=samples[samples.length-1],prev=samples.length>=2?samples[samples.length-2]:newest;
  const t=prev===newest?1:clamp((now-prev.at)/Math.max(1,newest.at-prev.at),0,1);
  for(const [key,remoteKey] of [['x','x'],['z','z'],['feetY','h'],['yaw','yaw'],['pitch','pitch']]){
   const a0=prev[remoteKey],a1=newest[remoteKey];
   a.p[key]=a0+(key==='yaw'?Math.atan2(Math.sin(a1-a0),Math.cos(a1-a0)):(a1-a0))*t;
  }
  a.p.walk=newest.w;a.p.grounded=!!newest.g;
  if(typeof mp6ApplyActorState==='function')mp6ApplyActorState(a.p,newest,false);
 }
}
function mpMatchUpdate(dt){
 const m=mpMatch;if(!m?.active||!game)return;
 const local=mpMatchInput(),self=m.actors.get(m.self);
 const guestFrozen=typeof mp8GuestFrozen==='function'&&mp8GuestFrozen();
 const outgoing=guestFrozen&&typeof mp8NeutralInput==='function'?mp8NeutralInput(local):local;
 if(typeof mp8Update==='function')mp8Update(m);
 if(m.host)self.cmd=local;
 else if(!m.round?.ended){
  m.sendAcc+=dt;
  const ready=typeof mp10InputDue==='function'?mp10InputDue(m,outgoing):m.sendAcc>=MP3_INPUT_EVERY;
  if(ready){m.sendAcc=0;
   const cmd={v:MP_VERSION,kind:'mp3-input',token:m.token,seq:++m.inputSeq,...outgoing};
   if(mpRtcFastSend(mpRoom.hostPeer,cmd)&&typeof mp10InputSent==='function')mp10InputSent(m,outgoing);
  }
 }
 m.acc+=dt;
 let loops=0;
 while(m.acc>=MP3_STEP&&loops++<4){
  m.acc-=MP3_STEP;m.tick++;
  if(m.host&&!m.round?.ended){
   for(const a of m.actors.values()){
    const cmd=typeof mp7SafeStale==='function'?mp7SafeStale(a,a.cmd):
     (!a.host&&Date.now()-a.lastInputAt>350?
      {...a.cmd,mx:0,mz:0,j:false,s:false,f:false,u:false,dn:false}:a.cmd);
    // Combat must use exactly the same sanitized command as movement.
    a.liveCmd=cmd;
    if(typeof mp6Step==='function')mp6Step(a,cmd,MP3_STEP);
    if(!(a.respawnAt>m.tick))mpMatchMove(a.p,cmd,MP3_STEP,[...m.actors.values()].filter(x=>x.p.hp>0).map(x=>x.p));
   }
   if(typeof mpCombatStep==='function')mpCombatStep(MP3_STEP);
   if(typeof mpRoundCheck==='function')mpRoundCheck();
 }else if(!m.host&&!m.round?.ended&&!guestFrozen&&!(self.respawnAt>m.tick))
  {if(typeof mp6GuestStep==='function')mp6GuestStep(self.p,MP3_STEP);
   mpMatchMove(self.p,local,MP3_STEP,[...m.actors.values()].filter(x=>x.p.hp>0).map(x=>x.p));}
 }
 if(m.host){m.snapAcc+=dt;
  const period=m.round?.ended?1:(typeof mp10SnapshotPeriod==='function'?mp10SnapshotPeriod(m):MP3_SNAPSHOT_EVERY);
  if(m.snapAcc>=period){m.snapAcc%=period;
   const snapshot=mpMatchState();let delivered=false;
   for(const a of m.actors.values())if(!a.host)delivered=mpRtcFastSend(a.peerId,snapshot)||delivered;
   if(delivered&&typeof mp10SnapshotSent==='function')mp10SnapshotSent(m);
  }}else mpMatchInterpolate(dt);
 game.t+=dt;game.sectorTime+=dt;
 if(performance.now()-m.lastHud>350){m.lastHud=performance.now();mpMatchStatus();}
 input.jumpQueued=false;
 if(game?.tracers)game.tracers=game.tracers.filter(x=>(x.life-=dt)>0);
 if(game?.impactFx)game.impactFx=game.impactFx.filter(x=>(x.life-=dt)>0);
 for(const a of m.actors.values())a.p.shotGlow=Math.max(0,(a.p.shotGlow||0)-dt);
}
function mpMatchActors(){return mpMatch?.active?[...mpMatch.actors.values()].filter(a=>a.id!==mpMatch.self&&a.p.hp>0).map(a=>a.p):[];}
function mpMatchRosterChanged(){
 const m=mpMatch;if(!m?.active||!mpRoom)return;
 const remaining=new Set(mpRoom.players.map(p=>p.peerId));
 if(!remaining.has(mpWire?.peerId)){mpMatchAbort();mpHome('Вас больше нет в составе комнаты.');return;}
 for(const [id,a] of m.actors)if(!remaining.has(a.peerId))m.actors.delete(id);
 if(m.actors.size<2){
  if(m.host){
   if(m.round&&!m.round.ended&&typeof mpRoundFinish==='function')mpRoundFinish('forfeit');
   else if(!m.round)mpMatchStop();
   return;
  }
  mpMatchAbort();mpLobby();mpStatus('Второй участник вышел. Матч завершён.');return;
 }
 mpMatchStatus();
}
function mpMatchRenderOperators(g){if(glReady)for(const a of mpMatchActors())if(hypot(a.x-g.p.x,a.z-g.p.z)<40)renderOperator(g,a);}
function mpMatchStatus(){
 const m=mpMatch,el=$('mpTrainingBadge');if(!m?.active||!el)return;
 const rtt=mpRtcLinks.get(mpRoom?.hostPeer)?.rtt;
 const self=m.actors.get(m.self)?.p;
 const warning=typeof mp8UpdateHud==='function'&&mp8UpdateHud(m);
 const hostWarning=typeof mp8HostWarning==='function'&&mp8HostWarning(m);
 el.textContent='◉ MP-10 · '+(m.round?.ended?'ИТОГИ':
  (typeof mpRoundClock==='function'?mpRoundClock():'БОЙ'))+
  ' · '+m.actors.size+' ИГР. · '+(warning||hostWarning||(mpSignalingLost?'⚠ METERED ОТКЛЮЧЁН · P2P':m.host?'ВЕДУЩИЙ':
   Date.now()-m.lastFromHost>2200?'⚠ НЕТ СВЯЗИ':Number.isFinite(rtt)?Math.round(rtt)+' мс':'P2P'))+
  ' · '+(self?.flying?'✈ ЛЕЧУ':'✈ ГОТОВ')+' · ЦЕЛЬ '+m.settings.scoreLimit;
 if(typeof mpCombatSyncHud==='function')mpCombatSyncHud();
}
function mpMatchPause(){
 const m=mpMatch;if(!m?.active)return;
 if(m.round?.ended){if(typeof mpRoundShowResults==='function')mpRoundShowResults();return;}
 m.paused=!m.paused;input.fire=false;
 if(!m.paused){$('overlay').classList.add('hidden');$('hud').classList.add('show');return;}
 pauseResumeGraceUntil=performance.now()+1100;
 if(document.pointerLockElement)document.exitPointerLock();
 panel(`<div class="eyebrow">СЕТЕВАЯ ИГРА / MP-10</div><h2>Сетевой матч</h2>
 <p class="lede">${mpEscape(mpMap(mpRoom?.settings?.mapId)?.name||'КАРТА')} · ${m.actors.size} игроков.</p>
 <p class="smalltext">${typeof mp10TrafficLabel==='function'?mp10TrafficLabel():''}</p>
 <p class="smalltext">Стрельба, попадания, полёт, рывок, импульс, щит, ремонт, убийства и возрождение рассчитываются ведущим. Всем доступны одинаковые базовые параметры полёта и способностей без переноса сохранённых улучшений. V / двойной Space — полёт, Space — вверх, Shift — вниз, E — рывок, Q — импульс, C — щит, F — ремонт. Пока открыто меню, матч продолжается.</p>
 <div class="row"><button class="primary" id="mpResume">▶ ВЕРНУТЬСЯ</button>
 <button class="secondary" id="mpRetryInGame">⟳ ПЕРЕПОДКЛЮЧИТЬ</button>
 ${m.host?'<button class="secondary" id="mpStop">■ ЗАВЕРШИТЬ МАТЧ ДЛЯ ВСЕХ</button>':''}
 <button class="secondary" id="mpExit">← ВЫЙТИ ИЗ КОМНАТЫ</button></div>`);
 $('mpResume').onclick=mpMatchPause;
 $('mpRetryInGame').onclick=()=>mpRtcManualRetry();
 if(m.host)$('mpStop').onclick=mpMatchStop;
 $('mpExit').onclick=mpLeave;
}
function mpMatchAbort(){
 if(!mpMatch&&!mpMatchStarting)return;
 mpMatchStarting=false;
 mpMatch=null;game=null;document.body.classList.remove('mpTraining');
 $('mpTrainingBadge')?.remove();$('mpReconnectNow')?.remove();$('mpCombatScore')?.remove();$('hud').classList.remove('show');
 input.fire=false;input.jumpHeld=false;input.jumpQueued=false;input.keys={};
 document.body.classList.remove('flightUnlocked','flying');
 if(document.pointerLockElement)document.exitPointerLock();
}
function mpMatchStop(){
 const m=mpMatch;if(!m?.active||!m.host)return;
 for(const a of m.actors.values())if(!a.host){const link=mpRtcLinks.get(a.peerId);
  if(link)mpRtcSend(link,link.control,{v:MP_VERSION,kind:'mp3-stop',token:m.token});
 }
 mpMatchAbort();for(const p of mpRoom.players)p.ready=false;mpRoom.seq++;
 mpPublishRoster();mpLobby();mpStatus('Матч завершён. Подтвердите готовность для следующего боя.');
}
// Restrict combat-only controls without changing the solo input handlers.
addEventListener('keydown',e=>{
 if(!mpMatch?.active||e.target?.matches?.('input,textarea,select'))return;
 if(/^(Key[EQFCV]|BracketLeft|BracketRight)$/.test(e.code)){
  if(!e.repeat&&typeof mp6Request==='function'){
   const action={KeyE:'dash',KeyQ:'pulse',KeyC:'shield',KeyF:'heal',KeyV:'flight'}[e.code];
   if(action)mp6Request(action);
  }
  e.preventDefault();e.stopImmediatePropagation();
 }
},true);
// Keep solo gameplay untouched: multiplayer owns weapon authorization.
const mpSoloAbility=useAbility,mpSoloFlight=toggleFlight,
 mpSoloArsenal=toggleArsenal,mpSoloWeapon=switchWeapon;
useAbility=function(...args){if(mpMatch?.active)return typeof mp6Request==='function'?mp6Request(args[0]):false;return mpSoloAbility(...args);};
toggleFlight=function(...args){if(mpMatch?.active)return typeof mp6Request==='function'?mp6Request('flight'):false;return mpSoloFlight(...args);};
toggleArsenal=function(...args){if(mpMatch?.active&&mpMatch.settings.equipment==='equal')return;return mpSoloArsenal(...args);};
switchWeapon=function(...args){
 if(mpMatch?.active){
  if(mpMatch.settings.equipment==='equal')return;
  const n=args[0]===undefined?(game.p.weapon+1)%weapons.length:args[0];
  if(!Number.isInteger(n)||n<0||n>=weapons.length)return;
  game.p.weapon=n;
 }
 return mpSoloWeapon(...args);
};
