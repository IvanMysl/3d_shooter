
function keydown(e){input.keys[e.code]=true;if(!game||game.state!=='playing')return;if(['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();if(e.repeat)return;if(e.code==='Space')queueJump();if(e.code==='ShiftLeft'||e.code==='ShiftRight')useAbility('dash');if(e.code==='KeyQ')useAbility('pulse');if(e.code==='KeyE')useAbility('shield');if(e.code==='KeyF')useAbility('heal');if(e.code==='KeyP')pause();if(e.code==='KeyR'){toggleArsenal();e.preventDefault();}if(e.code==='KeyG'){toggleFullscreen();e.preventDefault()};if(/^Digit[1-9]$/.test(e.code))switchWeapon(+e.code.slice(-1)-1);if(e.code==='Digit0')switchWeapon(9)}addEventListener('keydown',keydown);addEventListener('keyup',e=>{input.keys[e.code]=false});addEventListener('blur',()=>{input.keys={};input.fire=false;input.jumpQueued=false;input.mx=0;input.mz=0;if(game?.state==='playing')pause()});
addEventListener('keydown',e=>{if(e.code==='Escape'&&game?.state==='playing')pause()});glCanvas.addEventListener('mousedown',e=>{if(!game||game.state!=='playing')return;if(e.button===0){input.fire=true;if(!touchOnly&&!document.pointerLockElement){try{glCanvas.requestPointerLock?.()}catch(er){}}}});addEventListener('mouseup',()=>input.fire=false);glCanvas.addEventListener('contextmenu',e=>e.preventDefault());document.addEventListener('pointerlockchange',()=>{if(!touchOnly&&!document.pointerLockElement&&!fullscreenTransition&&game?.state==='playing')pause()});glCanvas.addEventListener('mousemove',e=>{if(!game||game.state!=='playing'||touchOnly)return;if(document.pointerLockElement===glCanvas||input.fire){game.p.yaw-=(document.pointerLockElement?e.movementX:e.movementX)*.0032;game.p.pitch=clamp(game.p.pitch-e.movementY*.0029,-1.15,1.1)}});glCanvas.addEventListener('wheel',e=>{if(!game||game.state!=='playing')return;e.preventDefault();switchWeapon((game.p.weapon+(e.deltaY>0?1:weapons.length-1))%weapons.length)},{passive:false});
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
  let joy=$('joystick'),stick=$('stick');const joyPos=e=>{const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let x=e.clientX-cx,y=e.clientY-cy,lim=r.width*.35,mag=hypot(x,y)||1;if(mag>lim){x*=lim/mag;y*=lim/mag}input.mx=x/lim;input.mz=-y/lim;stick.style.transform=`translate(${x}px,${y}px)`};joy.addEventListener('pointerdown',e=>{input.joyId=e.pointerId;joy.setPointerCapture(e.pointerId);joyPos(e);e.preventDefault()});joy.addEventListener('pointermove',e=>{if(input.joyId===e.pointerId){joyPos(e);e.preventDefault()}});const endJoy=e=>{if(e.pointerId===input.joyId){input.mx=0;input.mz=0;input.joyId=null;stick.style.transform='translate(0,0)'}};joy.addEventListener('pointerup',endJoy);joy.addEventListener('pointercancel',endJoy);
[['dashTouch','dash'],['pulseTouch','pulse'],['shieldTouch','shield'],['healTouch','heal']].forEach(([id,ab])=>$(id).addEventListener('pointerdown',e=>{e.preventDefault();useAbility(ab)}));$('mobileSwitch').addEventListener('click',toggleArsenal);$('jumpTouch').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();queueJump()});}
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
addEventListener('keydown',e=>{if(e.code==='KeyM'&&game?.state==='playing'){miniZoom=!miniZoom;drawMinimap();e.preventDefault();}});