'use strict';
// Player-facing percentage accuracy, anti-lock boss behavior and all weapons.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {lines,checks:weaponChecks,ctx}=require('../tools/weapon_value_audit.cjs');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0;
const check=(truth,message)=>{assert.ok(truth,message);checks++;};
const near=(a,b,message)=>check(Math.abs(a-b)<1e-9,`${message}: ${a} != ${b}`);
const calc=s=>vm.runInContext(s,ctx);

check(weaponChecks>1700,'weapon upgrade per-rank audit did not execute');
check(lines.length===10,'must evaluate all ten guns');
check(lines.every(w=>w.cost>0&&w.cost<40000),
 'some weapons are priced out of the late-game economy');
check(lines[5].maxDps>lines[5].baseDps*2,
 'SMG must remain a viable high-risk close-range upgrade target');
check(lines[2].maxDps>lines[2].baseDps*2,
 'railgun magazine research provides no sustained benefit');
check(src('12a-loadout-economy.js').includes('GUN_RESEARCH_BASE_PRICE'),
 'index-based gun pricing unfairly penalizes later inventory slots');
check(src('12a-loadout-economy.js').includes('railgunPenetrationPoints:.0135'),
 'railgun has wasted penetration upgrades after level 15');
near(calc('GUN_BASE_PENETRATION[2]+ECONOMY_BALANCE.railgunPenetrationPoints*20'),.94,
 'railgun research should reach 94% cap precisely at level 20');

// Starter suit +8% must be numerically exact even when the result is fractional.
near(calc('armorProgress(0,0).maxDurability'),65,'starter suit base durability');
near(calc('armorProgress(0,1).maxDurability'),70.2,'+8% actual suit durability');
near(calc('armorProgress(0,1).reduction'),.1345,'+0.45pp actual reduction');
near(calc('armorProgress(15,20).reduction'),.9995,
 'endgame physical suit is still below true invulnerability');

// Apply actual temporary upgrade functions, checking relative vs additive pct.
const upgrades=calc('upgrades');
const byId=id=>upgrades.find(u=>u.id===id);
const p={damage:1,rate:1,crit:.06,critDamage:1.75,regen:16,
 dashCost:25,speed:3.05,energy:100,maxEnergy:100,shieldDuration:3.5,
 heatMod:1,slowBullets:1};
const run={p};
for(const id of ['damage','rapid','pierce','crit','capacitor','dash',
 'energyshield','cool','bullet','super'])check(!!byId(id),`missing perk ${id}`);
byId('damage').fn(run);near(p.damage,1.18,'per-run damage +18%');
byId('rapid').fn(run);near(1/p.rate,1.15,'firing frequency grows by EXACTLY 15%');
byId('pierce').fn(run);near(p.crit,.13,'crit chance +7 percentage points');
byId('crit').fn(run);near(p.critDamage,2.0,'crit multiplier +25 percentage points');
byId('capacitor').fn(run);near(p.regen,18.88,'regeneration ×1.18');
byId('dash').fn(run);near(p.dashCost,19.25,'dash energy consumption −23%');
byId('energyshield').fn(run);near(p.shieldDuration,4.375,'barrier length ×1.25');
byId('cool').fn(run);near(p.heatMod,.8,'heat −20%');
byId('bullet').fn(run);near(p.slowBullets,.88,'enemy projectile speed −12%');
byId('super').fn(run);near(p.damage,1.18*1.12,'overcharge +12%');
const legacyCrit=.66;p.crit=legacyCrit;byId('pierce').fn(run);
near(p.crit,.73,'upgrading a legacy save must not silently erase old crit investment');
const capRun={p:{crit:.06,critDamage:1.75}};
for(let i=0;i<5;i++){byId('pierce').fn(capRun);byId('crit').fn(capRun);}
near(capRun.p.crit,.41,'5 × 7pp chance + initial 6%');
near(capRun.p.critDamage,3.0,'5 × 25pp critical damage + initial 175%');

// Execute the actual boss-control window that updateEnemies evaluates per tick.
const ai=src('18-ai-and-abilities.js');
const start=ai.indexOf('if(e.boss){const now=Number(g.t)||0,windowEnd=');
const end=ai.indexOf('\n let d=distance(',start);
check(start>0&&end>start,'boss anti-stun-lock window not found');
const fragment=ai.slice(start,end);
const env={Math,Number,g:{t:10},e:{boss:true,stun:2.9}};
vm.createContext(env);
const advance=(time,stun)=>{env.g.t=time;env.e.stun=stun;vm.runInContext(fragment,env);return env.e.stun;};
near(advance(10,2.9),.55,'boss stagger limited to 0.55 s');
near(advance(10.3,2.9),.25,'cryo does not refresh a boss stun window');
near(advance(10.56,2.9),0,'boss reattacks after 0.55s');
near(advance(12.95,2.9),0,'boss immune to repeat stun until 3.10s');
near(advance(13.11,2.9),.55,'boss may be interrupted again after immunity');
env.e={boss:false,stun:2.9};
near(advance(14,2.9),2.9,'regular robots retain full cryo/ion control');

console.log(`STAGE23: ${checks} direct percentage, progression and boss-stun assertions + ${weaponChecks} gun-rank assertions passed`);
