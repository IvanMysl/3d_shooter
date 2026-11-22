'use strict';
// Stage122: real app chat handlers + mock RTC data channels, 3 separate VMs.
const assert=require('node:assert/strict');
const {createBrowser,FakeMetered,setup,enter,state,until,wait}=require('./test_stage35_mp3_movement.cjs');
let checks=0;const ok=(value,label)=>{assert.ok(value,label);checks++};
const text=x=>JSON.stringify(x);
function browser(server){
 const app=createBrowser(server,true,true,true,true,true);
 // Network-only mock: DOM rendering is covered separately in actual Chromium.
 app.run('mpChatRender=()=>{}; mpChatStatus=()=>{};');
 return app;
}
async function connect(server,host,code,name){
 const guest=browser(server);enter(guest,code,name);await guest.run('mpJoinRoom()');
 await until(()=>host.run(`mpRtcLinks.get('${state(guest).hostPeer===state(host).hostPeer?state(guest).players.at(-1).peerId:state(guest).hostPeer}')?.control?.readyState==='open'`)||
  guest.run('mpRtcLinks.get(mpRoom.hostPeer)?.control?.readyState==="open"'),3000);
 return guest;
}
async function main(){
 const server=new FakeMetered();
 const h=browser(server);setup(h,'Хозяин');await h.run('mpCreateRoom()');
 const room=state(h).code;
 const a=await connect(server,h,room,'Алиса');
 const b=await connect(server,h,room,'Борис');
 await until(()=>h.run('mpRtcLinks.size')===2 &&
  a.run('mpRtcLinks.get(mpRoom.hostPeer)?.control?.readyState==="open"')&&
  b.run('mpRtcLinks.get(mpRoom.hostPeer)?.control?.readyState==="open"'),3000);
 ok(h.run('mpRoom.players.length')===3,'3 clients in same room');
 const signal=server.frameLog.length;
 ok(a.run(`mpChatSubmit(${text('Всем привет!')})`),'guest sends message');
 await until(()=>h.run('mpChat.items.length')===1&&b.run('mpChat.items.length')===1&&a.run('mpChat.items.length')===1);
 ok(h.run('mpChat.items[0].nick')==='Алиса','host authenticates sender from roster');
 ok(b.run('mpChat.items[0].text')==='Всем привет!','third client receives relay');
 ok(a.run('mpChat.pending===null'),'sender acknowledgement via echoed event');
 ok(server.frameLog.length===signal,'chat uses RTC, not Metered signalling');
 ok(h.saves===0&&a.saves===0&&b.saves===0,'chat does not write campaign save');
 ok(b.run(`mpChatSubmit(${text('<img src=x onerror=alert(1)>')})`),'HTML-looking message is allowed as literal text');
 await until(()=>a.run('mpChat.items.length')===2);
 ok(a.run('mpChat.items[1].text')==='<img src=x onerror=alert(1)>','raw content stays text, never parsed');
 const peerA=state(a).players.find(p=>p.nick==='Алиса').peerId;
 ok(!h.run(`mpChatAccept(${text(peerA)}, {text:'evil',nonce:'???'})`),'malformed nonce rejected');
 ok(!h.run(`mpChatAccept(${text('forged')}, {text:'evil',nonce:'AAAAAAAAAAAAA'})`),'nonmember rejected');
 const curr=h.run('mpChat.items.length');
 const nonce=a.run('mpChat.items[0].nonce');
 ok(h.run(`mpChatAccept(${text(peerA)}, {text:'Всем привет!',nonce:${text(nonce)}})`),'same-nonce resend returns original receipt');
 await wait(30);
 ok(h.run('mpChat.items.length')===curr,'idempotent retry never rebroadcasts duplicate');
 ok(a.run('mpChat.items.length')===curr,'guest does not duplicate echoed event');
 // Host history replay for a guest which missed two reliable messages while disconnected.
 const bBefore=b.run('mpChat.last');
 b.run('mpChat.items=[];mpChat.last=0');
 const hostPeer=state(h).hostPeer;
 h.run('mpChat.syncs.clear()'); // simulate elapsed reconnect backoff
 b.run(`mpChatOnChannelOpen(${text(hostPeer)})`);
 await until(()=>b.run('mpChat.items.length')>=2);
 ok(b.run('mpChat.last')===bBefore,'resynchronization reconstructs ordered history');
 ok(b.run('mpChat.items.map(x=>x.seq).join(",")')==='1,2','history in ascending sequence');
 // Hold pending while host does not process; reconnect + retry with SAME nonce.
 a.run('mpChat.pending={nonce:"AAAAAAAAAAAAA",text:"retry",retries:0}');
 a.run('mpChatOnChannelOpen(mpRoom.hostPeer)');
 await until(()=>h.run('mpChat.items.length')===curr+1);
 const last=h.run('mpChat.items.at(-1).nonce');
 ok(last==='AAAAAAAAAAAAA','reconnect retries original nonce');
 ok(h.run('mpChat.accepted.size')>=3,'host maintains bounded deduplication records');
 const tooLong='X'.repeat(241);
 ok(!a.run(`mpChatText(${text(tooLong)})`),'240 Unicode codepoint limit');
 ok(a.run('mpChatText("✌🏽")')==='✌🏽','emoji modifiers allowed');
 // Rate limit is enforced on the authoritative host, independent of client UI.
 ok(h.run(`(()=>{mpChat.rates.delete(${text(peerA)});const n=Date.now(),x=${text(peerA)};
 const r=[0,1,2,3].map(i=>mpChatRate(x,mpRandom(8),n));
 mpChat.rates.delete(x);return r.join(',')==='true,true,true,false';})()`),'burst rate limit blocks fourth instant message');
 // Late delivery clears only an unchanged restored draft.
 ok(a.run(`(()=>{const id=mpRoom.players.find(p=>p.peerId===mpWire.peerId).id;
 mpChat.failed={nonce:'AAAAAAAAAAAAA',text:'retry'};mpChat.draft='retry';
 mpChatConfirmPending({nonce:'AAAAAAAAAAAAA',id});return !mpChat.failed&&mpChat.draft==='';})()`),
 'late acknowledgement removes duplicate-prone restored draft');
 // Messages from a departed room member must remain visible to newcomers.
 await b.run('mpLeave()');
 const c=await connect(server,h,room,'Новый');
 await until(()=>c.run('mpChat.items.some(x=>x.nick==="Борис")'),3000);
 ok(c.run('mpChat.items.some(x=>x.text==="<img src=x onerror=alert(1)>")'),'late join sees history of departed member');
 await c.run('mpLeave()');await a.run('mpLeave()');await h.run('mpLeave()');
 ok(h.run('mpChat.items.length')===0,'leaving clears chat history and peers');
 ok(h.saves===0&&a.saves===0&&b.saves===0&&c.saves===0,'still zero campaign writes after cleanup');
 console.log('STAGE122 ROOM CHAT RTC: '+checks+' assertions passed');
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;setTimeout(()=>process.exit(1),40)});
