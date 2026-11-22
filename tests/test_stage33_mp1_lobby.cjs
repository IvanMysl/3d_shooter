'use strict';
// Two-to-eight-browser integration test without a Metered account: the fake
// service speaks documented WebSocket wire frames, including presence + acks.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'../src/21b-multiplayer-lobby.js'),'utf8');
const menuSource=fs.readFileSync(path.join(__dirname,'../src/22-menus-and-upgrades.js'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../src/manifest.json'),'utf8'));
let checks=0;function ok(condition,msg){assert.ok(condition,msg);checks++;}
class FakeMetered{
 constructor(){this.next=0;this.sockets=new Map();this.channels=new Map();this.iceServers=[];this.frameLog=[];}
 socketClass(){const server=this;return class FakeWS{
  constructor(url){
   ok(url.startsWith('wss://rms.metered.ca/v1?key='),'Metered endpoint');
   this.readyState=0;this.bufferedAmount=0;this.id='peer-'+(++server.next);
   this.member=new Set();server.sockets.set(this.id,this);
   queueMicrotask(()=>{if(this.readyState!==0)return;this.readyState=1;this.emit({type:'welcome',peerId:this.id,metadata:{iceServers:server.iceServers}});});
  }
  emit(data){this.onmessage?.({data:JSON.stringify(data)});}
  send(raw){
   const f=JSON.parse(raw),channel=f.channel,member=this.member;
   server.frameLog.push({from:this.id,...f});
   const ack=()=>this.emit({type:'ack',requestId:f.requestId,ok:true});
   if(f.type==='subscribe'){
    let peers=server.channels.get(channel);if(!peers){peers=new Set();server.channels.set(channel,peers);}
    const existing=Array.from(peers);peers.add(this);member.add(channel);ack();
    this.emit({type:'presence',channel,joined:existing.map(p=>({peerId:p.id})),left:[]});
    for(const peer of existing)peer.emit({type:'presence',channel,joined:[{peerId:this.id}],left:[]});
   }else if(f.type==='publish'){
    ack();for(const peer of server.channels.get(channel)||[])if(peer!==this)peer.emit({type:'message',channel,from:this.id,data:f.data});
   }else if(f.type==='send'){
    const target=server.sockets.get(f.to);
    if(!target){this.emit({type:'error',requestId:f.requestId,code:'peer_not_found'});return;}
    ack();target.emit({type:'direct',from:this.id,data:f.data});
   }else throw Error('Unexpected protocol frame '+f.type);
  }
  close(){
   if(this.readyState===3)return;this.readyState=3;server.sockets.delete(this.id);
   for(const channel of this.member){const peers=server.channels.get(channel);peers?.delete(this);
    for(const peer of peers||[])peer.emit({type:'presence',channel,joined:[],left:[{peerId:this.id}]});}
   this.onclose?.({code:1000});
  }
 };}
}
function app(server,script=source,extra={}){
 let elements=new Map(),lastHTML='',savedCalls=0,menuCalls=0;
 const element=(id)=>{
  if(!elements.has(id))elements.set(id,{id,value:'',disabled:false,hidden:false,textContent:'',className:'',onclick:null,focus(){},select(){},querySelectorAll(){return [];},addEventListener(){}});
  return elements.get(id);
 };
 const ctx={
  WebSocket:server.socketClass(),crypto:webcrypto,URL,Uint8Array,setTimeout,clearTimeout,setInterval,clearInterval,TextEncoder,performance:{now:()=>Date.now()},
  navigator:{clipboard:{writeText:async()=>{}}},location:{href:'https://example.org/3d_shooter/?v=33',protocol:'https:'},
  $:element,document:{getElementById:element,querySelector:()=>({value:'citadel'}),hidden:false},
  weapons:Array.from({length:10},(_,i)=>({short:'Weapon '+i})),
  GAME_BUILD:'33',game:null,save:{},persist(){savedCalls++;},
  panel(html){lastHTML=html;elements=new Map();for(const [,id] of html.matchAll(/id="([^"]+)"/g))element(id);},
  menu(){menuCalls++;},
  console,...extra,
 };
 vm.createContext(ctx);vm.runInContext(script,ctx,{filename:'21b-multiplayer-lobby.js'});
 return {
  ctx,el:element,run:(code)=>vm.runInContext(code,ctx),
  get html(){return lastHTML;},get saves(){return savedCalls;},get menus(){return menuCalls;},
 };
}
const setup=(a,nick)=>{a.run('mpHostForm()');a.el('mpHostNick').value=nick;a.el('mpMode').value='teams';a.el('mpEquipment').value='equal';a.el('mpWeapon').value='4';};
const enter=(a,code,nick)=>{a.run('mpJoinForm()');a.el('mpJoinCode').value=code;a.el('mpJoinNick').value=nick;};
const state=a=>a.run('mpRoom');

async function main(){
 ok(manifest.moduleOrder.some(m=>m.file==='21b-multiplayer-lobby.js'),'MP module in manifest');
 ok(manifest.styleOrder.includes('55-multiplayer.css'),'MP stylesheet in manifest');
 ok(menuSource.includes('multiplayerMenu'),'main menu MP entry');
 const server=new FakeMetered(),host=app(server);
 ok(host.run('MP_MAPS.length')===100,'100 selectable maps');
 ok(host.run("mpNickKey('Ｐｌａｙｅｒ')===mpNickKey('player')"),'NFKC + case-insensitive');
 ok(host.run("mpNickKey('ΣΣ')===mpNickKey('ςς')"),'Greek final sigma casefold');
 ok(host.run("mpNickKey('Straße')===mpNickKey('STRASSE')"),'German sharp S casefold');
 ok(host.run("mpNickKey('İvan')===mpNickKey('i\u0307van')"),'combining Unicode marks');
 ok(host.run("(()=>{try{mpNickname('<script>');return false;}catch(_){return true;}})()"),'invalid markup nickname rejected');
 ok(!host.run("mpCode('NR-not-a-room')"),'invalid room rejected');
 ok(host.run("mpCode(mpRandom()&&('NR-'+mpRandom()))")!==null,'random room format');
 ok(host.run("mpEscape('<script>')")=== '&lt;script&gt;','HTML sanitized');
 ok(host.run("mpSettings({mode:'teams',equipment:'owned',friendlyFire:false}).friendlyFire")===true,'friendly fire always on');
 // Inject a *test-only* public key, never ship it in production.
 const fakeKey='pk_live_0123456789abcdefghij';
 const sample=fs.readFileSync(path.join(__dirname,'../src/21b-multiplayer-lobby.js'),'utf8')
  .replace(/const MP_PUBLISHABLE_KEY='[^']+'/,"const MP_PUBLISHABLE_KEY='" + fakeKey + "'");
 // For wire tests, temporarily configure through a VM compile-time replacement.
 function onlineApp(){
  const a=app(server,sample);
  ok(state(a)===null,'new session empty');return a;
 }
 const h=onlineApp();setup(h,'HOST');await h.run('mpCreateRoom()');
 const code=state(h).code;ok(/^NR-[A-Z2-7]{26}$/.test(code),'128-bit invite code');
 ok(state(h).players.length===1,'host in lobby');
 ok(state(h).settings.mode==='teams','host-selected teams');
 ok(state(h).settings.equipment==='equal'&&state(h).settings.weapon===4,'equal weapon preset');
 const alice=onlineApp();enter(alice,code,'Алиса');await alice.run('mpJoinRoom()');
 ok(state(h).players.length===2&&state(alice).players.length===2,'two networked browsers');
 ok(state(alice).hostPeer===state(h).hostPeer,'host identity propagated');
 ok(state(alice).players[1].team===1,'opposite team initially');
 
 ok(!Object.hasOwn(state(h).players[1],'ready'),'host roster has no player readiness flag');
 ok(!Object.hasOwn(state(alice).players[1],'ready'),'guest roster has no player readiness flag');
 const clashA=onlineApp(),clashB=onlineApp();
 enter(clashA,code,'Ωμέγα');enter(clashB,code,'ωΜΈΓΑ');
 await Promise.all([clashA.run('mpJoinRoom()'),clashB.run('mpJoinRoom()')]);
 ok(Number(!!state(clashA))+Number(!!state(clashB))===1,'simultaneous Unicode join reserves one nickname');
 const acceptedClash=state(clashA)?clashA:clashB;
 await acceptedClash.run('mpLeave()');ok(state(h).players.length===2,'concurrent join cleanup');
 const settingsBefore=JSON.stringify(state(alice).settings);
 await alice.run("mpWire.publish(mpChannel(mpRoom.code),{app:'neonrift3d',v:1,kind:'roster',code:mpRoom.code,seq:9000,hostPeer:'attacker',settings:{mode:'ffa'},players:[]})");
 ok(JSON.stringify(state(h).settings)===settingsBefore,'host ignores forged guest roster');
 const dup=onlineApp();enter(dup,code,'АЛИСА');await dup.run('mpJoinRoom()');
 ok(state(dup)===null,'duplicate Cyrillic nickname rejected');
 ok(dup.el('mpStatus').textContent.includes('занят'),'clear duplicate error');
 const players=[alice];
 for(let i=2;i<8;i++){
  const p=onlineApp();enter(p,code,'Player'+i);await p.run('mpJoinRoom()');players.push(p);
 }
 ok(state(h).players.length===8,'eight-player lobby full');
 ok(state(players[0]).players.length===8,'first guest sees complete roster');
 const ninth=onlineApp();enter(ninth,code,'Player9');await ninth.run('mpJoinRoom()');
 ok(state(ninth)===null,'ninth player rejected');
 ok(ninth.el('mpStatus').textContent.includes('заполнена'),'capacity error reported');
 ok(h.saves===0&&players.every(p=>p.saves===0),'lobby never writes permanent single-player save');
 await players[0].run('mpLeave()');
 ok(state(h).players.length===7,'presence removes departed guest');
 await h.run('mpLeave()');
 ok(state(players[1])===null,'host closure notifies guests');
 ok(h.menus===1,'host returns to main menu');
 console.log('STAGE33 MP-1 MOCK NETWORK: '+checks+' assertions passed');
}
if(require.main===module)main().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={FakeMetered,app,setup,enter,state};
