'use strict';
// Stage 21: gantry jumping, truthful percentage upgrades, near-perfect suits
// and the exact terminal campaign boundary (100, never 101).
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
let checks=0;
const check=(ok,label)=>{assert.ok(ok,label);checks++;};
const near=(a,b,label,eps=1e-7)=>check(Math.abs(a-b)<eps,`${label}: ${a} != ${b}`);

// Reproduce the exact reported case: boots on a 4.1-meter-high, narrow beam.
const mapSize=16,cells=Array.from({length:16},()=>Array(16).fill(0));
const physics={console,Math,Array,Number,Float32Array,Float64Array,mapSize,mapCells:cells,
 glReady:true,sectorStyle:15,mapRooms:[],save:{settings:{audio:false}},
 game:{state:'playing',p:null},input:{jumpQueued:false,jumpHeld:false,flyUp:false,flyDown:false,keys:{}},
 arsenalOpened:false,sound(){},toast(){},clamp,hypot:Math.hypot};
vm.createContext(physics);
vm.runInContext(source('03-height-and-collision.js')+'\n'+source('04a-static-world-solids.js'),physics);
physics.resetWorldSolids();
physics.registerWorldSolid(5.1,3.91,5.20,6.2,4.10,5.35,'gantry');
const p={x:5.60,z:5.27,feetY:4.10,vy:0,grounded:true,flying:false,flightUnlocked:false};
physics.game.p=p;
for(let i=0;i<30;i++)physics.updateVertical(p,1/60);
near(p.feetY,4.10,'feet drifted off narrow beam');
check(p.grounded,'landing on a narrow beam is not recognized as grounded');
physics.input.jumpQueued=true;
physics.updateVertical(p,1/60);
check(!p.grounded&&p.vy>0&&p.feetY>4.10,'Space jump from beam was blocked');
// No levitation after stepping away, and no fake lift from distant overhead.
p.x=7;p.z=7;p.feetY=4.10;p.vy=0;p.grounded=true;
physics.updateVertical(p,1/60);
check(!p.grounded&&p.feetY<4.10,'player hovers beyond beam edge');
physics.registerWorldSolid(7,6.0,7,8,6.1,8,'overhead');
check(physics.worldSolidStandingSupport(7.5,7.5,.23,4.10)===null,
 'a distant roof becomes phantom supporting floor');

// Read the real equipment formulas and real player initialization.
const gear={console,Math,Number,Array,clamp,spawnX:2,spawnZ:2,
 weapons:Array.from({length:10},()=>({damage:18,rate:.2,heat:8,range:32,spread:.01,shots:1})),
 save:{perms:[0,0,0,0,0,0],bodyArmor:{owned:{},equipped:-1},weaponMods:{}}};
vm.createContext(gear);vm.runInContext(source('12a-loadout-economy.js'),gear);
vm.runInContext('const DASH_DISTANCE_BASE=2.52,DASH_UPGRADE_STEP=.30;',gear);
const arsenal=source('12-arsenal-and-game.js');
vm.runInContext(arsenal.slice(arsenal.indexOf('const PERM_COMPOUND='),arsenal.indexOf('function freshGame(')),gear);
const newPlayer=()=>vm.runInContext('newPlayer()',gear);
for(const lv of [0,1,13,40]){
 gear.save.perms=[lv,lv,lv,lv,lv,lv];
 const current=newPlayer();
 near(current.maxhp,100*Math.pow(1.08,lv),'permanent health compounds');
 near(current.maxArmor,30*Math.pow(1.09,lv),'barrier compounds from previous rank');
 near(current.maxEnergy,100*Math.pow(1.04,lv),'energy capacity compounds');
 near(current.regen,16*Math.pow(1.04,lv),'energy regeneration compounds');
 near(current.damage,Math.pow(1.04,lv),'weapon damage compounds');
 near(current.dashRange,2.52+.30*lv,'dash cap remains +0.3m per level');
}
const count=vm.runInContext('BODY_ARMOR_CATALOG.length',gear);
check(count===16,'expected sixteen suits, including four late-tier variants');
for(let i=12;i<16;i++){
 gear.save.bodyArmor.owned[i]=20;gear.save.bodyArmor.equipped=i;
 const suit=vm.runInContext('equippedArmorStats()',gear);
 const current=newPlayer();
 check(current.flightUnlocked,`late suit ${i+1} does not grant flight`);
 near(current.bodyArmorReduction,suit.reduction,'actual reduction differs from displayed suit');
 near(current.bodyArmorWear,suit.wear,'actual wear differs from catalog');
 check(suit.reduction>.9&&suit.reduction<1,'damage reduction out of legal range');
}
gear.save.bodyArmor.equipped=15;
const ultimate=vm.runInContext('equippedArmorStats()',gear);
near(ultimate.reduction,.9995,'final upgraded suit must reduce incoming damage by 99.95%');
check(ultimate.wear<1.12,'late suit should wear down more slowly than old suits');

// Damage reduction must actually reach HP and suit durability, not be UI text.
const bar={classList:{add(){},remove(){}}};
const dmg={Math,Number,console,clamp,game:{state:'playing',p:null},
 $:id=>id==='bars'?bar:{style:{}},setTimeout:()=>1,sound(){},gameOver(){}};
vm.createContext(dmg);
const damage=source('13-enemy-navigation-spawn.js');
vm.runInContext(damage.slice(damage.indexOf('function damagePlayer('),damage.indexOf('function burst(')),dmg);
const protectedP={hp:100,maxhp:100,armor:0,armorTier:0,iframes:0,shield:0,
 bodyArmor:ultimate.maxDurability,bodyArmorReduction:ultimate.reduction,bodyArmorWear:ultimate.wear};
dmg.game.p=protectedP;dmg.damagePlayer(1000);
near(protectedP.hp,99.5,'1000 damage with 99.95% reduction should cost 0.5 HP');
near(protectedP.bodyArmor,ultimate.maxDurability-999.5*ultimate.wear,
 'incoming damage fails to consume physical suit durability');
protectedP.iframes=0;protectedP.bodyArmor=0;dmg.damagePlayer(40);
near(protectedP.hp,59.5,'destroyed suit still magically absorbs damage');

// The hangar must show decimals accurately: NEVER round 99.95% to 100%.
gear.developerCanAfford=()=>true;
const ui=source('22-menus-and-upgrades.js');
vm.runInContext(ui.slice(ui.indexOf('function armorShopHTML('),ui.indexOf('function hangar(')),gear);
const html=vm.runInContext('armorShopHTML()',gear);
check(html.includes('99,95%'),'final 99.95% reduction not shown correctly');
check(!html.includes('100%'),'UI falsely promises invulnerability');
check(ui.includes('Максимальная прочность +8%')&&ui.includes('Урон любого оружия +4%')&&ui.includes('Восстановление энергии +4%')&&ui.includes('Все проценты начисляются от предыдущего уровня'),
 'permanent upgrade descriptions must disclose compound percentages');

// Limits, old-save clamping and a terminal victory without level 101.
const campaign={console,Math,Number,clamp};vm.createContext(campaign);
const core=source('00-core-save.js');
vm.runInContext(core.slice(core.indexOf('const CAMPAIGN_CHAPTER_SIZE='),core.indexOf('save.campaign=normalizeCampaign(')),
 Object.assign(campaign,{save:{campaign:null}}));
check(vm.runInContext('CAMPAIGN_MAX_LEVEL===100&&CAMPAIGN_CHAPTER_SIZE===20',campaign),
 'campaign boundary is not 5 chapters / 100 levels');
const progress=vm.runInContext('normalizeCampaign({schema:1,completedThrough:100,highestUnlocked:100},100)',campaign);
check(progress.completedThrough===100&&progress.highestUnlocked===100,'completed final campaign not preserved');
const legacy=vm.runInContext('normalizeCampaign(null,7000,{sector:99999})',campaign);
check(legacy.highestUnlocked===100,'old high-level save escaped level cap');
const final={Math,Number,clamp,CAMPAIGN_MAX_LEVEL:100,
 game:{state:'playing',sector:100,p:{hp:100,maxhp:100},kills:1,score:200},
 save:{best:100,campaign:{highestUnlocked:100},credits:0,checkpoint:{sector:100}},
 document:{pointerLockElement:null},recordLevelCompleted(){final.recorded++;},
 showFinalVictory(){final.won++;},showUpgrade(){final.bad++;},persist(){},recorded:0,won:0,bad:0};
vm.createContext(final);vm.runInContext(source('19-gameplay-update.js').slice(
 source('19-gameplay-update.js').indexOf('function portalNext('),
 source('19-gameplay-update.js').indexOf('function recordLevelCompleted(')),final);
final.portalNext();
check(final.game.state==='victory'&&final.won===1&&final.bad===0,'finale started level 101');
check(final.recorded===1&&final.save.checkpoint===null,'final progress not saved cleanly');
check(arsenal.includes('Math.min(30,7+Math.floor(n*1.2))'),'late game enemy wave not capped');
check(damage.includes('Math.max(0,g.sector-1)*.055'),'endgame enemy damage scaling not normalized');
console.log(`STAGE21: ${checks} gantry, true percentages, armor mitigation, final campaign assertions passed`);
