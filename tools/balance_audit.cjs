'use strict';
// Deterministic, code-backed economy and incoming-damage audit of all levels.
// Run: node tools/balance_audit.cjs [--markdown]
// Models a GUARANTEED first clear (no lucky drops, no DEV credits), three
// affordable purchasing policies and raw combat survivability without skill
// abilities. It is NOT a claim that a bot actually played the 3D game.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {simulateFire}=require('./combat_model.cjs');
const ROOT=path.join(__dirname,'..'),read=n=>fs.readFileSync(path.join(ROOT,'src',n),'utf8');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ctx={Math,Number,Array,Set,Map,console,clamp,spawnX:5,spawnZ:5,
 save:{perms:Array(8).fill(0),weaponMods:{},bodyArmor:{owned:{},equipped:-1}}};
vm.createContext(ctx);vm.runInContext('const DASH_DISTANCE_BASE=2.52,DASH_UPGRADE_STEP=.30;',ctx);
const arsenal=read('12-arsenal-and-game.js'),loadout=read('12a-loadout-economy.js');
vm.runInContext(arsenal.slice(0,arsenal.indexOf('function newPlayer(')),ctx);
vm.runInContext(loadout,ctx);
vm.runInContext(arsenal.slice(arsenal.indexOf('function newPlayer('),arsenal.indexOf('function freshGame(')),ctx);
const calc=s=>vm.runInContext(s,ctx);
const enemy=calc('enemies'),suits=calc('BODY_ARMOR_CATALOG'),gunNames=calc('weapons');
const MAX=100;
function gain(level){return 10+level*2+15+Math.floor(level*1.5)+Math.round(level*20+level*level*.25);}
const maxTypeForLevel=n=>{
 const types=['scout','shooter','charger'];
 if(n>2)types.push('brute');if(n>3)types.push('sniper','medic');
 if(n>5)types.push('warden');if(n>8)types.push('artillery','raider');
 if(n>11)types.push('drone');if(n>=14)types.push('skyhunter');
 if(n>=20)types.push('skyguard');if(n>=26)types.push('stormray');
 return types.sort((a,b)=>enemy[b].damage-enemy[a].damage)[0];
};
function robotAt(n){
 const scale=1+(n-1)*.055,type=maxTypeForLevel(n);
 const boss=n%5===0;
 return{level:n,scale,type,
  hp:enemy[type].hp*scale,normal:enemy[type].damage*scale,
  elite:enemy[type].damage*scale*1.28,
  bossRaw:boss?(17+1.2*n)*scale:0,
  // Worst theoretical single hit in both optional boss phases and heavy bomb.
  bossSpike:boss?(17+1.2*n)*scale*1.22*1.12*1.5:0,
  bossHp:boss?(430+55*n)*scale:0,
  wave:boss?1:Math.min(30,7+Math.floor(n*1.2))};
}
function pricePerm(level){return 45*level*(level+1)/2;}
function pathPrice(index,path,count){
 let total=0;for(let lv=0;lv<count;lv++){
  ctx.save.weaponMods[index]={[path]:lv};total+=calc(`gunPrice(${index},'${path}')`);
 }
 return total;
}
function armorPathPrice(id,count){
 let total=0;for(let lv=0;lv<count;lv++){
  ctx.save.bodyArmor.owned[id]=lv;total+=calc(`armorUpgradePrice(${id})`);
 }
 return total;
}
const POLICIES={
 steady:{title:'Сбалансированный',gun:2,
  milestones:[[2,0],[11,3],[20,6],[40,10],[60,12],[80,14],[98,15]],
  slopes:[.32,.27,.28,.07,.04,.06],gunSlopes:[.20,.13,.08],armorEach:4},
 guard:{title:'Осторожный',gun:9,
  milestones:[[2,0],[12,3],[24,6],[40,10],[60,12],[80,14],[99,15]],
  slopes:[.35,.18,.30,.10,.05,.04],gunSlopes:[.20,.11,.05],armorEach:4},
 striker:{title:'Атакующий',gun:2,
  milestones:[[3,0],[15,4],[24,6],[39,10],[69,12],[90,14]],
  slopes:[.23,.34,.28,.05,.03,.08],gunSlopes:[.22,.17,.12],armorEach:5}
};
function goalAt(n,policy){
 const ids=policy.milestones.filter(([at])=>at<=n),current=ids.at(-1);
 const suitId=current?current[1]:-1,suitBoughtAt=current?current[0]:0;
 const lv=policy.slopes.map(v=>Math.min(40,Math.floor(n*v)));
 const gun=policy.gunSlopes.map(v=>Math.min(20,Math.floor(n*v)));
 const armorLv=suitId<0?0:Math.min(20,Math.floor((n-suitBoughtAt)/policy.armorEach));
 return{suitId,suitBoughtAt,armorLv,lv,gun,ids:ids.map(x=>x[1])};
}
function costOf(goal,policy){
 const suitsPrice=goal.ids.reduce((s,id)=>s+suits[id].price,0);
 const mods=goal.lv.reduce((s,l,i)=>s+pricePerm(l)*(i===2?18/45:1),0);
 const thirdPath=calc(`GUN_PATHS[${policy.gun}][2]`);
 const weapon=pathPrice(policy.gun,'power',goal.gun[0])+pathPrice(policy.gun,'penetration',goal.gun[1])+
  pathPrice(policy.gun,thirdPath,goal.gun[2]);
 // Include upgrades that were actually purchased on discarded old suits.
 const milestones=policy.milestones.filter(([at])=>at<=goal.suitBoughtAt);
 let armor=0;
 for(let i=0;i<milestones.length;i++){
  const [at,id]=milestones[i],until=i+1<milestones.length?milestones[i+1][0]:goal.suitBoughtAt+goal.armorLv*policy.armorEach;
  const spentLevels=Math.min(20,Math.floor((until-at)/policy.armorEach));
  armor+=armorPathPrice(id,spentLevels);
 }
 return{suitsPrice,mods,weapon,armor,total:suitsPrice+mods+weapon+armor};
}
function playerAt(goal,policy){
 ctx.save.perms=[...goal.lv];
 ctx.save.bodyArmor.owned={};ctx.save.bodyArmor.equipped=goal.suitId;
 if(goal.suitId>=0)ctx.save.bodyArmor.owned[goal.suitId]=goal.armorLv;
 ctx.save.weaponMods={};ctx.save.weaponMods[policy.gun]={power:goal.gun[0],penetration:goal.gun[1]};
 const extra=calc(`GUN_PATHS[${policy.gun}][2]`);
 ctx.save.weaponMods[policy.gun][extra]=goal.gun[2];
 return{p:calc('newPlayer()'),w:calc(`combatWeapon(${policy.gun})`)};
}
function attacksToLose(p,damage){
 const state={hp:p.hp,armor:p.armor,suit:p.bodyArmor},fraction=clamp(.72+(p.armorTier||0)*.035,.72,.86);
 for(let hit=1;hit<=999;hit++){
  let amount=damage;
  const block=Math.min(amount*fraction,state.armor);state.armor-=block;amount-=block;
  const absorbed=Math.min(amount*(p.bodyArmorReduction||0),state.suit/Math.max(.01,p.bodyArmorWear||1.12));
  state.suit=Math.max(0,state.suit-absorbed*(p.bodyArmorWear||1.12));amount-=absorbed;
  if(state.hp>=(p.maxhp||p.hp)*.80)amount=Math.min(amount,(p.maxhp||p.hp)*.72);
  state.hp-=amount;if(state.hp<=0)return hit;
 }
 return 999;
}
function sustainableDps(p,w){
 // Actual game thermal lock and subframe intervals, not a continuous-energy
 // approximation. Return unarmored single-target sustained DPS.
 const shots=simulateFire({...w,rate:w.rate*p.rate,heat:w.heat*p.heatMod},{seconds:240}).shotsPerSecond;
 return w.damage*p.damage*shots*(w.shots||1)*(w.burst||1)*(1+.06*.75);
}
let guaranteed=0;const rows=[];
for(let n=1;n<=MAX;n++){
 const availableBefore=guaranteed;
 guaranteed+=gain(n);
 const r=robotAt(n),plans={};
 for(const [name,style] of Object.entries(POLICIES)){
  const goal=goalAt(n,style),cost=costOf(goal,style),combat=playerAt(goal,style);
  const normalHits=attacksToLose(combat.p,r.normal);
  const bossHits=r.bossSpike?attacksToLose(combat.p,r.bossSpike):0;
  const dmg=sustainableDps(combat.p,combat.w);
  const penetration=combat.w.penetration;
  const bossSec=r.bossHp?simulateFire({...combat.w,rate:combat.w.rate*combat.p.rate,heat:combat.w.heat*combat.p.heatMod},{
   bossHp:r.bossHp,protection:Math.round(r.bossHp*.8),protectionRating:.74,
   playerDamage:combat.p.damage,seconds:300}).seconds:0;
  plans[name]={goal,cost,normalHits,bossHits,dps:dmg,bossSec,armor:combat.p.bodyArmorReduction};
 }
 rows.push({...r,availableBefore,guaranteed,plans});
}
function pad(n){return Math.round(n).toLocaleString('ru-RU').replace(/\u00a0/g,' ');}
if(process.argv.includes('--markdown')){
 console.log('# NEON RIFT 3D — 100 уровней: анализ опасности и экономики\n');
 console.log('Числа взяты из действующих формул кода. «Макс. робот» — самый сильный по одиночному удару тип, доступный на уровне; элитный удар ×1,28. «Босс пик» — **теоретический совмещённый** усиленный удар ×1,5 ×1,22 ×1,12 (не всякий босс использует все эти усиления). «Кредиты до» — сумма за первое прохождение **предыдущих** уровней 1…N−1, без случайных выпадений, миссий и наград за поражение. «Выдержит» — число одинаковых ударов до смерти по физике энергощита и костюма, без лечения, уклонения, регенерации и временной полной защиты. Это **полный стартовый костюм**, а не гарантированное состояние после 10 миссий подряд; отдельный стресс-тест износа проверяется независимо. Время босса получено покадровой моделью действительного перегрева с конечной прочностью защиты цели и 100% точностью. Покупки каждого стиля учитываются **до входа на уровень**, без займа под будущую награду.\n');
 console.log('| № | Врагов | Макс. робот (урон) | Элитный удар | Босс: пиковый удар | Босс HP | Кредиты до уровня | Костюм по сбалансир. плану | Безопасных обычных попаданий* |');
 console.log('|--:|--:|---|--:|--:|--:|--:|---|--:|');
 for(const row of rows){
  const a=row.plans.steady;
  console.log(`| ${row.level} | ${row.wave} | ${enemy[row.type].name} · ${pad(row.normal)} | ${pad(row.elite)} | ${row.bossSpike?pad(row.bossSpike):'—'} | ${row.bossHp?pad(row.bossHp):'—'} | ${pad(row.availableBefore)} | ${a.goal.suitId>=0?'№'+(a.goal.suitId+1):'нет'} | ${a.normalHits-1} |`);
 }
 console.log('\n\* Число ударов до последнего смертельного, при максимальном опасном типе и без применённых способностей. **Это прогноз по формулам, не результат полноценного игрового прохождения.**');
 console.log('\n## Контрольные точки трёх стилей\n');
 console.log('| Уровень | Стиль | Доступно перед уровнем | Цена сборки | Костюм | HP | Барьер | Снижение костюма | Обычных ударов до смерти | Пиковых ударов босса до смерти | Примерное время босса (мин) |');
 console.log('|--:|---|--:|--:|---|--:|--:|--:|--:|--:|--:|');
 for(const n of [5,10,20,40,60,80,100])for(const key of Object.keys(POLICIES)){
  const r=rows[n-1],b=r.plans[key],player=playerAt(b.goal,POLICIES[key]).p;
  console.log(`| ${n} | ${POLICIES[key].title} | ${pad(r.availableBefore)} | ${pad(b.cost.total)} | ${b.goal.suitId>=0?'№'+(b.goal.suitId+1):'нет'} | ${pad(player.maxhp)} | ${pad(player.maxArmor)} | ${(b.armor*100).toFixed(2)}% | ${b.normalHits} | ${b.bossHits||'—'} | ${r.bossHp?(b.bossSec/60).toFixed(1):'—'} |`);
 }
}
if(process.argv.includes('--check')){
 assert.equal(rows.length,100);assert.equal(suits.length,16);
 assert.equal(rows[99].wave,1);assert.equal(rows[98].wave,30);
 assert.equal(rows[99].guaranteed,rows.reduce((s,r,i)=>s+gain(i+1),0));
 assert.ok(rows[99].guaranteed>200000,'too little guaranteed economy budget');
 for(let i=1;i<rows.length;i++)assert.ok(rows[i].normal>=rows[i-1].normal-.0001||
  enemy[rows[i].type].damage<enemy[rows[i-1].type].damage,
  'damage progression jumps backward unexpectedly');
 for(let i=1;i<suits.length;i++)assert.ok(suits[i].price>suits[i-1].price,'suit prices unsorted');
 assert.ok(suits.at(-1).price+armorPathPrice(15,20)<rows[99].guaranteed*.40,
  'best suit including all upgrades is unreachable from guaranteed revenue');
 for(const r of rows){
  for(const [name,b] of Object.entries(r.plans)){
   assert.ok(b.cost.total<=r.availableBefore,
    `${name} affordable BEFORE level ${r.level}: ${b.cost.total} > ${r.availableBefore}`);
   assert.ok(b.normalHits>=3,`level ${r.level} ${name}: ordinary hit survival too low`);
   if(r.bossHp)assert.ok(b.bossHits>=2,`boss ${r.level} ${name}: a single hit kills`);
   if(r.bossHp)assert.ok(b.bossSec<150,
    `boss ${r.level} ${name}: ideal single-target fight exceeds 2.5 minutes`);
  }
 }
 assert.ok(rows[99].bossSpike<2000,'final boss single-hit spike excessive');
 assert.ok(rows[99].plans.steady.bossSec<140,'final boss too time-consuming even with ideal aiming');
 assert.ok(rows[99].plans.guard.normalHits>=rows[99].plans.striker.normalHits,
  'investing more in defense gives worse hit survivability');
 console.log(`STAGE22 BALANCE AUDIT: ${rows.length} levels × 3 styles, full pricing, peak boss hits, effective heat DPS PASSED`);
}
module.exports={rows,POLICIES,goalAt,costOf,robotAt,pricePerm,suits,gain,attacksToLose};
