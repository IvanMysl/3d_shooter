

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
 const nextCanResume=!!checkpoint&&(
  checkpoint.state==='upgrade'&&checkpoint.sector===unlocked-1 ||
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
 panel(`<section class="campaignScreen" aria-label="Карта кампании">
 <div class="campaignTop"><div><div class="eyebrow">◈ ECLIPSE PROTOCOL · КАМПАНИЯ ${devMode?'· DEV':''}</div><h1 class="campaignTitle">КАРТА <span style="color:#63f6ff">УРОВНЕЙ</span></h1><div class="smalltext">${devMode?'Тестовый режим: все 100 уровней открыты. Выбери главу или введи номер уровня.':'Пять глав, 100 уровней. Выбирай пройденные или следующий открытый уровень.'}</div></div>
 <div class="campaignCounter"><strong>${done}</strong><small>УРОВНЕЙ ПРОЙДЕНО</small></div></div>
 <div class="campaignLegend"><span><i class="campaignDot done"></i> Пройден</span><span><i class="campaignDot now"></i> Доступен</span><span><i class="campaignDot locked"></i> Закрыт</span><span>♛ Босс каждые 5 уровней</span></div>
 <div class="campaignHero"><div style="font-size:33px;color:#81e3ff">${heroIcon}</div><div><b>${done>=CAMPAIGN_MAX_LEVEL?'✓ КАМПАНИЯ ЗАВЕРШЕНА':`Следующий: уровень ${unlocked}`}</b><small>${nextTitle} · ${missionInfo(unlocked).name}${rec.attempts?' · Попыток: '+rec.attempts:''}</small></div></div>
 <div class="campaignChapter"><div class="campaignChapterHead"><div><b>ГЛАВА ${campaignPage+1} · ${chapterName}</b><small>Уровни ${first}–${last} · пройдено ${chapterDone}/20</small></div>
 <div class="campaignPagination"><button id="prevChapter" ${campaignPage===0?'disabled':''} aria-label="Предыдущая глава">‹</button><span style="font-weight:900;font-size:12px">${campaignPage+1} / ${maxPage}</span><button id="nextChapter" ${campaignPage>=maxPage-1?'disabled':''} aria-label="Следующая глава">›</button></div></div>
 <div class="campaignProgressOuter"><div class="campaignProgressInner" style="width:${(chapterDone/CAMPAIGN_CHAPTER_SIZE*100).toFixed(2)}%"></div></div>
 <div class="campaignRoute"><svg class="campaignWires" aria-hidden="true"></svg>${nodes.join('')}</div></div>
 <div class="campaignDetails" id="campaignStageDetail"><strong>Уровень ${unlocked}: ${nextTitle}</strong><div>Нажми на открытую клетку карты, чтобы увидеть рекорд и начать прохождение.</div></div>
 <div class="campaignActions"><button id="mapPlayNext" class="primary">${nextCanResume?`↪ ПРОДОЛЖИТЬ ЗАБЕГ · ${checkpoint.sector}`:done>=CAMPAIGN_MAX_LEVEL?'▶ ПОВТОРИТЬ ФИНАЛ · 100':`▶ ИГРАТЬ · УРОВЕНЬ ${unlocked}`}</button>${checkpoint&&!nextCanResume?`<button id="mapResume" class="secondary">↪ ПРОДОЛЖИТЬ ${checkpoint.sector}</button>`:''}<button id="mapHangar" class="secondary">⚙ АНГАР</button><button id="mapBack" class="secondary">← МЕНЮ</button></div>
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
     detail.innerHTML=`<strong>Уровень ${stage} · ${stageName(stage)}</strong><div>${completed?'✓ Пройден':'➤ Текущий доступный'} ${stage%5===0?'· ♛ БОСС':''}</div><div>Миссия: ${missionInfo(stage).icon} ${missionInfo(stage).name} — ${missionInfo(stage).hint}</div><div>Побед: ${rec.wins||0} · Попыток: ${rec.attempts||0} · Медаль: ${medal}${rec.bestStars?' · '+ '★'.repeat(rec.bestStars):''}${rec.bestScore?' · Рекорд: '+rec.bestScore:''}</div><button id="playSelected" class="primary" style="margin-top:9px">${nextCanResume&&stage===unlocked?'↪ ПРОДОЛЖИТЬ ЗАБЕГ':completed?'▶ ПОВТОРИТЬ':'▶ НАЧАТЬ'} · УРОВЕНЬ ${stage}</button>`;
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
