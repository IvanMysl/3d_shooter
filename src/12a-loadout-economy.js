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
