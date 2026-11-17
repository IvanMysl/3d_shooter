// MP-6: symmetrical baseline flight and four energy-based PvP abilities.
// The host accepts intent counters, never remote coordinates/damage/energy.
// Guest prediction covers ordinary motion; authoritative snapshots repair it.
const MP6_FLIGHT_HORIZONTAL=4.0,MP6_FLIGHT_VERTICAL=4.4;
const MP6_EVENTS=['ft','ad','aq','ac','ah'];
const MP6_SKILLS={dash:{key:'ad',cost:30,cooldown:1.15},
 pulse:{key:'aq',cost:52,cooldown:2.2},
 shield:{key:'ac',cost:50,cooldown:8.5},
 heal:{key:'ah',cost:45,cooldown:0}};

function mp6Init(){
 const m=mpMatch;if(!m?.active)return;
 m.special={ft:0,ad:0,aq:0,ac:0,ah:0};
 for(const a of m.actors.values()){
  a.lastSpecial={ft:0,ad:0,aq:0,ac:0,ah:0};
  a.p.flightUnlocked=true;a.p.flying=false;a.p.shield=0;
  a.p.abilityCooldowns={dash:0,pulse:0,shield:0,heal:0};
 }
}
function mp6Request(type){
 const m=mpMatch;
 if(!m?.active||!m.special||m.round?.ended||m.paused||document.hidden||arsenalOpened||
  m.actors.get(m.self)?.p.hp<=0||
  (typeof mp8GuestFrozen==='function'&&mp8GuestFrozen()))return false;
 const key=type==='flight'?'ft':MP6_SKILLS[type]?.key;
 if(!key||m.special[key]>=1e9)return false;
 m.special[key]++;
 // Give guests immediate flight feedback. The host may still refuse a
 // spoofed/stale command; snapshots always establish the real flight state.
 if(type==='flight'&&!m.host){
  const p=game.p;p.flying=!p.flying;p.vy=0;
  if(p.flying){p.grounded=false;input.jumpQueued=false;}
  refreshFlightButtons();
 }
 return true;
}
function mp6Input(enabled){
 const m=mpMatch,p=game?.p,keys=input.keys||{};
 return {...(m?.special||{ft:0,ad:0,aq:0,ac:0,ah:0}),
  u:!!(enabled&&p?.flying&&(input.flyUp||input.jumpHeld||keys.Space)),
  dn:!!(enabled&&p?.flying&&(input.flyDown||keys.ShiftLeft||keys.ShiftRight||
   keys.ControlLeft||keys.ControlRight))};
}
function mp6SafeInput(data){
 const result={};
 for(const key of MP6_EVENTS){
  const value=data[key]===undefined?0:data[key];
  if(!Number.isSafeInteger(value)||value<0||value>1e9)return null;
  result[key]=value;
 }
 for(const key of ['u','dn']){
  if(data[key]!==undefined&&typeof data[key]!=='boolean')return null;
  result[key]=data[key]===true;
 }
 return result;
}
function mp6ActorState(p){
 const cds=p.abilityCooldowns||{};
 return {fl:p.flying?1:0,sh:+(p.shield||0).toFixed(2),
  cd:['dash','pulse','shield','heal'].map(k=>+(cds[k]||0).toFixed(2))};
}
function mp6SafeState(p){
 return [0,1].includes(p.fl)&&Number.isFinite(p.sh)&&p.sh>=0&&p.sh<=3.01&&
  Array.isArray(p.cd)&&p.cd.length===4&&p.cd.every(n=>Number.isFinite(n)&&n>=0&&n<=8.51);
}
function mp6ApplyActorState(p,next,local){
 const changed=!!p.flying!==!!next.fl;
 p.flying=!!next.fl;p.shield=next.sh;
 const cds=p.abilityCooldowns||(p.abilityCooldowns={});
 for(const [i,name] of ['dash','pulse','shield','heal'].entries())cds[name]=next.cd[i];
 if(local&&changed)refreshFlightButtons();
}
function mp6FlyVertical(p,cmd,dt,floor,deck){
 const before=p.feetY,maxFeet=Math.max(floor,ceilingHeight()-PLAYER_SOLID_HEIGHT-.2);
 const direction=Number(!!cmd.u)-Number(!!cmd.dn);
 let after=clamp(before+direction*MP6_FLIGHT_VERTICAL*dt,floor,maxFeet);
 if(after>before){
  const low=deck-.17-PLAYER_SOLID_HEIGHT;
  if(deck>0&&before+PLAYER_SOLID_HEIGHT<=deck-.17+.001&&after>low)
   after=Math.min(after,low-.004);
  if(glReady){const roof=worldSolidHeadBarrier(p.x,p.z,.23,before+PLAYER_SOLID_HEIGHT,after+PLAYER_SOLID_HEIGHT);
   if(roof!==null)after=Math.min(after,roof-PLAYER_SOLID_HEIGHT-.004);}
 }else if(after<before&&glReady){
  const landing=worldSolidFeetBarrier(p.x,p.z,.23,before,after);
  if(landing!==null)after=Math.max(after,landing+.004);
 }
 p.feetY=clamp(after,floor,maxFeet);p.vy=0;p.grounded=p.feetY<=floor+.003;
}
function mp6Dash(a,cmd){
 const p=a.p,angle=p.yaw-(Math.hypot(cmd.mx,cmd.mz)>.12?Math.atan2(cmd.mx,cmd.mz):0);
 const others=[...mpMatch.actors.values()].filter(b=>b!==a&&b.p.hp>0).map(b=>b.p);
 const step=.15,range=4.5;
 const start={x:p.x,y:p.feetY+1,z:p.z};
 for(let d=0;d<range-1e-6;d+=step){
  const length=Math.min(step,range-d),x=p.x+Math.sin(angle)*length,z=p.z+Math.cos(angle)*length;
  const floor=supportHeight(p,x,z);
  if(collide(x,z,.26)||floor>p.feetY+.245||
   worldSolidBodyCollision(x,z,.26,Math.max(p.feetY,floor),PLAYER_SOLID_HEIGHT)||
   others.some(o=>Math.abs(o.feetY-p.feetY)<1.65&&hypot(o.x-x,o.z-z)<.69))break;
  p.x=x;p.z=z;
  if(p.grounded&&Math.abs(floor-p.feetY)<.245)p.feetY=floor;
 }
 mpCombatEmit('dash',start,{x:p.x,y:p.feetY+1,z:p.z},p.weapon,a.id);
}
function mp6Pulse(a){
 const p=a.p,o={x:p.x,y:p.feetY+1.03,z:p.z},radius=5.8;
 for(const target of mpMatch.actors.values()){
  if(target===a||target.p.hp<=0||target.respawnAt>mpMatch.tick)continue;
  const q=target.p,to={x:q.x,y:q.feetY+1.02,z:q.z};
  const distance=Math.hypot(o.x-to.x,o.y-to.y,o.z-to.z);
  if(distance>radius+.30||!mpCombatVisible(o,to))continue;
  mpCombatHit(a,target,32*(.28+.72*Math.max(0,1-distance/(radius+.3))));
 }
 mpCombatEmit('pulse',o,o,p.weapon,a.id);
}
function mp6Skill(a,name){
 const p=a.p,rule=MP6_SKILLS[name];if(!rule||p.hp<=0||a.respawnAt>mpMatch.tick)return false;
 const cds=p.abilityCooldowns;
 if(cds[name]>.001)return false;
 if(name==='heal'){
  // No artificial cooldown. Repair the full intended amount or nothing;
  // the last small missing remainder requires only its proportional cost.
  const missing=p.hp<100-1e-6?100-p.hp:Math.max(0,30-p.armor);
  const gain=p.hp<100-1e-6?38:22;
  if(missing<=1e-6)return false;
  const restored=Math.min(missing,gain),spent=restored/gain*rule.cost;
  if(p.energy+1e-6<spent)return false;
  p.energy=Math.max(0,p.energy-spent);
  if(p.hp<100-1e-6)p.hp=Math.min(100,p.hp+restored);
  else p.armor=Math.min(30,p.armor+restored);
  cds.heal=0;
  // The owner sees the restored HP immediately; do not wait for the periodic
  // 350 ms scoreboard update on the host. Guests still trust host snapshots.
  if(a.id===mpMatch.self&&typeof mpCombatSyncHud==='function')mpCombatSyncHud();
  // A final tiny remainder need not emit a barely visible network effect.
  if(restored>=.5){
   const o={x:p.x,y:p.feetY+1,z:p.z};mpCombatEmit('heal',o,o,p.weapon,a.id);
  }
  return true;
 }
 if(p.energy+1e-6<rule.cost)return false;
 if(name==='shield'&&p.shield>.001)return false;
 p.energy=Math.max(0,p.energy-rule.cost);cds[name]=rule.cooldown;
 if(name==='dash')mp6Dash(a,a.cmd);
 else if(name==='pulse')mp6Pulse(a);
 else if(name==='shield'){
  p.shield=3;const o={x:p.x,y:p.feetY+1,z:p.z};mpCombatEmit('shield',o,o,p.weapon,a.id);
 }
 return true;
}
function mp6Step(a,cmd,dt){
 const p=a.p,seen=a.lastSpecial;if(!seen)return;
 if(cmd.ft>seen.ft){
  const toggled=(cmd.ft-seen.ft)%2===1;
  seen.ft=cmd.ft;
  if(toggled&&p.hp>0&&!(a.respawnAt>mpMatch.tick)){
   p.flying=!p.flying;p.vy=0;
   if(p.flying)p.grounded=false;
   if(a.id===mpMatch.self)refreshFlightButtons();
  }
 }
 for(const name of ['dash','pulse','shield','heal']){
  const key=MP6_SKILLS[name].key;
  if(cmd[key]>seen[key]){seen[key]=cmd[key];mp6Skill(a,name);}
 }
 p.shield=Math.max(0,p.shield-dt);
 for(const name of Object.keys(MP6_SKILLS))p.abilityCooldowns[name]=Math.max(0,p.abilityCooldowns[name]-dt);
}
function mp6GuestStep(p,dt){
 p.shield=Math.max(0,(p.shield||0)-dt);
 for(const name of Object.keys(MP6_SKILLS))
  p.abilityCooldowns[name]=Math.max(0,(p.abilityCooldowns[name]||0)-dt);
}
