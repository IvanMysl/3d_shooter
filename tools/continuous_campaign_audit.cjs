'use strict';
// Synthetic, transparent play-style stress test. Not AI navigation or a claim
// that real players land a known number of hits. It explicitly carries physical
// suit damage and health through every consecutive sector, unlike one-level
// fresh-player audits. Assumes the documented purchasing policy is followed.
const assert=require('node:assert/strict');
const {rows,POLICIES,suits}=require('./balance_audit.cjs');
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const BOSS_ATTACK=[1,1.5,1,1,1.5,1,1.5,1.5];
const SCENARIOS={
 careful:{ordinaryHits:3,bossHits:1,heal:49,stations:0,plates:0,
  desc:'Подготовленный: 3 опасных попадания на обычном уровне, 1 у босса, одно лечение, без подобранных ремонтов.'},
 engaged:{ordinaryHits:4,bossHits:2,heal:49,stations:1,plates:0,
  desc:'Неровный бой: 4 опасных попадания, у босса 2 усиленных удара, одно лечение и одна станция.'},
 risky:{ordinaryHits:5,bossHits:3,heal:49,stations:1,plates:2,
  desc:'Ошибки: 5 попаданий, 3 усиленных удара босса, лечение, станция и две пластины.'}
};
function takeHit(p,d){
 let amount=d;
 const blocked=Math.min(amount*clamp(.72+Math.floor(p.permArmor/2)*.035,.72,.86),p.armor);
 p.armor-=blocked;amount-=blocked;
 const suitAbsorb=Math.min(amount*p.reduction,p.suit/p.wear);
 p.suit=Math.max(0,p.suit-suitAbsorb*p.wear);amount-=suitAbsorb;
 if(p.hp>=p.maxhp*.8)amount=Math.min(amount,p.maxhp*.72);
 p.hp=Math.max(0,p.hp-amount);
 return p.hp>0;
}
function setup(p,goal,next){
 const b=suits[goal.suitId],maxhp=100*Math.pow(1.08,goal.lv[0]),maxArmor=30*Math.pow(1.09,goal.lv[2]);
 const newSuitMax=b?b.durability*Math.pow(1.08,goal.armorLv):0;
 const reduction=b?Math.min(b.maxReduction??.9,b.reduction+(b.armorStep??.0045)*goal.armorLv):0;
 const wear=b?(b.wear??1.12):1.12;
 if(!p)return{hp:maxhp,maxhp,armor:maxArmor,maxArmor,suit:newSuitMax,suitMax:newSuitMax,
  suitId:goal.suitId,permArmor:goal.lv[2],reduction,wear};
 const healthGrowth=Math.max(0,maxhp-p.maxhp),barrierGrowth=Math.max(0,maxArmor-p.maxArmor);
 p.hp=Math.min(maxhp,p.hp+healthGrowth);p.maxhp=maxhp;
 p.armor=Math.min(maxArmor,p.armor+barrierGrowth);p.maxArmor=maxArmor;
 p.suit=p.suitId!==goal.suitId?newSuitMax:
  Math.min(newSuitMax,p.suit+Math.max(0,newSuitMax-p.suitMax));
 p.suitId=goal.suitId;p.suitMax=newSuitMax;p.permArmor=goal.lv[2];p.reduction=reduction;p.wear=wear;
 p.hp=Math.min(maxhp,p.hp+maxhp*.20);
 p.armor=Math.min(maxArmor,p.armor+maxArmor*.28);
 p.suit=Math.min(newSuitMax,p.suit+newSuitMax*(.34+((next.level-1)%5===0?.12:0)));
 return p;
}
function campaign(style,scenario){
 const policy=POLICIES[style],s=SCENARIOS[scenario];
 assert.ok(policy&&s);
 let p=null;const deaths=[];let fragile=0,totalTaken=0;
 for(const level of rows){
  const goal=level.plans[style].goal;
  p=setup(p,goal,level);
  const hits=level.bossHp?s.bossHits:s.ordinaryHits;
  const spike=level.bossHp?
   level.bossRaw*BOSS_ATTACK[(level.level/5-1)%8]*1.22*1.12:level.normal;
  for(let k=0;k<hits;k++){
   totalTaken++;
   if(!takeHit(p,spike)){
    deaths.push(level.level);
    // A normal retry starts a fresh game with all permanent purchases, not
    // an infinite checkpoint of the lethal damaged state.
    p.hp=p.maxhp;p.armor=p.maxArmor;p.suit=p.suitMax;
    break;
   }
  }
  if(p.hp<p.maxhp*.28)fragile++;
  p.hp=Math.min(p.maxhp,p.hp+s.heal);
  for(let i=0;i<s.stations;i++){
   p.hp=Math.min(p.maxhp,p.hp+35);
   p.armor=Math.min(p.maxArmor,p.armor+22);
   p.suit=Math.min(p.suitMax,p.suit+p.suitMax*.18);
  }
  p.suit=Math.min(p.suitMax,p.suit+p.suitMax*.06*s.plates);
 }
 return{style,scenario,deaths,fragile,landedHits:totalTaken};
}
function verify(){
 const out=[];
 for(const s of Object.keys(SCENARIOS))for(const policy of Object.keys(POLICIES)){
  const r=campaign(policy,s);
  assert.equal(rows.length,100);
  if(s==='careful')assert.equal(r.deaths.length,0,
   `${policy}: a reasonably prepared no-loot campaign must be passable`);
  if(s==='engaged')assert.ok(r.deaths.length<=12,
   `${policy}: two powerful boss mistakes should not imply dozens of forced retries`);
  if(s==='risky')assert.ok(r.deaths.length<=25,
   `${policy}: the punishing play style has unreasonably many failures`);
  out.push(r);
 }
 return out;
}
if(require.main===module){
 const results=verify();
 for(const r of results)console.log(`${r.scenario.padEnd(7)} ${r.style.padEnd(8)} deaths/retries=${String(r.deaths.length).padStart(2)} at [${r.deaths.join(',')}]; danger stages=${r.fragile}`);
 console.log('STAGE24 CONTINUOUS CAMPAIGN: 3 strategies × 3 hit/repair patterns × all 100 connected stages PASSED');
}
module.exports={campaign,SCENARIOS,verify};
