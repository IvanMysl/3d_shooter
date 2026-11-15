'use strict';
// A deterministic frame-by-frame mirror of the *live* 17/19 weapon clock.
// This intentionally preserves the 105-point soft thermal cap: tuning the
// combat implementation later must be accompanied by updating this simulator.
const assert=require('node:assert/strict');

function simulateFire(w,options={}){
 const fps=options.fps||60,seconds=options.seconds||240,dt=1/fps;
 assert.ok(fps>=20&&fps<=240&&seconds>0&&seconds<=600);
 let heat=0,heatLock=0,cooldown=0,triggers=0,projectileEvents=0;
 let bossHp=Number(options.bossHp)||0,protection=Number(options.protection)||0;
 const rating=Number(options.protectionRating)||0,penetration=w.penetration||0;
 const factor=Number(options.playerDamage)||1,critFactor=1+(options.critChance??.06)*((options.critDamage??1.75)-1);
 const hitChance=options.hitChance??1,seed0=options.seed??20261114;
 let seed=seed0>>>0,queue=[];
 const hits=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296<hitChance;};
 const deal=()=>{
  projectileEvents++;
  if(bossHp<=0||!hits())return;
  const raw=w.damage*factor*critFactor;
  const blocked=Math.min(raw*rating*(1-penetration),protection/1.18);
  protection=Math.max(0,protection-blocked*1.18);
  bossHp-=raw-blocked;
 };
 let elapsed=0;
 for(let tick=0;tick<Math.ceil(seconds*fps);tick++){
  elapsed=(tick+1)*dt;
  cooldown=Math.max(-dt,cooldown-dt);
  heatLock=Math.max(0,heatLock-dt);
  heat=Math.max(0,heat-dt*(heatLock>0?22:25));
  if(cooldown<=0&&heatLock<=0){
   if(heat>=97)heatLock=1;
   else{
    cooldown=w.rate+Math.min(0,cooldown);
    heat=Math.max(0,Math.min(105,heat+w.heat));
    triggers++;
    for(let k=0;k<(w.shots||1);k++)deal();
    for(let j=1;j<(w.burst||1);j++)queue.push({delay:j*w.burstGap});
   }
  }
  // The game processes queued burst bullets in the same frame after shoot().
  for(const b of queue){b.delay-=dt;if(b.delay<=0){for(let k=0;k<(w.shots||1);k++)deal();b.done=true;}}
  queue=queue.filter(b=>!b.done);
  if((options.bossHp||0)>0&&bossHp<=0)break;
 }
 return{seconds:elapsed,triggers,shotsPerSecond:triggers/elapsed,projectileEvents,
  bossHp,protection,damageDealt:(Number(options.bossHp)||0)-Math.max(0,bossHp)};
}

module.exports={simulateFire};
