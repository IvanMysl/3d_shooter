'use strict';
// Every weapon, every research path, every one of its 20 purchasable ranks.
// Theoretical damage assumes every pellet/burst bullet connects; rate and
// cooling are jointly accounted for. Real player accuracy is not measurable
// from a stat table, so use these numbers as ceilings, not gameplay telemetry.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {simulateFire}=require('./combat_model.cjs');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
const clamp=(n,a,b)=>Math.min(Math.max(n,a),b);
const ctx={Math,Number,Array,Map,Set,console,clamp,
 save:{perms:[0,0,0,0,0,0],bodyArmor:{owned:{},equipped:-1},weaponMods:{}}};
vm.createContext(ctx);
const arsenal=src('12-arsenal-and-game.js');
vm.runInContext(arsenal.slice(0,arsenal.indexOf('function newPlayer(')),ctx);
vm.runInContext(src('12a-loadout-economy.js'),ctx);
const evalSrc=s=>vm.runInContext(s,ctx);
const paths=i=>Array.from(evalSrc(`GUN_PATHS[${i}]`));
const weapon=(i,mod={})=>{ctx.save.weaponMods[i]=mod;return evalSrc(`combatWeapon(${i})`);};
function sustained(w){
 const fires=simulateFire(w,{seconds:240}).shotsPerSecond,projectiles=(w.shots||1)*(w.burst||1);
 return fires*w.damage*projectiles*(1-.74*(1-w.penetration))*(1+.06*.75);
}
const attr={power:'damage',penetration:'penetration',rate:'rate',cooling:'heat',
 precision:'spread',blast:'blast',freeze:'freeze'};
const increases=new Set(['power','penetration','blast','freeze']);
const lines=[];
let checks=0;
const check=(truth,description)=>{assert.ok(truth,description);checks++;};
for(let i=0;i<10;i++){
 const list=paths(i),baseline=weapon(i),full={};let cost=0;
 for(const p of list){
  for(let lv=0;lv<20;lv++){
   const lower=weapon(i,{[p]:lv}),upper=weapon(i,{[p]:lv+1});
   const property=attr[p],a=lower[property],b=upper[property];
   check(increases.has(p)? b>a+1e-12:b<a-1e-12,
    `${i+1}/${p}/rank${lv+1}: no real incremental gain (${a} → ${b})`);
   ctx.save.weaponMods[i]={[p]:lv};
   const rankCost=evalSrc(`gunPrice(${i},'${p}')`);
   cost+=rankCost;
   check(rankCost>0,`${i+1}/${p}/rank${lv+1}: invalid price`);
   if(lv>0){ctx.save.weaponMods[i]={[p]:lv-1};
    check(rankCost>evalSrc(`gunPrice(${i},'${p}')`),
     `${i+1}/${p}/rank${lv+1}: price decreases unexpectedly`);
   }
   if(p==='rate'||p==='cooling')for(const fps of [30,60,120]){
    const before=simulateFire(lower,{fps,seconds:240}).shotsPerSecond;
    const after=simulateFire(upper,{fps,seconds:240}).shotsPerSecond;
    check(after>before+1e-9,
     `${i+1}/${p}/rank${lv+1} @${fps}FPS: purchased rank reduces/does not improve REAL fire rate (${before} → ${after})`);
   }
  }
  full[p]=20;
 }
 const max=weapon(i,full),baseDps=sustained(baseline),maxDps=sustained(max);
 const finalBoss=simulateFire(max,{bossHp:38219,protection:Math.round(38219*.8),
  protectionRating:.74,playerDamage:3.4,seconds:180});
 check(maxDps>baseDps*2,`${i+1}: fully improved weapon fails to grow meaningfully`);
 check(cost<40000,`${i+1}: single gun full research consumes disproportionate final budget`);
 check(finalBoss.bossHp<=0&&finalBoss.seconds<110,
  `${i+1}: single-target perfect-aim final-boss fight exceeds 110s with 30 permanent power ranks`);
 if(list.includes('rate')){
  const rateOne=weapon(i,{rate:1});
  check(sustained(rateOne)>baseDps*1.01,
   `${i+1}: first rate research is meaningless under thermal throttling`);
 }
 lines.push({index:i,name:baseline.short,paths:list,cost,baseDps,maxDps,maxTTK:finalBoss.seconds,
  range:baseline.range,projectiles:(baseline.shots||1)*(baseline.burst||1)});
}
if(process.argv.includes('--check'))console.log(`STAGE24 WEAPON AUDIT: ${checks} per-rank, three-FPS real-time heat, price and boss-time checks PASSED`);
if(process.argv.includes('--markdown')){
 console.log('# NEON RIFT 3D — сравнительная эффективность всех десяти орудий\n');
 console.log('ДПС — теоретический **устойчивый** урон в секунду по ещё не разрушенной защите босса с 74% бронерейтингом. Ритм огня рассчитан покадрово при 60 FPS: фактический перегрев, блокировка, охлаждение и остатки времени между выстрелами. У дробовика предполагается попадание **всех 9 дробин**, у «Триады» — всех 3 пуль. Время финального босса учитывает **реальное истощение его бронепластин**. Ракеты и гранаты считаются прямыми попаданиями; поражение нескольких целей не учтено. Это идеализированные значения при точном наведении, не итог игрового прохождения.\n');
 console.log('| № | Оружие | Дальность, м | 20×3 модернизации, ◈ | Базовый ДПС против босса | ДПС с максимальными тремя ветками | Босс уровня 100, с 30 общими уровнями урона, с |');
 console.log('|--:|---|--:|--:|--:|--:|--:|');
 for(const w of lines)console.log(`| ${w.index+1} | ${w.name} | ${w.range} | ${w.cost.toLocaleString('ru-RU')} | ${w.baseDps.toFixed(1)} | ${w.maxDps.toFixed(1)} | ${w.maxTTK.toFixed(0)} |`);
 console.log('\nВсе ветки по 20 уровней проверены на прирост характеристик. Для каждого ранга скорострельности и охлаждения отдельно установлено **строгое увеличение фактической частоты огня на 30, 60 и 120 FPS**. Благодаря сохранению дробной части таймера между кадрами исчезают шаги, которые раньше ничего не давали или снижали ДПС. Рельсотрон получает +1,35 п.п. пробиваемости за уровень, не упираясь преждевременно в предел 94%.');
}
module.exports={lines,checks,sustained,ctx,weapon,paths};
