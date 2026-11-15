

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
const PERM_COMPOUND={health:1.08,damage:1.04,barrier:1.09,regen:1.04,capacity:1.04,pulseRadius:1.012,pulseDamage:1.04};
// Purchase ranks are clamped by normalizePerms before reaching gameplay.
// Keep this pure formula independently testable by the economy audit tools.
const permanentStat=(base,multiplier,level)=>base*Math.pow(multiplier,Math.max(0,Math.floor(Number(level)||0)));
function newPlayer(){const suit=equippedArmorStats(),hp=permanentStat(100,PERM_COMPOUND.health,save.perms[0]),barrier=permanentStat(30,PERM_COMPOUND.barrier,save.perms[2]),energy=permanentStat(100,PERM_COMPOUND.capacity,save.perms[4]);return{x:spawnX,z:spawnZ,yaw:1.2,pitch:0,hp,maxhp:hp,armor:barrier,maxArmor:barrier,armorTier:Math.min(4,Math.floor(save.perms[2]/2)),armorDelay:0,armorRegen:2.6,bodyArmorType:suit.id,bodyArmorMax:suit.maxDurability,bodyArmor:suit.maxDurability,bodyArmorReduction:suit.reduction,bodyArmorWear:suit.wear,energy,maxEnergy:energy,regen:permanentStat(16,PERM_COMPOUND.regen,save.perms[3]),damage:permanentStat(1,PERM_COMPOUND.damage,save.perms[1]),speed:3.05,rate:1,heatMod:1,heat:0,heatLock:0,cooldown:0,weapon:0,crit:.06,critDamage:1.75,shield:0,shieldDuration:3.5,abilityCooldowns:{dash:0,pulse:0,shield:0,heal:0},dashCost:25,dashRange:DASH_DISTANCE_BASE+save.perms[5]*DASH_UPGRADE_STEP,magnet:1.1,vamp:0,shock:1,slowBullets:1,healRegen:0,recoil:0,shotGlow:0,equipAnim:0,iframes:0,flying:false,flightUnlocked:armorGrantsFlight(suit),walk:0,shots:0,aimAssist:true,devicePower:1,feetY:0,vy:0,grounded:true}}
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
