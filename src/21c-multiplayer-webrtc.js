// MP-2: host-to-each-guest WebRTC star. Metered carries ONLY SDP/ICE; actual
// data uses two native RTCDataChannels (reliable control + lossy game state).
// No third-party runtime assets or changes to the single-player `game` object.
const MP_RTC_TRIES=3,MP_RTC_MAX_ICE=64,MP_RTC_TIMEOUT=25000;
let mpRtcLinks=new Map(),mpRtcOrphans=new Map(),mpRtcAttempts=new Map();
let mpRtcTicker=null,mpRtcManualAt=0,mpRtcErrors=new Map();

function mpRtcAllowed(peer){
 return !!(mpRoom&&mpWire&&typeof peer==='string'&&(
  mpRoom.host?mpRoom.players.some(p=>!p.host&&p.peerId===peer):mpRoom.hostPeer===peer));
}
function mpRtcAlive(link){return !!(mpWire&&mpRoom&&mpRtcLinks.get(link.peer)===link&&link.pc.signalingState!=='closed');}
function mpRtcGameplayOpen(peer){
 const link=mpRtcLinks.get(peer);return !!(link&&mpRtcAlive(link)&&link.fast?.readyState==='open');
}
function mpRtcAnyGameplayOpen(){return [...mpRtcLinks.keys()].some(mpRtcGameplayOpen);}
function mpRtcServers(){
 const raw=Array.isArray(mpWire?.iceServers)?mpWire.iceServers:[];
 const valid=raw.slice(0,8).filter(x=>x&&typeof x==='object'&&(
  typeof x.urls==='string'||Array.isArray(x.urls))&&
  [x.urls].flat().every(u=>typeof u==='string'&&/^(stun|turn|turns):/i.test(u)&&u.length<350));
 return valid.length?valid:[{urls:'stun:stun.relay.metered.ca:80'}];
}
function mpRtcStatusText(peer){
 if(!mpRoom||!mpWire)return 'НЕ ПОДКЛЮЧЕНО';
 if(peer===mpWire.peerId)return 'ВАШЕ УСТРОЙСТВО';
 if(!mpRoom.host&&peer!==mpRoom.hostPeer)return 'ЧЕРЕЗ ВЕДУЩЕГО';
 const l=mpRtcLinks.get(peer);
 if(!l)return mpRtcErrors.has(peer)?'P2P · '+mpRtcErrors.get(peer):
  typeof RTCPeerConnection==='function'?'P2P · ОЖИДАНИЕ':'WEBRTC НЕ ПОДДЕРЖИВАЕТСЯ';
 if(l.error)return 'P2P · '+l.error;
 if(l.control?.readyState==='open'&&l.fast?.readyState==='open')
  return 'P2P ✓ '+(l.probeVerified?'2 КАНАЛА · ':'')+(Number.isFinite(l.rtt)?Math.round(l.rtt)+' МС':'СВЯЗЬ ЕСТЬ');
 return 'P2P · '+(l.status==='retry'?'ПОВТОРНАЯ ПОПЫТКА':l.status==='disconnected'?'НЕСТАБИЛЬНА':'ПОДКЛЮЧЕНИЕ');
}
function mpRtcPaint(){
 if(!mpRoom||!mpWire)return;
 for(const p of mpRoom.players){const el=$('mpPeerLink'+p.id);if(el)el.textContent=mpRtcStatusText(p.peerId);}
 if(typeof mpMatchPaintLobbyStart==='function')mpMatchPaintLobbyStart();
}
function mpRtcDrop(peer,forget=true,keepIce=false){
 const l=mpRtcLinks.get(peer);
 if(l){mpRtcLinks.delete(peer);clearTimeout(l.iceTimer);clearTimeout(l.retryTimer);
  for(const dc of [l.control,l.fast])if(dc){dc.onopen=null;dc.onclose=null;dc.onmessage=null;try{dc.close();}catch(_){}}
  const pc=l.pc;pc.onicecandidate=null;pc.onconnectionstatechange=null;pc.oniceconnectionstatechange=null;pc.ondatachannel=null;
  try{pc.close();}catch(_){}}
 if(forget){mpRtcAttempts.delete(peer);mpRtcErrors.delete(peer);}
 if(!keepIce)for(const key of mpRtcOrphans.keys())if(key.startsWith(peer+'/'))mpRtcOrphans.delete(key);
 mpRtcPaint();
}
function mpRtcCloseAll(){
 for(const peer of [...mpRtcLinks.keys()])mpRtcDrop(peer);
 mpRtcOrphans.clear();mpRtcAttempts.clear();mpRtcErrors.clear();mpRtcLastRequest.clear();
 if(mpRtcTicker!==null){clearInterval(mpRtcTicker);mpRtcTicker=null;}
}
function mpRtcWatch(){if(mpRtcTicker===null)mpRtcTicker=setInterval(mpRtcTick,3000);}
function mpRtcCandidate(value){
 if(!value||typeof value!=='object'||typeof value.candidate!=='string'||value.candidate.length>2048)return null;
 if(value.sdpMid!=null&&(typeof value.sdpMid!=='string'||value.sdpMid.length>80))return null;
 if(value.sdpMLineIndex!=null&&(!Number.isInteger(value.sdpMLineIndex)||value.sdpMLineIndex<0||value.sdpMLineIndex>20))return null;
 return {candidate:value.candidate,sdpMid:value.sdpMid??null,sdpMLineIndex:value.sdpMLineIndex??null};
}
function mpRtcOrphanKey(peer,sid){return peer+'/'+sid;}
function mpRtcStoreIce(peer,sid,ice){
 const key=mpRtcOrphanKey(peer,sid),now=Date.now();
 let orphan=mpRtcOrphans.get(key);if(!orphan){orphan={items:[],at:now};mpRtcOrphans.set(key,orphan);}
 for(const raw of ice){const c=mpRtcCandidate(raw);if(c&&orphan.items.length<MP_RTC_MAX_ICE)orphan.items.push(c);}
 // Cap total orphan generations, even with a malicious member in a room.
 while(mpRtcOrphans.size>16)mpRtcOrphans.delete(mpRtcOrphans.keys().next().value);
}
function mpRtcCollectIce(link){
 const key=mpRtcOrphanKey(link.peer,link.sid),pending=mpRtcOrphans.get(key);
 if(pending){link.pendingIce.push(...pending.items);mpRtcOrphans.delete(key);}
}
function mpRtcApplyIce(link){
 if(!mpRtcAlive(link)||!link.pc.remoteDescription)return;
 mpRtcCollectIce(link);
 const batch=link.pendingIce.splice(0,MP_RTC_MAX_ICE);
 link.iceChain=link.iceChain.then(async()=>{
  for(const item of batch){if(!mpRtcAlive(link))break;
   try{await link.pc.addIceCandidate(item);}catch(_){/* stale or unsupported route; other candidates may succeed */}}
 }).catch(()=>{});
}
function mpRtcQueueLocalIce(link,candidate){
 if(!mpRtcAlive(link))return;
 const item=mpRtcCandidate(typeof candidate.toJSON==='function'?candidate.toJSON():candidate);
 if(!item)return;
 if(link.outIce.length>=MP_RTC_MAX_ICE)return;
 link.outIce.push(item);
 if(!link.iceTimer)link.iceTimer=setTimeout(()=>mpRtcFlushIce(link),170);
}
function mpRtcFlushIce(link){
 clearTimeout(link.iceTimer);link.iceTimer=null;
 if(!mpRtcAlive(link)){link.outIce.length=0;return;}
 const candidates=link.outIce.splice(0,12);
 if(candidates.length)mpWire.send(link.peer,mpPacket('rtc-ice',{sid:link.sid,candidates})).catch(()=>{});
 if(link.outIce.length)link.iceTimer=setTimeout(()=>mpRtcFlushIce(link),170);
}
function mpRtcSend(link,channel,value){
 if(!mpRtcAlive(link)||channel?.readyState!=='open'||channel.bufferedAmount>131072)return false;
 const serialized=JSON.stringify(value);
 if(serialized.length>4000)return false;
 try{channel.send(serialized);if(typeof mp10RecordTx==='function')mp10RecordTx(serialized.length);return true;}catch(_){return false;}
}
function mpRtcFastSend(peer,value){
 const l=mpRtcLinks.get(peer);
 if(!l||typeof mp7BufferAllowed==='function'&&!mp7BufferAllowed(l))return false;
 const payload=typeof mp10Encode==='function'?mp10Encode(value,peer):value;
 return !!payload&&mpRtcSend(l,l.fast,payload);
}
function mpRtcControl(link,e){
 if(typeof e.data!=='string'||e.data.length>4000)return;
 if(typeof mp10RecordRx==='function')mp10RecordRx(e.data.length);
 let data;try{data=JSON.parse(e.data);}catch(_){return;}
 if(data?.v!==MP_VERSION)return;
 link.lastHeard=Date.now();
 if(data.kind==='ping'&&Number.isSafeInteger(data.n)&&data.n>=0)
  mpRtcSend(link,link.control,{v:MP_VERSION,kind:'pong',n:data.n});
 else if(data.kind==='pong'&&data.n===link.pingSeq&&link.pingAt){
  link.rtt=Math.max(0,Math.min(9999,performance.now()-link.pingAt));mpRtcPaint();
 }
 else if(typeof data.kind==='string'&&data.kind.startsWith('chat-')&&typeof mpChatControl==='function')mpChatControl(link.peer,data);
 else if(typeof data.kind==='string'&&data.kind.startsWith('mp3-')&&typeof mpMatchControl==='function')mpMatchControl(link.peer,data);
}
function mpRtcFastMessage(link,e){
 if(typeof e.data!=='string'||e.data.length>4000)return;
 if(typeof mp10RecordRx==='function')mp10RecordRx(e.data.length);
 let data;try{data=JSON.parse(e.data);}catch(_){return;}
 if(data?.v!==MP_VERSION)return;
 if(data.c===1){data=typeof mp10Decode==='function'?mp10Decode(data):null;if(!data)return;}
 if(data.kind==='probe'&&Number.isSafeInteger(data.n))mpRtcSend(link,link.fast,{v:MP_VERSION,kind:'probe-ack',n:data.n});
 if(data.kind==='probe-ack'&&data.n===link.probeSeq){link.probeVerified=true;mpRtcPaint();}
 if(typeof data.kind==='string'&&data.kind.startsWith('mp3-')&&typeof mpMatchFast==='function')mpMatchFast(link.peer,data);
}
function mpRtcAttachChannel(link,channel){
 if(!channel||!mpRtcAlive(link))return;
 const name=channel.label;if(name!=='neonrift-control'&&name!=='neonrift-state'){try{channel.close();}catch(_){}return;}
 const key=name==='neonrift-control'?'control':'fast';
 if(link[key]&&link[key]!==channel){try{channel.close();}catch(_){}return;}
 link[key]=channel;channel.binaryType='arraybuffer';
 channel.onopen=()=>{
  if(!mpRtcAlive(link))return;
  link.lastHeard=Date.now();
  if(key==='control')mpRtcPing(link);
  else mpRtcProbe(link);
  if(key==='control'&&typeof mpRoundResync==='function')mpRoundResync(link.peer);
  if(key==='control'&&typeof mpChatOnChannelOpen==='function')mpChatOnChannelOpen(link.peer);
  mpRtcPaint();
 };
 channel.onclose=()=>{if(mpRtcAlive(link)){link.status='disconnected';mpRtcPaint();}};
 channel.onmessage=e=>{if(mpRtcAlive(link))(key==='control'?mpRtcControl:mpRtcFastMessage)(link,e);};
}
function mpRtcPing(link){
 if(!mpRtcAlive(link)||link.control?.readyState!=='open')return;
 link.pingAt=performance.now();link.pingSeq++;
 mpRtcSend(link,link.control,{v:MP_VERSION,kind:'ping',n:link.pingSeq});
 link.lastPing=Date.now();
}
function mpRtcProbe(link){
 if(!mpRtcAlive(link)||link.fast?.readyState!=='open')return;
 link.probeSeq++;
 mpRtcSend(link,link.fast,{v:MP_VERSION,kind:'probe',n:link.probeSeq});
 link.lastProbe=Date.now();
}
function mpRtcFail(link,reason){
 if(!mpRtcAlive(link)||link.failed)return;
 link.failed=true;link.error=reason;mpRtcPaint();
 if(mpRoom.host&&mpSignalingOnline()&&mpRtcAttempts.get(link.peer)<MP_RTC_TRIES){
  link.retryTimer=setTimeout(()=>{if(mpRtcAlive(link))mpRtcHostStart(link.peer,true);},2500+mpRtcAttempts.get(link.peer)*1200);
 }else if(!mpRoom.host&&mpSignalingOnline()){
  // If only the guest detects an ICE failure, ask the host for a fresh offer.
  mpWire.send(link.peer,mpPacket('rtc-retry',{sid:link.sid})).catch(e=>{link.error='SIGNAL: '+e.message;mpRtcPaint();});
 }
}
function mpRtcState(link){
 if(!mpRtcAlive(link))return;
 const state=link.pc.connectionState||link.pc.iceConnectionState;
 if(state==='failed')mpRtcFail(link,'ICE ОШИБКА');
 else if(state==='disconnected'){
  link.status='disconnected';mpRtcPaint();
  if(!link.retryTimer)link.retryTimer=setTimeout(()=>{
   link.retryTimer=null;if(mpRtcAlive(link)&&!document.hidden&&(
    link.pc.connectionState==='disconnected'||link.pc.iceConnectionState==='disconnected'))mpRtcFail(link,'ОБРЫВ');
  },8500);
 }else if(state==='connected'||state==='completed'){
  if(link.retryTimer){clearTimeout(link.retryTimer);link.retryTimer=null;}
  link.status='connected';link.error='';link.failed=false;mpRtcPaint();
 }
}
function mpRtcCreate(peer,sid,initiator){
 if(!mpRtcAllowed(peer)||typeof RTCPeerConnection!=='function')return null;
 mpRtcDrop(peer,false,true);
 let pc;try{pc=new RTCPeerConnection({iceServers:mpRtcServers()});}catch(_){mpRtcErrors.set(peer,'ОШИБКА СОЗДАНИЯ');mpRtcPaint();return null;}
 mpRtcErrors.delete(peer);
 const link={peer,sid,pc,initiator,status:'connecting',error:'',failed:false,
  control:null,fast:null,started:Date.now(),lastHeard:0,lastPing:0,lastProbe:0,
  pingAt:0,pingSeq:0,probeSeq:0,probeVerified:false,rtt:null,
  pendingIce:[],outIce:[],iceTimer:null,retryTimer:null,iceChain:Promise.resolve()};
 mpRtcLinks.set(peer,link);mpRtcCollectIce(link);
 pc.onicecandidate=e=>{if(e.candidate)mpRtcQueueLocalIce(link,e.candidate);else mpRtcFlushIce(link);};
 pc.onconnectionstatechange=()=>mpRtcState(link);
 pc.oniceconnectionstatechange=()=>mpRtcState(link);
 pc.ondatachannel=e=>{if(!initiator)mpRtcAttachChannel(link,e.channel);else try{e.channel.close();}catch(_){}};
 if(initiator){
  try{
   mpRtcAttachChannel(link,pc.createDataChannel('neonrift-control',{ordered:true}));
   mpRtcAttachChannel(link,pc.createDataChannel('neonrift-state',{ordered:false,maxRetransmits:0}));
  }catch(_){mpRtcDrop(peer,false);mpRtcErrors.set(peer,'ОШИБКА КАНАЛА');mpRtcPaint();return null;}
 }
 mpRtcWatch();mpRtcPaint();return link;
}
function mpRtcHostJoined(peer){if(mpRtcAllowed(peer)&&mpRoom.host)mpRtcHostStart(peer,false);}
async function mpRtcHostStart(peer,force=false){
 if(!mpRoom?.host||!mpRtcAllowed(peer))return;
 if(!force&&mpRtcLinks.has(peer))return;
 const attempt=(mpRtcAttempts.get(peer)||0)+1;
 if(attempt>MP_RTC_TRIES)return;
 mpRtcAttempts.set(peer,attempt);
 const link=mpRtcCreate(peer,mpRandom(8),true);
 if(!link){mpRtcPaint();return;}
 link.status=attempt>1?'retry':'connecting';mpRtcPaint();
 try{
  const offer=await link.pc.createOffer();if(!mpRtcAlive(link))return;
  await link.pc.setLocalDescription(offer);if(!mpRtcAlive(link))return;
  await mpWire.send(peer,mpPacket('rtc-offer',{sid:link.sid,sdp:link.pc.localDescription?.sdp||offer.sdp}));
 }catch(_){mpRtcFail(link,'SDP ОШИБКА');}
}
async function mpRtcGuestOffer(peer,data){
 const prior=mpRtcLinks.get(peer);
 if(prior?.sid===data.sid)return; // repeated signalling, no second answer
 const link=mpRtcCreate(peer,data.sid,false);if(!link)return;
 try{
  await link.pc.setRemoteDescription({type:'offer',sdp:data.sdp});if(!mpRtcAlive(link))return;
  mpRtcApplyIce(link);
  const answer=await link.pc.createAnswer();if(!mpRtcAlive(link))return;
  await link.pc.setLocalDescription(answer);if(!mpRtcAlive(link))return;
  await mpWire.send(peer,mpPacket('rtc-answer',{sid:link.sid,sdp:link.pc.localDescription?.sdp||answer.sdp}));
 }catch(_){mpRtcFail(link,'SDP ОШИБКА');}
}
async function mpRtcHostAnswer(peer,data){
 const link=mpRtcLinks.get(peer);
 if(!link||!link.initiator||link.sid!==data.sid||link.pc.remoteDescription)return;
 try{await link.pc.setRemoteDescription({type:'answer',sdp:data.sdp});mpRtcApplyIce(link);}
 catch(_){mpRtcFail(link,'SDP ОШИБКА');}
}
function mpRtcSignal(peer,data){
 if(!mpRtcAllowed(peer)||!data||typeof data.kind!=='string')return;
 if(data.kind==='rtc-retry'){
  if(!mpRoom.host)return;
  const last=mpRtcLinks.get(peer);if(last&&data.sid&&data.sid!==last.sid)return;
  const now=Date.now(),prev=mpRtcLastRequest.get(peer)||0;
  if(now-prev<5000)return;mpRtcLastRequest.set(peer,now);
  // An explicit user retry (empty sid) must still work after automatic ICE
  // attempts have been exhausted; retain the 5s per-peer request throttle.
  if(data.sid==='')mpRtcAttempts.set(peer,0);
  if((mpRtcAttempts.get(peer)||0)<MP_RTC_TRIES)mpRtcHostStart(peer,true);
  return;
 }
 if(!/^[A-Z2-7]{13}$/.test(data.sid||''))return;
 if(data.kind==='rtc-ice'){
  if(!Array.isArray(data.candidates)||data.candidates.length>16)return;
  const link=mpRtcLinks.get(peer);
  if(!link||link.sid!==data.sid){mpRtcStoreIce(peer,data.sid,data.candidates);return;}
  for(const raw of data.candidates){const c=mpRtcCandidate(raw);
   if(c&&link.pendingIce.length<MP_RTC_MAX_ICE)link.pendingIce.push(c);}
  mpRtcApplyIce(link);return;
 }
 if(typeof data.sdp!=='string'||data.sdp.length<10||data.sdp.length>55000||!/^v=0\r?\n/.test(data.sdp))return;
 if(data.kind==='rtc-offer'&&!mpRoom.host)mpRtcGuestOffer(peer,data);
 else if(data.kind==='rtc-answer'&&mpRoom.host)mpRtcHostAnswer(peer,data);
}
let mpRtcLastRequest=new Map();
function mpRtcTick(){
 const now=Date.now();
 for(const [key,o] of mpRtcOrphans)if(now-o.at>20000)mpRtcOrphans.delete(key);
 for(const l of mpRtcLinks.values()){
  if(!mpRtcAlive(l))continue;
  if(l.control?.readyState==='open'){
   if(now-l.lastPing>6000)mpRtcPing(l);
   if(!document.hidden&&l.lastHeard&&now-l.lastHeard>22000)mpRtcFail(l,'ТАЙМАУТ P2P');
  }else if(now-l.started>MP_RTC_TIMEOUT&&!document.hidden)mpRtcFail(l,'ТАЙМАУТ P2P');
  if(!l.probeVerified&&l.fast?.readyState==='open'&&now-l.lastProbe>6000)mpRtcProbe(l);
 }
}
function mpRtcManualRetry(onFailed){
 const now=Date.now();if(now-mpRtcManualAt<5000)return false;
 if(!mpRoom||!mpSignalingOnline())return false;
 if(typeof RTCPeerConnection!=='function'){mpStatus('Этот браузер не поддерживает WebRTC.',true);return false;}
 mpRtcManualAt=now;
 if(mpRoom.host){
  for(const p of mpRoom.players)if(!p.host){mpRtcAttempts.set(p.peerId,0);mpRtcHostStart(p.peerId,true);}
  mpStatus('Повторно устанавливаем прямые соединения…');
 }else{
  // Explicit manual request is allowed even if the guest's old generation
  // differs from the one currently held by the host.
  mpWire.send(mpRoom.hostPeer,mpPacket('rtc-retry',{sid:''})).then(()=>mpStatus('Запрос ведущему отправлен.')).catch(e=>{mpStatus(e.message,true);if(typeof onFailed==='function')onFailed(e);});
 }
 return true;
}
