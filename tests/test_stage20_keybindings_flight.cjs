'use strict';
// Stage 26: F repairs in priority order, E is the phase dash; Shift lowers the
// flying operator; Space ascends; C preserves temporary invulnerability.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0;function check(value,reason){assert.ok(value,reason);checks++;}
const clamp=(value,min,max)=>Math.max(min,Math.min(value,max));
const activated=[],p={flightUnlocked:true,flying:true,feetY:1.5,vy:0,grounded:false};
const ctx={Math,Number,console,game:{state:'playing',p},touchOnly:false,
 arsenalOpened:false,performance:{now:()=>1000},input:{keys:{},sprint:false,lastWAt:-Infinity,
 lastSpaceAt:-Infinity,jumpHeld:false},useAbility:name=>activated.push(name),
 toggleFlight:()=>{},queueJump:()=>{},pause:()=>{},stepDashRange:()=>{},
 toggleArsenal:()=>{},toggleFullscreen:()=>{},switchWeapon:()=>{},
 refreshCameraInterface:()=>{},toggleCameraMode:()=>{},closeArsenal:()=>{},
 sound:()=>{}};
vm.createContext(ctx);
const source=read('26-input-handlers.js');
vm.runInContext(source.slice(source.indexOf('let lastDashRangeArrowAt='),
 source.indexOf("addEventListener('keydown',keydown)")),ctx);
const hit=(code,repeat=false)=>{
 let prevented=false;ctx.keydown({code,repeat,altKey:false,preventDefault(){prevented=true}});
 return prevented;
};
hit('KeyF');check(activated.join(',')==='heal','F does not activate priority repair');
hit('KeyF',true);check(activated.length===1,'holding F repeats repair unintentionally');
hit('KeyC');check(activated.at(-1)==='shield','C protective sphere no longer activates');
hit('KeyQ');check(activated.at(-1)==='pulse','Q pulse was modified');
hit('KeyE');check(activated.at(-1)==='dash','E dash was modified');
const beforeShift=activated.length;
check(hit('ShiftLeft'),'Shift-down did not prevent default browser action');
check(activated.length===beforeShift,'Shift unexpectedly still triggers dash');
check(ctx.input.keys.ShiftLeft,'Shift key hold is not recorded for vertical physics');
hit('KeyF');check(activated.at(-1)==='heal','Shift disables F repair while flying');
hit('KeyW');check(ctx.input.keys.KeyW,'W movement was altered by new controls');
hit('Space');check(ctx.input.keys.Space&&ctx.input.jumpHeld,'Space no longer provides held ascent');
ctx.input.keys.ShiftLeft=false;check(ctx.input.keys.Space,'releasing Shift also removed Space');
hit('ShiftRight');check(ctx.input.keys.ShiftRight,'right Shift unsupported');
check(source.includes("['dashTouch','dash'],['pulseTouch','pulse'],['shieldTouch','shield'],['healTouch','heal']"),
 'mobile ability buttons changed or lost their functions');

// The real height integrator must respond to held keys over multiple frames.
const floor=Array.from({length:20},()=>Array(20).fill(0));
const phy={Math,Number,Array,Float32Array,console,sectorStyle:0,mapSize:20,mapCells:floor,
 mapRooms:[],game:{state:'playing',p:null},arsenalOpened:false,
 input:{keys:{},jumpHeld:false,jumpQueued:false,mx:0,mz:0},
 save:{settings:{audio:false}},glReady:false,toast:()=>{},refreshFlightButtons:()=>{},
 flightSpeedMultiplier:()=>1,normalizeFlightThrottle:()=>1,
 sound:()=>{},burst:()=>{},worldSolidBodyCollision:()=>false,clamp};
vm.createContext(phy);vm.runInContext(read('03-height-and-collision.js'),phy);
vm.runInContext(read('04a-static-world-solids.js'),phy);
const flyer={x:8.5,z:8.5,feetY:1.0,vy:0,grounded:false,flying:true,flightUnlocked:true};
phy.game.p=flyer;
phy.input.keys.Space=true;phy.updateVertical(flyer,.10);
check(flyer.feetY>1.4,'holding Space fails to lift flying suit');
const upHeight=flyer.feetY;
phy.input.keys.Space=false;phy.input.keys.ShiftLeft=true;
phy.updateVertical(flyer,.10);
check(flyer.feetY<upHeight-.4,'left Shift fails to lower flying suit');
phy.input.keys.ShiftLeft=false;phy.input.keys.ShiftRight=true;
const beforeRightShift=flyer.feetY;phy.updateVertical(flyer,.08);
check(flyer.feetY<beforeRightShift-.3,'right Shift fails to lower flying suit');
phy.input.keys.ShiftRight=false;phy.input.keys.Space=true;
const beforeAscend=flyer.feetY;phy.updateVertical(flyer,.08);
check(flyer.feetY>beforeAscend+.3,'Space ascent fails after Shift descent');
phy.input.keys.ShiftLeft=true;
const beforeBoth=flyer.feetY;phy.updateVertical(flyer,.08);
check(Math.abs(flyer.feetY-beforeBoth)<.0001,'Space+Shift should hold altitude');
phy.input.keys.ShiftLeft=false;phy.input.keys.Space=false;
phy.input.keys.ControlLeft=true;
const beforeCtrl=flyer.feetY;phy.updateVertical(flyer,.08);
check(flyer.feetY<beforeCtrl-.3,'legacy Ctrl descent stopped working');
phy.input.keys.ControlLeft=false;phy.input.flyDown=true;
const beforeTouch=flyer.feetY;phy.updateVertical(flyer,.08);
check(flyer.feetY<beforeTouch-.25,'mobile descent button stopped working');
phy.input.flyDown=false;phy.input.flyUp=true;
const beforeTouchUp=flyer.feetY;phy.updateVertical(flyer,.08);
check(flyer.feetY>beforeTouchUp+.25,'mobile ascent button stopped working');
check(flyer.feetY<=4.25-1.95-.2,'sector 1 ceiling protection was removed');

// End-to-end: a real E keypress must reach the real dash solver and preserve
// altitude, while Shift must change only altitude without consuming dash energy.
phy.game.p.yaw=0;phy.game.p.energy=200;phy.game.p.dashCost=25;
phy.game.p.dashRange=2.52;phy.game.p.shield=0;phy.game.p.shieldDuration=3.5;
phy.save.settings.dashDistance=2.00;
phy.touchOnly=false;phy.performance={now:()=>3000};
phy.toggleFlight=()=>{};phy.queueJump=()=>{};phy.pause=()=>{};
phy.stepDashRange=()=>{};phy.toggleArsenal=()=>{};phy.toggleFullscreen=()=>{};
phy.toggleCameraMode=()=>{};phy.switchWeapon=()=>{};
vm.runInContext('const DASH_DISTANCE_BASE=2.52,DASH_DISTANCE_MAX=14.52,DASH_DISTANCE_MIN=.50;',phy);
const ability=read('18-ai-and-abilities.js');
vm.runInContext(ability.slice(ability.indexOf('function useAbility('),ability.indexOf('function enemyFire(')),phy);
vm.runInContext(source.slice(source.indexOf('let lastDashRangeArrowAt='),
 source.indexOf("addEventListener('keydown',keydown)")),phy);
phy.input.keys={};phy.input.flyUp=false;phy.input.flyDown=false;
const dashStart={x:flyer.x,z:flyer.z,y:flyer.feetY,energy:flyer.energy};
phy.keydown({code:'KeyE',repeat:false,altKey:false,preventDefault:()=>{}});
check(Math.abs(flyer.z-dashStart.z-2)<.0001&&Math.abs(flyer.x-dashStart.x)<.0001,
 'E did not perform the configured two-meter phase shift');
check(Math.abs(flyer.feetY-dashStart.y)<.0001,'E dash modified altitude during flight');
check(flyer.energy===dashStart.energy-25,'E dash does not consume its energy cost');
const downStart={x:flyer.x,z:flyer.z,y:flyer.feetY,energy:flyer.energy};
phy.keydown({code:'ShiftLeft',repeat:false,altKey:false,preventDefault:()=>{}});
phy.updateVertical(flyer,.08);
check(flyer.feetY<downStart.y-.3,'Shift did not lower altitude after E');
check(flyer.x===downStart.x&&flyer.z===downStart.z,'Shift incorrectly caused another dash');
check(flyer.energy===downStart.energy,'Shift descent wrongly consumed dash energy');
phy.keydown({code:'KeyC',repeat:false,altKey:false,preventDefault:()=>{}});
check(flyer.shield===3.5,'C does not activate the actual protective shield');
console.log(`STAGE20 KEYMAP + FLIGHT: ${checks} PC, mobile, cooldown and physics assertions passed`);
