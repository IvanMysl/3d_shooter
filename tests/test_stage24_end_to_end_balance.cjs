'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.join(__dirname,'..'),src=n=>fs.readFileSync(path.join(ROOT,'src',n),'utf8');
const {simulateFire}=require('../tools/combat_model.cjs');
const {rows,POLICIES,suits,attacksToLose}=require('../tools/balance_audit.cjs');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const near=(a,b,what,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol,`${what}: ${a} versus ${b}`);
let checks=0;function check(x,msg){assert.ok(x,msg);checks++;}

// Independent test of the extracted *real* shoot() implementation against the
// deterministic pure-JS thermal model at 30/60/120 frames per second.
const weaponCtx={Math,Number,Array,Map,Set,clamp,console,
 save:{perms:Array(6).fill(0),weaponMods:{},bodyArmor:{owned:{},equipped:-1}}};
vm.createContext(weaponCtx);
vm.runInContext(src('12-arsenal-and-game.js').split('function newPlayer(')[0],weaponCtx);
vm.runInContext(src('12a-loadout-economy.js'),weaponCtx);
const weaponSrc=src('17-weapon-combat.js');
weaponCtx.fireBurstShot=()=>{};weaponCtx.toast=()=>{};weaponCtx.sound=()=>{};
weaponCtx.game={state:'playing',p:null,burstQueue:[]};
vm.runInContext(weaponSrc.slice(weaponSrc.indexOf('let ammoShots=0;'),weaponSrc.indexOf('function updatePlayerOrdnance(')),weaponCtx);
for(let gun=0;gun<10;gun++)for(const levels of [0,20])for(const fps of [30,60,120]){
 const paths=Array.from(vm.runInContext(`GUN_PATHS[${gun}]`,weaponCtx));
 weaponCtx.save.weaponMods[gun]=Object.fromEntries(paths.map(p=>[p,levels]));
 const w=vm.runInContext(`combatWeapon(${gun})`,weaponCtx),seconds=35;
 const p={weapon:gun,heat:0,heatLock:0,cooldown:0,heatMod:1,rate:1,shots:0};
 weaponCtx.game.p=p;weaponCtx.game.burstQueue=[];
 for(let k=0;k<fps*seconds;k++){
  const dt=1/fps;
  p.cooldown=Math.max(-dt,p.cooldown-dt);p.heatLock=Math.max(0,p.heatLock-dt);
  p.heat=Math.max(0,p.heat-dt*(p.heatLock>0?22:25));weaponCtx.shoot();
 }
 check(p.shots===simulateFire(w,{fps,seconds}).triggers,
  `weapon ${gun+1}, LVL ${levels}, ${fps} FPS: simulator diverged from actual shoot()`);
}

// Physical suit value frontier: there must be no more expensive final suit
// which is worse than a fully enhanced cheaper previous suit on every axis.
function suitStats(id,level){
 const b=suits[id];let cost=b.price;
 for(let k=0;k<level;k++)cost+=Math.round((18+.005*b.price)*(1+k*.12+k*k*.012));
 const red=Math.min(b.maxReduction??.90,b.reduction+(b.armorStep??.0045)*level);
 const durability=b.durability*Math.pow(1.08,level),budget=durability/(b.wear??1.12);
 return{cost,red,budget};
}
const s14=suitStats(13,20),s15=suitStats(14,20),s16=suitStats(15,0);
check(s16.cost>s14.cost&&s16.red>s14.red,
 'final suit has no meaningful compensating protection improvement for higher price');
check(s16.budget>s15.budget&&s16.red<s15.red,
 'final baseline / previous maximum should be distinct meaningful tradeoffs');
check(s16.red<1&&suitStats(15,20).red<1,'no suit may confer unlimited physical invulnerability');

// Every one of 100 stages, three affordable loadouts: depleted-suit scenario
// starts with only the automatic +34% suit and +28% barrier resupply. Full HP
// is intentionally optimistic; the purpose is specifically to stop one-shot
// deaths and quantify the danger of NOT finding optional repair resources.
const bossPatterns=[1,1.5,1,1,1.5,1,1.5,1.5];
for(const r of rows)for(const [name,policy] of Object.entries(POLICIES)){
 const plan=r.plans[name],goal=plan.goal,b=suits[goal.suitId];
 const hp=100*Math.pow(1.08,goal.lv[0]),barrier=30*Math.pow(1.09,goal.lv[2]);
 const suitMax=b?b.durability*Math.pow(1.08,goal.armorLv):0;
 const red=b?Math.min(b.maxReduction??.9,b.reduction+(b.armorStep??.0045)*goal.armorLv):0;
 const p={hp,maxhp:hp,armor:barrier*.28,bodyArmor:suitMax*.34,
  armorTier:Math.min(4,Math.floor(goal.lv[2]/2)),bodyArmorReduction:red,bodyArmorWear:b?(b.wear??1.12):1.12};
 check(plan.cost.total<=r.availableBefore,`level ${r.level}/${name}: unaffordable recommended path`);
 check(attacksToLose(p,r.normal)>=4,`level ${r.level}/${name}: too few ordinary hits after suit attrition`);
 if(r.bossSpike){
  const variant=(r.level/5-1)%8,actualSpike=r.bossRaw*bossPatterns[variant]*1.22*1.12;
  check(attacksToLose(p,actualSpike)>=2,
   `boss ${r.level}/${name}: one hit kills a fully healthy player with resupplied suit`);
  check(plan.bossSec<=125,`boss ${r.level}/${name}: ideal fight is excessively long`);
 }
}

// The actual player damage routine caps a single catastrophic hit ONLY when
// the player was healthy. It must still allow a second mistake to be lethal.
const damageCtx={Math,Number,clamp,game:{state:'playing',p:{
 hp:500,maxhp:500,armor:0,bodyArmor:0,bodyArmorReduction:0,iframes:0,shield:0}},
 $:()=>({style:{},classList:{add(){},remove(){}}}),setTimeout:()=>{},sound:()=>{},lost:0};
damageCtx.gameOver=()=>{damageCtx.lost++;};vm.createContext(damageCtx);
const damageCode=src('13-enemy-navigation-spawn.js');
vm.runInContext(damageCode.slice(damageCode.indexOf('function damagePlayer('),damageCode.indexOf('function burst(')),damageCtx);
damageCtx.damagePlayer(2000);near(damageCtx.game.p.hp,140,'emergency limiter leaves 28% HP');
check(damageCtx.lost===0,'one bomb killed a healthy player');
damageCtx.game.p.iframes=0;damageCtx.damagePlayer(2000);
check(damageCtx.game.p.hp===0&&damageCtx.lost===1,'two unavoided bombs should still be lethal');

// Sector resupply: start-of-run does not double-refill the intact kit; next
// level gives predictable percentage, with extra suit relief after bosses.
const sectorSource=src('12-arsenal-and-game.js');
const sectorCtx={Math,Number,clamp,spawnX:3,spawnZ:4,sectorStyle:0,
 sectorArchitecture:'TEST',decalDirty:false,themes:[{name:'TEST'}],
 buildMap(){},floorHeight(){return 0;},chooseEntranceYaw(){return 0;},
 refreshFlightButtons(){},spawnPowerNodes(){},startMission(){},initDevices(){},closeArsenal(){},
 $:()=>({style:{},textContent:''})};
sectorCtx.game={sector:1,p:{hp:20,maxhp:100,armor:10,maxArmor:100,
 bodyArmor:100,bodyArmorMax:1000,maxEnergy:100,energy:50,abilityCooldowns:{}},
 enemies:[],nodes:[],score:0};
vm.createContext(sectorCtx);
vm.runInContext(sectorSource.slice(sectorSource.indexOf('const SECTOR_RESUPPLY='),sectorSource.indexOf('function chooseEntranceYaw(')),sectorCtx);
sectorCtx.enterSector(2);
near(sectorCtx.game.p.hp,40,'next stage heals 20% maximum HP');
near(sectorCtx.game.p.armor,38,'next stage restores 28% barrier');
near(sectorCtx.game.p.bodyArmor,440,'next stage repairs 34% suit');
sectorCtx.game.sector=5;sectorCtx.game.p.bodyArmor=0;
sectorCtx.enterSector(6);near(sectorCtx.game.p.bodyArmor,460,'post boss restores 46% suit');

// Restore checkpoint after going to hangar: preserve chosen run perks AND
// apply every permanent rank bought since that checkpoint, without doubling.
const checkpointSource=src('20-minimap-and-checkpoint.js');
const capCtx={};vm.createContext(capCtx);
vm.runInContext(checkpointSource.slice(checkpointSource.indexOf('const RUN_UPGRADE_CAPS='),checkpointSource.indexOf('function pickUpgrades(')),capCtx);
const capValues=Array.from(vm.runInContext('Object.values(RUN_UPGRADE_CAPS)',capCtx));
capValues.sort((a,b)=>b-a);
check(capValues.reduce((a,b)=>a+b,0)-capValues[0]-capValues[1]>=100,
 'there are not guaranteed to be three distinct upgrade choices by the 99th reward');
check(Array.from(vm.runInContext('upgrades.map(x=>x.id)',weaponCtx)).length===capValues.length,
 'some run upgrade lacks a separate cap or implementation');
const fieldArmor=Array.from(vm.runInContext('upgrades',weaponCtx)).find(x=>x.id==='fieldarmor');
check(!!fieldArmor,'physical suit cannot be repaired by a temporary sector reward');
const reserve={p:{bodyArmor:100,bodyArmorMax:1000,armor:10,maxArmor:100}};
fieldArmor.fn(reserve);
near(reserve.p.bodyArmor,450,'emergency physical plate reward');
near(reserve.p.armor,35,'emergency energy barrier reward');

// Three barrier-duration perks must still give three useful improvements, but
// they must not produce near-constant invulnerability by cooldown stacking.
const abilityCtx={Math,Number,clamp,game:{state:'playing',p:{energy:100,
 maxEnergy:100,hp:100,maxhp:100,x:3,z:4,shield:0,shieldDuration:3.5*Math.pow(1.25,3),
 abilityCooldowns:{},dashCost:25}},toast(){},burst(){},sound(){}};
vm.createContext(abilityCtx);
const abilitySrc=src('18-ai-and-abilities.js');
vm.runInContext(abilitySrc.slice(abilitySrc.indexOf('function useAbility('),abilitySrc.indexOf('function enemyFire(')),abilityCtx);
abilityCtx.useAbility('shield');
const shield=abilityCtx.game.p;
check(Math.abs(shield.abilityCooldowns.shield-shield.shield-5)<1e-8&&shield.shield/shield.abilityCooldowns.shield<.70,
 'full shield perk set must have five seconds of downtime without endless invulnerability');
const restoreCtx={Math,Number,clamp,PERM_MAX_LEVEL:40,
 DASH_DISTANCE_BASE:2.52,DASH_UPGRADE_STEP:.30,
 save:{perms:[5,7,6,4,3,2]},weapons:Array(10).fill(null),
 sectorArchitecture:'TEST',navField:null,navClock:0,portalRouteField:null,decalDirty:false,
 floorHeight:()=>0,collide:()=>false,equippedArmorStats:()=>({id:15,maxDurability:5600,reduction:.9945,wear:.27}),
 $:()=>({style:{},dataset:{},textContent:''})};
restoreCtx.game={sector:50,state:'playing',p:{},enemies:[],upgrades:{damage:1}};
vm.createContext(restoreCtx);
const compSource=src('12-arsenal-and-game.js');
vm.runInContext(compSource.slice(compSource.indexOf('const PERM_COMPOUND='),compSource.indexOf('function newPlayer(')),restoreCtx);
vm.runInContext(checkpointSource.slice(checkpointSource.indexOf('function restoreLiveCheckpoint('),checkpointSource.indexOf('// Auto-save during combat')),restoreCtx);
const oldP={hp:148,maxhp:148,damage:1.4*1.18,armor:35,maxArmor:70,armorTier:2,
 regen:16*1.375,energy:80,maxEnergy:116,dashRange:2.82,
 bodyArmorType:13,bodyArmorMax:2100,bodyArmor:150,weapon:2,x:3,z:4};
restoreCtx.restoreLiveCheckpoint({version:3,state:'playing',sector:50,
 permanentLevels:[4,5,4,3,2,1],player:oldP,live:{enemies:[]}});
const restored=restoreCtx.game.p;
near(restored.maxhp,100*Math.pow(1.08,5),'new HP rank uses compound formula');near(restored.hp,restored.maxhp,'new HP rank migration preserves maximum health');
near(restored.damage,Math.pow(1.04,7)*1.18,'new damage rank keeps running perk');
near(restored.maxArmor,70+30*Math.pow(1.09,6)-(30+10*4),'migrated barrier cap uses compound formula');
near(restored.armor,35+(30*Math.pow(1.09,4)-(30+10*4))*.5+
 (30*Math.pow(1.09,6)-30*Math.pow(1.09,4)),
 'old damaged barrier preserves its charge fraction and credits newly bought ranks');
near(restored.regen,16*Math.pow(1.04,4),'new energy regen rank');near(restored.maxEnergy,100*Math.pow(1.04,3),'new capacity rank');
near(restored.dashRange,3.12,'new phase dash rank');
near(restored.bodyArmor,5600,'newly equipped suit starts fully repaired');
check(restored.bodyArmorType===15,'new equipped suit type lost during restore');
check(restoreCtx.game.appliedPerms.every((v,i)=>v===restoreCtx.save.perms[i]),
 'applied permanent snapshot did not advance after restore');

const map=src('21-campaign-map.js');
check(map.includes("$('mapPlayNext').onclick=()=>nextCanResume?startGame(true)"),
 'main campaign call-to-action silently discards an active run');
check(map.includes("checkpoint.state==='upgrade'&&checkpoint.sector===unlocked-1"),
 'completed level must restore pending run upgrade instead of restarting it');
console.log(`STAGE24: ${checks} deterministic heat, economy, 100-stage attrition, shop, one-hit and checkpoint assertions PASSED`);
