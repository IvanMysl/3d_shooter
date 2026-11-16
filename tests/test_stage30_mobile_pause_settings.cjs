'use strict';
// Mobile/tablet HUD must contain only controls needed during combat. Camera
// selection and flight speed tuning live in Pause; the desktop HUD is intact.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const menus=src('src/22-menus-and-upgrades.js');
const inputs=src('src/26-input-handlers.js');
const css=src('styles/70-directors-cut.css');
const gameplay=src('src/19-gameplay-update.js');
const physics=src('src/03-height-and-collision.js');
let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};

check(css.includes('body.flightUnlocked #hud.show #flightTuning{display:none!important}'),
 'touch HUD can still show flight speed sliders over battle');
check(css.includes('#viewTouch{display:none!important}'),
 'battle camera button is still visible on mobile');
check(!inputs.includes("mobileView.addEventListener('pointerdown'"),
 'hidden battle camera button can still switch camera mode');
check(inputs.includes('function wireFlightPauseSettings('),
 'pause sliders cannot be connected after a pause panel refresh');
check(gameplay.includes("flightSpeedMultiplier('horizontal')*normalizeFlightThrottle(save.settings.flightHorizontal)"),
 'saved horizontal throttle does not affect real flight motion');
check(physics.includes("flightSpeedMultiplier('vertical')*normalizeFlightThrottle(save.settings.flightVertical)"),
 'saved vertical throttle does not affect real flight motion');

let rendered='',saves=0,closeCount=0,wired=0,cameraChanges=0;
const elements=Object.fromEntries(['unpause','toMenu','pauseCampaign','cameraToggle','mute','aim','quality']
 .map(key=>[key,{}]));
const ctx={Math,Number,touchOnly:true,
 game:{state:'playing',sector:16,kills:8,score:1500,p:{flightUnlocked:true}},
 save:{settings:{flightHorizontal:.35,flightVertical:.75,cameraMode:'first',audio:true,aim:true,quality:1}},
 storageAvailable:true,document:{pointerLockElement:null},input:{fire:true},
 $:id=>elements[id]||null,
 closeArsenal(){closeCount++;},saveRun(){saves++;},
 panel:markup=>{rendered=markup},
 fpsSettingsHTML:()=>'',dashDistanceSettingsHTML:()=>'',
 normalizeFlightThrottle:value=>Math.round(Math.min(1,Math.max(.25,value))*20)/20,
 cameraModeLabel:()=>({first:'ПЕРВОЕ ЛИЦО',third:'ТРЕТЬЕ ЛИЦО',second:'ВТОРОЕ ЛИЦО'})[ctx.save.settings.cameraMode],
 toggleCameraMode(){cameraChanges++;ctx.save.settings.cameraMode=ctx.save.settings.cameraMode==='first'?'third':ctx.save.settings.cameraMode==='third'?'second':'first'},
 wireBackupButtons(){},wireFpsSettings(){},wireDashDistanceSettings(){},
 wireFlightPauseSettings(){wired++;},
 unpauseGame(){ctx.game.state='playing'},menu(){},showCampaignMap(){},
 persist(){},createWorldMesh(){},resize(){},clamp:(v,a,b)=>Math.max(a,Math.min(v,b))};
vm.createContext(ctx);
vm.runInContext(menus.slice(menus.indexOf('function flightPauseSettingsHTML('),menus.indexOf('function gameOver(')),ctx);

check(ctx.flightPauseSettingsHTML().includes('flightHorizontalPauseSlider'),
 'mobile pause is missing horizontal speed control');
check(ctx.flightPauseSettingsHTML().includes('flightVerticalPauseSlider'),
 'mobile pause is missing vertical speed control');
ctx.pause();
check(ctx.game.state==='paused'&&closeCount===1&&saves===1,
 'opening pause lost gameplay or failed to save it');
check(rendered.includes('id="flightHorizontalPauseSlider"')&&rendered.includes('35%'),
 'pause failed to show persisted horizontal speed');
check(rendered.includes('id="flightVerticalPauseSlider"')&&rendered.includes('75%'),
 'pause failed to show persisted vertical speed');
check(rendered.includes('id="cameraToggle"')&&wired===1,
 'pause is missing camera mode button or live slider bindings');
elements.cameraToggle.onclick();
check(cameraChanges===1&&ctx.game.state==='paused'&&wired===2,
 'camera switch did not stay in pause or restore slider listeners');
check(rendered.includes('КАМЕРА: ТРЕТЬЕ ЛИЦО')&&rendered.includes('35%')&&rendered.includes('75%'),
 'camera change reset the pause display or selected flight speeds');
ctx.game.state='playing';ctx.game.p.flightUnlocked=false;ctx.pause();
check(!rendered.includes('flightHorizontalPauseSlider')&&rendered.includes('id="cameraToggle"'),
 'non-flying loadout shows irrelevant speed settings or loses camera settings');
ctx.touchOnly=false;ctx.game.state='playing';ctx.game.p.flightUnlocked=true;ctx.pause();
check(!rendered.includes('flightHorizontalPauseSlider')&&rendered.includes('id="cameraToggle"'),
 'desktop pause unexpectedly duplicates the desktop in-combat flight sliders');
console.log(`STAGE30 MOBILE PAUSE: ${checks} assertions passed`);
