
function refreshFlightButtons(){
 const p=game?.p,eligible=!!p?.flightUnlocked,active=eligible&&!!p?.flying;
 document.body.classList.toggle('flightUnlocked',eligible);
 document.body.classList.toggle('flying',active);
 const toggle=$('flightToggle');
 if(toggle){toggle.setAttribute('aria-pressed',String(active));toggle.textContent=active?'✈ ЛЕЧУ':'✈ ПОЛЁТ';}
 refreshFlightTuning();
 requestAnimationFrame(positionMobileFlightControls);
}
// Keep the flight button (and the hold-to-ascend/descend buttons) directly
// above ARSENAL, even when phone rotation, safe areas or browser UI change.
// Both elements are absolutely positioned inside the same HUD coordinate space.
function flightLayoutAboveArsenal(hudBounds,arsenalBounds){
 const gap=7;
 return {
  bottom:Math.max(0,Math.round(hudBounds.bottom-arsenalBounds.top+gap)),
  right:Math.max(0,Math.round(hudBounds.right-arsenalBounds.right))
 };
}
function positionMobileFlightControls(){
 const hud=$('hud'),arsenal=$('mobileSwitch'),controls=$('flightControls');
 if(!hud||!arsenal||!controls)return;
 const a=arsenal.getBoundingClientRect(),h=hud.getBoundingClientRect();
 if(a.width<=0||a.height<=0||h.width<=0||h.height<=0)return;
 const placement=flightLayoutAboveArsenal(h,a);
 controls.style.top='auto';
 controls.style.bottom=placement.bottom+'px';
 controls.style.right=placement.right+'px';
}
addEventListener('resize',positionMobileFlightControls);
addEventListener('orientationchange',()=>requestAnimationFrame(positionMobileFlightControls));
if(typeof window!=='undefined'&&window.visualViewport)window.visualViewport.addEventListener('resize',positionMobileFlightControls);
function setFlightThrottle(axis,value,commit=false){
 if(typeof mpMatch!=='undefined'&&mpMatch?.active)return;
 if(!['horizontal','vertical'].includes(axis))return;
 const key=axis==='horizontal'?'flightHorizontal':'flightVertical';
 save.settings[key]=normalizeFlightThrottle(value);
 refreshFlightTuning();
 if(commit)persist();
}
function refreshFlightTuning(){
 for(const [axis,id] of [['horizontal','flightHorizontal'],['vertical','flightVertical']]){
  const ratio=normalizeFlightThrottle(save.settings[id]);
  for(const suffix of ['','Pause']){
   const slider=$(id+suffix+'Slider'),value=$(id+suffix+'Value');if(!slider||!value)continue;
   slider.value=String(Math.round(ratio*100));
   value.textContent=Math.round(ratio*100)+'%';
   value.title='Доступно '+(axis==='horizontal'?(3.05*flightSpeedMultiplier(axis)).toFixed(2):(FLIGHT_SPEED*flightSpeedMultiplier(axis)).toFixed(2))+' м/с';
  }
 }
}
for(const [axis,id] of [['horizontal','flightHorizontal'],['vertical','flightVertical']]){
 const slider=$(id+'Slider');
 slider.addEventListener('input',()=>setFlightThrottle(axis,Number(slider.value)/100));
 slider.addEventListener('change',()=>setFlightThrottle(axis,Number(slider.value)/100,true));
 for(const action of ['pointerdown','pointermove','pointerup'])slider.addEventListener(action,e=>e.stopPropagation());
}
// The mobile pause panel is recreated after camera/settings changes, so its
// sliders must be rebound each time. The HUD controls remain desktop-only.
function wireFlightPauseSettings(){
 for(const [axis,id] of [['horizontal','flightHorizontal'],['vertical','flightVertical']]){
  const slider=$(id+'PauseSlider');if(!slider)continue;
  slider.addEventListener('input',()=>setFlightThrottle(axis,Number(slider.value)/100));
  slider.addEventListener('change',()=>setFlightThrottle(axis,Number(slider.value)/100,true));
  for(const action of ['pointerdown','pointermove','pointerup'])slider.addEventListener(action,e=>e.stopPropagation());
 }
 refreshFlightTuning();
}
// Enter on an input invokes the exact associated action, just like clicking
// its adjacent primary button. Password changes never accidentally log in.
const INPUT_ENTER_ACTIONS={devPass:'devLogin',devOld:'devChange',devNew:'devChange',devStageNumber:'devStageGo'};
addEventListener('keydown',e=>{
 if(e.key!=='Enter'||e.repeat||!e.target?.matches?.('#overlay input'))return;
 const action=$(INPUT_ENTER_ACTIONS[e.target.id]);
 if(action&&!action.disabled){e.preventDefault();e.stopImmediatePropagation();action.click();}
},true);
let lastDashRangeArrowAt=-Infinity;
function textEntryTarget(target){return !!target?.matches?.('input,textarea,select,[contenteditable]')||!!target?.isContentEditable;}
function keydown(e){
 if(mpChat.open)return;
 if(e.code==='Escape')return;
 if(textEntryTarget(e.target)&&!e.target.matches('#gl'))return;
 if(mpMatch?.active&&/^(ArrowUp|ArrowDown|BracketLeft|BracketRight|Comma|Period)$/.test(e.code)){e.preventDefault();return;}
 if(e.code==='F5'&&game&&['playing','paused'].includes(game.state)){e.preventDefault();if(!e.repeat)toggleCameraMode();return;}
 if((e.code==='ArrowUp'||e.code==='ArrowDown')&&game?.state==='playing'&&!touchOnly&&!e.altKey&&!arsenalOpened){
  e.preventDefault();
  const alreadyHeld=!!input.keys[e.code];
  input.keys[e.code]=true;
  if(!alreadyHeld){
   stepDashRange(e.code==='ArrowUp'?1:-1);
   lastDashRangeArrowAt=performance.now();
  }
  return;
 }
 if(e.code==='KeyW'&&!e.repeat&&game?.state==='playing'&&!arsenalOpened){const now=performance.now();input.sprint=now-input.lastWAt<325;input.lastWAt=now;}
 input.keys[e.code]=true;if(!game||game.state!=='playing')return;if(['Space','ShiftLeft','ShiftRight','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();if(e.code==='Space')input.jumpHeld=true;if(e.repeat)return;if(e.code==='Space'){const now=performance.now();if(game.p.flightUnlocked&&now-input.lastSpaceAt<340){toggleFlight();input.lastSpaceAt=-Infinity;}else{if(!game.p.flying)queueJump();input.lastSpaceAt=now;}}if(e.code==='KeyV')toggleFlight();if(e.code==='KeyE')useAbility('dash');if(e.code==='KeyQ')useAbility('pulse');if(e.code==='KeyC')useAbility('shield');if(e.code==='KeyF')useAbility('heal');if(game.p.flightUnlocked&&['BracketLeft','BracketRight','Comma','Period'].includes(e.code)){const axis=['BracketLeft','BracketRight'].includes(e.code)?'horizontal':'vertical',delta=['BracketRight','Period'].includes(e.code)?.10:-.10;setFlightThrottle(axis,save.settings[axis==='horizontal'?'flightHorizontal':'flightVertical']+delta,true);}if(e.code==='KeyP')pause();if(e.code==='KeyR'){toggleArsenal();e.preventDefault();}if(e.code==='KeyG'){toggleFullscreen();e.preventDefault()};if(/^Digit[1-9]$/.test(e.code))switchWeapon(+e.code.slice(-1)-1);if(e.code==='Digit0')switchWeapon(9)}addEventListener('keydown',keydown);addEventListener('keyup',e=>{if(e.code==='KeyW')input.sprint=false;if(e.code==='Space')input.jumpHeld=false;input.keys[e.code]=false});function resetTransientInput(){
 input.keys={};input.sprint=false;input.lastWAt=-Infinity;
 input.fire=false;input.jumpQueued=false;input.jumpHeld=false;
 input.flyUp=false;input.flyDown=false;input.lastSpaceAt=-Infinity;input.mx=0;input.mz=0;
 if(input.pid!==null){try{glCanvas.releasePointerCapture(input.pid)}catch(_){}}
 input.pid=null;input.tapMoved=false;
 if(input.joyId!==null){try{$('joystick').releasePointerCapture(input.joyId)}catch(_){}}
 input.joyId=null;
 const stick=$('stick');if(stick)stick.style.transform='translate(0,0)';
 if(game?.state==='playing'&&!mpChat.open&&!game.preview&&!(typeof mpMatch!=='undefined'&&mpMatch?.paused))pause();
}
addEventListener('blur',resetTransientInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden)resetTransientInput()});
// Esc delegates to the visible screen's actual button, never bypasses its cleanup.
function handleEscape(e){
 if(mpChat.open)return false;
 if(e.code!=='Escape'||e.repeat||e.defaultPrevented)return false;
 const consume=()=>{e.preventDefault();e.stopImmediatePropagation?.();return true;};
 if(arsenalOpened){closeArsenal();return consume();}
 const overlay=$('overlay');
 if(overlay&&!overlay.classList.contains('hidden')){
  const action=$('panel')?.querySelector('button[data-esc-action]:not(:disabled)');
  if(action){consume();action.click();return true;}
  return false;
 }
 if(game?.state==='playing'){consume();pause();return true;}
 return false;
}
addEventListener('keydown',handleEscape,true);
glCanvas.addEventListener('mousedown',e=>{if(mpChat.open||!game||game.state!=='playing')return;if(e.button===0){input.fire=true;if(!touchOnly&&!document.pointerLockElement){try{glCanvas.requestPointerLock?.()}catch(er){}}}});addEventListener('mouseup',()=>input.fire=false);glCanvas.addEventListener('contextmenu',e=>e.preventDefault());document.addEventListener('pointerlockchange',()=>{if(touchOnly||document.pointerLockElement||fullscreenTransition||mpChat.open||game?.state!=='playing')return;if(game.preview){mpPreviewEnd();return;}if(performance.now()>pauseResumeGraceUntil)pause();});glCanvas.addEventListener('mousemove',e=>{if(mpChat.open||!game||game.state!=='playing'||touchOnly)return;if(document.pointerLockElement===glCanvas||input.fire){game.p.yaw-=(document.pointerLockElement?e.movementX:e.movementX)*.0032;game.p.pitch=clamp(game.p.pitch-e.movementY*.0029,-1.15,1.1)}});glCanvas.addEventListener('wheel',e=>{if(mpChat.open||!game||game.state!=='playing')return;e.preventDefault();switchWeapon((game.p.weapon+(e.deltaY>0?1:weapons.length-1))%weapons.length)},{passive:false});
if(touchOnly){
  // A tap is a shot. A drag is camera movement, and MUST never shoot.
  // Touches on buttons/joystick don't reach this canvas, so they never fire.
  const TAP_DRIFT=12, TAP_MAX_MS=350;
  glCanvas.addEventListener('pointerdown',e=>{
    if(!game||game.state!=='playing'||e.pointerType!=='touch'||input.pid!==null)return;
    input.pid=e.pointerId;
    input.px=input.tapX=e.clientX;
    input.py=input.tapY=e.clientY;
    input.tapAt=performance.now();
    input.tapMoved=false;
    try{glCanvas.setPointerCapture(e.pointerId)}catch(_){}
    e.preventDefault();
  },{passive:false});
  glCanvas.addEventListener('pointermove',e=>{
    if(!game||game.state!=='playing'||e.pointerId!==input.pid)return;
    // Track movement from the initial touch, not just between frames.
    // Once a gesture becomes a look gesture it can never become a tap again.
    if(hypot(e.clientX-input.tapX,e.clientY-input.tapY)>TAP_DRIFT)input.tapMoved=true;
    const dx=e.clientX-input.px,dy=e.clientY-input.py;
    input.px=e.clientX;input.py=e.clientY;
    if(input.tapMoved){
      game.p.yaw-=dx*.0061;
      game.p.pitch=clamp(game.p.pitch-dy*.0048,-1.1,1.04);
    }
    e.preventDefault();
  },{passive:false});
  glCanvas.addEventListener('pointerup',e=>{
    if(e.pointerId!==input.pid)return;
    const tap=!input.tapMoved&&
      hypot(e.clientX-input.tapX,e.clientY-input.tapY)<=TAP_DRIFT&&
      performance.now()-input.tapAt<=TAP_MAX_MS;
    input.pid=null;
    input.tapMoved=false;
    e.preventDefault();
    if(tap&&!arsenalOpened&&game?.state==='playing')shoot();
  },{passive:false});
  glCanvas.addEventListener('pointercancel',e=>{
    if(e.pointerId===input.pid){input.pid=null;input.tapMoved=false}
  });
  let joy=$('joystick'),stick=$('stick');const joyPos=e=>{const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let x=e.clientX-cx,y=e.clientY-cy,lim=r.width*.35,mag=hypot(x,y)||1;if(mag>lim){x*=lim/mag;y*=lim/mag}input.mx=x/lim;input.mz=-y/lim;stick.style.transform=`translate(${x}px,${y}px)`};joy.addEventListener('pointerdown',e=>{if(input.joyId!==null){e.preventDefault();return;}input.joyId=e.pointerId;joy.setPointerCapture(e.pointerId);joyPos(e);e.preventDefault()});joy.addEventListener('pointermove',e=>{if(input.joyId===e.pointerId){joyPos(e);e.preventDefault()}});const endJoy=e=>{if(e.pointerId===input.joyId){input.mx=0;input.mz=0;input.joyId=null;stick.style.transform='translate(0,0)'}};joy.addEventListener('pointerup',endJoy);joy.addEventListener('pointercancel',endJoy);
[['dashTouch','dash'],['pulseTouch','pulse'],['shieldTouch','shield'],['healTouch','heal']].forEach(([id,ab])=>$(id).addEventListener('pointerdown',e=>{e.preventDefault();useAbility(ab)}));const runTouch=$('runTouch');
 runTouch.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();input.mobileSprint=!input.mobileSprint;runTouch.classList.toggle('running',input.mobileSprint);runTouch.setAttribute('aria-pressed',String(input.mobileSprint));},{passive:false});
 // Practice returns directly to the room form, so expose a local-only camera switch.
 $('viewTouch')?.addEventListener('pointerdown',e=>{if(mpMatch?.active){e.preventDefault();e.stopPropagation();toggleCameraMode();}},{passive:false});
 const flyButton=$('flightToggle');
 flyButton.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();toggleFlight();},{passive:false});
 for(const [id,axis] of [['flightUp','flyUp'],['flightDown','flyDown']]){
  const button=$(id);let heldId=null;
  button.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();heldId=e.pointerId;input[axis]=true;try{button.setPointerCapture(e.pointerId);}catch(_){}},{passive:false});
  const release=e=>{if(e.pointerId===heldId){input[axis]=false;heldId=null;}};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);
  button.addEventListener('lostpointercapture',()=>{input[axis]=false;heldId=null;});
 }
 const mobileSwitch=$('mobileSwitch');let weaponTouchAt=-Infinity;
 mobileSwitch.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch'||e.pointerType==='pen'){
   e.preventDefault();e.stopPropagation();weaponTouchAt=performance.now();toggleArsenal();
  }
 },{passive:false});
 mobileSwitch.addEventListener('click',e=>{if(performance.now()-weaponTouchAt>500)toggleArsenal();});$('jumpTouch').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();queueJump()});}
// Fullscreen is a browser permission, not a hidden external dependency.
let fullscreenTransition=false;
const fsEl=document.documentElement;
function updateFullscreenButtons(){
  let active=!!(document.fullscreenElement||document.webkitFullscreenElement);
  const b=$('fullscreenBtn');b.textContent=active?'⤢':'⛶';b.setAttribute('aria-pressed',String(active));
  b.setAttribute('aria-label',active?'Выйти из полноэкранного режима':'Включить полноэкранный режим');
  for(const el of document.querySelectorAll('[data-fs]'))el.textContent=active?'⤢ ВЫЙТИ ИЗ ПОЛНОГО ЭКРАНА':'⛶ ПОЛНЫЙ ЭКРАН';
  requestAnimationFrame(resize);
}
async function toggleFullscreen(){
  let enabled=!!(document.fullscreenElement||document.webkitFullscreenElement);
  fullscreenTransition=true;
  try{
    if(enabled){if(document.exitFullscreen)await document.exitFullscreen();else if(document.webkitExitFullscreen)document.webkitExitFullscreen();}
    else{
      if(fsEl.requestFullscreen)await fsEl.requestFullscreen({navigationUI:'hide'});
      else if(fsEl.webkitRequestFullscreen)fsEl.webkitRequestFullscreen();
      else throw Error('API not available');
    }
  }catch(err){toast('Полный экран недоступен в этом браузере. Попробуй меню браузера.',3);}
  finally{setTimeout(()=>{fullscreenTransition=false;updateFullscreenButtons();},160)}
}
$('fullscreenBtn').addEventListener('click',toggleFullscreen);
$('overlay').addEventListener('click',e=>{if(e.target.closest('[data-fs]'))toggleFullscreen()});
for(const event of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(event,updateFullscreenButtons);
updateFullscreenButtons();
$('pauseBtn').onclick=pause;
$('minimap').addEventListener('click',()=>{miniZoom=!miniZoom;drawMinimap();});
addEventListener('keydown',e=>{if(mpChat.open||textEntryTarget(e.target))return;if(e.code==='KeyM'&&game?.state==='playing'){miniZoom=!miniZoom;drawMinimap();e.preventDefault();}});

mpChatBind();
