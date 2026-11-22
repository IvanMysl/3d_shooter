// MP-1: ephemeral multiplayer lobby. No multiplayer data ever enters `save`.
// A publishable key (pk_live_...) may be embedded in a *published* HTML file.
// Never embed a Metered sk_ secret or TURN admin credentials here.
const MP_PUBLISHABLE_KEY='pk_live_3faca90fc2e0eb3f14b34a1bc453242cfe73e937';
// v44: host starts the match when P2P channels are connected. Player
// readiness/ready messages and roster fields are no longer part of protocol.
const MP_VERSION=44,MP_CAP=8,MP_PREFIX='NR-',MP_ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
// Shared campaign/PvP catalog: one stable ID and unique title per seeded sector.
const MP_MAPS=Object.freeze([
 ['citadel','ЦИТАДЕЛЬ'],['reactor','РЕАКТОРНЫЕ КОЛЬЦА'],['temple','БАСТИОНЫ НАД ПЛОЩАДЬЮ'],
 ['sky-docks','НЕБЕСНЫЕ ДОКИ'],['archives','АМФИТЕАТР КАРНИЗОВ'],['shipyards','ГРУЗОВЫЕ ВЕРФИ'],
 ['quarantine','ГОРОД БАЛКОНОВ'],['flooded','ЗАТОПЛЕННЫЙ ТРАНЗИТ'],['observatory','ЗВЁЗДНАЯ ОБСЕРВАТОРИЯ'],
 ['metro','КАМЕННЫЙ КАНЬОН'],['crystal','КРИСТАЛЬНАЯ ГАВАНЬ'],['forge','ТИТАНОВАЯ КУЗНЯ'],
 ['vertical','ВЕРТИКАЛЬНАЯ ВЕРФЬ'],['stairs','ЛЕСТНИЧНАЯ ЦИТАДЕЛЬ'],['collector','ВОЗДУШНЫЙ КОЛЛЕКТОР'],
 ['atrium','ТИТАНОВЫЙ АТРИУМ'],['cryo','КРИОГЕННЫЙ ШПИЛЬ'],['gravity','ГРАВИТАЦИОННАЯ ФАБРИКА'],
 ['sector-019','ЦИТАДЕЛЬ АЛЫХ ВОРОТ'],['sector-020','РЕАКТОРНЫЙ КОМПЛЕКС «ПУЛЬСАР»'],['sector-021','БАСТИОНЫ ЧЁРНОГО ОБЕЛИСКА'],
 ['sector-022','ДОКИ СЕВЕРНОГО ВЕТРА'],['sector-023','АМФИТЕАТР ЭХА'],['sector-024','ВЕРФИ «ЖЕЛЕЗНЫЙ ПРИЛИВ»'],
 ['sector-025','БАЛКОНЫ ЛУННОГО ГОРОДА'],['sector-026','ТРАНЗИТ «ГЛУБИНА»'],['sector-027','ОБСЕРВАТОРИЯ ОРИОНА'],
 ['sector-028','КАНЬОН КРАСНОГО КАМНЯ'],['sector-029','ГАВАНЬ СИНИХ КРИСТАЛЛОВ'],['sector-030','КУЗНЯ ЧЁРНОГО ТИТАНА'],
 ['sector-031','ВЕРТИКАЛЬНАЯ ВЕРФЬ «ЗЕНИТ»'],['sector-032','ЛЕСТНИЦЫ ОБСИДИАНА'],['sector-033','КОЛЛЕКТОР «СТРАТОСФЕРА»'],
 ['sector-034','АТРИУМ СЕРЕБРЯНЫХ БАШЕН'],['sector-035','ШПИЛЬ ВЕЧНОЙ МЕРЗЛОТЫ'],['sector-036','ФАБРИКА «СИНГУЛЯРНОСТЬ»'],
 ['sector-037','ЦИТАДЕЛЬ СЕМИ РУБЕЖЕЙ'],['sector-038','РЕАКТОРНЫЕ КОЛЬЦА «КВАЗАР»'],['sector-039','БАСТИОНЫ ПРОТОКОЛА «СТРАЖ»'],
 ['sector-040','ДОКИ «ГОРИЗОНТ»'],['sector-041','АМФИТЕАТР СЕВЕРНЫХ КАРНИЗОВ'],['sector-042','ВЕРФИ «МАГНИТНЫЙ ШТОРМ»'],
 ['sector-043','ГОРОД ВИСЯЧИХ ГАЛЕРЕЙ'],['sector-044','ТРАНЗИТ ПОД ВОДОРАЗДЕЛОМ'],['sector-045','ОБСЕРВАТОРИЯ «ПОЛЯРИС»'],
 ['sector-046','КАНЬОН РАЗЛОМЛЕННЫХ СКАЛ'],['sector-047','ГАВАНЬ АМЕТИСТА'],['sector-048','КУЗНЯ «ОГНЕННОЕ ЯДРО»'],
 ['sector-049','ВЕРФЬ ВОСХОДЯЩИХ ЯРУСОВ'],['sector-050','ЛЕСТНИЧНЫЙ ФОРТ «ЛАБИРИНТ»'],['sector-051','КОЛЛЕКТОР «ОБЛАЧНЫЙ ФРОНТ»'],
 ['sector-052','АТРИУМ «МЕРИДИАН»'],['sector-053','ШПИЛЬ «АБСОЛЮТНЫЙ НОЛЬ»'],['sector-054','ГРАВИТАЦИОННЫЙ УЗЕЛ «ОМЕГА»'],
 ['sector-055','ЦИТАДЕЛЬ ПЕПЕЛЬНЫХ СТЕН'],['sector-056','РЕАКТОР «ДВОЙНАЯ СПИРАЛЬ»'],['sector-057','БАСТИОНЫ ИЗУМРУДНОЙ ПЛОЩАДИ'],
 ['sector-058','ДОКИ «СОЛНЕЧНЫЙ ПАРУС»'],['sector-059','АМФИТЕАТР «КОРОНА»'],['sector-060','ВЕРФИ «ОРБИТАЛЬНЫЙ КРАН»'],
 ['sector-061','ГОРОД ТЕНЕВЫХ БАЛКОНОВ'],['sector-062','ТРАНЗИТ «НИЖНИЙ БЬЕФ»'],['sector-063','ОБСЕРВАТОРИЯ «АНДРОМЕДА»'],
 ['sector-064','КАНЬОН «РАСКОЛ»'],['sector-065','ГАВАНЬ СТЕКЛЯННЫХ СКАЛ'],['sector-066','КУЗНЯ «ЖИДКИЙ МЕТАЛЛ»'],
 ['sector-067','ВЕРТИКАЛЬНАЯ ВЕРФЬ «АТЛАНТ»'],['sector-068','ЛЕСТНИЦЫ «КАСКАД»'],['sector-069','КОЛЛЕКТОР «ЦИКЛОН»'],
 ['sector-070','АТРИУМ ЗОЛОТЫХ СВОДОВ'],['sector-071','ШПИЛЬ «МОРОЗНЫЙ ПИК»'],['sector-072','ФАБРИКА «АНТИГРАВ»'],
 ['sector-073','ЦИТАДЕЛЬ МЕДНЫХ ЩИТОВ'],['sector-074','РЕАКТОР «ТЕРМОЯДРО»'],['sector-075','БАСТИОНЫ «СУМЕРЕЧНЫЙ ФОРУМ»'],
 ['sector-076','ДОКИ «ВЕРХНИЙ ПРИЧАЛ»'],['sector-077','АМФИТЕАТР «РЕЗОНАНС»'],['sector-078','ВЕРФИ «СТАЛЬНАЯ ВОЛНА»'],
 ['sector-079','ГОРОД ПАРЯЩИХ ТЕРРАС'],['sector-080','ТРАНЗИТ «ПОДВОДНЫЙ ШЛЮЗ»'],['sector-081','ОБСЕРВАТОРИЯ «ТУМАННОСТЬ»'],
 ['sector-082','КАНЬОН БАЗАЛЬТОВЫХ ВРАТ'],['sector-083','ГАВАНЬ РУБИНОВЫХ ГРАНЕЙ'],['sector-084','КУЗНЯ «ФЕРРУМ»'],
 ['sector-085','ВЕРТИКАЛЬНАЯ ВЕРФЬ «ВЕКТОР»'],['sector-086','ЛЕСТНИЧНАЯ КРЕПОСТЬ «ПИРАМИДА»'],['sector-087','КОЛЛЕКТОР «СТРУЙНЫЙ ПОТОК»'],
 ['sector-088','АТРИУМ «ХРОНОС»'],['sector-089','ШПИЛЬ «ЛЕДЯНАЯ КОРОНА»'],['sector-090','ФАБРИКА «ГРАВИТОН»'],
 ['sector-091','ЦИТАДЕЛЬ ПОСЛЕДНЕГО КОЛЬЦА'],['sector-092','РЕАКТОР «СВЕРХНОВАЯ»'],['sector-093','БАСТИОНЫ «КРАЙ ЭКЛИПСА»'],
 ['sector-094','ДОКИ «ТЁМНАЯ ОРБИТА»'],['sector-095','АМФИТЕАТР БЕСКОНЕЧНЫХ КАРНИЗОВ'],['sector-096','ВЕРФИ «ПОСЛЕДНИЙ КОВЧЕГ»'],
 ['sector-097','ГОРОД «НЕБЕСНАЯ РЕШЁТКА»'],['sector-098','ТРАНЗИТ «БЕЗДНА»'],['sector-099','ОБСЕРВАТОРИЯ «ЭКЛИПС»'],
 ['sector-100','КАНЬОН ПОСЛЕДНЕГО РАЗЛОМА']
].map(([id,name],index)=>Object.freeze({id,name,sector:index+1})));
let mpWire=null,mpRoom=null,mpEpoch=0,mpPending=null,mpScreenError='',mpSignalingLost=false;
function mpSignalingOnline(){return !!(mpWire?.ws?.readyState===1&&!mpSignalingLost);}
function mpGamePeerLive(peer){return !!(typeof mpMatch!=='undefined'&&mpMatch?.active&&typeof mpRtcGameplayOpen==='function'&&mpRtcGameplayOpen(peer));}

function mpEscape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function mpNickname(value){
 const name=String(value||'').normalize('NFKC').replace(/\s+/gu,' ').trim();
 if(Array.from(name).length<2||Array.from(name).length>20||!(/^[\p{L}\p{M}\p{N}_ -]+$/u).test(name)||!(/[\p{L}\p{N}]/u).test(name))throw Error('Ник: 2–20 букв/цифр, пробел, дефис или подчёркивание.');
 return name;
}
function mpNickKey(value){
 return mpNickname(value).normalize('NFKC').toLocaleLowerCase('und')
  .replace(/ς/g,'σ').replace(/ß/g,'ss').normalize('NFC');
}
function mpRandom(bytes=16){
 if(!globalThis.crypto?.getRandomValues)throw Error('Браузер не поддерживает криптографически надёжные коды комнат.');
 const a=new Uint8Array(bytes);crypto.getRandomValues(a);let out='',bits=0,acc=0;
 for(const b of a){acc=(acc<<8)|b;bits+=8;while(bits>=5){bits-=5;out+=MP_ALPHABET[(acc>>>bits)&31];}}
 if(bits)out+=MP_ALPHABET[(acc<<(5-bits))&31];return out;
}
function mpCode(value){
 let raw=String(value||'').trim();
 if(raw.includes('mp=')){try{raw=new URL(raw,location.href).searchParams.get('mp')||'';}catch(_){raw='';}}
 raw=raw.toUpperCase().replace(/\s+/g,'');
 return /^NR-[A-Z2-7]{26}$/.test(raw)?raw:null;
}
function mpChannel(code){return 'neonrift3d-room-'+code.slice(3).toLowerCase();}
function mpMap(id){return MP_MAPS.find(m=>m.id===id)||null;}
function mpSettings(input){
 const o=input&&typeof input==='object'?input:{};
 const scoreLimit=[5,10,15,20,30,50].includes(o.scoreLimit)?o.scoreLimit:15;
 const timeLimitSec=[60,180,300,600,900].includes(o.timeLimitSec)?o.timeLimitSec:300;
 return {mode:o.mode==='teams'?'teams':'ffa',equipment:o.equipment==='equal'?'equal':'owned',
  weapon:Number.isInteger(o.weapon)&&o.weapon>=0&&o.weapon<weapons.length?o.weapon:0,
  mapId:mpMap(o.mapId)?.id||MP_MAPS[0].id,friendlyFire:true,maxPlayers:MP_CAP,
  scoreLimit,timeLimitSec};
}
function mpConfigured(){return /^pk_live_[A-Za-z0-9_-]{12,}$/.test(MP_PUBLISHABLE_KEY)&&!MP_PUBLISHABLE_KEY.includes('CONFIGURE');}
function mpStatus(msg,bad=false){const el=$('mpStatus');if(el){el.textContent=msg;el.className='mpStatus '+(bad?'mpError':'');}}
function mpInviteUrl(code){
 if(!/^https?:$/.test(location.protocol))return '';
 const u=new URL(location.href);u.hash='';u.search='';u.searchParams.set('v',GAME_BUILD);u.searchParams.set('mp',code);return u.href;
}
function mpShutdown(){
 ++mpEpoch;
 if(typeof mpChatReset==='function')mpChatReset();
 if(typeof mpMatchAbort==='function')mpMatchAbort();
 if(typeof mpRtcCloseAll==='function')mpRtcCloseAll();
 if(mpPending){clearTimeout(mpPending.timer);mpPending.reject(Error('Вход отменён.'));mpPending=null;}
 const wire=mpWire;mpWire=null;mpRoom=null;mpSignalingLost=false;if(wire)wire.close();
}

// Exact Metered Realtime Messaging v1 JSON frames. Only low-frequency lobby
// events and SDP/ICE use this quota-limited signalling route. Actual gameplay
// data, heartbeat and state travel only through P2P WebRTC DataChannels.
class MpWire{
 constructor(onFrame,onLost){this.ws=null;this.peerId='';this.pending=new Map();this.seq=0;this.closed=false;this.onFrame=onFrame;this.onLost=onLost;this.presence=new Set();this.iceServers=[];}
 connect(){return new Promise((resolve,reject)=>{
  if(typeof WebSocket!=='function'){reject(Error('В этом браузере нет поддержки WebSocket.'));return;}
  let settled=false;
  const timer=setTimeout(()=>{if(!settled){settled=true;reject(Error('Таймаут соединения с Metered.'));this.close();}},10000);
  try{this.ws=new WebSocket('wss://rms.metered.ca/v1?key='+encodeURIComponent(MP_PUBLISHABLE_KEY));}
  catch(e){clearTimeout(timer);reject(e);return;}
  this.ws.onmessage=e=>{
   let f;try{f=JSON.parse(e.data);}catch(_){return;}
   if(!f||typeof f!=='object')return;
   if(f.type==='welcome'){
    if(settled)return;settled=true;clearTimeout(timer);this.peerId=String(f.peerId||'');
    this.iceServers=Array.isArray(f.metadata?.iceServers)?f.metadata.iceServers:[];
    if(!this.peerId){reject(Error('Metered не прислал идентификатор подключения.'));this.close();return;}
    resolve(this);return;
   }
   if(f.type==='ack'||f.type==='error'){
    const p=this.pending.get(f.requestId);if(p){this.pending.delete(f.requestId);clearTimeout(p.timer);
     f.type==='ack'?p.resolve(f):p.reject(Error('Metered: '+String(f.code||f.message||'ошибка')));}
    else if(f.type==='error')this.onFrame(f);
    return;
   }
   if(f.type==='presence'){
    for(const x of f.joined||[])if(typeof x.peerId==='string')this.presence.add(x.peerId);
    for(const x of f.left||[])if(typeof x.peerId==='string')this.presence.delete(x.peerId);
   }
   this.onFrame(f);
  };
  this.ws.onclose=e=>{
   clearTimeout(timer);if(!settled){settled=true;reject(Error('Metered отключил соединение ('+e.code+').'));}
   for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('Соединение закрыто.'));}this.pending.clear();
   if(!this.closed)this.onLost(e);
  };
  this.ws.onerror=()=>{if(!settled){settled=true;clearTimeout(timer);reject(Error('Не удалось подключиться к Metered.'));this.close();}};
 });}
 request(type,fields){return new Promise((resolve,reject)=>{
  if(!this.ws||this.ws.readyState!==1){reject(Error('Нет соединения с сервером.'));return;}
  const requestId='nr-'+(++this.seq);const frame=JSON.stringify({type,...fields,requestId});
  if((typeof TextEncoder==='function'?new TextEncoder().encode(frame).length:frame.length*3)>60000||this.ws.bufferedAmount>262144){reject(Error('Превышен лимит сетевых данных.'));return;}
  const timer=setTimeout(()=>{this.pending.delete(requestId);reject(Error('Сервер не подтвердил операцию.'));},6500);
  this.pending.set(requestId,{resolve,reject,timer});
  try{this.ws.send(frame);}catch(e){clearTimeout(timer);this.pending.delete(requestId);reject(e);}
 });}
 subscribe(channel){return this.request('subscribe',{channel});}
 publish(channel,data){return this.request('publish',{channel,data});}
 send(to,data){return this.request('send',{to,data});}
 close(){if(this.closed)return;this.closed=true;if(this.ws)this.ws.close();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('Соединение закрыто.'));}this.pending.clear();}
}

function mpHome(message=''){
 mpScreenError=message;
 panel(`<div class="eyebrow">◉ СЕТЕВАЯ ИГРА · MP-10</div><h2>Комнаты до 8 игроков</h2>
 <p class="smalltext">Бой на любой из ${MP_MAPS.length} карт: полёт, рывок, импульс, щит, ремонт, стрельба, командные очки, таймер, победа и результаты. Одиночная кампания и её сохранения независимы.</p>
 <div class="mpGrid"><button class="primary" id="mpOpenHost">＋ СОЗДАТЬ ИГРУ</button><button class="secondary" id="mpOpenJoin">↪ ПРИСОЕДИНИТЬСЯ</button></div>
 <div class="mpStatus ${message?'mpError':''}" id="mpStatus" role="status">${mpEscape(message||(!mpConfigured()?'Сеть пока не настроена: создателю сайта нужно добавить publishable key Metered.':'Готово к соединению.'))}</div>
 <div class="smalltext">Два режима: каждый за себя и команды. Дружественный огонь включён. Комнаты по ссылке для друзей, без регистрации и без серверной защиты от злоумышленников.</div>
 <button class="secondary mpBack" id="mpBack" data-esc-action>← ГЛАВНОЕ МЕНЮ</button>`);
 $('mpOpenHost').onclick=mpHostForm;$('mpOpenJoin').onclick=()=>mpJoinForm();$('mpBack').onclick=menu;
}
// The generator uses (sector - 1) % 18 for new maps. Keep grouping purely
// presentational: the wire catalog, IDs and actual sector seeds stay unchanged.
const MP_MAP_FAMILIES=Object.freeze(MP_MAPS.slice(0,18).map((m,index)=>Object.freeze({
 id:m.id,name:m.name,maps:Object.freeze(MP_MAPS.filter(item=>(item.sector-1)%18===index))
})));
function mpMapLabel(m){return String(m.sector).padStart(2,'0')+' · '+m.name;}
function mpMapFamilyMarkup(selectedId=MP_MAPS[0].id){
 return MP_MAP_FAMILIES.map((family,index)=>{
  const selected=family.maps.find(m=>m.id===selectedId);
  const cards=family.maps.map(m=>`<div class="mpMapCard"><label class="mpMapChoose"><input type="radio" name="mpMap" value="${m.id}" ${m.id===selectedId?'checked':''}><span>${mpEscape(mpMapLabel(m))}</span></label><button type="button" class="mpPreviewBtn" data-preview-map="${m.id}" aria-label="Посмотреть ${mpEscape(mpMapLabel(m))}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg><span>Посмотреть</span></button></div>`).join('');
  return `<details class="mpMapFamily${selected?' mpMapFamilySelected':''}" name="mpMapFamilies" data-family="${index+1}"><summary><span class="mpFamilyNumber" aria-hidden="true">${String(index+1).padStart(2,'0')}</span><span class="mpFamilyTitle"><strong>${mpEscape(family.name)}</strong><small>${selected?'Выбрана: '+mpEscape(mpMapLabel(selected)):''}</small></span><span class="mpFamilyCount">${family.maps.length} карт</span><span class="mpFamilyChevron" aria-hidden="true"></span></summary><div class="mpFamilyMaps" role="group" aria-label="${mpEscape(family.name)}">${cards}</div></details>`;
 }).join('');
}
function mpBindMapFamilies(){
 const list=$('mpMapFamilies'),status=$('mpMapSelected');if(!list||!status)return;
 const groups=Array.from(list.querySelectorAll('.mpMapFamily'));
 // Native details/summary supports touch, Enter and Space. Explicit sibling
 // closure also works in browsers without exclusive named details support.
 for(const group of groups){
  const summary=group.querySelector('summary');
  summary.addEventListener('click',()=>{if(!group.open){for(const other of groups)if(other!==group)other.open=false;}});
  group.addEventListener('toggle',()=>{
   if(!group.open)return;
   const rect=list.getBoundingClientRect(),header=summary.getBoundingClientRect();
   if(header.top<rect.top+3)list.scrollTop+=header.top-rect.top-3;
   else if(header.bottom>rect.bottom-3)list.scrollTop+=header.bottom-rect.bottom+3;
  });
 }
 list.addEventListener('click',e=>{
  const button=e.target.closest('button[data-preview-map]');
  if(button&&list.contains(button)){e.preventDefault();mpPreviewStart(button.dataset.previewMap,button);}
 });
 list.addEventListener('change',e=>{
  if(e.target.name!=='mpMap'||!e.target.checked)return;
  const m=mpMap(e.target.value);if(!m)return;
  status.textContent=mpMapLabel(m);
  for(const group of groups){
   const selected=Number(group.dataset.family)===(m.sector-1)%18+1;
   group.classList.toggle('mpMapFamilySelected',selected);
   group.querySelector('.mpFamilyTitle small').textContent=selected?'Выбрана: '+mpMapLabel(m):'';
  }
 });
}
function mpHostForm(){
 panel(`<div class="eyebrow">СЕТЕВАЯ ИГРА / СОЗДАТЬ</div><h2>Новая комната</h2>
 <label class="mpField"><input id="mpHostNick" maxlength="40" autocomplete="nickname" aria-label="Ваш ник" placeholder="Ваш ник"></label>
 <fieldset class="mpField"><legend>КАРТА · ${MP_MAPS.length}</legend><div class="mpMapSelected" id="mpMapSelected" aria-live="polite">01 · ${MP_MAPS[0].name}</div><div class="mpMapHint">18 семейств · выберите карту или осмотрите её без подключения</div><div id="mpMapFamilies" class="mpMaps mpMapFamilies" role="group" aria-label="Архитектурные семейства карт">${mpMapFamilyMarkup()}</div></fieldset>
 <label class="mpField">РЕЖИМ<select id="mpMode"><option value="ffa">Каждый за себя</option><option value="teams">Команды (голубая / оранжевая)</option></select></label>
 <label class="mpField">ЭКИПИРОВКА<select id="mpEquipment"><option value="owned">Выбор из 10 базовых видов оружия</option><option value="equal">Одинаковое оружие для всех</option></select></label>
 <label class="mpField" id="mpWeaponWrap" hidden>СТАРТОВОЕ ОРУЖИЕ<select id="mpWeapon">${weapons.map((w,i)=>`<option value="${i}">${mpEscape(w.short)}</option>`).join('')}</select></label>
 <label class="mpField">ПОБЕДНЫЙ СЧЁТ<select id="mpScoreLimit"><option value="5">5</option><option value="10">10</option><option value="15" selected>15</option><option value="20">20</option><option value="30">30</option><option value="50">50</option></select></label>
 <label class="mpField">ВРЕМЯ МАТЧА<select id="mpTimeLimit"><option value="60">1 минута</option><option value="180">3 минуты</option><option value="300" selected>5 минут</option><option value="600">10 минут</option><option value="900">15 минут</option></select></label>
 <div class="mpRule">До 8 игроков · Дружественный огонь: ВКЛ · Полёт и четыре способности доступны всем с одинаковыми характеристиками · Ведущий рассчитывает бой.</div>
 <button class="primary" id="mpCreate">СОЗДАТЬ КОМНАТУ</button><div id="mpStatus" class="mpStatus" role="status"></div>
 <button class="secondary mpBack" id="mpBack" data-esc-action>← НАЗАД</button>`);
 mpBindMapFamilies();
 $('mpEquipment').onchange=()=>{$('mpWeaponWrap').hidden=$('mpEquipment').value!=='equal';};
 $('mpCreate').onclick=mpCreateRoom;$('mpBack').onclick=()=>{mpShutdown();mpHome();};
}
function mpJoinForm(invite=''){
 panel(`<div class="eyebrow">СЕТЕВАЯ ИГРА / ВХОД</div><h2>Присоединиться к комнате</h2>
 <label class="mpField">КОД ИЛИ ССЫЛКА<input id="mpJoinCode" autocomplete="off" spellcheck="false" placeholder="NR-…" value="${mpEscape(invite)}"></label>
 <label class="mpField"><input id="mpJoinNick" maxlength="40" autocomplete="nickname" aria-label="Ваш ник" placeholder="Ваш ник"></label>
 <button class="primary" id="mpJoin">ВОЙТИ В ЛОББИ</button><div id="mpStatus" class="mpStatus" role="status"></div>
 <div class="smalltext">Для входа нужен Интернет. Регистрация на Metered не требуется.</div>
 <button class="secondary mpBack" id="mpBack" data-esc-action>← НАЗАД</button>`);
 $('mpJoin').onclick=mpJoinRoom;$('mpBack').onclick=()=>{mpShutdown();mpHome();};
}
async function mpConnect(epoch){
 if(!mpConfigured())throw Error('Нужна настройка публичного ключа Metered в src/21b-multiplayer-lobby.js.');
 const wire=new MpWire(f=>{if(mpWire===wire)mpFrame(f);},e=>{
  if(mpWire!==wire)return;
  // Realtime Messaging is signalling, NOT the gameplay transport. A lost
  // WebSocket must not kill already-open RTCDataChannels during a match.
  if(typeof mpMatch!=='undefined'&&mpMatch?.active&&typeof mpRtcAnyGameplayOpen==='function'&&mpRtcAnyGameplayOpen()){
   mpSignalingLost=true;mpMatchStatus();return;
  }
  mpShutdown();mpHome('Сеть отключилась ('+e.code+'). Создайте комнату или войдите заново.');
 });
 mpWire=wire;mpSignalingLost=false;try{await wire.connect();if(epoch!==mpEpoch)throw Error('Соединение отменено.');return wire;}
 catch(e){if(mpWire===wire){mpWire=null;wire.close();}throw e;}
}
async function mpCreateRoom(){
 if(game?.preview)return;
 let nick,settings,code;try{
  nick=mpNickname($('mpHostNick').value);
  const chosen=mpMap(document.querySelector('input[name="mpMap"]:checked')?.value);
  if(!chosen)throw Error('Выберите карту из каталога.');
  settings=mpSettings({mode:$('mpMode').value,equipment:$('mpEquipment').value,weapon:Number($('mpWeapon').value),
   scoreLimit:Number($('mpScoreLimit').value),timeLimitSec:Number($('mpTimeLimit').value),
   mapId:chosen.id});
  code=MP_PREFIX+mpRandom();
 }catch(e){mpStatus(e.message,true);return;}
 $('mpCreate').disabled=true;mpStatus('Подключаемся и создаём комнату…');mpShutdown();const epoch=mpEpoch;
 try{
  const wire=await mpConnect(epoch);
  await wire.subscribe(mpChannel(code));if(epoch!==mpEpoch)return;
  mpRoom={code,host:true,hostPeer:wire.peerId,settings,players:[{peerId:wire.peerId,id:0,nick,team:0,host:true}],seq:1,nextId:1};
  mpLobby();
 }catch(e){if(epoch===mpEpoch){if(mpWire){const wire=mpWire;mpWire=null;wire.close();}$('mpCreate')&&($('mpCreate').disabled=false);mpStatus(e.message,true);}}
}
async function mpJoinRoom(){
 const code=mpCode($('mpJoinCode').value);if(!code){mpStatus('Некорректный код или ссылка комнаты.',true);return;}
 let nick;try{nick=mpNickname($('mpJoinNick').value);}catch(e){mpStatus(e.message,true);return;}
 $('mpJoin').disabled=true;mpStatus('Ищем ведущего комнаты…');mpShutdown();const epoch=mpEpoch;
 try{
  const wire=await mpConnect(epoch);await wire.subscribe(mpChannel(code));if(epoch!==mpEpoch)return;
  const nonce=mpRandom(8);mpRoom={code,host:false,hostPeer:null,settings:null,players:[],seq:0,nick,nonce};
  const result=new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{if(mpPending?.nonce===nonce){mpPending=null;reject(Error('Ведущий не ответил за 9 секунд. Проверьте код и подключение.'));}},9000);
   mpPending={nonce,timer,resolve,reject};
  });
  await Promise.all([wire.publish(mpChannel(code),{app:'neonrift3d',v:MP_VERSION,kind:'join',code,nonce,nick}),result]);
  if(epoch!==mpEpoch)return;mpLobby();
 }catch(e){if(epoch===mpEpoch){mpShutdown();mpJoinForm(code);$('mpJoinNick').value=nick;mpStatus(e.message,true);}}
}
function mpPacket(kind,extra={}){return {app:'neonrift3d',v:MP_VERSION,kind,code:mpRoom?.code,...extra};}
function mpRoster(){return mpPacket('roster',{seq:mpRoom.seq,hostPeer:mpRoom.hostPeer,settings:mpRoom.settings,players:mpRoom.players.map(p=>({...p}))});}
function mpPublishRoster(){
 if(!mpRoom?.host)return;
 const room=mpRoom;
 const publish=attempt=>{
  if(mpRoom!==room||!mpSignalingOnline())return;
  mpWire.publish(mpChannel(room.code),mpRoster()).catch(e=>{
   if(mpRoom!==room)return;
   if(!attempt&&mpSignalingOnline()){
    setTimeout(()=>{if(mpRoom===room)publish(1);},450);return;
   }
   mpStatus('Не удалось передать список игроков: '+e.message,true);
  });
 };
 publish(0);
}
function mpHostFrame(frame,data){
 if(frame.type==='message'&&data.kind==='join'){
  const peer=frame.from,nonce=data.nonce;
  if(typeof peer!=='string'||peer.length>128||typeof nonce!=='string'||!/^[A-Z2-7]{13}$/.test(nonce))return;
  let reason='',nick='';try{nick=mpNickname(data.nick);}catch(e){reason=e.message;}
  if(!reason&&typeof mpMatch!=='undefined'&&mpMatch?.active)reason='Матч уже начался. Дождитесь следующей комнаты.';
  if(!reason&&mpRoom.players.some(p=>p.peerId===peer))reason='Вы уже в этой комнате.';
  if(!reason&&mpRoom.players.length>=MP_CAP)reason='Комната заполнена (8/8).';
  if(!reason&&mpRoom.players.some(p=>mpNickKey(p.nick)===mpNickKey(nick)))reason='Такой ник уже занят. Выберите другой.';
  if(reason){mpWire.send(peer,mpPacket('join-reject',{nonce,reason})).catch(e=>mpStatus('Отказ во входе не доставлен: '+e.message,true));return;}
  // Atomic reservation before any async operations: simultaneous JOINs cannot
  // obtain the same nickname or exceed capacity.
  const p={peerId:peer,id:mpRoom.nextId++,nick,team:mpRoom.players.filter(x=>x.team===0).length<=mpRoom.players.filter(x=>x.team===1).length?0:1,host:false};
  mpRoom.players.push(p);mpRoom.seq++;const snapshot=mpRoster();mpLobby();
  mpWire.send(peer,{...snapshot,kind:'join-accepted',nonce}).then(()=>{
   if(mpRoom?.host&&mpRoom.players.includes(p)&&typeof mpRtcHostJoined==='function')mpRtcHostJoined(peer);
  }).catch(e=>{
   // An unacknowledged acceptance must not reserve a seat forever. Revert
   // only this exact candidate; another JOIN may already have changed roster.
   if(!mpRoom?.host||!mpRoom.players.includes(p))return;
   mpRoom.players=mpRoom.players.filter(x=>x!==p);mpRoom.seq++;
   if(typeof mpMatch==='undefined'||!mpMatch?.active)mpLobby();mpPublishRoster();
   mpStatus('Вход '+p.nick+' не подтверждён: '+e.message,true);
  });mpPublishRoster();return;
 }
 if(frame.type==='direct'&&typeof data.kind==='string'&&data.kind.startsWith('rtc-')&&typeof mpRtcSignal==='function')mpRtcSignal(frame.from,data);
}
function mpSafeRoster(data,wire){
 if(!data||!Array.isArray(data.players)||data.players.length<1||data.players.length>MP_CAP)return null;
 const players=[],names=new Set(),peers=new Set(),ids=new Set();let ownerCount=0;
 for(const raw of data.players){
  if(typeof raw.peerId!=='string'||raw.peerId.length>128||peers.has(raw.peerId)||!Number.isInteger(raw.id)||raw.id<0||raw.id>10000||ids.has(raw.id))return null;
  let nick,key;try{nick=mpNickname(raw.nick);key=mpNickKey(nick);}catch(_){return null;}
  if(names.has(key))return null;names.add(key);peers.add(raw.peerId);ids.add(raw.id);
  const owner=raw.host===true;if(owner)ownerCount++;
  players.push({peerId:raw.peerId,id:raw.id,nick,team:raw.team===1?1:0,host:owner});
 }
 if(ownerCount!==1||!players.some(p=>p.peerId===data.hostPeer&&p.host)||!players.some(p=>p.peerId===wire.peerId))return null;
 return players;
}
function mpGuestFrame(frame,data){
 if(frame.type==='direct'&&data.kind==='join-reject'&&mpPending&&data.nonce===mpPending.nonce){
  const p=mpPending;mpPending=null;clearTimeout(p.timer);p.reject(Error(String(data.reason||'Вход отклонён.').slice(0,130)));return;
 }
 if(frame.type==='direct'&&data.kind==='join-accepted'&&mpPending&&data.nonce===mpPending.nonce){
  const roster=mpSafeRoster(data,mpWire);
  if(!roster||!mpMap(data.settings?.mapId)||frame.from!==data.hostPeer||!roster.some(p=>p.peerId===mpWire.peerId&&mpNickKey(p.nick)===mpNickKey(mpRoom.nick)))return;
  mpRoom.players=roster;mpRoom.hostPeer=frame.from;mpRoom.settings=mpSettings(data.settings);mpRoom.seq=Number.isSafeInteger(data.seq)?data.seq:0;
  const p=mpPending;mpPending=null;clearTimeout(p.timer);p.resolve();return;
 }
 if(frame.type==='message'&&data.kind==='roster'&&frame.from===mpRoom.hostPeer){
  if(!Number.isSafeInteger(data.seq)||data.seq<=mpRoom.seq)return;
  const roster=mpSafeRoster(data,mpWire);if(!roster||!mpMap(data.settings?.mapId))return;
  mpRoom.players=roster;mpRoom.settings=mpSettings(data.settings);mpRoom.seq=data.seq;
  if(typeof mpMatch!=='undefined'&&mpMatch?.active)mpMatchRosterChanged();else mpLobby();
 }
 if(frame.type==='message'&&data.kind==='closed'&&frame.from===mpRoom.hostPeer){mpShutdown();mpHome('Ведущий закрыл комнату.');}
 if(frame.type==='direct'&&typeof data.kind==='string'&&data.kind.startsWith('rtc-')&&frame.from===mpRoom.hostPeer&&typeof mpRtcSignal==='function')mpRtcSignal(frame.from,data);
}
function mpFrame(frame){
 if(!mpRoom||!mpWire)return;
 if(frame.type==='presence'){
  if(frame.channel!==mpChannel(mpRoom.code))return;
  const left=new Set((frame.left||[]).map(x=>x.peerId));
  if(mpRoom.host){
   // Signalling presence can disappear while the *direct game channel* lives.
   const departed=new Set([...left].filter(peer=>!mpGamePeerLive(peer)));
   for(const peer of departed)if(typeof mpRtcDrop==='function')mpRtcDrop(peer);
   const count=mpRoom.players.length;mpRoom.players=mpRoom.players.filter(p=>p.host||!departed.has(p.peerId));
   if(count!==mpRoom.players.length){mpRoom.seq++;
    if(typeof mpMatch!=='undefined'&&mpMatch?.active)mpMatchRosterChanged();else mpLobby();
    mpPublishRoster();}}
  else if(mpRoom.hostPeer&&left.has(mpRoom.hostPeer)&&!mpGamePeerLive(mpRoom.hostPeer)){mpShutdown();mpHome('Ведущий отключился. Матч не будет запущен.');}
  return;
 }
 if(frame.type!=='message'&&frame.type!=='direct')return;
 if(frame.type==='message'&&frame.channel!==mpChannel(mpRoom.code))return;
 const data=frame.data;
 if(!data||typeof data!=='object'||data.app!=='neonrift3d'||data.v!==MP_VERSION||data.code!==mpRoom.code)return;
 if(mpRoom.host)mpHostFrame(frame,data);else mpGuestFrame(frame,data);
}
async function mpCopy(value){
 try{if(!navigator.clipboard?.writeText)throw Error('Недоступен буфер обмена');await navigator.clipboard.writeText(value);mpStatus('Скопировано.');}
 catch(_){mpStatus('Автокопирование недоступно. Выделите и скопируйте код вручную.',true);const input=$('mpCodeValue');if(input){input.focus();input.select();}}
}
function mpLobby(){
 if(typeof mpMatch!=='undefined'&&mpMatch?.active)return;
 if(!mpRoom||!mpWire)return;
 const r=mpRoom,settings=r.settings||mpSettings({}),m=mpMap(settings.mapId),url=mpInviteUrl(r.code);
 const users=r.players.map(p=>`<li class="mpPlayer ${settings.mode==='teams'?'mpTeam'+p.team:''}"><span class="mpTeamMark" aria-hidden="true">${settings.mode==='teams'?'◉':'●'}</span><strong>${mpEscape(p.nick)}</strong>${p.host?'<span>ВЕДУЩИЙ</span>':''}<small class="mpLinkBadge" id="mpPeerLink${p.id}">${typeof mpRtcStatusText==='function'?mpEscape(mpRtcStatusText(p.peerId)):'ПОДКЛЮЧЕНИЕ P2P'}</small></li>`).join('');
 panel(`<div class="eyebrow">СЕТЕВАЯ ИГРА / ЛОББИ</div><h2>${r.host?'Вы ведущий':'Комната ведущего'}</h2>
 <label class="mpField">КОД КОМНАТЫ<input id="mpCodeValue" readonly value="${mpEscape(r.code)}"></label>
 <div class="mpGrid"><button class="secondary" id="mpCopyCode">▣ КОПИРОВАТЬ КОД</button>${url?'<button class="secondary" id="mpCopyLink">↗ КОПИРОВАТЬ ССЫЛКУ</button>':''}</div>
 <div class="mpRoomSummary"><div>Карта: <b>${mpEscape(m?.name||'—')}</b></div><div>Режим: <b>${settings.mode==='teams'?'КОМАНДЫ':'КАЖДЫЙ ЗА СЕБЯ'}</b></div>
 <div>Экипировка: <b>${settings.equipment==='equal'?'ОДИНАКОВАЯ · '+mpEscape(weapons[settings.weapon]?.short||''):'ВЫБОР ИЗ 10 БАЗОВЫХ ВИДОВ'}</b></div>
 <div>Дружественный огонь: <b>ВКЛ</b></div><div>До победы: <b>${settings.scoreLimit} очков</b></div>
 <div>Время: <b>${settings.timeLimitSec/60} мин.</b></div></div>
 <h3>Игроки · ${r.players.length}/${MP_CAP}</h3><ol class="mpPlayers">${users}</ol>
 <button class="secondary" id="mpLobbyChat" type="button">💬 ЧАТ КОМНАТЫ</button>
 <button class="secondary" id="mpRetryRtc">↻ ПЕРЕПОДКЛЮЧИТЬ WEBRTC</button>
 ${r.host?'<button class="primary" id="mpStartTraining" disabled>▶ НАЧАТЬ БОЙ</button><div class="mpRule" id="mpLaunchHint" role="status" aria-live="polite">Подключаем участников…</div>':'<div class="mpRule">Вы в комнате. Ведущий может запустить бой после подключения P2P-каналов всех участников.</div>'}
 <div class="mpRule">В сетевом бою у всех 100 HP и 30 единиц энергобарьера. Улучшения и купленные костюмы из одиночной игры не дают преимуществ. Дружественный огонь включён, за убийство союзника начисляется штраф.</div>
 <div id="mpStatus" class="mpStatus" role="status">MP-10: управление при долгой потере связи приостанавливается, есть переподключение, полёт и способности доступны всем. Победа — по очкам или времени.</div>
 <button class="secondary mpBack" id="mpLeave" data-esc-action>← ВЫЙТИ ИЗ КОМНАТЫ</button>`);
 $('mpCopyCode').onclick=()=>mpCopy(r.code);if(url)$('mpCopyLink').onclick=()=>mpCopy(url);
 if(typeof mpChatOpen==='function')$('mpLobbyChat').onclick=mpChatOpen;
 $('mpLeave').onclick=mpLeave;
 if(r.host&&typeof mpMatchStartTraining==='function'){$('mpStartTraining').onclick=mpMatchStartTraining;mpMatchPaintLobbyStart();}
 if($('mpRetryRtc'))$('mpRetryRtc').onclick=()=>typeof mpRtcManualRetry==='function'&&mpRtcManualRetry();
}
async function mpLeave(){
 const wire=mpWire,r=mpRoom,epoch=mpEpoch;
 if(r?.leaving)return;
 if(r)r.leaving=true;
 if(r?.host&&wire){try{await Promise.race([wire.publish(mpChannel(r.code),mpPacket('closed')),new Promise(resolve=>setTimeout(resolve,1000))]);}catch(_){/* best effort */}}
 if(epoch!==mpEpoch)return;
 mpShutdown();menu();
}
function mpInviteOnLoad(){
 try{const code=mpCode(new URL(location.href).searchParams.get('mp'));if(code&&!game)mpJoinForm(code);}catch(_){/* file:// and restricted browsers still have the menu */}
}
setTimeout(mpInviteOnLoad,0);
