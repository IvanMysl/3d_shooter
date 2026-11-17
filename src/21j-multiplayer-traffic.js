// MP-10: bandwidth-aware, resilient PvP transport. All gameplay authority and
// collision checks stay unchanged; the unreliable RTC channel transports full
// world snapshots, NOT chained deltas that can break on one dropped packet.
// All V43 participants must use MP_VERSION=3: these wire arrays aren't V42.
const MP10_IDLE_INPUT=.24,MP10_IDLE_STATE=.25,MP10_ACTIVE_STATE=.10;
const MP10_ORDNANCE_CAP=48,MP10_PACKET_MAX=3800;
const MP10_EFFECTS=['shot','blast','down','spawn','dash','pulse','shield','heal'];
function mp10Round(n,digits=2){
 if(!Number.isFinite(n))return n;
 const factor=10**digits;return Math.round(n*factor)/factor;
}
function mp10InputSignature(command){
 // Quantization ONLY decides if a new packet is needed; it doesn't change
 // the authoritative controls. Tiny aiming noise doesn't wake idle traffic.
 return JSON.stringify([mp10Round(command.mx,2),mp10Round(command.mz,2),
  mp10Round(command.yaw,2),mp10Round(command.pitch,2),
  +!!command.j,+!!command.s,+!!command.f,command.w,
  +!!command.u,+!!command.dn,
  command.ft,command.ad,command.aq,command.ac,command.ah]);
}
function mp10InputDiscrete(command){
 return JSON.stringify([+!!command.j,+!!command.s,+!!command.f,+!!command.u,+!!command.dn,
  command.ft,command.ad,command.aq,command.ac,command.ah,
  +!!(Math.abs(command.mx)>.01),+!!(Math.abs(command.mz)>.01)]);
}
function mp10InputDue(m,command){
 const signature=mp10InputSignature(command);
 const changed=signature!==m.mp10LastInput;
 const active=Math.abs(command.mx)>.001||Math.abs(command.mz)>.001||
  command.j||command.s||command.f||command.u||command.dn;
 // Critical transitions (release fire/movement, new special action) must be
 // sent on the next frame, not deferred to an idle heartbeat.
 if(changed)if(changed){
  const urgent=!m.mp10LastInput||m.mp10LastDiscrete!==mp10InputDiscrete(command);
  return m.sendAcc>=(urgent?MP3_STEP-.002:MP3_INPUT_EVERY);
 }
 return m.sendAcc>=(active?MP3_INPUT_EVERY:MP10_IDLE_INPUT);
}
function mp10InputSent(m,command){m.mp10LastInput=mp10InputSignature(command);m.mp10LastDiscrete=mp10InputDiscrete(command);}
function mp10SnapshotPeriod(m){
 if(m.projectiles.length>0)return MP10_ACTIVE_STATE;
 for(const actor of m.actors.values()){
  const p=actor.p,c=actor.liveCmd||actor.cmd||{},last=m.mp10LastSnapshot?.get(actor.id);
  if(Math.abs(c.mx||0)>.002||Math.abs(c.mz||0)>.002||c.j||c.s||c.f||c.u||c.dn||
   !p.grounded&&Math.abs(p.vy||0)>.02||actor.respawnAt>m.tick)return MP10_ACTIVE_STATE;
  // Standing still is NOT equivalent to an inactive fight. Aim turns,
  // impacts, repairs and fresh shields must receive prompt snapshots too.
  if(!last||Math.abs(Math.atan2(Math.sin(p.yaw-last[0]),Math.cos(p.yaw-last[0])))>.025||
   Math.abs(p.pitch-last[1])>.025||Math.abs(p.hp-last[2])>.05||
   p.armor<last[3]-.05||p.armor>last[3]+4||p.weapon!==last[4]||
   (actor.kills||0)!==last[5]||(actor.deaths||0)!==last[6]||
   !!p.flying!==last[7]||!!(p.shield>.01)!==last[8]||p.energy<last[9]-10||
   Math.hypot(p.x-last[10],p.z-last[11])>.06||Math.abs(p.feetY-last[12])>.06)
    return MP10_ACTIVE_STATE;
 }
 return MP10_IDLE_STATE;
}
function mp10SnapshotSent(m){
 m.mp10LastSnapshot=new Map([...m.actors.values()].map(a=>{
  const p=a.p;return [a.id,[p.yaw,p.pitch,p.hp,p.armor,p.weapon,
   a.kills||0,a.deaths||0,!!p.flying,!!(p.shield>.01),p.energy,p.x,p.z,p.feetY]];
 }));
}
function mp10ProjectilesFor(peer,list){
 const actor=mpMatch?.actors&&[...mpMatch.actors.values()].find(a=>a.peerId===peer);
 if(!actor||list.length<=MP10_ORDNANCE_CAP)return list.slice(0,MP10_ORDNANCE_CAP);
 const p=actor.p;
 return list.map((s,i)=>{
  const dx=s.x-p.x,dy=s.y-p.feetY-1,dz=s.z-p.z;
  const fx=dx+s.vx*.35,fy=dy+s.vy*.35,fz=dz+s.vz*.35;
  return {i,score:Math.min(dx*dx+dy*dy+dz*dz,fx*fx+fy*fy+fz*fz)};
 }).sort((a,b)=>a.score-b.score||a.i-b.i).slice(0,MP10_ORDNANCE_CAP).map(x=>list[x.i]);
}
function mp10Encode(value,peer){
 if(!value||typeof value!=='object')return null;
 if(value.kind==='mp3-input'){
  const c=value;
  return {v:c.v,kind:'mp3-input',token:c.token,c:1,s:c.seq,
   i:[mp10Round(c.mx,3),mp10Round(c.mz,3),+!!c.j,+!!c.s,
    mp10Round(c.yaw,3),mp10Round(c.pitch,3),+!!c.f,c.w,
    c.ft||0,c.ad||0,c.aq||0,c.ac||0,c.ah||0,+!!c.u,+!!c.dn]};
 }
 if(value.kind==='mp3-effect'){
  const code=MP10_EFFECTS.indexOf(value.type);
  if(code<0)return value;
  return {v:value.v,kind:'mp3-effect',token:value.token,c:1,
   i:[code,value.gun,value.id,...value.a,...value.b]};
 }
 if(value.kind!=='mp3-state')return value;
 const out={v:value.v,kind:'mp3-state',token:value.token,c:1,t:value.tick,
  a:value.actors.map(p=>[p.id,p.x,p.z,p.h,p.yaw,p.pitch,p.vy,p.e,p.w,p.g,
   p.fl??0,p.sh??0,...(p.cd||[0,0,0,0]),p.hp,p.ar,p.gun,p.k,p.d,p.rs,p.iv])};
 const visible=mp10ProjectilesFor(peer,value.ordnance||[]);
 if(visible.length)out.o=visible.map(p=>[p.x,p.y,p.z,p.vx,p.vy,p.vz,p.gun]);
 // Network clock correction ~once/second is enough: the guest counts down
 // locally between updates. ALWAYS include the result when the round ends.
 if(value.round&&(value.round.result||value.tick<5||value.tick%30<5))out.r=value.round;
 // Avoid long SCTP messages (particularly when all eight players fill the
 // arena with rockets). Prefer dropping the FARTHEST visual projectile; never
 // remove an actor or the authoritative health/score/round result.
 while(out.o?.length&&JSON.stringify(out).length>MP10_PACKET_MAX)out.o.pop();
 return out;
}
function mp10Decode(data){
 if(!data||data.c!==1||!['mp3-input','mp3-state','mp3-effect'].includes(data.kind))return null;
 if(data.kind==='mp3-input'){
  const a=data.i;
  if(!Array.isArray(a)||a.length!==15||![2,3,6,13,14].every(i=>a[i]===0||a[i]===1))return null;
  return {v:data.v,kind:'mp3-input',token:data.token,seq:data.s,
   mx:a[0],mz:a[1],j:!!a[2],s:!!a[3],yaw:a[4],pitch:a[5],f:!!a[6],w:a[7],
   ft:a[8],ad:a[9],aq:a[10],ac:a[11],ah:a[12],u:!!a[13],dn:!!a[14]};
 }
 if(data.kind==='mp3-effect'){
  const a=data.i;
  if(!Array.isArray(a)||a.length!==9||!Number.isInteger(a[0])||a[0]<0||a[0]>=MP10_EFFECTS.length)return null;
  return {v:data.v,kind:'mp3-effect',token:data.token,
   type:MP10_EFFECTS[a[0]],gun:a[1],id:a[2],a:a.slice(3,6),b:a.slice(6)};
 }
 if(!Array.isArray(data.a)||data.a.length<1||data.a.length>MP_CAP||
  !data.a.every(a=>Array.isArray(a)&&a.length===23)||
  (data.o!==undefined&&(!Array.isArray(data.o)||data.o.length>MP10_ORDNANCE_CAP||
   !data.o.every(a=>Array.isArray(a)&&a.length===7))))return null;
 const actors=data.a.map(a=>({id:a[0],x:a[1],z:a[2],h:a[3],yaw:a[4],pitch:a[5],vy:a[6],
  e:a[7],w:a[8],g:a[9],fl:a[10],sh:a[11],cd:a.slice(12,16),
  hp:a[16],ar:a[17],gun:a[18],k:a[19],d:a[20],rs:a[21],iv:a[22]}));
 const ordnance=(data.o||[]).map(a=>({x:a[0],y:a[1],z:a[2],vx:a[3],vy:a[4],vz:a[5],gun:a[6]}));
 return {v:data.v,kind:'mp3-state',token:data.token,tick:data.t,actors,ordnance,round:data.r||null};
}
function mp10RecordTx(n){
 if(mpMatch?.active&&Number.isFinite(n))mpMatch.netTx=(mpMatch.netTx||0)+n;
}
function mp10RecordRx(n){
 if(mpMatch?.active&&Number.isFinite(n))mpMatch.netRx=(mpMatch.netRx||0)+n;
}
function mp10TrafficLabel(){
 const m=mpMatch;if(!m?.active)return '';
 return 'WebRTC полезные данные: передано '+((m.netTx||0)/1024).toFixed(1)+
  ' КиБ, получено '+((m.netRx||0)/1024).toFixed(1)+
  ' КиБ (без UDP/IP/DTLS/TURN и сигнализации Metered).';
}
