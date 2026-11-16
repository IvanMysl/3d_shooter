
(()=>{'use strict';
const $=x=>document.getElementById(x), TAU=Math.PI*2, clamp=(n,a,b)=>Math.max(a,Math.min(b,n)), hypot=Math.hypot, rand=(a,b)=>a+Math.random()*(b-a), pick=a=>a[Math.random()*a.length|0], distance=(a,b)=>hypot(a.x-b.x,a.z-b.z);let game=null, lastFrame=0, deadlock=false;
// Stage32 uses a protected namespace. An already-open Stage31 (or older) page
// still writes its legacy keys, but cannot overwrite this edition's progress.
// Import the legacy journal once; never let a newer legacy write silently
// replace an existing protected journal.
const SAVE_KEY='neonrift3d-save-protected-v1',SAVE_BACKUP_KEY='neonrift3d-save-protected-backup-v1',SAVE_SESSION_KEY='neonrift3d-save-protected-session-v1';
const LEGACY_SAVE_KEY='neonrift3d-save',LEGACY_BACKUP_KEY='neonrift3d-save-backup',LEGACY_SESSION_KEY='neonrift3d-save-session';
const GAME_BUILD='32',GAME_RELEASE='2026-11-16';
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
   if(!backup||typeof backup!=='object'||!Array.isArray(backup.perms)||!Number.isInteger(backup.best)||backup.best<1)throw Error('Invalid backup');
   if(!confirm('Импорт ЗАМЕНИТ текущий прогресс, а не объединит покупки. Сначала экспортируй текущую игру в JSON. Продолжить?'))return;
   const before=save;
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
   if(!persist(true)){
    save=before;campaignPage=Math.floor((save.campaign.highestUnlocked-1)/CAMPAIGN_CHAPTER_SIZE);
    refreshCameraInterface();throw Error('Save storage unavailable after import');
   }
   game=null;saveNotice('СОХРАНЕНИЕ ИМПОРТИРОВАНО');showCampaignMap(campaignPage);
 }catch(e){alert('Не удалось импортировать сохранение. Проверь JSON-файл резервной копии.');}finally{restoreInput.value='';}
});
function wireBackupButtons(){document.querySelectorAll('[data-export-save]').forEach(b=>b.onclick=backupFile);document.querySelectorAll('[data-import-save]').forEach(b=>b.onclick=()=>restoreInput.click());}


const glCanvas=$('gl'),gl=glCanvas.getContext('webgl',{alpha:false,antialias:true,depth:true,stencil:false,powerPreference:'high-performance',premultipliedAlpha:false});if(gl)document.body.classList.add('webgl');let worldMesh=null, worldChunks=[], meshStats={chunks:0,triangles:0}, glReady=!!gl, fallCtx=null;const floorCanvas=document.createElement('canvas'),floorCtx=floorCanvas.getContext('2d');let fBackAt=0;const touchOnly=matchMedia('(hover:none), (pointer:coarse)').matches;const mm=$('minimap').getContext('2d');let legacyResumeSector=-1;let legacyResumeDivisor=12;let mapCells=[], mapSize=55,spawnX=27.5,spawnZ=27.5,portal={x:27.5,z:27.5},mapFeatures=[],mapRooms=[],sectorArchitecture="ЦИТАДЕЛЬ",sectorStyle=0,miniZoom=true,navField=null,navClock=0,portalRouteField=null;const themes=[{name:'ПРОМЫШЛЕННЫЕ РУИНЫ',wall:[.37,.43,.48],accent:[.14,.8,1],floor:[.29,.33,.36],fog:[.018,.029,.045]},{name:'АЛЫЙ РЕАКТОР',wall:[.42,.37,.40],accent:[1,.27,.35],floor:[.30,.27,.29],fog:[.053,.021,.032]},{name:'ЛЕДЯНОЙ УЗЕЛ',wall:[.38,.44,.47],accent:[.35,.82,1],floor:[.30,.35,.39],fog:[.024,.038,.048]},{name:'ТОКСИЧНЫЙ САД',wall:[.40,.43,.36],accent:[.55,.96,.36],floor:[.29,.33,.28],fog:[.031,.046,.031]},{name:'ХРАМ ПУСТОТЫ',wall:[.40,.38,.46],accent:[.76,.44,1],floor:[.30,.27,.34],fog:[.038,.025,.05]},{name:'ЗОЛОТАЯ КУЗНИЦА',wall:[.46,.41,.34],accent:[1,.67,.27],floor:[.33,.30,.26],fog:[.05,.035,.023]},{name:'СТАЛЬНОЙ ШТОРМ',wall:[.32,.38,.44],accent:[.80,.88,.97],floor:[.26,.30,.34],fog:[.015,.023,.038]},{name:'ИЗОЛЯТОР',wall:[.43,.43,.40],accent:[.96,.72,.30],floor:[.34,.33,.30],fog:[.045,.036,.018]},{name:'АБИСС',wall:[.22,.35,.40],accent:[.18,.93,.74],floor:[.18,.28,.32],fog:[.009,.034,.041]},{name:'ОРБИТА',wall:[.35,.32,.46],accent:[.66,.63,1],floor:[.25,.23,.37],fog:[.022,.015,.043]},{name:'КРИСТАЛЛ',wall:[.33,.43,.47],accent:[.46,.95,.99],floor:[.24,.34,.39],fog:[.014,.033,.044]},{name:'ТИТАН',wall:[.46,.38,.32],accent:[1,.61,.27],floor:[.30,.27,.24],fog:[.046,.030,.018]},{name:'ВЕРТИКАЛЬНАЯ ВЕРФЬ',wall:[.37,.43,.45],accent:[.95,.68,.31],floor:[.26,.30,.33],fog:[.023,.033,.036]},{name:'ЛЕСТНИЧНАЯ ЦИТАДЕЛЬ',wall:[.34,.39,.49],accent:[.31,.95,.85],floor:[.25,.29,.37],fog:[.012,.027,.037]},
{name:'ВОЗДУШНЫЙ КОЛЛЕКТОР',wall:[.39,.47,.51],accent:[.25,.83,1],floor:[.28,.33,.38],fog:[.015,.029,.043]},
{name:'ТИТАНОВЫЙ АТРИУМ',wall:[.48,.43,.37],accent:[1,.74,.36],floor:[.33,.30,.27],fog:[.036,.027,.022]},
 {name:'КРИОГЕННЫЙ ШПИЛЬ',wall:[.33,.45,.49],accent:[.34,.96,1],floor:[.26,.35,.39],fog:[.016,.031,.047]},
 {name:'ГРАВИТАЦИОННАЯ ФАБРИКА',wall:[.43,.37,.45],accent:[.90,.48,1],floor:[.30,.26,.32],fog:[.035,.020,.045]}];
function mix(a,b,t){return a.map((v,i)=>v*(1-t)+b[i]*t)}function rcolor(c,m=1){return c.map(x=>x*m)}
const VS=`attribute vec3 aPos;attribute vec3 aNorm;attribute vec3 aCol;attribute float aEmit;uniform mat4 uProj,uView,uModel;uniform vec3 uTint;uniform float uGlow,uTime;varying vec3 vCol,vPos,vNormal,vLocal;varying float vEmit,vLight;void main(){vec4 wp=uModel*vec4(aPos,1.0);vPos=wp.xyz;vLocal=aPos;mat3 M=mat3(uModel);vec3 v=aNorm/vec3(max(dot(M[0],M[0]),.00001),max(dot(M[1],M[1]),.00001),max(dot(M[2],M[2]),.00001));vec3 n=normalize(M*v);vNormal=n;vLight=.5+.5*max(0.,dot(n,normalize(vec3(-.45,1.,.3))));vCol=aCol*uTint;vEmit=aEmit+uGlow;gl_Position=uProj*uView*wp;}`;
const FS=`
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vCol,vPos,vNormal,vLocal;varying float vEmit,vLight;
uniform vec3 uEye,uFog,uAccent,uCamDir,uLampPos[3];
uniform float uTime,uQuality,uShotFlash,uMatOverride,uRobotDamage;
uniform sampler2D uMatAlbedo,uMatNormal;
float sat(float v){return clamp(v,0.,1.);}
float rnd(vec2 v){return fract(sin(dot(v,vec2(127.1,311.7)))*43758.5453);}
vec3 film(vec3 x){x=max(vec3(0.),x);return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
vec3 efficientLight(vec3 albedo,float metal,float rough,vec3 N,vec3 V,vec3 L,vec3 radiance){
 float d=max(dot(N,L),0.);
 vec3 h=normalize(V+L);
 float s=pow(max(dot(N,h),0.),mix(42.,7.,rough));
 return radiance*(albedo*(1.-metal*.52)*d*.55+mix(vec3(.045),albedo,metal)*s*.19);
}
vec3 brdf(vec3 albedo,float metal,float rough,vec3 N,vec3 V,vec3 L,vec3 radiance){
 float ndl=max(dot(N,L),0.),ndv=max(dot(N,V),.001);
 vec3 H=normalize(V+L);float ndh=max(dot(N,H),0.),vdh=max(dot(V,H),0.);
 float a=max(.075,rough*rough),a2=a*a;
 float denom=(ndh*ndh*(a2-1.)+1.);
 float D=a2/(3.14159*denom*denom+.00001);
 float k=(rough+1.)*(rough+1.)/8.;
 float G=ndl/(ndl*(1.-k)+k)*ndv/(ndv*(1.-k)+k);
 vec3 F0=mix(vec3(.04),albedo,metal);
 vec3 F=F0+(1.-F0)*pow(1.-vdh,5.);
 vec3 spec=(D*G*F)/(4.*max(.001,ndl*ndv)+.001);
 return (albedo*(1.-metal)*(1.-F)/3.14159+spec)*radiance*ndl;
}
void main(){
 vec3 geometric=normalize(vNormal),N=geometric,V=normalize(uEye-vPos+vec3(.00001));
 float horizontal=length(vPos.xz-uEye.xz),dist=length(vPos-uEye);
 bool floorMat=geometric.y>.76&&abs(vPos.y)<.11;
 bool ceilMat=geometric.y<-.76;
 bool wallMat=abs(geometric.y)<.26&&vPos.y>.12;
 bool robotMat=uMatOverride>3.5;
 vec2 tileUV=(floorMat||ceilMat)?vPos.xz:(abs(geometric.x)>.58?vPos.zy:vPos.xy);
 float id=uMatOverride>-.5?uMatOverride:(floorMat?1.:(ceilMat?2.:(wallMat?0.:3.)));
 if(robotMat){
  // Stable, mesh-local machining texture: no sliding when the robot walks or rotates.
  tileUV=vec2(vLocal.x+.27*vLocal.z,vLocal.y+.13*vLocal.z)*3.2;
  float luminosity=dot(vCol,vec3(.28,.58,.14));
  id=vEmit>.26?7.:(luminosity<.20?5.:(luminosity>.46?6.:4.));
 }
 vec2 unit=fract(tileUV);
 vec2 atlas=vec2((id+.007+unit.x*.986)*.125,.007+unit.y*.986);
 vec4 tex=texture2D(uMatAlbedo,atlas);
 vec4 bump=texture2D(uMatNormal,atlas);
 vec3 albedo=vCol*mix(vec3(.90),tex.rgb*1.36,.66);
 float rough=clamp(tex.a,.13,.96), metal=wallMat?.73:(floorMat?.64:(ceilMat?.45:.68));
 if(robotMat){
  metal=id<4.5?.82:(id<5.5?.04:(id<6.5?.23:.46));
  rough=clamp(rough*(id<4.5?.79:1.),.19,.93);
 }
 vec2 cell=floor(tileUV);float variation=rnd(cell+id*17.);
 albedo*=.88+.22*variation;
 if(uQuality>.5){
  vec2 bn=bump.rg*2.-1.;
  vec3 T=(floorMat||ceilMat)?vec3(1.,0.,0.):(abs(geometric.x)>.58?vec3(0.,0.,1.):vec3(1.,0.,0.));
  vec3 B=(floorMat||ceilMat)?vec3(0.,0.,1.):vec3(0.,1.,0.);
  N=normalize(geometric+T*bn.x*(robotMat?.27:.52)+B*bn.y*(robotMat?.27:.52));
 }else{rough=max(rough,.37);}
 // Recessed wall joints and slab bevels are darker: simulated crevice occlusion.
 float joint=1.-smoothstep(.013,.065,min(min(unit.x,1.-unit.x),min(unit.y,1.-unit.y)));
 float cavity=bump.b;
 float ao=clamp(1.-.26*joint-.21*(1.-cavity),.46,1.);
 if(wallMat){ao*=mix(.54,1.,smoothstep(.0,.56,vPos.y));}
 if(ceilMat&&!robotMat)ao*=.77;
 if(robotMat){
  // Scratched metallic bevels, soot inside seams and paint chips at critical damage.
  float chip=rnd(floor(vLocal.xy*17.)+floor(vLocal.z*8.)*7.0);
  float wear=smoothstep(.91,.995,chip)*clamp(uRobotDamage,0.,1.);
  albedo=mix(albedo,albedo*.39+vec3(.014),wear*.76);
  rough=mix(rough,.82,wear*.53);
  ao*=.91;
 }
 if(floorMat){
  // Local oily stains are *not* all-over cyan reflections.
  float stain=rnd(floor(tileUV*2.)+31.);
  metal=mix(metal,.84,step(.90,stain)*.55);
  rough*=mix(1.,.63,step(.90,stain)*.7);
 }
 vec3 C=albedo*(.20+max(geometric.y,0.)*.11)*ao;
 // Industrial skylight as broad, cool fill, with warm spill from the far end.
 C+=(uQuality>1.5?brdf(albedo,metal,rough,N,V,normalize(vec3(-.42,.83,.32)),vec3(1.45,1.55,1.65)):efficientLight(albedo,metal,rough,N,V,normalize(vec3(-.42,.83,.32)),vec3(1.43,1.48,1.53)))*.58*ao;
 C+=efficientLight(albedo,metal,rough,N,V,normalize(vec3(.58,.22,-.63)),vec3(.60,.47,.34))*.18*ao;
 // Player's flashlight: narrower pool, naturally falling off at distance.
 vec3 eyeTo=vPos-uEye;
 float cone=dot(normalize(eyeTo+vec3(.0001)),normalize(uCamDir));
 float flash=smoothstep(.84,.97,cone)*1.65/(1.+dist*.26+dist*dist*.024);
 C+=(uQuality>1.5?brdf(albedo,metal,rough,N,V,normalize(-eyeTo+vec3(.0001)),vec3(3.6,3.65,3.45)):efficientLight(albedo,metal,rough,N,V,normalize(-eyeTo+vec3(.0001)),vec3(3.6,3.65,3.45)))*flash;
 // Up to three nearest luminaire positions, warm/cool alternating.
 for(int i=0;i<3;i++){
  if(i==0||uQuality>.5){
   vec3 lp=uLampPos[i]-vPos;float r2=dot(lp,lp);
   vec3 radiance=mix(vec3(1.14,.83,.56),uAccent*1.45,float(i)-2.*floor(float(i)*.5));
   float att=2.3/(1.+r2*.24+r2*r2*.008);
   C+=efficientLight(albedo,metal,rough,N,V,normalize(lp+vec3(.00001)),radiance)*att;
  }
 }
 // Weapon muzzle casts a brief warm flash on nearby walls.
 float flashDist=1.85*max(0.,uShotFlash)/(1.+dist*dist*.49);
 C+=efficientLight(albedo,metal,rough,N,V,normalize(-eyeTo+vec3(.0001)),vec3(4.5,2.15,.64))*flashDist;
 if(robotMat){
  // Tight cool rim light separates a moving armored silhouette from the environment.
  float rim=pow(1.-max(0.,dot(N,V)),3.5);
  C+=mix(vec3(.23,.47,.60),uAccent*.47,.25)*rim*(uQuality<.5?.075:.24);
  float scar=smoothstep(.94,.995,rnd(floor(vLocal.xy*17.)+floor(vLocal.z*8.)*7.0));
  C+=vec3(.75,.09,.025)*scar*uRobotDamage*.07;
 }
 // A few localized light leaks, deliberately weaker than real surface colors.
 float emit=clamp(vEmit,0.,3.);
 C+=vCol*emit*(.82+.10*sin(uTime*1.7+vPos.x*2.));
 // Low-lying industrial dust catches light in distant passages.
 float dust=smoothstep(8.,34.,dist)*(.10+.07*(1.-sat(vPos.y/4.5)));
 C=mix(C,uFog+uAccent*.024,dust);
 float f=smoothstep(18.,47.,horizontal)*.76;
 C=mix(C,uFog+uAccent*.014,f);
 C=film(C*1.23);
 C=pow(C,vec3(.965));
 gl_FragColor=vec4(C,1.);
}`;
// Offline-generated tileable material atlases. Two 1024×256 textures, 4 industrial materials.
// Stored as GPU textures instead of computing expensive noise in every fragment.
let materialAlbedo=null,materialNormals=null;
function makeMaterialAtlases(){
 const W=2048,H=256,T=256,al=new Uint8Array(W*H*4),nm=new Uint8Array(W*H*4);
 let heights=new Float32Array(W*H);
 const rnd=(x,y,k=0)=>{let q=(Math.imul((x+31417)|0,374761393)^Math.imul((y+821+k*173)|0,668265263))|0;
  q=Math.imul(q^(q>>>13),1274126177);return ((q^(q>>>16))>>>0)/4294967295;};
 const clampByte=(x)=>Math.max(0,Math.min(255,Math.round(x)));
 const near=(v,t,w)=>Math.max(0,1-Math.abs(v-t)/w);
 for(let ty=0;ty<H;ty++)for(let tx=0;tx<W;tx++){
  const mat=Math.floor(tx/T),px=tx%T,u=(px+.5)/T,v=(ty+.5)/T;
  const coarse=rnd(px>>4,ty>>4,mat),fine=rnd(px,ty,mat),grain=rnd(px>>1,ty,mat);
  const scuff=(rnd(px>>3,ty>>5,mat)>.962&&(ty+px*3)%13<4)?1:0;
  let h=.60,rough=.6,metal=1,base=0,rr=0,gg=0,bb=0;
  if(mat===0){ // vertical insulated steel cladding, joints and rivets
   const edge=Math.min(u,1-u,v,1-v),gasket=edge<.018,bevel=edge<.054;
   const recess=(u>.105&&u<.895&&v>.19&&v<.82);
   const rib=near(v,.18,.014)+near(v,.815,.014);
   let bolts=(Math.hypot((u<.5?u-.085:u-.915)*12,(v<.5?v-.11:v-.89)*12)<.25)?1:0;
   h=.56+(bevel?.12:0)-(gasket?.24:0)-(recess?.075:0)+rib*.09+bolts*.15;
   base=139+coarse*25+fine*15-scuff*36;
   if(recess)base-=19;
   if(gasket)base-=74;
   if(rib>.1)base+=25;
   if(bolts)base=79;
   rough=.62+coarse*.13+fine*.13-scuff*.20;
   rr=base*.97;gg=base*1.02;bb=base*1.06;
  }else if(mat===1){ // floor armor plates: bevels, inset mesh, bolts, dark oil
   const edge=Math.min(u,1-u,v,1-v),gasket=edge<.015,bevel=edge<.058;
   const inset=(u>.24&&u<.76&&v>.26&&v<.75),grate=inset&&((Math.floor(u*38)%3)===0);
   const dents=rnd(px>>3,ty>>3,mat)>.95;
   h=.58+(bevel?.085:0)-(gasket?.20:0)-(inset?.065:0)-(grate?.12:0)-(dents?.025:0);
   base=119+coarse*20+fine*17-scuff*27;
   if(inset)base-=17;
   if(grate)base-=47;
   if(gasket)base-=76;
   if(bevel&&!gasket)base+=19;
   rough=.40+coarse*.16+fine*.18;
   rr=base*.95;gg=base*1.02;bb=base*1.06;
  }else if(mat===2){ // black suspended ceiling and cable trays
   const rib=(u%0.245)<.04 || (v%0.25)<.033;
   const vent=(u>.15&&u<.84&&v>.2&&v<.84)&&(Math.floor(v*29)%3===0);
   h=.45+(rib?.13:0)-(vent?.11:0);
   base=81+coarse*18+fine*15+(rib?24:0)-(vent?30:0);
   rough=.77+fine*.12;
   rr=base*.98;gg=base*1.02;bb=base*1.04;
  }else if(mat===3){ // gunmetal mechanical metal for pipes, columns, mesh and props
   const stripe=near(u,.18,.026)+near(u,.81,.022);
   const groove=Math.sin(v*220)>0.96;
   h=.50+stripe*.13-(groove?.03:0);
   base=103+coarse*24+fine*16+stripe*27-scuff*28;
   rough=.42+coarse*.20+fine*.18;
   rr=base*.98;gg=base*1.02;bb=base*1.08;
  }else if(mat===4){ // robot armor: brushed titanium, ceramic-coated ridges and machined scars
   const edge=Math.min(u,1-u,v,1-v),seam=edge<.018;
   const brush=(Math.sin(v*760.+u*16.)*.5+.5);
   const mill=(Math.sin(u*65.)*.5+.5),chip=rnd(px>>2,ty>>2,mat)>.971;
   const bracket=near(u,.19,.025)+near(u,.81,.025);
   h=.63+(bracket>.1?.055:0)-(seam?.115:0)-(chip?.036:0)+brush*.012;
   base=164+coarse*14+fine*12+brush*9+mill*4-(seam?42:0)-(chip?57:0);
   rough=.38+coarse*.12+fine*.085+(chip?.18:0);
   rr=base*.99;gg=base*1.025;bb=base*1.04;
  }else if(mat===5){ // robot seals: black polymer bellows and matte carbon joint protectors
   const rib=(Math.sin(v*108.)>.69),groove=(Math.sin(u*48.)>.87);
   h=.45+(rib?.049:0)-(groove?.030:0);
   base=54+coarse*16+fine*9+(rib?11:0)-(groove?10:0);
   rough=.87+fine*.10;
   rr=base*.92;gg=base*.99;bb=base*1.04;
  }else if(mat===6){ // satin ceramic armor and edge-worn white enamel
   const bevel=Math.min(u,1-u,v,1-v)<.055;
   const brush=Math.sin((u+v*.17)*270.)*.5+.5;
   const polish=rnd(px>>4,ty>>3,mat)>.90;
   h=.65+(bevel?.069:0)+brush*.012-(polish?.034:0);
   base=183+coarse*11+fine*11+brush*7+(bevel?12:0)-(polish?30:0);
   rough=.51+coarse*.10+fine*.07;
   rr=base*.99;gg=base*1.005;bb=base*1.02;
  }else{ // optical faceplates / power channels with restrained internal light guides
   const lattice=Math.abs(Math.sin(u*45.)*Math.sin(v*41.));
   const gap=Math.min(u,1-u,v,1-v)<.045;
   h=.53+(lattice>.9?.036:0)-(gap?.07:0);
   base=136+coarse*13+fine*8+(lattice>.9?18:0)-(gap?37:0);
   rough=.21+fine*.08;
   rr=base*.94;gg=base*1.03;bb=base*1.10;
  }
  // Subtle directional abrasion, edge grime and concentrated oil deposits.
  const edgeDist=Math.min(u,1-u,v,1-v);
  const seamDirt=Math.max(0,1-edgeDist*17)*(4+coarse*14);
  const grit=Math.max(0,rnd(px>>2,ty>>2,mat)-.83)*48;
  const scratch=(mat===0||mat===3)?((rnd(px>>5,ty>>1,mat)> .991)?23:0):0;
  const oil=(mat===1&&rnd(px>>4,ty>>4,mat)>.91)?26:0;
  rr-=seamDirt+grit*.78+oil+scratch*.74;
  gg-=seamDirt+grit+oil+scratch;
  bb-=seamDirt+grit+oil+scratch*1.07;
  // Oxide/rust occupies only sparse isolated patches; no random saturated blue tint.
  const rust=Math.max(0,(coarse*.56+rnd(px>>2,ty>>2,mat)*.44-.81))*2.6;
  rr+=rust*52;gg-=rust*15;bb-=rust*31;
  const idx=(ty*W+tx)*4;
  al[idx]=clampByte(rr);al[idx+1]=clampByte(gg);al[idx+2]=clampByte(bb);al[idx+3]=clampByte(rough*255);
  heights[ty*W+tx]=h;
 }
 // Encode small-scale normal perturbation; avoid seams at atlas tile boundaries.
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const tile=x>>8,low=tile<<8,x0=low+((x-low+255)&255),x1=low+((x-low+1)&255);
  const y0=(y+255)&255,y1=(y+1)&255;
  const dx=(heights[y*W+x1]-heights[y*W+x0])*1.3;
  const dy=(heights[y1*W+x]-heights[y0*W+x])*1.3;
  const ii=(y*W+x)*4;
  nm[ii]=clampByte(128-dx*105);nm[ii+1]=clampByte(128-dy*105);nm[ii+2]=clampByte(heights[y*W+x]*255);nm[ii+3]=255;
 }
 function upload(data){const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);return tex;}
 materialAlbedo=upload(al);materialNormals=upload(nm);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,materialAlbedo);
 gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,materialNormals);
 gl.useProgram(program);gl.uniform1i(u.uMatAlbedo,0);gl.uniform1i(u.uMatNormal,1);
 gl.activeTexture(gl.TEXTURE0);
}
let program, u={},bufferWorld,geom={};function shader(t,s){let h=gl.createShader(t);gl.shaderSource(h,s);gl.compileShader(h);if(!gl.getShaderParameter(h,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(h));return h}function initGL(){program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,VS));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,FS));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);for(const k of ['uProj','uView','uModel','uTint','uGlow','uEye','uFog','uTime','uAccent','uCamDir','uLampPos[0]','uQuality','uShotFlash','uMatOverride','uRobotDamage','uMatAlbedo','uMatNormal'])u[k]=gl.getUniformLocation(program,k);for(const k of ['aPos','aNorm','aCol','aEmit'])u[k]=gl.getAttribLocation(program,k);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);bufferWorld=gl.createBuffer();geom.cube=makeCube();geom.bevel=makeChamferedBox();geom.rounded=makeRoundedBox();geom.octa=makeOcta();geom.orb=makeOrb(10,6);geom.spark=makeSparkOrb(8,5);geom.tracer=makeEnergyBeam(10);geom.ring=makeRing(24);geom.pylon=makePylon();geom.cylinder=makeCylinder(12);initRobotFoundry();makeMaterialAtlases();initScreenFx();}
// Horizon gradient and sparse stars are generated on the GPU, with no assets.
const SCREEN_VS=`attribute vec2 aXY;varying vec2 vUV;void main(){vUV=aXY*.5+.5;gl_Position=vec4(aXY,0.,1.);}`;
const SKY_FS=`precision mediump float;varying vec2 vUV;uniform vec3 uTop,uHorizon,uGlowTint;uniform vec2 uLook;uniform float uClock,uAspect;float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){float y=vUV.y-.5+uLook.y*.58;float h=smoothstep(-.30,.72,y);vec3 c=mix(uHorizon,uTop,h);float cloud=sin(vUV.x*13.+sin(vUV.y*12.)*1.7+uClock*.016)*sin(vUV.x*29.-vUV.y*20.);c+=uGlowTint*max(0.,cloud)*.014*(1.-h);vec2 cell=floor(vec2(vUV.x*uAspect,vUV.y)*vec2(480.,270.));float star=step(.99835,hs(cell));star*=smoothstep(.05,.9,y)*(.65+.35*sin(uClock*.9+cell.x));c+=vec3(.35,.52,.65)*star;float haze=exp(-pow(y*6.,2.))*.23;c+=uGlowTint*haze;gl_FragColor=vec4(c,1.);}`;
const POST_FS=`precision mediump float;varying vec2 vUV;uniform sampler2D uScene;uniform vec2 uTexel;uniform float uClock;
float lum(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec3 bright(vec2 offs){vec3 c=texture2D(uScene,clamp(vUV+offs*uTexel,.001,.999)).rgb;float b=max(0.,lum(c)-.64);return c*b;}
void main(){vec3 base=texture2D(uScene,vUV).rgb;
 vec3 glow=bright(vec2(0.,0.))*.16;
 glow+=(bright(vec2(3.,0.))+bright(vec2(-3.,0.))+bright(vec2(0.,3.))+bright(vec2(0.,-3.)))*.10;
 glow+=(bright(vec2(8.,5.))+bright(vec2(-8.,5.))+bright(vec2(8.,-5.))+bright(vec2(-8.,-5.)))*.067;
 vec3 c=base+glow*.52;
 float vg=1.-.20*smoothstep(.22,.8,length((vUV-.5)*vec2(1.,.8)));c*=vg;
 float grain=fract(sin(dot(vUV*vec2(1001.,567.)+uClock*.35,vec2(12.9898,78.233)))*43758.5453);
 c+=(grain-.5)*.006;
 gl_FragColor=vec4(clamp(c,0.,1.),1.);}`;
let skyProgram,postProgram,quadBuffer,skyLoc={},postLoc={},postFbo=null,postTexture=null,postDepth=null,postW=0,postH=0;
function screenProgram(fs){const pr=gl.createProgram();gl.attachShader(pr,shader(gl.VERTEX_SHADER,SCREEN_VS));gl.attachShader(pr,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(pr));return pr;}
function initScreenFx(){skyProgram=screenProgram(SKY_FS);postProgram=screenProgram(POST_FS);quadBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quadBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);for(const k of ['aXY','uTop','uHorizon','uGlowTint','uLook','uClock','uAspect'])skyLoc[k]=k==='aXY'?gl.getAttribLocation(skyProgram,k):gl.getUniformLocation(skyProgram,k);for(const k of ['aXY','uScene','uTexel','uClock'])postLoc[k]=k==='aXY'?gl.getAttribLocation(postProgram,k):gl.getUniformLocation(postProgram,k);}
function screenQuad(location){gl.bindBuffer(gl.ARRAY_BUFFER,quadBuffer);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(location);gl.drawArrays(gl.TRIANGLES,0,6);gl.disableVertexAttribArray(location);}
function backdrop(tt,p,t){if(!skyProgram)return;gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.useProgram(skyProgram);gl.uniform3fv(skyLoc.uTop,tt.fog.map(v=>v*.17));gl.uniform3fv(skyLoc.uHorizon,tt.fog.map(v=>v*1.26));gl.uniform3fv(skyLoc.uGlowTint,tt.accent);gl.uniform2f(skyLoc.uLook,p.yaw,p.pitch);gl.uniform1f(skyLoc.uClock,t);gl.uniform1f(skyLoc.uAspect,glCanvas.width/Math.max(1,glCanvas.height));screenQuad(skyLoc.aXY);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.useProgram(program);}
function ensurePost(){let w=glCanvas.width,h=glCanvas.height;if(postFbo&&postW===w&&postH===h)return true;if(postTexture)gl.deleteTexture(postTexture);if(postDepth)gl.deleteRenderbuffer(postDepth);if(postFbo)gl.deleteFramebuffer(postFbo);postW=w;postH=h;postTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,postTexture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);postDepth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,postDepth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,w,h);postFbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,postFbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,postTexture,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,postDepth);let ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);if(!ok){console.warn('Cinematic postprocessing unavailable');return false}return true;}
function showPost(t){gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,glCanvas.width,glCanvas.height);gl.disable(gl.DEPTH_TEST);gl.useProgram(postProgram);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,postTexture);gl.uniform1i(postLoc.uScene,0);gl.uniform2f(postLoc.uTexel,1/postW,1/postH);gl.uniform1f(postLoc.uClock,t);screenQuad(postLoc.aXY);gl.enable(gl.DEPTH_TEST);gl.useProgram(program);}

function geomBegin(){return []}function addTri(dst,v1,v2,v3,n,c,e=0){for(const v of [v1,v2,v3])dst.push(v[0],v[1],v[2],n[0],n[1],n[2],c[0],c[1],c[2],e)}function quad(dst,a,b,c,d,n,color,e=0){addTri(dst,a,b,c,n,color,e);addTri(dst,a,c,d,n,color,e)}function box(dst,x1,y1,z1,x2,y2,z2,c,e=0,sides=[1,1,1,1,1,1]){if(sides[0])quad(dst,[x1,y1,z2],[x2,y1,z2],[x2,y2,z2],[x1,y2,z2],[0,0,1],c,e);if(sides[1])quad(dst,[x2,y1,z1],[x1,y1,z1],[x1,y2,z1],[x2,y2,z1],[0,0,-1],c,e);if(sides[2])quad(dst,[x1,y1,z1],[x1,y1,z2],[x1,y2,z2],[x1,y2,z1],[-1,0,0],c,e);if(sides[3])quad(dst,[x2,y1,z2],[x2,y1,z1],[x2,y2,z1],[x2,y2,z2],[1,0,0],c,e);if(sides[4])quad(dst,[x1,y2,z2],[x2,y2,z2],[x2,y2,z1],[x1,y2,z1],[0,1,0],c,e);if(sides[5])quad(dst,[x1,y1,z1],[x2,y1,z1],[x2,y1,z2],[x1,y1,z2],[0,-1,0],c,e)}
function toMesh(verts){const v=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,v);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);return {b:v,n:verts.length/10}}function makeCube(){let d=[];box(d,-.5,-.5,-.5,.5,.5,.5,[1,1,1]);return toMesh(d)}function makeOcta(){let d=[],T=[0,.72,0],B=[0,-.72,0],q=[[.6,0,0],[0,0,.6],[-.6,0,0],[0,0,-.6]];for(let i=0;i<4;i++){let a=q[i],b=q[(i+1)%4];let n=[(a[0]+b[0])*.6,.7,(a[2]+b[2])*.6];addTri(d,T,a,b,n,[1,1,1]);addTri(d,B,b,a,[n[0],-.7,n[2]],[1,1,1])}return toMesh(d)}function makeOrb(segs,rings){let d=[];for(let y=0;y<rings;y++){const a=Math.PI*y/rings,b=Math.PI*(y+1)/rings;for(let j=0;j<segs;j++){let t=TAU*j/segs,u=TAU*(j+1)/segs;let P=(phi,th)=>[Math.sin(phi)*Math.cos(th)*.5,Math.cos(phi)*.5,Math.sin(phi)*Math.sin(th)*.5];let p1=P(a,t),p2=P(a,u),p3=P(b,u),p4=P(b,t);let nx=p1[0]+p2[0]+p3[0]+p4[0],ny=p1[1]+p2[1]+p3[1]+p4[1],nz=p1[2]+p2[2]+p3[2]+p4[2],nn=hypot(nx,ny,nz)||1;
quad(d,p1,p2,p3,p4,[nx/nn,ny/nn,nz/nn],[1,1,1])}}return toMesh(d)}function makeRing(n){let d=[];for(let i=0;i<n;i++){let a=i*TAU/n,b=(i+1)*TAU/n;let p=(r,t,y)=>[r*Math.cos(t),y,r*Math.sin(t)];quad(d,p(.48,a,-.03),p(.55,a,-.03),p(.55,b,-.03),p(.48,b,-.03),[0,1,0],[1,1,1]);quad(d,p(.48,a,.03),p(.48,b,.03),p(.55,b,.03),p(.55,a,.03),[0,1,0],[1,1,1])}return toMesh(d)}function makeChamferedBox(){
 let d=[],bevel=.09;
 const outline=[[-.5+bevel,-.5],[.5-bevel,-.5],[.5,-.5+bevel],[.5,.5-bevel],[.5-bevel,.5],[-.5+bevel,.5],[-.5,.5-bevel],[-.5,-.5+bevel]];
 const back=outline.map(p=>[p[0],p[1],-.5]),front=outline.map(p=>[p[0],p[1],.5]);
 for(let i=0;i<8;i++){
  let j=(i+1)%8,a=outline[i],b=outline[j],n=[(a[1]-b[1]),(b[0]-a[0]),0],L=Math.hypot(n[0],n[1]);
  quad(d,back[i],back[j],front[j],front[i],[n[0]/L,n[1]/L,0],[1,1,1]);
 }
 for(let i=1;i<7;i++){addTri(d,front[0],front[i],front[i+1],[0,0,1],[1,1,1]);addTri(d,back[0],back[i+1],back[i],[0,0,-1],[1,1,1]);}
 return toMesh(d);
}
// Real curved bevels instead of the 8-edge extrusion used for minor props.
// Faces, edges and corners share analytic normals; generated ONCE and reused.
// A coarse bevel mesh remains available for distant/mobile animated parts.
function makeRoundedBox(){
 const verts=[],radius=.105,core=.5-radius;
 // Mid-arc samples give a genuinely curved outline, not just interpolated
 // normals on a single planar chamfer (7x7 shared grid per face).
 const mid=core+radius*.5;
 const grid=[-.5,-mid,-core,0,core,mid,.5];
 const sample=(axis,side,u,v)=>{
  const point=axis===0?[side*.5,u,v]:axis===1?[u,side*.5,v]:[u,v,side*.5];
  const clampCore=x=>Math.max(-core,Math.min(core,x));
  const base=point.map(clampCore),d=point.map((a,i)=>a-base[i]);
  const length=Math.hypot(d[0],d[1],d[2])||1;
  return {p:base.map((a,i)=>a+radius*d[i]/length),n:d.map(a=>a/length)};
 };
 const triangle=(a,b,c)=>{
  for(const v of [a,b,c])verts.push(...v.p,...v.n,1,1,1,0);
 };
 for(let axis=0;axis<3;axis++)for(const side of [-1,1]){
  for(let j=0;j<grid.length-1;j++)for(let i=0;i<grid.length-1;i++){
   const a=sample(axis,side,grid[i],grid[j]);
   const b=sample(axis,side,grid[i+1],grid[j]);
   const c=sample(axis,side,grid[i+1],grid[j+1]);
   const d=sample(axis,side,grid[i],grid[j+1]);
   // Winding follows each outward face normal, including the negative sides.
   const outward=(axis===1?-1:1)*side>0;
   if(outward){triangle(a,b,c);triangle(a,c,d)}
   else{triangle(a,c,b);triangle(a,d,c)}
  }
 }
 return toMesh(verts);
}
// Slim, softly tapered energy filaments. The emissive center and slimmer ends
// are baked per vertex: no extra shader passes, sprites, or remote textures.
function makeEnergyBeam(segs=10){
 const verts=[],rings=[[-.5,.08,.08],[-.435,.50,.93],[.435,.50,.93],[.5,.08,.08]];
 const point=(ring,a)=>[ring[1]*Math.cos(a),ring[1]*Math.sin(a),ring[0]];
 const normal=(a,slope)=>{const n=[Math.cos(a),Math.sin(a),-slope],len=Math.hypot(...n)||1;return n.map(x=>x/len)};
 const emit=(p,n,e)=>verts.push(...p,...n,1,1,1,e);
 for(let j=0;j<rings.length-1;j++){
  const r0=rings[j],r1=rings[j+1],slope=(r1[1]-r0[1])/(r1[0]-r0[0]);
  for(let i=0;i<segs;i++){
   const a=i*TAU/segs,b=(i+1)*TAU/segs;
   const p=point(r0,a),q=point(r0,b),r=point(r1,a),s=point(r1,b);
   const n0=normal(a,slope),n1=normal(b,slope);
   emit(p,n0,r0[2]);emit(q,n1,r0[2]);emit(r,n0,r1[2]);
   emit(q,n1,r0[2]);emit(s,n1,r1[2]);emit(r,n0,r1[2]);
  }
 }
 return toMesh(verts);
}
// Small volume sparks with smooth analytical normals. Quality 0 keeps octa LOD.
function makeSparkOrb(segs=8,rings=5){
 const verts=[],sample=(t,p)=>{const x=Math.sin(t)*Math.cos(p),y=Math.cos(t),z=Math.sin(t)*Math.sin(p);return [x,y,z]};
 const add=(p)=>verts.push(p[0]*.5,p[1]*.5,p[2]*.5,...p,1,1,1,.24);
 for(let i=0;i<rings;i++)for(let j=0;j<segs;j++){
  const t0=i*Math.PI/rings,t1=(i+1)*Math.PI/rings,a=j*TAU/segs,b=(j+1)*TAU/segs;
  const p=sample(t0,a),q=sample(t0,b),r=sample(t1,a),s=sample(t1,b);
  if(i!==0){add(p);add(q);add(r)}
  if(i!==rings-1){add(q);add(s);add(r)}
 }
 return toMesh(verts);
}
function makeCylinder(segments=12){
 const d=[],r=.5;
 for(let j=0;j<segments;j++){
   let a=j*TAU/segments,b=(j+1)*TAU/segments;
   const n1=[Math.cos(a),Math.sin(a),0],n2=[Math.cos(b),Math.sin(b),0];
   const A=[r*n1[0],r*n1[1],-.5], B=[r*n2[0],r*n2[1],-.5];
   const C=[r*n2[0],r*n2[1],.5],D=[r*n1[0],r*n1[1],.5];
   addTri(d,A,B,D,n1,[1,1,1]);addTri(d,D,B,C,n2,[1,1,1]);
   addTri(d,[0,0,.5],D,C,[0,0,1],[1,1,1]);
   addTri(d,[0,0,-.5],B,A,[0,0,-1],[1,1,1]);
 }
 return toMesh(d);
}
function makePylon(){let d=[];box(d,-.23,-.5,-.23,.23,.5,.23,[1,1,1]);return toMesh(d)}
const ID=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);let matModel=new Float32Array(16),matView=new Float32Array(16),matProj=new Float32Array(16);function model(x,y,z,sx=1,sy=1,sz=1,rot=0,tilt=0){const c=Math.cos(rot),s=Math.sin(rot),v=Math.cos(tilt),w=Math.sin(tilt);return new Float32Array([sx*c,0,-sx*s,0,sy*s*w,sy*v,sy*c*w,0,sz*s*v,-sz*w,sz*c*v,0,x,y,z,1])}function perspective(fov,aspect,near,far){let f=1/Math.tan(fov/2);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0])}
function lookAt(ex,ey,ez,tx,ty,tz){let z=[ex-tx,ey-ty,ez-tz],zl=hypot(...z)||1;z=z.map(v=>v/zl);let x=[z[2],0,-z[0]],xl=hypot(...x)||1;x=x.map(v=>v/xl);let y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-(x[0]*ex+x[1]*ey+x[2]*ez),-(y[0]*ex+y[1]*ey+y[2]*ez),-(z[0]*ex+z[1]*ey+z[2]*ez),1])}
function draw(mesh,x,y,z,sx,sy,sz,rot,tint,glow=0,tilt=0){if(!mesh)return;gl.bindBuffer(gl.ARRAY_BUFFER,mesh.b);let stride=40;gl.vertexAttribPointer(u.aPos,3,gl.FLOAT,false,stride,0);gl.vertexAttribPointer(u.aNorm,3,gl.FLOAT,false,stride,12);gl.vertexAttribPointer(u.aCol,3,gl.FLOAT,false,stride,24);gl.vertexAttribPointer(u.aEmit,1,gl.FLOAT,false,stride,36);for(const k of ['aPos','aNorm','aCol','aEmit'])gl.enableVertexAttribArray(u[k]);gl.uniformMatrix4fv(u.uModel,false,model(x,y,z,sx,sy,sz,rot,tilt));gl.uniform3fv(u.uTint,tint);gl.uniform1f(u.uGlow,glow);gl.drawArrays(gl.TRIANGLES,0,mesh.n)}function drawWorld(){
if(worldMesh)draw(worldMesh,0,0,0,1,1,1,0,[1,1,1],0);
if(!game)return;
const p=game.p,viewDist=save.settings.quality===0?30:39;
for(const chunk of worldChunks){if(hypot(chunk.x-p.x,chunk.z-p.z)>viewDist+8)continue;
draw(chunk.mesh,0,0,0,1,1,1,0,[1,1,1],0)}
}

// VERTICAL FRONTIER — genuine stair-height terrain, reproducibly generated per sector.
let heightCells=new Float32Array(0), deckCells=new Float32Array(0), stairStages=[], bridgeSpecs=[],skyDeckSpecs=[];
const BRIDGE_Y=2.20, BRIDGE_RISE=.22;
function deckAtCell(x,z){return x>=0&&z>=0&&x<mapSize&&z<mapSize&&deckCells.length?deckCells[z*mapSize+x]||0:0;}
function deckHeight(x,z){return deckAtCell(Math.floor(x),Math.floor(z));}
function supportHeight(a,x,z){
 const ground=floorHeight(x,z), deck=deckHeight(x,z);
 if(!deck)return ground;
 const feet=Number.isFinite(a?.feetY)?a.feetY:ground;
 return feet>=deck-.28?deck:ground;
}
// The four sky-shipyard world families have a genuinely tall atrium.
function ceilingHeight(){return sectorStyle>=14?15.0:4.25;}
const STAIR_RISE=.215, JUMP_VELOCITY=4.8, JUMP_GRAVITY=13.6;
const FLIGHT_SPEED=4.4;
// The solid player body (helmet plus torso). Very thin suit antennas are visual.
const PLAYER_SOLID_HEIGHT=1.95;
function floorHeightAtCell(x,z){
 if(x<0||z<0||x>=mapSize||z>=mapSize||!heightCells.length)return 0;
 return heightCells[z*mapSize+x]||0;
}
function floorHeight(x,z){return floorHeightAtCell(Math.floor(x),Math.floor(z));}
function makeStairHeights(level){
 heightCells=new Float32Array(mapSize*mapSize);deckCells=new Float32Array(mapSize*mapSize);stairStages=[];bridgeSpecs=[];skyDeckSpecs=[];
 const centre=Math.floor(mapSize/2), boss=level%5===0;
 // Every sector has one raised central deck; certain layouts add side decks.
 function stage(cx,cz,radius,maxSteps=4){
  cx=Math.floor(cx);cz=Math.floor(cz);
  if(mapCells[cz]?.[cx]!==0)return false;
  const needs=[];let validCells=0;
  for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
   let x=cx+dx,z=cz+dz;
   if(x<2||z<2||x>=mapSize-2||z>=mapSize-2||mapCells[z][x]!==0)continue;
   validCells++;
   const d=Math.max(Math.abs(dx),Math.abs(dz));
   const steps=Math.min(maxSteps,Math.max(0,radius-d));
   if(steps>0)needs.push({x,z,h:steps*STAIR_RISE});
  }
  if(validCells < (2*radius+1)**2*.79)return false;
  for(const t of needs)heightCells[t.z*mapSize+t.x]=Math.max(heightCells[t.z*mapSize+t.x],t.h);
  stairStages.push({x:cx+.5,z:cz+.5,radius,top:Math.min(maxSteps,radius)*STAIR_RISE});
  return true;
 }
 if(sectorStyle<14)stage(centre,centre,boss?9:6,4);
 // Secondary decks appear in chamber-rich levels, as well as in two new worlds.
 const extra=(level%4===0||level%4===2)?1:2;
 let made=0;
 for(let i=1;i<mapRooms.length&&made<extra;i++){
  const r=mapRooms[(i*5+level)%mapRooms.length];
  if(!r||r.w<9||r.h<9||Math.hypot(r.x-centre,r.z-centre)<(sectorStyle>=14?20:12))continue;
  if(stage(r.x-.5,r.z-.5,Math.min(4,Math.floor(Math.min(r.w,r.h)/2)-1),3))made++;
 }
 // A true two-level overpass: ground traffic can pass under the deck, while
 // players and enemies ascend two ten-step stair flights to the upper floor.
 // The deck is separate from heightCells, preserving the lower passage.
 if(sectorStyle>=14){
  const c=Math.floor(mapSize/2), width=2, halfLen=sectorStyle===15?7:5;
  for(let z=c-halfLen;z<=c+halfLen;z++)for(let x=c-3;x<=c+3;x++){
   if(mapCells[z]?.[x]===0)deckCells[z*mapSize+x]=BRIDGE_Y;
  }
  for(const side of [-1,1])for(let i=0;i<10;i++){
   const x=c+side*(4+i), h=(10-i)*BRIDGE_RISE;
   for(let z=c-width;z<=c+width;z++){
    if(mapCells[z]?.[x]===0)heightCells[z*mapSize+x]=h;
   }
  }
  bridgeSpecs.push({x:c+.5,z:c+.5, y:BRIDGE_Y, width:7,length:halfLen*2+1,stairRun:10,underpass:true});
  stairStages.push({x:c+.5,z:c+.5,radius:14,top:BRIDGE_Y,kind:'overpass'});
  // Two truly airborne 3×3 maintenance platforms. Reachable by flight;
  // ordinary stairs/ground navigation do not magically climb to their height.
  for(let i=0;i<mapRooms.length&&skyDeckSpecs.length<2;i++){
   const room=mapRooms[(i*3+level)%mapRooms.length];
   if(!room||room.w<8||room.h<8)continue;
   const cx=Math.floor(room.x-.5),cz=Math.floor(room.z-.5);
   if(Math.hypot(cx-c,cz-c)<10)continue;
   let clear=true;
   for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
    const x=cx+dx,z=cz+dz;
    if(mapCells[z]?.[x]!==0||deckAtCell(x,z)>0||floorHeightAtCell(x,z)>.3)clear=false;
   }
   if(!clear)continue;
   const altitude=7.25+skyDeckSpecs.length*1.5;
   for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)deckCells[(cz+dz)*mapSize+(cx+dx)]=altitude;
   skyDeckSpecs.push({x:cx+.5,z:cz+.5,y:altitude,radius:1});
  }
 }
}
// Keep ordinary movement unchanged while preventing a long low-FPS frame or
// a dash step from jumping over a thin handrail or an entire wall tile.
// Each short microstep preserves the original X-then-Z slide behavior.
function tryMoveEntity(a,dx,dz,r=.23){
 if(!Number.isFinite(dx)||!Number.isFinite(dz))return;
 const player=!!game&&a===game.p;
 const enemy=!player&&!!a.maxhp&&(!!a.type||a.boss);
 const length=Math.hypot(dx,dz);
 const steps=Math.max(1,Math.ceil(length/Math.max(.13,r*.72)));
 const sx=dx/steps,sz=dz/steps;
 for(let i=0;i<steps;i++){
  const feet=Number.isFinite(a.feetY)?a.feetY:floorHeight(a.x,a.z);
  const permit=(x,z)=>{
   // X and Z slide independently. Crossing X may change the grounded
   // operator's foot level before Z is considered in this same microstep.
   const currentFeet=player&&Number.isFinite(a.feetY)?a.feetY:feet;
   const raised=enemy&&a.airborne?feet:supportHeight(a,x,z);
   if(collide(x,z,r)||
      (enemy&&a.airborne?feet<floorHeight(x,z)+.12:raised>currentFeet+.245))return false;
   // A normal stair is <= .245 m high. Test body clearance at the height
   // the grounded operator will actually occupy after stepping onto it.
   // Testing with the PREVIOUS foot height can mistake a traversable riser
   // for a chest-high obstacle, especially when a tread borders a rail.
   if(player)return !worldSolidBodyCollision(x,z,r,Math.max(currentFeet,raised),PLAYER_SOLID_HEIGHT);
   if(enemy)return !worldSolidBodyCollision(x,z,r,Math.max(feet,raised),enemyBodyHeight(a)) &&
     (typeof enemyCrowdAllows!=='function'||enemyCrowdAllows(a,x,z,r));
   return true;
  };
  // Player support must follow accepted microsteps, not just the final
  // frame. Otherwise a sprint/low-FPS frame can climb the first 0.215 m
  // tread and then reject every higher tread against stale feetY=0.
  const settleStair=()=>{
   if(!player||!a.grounded)return;
   const support=supportHeight(a,a.x,a.z),delta=support-a.feetY;
   if(Math.abs(delta)<=.245)a.feetY=support;
  };
  if(permit(a.x+sx,a.z)){a.x+=sx;settleStair();}
  if(permit(a.x,a.z+sz)){a.z+=sz;settleStair();}
  if(!player&&!(enemy&&a.airborne))a.feetY=supportHeight(a,a.x,a.z);
 }
}
function queueJump(){if(game?.state==='playing'&&!arsenalOpened)input.jumpQueued=true;}
function toggleFlight(){
 if(!game||game.state!=='playing'||arsenalOpened)return false;
 const p=game.p;
 if(!p.flightUnlocked){toast('ПОЛЁТ: КОСТЮМ №10–16 ИЛИ УЛУЧШЕНИЕ LVL 10',1.4);return false;}
 p.flying=!p.flying;
 p.vy=0;if(p.flying){p.grounded=false;input.jumpQueued=false;}
 if(typeof refreshFlightButtons==='function')refreshFlightButtons();
 toast(p.flying?'ПОЛЁТ ВКЛ · SPACE ↑ · SHIFT ↓':'ПОЛЁТ ВЫКЛ',1.5);
 return p.flying;
}
function updateVertical(p,dt){
 const terrain=supportHeight(p,p.x,p.z);
 const beam=typeof worldSolidStandingSupport==='function'?
  worldSolidStandingSupport(p.x,p.z,.23,p.feetY):null;
 const floor=beam===null?terrain:Math.max(terrain,beam);
 const deck=deckHeight(p.x,p.z);
 if(!Number.isFinite(p.feetY)){p.feetY=floor;p.grounded=true;p.vy=0;}
 if(p.flying&&!p.flightUnlocked)p.flying=false;
 if(p.flying){
  const ascend=!!(input.flyUp||input.keys?.Space);
  const descend=!!(input.flyDown||input.keys?.ShiftLeft||input.keys?.ShiftRight||input.keys?.ControlLeft||input.keys?.ControlRight);
  const direction=Number(ascend)-Number(descend);
  const before=p.feetY,maxFeet=Math.max(floor,ceilingHeight()-PLAYER_SOLID_HEIGHT-.2);
  const flightVerticalSpeed=FLIGHT_SPEED*flightSpeedMultiplier('vertical')*normalizeFlightThrottle(save.settings.flightVertical);
  let after=clamp(before+direction*flightVerticalSpeed*dt,floor,maxFeet);
  if(after>before){
   const fromHead=before+PLAYER_SOLID_HEIGHT,toHead=after+PLAYER_SOLID_HEIGHT;
   if(deck>0&&fromHead<=deck-.17+.001&&toHead>deck-.17)after=Math.min(after,deck-.17-PLAYER_SOLID_HEIGHT-.004);
   if(glReady){const bar=worldSolidHeadBarrier(p.x,p.z,.23,fromHead,toHead);
    if(bar!==null)after=Math.min(after,bar-PLAYER_SOLID_HEIGHT-.004);}
  }else if(after<before&&glReady){
   const roof=worldSolidFeetBarrier(p.x,p.z,.23,before,after);
   if(roof!==null)after=Math.max(after,roof+.004);
  }
  p.feetY=clamp(after,floor,maxFeet);p.vy=0;
  p.grounded=p.feetY<=floor+.003;
  input.jumpQueued=false;
  return;
 }
 if(p.grounded){
  if(floor<=p.feetY+.24 && p.feetY-floor<=.245)p.feetY=floor;
  else if(floor<p.feetY-.245){p.grounded=false;p.vy=0;}
  else p.feetY=Math.max(p.feetY,floor);
 }
 // Keyboard-held Space queues a new jump on every landing; touch remains a
 // one-shot tap until a later input-mode revision explicitly changes it.
 if(input.jumpHeld&&p.grounded&&game?.state==='playing'&&!arsenalOpened)input.jumpQueued=true;
 if(input.jumpQueued){
  input.jumpQueued=false;
  if(p.grounded){p.grounded=false;p.vy=JUMP_VELOCITY;p.feetY+=.008;
   if(save.settings.audio)sound(250,.09,'triangle',.045);
  }
 }
 if(!p.grounded){
  p.vy-=JUMP_GRAVITY*dt;
  const prevY=p.feetY;
  p.feetY+=p.vy*dt;
  // The bridge plate occupies [deck-.17,deck]; the entire player body,
  // not just the feet, must stay below its underside when passing under it.
  const lowerDeckLimit=deck-.17-PLAYER_SOLID_HEIGHT;
  if(deck>0 && prevY<=lowerDeckLimit+.001 && p.vy>0 && p.feetY>lowerDeckLimit){
   p.feetY=Math.max(0,lowerDeckLimit-.004);p.vy=0;
  }
  // Suspended metal signs, gantries and crossbars also stop upward movement.
  if(p.vy>0 && glReady){
   const underside=worldSolidHeadBarrier(p.x,p.z,.23,
     prevY+PLAYER_SOLID_HEIGHT,p.feetY+PLAYER_SOLID_HEIGHT);
   if(underside!==null){p.feetY=Math.max(prevY,underside-PLAYER_SOLID_HEIGHT-.004);p.vy=0;}
  }
  if(p.vy<0 && glReady){
   const landing=worldSolidFeetBarrier(p.x,p.z,.23,prevY,p.feetY);
   if(landing!==null){p.feetY=Math.max(p.feetY,landing+.004);p.vy=0;p.grounded=true;}
  }
  if(p.feetY<=floor){
   const impact=Math.max(0,-p.vy);
   p.feetY=floor;p.vy=0;p.grounded=true;
   if(impact>3.1)burst(p.x,floor+.06,p.z,[.46,.73,.76],4);
  }
 }
 const maximum=Math.max(floor,ceilingHeight()-PLAYER_SOLID_HEIGHT-.2);
 if(p.feetY>maximum){p.feetY=maximum;p.vy=Math.min(0,p.vy);}
}
function isWall(x,z){let ix=Math.floor(x),iz=Math.floor(z);return ix<0||iz<0||ix>=mapSize||iz>=mapSize||mapCells[iz][ix]===1}function collide(x,z,r=.22){return isWall(x-r,z-r)||isWall(x+r,z-r)||isWall(x-r,z+r)||isWall(x+r,z+r)}function moveEntity(a,dx,dz,r=.23){tryMoveEntity(a,dx,dz,r)}function lineClear(x,z,X,Z){let dx=X-x,dz=Z-z,n=Math.ceil(hypot(dx,dz)*5);for(let i=1;i<n;i++){let t=i/n;if(isWall(x+dx*t,z+dz*t))return false}return true}

// A central safe hub, linked combat chambers and alternative routes. Every
// generated room is reachable; decorative objects never obstruct collision cells.
// MEGAWORLD: seeded sectors, five spatial blueprints, navigable halls and routes.
function buildMap(level){
  mapSize=55+8*Math.min(2,Math.floor((level-1)/6));
  const center=Math.floor(mapSize/2),boss=level%5===0;
  let seed=(Math.imul(level,2654435761) ^ 0x75931c5b)>>>0;
  const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const irand=(lo,hi)=>lo+Math.floor(rng()*(hi-lo+1));
  const m=Array.from({length:mapSize},()=>Array(mapSize).fill(1));
  const rooms=[];
  sectorStyle=(level===legacyResumeSector?(level-1)%legacyResumeDivisor:(level-1)%18);
  sectorArchitecture=['ЦИТАДЕЛЬ','РЕАКТОРНЫЕ КОЛЬЦА','ХРАМ ПЕРЕХОДОВ','НЕБЕСНЫЕ ДОКИ','АРХИВ ЛАБИРИНТОВ','ГРУЗОВЫЕ ВЕРФИ','КАРАНТИННЫЙ КОМПЛЕКС','ЗАТОПЛЕННЫЙ ТРАНЗИТ','ЗВЁЗДНАЯ ОБСЕРВАТОРИЯ','ПОДЗЕМНОЕ МЕТРО','КРИСТАЛЬНАЯ ГАВАНЬ','ТИТАНОВАЯ КУЗНЯ','ВЕРТИКАЛЬНАЯ ВЕРФЬ','ЛЕСТНИЧНАЯ ЦИТАДЕЛЬ','ВОЗДУШНЫЙ КОЛЛЕКТОР','ТИТАНОВЫЙ АТРИУМ','КРИОГЕННЫЙ ШПИЛЬ','ГРАВИТАЦИОННАЯ ФАБРИКА'][sectorStyle];
  function carve(x,z,r=0){for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){
    let xx=x+dx,zz=z+dz;
    if(xx>1&&zz>1&&xx<mapSize-2&&zz<mapSize-2)m[zz][xx]=0;
  }}
  function rect(x,z,w,h){for(let j=z;j<z+h;j++)for(let i=x;i<x+w;i++)carve(i,j)}
  function road(a,b,wide=1,reverse=false){
    let horizontalFirst=reverse?false:(((a.x*17+a.z*11+b.x*7+level)%3)!==0);
    if(horizontalFirst){for(let x=Math.min(a.x,b.x);x<=Math.max(a.x,b.x);x++)carve(x,a.z,wide);for(let z=Math.min(a.z,b.z);z<=Math.max(a.z,b.z);z++)carve(b.x,z,wide)}
    else{for(let z=Math.min(a.z,b.z);z<=Math.max(a.z,b.z);z++)carve(a.x,z,wide);for(let x=Math.min(a.x,b.x);x<=Math.max(a.x,b.x);x++)carve(x,b.z,wide)}
  }
  const hub={x:center,z:center};
  rect(center-(boss?11:6),center-(boss?11:6),boss?23:13,boss?23:13);
  rooms.push(hub);
  if(sectorStyle>=14)rect(center-16,center-16,33,33); // guaranteed safe two-floor transit hub
  // Ten genuinely different spatial blueprints. Alternate routes are always
  // carved into the same connected cell grid used by AI and projectile tracing.
  const count=12,ringR=(mapSize-1)*.34;
  let anchors=[];
  const chamber=(x,z,w=9,h=9)=>{
    x=clamp(Math.round(x),6,mapSize-7);z=clamp(Math.round(z),6,mapSize-7);
    const p={x,z,w,h};anchors.push(p);
    rect(x-Math.floor(w/2),z-Math.floor(h/2),w,h);rooms.push(p);
    return p;
  };
  if(sectorStyle<5){
    // Original circular citadel network; each variant has its own cross links.
    for(let k=0;k<count;k++){
      const a=k*TAU/count-Math.PI/2,r=ringR+irand(-2,2);
      chamber(center+Math.cos(a)*r+irand(-2,2),center+Math.sin(a)*r+irand(-2,2),irand(7,11),irand(7,11));
    }
    anchors.forEach((p,k)=>{
      road(p,hub,sectorStyle===0||boss?2:1);
      if(k%2===0||sectorStyle!==4)road(p,anchors[(k+1)%count],sectorStyle===1?2:1);
      if(sectorStyle===3&&k%3===0)road(p,anchors[(k+3)%count],1,true);
    });
  }else if(sectorStyle===5){
    // CARGO SHIPYARD: two rows of long rectangular hangars; broad freight
    // corridors, transverse gantries and a central transport spine.
    for(const side of [-1,1])for(let i=0;i<5;i++){
      const x=7+i*(mapSize-14)/4,z=center+side*(mapSize*.26);
      chamber(x,z,8,11);
    }
    rect(center-2,5,5,mapSize-10);
    rect(5,center-2,mapSize-10,5);
    anchors.forEach((p,k)=>{road(p,{x:p.x,z:center},2);road({x:p.x,z:center},hub,2);
      if(k%5!==4)road(p,anchors[k+1],1);
    });
  }else if(sectorStyle===6){
    // QUARANTINE LAB: four large isolated research wings connected by
    // pressurised access tunnels and smaller decontamination chambers.
    const span=mapSize*.29;
    for(const [dx,dz] of [[-span,-span],[span,-span],[span,span],[-span,span]]){
      const r=chamber(center+dx,center+dz,13,13);
      road(hub,r,1); // Narrow sterilisation corridors.
      chamber(r.x+(dx<0?3:-3),r.z+(dz<0?3:-3),5,5);
    }
    for(let k=0;k<4;k++)road(anchors[2*k],anchors[(2*((k+1)%4))],1,k%2===0);
    for(let k=0;k<4;k++){let p=anchors[k*2];rect(p.x-2,p.z-2,5,5);}
  }else if(sectorStyle===7){
    // FLOODED TRANSIT: winding channel with lateral pumping-station chambers.
    const left=7,right=mapSize-8;
    let last=hub;
    for(let i=0;i<11;i++){
      const u=i/10,x=left+(right-left)*u;
      const z=center+Math.sin(i*1.16)*(mapSize*.23);
      const p=chamber(x,z,(i%3===0?11:7),(i%3===0?10:8));
      road(last,p,i%3===0?2:1,i%2===0);last=p;
      if(i>2&&i%3===0)road(p,anchors[i-3],1,true);
    }
    road(last,hub,1,true);
    rect(center-3,center-3,7,7);
  }else if(sectorStyle===8){
    // OBSERVATORY: concentric viewing decks with radial routes and a central
    // telescope nave. Distinct loops create several ways around obstacles.
    for(let ring=0;ring<2;ring++){
      const radius=ring===0?mapSize*.21:mapSize*.36;
      for(let k=0;k<8;k++){
        const a=k*TAU/8+(ring?Math.PI/8:0);
        chamber(center+Math.cos(a)*radius,center+Math.sin(a)*radius,ring?8:7,ring?8:7);
      }
    }
    for(let ring=0;ring<2;ring++)for(let k=0;k<8;k++){
      const p=anchors[ring*8+k];
      road(p,anchors[ring*8+(k+1)%8],1);
      if(ring===0)road(p,hub,1);
      else road(p,anchors[k],1,true);
    }
    rect(center-8,center-4,17,9);
  }else if(sectorStyle===10){
    // CRYSTAL HARBOR: two transverse harbor lanes, four quay decks,
    // loop bridges around water channels, plus maintenance slips.
    rect(5,center-2,mapSize-10,5);rect(center-2,5,5,mapSize-10);
    for(let side of [-1,1])for(let k=0;k<5;k++){
      const xx=8+k*(mapSize-16)/4, zz=center+side*mapSize*.28;
      const p=chamber(xx,zz,10,k%2===0?9:12);
      road(p,{x:p.x,z:center},1,k%2===0);
      if(k>0)road(p,anchors[anchors.length-2],1,true);
    }
    for(let u=0;u<4;u++){
      const x=8+u*(mapSize-16)/3;
      rect(Math.floor(x)-1,8,3,mapSize-16);
    }
  }else if(sectorStyle===11){
    // TITANIUM FORGE: concentric rectangular furnace rings,
    // cross-shaped slag channels and broad service bypasses.
    for(let radius=9;radius<mapSize*.44;radius+=9){
      const r=Math.round(radius);
      for(const side of [-1,1])for(let k=-1;k<=1;k++){
        const p=chamber(center+k*r*.74,center+side*r,8,8);
        road(p,{x:center,z:center+side*r},2,k%2===0);
      }
      rect(center-r,center-r,2*r+1,3);rect(center-r,center+r-2,2*r+1,3);
      rect(center-r,center-r,3,2*r+1);rect(center+r-2,center-r,3,2*r+1);
    }
    rect(center-2,4,5,mapSize-8);rect(4,center-2,mapSize-8,5);
  }else if(sectorStyle===12){
    // VERTICAL SHIPYARD: freight chambers connected with a spine and
    // raised gantries / accessible stair decks in the later elevation pass.
    rect(center-3,5,7,mapSize-10);
    for(let k=0;k<4;k++){
      const zz=10+k*(mapSize-20)/3;
      for(const side of [-1,1]){
        const r=chamber(center+side*(mapSize*.27),zz,11,11);
        road(r,{x:center,z:zz},2,k%2===0);
        if(k>0)road(r,anchors[anchors.length-3],1,true);
      }
    }
    rect(7,center-2,mapSize-14,5);
  }else if(sectorStyle===13){
    // STAIRKEEP: monumental central amphitheatre plus paired stair landings.
    rect(center-10,center-10,21,21);
    for(let ring=0;ring<2;ring++){
      const radius=ring===0?mapSize*.24:mapSize*.37;
      for(let k=0;k<8;k++){
        const angle=k*TAU/8+(ring?Math.PI/8:0);
        chamber(center+Math.cos(angle)*radius,center+Math.sin(angle)*radius,11,11);
      }
    }
    anchors.forEach((r,k)=>{
      road(r,k<8?hub:anchors[k-8],2,k%2===0);
      road(r,anchors[(k<8?0:8)+((k+1)%8)],1);
    });
    rect(center-3,4,7,mapSize-8);
  }else if(sectorStyle===14){
    // SKY COLLECTOR: a giant open industrial crossing, two wide service
    // boulevards, elevated central tram bridge and 12 distribution galleries.
    rect(center-3,4,7,mapSize-8);
    rect(4,center-3,mapSize-8,7);
    for(let k=0;k<6;k++)for(const side of [-1,1]){
      const x=7+k*(mapSize-14)/5,z=center+side*(mapSize*.34);
      const p=chamber(x,z,9+(k%2)*2,10);
      road(p,{x:p.x,z:center},2,k%2===0);
      if(k>0)road(p,anchors[anchors.length-3],1,true);
    }
    for(let i=0;i<3;i++){
      const zz=7+i*(mapSize-14)/2;
      rect(center-13,Math.round(zz)-1,27,3);
    }
  }else if(sectorStyle===15){
    // TITANIUM ATRIUM: oversized concentric reactor sanctum with two
    // service rings, intersecting ramps and a walkable upper inspection deck.
    rect(center-18,center-9,37,19);
    for(let ring=0;ring<2;ring++)for(let k=0;k<8;k++){
      const a=k*TAU/8+(ring?Math.PI/8:0);
      const r=ring?mapSize*.37:mapSize*.27;
      const p=chamber(center+Math.cos(a)*r,center+Math.sin(a)*r,11,11);
      road(p,ring?anchors[k]:hub,2,k%2===0);
      if(k>0)road(p,anchors[ring*8+((k+7)%8)],1);
    }
    rect(center-2,4,5,mapSize-8);
    rect(4,center-2,mapSize-8,5);
  }else if(sectorStyle===16){
    // CRYOGENIC SPIRE: a long insulated transport shaft, staggered cold
    // chambers and transverse bypasses with a south-to-north main passage.
    rect(center-2,4,5,mapSize-8);
    for(let k=0;k<7;k++){
      const z=6+k*(mapSize-12)/6;
      const side=(k%2===0?-1:1),span=mapSize*.28;
      const r=chamber(center+side*span,z,9,11);
      road(r,{x:center,z:r.z},1,k%2===0);
      // Alternate compression chambers on the opposite side.
      const other=chamber(center-side*span*.75,z+((k%3)-1)*2,7,7);
      road(other,{x:center,z:other.z},1,k%2!==0);
      if(k>0){road(r,anchors[(k-1)*2],1,true);road(other,anchors[(k-1)*2+1],1,false);}
    }
    // Two wide cross-decks break the uniform corridor silhouette.
    rect(5,center-8,mapSize-10,3);
    rect(5,center+6,mapSize-10,3);
  }else if(sectorStyle===17){
    // GRAVITY FACTORY: an expanding spiral of industrial halls with
    // occasional cross-cuts back to the core and multiple loop bypasses.
    let prev=hub;
    for(let k=0;k<15;k++){
      const angle=k*TAU/4.8+.28,rr=6+1.15*k;
      const r=chamber(center+Math.cos(angle)*rr,center+Math.sin(angle)*rr,8+(k%3),9+(k%2));
      road(prev,r,1+(k%4===0?1:0),k%2===0);
      if(k%4===2)road(hub,r,1,true);
      if(k>=5&&k%5===0)road(r,anchors[k-5],1,k%2!==0);
      prev=r;
    }
    road(prev,hub,2,true);
    // Massive service quadrants with central magnetic stabilizer.
    rect(center-3,center-3,7,7);
    rect(5,center-2,mapSize-10,5);
  }else{
    // UNDERGROUND METRO: one long underground boulevard with platform
    // pairs, lateral tunnels and multiple bypasses at station ends.
    rect(center-3,4,7,mapSize-8);
    for(let i=0;i<5;i++){
      const z=7+i*(mapSize-14)/4;
      for(const side of [-1,1]){
        const p=chamber(center+side*(mapSize*.27),z,12,7);
        road(p,{x:center,z:p.z},2,i%2===0);
      }
    }
    for(let i=0;i<4;i++){
      road(anchors[2*i],anchors[2*i+2],1);
      road(anchors[2*i+1],anchors[2*i+3],1,true);
    }
    rect(4,center-2,mapSize-8,5);
  }
  // Service alcoves and optional second loops increase traversable area.
  for(let k=0;k<(sectorStyle<5?10:5)+(mapSize-55)/4;k++){
    const r=irand(3,mapSize-9),z=irand(3,mapSize-9);
    let w=irand(4,7),h=irand(4,7);
    rect(r,z,w,h);
    const p={x:r+Math.floor(w/2),z:z+Math.floor(h/2),w,h};
    const nearest=anchors.slice().sort((a,b)=>hypot(a.x-p.x,a.z-p.z)-hypot(b.x-p.x,b.z-p.z))[0];
    road(p,nearest,sectorStyle===4?1:2);rooms.push(p);
  }
  // Tall boss amphitheatre; wide approaches to avoid combat bottlenecks.
  if(boss){rect(center-11,center-11,23,23);anchors.forEach(p=>road(hub,p,2));}
  // Distributed navigable cover. Never place walls in protected hub corridors.
  const candidates=[];
  for(let k=0;k<anchors.length;k++){
    let p=anchors[k];candidates.push([p.x+((k&1)?2:-2),p.z+((k%3)?2:-2)]);
  }
  if(boss)for(const dx of [-8,8])for(const dz of [-8,8])candidates.push([center+dx,center+dz]);
  const covers=[];
  for(let [x,z] of candidates){
    if(x<3||z<3||x>=mapSize-3||z>=mapSize-3||m[z][x]!==0)continue;
    if(hypot(x-center,z-center)<7)continue;
    const clearAround=[[1,0],[-1,0],[0,1],[0,-1]].every(([dx,dz])=>m[z+dz]?.[x+dx]===0);
    if(!clearAround)continue;
    m[z][x]=1; covers.push([x,z]);
  }
  function reachable(){
    let q=[[center,center]],head=0,visited=new Uint8Array(mapSize*mapSize);
    visited[center*mapSize+center]=1;
    while(head<q.length){let [x,z]=q[head++];for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const X=x+dx,Z=z+dz,key=Z*mapSize+X;
      if(X<0||Z<0||X>=mapSize||Z>=mapSize||m[Z][X]||visited[key])continue;
      visited[key]=1;q.push([X,Z]);
    }}
    for(let z=0;z<mapSize;z++)for(let x=0;x<mapSize;x++)if(!m[z][x]&&!visited[z*mapSize+x])return false;
    return true;
  }
  if(!reachable()){for(const [x,z] of covers)m[z][x]=0;}
  mapCells=m;spawnX=center+.5;spawnZ=center+.5;
  // Portal is anchored in a reachable chamber (not randomly inside a wall).
  // For maze-like layouts use real walking distance rather than straight lines.
  const dist=new Int16Array(mapSize*mapSize);dist.fill(-1);
  const queue=new Int32Array(mapSize*mapSize);let front=0,back=0;
  const st=center*mapSize+center;dist[st]=0;queue[back++]=st;
  while(front<back){const q=queue[front++],x=q%mapSize,z=(q/mapSize)|0;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const X=x+dx,Z=z+dz,k=Z*mapSize+X;
      if(X<1||Z<1||X>=mapSize-1||Z>=mapSize-1||m[Z][X]||dist[k]>=0)continue;
      dist[k]=dist[q]+1;queue[back++]=k;
    }
  }
  const far=anchors.filter(p=>m[p.z]?.[p.x]===0).sort((a,b)=>dist[b.z*mapSize+b.x]-dist[a.z*mapSize+a.x])[0]||hub;
  portal={x:far.x+.5,z:far.z+.5};
  mapRooms=rooms.map(r=>({x:r.x+.5,z:r.z+.5,w:r.w||13,h:r.h||13}));
  mapFeatures=anchors.filter((r,k)=>k%2===0).map((p,k)=>({x:p.x+.5,z:p.z+.5,kind:k%3,phase:k*1.7}));
  mapFeatures.push({x:spawnX,z:spawnZ,kind:3,phase:0});
  // Wayfinding pylons live above the player's head, never block movement.
  anchors.filter((r,k)=>k%3===1).forEach((r,k)=>mapFeatures.push({x:r.x+.5,z:r.z+.5,kind:4,phase:k*.8}));
  navClock=0;navField=null;portalRouteField=null;
  makeStairHeights(level);
  createWorldMesh(level);
}
function buildFloorDecal(v,x,z,t,seed){
  const c=rcolor(t.accent,(seed%3===0)?.46:.17);
  const sx=x+.1,sz=z+.1;
  if(seed%5===0){
    box(v,sx,.024,sz,x+.9,.029,sz+.04,c,1.3,[0,0,0,0,1,0]);
    box(v,sx,.024,z+.86,x+.9,.029,z+.9,c,.9,[0,0,0,0,1,0]);
  }
  if(seed%4===0){
    box(v,x+.48,.023,z+.2,x+.52,.029,z+.8,c,.65,[0,0,0,0,1,0]);
    box(v,x+.2,.023,z+.48,x+.8,.029,z+.52,c,.65,[0,0,0,0,1,0]);
  }
}// Stage 3: static scene solids share their exact AABBs with the world renderer.
// One spatial bucket per grid tile; projectiles and the camera query ONLY the
// tiles intersected by the ray. No per-frame rebuild and no network assets.
let worldSolidGrid=[],worldSolidCount=0,worldSolidIndexed=0,worldDecorClearance=false;
function resetWorldSolids(){
 worldSolidGrid=new Array(Math.max(0,mapSize*mapSize));
 worldSolidCount=0;worldSolidIndexed=0;
}
function registerWorldSolid(x0,y0,z0,x1,y1,z1,kind='structure'){
 if(!glReady||!mapSize)return;
 if(![x0,y0,z0,x1,y1,z1].every(Number.isFinite))return;
 const loX=Math.min(x0,x1),hiX=Math.max(x0,x1);
 const loY=Math.min(y0,y1),hiY=Math.max(y0,y1);
 const loZ=Math.min(z0,z1),hiZ=Math.max(z0,z1);
 if(hiX-loX<.001||hiY-loY<.001||hiZ-loZ<.001)return;
 // Paint-thin tread markings, floor seams and decals are not separate walls.
 // Actual plates, columns, braces, rails, ductwork and overhead equipment are.
 if(hiY<=.15&&hiY-loY<.09)return;
 const minX=Math.max(0,Math.floor(loX)),maxX=Math.min(mapSize-1,Math.floor(hiX));
 const minZ=Math.max(0,Math.floor(loZ)),maxZ=Math.min(mapSize-1,Math.floor(hiZ));
 if(maxX<minX||maxZ<minZ)return;
 const solid={box:[loX,loY,loZ,hiX,hiY,hiZ],kind};
 worldSolidCount++;
 for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
  const key=z*mapSize+x;
  (worldSolidGrid[key]||(worldSolidGrid[key]=[])).push(solid);
  worldSolidIndexed++;
 }
}
// Raised stairs and elevated bridges remain traversable. Decorative gantries
// are omitted *at mesh generation time*, not merely excluded from collision,
// when they would leave insufficient headroom over an accessible upper floor.
// Essential bridge plates, posts and rails are emitted before this mode starts.
function worldDecorObstructsRoute(x0,y0,z0,x1,y1,z1){
 if(!worldDecorClearance)return false;
 const loY=Math.min(y0,y1),hiY=Math.max(y0,y1);
 const a=Math.max(0,Math.floor(Math.min(x0,x1)-.26));
 const b=Math.min(mapSize-1,Math.floor(Math.max(x0,x1)+.26));
 const c=Math.max(0,Math.floor(Math.min(z0,z1)-.26));
 const d=Math.min(mapSize-1,Math.floor(Math.max(z0,z1)+.26));
 for(let z=c;z<=d;z++)for(let x=a;x<=b;x++){
  if(mapCells[z]?.[x]!==0)continue;
  const upper=Math.max(floorHeightAtCell(x,z),deckAtCell(x,z));
  if(upper>.15&&loY<upper+2.25&&hiY>upper+.16)return true;
 }
 return false;
}
// WORLD-MESH ONLY. Never call for animated robots or first-person weapons.
// This draws the same six-faced geometric box while registering its projectile
// collision boundary, so the two representations cannot drift apart.
function worldSolidBox(dst,x0,y0,z0,x1,y1,z1,color,emission=0,sides=[1,1,1,1,1,1]){
 if(worldDecorObstructsRoute(x0,y0,z0,x1,y1,z1))return;
 box(dst,x0,y0,z0,x1,y1,z1,color,emission,sides);
 registerWorldSolid(x0,y0,z0,x1,y1,z1);
}
function worldSolidRayCell(o,d,limit,travelled,cx,cz,best){
 const solids=worldSolidGrid[cz*mapSize+cx];
 if(!solids)return best;
 for(const solid of solids){
  const h=rayAABB(o,d,limit,...solid.box);
  if(!h||h.t+1e-7<travelled||h.t>limit+1e-7)continue;
  if(!best||h.t<best.t-1e-8){
   best={...h,kind:solid.kind,cellX:cx,cellZ:cz,solid};
  }
 }
 return best;
}

// Body-vs-static geometry for the operator. Only projected 3D volume matters;
// flush decorative seams are excluded during registration above. Preserve
// legacy AI pathing (which uses the map grid) until navigation can route
// around these finer obstacles without deadlocks.
function worldSolidBodyCollision(x,z,r,feet,height=1.92){
 if(!glReady||!worldSolidCount)return false;
 const loX=Math.max(0,Math.floor(x-r)),hiX=Math.min(mapSize-1,Math.floor(x+r));
 const loZ=Math.max(0,Math.floor(z-r)),hiZ=Math.min(mapSize-1,Math.floor(z+r));
 for(let cz=loZ;cz<=hiZ;cz++)for(let cx=loX;cx<=hiX;cx++){
  const solids=worldSolidGrid[cz*mapSize+cx];if(!solids)continue;
  for(const solid of solids){
   const b=solid.box;
   if(b[1]>=feet+height-.015||b[4]<=feet+.16)continue;
   // Flush wall adornments and raised floor graphics are already handled by
   // their parent wall / support surface, but posts and rails are physical.
   const dx=x-Math.max(b[0],Math.min(x,b[3]));
   const dz=z-Math.max(b[2],Math.min(z,b[5]));
   if(dx*dx+dz*dz<r*r-1e-7)return true;
  }
 }
 return false;
}
// Minimum underside crossed by a jumping player's head this frame.
// The check is swept, so short jumps cannot pass through thin crossbars.
function worldSolidHeadBarrier(x,z,r,previousHead,nextHead){
 if(!glReady||!worldSolidCount||nextHead<=previousHead)return null;
 const loX=Math.max(0,Math.floor(x-r)),hiX=Math.min(mapSize-1,Math.floor(x+r));
 const loZ=Math.max(0,Math.floor(z-r)),hiZ=Math.min(mapSize-1,Math.floor(z+r));
 let nearest=null;
 for(let cz=loZ;cz<=hiZ;cz++)for(let cx=loX;cx<=hiX;cx++){
  for(const solid of worldSolidGrid[cz*mapSize+cx]||[]){
   const b=solid.box;
   if(b[1]<previousHead-.001||b[1]>nextHead+.001)continue;
   const dx=x-Math.max(b[0],Math.min(x,b[3]));
   const dz=z-Math.max(b[2],Math.min(z,b[5]));
   if(dx*dx+dz*dz<=r*r&&(nearest===null||b[1]<nearest))nearest=b[1];
  }
 }
 return nearest;
}
// Highest top surface crossed by descending flying feet in this frame.
// Swept vertical contact prevents falling through thin gantries at low FPS.
function worldSolidFeetBarrier(x,z,r,previousFeet,nextFeet){
 if(!glReady||!worldSolidCount||nextFeet>=previousFeet)return null;
 const loX=Math.max(0,Math.floor(x-r)),hiX=Math.min(mapSize-1,Math.floor(x+r));
 const loZ=Math.max(0,Math.floor(z-r)),hiZ=Math.min(mapSize-1,Math.floor(z+r));
 let highest=null;
 for(let cz=loZ;cz<=hiZ;cz++)for(let cx=loX;cx<=hiX;cx++){
  for(const solid of worldSolidGrid[cz*mapSize+cx]||[]){
   const b=solid.box;
   if(b[4]>previousFeet+.001||b[4]<nextFeet-.001)continue;
   const dx=x-Math.max(b[0],Math.min(x,b[3]));
   const dz=z-Math.max(b[2],Math.min(z,b[5]));
   if(dx*dx+dz*dz<=r*r&&(highest===null||b[4]>highest))highest=b[4];
  }
 }
 return highest;
}
// Once a descending operator lands on a narrow beam/gantry, its top must
// remain a real support on the NEXT frame. Otherwise the terrain-only floor
// query marks the player airborne and blocks another Space jump even while
// the boots visibly rest on metal. Only surfaces at the current foot height
// count; lower decorative parts and distant rooftops cannot lift the player.
function worldSolidStandingSupport(x,z,r,feet,tolerance=.045){
 if(!glReady||!worldSolidCount||!Number.isFinite(feet))return null;
 const loX=Math.max(0,Math.floor(x-r)),hiX=Math.min(mapSize-1,Math.floor(x+r));
 const loZ=Math.max(0,Math.floor(z-r)),hiZ=Math.min(mapSize-1,Math.floor(z+r));
 let highest=null;
 for(let cz=loZ;cz<=hiZ;cz++)for(let cx=loX;cx<=hiX;cx++){
  for(const solid of worldSolidGrid[cz*mapSize+cx]||[]){
   const b=solid.box,top=b[4];
   if(Math.abs(top-feet)>tolerance)continue;
   const dx=x-Math.max(b[0],Math.min(x,b[3]));
   const dz=z-Math.max(b[2],Math.min(z,b[5]));
   if(dx*dx+dz*dz<=r*r&&(highest===null||top>highest))highest=top;
  }
 }
 return highest;
}
function worldSolidStats(){return {boxes:worldSolidCount,gridReferences:worldSolidIndexed,tiles:worldSolidGrid.filter(Boolean).length};}

function createWorldMesh(level){
  worldDecorClearance=false;
  resetWorldSolids();
  if(!glReady)return;
  let t=themes[sectorStyle%themes.length],v=[],size=mapSize;
  if(worldMesh){gl.deleteBuffer(worldMesh.b);worldMesh=null;}for(const c of worldChunks)gl.deleteBuffer(c.mesh.b);worldChunks=[];meshStats={chunks:0,triangles:0};
  const detail=save.settings.quality!==0, roofH=ceilingHeight();
  const metal=rcolor(t.wall,.49),trim=rcolor(t.wall,1.48),dim=rcolor(t.accent,.46),bright=rcolor(t.accent,.93);
  for(let z0=1;z0<size-1;z0+=9)for(let x0=1;x0<size-1;x0+=9){
  let v=[];
  for(let z=z0;z<Math.min(z0+9,size-1);z++)for(let x=x0;x<Math.min(x0+9,size-1);x++){
    let open=mapCells[z][x]===0;
    if(open){
      let seed=(x*31+z*17+level*7),base=rcolor(t.floor,.72+(seed%9)*.035);
      quad(v,[x,0,z+1],[x+1,0,z+1],[x+1,0,z],[x,0,z],[0,1,0],base);
      // Actual elevated stairs: opaque tread planes, vertical risers and
      // metal nosing, matching exactly the physics height map.
      const stepY=floorHeightAtCell(x,z);
      if(stepY>.001){
        const tread=rcolor(t.floor,.88+(seed%5)*.045);
        const riser=rcolor(t.wall,.42);
        const accent=rcolor(t.accent,.56);
        quad(v,[x,stepY,z+1],[x+1,stepY,z+1],[x+1,stepY,z],[x,stepY,z],[0,1,0],tread);
        const n=floorHeightAtCell(x,z-1),s=floorHeightAtCell(x,z+1),e=floorHeightAtCell(x+1,z),w=floorHeightAtCell(x-1,z);
        if(n<stepY-.01){quad(v,[x,stepY,z],[x+1,stepY,z],[x+1,n,z],[x,n,z],[0,0,-1],riser);}
        if(s<stepY-.01){quad(v,[x+1,stepY,z+1],[x,stepY,z+1],[x,s,z+1],[x+1,s,z+1],[0,0,1],riser);}
        if(e<stepY-.01){quad(v,[x+1,stepY,z],[x+1,stepY,z+1],[x+1,e,z+1],[x+1,e,z],[1,0,0],riser);}
        if(w<stepY-.01){quad(v,[x,stepY,z+1],[x,stepY,z],[x,w,z],[x,w,z+1],[-1,0,0],riser);}
        // Brushed anti-slip treads are paint-thin walkable surface details.
        // Keep them visible, but never register them as collision boxes:
        // a player approaches a riser with feet on the LOWER tread, so the
        // old raised solid strip snagged the body's leading edge before the
        // centre could reach the next floor-height cell.
        if(detail&&(n<stepY-.01||s<stepY-.01)){
          box(v,x+.12,stepY+.003,z+.10,x+.88,stepY+.013,z+.13,accent,.30,[0,0,0,0,1,0]);
          for(let k=0;k<3;k++)box(v,x+.25+k*.17,stepY+.004,z+.3,x+.28+k*.17,stepY+.012,z+.72,rcolor(t.wall,1.30),0,[0,0,0,0,1,0]);
        }
        if(detail&&e<stepY-.01)box(v,x+.86,stepY+.003,z+.14,x+.90,stepY+.014,z+.86,accent,.28,[0,0,0,0,1,0]);
      }
      // HIGH DECK: real suspended bridge, with underside, braces and railings.
      // Unlike a raised height-map tile this leaves a walkable lower passage.
      const deckY=deckAtCell(x,z);
      if(deckY>0){
        const plate=rcolor(t.floor,.69),frame=rcolor(t.wall,1.35),rail=rcolor(t.wall,1.55),a=rcolor(t.accent,.62);
        worldSolidBox(v,x,deckY-.17,z,x+1,deckY,z+1,plate,0);
        if(detail){
          worldSolidBox(v,x+.06,deckY+.008,z+.09,x+.94,deckY+.019,z+.13,a,.47,[0,0,0,0,1,0]);
          for(let k=0;k<4;k++){let zz=z+.2+k*.19;worldSolidBox(v,x+.12,deckY+.010,zz,x+.88,deckY+.017,zz+.025,frame,0,[0,0,0,0,1,0]);}
        }
        for(const side of [-1,1]){
          const zz=side<0?z:z+1;
          if(deckAtCell(x,z+side)===0){
            worldSolidBox(v,x,deckY-.20,zz-.04,x+1,deckY+.015,zz+.04,frame,0);
            // A safety rail must exist at EVERY quality setting: otherwise
            // low graphics settings alter collision and leave upper decks open.
            worldSolidBox(v,x+.08,deckY+.64,zz-.028,x+.92,deckY+.70,zz+.028,rail,0);
            if(detail){
              worldSolidBox(v,x+.08,deckY+.28,zz-.024,x+.92,deckY+.33,zz+.024,rail,0);
              if(x%2===0)worldSolidBox(v,x+.10,deckY+.02,zz-.032,x+.15,deckY+.74,zz+.032,rail,0);
            }
          }
        }
        // Structural supports stay at the outer edges of the underpass.
        if((x%4===0)&&((z+1)%4===0)&&deckAtCell(x,z-1)===0){
          worldSolidBox(v,x+.04,0,z+.08,x+.20,deckY-.17,z+.26,frame,0);
          if(detail)worldSolidBox(v,x+.02,.20,z+.065,x+.23,.27,z+.28,a,.21);
        }
      }
      if((x+z+level*3)%11===0){
        worldSolidBox(v,x+.035,.006,z+.05,x+.055,.012,z+.95,dim,.28,[0,0,0,0,1,0]);
        worldSolidBox(v,x+.05,.006,z+.035,x+.95,.012,z+.055,dim,.28,[0,0,0,0,1,0]);
      }
      if(detail&&seed%11===0)buildFloorDecal(v,x,z,t,seed);
      // VANGUARD SET DRESSING: physically modeled infrastructure in static
      // chunks. Ceiling-mounted hardware stays out of the navigation grid.
      if(detail && sectorStyle<14 && (!touchOnly||save.settings.quality===2||seed%3===0) && (seed%41===9 || seed%53===11)){
        const alloy=rcolor(t.wall,.58),sil=[.055,.067,.073],chrome=rcolor(t.wall,1.42);
        const warm=[.95,.61,.22],light=rcolor(t.accent,1.3);
        const cX=x+.5,cZ=z+.5;
        // Suspended power service cassette with four brackets and vents.
        worldSolidBox(v,x+.16,3.64,z+.18,x+.84,3.85,z+.82,alloy,0);
        worldSolidBox(v,x+.22,3.61,z+.25,x+.78,3.64,z+.75,sil,0);
        for(let a=0;a<6;a++)worldSolidBox(v,x+.26+a*.075,3.598,z+.29,x+.29+a*.075,3.605,z+.72,chrome,0,[0,0,0,0,1,0]);
        for(const ix of [x+.23,x+.77])for(const iz of [z+.26,z+.74])worldSolidBox(v,ix-.028,3.76,iz-.028,ix+.028,4.2,iz+.028,chrome,0);
        worldSolidBox(v,x+.38,3.586,z+.38,x+.62,3.598,z+.62,light,1.15,[0,0,0,0,1,0]);
        if((seed%3)===0){
          for(const iz of [z+.22,z+.77])worldSolidBox(v,x+.14,3.51,iz-.021,x+.86,3.57,iz+.021,chrome,0);
        }
      }
      if(detail && sectorStyle<14 && (!touchOnly||save.settings.quality===2||seed%3===0) && seed%59===13){
        // Overhead cable bridge and hanging structural lock brackets.
        const dark=rcolor(t.wall,.36),pale=rcolor(t.wall,1.52),alert=[.61,.32,.11];
        worldSolidBox(v,x+.02,3.39,z+.10,x+.98,3.48,z+.18,dark,0);
        worldSolidBox(v,x+.02,3.39,z+.82,x+.98,3.48,z+.90,dark,0);
        for(let j=0;j<4;j++){
          const xx=x+.12+j*.23;
          worldSolidBox(v,xx,3.37,z+.12,xx+.075,3.42,z+.88,pale,0);
          worldSolidBox(v,xx+.014,3.422,z+.22,xx+.059,3.435,z+.78,j===0?alert:dark,0);
        }
        for(const iz of [z+.14,z+.86])for(const ix of [x+.06,x+.93])worldSolidBox(v,ix-.02,3.44,iz-.018,ix+.02,4.21,iz+.018,pale,0);
      }
      if(detail && (!touchOnly||save.settings.quality===2||seed%3===0) && seed%73===7){
        // Removable floor engineering plate with bolted corners and steel seam.
        const base=rcolor(t.floor,.47),edge=rcolor(t.wall,1.75),rubber=[.048,.06,.073];
        worldSolidBox(v,x+.11,.018,z+.12,x+.89,.038,z+.88,edge,0,[0,0,0,0,1,0]);
        worldSolidBox(v,x+.14,.040,z+.15,x+.86,.047,z+.85,base,0,[0,0,0,0,1,0]);
        for(const ix of [x+.18,x+.82])for(const iz of [z+.19,z+.81])worldSolidBox(v,ix-.024,.049,iz-.024,ix+.024,.054,iz+.024,rubber,0,[0,0,0,0,1,0]);
        worldSolidBox(v,x+.47,.05,z+.23,x+.53,.056,z+.77,rubber,0,[0,0,0,0,1,0]);
      }

      if(detail&&(seed%41===0)&&mapCells[z][x]===0){
        // Thin raised maintenance lane marks and numbered tread lugs.
        const hazard=[.52,.29,.095],rubber=[.055,.069,.073];
        worldSolidBox(v,x+.13,.016,z+.11,x+.87,.021,z+.19,rubber,0,[0,0,0,0,1,0]);
        for(let q=0;q<5;q++){
          const xx=x+.15+q*.14;
          worldSolidBox(v,xx,.023,z+.12,xx+.065,.027,z+.18,hazard,0,[0,0,0,0,1,0]);
        }
      }
      if(detail&&seed%13===0){
        // Inset grated service drains, alloy lip, three individual slots.
        const steel=rcolor(t.wall,1.3),pit=rcolor(t.floor,.24);
        worldSolidBox(v,x+.18,.012,z+.20,x+.82,.018,z+.80,steel,0,[0,0,0,0,1,0]);
        worldSolidBox(v,x+.23,.02,z+.25,x+.77,.026,z+.75,pit,0,[0,0,0,0,1,0]);
        for(let j=0;j<4;j++)worldSolidBox(v,x+.26+j*.125,.027,z+.26,x+.278+j*.125,.032,z+.74,steel,0,[0,0,0,0,1,0]);
      }
      if(detail&&seed%23===0){
        // Small floor access hatch with bolts, no collision height.
        const plate=rcolor(t.wall,.78),rim=rcolor(t.wall,1.5);
        worldSolidBox(v,x+.17,.012,z+.16,x+.83,.018,z+.84,plate,0,[0,0,0,0,1,0]);
        for(let dx of [.22,.77])for(let dz of [.21,.79])worldSolidBox(v,x+dx-.025,.019,z+dz-.025,x+dx+.025,.023,z+dz+.025,rim,0,[0,0,0,0,1,0]);
      }
      if((sectorStyle===3||sectorStyle===1)&&seed%23===0){
        worldSolidBox(v,x+.17,.023,z+.16,x+.82,.028,z+.19,bright,1.0,[0,0,0,0,1,0]);
        worldSolidBox(v,x+.17,.023,z+.78,x+.82,.028,z+.81,dim,.8,[0,0,0,0,1,0]);
      }
      if(seed%19===0){
        worldSolidBox(v,x+.24,.023,z+.28,x+.76,.026,z+.73,rcolor(t.floor,1.65),0,[0,0,0,0,1,0]);
        worldSolidBox(v,x+.4,.028,z+.44,x+.6,.034,z+.56,bright,.7,[0,0,0,0,1,0]);
      }
      let adj=0;
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])if(mapCells[z+dz]?.[x+dx]===0)adj++;
      // Covered transit galleries alternate with open, monumental halls.
      if(((adj<=2) || seed%7!==0) && ((x*7+z*3+level)%13!==0)){
        quad(v,[x,roofH+.10,z],[x+1,roofH+.10,z],[x+1,roofH+.10,z+1],[x,roofH+.10,z+1],[0,-1,0],rcolor(t.wall,.43));
        registerWorldSolid(x,roofH+.09,z,x+1,roofH+.13,z+1,'ceiling');
        if(detail&&seed%9===0)worldSolidBox(v,x+.15,roofH+.07,z+.45,x+.85,roofH+.08,z+.55,bright,.78,[0,0,0,0,0,1]);
        if(detail&&seed%9===0){
          const frame=rcolor(t.wall,1.4),light=[.70,.74,.67];
          worldSolidBox(v,x+.12,roofH+.02,z+.10,x+.88,roofH+.06,z+.88,frame,0,[0,0,0,0,0,1]);
          worldSolidBox(v,x+.31,roofH-.01,z+.18,x+.69,roofH,z+.82,light,1.45,[0,0,0,0,0,1]);
        }
      }
    }else{
      const side=[!mapCells[z+1]?.[x],!mapCells[z-1]?.[x],!mapCells[z]?.[x-1],!mapCells[z]?.[x+1]];
      if(!side.some(Boolean))continue;
      let seed=x*11+z*19+level*13;
      let intensity=.71+(seed%7)*.040;
      worldSolidBox(v,x,0,z,x+1,roofH,z+1,rcolor(t.wall,intensity),0,[...side,1,0]);
      // Semi-recessed service wall: protective rails, actual cable raceways,
      // a vent grille, latches, and a caution marker. Static/batched geometry.
      if(detail&&seed%11===0){
        const ink=[.07,.085,.09],body=[.20,.235,.25],rim=[.37,.40,.40],
              ochre=[.70,.40,.13],glass=[.08,.22,.25],lamp=rcolor(t.accent,.62);
        const service=(axis,front)=>{
          // local x-axis is horizontal along a face, depth positive toward viewer
          const box2=(a,b,c,d,e,f,color,glow=0)=>{
            const cx=x+.5,cz=z+.5;
            if(axis==='z'){
              const q=front>0?z+1.07:z-.07;
              worldSolidBox(v,cx+a,b,Math.min(q+c*front,q+f*front),cx+d,e,Math.max(q+c*front,q+f*front),color,glow);
            }else{
              const q=front>0?x+1.07:x-.07;
              worldSolidBox(v,Math.min(q+c*front,q+f*front),b,cz+a,Math.max(q+c*front,q+f*front),e,cz+d,color,glow);
            }
          };
          // Face segments use a small symmetric depth range, requiring only a
          // fraction of a floor tile; invisible for collision purposes.
          box2(-.41,.45,-.033,.41,3.36,.035,ink);
          box2(-.37,.53,-.058,.37,3.23,.062,body);
          box2(-.39,.51,-.078,.39,.59,.080,rim);
          box2(-.39,3.15,-.078,.39,3.23,.080,rim);
          box2(-.31,1.36,-.082,.31,2.29,.084,ink);
          for(let k=0;k<7;k++)box2(-.27,1.48+k*.105,-.092,.27,1.52+k*.105,.096,rim);
          for(let k=0;k<3;k++)box2(-.33,2.59+k*.15,-.094,.33,2.65+k*.15,.095,k===2?ochre:ink,k===2?.12:0);
          box2(.27,.83,-.102,.34,1.09,.108,glass,.15);
          for(let k=0;k<2;k++){
            box2(-.33+k*.60,.64,-.100,-.29+k*.60,.72,.105,ochre,.1);
            box2(-.33+k*.60,2.99,-.105,-.29+k*.60,3.05,.108,lamp,.55);
          }
        };
        if(side[0])service('z',1);else if(side[1])service('z',-1);
        else if(side[2])service('x',-1);else if(side[3])service('x',1);
      }
      // Buttresses and double-height ribs create readable 3D architecture.
      if(side[0]&&seed%3!==0){
        worldSolidBox(v,x+.04,.09,z+.97,x+.22,3.93,z+1.035,trim,0,[1,0,0,0,1,1]);
        worldSolidBox(v,x+.78,.09,z+.97,x+.96,3.93,z+1.035,trim,0,[1,0,0,0,1,1]);
      }
      if(side[1]&&seed%3!==0){
        worldSolidBox(v,x+.04,.09,z-.035,x+.22,3.93,z+.03,trim,0,[1,0,0,0,1,1]);
        worldSolidBox(v,x+.78,.09,z-.035,x+.96,3.93,z+.03,trim,0,[1,0,0,0,1,1]);
      }
      if(side[2]&&seed%3!==0){
        worldSolidBox(v,x-.035,.09,z+.04,x+.03,3.93,z+.22,trim,0,[1,0,0,0,1,1]);
        worldSolidBox(v,x-.035,.09,z+.78,x+.03,3.93,z+.96,trim,0,[1,0,0,0,1,1]);
      }
      if(side[3]&&seed%3!==0){
        worldSolidBox(v,x+.97,.09,z+.04,x+1.035,3.93,z+.22,trim,0,[1,0,0,0,1,1]);
        worldSolidBox(v,x+.97,.09,z+.78,x+1.035,3.93,z+.96,trim,0,[1,0,0,0,1,1]);
      }
      // Three-layer industrial panels: fascia, illuminated seam and foot rail.
      const addFace=(axis,at,sideInt)=>{
        let x1=x+.1,x2=x+.9,z1=z+.1,z2=z+.9;
        if(axis==='z'){
          worldSolidBox(v,x1,.18,at-.023,x2,.37,at+.023,metal,0,[1,1,0,0,1,1]);
          worldSolidBox(v,x1,3.18,at-.022,x2,3.27,at+.022,dim,.52,[1,1,0,0,1,1]);
          worldSolidBox(v,x1,3.94,at-.02,x2,4.05,at+.02,trim,0,[1,1,0,0,1,1]);
          if(detail&&sideInt%5===0){worldSolidBox(v,x+.47,.8,at-.032,x+.53,2.62,at+.032,bright,1.15,[1,1,0,0,1,1]);}
          else if(detail&&sideInt%7===0)worldSolidBox(v,x+.22,1.4,at-.034,x+.78,1.47,at+.034,dim,.8,[1,1,0,0,1,1]);
        }else{
          worldSolidBox(v,at-.023,.18,z1,at+.023,.37,z2,metal,0,[0,0,1,1,1,1]);
          worldSolidBox(v,at-.022,3.18,z1,at+.022,3.27,z2,dim,.52,[0,0,1,1,1,1]);
          worldSolidBox(v,at-.02,3.94,z1,at+.02,4.05,z2,trim,0,[0,0,1,1,1,1]);
          if(detail&&sideInt%5===0)worldSolidBox(v,at-.032,.8,z+.47,at+.032,2.62,z+.53,bright,1.15,[0,0,1,1,1,1]);
          else if(detail&&sideInt%7===0)worldSolidBox(v,at-.034,1.4,z+.22,at+.034,1.47,z+.78,dim,.8,[0,0,1,1,1,1]);
        }
      };
      if(side[0])addFace('z',z+1.009,seed);
      if(side[1])addFace('z',z-.009,seed+3);
      if(side[2])addFace('x',x-.009,seed+7);
      if(side[3])addFace('x',x+1.009,seed+11);
      if(detail&&seed%6===0){
        // Recessed power conduit with two supporting metal clamp brackets.
        const pipe=rcolor(t.wall,1.9),cable=rcolor(t.wall,.32);
        if(side[0]||side[1]){
          const iz=side[0]?z+1.04:z-.04;
          worldSolidBox(v,x+.12,2.53,iz-.038,x+.88,2.61,iz+.038,pipe,0,[1,1,1,1,1,1]);
          for(const xx of [x+.22,x+.74])worldSolidBox(v,xx,2.46,iz-.05,xx+.07,2.69,iz+.05,cable,0);
        }else if(side[2]||side[3]){
          const ix=side[3]?x+1.04:x-.04;
          worldSolidBox(v,ix-.038,2.53,z+.12,ix+.038,2.61,z+.88,pipe,0);
          for(const zz of [z+.22,z+.74])worldSolidBox(v,ix-.05,2.46,zz,ix+.05,2.69,zz+.07,cable,0);
        }
      }
      // Architectural set dressing: wall-mounted breaker boxes, shock braces,
      // hanging cable runs and maintenance placards (pure geometry, no collision).
      if(detail && seed%7===0){
        const panel=rcolor(t.wall,.55),frame=rcolor(t.wall,1.12),dark=[.055,.067,.072],warm=[.87,.47,.15];
        const addCabinet=(axis,sideVal)=>{
          if(axis==='z'){
            const face=sideVal>0?z+1.07:z-.07;
            worldSolidBox(v,x+.24,1.08,face-.035,x+.76,2.32,face+.035,panel,0);
            worldSolidBox(v,x+.20,1.05,face-.055,x+.80,1.13,face+.055,frame,0);
            worldSolidBox(v,x+.25,2.26,face-.055,x+.75,2.32,face+.055,frame,0);
            worldSolidBox(v,x+.31,1.48,face-.063,x+.69,1.88,face+.063,dark,0);
            for(let k=0;k<4;k++)worldSolidBox(v,x+.34,1.54+k*.076,face-.074,x+.66,1.565+k*.076,face+.074,frame,0);
            worldSolidBox(v,x+.59,2.07,face-.075,x+.67,2.14,face+.075,warm,.55);
          }else{
            const face=sideVal>0?x+1.07:x-.07;
            worldSolidBox(v,face-.035,1.08,z+.24,face+.035,2.32,z+.76,panel,0);
            worldSolidBox(v,face-.055,1.05,z+.20,face+.055,1.13,z+.8,frame,0);
            worldSolidBox(v,face-.055,2.26,z+.25,face+.055,2.32,z+.75,frame,0);
            worldSolidBox(v,face-.065,1.48,z+.31,face+.065,1.88,z+.69,dark,0);
            for(let k=0;k<4;k++)worldSolidBox(v,face-.073,1.54+k*.076,z+.34,face+.073,1.565+k*.076,z+.66,frame,0);
            worldSolidBox(v,face-.075,2.07,z+.59,face+.075,2.14,z+.67,warm,.55);
          }
        };
        if(side[0])addCabinet('z',1);else if(side[1])addCabinet('z',-1);
        else if(side[2])addCabinet('x',-1);else if(side[3])addCabinet('x',1);
      }
      if(detail && seed%13===0){
       // Diagonal strengthening struts with tiered bracket and hanging conduit.
       const oxid=rcolor(t.wall,.67),highlight=rcolor(t.wall,1.45);
       if(side[0]||side[1]){
        const zz=side[0]?z+1.059:z-.059;
        for(let j=0;j<4;j++)worldSolidBox(v,x+.15+j*.17,.48+j*.55,zz-.027,x+.20+j*.17,.77+j*.55,zz+.027,oxid,0);
        worldSolidBox(v,x+.12,.44,zz-.064,x+.85,.51,zz+.064,highlight,0);
       }else if(side[2]||side[3]){
        const xx=side[3]?x+1.059:x-.059;
        for(let j=0;j<4;j++)worldSolidBox(v,xx-.027,.48+j*.55,z+.15+j*.17,xx+.027,.77+j*.55,z+.20+j*.17,oxid,0);
        worldSolidBox(v,xx-.064,.44,z+.12,xx+.064,.51,z+.85,highlight,0);
       }
      }
      // Microscale environment dressing: stencil strips, plate bolts, ID plaques,
      // access switches, hose clamps. Grouped in static world chunks, not draw calls.
      if(detail && seed%19===2){
        const black=[.041,.055,.062],outline=[.38,.42,.43],ink=[.67,.61,.39];
        const face=side[0]?['z',z+1.042]:side[1]?['z',z-.042]:side[2]?['x',x-.042]:['x',x+1.042];
        if(face[0]==='z'){
          const Z=face[1];
          worldSolidBox(v,x+.26,2.79,Z-.016,x+.74,3.24,Z+.016,black,0);
          worldSolidBox(v,x+.29,3.12,Z-.024,x+.71,3.19,Z+.024,outline,0);
          for(let j=0;j<4;j++)worldSolidBox(v,x+.31+j*.088,2.88,Z-.024,x+.35+j*.088,2.98,Z+.024,j%2?ink:outline,0);
          for(const X of [x+.27,x+.72])for(const Y of [2.80,3.24])worldSolidBox(v,X-.023,Y-.022,Z-.034,X+.023,Y+.022,Z+.034,ink,0);
        }else{
          const X=face[1];
          worldSolidBox(v,X-.016,2.79,z+.26,X+.016,3.24,z+.74,black,0);
          worldSolidBox(v,X-.024,3.12,z+.29,X+.024,3.19,z+.71,outline,0);
          for(let j=0;j<4;j++)worldSolidBox(v,X-.024,2.88,z+.31+j*.088,X+.024,2.98,z+.35+j*.088,j%2?ink:outline,0);
        }
      }
      if(detail && seed%27===4){
        // Broad removable armored wall cassettes with seam and screw bosses.
        const c=rcolor(t.wall,.89),rim=rcolor(t.wall,1.45),screw=[.11,.12,.13];
        if(side[0]){
          worldSolidBox(v,x+.23,.71,z+1.017,x+.78,1.26,z+1.046,c,0);
          for(const Y of [.75,1.2])for(const X of [x+.27,x+.74])worldSolidBox(v,X-.025,Y-.023,z+1.051,X+.025,Y+.023,z+1.058,screw,0);
          worldSolidBox(v,x+.25,1.17,z+1.056,x+.76,1.21,z+1.064,rim,0);
        }
      }
      // Five distinct facades — far fewer emissive meshes in power-save mode.
      if(detail&&((x*7+z*13+level)%5===0)){
        const b=rcolor(t.accent,sectorStyle===1?.9:.5),steel=rcolor(t.wall,1.45);
        if(side[0]){
          if(sectorStyle===1||sectorStyle===3||sectorStyle===5||sectorStyle===9){worldSolidBox(v,x+.22,1.2,z+.997,x+.78,1.35,z+1.016,b,sectorStyle>=5?.55:1.6,[1,1,0,0,1,1]);worldSolidBox(v,x+.32,1.55,z+.997,x+.68,2.15,z+1.016,steel,0,[1,1,0,0,1,1]);}
          else if(sectorStyle===2||sectorStyle===4){worldSolidBox(v,x+.33,.85,z+.998,x+.39,2.75,z+1.017,b,1.3,[1,1,0,0,1,1]);worldSolidBox(v,x+.61,.85,z+.998,x+.67,2.75,z+1.017,b,1.3,[1,1,0,0,1,1]);}
        }
        if(side[1])worldSolidBox(v,x+.26,2.16,z-.019,x+.74,2.24,z+.003,b,1.3,[1,1,0,0,1,1]);
      }
    }
  }
  if(v.length){let mesh=toMesh(v);worldChunks.push({mesh,x:x0+4.5,z:z0+4.5});meshStats.triangles+=mesh.n/3;}
  }
  v=[];
  // Unlike bridge rails and walls, later set dressing may be dropped if it
  // obstructs the real elevated walkway; both drawing and collisions agree.
  worldDecorClearance=true;
  // Elevated luminous octagonal floor markings at the safe zone and boss room.
  function circleOnFloor(cx,cz,r,col,segments=28){
    for(let i=0;i<segments;i++){
      let a=TAU*i/segments,b=TAU*(i+1)/segments;
      let A=[cx+Math.cos(a)*r,.039,cz+Math.sin(a)*r];
      let B=[cx+Math.cos(b)*r,.039,cz+Math.sin(b)*r];
      let C=[cx+Math.cos(b)*(r-.06),.039,cz+Math.sin(b)*(r-.06)];
      let D=[cx+Math.cos(a)*(r-.06),.039,cz+Math.sin(a)*(r-.06)];
      quad(v,A,B,C,D,[0,1,0],col,1.15);
    }
  }
  circleOnFloor(spawnX,spawnZ,2.05,dim);
  circleOnFloor(spawnX,spawnZ,1.65,rcolor(t.accent,.3));
  if(level%5===0){circleOnFloor(spawnX,spawnZ,4.8,rcolor(t.accent,.52));circleOnFloor(spawnX,spawnZ,5.0,rcolor(t.accent,.32));}
  // Large environmental structures attached to edges, not the walkable paths.
  for(const f of mapFeatures){
    if(f.kind===3)continue;
    let c=rcolor(t.wall,1.58),light=rcolor(t.accent,.85),x=f.x,z=f.z;
    // Suspended luminous frame, deliberately higher than the player's camera.
    worldSolidBox(v,x-.62,3.72,z-.62,x+.62,3.88,z+.62,c,0,[1,1,1,1,0,1]);
    worldSolidBox(v,x-.53,3.71,z-.53,x+.53,3.73,z+.53,light,.88,[1,1,1,1,0,1]);
    if(f.kind===1){
      worldSolidBox(v,x-.64,2.82,z-.65,x-.58,3.71,z-.58,c,0);
      worldSolidBox(v,x+.58,2.82,z+.58,x+.64,3.71,z+.65,c,0);
    }
  }
  // Oversized hanging conduits and floating navigation pylons, inspired by
  // reactor gantries and museum atria: above players and enemies, no hitbox.
  const arch=sectorStyle;
  for(let k=0;k<mapRooms.length;k++){
    const r=mapRooms[k],x=r.x,z=r.z;
    if(k===0)continue;
    const accent=rcolor(t.accent,k%3===0?1.08:.61);
    const dark=rcolor(t.wall,.75),strut=rcolor(t.wall,1.7);
    const stretch=Math.min(3.7,Math.max(2.5,r.w*.30));
    // Overhead gantries and ducts make each room read as real architecture.
    // The player and enemies never collide with these high-mounted structures.
    if(detail && k%2===0){
      const half=Math.min(3.4,Math.max(1.4,Math.min(r.w,r.h)*.25));
      const steel=rcolor(t.wall,.72),light=rcolor(t.wall,1.22);
      worldSolidBox(v,x-half,3.51,z-.16,x+half,3.82,z+.16,steel,0);
      worldSolidBox(v,x-half,3.48,z-.205,x+half,3.54,z+.205,light,0);
      for(let j=-1;j<=1;j++){
        const xx=x+half*j*.72;
        worldSolidBox(v,xx-.11,3.23,z-.30,xx+.11,3.55,z+.30,steel,0);
        worldSolidBox(v,xx-.075,3.15,z-.20,xx+.075,3.24,z+.20,[.62,.58,.45],.10);
      }
    }
    // Maintenance truss, cross braces and pendant luminaires.
    if(detail&&k%3===1){
      const ox=[.105,.135,.15],frame=[.32,.34,.35],amber=[.65,.44,.20];
      for(let q=-2;q<=2;q++){
        const zz=z+q*.44;
        worldSolidBox(v,x-2.15,3.87,zz-.045,x+2.15,3.95,zz+.045,ox);
      }
      for(let q=-1;q<=1;q++){
        const xx=x+q*.91;
        worldSolidBox(v,xx-.06,3.77,z-1.15,xx+.06,3.96,z+1.15,frame);
        worldSolidBox(v,xx-.09,3.74,z-.34,xx+.09,3.765,z+.34,amber,.10);
      }
      worldSolidBox(v,x-1.4,3.72,z-.075,x+1.4,3.76,z+.075,frame);
      worldSolidBox(v,x-1.27,3.70,z-.055,x+1.27,3.72,z+.055,rcolor(t.accent,.46),.60);
    }
    // Monumental suspended illuminated hex/cross frames.
    worldSolidBox(v,x-stretch,3.92,z-.10,x+stretch,4.07,z+.10,dark,0);
    worldSolidBox(v,x-stretch,3.87,z-.055,x+stretch,3.90,z+.055,accent,1.3);
    worldSolidBox(v,x-.09,3.9,z-stretch,x+.09,4.07,z+stretch,strut,0);
    worldSolidBox(v,x-.045,3.86,z-stretch,x+.045,3.89,z+stretch,accent,.9);
    if(arch===1||arch===3){
      // Extra suspended reactor chamber ribs, bright at center.
      worldSolidBox(v,x-.52,3.45,z-.52,x+.52,3.64,z+.52,dark,0);
      worldSolidBox(v,x-.25,3.42,z-.25,x+.25,3.46,z+.25,accent,1.55);
    }else if(arch===2||arch===4){
      // Ancient floating holographic plaque, no collision.
      worldSolidBox(v,x-.78,3.18,z-.12,x+.78,3.58,z+.12,dark,0);
      worldSolidBox(v,x-.65,3.29,z-.14,x+.65,3.34,z+.14,accent,1.15);
    }
  }
  // DISTINCT LANDMARKS for the new spatial blueprints. All above walking
  // height except shallow, non-collidable floor motifs. Batched per sector.
  if(arch>=5){
    const steel=rcolor(t.wall,.60),edge=rcolor(t.wall,1.35),signal=rcolor(t.accent,.60);
    const rust=[.34,.17,.095],cold=[.64,.73,.78];
    for(let k=1;k<mapRooms.length;k++){
      const r=mapRooms[k],x=r.x,z=r.z;
      if(arch===5){ // Container loading bridges and overhead cargo cranes.
        for(const side of [-1,1]){
          worldSolidBox(v,x+side*1.9-.10,2.90,z-2.2,x+side*1.9+.10,3.93,z+2.2,edge);
          worldSolidBox(v,x+side*1.9-.10,3.70,z-2.2,x+side*1.9+.10,3.87,z+2.2,steel);
        }
        worldSolidBox(v,x-2.05,3.62,z-.18,x+2.05,3.78,z+.18,steel);
        worldSolidBox(v,x-.32,3.40,z-.32,x+.32,3.59,z+.32,rust);
        worldSolidBox(v,x-.18,3.35,z-.18,x+.18,3.38,z+.18,signal,.75);
      }else if(arch===6){ // Suspended clean-room filtration and warning rails.
        worldSolidBox(v,x-1.45,3.35,z-.9,x+1.45,3.66,z+.9,cold);
        worldSolidBox(v,x-1.30,3.30,z-.74,x+1.3,3.34,z+.74,steel);
        for(let j=-3;j<=3;j++)worldSolidBox(v,x+j*.35-.04,3.27,z-.69,x+j*.35+.04,3.30,z+.69,edge);
        worldSolidBox(v,x-.8,3.22,z-.85,x+.8,3.25,z-.79,signal,.8);
      }else if(arch===7){ // Submerged pumping mains, oxidised tubing.
        for(const side of [-1,1]){
          worldSolidBox(v,x+side*1.2-.15,3.23,z-1.5,x+side*1.2+.15,3.48,z+1.5,rust);
          for(let q=-1;q<=1;q++)worldSolidBox(v,x+side*1.2-.22,3.2,z+q*.95-.05,x+side*1.2+.22,3.52,z+q*.95+.05,edge);
        }
        worldSolidBox(v,x-1.1,3.03,z-.055,x+1.1,3.11,z+.055,signal,.85);
      }else if(arch===8){ // Orrery ribs: suspended crosses and observatory lenses.
        for(let q=-2;q<=2;q++){
          let xx=x+q*.54;
          worldSolidBox(v,xx-.05,3.12,z-.99,xx+.05,3.78,z+.99,edge);
        }
        worldSolidBox(v,x-1.30,3.55,z-.10,x+1.30,3.78,z+.10,steel);
        worldSolidBox(v,x-.26,3.18,z-.26,x+.26,3.24,z+.26,signal,1.2);
      }else{ // Metro signage, platform beams and departure gantries.
        worldSolidBox(v,x-1.95,3.05,z-.22,x+1.95,3.3,z+.22,steel);
        worldSolidBox(v,x-1.68,3.08,z-.235,x+1.68,3.20,z-.225,signal,.9);
        for(let q=-1;q<=1;q++)worldSolidBox(v,x+q*.72-.055,3.29,z-.46,x+q*.72+.055,3.77,z+.46,edge);
        worldSolidBox(v,x-.67,.034,z-.85,x+.67,.041,z-.73,[.52,.39,.12],0,[0,0,0,0,1,0]);
      }
    }
  }

  // DIRECTOR'S CUT: bold modular setpieces designed for recognizable room silhouettes.
  // Static batched triangles, not per-frame draw calls; no collision volumes.
  if(detail){
    const alloy=rcolor(t.wall,1.22),steel=rcolor(t.wall,.71),graphite=[.085,.118,.134],rim=rcolor(t.wall,1.55);
    const signal=rcolor(t.accent,1.13),signalDim=rcolor(t.accent,.47),warning=[.69,.38,.16],porcelain=[.54,.57,.55];
    const full=!touchOnly||save.settings.quality===2;
    for(let k=1;k<mapRooms.length;k+=full?2:4){
      const room=mapRooms[k],xx=room.x,zz=room.z;
      if(!Number.isFinite(xx)||!Number.isFinite(zz))continue;
      // Massive suspended service spine with telescoping structural arms.
      // Lower edge > 3m, leaving movement/jumps untouched.
      worldSolidBox(v,xx-1.80,3.27,zz-.25,xx+1.80,3.52,zz+.25,graphite);
      worldSolidBox(v,xx-1.62,3.24,zz-.31,xx+1.62,3.30,zz+.31,rim);
      for(const side of [-1,1]){
        const ax=xx+side*1.47;
        worldSolidBox(v,ax-.14,3.04,zz-.27,ax+.14,3.68,zz+.27,steel);
        worldSolidBox(v,ax-.08,3.06,zz-.32,ax+.08,3.25,zz+.32,alloy);
        worldSolidBox(v,ax-.065,3.10,zz-.335,ax+.065,3.19,zz+.335,signal,.95);
        worldSolidBox(v,ax-.24,3.64,zz-.31,ax+.24,3.80,zz+.31,graphite);
      }
      // Hanging engine core or industrial navigation terminal, varies by room.
      if(k%3===0){
        worldSolidBox(v,xx-.58,2.86,zz-.49,xx+.58,3.22,zz+.49,steel);
        worldSolidBox(v,xx-.48,2.80,zz-.35,xx+.48,2.86,zz+.35,graphite);
        for(let q=-2;q<=2;q++){
          worldSolidBox(v,xx+q*.19-.055,2.76,zz-.30,xx+q*.19+.055,2.81,zz+.30,porcelain);
          worldSolidBox(v,xx+q*.19-.031,2.745,zz-.25,xx+q*.19+.031,2.762,zz+.25,signalDim,.28);
        }
        worldSolidBox(v,xx-.29,2.720,zz-.20,xx+.29,2.747,zz+.20,signal,1.35,[0,0,0,0,0,1]);
      }else{
        for(let q=-3;q<=3;q++){
          const ax=xx+q*.37;
          worldSolidBox(v,ax-.047,3.02,zz-.63,ax+.047,3.31,zz+.63,q%2?alloy:steel);
          if(q%2===0)worldSolidBox(v,ax-.045,3.008,zz-.52,ax+.045,3.025,zz+.52,signalDim,.34,[0,0,0,0,0,1]);
        }
      }
      // Route ID panel and engineering markings on existing room floor.
      if(full){
        worldSolidBox(v,xx-1.16,.015,zz-1.17,xx+1.16,.024,zz-1.10,graphite,0,[0,0,0,0,1,0]);
        for(let q=-5;q<=5;q++){
          const px=xx+q*.195;
          worldSolidBox(v,px-.069,.027,zz-1.15,px+.017,.031,zz-1.11,(q%3===0)?warning:rim,0,[0,0,0,0,1,0]);
        }
      }
    }
    // Landmark gateway in the spawn chamber: broad alloy emblem and lights.
    const sx=spawnX,sz=spawnZ;
    worldSolidBox(v,sx-2.18,3.55,sz-2.20,sx+2.18,3.78,sz-1.97,graphite);
    worldSolidBox(v,sx-1.92,3.52,sz-2.23,sx+1.92,3.55,sz-1.95,signalDim,.74);
    for(let q=-4;q<=4;q++){
      const x=sx+q*.44;
      worldSolidBox(v,x-.10,3.49,sz-2.235,x+.10,3.515,sz-2.225,q%2?porcelain:warning,q%2?0:.32);
    }
  }
  // Hanging luminous gantries and maintenance pipes at major junctions.
  if(detail)for(let k=1;k<mapRooms.length;k+=2){
    let r=mapRooms[k],x=r.x,z=r.z;
    let shell=rcolor(t.wall,1.25),dark=rcolor(t.wall,.34),accent=rcolor(t.accent,.72);
    worldSolidBox(v,x-1.7,3.4,z-.21,x+1.7,3.54,z+.21,shell);
    worldSolidBox(v,x-1.65,3.34,z-.17,x+1.65,3.355,z+.17,accent,1.1,[0,0,0,0,0,1]);
    for(let j=-1;j<=1;j++){
      worldSolidBox(v,x+j*.75-.10,3.52,z-.32,x+j*.75+.10,3.78,z+.32,dark);
      worldSolidBox(v,x+j*.75-.075,3.54,z-.34,x+j*.75+.075,3.62,z-.31,accent,.56);
    }
  }
  // Grounded support struts, mechanical conduits and integrated warning lights.
  if(detail)for(let k=1;k<mapRooms.length;k+=3){
    const r=mapRooms[k],x=r.x,z=r.z;const steel=rcolor(t.wall,1.15),dark=rcolor(t.wall,.28),accent=rcolor(t.accent,.77);
    // Cross-shaped cable ladder under suspended gantry: 3D depth, not a sprite.
    for(let j=-2;j<=2;j++){
      worldSolidBox(v,x+j*.55-.045,3.49,z-.36,x+j*.55+.045,3.54,z+.36,steel);
      worldSolidBox(v,x+j*.55-.026,3.47,z-.32,x+j*.55+.026,3.49,z+.32,dark);
    }
    worldSolidBox(v,x-1.35,3.48,z-.38,x+1.35,3.55,z-.32,dark);
    worldSolidBox(v,x-1.35,3.48,z+.32,x+1.35,3.55,z+.38,dark);
    for(const sx of [-1,1]){
      let ax=x+sx*1.2;
      worldSolidBox(v,ax-.11,3.55,z-.12,ax+.11,3.92,z+.12,steel);
      worldSolidBox(v,ax-.07,3.62,z-.14,ax+.07,3.75,z-.123,accent,.8);
    }
    // Oil-darkened floor patches directly below service gantries.
    let floorShadow=rcolor(t.floor,.26);
    worldSolidBox(v,x-1.18,.034,z-.28,x+1.18,.039,z+.28,floorShadow,0,[0,0,0,0,1,0]);
  }
  if(detail&&(sectorStyle===16||sectorStyle===17)){
    // Fixed suspended equipment. Kept above the collision volume so it
    // cannot create navigation obstacles or make the portal unreachable.
    const frame=rcolor(t.wall,.62),bright=rcolor(t.accent,.90),alloy=rcolor(t.wall,1.34);
    for(let k=2;k<mapRooms.length;k+=2){
      const r=mapRooms[k],x=r.x,z=r.z;if(!Number.isFinite(x)||!Number.isFinite(z))continue;
      if(sectorStyle===16){
        worldSolidBox(v,x-1.45,3.51,z-.17,x+1.45,3.63,z+.17,alloy);
        for(let j=-2;j<=2;j++){
          const q=x+j*.55;
          worldSolidBox(v,q-.09,3.07,z-.36,q+.09,3.44,z+.36,frame);
          worldSolidBox(v,q-.062,3.23,z-.38,q+.062,3.30,z-.36,bright,.67);
        }
        worldSolidBox(v,x-1.4,3.05,z-.48,x+1.4,3.10,z-.42,bright,.41);
      }else{
        worldSolidBox(v,x-1.6,3.28,z-.27,x+1.6,3.45,z+.27,frame);
        for(let j=-2;j<=2;j++){
          const q=z+j*.55;
          worldSolidBox(v,x-.65,3.21,q-.05,x+.65,3.32,q+.05,alloy);
          worldSolidBox(v,x-.14,3.15,q-.06,x+.14,3.23,q+.06,bright,.8);
        }
        worldSolidBox(v,x-.32,3.31,z-.67,x+.32,3.55,z-.56,alloy);
      }
    }
  }
  // Sector origin station and destination landing pad.
  circleOnFloor(portal.x,portal.z,1.3,rcolor(t.accent,.5));
  circleOnFloor(portal.x,portal.z,.95,rcolor(t.accent,.95));
  worldMesh=toMesh(v);meshStats.triangles+=worldMesh.n/3;meshStats.chunks=worldChunks.length;
  worldDecorClearance=false;

}

function drawEnvironmentDetails(g,tt){
  // Small animated holograms: intentionally few draw calls on mobile.
  const reduced=save.settings.quality===0;
  const features=reduced?mapFeatures.filter(f=>f.kind===3):mapFeatures;
  for(const f of features){
    if(distance(g.p,f)>18)continue;
    const height=f.kind===3?3.65:2.85;
    const sz=f.kind===3?.65:.38;
    const t=g.t*1.2+f.phase;
    draw(geom.ring,f.x,height,f.z,sz,sz,sz,t,tt.accent,.7,Math.PI*.34);
    if(!reduced)draw(geom.octa,f.x,height+.14+Math.sin(t*1.7)*.15,f.z,.18,.34,.18,-t*1.5,tt.accent,1.55);
  }
}
function drawRouteBeacons(g,tt){
 if(!g.portalReady || save.settings.quality===0)return;
 const path=portalRoute(g.p,28);
 // Six modest 3D markers along reachable paths; unlike direct wall-through arrows.
 for(let i=3;i<path.length;i+=4){
  const pt=path[i],d=hypot(pt.x-g.p.x,pt.z-g.p.z);
  if(d<3||d>21||isWall(pt.x,pt.z))continue;
  const bob=.22+Math.sin(g.t*3+i)*.05;
  draw(geom.ring,pt.x,bob,pt.z,.33,.045,.33,g.t*.36,tt.accent,.62);
  draw(geom.octa,pt.x,bob+.30,pt.z,.08,.23,.08,g.t*.7,tt.accent,.7);
 }
}
function drawEnemyVanguard(e,g,p){
  if(save.settings.quality===0||e.dead)return;
  const d=hypot(e.x-p.x,e.z-p.z);if(d>15)return;
  const s=e.radius, tt=g.t*3.3+e.id, bob=Math.sin(tt)*.06;
  const metal=[.22,.28,.33],black=[.052,.069,.075],silver=[.49,.57,.61];
  const warning=e.elite?[1,.64,.26]:e.color;
  const rot=Math.atan2(p.x-e.x,p.z-e.z);
  // Separate articulated shoulder bearing, armor cap and illuminated status.
  for(const side of [-1,1]){
    const rx=e.x+side*s*.68,rz=e.z;
    draw(geom.orb,rx,.98+bob,rz,s*.22,s*.24,s*.26,tt*.12,metal,.02);
    draw(geom.bevel,rx+side*s*.14,1.06+bob,rz,s*.32,s*.17,s*.34,rot,metal,.015);
    draw(geom.cube,rx+side*s*.17,.89+bob,rz+s*.26,s*.17,s*.055,s*.15,rot,warning,.42);
    if(!e.boss){
      const phase=Math.sin(tt+side*2.3)*.12;
      draw(geom.pylon,rx+side*s*.12,.41+phase,rz,s*.19,s*.39,s*.25,rot,black,.015);
      draw(geom.bevel,rx+side*s*.12,.1+phase,rz+s*.14,s*.31,s*.09,s*.4,rot,silver,.01);
    }
  }
  if(!e.boss){
    draw(geom.bevel,e.x,1.49+bob,e.z,s*.58,s*.12,s*.48,rot,metal,.03);
    draw(geom.cube,e.x,1.51+bob,e.z+s*.18,s*.38,s*.065,s*.11,rot,warning,.3);
  }else{
    draw(geom.ring,e.x,1.67+bob,e.z,s*1.56,s*1.56,s*1.56,g.t*.42,warning,.46);
  }
}
// NEON RIFT: ROBOT FOUNDRY II — true procedural hard-surface geometry.
// Mesh data is baked ONCE per archetype into GPU vertex buffers. Animated limbs
// are separate rigid parts; per-enemy allocations are kept small for mobile.
const robotFoundry={};
const RF={
 dark:[.055,.073,.089], rubber:[.084,.099,.112], iron:[.17,.205,.236],
 steel:[.29,.35,.39], ceramic:[.37,.43,.47], light:[.58,.65,.68],
 edge:[.12,.145,.16], brass:[.50,.37,.20], soot:[.027,.040,.053]
};
function robotMaker(){
  const v=[];
  function facet(a,b,c,t,em=0){
    const p=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],q=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
    let n=[p[1]*q[2]-p[2]*q[1],p[2]*q[0]-p[0]*q[2],p[0]*q[1]-p[1]*q[0]];
    const len=Math.hypot(...n)||1;n=n.map(x=>x/len);
    addTri(v,a,b,c,n,t,em);
  }
  function smoothFacet(a,b,c,na,nb,nc,col,em=0){
    // Analytic per-vertex normals remove the visible polygon bands on
    // machine joints and domed composite shells, with unchanged shader format.
    for(const [p,n] of [[a,na],[b,nb],[c,nc]])v.push(...p,...n,...col,em);
  }
  function ellipsoid(cx,cy,cz,rx,ry,rz,col,em=0,segs=12,rings=7){
    const sample=(theta,phi)=>{
      const sa=Math.sin(theta),co=Math.cos(theta);
      const u=sa*Math.cos(phi),w=sa*Math.sin(phi);
      const point=[cx+rx*u,cy+ry*co,cz+rz*w];
      const norm=[u/rx,co/ry,w/rz],len=Math.hypot(...norm)||1;
      return [point,norm.map(t=>t/len)];
    };
    for(let i=0;i<rings;i++)for(let j=0;j<segs;j++){
      const t1=Math.PI*i/rings,t2=Math.PI*(i+1)/rings;
      const a=TAU*j/segs,b=TAU*(j+1)/segs;
      const p=sample(t1,a),q=sample(t1,b),r=sample(t2,a),s=sample(t2,b);
      if(i!==0)smoothFacet(p[0],q[0],r[0],p[1],q[1],r[1],col,em);
      if(i!==rings-1)smoothFacet(q[0],s[0],r[0],q[1],s[1],r[1],col,em);
    }
  }
  function panel(cx,cy,cz,w,h,d,col,em=0,bevel=.15){
    const x=cx-w/2,y=cy-h/2,ex=cx+w/2,ey=cy+h/2;
    const px=w*bevel,py=h*bevel;
    const outline=[[x+px,y],[ex-px,y],[ex,y+py],[ex,ey-py],[ex-px,ey],[x+px,ey],[x,ey-py],[x,y+py]];
    const zz0=cz-d/2,zz1=cz+d/2;
    const centre=[cx,cy,zz1];
    for(let i=0;i<8;i++){
      const j=(i+1)%8,a=outline[i],b=outline[j];
      facet(centre,[a[0],a[1],zz1],[b[0],b[1],zz1],col,em);
      facet([a[0],a[1],zz0],[b[0],b[1],zz0],[b[0],b[1],zz1],col,em);
      facet([a[0],a[1],zz0],[b[0],b[1],zz1],[a[0],a[1],zz1],col,em);
    }
  }
  function poly(shape,z0,z1,col,em=0){
    const n=shape.length,fc=shape.reduce((a,b)=>[a[0]+b[0]/n,a[1]+b[1]/n],[0,0]);
    for(let i=0;i<n;i++){
      const j=(i+1)%n,a=shape[i],b=shape[j];
      facet([fc[0],fc[1],z1],[a[0],a[1],z1],[b[0],b[1],z1],col,em);
      facet([fc[0],fc[1],z0],[b[0],b[1],z0],[a[0],a[1],z0],col,em);
      facet([a[0],a[1],z0],[a[0],a[1],z1],[b[0],b[1],z1],col,em);
      facet([a[0],a[1],z0],[b[0],b[1],z1],[b[0],b[1],z0],col,em);
    }
  }
  function slab(cx,cy,cz,w,h,d,col,em=0){box(v,cx-w/2,cy-h/2,cz-d/2,cx+w/2,cy+h/2,cz+d/2,col,em);}
  function rod(a,b,r,col,em=0,sides=9){
    const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dx,dy,dz)||1;
    const N=[dx/length,dy/length,dz/length],seed=Math.abs(N[1])>.86?[1,0,0]:[0,1,0];
    let U=[N[1]*seed[2]-N[2]*seed[1],N[2]*seed[0]-N[0]*seed[2],N[0]*seed[1]-N[1]*seed[0]],ul=Math.hypot(...U)||1;U=U.map(t=>t/ul);
    const V=[N[1]*U[2]-N[2]*U[1],N[2]*U[0]-N[0]*U[2],N[0]*U[1]-N[1]*U[0]];
    const normal=phi=>U.map((u,i)=>u*Math.cos(phi)+V[i]*Math.sin(phi));
    const point=(org,phi)=>org.map((c,i)=>c+r*normal(phi)[i]);
    for(let i=0;i<sides;i++){
      const p=TAU*i/sides,q=TAU*(i+1)/sides;
      const a0=point(a,p),a1=point(a,q),b0=point(b,p),b1=point(b,q);
      const n0=normal(p),n1=normal(q);
      smoothFacet(a0,a1,b0,n0,n1,n0,col,em);
      smoothFacet(a1,b1,b0,n1,n1,n0,col,em);
      facet(a,a1,a0,col,em);facet(b,b0,b1,col,em);
    }
  }
  function fastener(x,y,z,r=.025,c=RF.light){rod([x,y,z-.016],[x,y,z+.016],r,c,0,7)}
  function vent(x,y,z,n=4,w=.24,col=RF.dark){
    for(let i=0;i<n;i++)slab(x,y+(i-(n-1)/2)*.048,z,w,.018,.025,col);
  }
  return {v,panel,poly,slab,rod,ellipsoid,fastener,vent,finish:()=>toMesh(v)};
}
function robotPalette(kind){
  const styles={
    scout:[.31,.52,.49],charger:[.56,.43,.21],shooter:[.37,.42,.49],
    brute:[.49,.38,.32],sniper:[.36,.35,.41],medic:[.32,.44,.38],
    warden:[.30,.41,.56],artillery:[.48,.38,.27],raider:[.39,.32,.49],
    drone:[.32,.43,.51],boss:[.48,.37,.39]
  };
  const base=styles[kind]||styles.shooter;
  return {base,trim:base.map(v=>v*.48),highlight:base.map(v=>Math.min(.73,v*1.34)),glow:(enemies[kind]?.color||[.97,.43,.33])};
}
// ROBOT FOUNDRY II: per-class baked hard-surface details and asymmetrical silhouettes.
// Shapes are real vertices in the 3D scene (no billboards, external textures or online assets).
function robotDetailMesh(M,kind){
  const {panel,slab,poly,rod,fastener,vent}=M,P=robotPalette(kind),A=P.base,H=P.highlight,G=P.glow;
  const shade=P.trim,hard=RF.iron,dark=RF.dark,bright=RF.light;
  const frame=(x,y,z,w,h,depth,col=hard)=>{
    panel(x,y,z,w,h,depth,col,0,.21);
    panel(x,y,z+depth*.48,w*.73,h*.67,.029,RF.soot,0,.19);
    fastener(x-w*.34,y+h*.31,z+depth*.56,.022);
    fastener(x+w*.34,y-h*.31,z+depth*.56,.022);
  };
  const mark=(x,y,z)=>{ // industrial stencil: 3-digit geometric identification strip
    slab(x,y,z,.20,.018,.023,RF.light);
    slab(x-.07,y-.052,z,.034,.068,.017,RF.light);
    slab(x+.065,y-.052,z,.03,.068,.017,RF.brass);
  };
  const cooling=(x,y,z,s=1)=>{
    panel(x,y,z,.33*s,.23*s,.04,RF.dark);
    for(let i=0;i<5;i++)slab(x+(i-2)*.051*s,y,z+.03*s,.015*s,.17*s,.026*s,RF.iron);
    for(let i=0;i<2;i++)fastener(x+(i?1:-1)*.15*s,y+.106*s,z+.03*s,.009*s);
  };
  const hinge=(x,y,z,r=.11)=>{
    rod([x,y,z-.035],[x,y,z+.045],r,RF.iron,0,10);
    rod([x,y,z+.05],[x,y,z+.067],r*.72,H,0,10);
    rod([x,y,z+.07],[x,y,z+.083],r*.22,RF.soot,0,9);
  };
  const layered=(x,y,z,w,h)=>{
    panel(x,y,z,w,h,.10,shade,0,.24);
    panel(x,y+.018,z+.074,w*.85,h*.75,.056,A,0,.18);
    slab(x,y-h*.15,z+.109,w*.60,.015,.028,RF.dark);
    for(const side of [-1,1])fastener(x+side*w*.35,y+h*.19,z+.115,.018);
  };
  const antenna=(x,y,z,ht=0.37)=>{
    rod([x,y,z],[x,y+ht*.68,z-.045],.022,RF.iron,0,8);
    rod([x,y+ht*.68,z-.045],[x,y+ht,z-.065],.010,RF.brass,0,8);
    panel(x,y+ht,z-.065,.075,.055,.065,G,.18);
  };
  const capacitor=(x,y,z,ht=.38)=>{
    rod([x,y-ht*.5,z],[x,y+ht*.5,z],.060,RF.dark,0,9);
    for(let i=0;i<4;i++){
      const yy=y-ht*.35+i*ht*.24;
      rod([x,yy,z-.01],[x,yy+.01,z+.01],.084,i===2?G:RF.iron,i===2?.12:0,9);
    }
    rod([x,y-ht*.49,z],[x,y+ht*.49,z],.027,RF.light,0,8);
  };
  const gun=(x,y,z,len=.68)=>{
    panel(x,y,z,.24,.22,.37,RF.dark);
    panel(x,y+.125,z-.045,.16,.054,.39,H);
    rod([x,y-.01,z+.05],[x,y-.01,z+.05+len],.072,RF.iron,0,11);
    rod([x,y-.01,z+.05+len],[x,y-.01,z+.12+len],.095,RF.soot,0,10);
    rod([x,y-.01,z+.16+len],[x,y-.01,z+.17+len],.049,G,.17,10);
    for(let i=0;i<3;i++)panel(x,y+.08,z+.23+i*.13,.16,.033,.035,RF.dark);
  };
  const scar=(x,y,z)=>{
    rod([x-.13,y+.034,z],[x-.024,y-.012,z+.008],.008,RF.soot,0,5);
    rod([x-.022,y-.014,z],[x+.093,y-.049,z+.009],.007,RF.brass,0,5);
  };
  if(kind==='scout'||kind==='charger'){
    for(const side of [-1,1]){
      layered(side*.39,1.07,.32,.26,.27);
      hinge(side*.43,.85,.46,.092);
      hinge(side*.40,.82,-.34,.085);
      rod([side*.24,1.22,.28],[side*.47,1.28,.45],.035,RF.iron,0,8);
    }
    // Segment carapace into overlap plates and place the vented power spine.
    for(let i=0;i<5;i++){
      const z=-.49+i*.17;
      panel(0,1.29,z,.60-i*.025,.06,.15,i%2?H:A,0,.18);
      for(const side of [-1,1])fastener(side*(.24-i*.009),1.32,z+.078,.012);
    }
    for(let side of [-1,1]){
      panel(side*.28,.99,.80,.10,.09,.035,G,.38);
      rod([side*.26,1.03,.80],[side*.37,1.12,1.04],.035,RF.dark,0,7);
    }
    if(kind==='charger'){
      for(const side of [-1,1]){
        rod([side*.31,1.1,.73],[side*.52,1.38,1.30],.052,H,0,9);
        rod([side*.52,1.38,1.30],[side*.62,1.35,1.46],.026,RF.light,0,7);
      }
    }
    mark(0,1.16,.84);
    return;
  }
  if(kind==='drone'){
    // Swept aerospace armoring, exposed lift fans, sensor radome and engines.
    for(let side of [-1,1]){
      frame(side*.65,1.13,.06,.38,.19,.10);
      panel(side*.96,1.06,.25,.34,.045,.42,A);
      panel(side*1.12,.96,-.11,.25,.08,.37,RF.iron);
      rod([side*.94,.88,-.35],[side*.94,1.20,-.35],.109,RF.soot,0,12);
      rod([side*.94,.87,-.35],[side*.94,1.21,-.35],.058,RF.iron,0,10);
      for(let i=0;i<6;i++){
        const a=i*TAU/6;
        rod([side*.94,.97,-.35],[side*.94+.16*Math.cos(a),.97,-.35+.16*Math.sin(a)],.019,bright,0,6);
      }
      panel(side*.69,.88,.47,.19,.07,.05,G,.45);
    }
    panel(0,1.03,.86,.29,.17,.10,RF.soot);
    for(let i=-1;i<=1;i++)panel(i*.10,1.04,.925,.08,.056,.018,i===0?G:RF.light,i===0?.65:.02);
    antenna(0,1.34,-.12,.35);
    cooling(0,.86,.60,.80);
    return;
  }
  if(kind==='medic'){
    for(let side of [-1,1]){
      capacitor(side*.48,1.19,-.09,.58);
      rod([side*.38,1.34,.02],[side*.74,1.07,.05],.05,RF.iron,0,9);
      layered(side*.59,1.13,.31,.26,.35);
      rod([side*.71,.88,.24],[side*.87,.72,.64],.041,RF.light,0,9);
      rod([side*.87,.72,.64],[side*.82,.64,.78],.025,G,.24,7);
    }
    frame(0,1.16,.48,.42,.44,.07,RF.light);
    slab(0,1.16,.57,.07,.26,.035,G,1.3);
    slab(0,1.16,.57,.26,.07,.034,G,1.3);
    vent(0,.89,.56,4,.3);
    antenna(0,1.67,-.02,.33);
    return;
  }
  // Shared infantry details — distinctive layered armor, shoulder hinges,
  // service piping, exposed substructure and machined edge highlights.
  const wide=['brute','warden','artillery','boss'].includes(kind)?1.17:1;
  for(const side of [-1,1]){
    layered(side*.30*wide,1.38,.445,.27,.33);
    panel(side*.52*wide,1.64,.07,.35,.15,.42,H);
    hinge(side*.55*wide,1.39,.12,.103*wide);
    cooling(side*.27*wide,.88,-.36,.61);
    rod([side*.30*wide,.92,-.20],[side*.45*wide,1.34,-.32],.029,RF.light,0,8);
    rod([side*.23*wide,1.55,-.37],[side*.48*wide,1.53,-.19],.033,RF.iron,0,9);
    fastener(side*.50*wide,1.70,.25,.025);
    panel(side*.31*wide,.68,.41,.11,.18,.045,shade);
    // Three-layer hip skirts create a realistic overlapping silhouette.
    for(let i=0;i<3;i++)panel(side*(.29+i*.025)*wide,.70-i*.045,.27+i*.018,.15,.10,.13,i===1?H:A);
  }
  frame(0,1.12,-.45,.45,.49,.11);
  cooling(0,1.03,.48,.72);
  layered(0,1.59,.28,.26,.135);
  slab(0,1.03,-.47,.15,.33,.18,RF.iron);
  antenna(.26*wide,1.96,-.22,.32);
  mark(-.29*wide,1.53,.46);
  if(kind==='shooter'){
    // Rifleman: right-shoulder rotary optics, left tactical control box.
    gun(.59,1.29,.15,.52);
    panel(-.51,1.43,-.16,.31,.29,.36,RF.dark);
    panel(-.51,1.48,.04,.20,.07,.03,G,.34);
    antenna(-.48,1.63,-.23,.20);
    scar(.25,1.38,.53);
  }else if(kind==='sniper'){
    // Recon sniper: long slender rail, dual optics, bipod and targeting cable.
    gun(.46,1.51,.21,1.20);
    rod([.47,1.64,-.37],[.47,1.64,1.24],.033,RF.light,0,10);
    panel(.46,1.75,.24,.14,.13,.38,RF.dark);
    rod([.47,1.75,.12],[.47,1.75,.53],.044,G,.27,9);
    for(let side of [-1,1])rod([.46,1.43,.66],[.46+side*.18,1.04,.70],.028,RF.iron,0,9);
    antenna(-.33,1.96,-.11,.53);
  }else if(kind==='brute'){
    // Close-range heavy: raised impact guards, serrated fore-collar, blast pads.
    for(let side of [-1,1]){
      layered(side*.57,1.52,.37,.36,.40);
      panel(side*.58,1.29,.49,.24,.18,.17,H);
      rod([side*.59,1.72,-.24],[side*.70,1.92,-.14],.080,RF.iron,0,9);
      panel(side*.69,1.91,-.12,.17,.25,.18,shade);
      hinge(side*.31,.91,.28,.12);
      scar(side*.48,1.55,.64);
    }
    panel(0,1.72,.48,.51,.19,.15,RF.dark);
    for(let i=0;i<5;i++)slab((i-2)*.099,1.74,.57,.077,.034,.022,RF.brass);
  }else if(kind==='warden'){
    // Guardian: flared side shield emitters and modular barrier cells.
    for(let side of [-1,1]){
      panel(side*.81,1.35,.06,.44,.82,.22,RF.dark);
      panel(side*.84,1.37,.19,.28,.63,.10,A);
      for(let j=0;j<4;j++)panel(side*.85,1.09+j*.17,.26,.20,.09,.028,j===2?G:RF.light,j===2?.24:0);
      rod([side*.55,1.45,-.36],[side*.72,1.61,-.34],.052,G,.18,10);
    }
    frame(0,1.40,.58,.34,.32,.08,H);
    panel(0,1.4,.65,.22,.22,.035,G,.55);
  }else if(kind==='artillery'){
    // Long-range artillery: three-barrel missile tubes and stabilizer fins.
    for(let side of [-1,1]){
      panel(side*.81,1.53,-.27,.54,.54,.84,RF.dark);
      panel(side*.81,1.53,.20,.48,.49,.11,A);
      for(let j=-1;j<=1;j++){
        rod([side*.81+j*.125,1.52,.18],[side*.81+j*.125,1.52,.75],.072,RF.soot,0,11);
        rod([side*.81+j*.125,1.52,.76],[side*.81+j*.125,1.52,.80],.044,RF.brass,0,8);
      }
      panel(side*.81,1.83,-.36,.30,.10,.48,H);
      rod([side*.65,1.43,-.67],[side*.56,1.18,-.55],.045,RF.light,0,9);
    }
    mark(0,1.32,.52);
  }else if(kind==='raider'){
    // Raider: lean skeleton, swept blades, purple energy capacitors.
    for(let side of [-1,1]){
      rod([side*.31,1.55,-.24],[side*.63,1.84,-.60],.055,H,0,9);
      rod([side*.63,1.84,-.60],[side*.66,2.03,-.82],.025,RF.light,0,7);
      panel(side*.41,1.04,.33,.13,.47,.07,A);
      rod([side*.43,.86,-.05],[side*.60,.58,.05],.035,RF.iron,0,9);
      capacitor(side*.53,1.40,-.28,.38);
    }
    frame(0,1.39,.47,.30,.23,.10);
    panel(0,1.39,.54,.16,.10,.02,G,.65);
  }else if(kind==='boss'){
    // Titan command frame: oversized plated spine, multiple independent weapon pods,
    // layered reactor chassis and heavy field-generator spars.
    for(let side of [-1,1]){
      layered(side*.61,1.59,.28,.53,.49);
      gun(side*.81,1.43,.38,.65);
      for(let j=-1;j<=1;j++)rod([side*.82+j*.105,1.23,-.40],[side*.82+j*.105,1.23,.66],.055,RF.soot,0,10);
      panel(side*.55,1.01,.44,.29,.42,.14,shade);
      rod([side*.36,1.89,-.35],[side*.69,2.16,-.47],.048,H,0,8);
      panel(side*.68,2.18,-.47,.16,.24,.25,A);
      cooling(side*.29,1.51,.59,.58);
    }
    frame(0,1.34,.56,.55,.53,.14,H);
    panel(0,1.32,.68,.36,.35,.055,G,.52);
    for(let j=0;j<4;j++)panel(0,1.11+j*.14,.70,.25-.035*j,.026,.020,j===2?RF.light:RF.dark,j===2?.07:0);
    antenna(0,2.10,-.27,.50);
  }
  // Deterministic manufacturing scratches: close-up detail, not random per frame.
  scar(-.23*wide,1.22,.50);
  if(kind!=='medic')scar(.19*wide,.89,.47);
}


// Fine motor modules: four separate articulated pieces per biped. Shorter
// limb pivots allow knees and elbows to move independently, unlike a single box.
function buildRobotArticulatedPart(kind,which){
  const M=robotMaker(),{panel,slab,rod,ellipsoid,fastener}=M,P=robotPalette(kind);
  const width=['boss','brute','artillery','warden'].includes(kind)?1.17:(kind==='raider'?.85:1);
  const W=width, A=P.base,H=P.highlight;
  if(which==='upperLeg'){
    ellipsoid(0,-.21,.045,.165*W,.24,.18,RF.dark,0,10,6);
    rod([0,-.04,0],[0,-.42,.025],.10*W,RF.iron,0,11);
    panel(0,-.20,.06,.36*W,.34,.32,RF.dark);
    panel(0,-.20,.24,.31*W,.36,.125,A);
    panel(0,-.13,.32,.24*W,.15,.045,H);
    rod([.16*W,-.02,-.035],[.17*W,-.39,.08],.039,RF.light,0,9);
    rod([-.13*W,-.05,.04],[-.13*W,-.38,.04],.030,RF.iron,0,9);
    panel(0,-.42,.07,.30*W,.12,.31,RF.iron);
    for(let side of [-1,1])fastener(side*.12*W,-.41,.24,.019);
  }else if(which==='lowerLeg'){
    ellipsoid(0,-.18,.04,.155*W,.20,.16,RF.dark,0,10,6);
    rod([0,-.02,0],[0,-.32,.01],.086*W,RF.iron,0,10);
    panel(0,-.18,.05,.38*W,.32,.29,RF.dark);
    panel(0,-.15,.23,.31*W,.25,.10,A);
    panel(0,-.23,.29,.23*W,.10,.035,H);
    rod([-.14*W,-.03,-.055],[-.14*W,-.31,-.04],.033,RF.light,0,9);
    rod([.14*W,-.03,-.055],[.14*W,-.31,-.04],.035,RF.iron,0,9);
    slab(0,-.43,.19,.44*W,.14,.54,RF.soot);
    panel(0,-.37,.42,.37*W,.12,.14,A);
    panel(0,-.46,.37,.36*W,.033,.18,RF.iron);
    for(let side of [-1,1]){
      panel(side*.13*W,-.43,.49,.10,.038,.08,H);
      fastener(side*.16*W,-.18,.30,.024);
    }
  }else if(which==='upperArm'){
    ellipsoid(0,-.13,.04,.175*W,.24,.20,RF.dark,0,10,6);
    panel(0,-.04,.05,.38*W,.31,.47,RF.dark);
    panel(0,.02,.14,.36*W,.20,.42,H);
    panel(0,-.13,.29,.29*W,.20,.12,A);
    rod([0,-.15,-.02],[0,-.39,.075],.075*W,RF.iron,0,9);
    rod([.15*W,-.13,-.12],[.14*W,-.37,-.04],.033,RF.light,0,8);
    panel(0,-.40,.11,.25,.15,.22,RF.iron);
    for(let side of [-1,1])fastener(side*.12*W,-.41,.23,.019);
  }else if(which==='foreArm'){
    ellipsoid(0,-.17,.08,.14*W,.21,.19,RF.dark,0,10,6);
    rod([0,-.015,0],[0,-.32,.07],.073*W,RF.iron,0,9);
    panel(0,-.17,.12,.26*W,.28,.39,RF.dark);
    panel(0,-.14,.33,.24*W,.26,.105,A);
    panel(0,-.11,.40,.16*W,.054,.022,H);
    slab(0,-.37,.22,.25*W,.15,.27,RF.iron);
    for(let side of [-1,1]){
      rod([side*.06,-.40,.22],[side*.13,-.49,.39],.03,RF.dark,0,8);
      rod([side*.08,-.41,.20],[side*.12,-.48,.30],.019,RF.light,0,7);
    }
    if(kind==='shooter'||kind==='sniper'||kind==='artillery'){
      panel(0,-.24,.39,.19,.17,.35,RF.dark);
      rod([0,-.23,.42],[0,-.23,.73],.045,RF.iron,0,9);
      rod([0,-.23,.73],[0,-.23,.80],.062,RF.soot,0,9);
      panel(0,-.16,.53,.16,.033,.17,P.glow,.18);
    }
    if(kind==='raider'){
      rod([0,-.30,.33],[0,-.54,.78],.050,P.highlight,0,8);
      rod([0,-.54,.78],[0,-.61,.95],.020,RF.light,0,7);
    }
  }
  return M.finish();
}

function buildRobotAnimatedSensors(kind){
  const M=robotMaker(),{panel,rod,slab,fastener}=M,P=robotPalette(kind);
  const G=P.glow;
  if(kind==='scout'||kind==='charger'){
    panel(0,1.01,.94,.35,.13,.05,RF.soot);
    for(let side of [-1,1]){
      panel(side*.11,1.025,.98,.105,.045,.026,G,.42);
      rod([side*.25,1.09,.70],[side*.35,1.21,1.01],.023,RF.light,0,7);
    }
  }else if(kind==='drone'){
    panel(0,1.02,1.0,.27,.17,.07,RF.soot);
    panel(0,1.04,1.055,.18,.052,.025,G,.85);
    for(let side of [-1,1])panel(side*.22,1.0,.96,.055,.11,.03,RF.light);
  }else if(kind==='medic'){
    panel(0,1.28,.62,.28,.24,.06,RF.soot);
    slab(0,1.28,.655,.045,.18,.02,G,1.1);
    slab(0,1.28,.657,.18,.045,.02,G,1.1);
  }else{
    // Separate floating optic/face armor enables scanning motion.
    panel(0,1.88,.405,.39,.18,.095,RF.soot);
    panel(0,1.91,.468,.31,.095,.038,RF.dark);
    for(let side of [-1,1]){
      panel(side*.096,1.915,.49,.126,.038,.018,G,.96,.25);
      panel(side*.246,1.855,.36,.085,.23,.11,P.base);
    }
    panel(0,1.764,.445,.20,.069,.06,P.trim);
    for(let i=-1;i<=1;i++)slab(i*.043,1.748,.485,.027,.018,.024,RF.light);
    if(kind==='boss'||kind==='brute'){
      panel(0,2.07,.18,.35,.15,.30,P.highlight);
      for(let side of [-1,1])panel(side*.24,2.03,.2,.125,.26,.31,P.base);
    }
  }
  return M.finish();
}

// Baked alternate plating exposed after armor loss. Drawn only for close,
// damaged enemies; on death no decal or permanent ground shadow is created.
function buildRobotDamageOverlay(kind){
  const M=robotMaker(),{panel,poly,rod,slab}=M,P=robotPalette(kind);
  const insect=kind==='scout'||kind==='charger',flyer=kind==='drone',medic=kind==='medic';
  const C=RF.soot,B=RF.brass,K=RF.iron;
  if(insect){
    poly([[-.25,1.10],[-.06,1.19],[.09,1.14],[-.04,.99]],.60,.65,C);
    for(let j=0;j<3;j++)rod([-.20+j*.13,1.03,.63],[-.14+j*.13,1.15,.67],.022,B,0,7);
    panel(.21,1.08,.58,.18,.07,.035,P.glow,.13);
  }else if(flyer){
    panel(-.26,1.15,.66,.31,.13,.047,C);
    panel(-.26,1.15,.70,.18,.030,.027,P.glow,.17);
    for(let j=0;j<4;j++)rod([.11+j*.060,.91,.62],[.17+j*.060,1.06,.73],.017,K,0,6);
  }else if(medic){
    panel(-.30,1.25,.54,.27,.35,.085,C);
    for(let j=0;j<3;j++)rod([-.39+j*.12,1.10,.61],[-.34+j*.12,1.39,.63],.025,B,0,7);
    panel(-.27,1.24,.68,.13,.034,.027,P.glow,.15);
  }else{
    const wid=kind==='boss'?1.23:1;
    // Torn oblique plates reveal the dark chassis, hydraulic lines and wires.
    poly([[-.29*wid,1.28],[-.23*wid,1.56],[-.08*wid,1.53],[.02,1.42],[-.04*wid,1.20]],.492,.56,C);
    poly([[.16*wid,1.47],[.32*wid,1.46],[.23*wid,1.26],[.10*wid,1.23]],.492,.57,K);
    for(let j=0;j<4;j++){
      const x=-.24*wid+j*.095*wid;
      rod([x,1.26,.57],[x+.07,1.43,.59],.020,j%2?B:RF.light,0,7);
    }
    panel(.19*wid,1.37,.60,.15,.07,.04,P.glow,.13);
    panel(-.19*wid,1.16,.53,.26,.10,.047,RF.dark);
    slab(-.19*wid,1.12,.565,.17,.032,.025,RF.light);
    if(kind==='boss'||kind==='brute'){
      poly([[.37,1.62],[.64,1.62],[.61,1.43],[.42,1.47]],.52,.61,RF.soot);
      for(let j=0;j<3;j++)rod([.41+j*.075,1.47,.64],[.44+j*.075,1.63,.65],.025,B,0,7);
    }
  }
  return M.finish();
}


// Robot Foundry IV: manufacturing-layer meshes add cast-iron ribs, complex layered
// ceramic armor, functional hinges and class-specific silhouettes. They are baked
// into the archetype's static GPU buffer (zero extra draw calls per enemy).
function robotArmorKit(M,kind){
 const {panel,slab,poly,rod,fastener,vent}=M, P=robotPalette(kind);
 const heavy=['boss','brute','artillery','warden'].includes(kind),wide=heavy?1.13:(kind==='sniper'?.69:kind==='raider'?.82:1);
 const dark=RF.soot,base=P.base,bright=P.highlight,trim=P.trim;
 const small=(x,y,z,s=.04)=>fastener(x,y,z,s,RF.light);
 if(kind==='scout'||kind==='charger'){
  // Segmented insect carapace plates do not obscure the two front optics.
  for(let z=-.31;z<.26;z+=.18){
   panel(0,1.29,z,.51,.072,.23,bright);
   panel(-.23,1.26,z,.13,.035,.18,RF.iron);
   panel(.23,1.26,z,.13,.035,.18,RF.iron);
   small(-.18,1.30,z+.12,.014);small(.18,1.30,z+.12,.014);
  }
  for(let side of [-1,1]){
   rod([side*.26,1.25,.15],[side*.47,1.09,.13],.047,RF.iron);
   panel(side*.44,1.07,.15,.16,.12,.20,trim);
   panel(side*.30,.94,.50,.22,.12,.10,dark);
  }
  return;
 }
 if(kind==='drone'){
  for(let side of [-1,1]){
   const s=side;
   for(let j=0;j<3;j++){
    const x=s*(.58+j*.24),z=-.08-j*.08;
    panel(x,1.14,z,.24,.07,.32,j%2?base:bright);
    slab(x,1.185,z,.15,.015,.23,dark);
   }
   rod([s*.71,.91,-.15],[s*1.11,.89,-.29],.046,RF.iron);
   panel(s*1.03,.88,-.09,.25,.10,.21,RF.iron);
   panel(s*.58,1.10,.21,.11,.08,.17,P.glow,.23);
  }
  vent(0,1.22,.44,4,.31,dark);
  return;
 }
 if(kind==='medic'){
  for(let side of [-1,1]){
   panel(side*.28,1.27,.50,.23,.36,.068,bright);
   for(let k=0;k<3;k++)slab(side*.28,1.14+k*.11,.558,.16,.022,.021,dark);
   rod([side*.36,1.06,-.22],[side*.47,.89,-.39],.047,RF.light);
  }
  panel(0,1.72,.11,.39,.09,.28,RF.light);
  small(-.18,1.67,.30,.018);small(.18,1.67,.30,.018);
  return;
 }
 // Layered lamellar chest plates with exposed chassis seam and small bevelled edges.
 for(let side of [-1,1]){
  const x=side*.23*wide;
  panel(x,1.48,.52,.23*wide,.18,.12,bright);
  panel(x,1.32,.53,.26*wide,.14,.12,base);
  panel(x,1.21,.535,.25*wide,.075,.12,trim);
  slab(x,1.37,.608,.17*wide,.014,.019,RF.light);
  small(x+side*.067,1.51,.606,.015);small(x-side*.071,1.24,.603,.014);
  // Shoulder pauldron, external hinge and fasteners.
  panel(side*.52*wide,1.58,.36,.28*wide,.23,.24,bright);
  panel(side*.57*wide,1.44,.47,.24*wide,.12,.11,base);
  rod([side*.43*wide,1.47,.13],[side*.62*wide,1.40,.14],.065,RF.iron);
  rod([side*.43*wide,1.47,.13],[side*.62*wide,1.40,.14],.029,RF.light);
  small(side*.57*wide,1.58,.50,.018);
  // Hip armor and protected waist joints.
  panel(side*.30*wide,.94,.39,.18,.12,.21,trim);
  for(let j=0;j<3;j++)slab(side*.30*wide,.85-j*.065,.45,.15,.033,.055,j===0?base:RF.iron);
  small(side*.30*wide,.96,.49,.016);
 }
 for(let j=0;j<3;j++){
  slab(-.074+j*.074,1.29,.621,.028,.16,.017,RF.iron);
 }
 // Vents on upper back are functional radiators rather than random cubes.
 for(let side of [-1,1]){
  panel(side*.25,1.41,-.39,.33,.35,.09,RF.dark);
  for(let k=0;k<5;k++)slab(side*.25,1.26+k*.065,-.45,.21,.024,.022,k%2?RF.iron:RF.soot);
 }
 if(kind==='sniper'){
  for(let j=0;j<4;j++){
   slab(.37,1.62,-.45+j*.20,.20,.029,.06,RF.iron);
  }
  panel(.41,1.72,.56,.24,.09,.25,dark);
  panel(.41,1.77,.56,.16,.026,.15,P.glow,.24);
 } else if(kind==='artillery'||kind==='boss'){
  for(let s of [-1,1])for(let j=0;j<2;j++){
   const x=s*(.59*wide+j*.08);
   rod([x,1.49,-.59],[x,1.49,.40],.038,RF.iron);
   panel(x,1.49,.42,.094,.075,.055,RF.soot);
  }
  panel(0,1.58,.60,.34,.10,.077,RF.iron);
 } else if(kind==='warden'){
  for(let s of [-1,1]){
   rod([s*.52,1.67,-.23],[s*.68,1.67,-.60],.051,RF.iron);
   panel(s*.68,1.67,-.57,.20,.13,.16,P.glow,.18);
  }
 } else if(kind==='raider'){
  for(let s of [-1,1]){
   panel(s*.26,.96,.52,.10,.20,.045,P.glow,.30);
   rod([s*.31,1.51,-.32],[s*.47,1.88,-.47],.028,RF.light);
  }
 } else if(kind==='brute'){
  for(let side of [-1,1]){
   poly([[side*.27,1.67],[side*.57,1.72],[side*.72,1.59],[side*.52,1.40]],.46,.57,bright);
   panel(side*.50,1.57,.605,.22,.042,.032,dark);
  }
 }
}


// FOUNDRY IV: silhouette and articulation engineering. Each archetype receives
// class-specific hard-surface armor with chamfered plates, mechanical cavities,
// constrained joints and a legible optics/cooling system. Geometry is baked once.
function robotForgeSilhouette(M,kind){
 const {panel,poly,slab,rod,fastener,vent}=M;
 const P=robotPalette(kind),armor=P.base,edge=P.highlight,shadow=RF.soot,metal=RF.iron;
 const vivid=P.glow,lead=RF.light,trim=P.trim;
 const shape=(a,z0,z1,col=armor,glow=0)=>poly(a,z0,z1,col,glow);
 const rivet=(x,y,z)=>fastener(x,y,z,.012,RF.light);
 const tracer=(a,b)=>rod(a,b,.011,RF.light,0,6);
 const pip=(x,y,z,r=.018)=>rod([x,y,z],[x,y,z+.013],r,vivid,.3,7);
 const boltRows=(x,y,z,w,n=3)=>{for(let j=0;j<n;j++)rivet(x-w/2+w*j/(n-1),y,z)};
 const duct=(x,y,z,h)=>{
   panel(x,y,z,.18,h,.11,RF.dark);
   for(let i=0;i<5;i++)slab(x,y-h*.35+i*h*.17,z+.070,.12,.015,.025,metal);
 };
 const cheek=(side,x,y,z,scale=1)=>{
   const s=side;
   shape([[s*(x-.03)*scale,y-.18],[s*(x+.09)*scale,y-.12],[s*(x+.15)*scale,y+.05],[s*(x+.03)*scale,y+.19],[s*(x-.055)*scale,y+.075]],z-.07,z+.08,armor);
   pip(s*(x+.05)*scale,y-.037,z+.1,.016);
 };
 if(kind==='scout'||kind==='charger'){
   // Organic insect-machine silhouette: segmented back, mandibular protective
   // horns, antenna housings and external joint struts for quadruped legs.
   for(let i=0;i<4;i++){
     const z=-.39+i*.25,ext=.39-(i%2)*.025;
     shape([[-ext,1.14],[-ext*.66,1.36],[0,1.40],[ext*.66,1.36],[ext,1.14]],z-.11,z+.12,i%2?edge:armor);
     slab(0,1.403,z,.22,.018,.12,shadow);
     boltRows(0,1.29,z+.129,.52,3);
   }
   for(const side of [-1,1]){
     const x=side;
     shape([[x*.18,.84],[x*.29,.92],[x*.49,.97],[x*.57,.80],[x*.35,.66]],.52,.66,edge);
     rod([x*.44,.81,.55],[x*.58,.60,.77],.05,metal,0,9);
     rod([x*.58,.60,.77],[x*.51,.57,.97],.026,lead,0,7);
     shape([[x*.16,1.05],[x*.26,1.13],[x*.33,1.19],[x*.19,1.18]],.78,.98,shadow);
     pip(x*.25,1.123,1.00,.021);
     rod([x*.31,1.31,.12],[x*.66,1.36,.02],.035,metal,0,8);
   }
   if(kind==='charger'){
     for(const s of [-1,1]){
       rod([s*.41,1.22,.74],[s*.60,1.43,1.19],.067,RF.iron,0,9);
       shape([[s*.49,1.32],[s*.59,1.50],[s*.68,1.41]],1.12,1.31,lead);
     }
   }else{
     // rear counter-balance and horizontal cooling fins
     rod([0,1.02,-.5],[0,.96,-.92],.09,metal,0,10);
     for(let i=0;i<3;i++)slab(0,1.1+i*.075,-.66,.45-i*.065,.022,.20,shadow);
   }
   return;
 }
 if(kind==='drone'){
   // A winged spacecraft-inspired drone, not a hovering cube.
   shape([[-.42,1.02],[0,1.38],[.42,1.02],[0,.88]],.35,.83,edge);
   panel(0,1.11,.86,.23,.13,.10,shadow);
   for(const side of [-1,1]){
     const s=side;
     shape([[s*.50,1.17],[s*.88,1.26],[s*1.46,1.08],[s*1.32,.94],[s*.85,1.00]],-.28,.07,armor);
     shape([[s*.70,1.22],[s*1.14,1.14],[s*1.23,1.09],[s*.75,1.13]],.07,.11,edge);
     rod([s*.57,.97,-.09],[s*1.33,.96,-.35],.046,metal,0,9);
     rod([s*1.16,.91,-.47],[s*1.16,1.12,-.47],.12,RF.dark,0,12);
     pip(s*1.25,.94,-.32,.04);
     panel(s*1.27,.99,-.16,.18,.095,.13,vivid,.19);
     shape([[s*.61,1.04],[s*.80,1.00],[s*.91,.91],[s*.70,.91]],.34,.49,trim);
   }
   // chin camera cluster
   for(let j=-1;j<=1;j++)pip(j*.09,1.023,.994,.018);
   return;
 }
 if(kind==='medic'){
   for(const side of [-1,1]){
     const s=side;
     shape([[s*.28,1.52],[s*.55,1.46],[s*.68,1.24],[s*.48,1.18],[s*.29,1.30]],.20,.42,RF.light);
     rod([s*.48,1.30,-.2],[s*.65,1.52,-.39],.056,metal,0,9);
     duct(s*.46,1.18,.45,.25);
     pip(s*.57,1.05,.54,.022);
     rod([s*.69,1.03,.13],[s*.85,.73,.28],.035,lead,0,8);
     panel(s*.84,.72,.34,.18,.08,.14,vivid,.2);
   }
   // illuminated halo around triage insignia and power injection ports
   for(let j=0;j<4;j++){
     const a=j*Math.PI*.5;
     pip(Math.cos(a)*.245,1.27+Math.sin(a)*.245,.565,.024);
   }
   return;
 }
 const giant=kind==='boss',heavy=giant||kind==='brute'||kind==='warden'||kind==='artillery';
 const slim=kind==='sniper',fast=kind==='raider';
 const width=giant?1.30:heavy?1.17:slim?.75:fast?.85:1;
 // Faceted breastplate with central vent channel and layered abdominal cover.
 shape([[-.39*width,1.56],[-.29*width,1.73],[-.08*width,1.72],[-.03*width,1.42],[-.24*width,1.27],[-.43*width,1.36]],.48,.65,edge);
 shape([[.39*width,1.56],[.29*width,1.73],[.08*width,1.72],[.03*width,1.42],[.24*width,1.27],[.43*width,1.36]],.48,.65,armor);
 panel(0,1.37,.68,.079,.29,.042,shadow);
 for(let i=0;i<3;i++)slab(0,1.29+i*.09,.712,.044,.022,.03,i===1?vivid:lead,i===1?.22:0);
 for(const side of [-1,1]){
   const s=side;
   // Canted, flared shoulder pauldron; actual silhouette-shaping geometry.
   shape([[s*.39*width,1.75],[s*.62*width,1.80],[s*.76*width,1.68],[s*.80*width,1.52],[s*.59*width,1.47],[s*.44*width,1.52]],.09,.43,edge);
   shape([[s*.52*width,1.71],[s*.68*width,1.70],[s*.73*width,1.59],[s*.60*width,1.61]],.45,.52,trim);
   rod([s*.46*width,1.43,.1],[s*.63*width,1.41,.14],.08,metal,0,11);
   rod([s*.46*width,1.43,.1],[s*.63*width,1.41,.14],.036,lead,0,8);
   for(let i=0;i<3;i++)pip(s*(.53+i*.047)*width,1.58,.535,.015);
   // side waist cooling fins with distinct cast shadows
   duct(s*.47*width,1.13,.04,.37);
   shape([[s*.25*width,.94],[s*.45*width,1.02],[s*.49*width,.83],[s*.29*width,.74]],.28,.46,armor);
   tracer([s*.28*width,.88,.44],[s*.34*width,.80,.49]);
 }
 // recessed goggle sockets and armored frowning eyebrow, distinguishing head.
 shape([[-.27*width,1.99],[-.19*width,2.05],[.18*width,2.05],[.28*width,1.97],[.18*width,1.92],[-.18*width,1.92]],.30,.40,trim);
 panel(0,1.882,.438,.31*width,.09,.06,shadow);
 for(const s of [-1,1])cheek(s,.23,1.854,.32,width);
 // side collars and dorsal coolant manifold
 for(const s of [-1,1]){
   rod([s*.28*width,1.64,-.27],[s*.43*width,1.82,-.40],.046,metal,0,8);
   shape([[s*.34*width,1.79],[s*.51*width,1.72],[s*.51*width,1.58],[s*.36*width,1.62]],-.40,-.24,shadow);
 }
 for(let j=-2;j<=2;j++){
   const x=j*.088*width;
   slab(x,1.45,-.49,.055,.28,.072,j%2?metal:RF.dark);
 }
 // Thin raised emblems / warning chevrons without texture dependencies.
 for(const s of [-1,1]){
   tracer([s*.24*width,1.40,.685],[s*.30*width,1.42,.684]);
   tracer([s*.30*width,1.42,.684],[s*.36*width,1.40,.68]);
 }
 if(slim){
   // dedicated long-range optics, active stabilisers and slender head fin
   rod([0,2.01,-.06],[0,2.27,-.27],.038,metal,0,8);
   shape([[-.11,2.25],[0,2.34],[.11,2.25]],-.30,-.13,edge);
   for(let s of [-1,1])rod([s*.4,1.63,-.31],[s*.70,1.89,-.41],.026,lead,0,8);
   pip(.41,1.72,.81,.042);
 } else if(fast){
   // sweeping shock vanes and thigh blades distinguish the fast unit
   for(let s of [-1,1]){
     shape([[s*.4,1.65],[s*.67,1.79],[s*.57,1.43]],-.52,-.28,edge);
     shape([[s*.30,.78],[s*.47,.72],[s*.34,.46]],.2,.42,armor);
   }
 } else if(kind==='warden'){
   // broad forked shield generators, no oversized translucent billboard
   for(let s of [-1,1]){
     rod([s*.46,1.64,-.33],[s*.80,1.76,-.47],.055,metal,0,9);
     shape([[s*.60,1.74],[s*.90,1.81],[s*.99,1.56],[s*.67,1.51]],-.54,-.39,edge);
     pip(s*.81,1.64,-.375,.038);
   }
 } else if(giant||kind==='artillery'){
   // Shoulder missile launchers with exposed multi-cell shutters.
   for(let s of [-1,1]){
     shape([[s*.56,1.70],[s*.84,1.72],[s*.88,1.39],[s*.58,1.40]],-.57,-.15,shadow);
     for(let i=0;i<3;i++){
       const x=s*(.65+i*.073);
       rod([x,1.53,-.60],[x,1.53,-.12],.038,metal,0,8);
       pip(x,1.53,-.11,.024);
     }
   }
   if(giant){
     shape([[-.31,2.02],[-.26,2.24],[0,2.31],[.26,2.24],[.31,2.02]],-.14,.20,edge);
     for(let s of [-1,1]){
       rod([s*.32,2.04,-.14],[s*.55,2.25,-.29],.047,metal,0,9);
       shape([[s*.47,2.19],[s*.60,2.29],[s*.67,2.15]],-.35,-.19,trim);
     }
   }
 } else if(kind==='brute'){
   for(let s of [-1,1]){
     shape([[s*.54,1.70],[s*.79,1.65],[s*.84,1.39],[s*.63,1.34]],.22,.49,edge);
     panel(s*.67,1.52,.515,.19,.058,.045,shadow);
     pip(s*.69,1.46,.55,.028);
   }
 }
 // Inspection markings and recessed screws are deliberately sparse.
 rivet(-.24*width,1.52,.665);rivet(.24*width,1.52,.665);
 rivet(-.25*width,1.27,.62);rivet(.25*width,1.27,.62);
}

function buildRobotBody(kind,withDetails=true){
  const M=robotMaker(),{panel,slab,poly,rod,ellipsoid,fastener,vent}=M;
  const P=robotPalette(kind),A=P.base,H=P.highlight,G=P.glow;
  const insect=kind==='scout'||kind==='charger',flyer=kind==='drone',medic=kind==='medic';
  const giant=kind==='boss',heavy=kind==='brute'||kind==='warden'||kind==='artillery'||giant;
  const sniper=kind==='sniper',quick=kind==='raider';
  if(insect){
    // Long segmented carapace, wedge-shaped head, articulated mandibles.
    ellipsoid(0,1.07,-.04,.38,.24,.47,P.trim,0,12,7);
    poly([[-.38,.73],[-.53,1.00],[-.40,1.20],[0,1.30],[.40,1.20],[.53,1.0],[.38,.73]],-.53,.40,RF.dark);
    panel(0,1.07,-.02,.86,.37,.83,A);
    poly([[-.29,.93],[-.40,1.10],[-.25,1.25],[.25,1.25],[.40,1.10],[.29,.93]],.27,.50,H);
    for(let s of [-1,1]){
      panel(s*.36,1.03,.35,.24,.31,.13,P.trim);
      rod([s*.28,.93,.53],[s*.50,.67,.74],.055,RF.iron);
      panel(s*.44,.83,.68,.17,.19,.14,A);
    }
    poly([[-.25,.72],[-.34,.97],[0,1.06],[.34,.97],[.25,.72]],.47,.76,RF.iron);
    panel(0,.97,.77,.42,.10,.09,RF.dark);
    for(let s of [-1,1])panel(s*.13,.98,.83,.17,.05,.035,G,1.3,.27);
    for(let z of [-.40,-.22,-.04]){
      slab(0,1.28,z,.59,.045,.055,RF.edge);
      fastener(-.30,1.25,z,.019);
      fastener(.30,1.25,z,.019);
    }
    if(kind==='charger'){
      for(let s of [-1,1])rod([s*.21,1.10,.64],[s*.41,1.32,1.12],.069,H);
      panel(0,1.12,.88,.18,.31,.18,P.trim);
    }else{
      slab(0,.95,-.70,.26,.10,.52,RF.dark);
      panel(0,.94,-.88,.14,.07,.12,G,.7);
    }
    if(withDetails){robotDetailMesh(M,kind);robotArmorKit(M,kind);robotForgeSilhouette(M,kind);}return M.finish();
  }
  if(flyer){
    // Wide swept-wing aerial body with asymmetric stabilizers and two ducted thrusters.
    ellipsoid(0,1.09,.12,.41,.25,.48,RF.iron,0,12,7);
    poly([[-.48,.86],[-.54,1.03],[-.23,1.26],[.23,1.26],[.54,1.03],[.48,.86]],-.40,.55,RF.dark);
    panel(0,1.08,.16,.74,.30,.75,A);
    poly([[-.29,1.08],[-.24,1.27],[0,1.33],[.24,1.27],[.29,1.08]],.44,.68,H);
    for(let s of [-1,1]){
      poly([[s*.24,1.04],[s*.58,1.23],[s*1.16,1.11],[s*1.31,.91],[s*.85,.82]],-.43,.18,A);
      rod([s*.40,1.03,.18],[s*1.12,.96,-.28],.052,RF.iron);
      panel(s*.97,.99,-.18,.34,.16,.50,RF.dark);
      rod([s*1.04,.85,-.34],[s*1.04,1.12,-.34],.17,RF.iron);
      panel(s*1.04,1.10,-.34,.43,.035,.43,H);
      panel(s*.72,.91,.14,.10,.07,.17,G,.63);
    }
    panel(0,1.03,.78,.39,.21,.15,RF.soot);
    panel(0,1.04,.89,.29,.072,.06,G,1.25);
    for(let s of [-1,1])rod([s*.16,.80,-.22],[s*.25,.52,-.37],.065,RF.iron);
    if(withDetails){robotDetailMesh(M,kind);robotArmorKit(M,kind);robotForgeSilhouette(M,kind);}return M.finish();
  }
  if(medic){
    // Suspended triage drone with a stacked chassis, medicinal cross and repair mandibles.
    ellipsoid(0,1.21,.13,.39,.34,.32,RF.iron,0,12,7);
    poly([[-.43,.82],[-.56,1.13],[-.39,1.41],[.39,1.41],[.56,1.13],[.43,.82]],-.34,.40,RF.dark);
    panel(0,1.22,.20,.74,.63,.40,A);
    panel(0,1.27,.46,.55,.41,.10,RF.light);
    slab(0,1.27,.54,.11,.32,.055,G,1.0);
    slab(0,1.27,.54,.32,.11,.056,G,1.0);
    panel(0,1.65,.08,.54,.13,.46,H);
    panel(0,.76,.17,.65,.12,.48,RF.iron);
    for(let s of [-1,1]){
      rod([s*.39,1.17,.06],[s*.69,.88,.12],.063,RF.iron);
      panel(s*.67,.91,.15,.24,.22,.36,H);
      rod([s*.69,.86,.18],[s*.83,.68,.48],.035,G,.35);
    }
    vent(0,1.49,.44,3,.32);
    if(withDetails){robotDetailMesh(M,kind);robotArmorKit(M,kind);robotForgeSilhouette(M,kind);}return M.finish();
  }
  // Articulated combat infantry: NOT a cube with a glowing ball.
  const wide=heavy?1.13:sniper?.69:quick?.82:1;
  const chestWidth=.84*wide, shoulder=.49*wide;
  ellipsoid(0,1.34,-.015,.34*wide,.40,.32,RF.dark,0,12,7);
  poly([[-.22,.73],[-.38,.89],[-.30,1.08],[.30,1.08],[.38,.89],[.22,.73]],-.20,.29,RF.dark);
  poly([[-shoulder,1.05],[-chestWidth*.67,1.55],[-chestWidth*.32,1.69],[chestWidth*.32,1.69],[chestWidth*.67,1.55],[shoulder,1.05],[.27,.96],[-.27,.96]],-.33,.28,RF.iron);
  // Front armored shell with distinct asymmetric upper plates.
  poly([[-.33*wide,1.17],[-.41*wide,1.48],[-.19,1.61],[-.018,1.48],[-.05,1.19]],.29,.39,A);
  poly([[.05,1.19],[.018,1.48],[.19,1.61],[.41*wide,1.48],[.33*wide,1.17]],.29,.39,H);
  panel(0,1.06,.37,.62*wide,.28,.11,P.trim);
  panel(0,1.35,.425,.13,.39,.095,RF.dark);
  // Glowing power bus: narrow, inset and physically restrained.
  panel(0,1.34,.487,.065,.26,.03,G,.8,.24);
  for(let s of [-1,1]){
    vent(s*.25,1.24,.425,3,.17,RF.dark);
    panel(s*.29,1.43,.455,.065,.036,.02,RF.brass,.13);
    // Back scapular assembly and raised shoulder brackets.
    panel(s*.47*wide,1.48,-.04,.37*wide,.28,.42,P.trim);
    panel(s*.47*wide,1.60,.03,.33*wide,.15,.45,A);
    fastener(s*.30,1.52,.452,.023);
  }
  // Segmented pelvis and protective tassets.
  panel(0,.87,.20,.60*wide,.26,.39,A);
  panel(0,.83,.44,.34,.16,.10,H);
  for(let s of [-1,1]){
    poly([[s*.18,.86],[s*.31*wide,.84],[s*.36*wide,.57],[s*.24,.58]],.26,.40,P.trim);
    panel(s*.18,.79,.45,.07,.10,.025,RF.brass,.15);
  }
  // Neck and angled combat helmet; optical sockets are recessed.
  rod([0,1.59,.02],[0,1.78,.02],.12,RF.iron);
  ellipsoid(0,1.84,.08,.255*wide,.235,.235,RF.iron,0,12,7);
  panel(0,1.82,.07,.48*wide,.40,.43,RF.dark);
  poly([[-.24*wide,1.76],[-.28*wide,1.97],[-.14,2.06],[.14,2.06],[.28*wide,1.97],[.24*wide,1.76],[0,1.70]],.10,.32,A);
  panel(0,1.87,.36,.40*wide,.17,.10,RF.soot);
  for(let s of [-1,1]){
    panel(s*.092,1.89,.43,.155,.052,.035,G,1.8,.29);
    panel(s*.25*wide,1.84,.24,.095,.20,.19,P.trim);
    rod([s*.29*wide,1.89,.04],[s*.31*wide,1.92,-.29],.035,RF.iron);
  }
  panel(0,1.73,.34,.17,.08,.08,P.trim);
  if(heavy){
    // Layered shield-like pectorals and massive collar shields.
    for(let s of [-1,1]){
      panel(s*.43*wide,1.57,.18,.30,.24,.58,H);
      panel(s*.45*wide,1.63,.32,.24,.07,.10,RF.dark);
      fastener(s*.54*wide,1.57,.49,.025);
    }
    panel(0,1.58,-.30,.60,.36,.28,RF.iron);
  }
  if(quick){
    for(let s of [-1,1]){
      rod([s*.26,1.44,-.22],[s*.52,1.63,-.52],.045,H);
      panel(s*.30,.99,.44,.12,.20,.045,G,.32);
    }
  }
  if(sniper){
    // A proper exposed rail weapon mounted along the back: elongated barrel,
    // scope and articulated stabilizers.
    slab(.42,1.54,-.18,.13,.15,1.35,RF.dark);
    rod([.42,1.53,-.64],[.42,1.53,1.07],.064,RF.iron);
    rod([.38,1.62,-.40],[.38,1.62,.49],.033,H);
    panel(.42,1.65,.42,.19,.09,.28,G,.44);
    panel(.42,1.49,1.07,.23,.18,.10,P.trim);
    vent(.41,1.72,.12,3,.18);
  }
  if(kind==='warden'){
    // Rear shield emitter and side shield coils.
    panel(0,1.34,-.48,.77,.63,.14,RF.dark);
    panel(0,1.34,-.59,.40,.40,.05,G,.42);
    for(let s of [-1,1]){
      rod([s*.46,1.54,-.22],[s*.58,1.12,-.35],.075,H);
      panel(s*.59,1.27,-.42,.19,.27,.12,G,.26);
    }
  }
  if(kind==='artillery'||giant){
    // Twin missile racks with visible barrel openings.
    for(let s of [-1,1]){
      panel(s*.68*wide,1.48,-.30,.37,.37,.65,RF.dark);
      panel(s*.68*wide,1.47,.07,.32,.27,.12,A);
      for(let j of [-1,1])rod([s*.68*wide+j*.07,1.47,-.61],[s*.68*wide+j*.07,1.47,.30],.042,RF.soot);
      panel(s*.68*wide,1.47,.33,.22,.10,.035,G,.4);
    }
  }
  if(giant){
    panel(0,1.39,.46,.52,.39,.14,P.trim);
    panel(0,1.41,.58,.30,.30,.035,G,.70);
    for(let s of [-1,1]){
      panel(s*.39,.98,.41,.15,.22,.06,RF.brass,.15);
      rod([s*.31,2.00,-.15],[s*.55,2.28,-.36],.045,RF.iron);
      panel(s*.56,2.18,-.35,.15,.15,.16,A);
    }
  }
  // Tiny industrial stencils, bolt heads and weld lines baked in GPU mesh.
  for(const s of [-1,1]){
    fastener(s*.31,1.12,.40,.026);
    fastener(s*.25,1.57,.43,.022);
    fastener(s*.25,.79,.43,.024);
  }
  if(withDetails){robotDetailMesh(M,kind);robotArmorKit(M,kind);robotForgeSilhouette(M,kind);}return M.finish();
}
function buildRobotLimb(kind,leg){
  const M=robotMaker(),{panel,poly,slab,rod,fastener}=M;
  const P=robotPalette(kind),wide=['brute','warden','artillery','boss'].includes(kind)?1.16:1;
  if(leg){
    // Origin at hip; upper piston, knee knuckle, armored shin, boot.
    rod([0,-.04,0],[0,-.37,.04],.095*wide,RF.iron);
    panel(0,-.24,.08,.30*wide,.40,.31,P.base);
    panel(0,-.25,.27,.21*wide,.29,.05,P.highlight);
    rod([.13,-.12,.02],[.13,-.43,.10],.032,RF.light);
    rod([0,-.45,.06],[0,-.50,.06],.14*wide,RF.dark);
    panel(0,-.49,.22,.24*wide,.20,.14,P.trim);
    rod([0,-.52,.04],[0,-.73,-.02],.095*wide,RF.iron);
    panel(0,-.70,.10,.36*wide,.31,.30,P.base);
    panel(0,-.73,.28,.27*wide,.20,.06,P.highlight);
    slab(0,-.875,.19,.41*wide,.14,.53,RF.dark);
    panel(0,-.84,.40,.31*wide,.10,.13,P.base);
    fastener(.10,-.48,.29,.027);
    // Angled knee cap and segmented tread guards make the legs read as machinery.
    poly([[-.16,-.39],[-.09,-.28],[.13,-.28],[.19,-.39],[.14,-.48],[-.15,-.48]],.29,.39,P.highlight);
    for(let j=0;j<3;j++)slab(0,-.88,.37+j*.056,.31*wide,.026,.018,j===1?RF.iron:RF.dark);
    for(const side of [-1,1]){
      rod([side*.13,-.56,-.10],[side*.16,-.73,-.09],.026,RF.light,0,8);
      fastener(side*.12,-.47,.35,.018);
    }
  }else{
    // Origin at shoulder; separate elbow and claw/weapon tool.
    panel(0,-.06,.02,.35*wide,.30,.43,P.base);
    panel(0,.03,.10,.35*wide,.15,.44,P.highlight);
    rod([0,-.19,.03],[0,-.46,.13],.087*wide,RF.iron);
    panel(0,-.40,.19,.23,.23,.17,P.trim);
    rod([0,-.49,.08],[0,-.68,.20],.071,RF.iron);
    panel(0,-.64,.19,.23,.24,.35,P.base);
    panel(0,-.68,.40,.18,.11,.13,P.highlight);
    for(const s of [-1,1])rod([s*.06,-.77,.26],[s*.09,-.86,.39],.032,RF.iron);
    fastener(0,-.41,.29,.035);
    // Joint shroud and accessible piston wiring: breaks up square forearms.
    poly([[-.13,-.47],[-.085,-.34],[.09,-.34],[.14,-.47],[.095,-.55],[-.09,-.55]],.27,.40,P.highlight);
    rod([-.12,-.13,-.09],[-.12,-.61,-.06],.022,RF.light,0,8);
    for(let j=0;j<3;j++)slab(0,-.66+j*.058,.39,.21,.017,.031,RF.dark);
    if(kind==='sniper'){
      slab(0,-.45,.37,.14,.13,.55,RF.dark);
      rod([0,-.45,.30],[0,-.45,.89],.05,RF.iron);
    }
    if(kind==='raider')rod([0,-.45,.36],[0,-.71,.88],.06,P.highlight);
  }
  return M.finish();
}
function buildRobotInsectLeg(kind){
  const M=robotMaker(),{panel,rod}=M,P=robotPalette(kind);
  rod([0,0,0],[.23,-.23,.03],.07,RF.iron);
  panel(.16,-.18,.04,.18,.19,.25,P.base);
  rod([.23,-.23,.03],[.35,-.51,.14],.065,P.highlight);
  rod([.35,-.51,.14],[.45,-.59,.32],.034,RF.dark);
  rod([.36,-.52,.14],[.45,-.57,.36],.022,RF.brass);
  return M.finish();
}

function buildRobotThruster(kind){
  const M=robotMaker(),{panel,rod}=M,P=robotPalette(kind);
  panel(0,0,0,.43,.23,.54,RF.dark);
  rod([0,-.10,0],[0,.09,0],.16,RF.iron);
  panel(0,.13,.02,.36,.06,.36,P.highlight);
  for(let i=0;i<4;i++){
    const a=i*TAU/4;
    rod([0,.10,0],[Math.cos(a)*.19,.10,Math.sin(a)*.19],.025,P.highlight);
  }
  return M.finish();
}

function buildRobotMuzzle(kind){
 const M=robotMaker(),{poly,rod,panel}=M,P=robotPalette(kind);
 const glow=P.glow;
 // Pulsing emitter with armored petals, small enough to remain a genuine object.
 const body=kind==='artillery'||kind==='boss'?0.18:.11;
 rod([0,0,-.06],[0,0,.15],body,RF.soot,0,10);
 rod([0,0,.10],[0,0,.19],body*.63,glow,.75,9);
 for(let i=0;i<6;i++){
  const a=TAU*i/6,x=Math.cos(a),y=Math.sin(a);
  rod([x*body*.68,y*body*.68,.04],[x*body*1.04,y*body*1.04,.14],.014,RF.light,0,6);
 }
 panel(0,0,.19,body*.70,body*.70,.025,glow,1.2);
 return M.finish();
}

// FOUNDRY V: local-space, GPU-baked enemy mechanisms for dynamic damage feedback.
// Muzzle, regulator and reactor cores are built ONCE for each archetype.
function buildRobotReactor(kind){
 const M=robotMaker(),{panel,poly,rod,slab,fastener}=M,P=robotPalette(kind);
 const heavy=['boss','artillery','brute','warden'].includes(kind);
 const w=heavy?.41:.27, cy=heavy?1.31:1.29, zz=heavy?.77:.63;
 // Heat-damaged chest panel: blackened opened grille and triangular emissive reactor.
 panel(0,cy,zz,w*1.55,w*1.34,.04,RF.soot);
 panel(0,cy,zz+.045,w*1.14,w*.88,.035,RF.iron);
 poly([[-w*.36,cy-w*.29],[0,cy+w*.32],[w*.36,cy-w*.29]],zz+.069,zz+.116,P.glow,1.2);
 for(let side of [-1,1]){
  rod([side*w*.44,cy-w*.32,zz+.07],[side*w*.51,cy+w*.36,zz+.08],.016,RF.light,0,7);
  fastener(side*w*.53,cy,zz+.09,.018);
 }
 for(let j=0;j<4;j++)slab(0,cy-w*.45-j*.051,zz+.03,w*.95-j*.04,.018,.024,j===2?RF.brass:RF.soot);
 return M.finish();
}
function buildRobotServo(kind){
 const M=robotMaker(),{panel,rod,slab}=M,P=robotPalette(kind);
 // Independent, suspended jaw/stabilizer beneath a tracked head optics module.
 panel(0,1.85,.50,.29,.055,.09,RF.dark);
 panel(0,1.84,.553,.19,.032,.029,P.glow,.44);
 for(const side of [-1,1]){
  rod([side*.185,1.83,.40],[side*.215,1.75,.35],.027,RF.iron,0,8);
  slab(side*.19,1.78,.42,.045,.067,.08,P.trim);
 }
 return M.finish();
}
function robotWrapAngle(a){return Math.atan2(Math.sin(a),Math.cos(a));}
function robotApproachAngle(from,to,t){return from+robotWrapAngle(to-from)*Math.max(0,Math.min(1,t));}
function robotAnimationProfile(kind){
 switch(kind){
 case 'raider':return {turn:4.6,gait:9.5,lead:.32,lean:.13};
 case 'sniper':return {turn:1.35,gait:5.4,lead:.16,lean:.043};
 case 'brute':case 'boss':return {turn:1.38,gait:4.6,lead:.12,lean:.051};
 case 'scout':case 'charger':return {turn:3.5,gait:11.4,lead:.19,lean:.092};
 case 'drone':case 'medic':return {turn:3.0,gait:7.2,lead:.28,lean:.15};
 default:return {turn:2.5,gait:7.1,lead:.2,lean:.078};
 }
}
// FOUNDRY VI — layered, destructible visual armor. These are true local-space
// hard-surface meshes, not sprites. All meshes are shared by each enemy class.
function buildRobotArmorPlate(kind,place){
 const M=robotMaker(),{panel,poly,rod,fastener,vent}=M,P=robotPalette(kind);
 const heavy=['boss','brute','artillery','warden'].includes(kind);
 const insect=['scout','charger'].includes(kind);
 const flyer=['drone','medic'].includes(kind);
 const metal=place==='chest'?P.highlight:P.base;
 const xscale=heavy?1.22:(insect?.78:flyer?.88:1),zz=insect?.69:flyer?.69:(heavy?.59:.56);
 if(place==='chest'){
  const cy=insect?1.09:flyer?1.26:1.35;
  const w=(heavy?.87:.66)*xscale, hh=insect?.31:flyer?.40:.54;
  // A protruding armored cuirass with three inset forged facets.
  poly([[-w*.48,cy-hh*.36],[-w*.55,cy+hh*.13],[-w*.30,cy+hh*.57],[w*.30,cy+hh*.57],[w*.55,cy+hh*.13],[w*.48,cy-hh*.36],[0,cy-hh*.59]],zz,zz+.145,RF.dark);
  poly([[-w*.42,cy-hh*.29],[-w*.47,cy+hh*.16],[-w*.25,cy+hh*.45],[-.06,cy+hh*.24],[-.08,cy-hh*.36]],zz+.15,zz+.213,metal);
  poly([[w*.42,cy-hh*.29],[w*.47,cy+hh*.16],[w*.25,cy+hh*.45],[.06,cy+hh*.24],[.08,cy-hh*.36]],zz+.15,zz+.213,metal);
  poly([[-.06,cy+hh*.22],[0,cy+hh*.43],[.06,cy+hh*.22],[.048,cy-hh*.38],[-.048,cy-hh*.38]],zz+.171,zz+.24,P.glow,.14);
  for(let side of [-1,1]){
   panel(side*w*.35,cy+hh*.20,zz+.218,w*.14,.038,.036,RF.light);
   fastener(side*w*.42,cy-hh*.15,zz+.220,.018);
  }
  for(let j=0;j<3;j++)vent(0,cy-hh*.33-j*.045,zz+.224,1,w*.42,RF.soot);
 }else{
  const side=place==='left'?-1:1;
  if(insect){
   poly([[side*.29,.94],[side*.57,.84],[side*.71,1.02],[side*.50,1.24],[side*.30,1.13]],zz-.20,zz+.11,metal);
   panel(side*.49,1.10,zz+.14,.14,.09,.055,P.trim);
  }else if(flyer){
   poly([[side*.39,1.17],[side*.83,1.10],[side*1.01,1.26],[side*.66,1.49],[side*.39,1.42]],zz-.35,zz+.13,metal);
   rod([side*.55,1.17,zz+.16],[side*.88,1.17,zz+.19],.027,RF.iron,0,7);
  }else{
   const cy=heavy?1.69:1.60,w=heavy?.43:.35;
   poly([[side*.39,cy-.26],[side*(.39+w),cy-.16],[side*(.44+w),cy+.16],[side*.60,cy+.30],[side*.37,cy+.15]],zz-.30,zz+.04,metal);
   panel(side*.61,cy+.02,zz+.065,.20,.065,.039,P.highlight);
   rod([side*.43,cy-.19,zz+.068],[side*.67,cy-.11,zz+.080],.029,RF.iron,0,7);
   fastener(side*.58,cy+.19,zz+.066,.022);
  }
 }
 return M.finish();
}
function buildRobotExposedPanel(kind){
 const M=robotMaker(),{panel,poly,rod,slab,fastener}=M,P=robotPalette(kind);
 const hh=['boss','brute','warden','artillery'].includes(kind)?1.43:1.34;
 const depth=['scout','charger'].includes(kind)?.73:.69;
 // The plate disappears after a hit; hoses, ribs, glow and torn mounts remain.
 panel(0,hh,depth,.61,.54,.045,RF.soot);
 poly([[-.23,hh-.18],[-.29,hh+.20],[.16,hh+.24],[.22,hh-.19]],depth+.04,depth+.074,RF.iron);
 for(let side of [-1,1]){
  rod([side*.22,hh-.20,depth+.08],[side*.14,hh+.24,depth+.09],.035,RF.brass,0,9);
  rod([side*.10,hh-.15,depth+.10],[side*.13,hh+.15,depth+.10],.024,RF.light,0,7);
  fastener(side*.30,hh+.22,depth+.08,.021);
 }
 poly([[0,hh+.19],[.12,hh+.02],[0,hh-.13],[-.12,hh+.02]],depth+.09,depth+.13,P.glow,1.14);
 for(let j=0;j<3;j++)slab(.16,hh-.14+j*.12,depth+.11,.11,.020,.022,RF.dark);
 return M.finish();
}
function buildRobotEliteRig(kind){
 const M=robotMaker(),{panel,poly,rod,fastener,slab}=M,P=robotPalette(kind);
 const insect=['scout','charger'].includes(kind),flyer=['drone','medic'].includes(kind),big=['boss','brute','warden','artillery'].includes(kind);
 const headY=insect?1.30:flyer?1.45:2.18;
 for(const side of [-1,1]){
  rod([side*.24,headY-.12,-.05],[side*.35,headY+.25,-.02],.034,RF.iron,0,8);
  rod([side*.35,headY+.24,-.02],[side*.43,headY+.37,.08],.016,RF.light,0,6);
  panel(side*.43,headY+.36,.10,.11,.065,.095,P.glow,.86);
  if(big){
   poly([[side*.48,1.71],[side*.85,1.77],[side*.87,1.97],[side*.59,2.12]],-.20,.15,P.highlight);
   fastener(side*.71,1.87,.16,.025);
  }
 }
 slab(0,headY+.13,.02,.19,.12,.18,RF.dark);
 panel(0,headY+.14,.125,.13,.07,.037,P.glow,.69);
 return M.finish();
}
function buildRobotDebrisMesh(){
 const M=robotMaker(),{poly,panel}=M;
 poly([[-.28,-.14],[-.17,.20],[.12,.24],[.31,-.06],[.05,-.23]],-.06,.055,RF.steel);
 panel(-.045,.02,.07,.24,.05,.016,RF.light);
 return M.finish();
}
let robotDebrisMesh=null;
// Three enemy airframes have different, truly 3-D silhouettes; their cores,
// animated thrusters and shootable wing volumes remain the shared drone rig.
// All curved skin/joint geometry is baked once, not regenerated per frame.
function buildRobotAirframeVariant(kind){
 const M=robotMaker(),{ellipsoid,poly,panel,rod}=M;
 if(kind==='skyhunter'){
   // Fast interceptor: needle nose, swept feather-like forward wings, twin tails.
   ellipsoid(0,1.19,.25,.32,.19,.55,[.22,.31,.40],0,14,8);
   ellipsoid(0,1.21,.68,.10,.095,.17,[.37,.49,.56],.17,12,6);
   for(const side of [-1,1]){
     poly([[side*.32,1.28],[side*.73,1.40],[side*1.14,1.20],[side*.72,1.12]],-.31,.23,[.30,.40,.47]);
     rod([side*.48,1.35,.10],[side*1.02,1.22,-.19],.029,[.46,.58,.62],0,10);
     poly([[side*.52,1.31],[side*.64,1.55],[side*.91,1.57],[side*.85,1.27]],-.55,-.39,[.17,.24,.32]);
     ellipsoid(side*.84,1.00,-.38,.16,.12,.23,[.18,.25,.32],0,12,6);
   }
   rod([0,1.39,-.12],[0,1.48,-.50],.033,[.44,.56,.65],0,10);
 }else if(kind==='skyguard'){
   // Heavy hovering sentinel: recessed round command dome and shield nacelles.
   ellipsoid(0,1.28,.07,.43,.30,.43,[.30,.34,.40],0,14,7);
   ellipsoid(0,1.43,.26,.28,.13,.27,[.53,.53,.48],0,14,7);
   panel(0,1.33,.49,.47,.13,.085,[.68,.51,.26],.43);
   for(const side of [-1,1]){
     ellipsoid(side*.82,1.16,-.08,.27,.28,.40,[.36,.40,.44],0,10,6);
     ellipsoid(side*.82,1.13,.23,.17,.19,.13,[.57,.49,.35],.35,10,6);
     rod([side*.37,1.38,-.25],[side*.81,1.47,-.28],.078,[.47,.49,.48],0,12);
     poly([[side*.44,1.58],[side*.72,1.62],[side*.89,1.48],[side*.63,1.42]],-.48,-.12,[.52,.52,.49]);
   }
 }else if(kind==='stormray'){
   // Manta-style hunter: wide pinioned wings and smooth bioluminescent dorsal keel.
   ellipsoid(0,1.19,-.05,.39,.16,.51,[.19,.33,.36],0,16,8);
   ellipsoid(0,1.32,.25,.16,.085,.35,[.34,.58,.53],.25,14,7);
   for(const side of [-1,1]){
     poly([[0,1.17],[side*.46,1.33],[side*1.18,1.25],[side*.92,1.05],[side*.35,1.03]],-.59,.12,[.24,.42,.43]);
     rod([side*.24,1.27,.28],[side*1.03,1.21,-.37],.028,[.43,.69,.60],.13,12);
     ellipsoid(side*.70,1.13,-.36,.15,.085,.19,[.15,.27,.28],0,10,6);
     poly([[side*.16,1.30],[side*.31,1.52],[side*.48,1.56],[side*.53,1.32]],-.50,-.26,[.29,.49,.48]);
   }
 }
 return M.finish();
}
const airRobotVariants={};
function initRobotFoundry(){
  const keys=['scout','charger','shooter','brute','sniper','medic','warden','artillery','raider','drone','boss'];
  for(const kind of keys){
    robotFoundry[kind]={
      body:buildRobotBody(kind),bodyLite:buildRobotBody(kind,false),damage:buildRobotDamageOverlay(kind),
      limb:buildRobotLimb(kind,false),leg:buildRobotLimb(kind,true),
      insect:buildRobotInsectLeg(kind),thruster:buildRobotThruster(kind),
      sensor:buildRobotAnimatedSensors(kind),
      upperArm:buildRobotArticulatedPart(kind,'upperArm'),
      foreArm:buildRobotArticulatedPart(kind,'foreArm'),
      upperLeg:buildRobotArticulatedPart(kind,'upperLeg'),
      lowerLeg:buildRobotArticulatedPart(kind,'lowerLeg'),
      muzzle:buildRobotMuzzle(kind),reactor:buildRobotReactor(kind),servo:buildRobotServo(kind),
      armorChest:buildRobotArmorPlate(kind,'chest'),armorLeft:buildRobotArmorPlate(kind,'left'),
      armorRight:buildRobotArmorPlate(kind,'right'),exposed:buildRobotExposedPanel(kind),
      eliteRig:buildRobotEliteRig(kind)
    };
  }
 for(const kind of ['skyhunter','skyguard','stormray'])airRobotVariants[kind]=buildRobotAirframeVariant(kind);
 if(glReady)robotDebrisMesh=buildRobotDebrisMesh();
}
function drawEnemyModel(e,g,p){
  const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz);
  if(d>39 || e.dead)return;
  // Shared animated drone core; advanced flyers have individual airframe skins.
  const kind=e.boss?'boss':e.airborne?'drone':e.type,pack=robotFoundry[kind]||robotFoundry.shooter;
  if(!pack)return;
  // Advanced flyers have their own complete airframe. Rendering a whole
  // humanoid drone *under* the manta/interceptor skin superimposed two robots
  // (most obvious when a stormray came close to the camera).
  const completeAirframe=e.airborne?airRobotVariants[e.type]:null;
  const r=e.boss?1.75:Math.max(.76,Math.min(1.31,e.radius/.51));
  const floor=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
  const hover=kind==='drone'||kind==='medic';
  const dMotion=clamp(Number(e.robotMotion)||0,0,1);
  const phase=Number(e.robotCycle)||0;
  const bob=hover?Math.sin(g.t*3.2+e.id)*.048:
        (Math.sin(phase*2)*.030*dMotion + Math.sin(g.t*.8+e.id)*.006);
  const foot=floor+bob+(hover?.13:0);
  const yaw=Number.isFinite(e.robotYaw)?e.robotYaw:Math.atan2(p.x-e.x,p.z-e.z),ss=Math.sin(yaw),cc=Math.cos(yaw);
  const world=(x,y,z)=>[e.x+x*cc+z*ss,foot+y,-x*ss+e.z+z*cc];
  const mobile=touchOnly||save.settings.quality===0;
  const full=(!mobile&&d<18)||(mobile&&d<8)||(e.boss&&d<20);
  const reduced=(!full || (save.settings.quality===0&&d>5));
  const tint=e.flash>0?[1.22,1.10,1.08]:e.airborne?
    e.color.map(c=>.76+.49*c):[1,1,1];
  const pitchOffset=e.stun>0?Math.sin(g.t*17+e.id)*.03:0;
  gl.uniform1f(u.uMatOverride,4);
  gl.uniform1f(u.uRobotDamage,clamp(1-e.hp/Math.max(1,e.maxhp),0,1));
  const hitKick=Math.max(0,Number(e.hitReact)||0);
  const hitTilt=hitKick*.33*Math.sin((.24-hitKick)*34);
  const turnLean=Number(e.robotLean)||0;
  const inertia=Number(e.robotInertia)||0;
  const attackPulse=Number(e.attackPulse)||0;
  const servoPitch=(e.boss?0.025:0.015)*Math.sin(g.t*1.15+e.id*.68);
  const bodyTilt=clamp(hitTilt+turnLean*.43-inertia*.22+servoPitch,-.3,.3);
  try{
    // Mobile and distant targets keep the existing low-detail silhouette;
    // the advanced mesh is reserved for close inspection / high detail.
    if(completeAirframe&&full)draw(completeAirframe,e.x,foot,e.z,r,r,r,yaw,tint,0,bodyTilt);
    else draw((full?pack.body:pack.bodyLite)||pack.body,e.x,foot,e.z,r,r,r,yaw,tint,0,bodyTilt);
    // Armor has a *visible lifecycle*: protruding plates break away permanently.
    // Stage is derived from HP, so older saves load without extra migration.
    if(full&&!completeAirframe){
      const condition=e.maxProtection>0?clamp((e.protection||0)/e.maxProtection,0,1):clamp(e.hp/Math.max(1,e.maxhp),0,1);
      if(condition>.46 && pack.armorChest)draw(pack.armorChest,e.x,foot,e.z,r,r,r,yaw,tint,0,bodyTilt);
      else if(pack.exposed)draw(pack.exposed,e.x,foot,e.z,r,r,r,yaw,tint,.11+(Number(e.robotDamageHeat)||0)*.12,bodyTilt);
      if(condition>.71 && pack.armorLeft)draw(pack.armorLeft,e.x,foot,e.z,r,r,r,yaw,tint,0,bodyTilt);
      if(condition>.29 && pack.armorRight)draw(pack.armorRight,e.x,foot,e.z,r,r,r,yaw,tint,0,bodyTilt);
      if((e.elite||e.boss)&&pack.eliteRig)draw(pack.eliteRig,e.x,foot,e.z,r,r,r,yaw,tint,.07,bodyTilt);
      // Volumetric optic flare; brighter when target is locked or taking aim.
      const opticPower=e.telegraph>0?.84:(e.attack<.37?.46:.13);
      const flicker=e.stun>0?.3:.85+.15*Math.sin(g.t*9+e.id);
      const yy=kind==='scout'||kind==='charger'?r*1.03:kind==='drone'?r*1.06:r*1.94;
      const zz=kind==='scout'||kind==='charger'?r*.92:kind==='drone'?r*1.04:r*.51;
      const at=world(0,yy,zz);
      if(d<(mobile?4.5:13) && e.spawn>.2){
        draw(geom.orb,...at,r*.046,r*.029,r*.014,yaw,e.color,opticPower*flicker*.7);
      }
    }
    if(kind==='drone'){
      for(const side of [-1,1]){
        if(!reduced){
          const pt=world(side*r*.97,r*1.06,-r*.28);
          draw(pack.thruster,...pt,r*.65,r*.65,r*.65,yaw+g.t*(side>0?3.4:-3.4),tint,0,turnLean*side*.6);
        }
      }
    }else if(kind==='scout'||kind==='charger'){
      const n=reduced?2:4;
      for(let j=0;j<n;j++){
        const side=j%2?1:-1,front=n===2?1:(j<2?1:-1);
        const pt=world(side*r*.39,r*.91,front*r*.36);
        const swing=(Math.sin(phase+side*1.70+front*2.2)*.28 + turnLean*side*.38)*dMotion;
        draw(pack.insect,...pt,r,r,r,yaw+(side<0?Math.PI:0),tint,0,swing);
      }
      if(full && pack.sensor){
        draw(pack.sensor,e.x,foot,e.z,r,r,r,yaw+Math.sin(g.t*1.35+e.id)*.045,tint,0);
      }
    }else if(kind==='medic'){
      if(full){
        const C=enemies.medic.color,pt=world(0,r*.67,0);
        draw(geom.ring,...pt,r*.91,.044*r,r*.91,g.t*.54,C,.24);
      }
    }else{
      for(const side of [-1,1]){
        const step=Math.sin(phase+(side>0?Math.PI:0));
        const reverse=1-2*clamp(Number(e.robotReverse)||0,0,1);
        const strafe=clamp(Number(e.robotStrafe)||0,-1,1);
        const stride=(step*reverse+strafe*.28)*.25*dMotion;
        const stepLift=Math.pow(Math.max(0,step),1.4)*.14*dMotion;
        const hBase=.92*r;
        const legPt=world(side*r*.25,hBase+stepLift*r,-stride*.09*r);
        const armPt=world(side*r*.52,1.44*r,step*.04*r*dMotion);
        if(!reduced && pack.upperLeg && pack.lowerLeg){
          const legTilt=stride*.7;
          draw(pack.upperLeg,...legPt,r,r,r,yaw,tint,0,legTilt);
          const kneePt=world(side*r*.25,hBase+stepLift*r-.42*r*Math.cos(legTilt),
            -stride*.09*r-.42*r*Math.sin(legTilt));
          const kneeTilt=-legTilt*.65+stepLift*.47+(e.type==='raider'?.04:0);
          draw(pack.lowerLeg,...kneePt,r,r,r,yaw,tint,0,kneeTilt);
        }else{
          draw(pack.leg,...legPt,r,r,r,yaw,tint,0,stride*.55);
        }
        if(!reduced && pack.upperArm && pack.foreArm){
          const armTilt=-stride*.39-(kind==='sniper'?.04:0)+attackPulse*.95 +(Number(e.robotAttackState)||0)*.25;
          draw(pack.upperArm,...armPt,r,r,r,yaw,tint,0,armTilt);
          const elbowPt=world(side*r*.52,1.44*r-.405*r*Math.cos(armTilt),
            step*.04*r*dMotion-.405*r*Math.sin(armTilt));
          draw(pack.foreArm,...elbowPt,r,r,r,yaw,tint,0,-armTilt*.52+.045+attackPulse*.18);
        }else if(e.boss||d<17){
          draw(pack.limb,...armPt,r,r,r,yaw,tint,0,-stride*.30);
        }
      }
      if(full&&pack.sensor){
        // Fine optic module turns with small independent tracking micro-movements.
        const scan=Math.sin(g.t*1.45+e.id*.48)*.028+pitchOffset;
        const eyeYaw=Number.isFinite(e.robotEyeYaw)?e.robotEyeYaw:yaw;
        draw(pack.sensor,e.x,foot,e.z,r,r,r,eyeYaw+scan,tint,0);
        if(pack.servo && d<12){
          // Independent trackable jaw, with subtle vertical servo vibration.
          draw(pack.servo,e.x,foot+Math.sin(g.t*4.2+e.id)*.006*r,e.z,r,r,r,eyeYaw+scan,tint,0);
        }
      }
      if(e.boss&&full){
        const col=e.color||[.91,.42,.21];
        for(const side of [-1,1]){
          const pt=world(side*r*.78,r*1.53,r*.62);
          draw(geom.cylinder,...pt,r*.106,r*.106,r*.23,yaw,col,.24);
        }
      }
    }
    if(full&&(Number(e.attackPulse)||0)>0.005&&pack.muzzle){
      const f=clamp((Number(e.attackPulse)||0)/.19,0,1);
      const offset=kind==='scout'||kind==='charger'?[0,r*.95,r*.97]:kind==='drone'?[0,r*1.03,r*1.04]:kind==='artillery'||kind==='boss'?[r*.65,r*1.49,r*.58]:[r*.54,r*.92,r*.75];
      const pt=world(...offset);
      draw(pack.muzzle,...pt,r*(.60+f*.56),r*(.60+f*.56),r*(.60+f*.56),yaw,tint,f*1.35);
    }
    if(full&&e.hp/e.maxhp<.54&&pack.damage){
      draw(pack.damage,e.x,foot,e.z,r,r,r,yaw,[1,1,1],0);
    }
    if(e.elite&&full){
      const pt=world(0,r*.98,-r*.24);
      draw(geom.ring,...pt,r*.58,.027*r,r*.58,g.t*.20,[.74,.43,.18],.13);
    }
    // Dying armor: a compact vent at the reactor, not a permanent floor shadow.
    if(e.hp<e.maxhp*.47&&full){
      // Reactor heat pulse reveals inner mechanics through broken armor.
      const damage=clamp(1-e.hp/Math.max(1,e.maxhp),0,1);
      const pulse=.09+.30*Math.max(0,Math.sin(g.t*(9+damage*9)+e.id)) + (Number(e.robotDamageHeat)||0)*.25;
      if(pack.reactor && d<(mobile?6.5:20))draw(pack.reactor,e.x,foot,e.z,r,r,r,yaw,[1,1,1],pulse);
    }
    if(e.maxhp>=120){
      const health=clamp(e.hp/e.maxhp,0,1),pt=world(0,r*2.44,0);
      draw(geom.cube,...pt,r*1.45,.038,.085,yaw,RF.dark,0);
      const hpPt=world(-r*.725*(1-health),r*2.445,.015);
      draw(geom.cube,...hpPt,r*1.45*health,.042,.087,yaw,health>.33?[.25,.79,.59]:[.92,.30,.23],.54);
    }
  }finally{
    gl.uniform1f(u.uMatOverride,-1);
    gl.uniform1f(u.uRobotDamage,0);
  }
}
// THIRD-PERSON OPERATOR. Single-source armor palette for the hangar preview
// and the in-world character. No new libraries or network assets.
const OPERATOR_CAMERA_DISTANCE=3.35;
function thirdPersonEnabled(){return save.settings.cameraMode==='third';}
function secondPersonEnabled(){return save.settings.cameraMode==='second';}
function externalCameraEnabled(){return thirdPersonEnabled()||secondPersonEnabled();}
function cameraModeLabel(){return secondPersonEnabled()?'ВТОРОЕ ЛИЦО':thirdPersonEnabled()?'ТРЕТЬЕ ЛИЦО':'ПЕРВОЕ ЛИЦО';}
function operatorColor(c,k=1){return c.map(v=>clamp(v*k,0,1));}
function operatorSuit(id){return Number.isInteger(id)&&id>=0?BODY_ARMOR_CATALOG[id]||null:null;}
function operatorPalette(id){
 const suit=operatorSuit(id);
 const primary=suit?suit.color:[.19,.275,.32];
 const grade=id<0?0:id+1;
 const accent=grade<1?[.31,.70,.79]:grade<5?[.43,.87,.98]:grade<9?[.75,.59,.99]:[.98,.75,.39];
 return {grade,primary,accent,shadow:operatorColor(primary,.40),light:operatorColor(primary,1.37),black:[.045,.069,.088],joint:[.16,.21,.25],fabric:[.095,.145,.18],visor:[.09,.28,.36]};
}
function normalizedAim(p){
 const c=Math.cos(p.pitch);
 return {x:Math.sin(p.yaw)*c,y:Math.sin(p.pitch),z:Math.cos(p.yaw)*c};
}
function thirdPersonCameraPose(p){
 const focus={x:p.x,y:1.46+(p.feetY||0),z:p.z};
 const forward=normalizedAim(p),right={x:Math.cos(p.yaw),y:0,z:-Math.sin(p.yaw)};
 const desired={x:focus.x-forward.x*OPERATOR_CAMERA_DISTANCE+right.x*.42,
  y:focus.y-forward.y*OPERATOR_CAMERA_DISTANCE+.57,
  z:focus.z-forward.z*OPERATOR_CAMERA_DISTANCE+right.z*.42};
 const vector={x:desired.x-focus.x,y:desired.y-focus.y,z:desired.z-focus.z};
 const total=Math.hypot(vector.x,vector.y,vector.z)||1;
 const trace={x:vector.x/total,y:vector.y/total,z:vector.z/total};
 // A single 3D swept camera sphere catches railings and overhead beams,
 // even when the center ray just misses the edge. It cannot phase through
 // the same static solids that block rockets or enemy plasma.
 const hit=sweepWorldSphere(focus,trace,total,.17);
 const allowed=hit?Math.max(0,hit.t-.08):total;
 if(allowed<1.05){
  // A temporary shoulder-to-eye fallback prevents the model filling the screen
  // when backing against a wall. The selected camera mode is not lost.
  return {eye:[focus.x,focus.y,focus.z],dir:[forward.x,forward.y,forward.z],drawActor:false,distance:0};
 }
 const k=allowed/total,eye=[focus.x+vector.x*k,focus.y+vector.y*k,focus.z+vector.z*k];
 const far=[focus.x+forward.x*14,focus.y+forward.y*14,focus.z+forward.z*14];
 const d=[far[0]-eye[0],far[1]-eye[1],far[2]-eye[2]];
 const len=Math.hypot(...d)||1;
 return {eye,dir:d.map(x=>x/len),drawActor:true,distance:allowed};
}
// Second person: the camera stays in front of the operator and looks back at
// their helmet/armor. Movement and weapon direction remain the operator's
// forward direction, not the camera's reversed viewing direction.
function secondPersonCameraPose(p){
 const focus={x:p.x,y:1.46+(p.feetY||0),z:p.z};
 const front={x:Math.sin(p.yaw),z:Math.cos(p.yaw)};
 const right={x:Math.cos(p.yaw),z:-Math.sin(p.yaw)};
 const desired={x:focus.x+front.x*3.35+right.x*.17,
  y:focus.y+.38,z:focus.z+front.z*3.35+right.z*.17};
 const vx=desired.x-focus.x,vy=desired.y-focus.y,vz=desired.z-focus.z;
 const total=Math.hypot(vx,vy,vz)||1;
 const ray={x:vx/total,y:vy/total,z:vz/total};
 const hit=sweepWorldSphere(focus,ray,total,.17);
 const allowed=hit?Math.max(0,hit.t-.08):total;
 if(allowed<1.05){
  const look=normalizedAim(p);
  return {eye:[focus.x,focus.y,focus.z],dir:[look.x,look.y,look.z],drawActor:false,distance:0};
 }
 const k=allowed/total,eye=[focus.x+vx*k,focus.y+vy*k,focus.z+vz*k];
 const target=[focus.x,focus.y+.05,focus.z];
 const d=[target[0]-eye[0],target[1]-eye[1],target[2]-eye[2]];
 const len=Math.hypot(...d)||1;
 return {eye,dir:d.map(x=>x/len),drawActor:true,distance:allowed};
}
function operatorCameraPose(p){return secondPersonEnabled()?secondPersonCameraPose(p):thirdPersonCameraPose(p);}
function aimFromOperator(origin){
 // In the front-facing mode the camera looks backward at the player, so
 // projecting the reticle ray through it would make shots fire backward.
 if(!thirdPersonEnabled()||!game)return normalizedAim(game?.p||{yaw:0,pitch:0});
 const cam=thirdPersonCameraPose(game.p);
 if(!cam.drawActor)return normalizedAim(game.p);
 const from={x:cam.eye[0],y:cam.eye[1],z:cam.eye[2]};
 const ray={x:cam.dir[0],y:cam.dir[1],z:cam.dir[2]};
 const wall=rayWall(from,ray,80),limit=wall?wall.t:80;
 const node=rayNode(from,ray,limit);
 const enemy=rayEnemy(from,ray,node?node.t:limit);
 const hit=enemy||node||wall;
 const depth=hit?hit.t:80;
 const target={x:from.x+ray.x*depth,y:from.y+ray.y*depth,z:from.z+ray.z*depth};
 const dx=target.x-origin.x,dy=target.y-origin.y,dz=target.z-origin.z;
 const length=Math.hypot(dx,dy,dz);
 const forward=normalizedAim(game.p);
 if(length<.18||(dx*forward.x+dy*forward.y+dz*forward.z)<.15)return forward;
 return {x:dx/length,y:dy/length,z:dz/length};
}
// Local head rotation around the base of the helmet. Rotating every helmet
// component around its own center caused the visor/cheeks to separate.
// Positive camera pitch lifts the FACE, without bending the torso.
function operatorHeadPose(p,x,y,z){
 const pitch=clamp(Number(p.pitch)||0,-1.08,1.06)*.82;
 const c=Math.cos(pitch),s=Math.sin(pitch),neckY=1.58,neckZ=.025;
 const dy=y-neckY,dz=z-neckZ;
 return {x,y:neckY+dy*c+dz*s,z:neckZ+dz*c-dy*s,tilt:-pitch};
}
// A third-person weapon uses the same ten distinctive silhouette families as
// the cockpit weapon. All components share a glove pivot and rise with camera
// pitch; the old universal rectangular club is completely removed.
function renderOperatorWeapon(g,p,block,c){
 const idx=clamp(p.weapon|0,0,weapons.length-1),w=weapons[idx];
 const dark=[.095,.13,.16],black=[.032,.05,.065],steel=[.35,.43,.48],
  mid=[.18,.26,.32],bronze=[.42,.31,.20],edge=[.54,.62,.66],glow=w.color;
 const pitch=clamp(Number(p.pitch)||0,-1.08,1.06),si=Math.sin(pitch),co=Math.cos(pitch);
 const recoil=Math.min(.06,(p.recoil||0)*.08),bob=p.walk?Math.sin(g.t*11)*.012:0;
 const pivotX=.39,pivotY=.98,pivotZ=.20;
 const part=(x,y,z,sx,sy,sz,color,shine=0,mesh=geom.bevel)=>{
  const forward=z-recoil;
  block(pivotX+x,pivotY+y*co+forward*si+bob,pivotZ+forward*co-y*si,
   sx,sy,sz,color,shine,mesh,-pitch);
 };
 const compact=idx===5||idx===9,heavy=idx===2||idx===4||idx===8;
 const twin=idx===1||idx===8,long=idx===2||idx===6;
 const bodyLen=compact?.27:heavy?.47:.37;
 const barrelLen=long?.66:compact?.21:heavy?.46:.39;
 const bw=twin?.095:idx===4?.15:idx===2?.055:.077;
 // Stock, receiver, ergonomic grip and a support hand stay connected.
 part(0,.064,-.12,.18,.13,.23,dark);
 part(0,.09,.22,.245,.18,bodyLen,mid,0,geom.rounded||geom.bevel);
 part(0,.194,.22,.225,.054,bodyLen*.9,steel);
 part(0,.052,.22,.24,.08,bodyLen*.72,dark);
 part(.11,.12,.21,.030,.105,bodyLen*.73,edge);
 part(-.11,.12,.21,.030,.105,bodyLen*.73,black);
 part(0,-.10,.025,.09,.21,.11,black);
 part(0,-.12,.22,.12,.17,.12,bronze);
 part(0,.25,.19,.095,.085,.15,black);
 part(0,.305,.20,.065,.025,.07,glow,.6);
 // Circular barrels are short, visibly hollow-looking tubes rather than
 // a solid rectangular beam through the character's shoulder.
 const muzzle=.55+(long?.09:compact?-.085:0);
 if(twin){
  for(const x of [-.088,.088]){
   part(x,.115,muzzle,.095,.095,barrelLen,steel,0,geom.cylinder);
   part(x,.115,muzzle+barrelLen*.43,.105,.105,.075,black,0,geom.cylinder);
  }
 }else if(idx===6){
  for(const x of [-.097,0,.097]){
   part(x,.123,muzzle,.072,.072,barrelLen,steel,0,geom.cylinder);
   part(x,.123,muzzle+barrelLen*.43,.085,.085,.065,black,0,geom.cylinder);
  }
 }else{
  part(0,.125,muzzle,bw,bw,barrelLen,steel,0,geom.cylinder);
  part(0,.125,muzzle+barrelLen*.44,bw*1.25,bw*1.25,.09,black,0,geom.cylinder);
 }
 if(!compact){
  part(-.18,-.06,.34,.18,.14,.18,c.joint,0,geom.rounded||geom.bevel);
 }
 if(idx===0){ // Impulse carbine: slender barrel, optic and side vent.
  part(.145,.17,.35,.045,.075,.28,steel);
  part(-.15,.17,.35,.045,.075,.28,steel);
 }else if(idx===1){ // Shotgun: twin pipes, deep pump shroud.
  part(0,-.01,.46,.27,.17,.24,black);
  part(0,.20,.40,.21,.04,.24,bronze);
 }else if(idx===2){ // Railgun: spaced rails and illuminated coil cells.
  for(const side of [-1,1])part(side*.155,.115,.52,.045,.08,.72,black);
  for(let j=0;j<4;j++)part(0,.216,.37+j*.16,.30,.042,.045,glow,.75);
  part(0,.23,.80,.12,.09,.22,edge);
 }else if(idx===3){ // Machine gun: large ammo box and cooling fins.
  part(.13,-.14,.14,.22,.28,.22,black);
  for(let j=0;j<5;j++)part(0,.12,.43+j*.10,.29,.03,.038,edge);
 }else if(idx===4){ // Rocket launcher: high-caliber tube, ring cage.
  part(0,.10,.44,.32,.30,.53,mid,0,geom.cylinder);
  part(0,.10,.75,.34,.34,.08,black,0,geom.cylinder);
  for(const side of [-1,1])part(side*.16,.10,.51,.035,.10,.40,bronze);
 }else if(idx===5){ // Vector: compact, thick forward compensator.
  part(.12,-.07,.22,.105,.22,.14,black);
  part(0,.12,.65,.18,.18,.12,edge,0,geom.cylinder);
 }else if(idx===6){ // Triad: triple independent muzzle guides.
  for(const side of [-1,1])part(side*.14,.16,.46,.043,.045,.38,glow,.4);
 }else if(idx===7){ // Ion: two exposed glowing charge chambers.
  for(const side of [-1,1]){
   part(side*.14,.11,.42,.094,.13,.32,black,0,geom.cylinder);
   part(side*.14,.11,.48,.052,.065,.23,glow,1.1,geom.cylinder);
  }
 }else if(idx===8){ // Grenade launcher: rotating drum.
  part(0,-.065,.25,.32,.30,.30,bronze,0,geom.cylinder);
  for(const side of [-1,1])part(side*.14,-.07,.25,.085,.09,.33,black,0,geom.cylinder);
 }else if(idx===9){ // Cryo emitter: refrigerated twin reservoirs.
  for(const side of [-1,1]){
   part(side*.115,.14,.35,.075,.10,.27,black,0,geom.cylinder);
   part(side*.115,.15,.39,.043,.07,.22,glow,.8,geom.cylinder);
  }
  part(0,.245,.40,.13,.085,.13,edge);
 }
 if((p.shotGlow||0)>.015){
  const power=clamp(p.shotGlow*7,0,1);
  part(0,.12,muzzle+barrelLen*.5,.11+power*.10,.11+power*.10,.19,glow,1.9,geom.orb);
 }
}
function renderOperator(g,p){
 if(!glReady)return;
 const suitId=p.bodyArmorType>=0?p.bodyArmorType:-1;
 const c=operatorPalette(suitId),w=weapons[p.weapon];
 const yaw=p.yaw,cs=Math.cos(yaw),sn=Math.sin(yaw),feet=p.feetY||0;
 const suitLevel=suitId>=0?(Number(save.bodyArmor?.owned?.[suitId])||0):0;
 const wear=(p.bodyArmorMax>0)?clamp((p.bodyArmor||0)/p.bodyArmorMax,0,1):1;
 const point=(x,y,z)=>[p.x+x*cs+z*sn,feet+y,p.z-x*sn+z*cs];
 const block=(x,y,z,sx,sy,sz,color,shine=0,mesh=geom.bevel,tilt=0)=>draw(mesh,...point(x,y,z),sx,sy,sz,yaw,color,shine,tilt);
 // Curved breastplate and helmet; cheap faceted parts remain at mobile LOD.
 const shell=geom.rounded||geom.bevel;
 const limbShell=((typeof touchOnly!=='undefined'&&touchOnly)||save.settings.quality===0)?geom.bevel:shell;
 const move=p.walk?Math.sin(g.t*11.5)*.28:Math.sin(g.t*1.7)*.015;
 const degree=c.grade,armored=degree>0;
 // Independent legs with armor shells, ankle joints, boot treads and toe caps.
 for(const side of [-1,1]){
  const x=side*.175,phase=move*side;
  block(x,.77,.012,.245,.25,.255,c.shadow,0,geom.bevel,phase*.45);
  block(x,.60,phase*.24,.20,.38,.20,c.fabric,0,limbShell,phase);
  block(x,.52,phase*.27+.032,.225,.19,.255,armored?c.light:c.joint);
  block(x,.36,phase*.35,.19,.30,.20,armored?c.primary:c.fabric,0,limbShell,-phase*.7);
  block(x,.24,phase*.41+.025,.22,.10,.26,c.black);
  block(x,.11,phase*.45+.065,.27,.20,.42,c.shadow,0,limbShell);
  block(x,.10,phase*.45+.18,.265,.10,.23,armored?c.light:c.joint);
  if(armored){block(x,.54,phase*.26+.15,.17,.045,.025,c.accent,.24);block(x,.30,phase*.34+.12,.13,.08,.06,c.light);}
 }
 // Belt with visible equipment and rear canisters.
 block(0,.88,0,.47,.20,.27,c.black);
 block(0,.88,.16,.19,.095,.048,c.light);
 for(const side of [-1,1])block(side*.25,.86,-.015,.09,.17,.21,c.shadow);
 // Ballistic torso: segmented breastplates, collar, spine, breathing tubes.
 block(0,1.18,-.005,.58,.60,.32,armored?c.primary:c.fabric,0,shell);
 block(0,1.19,.175,.49,.44,.07,c.light);
 block(0,1.17,.215,.09,.37,.05,c.shadow);
 for(const side of [-1,1]){
  block(side*.16,1.26,.222,.13,.23,.055,armored?c.primary:c.joint);
  block(side*.19,1.46,.145,.24,.12,.23,c.shadow);
  block(side*.35,1.41,0,.275,armored?.28:.23,.34,armored?c.light:c.joint,0,limbShell);
  // Shoulder actuator, upper arm, forearm gauntlet and gloves.
  block(side*.39,1.22,.015,.18,.23,.185,c.joint,0,geom.cylinder,-move*.26*side);
  block(side*.41,1.065,.09,.175,.28,.20,armored?c.primary:c.fabric,0,limbShell,-move*.21*side);
  block(side*.40,.95,.18,.20,.16,.21,armored?c.light:c.joint);
  block(side*.40,.865,.20,.15,.16,.19,c.black);
  if(armored){block(side*.33,1.43,.16,.09,.095,.06,c.accent,.22);block(side*.40,1.02,.218,.125,.035,.035,c.accent,.12);}
 }
 // Reinforced back frame and layered exhaust vents on advanced suits.
 block(0,1.18,-.225,.45,.43,.16,c.shadow);
 for(const side of [-1,1]){
  block(side*.17,1.12,-.334,.12,.33,.12,c.black);
  if(degree>=4)block(side*.17,1.12,-.405,.085,.23,.07,c.light);
  if(degree>=7)block(side*.17,1.19,-.442,.048,.18,.038,c.accent,.42);
 }
 block(0,1.54,0,.275,.19,.24,c.joint);
 // Anatomically layered helmet, chin, cheeks, visor and optic strip.
 const headBlock=(x,y,z,sx,sy,sz,color,shine=0,mesh=shell)=>{
  const h=operatorHeadPose(p,x,y,z);
  block(h.x,h.y,h.z,sx,sy,sz,color,shine,mesh,h.tilt);
 };
 headBlock(0,1.75,.012,.345,.35,.31,armored?c.primary:c.fabric);
 headBlock(0,1.82,.18,.30,.17,.13,c.black);
 headBlock(0,1.805,.252,.26,.086,.045,c.visor,.18);
 headBlock(0,1.70,.212,.265,.115,.08,armored?c.light:c.joint);
 headBlock(0,1.645,.185,.19,.08,.11,c.black);
 for(const side of [-1,1]){
  headBlock(side*.18,1.74,.03,.085,.24,.23,c.shadow,0,limbShell);
  headBlock(side*.195,1.81,.10,.055,.09,.085,c.accent,.39);
  headBlock(side*.114,1.83,.29,.069,.024,.02,c.accent,.5);
 }
 headBlock(0,1.957,.0,.21,.055,.19,c.light);
 if(degree>=3){
  headBlock(0,2.005,-.06,.08,.12,.11,c.accent,.28);
  headBlock(0,1.82,-.31,.18,.18,.14,c.shadow);
 }
 if(suitLevel>=5){
  // Refinement upgrades add visible hardware every five purchased levels.
  for(const side of [-1,1])block(side*.24,1.15,.257,.035,.24,.031,c.accent,.25);
 }
 if(suitLevel>=10)block(0,1.40,.265,.23,.045,.03,c.accent,.42);
 if(suitLevel>=15)for(const side of [-1,1])block(side*.17,.62,.193,.105,.04,.04,c.accent,.34);
 if(suitLevel>=20)headBlock(0,1.98,.02,.13,.035,.10,c.accent,.65);
 if(armored&&wear<.25){
  // Broken armor remains equipped but loses bright plating as durability falls.
  for(const side of [-1,1])block(side*.14,1.24,.264,.13,.035,.024,c.black,.0);
 }
 if(degree>=9){
  // High-tier rear antenna and luminous spinal conduits are visibly distinct.
  headBlock(0,1.96,-.34,.035,.41,.035,c.light);
  headBlock(0,2.16,-.34,.075,.075,.075,c.accent,.72,geom.orb);
  for(const side of [-1,1])block(side*.11,1.27,-.51,.035,.33,.035,c.accent,.45);
 }
 renderOperatorWeapon(g,p,block,c);
 if(p.shield>0){
  draw(geom.ring,p.x,feet+1.12,p.z,1.10,1.10,1.10,g.t*1.9,[.33,.88,1],1.0,.30);
 }
}
// The same grade/shape language rendered as a cheap illustrated hangar preview.
function renderArmorPreview(canvas,id){
 if(!canvas)return;
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const W=canvas.width,H=canvas.height,c=operatorPalette(id);
 const rgb=(arr,k=1)=>`rgb(${arr.map(v=>Math.round(clamp(v*k,0,1)*255)).join(',')})`;
 ctx.clearRect(0,0,W,H);
 const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#1b313c');bg.addColorStop(.55,'#081721');bg.addColorStop(1,'#030c13');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 ctx.strokeStyle='#31565c88';ctx.lineWidth=1;
 for(let y=24;y<H;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
 const plate=(x,y,w,h,col,stroke='#030a13')=>{
  ctx.beginPath();ctx.moveTo(x-w*.42,y-h*.5);ctx.lineTo(x+w*.42,y-h*.5);ctx.lineTo(x+w*.5,y-h*.32);ctx.lineTo(x+w*.48,y+h*.34);ctx.lineTo(x+w*.29,y+h*.5);ctx.lineTo(x-w*.29,y+h*.5);ctx.lineTo(x-w*.48,y+h*.34);ctx.lineTo(x-w*.5,y-h*.32);ctx.closePath();ctx.fillStyle=col;ctx.fill();ctx.lineWidth=3;ctx.strokeStyle=stroke;ctx.stroke();
 };
 ctx.save();ctx.translate(W/2,H*.52);const scale=Math.min(W/195,H/320);ctx.scale(scale,scale);
 // Back to front: articulated legs, arms, chest, head, weapon.
 for(const s of [-1,1]){
  plate(s*34,74,49,97,rgb(c.fabric));plate(s*34,127,46,44,rgb(c.primary));plate(s*34,169,52,43,rgb(c.shadow));
  plate(s*81,-24,50,52,rgb(c.shadow));plate(s*84,20,43,64,rgb(c.primary));plate(s*85,68,42,39,rgb(c.light));
 }
 plate(0,55,105,46,rgb(c.black));plate(0,-28,122,127,rgb(c.shadow));plate(0,-45,111,93,rgb(c.primary));
 for(const s of [-1,1]){plate(s*27,-50,49,67,rgb(c.light));plate(s*64,-90,49,30,rgb(c.light));}
 plate(0,-96,43,27,rgb(c.black));plate(0,-140,73,79,rgb(c.primary));plate(0,-141,69,28,rgb(c.black));plate(0,-138,61,14,rgb(c.visor));plate(0,-121,53,14,rgb(c.light));
 ctx.fillStyle=rgb(c.accent);for(const s of [-1,1])ctx.fillRect(s*25-12,-140,22,5);
 plate(34,30,46,106,'#15252a');plate(34,-16,47,23,rgb(c.light));plate(34,-45,31,20,rgb(c.accent));
 if(c.grade>=8){ctx.strokeStyle=rgb(c.accent);ctx.lineWidth=3;ctx.strokeRect(-70,-93,140,149);}
 ctx.restore();ctx.font='700 12px ui-monospace,monospace';ctx.textAlign='center';ctx.fillStyle='#b6e1e9';ctx.fillText(id<0?'БАЗОВАЯ ФОРМА':'БРОНЯ / КЛАСС '+String(id+1).padStart(2,'0'),W/2,H-12);
}
function refreshCameraInterface(){
 const active=externalCameraEnabled();
 document.body.classList.toggle('thirdPerson',active);
 document.body.classList.toggle('secondPerson',secondPersonEnabled());
 const touchButton=$('viewTouch');
 if(touchButton){touchButton.textContent=secondPersonEnabled()?'◉ СПЕРЕДИ':thirdPersonEnabled()?'◧ 3D ВИД':'◫ ВИД';touchButton.setAttribute('aria-pressed',String(active));touchButton.setAttribute('aria-label','Камера: '+cameraModeLabel()+'. Переключить вид');}
}
function toggleCameraMode(){
 save.settings.cameraMode=thirdPersonEnabled()?'second':secondPersonEnabled()?'first':'third';
 persist();refreshCameraInterface();
 if(game?.state==='playing')toast('КАМЕРА: '+cameraModeLabel()+(secondPersonEnabled()?' · ОРУЖИЕ СТРЕЛЯЕТ ВПЕРЁД':''),1.65);
 return save.settings.cameraMode;
}
// Canvas-only silhouette (software raycaster) shares the selected armor palette.
function drawFallbackOperator(ctx,p,size){
 const c=operatorPalette(p.bodyArmorType),S=Math.max(35,size*.56);
 const rgb=(arr,k=1)=>`rgb(${arr.map(v=>Math.round(clamp(v*k,0,1)*255)).join(',')})`;
 const plate=(x,y,w,h,col)=>{
  ctx.beginPath();
  if(typeof ctx.quadraticCurveTo==='function'){
    const a=x-w*.50,b=x+w*.50,t=y-h*.50,d=y+h*.50,r=Math.min(w,h)*.19;
    ctx.moveTo(a+r,t);ctx.lineTo(b-r,t);ctx.quadraticCurveTo(b,t,b,t+r);
    ctx.lineTo(b,d-r);ctx.quadraticCurveTo(b,d,b-r,d);
    ctx.lineTo(a+r,d);ctx.quadraticCurveTo(a,d,a,d-r);
    ctx.lineTo(a,t+r);ctx.quadraticCurveTo(a,t,a+r,t);
  }else{
    ctx.moveTo(x-w*.45,y-h*.48);ctx.lineTo(x+w*.45,y-h*.48);
    ctx.lineTo(x+w*.5,y+h*.30);ctx.lineTo(x+w*.3,y+h*.5);
    ctx.lineTo(x-w*.3,y+h*.5);ctx.lineTo(x-w*.5,y+h*.30);
  }
  ctx.closePath();ctx.fillStyle=col;ctx.fill();ctx.strokeStyle='#06111b';ctx.lineWidth=.014;ctx.stroke();
 };
 ctx.save();ctx.scale(S,S);ctx.translate(0,.065);
 for(const s of [-1,1]){
  plate(s*.19,.27,.27,.48,rgb(c.shadow));plate(s*.19,.50,.25,.16,rgb(c.light));
  plate(s*.36,-.16,.27,.43,rgb(c.primary));plate(s*.40,.12,.24,.30,rgb(c.shadow));
  plate(s*.19,.64,.30,.16,rgb(c.shadow));
 }
 plate(0,-.01,.68,.24,rgb(c.black));plate(0,-.28,.81,.78,rgb(c.primary));
 plate(0,-.28,.69,.59,rgb(c.light));plate(0,-.31,.08,.45,rgb(c.shadow));
 // A single neck-pivot rotation keeps the fallback visor/chin attached to
 // the looking head, as in the fully three-dimensional operator.
 plate(0,-.73,.24,.24,rgb(c.joint));
 ctx.save();ctx.translate(0,-.73);ctx.rotate(-clamp(p.pitch||0,-1.08,1.06)*.30);
 plate(0,-.20,.54,.48,rgb(c.primary));
 plate(0,-.18,.45,.16,rgb(c.black));plate(0,-.18,.39,.064,rgb(c.visor));
 ctx.restore();
 // Illustrated fallback weapon also follows camera pitch and weapon type.
 // Shapes are deliberately distinct; there is no universal club silhouette.
 const gunId=clamp(p.weapon|0,0,weapons.length-1);
 const signal=rgb(weapons[gunId].color),metal='#78949f',low='#162a35';
 ctx.save();ctx.translate(.43,-.21);ctx.rotate(-clamp(p.pitch||0,-1.08,1.06)*.30);
 plate(-.07,.17,.18,.36,low);plate(0,0,.29,.17,low);
 plate(.015,-.06,.23,.048,metal);plate(.27,0,.33,.095,metal);
 plate(.41,0,.065,.13,low);plate(.07,-.16,.13,.055,signal);
 if(gunId===1||gunId===8){plate(.27,-.075,.34,.055,metal);plate(.27,.075,.34,.055,metal);}
 if(gunId===2){for(let i=0;i<4;i++)plate(.11+i*.07,-.075,.045,.07,signal);plate(.19,.10,.36,.035,low);}
 if(gunId===3){plate(.12,.18,.19,.21,low);for(let i=0;i<4;i++)plate(.19+i*.07,-.09,.025,.08,metal);}
 if(gunId===4){plate(.22,0,.50,.26,metal);plate(.46,0,.11,.30,low);}
 if(gunId===5){plate(.17,.13,.22,.24,low);plate(.42,0,.12,.18,metal);}
 if(gunId===6){for(const y of [-.08,0,.08])plate(.31,y,.30,.035,metal);}
 if(gunId===7){for(const y of [-.09,.09])plate(.20,y,.27,.055,signal);}
 if(gunId===8){plate(.11,.11,.26,.24,metal);plate(.11,.11,.19,.19,low);}
 if(gunId===9){for(const y of [-.105,.105])plate(.10,y,.23,.065,signal);}
 ctx.restore();
 if(c.grade>0)for(const s of [-1,1])plate(s*.49,-.46,.19,.17,rgb(c.accent));
 ctx.restore();
}

// Reflect saved camera mode (including imported backups) on the initial UI.
refreshCameraInterface();


function renderHeldWeapon(g,p,eye,dir){
 // A modular multi-part viewmodel: different silhouettes for all ten guns.
 // Procedural geometry only; no external models or textures are required.
 if(!glReady)return;
 gl.clear(gl.DEPTH_BUFFER_BIT);
 gl.uniform1f(u.uMatOverride,3.);
 const yaw=p.yaw,cy=Math.cos(yaw),sy=Math.sin(yaw);
 const right=[-cy,0,sy],up=[-sy*Math.sin(p.pitch),Math.cos(p.pitch),-cy*Math.sin(p.pitch)];
 const recoil=Math.min(.37,Math.max(0,p.recoil||0))*.20;
 const walk=p.walk?Math.sin(g.t*10.5)*.010:Math.sin(g.t*1.4)*.002;
 const equip=Math.max(0,(p.equipAnim||0))*.17;
 const at=(x,y,z)=>[
   eye[0]+right[0]*x+up[0]*(y+walk-equip)+dir[0]*(z-recoil),
   eye[1]+right[1]*x+up[1]*(y+walk-equip)+dir[1]*(z-recoil),
   eye[2]+right[2]*x+up[2]*(y+walk-equip)+dir[2]*(z-recoil)
 ];
 const idx=p.weapon, w=weapons[idx],glow=w.color;
 const dark=[.09,.115,.126],black=[.032,.045,.055],steel=[.32,.37,.38],
   mid=[.205,.245,.26],edge=[.36,.39,.38],bronze=[.34,.28,.20];
 const x0=.24,y0=-.28;
 const a=(x,y,z)=>at(x*.61+.20,y*.55-.19,z*.87+.72);
 function part(x,y,z,sx,sy,sz,color,e=0,shape=geom.bevel){
   draw(shape,...a(x,y,z),sx*.58,sy*.58,sz*.64,yaw,color,e);
 }
 const compact=(idx===5||idx===9),heavy=(idx===2||idx===4||idx===8);
 const long=(idx===2||idx===6),twin=(idx===1||idx===8);
 const bodyLen=compact?.44:heavy?.76:.61;
 const barrelLen=long?.96:compact?.35:heavy?.68:.62;
 const bw=(idx===1||idx===8)?.18:(idx===2?.1:.13);
 // Faceted alloy lower receiver and distinctive reinforced upper shell.
 part(x0,y0,.45,.27,.20,bodyLen,steel);
 part(x0,y0+.106,.46,.255,.071,bodyLen*.94,mid);
 part(x0,y0-.095,.37,.185,.105,.37,dark);
 part(x0+.135,y0-.205,.23,.116,.26,.19,black);
 part(x0-.11,y0-.26,.20,.11,.23,.14,mid);
 part(x0-.154,y0+.01,.44,.047,.115,bodyLen*.86,black);
 part(x0+.154,y0+.01,.44,.047,.115,bodyLen*.86,black);
 // Ribbed handguard sleeves and ergonomic ergonomic shell fasteners.
 for(let j=0;j<(compact?3:6);j++){
   let z=.33+j*.09;
   part(x0,y0+.15,z,.232,.016,.027,edge);
   part(x0+.14,y0-.03,z,.02,.075,.03,dark);
 }
 // Cylindrical and square profile barrels carry actual circular highlights.
 if(twin){
   for(const xx of [-.084,.084]){
     part(x0+xx,y0+.019,.87,bw*.81,bw*.81,barrelLen,steel,0,geom.cylinder);
     part(x0+xx,y0+.019,1.09,bw*.92,bw*.92,.11,black,0,geom.cylinder);
   }
 }else{
   part(x0,y0+.022,.90,bw,bw,barrelLen,steel,0,geom.cylinder);
   part(x0,y0+.021,1.04,bw*1.32,bw*1.32,.15,black,0,geom.cylinder);
   part(x0,y0+.022,1.18,bw*1.06,bw*1.06,.15,edge,0,geom.cylinder);
 }
 // Rails, metallic side plates, magazine and optical sight.
 part(x0,y0+.17,.66,.08,.07,.66,black);
 for(let q=0;q<4;q++)part(x0,y0+.205,.45+q*.14,.21,.015,.026,steel);
 part(x0,y0+.27,.45,.13,.13,.23,black);
 part(x0,y0+.33,.47,.09,.035,.09,glow,.24);
 part(x0+.17,y0+.027,.40,.015,.085,.23,edge);
 part(x0-.17,y0+.04,.40,.018,.06,.21,bronze);
 part(x0+.18,y0+.075,.40,.02,.03,.035,glow,.8);
 for(const sign of [-1,1]){
   part(x0+sign*.196,y0-.09,.32,.026,.045,.06,black);
   part(x0+sign*.173,y0+.105,.65,.025,.03,.075,steel);
 }
 if(compact){ // Short weapon with an oversized vented muzzle and compact magazine.
   part(x0,y0-.20,.39,.08,.24,.14,dark);
   part(x0,y0+.03,1.01,.17,.17,.16,steel,0,geom.cylinder);
 }
 if(idx===2){ // Electromagnetic railgun: exposed coil cells and twin guide rails.
   for(const side of [-1,1])part(x0+side*.15,y0+.06,1.07,.047,.075,.92,black);
   for(let j=0;j<5;j++)part(x0,y0+.11,.86+j*.16,.30,.035,.042,glow,.35);
   part(x0,y0+.18,1.35,.09,.09,.22,steel);
 }
 if(idx===4||idx===8){ // Heavy launcher: chamber, pressure drum, rocket cage.
   part(x0,y0-.12,.49,.33,.31,.31,mid,0,geom.cylinder);
   for(let j=0;j<4;j++){
      let aa=j*Math.PI*.5;
      part(x0+Math.sin(aa)*.20,y0-.12+Math.cos(aa)*.20,.47,.075,.075,.27,bronze,0,geom.cylinder);
   }
   part(x0,y0+.006,1.19,.29,.27,.13,dark);
 }
 if(idx===3){ // LMG cooling fins, box magazine and bipod attachment.
   part(x0+.15,y0-.24,.34,.25,.31,.24,dark);
   for(let j=0;j<7;j++)part(x0,y0-.025,.80+j*.075,.30,.021,.035,edge);
 }
 if(idx===7||idx===9){ // High-energy emitter: exposed double charged cells.
   for(const side of [-1,1]){
     part(x0+side*.115,y0+.03,.74,.09,.13,.39,black,0,geom.cylinder);
     part(x0+side*.12,y0+.04,.86,.043,.072,.25,glow,.53,geom.cylinder);
   }
 }
 // Gloved support hand: soft joints rather than a floating weapon.
 if(!compact){
   part(x0-.24,y0-.22,.64,.19,.145,.25,[.145,.17,.18]);
   for(let j=0;j<3;j++)part(x0-.15+j*.066,y0-.15,.75,.056,.061,.17,[.19,.22,.22]);
 }
 // Muzzle animation is short and weapon-dependent.
 if((p.shotGlow||0)>.006){
   const flash=Math.min(1,(p.shotGlow||0)*8),fz=1.26+(long?.26:0);
   const pos=a(x0,y0+.02,fz);
   draw(geom.orb,...pos,.10+.10*flash,.10+.10*flash,.15+.15*flash,g.t,glow,2.6*flash);
   draw(geom.ring,...pos,.20+.09*flash,.20+.09*flash,.20+.09*flash,g.t*8,glow,1.0*flash,1.0);
 }
 gl.uniform1f(u.uMatOverride,-1.);
}
// Directional glow tails share one tapered GPU mesh. No per-shot allocations
// beyond a few scalars and no change to projectile collision or lifetimes.
function drawEnergyTail(b,color,width,maxLength,glow=1.1){
 const vx=Number(b.vx)||0,vy=Number(b.vy)||0,vz=Number(b.vz)||0;
 const speed=Math.hypot(vx,vy,vz);if(speed<.001)return;
 const len=Math.min(maxLength,.06+speed*.032);
 const x=b.x-vx/speed*len*.5,y=b.y-vy/speed*len*.5,z=b.z-vz/speed*len*.5;
 const yaw=Math.atan2(vx,vz),tilt=-Math.atan2(vy,Math.hypot(vx,vz));
 draw(geom.tracer||geom.cylinder,x,y,z,width,width,len,yaw,color,glow,tilt);
}
function render(){if(!game)return;if(!glReady){renderFallback();return;}const g=game,p=g.p,tt=themes[sectorStyle%themes.length];
// Physically restrained weapon sway and recoil, kept separate from the 3D scene.
const gunEl=$('gun');if(gunEl){const bob=p.walk?Math.sin(g.t*11)*3.5:Math.sin(g.t*1.9)*.65;
 gunEl.style.transform=`translateX(calc(-50% + ${p.walk?Math.cos(g.t*8)*2.7:0}px)) translateY(${bob+(p.recoil||0)*12}px) rotate(${Math.sin(g.t*1.1)*.18}deg)`;}
let width=innerWidth,height=innerHeight;const post=save.settings.quality===2&&!!postProgram&&ensurePost();gl.bindFramebuffer(gl.FRAMEBUFFER,post?postFbo:null);gl.viewport(0,0,glCanvas.width,glCanvas.height);gl.clearColor(...tt.fog,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,materialAlbedo);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,materialNormals);gl.activeTexture(gl.TEXTURE0);let camY=1.47+(p.feetY||0)+Math.sin(g.t*10)*(p.walk? .028:0)+(p.recoil||0)*-.045;const camera=externalCameraEnabled()?operatorCameraPose(p):null;let eye=camera?camera.eye:[p.x,camY,p.z],dir=camera?camera.dir:[Math.sin(p.yaw)*Math.cos(p.pitch),Math.sin(p.pitch),Math.cos(p.yaw)*Math.cos(p.pitch)];matView=lookAt(...eye,eye[0]+dir[0],eye[1]+dir[1],eye[2]+dir[2]);matProj=perspective((touchOnly&&height>width?79:73)*Math.PI/180,width/height,.045,60);gl.uniformMatrix4fv(u.uView,false,matView);gl.uniformMatrix4fv(u.uProj,false,matProj);gl.uniform3fv(u.uEye,eye);gl.uniform3fv(u.uFog,tt.fog);gl.uniform1f(u.uTime,g.t);gl.uniform3fv(u.uAccent,tt.accent);gl.uniform3fv(u.uCamDir,dir);gl.uniform1f(u.uQuality,save.settings.quality);gl.uniform1f(u.uShotFlash,clamp((p.shotGlow||0)*6,0,1.5));gl.uniform1f(u.uMatOverride,-1);backdrop(tt,p,g.t);
const features=mapFeatures.filter(f=>hypot(f.x-p.x,f.z-p.z)<24).sort((a,b)=>hypot(a.x-p.x,a.z-p.z)-hypot(b.x-p.x,b.z-p.z));
const lamps=[];for(let i=0;i<3;i++){let f=features[i];lamps.push(f?f.x:(p.x+dir[0]*7),f?(f.kind===3?3.55:3.15):3.1,f?f.z:(p.z+dir[2]*7));}
gl.uniform3fv(u['uLampPos[0]'],new Float32Array(lamps));drawWorld();drawEnvironmentDetails(g,tt);drawRouteBeacons(g,tt);drawDevices(g);
if(g.portalReady){
  let tm=g.t,xx=portal.x,zz=portal.z,py=floorHeight(xx,zz);
  draw(geom.ring,xx,1.5+py,zz,1.25,1.25,1.25,tm*.7,tt.accent,1.45,.35);
  draw(geom.ring,xx,1.5+py,zz,.87,.87,.87,-tm*1.15,tt.accent,1.5,.8);
  draw(geom.orb,xx,1.5+py,zz,.55,.55,.55,tm,[.35,.72,1],1.5);
  // A short, local, low-cost breadcrumb trail around corners. The arrow and
  // map route are still available in power-saving 2D fallback mode.
  const path=portalRoute(p,13);
  for(let i=2;i<path.length;i+=2){const q=path[i];
    if(hypot(q.x-p.x,q.z-p.z)>13)continue;
    draw(geom.ring,q.x,.061+floorHeight(q.x,q.z),q.z,.25,.021,.25,tm*.4+i,tt.accent,.72);
  }
}
for(const loot of g.loot){let c=loot.type==='heal'?[1,.32,.48]:loot.type==='energy'?[.32,.88,1]:loot.type==='plates'?[.67,.80,.94]:[1,.75,.31];draw(geom.octa,loot.x,.45+floorHeight(loot.x,loot.z)+Math.sin(g.t*4+loot.z)*.12,loot.z,.24,.39,.24,g.t*2,c,1.25)}
if(save.settings.quality>0)for(const s of (g.scorch||[])){
 if(hypot(s.x-p.x,s.z-p.z)>22)continue;
 let r=s.r*Math.min(1,s.life/2);draw(geom.orb,s.x,.021,s.z,r*2,.009,r*2,0,[.037,.041,.047],0);
}
if(g.mission?.type==='recovery')for(const c of g.mission.caches)if(!c.got&&distance(c,p)<31){
 const y=.76+floorHeight(c.x,c.z)+Math.sin(g.t*2.5+c.id)*.13;
 draw(geom.octa,c.x,y,c.z,.30,.43,.30,g.t*.95,[.56,.91,1],1.1);
 draw(geom.ring,c.x,.08+floorHeight(c.x,c.z),c.z,.66,.05,.66,g.t,[.30,.95,1],.7);
}
if(g.arenaEvent?.phase==='warning'){const a=g.arenaEvent;
 const ground=floorHeight(a.x,a.z);const c=a.kind==='thermal'?[1,.28,.13]:[.3,.76,1];
 if(distance(a,p)<30){draw(geom.ring,a.x,ground+.045,a.z,a.r*2,.08,a.r*2,g.t*2,c,1.25);draw(geom.ring,a.x,ground+.08,a.z,.25+((2.65-a.warning)/2.65)*a.r*1.7,.06,.25+((2.65-a.warning)/2.65)*a.r*1.7,-g.t,c,.8);}
}
for(const node of g.nodes){if(node.dead||distance(node,p)>31)continue;
 const type=NODE_TYPES[node.type],col=node.flash>0?[1,1,1]:type.color;
 draw(geom.cube,node.x,.34+floorHeight(node.x,node.z),node.z,.74,.57,.74,0,[.075,.13,.21],.10);
 draw(geom.pylon,node.x,.84+floorHeight(node.x,node.z),node.z,.43,.84,.43,g.t*.10,[.18,.24,.33],.2);
 draw(geom.ring,node.x,1.32+floorHeight(node.x,node.z),node.z,.82,.82,.82,g.t*.72+node.phase,col,1.35,.22);
 if(save.settings.quality>0)draw(geom.ring,node.x,1.32+floorHeight(node.x,node.z),node.z,.70,.70,.70,-g.t*.57+node.phase,col,.9,.8);
 draw(geom.orb,node.x,1.32+floorHeight(node.x,node.z),node.z,.39,.39,.39,g.t*1.4,col,1.75);
}
for(const enemy of g.enemies){if(enemy.dead)continue;
  if(enemy.boss && enemy.ultWarn>0 && distance(p,enemy)<29){
   const yy=.05+(enemy.feetY||0),progress=1-enemy.ultWarn/1.85;
   draw(geom.ring,enemy.x,yy,enemy.z,10.3,.08,10.3,g.t*1.8,[1,.34,.12],1.25);
   draw(geom.ring,enemy.x,yy+.06,enemy.z,2+8.3*progress,.07,2+8.3*progress,-g.t,[1,.71,.24],.96);
  }

  if(enemy.telegraph>0&&enemy.lockTarget&&distance(p,enemy)<28){
    const ex=enemy.lockTarget.x-enemy.x,ez=enemy.lockTarget.z-enemy.z,l=hypot(ex,ez);
    if(l>.1){draw(geom.cube,(enemy.x+enemy.lockTarget.x)*.5,1.02,(enemy.z+enemy.lockTarget.z)*.5,.021,.023,l,Math.atan2(ex,ez),[1,.12,.29],1.4);
    draw(geom.ring,enemy.lockTarget.x,.07,enemy.lockTarget.z,.76,.044,.76,g.t*1.3,[1,.2,.38],1.5);}
  }
  if(save.settings.quality>0&&hypot(enemy.x-p.x,enemy.z-p.z)<19){let r=enemy.radius*(enemy.boss?2.05:1.22);draw(geom.orb,enemy.x,.032+(enemy.type==='drone'?floorHeight(enemy.x,enemy.z):(Number.isFinite(enemy.feetY)?enemy.feetY:floorHeight(enemy.x,enemy.z))),enemy.z,r*2,.012,r*2,0,[.055,.063,.075],0);}
  if(enemy.elite&&save.settings.quality>0){draw(geom.ring,enemy.x,.32+(Number.isFinite(enemy.feetY)?enemy.feetY:floorHeight(enemy.x,enemy.z)),enemy.z,1.1,.08,1.1,g.t,[1,.56,.26],.95);}
  if(enemy.type==='warden'&&save.settings.quality>0){draw(geom.ring,enemy.x,1.35+(Number.isFinite(enemy.feetY)?enemy.feetY:floorHeight(enemy.x,enemy.z)),enemy.z,8.2,.09,8.2,g.t*.25,[.18,.53,1],.68);}
  if(enemy.type==='artillery'&&save.settings.quality>0){draw(geom.ring,enemy.x,.35+(Number.isFinite(enemy.feetY)?enemy.feetY:floorHeight(enemy.x,enemy.z)),enemy.z,.8,.13,.8,g.t,[1,.46,.14],1.0);}
  drawEnemyModel(enemy,g,p);drawEnemyVanguard(enemy,g,p);
}
// Detached armor survives briefly, bounces, then evaporates; never a permanent shadow.
if(glReady && robotDebrisMesh && g.robotDebris?.length){
 gl.uniform1f(u.uMatOverride,4);
 const maxShardsRendered=save.settings.quality===0?8:touchOnly?17:36;
 let visibleShards=0;
 for(const sh of g.robotDebris){
  if(hypot(sh.x-p.x,sh.z-p.z)>18)continue;
  if(visibleShards++>=maxShardsRendered)break;
  const fade=clamp(sh.life/.42,0,1);
  const scale=sh.size*(sh.rested?.76:1);
  draw(robotDebrisMesh,sh.x,sh.y,sh.z,scale,scale,scale,sh.rx,sh.color.map(v=>v*fade),sh.glow?fade*.18:0,sh.rz);
 }
 gl.uniform1f(u.uMatOverride,-1);
}
// One GPU batch for all wall scars: avoids hundreds of draw calls on phones.
if(decalDirty)rebuildDecalMesh();
if(decalMesh)draw(decalMesh,0,0,0,1,1,1,0,[1,1,1],0);
for(const tr of (g.tracers||[])){
 const xx=tr.b.x-tr.a.x,yy=tr.b.y-tr.a.y,zz=tr.b.z-tr.a.z;
 const len=hypot(xx,yy,zz),fade=clamp(tr.life/tr.maxLife,0,1);
 if(len>.01){const yaw=Math.atan2(xx,zz),tilt=-Math.atan2(yy,hypot(xx,zz)),mid=v3((tr.a.x+tr.b.x)/2,(tr.a.y+tr.b.y)/2,(tr.a.z+tr.b.z)/2);
  draw(geom.tracer||geom.cylinder,mid.x,mid.y,mid.z,tr.r*fade*1.65,tr.r*fade*1.65,len,yaw,tr.col,.9+1.3*fade,tilt);
 }
}
for(const f of (g.impactFx||[])){
 if(hypot(f.x-p.x,f.z-p.z)>24)continue;
 let a=clamp(f.life/f.maxLife,0,1),r=f.r*(1+(1-a)*1.35);
 draw(geom.orb,f.x,f.y,f.z,r*.5*a,r*.5*a,r*.5*a,g.t,f.col,1.15*a);
}
for(const b of (g.projectiles||[])){
 if(hypot(b.x-p.x,b.z-p.z)>40)continue;
 draw(geom.spark||geom.orb,b.x,b.y,b.z,b.rad*2,b.rad*2,b.rad*2,g.t*2,b.w.color,2.4);
 if(save.settings.quality>0){
   drawEnergyTail(b,b.w.color,b.rad*1.15,1.25,1.35);
   draw(geom.ring,b.x,b.y,b.z,b.rad*2.5,b.rad*2.5,b.rad*2.5,g.t,b.w.color,.58);
 }
}
if(save.settings.quality>0){
 // Slow-floating luminous dust: subtly conveys depth and air movement.
 for(let i=0;i<12;i++){
  let h=(i*17.23+g.sector*4.71),aa=i*2.399963+g.t*.08;
  let px=p.x+Math.sin(aa)*((i%5)+2.9),pz=p.z+Math.cos(aa)*((i%5)+2.9);
  if(isWall(px,pz))continue;
  let py=1.15+1.45*Math.sin(h+g.t*.26);
  draw(geom.orb,px,py,pz,.014,.014,.014,aa,tt.accent,.25);
 }
}
for(const b of g.bullets){
 const c=b.from==='player'?[.1,1,1]:b.col||[1,.25,.43];
 draw(geom.spark||geom.orb,b.x,b.y,b.z,b.radius*2,b.radius*2,b.radius*2,g.t,c,2.5);
 if(save.settings.quality>0)drawEnergyTail(b,c,b.radius*.66,.92,1.05);
}
let renderedSparks=0;const maxSparks=save.settings.quality===0?75:touchOnly?110:145;
for(let i=g.particles.length-1;i>=0&&renderedSparks<maxSparks;i--){
 const pfx=g.particles[i];renderedSparks++;
 const life=clamp(pfx.life/Math.max(.01,pfx.maxLife||.6),0,1);
 const scale=(.037+.031*life)*Math.sqrt(life);
 const vx=Number(pfx.vx)||0,vy=Number(pfx.vy)||0,vz=Number(pfx.vz)||0;
 const speed=Math.hypot(vx,vy,vz);
 const yaw=speed>.001?Math.atan2(vx,vz):Number(pfx.a)||0;
 const tilt=speed>.001?-Math.atan2(vy,Math.hypot(vx,vz)):0;
 const mesh=save.settings.quality===0?geom.octa:(geom.spark||geom.orb);
 draw(mesh,pfx.x,pfx.y,pfx.z,scale,scale,scale*(1.2+Math.min(3,speed*.38)),yaw,pfx.col||[1,.65,.32],.5+2*life,tilt);
}
if(camera?.drawActor)renderOperator(g,p);else renderHeldWeapon(g,p,eye,dir);if(!camera?.drawActor&&p.shotGlow>.015){const rt=[-Math.cos(p.yaw),0,Math.sin(p.yaw)];const fx=eye[0]+dir[0]*1.55+rt[0]*.27,fy=eye[1]+dir[1]*1.55-.24,fz=eye[2]+dir[2]*1.55+rt[2]*.27;const sz=.10+Math.min(1,p.shotGlow*9)*.18;draw(geom.octa,fx,fy,fz,sz*.7,sz*.7,sz*1.8,g.t*25,weapons[p.weapon].color,1.75);}if(post)showPost(g.t);
}


// Hand-authored procedural metal plate albedo. Generated at runtime in a
// small offscreen canvas, so the single HTML stays offline and asset-free.
const steelAtlas=new Map();
function makeSteelAtlas(theme,variant){
 const c=document.createElement('canvas');c.width=320;c.height=512;
 const a=c.getContext('2d'),w=c.width,h=c.height,img=a.createImageData(w,h),data=img.data;
 const t=themes[theme],seed=1111+theme*7919+variant*3959;
 const rnd=(x,y)=>{let k=(Math.imul(x+seed,374761393)+Math.imul(y+251,668265263))|0;k=Math.imul(k^(k>>>13),1274126177);return ((k^(k>>>16))>>>0)/4294967295;};
 const bc=[37+t.wall[0]*110,41+t.wall[1]*110,46+t.wall[2]*110];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const edge=Math.min(x,w-1-x),side=edge<18?.53:edge<34?.79:1;
  const lineY=y%102,edgeY=lineY<5||lineY>98?.55:lineY<11||lineY>91?.83:1;
  const n=rnd(x>>2,y>>2),fine=rnd(x,y),scr= Math.sin(y*.47+x*.005)*.019;
  const scratches=rnd(x>>3,y>>6)>.968 && ((x+3*y)%19<3)?1.25:1;
  const oxidation=rnd(x>>4,y>>5)>.82?.86:1;
  const col=side*edgeY*(.82+.25*n+.07*fine+scr)*scratches*oxidation;
  const p=(y*w+x)*4;
  for(let q=0;q<3;q++)data[p+q]=Math.max(0,Math.min(255,bc[q]*col));data[p+3]=255;
 }
 a.putImageData(img,0,0);
 // Machined joint lines and recessed power boxes.
 const stroke='#92a4ab',tint=`rgba(${Math.round(t.accent[0]*245)},${Math.round(t.accent[1]*245)},${Math.round(t.accent[2]*245)},.5)`;
 a.fillStyle='#080f1b';a.fillRect(7,18,306,5);a.fillRect(7,494,306,6);
 a.fillStyle='#172431';a.fillRect(11,38,298,8);a.fillRect(11,469,298,10);
 for(let yy=96;yy<500;yy+=103){
  a.fillStyle='#090f17';a.fillRect(15,yy,290,4);
  a.fillStyle='rgba(195,216,217,.18)';a.fillRect(17,yy+5,286,2);
 }
 a.fillStyle='#07121a';a.fillRect(26,132,268,177);
 a.fillStyle='#253747';a.fillRect(35,141,250,159);
 const g=a.createLinearGradient(0,140,320,302);g.addColorStop(0,'#101e2a');g.addColorStop(.39,'#354451');g.addColorStop(.54,'#142431');g.addColorStop(1,'#192c3a');
 a.fillStyle=g;a.fillRect(43,149,235,145);
 a.strokeStyle='rgba(182,210,221,.38)';a.lineWidth=2;a.strokeRect(39,145,244,153);
 // Vents and real light-facing rim detail.
 for(let yy=166;yy<277;yy+=15){a.fillStyle='#070e16';a.fillRect(65,yy,183,8);a.fillStyle='rgba(149,174,184,.25)';a.fillRect(68,yy+1,180,2)}
 a.fillStyle=tint;a.fillRect(69,276,172,5);
 for(let bx of [20,300])for(let by of [26,115,323,465]){
  a.fillStyle='#070d17';a.beginPath();a.arc(bx,by,6,0,Math.PI*2);a.fill();
  a.fillStyle='#7f939f';a.beginPath();a.arc(bx-1,by-1,2.5,0,Math.PI*2);a.fill();
 }
 if(variant){
  a.fillStyle='rgba(5,9,15,.72)';a.fillRect(90,350,147,90);
  for(let k=0;k<7;k++){
   a.fillStyle=k%2?'#a99b64':'#282c29';a.beginPath();
   a.moveTo(96+k*20,350);a.lineTo(106+k*20,350);a.lineTo(147+k*20,440);a.lineTo(137+k*20,440);a.fill();
  }
  a.font='bold 20px monospace';a.fillStyle='#bbba99';a.fillText('CAUTION',99,334);
 }else{
  a.fillStyle='#0b131b';a.fillRect(65,359,190,56);
  a.strokeStyle='#758c9b';a.lineWidth=2;a.strokeRect(64,358,191,57);
  a.fillStyle=tint;a.fillRect(74,367,172,3);
  a.font='bold 18px monospace';a.fillStyle='#b1cad6';a.fillText('RIFT // 07',79,394);
  a.fillStyle='#657f8e';a.font='12px monospace';a.fillText('RESTRICTED ACCESS',79,408);
 }
 // Grease and weathering spots, short directional scuffs.
 for(let i=0;i<280;i++){
  const x=(rnd(i,seed)*312)|0,y=(rnd(seed,i)*500)|0;
  a.strokeStyle=`rgba(${i%3?8:211},${i%3?14:225},${i%3?17:211},${.025+rnd(i,i)*.13})`;
  a.lineWidth=i%7===0?2:1;a.beginPath();a.moveTo(x,y);a.lineTo(x+rnd(i+5,i)*28,y-1);a.stroke();
 }
 return c;
}
function wallTexture(theme,variant){let id=theme*2+variant;if(!steelAtlas.has(id))steelAtlas.set(id,makeSteelAtlas(theme,variant));return steelAtlas.get(id)}
// Detailed silhouette renderer for the no-WebGL emergency mode; no neon polygons.
function drawFallbackRobot(ctx,e,size,t){
  const S=Math.max(9,size),c=e.flash>0?[1,1,1]:e.color||[.4,.8,.9];
  const accent=`rgb(${Math.round(c[0]*220+35)},${Math.round(c[1]*220+35)},${Math.round(c[2]*220+35)})`;
  const heavy=e.boss||['brute','warden','artillery'].includes(e.type);
  const insect=e.type==='scout'||e.type==='charger',drone=e.airborne||e.type==='drone';
  const walk=Math.sin(Number(e.robotCycle)||0)*.10*clamp(Number(e.robotMotion)||0,0,1);
  ctx.save();ctx.scale(S,S);
  // Damage produces an instantaneous body recoil rather than a permanent shadow.
  const hit=Math.max(0,Number(e.hitReact)||0);
  if(hit>0)ctx.rotate(Math.sin((.24-hit)*39)*hit*.30);
  const fill=(points,col,stroke=false)=>{
    ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.fill();
    if(stroke){ctx.lineWidth=.018;ctx.strokeStyle='#111b25';ctx.stroke();}
  };
  const plate=(x,y,w,h,col)=>{
    if(typeof ctx.quadraticCurveTo!=='function'){
      fill([[x-w*.43,y-h/2],[x+w*.43,y-h/2],[x+w*.5,y-h*.28],[x+w*.5,y+h*.25],[x+w*.34,y+h*.5],[x-w*.34,y+h*.5],[x-w*.5,y+h*.25],[x-w*.5,y-h*.25]],col,true);
      return;
    }
    const a=x-w*.5,b=x+w*.5,t=y-h*.5,d=y+h*.5,r=Math.min(w,h)*.18;
    ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(a+r,t);ctx.lineTo(b-r,t);
    ctx.quadraticCurveTo(b,t,b,t+r);ctx.lineTo(b,d-r);ctx.quadraticCurveTo(b,d,b-r,d);
    ctx.lineTo(a+r,d);ctx.quadraticCurveTo(a,d,a,d-r);ctx.lineTo(a,t+r);
    ctx.quadraticCurveTo(a,t,a+r,t);ctx.closePath();ctx.fill();
    ctx.lineWidth=.018;ctx.strokeStyle='#111b25';ctx.stroke();
  };
  ctx.shadowBlur=0;
  if(drone){
    fill([[-.46,-.08],[-.95,-.37],[-.88,.12],[-.34,.28],[0,.31],[.34,.28],[.88,.12],[.95,-.37],[.46,-.08]],'#283847',true);
    if(e.type==='skyhunter'){
      fill([[-.98,-.35],[-.38,-.17],[0,-.42],[.38,-.17],[.98,-.35],[.64,-.04],[0,.29],[-.64,-.04]],'#374e5c',true);
    }else if(e.type==='skyguard'){
      for(const s of [-1,1])plate(s*.71,-.08,.35,.48,'#69757b');
      plate(0,-.13,.58,.51,'#5b6469');
    }else if(e.type==='stormray'){
      fill([[-1.05,-.20],[-.41,-.25],[0,-.44],[.41,-.25],[1.05,-.20],[.87,.13],[0,.22],[-.87,.13]],'#325c5d',true);
    }
    fill([[-.83,-.24],[-.54,-.16],[-.46,.12],[-.78,.03]],'#647684');
    fill([[.83,-.24],[.54,-.16],[.46,.12],[.78,.03]],'#647684');
    plate(0,.02,.58,.42,'#435965');plate(0,.09,.25,.17,'#0b1522');
    for(const k of [-1,1]){plate(k*.62,-.03,.28,.16,'#23313b');plate(k*.63,-.05,.13,.07,accent);}
    plate(0,.11,.22,.06,accent);
  }else if(insect){
    for(const side of [-1,1])for(const step of [-1,1]){
      ctx.strokeStyle='#283640';ctx.lineWidth=.085;ctx.beginPath();ctx.moveTo(side*.33,step*.05);ctx.lineTo(side*.65,step*.15+.12+walk*side);ctx.lineTo(side*.75,.37+walk*side);ctx.stroke();
      plate(side*.57,.18, .17,.18,'#586a70');
    }
    fill([[-.54,.09],[-.42,-.32],[-.22,-.45],[.22,-.45],[.42,-.32],[.54,.09],[.32,.38],[-.32,.38]],'#354b55',true);
    plate(0,-.18,.66,.40,'#658188');
    plate(0,.21,.53,.26,'#182631');
    for(const side of [-1,1])plate(side*.13,.25,.16,.07,accent);
    if(e.type==='charger')for(const side of [-1,1])fill([[side*.21,-.27],[side*.34,-.52],[side*.39,-.15]],'#a0a7a3');
  }else{
    const wide=heavy?1.23:1;
    // Actual segmented arms/legs rather than spinning octagon sprites.
    for(const side of [-1,1]){
      const x=side*.28*wide;
      ctx.save();ctx.translate(x,.27);ctx.rotate(side*walk);
      plate(0,.09,.28*wide,.41,'#273744');plate(0,.03,.22*wide,.30,'#68767c');
      plate(side*.04,.31,.31,.18,'#27303a');ctx.restore();
      ctx.save();ctx.translate(side*.42*wide,-.18);ctx.rotate(-walk*side);
      plate(0,.0,.30*wide,.26,'#65727a');plate(0,.20,.19,.36,'#24343e');plate(0,.35,.24,.16,'#53626c');ctx.restore();
    }
    plate(0,.13,.57*wide,.17,'#1a2933');
    fill([[-.36*wide,-.39],[-.48*wide,-.17],[-.33*wide,.18],[.33*wide,.18],[.48*wide,-.17],[.36*wide,-.39]],'#263440',true);
    fill([[-.30*wide,-.39],[-.02,-.29],[-.025,-.01],[-.30*wide,-.04]],'#667982',true);
    fill([[.30*wide,-.39],[.02,-.29],[.025,-.01],[.30*wide,-.04]],'#445560',true);
    plate(0,-.16,.11,.34,'#152633');
    plate(0,-.16,.055,.23,accent);
    plate(0,-.55,.36*wide,.31,'#1b2832');
    fill([[-.20*wide,-.69],[-.21*wide,-.50],[-.12*wide,-.43],[.12*wide,-.43],[.21*wide,-.50],[.20*wide,-.69],[0,-.74]],'#5f717a',true);
    plate(0,-.57,.29,.10,'#0b1420');
    for(const side of [-1,1])plate(side*.087,-.57,.135,.043,accent);
    if(heavy){for(const side of [-1,1])plate(side*.50*wide,-.27,.23,.27,'#78858b')}
    if(e.type==='sniper'){
      ctx.strokeStyle='#bcc8d0';ctx.lineWidth=.045;ctx.beginPath();ctx.moveTo(.28,-.36);ctx.lineTo(.38,-.85);ctx.stroke();
      plate(.38,-.58,.12,.18,'#253541');
    }
    if(e.type==='artillery'||e.boss){for(const side of [-1,1]){plate(side*.55,-.53,.29,.25,'#25333d');plate(side*.55,-.53,.12,.09,accent);}}
  }
  // A damaged power core is visible in the low-end renderer too. It flickers
  // on the body itself rather than leaving a mark on the floor after death.
  if(!insect&&!drone && e.hp<e.maxhp*.47){
    const heat=clamp(1-e.hp/Math.max(1,e.maxhp),0,1);
    ctx.fillStyle='#101218';ctx.fillRect(-.12,-.23,.24,.22);
    ctx.fillStyle=`rgba(255,${Math.round(75+heat*42)},38,${.45+heat*.42})`;
    ctx.beginPath();ctx.moveTo(0,-.21);ctx.lineTo(.085,-.13);ctx.lineTo(0,-.02);ctx.lineTo(-.085,-.13);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#7b8991';ctx.lineWidth=.015;ctx.strokeRect(-.12,-.23,.24,.22);
  }
  // Machining highlights, seam fasteners, and layered armor are baked into
  // the cheap no-WebGL silhouette without additional offscreen textures.
  if(!insect&&!drone){
    ctx.save();
    ctx.strokeStyle='rgba(214,232,237,.28)';ctx.lineWidth=.014;
    for(const side of [-1,1]){
      ctx.beginPath();ctx.moveTo(side*.09,-.34);ctx.lineTo(side*.27,-.38);
      ctx.lineTo(side*.32,-.25);ctx.stroke();
      ctx.strokeStyle='rgba(9,17,24,.65)';ctx.beginPath();
      ctx.moveTo(side*.12,-.06);ctx.lineTo(side*.30,-.06);ctx.stroke();
      ctx.fillStyle='#b3b7b1';
      for(const y of [-.32,-.08,.15]){ctx.beginPath();ctx.arc(side*.285,y,.012,0,TAU);ctx.fill();}
    }
    ctx.strokeStyle='rgba(226,237,241,.15)';
    for(let k=-1;k<=1;k++){
      ctx.beginPath();ctx.moveTo(k*.07,.07);ctx.lineTo(k*.07,.16);ctx.stroke();
    }
    ctx.restore();
  }
  const health=clamp((Number(e.hp)||0)/Math.max(1,Number(e.maxhp)||1),0,1);
  if(health<.57){
    ctx.save();
    ctx.globalAlpha=.28+(1-health)*.27;
    ctx.fillStyle='#0d151d';
    const scuffs=insect?[[-.22,-.19,.21,.09],[.22,.09,.14,.11]]:drone?[[-.29,.0,.22,.12]]:[[-.18,-.26,.18,.15],[.23,.05,.15,.12]];
    for(const [x,y,w,h] of scuffs){
      ctx.beginPath();ctx.moveTo(x-w*.5,y-h*.45);ctx.lineTo(x+w*.45,y-h*.36);
      ctx.lineTo(x+w*.25,y+h*.48);ctx.lineTo(x-w*.36,y+h*.34);ctx.closePath();ctx.fill();
    }
    ctx.strokeStyle='rgba(255,139,75,.44)';ctx.lineWidth=.018;
    ctx.beginPath();ctx.moveTo(-.16,-.28);ctx.lineTo(-.04,-.14);ctx.lineTo(.015,-.18);ctx.stroke();
    ctx.restore();
  }
  const hpFraction=clamp(e.hp/Math.max(1,e.maxhp),0,1);
  if(hpFraction<.72){
    ctx.save();ctx.fillStyle='#172b32';ctx.beginPath();ctx.moveTo(-.27,-.16);ctx.lineTo(-.03,-.29);ctx.lineTo(.22,-.02);ctx.lineTo(.07,.30);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#dd7b42';ctx.lineWidth=.026;ctx.beginPath();ctx.moveTo(-.23,-.22);ctx.lineTo(-.05,-.09);ctx.lineTo(-.13,.09);ctx.stroke();ctx.restore();
  }
  if(hpFraction<.47){
    ctx.fillStyle='rgba(255,129,55,'+(.60+.32*Math.sin(t*12+e.id))+')';ctx.beginPath();ctx.moveTo(0,-.13);ctx.lineTo(.13,.10);ctx.lineTo(-.13,.10);ctx.closePath();ctx.fill();
  }
  if(e.elite||e.boss){
    ctx.strokeStyle=e.boss?'#ffb89b':'#ffb969';ctx.lineWidth=.025;ctx.strokeRect(-.55,-.83,1.1,1.3);
    ctx.strokeStyle='#ffc67b';ctx.lineWidth=.036;ctx.beginPath();ctx.moveTo(-.26,-.77);ctx.lineTo(-.36,-1.06);ctx.moveTo(.26,-.77);ctx.lineTo(.36,-1.06);ctx.stroke();
    ctx.fillStyle='#ffdc89';ctx.fillRect(-.42,-1.09,.12,.055);ctx.fillRect(.3,-1.09,.12,.055);
  }
  ctx.restore();
}

function renderFallback(){if(!fallCtx||!game)return;
// Fast ray-cast renderer for browsers where GPU WebGL is unavailable.
const g=game,actor=g.p,pose=externalCameraEnabled()?operatorCameraPose(actor):null;
 const p=pose?.drawActor?{...actor,x:pose.eye[0],z:pose.eye[2],yaw:Math.atan2(pose.dir[0],pose.dir[2]),pitch:Math.asin(clamp(pose.dir[1],-1,1)),feetY:pose.eye[1]-1.46}:actor;
 document.body.classList.toggle('thirdPersonCameraClose',!!pose&&!pose.drawActor);
 const t=themes[sectorStyle%themes.length],W=glCanvas.width,H=glCanvas.height,C=fallCtx;
if(performance.now()-fBackAt<29)return;fBackAt=performance.now();
const w=W,h=H,FOV=(touchOnly&&h>w?82:74)*Math.PI/180,focal=w/(2*Math.tan(FOV/2)),eyeHeight=1.46+(p.feetY||0),horizon=h*.49+Math.tan(p.pitch)*focal*.62;
// A layered night sky, subtle nebula and horizon beams around the arena.
let sky=C.createLinearGradient(0,0,0,h*.78);
sky.addColorStop(0,'#030513');sky.addColorStop(.39,'#09132b');sky.addColorStop(.8,'#12243b');sky.addColorStop(1,'#081222');
C.fillStyle=sky;C.fillRect(0,0,w,h);
const glowR=Math.round(t.accent[0]*255),glowG=Math.round(t.accent[1]*255),glowB=Math.round(t.accent[2]*255);
// Distant illuminated atmosphere: a few inexpensive broad gradients.
let nebula=C.createRadialGradient(w*.57,h*.15,1,w*.57,h*.15,w*.58);
nebula.addColorStop(0,`rgba(${glowR},${glowG},${glowB},.09)`);
nebula.addColorStop(1,`rgba(${glowR},${glowG},${glowB},0)`);
C.fillStyle=nebula;C.fillRect(0,0,w,Math.max(0,horizon));
// Perspective-projected overhead metal gratings and translucent skylights.
// Realistic ceiling parallax even on browsers without GPU WebGL.
const roofStepX=Math.max(5,Math.floor(w/155)),roofStepY=Math.max(3,Math.floor(h/170));
for(let sy=0;sy<Math.min(h,Math.ceil(horizon)-3);sy+=roofStepY){
 let distanceToRoof=(ceilingHeight()+.03-eyeHeight)*focal/Math.max(2,horizon-sy);
 if(distanceToRoof>32)continue;
 for(let sx=0;sx<w;sx+=roofStepX){
  const side=(sx-w*.5)/focal;
  const wx=p.x+Math.sin(p.yaw)*distanceToRoof-Math.cos(p.yaw)*side*distanceToRoof;
  const wz=p.z+Math.cos(p.yaw)*distanceToRoof+Math.sin(p.yaw)*side*distanceToRoof;
  let ix=Math.floor(wx),iz=Math.floor(wz);if(isWall(wx,wz))continue;
  let adj=0;for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])if(!isWall(ix+dx+.5,iz+dz+.5))adj++;
  if(adj>2&&(ix+iz+sectorStyle)%4===0)continue;
  const u=wx-ix,v=wz-iz,edge=u<.08||v<.08||u>.92||v>.92;
  const cloud=(ix*19+iz*31)%11;
  let fade=clamp(1-distanceToRoof/34,.03,.88);
  let base=cloud<3?28:40;
  C.fillStyle=`rgba(${base},${base+16},${base+22},${fade*(edge?.71:.55)})`;
  C.fillRect(sx,sy,roofStepX+1,roofStepY+1);
  if((ix*5+iz*7)%11===0&&(u>.25&&u<.75)&&v>.35&&v<.65){
   C.fillStyle=`rgba(${glowR},${glowG},${glowB},${fade*.50})`;
   C.fillRect(sx,sy,roofStepX+1,roofStepY+1);
  }
 }
}
const flicker=g.t*.85;
for(let j=0;j<48;j++){
 let xx=((j*131+41)%997)/997*w,yy=((j*89+73)%701)/701*Math.max(0,horizon*.92);
 if(yy<0||yy>horizon)continue;
 C.fillStyle=`rgba(159,231,255,${.09+.11*(.5+.5*Math.sin(flicker+j*4.8))})`;
 C.fillRect(xx,yy,1.1,1.1);
}
let floor=C.createLinearGradient(0,horizon,0,h);
floor.addColorStop(0,'#122638');floor.addColorStop(.52,'#07121e');floor.addColorStop(1,'#020610');
C.fillStyle=floor;C.fillRect(0,Math.max(0,horizon),w,h-Math.max(0,horizon));
// Perspective floor with illuminated panel edges, metal seams and reactor tiles.
let floorStart=Math.max(0,Math.ceil(horizon)+3),stepX=Math.max(6,Math.round(w/158)),stepY=Math.max(3,Math.round(h/190));
for(let sy=floorStart;sy<h;sy+=stepY){
 let dist=eyeHeight*focal/Math.max(2,sy-horizon);if(dist>29)continue;
 let strength=clamp(.29-dist*.010,.018,.22);
 for(let sx=0;sx<w;sx+=stepX){
  let side=(sx-w*.5)/focal;
  let fx=p.x+Math.sin(p.yaw)*dist-Math.cos(p.yaw)*side*dist;
  let fz=p.z+Math.cos(p.yaw)*dist+Math.sin(p.yaw)*side*dist;
  let tx=Math.floor(fx),tz=Math.floor(fz),nx=fx-tx,nz=fz-tz;
  if(isWall(fx,fz))continue;
  let grid=nx<.055||nz<.055||nx>.945||nz>.945;const elevated=floorHeightAtCell(tx,tz);if(elevated>.01){C.fillStyle='rgba(157,200,210,'+Math.min(.22,.06+elevated*.12)+')';C.fillRect(sx,sy,stepX,stepY);if(grid){C.fillStyle='rgba(243,184,98,.23)';C.fillRect(sx,sy,stepX,stepY);}}
  if(grid){
   C.fillStyle=`rgba(${glowR},${glowG},${glowB},${strength})`;
   C.fillRect(sx,sy,stepX,stepY);
  }else if((tx*19+tz*29)%13===0&&nx>.26&&nx<.76&&nz>.27&&nz<.72){
   C.fillStyle=`rgba(${glowR},${glowG},${glowB},${strength*.52})`;
   C.fillRect(sx,sy,stepX,stepY);
  }else if((sectorStyle===1||sectorStyle===3)&&(tx*7+tz*11)%9===0&&(nx<.24||nz<.24)){
   C.fillStyle=`rgba(${glowR},${glowG},${glowB},${strength*.66})`;C.fillRect(sx,sy,stepX,stepY);
  }else if((tx+tz)%7===0&&(nx<.13||nz<.13)){
   C.fillStyle='rgba(112,158,178,.085)';C.fillRect(sx,sy,stepX,stepY);
  }else{
    const steel=((tx*13+tz*31)%9)/9;
    const patch=(nx>.12&&nx<.88&&nz>.12&&nz<.88);
    C.fillStyle=`rgba(${42+Math.round(steel*13)},${53+Math.round(steel*19)},${64+Math.round(steel*18)},${patch?clamp(.17-dist*.005,0,.12):.035})`;
    C.fillRect(sx,sy,stepX,stepY);
  }
 }
}
let zbuffer=[],strip=Math.max(2,Math.floor(w/(save.settings.quality===0?260:360)));
for(let sx=0;sx<w;sx+=strip){
 const angle=p.yaw-Math.atan((sx+strip/2-w/2)/focal),dx=Math.sin(angle),dz=Math.cos(angle);
 const mx0=Math.floor(p.x),mz0=Math.floor(p.z);let ix=mx0,iz=mz0;
 let deltaX=Math.abs(1/(dx||1e-8)),deltaZ=Math.abs(1/(dz||1e-8));
 let stepGX=dx<0?-1:1,stepGZ=dz<0?-1:1;
 let sdx=(dx<0?p.x-mx0:mx0+1-p.x)*deltaX,sdz=(dz<0?p.z-mz0:mz0+1-p.z)*deltaZ;
 let hitSide=0,d=0;
 for(let i=0;i<Math.ceil(mapSize*1.5);i++){
  if(sdx<sdz){ix+=stepGX;d=sdx;sdx+=deltaX;hitSide=1}
  else{iz+=stepGZ;d=sdz;sdz+=deltaZ;hitSide=0}
  if(isWall(ix+.01,iz+.01))break;
 }
 d=Math.max(.09,d*Math.cos(angle-p.yaw));for(let j=sx;j<Math.min(w,sx+strip);j++)zbuffer[j]=d;
 let wallBottom=horizon+eyeHeight*focal/d, wallTop=horizon-(ceilingHeight()-eyeHeight)*focal/d;
 let light=clamp(1.10-d/37,.18,1.06)*(hitSide?.77:1);
 let r=Math.round(t.wall[0]*255*light),gg=Math.round(t.wall[1]*255*light),b=Math.round(t.wall[2]*255*light);
 let fx=p.x+dx*(d/Math.max(.01,Math.cos(angle-p.yaw))),fz=p.z+dz*(d/Math.max(.01,Math.cos(angle-p.yaw)));
 let coord=(hitSide?fz:fx)%1;if(coord<0)coord++;
 const variant=(ix*31+iz*19)%7===0?1:0;
 const img=wallTexture(sectorStyle%themes.length,variant);
 C.drawImage(img,Math.min(319,Math.max(0,Math.floor(coord*319))),0,1,512,sx,wallTop,strip+1,wallBottom-wallTop);
 const darkness=clamp(.24+d/48+(hitSide?.14:0),.17,.80);
 C.fillStyle=`rgba(1,7,14,${darkness})`;
 C.fillRect(sx,wallTop,strip+1,wallBottom-wallTop);
 const diffuse=clamp(.32-d*.009,0,.25);
 if(diffuse>0){C.fillStyle=`rgba(${glowR},${glowG},${glowB},${diffuse*.23})`;C.fillRect(sx,wallTop+Math.max(0,(wallBottom-wallTop)*.12),strip+1,(wallBottom-wallTop)*.59);}
 // Every tile has metallic side ribs, a recessed center and a faint panel inset.
 let edge=coord<.12||coord>.88;
 // Procedural stamped alloy plates: repeating welds, brushed scratches, inset hardware.
 let wallH=wallBottom-wallTop;
 for(let i=1;i<=5;i++){
   let lineY=wallTop+wallH*i/6;
   C.fillStyle=`rgba(2,7,16,${clamp(.44-d*.008,.08,.39)})`;
   C.fillRect(sx,lineY,strip+1,Math.max(.6,2*focal/(d*260)));
   C.fillStyle=`rgba(181,211,220,${clamp(.18-d*.006,.02,.15)})`;
   C.fillRect(sx,lineY+Math.max(.7,1*focal/(d*270)),strip+1,Math.max(.5,.5*focal/(d*260)));
 }
 if((ix*17+iz*11)%3===0&&coord>.21&&coord<.78){
  let scuff=(ix*19+iz*13)%5;
  C.fillStyle=`rgba(153,169,171,${clamp(.14-d*.002,0,.13)})`;
  C.fillRect(sx,wallTop+wallH*(.32+scuff*.08),strip+1,Math.max(.6,wallH*.028));
 }

 if(edge){C.fillStyle=`rgba(3,8,19,${clamp(.89-d*.011,.44,.82)})`;C.fillRect(sx,wallTop,strip+1,wallBottom-wallTop)}
 else if(coord<.18||coord>.82){C.fillStyle=`rgba(155,207,236,${clamp(.18-d*.004,.03,.13)})`;C.fillRect(sx,wallTop,strip+1,wallBottom-wallTop)}
 else if((ix*11+iz*17)%4===0){C.fillStyle='rgba(2,5,16,.17)';C.fillRect(sx,wallTop+Math.max(1,12*focal/(d*400)),strip+1,Math.max(1,(wallBottom-wallTop)*.86));}
 let upper=horizon-(3.20-eyeHeight)*focal/d;
 let lower=horizon-(.32-eyeHeight)*focal/d;
 C.fillStyle='rgba(1,4,10,.38)';C.fillRect(sx,wallTop,strip+1,Math.max(1,9*focal/(d*180)));
 C.fillStyle=`rgba(${glowR},${glowG},${glowB},${clamp(.87-d/39,.10,.64)})`;
 C.fillRect(sx,upper,strip+1,Math.max(1.4,5*focal/(d*500)));
 C.fillStyle=`rgba(10,14,26,${clamp(.95-d*.008,.4,.83)})`;
 C.fillRect(sx,lower,strip+1,Math.max(1,(wallBottom-wallTop)*.022));
 if((ix*3+iz*5)%5===0&&coord>.39&&coord<.60){
  let y1=horizon-(2.62-eyeHeight)*focal/d,y2=horizon-(.85-eyeHeight)*focal/d;
  C.fillStyle=`rgba(${glowR},${glowG},${glowB},${clamp(1-d/37,.15,.75)})`;
  C.fillRect(sx,y1,strip+1,y2-y1);
  C.fillStyle='#d8faff9c';C.fillRect(sx,y1,strip+1,Math.max(1,(y2-y1)*.035));
 }
  // Large theme-dependent side murals instead of identical corridors.
  if((sectorStyle===1||sectorStyle===3)&&(ix*5+iz*3)%8===0&&coord>.19&&coord<.82){
    let y1=horizon-(2.9-eyeHeight)*focal/d;
    C.fillStyle=`rgba(${glowR},${glowG},${glowB},${clamp(.74-d/46,.10,.64)})`;
    C.fillRect(sx,y1,strip+1,Math.max(1,7*focal/(d*190)));
  }else if((sectorStyle===2||sectorStyle===4)&&(ix*5+iz*3)%8===0&&coord>.38&&coord<.6){
    let y1=horizon-(2.75-eyeHeight)*focal/d,y2=horizon-(.75-eyeHeight)*focal/d;
    C.fillStyle=`rgba(${glowR},${glowG},${glowB},${clamp(.9-d/40,.08,.56)})`;
    C.fillRect(sx,y1,strip+1,Math.max(1,y2-y1));
  }
  if((ix+iz)%7===0&&coord>.24&&coord<.71){
  let y1=horizon-(1.7-eyeHeight)*focal/d;
  C.fillStyle='rgba(6,12,27,.63)';C.fillRect(sx,y1,strip+1,Math.max(1,(wallBottom-wallTop)*.085));
  if((ix+iz)%14===0){C.fillStyle=`rgba(${glowR},${glowG},${glowB},.3)`;C.fillRect(sx,y1,strip+1,Math.max(1,2*focal/(d*460)));}
 }
}
// Marks are painted in screen-space over the actual raycast wall column.
// Depth checks prevent floating or appearing through a nearer wall.
function proj(p3){
 const dx=p3.x-p.x,dz=p3.z-p.z;
 const f=dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw),r=-dx*Math.cos(p.yaw)+dz*Math.sin(p.yaw);
 if(f<=.05)return null;
 const sx=w/2+r/f*focal,sy=horizon-(p3.y-eyeHeight)*focal/f;
 if(sx< -25||sx>w+25||sy< -30||sy>h+30)return null;
 return{x:sx,y:sy,d:f};
}
// Low-cost perspective representation of the suspended catwalk in the
// software renderer. Ground passage remains visible underneath it.
if(bridgeSpecs.length){
 const c=Math.floor(mapSize/2), half=sectorStyle===15?7:5,polys=[];
 const above=(p.feetY||0)>BRIDGE_Y-.28;
 for(let zz=c-half;zz<=c+half;zz++)for(let xx=c-3;xx<=c+3;xx++){
  if(deckAtCell(xx,zz)<=0||hypot(xx+.5-p.x,zz+.5-p.z)>22)continue;
  const level=above?BRIDGE_Y+.01:BRIDGE_Y-.17;
  const pts=[proj({x:xx,y:level,z:zz}),proj({x:xx+1,y:level,z:zz}),proj({x:xx+1,y:level,z:zz+1}),proj({x:xx,y:level,z:zz+1})];
  if(pts.some(q=>!q))continue;
  const dist=hypot(xx+.5-p.x,zz+.5-p.z);
  polys.push({dist,pts,x:xx,z:zz,above});
 }
 // Higher maintenance platforms use the same filled perspective polygons;
 // they must not be invisible just because WebGL is unavailable.
 for(const sky of skyDeckSpecs)for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
  const xx=Math.floor(sky.x)+dx,zz=Math.floor(sky.z)+dz;
  if(deckAtCell(xx,zz)<sky.y-.01)continue;
  const dist=hypot(xx+.5-p.x,zz+.5-p.z);if(dist>26)continue;
  const aboveSky=(p.feetY||0)>=sky.y-.28;
  const altitude=sky.y+(aboveSky?.01:-.17);
  const pts=[proj({x:xx,y:altitude,z:zz}),proj({x:xx+1,y:altitude,z:zz}),proj({x:xx+1,y:altitude,z:zz+1}),proj({x:xx,y:altitude,z:zz+1})];
  if(pts.some(q=>!q))continue;
  polys.push({dist,pts,x:xx,z:zz,above:aboveSky});
 }
 polys.sort((a,b)=>b.dist-a.dist);
 for(const tile of polys){
  const q=tile.pts;
  C.fillStyle=tile.above?'rgba(126,155,162,.94)':'rgba(53,72,84,.96)';
  C.strokeStyle=tile.above?'rgba(162,235,240,.42)':'rgba(58,125,135,.5)';
  C.lineWidth=Math.max(1,Math.min(2.7,15/(tile.dist+3)));
  C.beginPath();C.moveTo(q[0].x,q[0].y);
  for(let j=1;j<4;j++)C.lineTo(q[j].x,q[j].y);
  C.closePath();C.fill();C.stroke();
 }
 if(above){
  for(const side of [-1,1])for(let iz=c-half;iz<=c+half;iz+=2){
   const z=iz+.5, x=c+(side<0?-3:4);
   const a=proj({x,y:BRIDGE_Y,z}),b=proj({x,y:BRIDGE_Y+.65,z});
   if(a&&b){C.strokeStyle='rgba(178,225,226,.65)';C.lineWidth=2.0;C.beginPath();C.moveTo(a.x,a.y);C.lineTo(b.x,b.y);C.stroke();}
  }
 }
}
for(const d of (g.decals||[])){
 const q=proj(d);if(!q)continue;
 const wallDist=zbuffer[clamp(q.x|0,0,w-1)]||Infinity;
 if(q.d>wallDist+.16)continue;
 const r=Math.max(1,Math.min(28,d.r*focal/q.d)),alpha=clamp(d.life/Math.min(5,d.maxLife),0,1);
 C.save();C.globalAlpha=alpha*.95;C.translate(q.x,q.y);
 C.rotate(d.rot);C.fillStyle=d.energy?'#4b2a1e':'#080c10';
 C.beginPath();C.ellipse(0,0,r*(d.nx?.75:1),r*(d.ny?.5:1),0,0,TAU);C.fill();
 C.fillStyle='#020609';C.beginPath();C.ellipse(0,0,r*.55,r*.47,0,0,TAU);C.fill();
 if(d.energy){C.strokeStyle=`rgb(${d.col.map(c=>Math.round(c*255)).join(',')})`;C.lineWidth=1.35;C.globalAlpha=alpha*.38;C.beginPath();C.arc(0,0,r*1.25,0,TAU);C.stroke()}
 C.restore();
}
for(const tr of (g.tracers||[])){
 const a=proj(tr.a),b=proj(tr.b);if(!a||!b)continue;
 C.save();let fade=clamp(tr.life/tr.maxLife,0,1);
 C.shadowColor=`rgb(${tr.col.map(c=>Math.round(c*255)).join(',')})`;
 // Soft colored halo plus a thin white-hot core, like the tapered WebGL beam.
 C.globalAlpha=.32*fade;C.shadowBlur=16;C.strokeStyle=C.shadowColor;
 C.lineWidth=3+tr.r*45;C.beginPath();C.moveTo(a.x,a.y);C.lineTo(b.x,b.y);C.stroke();
 C.globalAlpha=.86*fade;C.shadowBlur=4;C.strokeStyle='#effcff';C.lineWidth=1+tr.r*9;
 C.beginPath();C.moveTo(a.x,a.y);C.lineTo(b.x,b.y);C.stroke();C.restore();
}
for(const b of (g.projectiles||[])){
 const q=proj(b);if(!q||q.d>(zbuffer[clamp(q.x|0,0,w-1)]||Infinity)+.12)continue;
 let rr=clamp(b.rad*focal/q.d,2,22);C.save();C.shadowBlur=22;C.shadowColor=`rgb(${b.w.color.map(c=>Math.round(c*255)).join(',')})`;
 C.fillStyle='#f4ffff';C.beginPath();C.arc(q.x,q.y,rr,0,TAU);C.fill();C.restore();
}
for(const f of (g.impactFx||[])){
 const q=proj(f);if(!q)continue;
 const fade=clamp(f.life/f.maxLife,0,1),r=clamp(f.r*focal/q.d*(1.4-fade*.4),1,95);
 C.save();C.globalAlpha=.6*fade;C.strokeStyle=`rgb(${f.col.map(c=>Math.round(c*255)).join(',')})`;C.shadowColor=C.strokeStyle;C.shadowBlur=17;C.lineWidth=2;
 C.beginPath();C.arc(q.x,q.y,r,0,TAU);C.stroke();C.restore();
}
for(const e of g.enemies)if(!e.dead&&e.telegraph>0&&e.lockTarget){
 const a=proj({x:e.x,y:1.1,z:e.z}),b=proj({x:e.lockTarget.x,y:.13,z:e.lockTarget.z});
 if(a&&b){C.save();C.strokeStyle='#ff477b';C.shadowBlur=18;C.shadowColor='#ff235d';C.globalAlpha=.62+.28*Math.sin(g.t*21);C.lineWidth=2.1;C.beginPath();C.moveTo(a.x,a.y);C.lineTo(b.x,b.y);C.stroke();C.beginPath();C.arc(b.x,b.y,Math.min(24,10*focal/b.d),0,TAU);C.stroke();C.restore();}
 }
// Third boss phase: explicit ground-wave warning in the software renderer.
for(const e of g.enemies)if(!e.dead&&e.boss&&e.ultWarn>0){
 const q=proj({x:e.x,y:.065+(e.feetY||0),z:e.z});
 if(!q)continue;
 const r=clamp(5.15*focal/q.d,8,Math.min(w,h)*1.7);
 const alpha=.44+.32*Math.sin(g.t*14);
 C.save();C.globalAlpha=alpha;C.strokeStyle='#ff9b4d';
 C.shadowBlur=18;C.shadowColor='#ff5928';C.lineWidth=2.7;
 C.beginPath();C.ellipse(q.x,q.y,r,Math.max(4,r*.30),0,0,TAU);C.stroke();
 C.setLineDash([8,7]);C.beginPath();C.ellipse(q.x,q.y,r*.62,Math.max(3,r*.19),0,0,TAU);C.stroke();C.restore();
}
const items=[];for(const sh of (g.robotDebris||[]))if(sh.life>.1)items.push({type:'robotShard',obj:sh,x:sh.x,z:sh.z,y:sh.y,size:sh.size*1.6,dy:0});for(const f of mapFeatures)items.push({type:'beacon',obj:f,x:f.x,z:f.z,y:f.kind===3?3.6:2.9,size:f.kind===3?1.15:.68,dy:0});for(const e of g.enemies){if(!e.dead)items.push({type:'enemy',obj:e,x:e.x,z:e.z,y:1.18+(Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z)),size:e.radius*2.5,dy:0})}
for(const c of (g.mission?.caches||[]))if(!c.got)items.push({type:'archive',obj:c,x:c.x,z:c.z,y:.80+floorHeight(c.x,c.z),size:.9,dy:0});for(const d of (g.devices||[]))items.push({type:'device',obj:d,x:d.x,z:d.z,y:.91+floorHeight(d.x,d.z),size:1.05,dy:0});for(const n of g.nodes)if(!n.dead)items.push({type:'node',obj:n,x:n.x,z:n.z,y:1.3+floorHeight(n.x,n.z),size:1.75,dy:0});for(const b of g.bullets)items.push({type:'bullet',obj:b,x:b.x,z:b.z,y:b.y,size:b.radius*2,dy:0});for(const l of g.loot)items.push({type:'loot',obj:l,x:l.x,z:l.z,y:.5+floorHeight(l.x,l.z)+Math.sin(g.t*5+l.x)*.15,size:.55,dy:0});if(g.portalReady)items.push({type:'portal',obj:portal,x:portal.x,z:portal.z,y:1.45+floorHeight(portal.x,portal.z),size:2.6,dy:0});
for(const a of g.particles)items.push({type:'particle',obj:a,x:a.x,z:a.z,y:a.y,size:.1,dy:0});
 if(pose?.drawActor)items.push({type:'operator',obj:actor,x:actor.x,z:actor.z,y:1.01+(actor.feetY||0),size:1.72,dy:0});
items.sort((a,b)=>hypot(b.x-p.x,b.z-p.z)-hypot(a.x-p.x,a.z-p.z));
for(const item of items){const dx=item.x-p.x,dz=item.z-p.z,forward=dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw),right=-dx*Math.cos(p.yaw)+dz*Math.sin(p.yaw);if(forward<=.13)continue;let x=w/2+right/forward*focal;if(x< -w*.4||x>w*1.4)continue;const spriteW=item.size*focal/forward,cx=Math.round(x),depth=zbuffer[clamp(cx|0,0,w-1)]||100;if(forward>depth+.17)continue;const y=horizon-(item.y-eyeHeight)*focal/forward,sz=clamp(spriteW,2,w*4),ob=item.obj;
C.save();C.translate(x,y);let shadow='rgba(30,244,255,.7)',core='#88ffff';if(item.type==='beacon'){
 C.rotate(g.t*.42+ob.phase);C.shadowColor=`rgba(${glowR},${glowG},${glowB},.8)`;
 C.shadowBlur=Math.min(28,sz*.45);C.strokeStyle=`rgba(${glowR},${glowG},${glowB},.8)`;
 C.lineWidth=Math.max(1,sz*.035);C.strokeRect(-sz*.33,-sz*.33,sz*.66,sz*.66);
 C.rotate(-g.t*1.1);C.strokeRect(-sz*.22,-sz*.22,sz*.44,sz*.44);
 C.fillStyle='#d6feff';C.fillRect(-sz*.045,-sz*.045,sz*.09,sz*.09);
 }else if(item.type==='device'){
   const color=deviceColor(ob),rgb=color.map(v=>Math.round(v*255)).join(','),alpha=ob.used?.24:1;
   C.globalAlpha=alpha;C.shadowColor=`rgb(${rgb})`;C.shadowBlur=ob.used?1:18;
   C.fillStyle='#1b2c38';C.strokeStyle=`rgb(${rgb})`;C.lineWidth=Math.max(1,sz*.055);
   C.fillRect(-sz*.30,-sz*.42,sz*.60,sz*.84);C.strokeRect(-sz*.30,-sz*.42,sz*.60,sz*.84);
   C.fillStyle=`rgb(${rgb})`;C.fillRect(-sz*.12,-sz*.12,sz*.24,sz*.24);
   if(ob.kind==='coil'&&!ob.used){C.strokeStyle=ob.active?'#ff482c':'#e9a742';C.beginPath();C.arc(0,0,sz*.53,0,TAU);C.stroke();}
  }else if(item.type==='archive'){C.rotate(g.t*.75);C.shadowColor='#60eeff';C.shadowBlur=18;C.strokeStyle='#81efff';C.lineWidth=Math.max(2,sz*.06);C.strokeRect(-sz*.34,-sz*.34,sz*.68,sz*.68);C.rotate(-g.t*1.4);C.fillStyle='#d6ffff';C.fillRect(-sz*.13,-sz*.13,sz*.26,sz*.26);}else if(item.type==='node'){const ty=NODE_TYPES[ob.type],color=ty.color,Cc=`rgb(${color.map(x=>Math.round(x*255)).join(',')})`;C.rotate(g.t*.53+ob.phase);C.shadowColor=Cc;C.shadowBlur=Math.min(45,sz*.35);C.strokeStyle=Cc;C.lineWidth=Math.max(2,sz*.065);C.strokeRect(-sz*.33,-sz*.33,sz*.66,sz*.66);C.rotate(g.t*.65);C.beginPath();C.arc(0,0,sz*.25,0,TAU);C.stroke();C.fillStyle=ob.flash>0?'white':Cc;C.fillRect(-sz*.11,-sz*.11,sz*.22,sz*.22); }else if(item.type==='robotShard'){
 C.rotate(ob.rx);C.globalAlpha=clamp(ob.life/.5,0,1);C.fillStyle=`rgb(${ob.color.map(v=>Math.round(clamp(v,0,1)*255)).join(',')})`;
 C.strokeStyle='#27323c';C.lineWidth=Math.max(1,sz*.11);
 C.beginPath();C.moveTo(0,-sz*.5);C.lineTo(sz*.5,sz*.32);C.lineTo(-sz*.42,sz*.36);C.closePath();C.fill();C.stroke();
}else if(item.type==='enemy'){drawFallbackRobot(C,ob,sz,g.t);}
 else if(item.type==='operator'){drawFallbackOperator(C,ob,sz);}
else if(item.type==='portal'){C.shadowColor='#63eeff';C.shadowBlur=30;C.strokeStyle='#74eeff';C.lineWidth=Math.max(3,sz*.042);C.rotate(g.t*.75);C.strokeRect(-sz*.3,-sz*.43,sz*.6,sz*.86);C.rotate(-g.t*1.5);C.beginPath();C.ellipse(0,0,sz*.43,sz*.48,.2,0,TAU);C.stroke();C.fillStyle='#45dfff55';C.fillRect(-sz*.13,-sz*.26,sz*.26,sz*.52)}else if(item.type==='bullet'||item.type==='particle'){let rgb=(ob.col||[.6,1,1]).map(c=>Math.round(c*255));C.shadowColor=`rgb(${rgb.join(',')})`;C.shadowBlur=Math.max(10,sz);C.fillStyle=C.shadowColor;C.beginPath();C.arc(0,0,Math.max(2,sz*.45),0,TAU);C.fill()}else{C.shadowColor='#6feaff';C.shadowBlur=15;C.rotate(g.t*2);C.fillStyle=ob.type==='heal'?'#ff638c':ob.type==='energy'?'#67edff':'#ffc976';C.beginPath();C.moveTo(0,-sz*.5);C.lineTo(sz*.32,0);C.lineTo(0,sz*.5);C.lineTo(-sz*.32,0);C.closePath();C.fill()}C.restore()}
}


const weapons=[
 {name:'ИМПУЛЬСНЫЙ КАРАБИН',short:'ИМПУЛЬС',icon:'⚡',damage:18,rate:.16,heat:8,range:32,shots:1,spread:.009,color:[.23,.91,1],mode:'hitscan',recoil:.32},
 {name:'ПЛАЗМЕННЫЙ ДРОБОВИК',short:'ДРОБОВИК',icon:'✷',damage:12,rate:.72,heat:21,range:13,shots:9,spread:.105,color:[1,.67,.32],mode:'hitscan',recoil:.96},
 {name:'РЕЛЬСОВЫЙ УСКОРИТЕЛЬ',short:'РЕЛЬСОТРОН',icon:'⌁',damage:110,rate:1.25,heat:37,range:57,shots:1,spread:0,color:[.78,.55,1],mode:'hitscan',pierce:4,recoil:1.12},
 {name:'АВТО-ПУЛЕМЁТ',short:'ШТОРМ',icon:'⟁',damage:11,rate:.077,heat:4.4,range:28,shots:1,spread:.037,color:[1,.82,.36],mode:'hitscan',recoil:.19},
 {name:'РАКЕТНАЯ УСТАНОВКА',short:'РАКЕТЫ',icon:'◈',damage:88,rate:1.10,heat:27,range:44,shots:1,spread:.009,color:[1,.42,.17],mode:'projectile',speed:17,blast:3.4,recoil:.95},
 {name:'ВЕКТОР · ПИСТОЛЕТ-ПУЛЕМЁТ',short:'ВЕКТОР',icon:'⇶',damage:12,rate:.058,heat:3.0,range:23,shots:1,spread:.056,color:[.27,1,.73],mode:'hitscan',recoil:.16},
 {name:'ТРИАДА · ШТУРМОВАЯ ВИНТОВКА',short:'ТРИАДА',icon:'≋',damage:24,rate:.52,heat:22,range:39,shots:1,spread:.016,color:[.58,1,.32],mode:'hitscan',burst:3,burstGap:.085,recoil:.38},
 {name:'ИОННЫЙ ИЗЛУЧАТЕЛЬ',short:'ИОННЫЙ',icon:'✦',damage:42,rate:.37,heat:16,range:40,shots:1,spread:.014,color:[.25,.75,1],mode:'projectile',speed:24,blast:1.15,ionStun:.75,recoil:.39},
 {name:'ГРОМ · ГРАНАТОМЁТ',short:'ГРОМ',icon:'⬡',damage:105,rate:1.35,heat:33,range:38,shots:1,spread:.022,color:[1,.58,.19],mode:'projectile',speed:12.3,blast:4.1,gravity:3.5,recoil:1.08},
 {name:'КРИО-ЛУЧ',short:'КРИО',icon:'❄',damage:34,rate:.23,heat:11,range:25,shots:1,spread:.007,color:[.55,.96,1],mode:'hitscan',freeze:1.45,recoil:.19}
];
const enemies={scout:{name:'СКАРАБЕЙ',hp:43,speed:1.38,damage:7,range:1.2,color:[.5,1,.88],radius:.42,score:45},shooter:{name:'ТУРЕЛЬ',hp:75,speed:.64,damage:9,range:11,color:[.92,.37,.95],radius:.52,score:85},brute:{name:'КОЛОСС',hp:165,speed:.55,damage:17,range:1.4,color:[1,.52,.3],radius:.69,score:180},sniper:{name:'ПРИЗРАК',hp:70,speed:.92,damage:21,range:17,color:[1,.24,.48],radius:.47,score:140},charger:{name:'ТОРНАДО',hp:78,speed:1.73,damage:11,range:1.35,color:[.95,.81,.29],radius:.47,score:90},medic:{name:'РЕГЕНЕРАТОР',hp:85,speed:.79,damage:7,range:9,color:[.34,1,.52],radius:.5,score:140},warden:{name:'СТРАЖ БАРЬЕРА',hp:175,speed:.58,damage:11,range:9,color:[.27,.67,1],radius:.68,score:230},artillery:{name:'АРТИЛЛЕРИСТ',hp:125,speed:.55,damage:16,range:12,color:[1,.53,.23],radius:.61,score:190},raider:{name:'КВАНТОВЫЙ РЕЙДЕР',hp:100,speed:1.48,damage:12,range:1.5,color:[.75,.31,1],radius:.53,score:175},drone:{name:'НЕБЕСНЫЙ ПЕРЕХВАТЧИК',hp:94,speed:1.26,damage:13,range:12,color:[.30,.81,1],radius:.48,score:170},skyhunter:{name:'ФАЗОВЫЙ ОХОТНИК',hp:125,speed:1.47,damage:16,range:14,color:[.80,.38,1],radius:.55,score:230},skyguard:{name:'НЕБЕСНЫЙ СТРАЖ',hp:220,speed:.91,damage:22,range:16,color:[1,.54,.26],radius:.70,score:365},stormray:{name:'ГРОЗОВОЙ СКАТ',hp:150,speed:1.77,damage:19,range:17,color:[.31,1,.79],radius:.59,score:290}};
const bossNames=['ПОЛИГОННЫЙ ЖНЕЦ','ЛЕВИАФАН РАЗЛОМА','МАТКА УЛЬЯ','ХРОНО-СТРАЖ','ПРОТОКОЛЬНЫЙ ТИТАН','АПОСТОЛ ПУСТОТЫ','РАСКОЛОТАЯ СИНГУЛЯРНОСТЬ','ВЕЧНЫЙ АРХОНТ'];
const upgrades=[{id:'damage',icon:'✹',name:'Критический резонанс',desc:'Урон всех орудий +18% к предыдущему значению.',fn:g=>g.p.damage*=1.18},{id:'health',icon:'♥',name:'Бронеконтур',desc:'Макс. прочность +30, лечение 30.',fn:g=>{g.p.maxhp+=30;g.p.hp=Math.min(g.p.maxhp,g.p.hp+30)}},{id:'rapid',icon:'ϟ',name:'Разогнанный затвор',desc:'Базовая скорострельность +15%. При перегреве эффективность ограничена охлаждением.',fn:g=>g.p.rate/=1.15},{id:'capacitor',icon:'◇',name:'Квантовая батарея',desc:'Макс. энергия +25 и восстановление +18% к предыдущему значению.',fn:g=>{g.p.maxEnergy+=25;g.p.energy=g.p.maxEnergy;g.p.regen*=1.18}},{id:'armor',icon:'⬡',name:'Композитные бронеплиты',desc:'Броня +30, защита корпуса и восстановление брони.',fn:g=>{g.p.maxArmor+=30;g.p.armor+=30;g.p.armorTier=Math.min(4,(g.p.armorTier||0)+1);g.p.armorRegen=(g.p.armorRegen||2.6)+.65;}},{id:'pierce',icon:'➳',name:'Сквозной заряд',desc:'Шанс критического попадания +7 процентных пунктов.',fn:g=>g.p.crit+=.07},{id:'cool',icon:'❄',name:'Сверхохлаждение',desc:'Нагрев оружия −20% к предыдущему значению.',fn:g=>g.p.heatMod*=.8},{id:'dash',icon:'➤',name:'Фазовый след',desc:'Энергозатраты рывка −23%, скорость +8%.',fn:g=>{g.p.dashCost*=.77;g.p.speed*=1.08}},{id:'magnet',icon:'◉',name:'Магнит материи',desc:'Радиус сбора трофеев увеличен.',fn:g=>g.p.magnet+=1.3},{id:'lifesteal',icon:'✚',name:'Вампир-наниты',desc:'Восстановление 3 HP за убийство.',fn:g=>g.p.vamp+=3},{id:'shock',icon:'✺',name:'Сверхимпульс',desc:'Импульс наносит на 40% больше урона.',fn:g=>g.p.shock*=1.4},{id:'energyshield',icon:'✧',name:'Нестабильная броня',desc:'Длительность барьера +25% к предыдущему значению.',fn:g=>g.p.shieldDuration*=1.25},{id:'bullet',icon:'☄',name:'Усиленные снаряды',desc:'Скорость пуль врагов −12% к предыдущему значению.',fn:g=>g.p.slowBullets*=.88},{id:'repair',icon:'⚕',name:'Полевой ремонт',desc:'Восстановить 60 HP немедленно.',fn:g=>g.p.hp=Math.min(g.p.maxhp,g.p.hp+60)},{id:'fieldarmor',icon:'⚒',name:'Экстренная бронеподдержка',desc:'Немедленно восстановить 35% прочности физического костюма и 25 единиц энергобарьера.',fn:g=>{const p=g.p;p.bodyArmor=Math.min(p.bodyArmorMax||0,(p.bodyArmor||0)+(p.bodyArmorMax||0)*.35);p.armor=Math.min(p.maxArmor,p.armor+25)}},{id:'crit',icon:'✦',name:'Слабые точки',desc:'Критический урон: +25 процентных пунктов к обычному урону (×1,75 → ×2,00).',fn:g=>g.p.critDamage+=.25},{id:'walk',icon:'⇶',name:'Лёгкий экзоскелет',desc:'Скорость движения +16% к предыдущему значению.',fn:g=>g.p.speed*=1.16},{id:'regen',icon:'❖',name:'Самосборка',desc:'Постепенно восстанавливает HP.',fn:g=>g.p.healRegen+=.45},{id:'fieldkit',icon:'⚒',name:'Полевой инженер',desc:'Ремонт и заряд от станций +35%, восстановление брони +20%.',fn:g=>{g.p.devicePower=(g.p.devicePower||1)*1.35;g.p.armorRegen=(g.p.armorRegen||2.6)*1.2;}},{id:'super',icon:'◎',name:'Перегрузка',desc:'Урон +12% к предыдущему значению, энергия +15.',fn:g=>{g.p.damage*=1.12;g.p.maxEnergy+=15;g.p.energy+=15}}];
// Multiplicative permanent bonuses have intentionally restrained per-rank
// percentages: 40 ranks must not create infinite energy or invincible HP.
const PERM_COMPOUND={health:1.08,damage:1.04,barrier:1.09,regen:1.04,capacity:1.04,pulseRadius:1.012,pulseDamage:1.04,repairHull:1.03,repairSuit:1.025,repairBarrier:1.02,shieldDuration:1.006};
// Purchase ranks are clamped by normalizePerms before reaching gameplay.
// Keep this pure formula independently testable by the economy audit tools.
const permanentStat=(base,multiplier,level)=>base*Math.pow(multiplier,Math.max(0,Math.floor(Number(level)||0)));
function newPlayer(){const suit=equippedArmorStats(),hp=permanentStat(100,PERM_COMPOUND.health,save.perms[0]),barrier=permanentStat(30,PERM_COMPOUND.barrier,save.perms[2]),energy=permanentStat(100,PERM_COMPOUND.capacity,save.perms[4]);return{x:spawnX,z:spawnZ,yaw:1.2,pitch:0,hp,maxhp:hp,armor:barrier,maxArmor:barrier,armorTier:Math.min(4,Math.floor(save.perms[2]/2)),armorDelay:0,armorRegen:2.6,bodyArmorType:suit.id,bodyArmorMax:suit.maxDurability,bodyArmor:suit.maxDurability,bodyArmorReduction:suit.reduction,bodyArmorWear:suit.wear,energy,maxEnergy:energy,regen:permanentStat(16,PERM_COMPOUND.regen,save.perms[3]),damage:permanentStat(1,PERM_COMPOUND.damage,save.perms[1]),speed:3.05,rate:1,heatMod:1,heat:0,heatLock:0,cooldown:0,weapon:0,crit:.06,critDamage:1.75,shield:0,shieldDuration:permanentStat(3.5,PERM_COMPOUND.shieldDuration,save.perms[11]),abilityCooldowns:{dash:0,pulse:0,shield:0,heal:0},dashCost:25,dashRange:DASH_DISTANCE_BASE+save.perms[5]*DASH_UPGRADE_STEP,magnet:1.1,vamp:0,shock:1,slowBullets:1,healRegen:0,recoil:0,shotGlow:0,equipAnim:0,iframes:0,flying:false,flightUnlocked:armorGrantsFlight(suit),walk:0,shots:0,aimAssist:true,devicePower:1,feetY:0,vy:0,grounded:true}}
function freshGame(){const p=newPlayer();return{state:'playing',sector:1,p,appliedPerms:[...save.perms],score:0,kills:0,target:0,spawned:0,waveDelay:0,enemies:[],bullets:[],particles:[],tracers:[],scorch:[],decals:[],impactFx:[],projectiles:[],burstQueue:[],loot:[],nodes:[],nodesDestroyed:0,t:0,sectorTime:0,portalReady:false,boss:null,upgrades:{},idCounter:0,combo:0,comboAt:0,helpTime:0,totalCredits:0,mission:null,arenaEvent:null,devices:[],robotDebris:[]}}
function startGame(resume=false,chosenStage=null){
 const selected=chosenStage===null?1:Math.floor(Number(chosenStage));
 if(!resume){
   if(!developerStageAccessible(selected)){showCampaignMap();return;}
   save.checkpoint=null;save.campaign.lastSelected=selected;save.runs++;
   const rec=save.campaign.records[selected]||{};
   save.campaign.records[selected]={...rec,attempts:(Number(rec.attempts)||0)+1};
   persist();
 }
 let g=freshGame(),ck=resume?save.checkpoint:null;
 if(!ck)g.sector=selected;
 legacyResumeSector=(ck?.sector>=11&&(ck?.mapSchema==='v10'||ck?.mapSchema==='v12'||ck?.mapSchema==='v14'||ck?.mapSchema==='v16'||!ck.mapSchema))?ck.sector:-1;legacyResumeDivisor=(ck?.mapSchema==='v16'?16:ck?.mapSchema==='v14'?14:(ck?.mapSchema==='v10'||!ck?.mapSchema)?10:12);
 if(ck){g.sector=clamp(Number(ck.sector)||1,1,CAMPAIGN_MAX_LEVEL);if(ck.player)Object.assign(g.p,ck.player);g.score=ck.score||0;g.kills=ck.kills||0;g.upgrades=ck.upgrades||{};}
 game=g;
$('gun').dataset.gun=String(g.p.weapon);$('gun').style.setProperty('--weapon-glow',`rgb(${weapons[g.p.weapon].color.map(v=>Math.round(v*255)).join(',')})`);enterSector(g.sector);if(ck?.version>=3)restoreLiveCheckpoint(ck);else if(ck?.player){Object.assign(g.p,ck.player);if(collide(g.p.x,g.p.z,.3)){g.p.x=spawnX;g.p.z=spawnZ;}}g.p.flightUnlocked=newPlayer().flightUnlocked;g.p.bodyArmorWear=equippedArmorStats().wear;g.p.flying=!!g.p.flying&&g.p.flightUnlocked;refreshFlightButtons();if(g.state==='upgrade'){if(g.sector>=CAMPAIGN_MAX_LEVEL){save.checkpoint=null;persist();showFinalVictory();}else showUpgrade(g.pendingUpgrade);return;}saveRun();$('overlay').classList.add('hidden');$('hud').classList.add('show');$('bossWrap').style.display='none';lastFrame=performance.now();audioStart();toast('СЕКТОР '+g.sector+' · '+themes[sectorStyle%themes.length].name,2.8);updateHud(true)}
// Stage transition is a field resupply, not a reset to full equipment. Earned
// suit plates and repair stations matter, but a long run must not inevitably
// degrade into a one-hit death after a dozen otherwise successful missions.
const SECTOR_RESUPPLY={hp:.20,barrier:.28,suit:.34,postBossSuit:.12};
function enterSector(n){const g=game,previous=g.sector;g.sector=n;g.sectorTime=0;g.spawned=0;g.enemies=[];g.bullets=[];g.particles=[];g.tracers=[];g.scorch=[];g.decals=[];decalDirty=true;g.impactFx=[];g.nodes=[];g.nodesDestroyed=0;g.projectiles=[];g.burstQueue=[];g.loot=[];g.devices=[];g.robotDebris=[];g.portalReady=false;g.boss=null;g.waveDelay=1.3;g.p.x=spawnX;g.p.z=spawnZ;
 if(n!==previous){
  g.p.hp=Math.min(g.p.maxhp,g.p.hp+g.p.maxhp*SECTOR_RESUPPLY.hp);
  g.p.armor=Math.min(g.p.maxArmor,g.p.armor+g.p.maxArmor*SECTOR_RESUPPLY.barrier);
  const extra=previous%5===0?SECTOR_RESUPPLY.postBossSuit:0;
  g.p.bodyArmor=Math.min(g.p.bodyArmorMax||0,(g.p.bodyArmor||0)+(g.p.bodyArmorMax||0)*(SECTOR_RESUPPLY.suit+extra));
 }else{
  // New runs already start at full health and with an intact purchased suit.
  g.p.armor=clamp(g.p.armor,0,g.p.maxArmor);
  g.p.bodyArmor=clamp(g.p.bodyArmor||0,0,g.p.bodyArmorMax||0);
 }
 g.p.energy=g.p.maxEnergy;g.p.heat=0;buildMap(n);g.p.x=spawnX;g.p.z=spawnZ;g.p.feetY=floorHeight(spawnX,spawnZ);g.p.vy=0;g.p.grounded=true;g.p.flying=false;g.p.abilityCooldowns={dash:0,pulse:0,shield:0,heal:0};g.p.yaw=chooseEntranceYaw();refreshFlightButtons();spawnPowerNodes(n);startMission(g);initDevices(g);closeArsenal();g.target=n%5===0?1:Math.min(30,7+Math.floor(n*1.2));$('sectorText').textContent=String(n).padStart(2,'0')+' · '+sectorArchitecture; $('zoneText').textContent=sectorArchitecture;$('bossWrap').style.display='none';$('killText').textContent='УНИЧТОЖЕНО 0 / '+g.target;}
function chooseEntranceYaw(){
  // Face a genuine corridor instead of the nearest blank wall. This also makes
  // the entry shot look more like a new level, not a fixed grey corner.
  const desired=Math.atan2(portal.x-spawnX,portal.z-spawnZ);
  let best=desired,bestScore=-Infinity;
  for(let i=0;i<48;i++){
    let a=TAU*i/48,dx=Math.sin(a),dz=Math.cos(a),clear=0;
    for(let t=.6;t<=14;t+=.35){
      if(collide(spawnX+dx*t,spawnZ+dz*t,.23))break;
      clear=t;
    }
    let alignment=Math.cos(a-desired);
    let score=clear+alignment*.42;
    if(score>bestScore){bestScore=score;best=a;}
  }
  return best;
}
// Persistent armory: each gun has its own 20-level research paths.
// Penetration is the unmitigated fraction of damage, NOT railgun target count.
const WEAPON_MAX_LEVEL=20;
// Stage 22 balance constants: all shop, tooltip and combat formulas below use
// the same values. Percent reductions for precision/rate are multiplicative;
// penetration adds percentage POINTS, never 'percent of a percent'.
const ECONOMY_BALANCE={
 gunPower:1.055,gunPenetrationPoints:.018,railgunPenetrationPoints:.0135,
 gunRate:.978,gunRateHeat:.975,
 gunCooling:.974,gunPrecision:.968,gunBlast:.032,gunFreeze:.06,
 armorDurabilityPerLevel:.08,legacyArmorStep:.0045,
 armorUpgradeBase:18,armorUpgradePriceShare:.005
};
const FLIGHT_MOD_MAX_LEVEL=20;
const FLIGHT_HORIZONTAL_GROWTH=1.05,FLIGHT_VERTICAL_GROWTH=1.05;
const GUN_PATHS=[
 ['power','penetration','cooling'],       // carbine
 ['power','penetration','precision'],     // shotgun
 ['power','penetration','rate'],          // railgun
 ['power','penetration','cooling'],       // machine gun
 ['power','penetration','blast'],         // rocket launcher
 ['power','penetration','rate'],          // vector SMG
 ['power','penetration','precision'],     // triad
 ['power','penetration','blast'],         // ion launcher
 ['power','penetration','blast'],         // grenade launcher
 ['power','penetration','freeze']         // cryo beam
];
const GUN_PATH_LABELS={
 power:['Ударный модуль','Урон ×1,055 за уровень (+5,5% к предыдущему)'],
 penetration:['Пробиваемость','Доля урона, обходящая броню: +1,8 п.п. за LVL; рельсотрон +1,35 п.п. (потолок 94%)'],
 cooling:['Термостабилизатор','Нагрев ×0,974 за уровень (−2,6%)'],
 precision:['Стабилизация','Разброс ×0,968 за уровень (−3,2%)'],
 rate:['Механизм перезарядки','Интервал между залпами ×0,978 (−2,2%); нагрев −2,5% за LVL — проверено при перегреве'],
 blast:['Радиус взрыва','Радиус ×1,032 за уровень (+3,2% к предыдущему)'],
 freeze:['Криоконтур','Заморозка ×1,06 за уровень (+6% к предыдущему)']
};
const GUN_BASE_PENETRATION=[.20,.13,.67,.16,.27,.12,.26,.43,.24,.38];
// A gun's research price depends on combat role, not its arbitrary position
// in the inventory. Close-range and control weapons should not cost twice as
// much as stronger long-range weapons solely because their index is larger.
const GUN_RESEARCH_BASE_PRICE=[42,53,64,64,72,55,70,78,82,60];
function normalizeLoadoutSave(){
 if(!save.weaponMods||typeof save.weaponMods!=='object'||Array.isArray(save.weaponMods))save.weaponMods={};
 for(let i=0;i<weapons.length;i++){
  const entry=save.weaponMods[i];
  if(!entry||typeof entry!=='object'||Array.isArray(entry)){save.weaponMods[i]={};continue;}
  const clean={};for(const path of GUN_PATHS[i])clean[path]=clamp(Math.floor(Number(entry[path])||0),0,WEAPON_MAX_LEVEL);
  save.weaponMods[i]=clean;
 }
 const old=save.bodyArmor;
 if(!old||typeof old!=='object'||Array.isArray(old))save.bodyArmor={owned:{},equipped:-1};
 if(!save.bodyArmor.owned||typeof save.bodyArmor.owned!=='object'||Array.isArray(save.bodyArmor.owned))save.bodyArmor.owned={};
 for(const key of Object.keys(save.bodyArmor.owned)){
  const id=Number(key);
  if(!Number.isInteger(id)||id<0||id>=BODY_ARMOR_CATALOG.length)delete save.bodyArmor.owned[key];
  else save.bodyArmor.owned[key]=clamp(Math.floor(Number(save.bodyArmor.owned[key])||0),0,20);
 }
 let equipped=Number(save.bodyArmor.equipped);
 if(!Number.isInteger(equipped)||!(equipped in save.bodyArmor.owned))equipped=-1;
 save.bodyArmor.equipped=equipped;
 if(!save.bodyArmor.flightMods||typeof save.bodyArmor.flightMods!=='object'||Array.isArray(save.bodyArmor.flightMods))save.bodyArmor.flightMods={};
 for(const key of Object.keys(save.bodyArmor.flightMods)){
  const id=Number(key),entry=save.bodyArmor.flightMods[key];
  if(!Number.isInteger(id)||id<0||id>=BODY_ARMOR_CATALOG.length||!Object.prototype.hasOwnProperty.call(save.bodyArmor.owned,id)){
   delete save.bodyArmor.flightMods[key];continue;
  }
  save.bodyArmor.flightMods[key]={horizontal:clamp(Math.floor(Number(entry?.horizontal)||0),0,FLIGHT_MOD_MAX_LEVEL),vertical:clamp(Math.floor(Number(entry?.vertical)||0),0,FLIGHT_MOD_MAX_LEVEL)};
 }
}
function gunPathLevel(index,path){return clamp(Math.floor(Number(save.weaponMods?.[index]?.[path])||0),0,WEAPON_MAX_LEVEL);}
function gunPrice(index,path){
 const lv=gunPathLevel(index,path),factor=path==='power'?1.30:path==='penetration'?1.20:path==='blast'?1.16:1;
 return Math.round(GUN_RESEARCH_BASE_PRICE[index]*factor*(1+lv*.22+lv*lv*.022));
}
function combatWeapon(index){
 const b=weapons[index],up=id=>gunPathLevel(index,id),w={...b};
 w.damage=b.damage*Math.pow(ECONOMY_BALANCE.gunPower,up('power'));
 // All 20 research ranks must improve the stat. Railgun starts at 67%:
 // 1.8 pp/level would hit the 94% cap at rank 15, wasting five purchases.
 const penetrationStep=index===2?ECONOMY_BALANCE.railgunPenetrationPoints:ECONOMY_BALANCE.gunPenetrationPoints;
 w.penetration=clamp(GUN_BASE_PENETRATION[index]+penetrationStep*up('penetration'),0,.94);
 w.rate=b.rate*Math.pow(ECONOMY_BALANCE.gunRate,up('rate'));
 // Railgun and SMG are heat-limited. A pure firing-interval upgrade would
 // produce ZERO long-run DPS there; the mechanism also improves heat recovery
 // efficiency by lowering heat per shot (1.4% per research rank).
 w.heat=b.heat*Math.pow(ECONOMY_BALANCE.gunCooling,up('cooling'))*
  Math.pow(ECONOMY_BALANCE.gunRateHeat,up('rate'));
 w.spread=b.spread*Math.pow(ECONOMY_BALANCE.gunPrecision,up('precision'));
 if(b.blast)w.blast=b.blast*Math.pow(1+ECONOMY_BALANCE.gunBlast,up('blast'));
 if(b.freeze)w.freeze=b.freeze*Math.pow(1+ECONOMY_BALANCE.gunFreeze,up('freeze'));
 return w;
}
// Weapon-specific operational descriptions shown alongside numeric stats.
// These deliberately describe the actual combat code, not imagined effects.
const GUN_TACTICS=[
 'Карабин: точные одиночные импульсы, дальний бой и стабильный нагрев.',
 'Дробовик: 9 отдельных дробин за спуск; вблизи суммарный урон выше.',
 'Рельсотрон: прямой луч без разброса проходит до четырёх роботов; сильный обход защиты.',
 'Пулемёт: долгий непрерывный огонь, постепенный перегрев.',
 'Ракетница: прямолинейный снаряд; прямое попадание и взрыв по площади.',
 'Вектор: короткая дистанция, минимальный интервал и высокий разброс.',
 'Триада: три быстрых выстрела в очереди, хороший средний и дальний бой.',
 'Ионный излучатель: быстрый заряд с небольшим взрывом и электрошоком роботов.',
 'Гром: тяжёлая граната летит по дуге и создаёт самый широкий базовый взрыв.',
 'Крио-луч: быстрый точный выстрел, временно обездвиживающий роботов.'
];
function gunNumericStats(index){
 const w=combatWeapon(index);
 const parts=[`Урон ${Math.round(w.damage*10)/10}${w.shots>1?' × '+w.shots+' дробин':''}`,
  `Дальность ${w.range} м`,`Задержка ${w.rate.toFixed(3)} с`,
  `Нагрев ${w.heat.toFixed(1)}`,`Пробиваемость ${Math.round(w.penetration*100)}%`];
 if(w.spread)parts.push(`Разброс ${(w.spread*180/Math.PI).toFixed(2)}°`);
 if(w.blast)parts.push(`Взрыв ${w.blast.toFixed(2)} м`);
 if(w.speed)parts.push(`Скорость ${w.speed.toFixed(1)} м/с`);
 if(w.freeze)parts.push(`Заморозка ${w.freeze.toFixed(2)} с`);
 if(w.ionStun)parts.push(`Электрошок ${w.ionStun.toFixed(2)} с`);
 if(w.burst)parts.push(`Очередь ${w.burst} × ${w.burstGap.toFixed(3)} с`);
 if(w.pierce)parts.push(`До ${w.pierce} целей`);
 return parts.join(' · ');
}
// Sixteen purchasable physical suits; these are SEPARATE from the rechargeable
// energy barrier. None is available to a new player until purchased.
const BODY_ARMOR_CATALOG=[
 {name:'Патрульный жилет',price:45,durability:65,reduction:.13,color:[.23,.43,.51]},
 {name:'Усиленный композит',price:200,durability:90,reduction:.19,color:[.28,.47,.59]},
 {name:'Керамический дозор',price:400,durability:125,reduction:.25,color:[.57,.64,.66]},
 {name:'Титановый каркас',price:700,durability:165,reduction:.32,color:[.43,.57,.65]},
 {name:'Вольфрамовый бастион',price:1050,durability:210,reduction:.38,color:[.30,.39,.44]},
 {name:'Экзопанцирь «Атлас»',price:1500,durability:260,reduction:.45,color:[.57,.53,.42]},
 {name:'Гравитон-X',price:2000,durability:315,reduction:.51,color:[.39,.53,.78]},
 {name:'Фазовая мантия',price:3400,durability:375,reduction:.57,color:[.62,.41,.82]},
 {name:'Адамантовый корпус',price:4900,durability:455,reduction:.64,color:[.67,.73,.79]},
 {name:'Вакуумный бастион',price:6900,durability:535,reduction:.70,color:[.31,.39,.64]},
 {name:'Архонтов панцирь',price:9900,durability:655,reduction:.76,color:[.94,.70,.31]},
 {name:'Сингулярный экзокостюм',price:13900,durability:840,reduction:.81,color:[.43,.94,.92]},
 // Endgame plating trades high upfront cost for a stronger reduction AND a
 // lower durability cost per absorbed hit. Near-100% reduction is real, but
 // the suit still wears down and must be repaired by sector transitions.
 {name:'Квантовый рубеж',price:19500,durability:1250,reduction:.915,armorStep:.00275,maxReduction:.970,wear:.72,color:[.33,.58,.88]},
 {name:'Сфера нулевого импульса',price:27000,durability:2100,reduction:.955,armorStep:.00190,maxReduction:.993,wear:.35,color:[.65,.43,.95]},
 {name:'Оболочка горизонта',price:38000,durability:3600,reduction:.994,armorStep:.00020,maxReduction:.998,wear:.50,color:[.88,.52,.72]},
 // Compounding 8% durability on the previous tier made its maxed version
 // outperform this more expensive base tier in both lifetime and reduction.
 // A lighter wear coefficient preserves a real, non-dominated final choice.
 {name:'Сингулярность Ω',price:55000,durability:5600,reduction:.9945,armorStep:.00025,maxReduction:.9995,wear:.16,color:[.97,.88,.50]}
];
function armorProgress(id,level=0){
 const b=BODY_ARMOR_CATALOG[id],lv=clamp(Number(level)||0,0,20);
 // Keep fractional durability internally: +8% must be mathematically exact
 // even for a 65-point starter suit (65 × 1.08 = 70.2, not 70).
 return{maxDurability:b.durability*Math.pow(1+ECONOMY_BALANCE.armorDurabilityPerLevel,lv),
  reduction:Math.min(b.maxReduction??.90,b.reduction+(b.armorStep??ECONOMY_BALANCE.legacyArmorStep)*lv),
  wear:b.wear??1.12};
}
function flightResearchLevel(id,axis){return clamp(Math.floor(Number(save.bodyArmor?.flightMods?.[id]?.[axis])||0),0,FLIGHT_MOD_MAX_LEVEL);}
function flightResearchPrice(id,axis){
 const lv=flightResearchLevel(id,axis),base=BODY_ARMOR_CATALOG[id];
 return Math.round((45+Math.sqrt(base.price)*3.5)*(1+lv*.19+lv*lv*.018));
}
function flightSpeedMultiplier(axis,level=flightResearchLevel(save.bodyArmor?.equipped,axis)){
 return Math.pow(axis==='vertical'?FLIGHT_VERTICAL_GROWTH:FLIGHT_HORIZONTAL_GROWTH,level);
}
function equippedArmorStats(){
 const id=save.bodyArmor?.equipped;
 if(!Number.isInteger(id)||id<0||!BODY_ARMOR_CATALOG[id]||!Object.prototype.hasOwnProperty.call(save.bodyArmor.owned,id))return{id:-1,level:0,maxDurability:0,reduction:0,wear:1.12};
 const b=BODY_ARMOR_CATALOG[id],level=clamp(Number(save.bodyArmor.owned[id])||0,0,20);
 return{id,level,...armorProgress(id,level)};
}
// A suit from catalog tier 10+ already has flight hardware. Earlier suits
// can acquire it through ten levels of their own purchased upgrades.
// No suit means no flight, even when an old checkpoint says otherwise.
function armorGrantsFlight(suit=equippedArmorStats()){
 return suit.id>=9 || suit.id>=0&&suit.level>=10;
}
function armorUpgradePrice(id){
 const lv=save.bodyArmor?.owned?.[id]||0;
 const b=BODY_ARMOR_CATALOG[id];
 return Math.round((ECONOMY_BALANCE.armorUpgradeBase+b.price*ECONOMY_BALANCE.armorUpgradePriceShare)*(1+lv*.12+lv*lv*.012));
}
// A hint, not a gate: skilled players can use lighter equipment, and players
// who struggle are free to buy the next tier sooner.
function recommendedArmorId(level){
 const milestones=[[1,0],[10,4],[20,7],[40,10],[60,12],[80,14],[100,15]];
 for(let i=1;i<milestones.length;i++)if(level<=milestones[i][0]){
  const [a,x]=milestones[i-1],[b,y]=milestones[i];
  return clamp(Math.round(x+(y-x)*(level-a)/(b-a)),0,BODY_ARMOR_CATALOG.length-1);
 }
 return BODY_ARMOR_CATALOG.length-1;
}
normalizeLoadoutSave();

// BFS flow-field for enemy navigation. Updated <2 Hz; no per-enemy A*.
function rebuildNavigation(){
  if(!game)return;
  const sz=mapSize,px=clamp(Math.floor(game.p.x),0,sz-1),pz=clamp(Math.floor(game.p.z),0,sz-1);
  const val=new Int16Array(sz*sz);val.fill(32767);
  const qx=new Int16Array(sz*sz),qz=new Int16Array(sz*sz);
  let head=0,tail=0;val[pz*sz+px]=0;qx[tail]=px;qz[tail++]=pz;
  while(head<tail){const x=qx[head],z=qz[head++],d=val[z*sz+x]+1;
    for(const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0]]){
      const X=x+dx,Z=z+dz;
      if(X<1||Z<1||X>=sz-1||Z>=sz-1||mapCells[Z][X])continue;
      if(!enemyNavEdge(x,z,X,Z))continue;
      const ix=Z*sz+X;if(d>=val[ix])continue;
      val[ix]=d;qx[tail]=X;qz[tail++]=Z;
    }
  }
  navField=val;navClock=.65;
}
function enemyHeading(e,p){
  if(!e.airborne&&bridgeSpecs.length && p.feetY>BRIDGE_Y-.38 && (e.feetY||0)<BRIDGE_Y-.30){
    const c=Math.floor(mapSize/2);
    if(!e.rampSide)e.rampSide=e.x<c?-1:1;
    const side=e.rampSide;
    const outer={x:c+side*13.5,z:c+.5},inner={x:c+side*2.5,z:c+.5};
    if(e.rampAccess || hypot(e.x-outer.x,e.z-outer.z)<1.4)e.rampAccess=true;
    const target=e.rampAccess?inner:outer;
    const dx=target.x-e.x,dz=target.z-e.z,d=hypot(dx,dz)||1;
    return {dx:dx/d,dz:dz/d};
  }
  if(e.rampAccess&&(e.feetY||0)>BRIDGE_Y-.38)e.rampAccess=false;
  let d=hypot(p.x-e.x,p.z-e.z)||1;
  if(enemyDirectRoute(e,p))return {dx:(p.x-e.x)/d,dz:(p.z-e.z)/d};
  if(!navField)return {dx:(p.x-e.x)/d,dz:(p.z-e.z)/d};
  const x=Math.floor(e.x),z=Math.floor(e.z),sz=mapSize;
  if(x<1||z<1||x>=sz-1||z>=sz-1)return {dx:0,dz:0};
  let best=navField[z*sz+x],targetX=x+.5,targetZ=z+.5;
  const offsets=[[0,1],[0,-1],[1,0],[-1,0]];
  for(const [mx,mz] of offsets){const X=x+mx,Z=z+mz;if(mapCells[Z]?.[X]!==0||!enemyNavEdge(x,z,X,Z))continue;
    let cost=navField[Z*sz+X];if(cost<best){best=cost;targetX=X+.5;targetZ=Z+.5;}
  }
  let dx=targetX-e.x,dz=targetZ-e.z,mag=hypot(dx,dz);
  if(mag<.13)return {dx:(p.x-e.x)/d,dz:(p.z-e.z)/d};
  return {dx:dx/mag,dz:dz/mag};
}
// STAGE 11 — A spawn is a physical placement, not merely a free map tile.
// Stage 10 made moving actors tangible, but the old random generator could
// materialise them inside an existing robot. Never use the portal as an unsafe
// last resort; a temporarily full arena should retry the wave later instead.
function enemySpawnSpaceClear(x,z,bodyRadius=.48,bodyHeight=1.9){
 const g=game;
 if(!g||!Number.isFinite(x)||!Number.isFinite(z)||
    x<1||z<1||x>=mapSize-1||z>=mapSize-1)return false;
 const r=Math.max(.25,Number(bodyRadius)||.48);
 if(collide(x,z,Math.max(.45,r))||
    (glReady&&worldSolidBodyCollision(x,z,r,floorHeight(x,z),bodyHeight)))return false;
 const feet=floorHeight(x,z),top=feet+bodyHeight;
 if(Math.hypot(x-g.p.x,z-g.p.z)<r+.60 &&
    feet<=(g.p.feetY||0)+1.92 && top>=(g.p.feetY||0)+.15)return false;
 for(const e of g.enemies){
  if(e.dead||!Number.isFinite(e.x)||!Number.isFinite(e.z))continue;
  const ef=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
  if(top<=ef+.03||feet>=ef+enemyBodyHeight(e)-.03)continue;
  // A small buffer lets freshly spawned neighbours begin walking freely.
  if(Math.hypot(x-e.x,z-e.z)<r+enemyCrowdRadius(e)+.08)return false;
 }
 return true;
}
function randFloor(minDist=7,bodyRadius=.48,bodyHeight=1.9){
 const g=game;if(!g)return null;
 let backup=null;
 for(let t=0;t<240;t++){
  const x=2+Math.random()*(mapSize-4),z=2+Math.random()*(mapSize-4);
  if(!enemySpawnSpaceClear(x,z,bodyRadius,bodyHeight))continue;
  const d=hypot(x-g.p.x,z-g.p.z);
  if(d<minDist)continue;
  if(d<Math.min(22,mapSize*.38)&&(d>11||!lineClear(g.p.x,g.p.z,x,z)))return {x,z};
  if(!backup)backup={x,z};
 }
 if(backup)return backup;
 // A predictable fallback is vital in a crowded arena: random retries can
 // miss the last free tile. Search cell centres and a small offset grid, but
 // do not summon a robot inside another robot or the portal's structures.
 const offsets=[[.5,.5],[.28,.28],[.72,.72],[.28,.72],[.72,.28]];
 let best=null,bestScore=-Infinity;
 for(let z=1;z<mapSize-1;z++)for(let x=1;x<mapSize-1;x++){
  if(mapCells[z]?.[x]!==0)continue;
  for(const [u,v] of offsets){
   const xx=x+u,zz=z+v,d=hypot(xx-g.p.x,zz-g.p.z);
   if(d<minDist||!enemySpawnSpaceClear(xx,zz,bodyRadius,bodyHeight))continue;
   // Prefer the original spawning band near the player, without depending on
   // PRNG luck. Never sacrifice collision validity for proximity.
   const score=-Math.abs(d-Math.min(15,Math.max(minDist,11)))+.0001*(xx+zz);
   if(score>bestScore){best={x:xx,z:zz};bestScore=score;}
  }
 }
 return best;
}
function spawnEnemy(type,boss=false){let g=game,air=!boss&&['drone','skyhunter','skyguard','stormray'].includes(type);const size=enemies[type]?.radius||.48;const flightHeight=air?Math.max(2.12,2.12*Math.max(.76,Math.min(1.31,size/.51))):1.9;let p=randFloor(boss?11:6,boss ? .78 : air ? .66 : .48,boss ? 3.1 : air ? flightHeight+.18 : 1.9);if(!p)return null;let prop=boss?{name:bossNames[((g.sector/5)|0)-1>=0?(((g.sector/5)|0)-1)%bossNames.length:0],hp:430+g.sector*55,speed:.58,damage:17+g.sector*1.2,range:14,color:[1,.25,.62],radius:1.03,score:1300}:enemies[type];if(!prop)prop=enemies.scout;let scale=1+Math.max(0,g.sector-1)*.055;let obj={id:++g.idCounter,x:p.x,z:p.z,feetY:floorHeight(p.x,p.z),type:boss?'boss':type,boss,airborne:air,elite:!boss&&g.sector>=3&&g.spawned%5===4,orbit:Math.random()<.5?-1:1,telegraph:0,lockTarget:null,variant:boss?((Math.floor(g.sector/5)-1)%bossNames.length):0,hp:prop.hp*scale,maxhp:prop.hp*scale,speed:prop.speed*(1+g.sector*.015),damage:prop.damage*scale,range:prop.range,color:boss?themes[sectorStyle%themes.length].accent:prop.color,radius:prop.radius,score:prop.score,attack:rand(.3,1.7),spawn:0,flash:0,bossPhase:0,trail:0,charge:0,stun:0,dead:false,robotYaw:Math.atan2(g.p.x-p.x,g.p.z-p.z),robotEyeYaw:Math.atan2(g.p.x-p.x,g.p.z-p.z),robotCycle:Math.random()*6.283,robotMotion:0,robotTurn:0,robotLean:0,robotStrafe:0,robotReverse:0,robotInertia:0,robotAttackState:0,robotDamageHeat:0};if(obj.airborne)obj.feetY=floorHeight(p.x,p.z)+.13;if(obj.elite){obj.hp*=2.1;obj.maxhp=obj.hp;obj.damage*=1.28;obj.speed*=1.12;obj.radius*=1.13;obj.score*=2.5;obj.color=[Math.min(1,prop.color[0]*.6+.42),Math.min(1,prop.color[1]*.58+.23),Math.min(1,prop.color[2]*.6+.48)];}const armorKind=boss?'boss':type;
 const armorClasses={boss:[Math.round(obj.maxhp*.80),.74],brute:[145,.56],warden:[200,.69],artillery:[110,.48],skyguard:[145,.56]};
 const armorSpec=armorClasses[armorKind]||(obj.elite?[Math.round(obj.maxhp*.43),.42]:null);
 if(armorSpec){obj.protection=Math.round(armorSpec[0]*(boss?1:scale));obj.maxProtection=obj.protection;obj.protectionRating=armorSpec[1];}
 else {obj.protection=0;obj.maxProtection=0;obj.protectionRating=0;}
 g.enemies.push(obj);if(boss){g.boss=obj;$('bossTitle').textContent=prop.name;$('bossWrap').style.display='block';toast('☠ БОСС: '+prop.name,2.6);sound(85,.28,'sawtooth',.22)}return obj}
function spawnWave(dt){const g=game;if(g.spawned>=g.target||g.portalReady)return;g.waveDelay-=dt;if(g.waveDelay>0)return;if(g.sector%5===0){if(!spawnEnemy('boss',true)){g.waveDelay=.75;return;}g.spawned=1;return}let active=g.enemies.filter(x=>!x.dead).length;if(active>=Math.min(6+g.sector*.4,14)){g.waveDelay=.6;return}let pool=['scout','scout','scout','shooter','charger'];if(g.sector>2)pool.push('brute');if(g.sector>3)pool.push('sniper','medic');if(g.sector>5)pool.push('warden');if(g.sector>8)pool.push('artillery');if(g.sector>11)pool.push('drone');if(g.sector>=14)pool.push('skyhunter');if(g.sector>=20)pool.push('skyguard');if(g.sector>=26)pool.push('stormray');if(sectorStyle>=14&&g.sector>=20)pool.push('skyhunter','stormray');if(g.sector>=8)pool.push('raider');let isHunt=g.mission?.type==='hunt'&&!g.mission.sentinelId&&g.spawned>=Math.floor(g.target*.48);let e=spawnEnemy(isHunt?(g.sector>8?'warden':'brute'):pick(pool));if(!e){g.waveDelay=.75;return;}if(isHunt){e.elite=true;e.maxhp*=2.45;e.hp=e.maxhp;e.damage*=1.35;e.score*=3;e.color=[1,.64,.22];e.maxProtection=Math.max(e.maxProtection||0,Math.round(e.maxhp*.45));e.protection=e.maxProtection;e.protectionRating=Math.max(e.protectionRating||0,.44);g.mission.sentinelId=e.id;toast('♜ КОМАНДИР ОБНАРУЖЕН · ПОВЫШЕННАЯ УГРОЗА',2.4)}g.spawned++;g.waveDelay=rand(.42,.95)*Math.pow(.98,g.sector);}
// A capped, short-lived debris system: no enduring robot shadow / corpse decals.
function spawnRobotArmorDebris(e,count=3,lethal=false){
 const g=game;if(!g)return;
 if(!Array.isArray(g.robotDebris))g.robotDebris=[];
 const cap=touchOnly?34:66;
 const palette=robotPalette(e.boss?'boss':e.type);
 const floor=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
 const level=lethal?1.10:1.36;
 const speed=lethal?3.7:2.1;
 const angle=Number.isFinite(e.robotYaw)?e.robotYaw:0;
 for(let i=0;i<count;i++){
   const a=Math.random()*TAU,side=(i%2?1:-1);
   const r=(lethal?.14:.11)+Math.random()*.16;
   g.robotDebris.push({x:e.x+Math.cos(a)*.15,z:e.z+Math.sin(a)*.15,
     y:floor+level+Math.random()*.38, vx:Math.cos(a)*(speed*.45+Math.random()*speed*.55),
     vy:1.05+Math.random()*(lethal?2.0:1.3),vz:Math.sin(a)*(speed*.45+Math.random()*speed*.55),
     rx:Math.random()*TAU,rz:Math.random()*TAU, spin:(Math.random()-.5)*12,
     size:r, life:lethal?3.4:2.1, ttl:lethal?3.4:2.1,
     color:((i%4)===0?palette.highlight:(i%3===0?RF.iron:palette.base)).slice(),
     glow:(i%7)===0, rested:false, bounces:0});
 }
 if(g.robotDebris.length>cap)g.robotDebris.splice(0,g.robotDebris.length-cap);
}
function updateRobotDebris(dt){
 const g=game;if(!g || !Array.isArray(g.robotDebris) || !g.robotDebris.length)return;
 const out=[];
 for(const sh of g.robotDebris){
   sh.life-=dt;
   if(sh.life<=0 || !Number.isFinite(sh.x)||!Number.isFinite(sh.y)||!Number.isFinite(sh.z))continue;
   if(!sh.rested){
     const oldX=sh.x,oldZ=sh.z;
     sh.vy-=9.5*dt;
     sh.x+=sh.vx*dt;sh.y+=sh.vy*dt;sh.z+=sh.vz*dt;
     if(isWall(sh.x,sh.z)){sh.x=oldX;sh.z=oldZ;sh.vx*=-.25;sh.vz*=-.25;}
     const ground=floorHeight(sh.x,sh.z);
     if(sh.y<ground+sh.size*.3){
       sh.y=ground+sh.size*.3;
       sh.bounces++;
       sh.vy=Math.abs(sh.vy)*.28;
       sh.vx*=.61;sh.vz*=.61;
       if(sh.bounces>=2||Math.abs(sh.vy)<.42){sh.rested=true;sh.vx=0;sh.vy=0;sh.vz=0;}
     }
     sh.rx+=sh.spin*dt;sh.rz-=sh.spin*.67*dt;
   }
   out.push(sh);
 }
 g.robotDebris=out;
}
function awardKill(e){const g=game;spawnRobotArmorDebris(e,e.boss?15:e.elite?9:6,true);g.kills++;g.combo++;g.comboAt=g.t;g.score+=e.score*(1+Math.min(g.combo,15)*.06)|0;g.p.hp=Math.min(g.p.maxhp,g.p.hp+g.p.vamp);save.kills++;if(e.elite){toast('★ ЭЛИТА УНИЧТОЖЕНА · БОНУС ОЧКОВ',1.2);}if(Math.random()<.34||e.boss||e.elite){let type=e.boss?'heal':Math.random()<.20?'heal':Math.random()<.65?'energy':'credits';g.loot.push({x:e.x,z:e.z,type,life:16})}
 if(e.elite||(!e.boss&&Math.random()<.10))g.loot.push({x:e.x+.18,z:e.z-.17,type:'plates',life:23});
 if(g.mission?.type==='hunt'&&e.id===g.mission.sentinelId){g.mission.done=1;g.score+=450;toast('♜ КОМАНДИР УСТРАНЁН',1.5);}burst(e.x,1.2+(e.feetY||0),e.z,e.color,e.boss?34:11);/* Robot deaths should not leave a permanent dark floor shadow.
   Keep kill feedback via particles and loot only; reserve scorch marks for
   weapon and environmental impacts rather than enemy disposal. */if(e.boss)for(let k=0;k<6;k++)g.loot.push({x:e.x+rand(-.8,.8),z:e.z+rand(-.8,.8),type:'credits',life:22});if(g.spawned>=g.target&&!g.enemies.some(x=>!x.dead))maybeFinishMission(g)}
function hurtEnemy(e,damage,options={}){
 if(e.dead||!game)return;
 const crit=Math.random()<game.p.crit;
 let dm=damage*game.p.damage*(crit?game.p.critDamage:1);
 if(e.type!=='warden'&&game.enemies.some(z=>!z.dead&&z.type==='warden'&&z.stun<=0&&distance(z,e)<4.2))dm*=.72;
 const prevHp=e.hp,prevProtection=Math.max(0,Number(e.protection)||0);
 const maxProtection=Math.max(0,Number(e.maxProtection)||0);
 const rating=clamp(Number(e.protectionRating)||0,0,.94);
 const penetration=clamp(Number(options.penetration)||0,0,1);
 let blocked=0;
 if(prevProtection>0&&rating>0){
  // Armor has REAL hit-point durability. Penetrating damage bypasses reduction.
  // If the final plate runs out mid-hit, the uncovered portion hits the chassis.
  const desiredBlock=dm*rating*(1-penetration);
  blocked=Math.min(desiredBlock,prevProtection/1.18);
  e.protection=Math.max(0,prevProtection-blocked*1.18);
 }
 const chassis=Math.max(0,dm-blocked);
 e.hp-=chassis;
 const before=maxProtection>0?prevProtection/maxProtection:prevHp/e.maxhp;
 const after=maxProtection>0?Math.max(0,e.protection)/maxProtection:e.hp/e.maxhp;
 const armorStage=v=>v>.71?0:v>.46?1:v>.29?2:3;
 if(armorStage(after)>armorStage(before)&&e.hp>0)
  spawnRobotArmorDebris(e,(e.boss?6:3)*(armorStage(after)-armorStage(before)));
 e.flash=.13;e.hitReact=.24;
 e.robotDamageHeat=Math.min(1,(Number(e.robotDamageHeat)||0)+Math.min(.6,chassis/Math.max(1,e.maxhp)*3));
 game.score+=Math.ceil(chassis*.4);showDamage(e,Math.round(chassis),crit);
 if(e.hp<=0){e.dead=true;awardKill(e)}else sound(blocked>0?108:170,.055,'triangle',.035);
}
function damagePlayer(d){const p=game.p;if(p.iframes>0||p.shield>0||game.state!=='playing')return;p.armorDelay=0;let amount=d;if(p.armor>0){const fraction=clamp(.72+(p.armorTier||0)*.035,.72,.86),a=Math.min(amount*fraction,p.armor);p.armor-=a;amount-=a;
 const bar=$('bars');bar.classList.add('armorHit');setTimeout(()=>bar.classList.remove('armorHit'),180);
 }
 if((p.bodyArmor||0)>0&&(p.bodyArmorReduction||0)>0){
  const reduced=amount*p.bodyArmorReduction;
  const wear=Number.isFinite(p.bodyArmorWear)&&p.bodyArmorWear>0?p.bodyArmorWear:1.12;
  const absorbed=Math.min(reduced,p.bodyArmor/wear);
  p.bodyArmor=Math.max(0,p.bodyArmor-absorbed*wear);
  amount=Math.max(0,amount-absorbed);
  if(absorbed>0){
   const bar=$('bars');
   bar.classList.add('suitHit');
   setTimeout(()=>bar.classList.remove('suitHit'),240);
  }
 }
 // A fully operational pilot has a one-hit shock limiter. Even a late-boss
 // bomb cannot erase an otherwise healthy character outright when the suit
 // wears out; a *second* mistake is still deadly, so dodging remains vital.
 if(p.hp>=p.maxhp*.80)amount=Math.min(amount,p.maxhp*.72);
 p.hp=Math.max(0,p.hp-amount);p.iframes=.35;$('damageFlash').style.opacity=String(clamp(amount/75,.08,.29));setTimeout(()=>$('damageFlash').style.opacity='0',95);sound(115,.14,'sawtooth',.1);if(p.hp<=0)gameOver()}
function burst(x,y,z,col,count=9){const g=game;for(let i=0;i<count;i++){let a=rand(0,TAU),v=rand(.4,3.5),vy=rand(-.4,2.8),life=rand(.25,.85);g.particles.push({x,y,z,vx:Math.cos(a)*v,vz:Math.sin(a)*v,vy,life,maxLife:life,a:rand(0,TAU),col})}}
// STAGE 9 — Navigation uses the same rendered 3D solids as the projectile engine.
// The flow-field remains inexpensive and shared; an enemy-specific local sensor
// avoids rails, posts and thin separators without a per-robot A* each frame.
// Overpasses retain the established ramp-target logic of enemyHeading().
let enemyNavMask=null,enemyNavEdges=null,enemyNavMaskWorld=null,enemyNavMaskMap=null;
function enemyBodyHeight(e){
 // Includes the actual optic dome and hovering lift, not just the chassis.
 // Heavier flying frames are physically taller and need clear vertical space.
 const scale=Math.max(.76,Math.min(1.31,(Number(e.radius)||.48)/.51));
 return e.boss?2.85:e.airborne?Math.max(2.05,2.12*scale):
   e.type==='brute'||e.type==='warden'||e.type==='artillery'?2.13:1.68;
}
function enemyBodyRadius(e){return Math.max(.22,Math.min(e.airborne ? .67 : .58,(Number(e.radius)||.48)*(e.airborne ? .78 : .45)));}
// STAGE 10 — dynamic actors are not world-mesh boxes. Give each living robot
// a modest physical footprint, and separate crowds only when their vertical
// body intervals overlap. This is deliberately local (maximum 14 regular
// enemies) and does not dirty the static flow-field on every moving frame.
function enemyCrowdRadius(e,r=0){
 const nominal=Math.max(.24,Number(e?.radius)||.48);
 return Math.max(r,Math.min(e?.boss?.90:.69,nominal*(e?.boss?.77:.69)));
}
function enemyCrowdAllows(e,x,z,r=0){
 const others=game?.enemies;
 if(!Array.isArray(others)||others.length<2)return true;
 const baseFeet=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
 const feet=e.airborne?baseFeet:Math.max(baseFeet,supportHeight(e,x,z)),top=feet+enemyBodyHeight(e);
 const mine=enemyCrowdRadius(e,r);
 for(const other of others){
  if(other===e||other.dead||!Number.isFinite(other.x)||!Number.isFinite(other.z))continue;
  const otherFeet=Number.isFinite(other.feetY)?other.feetY:floorHeight(other.x,other.z);
  // NPCs on different floors never interfere through a bridge or ceiling.
  if(top<=otherFeet+.03||feet>=otherFeet+enemyBodyHeight(other)-.03)continue;
  const combined=mine+enemyCrowdRadius(other),vx=x-other.x,vz=z-other.z;
  if(Math.abs(vx)>=combined||Math.abs(vz)>=combined)continue;
  const next=Math.hypot(vx,vz),before=Math.hypot(e.x-other.x,e.z-other.z);
  // If they spawned in overlap, allow retreat and tangential escape; otherwise
  // never step *into* a neighbour's collision radius. No teleport/shoving.
  if(next<combined-.006&&(before>=combined-.006||next<before-.00015))return false;
 }
 return true;
}
function enemyCanOccupy(e,x,z,r=enemyBodyRadius(e)){
 if(!Number.isFinite(x)||!Number.isFinite(z)||collide(x,z,r))return false;
 const feet=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
 const candidate=e.airborne?feet:supportHeight(e,x,z);
 if((!e.airborne&&candidate>feet+.245)||(e.airborne&&feet<floorHeight(x,z)+.12))return false;
 return !worldSolidBodyCollision(x,z,r,Math.max(feet,candidate),enemyBodyHeight(e))&&
   enemyCrowdAllows(e,x,z,r);
}
// Cached *ground-level standard-robot* cell mask, invalidated by actual mesh
// identity, not by number of polygons (two quality settings may use same count).
// Larger enemies still check their own radius and height when they move.
function enemyNavTile(x,z){
 if(x<1||z<1||x>=mapSize-1||z>=mapSize-1||mapCells[z]?.[x]!==0)return false;
 if(!glReady||!worldSolidCount)return true;
 if(!enemyNavMask||enemyNavMask.length!==mapSize*mapSize||
     enemyNavMaskWorld!==worldSolidGrid||enemyNavMaskMap!==mapCells){
  enemyNavMask=new Int8Array(mapSize*mapSize);
  enemyNavEdges=new Int8Array(mapSize*mapSize*4);
  enemyNavMaskWorld=worldSolidGrid;enemyNavMaskMap=mapCells;
 }
 const index=z*mapSize+x;
 if(enemyNavMask[index]===0){
  // A standard 1.68m bot can pass under a 2.03m-high bridge plate.
  const feet=floorHeight(x+.5,z+.5);
  enemyNavMask[index]=worldSolidBodyCollision(x+.5,z+.5,.26,feet,1.68)?-1:1;
 }
 return enemyNavMask[index]>0;
}
function enemyNavEdge(x,z,X,Z){
 // Grid centres can be free while a thin structural bar separates them.
 // Cache the four *edges* per tile; three swept samples catch metal lying
 // at a quarter-cell, not only at the exact tile boundary.
 if(!enemyNavTile(X,Z))return false;
 if(!glReady||!worldSolidCount)return true;
 const dir=X>x?0:X<x?1:Z>z?2:3,opposite=dir^1;
 const key=(z*mapSize+x)*4+dir;
 if(enemyNavEdges[key]!==0)return enemyNavEdges[key]===1;
 const feet=Math.max(floorHeight(x+.5,z+.5),floorHeight(X+.5,Z+.5));
 let clear=true;
 for(const t of [.25,.50,.75]){
  const mx=x+.5+(X-x)*t,mz=z+.5+(Z-z)*t;
  if(worldSolidBodyCollision(mx,mz,.24,feet,1.68)){clear=false;break;}
 }
 enemyNavEdges[key]=clear?1:-1;
 enemyNavEdges[(Z*mapSize+X)*4+opposite]=enemyNavEdges[key];
 return clear;
}
function enemyPathClear(e,tx,tz){
 if(!lineClear(e.x,e.z,tx,tz))return false;
 if(!glReady||!worldSolidCount)return true;
 const span=Math.hypot(tx-e.x,tz-e.z),r=enemyBodyRadius(e);
 if(!(span>.0001))return true;
 const n=Math.max(1,Math.ceil(span/.24));
 // Don't demand the opponent's last few centimetres be robot-passable.
 for(let i=1;i<n;i++){
  const x=e.x+(tx-e.x)*i/n,z=e.z+(tz-e.z)*i/n;
  const feet=e.airborne?(Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z)):supportHeight(e,x,z);
  if(e.airborne&&feet<floorHeight(x,z)+.12)return false;
  if(worldSolidBodyCollision(x,z,r,feet,enemyBodyHeight(e)))return false;
 }
 return true;
}
// Cached direct-route probe; near the target it is sampled frequently enough
// to react to movement, without testing dozens of boxes for every bot each tick.
function enemyDirectRoute(e,p){
 if(!lineClear(e.x,e.z,p.x,p.z))return false;
 if(!glReady||!worldSolidCount)return true;
 const now=Number(game?.t)||0;
 if(e.navSeenUntil>now&&e.navSeenX!==undefined&&
    Math.hypot(e.x-e.navSeenX,e.z-e.navSeenZ)<.42&&
    Math.hypot(p.x-e.navGoalX,p.z-e.navGoalZ)<.42)return !!e.navSeenClear;
 const clear=enemyPathClear(e,p.x,p.z);
 e.navSeenX=e.x;e.navSeenZ=e.z;e.navGoalX=p.x;e.navGoalZ=p.z;
 e.navSeenClear=clear;e.navSeenUntil=now+.22+(e.id%5)*.017;
 return clear;
}
function enemyMove(e,dx,dz,r=enemyBodyRadius(e)){
 const amount=Math.hypot(dx,dz);
 if(!(amount>1e-8))return;
 // Crowd avoidance must run in Canvas fallback as well as WebGL.
 // The shared mover performs continuous actor/body collision per microstep.
 const ux=dx/amount,uz=dz/amount;
 const beforeX=e.x,beforeZ=e.z;
 moveEntity(e,dx,dz,r);
 const advanced=Math.hypot(e.x-beforeX,e.z-beforeZ);
 if(advanced>=amount*.67){
  e.navBlockedTime=Math.max(0,(e.navBlockedTime||0)-amount*.13);
  return;
 }
 // A thin static barrier or a living neighbour blocks our advance. Keep a
 // side for a short interval so a bot
 // doesn't alternate left/right every frame while walking alongside a rail.
 if(!(e.navBlockedTime>0))e.navAvoidSide=e.orbit===-1?-1:1;
 e.navBlockedTime=Math.min(1.4,(e.navBlockedTime||0)+.14);
 const side=e.navAvoidSide||1;
 // If the sought direction is blocked, try tangent/slanted detours. Test
 // farther than a single simulation step to avoid repeatedly hitting a post.
 let best=null;
 for(const a of [side*Math.PI/2,side*Math.PI/3,-side*Math.PI/2,
                  -side*Math.PI/3,side*Math.PI*.8,-side*Math.PI*.8,Math.PI]){
  const vx=ux*Math.cos(a)-uz*Math.sin(a),vz=ux*Math.sin(a)+uz*Math.cos(a);
  const look=Math.min(.58,Math.max(.29,r*.9));
  const can=enemyCanOccupy(e,e.x+vx*look,e.z+vz*look,r);
  if(!can)continue;
  // Prefer progress towards goal, but with a stable side to clear corners.
  const score=Math.cos(a)*.46+((a>0?1:-1)===side?.23:0);
  if(!best||score>best.score)best={vx,vz,score,a};
 }
 if(best){
  const x=e.x,z=e.z;
  moveEntity(e,best.vx*amount,best.vz*amount,r);
  if(Math.hypot(e.x-x,e.z-z)>amount*.28){
   e.navAvoidSide=best.a>=0?1:-1;
   return;
  }
 }
 // If this direction leads into a dead end, flip only occasionally, not
 // every frame. The shared flow-field will do the global detour.
 if(e.navBlockedTime>=1.3){e.navAvoidSide=-side;e.navBlockedTime=.35;}
}

// --- Ballistics and impact effects. All calculations are in the level's world space. ---
const MAX_WALL_MARKS=touchOnly?115:230;

let decalMesh=null,decalDirty=true;
function clipDecalPoly(poly,coord,min,max){
 const inside=(p,b,isMin)=>isMin?p[coord]>=b-1e-7:p[coord]<=b+1e-7;
 for(const [bound,isMin] of [[min,true],[max,false]]){
  const out=[];
  for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length],ain=inside(a,bound,isMin),bin=inside(b,bound,isMin);
   if(ain)out.push(a);
   if(ain!==bin){const den=b[coord]-a[coord],t=Math.abs(den)>1e-12?(bound-a[coord])/den:0;
    out.push({u:a.u+(b.u-a.u)*t,v:a.v+(b.v-a.v)*t});}
  }
  poly=out;if(poly.length<3)return [];
 }
 return poly;
}
function rebuildDecalMesh(){
 decalDirty=false;
 if(!glReady||!game)return;
 if(decalMesh){gl.deleteBuffer(decalMesh.b);decalMesh=null;}
 const vertices=[];
 for(const mark of game.decals){
  const n=[mark.nx,mark.ny,mark.nz],c=[mark.x,mark.y,mark.z],r=mark.r;
  const axis= Math.abs(mark.nx)>.5?'x':Math.abs(mark.ny)>.5?'y':'z';
  const U=axis==='x'?[0,0,1]:[1,0,0];
  const V=axis==='y'?[0,0,1]:[0,1,0];
  const x=Number.isInteger(mark.cellX)?mark.cellX:Math.floor(mark.x-.001*mark.nx);
  const z=Number.isInteger(mark.cellZ)?mark.cellZ:Math.floor(mark.z-.001*mark.nz);
  // Rectangular face bounds in the decal's local (u,v) plane.
  const cu=c[0]*U[0]+c[1]*U[1]+c[2]*U[2];
  const cv=c[0]*V[0]+c[1]*V[1]+c[2]*V[2];
  const umin=(axis==='x'?z:x)-cu,umax=umin+1;
  const vmin=(axis==='y'?z:0)-cv;
  const vmax=(axis==='y'?z+1:mark.kind==='stairs'?floorHeightAtCell(x,z):ceilingHeight())-cv;
  let bounds=[umin,umax,vmin,vmax];
  if(mark.bounds){
   // Thin rails, pillars and boxes clip impact marks to their true face.
   const b=mark.bounds;
   const uAxis=axis==='x'?2:0,vAxis=axis==='y'?2:1;
   bounds=[b[uAxis]-cu,b[uAxis+3]-cu,b[vAxis]-cv,b[vAxis+3]-cv];
  }
  if(bounds[3]<=bounds[2]+1e-5)continue;
  const outline=mark.energy?[.16,.065,.035]:[.065,.061,.058],dark=[.008,.009,.012];
  const point=(a,size)=>({u:Math.cos(a)*size,v:Math.sin(a)*size});
  const emit=(poly,color,glow)=>{
   poly=clipDecalPoly(poly,'u',bounds[0],bounds[1]);
   if(poly.length<3)return;
   poly=clipDecalPoly(poly,'v',bounds[2],bounds[3]);
   if(poly.length<3)return;
   const world=q=>[c[0]+U[0]*q.u+V[0]*q.v,c[1]+U[1]*q.u+V[1]*q.v,c[2]+U[2]*q.u+V[2]*q.v];
   for(let i=1;i<poly.length-1;i++)addTri(vertices,world(poly[0]),world(poly[i]),world(poly[i+1]),n,color,glow);
  };
  for(let i=0;i<12;i++){
   const a=TAU*i/12+mark.rot,b=TAU*(i+1)/12+mark.rot;
   const A=r*(.94+.12*Math.sin(i*7.23+mark.rot)),B=r*(.94+.12*Math.sin((i+1)*7.23+mark.rot));
   const p1=point(a,A),p2=point(b,B),q1=point(a,A*.65),q2=point(b,B*.65);
   emit([p1,p2,q1],outline,mark.energy?.035:0);
   emit([p2,q2,q1],outline,mark.energy?.035:0);
   emit([{u:0,v:0},q1,q2],dark,0);
  }
 }
 if(vertices.length)decalMesh=toMesh(vertices);
}
function v3(x,y,z){return{x,y,z}}
// Exact swept collision against the visible stair/ground tiles, walls and bridge plates.
// A wall, riser, stair top and bridge underside are all finite solid volumes.
function rayAABB(o,d,maxDist,x0,y0,z0,x1,y1,z1){
 let enter=-Infinity,exit=Infinity,nx=0,ny=0,nz=0;
 for(const [axis,lo,hi] of [['x',x0,x1],['y',y0,y1],['z',z0,z1]]){
  const v=d[axis],s=o[axis];
  if(Math.abs(v)<1e-10){if(s<lo-1e-8||s>hi+1e-8)return null;continue;}
  let a=(lo-s)/v,b=(hi-s)/v,sign=v>0?-1:1;
  if(a>b){const tmp=a;a=b;b=tmp;}
  if(a>enter){enter=a;nx=axis==='x'?sign:0;ny=axis==='y'?sign:0;nz=axis==='z'?sign:0;}
  exit=Math.min(exit,b);if(exit+1e-9<enter)return null;
 }
 if(exit<0||enter>maxDist)return null;
 if(enter<=0){
  // Firing from inside a collider must not let shots escape before hitting it.
  const k=Math.max(Math.abs(d.x),Math.abs(d.y),Math.abs(d.z));
  nx=Math.abs(d.x)===k?-Math.sign(d.x):0;ny=Math.abs(d.y)===k?-Math.sign(d.y):0;nz=Math.abs(d.z)===k?-Math.sign(d.z):0;
 }
 return {t:Math.max(0,enter),nx,ny,nz};
}
// When a projectile is born *inside* a solid (e.g. at the lip of a stair),
// attach its impact to the nearest actual outward face. Using the shot's
// direction chooses distant side faces on long, thin floor/stair volumes.
function embeddedSolidSurface(o,b){
 const epsilon=1e-8;
 if(o.x<b[0]-epsilon||o.x>b[3]+epsilon||o.y<b[1]-epsilon||
    o.y>b[4]+epsilon||o.z<b[2]-epsilon||o.z>b[5]+epsilon)return null;
 const faces=[
  {distance:o.x-b[0],axis:'x',value:b[0],nx:-1,ny:0,nz:0},
  {distance:b[3]-o.x,axis:'x',value:b[3],nx:1,ny:0,nz:0},
  {distance:o.y-b[1],axis:'y',value:b[1],nx:0,ny:-1,nz:0},
  {distance:b[4]-o.y,axis:'y',value:b[4],nx:0,ny:1,nz:0},
  {distance:o.z-b[2],axis:'z',value:b[2],nx:0,ny:0,nz:-1},
  {distance:b[5]-o.z,axis:'z',value:b[5],nx:0,ny:0,nz:1}
 ];
 faces.sort((a,b)=>a.distance-b.distance);
 const face=faces[0];
 return {...o,[face.axis]:face.value,nx:face.nx,ny:face.ny,nz:face.nz};
}
// Precise continuous collision of a finite-radius sphere with a box.
// Expanding the box and tracing a point (the usual broadphase) is NOT exact:
// it treats the square space around its edges/corners as solid and can make
// plasma balls explode while visibly missing a handrail. The distance to a
// box is piecewise quadratic as the center crosses each of its six planes.
// Solve those short intervals exactly; the fast face path costs one AABB test.
function sweptSphereAABB(o,d,maxDist,b,radius){
 const r=Math.max(0,Number(radius)||0);
 if(r<1e-8)return rayAABB(o,d,maxDist,...b);
 const expanded=rayAABB(o,d,maxDist,b[0]-r,b[1]-r,b[2]-r,b[3]+r,b[4]+r,b[5]+r);
 if(!expanded)return null;
 const axes=[['x',0,3],['y',1,4],['z',2,5]];
 const nearest=(t)=>{
  const c={x:o.x+d.x*t,y:o.y+d.y*t,z:o.z+d.z*t};
  const p={x:clampNumber(c.x,b[0],b[3]),y:clampNumber(c.y,b[1],b[4]),z:clampNumber(c.z,b[2],b[5])};
  const n={x:c.x-p.x,y:c.y-p.y,z:c.z-p.z};
  return {p,n,dist2:n.x*n.x+n.y*n.y+n.z*n.z};
 };
 function clampNumber(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
 const EPS=1e-9,rr=r*r;
 let t=expanded.t,contact=nearest(t);
 if(contact.dist2>rr+EPS){
  const cuts=[t,maxDist];
  for(const [axis,lo,hi] of axes){
   const speed=d[axis];if(Math.abs(speed)<1e-12)continue;
   for(const edge of [b[lo],b[hi]]){
    const q=(edge-o[axis])/speed;
    if(q>t+1e-10&&q<maxDist-1e-10)cuts.push(q);
   }
  }
  cuts.sort((a,b)=>a-b);
  let entry=null;
  for(let k=0;k<cuts.length-1;k++){
   const a=cuts[k],end=cuts[k+1];if(end-a<1e-11)continue;
   const mid=(a+end)*.5;
   let A=0,B=0,C=-rr;
   for(const [axis,lo,hi] of axes){
    const v=o[axis]+d[axis]*mid;
    const edge=v<b[lo]?b[lo]:v>b[hi]?b[hi]:null;
    if(edge===null)continue;
    const u=o[axis]-edge,w=d[axis];
    A+=w*w;B+=u*w;C+=u*u;
   }
   const f=a=>A*a*a+2*B*a+C;
   if(f(a)<=EPS){entry=a;break;}
   if(A<1e-12)continue;
   const discriminant=B*B-A*C;
   if(discriminant<0)continue;
   const q=(-B-Math.sqrt(Math.max(0,discriminant)))/A;
   if(q>=a-1e-8&&q<=end+1e-8){entry=Math.max(a,q);break;}
  }
  if(entry===null)return null; // a path through a corner of the inflated box only
  t=entry;contact=nearest(t);
  if(contact.dist2>rr+1e-6)return null;
 }
 const mag=Math.sqrt(contact.dist2);
 if(t<=1e-8){
  const surface=embeddedSolidSurface(o,b);
  if(surface)return {t:0,...surface};
 }
 return {t,
  nx:mag>1e-7?contact.n.x/mag:expanded.nx,
  ny:mag>1e-7?contact.n.y/mag:expanded.ny,
  nz:mag>1e-7?contact.n.z/mag:expanded.nz,
  x:contact.p.x,y:contact.p.y,z:contact.p.z};
}
function rayWall(o,d,maxDist){
 if(!(maxDist>0))return null;
 let cx=Math.floor(o.x),cz=Math.floor(o.z);
 const sx=d.x>0?1:-1,sz=d.z>0?1:-1;
 const deltaX=Math.abs(d.x)>1e-10?1/Math.abs(d.x):Infinity;
 const deltaZ=Math.abs(d.z)>1e-10?1/Math.abs(d.z):Infinity;
 let tx=Number.isFinite(deltaX)?(d.x>0?cx+1-o.x:o.x-cx)*deltaX:Infinity;
 let tz=Number.isFinite(deltaZ)?(d.z>0?cz+1-o.z:o.z-cz)*deltaZ:Infinity;
 let travelled=0;
 for(let i=0;i<Math.min(250,Math.ceil(maxDist*3)+4);i++){
  const segmentEnd=Math.min(maxDist,tx,tz),inside=cx>=0&&cz>=0&&cx<mapSize&&cz<mapSize;
  const wall=!inside||mapCells[cz]?.[cx]===1;
  const candidates=[];
  if(wall)candidates.push({box:[cx,0,cz,cx+1,ceilingHeight(),cz+1],kind:'wall'});
  else{
   const h=floorHeightAtCell(cx,cz);
   candidates.push({box:[cx,-100,cz,cx+1,h,cz+1],kind:h>.001?'stairs':'floor'});
   const deck=deckAtCell(cx,cz);
   if(deck>0)candidates.push({box:[cx,deck-.17,cz,cx+1,deck,cz+1],kind:'bridge'});
   // Canvas fallback uses a simple enclosed roof. In WebGL, roof tiles
   // and other solid details are captured from the actual drawn geometry.
   if(!glReady)candidates.push({box:[cx,ceilingHeight()+.10,cz,cx+1,ceilingHeight()+2,cz+1],kind:'ceiling'});
  }
  let best=null;
  for(const ob of candidates){
   const h=rayAABB(o,d,maxDist,...ob.box);
   if(!h||h.t>segmentEnd+1e-7||h.t+1e-7<travelled)continue;
   if(!best||h.t<best.t)best={...h,kind:ob.kind,cellX:cx,cellZ:cz,box:ob.box};
  }
  // The same broadphase grid is shared with the rendered box geometry.
  if(inside&&glReady)best=worldSolidRayCell(o,d,segmentEnd,travelled,cx,cz,best);
  if(best){
   const impact={...best,x:o.x+d.x*best.t,y:o.y+d.y*best.t,z:o.z+d.z*best.t};
   if(impact.t<=1e-8){
    const surface=embeddedSolidSurface(o,impact.solid?.box||impact.box);
    if(surface)Object.assign(impact,surface);
   }
   return impact;
  }
  if(segmentEnd>=maxDist||!Number.isFinite(segmentEnd))break;
  travelled=segmentEnd;
  if(tx<=tz){cx+=sx;tx+=deltaX;}else{cz+=sz;tz+=deltaZ;}
 }
 return null;
}
// Continuous collision for finite-radius enemy plasma bolts and rockets.
// Sweeps the projectile center against each candidate solid expanded by its
// radius (Minkowski AABB). Spatial broadphase is the short segment's swept
// 2D bounds, including neighboring cells so railings and corners cannot tunnel.
function sweepWorldSphere(o,d,maxDist,radius){
 if(!(maxDist>0))return null;
 const r=Math.max(0,Math.min(.48,Number(radius)||0));
 if(r<.001)return rayWall(o,d,maxDist);
 const end={x:o.x+d.x*maxDist,y:o.y+d.y*maxDist,z:o.z+d.z*maxDist};
 const x0=Math.max(-1,Math.floor(Math.min(o.x,end.x)-r));
 const x1=Math.min(mapSize,Math.floor(Math.max(o.x,end.x)+r));
 const z0=Math.max(-1,Math.floor(Math.min(o.z,end.z)-r));
 const z1=Math.min(mapSize,Math.floor(Math.max(o.z,end.z)+r));
 let best=null;
 const seen=new Set();
 const test=(b,kind,cx,cz,solid=null)=>{
  const hit=sweptSphereAABB(o,d,maxDist,b,r);
  if(!hit||(best&&hit.t>=best.t-1e-8))return;
  // Starting embedded in a solid: use the closest *real* face, never
  // the shot-axis face far away inside a long floor slab.
  if(hit.t<=1e-8){
   const surface=embeddedSolidSurface(o,b);
   if(surface)Object.assign(hit,surface);
  }
  best={...hit,kind,cellX:cx,cellZ:cz,solid};
 };
 for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
  const inside=x>=0&&z>=0&&x<mapSize&&z<mapSize;
  if(!inside||mapCells[z]?.[x]===1){
   test([x,0,z,x+1,ceilingHeight(),z+1],'wall',x,z);
  }else{
   const h=floorHeightAtCell(x,z);
   test([x,-100,z,x+1,h,z+1],h>.001?'stairs':'floor',x,z);
   const deck=deckAtCell(x,z);
   if(deck>0)test([x,deck-.17,z,x+1,deck,z+1],'bridge',x,z);
   if(!glReady)test([x,ceilingHeight()+.10,z,x+1,ceilingHeight()+2,z+1],'ceiling',x,z);
   else{
    for(const solid of worldSolidGrid[z*mapSize+x]||[]){
     if(seen.has(solid))continue;
     seen.add(solid);test(solid.box,solid.kind,x,z,solid);
    }
   }
  }
 }
 return best;
}
// Hit the visible robot silhouette: a wide chest/arms ellipse and head ellipse,
// based on the SAME model scaling used by drawEnemyModel(), not a tiny sphere.
function rayEllipsoid(o,d,center,rx,ry,rz,maxDist){
 const ox=(o.x-center.x)/rx,oy=(o.y-center.y)/ry,oz=(o.z-center.z)/rz;
 const vx=d.x/rx,vy=d.y/ry,vz=d.z/rz;
 const a=vx*vx+vy*vy+vz*vz,b=ox*vx+oy*vy+oz*vz,c=ox*ox+oy*oy+oz*oz-1;
 if(a<1e-12)return null;
 const disc=b*b-a*c;if(disc<0)return null;
 // Origin inside robot = immediate hit, not the exit surface behind it.
 const t=c<=0?.001:(-b-Math.sqrt(disc))/a;
 if(t<0||t>maxDist)return null;
 return t;
}
// Robot Foundry renders appendages as additional moving meshes around the
// chassis. The old chassis/head-only ellipsoids failed to register hits to
// visible drone wings, feet, insect legs and certain weapons. Keep their
// existing, generous central volumes for aim compatibility and ADD local-space
// accessory volumes at the same rig-relative coordinates as drawEnemyModel().
// All accessories rotate with the chassis. They are deliberately conservative
// filled volumes; no GPU triangle readback is needed for shots or explosions.
function robotAccessoryVolumes(e){
 const kind=e.boss?'boss':e.airborne?'drone':e.type;
 const r=e.boss?1.75:Math.max(.76,Math.min(1.31,e.radius/.51));
 const out=[],put=(part,x,y,z,rx,ry,rz)=>out.push({part,x:x*r,y:y*r,z:z*r,rx:rx*r,ry:ry*r,rz:rz*r});
 if(kind==='drone'){
  // Drawn swept wings reach +/-1.31r, whereas the central ellipsoid only
  // covered about +/-1.12r. The thrusters share the wing's rear edge.
  for(const side of [-1,1]){
   put('wing',side*.94,1.02,-.14,.43,.23,.51);
   put('thruster',side*1.04,1.06,-.34,.24,.28,.28);
  }
 }else if(kind==='scout'||kind==='charger'){
  // Locomoting insect legs are independently drawn at +/-0.39r, +/-0.36r;
  // these slender proxies reach below the shell but do not fill empty sky.
  for(const side of [-1,1])for(const fore of [-1,1])
   put('leg',side*.65,.57,fore*.51,.30,.41,.32);
  if(kind==='charger')for(const side of [-1,1])
   put('horn',side*.31,1.20,.89,.12,.17,.31);
 }else if(kind==='medic'){
  for(const side of [-1,1])put('manipulator',side*.69,.83,.26,.22,.24,.34);
 }else{
  // Leg meshes descend almost to floor level; the torso ellipsoid ended at
  // roughly 0.15r above it and shots at the boots could pass through.
  const motion=Math.max(0,Math.min(1,Number(e.robotMotion)||0));
  const phase=Number(e.robotCycle)||0;
  for(const side of [-1,1]){
   const step=Math.sin(phase+(side>0?Math.PI:0));
   const lift=Math.pow(Math.max(0,step),1.4)*.14*motion;
   put('leg',side*.25,.46+lift,-step*.025*motion,.27,.49,.37);
  }
  if(kind==='sniper')put('railgun',.42,1.54,.73,.15,.16,.47);
  if(kind==='artillery'||kind==='boss')for(const side of [-1,1])
   put('launcher',side*.77,1.48,-.21,.31,.32,.52);
 }
 return out;
}
function robotAccessoryRay(o,d,e,maxDist,assist=0){
 const base=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
 const kind=e.boss?'boss':e.airborne?'drone':e.type,hover=kind==='drone'||kind==='medic';
 const gTime=Number(game?.t)||0,id=Number(e.id)||0;
 const bob=hover?Math.sin(gTime*3.2+id)*.048:
  (Math.sin((Number(e.robotCycle)||0)*2)*.030*(Number(e.robotMotion)||0)+Math.sin(gTime*.8+id)*.006);
 const foot=base+bob+(hover?.13:0);
 const yaw=Number.isFinite(e.robotYaw)?e.robotYaw:0,cc=Math.cos(yaw),ss=Math.sin(yaw);
 // Inverse of the exact local -> world conversion in drawEnemyModel().
 const ox=o.x-e.x,oz=o.z-e.z;
 const localOrigin=v3(ox*cc-oz*ss,o.y-foot,ox*ss+oz*cc);
 const localDir=v3(d.x*cc-d.z*ss,d.y,d.x*ss+d.z*cc);
 let closest=null;
 for(const v of robotAccessoryVolumes(e)){
  const t=rayEllipsoid(localOrigin,localDir,v3(v.x,v.y,v.z),
    v.rx+assist,v.ry+assist,v.rz+assist,maxDist);
  if(t!==null&&(closest===null||t<closest.t))closest={t,part:v.part};
 }
 return closest;
}
// Conservative robot broadphase. It only rejects robots whose entire
// visible proxy envelope is too far from the shot segment. Important for
// shotguns and high-rate guns on mobile: no per-limb calculations for robots
// on the far side of the arena. The margin is deliberately larger than all
// arm, leg, wing, weapon, head and boss geometry in robotAccessoryVolumes().
function robotNearRay(o,d,maxDist,e,assist=0){
 const r=e.boss?1.75:Math.max(.76,Math.min(1.31,e.radius/.51));
 const base=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
 const dx=e.x-o.x,dy=base+1.25*r-o.y,dz=e.z-o.z;
 const t=Math.max(0,Math.min(maxDist,dx*d.x+dy*d.y+dz*d.z));
 const xx=dx-d.x*t,yy=dy-d.y*t,zz=dz-d.z*t;
 const reach=2.8*r+Math.max(0,assist);
 return xx*xx+yy*yy+zz*zz<=reach*reach;
}
// Early blast rejection uses the same deliberately generous physical envelope.
// In particular, a distant robot center cannot reject an actually exposed wing.
function robotNearArea(e,origin,radius){
 const r=e.boss?1.75:Math.max(.76,Math.min(1.31,e.radius/.51));
 const base=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
 return Math.hypot(e.x-origin.x,base+1.25*r-origin.y,e.z-origin.z)<=radius+2.8*r;
}
function rayEnemy(o,d,maxDist,ignored=null,assist=0){
 let closest=null,bt=maxDist;if(!game)return null;
 for(const e of game.enemies){
  if(e.dead||(ignored&&ignored.has(e.id)))continue;
  if(!robotNearRay(o,d,bt,e,assist))continue;
  const scale=e.boss?1.75:Math.max(.76,Math.min(1.31,e.radius/.51));
  const base=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
  const squat=e.type==='scout'||e.type==='charger'||e.airborne||e.type==='drone';
  const cy=base+(squat?1.02:1.28)*scale;
  let t=rayEllipsoid(o,d,v3(e.x,cy,e.z),scale*(squat?1.12:1.42)+assist,scale*(squat?.87:1.13)+assist,scale*1.03+assist,bt);
  let part='torso';
  const headY=base+(squat?1.52:2.07)*scale;
  const head=rayEllipsoid(o,d,v3(e.x,headY,e.z),scale*.48+assist,scale*.45+assist,scale*.53+assist,bt);
  if(head!==null&&(t===null||head<t)){t=head;part='head';}
  const accessory=robotAccessoryRay(o,d,e,bt,assist);
  if(accessory&&(t===null||accessory.t<t)){t=accessory.t;part=accessory.part;}
  if(t===null||t>=bt)continue;
  bt=t;closest={t,x:o.x+d.x*t,y:o.y+d.y*t,z:o.z+d.z*t,enemy:e,kind:'enemy',part};
 }
 return closest;
}

// Reactive arena devices: a small, capped collection; never blocks navigation.
const NODE_TYPES=[
 {name:'ТЕРМОРЕАКТОР',color:[1,.43,.18],radius:4.4},
 {name:'ЭМИ-ЯДРО',color:[.31,.8,1],radius:5.5},
 {name:'КОНТЕЙНЕР СНАБЖЕНИЯ',color:[.36,1,.57],radius:3.4}
];
// Mission engine: objectives are part of the level state, including autosaves.
const MISSION_TYPES={
 purge:{name:'ЗАЧИСТКА',icon:'⚔',hint:'Уничтожь всех роботов и доберись до портала'},
 sabotage:{name:'САБОТАЖ',icon:'ϟ',hint:'Выведи из строя энергоузлы и уничтожь охрану'},
 recovery:{name:'РАЗВЕДКА',icon:'◈',hint:'Собери три архивных ядра и отбейся от роботов'},
 hunt:{name:'ОХОТА',icon:'♜',hint:'Устрани командира и уничтожь охрану'},
 boss:{name:'ВЛАДЫКА РАЗЛОМА',icon:'♛',hint:'Победи босса и активируй портал'},
 holdout:{name:'ОБОРОНА КОМПЛЕКСА',icon:'◴',hint:'Выдержи осаду и уничтожь оставшиеся машины'},
 relay:{name:'ЗАПУСК РЕТРАНСЛЯТОРОВ',icon:'⌁',hint:'Включи два ретранслятора, затем уничтожь охрану'}
};
function missionType(level){if(level%5===0)return'boss';if(level>=11&&level%10===1)return'holdout';if(level>=14&&level%10===4)return'relay';return ['purge','sabotage','recovery','hunt'][(level-1)%5]||'purge'}
function missionInfo(level){const key=missionType(level);return MISSION_TYPES[key]}
function missionLocations(g,amount){
 const loc=[];const attempts=mapRooms.length?mapRooms:[{x:spawnX,z:spawnZ}];
 for(let i=0;i<attempts.length*2&&loc.length<amount;i++){
  const room=attempts[(i*7+g.sector)%attempts.length],cx=Math.floor(room.x)+.5,cz=Math.floor(room.z)+.5;
  if(collide(cx,cz,.7)||distance({x:cx,z:cz},g.p)<6||loc.some(c=>hypot(c.x-cx,c.z-cz)<8))continue;
  loc.push({id:loc.length,x:cx,z:cz,got:false});
 }
 if(loc.length<amount){
  for(let z=3;z<mapSize-3&&loc.length<amount;z+=3)for(let x=3;x<mapSize-3&&loc.length<amount;x+=3){
   if(mapCells[z][x]!==0)continue;
   const cx=x+.5,cz=z+.5;
   if(collide(cx,cz,.6)||hypot(cx-spawnX,cz-spawnZ)<6||loc.some(c=>hypot(c.x-cx,c.z-cz)<7))continue;
   loc.push({id:loc.length,x:cx,z:cz,got:false});
  }
 }
 return loc;
}
function startMission(g){
 const type=missionType(g.sector);g.mission={version:1,type,done:0,required:type==='sabotage'?Math.min(2,g.nodes.filter(n=>n.type!==2).length):type==='recovery'?3:type==='hunt'?1:type==='relay'?2:0,sentinelId:0,caches:[],surviveRemaining:type==='holdout'?Math.min(62,32+g.sector*.45):0,hazardsEvaded:0,hazardsHit:0};
 if(type==='recovery'){g.mission.caches=missionLocations(g,3);g.mission.required=g.mission.caches.length;}
 g.arenaEvent={phase:'quiet',countdown:Math.max(11,17-g.sector*.06),kind:(Math.floor((g.sector-1)/5)%2===0?'thermal':'emp'),x:0,z:0,r:3.35,warning:0,active:0};
}
function missionCounter(g){
 const m=g?.mission;if(!m)return'';
 if(m.type==='sabotage')return 'УЗЛЫ '+Math.min(m.done,m.required)+'/'+m.required;
 if(m.type==='recovery')return 'ДАННЫЕ '+m.done+'/'+m.required;
 if(m.type==='hunt')return m.done?'КОМАНДИР УСТРАНЁН':'КОМАНДИР НЕ УСТРАНЁН';
 if(m.type==='holdout')return 'ВЫСТОЯТЬ '+Math.ceil(m.surviveRemaining||0)+' с · ВРАГИ '+g.kills+'/'+g.target;
 if(m.type==='relay')return 'РЕТРАНСЛЯТОРЫ '+m.done+'/'+m.required;
 if(m.type==='boss')return 'БОСС · '+(g.boss&&!g.boss.dead?Math.ceil(100*g.boss.hp/g.boss.maxhp)+'%':'НАЧНИ БОЙ');
 return 'РОБОТЫ '+g.kills+'/'+g.target;
}
function missionFinished(g){
 if(!g||g.spawned<g.target||g.enemies.some(e=>!e.dead)||g.target<1)return false;
 const m=g.mission;
 return !m||(m.done>=m.required&&(m.type!=='holdout'||(m.surviveRemaining||0)<=0));
}
function maybeFinishMission(g){
 if(!g||g.state!=='playing'||g.portalReady||!missionFinished(g))return false;
 g.portalReady=true;
 toast('✓ ЗАДАНИЕ ВЫПОЛНЕНО · ПОРТАЛ ОТКРЫТ',3);
 sound(540,.36,'triangle',.16);saveRun();return true;
}
function updateMission(dt){
 const g=game;if(!g||g.state!=='playing')return;
 const m=g.mission;
 if(m?.type==='holdout')m.surviveRemaining=Math.max(0,(m.surviveRemaining||0)-dt);
 if(m&&m.type==='recovery'){
  for(const cache of m.caches)if(!cache.got){
   if(hypot(cache.x-g.p.x,cache.z-g.p.z)<1.04 && Math.abs((g.p.feetY||0)-floorHeight(cache.x,cache.z))<1.65){
    cache.got=true;m.done++;g.score+=140;
    save.credits+=4;burst(cache.x,.75+floorHeight(cache.x,cache.z),cache.z,[.32,.98,1],16);
    toast('◈ ДАННЫЕ ПОЛУЧЕНЫ · '+m.done+'/'+m.required,1.55);sound(720,.15,'sine',.12);saveRun();
   }
  }
 }
 const a=g.arenaEvent;
 if(a&&g.sector>=3&&!g.portalReady){
  if(a.phase==='quiet'){
   a.countdown-=dt;
   if(a.countdown<=0){a.phase='warning';a.warning=2.65;a.x=g.p.x;a.z=g.p.z;a.r=3.4;
    toast(a.kind==='thermal'?'⚠ ТЕРМОУДАР · УЙДИ ИЗ КРУГА':'⚠ ЭМИ-УДАР · УЙДИ ИЗ КРУГА',1.7);
   }
  }else if(a.phase==='warning'){
   a.warning-=dt;
   if(a.warning<=0){
    const hit=hypot(g.p.x-a.x,g.p.z-a.z)<a.r && Math.abs((g.p.feetY||0)-floorHeight(a.x,a.z))<2.0;
    if(hit){m&&(m.hazardsHit++);if(a.kind==='thermal')damagePlayer(12+Math.min(35,g.sector*.7));else {g.p.energy=Math.max(0,g.p.energy-38);g.p.shield=0;toast('ϟ ЭМИ · ЭНЕРГИЯ -38',1.1)}}
    else if(m)m.hazardsEvaded++;
    burst(a.x,.15+floorHeight(a.x,a.z),a.z,a.kind==='thermal'?[1,.42,.18]:[.23,.86,1],25);
    sound(a.kind==='thermal'?86:260,.26,'sawtooth',.10);
    a.phase='quiet';a.countdown=16+Math.min(7,g.sector*.2);
   }
  }
 }
 if(!g.portalReady)maybeFinishMission(g);
}
function missionWaypoint(g){
 if(!g||!g.mission)return null;
 const m=g.mission;
 let pool=[];
 if(m.type==='recovery')pool=m.caches.filter(c=>!c.got);
 if(m.type==='sabotage'&&m.done<m.required)pool=g.nodes.filter(n=>!n.dead&&n.type!==2);
 if(m.type==='hunt'&&!m.done)pool=g.enemies.filter(e=>e.id===m.sentinelId&&!e.dead);
 if(m.type==='relay'&&m.done<m.required)pool=(g.devices||[]).filter(d=>d.kind==='relay'&&!d.used);
 if(!pool.length)return null;
 let best=pool[0],dist=distance(g.p,best);
 for(const v of pool){const d=distance(g.p,v);if(d<dist){best=v;dist=d}}
 return best;
}
function missionStars(g){const m=g.mission;if(!m)return 1;return 1+Number(g.p.hp/g.p.maxhp>=.70)+Number(m.hazardsHit===0&&g.sectorTime<(75+g.sector*9))}

// Grid-aware mission guidance: follow corridors instead of pointing through walls.
let missionGuideCache=null;
function missionField(goal){
 if(!goal)return null;
 const x=Math.floor(goal.x),z=Math.floor(goal.z),sz=mapSize;
 if(missionGuideCache?.map===mapCells&&missionGuideCache.x===x&&missionGuideCache.z===z)return missionGuideCache.field;
 const field=new Int16Array(sz*sz);field.fill(32767);
 if(!mapCells[z]||mapCells[z][x]!==0)return field;
 const queue=new Int16Array(sz*sz);let head=0,tail=0;
 field[z*sz+x]=0;queue[tail++]=z*sz+x;
 while(head<tail){const k=queue[head++],px=k%sz,pz=(k/sz)|0;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const nx=px+dx,nz=pz+dz,idx=nz*sz+nx;
   if(nx<1||nz<1||nx>=sz-1||nz>=sz-1||mapCells[nz][nx]!==0||field[idx]!==32767)continue;
   field[idx]=field[k]+1;queue[tail++]=idx;
  }
 }
 missionGuideCache={map:mapCells,x,z,field};return field;
}
function missionRouteTo(p,target,limit=220){
 if(!target)return[];
 const field=missionField(target),sz=mapSize;
 let x=Math.floor(p.x),z=Math.floor(p.z);
 if(x<0||z<0||x>=sz||z>=sz)return[];
 let d=field[z*sz+x],out=[{x:p.x,z:p.z}];
 for(let i=0;i<limit&&d>0&&d<32767;i++){
  let best=d,bx=x,bz=z;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const xx=x+dx,zz=z+dz;if(xx<0||zz<0||xx>=sz||zz>=sz)continue;
   const value=field[zz*sz+xx];if(value<best){best=value;bx=xx;bz=zz;}
  }
  if(best>=d)break;
  x=bx;z=bz;d=best;out.push({x:x+.5,z:z+.5});
 }
 return out;
}
// Interactive mechanisms are native game-state data (saved with the encounter).
//  - repair/battery = one-off support; relay = mission objective;
//  - coil = pulsing area-denial emitter which can be disarmed by standing near it.
function initDevices(g){
 g.devices=[];
 const relay=g.mission?.type==='relay';
 const wanted=relay?7:g.sector>=3?6:3;
 const loc=missionLocations(g,wanted);
 let madeRelays=0;
 for(let i=0;i<loc.length;i++){
  const p=loc[i];
  let kind;
  if(relay&&madeRelays<2){kind='relay';madeRelays++;}
  else if(g.sector>=3&&i%3===0)kind='coil';
  else kind=i%2===0?'repair':'battery';
  g.devices.push({id:i+1,x:p.x,z:p.z,kind,used:false,charge:0,phase:i*2.31,
    cooldown:0,cycles:0});
 }
 if(relay)g.mission.required=madeRelays;
}
function deviceColor(d){return d.kind==='relay'?[.99,.76,.34]:d.kind==='repair'?[.34,1,.64]:d.kind==='coil'?[1,.35,.21]:[.3,.84,1];}
function completeDevice(g,d){
 if(d.used)return;
 d.used=true;d.charge=0;d.cooldown=0;
 const p=g.p,quality=(p.devicePower||1);
 if(d.kind==='relay'){
  g.mission.done=Math.min(g.mission.required,g.mission.done+1);g.score+=260;
  toast('⌁ РЕТРАНСЛЯТОР АКТИВИРОВАН · '+g.mission.done+'/'+g.mission.required,2);
 }else if(d.kind==='repair'){
  p.hp=Math.min(p.maxhp,p.hp+35*quality);
  p.armor=Math.min(p.maxArmor,p.armor+22*quality);
  // Repair the *physical* suit as well as the renewable energy barrier.
  // This is the player's deliberate, map-limited way to rescue a worn suit.
  p.bodyArmor=Math.min(p.bodyArmorMax||0,(p.bodyArmor||0)+(p.bodyArmorMax||0)*.18*quality);
  g.score+=85;
  toast('✚ РЕМОНТ · КОРПУС, ЭНЕРГОБАРЬЕР И КОСТЮМ',1.6);
 }else if(d.kind==='battery'){
  p.energy=Math.min(p.maxEnergy,p.energy+55*quality);p.heat=0;p.heatLock=0;
  g.score+=85;toast('ϟ ЭНЕРГОСТАНЦИЯ · ЗАРЯД И ОХЛАЖДЕНИЕ',1.5);
 }else if(d.kind==='coil'){
  g.score+=160;save.credits+=3;
  toast('✓ ИМПУЛЬСНЫЙ ИЗЛУЧАТЕЛЬ ОТКЛЮЧЁН',1.5);
 }
 burst(d.x,.55+floorHeight(d.x,d.z),d.z,deviceColor(d),19);
 sound(d.kind==='coil'?210:650,.17,'triangle',.11);
 saveRun();
 maybeFinishMission(g);
}
function updateDevices(dt){
 const g=game;if(!g||g.state!=='playing')return;
 const p=g.p;
 for(const d of (g.devices||[])){
  if(d.used)continue;
  const dist=distance(p,d);
  const y=floorHeight(d.x,d.z);
  const sameFloor=Math.abs((p.feetY||0)-y)<1.2;
  if(d.kind==='coil'){
   // 1.7 s warning, 2.3 s danger, 2.7 s cooldown. Jumping clears the ground pulse.
   const cycle=(g.t+d.phase)%6.7;
   const active=cycle>=1.7&&cycle<4.0;
   d.active=active;
   d.cooldown=Math.max(0,(d.cooldown||0)-dt);
   if(active && d.cooldown<=0 && dist<2.15 && sameFloor && p.grounded && p.shield<=0){
    damagePlayer(7+Math.min(14,g.sector*.28));d.cooldown=1.35;
   }
   // Safely disarm at the emitter by remaining next to it briefly.
   d.charge=dist<1.12&&sameFloor?Math.min(1.2,d.charge+dt):Math.max(0,d.charge-dt*.75);
   if(d.charge>=1.1){completeDevice(g,d);continue;}
  }else{
   d.charge=dist<1.25&&sameFloor?Math.min(1.1,d.charge+dt):Math.max(0,d.charge-dt*.70);
   if(d.charge>=(d.kind==='relay'?.82:.48))completeDevice(g,d);
  }
 }
}
function drawDevices(g){
 if(!glReady||!g?.devices)return;
 const low=save.settings.quality===0;
 for(const d of g.devices){
  if(distance(g.p,d)>24)continue;
  const ground=floorHeight(d.x,d.z),c=deviceColor(d),off=d.used;
  const shell=[.13,.18,.22],steel=[.33,.38,.41],dark=[.045,.067,.084];
  draw(geom.bevel,d.x,ground+.24,d.z,.72,.40,.72,0,shell,0);
  draw(geom.cylinder,d.x,ground+.58,d.z,.39,.45,.39,0,steel,.01);
  draw(geom.pylon,d.x,ground+.96,d.z,.24,.54,.24,0,shell,0);
  draw(geom.cube,d.x,ground+1.23,d.z,.47,.13,.47,0,dark,.01);
  if(!off){
   draw(geom.octa,d.x,ground+1.14+Math.sin(g.t*2+d.phase)*.05,d.z,.22,.31,.22,g.t*.55,c,1.7);
   draw(geom.ring,d.x,ground+.13,d.z,.68,.045,.68,g.t*.55,c,.48);
   if(!low&&d.charge>0)draw(geom.ring,d.x,ground+1.08,d.z,.55,.55,.55,g.t*1.1,c,1.05);
   if(d.kind==='coil'){
    const r=2.15;
    const isActive=d.active;
    draw(geom.ring,d.x,ground+.055,d.z,r*2,.045,r*2,g.t*.27,isActive?[1,.30,.18]:[1,.61,.18],isActive?1.1:.31);
    if(!low&&isActive)draw(geom.ring,d.x,ground+.11,d.z,r*1.2,.025,r*1.2,-g.t*.32,c,.42);
   }
  }else{
   draw(geom.cube,d.x,ground+1.20,d.z,.22,.03,.22,0,[.13,.29,.24],.05);
  }
 }
}
function spawnPowerNodes(level){
 if(!game)return;
 const selected=[];let seed=(Math.imul(level,1442695041)^0x6eeac1a5)>>>0;
 const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const n=Math.min(6,3+Math.floor(level/5));
 const rooms=mapRooms.slice(1).sort((a,b)=>hypot(b.x-spawnX,b.z-spawnZ)-hypot(a.x-spawnX,a.z-spawnZ));
 for(let i=0;i<rooms.length&&selected.length<n;i++){
  const room=rooms[(i*7+level*3)%rooms.length];
  let pos=null;
  for(let j=0;j<13;j++){
   const x=room.x+(j? (rng()-.5)*Math.min(4,room.w-2):0),z=room.z+(j? (rng()-.5)*Math.min(4,room.h-2):0);
   if(collide(x,z,.76)||hypot(x-spawnX,z-spawnZ)<8||hypot(x-portal.x,z-portal.z)<3||selected.some(a=>hypot(a.x-x,a.z-z)<7))continue;
   pos={x,z};break;
  }
  if(pos){const type=selected.length%3;selected.push({...pos,type,hp:39+level*6,maxhp:39+level*6,dead:false,flash:0,phase:rng()*TAU,radius:.61});}
 }
 game.nodes=selected;
}
function rayNode(o,d,maxDist,assist=0){
 if(!game)return null;let result=null,best=maxDist;
 for(const node of game.nodes){
  if(node.dead)continue;
  const ox=o.x-node.x,oy=o.y-(1.3+floorHeight(node.x,node.z)),oz=o.z-node.z;
  const radius=node.radius+Math.max(0,assist);
  const b=ox*d.x+oy*d.y+oz*d.z,c=ox*ox+oy*oy+oz*oz-radius*radius,disc=b*b-c;
  if(disc<0)continue;
  const t=c<=0?.001:-b-Math.sqrt(disc);
  if(t<0||t>=best)continue;best=t;
  result={kind:'node',node,t,x:o.x+d.x*t,y:o.y+d.y*t,z:o.z+d.z*t,nx:(o.x+d.x*t-node.x)/radius,ny:(o.y+d.y*t-1.3-floorHeight(node.x,node.z))/radius,nz:(o.z+d.z*t-node.z)/radius};
 }
 return result;
}
function damagePowerNode(node,amount,depth=0){
 if(!node||node.dead||!game)return false;
 node.hp-=amount;node.flash=.19;
 if(node.hp>0){sound(400,.045,'triangle',.033);return false;}
 node.dead=true;const g=game,kind=NODE_TYPES[node.type];g.nodesDestroyed++;if(g.mission?.type==='sabotage'&&node.type!==2&&g.mission.done<g.mission.required){g.mission.done++;toast('ϟ ЭНЕРГОУЗЕЛ ОТКЛЮЧЁН · '+g.mission.done+'/'+g.mission.required,1.5)}g.score+=125+g.sector*12;
 const center={x:node.x,y:1.3,z:node.z};
 g.impactFx.push({...center,life:.66,maxLife:.66,r:kind.radius*.9,col:kind.color,explosion:true});
 burst(node.x,1.2,node.z,kind.color,save.settings.quality===0?22:42);
 g.scorch.push({x:node.x,z:node.z,life:30,r:kind.radius*.57});if(g.scorch.length>32)g.scorch.shift();
 if(node.type===2){
  g.loot.push({x:node.x+.3,z:node.z,type:'heal',life:25},{x:node.x-.3,z:node.z,type:'energy',life:25},{x:node.x+.7,z:node.z-.3,type:'credits',life:25},{x:node.x-.55,z:node.z+.35,type:'plates',life:25});
  toast('✚ КОНТЕЙНЕР ОТКРЫТ · СОБЕРИ РЕСУРСЫ',1.35);
 }else{
  const r=kind.radius;
  for(const e of [...g.enemies])if(!e.dead){const dist=hypot(e.x-node.x,e.z-node.z);if(dist<=r+e.radius){hurtEnemy(e,(node.type===0?115:56)*(1-.45*Math.min(1,dist/r)));if(node.type===1)e.stun=Math.max(e.stun,2.7)}}
  const pd=distance(g.p,node);
  if(node.type===0&&pd<r*.55)damagePlayer(12*(1-pd/(r*.75)));
  if(depth<3)for(const other of g.nodes)if(!other.dead&&distance(node,other)<r*1.15)damagePowerNode(other,other.hp+1,depth+1);
  toast(node.type===0?'✹ ТЕРМОРЕАКТОР ВЗОРВАН':'ϟ ЭМИ-ИМПУЛЬС · ВРАГИ ОГЛУШЕНЫ',1.3);
 }
 sound(node.type===0?85:node.type===1?160:550,.31,'sawtooth',.12);
 maybeFinishMission(g);saveRun();return true;
}

function sparkImpact(x,y,z,n,col,num=9){
 const g=game;if(!g)return;
 const cap=save.settings.quality===0?9:20;
 for(let i=0;i<Math.min(num,cap);i++){
   let a=rand(0,TAU),sp=rand(.6,3.0),up=rand(-.2,2);
   const vx=Math.cos(a)*sp+(n.nx||0)*rand(.6,1.9),vz=Math.sin(a)*sp+(n.nz||0)*rand(.6,1.9),life=rand(.16,.48);
   g.particles.push({x,y,z,vx,vy:up+(n.ny||0),vz,life,maxLife:life,a,col});
 }
}
function addSurfaceMark(hit,w,size=1){
 if(!hit||hit.kind==='enemy'||hit.kind==='node'||!game)return;
 const g=game,energy=w.mode==='projectile'||w.blast>0;
 const c=w.color||[1,.65,.3],r=(energy?.20:.105)*(w.name.includes('ДРОБОВИК')?.70:1)*size;
 const bounds=hit.solid?hit.solid.box:null;
 // Corner and edge contacts have genuine diagonal sphere normals, but a
 // bullet mark must lie on one flat metal face. Pick the dominant face ONLY
 // for its decal; preserve the 3D contact normal for sparks and explosions.
 const normal=[hit.nx||0,hit.ny||0,hit.nz||0];
 let face=0;if(Math.abs(normal[1])>Math.abs(normal[face]))face=1;
 if(Math.abs(normal[2])>Math.abs(normal[face]))face=2;
 const decalN=[0,0,0];decalN[face]=Math.sign(normal[face])||1;
 g.decals.push({x:hit.x+decalN[0]*.025,y:hit.y+decalN[1]*.025,z:hit.z+decalN[2]*.025,
  nx:decalN[0],ny:decalN[1],nz:decalN[2],r,life:energy?34:52,maxLife:energy?34:52,
  col:c,energy,rot:rand(0,TAU),kind:hit.kind,cellX:hit.cellX,cellZ:hit.cellZ,bounds:bounds&&bounds.slice()});
 while(g.decals.length>MAX_WALL_MARKS)g.decals.shift();decalDirty=true;
}
function addImpact(hit,w,power=1){
 if(!hit||!game)return;
 const g=game,n={nx:hit.nx||0,ny:hit.ny||0,nz:hit.nz||0};
 if(hit.kind!=='enemy')addSurfaceMark(hit,w,Math.min(2,power));
 sparkImpact(hit.x,hit.y,hit.z,n,w.color||[1,1,1],Math.round(8*power));
 g.impactFx.push({x:hit.x,y:hit.y,z:hit.z,life:.19,maxLife:.19,r:(.13+.14*power),col:w.color||[1,1,1]});
 if(g.impactFx.length>38)g.impactFx.shift();
}
function makeTracer(o,end,w,width=1){
 const g=game;if(!g)return;
 g.tracers.push({a:{...o},b:{...end},life:w.pierce?.22:.13,maxLife:w.pierce?.22:.13,r:(w.pierce?.052:.017)*width,col:w.color});
 if(g.tracers.length>(touchOnly?35:65))g.tracers.shift();
}
function muzzleVisual(w){
 const p=game?.p;if(!p)return;
 p.shotGlow=Math.max(p.shotGlow||0,.115+(w.recoil||.3)*.065);
 const el=$('muzzle');el.style.opacity='.95';el.style.setProperty('--flash-color',`rgb(${w.color.map(c=>Math.round(c*255)).join(',')})`);
 clearTimeout(muzzleVisual.tm);muzzleVisual.tm=setTimeout(()=>el.style.opacity='0',72);
 sound(w.pierce?135:w.blast?110:w.shots>1?165:w.rate<.09?280:218,w.blast?.24:.10,w.pierce||w.blast?'sawtooth':'triangle',w.blast?.12:.058);
}
function shotProjectile(w,o,d){
 const g=game;
 if(g.projectiles.length>=42)g.projectiles.shift();
 g.projectiles.push({x:o.x+d.x*.035,y:o.y+d.y*.035,z:o.z+d.z*.035,vx:d.x*w.speed,vy:d.y*w.speed,vz:d.z*w.speed,life:Math.min(5.4,w.range/w.speed),w,rad:w.name.includes('ГРОМ')?.20:.13});
}
// Stage 4: a blast affects the actual volumetric robot silhouette, not a
// single point at its center. Cover is sampled at five independent visible
// body parts. A direct projectile impact is always a direct hit; it is not
// cancelled merely because another sample point is hidden by a staircase.
function enemyBlastSamples(e,origin){
 const scale=e.boss?1.75:Math.max(.76,Math.min(1.31,e.radius/.51));
 const base=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
 const squat=e.type==='scout'||e.type==='charger'||e.airborne||e.type==='drone';
 const torsoY=base+(squat?1.02:1.28)*scale;
 const headY=base+(squat?1.52:2.07)*scale;
 const rx=scale*(squat?1.12:1.42),rz=scale*1.03;
 const dx=origin.x-e.x,dz=origin.z-e.z,span=Math.hypot(dx,dz)||1;
 const tx=dx/span,tz=dz/span;
 const front={x:e.x+tx*rx*.65,y:torsoY,z:e.z+tz*rz*.65};
 const points=[front,
  {x:e.x,y:headY,z:e.z},
  {x:e.x,y:base+.50*scale,z:e.z},
  {x:e.x-tz*rx*.57,y:torsoY,z:e.z+tx*rz*.57},
  {x:e.x+tz*rx*.57,y:torsoY,z:e.z-tx*rz*.57}];
 const vertical=Math.max(base+.20,Math.min(headY+.40*scale,origin.y));
 let hullDist=Math.hypot(Math.max(0,span-Math.max(rx,rz)*.70),origin.y-vertical);
 // A blast can graze a real wing, boot or external weapon mount even if the
 // central body is outside the radius. Evaluate the SAME collision proxies
 // as direct shots, then sample the two nearest exposed accessory surfaces.
 const kind=e.boss?'boss':e.airborne?'drone':e.type,hover=kind==='drone'||kind==='medic';
 const t=Number(game?.t)||0,id=Number(e.id)||0;
 const bob=hover?Math.sin(t*3.2+id)*.048:
  (Math.sin((Number(e.robotCycle)||0)*2)*.030*(Number(e.robotMotion)||0)+Math.sin(t*.8+id)*.006);
 const foot=base+bob+(hover?.13:0);
 const yaw=Number.isFinite(e.robotYaw)?e.robotYaw:0,cs=Math.cos(yaw),sn=Math.sin(yaw);
 const extras=[];
 for(const v of robotAccessoryVolumes(e)){
  const center={x:e.x+v.x*cs+v.z*sn,y:foot+v.y,z:e.z-v.x*sn+v.z*cs};
  const ox=origin.x-center.x,oy=origin.y-center.y,oz=origin.z-center.z;
  const lx=ox*cs-oz*sn,lz=ox*sn+oz*cs;
  const den=Math.hypot(v.rx*lx,v.ry*oy,v.rz*lz)||1;
  // Support point of a rotated ellipsoid, on the actual side facing the blast.
  const sx=v.rx*v.rx*lx/den,sy=v.ry*v.ry*oy/den,sz=v.rz*v.rz*lz/den;
  const point={x:center.x+sx*cs+sz*sn,y:center.y+sy,z:center.z-sx*sn+sz*cs};
  const dist=Math.hypot(origin.x-point.x,origin.y-point.y,origin.z-point.z);
  extras.push({point,dist});
 }
 extras.sort((a,b)=>a.dist-b.dist);
 for(const extra of extras.slice(0,2)){
  hullDist=Math.min(hullDist,extra.dist);
  points.push(extra.point);
 }
 return {points,hullDist};
}
function areaVisibility(origin,targets){
 let visible=0;
 for(const point of targets){
  const dx=point.x-origin.x,dy=point.y-origin.y,dz=point.z-origin.z;
  const len=Math.hypot(dx,dy,dz);
  if(len<.16){visible++;continue;}
  const unit=v3(dx/len,dy/len,dz/len);
  // Exclude the final body surface from geometry-only raycast tolerance.
  if(!rayWall(origin,unit,Math.max(0,len-.13)))visible++;
 }
 return targets.length?visible/targets.length:0;
}
function explosiveHitEnemy(e,w,amount){
 hurtEnemy(e,amount,{penetration:w.penetration||0});
 // Ion bolts short-circuit robots; rockets and grenades do not freeze them.
 if(!e.dead&&w.ionStun)e.stun=Math.max(e.stun||0,w.ionStun);
}
function splash(x,y,z,w,directEnemy=null,directNode=null){
 const g=game;if(!g)return;
 const r=w.blast||2.5,origin=v3(x,y,z);
 // A real contact with the hull must inflict the complete listed direct damage.
 // Do not apply splash damage to that same enemy twice.
 if(directEnemy&&!directEnemy.dead)explosiveHitEnemy(directEnemy,w,w.damage);
 for(const e of [...g.enemies]){
  if(e.dead||e===directEnemy||!robotNearArea(e,origin,r))continue;
  const body=enemyBlastSamples(e,origin);
  if(body.hullDist>=r)continue;
  const exposure=areaVisibility(origin,body.points);
  if(exposure<=0)continue;
  const attenuation=.30+.70*Math.pow(1-body.hullDist/r,1.20);
  explosiveHitEnemy(e,w,w.damage*attenuation*exposure);
 }
 for(const n of [...g.nodes])if(!n.dead&&n!==directNode){
  const nodeY=.95+(n.feetY||floorHeight(n.x,n.z));
  const dx=n.x-x,dy=nodeY-y,dz=n.z-z;
  const dist=Math.hypot(dx,dy,dz);
  if(dist>=r+n.radius)continue;
  const target=v3(n.x,nodeY,n.z);
  if(areaVisibility(origin,[target])>0)
   damagePowerNode(n,w.damage*(.35+.65*(1-Math.min(1,dist/(r+n.radius)))));
 }
 burst(x,y,z,w.color||[1,.6,.3],save.settings.quality===0?20:44);
 g.impactFx.push({x,y,z,life:.48,maxLife:.48,r:r*.64,col:w.color||[1,.5,.1],explosion:true});
 if(g.impactFx.length>38)g.impactFx.shift();
 sound(w.name.includes('ГРОМ')?73:99,.4,'sawtooth',.19);
}
function shootPellet(w,burstIndex=0){
 if(!game||game.state!=='playing')return;
 const g=game,p=g.p;
 const o=v3(p.x,1.47+(p.feetY||0),p.z);
 const targetDir=aimFromOperator(o);
 const baseYaw=Math.atan2(targetDir.x,targetDir.z),basePitch=Math.atan2(targetDir.y,Math.hypot(targetDir.x,targetDir.z));
 const ang=baseYaw+rand(-w.spread,w.spread),pitch=clamp(basePitch+rand(-w.spread*.64,w.spread*.64),-1.13,1.04);
 const d=v3(Math.sin(ang)*Math.cos(pitch),Math.sin(pitch),Math.cos(ang)*Math.cos(pitch));
 if(w.mode==='projectile'){
   shotProjectile(w,o,d);
   return;
 }
 const wall=rayWall(o,d,w.range);
 const node=rayNode(o,d,wall?wall.t:w.range);
 const limit=node?node.t:(wall?wall.t:w.range);
 const ignored=new Set();
 const maxPierce=w.pierce||1;
 let count=0,first=null;
 while(count<maxPierce){
   const hit=rayEnemy(o,d,limit,ignored,touchOnly&&save.settings.aim?.10:0);
   if(!hit)break;
   ignored.add(hit.enemy.id);count++;
   if(!first)first=hit;
   hurtEnemy(hit.enemy,w.damage*Math.pow(.75,count-1),{penetration:w.penetration});
   if(w.freeze)hit.enemy.stun=Math.max(hit.enemy.stun,w.freeze);
   if(count===1||w.pierce)addImpact({...hit,nx:-d.x,ny:-d.y,nz:-d.z},w,.8);
 }
 if(node&&(!first||w.pierce)){
  damagePowerNode(node.node,w.damage*Math.pow(.78,Math.max(0,count-1)));
  addImpact(node,w,1);
 }
 const end=node||wall||first||v3(o.x+d.x*w.range,o.y+d.y*w.range);
 // An enemy stops ordinary rounds; railgun beams penetrate until the wall.
 const target=(w.pierce||!first)?end:first;
 if(w.shots===1||count>0||Math.random()<.42)makeTracer(v3(o.x+d.x*.44,o.y+d.y*.44,o.z+d.z*.44),target,w,w.shots>1?.48:1);
 if(wall&&!node&&(!first||w.pierce||w.shots>1))addImpact(wall,w,w.pierce?1.8:.85);
}
function fireBurstShot(w){
 if(!game||game.state!=='playing')return;
 muzzleVisual(w);
 const p=game.p;p.recoil=Math.min(1.8,(p.recoil||0)+(w.recoil||.3)*.68);
 for(let k=0;k<w.shots;k++)shootPellet(w);
}
let ammoShots=0;
function shoot(){
 const g=game;if(!g||g.state!=='playing')return;
 const p=g.p,w=combatWeapon(p.weapon);
 if(!w||p.cooldown>0||p.heatLock>0)return;
 if(p.heat>=97){p.heatLock=1;toast('ПЕРЕГРЕВ ОРУЖИЯ',.75);sound(70,.15);return;}
 // Preserve the sub-frame remainder: otherwise a purchased rate upgrade may
 // produce fewer real shots at some FPS because each shot discards up to dt.
 p.cooldown=w.rate*p.rate+Math.min(0,p.cooldown);
 p.heat=clamp(p.heat+w.heat*p.heatMod,0,105);
 p.shots++;ammoShots++;
 fireBurstShot(w);
 if(w.burst){for(let j=1;j<w.burst;j++)g.burstQueue.push({w,delay:j*w.burstGap});}
}
function updatePlayerOrdnance(dt){
 const g=game;if(!g)return;
 for(const b of g.burstQueue){b.delay-=dt;if(b.delay<=0){fireBurstShot(b.w);b.done=true;}}
 g.burstQueue=g.burstQueue.filter(x=>!x.done);
 for(const s of g.projectiles){
   if(s.dead)continue;
   const ox=s.x,oy=s.y,oz=s.z;
   const length=hypot(s.vx*dt,s.vy*dt,s.vz*dt);
   if(length<1e-6)continue;
   const d=v3(s.vx*dt/length,s.vy*dt/length,s.vz*dt/length),o=v3(ox,oy,oz);
   const wall=sweepWorldSphere(o,d,length,s.rad||0),node=rayNode(o,d,wall?Math.min(length,wall.t):length,s.rad||0);
   const enemy=rayEnemy(o,d,node?node.t:(wall?Math.min(length,wall.t):length),null,s.rad||0);
   const hit=enemy||node||wall;
   if(hit){s.x=hit.x;s.y=hit.y;s.z=hit.z;s.dead=true;addImpact(hit,s.w,1.5);if(hit.kind==='node')damagePowerNode(hit.node,s.w.damage);
      splash(hit.x+(hit.nx||0)*.05,hit.y+(hit.ny||0)*.05,hit.z+(hit.nz||0)*.05,s.w,hit.kind==='enemy'?hit.enemy:null,hit.kind==='node'?hit.node:null);
      
   }else{s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;}
   s.vy-=(s.w.gravity||0)*dt;
   s.life-=dt;
   if(s.life<=0&&!s.dead){s.dead=true;splash(s.x,s.y,s.z,s.w);}
 }
 g.projectiles=g.projectiles.filter(s=>!s.dead);
 for(const n of g.nodes)n.flash=Math.max(0,n.flash-dt);for(const d of g.decals)d.life-=dt;
 const oldMarks=g.decals.length;g.decals=g.decals.filter(d=>d.life>0);if(g.decals.length!==oldMarks)decalDirty=true;
 for(const f of g.impactFx)f.life-=dt;
 g.impactFx=g.impactFx.filter(f=>f.life>0);
}
function showDamage(e,dm,crit){let p=game.p,dx=e.x-p.x,dz=e.z-p.z;const a=Math.atan2(dx,dz)-p.yaw;let v=Math.atan2(Math.sin(a),Math.cos(a));let d=hypot(dx,dz);if(Math.abs(v)>1.1)return;let el=document.createElement('div');el.className='floating';el.textContent=(crit?'✦ ':'')+dm;el.style.left=(50+v/(Math.PI*.38)*40)+'%';el.style.top=(42+rand(-5,5))+'%';el.style.color=crit?'#ffcf6e':'#e9fdff';$('floatText').appendChild(el);setTimeout(()=>el.remove(),790);$('crosshair').classList.add('hit');clearTimeout(showDamage.tm);showDamage.tm=setTimeout(()=>$('crosshair').classList.remove('hit'),90)}

// F restores the first damaged defense in strict order: hull, physical suit,
// energy barrier. No artificial cooldown; each action is paid from energy.
function restorePriorityDefense(p){
 const stages=[
  {key:'hp',max:'maxhp',perAction:permanentStat(49,PERM_COMPOUND.repairHull,save.perms[8]),cost:50,name:'КОРПУС'},
  {key:'bodyArmor',max:'bodyArmorMax',perAction:(p.bodyArmorMax||0)*permanentStat(.07,PERM_COMPOUND.repairSuit,save.perms[9]),cost:50,name:'КОСТЮМ'},
  {key:'armor',max:'maxArmor',perAction:(p.maxArmor||0)*permanentStat(.30,PERM_COMPOUND.repairBarrier,save.perms[10]),cost:40,name:'ЭНЕРГОБАРЬЕР'}
 ];
 for(const stage of stages){
  const limit=Math.max(0,Number(p[stage.max])||0),value=clamp(Number(p[stage.key])||0,0,limit),missing=limit-value;
  if(limit<=0||missing<=1e-5)continue;
  // Even a fraction of one energy unit can be sufficient to complete the
  // final tiny remainder of a repair. Do not impose an undocumented 1-unit
  // gate when the actual proportional cost is lower.
  if(!(p.energy>0)){toast('ВОССТАНОВЛЕНИЕ · НЕДОСТАТОЧНО ЭНЕРГИИ',.8);return false;}
  const added=Math.min(missing,stage.perAction,p.energy/stage.cost*stage.perAction);
  if(added<=1e-8)return false;
  p.energy=Math.max(0,p.energy-added/stage.perAction*stage.cost);
  p[stage.key]=Math.min(limit,value+added);
  if(stage.key==='armor')p.armorDelay=0;
  burst(p.x,(p.feetY||0)+.9,p.z,stage.key==='hp'?[.22,1,.66]:stage.key==='bodyArmor'?[.96,.78,.37]:[.45,.73,1],10);
  sound(stage.key==='hp'?640:stage.key==='bodyArmor'?500:440,.10,'sine',.07);
  toast('✚ '+stage.name+' +'+Math.round(added*10)/10,.65);
  return stage.key;
 }
 toast('КОРПУС, КОСТЮМ И БАРЬЕР ПОЛНЫЕ',.8);
 return false;
}
function useAbility(type){const g=game;if(!g||g.state!=='playing')return;const p=g.p;
 if(type==='heal')return restorePriorityDefense(p);
 // Q is energy-limited rather than time-limited: deliberate presses can
 // fire immediately if enough battery charge remains.
 const ABILITY_COOLDOWNS={shield:5};
 const cooldowns=p.abilityCooldowns||(p.abilityCooldowns={});
 if(type==='shield'&&((p.shield||0)>0||(cooldowns.shield||0)>0)){toast((p.shield||0)>0?'ЗАЩИТНАЯ СФЕРА УЖЕ АКТИВНА':'ПЕРЕЗАРЯДКА · '+cooldowns.shield.toFixed(1)+' с',.65);return;}
 // Starter capacity of 100 permits one 52-energy pulse, not two in a row.
 // Later energy research improves the maximum burst rate naturally.
 let costs={dash:p.dashCost,pulse:52,shield:50,heal:50},cost=costs[type];
 if(!Number.isFinite(cost))return;
 if(p.energy<cost){toast('НЕДОСТАТОЧНО ЭНЕРГИИ',.8);return}
 p.energy-=cost;
 // Five seconds of genuine recharge AFTER the sphere expires. Storing the
 // combined timer keeps the existing per-frame update and old saves simple.
 // Temporary/permanent duration perks cannot produce nonstop invulnerability.
 cooldowns[type]=type==='shield'?(p.shieldDuration||3.5)+ABILITY_COOLDOWNS.shield:0;
 if(type==='dash'){
 const mx=input.mx,mz=input.mz,s=(Math.abs(mx)+Math.abs(mz)>0?p.yaw-Math.atan2(mx,mz):p.yaw);
 // The acquired phase-radius upgrade defines the hard upper bound. The
 // chosen distance only shortens this same safe, swept horizontal dash.
 // Neither pitch nor flight altitude is changed by the ability.
 const maximum=clamp(Number(p.dashRange)||DASH_DISTANCE_BASE,DASH_DISTANCE_BASE,DASH_DISTANCE_MAX);
 const configured=save.settings?.dashDistance;
 const range=configured==null?maximum:clamp(Number(configured)||maximum,DASH_DISTANCE_MIN,maximum);
 for(let left=range;left>1e-8;left-=.21){const step=Math.min(.21,left);moveEntity(p,Math.sin(s)*step,Math.cos(s)*step,.24);}
 // Without cooldown, long invulnerability windows would be exploitable.
 // The dash is now a displacement skill with only minimal transition safety.
 p.iframes=Math.max(p.iframes,.055);burst(p.x,(p.feetY||0)+.3,p.z,[.33,1,1],14);sound(380,.14)
}if(type==='pulse'){
  // Same physical silhouette and cover logic as explosive weapons.
  // In particular, contact-range targets cannot accidentally fall between
  // distance-to-center and hitbox checks, and elevated decks block a wave.
  const origin=v3(p.x,(p.feetY||0)+1.10,p.z);
  const radius=permanentStat(5.8,PERM_COMPOUND.pulseRadius,save.perms[6]);
  const power=permanentStat(1,PERM_COMPOUND.pulseDamage,save.perms[7])*p.shock;
  let count=0,blocked=0;
  for(const e of [...g.enemies]){
   if(e.dead||!robotNearArea(e,origin,radius))continue;
   const body=enemyBlastSamples(e,origin);
   if(body.hullDist>radius)continue;
   const exposure=areaVisibility(origin,body.points);
   if(exposure<=0){blocked++;continue;}
   hurtEnemy(e,66*power,{penetration:.82});
   if(!e.dead)e.stun=Math.max(e.stun||0,1.8);
   count++;
  }
  for(const n of g.nodes)if(!n.dead){
   const ny=(n.feetY||floorHeight(n.x,n.z))+.95;
   if(Math.hypot(n.x-origin.x,ny-origin.y,n.z-origin.z)<=radius+n.radius
      &&areaVisibility(origin,[v3(n.x,ny,n.z)])>0)
    damagePowerNode(n,45*power);
  }
  for(const b of g.bullets){
   if(Math.hypot(b.x-origin.x,b.y-origin.y,b.z-origin.z)>radius)continue;
   if(areaVisibility(origin,[v3(b.x,b.y,b.z)])>0)b.dead=true;
  }
  burst(p.x,(p.feetY||0)+1.1,p.z,[.36,.95,1],45);
  sound(190,.28,'sawtooth',.2);
  toast('ЭМИ-ВОЛНА · '+radius.toFixed(1)+' м · '+count+' ЦЕЛЕЙ'+(blocked?' · УКРЫТО '+blocked:''),1.25);
 }if(type==='shield'){p.shield=p.shieldDuration;burst(p.x,1,p.z,[.58,.58,1],18);sound(460,.2,'sine',.13)}}
function enemyFire(e,pattern=0){
 e.attackPulse=.19;
 const g=game,p=pattern===8&&e.lockTarget?e.lockTarget:g.p;
 const dx=p.x-e.x,dz=p.z-e.z,base=Math.atan2(dx,dz);
 const count=pattern===9?3:pattern===10?2:([1,10,5,12,3,8,1,2][pattern]||1);
 const spread=pattern===2?.14:pattern===4?.08:pattern===7?.2:pattern===9?.14:pattern===10?.10:0;
 const eY=1.1+(Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z));
 const targetY=1.05+(Number.isFinite(p.feetY)?p.feetY:(Number.isFinite(p.y)?p.y:0));
 const rise=targetY-eY,horizontal=Math.hypot(dx,dz),length3=Math.hypot(horizontal,rise)||1;
 for(let i=0;i<count;i++){
  let a=base;
  if(pattern===1||pattern===3||pattern===5)a=i*TAU/count+(pattern===3?g.t*.7:pattern===5?Math.PI/8:0);
  else if(pattern===2||pattern===4||pattern===7||pattern===9||pattern===10)a=base+(i-(count-1)/2)*spread;
  let speed=(e.boss?2.7:3.0)*g.p.slowBullets;
  if(pattern===8)speed*=1.5;if(pattern===6)speed*=.56;
  if(pattern===3)speed*=.88;if(pattern===7)speed*=1.45;
  if(pattern===9)speed*=1.23;if(pattern===10)speed*=1.14;
  // Flying enemies must fire at true 3D distance. Old ground enemies retain
  // their original bounded vertical aiming to preserve their established balance.
  const vy=e.airborne?rise/length3*speed:
    (pattern===1||pattern===3||pattern===5?0:
      clamp(rise/Math.max(.4,horizontal/speed),-speed*.60,speed*.60));
  const flatSpeed=e.airborne?horizontal/length3*speed:speed;
  g.bullets.push({x:e.x,y:eY,z:e.z,vx:Math.sin(a)*flatSpeed,vy,
   vz:Math.cos(a)*flatSpeed,life:pattern===6?10:7,
   radius:pattern===6?.27:e.boss?.13:.095,
   damage:e.damage*(pattern===6?1.5:pattern===7?.8:1),from:'enemy',col:e.color});
 }
 sound(100,.09,'sawtooth',.04);
}

// Stage 8: damage, healing and targeted attacks obey the same physical cover
// as projectiles. A mere two-dimensional distance is insufficient: a handrail,
// solid cabinet or stair riser may be between two otherwise adjacent actors.
// Trace at the actual torso height to avoid casting from inside the floor.
function enemyCombatClear(e,target,fromHeight=.96,toHeight=.96){
 const a=v3(e.x,(Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z))+fromHeight,e.z);
 const b=v3(target.x,(Number.isFinite(target.feetY)?target.feetY:floorHeight(target.x,target.z))+toHeight,target.z);
 const vx=b.x-a.x,vy=b.y-a.y,vz=b.z-a.z,length=Math.hypot(vx,vy,vz);
 if(!(length>1e-6))return true;
 const hit=rayWall(a,v3(vx/length,vy/length,vz/length),length);
 return !hit||hit.t>=length-.045;
}
function enemyMeleeReach(e,p){
 return Math.abs((e.feetY||0)-(p.feetY||0))<1.2 &&
   enemyCombatClear(e,p,e.boss?1.20:.91,.95);
}
function bossGroundWaveReach(e,p){
 return enemyCombatClear(e,p,.44,.44);
}
// Airborne robots are independently simulated in all arenas. Their height is
// real physics state (not an animation-only offset), used by 3D projectiles,
// cover checks, ray hits and collision; never snap it to a ground support.
function updateFlyingRobot(e,p,dt){
 const time=Number(game?.t)||0;
 const low=floorHeight(e.x,e.z)+.13;
 const high=Math.max(low,ceilingHeight()-enemyBodyHeight(e)-.08);
 let feet=Number.isFinite(e.feetY)?e.feetY:low;
 feet=clamp(feet,low,high);
 const variant=e.type;
 const offset=variant==='skyguard'?2.55:variant==='stormray'?1.45:
    variant==='skyhunter'?2.05:1.35;
 const amplitude=variant==='stormray'?.72:variant==='skyhunter'?.47:.27;
 const phase=time*(variant==='stormray'?2.05:1.23)+e.id*.73;
 const target=clamp((Number.isFinite(p.feetY)?p.feetY:0)+offset+
   Math.sin(phase)*amplitude,low,high);
 const speed=variant==='stormray'?3.9:variant==='skyhunter'?3.15:
   variant==='skyguard'?2.2:2.6;
 const desired=clamp(target-feet,-speed*dt,speed*dt);
 const r=enemyBodyRadius(e),height=enemyBodyHeight(e);
 let next=clamp(feet+desired,low,high);
 if(next>feet){
  const barrier=worldSolidHeadBarrier(e.x,e.z,r,feet+height,next+height);
  if(barrier!==null)next=Math.min(next,barrier-height-.018);
 }else if(next<feet){
  const barrier=worldSolidFeetBarrier(e.x,e.z,r,feet,next);
  if(barrier!==null)next=Math.max(next,barrier+.018);
 }
 next=clamp(next,low,high);
 if(!worldSolidBodyCollision(e.x,e.z,r,next,height))e.feetY=next;
 else e.feetY=feet;
 const blocked=target>(e.feetY||0)+.30&&desired>.001&&
   (e.feetY||0)<feet+desired*.25;
 e.airLiftBlocked=blocked?Math.min(1.6,(e.airLiftBlocked||0)+dt):
   Math.max(0,(e.airLiftBlocked||0)-dt*1.3);
 if(e.stun>0)return;

 const dx=p.x-e.x,dz=p.z-e.z,dist=Math.hypot(dx,dz)||.0001;
 const heightGap=((Number.isFinite(p.feetY)?p.feetY:0)+1.05)-(e.feetY+1.1);
 const dist3=Math.hypot(dist,heightGap);
 const heading=enemyHeading(e,p);
 let vx=0,vz=0;
 if(e.airLiftBlocked>.22 && heightGap>1.2){
  // When beneath a bridge / airborne platform, orbit *out* of its footprint
  // before trying to climb. Vertical collision still prevents clipping through.
  const awayX=-dx/dist,awayZ=-dz/dist;
  vx=awayX*.92+(-awayZ)*e.orbit*.35;
  vz=awayZ*.92+awayX*e.orbit*.35;
 }else if(dist>6.0){vx=heading.dx;vz=heading.dz;}
 else if(dist<3.2){vx=-dx/dist;vz=-dz/dist;}
 else{vx=-dz/dist*e.orbit*.66;vz=dx/dist*e.orbit*.66;}
 const mag=Math.hypot(vx,vz)||1;
 enemyMove(e,vx/mag*e.speed*dt,vz/mag*e.speed*dt,enemyBodyRadius(e));
 // Distances, cover and muzzle height are all 3D; flying enemies do not fire
 // through platforms merely because the player is nearby on the map.
 if(e.attack<=0){
  if(dist3<e.range&&enemyCombatClear(e,p,1.1,1.05)){
   enemyFire(e,variant==='skyhunter'?9:variant==='stormray'?10:0);
   e.attack=variant==='skyguard'?2.5:variant==='skyhunter'?2.18:
     variant==='stormray'?1.65:1.9;
  }else e.attack=.24;
 }
}
function updateEnemies(dt){const g=game,p=g.p;for(let e of g.enemies){if(e.dead)continue;e.spawn+=dt;e.flash=Math.max(0,e.flash-dt);e.stun=Math.max(0,e.stun-dt);
 // Elite-freezing tools should interrupt boss attacks, not lock the boss for
 // the entire encounter. Repeated cryo/ion/pulse/device hits cannot extend a
 // 0.55-s interruption; after that, the boss regains control for 2.55 s.
 if(e.boss){const now=Number(g.t)||0,windowEnd=Number(e.stunWindowEnd)||0,immuneEnd=Number(e.stunImmuneUntil)||0;
  if(now<windowEnd)e.stun=Math.min(e.stun,Math.max(0,windowEnd-now));
  else if(now<immuneEnd)e.stun=0;
  else if(e.stun>0){e.stunWindowEnd=now+.55;e.stunImmuneUntil=now+3.10;e.stun=Math.min(e.stun,.55);}
 }
 let d=distance(p,e),heading=e.airborne?{dx:0,dz:0}:enemyHeading(e,p),dx=heading.dx,dz=heading.dz;e.attack-=dt;e.trail+=dt;
 if(e.boss && !e.dead && e.hp<e.maxhp*.24){
  if(!e.phase3){e.phase3=true;e.damage*=1.12;e.ultTimer=3.3;toast('☠ ФАЗА III · УДАР ПО ПЛОЩАДИ · ПРЫГАЙ!',2.6);}
  if((e.ultWarn||0)>0){
   const prev=e.ultWarn;e.ultWarn=Math.max(0,e.ultWarn-dt);
   if(prev>0&&e.ultWarn===0){
    const near=hypot(p.x-e.x,p.z-e.z)<5.15;
    const nearHeight=Math.abs((p.feetY||0)-(e.feetY||0))<1.35;
    if(near&&nearHeight&&p.grounded&&e.stun<=0&&bossGroundWaveReach(e,p))damagePlayer(16+Math.min(22,g.sector*.45));
    burst(e.x,.18+(e.feetY||0),e.z,[1,.4,.12],28);
    sound(92,.32,'sawtooth',.13);
   }
  }else{
   e.ultTimer=(e.ultTimer||8.5)-dt;
   if(e.ultTimer<=0){e.ultTimer=8.5;e.ultWarn=1.85;toast('⚠ БОСС · ВОЛНА ПО ПОЛУ — ПРЫЖОК!',1.65);}
  }
 }

 if(e.telegraph>0){
  if(e.stun>0){e.telegraph=0;e.lockTarget=null;}
  else{e.telegraph-=dt;if(e.telegraph<=0&&e.lockTarget){enemyFire(e,8);e.lockTarget=null;}}
 }
 if(e.boss){if(e.hp<e.maxhp*.35&&!e.enraged){e.enraged=true;e.speed*=1.24;e.damage*=1.22;e.attack=Math.min(.3,e.attack);toast('☠ ФАЗА II · РЕЖИМ БЕШЕНСТВА',2.2);burst(e.x,1.2+(e.feetY||0),e.z,[1,.28,.42],28);}e.bossPhase+=dt;
let variant=e.variant,phase=e.bossPhase;
if(e.attack<=0&&d<19&&e.stun<=0){let attack=variant===0?(Math.floor(phase/4)%2?4:1):variant===1?(Math.floor(phase/5)%2?2:6):variant===2?2:variant===3?(Math.floor(phase/5)%2?7:5):variant===4?(Math.floor(phase/7)%2?6:2):variant===5?3:variant===6?(Math.floor(phase/5)%2?6:1):Math.floor(phase/4)%7;
enemyFire(e,attack);e.attack=attack===1||attack===3?2.8:attack===6?2.1:variant===2?1.6:1.15;
if(attack===1||attack===3)toast('⚠ РАДИАЛЬНЫЙ ЗАЛП · УКЛОНЯЙСЯ!',1.1);
if(attack===6)toast('⚠ ПЛАЗМЕННАЯ БОМБА!',1.1);
if(variant===6&&d<8){moveEntity(p,-dx*.43,-dz*.43,.25);toast('⚠ ГРАВИТАЦИОННАЯ ВОРОНКА',1)}
if(variant===0&&d>2&&Math.floor(phase/7)!==Math.floor((phase-dt)/7)){enemyMove(e,dx*1.8,dz*1.8,e.radius*.45)}
}
let summonEvery=variant===2?4.2:variant===7?4.5:variant===4?9.3:7.5;
if(phase>summonEvery&&Math.floor(phase/summonEvery)!==Math.floor((phase-dt)/summonEvery)&&g.enemies.filter(z=>!z.dead&&!z.boss).length<6){spawnEnemy(variant===2?'medic':pick(['scout','charger','shooter']),false);if(variant===2||variant===7)spawnEnemy('scout',false)}
if((d>3.5||!enemyDirectRoute(e,p))&&e.stun<=0)enemyMove(e,dx*e.speed*dt,dz*e.speed*dt,e.radius*.5);else if(d<2&&e.stun<=0)enemyMove(e,-dx*.55*dt,-dz*.55*dt,e.radius*.5);// Ranged fire and physical melee use separate cooldowns. Previously
 // e.attack was reset by each projectile volley, suppressing boss melee.
 e.meleeTimer=Math.max(0,(e.meleeTimer||0)-dt);
 if(d<1.35&&e.meleeTimer<=0&&e.stun<=0&&enemyMeleeReach(e,p)){
  damagePlayer(e.damage*.72);e.meleeTimer=1.65;e.attackPulse=Math.max(e.attackPulse||0,.24);
 }
 continue}
if(e.airborne){updateFlyingRobot(e,p,dt);continue;}
if(e.type==='medic'){if(e.trail>.75){e.trail=0;for(let f of g.enemies)if(!f.dead&&f!==e&&distance(e,f)<4&&enemyCombatClear(e,f,1.1,1.1))f.hp=Math.min(f.maxhp,f.hp+9)}}if(e.stun>0)continue;let chase=e.type==='scout'||e.type==='brute'||e.type==='charger'||e.type==='raider',stopDist=chase?1.1:e.type==='sniper'?8:5;if(d>stopDist||(!chase&&!enemyDirectRoute(e,p))){let mul=chase&&e.type==='charger'&&e.attack<.4?1.9:e.type==='raider'&&e.attack<.40?1.7:1;enemyMove(e,dx*e.speed*dt*mul,dz*e.speed*dt*mul,e.radius*.45)}else if(d<2.5&&!chase){enemyMove(e,-dx*e.speed*dt*.7,-dz*e.speed*dt*.7,e.radius*.45)}else if(!chase&&d<e.range&&d>3&&enemyDirectRoute(e,p)){enemyMove(e,-dz*e.orbit*e.speed*dt*.31,dx*e.orbit*e.speed*dt*.31,e.radius*.45)}if(e.attack<=0){if(chase&&d<1.55&&enemyMeleeReach(e,p)){damagePlayer(e.damage);e.attack=.75+(e.type==='brute'?.42:0)}else if(!chase&&d<e.range&&enemyDirectRoute(e,p)&&enemyCombatClear(e,p,1.25,1.05)){if(e.type==='sniper'){
  e.telegraph=.86;e.lockTarget={x:p.x,z:p.z,feetY:p.feetY||0};e.attack=2.9;
 }else{enemyFire(e,e.type==='artillery'?6:0);e.attack=e.type==='artillery'?3.15:e.type==='warden'?1.95:1.7}}else{e.attack=.26}}}
g.enemies=g.enemies.filter(x=>!x.dead);if(g.portalReady)return;if(g.spawned>=g.target&&g.enemies.length===0&&g.target>0)maybeFinishMission(g)}
// Robot animation rig V: movements are driven by measured locomotion rather
// than simply advancing the clock. Turn angular momentum, braking and strafing
// each have their own low-pass signals. All fields are serializable in saves.
const updateEnemiesBeforeRobotRig=updateEnemies;
updateEnemies=function(dt){
 const g=game;if(!g)return;
 const start=new Map();
 for(const e of g.enemies)if(!e.dead)start.set(e.id,[e.x,e.z]);
 updateEnemiesBeforeRobotRig(dt);
 const safeDt=Math.max(.001,Math.min(.045,dt));
 for(const e of g.enemies){
  if(e.dead)continue;
  const kind=e.boss?'boss':e.airborne?'drone':e.type,profile=robotAnimationProfile(kind);
  const from=start.get(e.id);
  const vx=from?(e.x-from[0])/safeDt:0,vz=from?(e.z-from[1])/safeDt:0;
  const speed=Math.hypot(vx,vz),prev=Number(e.robotMotion)||0;
  const motionTarget=clamp(speed/(e.boss?1.1:1.3),0,1);
  e.robotMotion=clamp(prev+(motionTarget-prev)*Math.min(1,safeDt*(motionTarget>prev?8:5)),0,1);
  if(!Number.isFinite(e.robotCycle))e.robotCycle=(e.id||0)*.67;
  // Step phase advances by traveled distance. If robot stops, feet stop.
  e.robotCycle+=speed*safeDt*profile.gait*.78;
  const desired=Math.atan2(g.p.x-e.x,g.p.z-e.z);
  if(!Number.isFinite(e.robotYaw))e.robotYaw=desired;
  if(!Number.isFinite(e.robotEyeYaw))e.robotEyeYaw=desired;
  const oldYaw=e.robotYaw;
  // Body can only turn a limited number of radians per second.
  const remaining=robotWrapAngle(desired-e.robotYaw);
  e.robotYaw+=clamp(remaining,-safeDt*profile.turn,safeDt*profile.turn);
  const yawDelta=robotWrapAngle(e.robotYaw-oldYaw)/safeDt;
  e.robotTurn=clamp((Number(e.robotTurn)||0)*.79+yawDelta*.21,-4.5,4.5);
  // Smaller optical modules acquire target faster than the armored chassis.
  e.robotEyeYaw=robotApproachAngle(e.robotEyeYaw,desired,Math.min(1,safeDt*9));
  const forward=vx*Math.sin(e.robotYaw)+vz*Math.cos(e.robotYaw);
  const lateral=vx*Math.cos(e.robotYaw)-vz*Math.sin(e.robotYaw);
  const sideTarget=clamp(lateral/Math.max(.7,speed),-1,1)*(speed>.025?1:0);
  e.robotStrafe=(Number(e.robotStrafe)||0)*Math.max(0,1-safeDt*6)+sideTarget*Math.min(1,safeDt*6);
  e.robotReverse=(Number(e.robotReverse)||0)*Math.max(0,1-safeDt*7)+(forward<-.06?1:0)*Math.min(1,safeDt*7);
  const accelerating=(motionTarget-prev)/safeDt;
  e.robotInertia=clamp((Number(e.robotInertia)||0)*Math.exp(-safeDt*8)+accelerating*safeDt*.14,-.3,.3);
  e.robotLean=clamp((-e.robotTurn*profile.lean+e.robotStrafe*profile.lean*.72)*e.robotMotion,-.24,.24);
  e.hitReact=Math.max(0,(Number(e.hitReact)||0)-safeDt);
  e.attackPulse=Math.max(0,(Number(e.attackPulse)||0)-safeDt);
  e.robotAttackState=clamp((Number(e.robotAttackState)||0)*Math.exp(-safeDt*8)+((e.telegraph||0)>0?.15:0),0,1);
  e.robotDamageHeat=Math.max(0,(Number(e.robotDamageHeat)||0)-safeDt*.5);
  // No per-frame costly meshes. On heavily damaged nearby enemies only, rare sparks.
  if(e.hp<e.maxhp*.38 && speed>=0 && Math.abs(e.x-g.p.x)+Math.abs(e.z-g.p.z)<12){
   e.robotSparkClock=(Number(e.robotSparkClock)||0)-safeDt;
   if(e.robotSparkClock<=0){
    e.robotSparkClock=.38+Math.random()*.48;
    if(g.particles.length<115){
     const angle=(Number(e.robotYaw)||0),r=e.boss?1.3:.55;
     const px=e.x+Math.sin(angle)*r*.5,pz=e.z+Math.cos(angle)*r*.5;
     const life=rand(.15,.35);
     g.particles.push({x:px,y:(Number(e.feetY)||0)+(e.boss?2.25:1.32),z:pz,vx:rand(-.5,.5),vy:rand(.6,1.8),vz:rand(-.5,.5),life,maxLife:life,col:[1,.44,.13]});
    }
   }
  }
 }
};

function updateBullets(dt){
 let g=game,p=g.p;
 for(const b of g.bullets){
  if(b.dead)continue;
  const o=v3(b.x,b.y,b.z),delta=v3(b.vx*dt,b.vy*dt,b.vz*dt);
  const length=Math.hypot(delta.x,delta.y,delta.z);
  if(length>1e-8){
   const d=v3(delta.x/length,delta.y/length,delta.z/length);
   const solid=sweepWorldSphere(o,d,length,b.radius||0);
   // A standing player's torso is an ellipsoid, with a true segment hit.
   const body=rayEllipsoid(o,d,v3(p.x,(p.feetY||0)+1.03,p.z),.42+b.radius,.89+b.radius,.42+b.radius,length);
   if(body!==null&&(!solid||body<solid.t)){
    b.x=o.x+d.x*body;b.y=o.y+d.y*body;b.z=o.z+d.z*body;
    damagePlayer(b.damage);b.dead=true;burst(b.x,b.y,b.z,b.col,7);
   }else if(solid){
    b.x=solid.x;b.y=solid.y;b.z=solid.z;b.dead=true;burst(b.x,b.y,b.z,b.col,4);
   }else{b.x+=delta.x;b.y+=delta.y;b.z+=delta.z;}
  }
  b.life-=dt;
 }
 g.bullets=g.bullets.filter(b=>!b.dead&&b.life>0);
 for(const e of g.loot){
  e.life-=dt;
  if(distance(e,p)>=1.0+p.magnet)continue;
  e.life=0;
  if(e.type==='heal')p.hp=Math.min(p.maxhp,p.hp+23);
  if(e.type==='energy')p.energy=Math.min(p.maxEnergy,p.energy+29);
  if(e.type==='plates'){
   p.armor=Math.min(p.maxArmor,p.armor+22);
   p.bodyArmor=Math.min(p.bodyArmorMax||0,(p.bodyArmor||0)+(p.bodyArmorMax||0)*.06);
   toast('БРОНЕПЛАСТИНЫ · БАРЬЕР + РЕМОНТ КОСТЮМА',1.2);
  }
  if(e.type==='credits'){save.credits+=8+Math.ceil(g.sector*.5);g.totalCredits+=8+Math.ceil(g.sector*.5);}
  sound(560,.08,'sine',.07);
 }
 g.loot=g.loot.filter(x=>x.life>0);
 for(const b of g.particles){b.life-=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;b.vy-=dt*2;}
 g.particles=g.particles.filter(b=>b.life>0);
 for(const t of (g.tracers||[]))t.life-=dt;
 g.tracers=(g.tracers||[]).filter(t=>t.life>0);
 for(const a of(g.scorch||[]))a.life-=dt;
 g.scorch=(g.scorch||[]).filter(a=>a.life>0);
 if(g.particles.length>140)g.particles.splice(0,g.particles.length-140);
}

let arsenalOpened=false;
function closeArsenal(){arsenalOpened=false;const el=$('weaponDrawer');el.classList.remove('open');el.replaceChildren();}
function toggleArsenal(){
 if(!game||game.state!=='playing')return;
 if(arsenalOpened){closeArsenal();return;}
 const el=$('weaponDrawer');
 el.innerHTML=`<div class="arsenalTop"><span>⟡ ВЫБЕРИ ОРУЖИЕ</span><button id="arsenalClose" aria-label="Закрыть выбор оружия">✕</button></div><div class="arsenalGrid">${weapons.map((w,i)=>`<button class="arsenalChoice ${game.p.weapon===i?'current':''}" data-wpn="${i}"><b>${w.icon}</b><span>${i+1}. ${w.short}</span></button>`).join('')}</div>`;
 el.classList.add('open');arsenalOpened=true;
 el.querySelector('#arsenalClose').onclick=closeArsenal;
 el.querySelectorAll('[data-wpn]').forEach(b=>b.onclick=()=>{switchWeapon(Number(b.dataset.wpn));closeArsenal()});
}
const input={keys:{},mx:0,mz:0,fire:false,jumpQueued:false,jumpHeld:false,flyUp:false,flyDown:false,lastSpaceAt:-Infinity,looking:false,pid:null,px:0,py:0,joyId:null,tapX:0,tapY:0,tapAt:0,tapMoved:false,sprint:false,mobileSprint:false,lastWAt:-Infinity};function key(k){return input.keys[k]||false}
const SPRINT_ENERGY_DRAIN=1.8;
function maxDashRange(p=game?.p){
 const permanent=DASH_DISTANCE_BASE+(Number(save.perms?.[5])||0)*DASH_UPGRADE_STEP;
 return Number(Math.min(DASH_DISTANCE_MAX,Math.max(DASH_DISTANCE_BASE,Number(p?.dashRange)||permanent)).toFixed(2));
}
function selectedDashRange(p=game?.p){
 const max=maxDashRange(p),choice=normalizeDashDistanceSetting(save.settings.dashDistance);
 return choice===null?max:Math.min(max,choice);
}
function dashDistancePercent(value=selectedDashRange(),max=maxDashRange()){
 return Number((100*(value-DASH_DISTANCE_MIN)/(max-DASH_DISTANCE_MIN)).toFixed(1));
}
function setDashRange(raw,commit=true,flash=false){
 if(!game||!['playing','paused'].includes(game.state))return null;
 const max=maxDashRange(game.p);
 const choice=normalizeDashDistanceSetting(raw);
 const selected=choice===null?max:Number(Math.min(choice,max).toFixed(2));
 save.settings.dashDistance=selected;
 if(commit)persist();
 if(flash)showDashRangeHud();
 return selected;
}
function showDashRangeHud(){
 if(typeof touchOnly!=='undefined'&&touchOnly)return;
 const hud=$('dashRangeHud');if(!hud)return;
 const selected=selectedDashRange(),max=maxDashRange();
 const display=n=>n.toFixed(2).replace('.',',');
 $('dashRangeLabel').textContent=display(selected)+' / '+display(max)+' м';
 $('dashRangeFill').style.height=dashDistancePercent(selected,max)+'%';
 hud.classList.add('visible');
 clearTimeout(showDashRangeHud.tm);
 showDashRangeHud.tm=setTimeout(()=>hud.classList.remove('visible'),1800);
}
function stepDashRange(direction){
 if(!game||game.state!=='playing'||(typeof touchOnly!=='undefined'&&touchOnly))return null;
 return setDashRange(selectedDashRange()+Math.sign(direction)*DASH_DISTANCE_STEP,true,true);
}
function updateDashDistanceWhileHeld(){
 // Browser keyboard auto-repeat can stop while WASD, shooting or sprint
 // keys are also held. Sample the physical key state on every game frame.
 if(typeof touchOnly!=='undefined'&&touchOnly||key('AltLeft')||key('AltRight'))return;
 const up=key('ArrowUp'),down=key('ArrowDown');
 if(up===down)return;
 const now=performance.now();
 if(now-lastDashRangeArrowAt>=170){
  stepDashRange(up?1:-1);
  lastDashRangeArrowAt=now;
 }
}
function sprintMotionState(p,moving,dt,regenApplied=0){
 if(!moving||!(input.sprint||input.mobileSprint&&input.mz>.2))return false;
 if(p.sprintTired){if(p.energy<8)return false;p.sprintTired=false;}
 if(p.energy<=.3){p.sprintTired=true;return false;}
 // The ordinary regeneration was applied earlier in this frame. Remove only
 // the amount ACTUALLY recovered, including when the tank was almost full.
 p.energy=Math.max(0,p.energy-regenApplied-SPRINT_ENERGY_DRAIN*dt);
 if(p.energy<=.3)p.sprintTired=true;
 return true;
}
function update(dt){const g=game,p=g.p;if(g.state!=='playing'||arsenalOpened)return;updateDashDistanceWhileHeld();g.t+=dt;g.sectorTime+=dt;navClock-=dt;if(navClock<=0)rebuildNavigation();p.walk=0;p.cooldown=Math.max(-dt,p.cooldown-dt);p.heatLock=Math.max(0,p.heatLock-dt);p.heat=Math.max(0,p.heat-dt*(p.heatLock>0?22:25));p.recoil=Math.max(0,p.recoil-dt*4);p.shotGlow=Math.max(0,(p.shotGlow||0)-dt);p.equipAnim=Math.max(0,(p.equipAnim||0)-dt*2.2);p.iframes=Math.max(0,p.iframes-dt);p.shield=Math.max(0,p.shield-dt);for(const cd of Object.keys(p.abilityCooldowns||{}))p.abilityCooldowns[cd]=Math.max(0,p.abilityCooldowns[cd]-dt);const energyBeforeRegen=p.energy;p.energy=Math.min(p.maxEnergy,p.energy+p.regen*dt);const regenApplied=p.energy-energyBeforeRegen;p.hp=Math.min(p.maxhp,p.hp+p.healRegen*dt);p.armorDelay=Math.max(0,(p.armorDelay||0)-dt);if(p.armorDelay<=0&&p.armor<p.maxArmor&&p.energy>12){const a=Math.min(p.maxArmor-p.armor,(p.armorRegen||2.6)*dt);p.armor+=a;p.energy=Math.max(0,p.energy-a*.5);}if(g.combo>0&&g.t-g.comboAt>5)g.combo=0;
if(key('ArrowLeft'))p.yaw+=dt*1.95;if(key('ArrowRight'))p.yaw-=dt*1.95;
// Plain ↑/↓ now choose teleport distance. Alt+↑/↓ keeps accessible camera
// pitch controls for players who cannot use a mouse (touch uses swipe).
const pitchArrows=(typeof touchOnly!=='undefined'&&touchOnly)||key('AltLeft')||key('AltRight');
if(pitchArrows&&key('ArrowUp'))p.pitch=clamp(p.pitch+dt*.95,-1.0,1.0);
if(pitchArrows&&key('ArrowDown'))p.pitch=clamp(p.pitch-dt*.95,-1,1);
let mx=(key('KeyD')?1:0)-(key('KeyA')?1:0),mz=(key('KeyW')?1:0)-(key('KeyS')?1:0);mx+=input.mx;mz+=input.mz;let mag=hypot(mx,mz);if(mag>1){mx/=mag;mz/=mag}const sprinting=sprintMotionState(p,mag>0,dt,regenApplied);if(mag){const flightScale=p.flying?flightSpeedMultiplier('horizontal')*normalizeFlightThrottle(save.settings.flightHorizontal):1;let dx=(Math.sin(p.yaw)*mz-Math.cos(p.yaw)*mx)*p.speed*flightScale*(sprinting?1.48:1)*dt;let dz=(Math.cos(p.yaw)*mz+Math.sin(p.yaw)*mx)*p.speed*flightScale*(sprinting?1.48:1)*dt;moveEntity(p,dx,dz);p.walk=1}updateVertical(p,dt);if(input.fire)shoot();spawnWave(dt);updateEnemies(dt);updateRobotDebris(dt);updatePlayerOrdnance(dt);updateBullets(dt);updateDevices(dt);updateMission(dt);if(g.portalReady&&distance(p,portal)<1.18){portalNext()}}
function portalNext(){
 const g=game;if(!g||g.state!=='playing')return;
 recordLevelCompleted(g);
 g.state=g.sector>=CAMPAIGN_MAX_LEVEL?'victory':'upgrade';
 save.best=Math.max(save.best,save.campaign.highestUnlocked);
 save.credits+=10+g.sector*2;
 if(document.pointerLockElement)document.exitPointerLock();
 if(g.state==='victory'){
  save.checkpoint=null;persist();showFinalVictory();return;
 }
 showUpgrade();
}
function recordLevelCompleted(g){
 const level=clamp(Math.floor(g.sector),1,CAMPAIGN_MAX_LEVEL);
 const progress=save.campaign;
 const rec=progress.records[level]||{};
 const firstWin=!(Number(rec.wins)>0)&&level>progress.completedThrough;
 progress.completedThrough=Math.max(progress.completedThrough,level);
 progress.highestUnlocked=Math.max(progress.highestUnlocked,Math.min(CAMPAIGN_MAX_LEVEL,level+1));
 if(Math.floor((progress.highestUnlocked-1)/CAMPAIGN_CHAPTER_SIZE)>campaignPage)campaignPage=Math.floor((progress.highestUnlocked-1)/CAMPAIGN_CHAPTER_SIZE);
 progress.latestCompleted=level;
 progress.totalVictories+=1;
 const score=Math.max(0,Math.floor(Number(g.score)||0));
 const time=Math.max(0,Number(g.sectorTime)||0);
 const hp=Math.max(0,Number(g.p.hp)||0);
 const medal=hp>=g.p.maxhp*.8?'gold':hp>=g.p.maxhp*.4?'silver':'bronze';
 const rank={bronze:1,silver:2,gold:3};
 const medals=rank[medal]>rank[rec.medal||'bronze']?medal:(rec.medal||medal);
 const missionRating=missionStars(g);if(g.mission)save.credits+=4+missionRating*4;
 progress.records[level]={...rec,missionType:g.mission?.type||'purge',bestStars:Math.max(Number(rec.bestStars)||0,missionRating),wins:(Number(rec.wins)||0)+1,bestScore:Math.max(Number(rec.bestScore)||0,score),
   bestTime:rec.bestTime==null?time:Math.min(rec.bestTime,time),medal:medals,lastClearedAt:Date.now()};
 // The later 99%+ armor tiers must be economically reachable without
 // endlessly farming early levels. First-clear bonuses scale by chapter.
 if(firstWin)save.credits+=15+Math.floor(level*1.5)+Math.round(level*20+level*level*.25);
 persist();
}

function toast(txt,time=1.5){const x=$('toast');x.textContent=txt;x.classList.add('show');clearTimeout(toast.id);toast.id=setTimeout(()=>x.classList.remove('show'),time*1000)}
function portalFlow(){
  if(portalRouteField&&portalRouteField.size===mapSize&&portalRouteField.x===Math.floor(portal.x)&&portalRouteField.z===Math.floor(portal.z))return portalRouteField.dist;
  const sz=mapSize,arr=new Int16Array(sz*sz);arr.fill(32767);
  const q=new Int16Array(sz*sz),px=Math.floor(portal.x),pz=Math.floor(portal.z);
  let head=0,tail=0;q[tail++]=pz*sz+px;arr[pz*sz+px]=0;
  while(head<tail){const cell=q[head++],x=cell%sz,z=(cell/sz)|0;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,nz=z+dz,k=nz*sz+nx;
      if(nx<1||nz<1||nx>=sz-1||nz>=sz-1||mapCells[nz][nx]!==0||arr[k]!==32767)continue;
      arr[k]=arr[cell]+1;q[tail++]=k;
    }
  }
  portalRouteField={size:sz,x:px,z:pz,dist:arr};return arr;
}
function portalRoute(p,limit=200){
  if(!game?.portalReady)return[];
  const d=portalFlow(),sz=mapSize,route=[{x:p.x,z:p.z}];
  let x=Math.floor(p.x),z=Math.floor(p.z),cost=d[z*sz+x];
  for(let i=0;i<limit&&cost>0&&cost<32767;i++){
    let bx=x,bz=z,bc=cost;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=sz||nz>=sz)continue;
      const c=d[nz*sz+nx];if(c<bc){bc=c;bx=nx;bz=nz;}
    }
    if(bc===cost)break;
    x=bx;z=bz;cost=bc;route.push({x:x+.5,z:z+.5});
  }
  return route;
}
function navArrow(p,target){let angle=Math.atan2(target.x-p.x,target.z-p.z)-p.yaw;let i=((Math.round(angle*4/Math.PI)%8)+8)%8;return ['↑','↗','→','↘','↓','↙','←','↖'][i]}
function updateHud(force=false){const g=game;if(!g||g.state!=='playing')return;const p=g.p;for(const [ability,id] of [['dash','dashTouch'],['pulse','pulseTouch'],['shield','shieldTouch'],['heal','healTouch']]){const btn=$(id);if(!btn)continue;const left=p.abilityCooldowns?.[ability]||0,active=ability==='shield'&&(p.shield||0)>.01;btn.dataset.cooldown=active?'АКТИВНА':left>.1?Math.ceil(left)+'с':'';btn.classList.toggle('recharging',left>.1&&!active);btn.classList.toggle('abilityActive',active);}$('hpFill').style.width=(p.hp/p.maxhp*100)+'%';$('energyFill').style.width=(p.energy/p.maxEnergy*100)+'%';$('armorFill').style.width=(p.maxArmor?p.armor/p.maxArmor*100:0)+'%';$('hpLabel').textContent=Math.ceil(p.hp)+'/'+Math.ceil(p.maxhp);$('energyLabel').textContent=Math.ceil(p.energy)+'/'+Math.ceil(p.maxEnergy);$('armorLabel').textContent=Math.round(p.armor)+'/'+Math.round(p.maxArmor)+(p.armorDelay>0?' ⌛':p.armor<p.maxArmor?' ↻':'');
 $('bodyArmorFill').style.width=(p.bodyArmorMax>0?p.bodyArmor/p.bodyArmorMax*100:0)+'%';
 $('bodyArmorLabel').textContent=p.bodyArmorMax>0?Math.ceil(p.bodyArmor)+'/'+Math.ceil(p.bodyArmorMax):'НЕТ';$('altimeter').textContent=p.flying?'✈ ПОЛЁТ · '+(p.feetY||0).toFixed(1)+' м':(p.feetY||0)>.15?'⤒ '+(p.feetY||0).toFixed(1)+' м':'';$('weaponName').textContent=weapons[p.weapon].icon+' '+weapons[p.weapon].short;$('weaponStats').textContent='НАГРЕВ '+Math.round(p.heat)+'% · '+(p.weapon+1)+'/'+weapons.length;$('killText').textContent='УНИЧТОЖЕНО '+g.kills+' · '+g.spawned+'/'+g.target;$('scoreText').textContent='ОЧКИ '+g.score.toLocaleString('ru');$('combo').textContent=g.combo>2?'КОМБО ×'+g.combo:'';const goal=g.portalReady?portal:(g.boss&&!g.boss.dead?g.boss:null);$('zoneText').textContent=sectorArchitecture+' · УЗЛЫ '+(g.nodes.length-g.nodesDestroyed)+'/'+g.nodes.length;const nearDevice=(g.devices||[]).filter(d=>!d.used).sort((a,b)=>distance(a,p)-distance(b,p))[0];
 const devHelp=$('deviceHint');if(devHelp){
  const close=nearDevice&&distance(nearDevice,p)<3.15;
  devHelp.textContent=close?(nearDevice.kind==='relay'?'⌁ РЕТРАНСЛЯТОР':nearDevice.kind==='coil'?'⚠ РАЗРЯДНИК':nearDevice.kind==='repair'?'✚ РЕМОНТНАЯ СТАНЦИЯ':'ϟ ЭНЕРГОСТАНЦИЯ')+' · '+(nearDevice.kind==='coil'?'подойди и удерживайся рядом':'подойди для активации')+(nearDevice.charge>0?' · '+Math.round(nearDevice.charge*100)+'%':''):'';
  devHelp.style.display=close?'block':'none';
 }
 const mi=g.mission,missionBox=$('missionHUD');if(missionBox&&mi){const def=MISSION_TYPES[mi.type]||MISSION_TYPES.purge;missionBox.innerHTML='<b>'+def.icon+' '+def.name+(g.portalReady?' · ✓':'')+'</b><span>'+missionCounter(g)+'</span><small>'+ (g.portalReady?'Портал открыт · следуй по маршруту':def.hint)+'</small>';}
 const from=v3(p.x,1.47+(p.feetY||0),p.z),aim=aimFromOperator(from);
 const wall=rayWall(from,aim,24),node=rayNode(from,aim,wall?wall.t:24);
 const label=$('eventLabel');const foe=node?null:rayEnemy(from,aim,wall?wall.t:24);
 if(node){label.textContent='◇ '+NODE_TYPES[node.node.type].name+' · '+Math.ceil(Math.max(0,node.node.hp))+' HP';label.style.opacity='.92';label.style.color=['#ffd0a0','#a1f1ff','#bbffcb'][node.node.type]}
 else if(foe){const e=foe.enemy;label.textContent='◈ '+(e.boss?'БОСС ':e.type.toUpperCase())+' · КОРПУС '+Math.ceil(Math.max(0,e.hp))+(e.maxProtection>0?' · ЗАЩИТА '+Math.ceil(Math.max(0,e.protection||0))+'/'+e.maxProtection:'');label.style.opacity='.92';label.style.color='#ffc886';}
 else label.style.opacity='0';
 const route=g.portalReady?portalRoute(p,4):[];const next=route[1]||portal;const walk=g.portalReady?portalFlow()[Math.floor(p.z)*mapSize+Math.floor(p.x)]:0;const waypoint=!g.portalReady?missionWaypoint(g):null;const missionWalk=waypoint?missionRouteTo(p,waypoint,5):[];const nextMission=missionWalk[1]||waypoint;const missionDist=waypoint?missionField(waypoint)[Math.floor(p.z)*mapSize+Math.floor(p.x)]:0;$('navSignal').textContent=g.portalReady?'◇ МАРШРУТ '+navArrow(p,next)+' · '+(walk<32767?walk:Math.round(distance(p,portal)))+' м':waypoint?'◆ ЦЕЛЬ '+navArrow(p,nextMission)+' · '+(missionDist<32767?missionDist:Math.round(distance(p,waypoint)))+' м':goal?'☠ БОСС · '+Math.round(distance(p,goal))+' м':'◈ '+sectorArchitecture+' · '+mapSize+'×'+mapSize;$('reticleShield').style.opacity=p.shield>0?.82:0;if(g.boss)$('bossFill').style.width=clamp(g.boss.hp/g.boss.maxhp*100,0,100)+'%';drawMinimap();}

function drawMinimap(){
  const m=mm,w=m.canvas.width,h=m.canvas.height,g=game;if(!g)return;
  m.clearRect(0,0,w,h);m.fillStyle='#040c19';m.fillRect(0,0,w,h);
  const visible=miniZoom?Math.min(mapSize,25):mapSize;
  const x0=miniZoom?clamp(g.p.x-visible/2,0,mapSize-visible):0;
  const z0=miniZoom?clamp(g.p.z-visible/2,0,mapSize-visible):0;
  const scale=w/visible;
  for(let iz=0;iz<=visible;iz++)for(let ix=0;ix<=visible;ix++){
    let x=Math.floor(x0+ix),z=Math.floor(z0+iz);
    if(x>=mapSize||z>=mapSize)continue;
    const elevated=floorHeightAtCell(x,z),upper=deckAtCell(x,z);m.fillStyle=mapCells[z][x]?'#1a293b':upper>0?'#a0b5aa':elevated>1.1?'#726e62':elevated>.65?'#58666b':elevated>.22?'#314858':((x+z)%2?'#0d293d':'#143850');
    m.fillRect((x-x0)*scale,(z-z0)*scale,scale+.15,scale+.15);
  }
  m.save();m.beginPath();m.rect(0,0,w,h);m.clip();
  const plot=(x,z)=>[(x-x0)*scale,(z-z0)*scale];
  if(g.portalReady){
    const path=portalRoute(g.p,Math.ceil(mapSize*mapSize*.75));
    if(path.length>1){
      m.beginPath();path.forEach((q,i)=>{const [xx,zz]=plot(q.x,q.z);if(i===0)m.moveTo(xx,zz);else m.lineTo(xx,zz)});
      m.strokeStyle='#6afde6df';m.lineWidth=miniZoom?2.8:1.7;m.setLineDash([4,3]);m.stroke();m.setLineDash([]);
    }
  }
  // Stair access markers: entrances to the second floor are always visible.
  for(const b of bridgeSpecs){
    for(const side of [-1,1]){
      const [px,pz]=plot(b.x+side*13,b.z);
      if(px>=-6&&pz>=-6&&px<w+6&&pz<h+6){
        m.fillStyle='#ffc97d';m.beginPath();m.arc(px,pz,miniZoom?3.3:2.2,0,TAU);m.fill();
        m.strokeStyle='#ffe5a9';m.lineWidth=1;m.stroke();
      }
    }
  }
  for(const f of mapFeatures){let [x,z]=plot(f.x,f.z);if(x<-3||x>w+3||z<-3||z>h+3)continue;
    m.strokeStyle='#44f6e388';m.lineWidth=miniZoom?1.3:.95;m.beginPath();m.arc(x,z,miniZoom?3:2,0,TAU);m.stroke();
  }
  if(!g.portalReady){const wp=missionWaypoint(g),route=wp?missionRouteTo(g.p,wp,Math.ceil(mapSize*mapSize*.75)):[];
   if(route.length>1){m.beginPath();route.forEach((pt,i)=>{const [xx,zz]=plot(pt.x,pt.z);if(i)m.lineTo(xx,zz);else m.moveTo(xx,zz);});m.strokeStyle='#f8e07cca';m.lineWidth=miniZoom?2.4:1.4;m.setLineDash([3,4]);m.stroke();m.setLineDash([]);}
  }
  if(g.mission?.type==='recovery')for(const c of g.mission.caches)if(!c.got){const [x,z]=plot(c.x,c.z);m.fillStyle='#e5f8ff';m.shadowColor='#38dcff';m.shadowBlur=9;m.beginPath();m.moveTo(x,z-4.7);m.lineTo(x+4.7,z);m.lineTo(x,z+4.7);m.lineTo(x-4.7,z);m.closePath();m.fill();m.shadowBlur=0;}
  if(g.arenaEvent?.phase==='warning'){const a=g.arenaEvent;const [x,z]=plot(a.x,a.z);m.strokeStyle=a.kind==='thermal'?'#ff844f':'#73e5ff';m.lineWidth=2;m.beginPath();m.arc(x,z,a.r*scale,0,TAU);m.stroke();}
  for(const d of (g.devices||[]))if(!d.used){
    const [dx,dz]=plot(d.x,d.z),color=d.kind==='coil'?'#ff7257':d.kind==='relay'?'#ffe08c':d.kind==='repair'?'#71f7ad':'#78dfff';
    m.save();m.fillStyle=color;m.shadowColor=color;m.shadowBlur=miniZoom?6:3;
    m.fillRect(dx-(miniZoom?3:2),dz-(miniZoom?3:2),miniZoom?6:4,miniZoom?6:4);m.restore();
  }
  for(const n of g.nodes)if(!n.dead){const [x,z]=plot(n.x,n.z);m.fillStyle=['#ff873f','#65deff','#77ff94'][n.type];m.fillRect(x-2.4,z-2.4,4.8,4.8);}if(g.portalReady){const [x,z]=plot(portal.x,portal.z);m.shadowBlur=10;m.shadowColor='#7affef';m.fillStyle='#76ffed';m.beginPath();m.arc(x,z,miniZoom?5:3,0,TAU);m.fill();m.shadowBlur=0;}
  for(const e of g.enemies){if(e.dead)continue;const [x,z]=plot(e.x,e.z);m.fillStyle=e.boss?'#ffcf7a':e.airborne?'#73ebff':'#ff6c96';m.beginPath();m.arc(x,z,e.boss?5:e.airborne?2.8:2.1,0,TAU);m.fill();
    if(e.airborne&&e.feetY>(g.p.feetY||0)+2){m.strokeStyle='#b5fcff';m.lineWidth=1.2;m.beginPath();m.arc(x,z,miniZoom?5.0:3.9,0,TAU);m.stroke();}
    if(e.boss&&e.ultWarn>0){m.strokeStyle='#ff8748';m.lineWidth=2;m.beginPath();m.arc(x,z,5.15*scale,0,TAU);m.stroke();}
  }
  const [x,z]=plot(g.p.x,g.p.z);
  m.save();m.translate(x,z);/* Canvas map uses +Z downward while the arrow is drawn pointing upward.
     Rotate by PI-yaw so the arrow points along the actual forward velocity:
     (sin(yaw),cos(yaw)) in map coordinates. */m.rotate(Math.PI-g.p.yaw);m.fillStyle='#eaffff';m.shadowColor='#a9ffff';m.shadowBlur=7;
  m.beginPath();m.moveTo(0,-6);m.lineTo(4,5);m.lineTo(0,2);m.lineTo(-4,5);m.closePath();m.fill();m.restore();m.restore();
  m.fillStyle='#c8f2fa';m.font='bold 13px system-ui';m.textAlign='left';m.fillText(miniZoom?'◈ РАДАР':'◈ ВЕСЬ СЕКТОР',7,15);
  $('radarLabel').textContent=(miniZoom?'КАРТА: ПРИБЛИЖЕНИЕ':'КАРТА: ВЕСЬ СЕКТОР')+(deckHeight(g.p.x,g.p.z)>0&&g.p.feetY>BRIDGE_Y-.3?' · УРОВЕНЬ 2':' · УРОВЕНЬ 1');
}
// Across a 100-level continuous run, uncapped exponential perks can trivialize
// bosses (rapid fire, stacked shield duration). Caps keep a finite power curve;
// total available picks exceed 99, so the finale never runs out of choices.
const RUN_UPGRADE_CAPS={damage:4,health:12,rapid:4,capacitor:8,armor:10,
 pierce:5,cool:6,dash:5,magnet:6,lifesteal:6,shock:5,energyshield:3,
 bullet:6,repair:12,fieldarmor:5,crit:5,walk:4,regen:8,fieldkit:6,super:4};
function pickUpgrades(){
 const owned=game?.upgrades||{};
 const pool=upgrades.filter(x=>(Number(owned[x.id])||0)<(RUN_UPGRADE_CAPS[x.id]||5));
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 return pool.slice(0,3);
}
function saveRun(){
 const g=game;if(!g||g.state==='dead'||g.state==='victory')return false;
 const keys=['sectorTime','t','target','spawned','waveDelay','enemies','bullets','tracers','projectiles','burstQueue','loot','nodes','nodesDestroyed','portalReady','idCounter','combo','comboAt','helpTime','totalCredits','decals','scorch','mission','arenaEvent','devices','robotDebris'];
 const live={};for(const k of keys)live[k]=g[k];
 save.checkpoint={version:4,permanentFormula:'compound-v2',barrierFormula:'compound-v2',shieldRechargeModel:'after-duration-5s',mapSchema:(g.sector===legacyResumeSector?(legacyResumeDivisor===10?'v10':legacyResumeDivisor===12?'v12':legacyResumeDivisor===14?'v14':'v16'):'v18'),state:g.state==='upgrade'?'upgrade':'playing',sector:g.sector,player:{...g.p},permanentLevels:[...(g.appliedPerms||save.perms)],score:g.score,kills:g.kills,upgrades:{...g.upgrades},pendingUpgrade:g.pendingUpgrade||null,live};
 const ok=persist();if(!ok){saveNotice('⚠ БРАУЗЕР ЗАПРЕТИЛ СОХРАНЕНИЕ · ЭКСПОРТИРУЙ РЕЗЕРВНУЮ КОПИЮ');}return ok;
}
function restoreLiveCheckpoint(ck){
 if(!ck||ck.version<3||!ck.live)return;
 const g=game;for(const [k,v] of Object.entries(ck.live)){if(Object.prototype.hasOwnProperty.call(g,k))g[k]=v;}
 Object.assign(g.p,ck.player||{});
 // Persistent purchases are allowed in the hangar between two sectors. A
 // snapshot of the permanent ranks actually applied to the running player
 // prevents both the "new purchase had no effect" bug and double-applying it.
 const current=[...save.perms],previous=Array.isArray(ck.permanentLevels)&&ck.permanentLevels.length>=6?
  ck.permanentLevels.map((v,i)=>clamp(Math.floor(Number(v)||0),0,PERM_MAX_LEVEL)) : null;
 if(previous){
  const diff=i=>current[i]-previous[i],p=g.p;
  // Stage24 had additive upgrades, Stage25/26 used the original compound
  // rates, and Stage27 increases five of them. Decode the checkpoint's own
  // formula before applying the new formula and any newly purchased ranks.
  const oldBase=(base,mult,lv,linear,v1=mult)=>ck.permanentFormula==='compound-v2'?
   permanentStat(base,mult,lv):ck.permanentFormula==='compound-v1'?
   permanentStat(base,v1,lv):base*(1+linear*lv);
  const oldHp=oldBase(100,PERM_COMPOUND.health,previous[0],.12,1.05),newHp=permanentStat(100,PERM_COMPOUND.health,current[0]);
  const oldEnergy=oldBase(100,PERM_COMPOUND.capacity,previous[4],.08,1.035),newEnergy=permanentStat(100,PERM_COMPOUND.capacity,current[4]);
  // Barrier changed independently in Stage26, so keep a separate marker.
  const oldBarrier=ck.barrierFormula==='compound-v2'?
   permanentStat(30,PERM_COMPOUND.barrier,previous[2]):ck.barrierFormula==='compound-v1'?
   permanentStat(30,1.085,previous[2]):30+10*previous[2];
  const newBarrier=permanentStat(30,PERM_COMPOUND.barrier,current[2]);
  const hpIncrease=newHp-oldHp,barrierIncrease=newBarrier-oldBarrier,energyIncrease=newEnergy-oldEnergy;
  // Formula replacements keep the current fill percentage. Ranks genuinely
  // bought after the checkpoint grant their extra capacity at full charge.
  const remapPool=(value,oldMaximum,newMaximum,formulaDelta,rankDelta)=>{
   const fraction=clamp((Number(value)||0)/Math.max(1,Number(oldMaximum)||1),0,1);
   return clamp((Number(value)||0)+formulaDelta*fraction+Math.max(0,rankDelta),0,newMaximum);
  };
  const hpMax=Math.max(1,Number(p.maxhp)||oldHp),energyMax=Math.max(1,Number(p.maxEnergy)||oldEnergy);
  p.maxhp=Math.max(1,hpMax+hpIncrease);
  p.hp=remapPool(p.hp,hpMax,p.maxhp,permanentStat(100,PERM_COMPOUND.health,previous[0])-oldHp,
   newHp-permanentStat(100,PERM_COMPOUND.health,previous[0]));
  p.damage*= permanentStat(1,PERM_COMPOUND.damage,current[1])/oldBase(1,PERM_COMPOUND.damage,previous[1],.08,1.04);
  const savedMax=Math.max(1,Number(p.maxArmor)||30);
  p.maxArmor=Math.max(1,savedMax+barrierIncrease);
  const sameRankBarrier=permanentStat(30,PERM_COMPOUND.barrier,previous[2]);
  p.armor=remapPool(p.armor,savedMax,p.maxArmor,sameRankBarrier-oldBarrier,newBarrier-sameRankBarrier);
  p.armorTier=clamp((p.armorTier||0)+Math.floor(current[2]/2)-Math.floor(previous[2]/2),0,4);
  p.regen*= permanentStat(16,PERM_COMPOUND.regen,current[3])/oldBase(16,PERM_COMPOUND.regen,previous[3],.125,1.03);
  p.maxEnergy=Math.max(1,energyMax+energyIncrease);
  p.energy=remapPool(p.energy,energyMax,p.maxEnergy,
   permanentStat(100,PERM_COMPOUND.capacity,previous[4])-oldEnergy,
   newEnergy-permanentStat(100,PERM_COMPOUND.capacity,previous[4]));
  p.dashRange=Math.max(DASH_DISTANCE_BASE,p.dashRange+DASH_UPGRADE_STEP*diff(5));
  // Duration also carries temporary 25% perks. Rescale only the permanent
  // component, so purchases in the hangar apply exactly once on resume.
  p.shieldDuration=(Number(p.shieldDuration)||3.5)*permanentStat(1,PERM_COMPOUND.shieldDuration,current[11])/permanentStat(1,PERM_COMPOUND.shieldDuration,previous[11]||0);
 }else{
  // Pre-stage24 checkpoints lack a rank snapshot. Conservatively fill only
  // the missing minimum derived from the purchased ranks and acquired perks.
  const p=g.p,u=g.upgrades||{};
  const newHp=permanentStat(100,PERM_COMPOUND.health,current[0])+30*(u.health||0),newBarrier=permanentStat(30,PERM_COMPOUND.barrier,current[2])+30*(u.armor||0);
  const hpAdded=Math.max(0,newHp-p.maxhp),barrierAdded=Math.max(0,newBarrier-p.maxArmor);
  p.maxhp=Math.max(p.maxhp,newHp);p.hp=Math.min(p.maxhp,p.hp+hpAdded);
  p.maxArmor=Math.max(p.maxArmor,newBarrier);p.armor=Math.min(p.maxArmor,p.armor+barrierAdded);
  p.armorTier=Math.max(p.armorTier||0,Math.min(4,Math.floor(current[2]/2)+(u.armor||0)));
  p.damage=Math.max(p.damage,permanentStat(1,PERM_COMPOUND.damage,current[1])*Math.pow(1.18,u.damage||0)*Math.pow(1.12,u.super||0));
  p.shieldDuration=permanentStat(3.5,PERM_COMPOUND.shieldDuration,current[11])*Math.pow(1.25,u.energyshield||0);
 }
 g.appliedPerms=current;
 // Legacy four-perk saves have no permanent capacity/range fields. Restoring
 // a checkpoint must not undo purchases made in the hangar since that run.
 const permanentCapacity=permanentStat(100,PERM_COMPOUND.capacity,save.perms[4]);
 if(!Number.isFinite(g.p.maxEnergy)||g.p.maxEnergy<permanentCapacity){
  const oldCapacity=Number.isFinite(g.p.maxEnergy)?g.p.maxEnergy:100;
  g.p.maxEnergy=permanentCapacity;
  g.p.energy=Math.min(g.p.maxEnergy,Math.max(0,(Number(g.p.energy)||0)+permanentCapacity-oldCapacity));
 }
 g.p.dashRange=Math.max(DASH_DISTANCE_BASE+save.perms[5]*DASH_UPGRADE_STEP,Number(g.p.dashRange)||0);
 g.p.regen=Math.max(permanentStat(16,PERM_COMPOUND.regen,save.perms[3]),Number(g.p.regen)||0);
 g.p.weapon=clamp(g.p.weapon|0,0,weapons.length-1);
 if(!Number.isFinite(g.p.feetY))g.p.feetY=floorHeight(g.p.x,g.p.z);
 if(!Number.isFinite(g.p.vy))g.p.vy=0;
 if(typeof g.p.grounded!=='boolean')g.p.grounded=true;
 g.p.armor=clamp(Number(g.p.armor)||0,0,g.p.maxArmor||30);
 const suit=equippedArmorStats();
 g.p.bodyArmorType=suit.id;g.p.bodyArmorMax=suit.maxDurability;g.p.bodyArmorReduction=suit.reduction;g.p.bodyArmorWear=suit.wear;
 const oldSuit=Number(ck.player?.bodyArmorType),oldMax=Number(ck.player?.bodyArmorMax);
 // Equipping a *different* newly bought suit gives its fresh durability;
 // upgrading the same suit preserves damage but grants the extra capacity.
 g.p.bodyArmor=oldSuit!==suit.id?suit.maxDurability:
  Number.isFinite(ck.player?.bodyArmor)?clamp(ck.player.bodyArmor+Math.max(0,suit.maxDurability-(Number.isFinite(oldMax)?oldMax:suit.maxDurability)),0,suit.maxDurability):suit.maxDurability;
 if(!Number.isFinite(g.p.x)||!Number.isFinite(g.p.z)||collide(g.p.x,g.p.z,.23)){g.p.x=spawnX;g.p.z=spawnZ;}
 g.enemies=(g.enemies||[]).filter(e=>e&&!e.dead);
 // Stage 14 and older checkpoints predate physical airborne AI. Restore the
 // missing class flag without resetting combat HP, cooldowns or purchases.
 for(const e of g.enemies){
  if(!e.boss&&['drone','skyhunter','skyguard','stormray'].includes(e.type)){
   e.airborne=true;
   if(!Number.isFinite(e.feetY))e.feetY=floorHeight(e.x,e.z)+.13;
   // The previous floating animation placed drones 0.8 m above the floor;
   // beneath a bridge that can intersect the now-solid flying airframe.
   // Repair only a bad saved placement, preserving valid midair heights.
   if(worldSolidBodyCollision(e.x,e.z,enemyBodyRadius(e),e.feetY,enemyBodyHeight(e))){
    const lower=floorHeight(e.x,e.z)+.13;
    if(!worldSolidBodyCollision(e.x,e.z,enemyBodyRadius(e),lower,enemyBodyHeight(e)))
     e.feetY=lower;
   }
  }
 }
 g.boss=g.enemies.find(e=>e.boss)||null;
 g.p.abilityCooldowns=g.p.abilityCooldowns||{};
 // A Stage24 snapshot may carry the obsolete E/F and dash recharge timers.
 // Never reintroduce a cooldown after importing an old save.
 g.p.abilityCooldowns.dash=0;g.p.abilityCooldowns.heal=0;g.p.abilityCooldowns.pulse=0;
 if(ck.shieldRechargeModel!=='after-duration-5s'){
  // Old saved C timers began at activation and could exceed eight seconds.
  // Convert them to five seconds AFTER the remaining active sphere ends.
  const active=Math.max(0,Number(g.p.shield)||0);
  g.p.abilityCooldowns.shield=active>0?active+5:clamp(Number(g.p.abilityCooldowns.shield)||0,0,5);
 }else{
  g.p.abilityCooldowns.shield=Math.max(0,Number(g.p.abilityCooldowns.shield)||0);
 }
 g.bullets=g.bullets||[];g.tracers=g.tracers||[];g.projectiles=g.projectiles||[];g.burstQueue=g.burstQueue||[];
 g.loot=g.loot||[];g.nodes=g.nodes||[];g.robotDebris=Array.isArray(g.robotDebris)?g.robotDebris.slice(-72):[];g.decals=g.decals||[];g.scorch=g.scorch||[];g.devices=Array.isArray(g.devices)?g.devices:[];if(!ck.live?.mission||!g.mission||!g.mission.version){g.mission={version:1,type:'purge',done:0,required:0,caches:[],hazardsHit:0,hazardsEvaded:0,sentinelId:0};}g.arenaEvent=g.arenaEvent||{phase:'quiet',countdown:14,kind:'emp',x:0,z:0,r:3.4,warning:0};g.p.armorDelay=Math.max(0,Number(g.p.armorDelay)||0);g.p.armorRegen=Math.max(0,Number(g.p.armorRegen)||2.6);
 g.p.armorDelay=0;
 g.pendingUpgrade=ck.pendingUpgrade||null;g.state=ck.state==='upgrade'?'upgrade':'playing';
 navField=null;navClock=0;portalRouteField=null;decalDirty=true;
 $('sectorText').textContent=String(g.sector).padStart(2,'0')+' · '+sectorArchitecture;
 $('gun').dataset.gun=String(g.p.weapon);$('bossWrap').style.display=g.boss?'block':'none';
}
// Auto-save during combat and on app/browser lifecycle transitions.
setInterval(()=>{if(game&&game.state!=='dead')saveRun();},2600);
addEventListener('pagehide',()=>{if(game&&game.state!=='dead')saveRun();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game&&game.state!=='dead')saveRun();});

function panel(html){
 const content=$('panel');
 const buildLabel=`<div class="buildReleaseStamp" aria-label="Версия игры">NEON RIFT 3D · V${GAME_BUILD} · ${GAME_RELEASE}</div>`;
 const legacyNotice=legacyDiverged&&!game?'<div class="legacySaveWarning" role="status">⚠ Старая версия игры создала более позднее отдельное сохранение. Защищённый прогресс не перезаписан. Если нужны изменения из старой вкладки, экспортируй там JSON и импортируй сюда.</div>':'';
 // A new query-string URL forces a separate HTML cache entry. Keep the same
 // protocol/host: browser localStorage (and all purchases) is unchanged.
 // Never expose a reload link during a live run, including Pause / rewards.
 const releaseLink=!game&&typeof location!=='undefined'&&/^https?:$/.test(location.protocol)?
  `<div class="buildReleaseTools"><a href="?v=${GAME_BUILD}" class="buildReleaseLink">↻ ОТКРЫТЬ ЭТУ ВЕРСИЮ ПО НОВОЙ ССЫЛКЕ</a><small>Для следующего обновления используй ссылку с новым номером версии.</small></div>`:'';
 content.innerHTML=buildLabel+legacyNotice+html+'<div class="line"></div><div class="row"><button class="secondary" type="button" data-fs>⛶ ПОЛНЫЙ ЭКРАН</button></div>'+releaseLink;
 // Different screens must start at their own heading. Otherwise a deeply
 // scrolled campaign map can open the reward screen halfway through its cards.
 content.scrollTop=0;
 updateFullscreenButtons();$('overlay').classList.remove('hidden');$('hud').classList.remove('show');
}


const CAMPAIGN_ZONE_NAMES=['Цитадель Разлома','Реакторные кварталы','Архивный пояс','Вертикальные доки','Атриумы времени','Глубины металла','Пограничные системы','Небесные крепости'];
const LEVEL_ARCHITECTURES=['ЦИТАДЕЛЬ','РЕАКТОРНЫЕ КОЛЬЦА','ХРАМ ПЕРЕХОДОВ','НЕБЕСНЫЕ ДОКИ','АРХИВ ЛАБИРИНТОВ','ГРУЗОВЫЕ ВЕРФИ','КАРАНТИННЫЙ КОМПЛЕКС','ЗАТОПЛЕННЫЙ ТРАНЗИТ','ЗВЁЗДНАЯ ОБСЕРВАТОРИЯ','ПОДЗЕМНОЕ МЕТРО','КРИСТАЛЬНАЯ ГАВАНЬ','ТИТАНОВАЯ КУЗНЯ','ВЕРТИКАЛЬНАЯ ВЕРФЬ','ЛЕСТНИЧНАЯ ЦИТАДЕЛЬ','ВОЗДУШНЫЙ КОЛЛЕКТОР','ТИТАНОВЫЙ АТРИУМ','КРИОГЕННЫЙ ШПИЛЬ','ГРАВИТАЦИОННАЯ ФАБРИКА'];
function stageName(stage){return LEVEL_ARCHITECTURES[(stage-1)%LEVEL_ARCHITECTURES.length];}
function mapChapterMaximum(){return developerMaxChapter();}
function updateCampaignRoute(){
 const grid=$('panel').querySelector('.campaignRoute');
 if(!grid)return;
 const buttons=[...grid.querySelectorAll('[data-stage]')],wire=grid.querySelector('svg.campaignWires');
 if(!buttons.length||!wire)return;
 const columns=Math.max(1,getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length);
 for(let i=0;i<buttons.length;i++){
   const row=Math.floor(i/columns),inRow=i%columns;
   buttons[i].style.gridRow=String(row+1);
   buttons[i].style.gridColumn=String((row%2?columns-inRow:inRow+1));
 }
 const box=grid.getBoundingClientRect();
 wire.setAttribute('viewBox',`0 0 ${Math.max(1,box.width)} ${Math.max(1,box.height)}`);
 wire.textContent='';
 const svgNS='http://www.w3.org/2000/svg';
 for(let i=0;i<buttons.length-1;i++){
   const a=buttons[i].getBoundingClientRect(),b=buttons[i+1].getBoundingClientRect();
   const ax=a.left+a.width/2-box.left,ay=a.top+a.height/2-box.top;
   const bx=b.left+b.width/2-box.left,by=b.top+b.height/2-box.top;
   const path=document.createElementNS(svgNS,'path');
   const midx=(ax+bx)*.5;
   const d=Math.abs(ax-bx)<6 ? `M${ax},${ay} L${bx},${by}` : `M${ax},${ay} Q${midx},${(ay+by)*.5} ${bx},${by}`;
   path.setAttribute('d',d);
   const stage=Number(buttons[i].dataset.stage);
   path.setAttribute('class','campaignWire '+(stage<save.campaign.completedThrough?'done':stage===save.campaign.completedThrough?'current':'locked'));
   wire.appendChild(path);
 }
}
addEventListener('resize',()=>{if($('panel').querySelector('.campaignScreen'))requestAnimationFrame(updateCampaignRoute)});
function showCampaignMap(page=campaignPage){
 closeArsenal();
 if(game&&game.state!=='dead')saveRun();
 game=null;input.fire=false;
 if(document.pointerLockElement)document.exitPointerLock();
 const maxPage=mapChapterMaximum();
 campaignPage=clamp(Math.floor(Number(page)||0),0,Math.max(0,maxPage-1));
 const first=campaignPage*CAMPAIGN_CHAPTER_SIZE+1,last=Math.min(CAMPAIGN_MAX_LEVEL,first+CAMPAIGN_CHAPTER_SIZE-1);
 const done=save.campaign.completedThrough,unlocked=save.campaign.highestUnlocked;
 const checkpoint=save.checkpoint;
 // A completed sector may have an unclaimed between-sector reward. The next
 // stage is unlocked, but resume must first present that reward; never label
 // this transition as if the next combat level starts immediately.
 const pendingReward=!!checkpoint&&checkpoint.state==='upgrade'&&checkpoint.sector===unlocked-1;
 const nextCanResume=!!checkpoint&&(
  pendingReward ||
  checkpoint.state==='playing'&&checkpoint.sector===unlocked
 );
 const chapterDone=clamp(done-first+1,0,CAMPAIGN_CHAPTER_SIZE);
 const chapterName=CAMPAIGN_ZONE_NAMES[campaignPage%CAMPAIGN_ZONE_NAMES.length];
 const nodes=[];
 for(let stage=first;stage<=last;stage++){
   const completed=stage<=done,current=stage===unlocked;
   const locked=!developerStageAccessible(stage),rec=save.campaign.records[stage]||{};
   const boss=stage%5===0;
   const state=completed?'done':locked?'locked':'current';
   const symbol=boss?'♛':completed?'✓':locked?'🔒':'➤';
   const subtitle=completed?(boss?'БОСС ✓':'ПРОЙДЕН'):boss?'БОСС':locked?'ЗАКРЫТ':'ИГРАТЬ';const mSymbol=missionInfo(stage).icon;
   nodes.push(`<button type="button" class="campaignNode ${state}${boss?' boss':''}" data-stage="${stage}" ${locked?'disabled':''} aria-label="Уровень ${stage}: ${completed?'пройден':locked?'закрыт':'доступен'}" title="${stageName(stage)}"><span class="nodeBadge">${symbol}</span><span class="nodeN">${String(stage).padStart(2,'0')}</span><span class="nodeCaption">${subtitle}${completed&&rec.bestStars?' · '+'★'.repeat(rec.bestStars):''}</span><span class="missionMark">${mSymbol}</span></button>`);
 }
 const rec=save.campaign.records[unlocked]||{};
 const nextTitle=stageName(unlocked);
 const heroIcon=unlocked%5===0?'♛':'◆';
 const rewardPrompt=pendingReward?`<div class="campaignPendingReward" role="status">🎁 Награда за уровень ${checkpoint.sector} ещё не выбрана. Выбери улучшение — затем автоматически начнётся уровень ${unlocked}.</div>`:'';
 panel(`<section class="campaignScreen" aria-label="Карта кампании">
 <div class="campaignTop"><div><div class="eyebrow">◈ ECLIPSE PROTOCOL · КАМПАНИЯ ${devMode?'· DEV':''}</div><h1 class="campaignTitle">КАРТА <span style="color:#63f6ff">УРОВНЕЙ</span></h1><div class="smalltext">${devMode?'Тестовый режим: все 100 уровней открыты. Выбери главу или введи номер уровня.':'Пять глав, 100 уровней. Выбирай пройденные или следующий открытый уровень.'}</div></div>
 <div class="campaignCounter"><strong>${done}</strong><small>УРОВНЕЙ ПРОЙДЕНО</small></div></div>
 <div class="campaignLegend"><span><i class="campaignDot done"></i> Пройден</span><span><i class="campaignDot now"></i> Доступен</span><span><i class="campaignDot locked"></i> Закрыт</span><span>♛ Босс каждые 5 уровней</span></div>
 <div class="campaignHero"><div style="font-size:33px;color:#81e3ff">${heroIcon}</div><div><b>${done>=CAMPAIGN_MAX_LEVEL?'✓ КАМПАНИЯ ЗАВЕРШЕНА':`Следующий: уровень ${unlocked}`}</b><small>${nextTitle} · ${missionInfo(unlocked).name}${rec.attempts?' · Попыток: '+rec.attempts:''}</small></div></div>
 ${rewardPrompt}
 <div class="campaignChapter"><div class="campaignChapterHead"><div><b>ГЛАВА ${campaignPage+1} · ${chapterName}</b><small>Уровни ${first}–${last} · пройдено ${chapterDone}/20</small></div>
 <div class="campaignPagination"><button id="prevChapter" ${campaignPage===0?'disabled':''} aria-label="Предыдущая глава">‹</button><span style="font-weight:900;font-size:12px">${campaignPage+1} / ${maxPage}</span><button id="nextChapter" ${campaignPage>=maxPage-1?'disabled':''} aria-label="Следующая глава">›</button></div></div>
 <div class="campaignProgressOuter"><div class="campaignProgressInner" style="width:${(chapterDone/CAMPAIGN_CHAPTER_SIZE*100).toFixed(2)}%"></div></div>
 <div class="campaignRoute"><svg class="campaignWires" aria-hidden="true"></svg>${nodes.join('')}</div></div>
 <div class="campaignDetails" id="campaignStageDetail"><strong>Уровень ${unlocked}: ${nextTitle}</strong><div>${pendingReward?`Сначала забери награду за уровень ${checkpoint.sector}. После выбора начнётся уровень ${unlocked}.`:'Нажми на открытую клетку карты, чтобы увидеть рекорд и начать прохождение.'}</div></div>
 <div class="campaignActions"><button id="mapPlayNext" class="primary">${pendingReward?`🎁 ВЫБРАТЬ НАГРАДУ · ${checkpoint.sector} → ${unlocked}`:nextCanResume?`↪ ПРОДОЛЖИТЬ ЗАБЕГ · ${checkpoint.sector}`:done>=CAMPAIGN_MAX_LEVEL?'▶ ПОВТОРИТЬ ФИНАЛ · 100':`▶ ИГРАТЬ · УРОВЕНЬ ${unlocked}`}</button>${checkpoint&&!nextCanResume?`<button id="mapResume" class="secondary">${checkpoint.state==='upgrade'?`🎁 НАГРАДА · ${checkpoint.sector}`:`↪ ПРОДОЛЖИТЬ ${checkpoint.sector}`}</button>`:''}<button id="mapHangar" class="secondary">⚙ АНГАР</button><button id="mapBack" class="secondary">← МЕНЮ</button></div>
 ${devMode?'<div class="devStageJump"><label for="devStageNumber">БЫСТРЫЙ ПЕРЕХОД К УРОВНЮ</label><input id="devStageNumber" type="number" min="1" max="100" value="'+first+'"><button id="devStageGo" class="primary">▶ ЗАПУСТИТЬ</button><button id="devStageChapter" class="secondary">ПОКАЗАТЬ НА КАРТЕ</button></div>':''}
 <p class="campaignNote">Прогресс кампании сохраняется после победы. Портал завершает уровень и открывает следующий. Повтор старых уровней не сбрасывает достижения.</p>
 <div class="backupActions"><button class="secondary" data-export-save>⬇ ЭКСПОРТ</button><button class="secondary" data-import-save>⬆ ИМПОРТ</button></div>
 </section>`);
 const detail=$('campaignStageDetail');
 requestAnimationFrame(updateCampaignRoute);
 for(const button of $('panel').querySelectorAll('[data-stage]')){
   const stage=Number(button.dataset.stage);
   button.addEventListener('click',()=>{
     if(!developerStageAccessible(stage))return;
     const rec=save.campaign.records[stage]||{};
     const completed=stage<=save.campaign.completedThrough;
     const medal=rec.medal==='gold'?'★ Золото':rec.medal==='silver'?'◆ Серебро':rec.medal==='bronze'?'● Бронза':'—';
     detail.innerHTML=`<strong>Уровень ${stage} · ${stageName(stage)}</strong><div>${completed?'✓ Пройден':'➤ Текущий доступный'} ${stage%5===0?'· ♛ БОСС':''}</div><div>Миссия: ${missionInfo(stage).icon} ${missionInfo(stage).name} — ${missionInfo(stage).hint}</div><div>Побед: ${rec.wins||0} · Попыток: ${rec.attempts||0} · Медаль: ${medal}${rec.bestStars?' · '+ '★'.repeat(rec.bestStars):''}${rec.bestScore?' · Рекорд: '+rec.bestScore:''}</div>${pendingReward&&stage===unlocked?`<div class="campaignPendingReward">Забери улучшение за уровень ${checkpoint.sector} — после выбора сразу начнётся уровень ${stage}.</div>`:''}<button id="playSelected" class="primary" style="margin-top:9px">${pendingReward&&stage===unlocked?`🎁 НАГРАДА ${checkpoint.sector} → УРОВЕНЬ ${stage}`:nextCanResume&&stage===unlocked?'↪ ПРОДОЛЖИТЬ ЗАБЕГ · УРОВЕНЬ '+stage:completed?'▶ ПОВТОРИТЬ · УРОВЕНЬ '+stage:'▶ НАЧАТЬ · УРОВЕНЬ '+stage}</button>`;
     $('playSelected').onclick=()=>nextCanResume&&stage===unlocked?startGame(true):startGame(false,stage);
     detail.scrollIntoView({block:'nearest',behavior:'smooth'});
   });
 }
 $('prevChapter').onclick=()=>showCampaignMap(campaignPage-1);
 $('nextChapter').onclick=()=>showCampaignMap(campaignPage+1);
 $('mapPlayNext').onclick=()=>nextCanResume?startGame(true):startGame(false,save.campaign.highestUnlocked);
 if($('mapResume'))$('mapResume').onclick=()=>startGame(true);
 $('mapHangar').onclick=hangar;
 $('mapBack').onclick=menu;
 if(devMode){
  const stageInput=$('devStageNumber'),requested=()=>Number(stageInput.value);
  $('devStageGo').onclick=()=>{
   const stage=requested();if(!developerStageAccessible(stage)){stageInput.setCustomValidity('Введите целый номер от 1 до 100');stageInput.reportValidity();return;}
   stageInput.setCustomValidity('');startGame(false,stage);
  };
  $('devStageChapter').onclick=()=>{
   const stage=requested();if(developerStageAccessible(stage))showCampaignMap(Math.floor((stage-1)/CAMPAIGN_CHAPTER_SIZE));
  };
 }
 wireBackupButtons();
}
// Offline, per-browser QA playground. This password is a local interface
// guard, NOT server authentication: the owner can inspect any bundled HTML.
// Trial purchases and campaign wins use a separate save, never the real one.
function developerCredits(){return devMode?'∞':String(save.credits);}
function developerCanAfford(cost){return devMode||save.credits>=cost;}
function developerBuy(cost){if(!developerCanAfford(cost))return false;if(!devMode)save.credits-=cost;return true;}
function developerStageAccessible(stage){return Number.isInteger(stage)&&stage>=1&&stage<=CAMPAIGN_MAX_LEVEL&&(devMode||stage<=save.campaign.highestUnlocked);}
function developerMaxChapter(){return devMode?Math.ceil(CAMPAIGN_MAX_LEVEL/CAMPAIGN_CHAPTER_SIZE):Math.floor((save.campaign.highestUnlocked-1)/CAMPAIGN_CHAPTER_SIZE)+1;}

async function developerSecretDigest(password){
 const message='NEON RIFT QA PASSWORD v1\0'+password;
 // Cryptographic hashing when supported by the current offline browser.
 try{
  if(globalThis.crypto?.subtle){
   const bytes=new TextEncoder().encode(message),digest=await crypto.subtle.digest('SHA-256',bytes);
   return 'sha256:'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  }
 }catch(_){/* Browser denied WebCrypto for file://; use local checksum. */}
 // Deterministic fallback for browsers without WebCrypto; not a security boundary.
 let a=2166136261,b=0x9e3779b9;
 for(let j=0;j<message.length;j++){const v=message.charCodeAt(j);a=Math.imul(a^v,16777619)>>>0;b=Math.imul(b^(v+a),2246822519)>>>0;}
 return 'local:'+a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0');
}
async function developerPasswordMatches(password){
 let expected=null;
 try{expected=localStorage.getItem(DEV_PASSWORD_KEY);}catch(_){/* no persistence */}
 return (await developerSecretDigest(password))===(expected||await developerSecretDigest('tamu'));
}
function developerFreshSave(){
 const result={...saveDefaults,settings:{...saveDefaults.settings},perms:Array(PERM_COUNT).fill(0),
  campaign:normalizeCampaign(null,1,null),checkpoint:null,weaponMods:{},bodyArmor:{owned:{},equipped:-1}};
 return result;
}
function developerRestoreSandbox(){
 let saved=null;
 try{saved=getSaved(DEV_SAVE_KEY,localStorage);}catch(_){/* no persistence */}
 const base=developerFreshSave();
 if(!saved)return base;
 return {...base,...saved,best:clamp(Math.floor(Number(saved.best)||1),1,CAMPAIGN_MAX_LEVEL),
  checkpoint:Number(saved.checkpoint?.sector)>CAMPAIGN_MAX_LEVEL?null:saved.checkpoint,
  perms:normalizePerms(saved.perms),
  campaign:normalizeCampaign(saved.campaign,1,saved.checkpoint),
  settings:{...base.settings,...saved.settings},
  bodyArmor:saved.bodyArmor||base.bodyArmor,weaponMods:saved.weaponMods||{}};
}
function developerEnter(){
 if(devMode)return menu();
 normalPlayerSave=save;
 save=developerRestoreSandbox();devMode=true;
 normalizeLoadoutSave();
 save.settings.cameraMode=normalizeCameraMode(save.settings.cameraMode);
 save.settings.fpsLimit=normalizeFpsLimit(save.settings.fpsLimit);
 save.settings.dashDistance=normalizeDashDistanceSetting(save.settings.dashDistance);
 save.settings.flightHorizontal=normalizeFlightThrottle(save.settings.flightHorizontal);
 save.settings.flightVertical=normalizeFlightThrottle(save.settings.flightVertical);
 campaignPage=0;game=null;persist();refreshCameraInterface();menu();
}
function developerLeave(){
 if(!devMode)return menu();
 if(game&&game.state!=='dead')saveRun();
 game=null;closeArsenal();
 save=normalPlayerSave;normalPlayerSave=null;devMode=false;
 // The developer sandbox uses a different journal and timestamp. Restoring
 // the normal save must restore its own concurrency watermark too.
 lastSavedAt=Number(save._savedAt)||0;
 campaignPage=Math.floor((save.campaign.highestUnlocked-1)/CAMPAIGN_CHAPTER_SIZE);
 refreshCameraInterface();menu();
}
function developerResetSandbox(){
 if(!devMode||!confirm('Сбросить все покупки и достижения ТОЛЬКО тестового режима?'))return;
 game=null;save=developerFreshSave();normalizeLoadoutSave();campaignPage=0;
 persist();refreshCameraInterface();menu();
}
function showDeveloperPanel(){
 closeArsenal();game=null;
 if(document.pointerLockElement)document.exitPointerLock();
 panel(`<div class="eyebrow">◈ ЛОКАЛЬНОЕ ТЕСТИРОВАНИЕ</div><h1>РЕЖИМ <span class="accent">РАЗРАБОТЧИКА</span></h1>
 <p class="lede">Все уровни доступны, кредиты бесконечны. Бронекостюмы и улучшения не выдаются автоматически: нажимайте «КУПИТЬ». Прогресс тестирования хранится отдельно от обычной игры.</p>
 <label class="developerLabel" for="devPass">${devMode?'Тестовый режим уже включён':'Пароль для включения режима'}</label>
 <div class="row"><input type="password" id="devPass" autocomplete="off" spellcheck="false" placeholder="Пароль" ${devMode?'disabled':''}><button id="devLogin" class="primary" ${devMode?'disabled':''}>ВКЛЮЧИТЬ</button></div>
 <div id="devMessage" class="smalltext" aria-live="polite"></div>
 <div class="line"></div><h3>Сменить пароль</h3>
 <div class="row"><input type="password" id="devOld" autocomplete="off" placeholder="Текущий пароль"><input type="password" id="devNew" autocomplete="off" placeholder="Новый пароль" aria-label="Новый пароль (от 4 до 128 символов)"><button id="devChange" class="secondary">СМЕНИТЬ</button></div>
 <p class="smalltext">Пароль действует в этом браузере. Он защищает от случайного включения, но не является защитой от изменения исходного HTML.</p>
 <div class="row">${devMode?'<button id="devReset" class="secondary">↺ СБРОС ТЕСТОВЫХ ПОКУПОК</button><button id="devExit" class="secondary">ВЫЙТИ ИЗ DEV</button>':''}<button id="devBack" class="secondary">← МЕНЮ</button></div>`);
 const msg=$('devMessage');
 $('devLogin').onclick=async()=>{
  const b=$('devLogin');b.disabled=true;
  try{
   if(await developerPasswordMatches($('devPass').value)){developerEnter();return;}
   msg.textContent='Неверный пароль.';
  }catch(_){msg.textContent='Проверка пароля недоступна в этом браузере.';}
  b.disabled=false;
 };
 $('devChange').onclick=async()=>{
  const old=$('devOld').value,next=$('devNew').value,b=$('devChange');
  if(next.length<4||next.length>128){msg.textContent='Новый пароль должен иметь от 4 до 128 символов.';return;}
  b.disabled=true;
  try{
   if(!await developerPasswordMatches(old))msg.textContent='Предыдущий пароль неверен; ничего не изменено.';
   else{
    localStorage.setItem(DEV_PASSWORD_KEY,await developerSecretDigest(next));
    $('devOld').value='';$('devNew').value='';
    msg.textContent='Пароль изменён. Старый пароль больше не действует.';
   }
  }catch(_){msg.textContent='Не удалось сохранить новый пароль в этом браузере.';}
  b.disabled=false;
 };
 $('devBack').onclick=menu;
 if(devMode){$('devReset').onclick=developerResetSandbox;$('devExit').onclick=developerLeave;}
}



function fpsOptionsHTML(){return FPS_LIMITS.map(v=>`<option value="${v}" ${save.settings.fpsLimit===v?'selected':''}>${v===0?'Без ограничения':v+' FPS'}</option>`).join('');}
function fpsSettingsHTML(id){return `<div class="fpsSettings"><label for="${id}">ЛИМИТ КАДРОВ</label><select id="${id}" data-fps-select aria-label="Ограничение частоты кадров">${fpsOptionsHTML()}</select><small>Это максимальная частота отрисовки, а не гарантированный FPS. Реальная скорость зависит от устройства, дисплея и браузера. Физика игры работает независимо от лимита.</small></div>`;}
function wireFpsSettings(){document.querySelectorAll('[data-fps-select]').forEach(select=>{select.onchange=()=>{save.settings.fpsLimit=normalizeFpsLimit(select.value);persist();resetFpsPacing();saveNotice(`ЛИМИТ FPS: ${save.settings.fpsLimit||'БЕЗ ОГРАНИЧЕНИЯ'}`);select.title=save.settings.fpsLimit?`Ограничение ${save.settings.fpsLimit} FPS`:'Без ограничения';};});}
function dashDistanceSettingsHTML(){
 const max=maxDashRange(),current=selectedDashRange();
 const display=n=>n.toFixed(2).replace('.',',');
 const progress=dashDistancePercent(current,max);
 return `<div class="dashPauseSettings"><div class="dashPauseHead"><label for="dashPauseSlider">➤ ДАЛЬНОСТЬ ФАЗОВОГО РЫВКА</label><output id="dashPauseValue" for="dashPauseSlider">${display(current)} / ${display(max)} м</output></div><div class="dashPauseRail" id="dashPauseRail" style="--dash-fill:${progress}%"><div class="dashPauseTrack" aria-hidden="true"><div class="dashPauseRailFill"></div><div class="dashPauseRailKnob"></div></div><input id="dashPauseSlider" type="range" min="${DASH_DISTANCE_MIN.toFixed(2)}" max="${max.toFixed(2)}" step="0.01" value="${current.toFixed(2)}" aria-label="Настроить дальность рывка" aria-valuetext="${display(current)} метра"></div><div class="dashPauseScale"><span>МИНИМУМ ${display(DASH_DISTANCE_MIN)} м</span><span>ДОСТУПНО ${display(max)} м</span></div><small>Выбери дальность. На ПК ↑/↓ меняют её по 0,5 м; покупка «Фазового радиуса» добавляет 0,3 м к максимуму. Рывок работает горизонтально даже в полёте.</small></div>`;
}
function wireDashDistanceSettings(){
 const slider=$('dashPauseSlider'),output=$('dashPauseValue'),rail=$('dashPauseRail');if(!slider||!output)return;
 const display=n=>n.toFixed(2).replace('.',',');
 const sync=()=>{
  const distance=setDashRange(slider.value,false,false);
  output.textContent=display(distance)+' / '+display(maxDashRange())+' м';
  slider.setAttribute('aria-valuetext',display(distance)+' метра');
  if(rail)rail.style.setProperty('--dash-fill',dashDistancePercent(distance,maxDashRange())+'%');
 };
 slider.oninput=sync;
 slider.onchange=()=>{sync();persist()};
}
let pauseResumeGraceUntil=0;
function unpauseGame(){
 if(!game||game.state!=='paused')return false;
 game.state='playing';
 $('overlay').classList.add('hidden');
 $('hud').classList.add('show');
 lastFrame=performance.now();
 pauseResumeGraceUntil=lastFrame+350;
 return true;
}

function menu(){closeArsenal();game=null;input.fire=false;if(document.pointerLockElement)document.exitPointerLock();const cp=save.checkpoint;panel(`<div class="eyebrow">▣ ROBOT FOUNDRY VI · РАЗРУШАЕМАЯ БРОНЯ</div><div class="logo">NEON <em>RIFT</em><small>ECLIPSE PROTOCOL</small></div>${devMode?'<div class="devFlag">🛠 DEV · ТЕСТОВЫЙ ПРОГРЕСС · ∞ КРЕДИТЫ</div>':''}<div class="scenehint">FOUNDRY VI · БРОНЕПЛАСТИНЫ · ОСКОЛКИ · 18 КАРТ · 7 МИССИЙ</div><div class="lede">Портал разлома разрушает миры. Пройди <b>100 уровней в пяти главах</b>, переживи волны машин, уничтожь владык разлома и усили свой боевой костюм. Каждый пятый сектор — особый босс.</div><div class="quickstats"><div><b>${save.campaign.completedThrough}</b><span>ПРОЙДЕНО УРОВНЕЙ</span></div><div><b>${developerCredits()}</b><span>КРЕДИТЫ</span></div><div><b>${save.kills}</b><span>ВСЕГО ПОБЕД</span></div></div><div class="row"><button id="campaignMap" class="primary">◈ КАРТА УРОВНЕЙ</button>${cp?`<button id="resume" class="secondary">↪ ПРОДОЛЖИТЬ · ${cp.sector}</button>`:''}<button id="newRun" class="secondary">▶ НОВЫЙ ЗАБЕГ · УРОВЕНЬ ${save.campaign.highestUnlocked}</button><button id="hangar" class="secondary">⚙ АНГАР / УСИЛЕНИЯ</button><button id="devToggle" class="secondary">${devMode?'⚙ ВЫЙТИ ИЗ DEV':'⌘ РЕЖИМ РАЗРАБОТЧИКА'}</button>${devMode?'<button id="devSettings" class="secondary">⚿ ПАРОЛЬ / СБРОС DEV</button>':''}</div>
${fpsSettingsHTML('menuFpsLimit')}
<div class="backupActions"><button class="secondary" data-export-save>⬇ ЭКСПОРТ ПРОГРЕССА</button><button class="secondary" data-import-save>⬆ ИМПОРТ ПРОГРЕССА</button></div><div class="smalltext">${storageAvailable?'✓ Автосохранение: каждые 2,6 секунды, при паузе и закрытии страницы.':'⚠ Браузер запрещает запись. Экспортируй копию.'} Для переноса сохранения между файлами HTML и браузерами используй экспорт/импорт.</div><div class="line"></div><div class="smalltext"><b class="accent">ПК:</b> WASD — движение, пробел — прыжок, V/двойной пробел — полёт (если есть лётный костюм), удерживать Space/Shift — набор/снижение высоты; мышь — осмотр, ЛКМ — стрельба, 1–9/0 — оружие. <b>E — фазовый рывок без перезарядки</b>, ↑/↓ — его дальность; <b>F — восстановление по очереди: корпус → бронекостюм → энергобарьер (без ожидания, пока хватает энергии).</b> <b>Q — ЭМИ-импульс без перезарядки</b> (52 энергии); <b>C — временная защитная сфера</b> (50 энергии, перезарядка 5 секунд после окончания действия, но без заряда энергобарьера). Радиус и урон Q улучшаются в ангаре сложными процентами. F5 — камера, G — полный экран, M — масштаб карты, Esc — пауза (в ангаре — в меню). При полёте [ / ] меняют горизонтальную, , / . — вертикальную скорость; также есть ползунки прямо на игровом экране.<br><b class="accent">Телефон:</b> левый джойстик — движение, касание поля — выстрел, свайп — обзор; значки ➤ (рывок), ✚ (восстановление), ◈ (защитная сфера), ✺ (импульс), ⤒ (прыжок). Для лётных костюмов появляются ✈ / ↑ / ↓. Скорости полёта, дальность рывка и режим камеры настраиваются в паузе. <b>«Арсенал»</b> открывает список оружия; мини-карта меняет масштаб по касанию.</div><div class="note">Десять видов оружия, разные классы роботов, разрушаемые энергоядра, элитные противники и следы на стенах. Третья степень графики наиболее требовательна. В меню и на паузе отрисовка 3D отключается для экономии GPU. Игра работает без Интернета, внешних библиотек, регистрации и оплаты. Автосохранение текущего боя и экспорт резервной копии в JSON. ${glReady?'Аппаратный WebGL-движок активен.':'Работает программный 3D-режим, если WebGL недоступен.'}</div>`);$('campaignMap').onclick=()=>showCampaignMap();$('newRun').onclick=()=>startGame(false,save.campaign.highestUnlocked);if(cp)$('resume').onclick=()=>startGame(true);$('hangar').onclick=hangar;$('devToggle').onclick=()=>devMode?developerLeave():showDeveloperPanel();if(devMode)$('devSettings').onclick=showDeveloperPanel;wireBackupButtons();wireFpsSettings()}
const hangarData=[
 {name:'ПРОЧНОСТЬ КОРПУСА',desc:'Максимальная прочность +8% за уровень.'},
 {name:'УРОН ВСЕГО ОРУЖИЯ',desc:'Урон любого оружия +4% за уровень.'},
 {name:'ЭНЕРГОБАРЬЕР',desc:'Максимальный запас барьера +9% за уровень.'},
 {name:'РЕГЕНЕРАЦИЯ ЭНЕРГИИ',desc:'Восстановление энергии +4% за уровень.'},
 {name:'ЗАПАС ЭНЕРГИИ',desc:'Максимальная энергия +4% за уровень.'},
 {name:'ДАЛЬНОСТЬ РЫВКА (E)',desc:'Максимальная дальность +0,30 м за уровень. ↑/↓ — выбрать дистанцию.'},
 {name:'РАДИУС ЭМИ (Q)',desc:'Радиус импульса +1,2% за уровень.'},
 {name:'УРОН ЭМИ (Q)',desc:'Урон импульса +4% за уровень.'},
 {name:'РЕМОНТ КОРПУСА (F)',desc:'Восстанавливает на 3% больше за уровень. До 50 энергии.'},
 {name:'РЕМОНТ КОСТЮМА (F)',desc:'Восстанавливает на 2,5% больше за уровень. До 50 энергии.'},
 {name:'РЕМОНТ БАРЬЕРА (F)',desc:'Восстанавливает на 2% больше за уровень. До 40 энергии.'},
 {name:'ВРЕМЯ ЗАЩИТНОЙ СФЕРЫ (C)',desc:'Действует на 0,6% дольше за уровень. 50 энергии; перезарядка 5 с после конца.'}
];
const permCategories=[
 {id:'defense',icon:'⬡',name:'КОРПУС И БАРЬЕР',hint:'Максимальный запас защиты',upgrades:[0,2]},
 {id:'energy',icon:'ϟ',name:'ЭНЕРГИЯ',hint:'Запас и скорость восстановления',upgrades:[3,4]},
 {id:'combat',icon:'✹',name:'ОРУЖИЕ И ЭМИ',hint:'Урон оружия и импульса Q',upgrades:[1,6,7]},
 {id:'repair',icon:'✚',name:'РЕМОНТ (F)',hint:'Сколько восстанавливает одно нажатие',upgrades:[8,9,10]},
 {id:'abilities',icon:'➤',name:'СПОСОБНОСТИ (E / C)',hint:'Дальность рывка и время защиты',upgrades:[5,11]}
];
function permCurrentStat(i,suit){
 const lv=save.perms[i],number=(v,n=1)=>v.toFixed(n).replace('.',',');
 switch(i){
  case 0:return number(permanentStat(100,PERM_COMPOUND.health,lv))+' ед. прочности';
  case 1:return '+'+number((permanentStat(1,PERM_COMPOUND.damage,lv)-1)*100)+'% к урону оружия';
  case 2:return number(permanentStat(30,PERM_COMPOUND.barrier,lv))+' ед. барьера';
  case 3:return number(permanentStat(16,PERM_COMPOUND.regen,lv),2)+' энергии/с';
  case 4:return number(permanentStat(100,PERM_COMPOUND.capacity,lv))+' энергии';
  case 5:return number(DASH_DISTANCE_BASE+lv*DASH_UPGRADE_STEP,2)+' м';
  case 6:return number(permanentStat(5.8,PERM_COMPOUND.pulseRadius,lv),2)+' м';
  case 7:return number(permanentStat(66,PERM_COMPOUND.pulseDamage,lv))+' урона';
  case 8:return number(permanentStat(49,PERM_COMPOUND.repairHull,lv))+' ед. корпуса за F';
  case 9:{const fraction=permanentStat(.07,PERM_COMPOUND.repairSuit,lv);
   return number(fraction*100,2)+'% прочности костюма'+(suit.maxDurability?' ('+number(suit.maxDurability*fraction)+' ед.)':'');}
  case 10:{const fraction=permanentStat(.30,PERM_COMPOUND.repairBarrier,lv);
   return number(fraction*100,2)+'% барьера ('+number(permanentStat(30,PERM_COMPOUND.barrier,save.perms[2])*fraction)+' ед.)';}
  case 11:return number(permanentStat(3.5,PERM_COMPOUND.shieldDuration,lv),2)+' с защиты';
 }
 return '';
}
function permShopHTML(suit){
 return permCategories.map(group=>`<details class="permCategory" data-section="perm-${group.id}">
  <summary><span class="permCategoryIcon" aria-hidden="true">${group.icon}</span><span class="permCategoryText"><strong>${group.name}</strong><small>${group.hint}</small></span><span class="permCategoryCount">${group.upgrades.length} улучш.</span><span class="permChevron" aria-hidden="true">⌄</span></summary>
  <div class="shopitems">${group.upgrades.map(i=>{
   const x=hangarData[i],lv=save.perms[i],cost=permPrice(i);
   return `<div class="shopitem permUpgrade"><div><div class="permUpgradeTitle"><strong>${x.name}</strong><span class="accent">LVL ${lv}/${PERM_MAX_LEVEL}</span></div><small>${x.desc}</small><span class="permNow">Сейчас: ${permCurrentStat(i,suit)}</span></div><button class="secondary" data-up="${i}" ${!developerCanAfford(cost)||lv>=PERM_MAX_LEVEL?'disabled':''}>${lv>=PERM_MAX_LEVEL?'МАКС':cost+' ◈'}</button></div>`;
  }).join('')}</div></details>`).join('');
}
function permPrice(i){return (i===2?18:45)*(save.perms[i]+1);}
function weaponShopHTML(){
 return weapons.map((base,i)=>{
  const w=combatWeapon(i);
  const mods=GUN_PATHS[i].map(path=>{
   const lv=gunPathLevel(i,path),cost=gunPrice(i,path),text=GUN_PATH_LABELS[path];
   return `<div class="shopitem"><div><strong>${text[0]} <span class="accent">${lv}/${WEAPON_MAX_LEVEL}</span></strong><small>${text[1]}</small></div><button class="secondary" data-gun-up="${i}" data-mod="${path}" ${!developerCanAfford(cost)||lv>=WEAPON_MAX_LEVEL?'disabled':''}>${lv>=WEAPON_MAX_LEVEL?'МАКС':cost+' ◈'}</button></div>`;
  }).join('');
  return `<details class="weaponShop" data-section="gun-${i}"><summary>${base.icon} ${base.short} <span>Урон ${Math.round(w.damage)} · Пробиваемость ${Math.round(w.penetration*100)}%${w.blast?' · Взрыв '+w.blast.toFixed(2)+' м':''}</span></summary><div class="smalltext"><b>${GUN_TACTICS[i]}</b><div>${gunNumericStats(i)}</div></div>${mods}</details>`;
 }).join('');
}
function armorShopHTML(){
 const inventory=save.bodyArmor.owned,equipped=save.bodyArmor.equipped;
 return BODY_ARMOR_CATALOG.map((item,i)=>{
  const owned=Object.prototype.hasOwnProperty.call(inventory,i),lv=owned?inventory[i]:0;
  const stats=armorProgress(i,lv),dura=stats.maxDurability,reduction=stats.reduction;
  const reduce=(reduction*100).toFixed(i>=12?4:2).replace(/\.?0+$/,'').replace('.',',');
  const step=((item.armorStep??ECONOMY_BALANCE.legacyArmorStep)*100).toFixed(4).replace(/\.?0+$/,'').replace('.',',');
  const cost=owned?armorUpgradePrice(i):item.price;
  const flies=owned&&armorGrantsFlight({id:i,level:lv});
  const flightRows=flies?`<div class="flightResearch">${[['horizontal','ГОРИЗОНТАЛЬНАЯ','↔'],['vertical','ВЕРТИКАЛЬНАЯ','↕']].map(([axis,label,icon])=>{
   const rank=flightResearchLevel(i,axis),price=flightResearchPrice(i,axis),factor=flightSpeedMultiplier(axis,rank);
   return `<div class="flightResearchRow"><span>${icon} ${label} · LVL ${rank}/20 · ×${factor.toFixed(2)}</span><button class="secondary" data-flight-up="${i}" data-axis="${axis}" ${rank>=FLIGHT_MOD_MAX_LEVEL||!developerCanAfford(price)?'disabled':''}>${rank>=FLIGHT_MOD_MAX_LEVEL?'МАКС':price+' ◈ +5%'}</button></div>`;
  }).join('')}</div>`:'';
  const buttons=owned?`<button class="secondary" data-equip-armor="${i}" ${equipped===i?'disabled':''}>${equipped===i?'НАДЕТ':'НАДЕТЬ'}</button><button class="secondary" data-armor-up="${i}" ${lv>=20||!developerCanAfford(cost)?'disabled':''}>${lv>=20?'МАКС':cost+' ◈ УЛУЧШИТЬ'}</button>`:
  `<button class="secondary" data-buy-armor="${i}" ${!developerCanAfford(cost)?'disabled':''}>${cost} ◈ КУПИТЬ</button>`;
  return `<div class="shopitem"><button type="button" class="armorPreviewBtn" data-preview-armor="${i}" aria-label="Посмотреть костюм ${i+1}">◉</button><div class="armorDetails"><strong>${i+1}. ${item.name} <span class="accent">${owned?'LVL '+lv+'/20':'НЕ КУПЛЕН'}</span></strong><small>Прочность ${dura.toFixed(1).replace(/\.?0+$/,'').replace('.',',')} · снижение урона ${reduce}% · ${i>=9?'ПОЛЁТ СРАЗУ':'полёт с LVL 10'}<br>Каждый LVL: +${step} п.п. защиты (до предела) · +8% к предыдущей прочности</small>${flightRows}</div><div class="armorShopButtons">${buttons}</div></div>`;
 }).join('');
}
function hangar(section='',previousScroll=0,openPermSections=[]){
 const suit=equippedArmorStats();
 const next=clamp(save.campaign?.highestUnlocked||1,1,CAMPAIGN_MAX_LEVEL);
 const suggested=recommendedArmorId(next),suggestedSuit=BODY_ARMOR_CATALOG[suggested];
 panel(`<div class="eyebrow">МЕЖСЕКТОРНАЯ БАЗА</div><h1>АНГАР <span class="accent">/ МОДУЛИ</span></h1>
 <p class="lede">Постоянная прокачка. Улучшения каждого из 10 орудий независимы. Купленная физическая броня надевается отдельно от энергетического барьера.</p>
 <h3>◈ КРЕДИТЫ: ${developerCredits()}${devMode?' · ТЕСТОВЫЙ АНГАР':''}</h3>
 <div class="note"><b class="accent">СОВЕТ ДЛЯ УРОВНЯ ${next}:</b> костюм №${suggested+1} «${suggestedSuit.name}» (${suggestedSuit.price} ◈). Если тяжело — улучшай защиту и любимое оружие. Даже неудачные попытки приносят кредиты.</div>
 <div class="smalltext"><b>F</b> — ремонт: корпус → костюм → барьер. <b>E</b> — рывок. <b>Q</b> — ЭМИ (52 энергии). <b>C</b> — защитная сфера (50 энергии, перезарядка 5 с после окончания). <b>Esc</b> — назад. На телефоне способности работают через кнопки.</div>
 <h3>Общие модернизации</h3><p class="smalltext">Выбери категорию. Все проценты начисляются от предыдущего уровня; «Сейчас» — значение без временных бонусов забега.</p>
 <div class="permCategories">${permShopHTML(suit)}</div>
 <h3>Оружейная мастерская · 20 уровней каждого свойства</h3><p class="smalltext">Пробиваемость — доля урона, проходящая мимо защиты робота. Радиус взрыва применяется к ракетам, ионным зарядам и гранатам; у остальных видов вместо этого свои профильные улучшения.</p>
 <div class="shopitems">${weaponShopHTML()}</div>
 <h3>Бронекостюмы · ${BODY_ARMOR_CATALOG.length} моделей</h3>
 <p class="smalltext">Текущий костюм: <b>${suit.id<0?'нет':BODY_ARMOR_CATALOG[suit.id].name}</b>. Бронекостюм сначала нужно купить и надеть. Каждый выдерживает ограниченное количество ударов, до 20 уровней усовершенствования. <b class="accent">Костюмы №10–16 дают полёт сразу после покупки и экипировки; костюмы №1–9 — после улучшения до LVL 10.</b> Прочность костюма растёт на +8% к предыдущему значению за уровень. В четырёх поздних моделях снижение урона достигает 97–99,95%; физический костюм изнашивается. Между секторами автоматически чинится 34% его максимальной прочности (после босса ещё 12%), ремонтные станции восстанавливают 18%, бронепластины — 6%. F восстанавливает корпус, затем костюм, затем энергобарьер. На ПК: дважды Space либо V — полёт; Space — вверх, Shift — вниз. Для полётных костюмов доступны независимые улучшения горизонтальной и вертикальной скоростей (+5% к предыдущей за уровень); их доли регулируются ползунками во время боя. На телефоне кнопки полёта остаются в бою, а настройки скоростей — в паузе.</p>
 <div class="row"><button id="removeArmor" class="secondary" ${suit.id<0?'disabled':''}>СНЯТЬ БРОНЕКОСТЮМ</button></div>
 <div class="operatorPreview"><canvas id="operatorCanvas" width="265" height="340" aria-label="Внешний вид выбранного бронекостюма"></canvas><div><strong id="operatorPreviewName">${suit.id<0?'БАЗОВАЯ ФОРМА':BODY_ARMOR_CATALOG[suit.id].name}</strong><p class="smalltext">Предпросмотр показывает внешний вид бронекостюма. В бою он отображается на 3D-персонаже при режиме третьего или второго лица (F5). Можно посмотреть ещё не купленную модель — это не покупка.</p><small>При смене костюма внешний вид обновляется после экипировки.</small></div></div>
 <div class="shopitems">${armorShopHTML()}</div>
 <button id="back" class="primary">← ГЛАВНОЕ МЕНЮ</button>`);
 const previewCanvas=$('operatorCanvas');
 const showPreview=id=>{renderArmorPreview(previewCanvas,id);const el=$('operatorPreviewName');if(el)el.textContent=id<0?'БАЗОВАЯ ФОРМА':BODY_ARMOR_CATALOG[id].name;};
 showPreview(suit.id);
 document.querySelectorAll('[data-preview-armor]').forEach(el=>el.onclick=()=>showPreview(Number(el.dataset.previewArmor)));
 if(section){const el=document.querySelector(`[data-section="${section}"]`);if(el)el.open=true;}
 for(const id of openPermSections){const el=document.querySelector(`[data-section="${id}"]`);if(el)el.open=true;}
 $('panel').scrollTop=previousScroll;
 const refresh=id=>hangar(id,$('panel').scrollTop,Array.from(document.querySelectorAll('.permCategory[open]'),el=>el.dataset.section));
 $('back').onclick=menu;
 $('removeArmor').onclick=()=>{save.bodyArmor.equipped=-1;persist();refresh('armor');};
 document.querySelectorAll('[data-up]').forEach(el=>el.onclick=()=>{
  const i=Number(el.dataset.up);if(!Number.isInteger(i)||i<0||i>=PERM_COUNT)return;
  const cost=permPrice(i);
  if(developerCanAfford(cost)&&save.perms[i]<PERM_MAX_LEVEL){developerBuy(cost);save.perms[i]++;persist();refresh(section);document.querySelector(`[data-up="${i}"]`)?.focus?.({preventScroll:true});}
 });
 document.querySelectorAll('[data-gun-up]').forEach(el=>el.onclick=()=>{
  const i=Number(el.dataset.gunUp),path=el.dataset.mod,cost=gunPrice(i,path);
  if(!GUN_PATHS[i]?.includes(path)||gunPathLevel(i,path)>=WEAPON_MAX_LEVEL||!developerCanAfford(cost))return;
  developerBuy(cost);save.weaponMods[i][path]=gunPathLevel(i,path)+1;
  persist();refresh('gun-'+i);
 });
 document.querySelectorAll('[data-buy-armor]').forEach(el=>el.onclick=()=>{
  const i=Number(el.dataset.buyArmor),item=BODY_ARMOR_CATALOG[i];
  if(!item||Object.prototype.hasOwnProperty.call(save.bodyArmor.owned,i)||!developerCanAfford(item.price))return;
  developerBuy(item.price);save.bodyArmor.owned[i]=0;save.bodyArmor.equipped=i;
  persist();refresh('armor');
 });
 document.querySelectorAll('[data-equip-armor]').forEach(el=>el.onclick=()=>{
  const i=Number(el.dataset.equipArmor);
  if(!Object.prototype.hasOwnProperty.call(save.bodyArmor.owned,i))return;
  save.bodyArmor.equipped=i;persist();refresh('armor');
 });
 document.querySelectorAll('[data-armor-up]').forEach(el=>el.onclick=()=>{
  const i=Number(el.dataset.armorUp),lv=Number(save.bodyArmor.owned[i]);
  if(!Number.isInteger(lv)||lv>=20)return;
  const cost=armorUpgradePrice(i);if(!developerCanAfford(cost))return;
  developerBuy(cost);save.bodyArmor.owned[i]=lv+1;persist();refresh('armor');
 });
 document.querySelectorAll('[data-flight-up]').forEach(el=>el.onclick=()=>{
  const i=Number(el.dataset.flightUp),axis=el.dataset.axis;
  if(!Number.isInteger(i)||!['horizontal','vertical'].includes(axis)||!Object.prototype.hasOwnProperty.call(save.bodyArmor.owned,i)||!armorGrantsFlight({id:i,level:save.bodyArmor.owned[i]}))return;
  const rank=flightResearchLevel(i,axis),cost=flightResearchPrice(i,axis);
  if(rank>=FLIGHT_MOD_MAX_LEVEL||!developerCanAfford(cost))return;
  developerBuy(cost);save.bodyArmor.flightMods[i]??={horizontal:0,vertical:0};save.bodyArmor.flightMods[i][axis]=rank+1;
  persist();refresh('armor');
 });
}
function defeatRecoveryCredits(g){
 if(!g||!(g.target>0))return 0;
 const kills=clamp((Number(g.kills)||0)/Math.max(1,g.target),0,1);
 const boss=g.boss?.maxhp>0?clamp(1-g.boss.hp/g.boss.maxhp,0,1):0;
 const progress=Math.max(kills,boss);
 const level=clamp(Math.floor(Number(g.sector)||1),1,CAMPAIGN_MAX_LEVEL);
 return Math.round((40+2.5*level+.10*level*level)*progress*.75);
}
function showFinalVictory(){
 closeArsenal();const g=game;if(!g)return;
 g.state='victory';save.checkpoint=null;persist();
 panel(`<div class="eyebrow">✦ ECLIPSE PROTOCOL · ФИНАЛ</div>
 <h1>КАМПАНИЯ <span class="accent">ЗАВЕРШЕНА</span></h1>
 <p class="lede">Все 100 уровней и пять глав пройдены! Финальный противник повержен. Твои постоянные улучшения, бронекостюмы и рекорды сохранены.</p>
 <div class="quickstats"><div><b>100 / 100</b><span>УРОВНЕЙ</span></div><div><b>${g.kills}</b><span>УБИЙСТВ В ФИНАЛЕ</span></div><div><b>${Math.floor(g.score).toLocaleString('ru')}</b><span>ОЧКОВ</span></div></div>
 <div class="row"><button id="finalMap" class="primary">◈ КАРТА КАМПАНИИ</button><button id="finalReplay" class="secondary">↻ ПОВТОРИТЬ ФИНАЛ</button><button id="finalMenu" class="secondary">⌂ МЕНЮ</button></div>`);
 $('finalMap').onclick=()=>showCampaignMap(4);
 $('finalReplay').onclick=()=>startGame(false,CAMPAIGN_MAX_LEVEL);
 $('finalMenu').onclick=menu;
}
function showUpgrade(savedIDs=null){closeArsenal();const g=game;
 if(g.sector>=CAMPAIGN_MAX_LEVEL){showFinalVictory();return;}
 const opts=Array.isArray(savedIDs)&&savedIDs.length===3?savedIDs.map(id=>upgrades.find(x=>x.id===id)).filter(Boolean):pickUpgrades();
 g.state='upgrade';g.pendingUpgrade=opts.map(x=>x.id);saveRun();panel(`<div class="eyebrow">✓ УРОВЕНЬ ${g.sector} ПРОЙДЕН · ПРОГРЕСС СОХРАНЁН</div><h1>НАГРАДА <span class="accent">/ УРОВЕНЬ ${g.sector}</span></h1><p class="lede"><b>Выбери одно из трёх улучшений.</b> После выбора сразу начнётся уровень ${g.sector+1}. Если вернёшься на карту, награда останется доступной.</p><div class="missionWinBanner">${MISSION_TYPES[g.mission?.type||'purge'].icon} ${MISSION_TYPES[g.mission?.type||'purge'].name} · ${'★'.repeat(missionStars(g))}${'☆'.repeat(3-missionStars(g))} · БОНУС: ${4+missionStars(g)*4} ◈</div><div class="cards">${opts.map((x,i)=>`<button class="option" data-pick="${i}"><div class="ico">${x.icon}</div><strong>${x.name}</strong><p>${x.desc}</p><div class="tier">АДАПТАЦИЯ ${1+(g.upgrades[x.id]||0)}</div></button>`).join('')}</div><div class="smalltext">Награда за уровень ${g.sector} ещё не выбрана. После её получения начнётся уровень ${g.sector+1}.</div><div class="campaignActions"><button id="winMap" class="secondary">◈ КАРТА УРОВНЕЙ</button><button id="winReplay" class="secondary">↻ ПОВТОРИТЬ ${g.sector}</button></div>`);$('winMap').onclick=()=>showCampaignMap();$('winReplay').onclick=()=>startGame(false,g.sector);document.querySelectorAll('[data-pick]').forEach(el=>el.onclick=()=>{const x=opts[+el.dataset.pick];x.fn(g);g.upgrades[x.id]=(g.upgrades[x.id]||0)+1;g.pendingUpgrade=null;g.state='playing';enterSector(g.sector+1);saveRun();$('overlay').classList.add('hidden');$('hud').classList.add('show');toast('УЛУЧШЕНИЕ: '+x.name,2);})}
function flightPauseSettingsHTML(){
 if(!touchOnly||!game?.p?.flightUnlocked)return '';
 const controls=[['horizontal','flightHorizontal','↔ ГОРИЗОНТАЛЬНАЯ'],['vertical','flightVertical','↕ ВЕРТИКАЛЬНАЯ']].map(([axis,id,label])=>{
  const value=Math.round(normalizeFlightThrottle(save.settings[id])*100);
  return `<div class="flightPauseControl"><label for="${id}PauseSlider">${label}<output id="${id}PauseValue" for="${id}PauseSlider">${value}%</output></label><input id="${id}PauseSlider" type="range" min="25" max="100" step="5" value="${value}" aria-label="${axis==='horizontal'?'Горизонтальная':'Вертикальная'} скорость полёта, процент от максимума"></div>`;
 }).join('');
 return `<section class="flightPauseSettings" role="group" aria-label="Настройка скоростей полёта"><strong>✈ СКОРОСТЬ ПОЛЁТА</strong><p>Выбери скорость движения и подъёма. Показана доля от максимума с учётом улучшений костюма.</p><div class="flightPauseControls">${controls}</div></section>`;
}
function pause(){
 if(!game||game.state!=='playing')return;
 closeArsenal();game.state='paused';saveRun();input.fire=false;
 if(document.pointerLockElement)document.exitPointerLock();
 panel(`<div class="eyebrow">ПРИОСТАНОВЛЕНО</div><h1>ПАУЗА <span class="accent">Ⅱ</span></h1><p class="lede">Сектор ${game.sector}. Уничтожено ${game.kills} противников. Очки: ${game.score.toLocaleString('ru')}.</p><div class="row"><button class="primary" id="unpause">▶ ПРОДОЛЖИТЬ</button><button id="toMenu" class="secondary">⌂ В МЕНЮ</button><button id="pauseCampaign" class="secondary">◈ КАРТА УРОВНЕЙ</button></div><div class="backupActions"><button class="secondary" data-export-save>⬇ РЕЗЕРВНАЯ КОПИЯ</button><button class="secondary" data-import-save>⬆ ИМПОРТ</button></div><div class="note">${storageAvailable?'✓ Прогресс сохранён на этом устройстве':'⚠ Хранилище браузера недоступно — экспортируй сохранение!'}. При переходе в другой браузер или открытии HTML по другому пути используй экспорт/импорт.</div>${fpsSettingsHTML('pauseFpsLimit')}${dashDistanceSettingsHTML()}${flightPauseSettingsHTML()}<div class="line"></div><div class="row"><button class="secondary" id="cameraToggle">◫ КАМЕРА: ${cameraModeLabel()} (F5)</button><button class="secondary" id="mute">${save.settings.audio?'🔊 ЗВУК ВКЛ':'🔈 ЗВУК ВЫКЛ'}</button><button class="secondary" id="aim">${save.settings.aim?'⊕ АВТОНАВЕДЕНИЕ ВКЛ':'⊙ АВТОНАВЕДЕНИЕ ВЫКЛ'}</button><button class="secondary" id="quality">${['◈ ГРАФИКА: ЭКОНОМНАЯ','✧ ГРАФИКА: ВЫСОКАЯ','✦ ГРАФИКА: КИНО'][clamp(save.settings.quality|0,0,2)]}</button></div>`);
 $('unpause').onclick=unpauseGame;
 $('toMenu').onclick=()=>{saveRun();menu()};
 $('pauseCampaign').onclick=()=>showCampaignMap();
 $('cameraToggle').onclick=()=>{toggleCameraMode();pauseRefresh()};
 $('mute').onclick=()=>{save.settings.audio=!save.settings.audio;persist();pauseRefresh()};
 $('aim').onclick=()=>{save.settings.aim=!save.settings.aim;persist();pauseRefresh()};
 $('quality').onclick=()=>{save.settings.quality=(save.settings.quality+1)%3;persist();createWorldMesh(game.sector);resize();pauseRefresh()};
 wireBackupButtons();wireFpsSettings();wireDashDistanceSettings();wireFlightPauseSettings();
}
function pauseRefresh(){
 if(game?.state!=='paused')return;
 // Changing camera/settings redraws the SAME pause menu, so keep its scroll.
 // Opening a different screen instead goes to the heading via panel().
 const pane=$('panel');
 const scroll=pane?.scrollTop||0;
 game.state='playing';pause();
 if(pane)pane.scrollTop=scroll;
}
function gameOver(){if(!game||game.state==='dead')return;closeArsenal();const g=game;g.state='dead';input.fire=false;save.checkpoint=null;const recovery=defeatRecoveryCredits(g);save.credits+=Math.floor(g.score/350)+recovery;save.best=Math.max(save.best,g.sector);persist();if(document.pointerLockElement)document.exitPointerLock();panel(`<div class="eyebrow">▣ СИГНАЛ ПОТЕРЯН</div><div class="logo">СИСТЕМА <em>ПОВРЕЖДЕНА</em></div><div class="lede">Твоё путешествие завершилось, но добытые технологии остались в ангаре. Следующий забег может стать сильнее.</div><div class="note">Данные противника сохранены: <b class="accent">+${recovery} ◈</b> кредитов за прогресс этой попытки. Если было трудно, попробуй усилить костюм и основное оружие.</div><div class="quickstats"><div><b>${g.sector}</b><span>СЕКТОР</span></div><div><b>${g.kills}</b><span>ПОБЕД</span></div><div><b>${g.score.toLocaleString('ru')}</b><span>ОЧКИ</span></div></div><div class="row"><button class="primary" id="retry">↻ СНОВА В БОЙ</button><button class="secondary" id="backMenu">⌂ МЕНЮ</button><button class="secondary" id="gameOverMap">◈ КАРТА УРОВНЕЙ</button></div>`);$('retry').onclick=()=>startGame(false,g.sector);$('backMenu').onclick=menu;$('gameOverMap').onclick=()=>showCampaignMap()}
function switchWeapon(to){if(!game||game.state!=='playing')return;const p=game.p;p.equipAnim=.9;p.weapon=to===undefined?(p.weapon+1)%weapons.length:clamp(to,0,weapons.length-1);p.cooldown=.18;$('gun').dataset.gun=String(p.weapon);$('gun').style.setProperty('--weapon-glow',`rgb(${weapons[p.weapon].color.map(v=>Math.round(v*255)).join(',')})`);toast(weapons[p.weapon].name,.8);sound(360,.06,'square',.05)}

let ac=null;function audioStart(){if(!save.settings.audio)return;try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();ac.resume?.()}catch(e){}}
function sound(freq=220,duration=.07,type='triangle',vol=.07){if(!ac||!save.settings.audio)return;try{let osc=ac.createOscillator(),gain=ac.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,ac.currentTime);osc.frequency.exponentialRampToValueAtTime(Math.max(freq*.6,30),ac.currentTime+duration);gain.gain.setValueAtTime(vol,ac.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ac.currentTime+duration);osc.connect(gain);gain.connect(ac.destination);osc.start();osc.stop(ac.currentTime+duration+.01)}catch(e){}}

// ===== DIRECTOR'S CUT / integrated runtime (same lexical scope as engine) =====
const dc={hitUntil:0,killUntil:0,showBadgeUntil:0,splashUntil:0,weaponUntil:0,shake:0,lastTarget:0,canvasNoise:null,noiseBuffer:null,
  lastHealth:0,splashShown:0};
function dcNamedEnemy(e){
  if(e.boss)return 'ВЛАДЫКА РАЗЛОМА';
  if(e.elite)return 'ЭЛИТНЫЙ БОЕВОЙ РОБОТ';
  return ({scout:'РАЗВЕДЧИК',charger:'ШТУРМОВИК',brute:'ТЯЖЁЛЫЙ ДРОИД',sniper:'СНАЙПЕР',medic:'РЕМОНТНЫЙ ДРОН',shooter:'СТРЕЛОК',warden:'СТРАЖ БАРЬЕРА',artillery:'АРТИЛЛЕРИСТ',raider:'КВАНТОВЫЙ РЕЙДЕР',interceptor:'НЕБЕСНЫЙ ПЕРЕХВАТЧИК',drone:'НЕБЕСНЫЙ ПЕРЕХВАТЧИК',skyhunter:'ФАЗОВЫЙ ОХОТНИК',skyguard:'НЕБЕСНЫЙ СТРАЖ',stormray:'ГРОЗОВОЙ СКАТ'})[e.type]||'БОЕВАЯ МАШИНА';
}
function dcBadge(message,duration=1.05){
  const el=$('combatBadge');if(!el)return;
  el.textContent=message;el.classList.add('visible');
  dc.showBadgeUntil=performance.now()+duration*1000;
}
function dcWeaponFlash(message){
  const el=$('weaponBanner');if(!el)return;
  el.textContent=message;el.classList.add('visible');
  dc.weaponUntil=performance.now()+1000;
}
function dcSplash(level){
  const el=$('missionSplash');
  if(!el)return;
  const mt=missionInfo(level);
  el.querySelector('.dcIndex').textContent='ECLIPSE PROTOCOL  /  ОПЕРАЦИЯ '+String(level).padStart(3,'0');
  el.querySelector('.dcTitle').textContent=stageName(level);
  el.querySelector('.dcSub').textContent=mt.name+'  •  '+mt.hint;
  el.classList.add('visible');
  dc.splashUntil=performance.now()+1900;
}
// Layered audio: subtle buffered transients, synthesized locally without files.
function dcAudioTransient(w){
 if(!ac||!save.settings.audio)return;
 try{
  if(!dc.noiseBuffer){
    const length=Math.ceil(ac.sampleRate*.20),buf=ac.createBuffer(1,length,ac.sampleRate),dat=buf.getChannelData(0);
    for(let i=0;i<length;i++)dat[i]=(Math.random()*2-1)*Math.exp(-i/(length*.17));
    dc.noiseBuffer=buf;
  }
  const src=ac.createBufferSource(),filter=ac.createBiquadFilter(),gain=ac.createGain();
  src.buffer=dc.noiseBuffer;
  const heavy=!!w.blast||!!w.pierce,shotgun=w.shots>1;
  filter.type='bandpass';filter.frequency.value=heavy?590:shotgun?1100:1900;filter.Q.value=0.8;
  const volume=heavy?.076:shotgun?.060:.028;
  gain.gain.setValueAtTime(volume,ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001,ac.currentTime+(heavy?.20:.095));
  src.connect(filter);filter.connect(gain);gain.connect(ac.destination);
  src.start(ac.currentTime);src.stop(ac.currentTime+.20);
 }catch(e){}
}
const dcMuzzleBase=muzzleVisual;
muzzleVisual=function(w){dcMuzzleBase(w);dc.shake=Math.min(.4,dc.shake+(w.recoil||.2)*.10);dcAudioTransient(w);};
const dcDamageBase=damagePlayer;
damagePlayer=function(value){
  const hp=game?.p?.hp,armor=game?.p?.armor;
  const result=dcDamageBase(value);
  if(game && (game.p.hp<hp||game.p.armor<armor)){
    dc.shake=Math.min(.48,dc.shake+.17);
    const el=$('warningFrame');if(el){el.style.opacity=String(clamp(.22+value*.011,.32,.85));}
  }
  return result;
};
const dcDamageNumberBase=showDamage;
showDamage=function(e,amount,critical){
  dcDamageNumberBase(e,amount,critical);
  const now=performance.now(),c=$('crosshair');
  dc.hitUntil=now+170;
  if(c){c.classList.add('dcHit');}
  if(critical && game && Math.random()<.42)dcBadge('◆ КРИТИЧЕСКОЕ ПОПАДАНИЕ',.63);
};
const dcAwardKillBase=awardKill;
awardKill=function(e){
  const result=dcAwardKillBase(e);
  dc.killUntil=performance.now()+290;
  const c=$('crosshair');if(c)c.classList.add('dcKill');
  if(e.boss)dcBadge('✦ ПОВЕЛИТЕЛЬ ПОВЕРЖЕН',2.3);
  else if(e.elite)dcBadge('✦ ЭЛИТНАЯ ЦЕЛЬ УНИЧТОЖЕНА',1.3);
  else if(game && game.combo>1 && game.combo%4===0)dcBadge('✦ СЕРИЯ '+game.combo+' УНИЧТОЖЕНИЙ',1.0);
  return result;
};
const dcSwitchBase=switchWeapon;
switchWeapon=function(to){
  const old=game?.p?.weapon;
  const result=dcSwitchBase(to);
  if(game && old!==game.p.weapon){
    const w=weapons[game.p.weapon];
    dcWeaponFlash('◈ '+w.name+'  ·  '+Math.round(w.damage)+' УРОНА');
  }
  return result;
};
const dcEnterSectorBase=enterSector;
enterSector=function(level){
  const result=dcEnterSectorBase(level);
  if(game){dcSplash(level);dc.shake=0;dc.lastHealth=game.p.hp;}
  return result;
};
const dcRenderBase=render;
render=function(){
  dcRenderBase();
  if(!game)return;
  const g=game,p=g.p,now=performance.now();
  const c=$('crosshair');
  if(c){
    if(dc.hitUntil<now)c.classList.remove('dcHit');
    if(dc.killUntil<now)c.classList.remove('dcKill');
  }
  if(dc.showBadgeUntil<now)$('combatBadge')?.classList.remove('visible');
  if(dc.weaponUntil<now)$('weaponBanner')?.classList.remove('visible');
  if(dc.splashUntil<now)$('missionSplash')?.classList.remove('visible');
  const hit=$('warningFrame');if(hit){hit.style.opacity=String(Math.max(0,Number(hit.style.opacity||0)-.085));}
  // Dynamic target intelligence: only a visible target near the crosshair.
  if(now-dc.lastTarget>90){
    dc.lastTarget=now;
    const intel=$('targetIntel');
    if(intel && g.state==='playing'){
      let target=null,rank=-1;
      for(const e of g.enemies){
        if(e.dead)continue;
        const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz);
        if(d<1||d>22||!lineClear(p.x,p.z,e.x,e.z))continue;
        const a=Math.atan2(dx,dz)-p.yaw;
        const theta=Math.atan2(Math.sin(a),Math.cos(a));
        const center=Math.abs(theta),hY=(Number.isFinite(e.feetY)?e.feetY:0)+1.05-(p.feetY||0)-1.47;
        const pitch=Math.atan2(hY,d);
        const error=center+Math.abs(pitch-p.pitch)*.7;
        if(error<.19&&(rank<0||error<rank)){target=e;rank=error;}
      }
      if(target){
        intel.querySelector('.dcTargetTitle').textContent=dcNamedEnemy(target)+'  ·  '+Math.ceil(target.hp)+' HP';
        intel.querySelector('.dcTargetFill').style.width=(clamp(target.hp/Math.max(1,target.maxhp),0,1)*100)+'%';
        intel.classList.add('visible');
      }else intel.classList.remove('visible');
    }else intel?.classList.remove('visible');
  }
  dc.shake*=.86;
  // Recoil and movement response are non-destructive screen offsets; the
  // actual projection/collision direction stays unchanged.
  if(dc.shake>.012){
    const px=(Math.random()-.5)*dc.shake*7,py=(Math.random()-.5)*dc.shake*5;
    glCanvas.style.transform='translate('+px.toFixed(2)+'px,'+py.toFixed(2)+'px) scale(1.006)';
  }else if(glCanvas.style.transform)glCanvas.style.transform='';
};
// An immersive mission tile in the hub; inherited persistence and campaign logic.
const dcUpgradeBase=showUpgrade;
showUpgrade=function(savedIDs=null){
 dc.splashUntil=0;$('missionSplash')?.classList.remove('visible');
 return dcUpgradeBase(savedIDs);
};
const dcPauseBase=pause;
pause=function(){
 dc.splashUntil=0;$('missionSplash')?.classList.remove('visible');
 return dcPauseBase();
};

const dcUpdateBase=update;
update=function(dt){
  if(game?.state==='playing' && performance.now()<dc.splashUntil){input.jumpQueued=false;return;}
  return dcUpdateBase(dt);
};

// Atmospheric sci-fi hangar vista behind all menus, generated inside the HTML.
const dcMenuCanvas=document.createElement('canvas');dcMenuCanvas.id='dcMenuScene';
dcMenuCanvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:.72';
const dcOverlay=$('overlay');dcOverlay.insertBefore(dcMenuCanvas,dcOverlay.firstChild);
const dcMenuCtx=dcMenuCanvas.getContext('2d',{alpha:false});let dcSceneW=0,dcSceneH=0,dcSceneDirty=true;
function dcMenuResize(){
 const dpr=Math.min(1.25,devicePixelRatio||1);dcSceneW=innerWidth;dcSceneH=innerHeight;
 dcMenuCanvas.width=Math.max(1,Math.round(dcSceneW*dpr));dcMenuCanvas.height=Math.max(1,Math.round(dcSceneH*dpr));dcMenuCtx.setTransform(dpr,0,0,dpr,0,0);
 dcSceneDirty=true;requestAnimationFrame(dcDrawMenu);
}
addEventListener('resize',dcMenuResize);dcMenuResize();
function dcDrawMenu(now){
 if(dcOverlay.classList.contains('hidden')||!dcSceneDirty)return;
 dcSceneDirty=false;
 const ctx=dcMenuCtx,w=dcSceneW,h=dcSceneH,vx=w*.5,vy=h*.42,t=now*.00012;
 const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#04101a');sky.addColorStop(.5,'#0a242a');sky.addColorStop(1,'#030b11');
 ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 const glow=ctx.createRadialGradient(vx,vy,1,vx,vy,w*.44);glow.addColorStop(0,'rgba(71,217,185,.18)');glow.addColorStop(.4,'rgba(22,88,94,.08)');glow.addColorStop(1,'rgba(12,32,40,0)');
 ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
 ctx.save();ctx.translate(vx,vy);ctx.rotate(t*.3);
 for(const radius of [54,81,117]){ctx.strokeStyle='rgba(122,231,206,'+(radius===81?.28:.11)+')';ctx.lineWidth=radius===81?3:1.2;ctx.beginPath();ctx.arc(0,0,radius,0,TAU);ctx.stroke();}
 for(let k=0;k<20;k++){const a=k*TAU/20,rad=117;ctx.beginPath();ctx.moveTo(rad*.87*Math.cos(a),rad*.87*Math.sin(a));ctx.lineTo(rad*1.12*Math.cos(a),rad*1.12*Math.sin(a));ctx.strokeStyle=k%2?'rgba(226,172,109,.17)':'rgba(124,224,202,.27)';ctx.stroke();}
 ctx.restore();
 // Deep industrial tunnel: perspective rails, vertical struts and ceiling ribs.
 for(const side of [-1,1]){
   ctx.strokeStyle='rgba(106,196,192,.11)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(vx,vy);ctx.lineTo(vx+side*w*.78,h);ctx.stroke();
   for(let i=0;i<11;i++){
     const z=(i+.8)/11,scale=Math.pow(z,1.65),x=vx+side*(55+scale*w*.59),top=vy-scale*h*.43,bot=vy+scale*h*.64;
     ctx.fillStyle='rgba(5,14,19,'+(.31+.32*scale)+')';
     ctx.beginPath();ctx.moveTo(x-side*18*scale,bot);ctx.lineTo(x+side*19*scale,bot);ctx.lineTo(x+side*9*scale,top);ctx.lineTo(x-side*11*scale,top);ctx.closePath();ctx.fill();
     ctx.strokeStyle='rgba(114,204,191,'+(.10+.14*scale)+')';ctx.lineWidth=1+2*scale;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bot);ctx.stroke();
   }
 }
 for(let i=1;i<9;i++){
   let y=vy+Math.pow(i/9,1.55)*(h-vy);
   ctx.strokeStyle='rgba(132,195,186,'+(.045+.095*i/9)+')';ctx.lineWidth=1+i/7;
   ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();
 }
 for(let i=0;i<50;i++){
   const x=(i*103.7 + now*.004*(i%3+1))%w,y=(i*83.5 + 16*Math.sin(t*9+i)+h*.24)%h;
   ctx.fillStyle='rgba(160,229,206,'+(.03+.05*(.5+.5*Math.sin(t*19+i)))+')';ctx.fillRect(x,y,1.3,1.3);
 }
 let vg=ctx.createLinearGradient(0,0,w,0);vg.addColorStop(0,'rgba(1,8,13,.82)');vg.addColorStop(.3,'rgba(1,8,13,.12)');vg.addColorStop(.7,'rgba(1,8,13,.12)');vg.addColorStop(1,'rgba(1,8,13,.82)');ctx.fillStyle=vg;ctx.fillRect(0,0,w,h);
}
// Pause/map/login screens use a single static backdrop. Repeated 2D canvas
// compositing on a 120-Hz monitor wasted GPU power even without gameplay.
new MutationObserver(()=>{if(!dcOverlay.classList.contains('hidden')){dcSceneDirty=true;requestAnimationFrame(dcDrawMenu);}})
 .observe(dcOverlay,{attributes:true,attributeFilter:['class']});
requestAnimationFrame(dcDrawMenu);

const dcMenuBase=menu;
menu=function(){
  dc.splashUntil=0;$('missionSplash')?.classList.remove('visible');
  dcMenuBase();
  const panel=$('panel');if(!panel)return;
  const element=document.createElement('section');element.className='dcMissionCard';
  const level=save.campaign.highestUnlocked,info=missionInfo(level);
  element.style.cssText='display:flex;gap:13px;align-items:center;justify-content:space-between;border:1px solid #8dbdb565;border-left:3px solid #eac18b;border-radius:7px;background:linear-gradient(105deg,#263c3bcc,#0b202ab9);padding:12px 15px;margin:13px 0;';
  element.innerHTML='<div><small style="display:block;color:#eac18b;font-size:10px;letter-spacing:.18em;font-weight:850">СЛЕДУЮЩАЯ ОПЕРАЦИЯ · '+String(level).padStart(2,'0')+'</small><strong style="display:block;color:#eef4ed;font-size:15px;margin-top:3px">'+stageName(level)+'</strong><span style="display:block;color:#a7c7c4;font-size:11px;margin-top:3px">'+info.name+' · '+info.hint+'</span></div><div style="color:#f4cf9a;font-size:23px">'+info.icon+'</div>';
  const stats=panel.querySelector('.quickstats');
  if(stats)stats.insertAdjacentElement('beforebegin',element);
};

let adaptiveScale=1,performanceSlow=0,performanceFast=0;function resize(){let dpr=glReady?Math.min(devicePixelRatio||1,save.settings.quality===0?(touchOnly?1.0:1.2):save.settings.quality===1?(touchOnly?1.18:1.65):(touchOnly?1.30:1.8)):Math.min(devicePixelRatio||1,1.2);dpr*=adaptiveScale;const w=Math.round(innerWidth*dpr),h=Math.round(innerHeight*dpr);if(glCanvas.width!==w||glCanvas.height!==h){glCanvas.width=w;glCanvas.height=h;glCanvas.style.width=innerWidth+'px';glCanvas.style.height=innerHeight+'px';if(glReady)gl.viewport(0,0,w,h)}}addEventListener('resize',resize);

function refreshFlightButtons(){
 const p=game?.p,eligible=!!p?.flightUnlocked,active=eligible&&!!p?.flying;
 document.body.classList.toggle('flightUnlocked',eligible);
 document.body.classList.toggle('flying',active);
 const toggle=$('flightToggle');
 if(toggle){toggle.setAttribute('aria-pressed',String(active));toggle.textContent=active?'✈ ЛЕЧУ':'✈ ПОЛЁТ';}
 refreshFlightTuning();
}
function setFlightThrottle(axis,value,commit=false){
 if(!['horizontal','vertical'].includes(axis))return;
 const key=axis==='horizontal'?'flightHorizontal':'flightVertical';
 save.settings[key]=normalizeFlightThrottle(value);
 refreshFlightTuning();
 if(commit)persist();
}
function refreshFlightTuning(){
 for(const [axis,id] of [['horizontal','flightHorizontal'],['vertical','flightVertical']]){
  const ratio=normalizeFlightThrottle(save.settings[id]);
  for(const suffix of ['','Pause']){
   const slider=$(id+suffix+'Slider'),value=$(id+suffix+'Value');if(!slider||!value)continue;
   slider.value=String(Math.round(ratio*100));
   value.textContent=Math.round(ratio*100)+'%';
   value.title='Доступно '+(axis==='horizontal'?(3.05*flightSpeedMultiplier(axis)).toFixed(2):(FLIGHT_SPEED*flightSpeedMultiplier(axis)).toFixed(2))+' м/с';
  }
 }
}
for(const [axis,id] of [['horizontal','flightHorizontal'],['vertical','flightVertical']]){
 const slider=$(id+'Slider');
 slider.addEventListener('input',()=>setFlightThrottle(axis,Number(slider.value)/100));
 slider.addEventListener('change',()=>setFlightThrottle(axis,Number(slider.value)/100,true));
 for(const action of ['pointerdown','pointermove','pointerup'])slider.addEventListener(action,e=>e.stopPropagation());
}
// The mobile pause panel is recreated after camera/settings changes, so its
// sliders must be rebound each time. The HUD controls remain desktop-only.
function wireFlightPauseSettings(){
 for(const [axis,id] of [['horizontal','flightHorizontal'],['vertical','flightVertical']]){
  const slider=$(id+'PauseSlider');if(!slider)continue;
  slider.addEventListener('input',()=>setFlightThrottle(axis,Number(slider.value)/100));
  slider.addEventListener('change',()=>setFlightThrottle(axis,Number(slider.value)/100,true));
  for(const action of ['pointerdown','pointermove','pointerup'])slider.addEventListener(action,e=>e.stopPropagation());
 }
 refreshFlightTuning();
}
// Enter on an input invokes the exact associated action, just like clicking
// its adjacent primary button. Password changes never accidentally log in.
const INPUT_ENTER_ACTIONS={devPass:'devLogin',devOld:'devChange',devNew:'devChange',devStageNumber:'devStageGo'};
addEventListener('keydown',e=>{
 if(e.key!=='Enter'||e.repeat||!e.target?.matches?.('#overlay input'))return;
 const action=$(INPUT_ENTER_ACTIONS[e.target.id]);
 if(action&&!action.disabled){e.preventDefault();e.stopImmediatePropagation();action.click();}
},true);
let lastDashRangeArrowAt=-Infinity;
function keydown(e){
 if(e.target?.matches?.('input,textarea,select')&&!e.target.matches('#gl'))return;
 if(e.code==='F5'&&game&&['playing','paused'].includes(game.state)){e.preventDefault();if(!e.repeat)toggleCameraMode();return;}
 if((e.code==='ArrowUp'||e.code==='ArrowDown')&&game?.state==='playing'&&!touchOnly&&!e.altKey&&!arsenalOpened){
  e.preventDefault();
  const alreadyHeld=!!input.keys[e.code];
  input.keys[e.code]=true;
  if(!alreadyHeld){
   stepDashRange(e.code==='ArrowUp'?1:-1);
   lastDashRangeArrowAt=performance.now();
  }
  return;
 }
 if(e.code==='KeyW'&&!e.repeat&&game?.state==='playing'&&!arsenalOpened){const now=performance.now();input.sprint=now-input.lastWAt<325;input.lastWAt=now;}
 input.keys[e.code]=true;if(!game||game.state!=='playing')return;if(['Space','ShiftLeft','ShiftRight','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();if(e.code==='Space')input.jumpHeld=true;if(e.repeat)return;if(e.code==='Space'){const now=performance.now();if(game.p.flightUnlocked&&now-input.lastSpaceAt<340){toggleFlight();input.lastSpaceAt=-Infinity;}else{if(!game.p.flying)queueJump();input.lastSpaceAt=now;}}if(e.code==='KeyV')toggleFlight();if(e.code==='KeyE')useAbility('dash');if(e.code==='KeyQ')useAbility('pulse');if(e.code==='KeyC')useAbility('shield');if(e.code==='KeyF')useAbility('heal');if(game.p.flightUnlocked&&['BracketLeft','BracketRight','Comma','Period'].includes(e.code)){const axis=['BracketLeft','BracketRight'].includes(e.code)?'horizontal':'vertical',delta=['BracketRight','Period'].includes(e.code)?.10:-.10;setFlightThrottle(axis,save.settings[axis==='horizontal'?'flightHorizontal':'flightVertical']+delta,true);}if(e.code==='KeyP')pause();if(e.code==='KeyR'){toggleArsenal();e.preventDefault();}if(e.code==='KeyG'){toggleFullscreen();e.preventDefault()};if(/^Digit[1-9]$/.test(e.code))switchWeapon(+e.code.slice(-1)-1);if(e.code==='Digit0')switchWeapon(9)}addEventListener('keydown',keydown);addEventListener('keyup',e=>{if(e.code==='KeyW')input.sprint=false;if(e.code==='Space')input.jumpHeld=false;input.keys[e.code]=false});function resetTransientInput(){
 input.keys={};input.sprint=false;input.lastWAt=-Infinity;
 input.fire=false;input.jumpQueued=false;input.jumpHeld=false;
 input.flyUp=false;input.flyDown=false;input.lastSpaceAt=-Infinity;input.mx=0;input.mz=0;
 if(input.pid!==null){try{glCanvas.releasePointerCapture(input.pid)}catch(_){}}
 input.pid=null;input.tapMoved=false;
 if(input.joyId!==null){try{$('joystick').releasePointerCapture(input.joyId)}catch(_){}}
 input.joyId=null;
 const stick=$('stick');if(stick)stick.style.transform='translate(0,0)';
 if(game?.state==='playing')pause();
}
addEventListener('blur',resetTransientInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden)resetTransientInput()});
addEventListener('keydown',e=>{if(e.code!=='Escape'||e.repeat)return;if(game?.state==='playing'){e.preventDefault();pause()}else if(game?.state==='paused'){e.preventDefault();unpauseGame()}else if(!game&&document.querySelector('[data-up]')&&$('back')){e.preventDefault();$('back').click()}});glCanvas.addEventListener('mousedown',e=>{if(!game||game.state!=='playing')return;if(e.button===0){input.fire=true;if(!touchOnly&&!document.pointerLockElement){try{glCanvas.requestPointerLock?.()}catch(er){}}}});addEventListener('mouseup',()=>input.fire=false);glCanvas.addEventListener('contextmenu',e=>e.preventDefault());document.addEventListener('pointerlockchange',()=>{if(!touchOnly&&!document.pointerLockElement&&!fullscreenTransition&&game?.state==='playing'&&performance.now()>pauseResumeGraceUntil)pause()});glCanvas.addEventListener('mousemove',e=>{if(!game||game.state!=='playing'||touchOnly)return;if(document.pointerLockElement===glCanvas||input.fire){game.p.yaw-=(document.pointerLockElement?e.movementX:e.movementX)*.0032;game.p.pitch=clamp(game.p.pitch-e.movementY*.0029,-1.15,1.1)}});glCanvas.addEventListener('wheel',e=>{if(!game||game.state!=='playing')return;e.preventDefault();switchWeapon((game.p.weapon+(e.deltaY>0?1:weapons.length-1))%weapons.length)},{passive:false});
if(touchOnly){
  // A tap is a shot. A drag is camera movement, and MUST never shoot.
  // Touches on buttons/joystick don't reach this canvas, so they never fire.
  const TAP_DRIFT=12, TAP_MAX_MS=350;
  glCanvas.addEventListener('pointerdown',e=>{
    if(!game||game.state!=='playing'||e.pointerType!=='touch'||input.pid!==null)return;
    input.pid=e.pointerId;
    input.px=input.tapX=e.clientX;
    input.py=input.tapY=e.clientY;
    input.tapAt=performance.now();
    input.tapMoved=false;
    try{glCanvas.setPointerCapture(e.pointerId)}catch(_){}
    e.preventDefault();
  },{passive:false});
  glCanvas.addEventListener('pointermove',e=>{
    if(!game||game.state!=='playing'||e.pointerId!==input.pid)return;
    // Track movement from the initial touch, not just between frames.
    // Once a gesture becomes a look gesture it can never become a tap again.
    if(hypot(e.clientX-input.tapX,e.clientY-input.tapY)>TAP_DRIFT)input.tapMoved=true;
    const dx=e.clientX-input.px,dy=e.clientY-input.py;
    input.px=e.clientX;input.py=e.clientY;
    if(input.tapMoved){
      game.p.yaw-=dx*.0061;
      game.p.pitch=clamp(game.p.pitch-dy*.0048,-1.1,1.04);
    }
    e.preventDefault();
  },{passive:false});
  glCanvas.addEventListener('pointerup',e=>{
    if(e.pointerId!==input.pid)return;
    const tap=!input.tapMoved&&
      hypot(e.clientX-input.tapX,e.clientY-input.tapY)<=TAP_DRIFT&&
      performance.now()-input.tapAt<=TAP_MAX_MS;
    input.pid=null;
    input.tapMoved=false;
    e.preventDefault();
    if(tap&&!arsenalOpened&&game?.state==='playing')shoot();
  },{passive:false});
  glCanvas.addEventListener('pointercancel',e=>{
    if(e.pointerId===input.pid){input.pid=null;input.tapMoved=false}
  });
  let joy=$('joystick'),stick=$('stick');const joyPos=e=>{const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let x=e.clientX-cx,y=e.clientY-cy,lim=r.width*.35,mag=hypot(x,y)||1;if(mag>lim){x*=lim/mag;y*=lim/mag}input.mx=x/lim;input.mz=-y/lim;stick.style.transform=`translate(${x}px,${y}px)`};joy.addEventListener('pointerdown',e=>{if(input.joyId!==null){e.preventDefault();return;}input.joyId=e.pointerId;joy.setPointerCapture(e.pointerId);joyPos(e);e.preventDefault()});joy.addEventListener('pointermove',e=>{if(input.joyId===e.pointerId){joyPos(e);e.preventDefault()}});const endJoy=e=>{if(e.pointerId===input.joyId){input.mx=0;input.mz=0;input.joyId=null;stick.style.transform='translate(0,0)'}};joy.addEventListener('pointerup',endJoy);joy.addEventListener('pointercancel',endJoy);
[['dashTouch','dash'],['pulseTouch','pulse'],['shieldTouch','shield'],['healTouch','heal']].forEach(([id,ab])=>$(id).addEventListener('pointerdown',e=>{e.preventDefault();useAbility(ab)}));const runTouch=$('runTouch');
 runTouch.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();input.mobileSprint=!input.mobileSprint;runTouch.classList.toggle('running',input.mobileSprint);runTouch.setAttribute('aria-pressed',String(input.mobileSprint));},{passive:false});
 // Touch camera mode is selected exclusively through the pause menu.
 const flyButton=$('flightToggle');
 flyButton.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();toggleFlight();},{passive:false});
 for(const [id,axis] of [['flightUp','flyUp'],['flightDown','flyDown']]){
  const button=$(id);let heldId=null;
  button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();heldId=e.pointerId;input[axis]=true;try{button.setPointerCapture(e.pointerId);}catch(_){}},{passive:false});
  const release=e=>{if(e.pointerId===heldId){input[axis]=false;heldId=null;}};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);
  button.addEventListener('lostpointercapture',()=>{input[axis]=false;heldId=null;});
 }
 const mobileSwitch=$('mobileSwitch');let weaponTouchAt=-Infinity;
 mobileSwitch.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch'||e.pointerType==='pen'){
   e.preventDefault();e.stopPropagation();weaponTouchAt=performance.now();toggleArsenal();
  }
 },{passive:false});
 mobileSwitch.addEventListener('click',e=>{if(performance.now()-weaponTouchAt>500)toggleArsenal();});$('jumpTouch').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();queueJump()});}
// Fullscreen is a browser permission, not a hidden external dependency.
let fullscreenTransition=false;
const fsEl=document.documentElement;
function updateFullscreenButtons(){
  let active=!!(document.fullscreenElement||document.webkitFullscreenElement);
  const b=$('fullscreenBtn');b.textContent=active?'⤢':'⛶';b.setAttribute('aria-pressed',String(active));
  b.setAttribute('aria-label',active?'Выйти из полноэкранного режима':'Включить полноэкранный режим');
  for(const el of document.querySelectorAll('[data-fs]'))el.textContent=active?'⤢ ВЫЙТИ ИЗ ПОЛНОГО ЭКРАНА':'⛶ ПОЛНЫЙ ЭКРАН';
  requestAnimationFrame(resize);
}
async function toggleFullscreen(){
  let enabled=!!(document.fullscreenElement||document.webkitFullscreenElement);
  fullscreenTransition=true;
  try{
    if(enabled){if(document.exitFullscreen)await document.exitFullscreen();else if(document.webkitExitFullscreen)document.webkitExitFullscreen();}
    else{
      if(fsEl.requestFullscreen)await fsEl.requestFullscreen({navigationUI:'hide'});
      else if(fsEl.webkitRequestFullscreen)fsEl.webkitRequestFullscreen();
      else throw Error('API not available');
    }
  }catch(err){toast('Полный экран недоступен в этом браузере. Попробуй меню браузера.',3);}
  finally{setTimeout(()=>{fullscreenTransition=false;updateFullscreenButtons();},160)}
}
$('fullscreenBtn').addEventListener('click',toggleFullscreen);
$('overlay').addEventListener('click',e=>{if(e.target.closest('[data-fs]'))toggleFullscreen()});
for(const event of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(event,updateFullscreenButtons);
updateFullscreenButtons();
$('pauseBtn').onclick=pause;
$('minimap').addEventListener('click',()=>{miniZoom=!miniZoom;drawMinimap();});
addEventListener('keydown',e=>{if(e.code==='KeyM'&&game?.state==='playing'){miniZoom=!miniZoom;drawMinimap();e.preventDefault();}});

let uiTick=0,perfTick=0,fpsSamples=0,fpsTotal=0;
let frameBudgetMs=0,fpsLoopState='',lastMeasuredFps=0,framesRenderedTotal=0;
function resetFpsPacing(){frameBudgetMs=0;fpsSamples=0;fpsTotal=0;perfTick=0;lastMeasuredFps=0;}
// Accumulated time produces 45 real draws/sec on a stable 60 Hz panel
// (3 of every 4 callbacks), rather than incorrectly dropping to 30.
function shouldRenderFpsFrame(elapsedMs,limit){
 if(limit===0){frameBudgetMs=0;return true;}
 const interval=1000/limit;
 frameBudgetMs=Math.min(interval*2,frameBudgetMs+Math.max(0,elapsedMs));
 if(frameBudgetMs+0.25<interval)return false;
 frameBudgetMs=Math.max(0,frameBudgetMs-interval);
 return true;
}
function frame(now){
 // While in menus/pause, do not wake the compositor at the monitor refresh
 // rate merely to discover that there is nothing to render. A short timer
 // checks for a return to combat; gameplay itself retains full-rate RAF.
 if(game?.state==='playing')requestAnimationFrame(frame);
 else setTimeout(()=>requestAnimationFrame(frame),125);
 const elapsedMs=lastFrame>0?Math.max(0,now-lastFrame):16.6667;
 const actual=Math.min(.25,elapsedMs/1000);
 const dt=Math.min(.035,actual);
 lastFrame=now;
 const state=game?.state||'menu';
 const cap=save.settings.fpsLimit;
 if(fpsLoopState!==state||elapsedMs>500){
  fpsLoopState=state;
  resetFpsPacing();
  frameBudgetMs=cap?1000/cap:0; // Render immediately after pause/resume/tab switch.
  $('fpsMeter').textContent='— FPS';
  $('fpsCorner').className='';
 }
 // Update movement, collisions, enemy AI, and gun cooldowns every browser tick.
 // Rendering is capped independently, so lowering FPS does not slow gameplay.
 if(state==='playing')update(dt);
 // No WebGL draw calls outside actual combat. Menus, pause, victory and the
 // campaign map keep the last frozen frame; the GPU is never fed a new one.
 const willDraw=state==='playing'&&shouldRenderFpsFrame(elapsedMs,cap);
 if(game&&state==='playing'&&willDraw){
  render();
  if(state==='playing'&&game?.state==='playing'){fpsSamples++;framesRenderedTotal++;}
 }
 if(state==='playing'){
  uiTick+=dt;
  if(uiTick>.08){uiTick=0;updateHud();}
  const sampleTime=Math.min(.25,elapsedMs/1000);
  fpsTotal+=sampleTime;
  perfTick+=sampleTime;
  if(perfTick>=.75){
    const fps=fpsSamples/Math.max(.001,fpsTotal);
    lastMeasuredFps=fps;
    $('fpsMeter').textContent=Math.round(fps)+' FPS';
    $('fpsCorner').title=(cap?`Лимит: ${cap} FPS`:'Без ограничения FPS')+` · Фактически: ${fps.toFixed(1)} FPS`;
    const reference=Math.min(cap||60,60);
    $('fpsCorner').className=fps<reference*.55?'fpsLow':fps<reference*.80?'fpsWarn':'';
    // Dynamic mobile resolution should compare against the selected cap, not hard-coded 60.
    if(glReady&&touchOnly&&save.settings.quality===1){
      performanceSlow=fps<Math.max(16,reference*.72)?performanceSlow+.75:Math.max(0,performanceSlow-.75);
      performanceFast=fps>Math.max(19,reference*.88)?performanceFast+.75:0;
      if(performanceSlow>3&&adaptiveScale>.73){adaptiveScale=.72;performanceSlow=0;resize();}
      if(performanceFast>9&&adaptiveScale<1){adaptiveScale=1;performanceFast=0;resize();}
    }
    perfTick=0;fpsTotal=0;fpsSamples=0;
  }
 }
}
// Developer-only telemetry, useful for checking live FPS limits without touching save data.
window.__fpsDiagnostics={get:()=>({limit:save.settings.fpsLimit,actualFps:lastMeasuredFps,rendered:framesRenderedTotal,state:game?.state||'menu'}),
 setLimit:v=>{save.settings.fpsLimit=normalizeFpsLimit(v);persist();resetFpsPacing();},
 simulate:(limit,refresh=60,seconds=10)=>{
  const n=Math.round(refresh*seconds),step=1000/refresh,interval=limit?1000/limit:0;let budget=0,draws=0;
  for(let i=0;i<n;i++){if(!limit){draws++;continue;}
    budget=Math.min(interval*2,budget+step);
    if(budget+.25>=interval){draws++;budget=Math.max(0,budget-interval);}
  }
  return draws/seconds;
 }};
try{if(glReady)initGL()}catch(err){glReady=false;console.error(err)}if(!glReady){document.body.classList.remove('webgl');fallCtx=glCanvas.getContext('2d',{alpha:false})||glCanvas.getContext('2d');console.warn('Using Canvas 3D fallback')}resize();menu();requestAnimationFrame(frame);
window.__neonOperationsTest={
 selectStage:n=>{startGame(false,n);return game?.sector},
 state:()=>game&&({sector:game.sector,state:game.state,mission:structuredClone(game.mission),devices:structuredClone(game.devices||[]),portalReady:game.portalReady,boss:game.boss&&{hp:game.boss.hp,phase3:game.boss.phase3,ultWarn:game.boss.ultWarn},enemies:game.enemies.map(e=>e.type)}),
 activateDevice:i=>{const d=game?.devices?.[i];if(!d)return false;completeDevice(game,d);return true},
 setBossPhase3:()=>{if(!game)return false;if(!game.boss&&!spawnEnemy('boss',true))return false;game.boss.hp=game.boss.maxhp*.18;updateEnemies(.016);return true},
 simulateJump:()=>{queueJump();return game?.p.grounded},
 completeHoldout:()=>{if(game?.mission?.type!=='holdout')return false;game.mission.surviveRemaining=0;maybeFinishMission(game);return game.portalReady},
 mapNames:()=>sectorArchitecture
};
window.__neonMissionTest={current:()=>game&&({sector:game.sector,mission:game.mission,portal:game.portalReady,spawned:game.spawned,target:game.target,enemies:game.enemies.length,event:game.arenaEvent}),forceClear:()=>{if(!game)return false;game.spawned=game.target;game.enemies=[];if(game.mission){game.mission.done=game.mission.required;for(const c of game.mission.caches)c.got=true;}maybeFinishMission(game);return game.portalReady},defeatEnemiesOnly:()=>{if(!game)return false;game.spawned=game.target;game.enemies=[];return maybeFinishMission(game)},missionTick:(dt=.016)=>updateMission(dt),collectOneCache:(i=0)=>{if(!game?.mission?.caches?.[i])return false;const c=game.mission.caches[i];game.p.x=c.x;game.p.z=c.z;game.p.feetY=floorHeight(c.x,c.z);updateMission(.016);return c.got;},selectStage:(n)=>{save.campaign.highestUnlocked=Math.max(save.campaign.highestUnlocked,n);startGame(false,n);},killCommander:()=>{if(!game?.mission)return;game.mission.done=1;maybeFinishMission(game)},collectAll:()=>{if(!game?.mission)return;for(const c of game.mission.caches)c.got=true;game.mission.done=game.mission.required;maybeFinishMission(game);},nextEvent:()=>{if(game?.arenaEvent){game.arenaEvent.phase='quiet';game.arenaEvent.countdown=.01;}},missionFor:missionType,checkpoint:()=>save.checkpoint};
window.__neonTest={debugDrone:()=>{if(!game)return null;const e=spawnEnemy('drone',false);if(!e)return null;e.x=game.p.x+5;e.z=game.p.z+4;e.feetY=floorHeight(e.x,e.z)+.8;return {type:e.type,y:e.feetY,hp:e.hp};},debugEnemyClimb:(frames=560)=>{if(!game||!bridgeSpecs.length)return null;const c=Math.floor(mapSize/2);game.p.x=c+.5;game.p.z=c+.5;game.p.feetY=BRIDGE_Y;game.p.vy=0;game.p.grounded=true;game.p.iframes=9999;game.spawned=game.target;game.enemies=[];const e=spawnEnemy('charger',false);if(!e)return null;e.x=c+14.5;e.z=c+.5;e.feetY=0;e.speed=2.8;e.attack=999;const samples=[];for(let k=0;k<frames;k++){updateEnemies(.016);if(k%45===0)samples.push([k,+e.x.toFixed(2),+e.feetY.toFixed(2)]);}return {enemy:{x:e.x,z:e.z,feetY:e.feetY},samples};},debugStart:()=>startGame(false),debugSector:(n)=>{if(!game)startGame(false);game.sector=n;enterSector(n);return {sector:game.sector,style:sectorStyle,architecture:sectorArchitecture};},debugUnder:()=>{if(!game||!bridgeSpecs.length)return null;const c=Math.floor(mapSize/2);game.p.x=c+.5;game.p.z=c+.5;game.p.feetY=0;game.p.vy=0;game.p.grounded=true;updateVertical(game.p,.016);return {surface:supportHeight(game.p,game.p.x,game.p.z),floor:floorHeight(game.p.x,game.p.z),deck:deckHeight(game.p.x,game.p.z),feet:game.p.feetY};},debugTop:()=>{if(!game||!bridgeSpecs.length)return null;const c=Math.floor(mapSize/2);game.p.x=c+.5;game.p.z=c+.5;game.p.feetY=BRIDGE_Y;game.p.vy=0;game.p.grounded=true;updateVertical(game.p,.016);return {surface:supportHeight(game.p,game.p.x,game.p.z),floor:floorHeight(game.p.x,game.p.z),deck:deckHeight(game.p.x,game.p.z),feet:game.p.feetY};},debugTraverse:(frames=360)=>{if(!game||!bridgeSpecs.length)return null;const c=Math.floor(mapSize/2),p=game.p;p.x=c+14.5;p.z=c+.5;p.feetY=0;p.vy=0;p.grounded=true;p.yaw=-Math.PI/2;game.waveDelay=1e6;input.keys.KeyW=true;const samples=[];for(let k=0;k<frames&&game.state==='playing';k++){update(.016);if(k%30===0)samples.push([k,p.x,p.feetY]);}input.keys.KeyW=false;return {x:p.x,z:p.z,y:p.feetY,grounded:p.grounded,samples};},debugDrop:(frames=190)=>{if(!game||!bridgeSpecs.length)return null;const c=Math.floor(mapSize/2),p=game.p;p.x=c+.5;p.z=c+.5;p.feetY=BRIDGE_Y;p.vy=0;p.grounded=true;p.yaw=0;game.waveDelay=1e6;input.keys.KeyW=true;const samples=[];for(let k=0;k<frames&&game.state==='playing';k++){update(.016);if(k%30===0)samples.push([k,p.z,p.feetY]);}input.keys.KeyW=false;return {z:p.z,y:p.feetY,grounded:p.grounded,samples};},debugLevelInfo:()=>({sector:game?.sector,player:game?{x:game.p.x,z:game.p.z,y:game.p.feetY,armor:game.p.armor}:null,mapSchema:save.checkpoint?.mapSchema}),bridge:()=>({specs:bridgeSpecs.map(x=>({...x})),cells:Array.from(deckCells).filter(x=>x>0).length,ceiling:ceilingHeight()}),bridgeAt:deckHeight,teleportBridge:()=>{if(!game||!bridgeSpecs.length)return false;const c=Math.floor(mapSize/2);game.p.x=c+.5;game.p.z=c+.5;game.p.feetY=BRIDGE_Y;game.p.vy=0;game.p.grounded=true;saveRun();return true;},vertical:()=>game?{feetY:game.p.feetY,vy:game.p.vy,grounded:game.p.grounded,ground:floorHeight(game.p.x,game.p.z),stages:stairStages.length,steps:[...new Set(Array.from(heightCells).map(h=>h.toFixed(2)))].sort()}:null,jump:queueJump,stairStages:()=>stairStages.map(s=>({...s})),groundHeight:floorHeight,setYaw:(a)=>{if(game)game.p.yaw=a;},playerPos:()=>game?{x:game.p.x,z:game.p.z,yaw:game.p.yaw}:null,currentStyle:()=>({sector:game?.sector,style:sectorStyle,arch:sectorArchitecture,themes:themes.length}),setDamage:(v=22)=>{if(game){game.p.armorDelay=0;game.p.armor=Math.max(0,game.p.armor-v);}},saveNow:()=>saveRun(),saveSummary:()=>({available:storageAvailable,snapshot:save.checkpoint&&{version:save.checkpoint.version,sector:save.checkpoint.sector,state:save.checkpoint.state,spawned:save.checkpoint.live?.spawned,player:save.checkpoint.player},credits:save.credits,kills:save.kills}),setPosition:(x,z)=>{if(game&&!collide(x,z,.22)){game.p.x=x;game.p.z=z;game.p.feetY=floorHeight(x,z);game.p.vy=0;game.p.grounded=true;saveRun();return true;}return false;},debugBuild:(n)=>{buildMap(n);if(game){game.p.x=spawnX;game.p.z=spawnZ;}},debugPortalReady:()=>{if(game)game.portalReady=true;},route:()=>game?.portalReady?portalRoute(game.p,500):[],mapInfo:()=>({mapCells:mapCells.map(row=>row.slice()),spawn:[spawnX,spawnZ],portal:[portal.x,portal.z],features:mapFeatures.map(f=>({x:f.x,z:f.z})),arch:sectorArchitecture,style:sectorStyle,size:mapSize,rooms:mapRooms.length,meshes:meshStats,webgl:glReady}),getState:()=>game&&({state:game.state,sector:game.sector,enemies:game.enemies.length,kills:game.kills,spawned:game.spawned,portalReady:game.portalReady,hp:game.p.hp,score:game.score,weapon:game.p.weapon,shots:game.p.shots,yaw:game.p.yaw,pitch:game.p.pitch}),nextSector:()=>{if(game){game.portalReady=true;game.p.x=portal.x;game.p.z=portal.z;portalNext()}},fire:shoot,weaponSelect:to=>switchWeapon(to),weaponList:()=>weapons.map(w=>({name:w.name,mode:w.mode,shots:w.shots})),nodes:()=>game?.nodes.map(n=>({x:n.x,z:n.z,type:n.type,hp:n.hp,dead:n.dead})),testAimNode:(i=0)=>{if(!game)return false;const n=game.nodes[i];if(!n||n.dead)return false;let p=game.p;const offsets=[[2,0],[-2,0],[0,2],[0,-2]];let pos=offsets.map(([x,z])=>({x:n.x+x,z:n.z+z})).find(q=>!collide(q.x,q.z,.24)&&lineClear(q.x,q.z,n.x,n.z));if(!pos)return false;p.x=pos.x;p.z=pos.z;p.yaw=Math.atan2(n.x-p.x,n.z-p.z);p.pitch=Math.atan2(1.3-1.47,hypot(n.x-p.x,n.z-p.z));return true;},damageNode:(i,d)=>game&&damagePowerNode(game.nodes[i],d),arsenal:()=>({opened:arsenalOpened,items:$('weaponDrawer').querySelectorAll('[data-wpn]').length}),effectCounts:()=>game&&({decals:game.decals.length,projectiles:game.projectiles.length,impacts:game.impactFx.length,tracers:game.tracers.length,scorch:game.scorch.length}),testAimWall:()=>{if(!game)return;const p=game.p;for(let i=0;i<48;i++){let a=TAU*i/48;const wall=rayWall({x:p.x,y:1.47,z:p.z},{x:Math.sin(a),y:0,z:Math.cos(a)},36);if(wall&&wall.t>1&&wall.t<34){p.yaw=a;p.pitch=0;return wall;}}},killAll:()=>{if(game){game.spawned=game.target;for(const e of [...game.enemies]){e.dead=true;awardKill(e)}game.enemies=[];game.portalReady=true}},boss:()=>{if(game){spawnEnemy('boss',true)}},campaign:()=>({...save.campaign}),campaignMap:()=>showCampaignMap(),campaignStart:(n)=>startGame(false,n),campaignClear:()=>{if(game){game.spawned=game.target;game.enemies=[];game.portalReady=true;portalNext();}},campaignPage:(p)=>showCampaignMap(p)};// Stage 3 diagnostics: inspect active world geometry on a real WebGL device.
Object.assign(window.__neonTest,{
 worldSolids:()=>({webgl:glReady,...worldSolidStats()}),
 traceWorld:(x,y,z,dx,dy,dz,len=10,r=0)=>{
  const magnitude=Math.hypot(dx,dy,dz)||1;
  const o={x,y,z},d={x:dx/magnitude,y:dy/magnitude,z:dz/magnitude};
  const h=r>0?sweepWorldSphere(o,d,len,r):rayWall(o,d,len);
  return h&&{t:h.t,x:h.x,y:h.y,z:h.z,kind:h.kind,nx:h.nx,ny:h.ny,nz:h.nz};
 }
});

// Stage 5 diagnostics: compare a visible robot attachment with its hit volume.
// Geometry comes from the active combat raycast, not a test-only duplicate.
Object.assign(window.__neonTest,{
 traceRobot:(x,y,z,dx,dy,dz,len=10)=>{
  const mag=Math.hypot(dx,dy,dz)||1;
  const h=rayEnemy({x,y,z},{x:dx/mag,y:dy/mag,z:dz/mag},len);
  return h&&{id:h.enemy.id,type:h.enemy.type,boss:!!h.enemy.boss,part:h.part,
    distance:h.t,x:h.x,y:h.y,z:h.z};
 }
});

// Stage 8 diagnostics: evaluate real 3D cover without spawning or damaging
// anything. Coordinates are foot positions in game world units (x, y, z).
Object.assign(window.__neonTest,{
 coverBetween:(x,y,z,X,Y,Z)=>enemyCombatClear(
  {x,z,feetY:y},{x:X,z:Z,feetY:Y}),
});

// Stage 9: device-side diagnostics to compare map navigation and 3D body
// clearance. Pure read-only probes; no weapon, score or save mutation.
Object.assign(window.__neonTest,{
 npcNav:(x,z,feetY=0,type='scout',radius=.55)=>{
  if(!game||![x,z,feetY,radius].every(Number.isFinite))return null;
  const e={x,z,feetY,type,radius,maxhp:100,boss:type==='boss',orbit:1,id:11};
  const tx=Math.floor(x),tz=Math.floor(z);
  return {at:[x,z,feetY],type,bodyHeight:enemyBodyHeight(e),
   canOccupy:enemyCanOccupy(e,x,z),tile:enemyNavTile(tx,tz),
   direct:enemyDirectRoute(e,game.p),
   distance:Math.hypot(game.p.x-x,game.p.z-z),
   webgl:glReady,solids:worldSolidCount,
   field:navField&&tx>=0&&tz>=0&&tx<mapSize&&tz<mapSize?
    navField[tz*mapSize+tx]:null};
 }
});

// Stage 10: read-only measurements of living robot spacing in the current scene.
// Unlike the route debugger this never inserts actors or modifies navigation.
Object.assign(window.__neonTest,{
 npcCrowd:()=>{
  if(!game)return null;
  const living=game.enemies.filter(e=>!e.dead);
  let overlapPairs=0,closestGap=null;
  for(let i=0;i<living.length;i++)for(let j=i+1;j<living.length;j++){
   const a=living[i],b=living[j],ay=Number.isFinite(a.feetY)?a.feetY:0,
         by=Number.isFinite(b.feetY)?b.feetY:0;
   if(ay+enemyBodyHeight(a)<=by+.03||by+enemyBodyHeight(b)<=ay+.03)continue;
   const gap=Math.hypot(a.x-b.x,a.z-b.z)-enemyCrowdRadius(a)-enemyCrowdRadius(b);
   if(closestGap===null||gap<closestGap)closestGap=gap;
   if(gap<-.02)overlapPairs++;
  }
  return {living:living.length,overlapPairs,closestGap,webgl:glReady};
 }
});

// Stage 11: read-only spawn-space probe for real-device diagnosis.
// In particular, a valid empty map cell is not necessarily an empty 3D
// volume when a boss, player, handrail or elevated robot occupies it.
Object.assign(window.__neonTest,{
 npcSpawnCheck:(x,z,r=.48,height=1.9)=>{
  if(!game||![x,z,r,height].every(Number.isFinite)||r<.1||height<.1)return null;
  return enemySpawnSpaceClear(x,z,r,height);
 }
});

// Stage 13: read-only status for camera, stamina and permanent upgrades.
Object.assign(window.__neonTest,{
 expansionStatus:()=>({camera:save.settings.cameraMode,
  perkLevels:save.perms.slice(),perkMaximum:PERM_MAX_LEVEL,
  energy:game?.p.energy??null,maxEnergy:game?.p.maxEnergy??null,
  dashRange:game?.p.dashRange??null,
  jumpHeld:input.jumpHeld,sprintTired:!!game?.p.sprintTired})
});

// Stage 14: public, read-only QA state. Never expose the password digest.
Object.assign(window.__neonTest,{
 developerFlightStatus:()=>({
  developerMode:devMode,creditsShown:developerCredits(),
  campaignAccessibleMaximum:devMode?CAMPAIGN_MAX_LEVEL:save.campaign.highestUnlocked,
  armorOwnedCount:Object.keys(save.bodyArmor.owned).length,
  equippedArmor:save.bodyArmor.equipped,
  equippedArmorLevel:save.bodyArmor.owned[save.bodyArmor.equipped]??null,
  flightUnlocked:!!game?.p.flightUnlocked,flying:!!game?.p.flying,
  flightAltitude:game?.p.feetY??null,ceilingHeight:game?ceilingHeight():null,
  skyPlatforms:game?skyDeckSpecs.length:null
 })
});

// Stage 15: inspect altitude on real hardware. Only the authenticated local
// developer sandbox can summon test robots; normal campaigns are unaffected.
Object.assign(window.__neonTest,{
 airRobotStatus:()=>game?game.enemies.filter(e=>e.airborne&&!e.dead).map(e=>({
  id:e.id,type:e.type,altitude:+e.feetY.toFixed(3),
  x:+e.x.toFixed(2),z:+e.z.toFixed(2),hp:+e.hp.toFixed(1),
  blocked:+(e.airLiftBlocked||0).toFixed(2)
 })):[],
 developerSummonFlyer:type=>{
  if(!devMode||game?.state!=='playing'||
    !['drone','skyhunter','skyguard','stormray'].includes(type))return null;
  const e=spawnEnemy(type,false);
  return e?{id:e.id,type:e.type,altitude:e.feetY}:null;
 }
});

})();
