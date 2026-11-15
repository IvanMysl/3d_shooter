


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
<div class="backupActions"><button class="secondary" data-export-save>⬇ ЭКСПОРТ ПРОГРЕССА</button><button class="secondary" data-import-save>⬆ ИМПОРТ ПРОГРЕССА</button></div><div class="smalltext">${storageAvailable?'✓ Автосохранение: каждые 2,6 секунды, при паузе и закрытии страницы.':'⚠ Браузер запрещает запись. Экспортируй копию.'} Для переноса сохранения между файлами HTML и браузерами используй экспорт/импорт.</div><div class="line"></div><div class="smalltext"><b class="accent">ПК:</b> WASD — движение, пробел — прыжок, V/двойной пробел — полёт (если есть лётный костюм), удерживать Space/Shift — набор/снижение высоты; мышь — осмотр, ЛКМ — стрельба, 1–9/0 — оружие. <b>E — фазовый рывок без перезарядки</b>, ↑/↓ — его дальность; <b>F — восстановление по очереди: корпус → бронекостюм → энергобарьер (без ожидания, пока хватает энергии).</b> <b>Q — ЭМИ-импульс без перезарядки</b> (52 энергии); <b>C — временная защитная сфера</b> (50 энергии, перезарядка 5 секунд после окончания действия, но без заряда энергобарьера). Радиус и урон Q улучшаются в ангаре сложными процентами. F5 — камера, G — полный экран, M — масштаб карты, Esc — пауза (в ангаре — в меню). При полёте [ / ] меняют горизонтальную, , / . — вертикальную скорость; также есть ползунки прямо на игровом экране.<br><b class="accent">Телефон:</b> левый джойстик — движение, касание поля — выстрел, свайп — обзор; значки ➤ (рывок), ✚ (восстановление), ◈ (защитная сфера), ✺ (импульс), ⤒ (прыжок). Для лётных костюмов появляются ✈ / ↑ / ↓ и два ползунка скорости. Дальность рывка можно менять в паузе. <b>«Арсенал»</b> открывает список оружия; мини-карта меняет масштаб по касанию.</div><div class="note">Десять видов оружия, разные классы роботов, разрушаемые энергоядра, элитные противники и следы на стенах. Третья степень графики наиболее требовательна. В меню и на паузе отрисовка 3D отключается для экономии GPU. Игра работает без Интернета, внешних библиотек, регистрации и оплаты. Автосохранение текущего боя и экспорт резервной копии в JSON. ${glReady?'Аппаратный WebGL-движок активен.':'Работает программный 3D-режим, если WebGL недоступен.'}</div>`);$('campaignMap').onclick=()=>showCampaignMap();$('newRun').onclick=()=>startGame(false,save.campaign.highestUnlocked);if(cp)$('resume').onclick=()=>startGame(true);$('hangar').onclick=hangar;$('devToggle').onclick=()=>devMode?developerLeave():showDeveloperPanel();if(devMode)$('devSettings').onclick=showDeveloperPanel;wireBackupButtons();wireFpsSettings()}
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
 <p class="smalltext">Текущий костюм: <b>${suit.id<0?'нет':BODY_ARMOR_CATALOG[suit.id].name}</b>. Бронекостюм сначала нужно купить и надеть. Каждый выдерживает ограниченное количество ударов, до 20 уровней усовершенствования. <b class="accent">Костюмы №10–16 дают полёт сразу после покупки и экипировки; костюмы №1–9 — после улучшения до LVL 10.</b> Прочность костюма растёт на +8% к предыдущему значению за уровень. В четырёх поздних моделях снижение урона достигает 97–99,95%; физический костюм изнашивается. Между секторами автоматически чинится 34% его максимальной прочности (после босса ещё 12%), ремонтные станции восстанавливают 18%, бронепластины — 6%. F восстанавливает корпус, затем костюм, затем энергобарьер. На ПК: дважды Space либо V — полёт; Space — вверх, Shift — вниз. Для полётных костюмов доступны независимые улучшения горизонтальной и вертикальной скоростей (+5% к предыдущей за уровень); их доли регулируются ползунками во время боя. На телефоне те же функции доступны через значки и ползунки.</p>
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
 g.state='upgrade';g.pendingUpgrade=opts.map(x=>x.id);saveRun();panel(`<div class="eyebrow">✓ УРОВЕНЬ ${g.sector} ПРОЙДЕН · КАМПАНИЯ СОХРАНЕНА</div><h1>ПОБЕДА <span class="accent">/ УРОВЕНЬ ${g.sector}</span></h1><p class="lede">Следующий уровень ${g.sector+1} открыт. Выбери улучшение, чтобы сразу продолжить, или вернись на карту кампании. Зелёная отметка сохранится.</p><div class="missionWinBanner">${MISSION_TYPES[g.mission?.type||'purge'].icon} ${MISSION_TYPES[g.mission?.type||'purge'].name} · ${'★'.repeat(missionStars(g))}${'☆'.repeat(3-missionStars(g))} · БОНУС: ${4+missionStars(g)*4} ◈</div><div class="cards">${opts.map((x,i)=>`<button class="option" data-pick="${i}"><div class="ico">${x.icon}</div><strong>${x.name}</strong><p>${x.desc}</p><div class="tier">АДАПТАЦИЯ ${1+(g.upgrades[x.id]||0)}</div></button>`).join('')}</div><div class="smalltext">Прогресс сохранён. После выбора будет открыт следующий сектор.</div><div class="campaignActions"><button id="winMap" class="secondary">◈ КАРТА УРОВНЕЙ</button><button id="winReplay" class="secondary">↻ ПОВТОРИТЬ ${g.sector}</button></div>`);$('winMap').onclick=()=>showCampaignMap();$('winReplay').onclick=()=>startGame(false,g.sector);document.querySelectorAll('[data-pick]').forEach(el=>el.onclick=()=>{const x=opts[+el.dataset.pick];x.fn(g);g.upgrades[x.id]=(g.upgrades[x.id]||0)+1;g.pendingUpgrade=null;g.state='playing';enterSector(g.sector+1);saveRun();$('overlay').classList.add('hidden');$('hud').classList.add('show');toast('УЛУЧШЕНИЕ: '+x.name,2);})}
function pause(){if(!game||game.state!=='playing')return;closeArsenal();game.state='paused';saveRun();input.fire=false;if(document.pointerLockElement)document.exitPointerLock();panel(`<div class="eyebrow">ПРИОСТАНОВЛЕНО</div><h1>ПАУЗА <span class="accent">Ⅱ</span></h1><p class="lede">Сектор ${game.sector}. Уничтожено ${game.kills} противников. Очки: ${game.score.toLocaleString('ru')}.</p><div class="row"><button class="primary" id="unpause">▶ ПРОДОЛЖИТЬ</button><button id="toMenu" class="secondary">⌂ В МЕНЮ</button><button id="pauseCampaign" class="secondary">◈ КАРТА УРОВНЕЙ</button></div><div class="backupActions"><button class="secondary" data-export-save>⬇ РЕЗЕРВНАЯ КОПИЯ</button><button class="secondary" data-import-save>⬆ ИМПОРТ</button></div><div class="note">${storageAvailable?'✓ Прогресс сохранён на этом устройстве':'⚠ Хранилище браузера недоступно — экспортируй сохранение!'}. При переходе в другой браузер или открытии HTML по другому пути используй экспорт/импорт.</div>${fpsSettingsHTML('pauseFpsLimit')}${dashDistanceSettingsHTML()}<div class="line"></div><div class="row"><button class="secondary" id="cameraToggle">◫ КАМЕРА: ${cameraModeLabel()} (F5)</button><button class="secondary" id="mute">${save.settings.audio?'🔊 ЗВУК ВКЛ':'🔈 ЗВУК ВЫКЛ'}</button><button class="secondary" id="aim">${save.settings.aim?'⊕ АВТОНАВЕДЕНИЕ ВКЛ':'⊙ АВТОНАВЕДЕНИЕ ВЫКЛ'}</button><button class="secondary" id="quality">${['◈ ГРАФИКА: ЭКОНОМНАЯ','✧ ГРАФИКА: ВЫСОКАЯ','✦ ГРАФИКА: КИНО'][clamp(save.settings.quality|0,0,2)]}</button></div>`);$('unpause').onclick=unpauseGame;$('toMenu').onclick=()=>{saveRun();menu()};$('pauseCampaign').onclick=()=>showCampaignMap();$('cameraToggle').onclick=()=>{toggleCameraMode();pauseRefresh()};$('mute').onclick=()=>{save.settings.audio=!save.settings.audio;persist();pauseRefresh()};$('aim').onclick=()=>{save.settings.aim=!save.settings.aim;persist();pauseRefresh()};$('quality').onclick=()=>{save.settings.quality=(save.settings.quality+1)%3;persist();createWorldMesh(game.sector);resize();pauseRefresh()};wireBackupButtons();wireFpsSettings();wireDashDistanceSettings()}
function pauseRefresh(){if(game?.state==='paused'){game.state='playing';pause()}}
function gameOver(){if(!game||game.state==='dead')return;closeArsenal();const g=game;g.state='dead';input.fire=false;save.checkpoint=null;const recovery=defeatRecoveryCredits(g);save.credits+=Math.floor(g.score/350)+recovery;save.best=Math.max(save.best,g.sector);persist();if(document.pointerLockElement)document.exitPointerLock();panel(`<div class="eyebrow">▣ СИГНАЛ ПОТЕРЯН</div><div class="logo">СИСТЕМА <em>ПОВРЕЖДЕНА</em></div><div class="lede">Твоё путешествие завершилось, но добытые технологии остались в ангаре. Следующий забег может стать сильнее.</div><div class="note">Данные противника сохранены: <b class="accent">+${recovery} ◈</b> кредитов за прогресс этой попытки. Если было трудно, попробуй усилить костюм и основное оружие.</div><div class="quickstats"><div><b>${g.sector}</b><span>СЕКТОР</span></div><div><b>${g.kills}</b><span>ПОБЕД</span></div><div><b>${g.score.toLocaleString('ru')}</b><span>ОЧКИ</span></div></div><div class="row"><button class="primary" id="retry">↻ СНОВА В БОЙ</button><button class="secondary" id="backMenu">⌂ МЕНЮ</button><button class="secondary" id="gameOverMap">◈ КАРТА УРОВНЕЙ</button></div>`);$('retry').onclick=()=>startGame(false,g.sector);$('backMenu').onclick=menu;$('gameOverMap').onclick=()=>showCampaignMap()}
function switchWeapon(to){if(!game||game.state!=='playing')return;const p=game.p;p.equipAnim=.9;p.weapon=to===undefined?(p.weapon+1)%weapons.length:clamp(to,0,weapons.length-1);p.cooldown=.18;$('gun').dataset.gun=String(p.weapon);$('gun').style.setProperty('--weapon-glow',`rgb(${weapons[p.weapon].color.map(v=>Math.round(v*255)).join(',')})`);toast(weapons[p.weapon].name,.8);sound(360,.06,'square',.05)}
