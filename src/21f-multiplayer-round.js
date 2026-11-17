// MP-5: host-owned round limits, final standings and reliable result handoff.
// No personal save data or remote player claims are used for standings.
const MP5_RESULT_REASONS=['score','time','forfeit'];

function mpRoundInit(){
 const m=mpMatch;if(!m?.active)return;
 const now=Date.now(),settings=mpSettings(m.settings);
 m.round={ended:false,settings,startedAt:now,endsAt:now+settings.timeLimitSec*1000,
  remoteLeft:settings.timeLimitSec,remoteAt:now,result:null};
}
function mpRoundRemaining(){
 const m=mpMatch,r=m?.round;if(!r)return 0;
 if(r.ended)return 0;
 if(m.host)return Math.max(0,(r.endsAt-Date.now())/1000);
 return Math.max(0,Math.min(r.settings.timeLimitSec,
  r.remoteLeft-(Date.now()-r.remoteAt)/1000));
}
function mpRoundClock(){
 const seconds=Math.ceil(mpRoundRemaining());
 return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
}
function mpRoundState(){
 const r=mpMatch?.round;
 if(!r)return null;
 return {left:+mpRoundRemaining().toFixed(1),result:r.ended?r.result:null};
}
function mpRoundLeader(reason){
 const m=mpMatch,players=[...m.actors.values()];
 const scores=[0,0];for(const a of players)scores[a.team]+=a.kills||0;
 let winnerId=-1,winnerTeam=-1;
 if(reason==='forfeit'&&players.length===1){
  if(m.settings.mode==='teams')winnerTeam=players[0].team;
  else winnerId=players[0].id;
 }else if(m.settings.mode==='teams'){
  if(scores[0]!==scores[1])winnerTeam=scores[0]>scores[1]?0:1;
 }else{
  const ordered=[...players].sort((a,b)=>(b.kills||0)-(a.kills||0)||a.id-b.id);
  if(ordered.length&&(!ordered[1]||ordered[0].kills>ordered[1].kills))winnerId=ordered[0].id;
 }
 return {winnerId,winnerTeam,scores};
}
function mpRoundFinish(reason){
 const m=mpMatch,r=m?.round;if(!m?.active||!m.host||!r||r.ended||!MP5_RESULT_REASONS.includes(reason))return false;
 const leaders=mpRoundLeader(reason),result={reason,mode:m.settings.mode,tick:m.tick,
  winnerId:leaders.winnerId,winnerTeam:leaders.winnerTeam,scores:leaders.scores,
  players:[...m.actors.values()].map(a=>({id:a.id,k:a.kills||0,d:a.deaths||0,team:a.team}))};
 r.ended=true;r.result=result;m.paused=true;
 input.fire=false;m.fireUntil=0;
 m.projectiles.length=0;game.projectiles=[];
 for(const a of m.actors.values()){a.cmd.f=false;a.bursts.length=0;}
 for(const a of m.actors.values())if(!a.host){
  const link=mpRtcLinks.get(a.peerId);
  if(link)mpRtcSend(link,link.control,{v:MP_VERSION,kind:'mp3-result',token:m.token,result});
 }
 mpRoundShowResults();mpMatchStatus();
 return true;
}
function mpRoundCheck(){
 const m=mpMatch,r=m?.round;
 if(!m?.active||!m.host||!r||r.ended)return;
 const limit=r.settings.scoreLimit;
 const leaders=mpRoundLeader('score');
 const points=m.settings.mode==='teams'?Math.max(...leaders.scores):
  Math.max(-1e7,...[...m.actors.values()].map(a=>a.kills||0));
 if(points>=limit)mpRoundFinish('score');
 else if(Date.now()>=r.endsAt)mpRoundFinish('time');
}
function mpRoundSafeResult(data){
 const m=mpMatch;
 if(!m?.active||!data||typeof data!=='object'||!MP5_RESULT_REASONS.includes(data.reason)||
  data.mode!==m.settings.mode||!Number.isSafeInteger(data.tick)||data.tick<0||data.tick>1e9||
  !Number.isInteger(data.winnerId)||!Number.isInteger(data.winnerTeam)||
  (data.winnerId!==-1&&!m.roster.some(p=>p.id===data.winnerId))||
  ![-1,0,1].includes(data.winnerTeam)||
  (data.mode==='teams'&&data.winnerId!==-1)||
  (data.mode==='ffa'&&data.winnerTeam!==-1)||
  !Array.isArray(data.scores)||data.scores.length!==2||
  !data.scores.every(x=>Number.isSafeInteger(x)&&Math.abs(x)<=1e7)||
  !Array.isArray(data.players)||data.players.length<1||data.players.length>MP_CAP)return null;
 const seen=new Set(),players=[];
 for(const raw of data.players){
  const member=m.roster.find(p=>p.id===raw?.id);
  if(!member||seen.has(raw.id)||!Number.isSafeInteger(raw.k)||Math.abs(raw.k)>1e7||
   !Number.isSafeInteger(raw.d)||raw.d<0||raw.d>1e7||raw.team!==member.team)return null;
  seen.add(raw.id);players.push({id:raw.id,k:raw.k,d:raw.d,team:raw.team});
 }
 const scores=[0,0];for(const p of players)scores[p.team]+=p.k;
 if(scores.some((x,i)=>x!==data.scores[i]))return null;
 if(data.winnerId!==-1&&!seen.has(data.winnerId))return null;
 if(data.winnerTeam!==-1&&!players.some(p=>p.team===data.winnerTeam))return null;
 return {reason:data.reason,mode:data.mode,tick:data.tick,winnerId:data.winnerId,
  winnerTeam:data.winnerTeam,scores,players};
}
function mpRoundAccept(data){
 const m=mpMatch,r=m?.round;
 if(!m?.active||m.host||!r||r.ended)return false;
 const result=mpRoundSafeResult(data);if(!result)return false;
 r.ended=true;r.result=result;m.paused=true;
 input.fire=false;m.fireUntil=0;game.projectiles=[];
 for(const row of result.players){const actor=m.actors.get(row.id);
  if(actor){actor.kills=row.k;actor.deaths=row.d;actor.cmd.f=false;}}
 mpRoundShowResults();mpMatchStatus();return true;
}
function mpRoundApplySnapshot(state){
 const m=mpMatch,r=m?.round,payload=state?.round;
 if(!m?.active||m.host||!r||!payload||typeof payload!=='object')return;
 if(!Number.isFinite(payload.left)||payload.left<0||payload.left>r.settings.timeLimitSec+.5)return;
 r.remoteLeft=payload.left;r.remoteAt=Date.now();
 if(payload.result)mpRoundAccept(payload.result);
}
function mpRoundResync(peer){
 const m=mpMatch,r=m?.round;if(!m?.active||!m.host||!r?.ended)return;
 const link=mpRtcLinks.get(peer);
 if(link)mpRtcSend(link,link.control,{v:MP_VERSION,kind:'mp3-result',token:m.token,result:r.result});
}
function mpRoundShowResults(){
 const m=mpMatch,result=m?.round?.result;if(!m?.active||!result)return;
 if(document.pointerLockElement)document.exitPointerLock();
 pauseResumeGraceUntil=performance.now()+1100;
 const reason=result.reason==='score'?'Достигнут победный счёт':
  result.reason==='time'?'Время вышло':'Соперник покинул матч';
 const winner=result.mode==='teams'?
  (result.winnerTeam===0?'Победила голубая команда':result.winnerTeam===1?'Победила оранжевая команда':'Ничья'):
  result.winnerId===-1?'Ничья':'Победитель: '+(m.roster.find(p=>p.id===result.winnerId)?.nick||'Оператор');
 const ordered=[...result.players].sort((a,b)=>b.k-a.k||a.d-b.d||a.id-b.id);
 const rows=ordered.map((p,i)=>{
  const name=m.roster.find(r=>r.id===p.id)?.nick||'Игрок';
  return `<li class="mpResultRow ${p.id===m.self?'mpResultSelf':''}"><span>${i+1}. ${mpEscape(name)}`+
   `${result.mode==='teams'?(p.team===0?' 🔵':' 🟠'):''}</span><b>${p.k} / ${p.d}</b></li>`;
 }).join('');
 panel(`<div class="eyebrow">СЕТЕВАЯ ИГРА / MP-10 · РЕЗУЛЬТАТЫ</div>
  <h2>${mpEscape(winner)}</h2><p class="lede">${mpEscape(reason)} · ${mpEscape(mpMap(m.settings.mapId)?.name||'Карта')}</p>
  <p class="smalltext">Очки / смерти · ${m.settings.scoreLimit} очков для победы · ${m.settings.timeLimitSec/60} мин. максимум</p>
  ${result.mode==='teams'?`<div class="mpResultTeams">🔵 ${result.scores[0]} : ${result.scores[1]} 🟠</div>`:''}
  <ol class="mpResultList">${rows}</ol>
  <div class="row">${m.host?'<button class="primary" id="mpReturnLobby">↻ В ЛОББИ / СЛЕДУЮЩИЙ МАТЧ</button>':
   '<span class="mpRule">Ожидаем ведущего, чтобы вернуться в лобби.</span>'}
   <button class="secondary" id="mpResultExit">← ВЫЙТИ ИЗ КОМНАТЫ</button></div>`);
 if(m.host)$('mpReturnLobby').onclick=mpMatchStop;
 $('mpResultExit').onclick=mpLeave;
}
