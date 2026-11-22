'use strict';
// Stage130 regression: there is no human READY switch. The host launches after
// the two actual RTC channels are open; all 100 maps keep their stable IDs.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {FakeMetered,app,setup,enter,state}=require('./test_stage33_mp1_lobby.cjs');
const {createBrowser,active,until}=require('./test_stage35_mp3_movement.cjs');
const root=path.join(__dirname,'..');
let checks=0;
function check(value,label){assert.ok(value,label);checks++;}
const lobby=fs.readFileSync(path.join(root,'src/21b-multiplayer-lobby.js'),'utf8');
const match=fs.readFileSync(path.join(root,'src/21d-multiplayer-movement.js'),'utf8');
function simpleUI(){return app(new FakeMetered());}
async function test(){
 check(/const MP_VERSION=44\b/.test(lobby),'protocol upgraded: old readiness peers cannot join');
 check(!/function mpReady\b|id="mpReady"|kind==='ready'/.test(lobby),'readiness action and protocol branch removed');
 check(!/\.ready\b|\bready:false\b|\bready:true\b/.test(lobby),'player readiness field removed');
 check(!/p\.ready\b/.test(match),'match readiness no longer depends on human flags');
 check(!/подтверд.*готовност/i.test(lobby+match),'no UI prompts for readiness');
 check(!/Например, Ivan|Введите уникальный ник/.test(lobby),'old nick placeholders removed');
 const a=simpleUI();a.run('mpHostForm()');
 check(a.html.includes('id="mpHostNick"')&&a.html.includes('placeholder="Ваш ник"'),'create form nickname placeholder');
 check(!a.html.includes('ВАШ НИК')&&!a.html.includes('Например'),'no external host nick label or sample');
 check(a.html.includes('aria-label="Ваш ник"'),'host input accessible name retained');
 a.run('mpJoinForm()');
 check(a.html.includes('id="mpJoinNick"')&&a.html.includes('placeholder="Ваш ник"'),'join form nickname placeholder');
 check(!a.html.includes('ВАШ НИК'),'no external guest nickname label');
 // Fake Metered + real app-level WebRTC handshake and start-stop events.
 const server=new FakeMetered();const h=createBrowser(server);setup(h,'HOST');
 await h.run('mpCreateRoom()');
 check(state(h).players.length===1,'host initially alone');
 check(h.run('!mpMatchCanStart()'),'one player cannot start PvP');
 check(h.html.includes('id="mpStartTraining"'),'host has a start battle control');
 check(h.html.includes('disabled'),'start disabled before second player connects');
 check(!h.html.includes('id="mpReady"'),'host lobby has no READY button');
 check(!h.html.includes('✓ ГОТОВ')&&!h.html.includes('ОЖИДАЕТ'),'host lobby has no human status');
 const g=createBrowser(server);enter(g,state(h).code,'GUEST');await g.run('mpJoinRoom()');
 check(g.html.includes('id="mpLobbyChat"'),'guest retains room chat');
 check(!g.html.includes('id="mpStartTraining"'),'guest cannot see start action');
 check(!g.html.includes('id="mpReady"'),'guest has no READY button');
 check(!g.run('mpMatchCanStart()'),'guest cannot start independently');
 check(state(h).players.every(p=>!Object.hasOwn(p,'ready')),'host roster has no ready state');
 check(state(g).players.every(p=>!Object.hasOwn(p,'ready')),'guest roster has no ready state');
 await until(()=>h.run('mpRtcLinks.get(mpRoom.players[1].peerId)?.fast?.readyState==="open"')&&
                h.run('mpRtcLinks.get(mpRoom.players[1].peerId)?.control?.readyState==="open"')&&
                g.run('mpRtcLinks.get(mpRoom.hostPeer)?.fast?.readyState==="open"'));
 check(h.run('mpMatchCanStart()'),'host can start as soon as RTC is connected');
 check(!h.el('mpStartTraining').disabled,'launch button becomes enabled after RTC connection');
 // Invalid or stale READY packets must never influence host's roster.
 const before=state(h).seq;
 await g.run("mpWire.send(mpRoom.hostPeer,mpPacket('ready',{ready:true}))");
 check(state(h).seq===before,'obsolete READY frame ignored');
 check(!state(h).players.some(p=>Object.hasOwn(p,'ready')),'obsolete packet cannot reintroduce readiness state');
 check(server.frameLog.filter(f=>f.type==='publish').every(f=>!f.data?.players?.some(p=>Object.hasOwn(p,'ready'))),'roster messages omit readiness field');
 g.run('mpMatchStartTraining()');
 check(!active(h)&&!active(g),'guest start attempt cannot launch match');
 h.run('mpMatchStartTraining()');await until(()=>active(h)&&active(g));
 check(state(h).players.length===2,'roster retained after host launch');
 check(h.run('mpMatch.token')===g.run('mpMatch.token'),'both players receive same match token');
 const oldToken=h.run('mpMatch.token');
 h.run('mpMatchStop()');await until(()=>!active(h)&&!active(g));
 check(h.run('mpMatchCanStart()'),'host can launch a new match without any READY toggles');
 check(!h.el('mpStartTraining').disabled,'replay start button enabled');
 check(!h.html.includes('id="mpReady"')&&!g.html.includes('id="mpReady"'),'READY controls absent after stop');
 h.run('mpMatchStartTraining()');await until(()=>active(h)&&active(g));
 check(h.run('mpMatch.token')!==oldToken,'replay receives fresh token');
 check(h.run('game.sector')===g.run('game.sector'),'same map loaded for host and guest');
 check(h.saves===0&&g.saves===0,'PvP does not write campaign progress');
 g.run('mpShutdown()');h.run('mpShutdown()');
 console.log(`STAGE130 HOST-ONLY LAUNCH: ${checks} assertions passed`);
}
test().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
