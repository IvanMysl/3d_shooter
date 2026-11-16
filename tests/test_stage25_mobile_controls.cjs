'use strict';
// Actual touch-event registration from the production input module, without
// a browser-only test shim replacing any button or slider event handlers.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/26-input-handlers.js'),'utf8');
let checks=0;
const check=(value,label)=>{assert.ok(value,label);checks++};
function element(id){
 const handlers=new Map(),attributes={};
 const cls=new Set();
 return{id,handlers,attributes,style:{transform:''},value:'100',textContent:'',
  classList:{toggle:(name,on)=>{if(on===undefined?cls.has(name):!on)cls.delete(name);else cls.add(name)},add:name=>cls.add(name),remove:name=>cls.delete(name),contains:name=>cls.has(name)},
  addEventListener(name,fn){const l=handlers.get(name)||[];l.push(fn);handlers.set(name,l)},
  dispatch(name,data={}){const ev={pointerId:1,pointerType:'touch',clientX:0,clientY:0,
    preventDefault(){},stopPropagation(){},...data};for(const fn of handlers.get(name)||[])fn(ev);return ev},
  setAttribute(k,v){attributes[k]=v},getAttribute:k=>attributes[k],
  getBoundingClientRect(){return{left:20,top:250,width:120,height:120}},
  setPointerCapture(){},releasePointerCapture(){}};
}
const ids=['flightHorizontalSlider','flightVerticalSlider','flightHorizontalValue',
 'flightVerticalValue','flightHorizontalPauseSlider','flightVerticalPauseSlider',
 'flightHorizontalPauseValue','flightVerticalPauseValue','joystick','stick','dashTouch','pulseTouch',
 'shieldTouch','healTouch','runTouch','viewTouch','flightToggle',
 'flightUp','flightDown','mobileSwitch','jumpTouch','fullscreenBtn',
 'overlay','pauseBtn','minimap'];
const elems=Object.fromEntries(ids.map(id=>[id,element(id)]));
const globals=new Map();const documentListeners=new Map();
let now=1000,shots=0,paused=0,weaponList=0,changedView=0,flights=0,persisted=0,jumped=0;
const activated=[];
const glCanvas=element('gl');
const ctx={Math,Number,console,Map,Set,Date,TouchEvent:{},
 FLIGHT_SPEED:4.4,
 $:id=>elems[id]||null,glCanvas,document:{documentElement:{},body:element('body'),pointerLockElement:null,
  fullscreenElement:null,addEventListener(name,cb){documentListeners.set(name,cb)},
  querySelectorAll:()=>[]},
 addEventListener(name,fn){const a=globals.get(name)||[];a.push(fn);globals.set(name,a)},
 requestAnimationFrame(){},setTimeout(fn){fn()},performance:{now:()=>now},
 game:{state:'playing',p:{flightUnlocked:true,flying:true,yaw:0,pitch:0}},
 save:{settings:{flightHorizontal:1,flightVertical:1}},touchOnly:true,
 arsenalOpened:false,saveRun(){},closeArsenal(){},
 input:{keys:{},sprint:false,mobileSprint:false,lastWAt:-Infinity,
  jumpHeld:false,lastSpaceAt:-Infinity,lastWAt:-Infinity,mx:0,mz:0,
  pid:null,joyId:null,flyUp:false,flyDown:false},
 normalizeFlightThrottle:v=>Math.round(Math.min(1,Math.max(.25,v))*20)/20,
 flightSpeedMultiplier:()=>1.05,
 persist(){persisted++},useAbility:name=>activated.push(name),
 toggleFlight(){flights++;ctx.game.p.flying=!ctx.game.p.flying},
 toggleCameraMode(){changedView++},toggleArsenal(){weaponList++},
 queueJump(){jumped++},shoot(){shots++},pause(){paused++},
 switchWeapon(){},toggleFullscreen(){},stepDashRange(){},
 drawMinimap(){},updateFullscreenButtons(){},resize(){},
 clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),hypot:Math.hypot};
vm.createContext(ctx);
vm.runInContext(source,ctx);
// Pause creates these two mobile inputs dynamically after opening the overlay.
ctx.wireFlightPauseSettings();
for(const id of ['dashTouch','pulseTouch','shieldTouch','healTouch'])
 check(elems[id].handlers.has('pointerdown'),`${id} lacks actual touch listener`);
for(const [id,expected] of [['dashTouch','dash'],['pulseTouch','pulse'],
 ['shieldTouch','shield'],['healTouch','heal']]){
 elems[id].dispatch('pointerdown');
 check(activated.at(-1)===expected,`${id} activated ${activated.at(-1)} instead of ${expected}`);
}
const joystick=elems.joystick;
joystick.dispatch('pointerdown',{pointerId:41,clientX:80,clientY:260});
check(ctx.input.joyId===41&&Math.abs(ctx.input.mz)>0,'joystick movement did not register');
elems.dashTouch.dispatch('pointerdown',{pointerId:42});
check(ctx.input.joyId===41&&ctx.input.mz!==0&&activated.at(-1)==='dash',
 'touching an ability while moving interrupted joystick');
elems.runTouch.dispatch('pointerdown',{pointerId:43});
check(ctx.input.mobileSprint&&ctx.input.joyId===41,
 'running toggle stole a simultaneous joystick pointer');
joystick.dispatch('pointerup',{pointerId:41});
check(ctx.input.joyId===null&&ctx.input.mx===0&&ctx.input.mz===0,
 'releasing joystick left phantom movement');
const beforeFlight=flights;
elems.flightToggle.dispatch('pointerdown',{pointerId:51});
check(flights===beforeFlight+1,'mobile flight toggle did not activate');
elems.flightToggle.dispatch('pointerdown',{pointerId:52});
check(ctx.game.p.flying,'mobile flight cannot be turned on again');
elems.flightUp.dispatch('pointerdown',{pointerId:60});
check(ctx.input.flyUp,'mobile ascend does not set held flight input');
elems.flightUp.dispatch('pointerup',{pointerId:60});
check(!ctx.input.flyUp,'mobile ascend stays held after release');
elems.flightDown.dispatch('pointerdown',{pointerId:61});
check(ctx.input.flyDown,'mobile descend does not set held flight input');
elems.flightDown.dispatch('pointercancel',{pointerId:61});
check(!ctx.input.flyDown,'mobile descend stuck after cancellation');
elems.flightHorizontalPauseSlider.value='35';
elems.flightHorizontalPauseSlider.dispatch('input');
check(ctx.save.settings.flightHorizontal===.35,'pause horizontal slider ignores drag');
elems.flightVerticalPauseSlider.value='60';
elems.flightVerticalPauseSlider.dispatch('input');
check(ctx.save.settings.flightVertical===.6,'pause vertical slider ignores drag');
const persistedBefore=persisted;
elems.flightHorizontalPauseSlider.dispatch('change');
elems.flightVerticalPauseSlider.dispatch('change');
check(persisted===persistedBefore+2,'pause flight sliders do not save final selection');
ctx.refreshFlightButtons();
check(elems.flightHorizontalPauseValue.textContent==='35%'&&
 elems.flightVerticalPauseValue.textContent==='60%',
 'pause flight setting labels do not match persisted values');
check(elems.flightToggle.attributes['aria-pressed']==='true',
 'flight toggle inaccessible state does not match flight');
// A swipe changes camera direction; it must not fire an accidental shot.
glCanvas.dispatch('pointerdown',{pointerId:70,clientX:120,clientY:200});
glCanvas.dispatch('pointermove',{pointerId:70,clientX:180,clientY:190});
glCanvas.dispatch('pointerup',{pointerId:70,clientX:180,clientY:190});
check(shots===0&&ctx.game.p.yaw!==0,'mobile camera swipe triggers shooting or fails to look');
now+=100;
glCanvas.dispatch('pointerdown',{pointerId:71,clientX:120,clientY:200});
glCanvas.dispatch('pointerup',{pointerId:71,clientX:120,clientY:200});
check(shots===1,'mobile stationary tap did not fire a shot');
now+=100;
elems.mobileSwitch.dispatch('pointerdown',{pointerId:81});
check(weaponList===1,'mobile weapon drawer did not open on pointerdown');
elems.mobileSwitch.dispatch('click');
check(weaponList===1,'one mobile tap opened then immediately closed weapon drawer');
elems.jumpTouch.dispatch('pointerdown');
check(jumped===1,'mobile jump touch button does not work');
elems.viewTouch.dispatch('pointerdown');
check(changedView===0&&!elems.viewTouch.handlers.has('pointerdown'),
 'mobile combat view button must be inert; camera is changed in Pause');
check(paused===0,'mobile interactions unexpectedly paused the game');
console.log(`STAGE25 MOBILE: ${checks} production touch/slider/joystick/gesture assertions passed`);
