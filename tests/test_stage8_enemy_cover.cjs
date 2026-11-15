// Stage 8: real 3D cover must block robot attacks, shockwaves and healing.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'..','src',n),'utf8');
const ai=src('18-ai-and-abilities.js');
const section=ai.slice(ai.indexOf('function enemyCombatClear('),ai.indexOf('// Robot animation rig V'));
const context={Math,Number,Array,Map,Set,console,v3:(x,y,z)=>({x,y,z}),
 floorHeight:()=>0,rayWall:()=>null,hypot:Math.hypot,
 lineClear:()=>true,distance:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),
 clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
 sound:()=>{},toast:()=>{},burst:()=>{},
 enemyFire:()=>{context.fired++;},
 damagePlayer:()=>{context.damaged++;},
 moveEntity:()=>{},enemyMove:()=>{},spawnEnemy:()=>{},maybeFinishMission:()=>{},
 enemyHeading:()=>({dx:0,dz:0}),enemyDirectRoute:()=>true,
 updateRobotDebris:()=>{},
 fired:0,damaged:0,STAGE8_TEST:true};
const p={x:6,z:6,feetY:0,grounded:true},g={state:'playing',p,enemies:[],nodes:[],bullets:[],t:0,sector:6,target:100,spawned:1,portalReady:false};
context.game=g;
vm.createContext(context);vm.runInContext(section,context);
let count=0;function check(x,m){assert.ok(x,m);count++;}
const robot=(type,x,z)=>({id:1,type,x,z,feetY:0,boss:false,dead:false,elite:false,stun:0,
 hp:100,maxhp:100,radius:.52,speed:0,attack:0,trail:0,telegraph:0,range:9,
 damage:15,robotMotion:0,robotCycle:0,color:[1,1,1],flash:0});
const clear=()=>{context.rayWall=()=>null;};
const blocked=()=>{context.rayWall=()=>({t:.2});};
function tick(enemies,dt=.05){g.enemies=enemies;g.t+=dt;context.updateEnemies(dt);}
// Physical cover trace includes real actor heights and length.
const a=robot('scout',5.05,6);a.feetY=.22;
clear();check(context.enemyCombatClear(a,p),'an uncovered melee trace must pass');
blocked();check(!context.enemyCombatClear(a,p),'solid rail must block a melee trace');
// Ordinary assault bot cannot damage the player through a solid railing.
context.damaged=0;tick([a]);check(context.damaged===0,'scout meleed through wall');
clear();a.attack=0;tick([a]);check(context.damaged===1,'scout missed a genuine adjacent contact');
// Boss has an INDEPENDENT physical-attack cooldown; the old ranged timer
// reset every volley and accidentally made boss melee unreachable.
const boss=robot('boss',5.1,6);boss.boss=true;boss.variant=0;boss.attack=0;
context.damaged=0;context.fired=0;blocked();tick([boss]);
check(context.damaged===0,'boss melee damaged through metal');
clear();tick([boss]);check(context.damaged===1,'boss never performed close-range strike');
check(boss.meleeTimer>1,'boss melee lacks cooldown');
tick([boss]);check(context.damaged===1,'boss melee repeated without cooldown');
boss.stun=1;boss.meleeTimer=0;boss.attack=0;
const fired=context.fired;tick([boss]);
check(context.damaged===1&&context.fired===fired,'stunned boss still attacked');
// Phase III ground wave respects solid steel at same height.
const shock=robot('boss',4.1,6);shock.boss=true;shock.variant=1;shock.hp=15;shock.maxhp=100;
shock.phase3=true;shock.ultWarn=.01;shock.attack=9;shock.ultTimer=9;
context.damaged=0;blocked();tick([shock]);check(context.damaged===0,'shockwave went through barrier');
shock.ultWarn=.01;clear();tick([shock]);check(context.damaged===1,'uncovered ground wave failed');
// Medic beam must not heal a body behind a solid panel.
const doc=robot('medic',3,6),ally=robot('shooter',4.4,6);
doc.attack=9;doc.trail=.9;ally.attack=9;ally.hp=60;
blocked();tick([doc,ally]);check(ally.hp===60,'medic healed through opaque steel');
clear();doc.trail=.9;tick([doc,ally]);check(ally.hp===69,'medic failed to heal visible ally');
// Ranged enemies must wait instead of shooting straight through a 3D column.
const shooter=robot('shooter',2.4,6);shooter.attack=0;
context.fired=0;blocked();tick([shooter]);check(context.fired===0,'ranged robot fired through panel');
shooter.attack=0;clear();tick([shooter]);check(context.fired===1,'clear targeted shot never fired');
// Stage 9 regression: at close-but-not-melee range a volumetric barrier
// requires pursuit even though the original two-dimensional map is clear.
let walking=0;context.enemyMove=()=>{walking++;};
const shortRange=robot('shooter',3.2,6);shortRange.attack=10;
context.enemyDirectRoute=()=>false;tick([shortRange]);
check(walking>0,'short-range enemy refuses to seek around a metal panel');
const oldWalking=walking;context.enemyDirectRoute=()=>true;tick([shortRange]);
check(walking===oldWalking,'uncovered short-range shooter moved instead of holding position');

// Invulnerable hits are NOT real impacts; they must not defer armor recharge.
const defense=src('13-enemy-navigation-spawn.js');
const chunk=defense.slice(defense.indexOf('function damagePlayer('),defense.indexOf('function burst(',defense.indexOf('function damagePlayer(')));
const player={armorDelay:0,iframes:1,shield:0,armor:0,bodyArmor:0,hp:100,maxhp:100};
context.game={state:'playing',p:player};context.$=()=>({classList:{add:()=>{},remove:()=>{}},style:{}});
context.setTimeout=()=>{};context.gameOver=()=>{};
vm.runInContext(chunk,context);
context.damagePlayer(20);check(player.armorDelay===0&&player.hp===100,'iframes interrupted armor regeneration');
player.iframes=0;player.shield=1;context.damagePlayer(20);
check(player.armorDelay===0&&player.hp===100,'energy shield interrupted armor regeneration');
player.shield=0;context.damagePlayer(20);
check(player.armorDelay===0&&player.hp===80,'actual hit must not defer armor recharge');
// Hunt sentinel must inherit appropriate protection from enlarged max HP.
const spawn=src('13-enemy-navigation-spawn.js');
check(spawn.includes('e.maxProtection=Math.max(e.maxProtection||0,Math.round(e.maxhp*.45))'),
  'hunt sentinel not upgraded along with its HP');
console.log(`STAGE8 ENEMY COVER: ${count} tests passed`);
