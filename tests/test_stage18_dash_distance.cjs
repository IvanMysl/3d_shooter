'use strict';
// Stage 18 legacy regression, updated to Stage 19's precise .5 m keyboard
// increments, .3 m upgrade benefit, and accessible progress-bar slider.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0;const check=(ok,why)=>{assert.ok(ok,why);checks++;};
const close=(a,b,why)=>check(Math.abs(a-b)<1e-7,`${why}: ${a} != ${b}`);

// 1. Preserve pre-stage18 saves: null is intentional "use unlocked maximum".
let writes=0,clock=1000;
const storage={getItem:()=>null,setItem:()=>{writes++;}};
 const dom={dashRangeHud:{classList:{classes:new Set(),add(v){this.classes.add(v)},remove(v){this.classes.delete(v)}}},
 dashRangeFill:{style:{height:''}},dashRangeLabel:{textContent:''},
 dashPauseSlider:{value:'1.08',setAttribute(k,v){this[k]=v}},dashPauseValue:{textContent:''},
 dashPauseRail:{style:{setProperty(k,v){this[k]=v}}}};
let timeoutCallback=null;
const ctx={Math,Number,Array,Map,Set,Date,JSON,console,
 localStorage:storage,sessionStorage:storage,performance:{now:()=>clock},
 setTimeout:fn=>{timeoutCallback=fn;return 3},clearTimeout:()=>{},
 document:{getElementById:id=>dom[id]||null},touchOnly:false};
vm.createContext(ctx);
vm.runInContext(read('00-core-save.js').split('const restoreInput=')[0],ctx);
const calc=x=>vm.runInContext(x,ctx);
check(calc('save.settings.dashDistance')===null,'legacy save no longer defaults to MAX');
check(calc('normalizeDashDistanceSetting(undefined)')===null,'missing selection treated as zero');
check(calc('normalizeDashDistanceSetting(Infinity)')===null,'infinity imported as distance');
check(calc('normalizeDashDistanceSetting("oops")')===null,'invalid text imported as distance');
close(calc('normalizeDashDistanceSetting(-100)'),.50,'underflow clamp');
close(calc('normalizeDashDistanceSetting(999)'),14.52,'overflow clamp');
close(calc('normalizeDashDistanceSetting(1.05)'),1.05,'centimetre precision');
close(calc('normalizeDashDistanceSetting(2.52)'),2.52,'baseline exact step');

const gameplay=read('19-gameplay-update.js');
vm.runInContext(gameplay.slice(gameplay.indexOf('const SPRINT_ENERGY_DRAIN='),
 gameplay.indexOf('function update(')),ctx);
vm.runInContext('game={state:"playing",p:{dashRange:2.52}};input={keys:{},lastWAt:-Infinity};arsenalOpened=false;function key(k){return !!input.keys[k]}',ctx);
close(calc('selectedDashRange()'),2.52,'legacy setting did not keep 2.52 m');
const inputSource=read('26-input-handlers.js');
vm.runInContext(inputSource.slice(inputSource.indexOf('let lastDashRangeArrowAt='),
 inputSource.indexOf("addEventListener('keydown',keydown)")),ctx);
function key(code,repeat=false,altKey=false){
 let prevented=false;
 ctx.keydown({code,repeat,altKey,preventDefault:()=>{prevented=true}});
 return prevented;
}
check(key('ArrowDown'),'down arrow was not captured during play');
close(calc('selectedDashRange()'),2.02,'first down arrow not applied');
check(dom.dashRangeHud.classList.classes.has('visible'),'PC gauge not shown');
check(dom.dashRangeLabel.textContent.includes('2,02 / 2,52'),'PC gauge label wrong');
check(parseFloat(dom.dashRangeFill.style.height)>74&&parseFloat(dom.dashRangeFill.style.height)<77,
 'PC gauge fill ratio wrong');
clock+=60;key('ArrowDown',true);
close(calc('selectedDashRange()'),2.02,'browser repeat should be sampled by game frame');
clock+=135;key('ArrowDown',true);
calc('input.keys.KeyW=true;input.sprint=true');
calc('updateDashDistanceWhileHeld()');
close(calc('selectedDashRange()'),1.52,'held arrow did not update per frame');
check(calc('input.keys.KeyW&&input.sprint'), 'dash regulation interrupted WASD sprint');
calc('input.keys.ArrowDown=false');clock+=60;key('ArrowUp');
close(calc('selectedDashRange()'),2.02,'up arrow did not increase range');
calc('input.keys.ArrowUp=false');
for(let i=0;i<25;i++){clock+=200;key('ArrowDown');calc('input.keys.ArrowDown=false')}
close(calc('selectedDashRange()'),.50,'arrow distance did not stop at minimum');
for(let i=0;i<75;i++){clock+=200;key('ArrowUp');calc('input.keys.ArrowUp=false')}
close(calc('selectedDashRange()'),2.52,'arrow distance exceeded base upgrade cap');
timeoutCallback();
check(!dom.dashRangeHud.classList.classes.has('visible'),'PC gauge never auto-hides');
check(writes>0,'keyboard distance was not persisted');
check(key('ArrowDown',false,true),'Alt+Arrow should suppress browser scroll');
check(calc('input.keys.ArrowDown')===true,'Alt+Arrow unavailable to camera pitch');
close(calc('selectedDashRange()'),2.52,'Alt+Arrow changed dash distance');

// 2. The earned 40-tier cap is 14.52 m and an explicit selection remains
// unchanged after upgrades until the user adjusts it.
calc('save.perms[5]=40;game.p.dashRange=14.52;save.settings.dashDistance=null');
close(calc('selectedDashRange()'),14.52,'new max after upgrade incorrect');
calc('save.settings.dashDistance=2.52');
close(calc('selectedDashRange()'),2.52,'explicit selected range was lost on upgrade');
const menus=read('22-menus-and-upgrades.js');
vm.runInContext(menus.slice(0,menus.indexOf('function menu()')),ctx);
const mobileMarkup=calc('dashDistanceSettingsHTML()');
check(mobileMarkup.includes('type="range"')&&mobileMarkup.includes('max="14.52"')&&
 mobileMarkup.includes('step="0.01"')&&mobileMarkup.includes('dashPauseRailFill'),
 'touch pause progress rail has wrong bounds/precision or no fill');
check(mobileMarkup.includes('2,52 / 14,52'),'touch slider does not reflect saved selection');
calc('game.state="paused";wireDashDistanceSettings()');
const writesBeforeSlider=writes;
dom.dashPauseSlider.value='4.20';dom.dashPauseSlider.oninput();
close(calc('selectedDashRange()'),4.20,'mobile slider does not update active selection');
check(writes===writesBeforeSlider,'sliding caused excessive synchronous saves');
check(dom.dashPauseValue.textContent==='4,20 / 14,52 м','mobile output did not update');
check(dom.dashPauseRail.style['--dash-fill'].endsWith('%'),'mobile progress fill not updated');
dom.dashPauseSlider.onchange();
check(writes>writesBeforeSlider,'mobile slider release did not persist');
calc('game.state="playing"');
ctx.touchOnly=true;
const mobileBefore=calc('selectedDashRange()');
key('ArrowUp');
close(calc('selectedDashRange()'),mobileBefore,'mobile keyboard unexpectedly changed selected distance');
ctx.touchOnly=false;
check(fs.readFileSync(path.resolve(__dirname,'../styles/40-hud.css'),'utf8').includes('#dashRangeHud{display:none!important}'),
 'transient desktop gauge was not hidden on touch screens');

// 3. The actual dash solver, untouched collision algorithm and correct flight
// altitude: only X/Z change, even during a long airborne dash.
const N=32,cells=Array.from({length:N},(_,z)=>Array.from({length:N},(_,x)=>
 x===0||z===0||x===N-1||z===N-1?1:0));
let obstacle=()=>false,bursts=[];
const phy={Math,Number,Array,Map,Float32Array,console,
 mapSize:N,mapCells:cells,glReady:false,sectorStyle:15,mapRooms:[],
 worldSolidBodyCollision:(x,z,r,y,h)=>obstacle(x,z,r,y,h),
 input:{jumpQueued:false,jumpHeld:false,mx:0,mz:0},
 sound:()=>{},burst:(...a)=>bursts.push(a),toast:()=>{},
 save:{settings:{audio:false,dashDistance:4.20}},arsenalOpened:false,
 game:{state:'playing',p:null},clamp:(x,a,b)=>Math.max(a,Math.min(b,x))};
vm.createContext(phy);
vm.runInContext('const DASH_DISTANCE_BASE=2.52,DASH_DISTANCE_MAX=14.52,DASH_DISTANCE_MIN=.5;',phy);
vm.runInContext(read('03-height-and-collision.js'),phy);
vm.runInContext(read('04a-static-world-solids.js'),phy);
phy.worldSolidBodyCollision=(x,z,r,y,h)=>obstacle(x,z,r,y,h);
const ability=read('18-ai-and-abilities.js');
vm.runInContext(ability.slice(ability.indexOf('function useAbility('),
 ability.indexOf('function enemyFire(')),phy);
const player={x:6.5,z:7.5,yaw:Math.PI/2,feetY:6.35,vy:0,grounded:false,flying:true,
 flightUnlocked:true,energy:500,dashCost:25,dashRange:14.52,shield:0,maxhp:100,hp:100};
phy.game.p=player;
// Separate geometry scenarios are independent casts, not cooldown bypasses
// available to players. Advance the skill state between these unit cases.
const testDash=()=>{player.abilityCooldowns={};phy.useAbility('dash');};
testDash();
close(player.x,10.70,'midair dash did not use selected range');
close(player.feetY,6.35,'midair dash changed altitude');
close(player.vy,0,'midair dash introduced vertical velocity');
close(player.energy,475,'dash price unexpectedly changed');
close(bursts.at(-1)[1],6.65,'flight dash particles spawned at ground level');
// Tall shield: cannot cross it at the flying player's actual body altitude.
obstacle=(x,z,r,y,h)=>x>=8.12&&x<=9.40&&y>=5.5&&y<=7;
player.x=6.5;player.energy=500;
testDash();
check(player.x>7.8&&player.x<8.12,`dash clipped through midair obstacle: ${player.x}`);
close(player.feetY,6.35,'blocked midair dash changed flight height');
// The same obstacle placed far below the flying player is not an invisible wall.
obstacle=(x,z,r,y,h)=>x>=8.12&&x<=9.40&&y<1.8;
player.x=6.5;player.energy=500;
testDash();
close(player.x,10.70,'low obstacle incorrectly blocked an overhead dash');
// Ground dash uses identical selected setting. Oversized selection is clamped.
obstacle=()=>false;player.x=6.5;player.feetY=0;player.flying=false;player.grounded=true;
phy.save.settings.dashDistance=1.08;player.energy=500;
testDash();
close(player.x,7.58,'short ground dash wrong');
phy.save.settings.dashDistance=99;player.x=6.5;player.energy=500;
testDash();
close(player.x,21.02,'dash exceeded bought 40-level cap');
player.dashRange=2.52;player.x=6.5;player.energy=500;
testDash();
close(player.x,9.02,'out-of-cap setting bypassed base upgrade limit');
console.log(`STAGE18 DASH RANGE: ${checks} save, UI, keyboard, flight and swept-collision checks passed`);
