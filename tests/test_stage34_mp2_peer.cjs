'use strict';
// Offline deterministic MP-2 test: actual application SDP/ICE + RTCDataChannel
// code runs in separate VM browser contexts against small protocol fakes.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {FakeMetered,app,setup,enter,state}=require('./test_stage33_mp1_lobby.cjs');
const source=fs.readFileSync(path.join(__dirname,'../src/21b-multiplayer-lobby.js'),'utf8')+
 '\n'+fs.readFileSync(path.join(__dirname,'../src/21c-multiplayer-webrtc.js'),'utf8');
const configured=source.replace(/const MP_PUBLISHABLE_KEY='[^']+'/,"const MP_PUBLISHABLE_KEY='pk_live_0123456789abcdefghij'");
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(predicate,timeout=1500){const begin=Date.now();while(Date.now()-begin<timeout){if(predicate())return;await wait(5);}throw Error('WebRTC handshake timed out');}
let assertions=0;function check(condition,msg){assert.ok(condition,msg);assertions++;}

class MockDataChannel{
 constructor(label,options){this.label=label;this.options=options;this.readyState='connecting';this.bufferedAmount=0;this.peer=null;this.onopen=null;this.onclose=null;this.onmessage=null;}
 send(data){
  if(this.readyState!=='open'||this.peer?.readyState!=='open')throw Error('Channel not open');
  queueMicrotask(()=>{if(this.peer?.readyState==='open')this.peer.onmessage?.({data});});
 }
 close(){if(this.readyState==='closed')return;this.readyState='closed';this.onclose?.();
  if(this.peer?.readyState!=='closed'){this.peer.readyState='closed';this.peer.onclose?.();}}
}
class FakeRTC{
 static index=0;static all=new Map();static records=[];
 constructor(config){
  this.id=++FakeRTC.index;FakeRTC.all.set(this.id,this);FakeRTC.records.push(this);
  this.config=config;this.channels=[];this.remote=null;this.added=[];this.localDescription=null;this.remoteDescription=null;
  this.connectionState='new';this.iceConnectionState='new';this.signalingState='stable';
 }
 createDataChannel(label,options){const ch=new MockDataChannel(label,options);this.channels.push(ch);return ch;}
 async createOffer(){return {type:'offer',sdp:'v=0\r\nx-fake-pc:'+this.id+'\r\n'};}
 async createAnswer(){return {type:'answer',sdp:'v=0\r\nx-fake-pc:'+this.id+'\r\n'};}
 async setLocalDescription(desc){
  this.localDescription=desc;this.signalingState=desc.type==='offer'?'have-local-offer':'stable';
  queueMicrotask(()=>{
   if(this.signalingState==='closed')return;
   this.onicecandidate?.({candidate:{candidate:'candidate:1 1 udp 42 192.0.2.1 30000 typ host',sdpMid:'0',sdpMLineIndex:0}});
   this.onicecandidate?.({candidate:null});
  });
 }
 async setRemoteDescription(desc){
  this.remoteDescription=desc;this.signalingState=desc.type==='offer'?'have-remote-offer':'stable';
  const id=Number(/x-fake-pc:(\d+)/.exec(desc.sdp)?.[1]);
  const remote=FakeRTC.all.get(id);if(!remote)throw Error('Unknown remote PC');
  this.remote=remote;remote.remote=this;
  if(desc.type==='offer'){
   for(const ch of remote.channels){
    const incoming=new MockDataChannel(ch.label,ch.options);
    ch.peer=incoming;incoming.peer=ch;
    this.channels.push(incoming);this.ondatachannel?.({channel:incoming});
   }
  }else{
   queueMicrotask(()=>{
    if(!this.remote||this.signalingState==='closed'||this.remote.signalingState==='closed')return;
    this.connectionState='connected';this.iceConnectionState='connected';
    remote.connectionState='connected';remote.iceConnectionState='connected';
    for(const pc of [this,remote])pc.onconnectionstatechange?.();
    for(const pc of [this,remote])for(const ch of pc.channels)ch.readyState='open';
    for(const pc of [this,remote])for(const ch of pc.channels)ch.onopen?.();
   });
  }
 }
 async addIceCandidate(candidate){if(!this.remoteDescription)throw Error('Candidate before remote SDP');this.added.push(candidate);}
 close(){
  if(this.signalingState==='closed')return;
  this.signalingState='closed';this.connectionState='closed';
  for(const ch of this.channels)ch.close();
 }
}
function browser(server){return app(server,configured,{RTCPeerConnection:FakeRTC,GAME_BUILD:'34'});}
const links=a=>a.run('mpRtcLinks');
const ownWireId=a=>a.run('mpWire?.peerId');
async function main(){
 const server=new FakeMetered();
 const turn={urls:['turn:global.relay.metered.ca:80'],username:'ephemeral',credential:'ephemeral-secret'};
 server.iceServers=[{urls:'stun:stun.relay.metered.ca:80'},turn];
 const h=browser(server);setup(h,'Host');await h.run('mpCreateRoom()');
 const code=state(h).code;
 const guest=browser(server);enter(guest,code,'Guest');await guest.run('mpJoinRoom()');
 await until(()=>links(h).size===1&&links(guest).size===1&&
  [...links(h).values()][0].control?.readyState==='open'&&
  [...links(guest).values()][0].fast?.readyState==='open');
 const hostLink=[...links(h).values()][0],guestLink=[...links(guest).values()][0];
 check(hostLink.initiator&&!guestLink.initiator,'host creates offer, guest answers');
 check(hostLink.peer===ownWireId(guest),'host binds connection to joined peerId');
 check(guestLink.peer===ownWireId(h),'guest accepts only host peerId');
 check(hostLink.sid===guestLink.sid,'SDP session ID matches');
 check(hostLink.control.label==='neonrift-control'&&guestLink.control.label==='neonrift-control','reliable control channel both ways');
 check(hostLink.fast.label==='neonrift-state'&&guestLink.fast.label==='neonrift-state','unreliable game-state channel both ways');
 check(hostLink.fast.options.ordered===false&&hostLink.fast.options.maxRetransmits===0,'state channel non-retransmitting');
 check(hostLink.control.options.ordered===true,'control messages reliable and ordered');
 check(FakeRTC.records.every(p=>p.config.iceServers.some(s=>s.urls?.includes('turn:global.relay.metered.ca:80'))),'ephemeral TURN from welcome used');
 await until(()=>hostLink.probeVerified&&guestLink.probeVerified&&hostLink.rtt!==null&&guestLink.rtt!==null);
 check(hostLink.probeVerified&&guestLink.probeVerified,'data channel probe acknowledged bidirectionally');
 check(hostLink.rtt>=0&&guestLink.rtt>=0,'ping/pong RTT measured over P2P');
 check(h.run('mpRtcStatusText(mpRoom.players[1].peerId)').includes('P2P ✓'),'connected status visible in host');
 check(guest.run('mpRtcStatusText(mpRoom.hostPeer)').includes('P2P ✓'),'connected status visible in guest');
 check(guest.saves===0&&h.saves===0,'RTC telemetry never touches solo saves');
 await wait(220);
 check(hostLink.pc.added.length>=1&&guestLink.pc.added.length>=1,'trickled ICE applied on both ends');
 check(server.frameLog.some(f=>f.data?.kind==='rtc-offer')&&server.frameLog.some(f=>f.data?.kind==='rtc-answer'),'SDP exchange uses directed Metered frames');
 check(server.frameLog.some(f=>f.data?.kind==='rtc-ice'),'batched ICE signaling uses Metered');
 const signalCount=server.frameLog.length;
 h.run('mpRtcTick()');guest.run('mpRtcTick()');await wait(10);
 check(server.frameLog.length===signalCount,'P2P heartbeat/probes do not consume Metered message quota');

 const guest2=browser(server);enter(guest2,code,'Guest2');await guest2.run('mpJoinRoom()');
 await until(()=>links(h).size===2&&links(guest2).size===1&&[...links(h).values()].every(l=>l.control?.readyState==='open'));
 check(links(guest).size===1&&links(guest2).size===1,'star topology: guests only connect to host');
 check(state(h).players.length===3,'multiple players remain in common lobby');

 // A forged peer must not create an RTC connection or inject its own offer.
 guest.run("mpRtcSignal('unknown-peer',{kind:'rtc-offer',sid:'AAAAAAAAAAAAA',sdp:'v=0\\r\\nx-fake-pc:1\\r\\n'})");
 check(links(guest).size===1,'unapproved peer ignored');

 // A genuine ICE failure at the host automatically starts a bounded retry.
 const id2=ownWireId(guest2),failedLink=links(h).get(id2);
 failedLink.pc.connectionState='failed';failedLink.pc.onconnectionstatechange();
 await until(()=>links(h).get(id2)?.sid!==failedLink.sid&&
  links(guest2).get(ownWireId(h))?.control?.readyState==='open',6000);
 check(failedLink.pc.signalingState==='closed','automatic failure closes superseded connection');
 check(h.run(`mpRtcAttempts.get('${id2}')`)===2,'automatic retry capped and counted');

 // Guest manual retry also requests a new host offer, never initiates one.
 const oldGuestSid=links(guest).get(ownWireId(h)).sid;
 await guest.run('mpRtcManualRetry()');
 await until(()=>links(guest).get(ownWireId(h))?.sid!==oldGuestSid&&
  links(guest).get(ownWireId(h))?.control?.readyState==='open');
 check(links(guest).get(ownWireId(h)).initiator===false,'guest manual retry preserves host offer authority');

 // Candidate-before-offer: stored and transferred into a fresh generation.
 const before=guest.run(`(()=>{const id=mpRoom.hostPeer,sid='AAAAAAAAAAAAA';
  mpRtcStoreIce(id,sid,[{candidate:'candidate:3 1 udp 3 192.0.2.3 3333 typ host',sdpMid:'0',sdpMLineIndex:0}]);
  const l=mpRtcCreate(id,sid,false);return l.pendingIce.length;})()`);
 check(before===1,'early ICE candidate survives peer creation');
 await h.run('mpRtcManualRetry()');
 await until(()=>links(guest).size===1&&[...links(guest).values()][0].control?.readyState==='open'&&
  [...links(h).values()].every(l=>l.control?.readyState==='open'));
 check([...links(guest).values()][0].sid!==hostLink.sid,'manual retry replaces stale peer generation');
 check(hostLink.pc.signalingState==='closed','stale connection properly closed');

 // Exiting the room must tear down all DataChannels, PCs and intervals.
 await guest.run('mpLeave()');
 check(links(guest).size===0,'guest closes own RTC stack on exit');
 check(links(h).size===1,'host drops departed guest but retains other peer');
 await h.run('mpLeave()');
 check(links(h).size===0&&links(guest2).size===0,'host closes all RTC connections and notifies last guest');
 check(h.run('mpRtcTicker')===null&&guest2.run('mpRtcTicker')===null,'network timers do not leak');
 check(h.saves===0&&guest2.saves===0,'single-player state untouched after multiplayer');
 console.log('STAGE34 MP-2 P2P NETWORK: '+assertions+' assertions passed');
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={FakeRTC,MockDataChannel};
