'use strict';
// Stage 19: live head pitch, ten weapon silhouettes, safe pause toggle,
// suit-based flight, actual incoming-damage mitigation and UI feedback.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../styles/40-hud.css'),'utf8');
let checks=0;
const check=(value,label)=>{assert.ok(value,label);checks++;};
const near=(x,y,why)=>check(Math.abs(x-y)<.00001,`${why}: ${x} != ${y}`);
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));

// Head motion uses one neck pivot, while body and helmet stay assembled.
const palette={primary:[.2,.3,.4],fabric:[.12,.2,.26],joint:[.3,.38,.42],
 light:[.5,.6,.65],shadow:[.11,.16,.21],black:[.02,.03,.05],
 accent:[.35,.8,.9],visor:[.1,.9,1]};
const models=[],p={x:7,z:9,yaw:.3,pitch:0,feetY:0,walk:0,weapon:0,
 bodyArmorType:-1,bodyArmorMax:0,bodyArmor:0,shield:0,shotGlow:0};
const weapons=Array.from({length:10},(_,i)=>({color:[.20+i*.07,.65,.95-i*.05]}));
const modelCtx={Math,Number,Array,Set,Map,console,clamp,glReady:true,
 save:{settings:{cameraMode:'third',quality:1},bodyArmor:{owned:{}}},
 game:{p,t:0},weapons,BODY_ARMOR_CATALOG:[],
 geom:{bevel:'bevel',rounded:'rounded',orb:'orb',ring:'ring',cylinder:'cylinder'},
 draw:(...v)=>models.push(v),document:{body:{classList:{toggle(){}}}},$:()=>null,
 rayWall:()=>null,sweepWorldSphere:()=>null,rayNode:()=>null,rayEnemy:()=>null,
 persist:()=>{},toast:()=>{},touchOnly:false};
vm.createContext(modelCtx);vm.runInContext(read('09a-player-third-person.js'),modelCtx);
const pose=()=>vm.runInContext('operatorHeadPose(game.p,0,1.805,.252)',modelCtx);
const head0=pose();p.pitch=.8;const headUp=pose();p.pitch=-.8;const headDown=pose();
check(headUp.y>head0.y+.07,'head visor fails to rise when camera looks up');
check(headDown.y<head0.y-.07,'head visor fails to lower when camera looks down');
check(headUp.tilt<0&&headDown.tilt>0,'helmet does not rotate with pitch');
p.pitch=.38;vm.runInContext('renderOperator(game,game.p)',modelCtx);
check(models.length>=60,'operator assembly lost visible details');
check(models.some(x=>x.at(-1)<-.1),'helmet/gun draw calls lost negative pitch tilt');
const weaponProfiles=[];
for(let i=0;i<10;i++){
 p.weapon=i;p.pitch=0;
 const parts=[];
 modelCtx.recordBlock=(...v)=>parts.push(v);
 vm.runInContext('renderOperatorWeapon(game,game.p,recordBlock,{joint:[.3,.3,.3]})',modelCtx);
 check(parts.length>=13,`weapon ${i+1} too featureless`);
 weaponProfiles.push(JSON.stringify(parts.map(v=>[v[0],v[1],v[2],v[3],v[4],v[5],v[8]])));
}
check(new Set(weaponProfiles).size===10,'two distinct weapons still share the same club geometry');
p.weapon=2;p.pitch=.75;
const gunUp=[];modelCtx.recordBlock=(...v)=>gunUp.push(v);
vm.runInContext('renderOperatorWeapon(game,game.p,recordBlock,{joint:[.3,.3,.3]})',modelCtx);
p.pitch=-.75;const gunDown=[];modelCtx.recordBlock=(...v)=>gunDown.push(v);
vm.runInContext('renderOperatorWeapon(game,game.p,recordBlock,{joint:[.3,.3,.3]})',modelCtx);
check(gunUp.at(-3)[1]>gunDown.at(-3)[1]+.12,'held gun ignores vertical camera pitch');

// Real loadout code, not a duplicated mock of the eligibility function.
const gear={Math,Number,Array,console,clamp,save:{perms:[0,0,0,0,0,0],
 bodyArmor:{owned:{},equipped:-1},weaponMods:{}},weapons,spawnX:6.5,spawnZ:6.5};
vm.createContext(gear);vm.runInContext(read('12a-loadout-economy.js'),gear);
vm.runInContext('const DASH_DISTANCE_BASE=2.52,DASH_UPGRADE_STEP=.30;',gear);
const newPlayerSource=read('12-arsenal-and-game.js');
vm.runInContext(newPlayerSource.slice(newPlayerSource.indexOf('const PERM_COMPOUND='),
 newPlayerSource.indexOf('function freshGame(')),gear);
const getPlayer=()=>vm.runInContext('newPlayer()',gear);
check(!getPlayer().flightUnlocked,'flight without a purchased suit');
vm.runInContext('save.bodyArmor.owned[8]=9;save.bodyArmor.equipped=8',gear);
check(!getPlayer().flightUnlocked,'catalog #9 level 9 incorrectly flies');
vm.runInContext('save.bodyArmor.owned[8]=10',gear);
check(getPlayer().flightUnlocked,'catalog #9 level 10 cannot fly');
vm.runInContext('save.bodyArmor.owned[9]=0;save.bodyArmor.equipped=9',gear);
check(getPlayer().flightUnlocked,'catalog #10 cannot fly immediately after purchase');
vm.runInContext('save.bodyArmor.owned[11]=0;save.bodyArmor.equipped=11',gear);
check(getPlayer().flightUnlocked,'catalog #12 cannot fly immediately after purchase');
vm.runInContext('save.bodyArmor.equipped=10',gear);
check(!getPlayer().flightUnlocked,'flight enabled on unequipped/unowned suit');

// True mitigation: energy barrier absorbs first, the suit reduces the rest,
// then its durability is consumed. It must cease reducing once destroyed.
const barClasses=new Set(),bar={classList:{add:n=>barClasses.add(n),remove:n=>barClasses.delete(n)}};
const armorCtx={Math,Number,console,clamp,game:{state:'playing',p:null},
 $:id=>id==='bars'?bar:{style:{opacity:0}},setTimeout:fn=>{fn();return 1},
 sound:()=>{},gameOver:()=>{}};
vm.createContext(armorCtx);
const damage=read('13-enemy-navigation-spawn.js');
vm.runInContext(damage.slice(damage.indexOf('function damagePlayer('),damage.indexOf('function burst(')),armorCtx);
const victim=(durability,reduction)=>({hp:100,maxhp:100,armor:30,armorTier:0,
 shield:0,iframes:0,bodyArmor:durability,bodyArmorReduction:reduction});
const unprotected=victim(0,0);armorCtx.game.p=unprotected;
armorCtx.damagePlayer(100);near(unprotected.hp,30,'baseline shield protects from 30 only');
const protectedPlayer=victim(200,.5);armorCtx.game.p=protectedPlayer;
armorCtx.damagePlayer(100);near(protectedPlayer.hp,65,'physical armor fails to mitigate HP damage');
near(protectedPlayer.bodyArmor,200-35*1.12,'absorbed damage did not deplete plating');
const weakened=victim(10,.5);armorCtx.game.p=weakened;
armorCtx.damagePlayer(100);near(weakened.bodyArmor,0,'broken suit retained durability');
check(weakened.hp<protectedPlayer.hp&&weakened.hp>unprotected.hp,
 'exhausted plating still mitigates at full strength or provides no protection');
check(css.includes('#bars.suitHit')&&css.includes('#bodyArmorFill{'),
 'physical armor feedback lacks distinctive meter/impact styling');

// Real Escape handler toggles paused state; button and Escape use the same
// unpause path, and OS-repeat does not instantly re-pause the game.
const elems={overlay:{classList:{classes:new Set(),add(v){this.classes.add(v)}}},
 hud:{classList:{classes:new Set(),add(v){this.classes.add(v)}}}};
const handlers={};
const ui={Math,Number,console,game:{state:'playing'},lastFrame:0,
 performance:{now:()=>1234},document:{getElementById:id=>elems[id]},
 $:id=>elems[id],addEventListener:(name,fn)=>{handlers[name]=fn},
 pause:()=>{ui.game.state='paused'}};
vm.createContext(ui);
const menu=read('22-menus-and-upgrades.js');
vm.runInContext(menu.slice(menu.indexOf('let pauseResumeGraceUntil='),menu.indexOf('function menu()')),ui);
const inputs=read('26-input-handlers.js');
const match=inputs.match(/addEventListener\('keydown',e=>\{if\(e\.code!=='Escape'[\s\S]*?\}\}\);glCanvas\.addEventListener/);
check(!!match,'Escape handler missing from registered input handlers');
vm.runInContext(match[0].replace(/;glCanvas\.addEventListener$/,''),ui);
const press=(repeat=false)=>handlers.keydown({code:'Escape',repeat,preventDefault:()=>{}});
press();check(ui.game.state==='paused','Escape does not pause game');
press(true);check(ui.game.state==='paused','held Escape immediately unpaused game');
press();check(ui.game.state==='playing','Escape does not resume from pause');
check(elems.overlay.classList.classes.has('hidden')&&elems.hud.classList.classes.has('show'),
 'Escape resumed logic left pause overlay visible');
check(vm.runInContext('pauseResumeGraceUntil===1584',ui),'pointer-lock transition still races Escape resume');
console.log(`STAGE19: ${checks} head, 10 weapons, suit flight, defense and pause checks passed`);
