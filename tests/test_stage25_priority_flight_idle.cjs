'use strict';
// Stage25 acceptance: energy-paid repeatable abilities, priority restoration,
// multiplicative purchases, independently adjustable flight speeds, idle GPU,
// keyboard form submission and coherent advanced flying robot geometry.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.join(__dirname,'..'),src=f=>fs.readFileSync(path.join(ROOT,'src',f),'utf8');
const check=(condition,label)=>{assert.ok(condition,label);checks++};
const near=(a,b,label)=>check(Math.abs(a-b)<1e-7,`${label}: ${a} != ${b}`);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let checks=0;

// One real ability instance receives a fully equipped player. Do not replace
// the restoration function with a mock, including insufficient-energy cases.
const player={hp:40,maxhp:100,bodyArmor:0,bodyArmorMax:200,
 armor:10,maxArmor:60,energy:500,maxEnergy:500,dashCost:25,
 dashRange:2.52,shield:0,shieldDuration:3.5,iframes:0,
 abilityCooldowns:{heal:123,dash:900},x:0,z:0,feetY:0,yaw:Math.PI/2};
const abilities=src('18-ai-and-abilities.js');
const ability={Math,Number,clamp,game:{state:'playing',p:player},
 input:{mx:0,mz:0},save:{perms:Array(12).fill(0),settings:{dashDistance:2.52}},
 DASH_DISTANCE_BASE:2.52,DASH_DISTANCE_MIN:.5,DASH_DISTANCE_MAX:14.52,
 toast(){},burst(){},sound(){},moveEntity(p,x,z){p.x+=x;p.z+=z}};
vm.createContext(ability);
const arsenal=src('12-arsenal-and-game.js');
vm.runInContext(arsenal.slice(arsenal.indexOf('const PERM_COMPOUND='),arsenal.indexOf('function newPlayer(')),ability);
{const fx=fs.readFileSync(path.join(__dirname,'../src/13-enemy-navigation-spawn.js'),'utf8');vm.runInContext(fx.slice(fx.indexOf('function emitWeaponSound(')),ability);}
vm.runInContext(abilities.slice(abilities.indexOf('function restorePriorityDefense('),abilities.indexOf('function enemyFire(')),ability);
check(ability.useAbility('heal')==='hp','E first repairs hull');
near(player.hp,89,'initial +49 hp');near(player.energy,450,'first 50 energy spent');
check(ability.useAbility('heal')==='hp','E hull takes precedence over empty suit');
near(player.hp,100,'second E fills remaining hull');near(player.energy,450-11/49*50,'proportional energy use');
check(ability.useAbility('heal')==='bodyArmor','E repairs suit after hull');
near(player.bodyArmor,14,'suit +7% max, not arbitrary hit points');
const suitEnergy=player.energy;
player.energy=3;
check(ability.useAbility('heal')===false,'low energy cannot partially repair the suit');
near(player.bodyArmor,14,'failed suit repair changes no durability');near(player.energy,3,'failed suit repair spends nothing');
player.energy=50;
check(ability.useAbility('heal')==='bodyArmor','full-cost suit repair becomes available immediately');
near(player.bodyArmor,28,'suit repairs its entire advertised action');near(player.energy,0,'full suit repair costs 50');
player.energy=100;player.bodyArmor=200;
check(ability.useAbility('heal')==='armor','E charges barrier only after full suit');
near(player.armor,28,'barrier +30% max');near(player.energy,60,'barrier energy cost');
player.armor=59.5;player.energy=.5;
check(ability.useAbility('heal')===false,'even a tiny remainder needs its entire energy price');
near(player.armor,59.5,'underpowered barrier tap restores nothing');near(player.energy,.5,'no charge for rejected barrier tap');
player.energy=2;
check(ability.useAbility('heal')==='armor','fully funded final barrier remainder succeeds');
near(player.armor,60,'last 0.5 barrier repaired');check(player.energy>0,'excess barrier energy not charged');
player.energy=100;check(ability.useAbility('heal')===false,'full defenses do not spend energy');
near(player.energy,100,'full-state energy untouched');
player.hp=99.9;player.energy=.2;
check(ability.useAbility('heal')==='hp','sub-unit energy must repair a sufficiently small remaining deficit');
near(player.hp,100,'tiny remainder of hull restored');
check(player.energy>0&&player.energy<.2,'fractional energy charged proportionally');
player.energy=50;player.hp=0;player.bodyArmor=0;player.armor=0;
ability.useAbility('heal');check(player.hp>0&&player.bodyArmor===0&&player.armor===0,
 'damaged hull must not be bypassed when energy runs out');
player.energy=100;const dashAt=player.x;
ability.useAbility('dash');ability.useAbility('dash');
near(player.x,dashAt+2*2.52,'dash twice without elapsed time');
near(player.energy,50,'two dash activations cost energy');
check(player.iframes<=.05501,'infinite dash invulnerability exploit');
player.energy=0;const blockedAt=player.x;
ability.useAbility('dash');near(player.x,blockedAt,'insufficient energy blocks dash');
check(player.abilityCooldowns.dash===0,'old dash cooldown cleared when used');

// The actual economy code: exact factor^(n), suit-specific purchases, and
// valid persisted slider settings. Both flight axes and all 16 suits exist.
const weapons=src('12-arsenal-and-game.js');
const gear={Math,Number,Array,Map,Set,clamp,console,
 weapons:[],save:{perms:[0,0,0,0,0,0],weaponMods:{},bodyArmor:{owned:{9:3,15:20},equipped:9}}};
vm.createContext(gear);
vm.runInContext(weapons.slice(0,weapons.indexOf('function newPlayer(')),gear);
vm.runInContext(src('12a-loadout-economy.js'),gear);
near(vm.runInContext('armorProgress(0,2).maxDurability',gear),65*1.08*1.08,
 '8% suit durability applied to previous rank');
near(vm.runInContext('armorProgress(15,20).maxDurability',gear),5600*Math.pow(1.08,20),
 'tier-16 durability rank 20');
check(vm.runInContext('flightResearchLevel(9,"horizontal")',gear)===0,'flight starts rank 0');
vm.runInContext('save.bodyArmor.flightMods[9]={horizontal:2,vertical:3}',gear);
near(vm.runInContext('flightSpeedMultiplier("horizontal")',gear),1.05**2,'horizontal ranks compound');
near(vm.runInContext('flightSpeedMultiplier("vertical")',gear),1.05**3,'vertical ranks compound');
vm.runInContext('save.bodyArmor.equipped=15',gear);
near(vm.runInContext('flightSpeedMultiplier("horizontal")',gear),1,'other suit has independent speed');
vm.runInContext('save.bodyArmor.flightMods[15]={horizontal:999,vertical:-8};normalizeLoadoutSave()',gear);
check(vm.runInContext('flightResearchLevel(15,"horizontal")',gear)===20,'flight ranks capped at 20');
check(vm.runInContext('flightResearchLevel(15,"vertical")',gear)===0,'negative flight rank rejected');
near(vm.runInContext('flightSpeedMultiplier("horizontal")',gear),1.05**20,'max flight speed compounds');
for(const [lv,expected] of [[0,100],[1,108],[2,116.64],[20,100*Math.pow(1.08,20)]])
 near(vm.runInContext(`permanentStat(100,PERM_COMPOUND.health,${lv})`,gear),expected,
  `compound permanent HP rank ${lv}`);
for(const mode of ['blast','freeze']){
 const idx=mode==='blast'?4:9,prop=mode==='blast'?'blast':'freeze',rate=mode==='blast'?1.032:1.06;
 vm.runInContext(`save.weaponMods[${idx}].${prop}=2`,gear);
 near(vm.runInContext(`combatWeapon(${idx}).${prop}/weapons[${idx}].${prop}`,gear),rate*rate,
  `weapon ${prop} compounds`);
}
const saveCore=src('00-core-save.js');
const throttle={Math,Number,clamp};vm.createContext(throttle);
vm.runInContext(saveCore.slice(saveCore.indexOf('function normalizeFlightThrottle('),saveCore.indexOf('// Each key press')),throttle);
near(throttle.normalizeFlightThrottle(.531),.55,'flight throttle snaps to 5% steps');
near(throttle.normalizeFlightThrottle(-3),.25,'flight throttle lower clamp');
near(throttle.normalizeFlightThrottle(999),1,'flight throttle upper clamp');

// Production vertical integrator and horizontal movement consume the same
// purchased factor and user-selected ratio; sliders affect *physics*.
const phy={Math,Number,Array,Float32Array,console,clamp,
 mapSize:20,mapCells:Array.from({length:20},()=>Array(20).fill(0)),
 mapRooms:[],sectorStyle:0,game:{state:'playing',p:null},arsenalOpened:false,
 input:{keys:{Space:true},jumpQueued:false,jumpHeld:false,mx:0,mz:0},
 save:{settings:{flightVertical:.5}},flightSpeedMultiplier:()=>1.05**2,
 normalizeFlightThrottle:throttle.normalizeFlightThrottle,
 sound(){},burst(){},toast(){},worldSolidBodyCollision:()=>false,glReady:false};
vm.createContext(phy);vm.runInContext(src('03-height-and-collision.js'),phy);
vm.runInContext(src('04a-static-world-solids.js'),phy);
const flyer={x:7,z:7,feetY:1,vy:0,grounded:false,flying:true,flightUnlocked:true};
phy.game.p=flyer;phy.updateVertical(flyer,.1);
near(flyer.feetY,1+4.4*(1.05**2)*.5*.1,'actual vertical flight uses speed multiplier & throttle');

const motion={Math,Number,clamp,navClock:50,arsenalOpened:false,touchOnly:false,
 input:{mx:0,mz:0,fire:false},save:{settings:{flightHorizontal:.5}},
 flightSpeedMultiplier:()=>1.05**2,normalizeFlightThrottle:throttle.normalizeFlightThrottle,
 key:key=>key==='KeyW',updateDashDistanceWhileHeld(){},rebuildNavigation(){},
 sprintMotionState:()=>false,updateVertical(){},shoot(){},spawnWave(){},
 updateEnemies(){},updateRobotDebris(){},updatePlayerOrdnance(){},
 updateBullets(){},updateDevices(){},updateMission(){},
 moveEntity(p,dx,dz){p.x+=dx;p.z+=dz},hypot:Math.hypot};
motion.game={state:'playing',t:0,sectorTime:0,combo:0,portalReady:false,
 p:{x:0,z:0,yaw:0,pitch:0,speed:3.05,flying:true,
 energy:100,maxEnergy:100,regen:0,maxhp:100,hp:100,healRegen:0,
 armor:0,maxArmor:0,heat:0,heatLock:0,recoil:0,cooldown:0,iframes:0,
 shield:0,abilityCooldowns:{}}};
Object.assign(motion,{navFieldDestroyed:0,navFieldWorldCount:0,worldSolidCount:0,
 navFieldEquipment:null,worldEquipmentGrid:()=>null,navFieldMap:null,mapCells:null,
 navFieldHeights:null,heightCells:null,navFieldWorld:null,worldSolidGrid:null});
vm.createContext(motion);
const updateSource=src('19-gameplay-update.js');
vm.runInContext(updateSource.slice(updateSource.indexOf('function update(dt)'),updateSource.indexOf('function portalNext(')),motion);
motion.update(.1);
near(motion.game.p.z,3.05*1.05**2*.5*.1,'actual horizontal flying speed combines research and slider');
motion.game.p.flying=false;motion.game.p.z=0;
motion.update(.1);
near(motion.game.p.z,3.05*.1,'flight slider must not slow walking');

// Idle should call neither WebGL nor software render; the menu background
// itself has no self-sustaining RAF loop.
const frameSrc=src('27-main-loop-diagnostics.js');
let idleTimers=0;
const frameCtx={Math,Number,console,requestAnimationFrame(){},setTimeout(){idleTimers++;},lastFrame:0,
 save:{settings:{fpsLimit:60,quality:1}},game:null,uiTick:0,performanceSlow:0,
 performanceFast:0,adaptiveScale:1,touchOnly:false,glReady:false,
 renderedCalls:0,updatedCalls:0,render(){frameCtx.renderedCalls++},update(){frameCtx.updatedCalls++},updateHud(){},
 $:()=>({textContent:'',className:'',title:''})};
vm.createContext(frameCtx);
vm.runInContext(frameSrc.slice(frameSrc.indexOf('let uiTick='),frameSrc.indexOf('// Developer-only telemetry')),frameCtx);
for(let i=0;i<80;i++)frameCtx.frame(i*17);
check(frameCtx.renderedCalls===0,'menu still renders 3D');
check(idleTimers===80,'menu still uses full-speed RAF polling');
frameCtx.game={state:'playing'};
for(let i=80;i<110;i++)frameCtx.frame(i*17);
check(frameCtx.renderedCalls>0,'combat failed to render');
const atPause=frameCtx.renderedCalls;
frameCtx.game.state='paused';
for(let i=110;i<150;i++)frameCtx.frame(i*17);
check(frameCtx.renderedCalls===atPause,'pause still renders 3D');
frameCtx.game=null;
for(let i=150;i<190;i++)frameCtx.frame(i*17);
check(frameCtx.renderedCalls===atPause,'level map/menu still renders 3D');
check(idleTimers===160,'pause/level map did not use idle timer scheduling');
const menuPerf=src('25-cinematic-menu-perf.js');
const drawBody=menuPerf.slice(menuPerf.indexOf('function dcDrawMenu('),menuPerf.indexOf('new MutationObserver('));
check(!drawBody.includes('requestAnimationFrame(')&&
 !menuPerf.includes('setInterval(dcDrawMenu'),
 'background menu has a self-sustaining animation loop');

// All four entered fields route to their *own* corresponding button.
const formEvents=[],formButtons={};
for(const id of ['devLogin','devChange','devStageGo'])formButtons[id]={disabled:false,clicks:0,click(){this.clicks++}};
const form={addEventListener:(name,cb,capture)=>formEvents.push({name,cb,capture}),
 $:id=>formButtons[id]};
vm.createContext(form);
const handlerSrc=src('26-input-handlers.js');
vm.runInContext(handlerSrc.slice(handlerSrc.indexOf('const INPUT_ENTER_ACTIONS='),handlerSrc.indexOf('let lastDashRangeArrowAt=')),form);
check(formEvents.length===1&&formEvents[0].capture,'Enter handler must capture input before game controls');
for(const [id,target] of [['devPass','devLogin'],['devOld','devChange'],['devNew','devChange'],['devStageNumber','devStageGo']]){
 let stopped=0;
 formEvents[0].cb({key:'Enter',repeat:false,target:{id,matches:s=>s==='#overlay input'},
  preventDefault(){stopped++},stopImmediatePropagation(){stopped++}});
 check(stopped===2&&formButtons[target].clicks>0,`Enter from ${id} fails to click ${target}`);
}
formButtons.devChange.disabled=true;
const count=formButtons.devChange.clicks;
formEvents[0].cb({key:'Enter',repeat:false,target:{id:'devOld',matches:()=>true}});
check(formButtons.devChange.clicks===count,'disabled action was activated');

const renderer=src('09-robot-foundry-artifacts.js');
check(renderer.includes('const completeAirframe=e.airborne?airRobotVariants[e.type]:null;')&&
 renderer.includes('if(completeAirframe&&full)draw(completeAirframe')&&
 renderer.includes('if(full&&!completeAirframe)'),
 'special flying robot still overlays a whole drone torso on its airframe');
const mobileCss=fs.readFileSync(path.join(ROOT,'styles/70-directors-cut.css'),'utf8');
check(mobileCss.includes('#flightControls{top:92px;right:10px}')&&
 mobileCss.includes('grid-template-columns:minmax(0,1fr) minmax(0,1fr)'),
 'landscape mobile flight controls are not compacted below the minimap');
const campaignCss=fs.readFileSync(path.join(ROOT,'styles/50-campaign.css'),'utf8');
check(!campaignCss.includes('animation:campaignPulse'),
 'campaign map still runs a continuous GPU-composited pulse while idle');
console.log(`STAGE25: ${checks} acceptance assertions passed`);
