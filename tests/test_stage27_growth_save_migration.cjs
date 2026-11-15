'use strict';
// Stage27: exact replacement percentages plus automatic migration of Stage26
// live checkpoints, including partially depleted defense/energy pools.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=name=>fs.readFileSync(path.join(__dirname,'../src',name),'utf8');
const clamp=(v,a,b)=>Math.max(a,Math.min(v,b));
let passed=0;
function yes(condition,label){assert.ok(condition,label);passed++;}
function close(actual,expected,label){yes(Math.abs(actual-expected)<1e-6*Math.max(1,Math.abs(expected)),
 `${label}: expected ${expected}, received ${actual}`);}
const source=src('12-arsenal-and-game.js');
const stats=source.slice(source.indexOf('const PERM_COMPOUND='),source.indexOf('function freshGame('));
const current={Math,Number,Array,clamp,spawnX:4,spawnZ:5,
 DASH_DISTANCE_BASE:2.52,DASH_UPGRADE_STEP:.30,save:{perms:Array(8).fill(0)},
 equippedArmorStats:()=>({id:-1,maxDurability:0,reduction:0,wear:1}),armorGrantsFlight:()=>false};
vm.createContext(current);vm.runInContext(stats,current);
const expected={health:1.08,barrier:1.09,regen:1.04,capacity:1.04,pulseDamage:1.04};
for(const key of Object.keys(expected))close(current.PERM_COMPOUND?.[key]||vm.runInContext(`PERM_COMPOUND.${key}`,current),
 expected[key],`compound coefficient ${key}`);
for(const level of [0,1,2,10,40]){
 current.save.perms=[level,0,level,level,level,0,0,level];
 const p=current.newPlayer();
 close(p.maxhp,100*1.08**level,`health LVL ${level}`);
 close(p.maxArmor,30*1.09**level,`barrier LVL ${level}`);
 close(p.regen,16*1.04**level,`regeneration LVL ${level}`);
 close(p.maxEnergy,100*1.04**level,`energy capacity LVL ${level}`);
}

const hits=[],nodeHits=[];
const pulseCtx={Math,Number,Array,clamp,save:{perms:[0,0,0,0,0,0,0,40]},
 game:{state:'playing',p:{x:0,z:0,feetY:0,energy:80,shock:1,abilityCooldowns:{pulse:8}},
  enemies:[{x:4,z:0,dead:false,stun:0}],nodes:[{x:3,z:0,feetY:0,radius:.2,dead:false}],bullets:[]},
 v3:(x,y,z)=>({x,y,z}),robotNearArea:()=>true,
 enemyBlastSamples:(e,origin)=>({hullDist:Math.hypot(e.x-origin.x,e.z-origin.z),points:[{x:e.x,y:1,z:e.z}]}),
 floorHeight:()=>0,areaVisibility:()=>1,hurtEnemy:(e,amount)=>hits.push(amount),
 damagePowerNode:(n,amount)=>nodeHits.push(amount),burst(){},sound(){},toast(){}};
vm.createContext(pulseCtx);
vm.runInContext(stats.slice(stats.indexOf('const PERM_COMPOUND='),stats.indexOf('function newPlayer(')),pulseCtx);
const ability=src('18-ai-and-abilities.js');
vm.runInContext(ability.slice(ability.indexOf('function useAbility('),ability.indexOf('function enemyFire(')),pulseCtx);
pulseCtx.useAbility('pulse');
close(hits[0],66*1.04**40,'real EMP damage at rank 40');
close(nodeHits[0],45*1.04**40,'real EMP node damage at rank 40');
close(pulseCtx.game.p.energy,28,'EMP energy cost unchanged');
yes(pulseCtx.game.p.abilityCooldowns.pulse===0,'EMP cooldown unexpectedly reinstated');

const checkpoint=src('20-minimap-and-checkpoint.js');
yes(checkpoint.includes("permanentFormula:'compound-v2',barrierFormula:'compound-v2'"),
 'new checkpoints must advertise their revised formula to avoid double migration');
const previous=[20,5,10,6,8,0,2,10];
const legacyPlayer={x:4,z:5,weapon:1,feetY:0,vy:0,grounded:true,
 maxhp:100*1.05**previous[0],hp:100*1.05**previous[0]/2,
 maxArmor:30*1.085**previous[2],armor:30*1.085**previous[2]/2,armorTier:4,
 regen:16*1.03**previous[3],maxEnergy:100*1.035**previous[4],
 energy:100*1.035**previous[4]/2,damage:1.04**previous[1],
 bodyArmor:0,bodyArmorMax:0,bodyArmorType:-1,dashRange:2.52,
 abilityCooldowns:{dash:9,heal:7,pulse:3,shield:0}};
const restore={Math,Number,Array,clamp,PERM_MAX_LEVEL:40,
 DASH_DISTANCE_BASE:2.52,DASH_UPGRADE_STEP:.30,
 save:{perms:[...previous]},weapons:Array(10).fill(null),
 sectorArchitecture:'TEST',navField:null,navClock:0,portalRouteField:null,decalDirty:false,
 floorHeight:()=>0,collide:()=>false,
 equippedArmorStats:()=>({id:-1,maxDurability:0,reduction:0,wear:1}),
 $:()=>({style:{},dataset:{},textContent:''})};
restore.game={sector:50,state:'playing',p:{},enemies:[],upgrades:{}};
vm.createContext(restore);
vm.runInContext(stats.slice(stats.indexOf('const PERM_COMPOUND='),stats.indexOf('function newPlayer(')),restore);
vm.runInContext(checkpoint.slice(checkpoint.indexOf('function restoreLiveCheckpoint('),
 checkpoint.indexOf('// Auto-save during combat')),restore);
const oldCheckpoint={version:4,state:'playing',sector:50,
 permanentFormula:'compound-v1',barrierFormula:'compound-v1',permanentLevels:[...previous],
 player:{...legacyPlayer},live:{enemies:[]}};
restore.restoreLiveCheckpoint(oldCheckpoint);
close(restore.game.p.maxhp,100*1.08**20,'old Stage26 health pool converted');
close(restore.game.p.hp,100*1.08**20/2,'partial Stage26 HP pool ratio preserved');
close(restore.game.p.maxArmor,30*1.09**10,'old Stage26 barrier converted');
close(restore.game.p.armor,30*1.09**10/2,'partial Stage26 barrier ratio preserved');
close(restore.game.p.regen,16*1.04**6,'old Stage26 regeneration converted');
close(restore.game.p.maxEnergy,100*1.04**8,'old Stage26 capacity converted');
close(restore.game.p.energy,100*1.04**8/2,'partial Stage26 battery ratio preserved');
close(restore.game.p.damage,1.04**5,'unchanged weapon damage research preserved');
yes(restore.game.p.abilityCooldowns.pulse===0,'legacy Q cooldown survived checkpoint');

const latest={...oldCheckpoint,permanentFormula:'compound-v2',barrierFormula:'compound-v2',
 player:{...legacyPlayer,maxhp:100*1.08**20,hp:100*1.08**20/2,
 maxArmor:30*1.09**10,armor:30*1.09**10/2,
 regen:16*1.04**6,maxEnergy:100*1.04**8,energy:100*1.04**8/2}};
restore.restoreLiveCheckpoint(latest);
close(restore.game.p.maxhp,latest.player.maxhp,'already migrated HP not multiplied twice');
close(restore.game.p.maxArmor,latest.player.maxArmor,'already migrated barrier not multiplied twice');
close(restore.game.p.maxEnergy,latest.player.maxEnergy,'already migrated capacity not multiplied twice');

restore.save.perms=[21,5,11,6,9,0,2,10];
restore.restoreLiveCheckpoint(oldCheckpoint);
close(restore.game.p.maxhp,100*1.08**21,'newly purchased HP rank applied on old checkpoint');
close(restore.game.p.hp,100*1.08**20/2+(100*1.08**21-100*1.08**20),
 'purchased HP rank should grant full difference after preserving old HP fraction');
close(restore.game.p.maxArmor,30*1.09**11,'newly purchased barrier rank applied on old checkpoint');
close(restore.game.p.armor,30*1.09**10/2+(30*1.09**11-30*1.09**10),
 'new barrier rank should grant full charge after migrating old 50% pool');
close(restore.game.p.maxEnergy,100*1.04**9,'newly purchased capacity rank applied');
close(restore.game.p.energy,100*1.04**8/2+(100*1.04**9-100*1.04**8),
 'new energy capacity rank should grant its charge after migration');

const shop=src('22-menus-and-upgrades.js'),inputs=src('26-input-handlers.js');
for(const [phrase,label] of [['×1,08','health'],['×1,09','barrier'],
 ['×1,04 к предыдущей скорости','energy regeneration'],['×1,04 к предыдущей ёмкости','energy capacity'],
 ['×1,04 к урону Q','EMP damage']]){
 yes(shop.includes(phrase),`hangar still shows an old ${label} coefficient`);
}
yes(inputs.includes("if(e.code==='KeyE')useAbility('dash')")&&
 inputs.includes("if(e.code==='KeyF')useAbility('heal')")&&
 inputs.includes("if(e.code==='KeyQ')useAbility('pulse')"),'desktop control bindings regressed');
yes(inputs.includes("['dashTouch','dash'],['pulseTouch','pulse'],['shieldTouch','shield'],['healTouch','heal']"),
 'mobile icons no longer map to the corresponding ability');
console.log(`STAGE27: ${passed} exact coefficients, rank compounding, Stage26→27 save migration and input assertions passed`);
