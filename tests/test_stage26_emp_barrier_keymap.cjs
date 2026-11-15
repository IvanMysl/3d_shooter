'use strict';
// Execute production combat, permanent-stat and checkpoint code in isolated VMs.
// Nothing here replaces the actual EMP/repair/dash implementation.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=name=>fs.readFileSync(path.join(__dirname,'../src',name),'utf8');
let checks=0;
const check=(ok,why)=>{assert.ok(ok,why);checks++};
const near=(a,b,why)=>check(Math.abs(a-b)<1e-6,`${why}: ${a} != ${b}`);
const clamp=(v,a,b)=>Math.max(a,Math.min(v,b));
const playerCode=src('12-arsenal-and-game.js');
const permBlock=playerCode.slice(playerCode.indexOf('const PERM_COMPOUND='),playerCode.indexOf('function freshGame('));
const abilityCode=src('18-ai-and-abilities.js');
const pulseBlock=abilityCode.slice(abilityCode.indexOf('function useAbility('),abilityCode.indexOf('function enemyFire('));

// An old 6-item permanent save gains exactly two new empty EMP slots.
const core=src('00-core-save.js');
const saved={Math,Number,Array,clamp};vm.createContext(saved);
vm.runInContext(core.slice(core.indexOf('const PERM_MAX_LEVEL='),core.indexOf('function getSaved(')),saved);
let normalized=vm.runInContext('normalizePerms([4,5,6,7,8,9])',saved);
check(normalized.length===8&&normalized[0]===4&&normalized[5]===9&&normalized[6]===0&&normalized[7]===0,
 'old permanent save lost ranks or failed to append EMP branches');
normalized=vm.runInContext('normalizePerms([0,0,0,0,0,0,40,100])',saved);
check(normalized[6]===40&&normalized[7]===40,'EMP research ranks bypass maximum');

const progress={Math,Number,Array,clamp,spawnX:10,spawnZ:10,
 DASH_DISTANCE_BASE:2.52,DASH_UPGRADE_STEP:.30,
 save:{perms:Array(8).fill(0)},equippedArmorStats:()=>({id:-1,maxDurability:0,reduction:0,wear:1}),
 armorGrantsFlight:()=>false};vm.createContext(progress);vm.runInContext(permBlock,progress);
let freshman=progress.newPlayer();
near(freshman.maxArmor,30,'base barrier');
progress.save.perms[2]=1;
near(progress.newPlayer().maxArmor,30*1.09,'one compound barrier purchase');
progress.save.perms[2]=2;
near(progress.newPlayer().maxArmor,30*1.09**2,'second compound barrier purchase');
progress.save.perms[2]=40;
near(progress.newPlayer().maxArmor,30*1.09**40,'40th compound barrier purchase');
check(progress.newPlayer().maxArmor<1000,'max barrier growth trivializes 100-stage campaign');

const hits=[],nodesHit=[],messages=[];
const blast={Math,Number,Array,clamp,
 save:{perms:Array(8).fill(0)},
 game:{state:'playing',p:{x:0,z:0,feetY:0,energy:100,shock:1,abilityCooldowns:{pulse:999}},
  enemies:[],nodes:[],bullets:[]},
 v3:(x,y,z)=>({x,y,z}),
 robotNearArea:(e,center,r)=>Math.hypot(e.x-center.x,e.z-center.z)<=r+1,
 enemyBlastSamples:(e,center)=>({hullDist:Math.hypot(e.x-center.x,e.z-center.z),
  points:[{x:e.x,y:center.y,z:e.z}]}),
 floorHeight:()=>0,
 areaVisibility:()=>1,
 hurtEnemy:(e,d)=>hits.push([e.id,d]),
 damagePowerNode:(n,d)=>nodesHit.push([n.id,d]),
 burst(){},sound(){},toast:m=>messages.push(m),
 input:{mx:0,mz:0},moveEntity(){},DASH_DISTANCE_BASE:2.52,DASH_DISTANCE_MAX:14.52,
 DASH_DISTANCE_MIN:.5};
vm.createContext(blast);
vm.runInContext(permBlock.slice(permBlock.indexOf('const PERM_COMPOUND='),permBlock.indexOf('function newPlayer(')),blast);
vm.runInContext(pulseBlock,blast);
function targets(){
 blast.game.enemies=[{id:1,x:5,z:0,dead:false},{id:2,x:8,z:0,dead:false}];
 blast.game.nodes=[{id:1,x:5,z:0,feetY:0,radius:.2,dead:false},
  {id:2,x:8,z:0,feetY:0,radius:.2,dead:false}];
 blast.game.bullets=[{x:5,y:1.1,z:0,dead:false},{x:8,y:1.1,z:0,dead:false}];
 hits.length=0;nodesHit.length=0;
}
targets();
blast.useAbility('pulse');
near(blast.game.p.energy,48,'pulse energy price after removing cooldown');
check(blast.game.p.abilityCooldowns.pulse===0,'legacy saved Q cooldown still blocks the skill');
check(hits.length===1&&hits[0][0]===1,'base radius must not reach eight-meter target');
near(hits[0][1],66,'base pulse enemy damage');
check(nodesHit.length===1&&blast.game.bullets[0].dead&&!blast.game.bullets[1].dead,
 'base pulse does not use its radius for nodes and bullet interception');
blast.useAbility('pulse');
check(hits.length===1&&blast.game.p.energy===48,'pulse fired without enough energy');
blast.game.p.energy=52;
blast.useAbility('pulse');
check(hits.length===2&&blast.game.p.energy===0&&blast.game.p.abilityCooldowns.pulse===0,
 'second pulse requires artificial waiting after energy is restored');
blast.game.p.energy=500;
blast.save.perms[6]=40;blast.save.perms[7]=40;
targets();
blast.useAbility('pulse');
const expectedRadius=5.8*1.012**40,expectedDamage=66*1.04**40;
check(expectedRadius>9.3&&expectedRadius<9.4,'EMP radius level-40 calculation');
check(hits.length===2,'fully upgraded Q must hit target beyond base radius');
for(const [,d] of hits)near(d,expectedDamage,'compound Q enemy damage');
check(nodesHit.length===2,'upgraded radius not applied to energy nodes');
near(nodesHit[0][1],45*1.04**40,'compound Q node damage');
check(blast.game.bullets.every(b=>b.dead),'upgraded Q does not intercept distant bullets');
near(blast.game.p.energy,448,'upgraded Q energy price changed unexpectedly');
check(messages.at(-1).includes(expectedRadius.toFixed(1)+' м'),'Q visual toast omits actual radius');
blast.game.p.shock=1.4;
blast.game.p.energy=100;targets();blast.useAbility('pulse');
near(hits[0][1],expectedDamage*1.4,'temporary shock perk no longer stacks with permanent upgrades');

// Checkpoint migration: the new barrier capacity must not be applied twice.
const restore={Math,Number,Array,clamp,PERM_MAX_LEVEL:40,
 DASH_DISTANCE_BASE:2.52,DASH_UPGRADE_STEP:.30,
 save:{perms:[5,7,6,4,3,2,0,0]},weapons:Array(10).fill(null),
 sectorArchitecture:'TEST',navField:null,navClock:0,portalRouteField:null,decalDirty:false,
 floorHeight:()=>0,collide:()=>false,
 equippedArmorStats:()=>({id:-1,maxDurability:0,reduction:0,wear:1}),
 $:()=>({style:{},dataset:{},textContent:''})};
restore.game={sector:30,state:'playing',p:{},enemies:[],upgrades:{}};
vm.createContext(restore);
vm.runInContext(permBlock.slice(permBlock.indexOf('const PERM_COMPOUND='),permBlock.indexOf('function newPlayer(')),restore);
const checkpoint=src('20-minimap-and-checkpoint.js');
vm.runInContext(checkpoint.slice(checkpoint.indexOf('function restoreLiveCheckpoint('),checkpoint.indexOf('// Auto-save during combat')),restore);
const baseP={x:2,z:4,weapon:0,hp:127,maxhp:127,armor:45,maxArmor:90,armorTier:3,
 regen:16*1.03**4,damage:1.04**7,energy:111,maxEnergy:100*1.035**3,dashRange:3.12,
 bodyArmor:0,bodyArmorMax:0,bodyArmorType:-1,abilityCooldowns:{pulse:55,dash:14,heal:7,shield:0}};
const old={version:4,state:'playing',sector:30,permanentFormula:'compound-v1',
 permanentLevels:[5,7,6,4,3,2],player:baseP,live:{enemies:[]}};
restore.restoreLiveCheckpoint(old);
const expectedBarrier=30*1.09**6;
near(restore.game.p.maxArmor,expectedBarrier,'Stage25 additive barrier not converted');
near(restore.game.p.armor,expectedBarrier/2,'Stage25 half-charge lost in conversion');
check(restore.game.p.abilityCooldowns.pulse===0,'saved Q cooldown survived migration');
check(restore.game.p.abilityCooldowns.dash===0&&restore.game.p.abilityCooldowns.heal===0,
 'other old cooldowns were accidentally restored');
const stage26Barrier=30*1.085**6;
restore.restoreLiveCheckpoint({...old,barrierFormula:'compound-v1',
 permanentLevels:[5,7,6,4,3,2,0,0],player:{...baseP,armor:stage26Barrier/2,maxArmor:stage26Barrier}});
near(restore.game.p.maxArmor,expectedBarrier,'Stage26 compound-v1 barrier not migrated to new rate');
near(restore.game.p.armor,expectedBarrier/2,'Stage26 half-charge was not preserved');
restore.restoreLiveCheckpoint({...old,permanentFormula:'compound-v2',barrierFormula:'compound-v2',
 permanentLevels:[5,7,6,4,3,2,0,0],player:{...baseP,armor:expectedBarrier/2,maxArmor:expectedBarrier}});
near(restore.game.p.maxArmor,expectedBarrier,'new checkpoint barrier was compounded twice');
near(restore.game.p.armor,expectedBarrier/2,'new checkpoint partial barrier was modified');

// UI/shop and both input routes must expose exactly the new intended actions.
const shop=src('22-menus-and-upgrades.js'),input=src('26-input-handlers.js');
check(shop.includes("{name:'РАДИУС ЭМИ-ИМПУЛЬСА'")&&shop.includes("{name:'УРОН ЭМИ-ИМПУЛЬСА'"),
 'permanent EMP studies are not offered in the hangar');
check(shop.includes('const now=i===2?')&&shop.includes('permanentStat(66,PERM_COMPOUND.pulseDamage,lv)'),
 'shop does not show current stat values');
check(input.includes("if(e.code==='KeyE')useAbility('dash')")&&
 input.includes("if(e.code==='KeyF')useAbility('heal')")&&
 input.includes("if(e.code==='KeyQ')useAbility('pulse')"),'desktop E/F/Q bindings not updated');
check(input.includes("['dashTouch','dash'],['pulseTouch','pulse'],['shieldTouch','shield'],['healTouch','heal']"),
 'touch icons stopped calling the correct abilities');
console.log(`STAGE26: ${checks} EMP / compound barrier / migration / keyboard / touch assertions passed`);
