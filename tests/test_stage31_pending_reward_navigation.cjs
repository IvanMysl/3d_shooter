'use strict';
// After winning sector 3, sector 4 is unlocked but an unclaimed run upgrade
// must be awarded BEFORE entering sector 4. Verify labels, navigation, the
// restored card-selection result, and scroll reset independently of graphics.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};

const mapSource=read('src/21-campaign-map.js');
const mapBody=mapSource.slice(mapSource.indexOf('function showCampaignMap('));
function mapScenario(checkpoint){
 let markup='',detailMarkup='',scrollRequests=0;
 const starts=[];
 const nodes=[3,4].map(stage=>({dataset:{stage:String(stage)},
  addEventListener(_type,callback){this.onclick=callback;}}));
 const details={get innerHTML(){return detailMarkup},set innerHTML(x){detailMarkup=x},
  scrollIntoView(){scrollRequests++;}};
 const elements={panel:{querySelectorAll:()=>nodes},campaignStageDetail:details,
  mapPlayNext:{},mapResume:{},prevChapter:{},nextChapter:{},
  mapHangar:{},mapBack:{},playSelected:{}};
 const ctx={Math,Number,Array,String,Object,console,
  save:{campaign:{completedThrough:3,highestUnlocked:4,records:{3:{wins:1}}},checkpoint},
  campaignPage:0,game:null,input:{fire:false},devMode:false,
  CAMPAIGN_CHAPTER_SIZE:20,CAMPAIGN_MAX_LEVEL:100,
  CAMPAIGN_ZONE_NAMES:['Цитадель'],
  clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),
  missionInfo:stage=>({icon:'◈',name:'ЗАЧИСТКА',hint:'Устрани врагов '+stage}),
  stageName:stage=>'СЕКТОР '+stage,
  mapChapterMaximum:()=>5,developerStageAccessible:stage=>stage<=4,
  closeArsenal(){},saveRun(){},
  document:{pointerLockElement:null,exitPointerLock(){}},
  panel:html=>{markup=html},
  $:id=>elements[id]||null,
  requestAnimationFrame(){},updateCampaignRoute(){},wireBackupButtons(){},
  startGame:(...args)=>starts.push(args),
  hangar(){},menu(){},persist(){}};
 vm.createContext(ctx);vm.runInContext(mapBody,ctx);
 ctx.showCampaignMap(0);
 return {ctx,nodes,elements,starts,details,
  get markup(){return markup},get detailMarkup(){return detailMarkup},
  get scrollRequests(){return scrollRequests}};
}

const reward={state:'upgrade',sector:3,pendingUpgrade:['regen','heal','bullet']};
const pending=mapScenario(reward);
check(pending.markup.includes('Награда за уровень 3 ещё не выбрана'),
 'map does not explain why sector 4 does not start immediately');
check(pending.markup.includes('ВЫБРАТЬ НАГРАДУ · 3 → 4'),
 'global continue button mislabels sector 3 reward as sector 4 gameplay');
pending.nodes[1].onclick();
check(pending.detailMarkup.includes('НАГРАДА 3 → УРОВЕНЬ 4'),
 'selected sector 4 CTA does not describe the pending reward');
check(pending.detailMarkup.includes('Забери улучшение за уровень 3'),
 'sector 4 detail omits reward explanation');
pending.elements.playSelected.onclick();
check(pending.starts.length===1&&pending.starts[0][0]===true,
 'tapping sector 4 discarded the saved reward instead of resuming it');
pending.elements.mapPlayNext.onclick();
check(pending.starts.length===2&&pending.starts[1][0]===true,
 'global reward button did not resume the checkpoint');
check(pending.ctx.save.checkpoint===reward,
 'map navigation cleared the unclaimed checkpoint');
check(pending.scrollRequests===1,
 'selected stage details no longer scroll into view');

const active=mapScenario({state:'playing',sector:4});
check(active.markup.includes('ПРОДОЛЖИТЬ ЗАБЕГ · 4'),
 'active level 4 save cannot resume directly');
check(!active.markup.includes('ВЫБРАТЬ НАГРАДУ'),
 'already claimed reward is still shown on map');
active.nodes[1].onclick();
check(active.detailMarkup.includes('ПРОДОЛЖИТЬ ЗАБЕГ · УРОВЕНЬ 4'),
 'in-progress level 4 incorrectly asks for a reward');
active.elements.playSelected.onclick();
check(active.starts.length===1&&active.starts[0][0]===true,
 'level 4 checkpoint cannot resume');

const newRun=mapScenario(null);
check(newRun.markup.includes('ИГРАТЬ · УРОВЕНЬ 4'),
 'new level 4 run is incorrectly described as resumed');
newRun.nodes[1].onclick();newRun.elements.playSelected.onclick();
check(newRun.starts.length===1&&newRun.starts[0][0]===false&&newRun.starts[0][1]===4,
 'starting unlocked level 4 selected a wrong level');

const uiSource=read('src/20-minimap-and-checkpoint.js');
const content={innerHTML:'',scrollTop:1330};
let fullscreenWired=0,hidden=false,shown=false;
const ui={game:null,legacyDiverged:false,GAME_BUILD:'32',GAME_RELEASE:'2026-11-16',location:{protocol:'https:'},
 $:id=>id==='panel'?content:id==='overlay'?{classList:{remove(){shown=true}}}:
  id==='hud'?{classList:{remove(){hidden=true}}}:null,
 updateFullscreenButtons(){fullscreenWired++;}};
vm.createContext(ui);
vm.runInContext(uiSource.slice(uiSource.indexOf('function panel(html){')),ui);
ui.panel('<h1>НАГРАДА / УРОВЕНЬ 3</h1>');
check(content.scrollTop===0,'new reward page retained campaign map scroll offset');
check(content.innerHTML.startsWith('<div class="buildReleaseStamp"')&&
  content.innerHTML.includes('<h1>НАГРАДА / УРОВЕНЬ 3</h1>')&&
  hidden&&shown&&fullscreenWired===1,
 'new panel no longer initializes overlay and fullscreen correctly');

const menuSource=read('src/22-menus-and-upgrades.js');
const menus=menuSource.slice(menuSource.indexOf('function showUpgrade('),
 menuSource.indexOf('function flightPauseSettingsHTML('));
const cards=[0,1,2].map(i=>({dataset:{pick:String(i)}}));
const game={sector:3,state:'playing',pendingUpgrade:null,upgrades:{},mission:{type:'purge'}};
let upgradeMarkup='',saveCalls=0,entered=null,overlayHidden=false,hudShown=false;
const chosen=[
 {id:'heal',name:'Ремонт',icon:'✚',desc:'Ремонт',fn:g=>{g.p.hp+=15}},
 {id:'regen',name:'Ядро',icon:'⚡',desc:'Регенерация',fn:g=>{g.p.regen+=2}},
 {id:'bullet',name:'Урон',icon:'◆',desc:'Урон',fn:g=>{g.p.damage+=.15}}];
game.p={hp:50,regen:10,damage:1};
const buttons={winMap:{},winReplay:{},winMenu:{},overlay:{classList:{add(name){overlayHidden=name==='hidden'}}},
 hud:{classList:{add(name){hudShown=name==='show'}}}};
const upgradeCtx={game,Math,Array,Number,document:{querySelectorAll:()=>cards},
 upgrades:chosen,closeArsenal(){},CAMPAIGN_MAX_LEVEL:100,
 showFinalVictory(){throw Error('Wrong final victory')},
 pickUpgrades:()=>chosen,saveRun(){saveCalls++},
 panel:html=>{upgradeMarkup=html},$:(id)=>buttons[id],
 MISSION_TYPES:{purge:{name:'ЗАЧИСТКА',icon:'⚔'}},missionStars:()=>2,
 showCampaignMap(){},startGame(){},enterSector:stage=>{entered=stage;game.sector=stage},
 toast(){}};
vm.createContext(upgradeCtx);vm.runInContext(menus,upgradeCtx);
upgradeCtx.showUpgrade(['heal','regen','bullet']);
check(game.state==='upgrade'&&saveCalls===1,
 'restored reward choice is not persisted before opening overlay');
check(upgradeMarkup.includes('Выбери одно из трёх улучшений')&&
  upgradeMarkup.includes('сразу начнётся уровень 4'),
 'reward screen does not clearly explain the transition to sector 4');
check(cards.every(c=>typeof c.onclick==='function'),
 'some saved upgrade cards cannot be selected');
cards[1].onclick();
check(game.state==='playing'&&game.sector===4&&entered===4,
 'selecting reward failed to begin sector 4');
check(game.upgrades.regen===1&&game.p.regen===12&&game.pendingUpgrade===null,
 'selected upgrade not applied or not removed from pending rewards');
check(saveCalls===2&&overlayHidden&&hudShown,
 'after selecting reward level 4 is not saved and game overlay remains');

console.log(`STAGE31 REWARD NAVIGATION: ${checks} assertions passed`);
