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
  const packed={v:value.v,kind:'mp3-effect',token:value.token,c:1,
   i:[code,value.gun,value.id,...value.a,...value.b]};
  // Stage47: compact hit flags are optional and sent only after a real hit.
  // They MUST survive MP10 compression; otherwise remote players see no FX.
  if(value.h?.length)packed.h=value.h;
  if(value.s!==undefined)packed.s=value.s;
  if(value.wall!==undefined)packed.wall=value.wall;
  if(value.surface!==undefined)packed.surface=value.surface;
  if(value.repair!==undefined)packed.repair=value.repair;
  return packed;
 }
 if(value.kind!=='mp3-state')return value;
 const out={v:value.v,kind:'mp3-state',token:value.token,c:1,t:value.tick,
  a:value.actors.map(p=>[p.id,p.x,p.z,p.h,p.yaw,p.pitch,p.vy,p.e,p.w,p.g,
   p.fl??0,p.sh??0,...(p.cd||[0,0,0,0]),p.hp,p.ar,p.gun,p.k,p.d,p.rs,p.iv])};
 // Optional thermal HUD fields: old V42 clients ignore q; old hosts omit it.
 if(value.actors.every(p=>[p.ht,p.hl,p.wc].every(Number.isFinite)))out.q=value.actors.map(p=>[p.ht,p.hl,p.wc]);
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
  if(!Array.isArray(a)||a.length!==9||!Number.isInteger(a[0])||a[0]<0||a[0]>=MP10_EFFECTS.length||
   (data.h!==undefined&&(!Array.isArray(data.h)||data.h.length>MP_CAP||
    !data.h.every(n=>Number.isInteger(n)&&n>=0&&n<MP_CAP*4)))||
   (data.s!==undefined&&(!Number.isInteger(data.s)||data.s<0||data.s>=MP_CAP))||
   (data.wall!==undefined&&(MP10_EFFECTS[a[0]]!=='shot'||!mpCombatWallDataValid(data.wall)))||
   (data.surface!==undefined&&(MP10_EFFECTS[a[0]]!=='blast'||!mpCombatWallDataValid(data.surface)))||
   (data.repair!==undefined&&(MP10_EFFECTS[a[0]]!=='heal'||!['hp','armor'].includes(data.repair))))return null;
  return {v:data.v,kind:'mp3-effect',token:data.token,
   type:MP10_EFFECTS[a[0]],gun:a[1],id:a[2],a:a.slice(3,6),b:a.slice(6),
   ...(data.h!==undefined?{h:data.h}:{}),...(data.s!==undefined?{s:data.s}:{}),
   ...(data.wall!==undefined?{wall:data.wall}:{}),...(data.surface!==undefined?{surface:data.surface}:{}),...(data.repair!==undefined?{repair:data.repair}:{})};
 }
 if(!Array.isArray(data.a)||data.a.length<1||data.a.length>MP_CAP||
  !data.a.every(a=>Array.isArray(a)&&a.length===23)||
  (data.o!==undefined&&(!Array.isArray(data.o)||data.o.length>MP10_ORDNANCE_CAP||
   !data.o.every(a=>Array.isArray(a)&&a.length===7))))return null;
 if(data.q!==undefined&&(!Array.isArray(data.q)||data.q.length!==data.a.length||!data.q.every(a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite)&&a[0]>=0&&a[0]<=105.01&&a[1]>=0&&a[1]<=1.01&&a[2]>=0&&a[2]<=2.01)))return null;
 const actors=data.a.map((a,i)=>({id:a[0],x:a[1],z:a[2],h:a[3],yaw:a[4],pitch:a[5],vy:a[6],
  e:a[7],w:a[8],g:a[9],fl:a[10],sh:a[11],cd:a.slice(12,16),
  hp:a[16],ar:a[17],gun:a[18],k:a[19],d:a[20],rs:a[21],iv:a[22],
  ...(data.q?{ht:data.q[i][0],hl:data.q[i][1],wc:data.q[i][2]}:{})}));
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
// Room-local transient chat, reliable RTC control channel, host-authenticated sender.
// Never uses signalling, campaign storage, simulation pause or remote HTML.
const MP_CHAT_MAX=240,MP_CHAT_HISTORY=100,MP_CHAT_TTL=7000,MP_CHAT_SYNC_CHUNK=3;
let mpChatOpeningT=false;
let mpChat={room:null,seq:0,last:0,items:[],rates:new Map(),accepted:new Map(),syncs:new Map(),pending:null,failed:null,unread:0,open:false,draft:'',timer:null,ackTimer:null,locked:false,previousFocus:null,viewportTimer:null,viewportBase:0,readerBrowsing:false,touchScrolling:false,visibleChatHeight:0,imeReported:false,imeDismissed:false,imeFocusAt:0};
function mpChatText(raw){
 if(typeof raw!=='string'||raw.length>MP_CHAT_MAX*2)return null;
 // Normalize whitespace; strip control/format characters except joiners used by emoji/scripts.
 const text=raw.normalize('NFC').replace(/\s+/gu,' ').replace(/[\p{Cc}\u061c\u200b\u200e\u200f\u202a-\u202e\u2060-\u206f\ufeff]/gu,'').trim();
 return text&&Array.from(text).length<=MP_CHAT_MAX?text:null;
}
function mpChatEnsure(){
 if(!mpRoom||!mpWire||mpMatch?.preview)return false;
 if(mpChat.room!==mpRoom){mpChatReset();mpChat.room=mpRoom;}
 return true;
}
function mpChatSendPeer(peer,data){const l=mpRtcLinks.get(peer);return !!l&&mpRtcSend(l,l.control,{v:MP_VERSION,...data});}
function mpChatRate(peer,nonce,now=Date.now()){
 // Per authenticated peer, burst 3 then one message per 1800ms. Reject replay.
 // Departed peers are pruned; roster cap bounds memory.
 for(const key of mpChat.rates.keys())if(!mpRoom.players.some(p=>p.peerId===key))mpChat.rates.delete(key);
 let r=mpChat.rates.get(peer);if(!r){r={tokens:3,at:now,seen:[]};mpChat.rates.set(peer,r);}
 r.tokens=Math.min(3,r.tokens+Math.max(0,now-r.at)/1800);r.at=now;
 if(r.seen.includes(nonce)||r.tokens<1)return false;
 r.tokens--;r.seen.push(nonce);if(r.seen.length>32)r.seen.shift();return true;
}
function mpChatAccept(peer,data){
 if(!mpChatEnsure()||!mpRoom.host)return false;
 const p=mpRoom.players.find(p=>p.peerId===peer),text=mpChatText(data.text),nonce=data.nonce;
 if(!p||!text||typeof nonce!=='string'||!/^[A-Z2-7]{13}$/.test(nonce))return false;
 const key=peer+'/'+nonce,accepted=mpChat.accepted.get(key);
 // A retry reuses its nonce; replay ONLY the original accepted message.
 // Do not spend another spam token or broadcast a second copy.
 if(accepted){mpChatSendPeer(peer,accepted);return true;}
 if(!mpChatRate(peer,nonce)){
  const r=mpChat.rates.get(peer),now=Date.now();
  if(peer!==mpWire.peerId&&r&&now-(r.rejectedAt||0)>1000){r.rejectedAt=now;mpChatSendPeer(peer,{kind:'chat-reject',nonce});}
  return false;
 }
 const msg={kind:'chat-message',seq:++mpChat.seq,id:p.id,nick:p.nick,text,nonce};
 mpChat.accepted.set(key,msg);
 while(mpChat.accepted.size>MP_CHAT_HISTORY*2)mpChat.accepted.delete(mpChat.accepted.keys().next().value);
 mpChatReceive(msg);
 for(const other of mpRoom.players)if(other.peerId!==mpWire.peerId)mpChatSendPeer(other.peerId,msg);
 return true;
}
function mpChatConfirmPending(data){
 const p=mpChat.pending,selfId=mpRoom?.players.find(p=>p.peerId===mpWire?.peerId)?.id;
 if(p&&data.nonce===p.nonce&&data.id===selfId){
  clearTimeout(mpChat.ackTimer);mpChat.pending=null;mpChatStatus('Отправлено');
 }
 if(mpChat.failed?.nonce===data.nonce&&data.id===selfId){
  const oldText=mpChat.failed.text,field=$('mpChatInput');
  // An acknowledgement may arrive after timeout. Do not leave the restored
  // identical draft ready to be sent again as an accidental duplicate.
  if(mpChat.draft===oldText){
   mpChat.draft='';if(field?.value===oldText)field.value='';mpChatRenderCount();
  }
  mpChat.failed=null;mpChatStatus('Отправлено после восстановления');
 }
}
function mpChatReceive(data,replay=false){
 if(!mpChatEnsure()||!Number.isSafeInteger(data.seq)||data.seq<1||data.seq>1000000000||
  !Number.isInteger(data.id)||data.id<0||data.id>10000)return false;
 const text=mpChatText(data.text);
 let nick;try{nick=mpNickname(data.nick);}catch(_){return false;}
 // Old messages remain valid after their author leaves the lobby. Only the
 // host authenticates live senders; guests accept chat-message from the host.
 if(!text||typeof data.nonce!=='string'||
  !/^[A-Z2-7]{13}$/.test(data.nonce))return false;
 // A previously received live message can legitimately be replayed during
 // recovery; acknowledge it before de-duplication.
 mpChatConfirmPending(data);
 if(mpChat.items.some(m=>m.seq===data.seq))return true;
 if(!replay&&data.seq<=mpChat.last)return false;
 const newer=data.seq>mpChat.last;
 if(newer&&!mpChat.open&&data.id!==mpRoom.players.find(p=>p.peerId===mpWire.peerId)?.id)
  mpChat.unread=Math.min(99,mpChat.unread+1);
 mpChat.last=Math.max(mpChat.last,data.seq);
 mpChat.items.push({seq:data.seq,id:data.id,nick,text,nonce:data.nonce,at:Date.now()});
 mpChat.items.sort((a,b)=>a.seq-b.seq);
 if(mpChat.items.length>MP_CHAT_HISTORY)mpChat.items.splice(0,mpChat.items.length-MP_CHAT_HISTORY);
 mpChatRender();return true;
}
function mpChatSync(peer,after){
 if(!mpChatEnsure()||!mpRoom.host||!mpRoom.players.some(p=>p.peerId===peer)||
  !Number.isSafeInteger(after)||after<0||after>1000000000)return false;
 // Do not let a client flood the control channel with history requests.
 const now=Date.now();if(now-(mpChat.syncs.get(peer)||0)<1800)return false;
 mpChat.syncs.set(peer,now);
 const missing=mpChat.items.filter(x=>x.seq>after).slice(-MP_CHAT_HISTORY);
 for(let i=0;i<missing.length;i+=MP_CHAT_SYNC_CHUNK){
  const items=missing.slice(i,i+MP_CHAT_SYNC_CHUNK).map(m=>({seq:m.seq,id:m.id,nick:m.nick,text:m.text,nonce:m.nonce}));
  if(!mpChatSendPeer(peer,{kind:'chat-history',items}))return false;
 }
 return true;
}
function mpChatControl(peer,data){
 if(!mpChatEnsure())return;
 if(mpRoom.host){
  if(data.kind==='chat-send')mpChatAccept(peer,data);
  else if(data.kind==='chat-sync')mpChatSync(peer,data.after);
  return;
 }
 if(peer!==mpRoom.hostPeer)return;
 if(data.kind==='chat-message')mpChatReceive(data);
 else if(data.kind==='chat-history'&&Array.isArray(data.items)&&
  data.items.length<=MP_CHAT_SYNC_CHUNK){
  for(const item of data.items)if(item&&typeof item==='object')mpChatReceive(item,true);
 }
 else if(data.kind==='chat-reject'&&mpChat.pending?.nonce===data.nonce)
  mpChatFailed('Слишком часто. Повторите позже.');
}
function mpChatOnChannelOpen(peer){
 if(!mpChatEnsure()||mpRoom.host||peer!==mpRoom.hostPeer)return;
 mpChatSendPeer(peer,{kind:'chat-sync',after:mpChat.last});
 if(mpChat.pending)mpChatSendPeer(peer,{kind:'chat-send',nonce:mpChat.pending.nonce,text:mpChat.pending.text});
}
function mpChatStatus(text){const el=$('mpChatStatus');if(el)el.textContent=text;}
function mpChatFailed(text){
 clearTimeout(mpChat.ackTimer);const p=mpChat.pending;mpChat.pending=null;
 if(p){
  // A timed-out message might have arrived at the host. The next manual
  // retry MUST use the same nonce, avoiding duplicate publication.
  mpChat.failed={nonce:p.nonce,text:p.text};
  if(!mpChat.draft){mpChat.draft=p.text;const field=$('mpChatInput');if(field)field.value=p.text;}
 }
 mpChatRenderCount();mpChatStatus(text);mpChatRender();
}
function mpChatRetryTimer(){
 clearTimeout(mpChat.ackTimer);
 const p=mpChat.pending;if(!p)return;
 mpChat.ackTimer=setTimeout(()=>{
  const current=mpChat.pending;if(current!==p)return;
  if(current.retries>=2){mpChatFailed('Подтверждение не пришло. Сообщение сохранено для безопасной повторной отправки.');return;}
  current.retries++;
  if(!mpChatSendPeer(mpRoom?.hostPeer,{kind:'chat-send',nonce:current.nonce,text:current.text})){
   mpChatFailed('Связь потеряна. Черновик сохранён.');return;
  }
  mpChatStatus('Повторная передача…');mpChatRetryTimer();
 },2600);
}
function mpChatSubmit(raw){
 if(!mpChatEnsure())return false;
 const text=mpChatText(raw);if(!text){mpChatStatus('Сообщение: от 1 до 240 символов.');return false;}
 if(mpChat.pending){mpChatStatus('Ожидаем подтверждения предыдущего сообщения.');return false;}
 const nonce=mpChat.failed?.text===text?mpChat.failed.nonce:mpRandom(8);
 mpChat.failed=null;
 const data={kind:'chat-send',nonce,text};
 if(mpRoom.host){
  if(!mpChatAccept(mpWire.peerId,data)){mpChatStatus('Слишком часто. Повторите позже.');return false;}
  mpChatStatus('Отправлено');return true;
 }
 // Register pending BEFORE sending; fake and loopback RTC channels can deliver
 // an immediate acknowledgement synchronously.
 const p={nonce,text,retries:0};mpChat.pending=p;
 if(!mpChatSendPeer(mpRoom.hostPeer,data)){
  mpChat.pending=null;mpChat.failed={nonce,text};
  mpChatStatus('Нет связи с ведущим. Черновик сохранён.');return false;
 }
 if(mpChat.pending===p){mpChatStatus('Отправляется…');mpChatRetryTimer();}
 mpChatRender();return true;
}
function mpChatInBattle(){return !!(mpRoom&&mpWire&&mpMatch?.active&&!mpMatch.preview&&!mpMatch.round?.ended&&!mpMatch.paused&&game?.state==='playing'&&$('overlay')?.classList.contains('hidden'));}
function mpChatClearInput(){
 input.keys={};input.fire=false;input.jumpQueued=false;input.jumpHeld=false;input.sprint=false;input.mobileSprint=false;input.flyUp=false;input.flyDown=false;input.mx=0;input.mz=0;input.lastSpaceAt=-Infinity;input.lastWAt=-Infinity;
 if(mpMatch){mpMatch.fireUntil=0;mpMatch.jumpUntil=0;}
 if(input.pid!=null){try{glCanvas.releasePointerCapture(input.pid);}catch(_){}input.pid=null;}
 if(input.joyId!=null){try{$('joystick').releasePointerCapture(input.joyId);}catch(_){}input.joyId=null;}
 const stick=$('stick');if(stick)stick.style.transform='translate(0,0)';
 $('runTouch')?.classList.remove('running');$('runTouch')?.setAttribute('aria-pressed','false');
}
// Android content:// WebViews can report either a resized visual viewport,
// a VirtualKeyboard bounding rectangle, or neither. Never add the keyboard
// height as padding to an already resized dialog (the Stage124 regression).
// When neither API reports it, reserve a conservative top viewport for the
// composer instead of allowing the OS keyboard to cover an editable field.
function mpChatAvailableHeight(base,visual,layout,keyboard,focused,mobile){
 const full=Math.max(1,Number(base)||Number(layout)||1);
 const vv=Math.max(1,Number(visual)||Number(layout)||full);
 const inner=Math.max(1,Number(layout)||full);
 const kb=Math.max(0,Number(keyboard)||0);
 const shrunk=Math.min(vv,inner)<full-Math.max(65,full*.11);
 // Some browsers expose BOTH a shrunken viewport and keyboard geometry.
 // In that case the viewport is already keyboard-free; do not subtract twice.
 const reported=Math.max(1,Math.min(vv,inner,!shrunk&&kb>40?Math.max(1,inner-kb):Infinity));
 if(!mobile||!focused)return reported;
 const hasKeyboardReport=kb>40||shrunk;
 // 42% remains above the larger landscape keyboards seen in Android browsers.
 // Reported geometry takes precedence so the input can sit closer to the IME.
 return hasKeyboardReport?reported:Math.min(reported,Math.floor(full*.42));
}
function mpChatViewport(){
 const root=$('mpChatLayer'),vv=window.visualViewport;if(!root)return;
 const layout=window.innerHeight||document.documentElement.clientHeight||1;
 const vh=vv?.height||layout,vw=vv?.width||window.innerWidth;
 const base=mpChat.viewportBase||layout;
 const mobile=matchMedia('(hover:none),(pointer:coarse)').matches;
 const focused=document.activeElement===$('mpChatInput')&&mpChat.open;
 const keyboard=Math.max(0,Number(navigator.virtualKeyboard?.boundingRect?.height)||0);
 const reported=keyboard>40||Math.min(vh,layout)<base-Math.max(65,base*.11);
 // Android may retain focus when its keyboard disappears. Focus alone must
 // never force the 42% safety viewport forever after a real IME resize ends.
 const dismissed=mpChat.imeReported&&!reported;
 const appeared=reported&&!mpChat.imeReported;
 if(reported){mpChat.imeReported=true;mpChat.imeDismissed=false;}
 else if(dismissed){mpChat.imeReported=false;mpChat.imeDismissed=true;}
 const editing=focused&&!mpChat.imeDismissed;
 const height=mpChatAvailableHeight(base,vh,layout,keyboard,editing,mobile);
 const heightChanged=Math.abs((mpChat.visibleChatHeight||0)-height)>2;
 mpChat.visibleChatHeight=height;
 root.style.setProperty('--chat-vh',height+'px');root.style.setProperty('--chat-top',(vv?.offsetTop||0)+'px');
 root.style.setProperty('--chat-left',(vv?.offsetLeft||0)+'px');root.style.setProperty('--chat-vw',vw+'px');
 root.classList.toggle('chatImeVisible',editing&&mobile&&height<base-40);
 root.classList.toggle('chatInputFocused',focused&&mobile&&!mpChat.imeDismissed);
 const hide=$('mpChatHideKeyboard');if(hide)hide.hidden=!(focused&&mobile&&!mpChat.imeDismissed);
 // IME dismissal is an explicit layout transition, not an attempt to infer
 // keyboard state from a persistent blinking caret.
 if(!mpChat.touchScrolling&&(dismissed||appeared)){
  // Only the keyboard's first appearance / disappearance gets an immediate
  // anchor. Later resize ticks and touch swipes never fight the reader.
  mpChatScrollToLatest();
 }else if(editing&&!mpChat.readerBrowsing&&heightChanged)requestAnimationFrame(mpChatFollowComposer);
}
function mpChatDismissKeyboard(){
 if(!mpChat.open)return;
 mpChat.imeDismissed=true;mpChat.imeReported=false;
 clearInterval(mpChat.viewportTimer);mpChat.viewportTimer=null;
 const field=$('mpChatInput');if(document.activeElement===field)field.blur();
 mpChatViewport();
 if(!mpChat.touchScrolling){mpChatScrollToLatest();requestAnimationFrame(mpChatScrollToLatest);}
}
function mpChatViewportEvent(e){
 if(!mpChat.open)return;
 // Some Android content:// browsers emit a resize after Back without
 // changing the exposed viewport dimensions or blurring their input field.
 // Treat a late *real* resize with full geometry as the dismiss signal;
 // internal polling calls do not trigger this fallback.
 const base=mpChat.viewportBase||window.innerHeight||1;
 const vh=window.visualViewport?.height||window.innerHeight||1;
 const layout=window.innerHeight||1;
 const keyboard=Number(navigator.virtualKeyboard?.boundingRect?.height)||0;
 const full=Math.min(vh,layout)>=base-Math.max(40,base*.06)&&keyboard<=40;
 if(full&&mpChat.imeFocusAt&&performance.now()-mpChat.imeFocusAt>650&&
    document.activeElement===$('mpChatInput')&&mpChat.visibleChatHeight<base*.7){
  mpChat.imeDismissed=true;mpChat.imeReported=false;
 }
 mpChatViewport();
 if(mpChat.imeDismissed&&!mpChat.touchScrolling)requestAnimationFrame(mpChatScrollToLatest);
}
function mpChatFollowKeyboard(){
 // Animations/IME suggestion rows often resize for ~500-900ms after focus.
 // Track that transition with a bounded reflow, no permanent polling.
 clearInterval(mpChat.viewportTimer);
 const until=performance.now()+1350;
 mpChatViewport();
 mpChat.viewportTimer=setInterval(()=>{
  mpChatViewport();
  // Native Android input auto-scroll can run AFTER the resize handler; keep
  // the *whole* composer visible during its short keyboard-opening animation.
  // Any deliberate reader gesture takes ownership immediately.
  if(mpChat.open&&!mpChat.readerBrowsing&&!mpChat.touchScrolling)mpChatFollowComposer();
  if(!mpChat.open||performance.now()>=until){clearInterval(mpChat.viewportTimer);mpChat.viewportTimer=null;}
 },65);
}
function mpChatScrollBox(){
 // The native touch scroller owns the whole document, including the composer.
 // Desktop keeps the compact independent log for the Minecraft-style overlay.
 return typeof window!=='undefined'&&typeof window.matchMedia==='function'&&window.matchMedia('(hover:none),(pointer:coarse)').matches
  ?$('mpChatScroll'):$('mpChatHistory');
}
function mpChatScrollToLatest(){
 const box=mpChatScrollBox();if(!box)return;
 mpChat.readerBrowsing=false;box.scrollTop=box.scrollHeight;
}
function mpChatFollowComposer(){
 const box=mpChatScrollBox();if(!box)return;
 // IME changes may be delayed: re-anchor ONLY when the player is composing.
 if(mpChat.open&&!mpChat.readerBrowsing&&document.activeElement===$('mpChatInput')){const box=mpChatScrollBox();if(box)box.scrollTop=box.scrollHeight;}
}
function mpChatOpen(){
 if(!mpChatEnsure()||mpChat.open||(!mpChatInBattle()&&!$('mpLobbyChat')))return false;
 const layer=$('mpChatLayer');if(!layer)return false;
 mpChat.previousFocus=document.activeElement;mpChat.locked=document.pointerLockElement===glCanvas;
 mpChat.viewportBase=Math.max(window.innerHeight||0,window.visualViewport?.height||0);
 mpChat.imeReported=false;mpChat.imeDismissed=false;mpChat.imeFocusAt=0;
 mpChat.open=true;mpChat.unread=0;closeArsenal();mpChatClearInput();pauseResumeGraceUntil=performance.now()+1500;
 if(document.pointerLockElement)document.exitPointerLock();
 document.documentElement.classList.add('mpChatOpen');document.body.classList.add('mpChatOpen');$('hud').inert=true;$('overlay').inert=true;layer.hidden=false;
 const field=$('mpChatInput');field.value=mpChat.draft;mpChatRenderCount();mpChatViewport();mpChatRender(true);
 // Opening with a finger must NOT summon the IME or park the composer at 42%
 // of the screen. It starts at the bottom; a tap on the field opens the IME.
 if(typeof window==='undefined'||!window.matchMedia?.('(hover:none),(pointer:coarse)').matches){field.focus({preventScroll:true});mpChatFollowKeyboard();}
 requestAnimationFrame(mpChatScrollToLatest);return true;
}
function mpChatClose(resume=false){
 if(!mpChat.open)return false;
 mpChat.draft=$('mpChatInput')?.value||'';mpChat.open=false;
 clearInterval(mpChat.viewportTimer);mpChat.viewportTimer=null;mpChat.viewportBase=0;mpChat.imeReported=false;mpChat.imeDismissed=false;mpChat.imeFocusAt=0;
 const layer=$('mpChatLayer');if(layer)layer.hidden=true;
 document.documentElement.classList.remove('mpChatOpen');document.body.classList.remove('mpChatOpen');$('hud').inert=false;$('overlay').inert=false;
 pauseResumeGraceUntil=performance.now()+1500;mpChatClearInput();
 if(resume&&mpChat.locked&&mpChatInBattle()&&!touchOnly){try{const p=glCanvas.requestPointerLock?.();p?.catch?.(()=>{});}catch(_){}}
 else if(resume&&mpChat.previousFocus?.isConnected)mpChat.previousFocus.focus({preventScroll:true});
 mpChat.locked=false;mpChat.previousFocus=null;mpChatRender();return true;
}
function mpChatReset(){
 mpChatClose(false);clearTimeout(mpChat.timer);clearTimeout(mpChat.ackTimer);
 mpChat={room:null,seq:0,last:0,items:[],rates:new Map(),accepted:new Map(),syncs:new Map(),pending:null,failed:null,unread:0,open:false,draft:'',timer:null,ackTimer:null,locked:false,previousFocus:null,viewportTimer:null,viewportBase:0,readerBrowsing:false,touchScrolling:false,visibleChatHeight:0,imeReported:false,imeDismissed:false,imeFocusAt:0};
 const field=$('mpChatInput');if(field)field.value='';$('mpChatHistory')?.replaceChildren();mpChat.readerBrowsing=false;const scroll=$('mpChatScroll');if(scroll)scroll.scrollTop=0;mpChatStatus('');mpChatRender();
}
function mpChatRender(forceBottom=false){
 const feed=$('mpChatFeed'),list=$('mpChatHistory'),button=$('mpChatButton'),scroller=mpChatScrollBox();if(!feed||!list||!button||!scroller)return;
 const battle=mpChatInBattle();button.hidden=!battle;const unread=$('mpChatUnread');if(unread){unread.hidden=!mpChat.unread;unread.textContent=mpChat.unread>9?'9+':String(mpChat.unread);}
 const lobby=$('mpLobbyChat');if(lobby)lobby.textContent='💬 ЧАТ КОМНАТЫ'+(mpChat.unread?' · '+mpChat.unread+' НОВ.':'');feed.hidden=!battle||mpChat.open;
 const now=Date.now(),recent=mpChat.items.filter(x=>now-x.at<MP_CHAT_TTL).slice(-3);
 const row=(m,preview=false)=>{const el=document.createElement('div');el.className='mpChatLine';
  if(!preview){el.dataset.chatSeq=String(m.seq);el.dataset.chatKey=String(m.seq)+'|'+m.id;const t=document.createElement('time');t.textContent=new Date(m.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});el.append(t);}
  const name=document.createElement('b');name.textContent=m.nick+': ';el.append(name,document.createTextNode(m.text));return el;};
 feed.replaceChildren(...recent.map(m=>row(m,true)));feed.hidden=feed.hidden||!recent.length;
 if(mpChat.open){
  // IMPORTANT: do not rebuild the 100 DOM rows on transient HUD/chat ticks.
  // A replacement interrupts active Android touch scrolling and can move the
  // reader back to the newest message while the keyboard animates.
  const current=mpChat.items.map(m=>String(m.seq)+'|'+m.id);
  const old=[...list.children].filter(el=>el.classList.contains('mpChatLine'));
  const previous=old.map(el=>el.dataset.chatKey);
  const same=old.length===current.length&&previous.every((seq,i)=>seq===current[i])&&
   (current.length>0||!!list.querySelector('.mpChatEmpty'));
  if(!same){
   const wasAtBottom=!mpChat.readerBrowsing&&scroller.scrollHeight-scroller.scrollTop-scroller.clientHeight<35;
   const oldScroll=scroller.scrollTop;
   // Save the first VISIBLE message to keep the same text under the finger
   // when the 100-message history trims an old item or receives late sync.
   const area=scroller.getBoundingClientRect();
   const anchor=old.find(el=>el.getBoundingClientRect().bottom>area.top+1);
   const anchorSeq=anchor?.dataset.chatSeq;
   const anchorY=anchor?anchor.getBoundingClientRect().top-area.top:0;
   const trimmed=previous.length?previous.indexOf(current[0]):-1;
   const shared=trimmed>=0&&current.length>=previous.length-trimmed&&
    previous.slice(trimmed).every((seq,i)=>current[i]===seq);
   if(shared){
    // Append and 100-message window trim both keep the shared DOM rows.
    // Removing/recreating every row during a finger drag breaks the gesture.
    for(let i=0;i<trimmed;i++)old[i].remove();
    list.append(...mpChat.items.slice(previous.length-trimmed).map(m=>row(m)));
   }else if(current.length){
    list.replaceChildren(...mpChat.items.map(m=>row(m)));
   }else{
    const empty=document.createElement('p');empty.className='mpChatEmpty';empty.textContent='Пока нет сообщений. Напишите первым.';
    list.replaceChildren(empty);
   }
   if(forceBottom||wasAtBottom){scroller.scrollTop=scroller.scrollHeight;if(forceBottom)mpChat.readerBrowsing=false;}
   else if(anchorSeq){
    const surviving=[...list.children].find(el=>el.dataset.chatSeq===anchorSeq);
    if(surviving)scroller.scrollTop+=surviving.getBoundingClientRect().top-area.top-anchorY;
    else scroller.scrollTop=oldScroll;
   }else scroller.scrollTop=oldScroll;
  }else if(forceBottom){scroller.scrollTop=scroller.scrollHeight;mpChat.readerBrowsing=false;}
 }
 const send=$('mpChatSend');if(send)send.disabled=!!mpChat.pending;
 clearTimeout(mpChat.timer);if(recent.length&&battle)mpChat.timer=setTimeout(()=>mpChatRender(),Math.max(10,recent[0].at+MP_CHAT_TTL-now+20));
}
function mpChatRenderCount(){const field=$('mpChatInput'),count=$('mpChatCount');if(field&&count)count.textContent=Array.from(field.value).length+'/'+MP_CHAT_MAX;}
function mpChatBind(){
 $('mpChatButton')?.addEventListener('click',mpChatOpen);$('mpChatClose')?.addEventListener('click',()=>mpChatClose(true));
 $('mpChatHideKeyboard')?.addEventListener('click',mpChatDismissKeyboard);
 $('mpChatLayer')?.addEventListener('click',e=>{if(e.target===$('mpChatLayer'))mpChatClose(true);});
 // Native pan-y scrolling must never be interpreted as 'read latest'.
 // In a tiny landscape IME window even a 10px finger move is deliberate.
 for(const area of [$('mpChatHistory'),$('mpChatScroll')]){
  if(!area)continue;
  area.addEventListener('touchstart',e=>{
   if(!mpChat.open)return;
   // A touch on the send button/input is not the reader browsing messages.
   if(e.target.closest?.('input,button'))return;
   mpChat.readerBrowsing=true;mpChat.touchScrolling=true;
  },{passive:true});
  area.addEventListener('touchend',()=>{mpChat.touchScrolling=false;},{passive:true});
  area.addEventListener('touchcancel',()=>{mpChat.touchScrolling=false;},{passive:true});
  area.addEventListener('wheel',()=>{if(mpChat.open)mpChat.readerBrowsing=true;},{passive:true});
  area.addEventListener('keydown',e=>{if(mpChat.open&&['ArrowUp','ArrowDown','PageUp','PageDown','Home','End','Space'].includes(e.key))mpChat.readerBrowsing=true;});
  area.addEventListener('scroll',()=>{
   const scroller=mpChatScrollBox();if(scroller!==area)return;
   if(mpChat.readerBrowsing&&!mpChat.touchScrolling&&area.scrollHeight-area.scrollTop-area.clientHeight<1.5)mpChat.readerBrowsing=false;
  },{passive:true});
 }
 const field=$('mpChatInput');
 field?.addEventListener('input',()=>{mpChat.draft=field.value;mpChatRenderCount();});
 const submit=e=>{e.preventDefault();if(mpChatSubmit(field.value)){field.value='';mpChat.draft='';mpChatRenderCount();if(!touchOnly)mpChatClose(true);else field.focus({preventScroll:true});}};
 $('mpChatForm')?.addEventListener('submit',submit);
 field?.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.isComposing||e.keyCode===229))e.preventDefault();});
 field?.addEventListener('focus',()=>{
  if(!mpChat.open)return;
  mpChat.imeDismissed=false;mpChat.imeReported=false;mpChat.imeFocusAt=performance.now();
  mpChatScrollToLatest();mpChatFollowKeyboard();
  requestAnimationFrame(mpChatFollowComposer);
 });
 field?.addEventListener('pointerdown',()=>{
  if(mpChat.open&&mpChat.imeDismissed){mpChat.imeDismissed=false;mpChat.imeReported=false;mpChat.imeFocusAt=performance.now();mpChatFollowKeyboard();}
 });
 field?.addEventListener('blur',()=>{
  if(!mpChat.open)return;
  // Dismissing the Android IME should restore the chat to full height with
  // its composer at the bottom. Never interrupt an active reading gesture.
  setTimeout(()=>{
   if(!mpChat.open||document.activeElement===$('mpChatInput'))return;
   mpChatViewport();
   if(!mpChat.touchScrolling){mpChatScrollToLatest();requestAnimationFrame(mpChatScrollToLatest);}
  },90);
 });
 window.visualViewport?.addEventListener('resize',mpChatViewportEvent);window.visualViewport?.addEventListener('scroll',mpChatViewport);
 navigator.virtualKeyboard?.addEventListener?.('geometrychange',mpChatViewportEvent);addEventListener('resize',mpChatViewportEvent);
 addEventListener('keydown',e=>{
  if(mpChat.open){
   if(mpChatOpeningT&&e.code==='KeyT'&&e.repeat){e.preventDefault();e.stopImmediatePropagation();return;}
   if(e.code==='Escape'&&!e.isComposing&&e.keyCode!==229){e.preventDefault();e.stopImmediatePropagation();
    if(matchMedia('(hover:none),(pointer:coarse)').matches&&document.activeElement===$('mpChatInput'))mpChatDismissKeyboard();
    else mpChatClose(true);return;}
   if(e.key==='Enter'&&(e.isComposing||e.keyCode===229)){e.preventDefault();e.stopImmediatePropagation();return;}
   if(e.key==='Enter'&&e.target===$('mpChatInput')){e.preventDefault();e.stopImmediatePropagation();$('mpChatForm').requestSubmit();return;}
   if(e.key==='Tab'){const nodes=[...$('mpChatLayer').querySelectorAll('button:not(:disabled),input,[tabindex="0"]')],i=nodes.indexOf(document.activeElement);e.preventDefault();e.stopImmediatePropagation();nodes[(i+(e.shiftKey?-1:1)+nodes.length)%nodes.length]?.focus();return;}
   // Never intercept normal keystrokes on the dialog itself: doing so during
   // capture blocks the input element and even the phone's IME.
   if($('mpChatLayer')?.contains(e.target))return;
   e.preventDefault();e.stopImmediatePropagation();return;
  }
  if(e.code==='KeyT'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.target?.matches?.('input,textarea,select,[contenteditable]')&&(mpChatInBattle()||$('mpLobbyChat'))){e.preventDefault();e.stopImmediatePropagation();mpChatOpeningT=mpChatOpen();}
 },true);
 addEventListener('keyup',e=>{if(e.code==='KeyT')mpChatOpeningT=false;},true);
 addEventListener('blur',()=>{mpChatOpeningT=false;});
}
