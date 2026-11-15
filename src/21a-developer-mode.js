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
