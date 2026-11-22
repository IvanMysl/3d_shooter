'use strict';
// Regression: the 100-level balancing spreadsheet is reconstructed directly
// from the real weapon, player, suit and shop functions, not hard-coded data.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {rows,POLICIES,suits,gain}=require('../tools/balance_audit.cjs');
const source=name=>fs.readFileSync(path.join(__dirname,'../src',name),'utf8');
let checks=0;
const check=(condition,label)=>{assert.ok(condition,label);checks++;};
const near=(a,b,label)=>{check(Math.abs(a-b)<1e-8,`${label}: ${a} vs ${b}`);};

check(rows.length===100,'campaign must have exactly 100 simulated levels');
check(suits.length===16,'all sixteen purchasable suits covered');
let prevCredits=0;
for(const r of rows){
 check(r.availableBefore===prevCredits,`level ${r.level}: budget uses unearned credits`);
 check(r.guaranteed===prevCredits+gain(r.level),`level ${r.level}: first-clear reward mismatch`);
 check(r.bossSpike>0? r.level%5===0:r.level%5!==0,
  `level ${r.level}: incorrect boss progression`);
 check(r.wave<=30,`level ${r.level}: uncapped enemy wave`);
 check(r.normal>0&&r.elite>r.normal&&r.hp>0,`level ${r.level}: robot damage/hp invalid`);
 for(const style of Object.keys(POLICIES)){
  const b=r.plans[style];
  check(b.cost.total<=r.availableBefore,
   `level ${r.level} / ${style}: build cannot be bought BEFORE this level (${b.cost.total} > ${r.availableBefore})`);
  check(b.normalHits>=3,`level ${r.level} / ${style}: two hits are instantly fatal`);
  check(r.bossSpike===0||b.bossHits>=2,
   `boss ${r.level} / ${style}: theoretical worst single hit kills player`);
  check(!r.bossHp||b.bossSec>0&&b.bossSec<240,
   `boss ${r.level} / ${style}: insufficient sustained damage`);
  check(b.armor>=0&&b.armor<1,'physical suit must never be true invulnerability');
 }
 prevCredits=r.guaranteed;
}
check(rows.at(-1).guaranteed===205725,'reward formula has drifted from economy audit');

// Armor price and actual mitigation, including caps at 99.95%.
const ctx={Math,Number,Array,Set,Map,console,
 clamp:(v,a,b)=>Math.min(Math.max(v,a),b),spawnX:0,spawnZ:0,
 save:{perms:[0,0,0,0,0,0],weaponMods:{},bodyArmor:{owned:{},equipped:-1}}};
vm.createContext(ctx);
vm.runInContext('const DASH_DISTANCE_BASE=2.52,DASH_UPGRADE_STEP=.30;',ctx);
const arsenal=source('12-arsenal-and-game.js');
vm.runInContext(arsenal.slice(0,arsenal.indexOf('function newPlayer(')),ctx);
vm.runInContext(source('12a-loadout-economy.js'),ctx);
vm.runInContext(arsenal.slice(arsenal.indexOf('function newPlayer('),arsenal.indexOf('function freshGame(')),ctx);
const calc=s=>vm.runInContext(s,ctx);
near(calc('BODY_ARMOR_CATALOG[0].price'),45,'first suit obtainable after level one');
near(calc('combatWeapon(2).damage'),calc('weapons[2].damage'),'no-upgrade weapon damage');
ctx.save.weaponMods[2]={power:20,penetration:20,rate:20};
near(calc('combatWeapon(2).damage/weapons[2].damage'),Math.pow(1.055,20),
 'gun damage upgrade compounds by 5.5% per level');
near(calc('combatWeapon(2).rate/weapons[2].rate'),Math.pow(.978,20),
 'attack speed upgrade reduces firing interval by 2.2%');
near(calc('combatWeapon(2).penetration'),Math.min(.94,.67+.018*20),
 'penetration improvement is percentage points');
ctx.save.bodyArmor.owned[15]=20;ctx.save.bodyArmor.equipped=15;
near(calc('equippedArmorStats().reduction'),.9995,'final suit 99.95% maximum reduction');
near(calc('equippedArmorStats().maxDurability'),5600*Math.pow(1.08,20),
 'physical armor gains eight percent of its previous durability per level');
let fullCost=calc('BODY_ARMOR_CATALOG[15].price');
for(let lv=0;lv<20;lv++){
 ctx.save.bodyArmor.owned[15]=lv;
 fullCost+=calc('armorUpgradePrice(15)');
}
check(fullCost<rows.at(-1).availableBefore*.40,
 'best suit fully improved consumes too much guaranteed campaign income');
check(calc('recommendedArmorId(100)')===15,'late-game recommendation reaches final suit');

// C keeps its protective cooldown; E repairs without waiting, but only when
// the player can afford the energy. F dash spends energy, not cooldown time.
const abilities=source('18-ai-and-abilities.js');
const player={energy:100,dashCost:25,shieldDuration:3.5,shield:0,
 hp:20,maxhp:100,bodyArmor:0,bodyArmorMax:100,armor:0,maxArmor:100,
 x:1,z:1,yaw:Math.PI/2,feetY:0,abilityCooldowns:{}};
const power={game:{state:'playing',p:player},Math,Number,
 toast(){},burst(){},sound(){},input:{mx:0,mz:0},clamp:(v,a,b)=>Math.min(Math.max(v,a),b),
 moveEntity:(p,dx,dz)=>{p.x+=dx;p.z+=dz},save:{perms:Array(12).fill(0),settings:{dashDistance:2.52}},
 DASH_DISTANCE_BASE:2.52,DASH_DISTANCE_MAX:14.52,DASH_DISTANCE_MIN:.5};
vm.createContext(power);
vm.runInContext(arsenal.slice(arsenal.indexOf('const PERM_COMPOUND='),arsenal.indexOf('function newPlayer(')),power);
{const fx=fs.readFileSync(path.join(__dirname,'../src/13-enemy-navigation-spawn.js'),'utf8');vm.runInContext(fx.slice(fx.indexOf('function emitWeaponSound(')),power);}
vm.runInContext(abilities.slice(abilities.indexOf('function restorePriorityDefense('),
 abilities.indexOf('function enemyFire(')),power);
power.useAbility('shield');
near(player.shield,3.5,'first shield activation');
near(player.energy,50,'first shield energy price');
near(player.abilityCooldowns.shield-player.shield,5,
 'shield must have exactly five seconds of downtime after its duration');
power.useAbility('shield');
near(player.energy,50,'shield cannot be spammed during cooldown');
player.energy=100;
power.useAbility('heal');
near(player.hp,69,'healing value was unintentionally modified');
near(player.energy,50,'heal energy cost must be respected');
power.useAbility('heal');
near(player.hp,100,'second immediate press must complete HP restore');
near(player.energy,50-31/49*50,'partial heal spends energy proportionally');
player.energy=100;
power.useAbility('heal');
check(player.bodyArmor>0&&player.hp===100,'repair priority skipped suit');
player.bodyArmor=player.bodyArmorMax;player.energy=100;
power.useAbility('heal');
check(player.armor>0&&player.armor<player.maxArmor,'barrier not restored after hull and suit');
player.energy=100;player.dashRange=2.52;
power.useAbility('dash');const afterDash=player.x;
power.useAbility('dash');
check(player.x>afterDash&&player.energy===50,'phase dash has an artificial second-use cooldown');

// Failed-but-meaningful attempts should have bounded, nonzero recovery credits.
const menus=source('22-menus-and-upgrades.js');
const recovery={Math,Number,CAMPAIGN_MAX_LEVEL:100,clamp:(v,a,b)=>Math.min(Math.max(v,a),b)};
vm.createContext(recovery);
vm.runInContext(menus.slice(menus.indexOf('function defeatRecoveryCredits('),
 menus.indexOf('function showFinalVictory(')),recovery);
near(recovery.defeatRecoveryCredits({sector:100,target:30,kills:0}),0,
 'zero-progress suicide cannot farm free credits');
check(recovery.defeatRecoveryCredits({sector:100,target:30,kills:15})>0,
 'half-completed hard attempt receives no recovery');
check(recovery.defeatRecoveryCredits({sector:100,target:1,kills:0,
 boss:{hp:1000,maxhp:2000}})>0,
 'damaging a boss without killing it should count as progress');
const recoveryMax=recovery.defeatRecoveryCredits({sector:100,target:1,kills:10});
check(recoveryMax<=Math.ceil((40+2.5*100+.1*100*100)*.75),
 'failure economy can be farmed beyond the intended cap');

// On-screen upgrade descriptions and mobile ability timers are real UI state.
check(menus.includes('armorProgress(i,lv)'),'shop and gameplay armor formulas diverged');
check(menus.includes('СОВЕТ ДЛЯ УРОВНЯ')&&menus.includes('Если тяжело'),
 'shop lacks optional difficulty guidance');
check(menus.includes('E</b> — рывок')&&menus.includes('C</b> — защитная сфера'),
 'dash and temporary sphere are not explained to the player');
check(source('19-gameplay-update.js').includes('btn.dataset.cooldown'),
 'mobile action bar has no cooldown indicator');
check(source('20-minimap-and-checkpoint.js').includes('RUN_UPGRADE_CAPS'),
 'uncapped temporary power-up stacking can break late-game balance');
console.log(`STAGE22: ${checks} assertions across 100 levels × 3 purchasing styles, real formulas, retries, cooldowns and UI passed`);
