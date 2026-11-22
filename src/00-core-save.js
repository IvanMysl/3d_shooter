
const $=x=>document.getElementById(x), TAU=Math.PI*2, clamp=(n,a,b)=>Math.max(a,Math.min(b,n)), hypot=Math.hypot, rand=(a,b)=>a+Math.random()*(b-a), pick=a=>a[Math.random()*a.length|0], distance=(a,b)=>hypot(a.x-b.x,a.z-b.z);let game=null, lastFrame=0, deadlock=false;
// Stage32 uses a protected namespace. An already-open Stage31 (or older) page
// still writes its legacy keys, but cannot overwrite this edition's progress.
// Import the legacy journal once; never let a newer legacy write silently
// replace an existing protected journal.
const SAVE_KEY='neonrift3d-save-protected-v1',SAVE_BACKUP_KEY='neonrift3d-save-protected-backup-v1',SAVE_SESSION_KEY='neonrift3d-save-protected-session-v1';
const LEGACY_SAVE_KEY='neonrift3d-save',LEGACY_BACKUP_KEY='neonrift3d-save-backup',LEGACY_SESSION_KEY='neonrift3d-save-session';
const GAME_BUILD='131',GAME_RELEASE='2026-11-22 / OCCLUDED PLAYER NAMES';
// Developer play is an isolated rehearsal save. It can never overwrite the
// player's regular autosaves, backup journal or session save.
const DEV_SAVE_KEY='neonrift3d-developer-sandbox-v1',DEV_PASSWORD_KEY='neonrift3d-developer-password-v1';
let devMode=false,normalPlayerSave=null;
const FPS_LIMITS=[30,45,60,90,120,0]; // 0: unrestricted, constrained by screen/browser/GPU.
function normalizeFpsLimit(raw){const fps=Number(raw);return FPS_LIMITS.includes(fps)?fps:60;}
function normalizeCameraMode(raw){return raw==='third'||raw==='second'?raw:'first';}
function normalizeFlightThrottle(raw){const v=Number(raw);return Number.isFinite(v)?Math.round(clamp(v,.25,1)*20)/20:1;}
// Each key press changes the chosen distance by 0.5 m; each purchased phase
// upgrade raises its CAP by 0.3 m. These are deliberately different scales.
// Preserve previously saved absolute distances down to centimeters rather
// than snapping legacy 0.24-m selections onto a new 0.5-m grid.
// Null means automatic maximum for pre-selector saves.
const DASH_DISTANCE_MIN=.50,DASH_DISTANCE_STEP=.50,DASH_UPGRADE_STEP=.30;
const DASH_DISTANCE_BASE=2.52,DASH_DISTANCE_MAX=Number((DASH_DISTANCE_BASE+40*DASH_UPGRADE_STEP).toFixed(2));
function normalizeDashDistanceSetting(raw){
 if(raw==null||raw==='')return null;
 if(typeof raw!=='number'&&typeof raw!=='string')return null;
 const n=Number(raw);if(!Number.isFinite(n))return null;
 return Number(clamp(n,DASH_DISTANCE_MIN,DASH_DISTANCE_MAX).toFixed(2));
}
const PERM_MAX_LEVEL=40,PERM_COUNT=12;
function normalizePerms(raw){return Array.from({length:PERM_COUNT},(_,i)=>clamp(Math.floor(Number(raw?.[i])||0),0,PERM_MAX_LEVEL));}
const saveDefaults={best:1,credits:0,kills:0,perms:Array(PERM_COUNT).fill(0),runs:0,settings:{audio:true,aim:true,quality:1,fpsLimit:60,cameraMode:'first',dashDistance:null,flightHorizontal:1,flightVertical:1},checkpoint:null};
function getSaved(key,area){try{const s=JSON.parse(area.getItem(key));if(s&&typeof s==='object'&&Array.isArray(s.perms)&&s.best>=1)return s;}catch(e){}return null;}
function latestJournal(mainKey,backupKey,sessionKey){
 let main=null,backup=null,session=null;try{main=getSaved(mainKey,localStorage);backup=getSaved(backupKey,localStorage);}catch(e){}try{session=getSaved(sessionKey,sessionStorage);}catch(e){}const entries=[main,backup,session];
 let newest=null,stamp=-1;
 for(const s of entries){if(!s)continue;const at=Number(s._savedAt)||0;if(!newest||at>stamp){newest=s;stamp=at;}}
 return newest;
}
const protectedJournal=latestJournal(SAVE_KEY,SAVE_BACKUP_KEY,SAVE_SESSION_KEY);
const legacyJournal=latestJournal(LEGACY_SAVE_KEY,LEGACY_BACKUP_KEY,LEGACY_SESSION_KEY);
let legacyDiverged=!!protectedJournal&&!!legacyJournal&&
 (Number(legacyJournal._savedAt)||0)>(Number(protectedJournal._savedAt)||0);
function loadJournal(){return protectedJournal||legacyJournal;}
const loadedSave=loadJournal();
let save={...saveDefaults,...(loadedSave||{}),perms:normalizePerms(loadedSave?.perms||saveDefaults.perms),settings:{...saveDefaults.settings,...(loadedSave?.settings||{})}};
save.settings.quality=clamp(save.settings.quality|0,0,2);
save.settings.fpsLimit=normalizeFpsLimit(save.settings.fpsLimit);
save.settings.cameraMode=normalizeCameraMode(save.settings.cameraMode);
save.settings.dashDistance=normalizeDashDistanceSetting(save.settings.dashDistance);
save.settings.flightHorizontal=normalizeFlightThrottle(save.settings.flightHorizontal);
save.settings.flightVertical=normalizeFlightThrottle(save.settings.flightVertical);
// A complete campaign has five chapters of twenty levels, with a real finale.
const CAMPAIGN_CHAPTER_SIZE=20, CAMPAIGN_MAX_LEVEL=100;
// Reject damaged checkpoint containers before changing the active game or journal.
function checkpointShapeOK(ck){
 if(ck==null)return true;
 const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 if(!record(ck)||!Number.isInteger(Number(ck.sector))||Number(ck.sector)<1||Number(ck.sector)>CAMPAIGN_MAX_LEVEL)return false;
 for(const k of ['player','upgrades','live'])if(ck[k]!=null&&!record(ck[k]))return false;
 if(ck.pendingUpgrade!=null&&(!Array.isArray(ck.pendingUpgrade)||ck.pendingUpgrade.some(x=>typeof x!=='string')))return false;
 if(ck.player?.abilityCooldowns!=null&&!record(ck.player.abilityCooldowns))return false;
 for(const k of ['enemies','bullets','tracers','projectiles','burstQueue','loot','nodes','decals','scorch','devices','robotDebris']){
  if(ck.live&&Object.prototype.hasOwnProperty.call(ck.live,k)&&(!Array.isArray(ck.live[k])||ck.live[k].some(x=>!record(x))))return false;
 }
 if(ck.live?.mission!=null&&!record(ck.live.mission))return false;
 for(const k of ['caches','objectives'])if(ck.live?.mission?.[k]!=null&&!Array.isArray(ck.live.mission[k]))return false;
 return true;
}
function normalizeCampaign(record, legacyBest=1, checkpoint=null){
 const oldUnlocked=clamp(Math.floor(Number(legacyBest)||1),1,CAMPAIGN_MAX_LEVEL);
 const oldCheckpoint=Number(checkpoint?.sector)>CAMPAIGN_MAX_LEVEL?1:clamp(Math.floor(Number(checkpoint?.sector)||1),1,CAMPAIGN_MAX_LEVEL);
 // Legacy saves tracked the highest visited sector, so all preceding sectors were completed.
 // Existing campaign records supersede legacy best to avoid unlocking levels on a failed attempt.
 const migrated=Math.max(oldUnlocked,oldCheckpoint);
 const found=record&&typeof record==='object'&&Number(record.schema)>=1;
 const done=found?clamp(Math.floor(Number(record.completedThrough)||0),0,CAMPAIGN_MAX_LEVEL):Math.max(0,migrated-1);
 const unlocked=found?clamp(Math.max(done+1,Math.floor(Number(record.highestUnlocked)||1)),1,CAMPAIGN_MAX_LEVEL):migrated;
 const records=found&&record.records&&typeof record.records==='object'&&!Array.isArray(record.records)?record.records:{};
 return {schema:1,completedThrough:done,highestUnlocked:unlocked,records,
   totalVictories:Math.max(0,Math.floor(Number(record?.totalVictories)||0)),
   latestCompleted:clamp(Math.floor(Number(record?.latestCompleted)||0),0,CAMPAIGN_MAX_LEVEL)};
}
save.campaign=normalizeCampaign(save.campaign,save.best,save.checkpoint);
save.best=clamp(Math.floor(Number(save.best)||1),1,CAMPAIGN_MAX_LEVEL);
if(Number(save.checkpoint?.sector)>CAMPAIGN_MAX_LEVEL)save.checkpoint=null;
let campaignPage=Math.floor((save.campaign.highestUnlocked-1)/CAMPAIGN_CHAPTER_SIZE);
let storageAvailable=true,lastSavedAt=Number(save._savedAt)||0,saveConflict=false;
function showSaveConflict(){
 storageAvailable=false;
 if(!document.body||$('saveConflictBanner'))return;
 const banner=document.createElement('div');banner.id='saveConflictBanner';banner.setAttribute('role','alert');
 banner.innerHTML='<strong>⚠ ПРОГРЕСС ИЗМЕНЁН В ДРУГОЙ ВКЛАДКЕ</strong><span>Автосохранение здесь остановлено, чтобы не затереть более новые покупки. Экспортируй своё состояние в JSON или загрузи прогресс из другой вкладки.</span><div class="saveConflictActions"><button type="button" data-conflict-export>⬇ ЭКСПОРТ JSON</button><button type="button" data-conflict-reload>↻ ЗАГРУЗИТЬ АКТУАЛЬНОЕ</button></div>';
 document.body.append(banner);
 banner.querySelector('[data-conflict-export]').onclick=backupFile;
 banner.querySelector('[data-conflict-reload]').onclick=()=>window.location.reload();
 // Do not let an unsavable run continue silently in the background.
 if(game?.state==='playing'&&typeof pause==='function')pause();
}
function persist(force=false){
 if(game?.preview)return false;
 try{
  if(devMode){
   save._savedAt=Math.max(Date.now(),(Number(save._savedAt)||0)+1);
   localStorage.setItem(DEV_SAVE_KEY,JSON.stringify(save));
   storageAvailable=true;return true;
  }
  const disk=getSaved(SAVE_KEY,localStorage),diskStamp=Number(disk?._savedAt)||0;
  // Another Stage32 tab saved since this one loaded. Never silently replace
  // its purchase/armor/checkpoint snapshot with an older in-memory copy.
  if(!force&&(saveConflict||diskStamp>lastSavedAt)){
   saveConflict=true;showSaveConflict();return false;
  }
  // A still-open Stage31 tab may have changed its own journal meanwhile.
  // Preserve that separate branch for manual JSON export; never silently
  // replace newer legacy progress with a mirror of the protected branch.
  const oldLegacy=getSaved(LEGACY_SAVE_KEY,localStorage);
  if((Number(oldLegacy?._savedAt)||0)>lastSavedAt)legacyDiverged=true;
  save._savedAt=Math.max(Date.now(),(Number(save._savedAt)||0)+1,lastSavedAt+1,diskStamp+1);
  const blob=JSON.stringify(save);
  // Unlike Stage31, the backup is the PREVIOUS good snapshot, not an
  // identical overwrite. Never replace a newer recovery copy with an older
  // primary if a prior write failed partway through.
  const rollback=getSaved(SAVE_BACKUP_KEY,localStorage);
  if(disk&&diskStamp>=(Number(rollback?._savedAt)||0)){
   try{localStorage.setItem(SAVE_BACKUP_KEY,JSON.stringify(disk));}
   catch(e){console.warn('Previous save journal unavailable: ',e);}
  }
  localStorage.setItem(SAVE_KEY,blob);
  // Compatibility mirror: Stage31 may still read legacy data, but its writes
  // can no longer destroy this protected Stage32 copy. Best effort only.
  if(!legacyDiverged)try{localStorage.setItem(LEGACY_SAVE_KEY,blob);}catch(e){}
  try{sessionStorage.setItem(SAVE_SESSION_KEY,blob);}catch(e){}
  lastSavedAt=save._savedAt;storageAvailable=true;
  if(force){saveConflict=false;legacyDiverged=false;$('saveConflictBanner')?.remove();}
  return true;
 }catch(e){storageAvailable=false;console.warn('Save unavailable: ',e);return false;}
}
if(typeof addEventListener==='function')addEventListener('storage',e=>{
 if(devMode||!e.newValue)return;
 try{const updated=JSON.parse(e.newValue);
  if((Number(updated?._savedAt)||0)<=lastSavedAt)return;
  if(e.key===SAVE_KEY){saveConflict=true;showSaveConflict();}
  if(e.key===LEGACY_SAVE_KEY)legacyDiverged=true;
 }catch(_){/* A corrupt external write must not break gameplay. */}
});
if(loadedSave){try{if(getSaved(SAVE_KEY,localStorage)?._savedAt!==save._savedAt)persist();}catch(e){storageAvailable=false;}}
let autosaveNoticeUntil=0;
function saveNotice(message){const e=$('saveToast');if(!e)return;e.textContent=message;e.classList.add('visible');autosaveNoticeUntil=performance.now()+1500;}
function backupFile(){
 if(devMode){saveNotice('ТЕСТОВЫЙ ПРОГРЕСС НЕ ЭКСПОРТИРУЕТСЯ');return;}
 if(game&&game.state!=='dead')saveRun();
 const blob=new Blob([JSON.stringify({format:'NEON_RIFT_BACKUP_V3',saved:save,created:new Date().toISOString()},null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='NEON_RIFT_BACKUP_'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4500);
}
const restoreInput=document.createElement('input');restoreInput.type='file';restoreInput.accept='.json,application/json';restoreInput.style.display='none';document.body.append(restoreInput);
restoreInput.addEventListener('change',async()=>{
 if(devMode){restoreInput.value='';alert('В режиме разработчика импорт отключён, чтобы не затронуть обычные сохранения.');return;}
 const f=restoreInput.files?.[0];if(!f)return;
 try{const payload=JSON.parse(await f.text());const backup=payload?.format==='NEON_RIFT_BACKUP_V3'?payload.saved:payload;
   if(!backup||typeof backup!=='object'||!Array.isArray(backup.perms)||!Number.isInteger(backup.best)||backup.best<1||!checkpointShapeOK(backup.checkpoint))throw Error('Invalid backup');
   if(!confirm('Импорт ЗАМЕНИТ текущий прогресс, а не объединит покупки. Сначала экспортируй текущую игру в JSON. Продолжить?'))return;
   const before=save;
   // An imported old backup does not specify dashDistance. Do not inherit
   // an unrelated current-session choice: old saves use their full range.
   save={...save,...backup,checkpoint:backup.checkpoint??null,perms:normalizePerms(backup.perms),settings:{...save.settings,dashDistance:null,...(backup.settings||{})},weaponMods:backup.weaponMods||{},bodyArmor:backup.bodyArmor||{owned:{},equipped:-1}};
   save.settings.quality=clamp(save.settings.quality|0,0,2);
   save.settings.fpsLimit=normalizeFpsLimit(save.settings.fpsLimit);
   save.settings.cameraMode=normalizeCameraMode(save.settings.cameraMode);
   save.settings.dashDistance=normalizeDashDistanceSetting(save.settings.dashDistance);
   save.settings.flightHorizontal=normalizeFlightThrottle(save.settings.flightHorizontal);
   save.settings.flightVertical=normalizeFlightThrottle(save.settings.flightVertical);
   normalizeLoadoutSave();
   refreshCameraInterface();
   save.campaign=normalizeCampaign(backup.campaign,backup.best,backup.checkpoint);
   save.best=clamp(Math.floor(Number(save.best)||1),1,CAMPAIGN_MAX_LEVEL);
   if(Number(save.checkpoint?.sector)>CAMPAIGN_MAX_LEVEL)save.checkpoint=null;
   campaignPage=Math.floor((save.campaign.highestUnlocked-1)/CAMPAIGN_CHAPTER_SIZE);
   if(!persist(true)){
    save=before;campaignPage=Math.floor((save.campaign.highestUnlocked-1)/CAMPAIGN_CHAPTER_SIZE);
    refreshCameraInterface();throw Error('Save storage unavailable after import');
   }
   game=null;saveNotice('СОХРАНЕНИЕ ИМПОРТИРОВАНО');showCampaignMap(campaignPage);
 }catch(e){alert('Не удалось импортировать сохранение. Проверь JSON-файл резервной копии.');}finally{restoreInput.value='';}
});
function wireBackupButtons(){document.querySelectorAll('[data-export-save]').forEach(b=>b.onclick=backupFile);document.querySelectorAll('[data-import-save]').forEach(b=>b.onclick=()=>restoreInput.click());}
