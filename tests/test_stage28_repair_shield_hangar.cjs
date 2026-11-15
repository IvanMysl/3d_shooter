'use strict';
// Stage28 regression: four persistent branches, priority F, protected C with
// five seconds AFTER expiration, hangar Escape, and legacy checkpoint migration.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=name=>fs.readFileSync(path.join(__dirname,'../src',name),'utf8');
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
let checks=0;
function yes(value,description){assert.ok(value,description);checks++;}
function near(actual,expected,description){yes(Math.abs(actual-expected)<1e-6,`${description}: ${actual} != ${expected}`);}
const core=src('00-core-save.js'),arsenal=src('12-arsenal-and-game.js');
const stats=arsenal.slice(arsenal.indexOf('const PERM_COMPOUND='),arsenal.indexOf('function newPlayer('));
const perms=Array(12).fill(0),base={Math,Number,Array,clamp,save:{perms}};
vm.createContext(base);
vm.runInContext(core.slice(core.indexOf('const PERM_MAX_LEVEL='),core.indexOf('function getSaved(')),base);
vm.runInContext(stats,base);
const inspect=s=>vm.runInContext(s,base);
yes(inspect('PERM_COUNT')===12,'four new permanent slots missing');
let old=Array.from(inspect('normalizePerms([3,4,5,6,7,8,9,10])'));
yes(old.length===12&&old.slice(0,8).join(',')==='3,4,5,6,7,8,9,10'&&old.slice(8).every(v=>v===0),
 'eight-branch Stage27 save must append four zeros without losing ranks');
old=Array.from(inspect('normalizePerms([0,0,0,0,0,0,0,0,999,40,20,-5])'));
yes(old[8]===40&&old[9]===40&&old[10]===20&&old[11]===0,'new branch ranks must clamp to [0,40]');

for(const rank of [0,1,2,10,20,40]){
 for(const [name,index,value,factor] of [
  ['корпус F',8,49,1.03],['бронекостюм F',9,.07,1.025],
  ['барьер F',10,.30,1.02],['сфера C',11,3.5,1.006]]){
  const got=inspect(`permanentStat(${value},PERM_COMPOUND.${['repairHull','repairSuit','repairBarrier','shieldDuration'][index-8]},${rank})`);
  near(got,value*factor**rank,`${name} LVL ${rank}`);
 }
}

const abilities=src('18-ai-and-abilities.js');
const abilitySrc=abilities.slice(abilities.indexOf('function restorePriorityDefense('),abilities.indexOf('function enemyFire('));
const player={hp:0,maxhp:1200,bodyArmor:0,bodyArmorMax:600,armor:0,maxArmor:300,
 energy:500,maxEnergy:500,shield:0,shieldDuration:3.5,abilityCooldowns:{},x:1,z:1,feetY:0};
const powers={Math,Number,clamp,save:{perms:Array(12).fill(0)},game:{state:'playing',p:player},
 toast(){},burst(){},sound(){},input:{mx:0,mz:0}};
vm.createContext(powers);vm.runInContext(stats,powers);vm.runInContext(abilitySrc,powers);
yes(powers.useAbility('heal')==='hp','F must first repair hull');
near(player.hp,49,'base F hull repair');near(player.energy,450,'base hull energy cost');
player.hp=0;player.energy=100;powers.save.perms[8]=40;
powers.useAbility('heal');near(player.hp,49*1.03**40,'LVL 40 hull repair');near(player.energy,50,'LVL 40 hull cost stays 50');
player.hp=player.maxhp;player.bodyArmor=0;player.energy=100;powers.save.perms[9]=40;
yes(powers.useAbility('heal')==='bodyArmor','F must repair suit second');
near(player.bodyArmor,600*.07*1.025**40,'LVL 40 suit repair');near(player.energy,50,'LVL 40 suit energy cost');
player.bodyArmor=player.bodyArmorMax;player.armor=0;player.energy=100;powers.save.perms[10]=40;
yes(powers.useAbility('heal')==='armor','F must restore barrier third');
near(player.armor,300*.30*1.02**40,'LVL 40 barrier repair');near(player.energy,60,'barrier energy price remains 40');
player.hp=player.maxhp;player.bodyArmor=player.bodyArmorMax;player.armor=player.maxArmor;
player.energy=50;yes(powers.useAbility('heal')===false,'full defenses must block repair');
near(player.energy,50,'full defenses must not drain energy');
player.hp=0;player.energy=2;powers.useAbility('heal');
near(player.hp,49*1.03**40*2/50,'partial hull repair scales with energy');
near(player.energy,0,'partial repair cannot overdraw energy');

player.energy=49;player.shield=0;player.abilityCooldowns.shield=0;
powers.useAbility('shield');near(player.energy,49,'C should reject 49 energy');
player.energy=100;player.shieldDuration=3.5*1.006**40*1.25**3;
powers.useAbility('shield');
near(player.energy,50,'C activation consumes exactly 50');
near(player.shield,player.shieldDuration,'C duration uses all permanent and temporary bonuses');
near(player.abilityCooldowns.shield-player.shield,5,'C recharge is five seconds after protection ends');
powers.useAbility('shield');near(player.energy,50,'second C cannot activate during protection');
const activeTime=player.shield;
player.shield=0;player.abilityCooldowns.shield=5;
powers.useAbility('shield');near(player.energy,50,'second C cannot activate during five-second cooldown');
player.abilityCooldowns.shield=0;
powers.useAbility('shield');near(player.energy,0,'C reactivates only after recharge, consumes 50 again');
yes(activeTime>5,'temporary and permanent perks really can extend duration past five seconds');

// Render the production hangar with minimal DOM stubs and exercise the real
// purchase click handler, not only string inspection of shop descriptions.
const shopCode=src('22-menus-and-upgrades.js'),items=[];
let menuVisits=0,persistCalls=0,hangarVisible=false,rendered='';
let focusedUpgrade=-1;
const sections=new Map(['defense','energy','combat','repair','abilities'].map(id=>[
 'perm-'+id,{dataset:{section:'perm-'+id},open:false}]));
const elements=new Map([['panel',{scrollTop:0}],['back',{click(){this.onclick?.()}}],['operatorCanvas',{}],
 ['operatorPreviewName',{}],['removeArmor',{}]]);
const shop={Math,Number,Array,clamp,PERM_MAX_LEVEL:40,PERM_COUNT:12,CAMPAIGN_MAX_LEVEL:100,
 DASH_DISTANCE_BASE:2.52,DASH_UPGRADE_STEP:.30,
 save:{perms:Array(12).fill(0),campaign:{highestUnlocked:1},bodyArmor:{owned:{},equipped:-1},credits:10000},
 PERM_COMPOUND:vm.runInContext('PERM_COMPOUND',base),
 permanentStat:(v,f,l)=>v*f**l,
 equippedArmorStats:()=>({id:-1,maxDurability:0}),
 BODY_ARMOR_CATALOG:[{name:'Тестовый костюм',price:45}],recommendedArmorId:()=>0,
 developerCredits:()=>shop.save.credits,developerCanAfford:cost=>shop.save.credits>=cost,
 developerBuy:cost=>{shop.save.credits-=cost},persist:()=>{persistCalls++},
 devMode:false,weaponShopHTML:()=>'',armorShopHTML:()=>'',renderArmorPreview(){},
 panel:html=>{rendered=html;hangarVisible=true;for(const item of sections.values())item.open=false},
 menu:()=>{menuVisits++;hangarVisible=false},
 $:id=>elements.get(id)||{scrollTop:0},document:{
  querySelectorAll:selector=>selector==='[data-up]'?items:
   selector==='.permCategory[open]'?[...sections.values()].filter(c=>c.open):[],
  querySelector:selector=>selector==='[data-up]'&&hangarVisible?items[0]:
   sections.get(selector.match(/^\[data-section="([^"]+)"\]$/)?.[1])||
   items[Number(selector.match(/^\[data-up="(\d+)"\]$/)?.[1])]||null}};
for(let i=0;i<12;i++)items.push({dataset:{up:String(i)},onclick:null,focus:()=>{focusedUpgrade=i}});
vm.createContext(shop);
vm.runInContext(shopCode.slice(shopCode.indexOf('const hangarData='),shopCode.indexOf('function weaponShopHTML(')),shop);
yes(vm.runInContext('hangarData.length',shop)===12,'hangarData must expose twelve research entries');
vm.runInContext(shopCode.slice(shopCode.indexOf('function hangar('),shopCode.indexOf('function defeatRecoveryCredits(')),shop);
shop.hangar();
yes((rendered.match(/data-up="\d+"/g)||[]).length===12,'all twelve upgrade buttons must render');
for(const term of ['РЕМОНТ КОРПУСА (F)','РЕМОНТ КОСТЮМА (F)',
 'РЕМОНТ БАРЬЕРА (F)','ВРЕМЯ ЗАЩИТНОЙ СФЕРЫ (C)'])
 yes(rendered.includes(term),`missing hangar item: ${term}`);
yes(rendered.includes('49,0 ед. корпуса за F')&&rendered.includes('3,50 с защиты'),
 'hangar must show current quantities, not only percentages');
yes((rendered.match(/class="permCategory"/g)||[]).length===5,
 'five collapsible categories should replace the tall flat upgrade list');
yes((rendered.match(/<summary>/g)||[]).length===5,
 'each general-upgrade category should have an accessible native summary');
yes(!/<details[^>]+data-section="perm-[^"]+"[^>]*\bopen\b/.test(rendered),
 'categories must be collapsed by default to save screen space');
sections.get('perm-repair').open=true;
sections.get('perm-energy').open=true;
elements.get('panel').scrollTop=125;
items[8].onclick();
yes(shop.save.perms[8]===1&&shop.save.credits===9955&&persistCalls===1,
 'purchase must spend exactly 45 credits, save and refresh');
yes(rendered.includes('50,5 ед. корпуса за F'),'UI does not refresh hull repair after purchase');
yes(sections.get('perm-repair').open&&sections.get('perm-energy').open&&elements.get('panel').scrollTop===125,
 'purchase must preserve all open categories and scroll position');
yes(focusedUpgrade===8,'keyboard focus must return to purchased improvement');

// The actual Escape handler should leave the hangar; existing pause behavior
// and other menu screens must remain unchanged.
const input=src('26-input-handlers.js'),escapeStart=input.indexOf("addEventListener('keydown',e=>{if(e.code!=='Escape'");
yes(escapeStart>=0,'Escape handler missing');
const escapePart=input.slice(escapeStart,input.indexOf(";glCanvas.addEventListener('mousedown'",escapeStart)+1);
const listeners={},keyCtx={game:null,document:shop.document,$:shop.$,
 addEventListener:(event,fn)=>{listeners[event]=fn},pause:()=>{keyCtx.game.state='paused'},
 unpauseGame:()=>{keyCtx.game.state='playing'}};
vm.createContext(keyCtx);vm.runInContext(escapePart,keyCtx);
const press=()=>{let prevented=0;listeners.keydown({code:'Escape',repeat:false,preventDefault:()=>prevented++});return prevented};
yes(press()===1&&menuVisits===1,'Esc in hangar must click its Back button');
yes(press()===0&&menuVisits===1,'Esc in main menu must not navigate again');
keyCtx.game={state:'playing'};
yes(press()===1&&keyCtx.game.state==='paused','Esc must still pause gameplay');
yes(press()===1&&keyCtx.game.state==='playing','Esc must still unpause gameplay');

// Checkpoint saved with eight ranks, then a fresh Stage28 shield purchase.
const checkpoint=src('20-minimap-and-checkpoint.js');
const restore={Math,Number,Array,clamp,PERM_MAX_LEVEL:40,DASH_DISTANCE_BASE:2.52,DASH_UPGRADE_STEP:.30,
 save:{perms:[0,0,0,0,0,0,0,0,0,0,0,20]},weapons:Array(10).fill(null),
 sectorArchitecture:'TEST',floorHeight:()=>0,collide:()=>false,
 equippedArmorStats:()=>({id:-1,maxDurability:0,reduction:0,wear:1}),
 $:()=>({style:{},dataset:{},textContent:''})};
restore.game={sector:1,state:'playing',p:{},enemies:[],upgrades:{energyshield:2}};
vm.createContext(restore);vm.runInContext(stats,restore);
vm.runInContext(checkpoint.slice(checkpoint.indexOf('function restoreLiveCheckpoint('),checkpoint.indexOf('// Auto-save during combat')),restore);
const oldPlayer={x:0,z:0,weapon:0,hp:100,maxhp:100,maxArmor:30,armor:30,
 regen:16,maxEnergy:100,energy:100,damage:1,dashRange:2.52,
 shieldDuration:3.5*1.25**2,shield:1.2,abilityCooldowns:{shield:8.4}};
const legacy={version:4,permanentFormula:'compound-v2',barrierFormula:'compound-v2',
 permanentLevels:Array(8).fill(0),player:oldPlayer,live:{enemies:[]}};
restore.restoreLiveCheckpoint(legacy);
near(restore.game.p.shieldDuration,3.5*1.25**2*1.006**20,
 'purchase after eight-slot checkpoint must preserve temporary shield perks');
near(restore.game.p.abilityCooldowns.shield,6.2,
 'old active sphere must migrate to five seconds after remaining shield');
const already={...legacy,shieldRechargeModel:'after-duration-5s',
 permanentLevels:[...restore.save.perms],player:{...oldPlayer,
 shieldDuration:3.5*1.25**2*1.006**20,shield:0,abilityCooldowns:{shield:2.4}}};
restore.restoreLiveCheckpoint(already);
near(restore.game.p.shieldDuration,already.player.shieldDuration,
 'Stage28 checkpoint should not double-apply permanent duration ranks');
near(restore.game.p.abilityCooldowns.shield,2.4,'Stage28 cooldown should resume exactly');

console.log(`STAGE28: ${checks} repair, compound-rank, C, hangar, Esc and save-migration assertions passed`);
