
const $=x=>document.getElementById(x), TAU=Math.PI*2, clamp=(n,a,b)=>Math.max(a,Math.min(b,n)), hypot=Math.hypot, rand=(a,b)=>a+Math.random()*(b-a), pick=a=>a[Math.random()*a.length|0], distance=(a,b)=>hypot(a.x-b.x,a.z-b.z);let game=null, lastFrame=0, deadlock=false;
const SAVE_KEY='neonrift3d-save', SAVE_BACKUP_KEY='neonrift3d-save-backup', SAVE_SESSION_KEY='neonrift3d-save-session';
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
function loadJournal(){
 let main=null,backup=null,session=null;try{main=getSaved(SAVE_KEY,localStorage);backup=getSaved(SAVE_BACKUP_KEY,localStorage);}catch(e){}try{session=getSaved(SAVE_SESSION_KEY,sessionStorage);}catch(e){}const entries=[main,backup,session];
 let newest=null,stamp=-1;
 for(const s of entries){if(!s)continue;const at=Number(s._savedAt)||0;if(!newest||at>stamp){newest=s;stamp=at;}}
 return newest;
}
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
let storageAvailable=true,lastSavedAt=Number(save._savedAt)||0;
function persist(){
 try{
  save._savedAt=Math.max(Date.now(),(Number(save._savedAt)||0)+1);
  const blob=JSON.stringify(save);
  if(devMode){
   localStorage.setItem(DEV_SAVE_KEY,blob);
   storageAvailable=true;lastSavedAt=save._savedAt;return true;
  }
  localStorage.setItem(SAVE_KEY,blob);
  localStorage.setItem(SAVE_BACKUP_KEY,blob);
  try{sessionStorage.setItem(SAVE_SESSION_KEY,blob);}catch(e){}
  storageAvailable=true;lastSavedAt=save._savedAt;return true;
 }catch(e){storageAvailable=false;console.warn('Save unavailable: ',e);return false;}
}
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
   if(!backup||typeof backup!=='object'||!Array.isArray(backup.perms)||!Number.isInteger(backup.best)||backup.best<1)throw Error('Invalid backup');
   // An imported old backup does not specify dashDistance. Do not inherit
   // an unrelated current-session choice: old saves use their full range.
   save={...save,...backup,perms:normalizePerms(backup.perms),settings:{...save.settings,dashDistance:null,...(backup.settings||{})},weaponMods:backup.weaponMods||{},bodyArmor:backup.bodyArmor||{owned:{},equipped:-1}};
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
   persist();game=null;saveNotice('СОХРАНЕНИЕ ИМПОРТИРОВАНО');showCampaignMap(campaignPage);
 }catch(e){alert('Не удалось импортировать сохранение. Проверь JSON-файл резервной копии.');}finally{restoreInput.value='';}
});
function wireBackupButtons(){document.querySelectorAll('[data-export-save]').forEach(b=>b.onclick=backupFile);document.querySelectorAll('[data-import-save]').forEach(b=>b.onclick=()=>restoreInput.click());}
