// MP-8: bounded guest prediction and graceful recovery from missing host state.
// Never synthesize a hit, position, ability or round outcome on the guest.
const MP8_WARN_MS=600,MP8_FREEZE_MS=1050,MP8_AUTO_RETRY_MS=4800;

function mp8Init(){
 const m=mpMatch;if(!m?.active)return;
 m.recoveryAttempts=0;m.recoveryNextAt=0;m.recoveredAfterSilence=false;
 if(m.host)return;
 const btn=document.createElement('button');btn.id='mpReconnectNow';btn.type='button';
 btn.textContent='⟳ ВОССТАНОВИТЬ СВЯЗЬ';btn.hidden=true;
 btn.setAttribute('aria-label','Переподключить сетевую игру к ведущему');
 btn.onclick=()=>mpRtcManualRetry();document.body.appendChild(btn);
}
function mp8GuestState(now=Date.now()){
 const m=mpMatch;
 if(!m?.active||m.host||m.round?.ended)return 'ok';
 const age=now-m.lastFromHost;
 if(age>=MP8_FREEZE_MS)return 'frozen';
 if(age>=MP8_WARN_MS)return 'lag';
 return 'ok';
}
function mp8GuestFrozen(){return mp8GuestState()==='frozen';}
function mp8NeutralInput(command){
 // Keep the authentic counter values but never apply or transmit a held
 // movement/firing/flight control during a prolonged snapshot blackout.
 return {...command,mx:0,mz:0,j:false,s:false,f:false,u:false,dn:false};
}
function mp8OnSnapshot(m,now=Date.now()){
 if(m.host)return;
 const gap=now-m.lastFromHost;
 if(gap>=MP8_FREEZE_MS&&!m.round?.ended){
  m.recoveredAfterSilence=true;
  for(const a of m.actors.values())if(a.id!==m.self){a.samples=[];a.jitter=0;}
 }
}
function mp8ReconcileRecovered(m,p,next){
 if(!m.recoveredAfterSilence)return false;
 // The local predicted position is not reliable after an outage; use the
 // authenticated host snapshot exactly once before resuming soft correction.
 p.x=next.x;p.z=next.z;p.feetY=next.h;p.vy=next.vy;
 p.grounded=!!next.g;p.energy=next.e;
 m.recoveredAfterSilence=false;return true;
}
function mp8Update(m,now=Date.now()){
 if(!m?.active||m.host||m.round?.ended||document.hidden)return;
 if(now-m.lastFromHost<MP8_AUTO_RETRY_MS||m.recoveryAttempts>=1||!mpRoom||
  !mpSignalingOnline()||now<(m.recoveryNextAt||0))return;
 // A failed/undelivered retry is not a successful network attempt. Allow
 // another one only after a backoff, to avoid rapid metered signalling spam.
 if(mpRtcManualRetry(()=>{
  if(mpMatch!==m)return;
  m.recoveryAttempts=Math.max(0,m.recoveryAttempts-1);
  m.recoveryNextAt=Date.now()+8000;
 }))m.recoveryAttempts++;
}
function mp8UpdateHud(m){
 if(!m?.active||m.host)return '';
 const state=mp8GuestState(),btn=$('mpReconnectNow');
 if(btn)btn.hidden=state!=='frozen';
 if(state==='frozen')return '⚠ НЕТ СНИМКОВ · УПРАВЛЕНИЕ ПРИОСТАНОВЛЕНО';
 if(state==='lag')return '⚠ ЗАДЕРЖКА СЕТИ';
 return '';
}
function mp8HostWarning(m){
 if(!m?.active||!m.host||m.round?.ended)return '';
 const now=Date.now();
 const count=[...m.actors.values()].filter(a=>!a.host&&a.seq>=0&&
  now-a.lastInputAt>1200).length;
 return count?'⚠ НЕТ ВВОДА: '+count:'';
}
