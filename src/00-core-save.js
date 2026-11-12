
const $=x=>document.getElementById(x), TAU=Math.PI*2, clamp=(n,a,b)=>Math.max(a,Math.min(b,n)), hypot=Math.hypot, rand=(a,b)=>a+Math.random()*(b-a), pick=a=>a[Math.random()*a.length|0], distance=(a,b)=>hypot(a.x-b.x,a.z-b.z);let game=null, lastFrame=0, deadlock=false;
const SAVE_KEY='neonrift3d-save', SAVE_BACKUP_KEY='neonrift3d-save-backup', SAVE_SESSION_KEY='neonrift3d-save-session';
const FPS_LIMITS=[30,45,60,90,120,0]; // 0: unrestricted, constrained by screen/browser/GPU.
function normalizeFpsLimit(raw){const fps=Number(raw);return FPS_LIMITS.includes(fps)?fps:60;}
const saveDefaults={best:1,credits:0,kills:0,perms:[0,0,0,0],runs:0,settings:{audio:true,aim:true,quality:1,fpsLimit:60},checkpoint:null};
function getSaved(key,area){try{const s=JSON.parse(area.getItem(key));if(s&&typeof s==='object'&&Array.isArray(s.perms)&&s.best>=1)return s;}catch(e){}return null;}
function loadJournal(){
 let main=null,backup=null,session=null;try{main=getSaved(SAVE_KEY,localStorage);backup=getSaved(SAVE_BACKUP_KEY,localStorage);}catch(e){}try{session=getSaved(SAVE_SESSION_KEY,sessionStorage);}catch(e){}const entries=[main,backup,session];
 let newest=null,stamp=-1;
 for(const s of entries){if(!s)continue;const at=Number(s._savedAt)||0;if(!newest||at>stamp){newest=s;stamp=at;}}
 return newest;
}
const loadedSave=loadJournal();
let save={...saveDefaults,...(loadedSave||{}),perms:(loadedSave?.perms||[0,0,0,0]).slice(0,4),settings:{...saveDefaults.settings,...(loadedSave?.settings||{})}};
save.settings.quality=clamp(save.settings.quality|0,0,2);
save.settings.fpsLimit=normalizeFpsLimit(save.settings.fpsLimit);
const CAMPAIGN_CHAPTER_SIZE=20, CAMPAIGN_MAX_LEVEL=99999;
function normalizeCampaign(record, legacyBest=1, checkpoint=null){
 const oldUnlocked=clamp(Math.floor(Number(legacyBest)||1),1,CAMPAIGN_MAX_LEVEL);
 const oldCheckpoint=clamp(Math.floor(Number(checkpoint?.sector)||1),1,CAMPAIGN_MAX_LEVEL);
 // Legacy saves tracked the highest visited sector, so all preceding sectors were completed.
 // Existing campaign records supersede legacy best to avoid unlocking levels on a failed attempt.
 const migrated=Math.max(oldUnlocked,oldCheckpoint);
 const found=record&&typeof record==='object'&&Number(record.schema)>=1;
 const done=found?clamp(Math.floor(Number(record.completedThrough)||0),0,CAMPAIGN_MAX_LEVEL-1):Math.max(0,migrated-1);
 const unlocked=found?clamp(Math.max(done+1,Math.floor(Number(record.highestUnlocked)||1)),1,CAMPAIGN_MAX_LEVEL):migrated;
 const records=found&&record.records&&typeof record.records==='object'&&!Array.isArray(record.records)?record.records:{};
 return {schema:1,completedThrough:done,highestUnlocked:unlocked,records,
   totalVictories:Math.max(0,Math.floor(Number(record?.totalVictories)||0)),
   latestCompleted:Math.max(0,Math.floor(Number(record?.latestCompleted)||0))};
}
save.campaign=normalizeCampaign(save.campaign,save.best,save.checkpoint);
let campaignPage=Math.floor((save.campaign.highestUnlocked-1)/CAMPAIGN_CHAPTER_SIZE);
let storageAvailable=true,lastSavedAt=Number(save._savedAt)||0;
function persist(){
 try{
  save._savedAt=Math.max(Date.now(),(Number(save._savedAt)||0)+1);
  const blob=JSON.stringify(save);
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
 if(game&&game.state!=='dead')saveRun();
 const blob=new Blob([JSON.stringify({format:'NEON_RIFT_BACKUP_V3',saved:save,created:new Date().toISOString()},null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='NEON_RIFT_BACKUP_'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4500);
}
const restoreInput=document.createElement('input');restoreInput.type='file';restoreInput.accept='.json,application/json';restoreInput.style.display='none';document.body.append(restoreInput);
restoreInput.addEventListener('change',async()=>{
 const f=restoreInput.files?.[0];if(!f)return;
 try{const payload=JSON.parse(await f.text());const backup=payload?.format==='NEON_RIFT_BACKUP_V3'?payload.saved:payload;
   if(!backup||typeof backup!=='object'||!Array.isArray(backup.perms)||!Number.isInteger(backup.best)||backup.best<1)throw Error('Invalid backup');
   save={...save,...backup,perms:backup.perms.slice(0,4).map(x=>clamp(Number(x)||0,0,8)),settings:{...save.settings,...(backup.settings||{})}};
   save.settings.quality=clamp(save.settings.quality|0,0,2);
   save.settings.fpsLimit=normalizeFpsLimit(save.settings.fpsLimit);
   save.campaign=normalizeCampaign(backup.campaign,backup.best,backup.checkpoint);
   campaignPage=Math.floor((save.campaign.highestUnlocked-1)/CAMPAIGN_CHAPTER_SIZE);
   persist();game=null;saveNotice('СОХРАНЕНИЕ ИМПОРТИРОВАНО');showCampaignMap(campaignPage);
 }catch(e){alert('Не удалось импортировать сохранение. Проверь JSON-файл резервной копии.');}finally{restoreInput.value='';}
});
function wireBackupButtons(){document.querySelectorAll('[data-export-save]').forEach(b=>b.onclick=backupFile);document.querySelectorAll('[data-import-save]').forEach(b=>b.onclick=()=>restoreInput.click());}