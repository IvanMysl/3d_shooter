'use strict';
// Actual developer-mode helpers, isolated storage and flight physics.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let count=0;function check(value,label){assert.ok(value,label);count++;}
const near=(a,b,label)=>check(Math.abs(a-b)<1e-4,`${label}: ${a} vs ${b}`);
function store(){const items=new Map();return {getItem:k=>items.get(k)||null,setItem:(k,v)=>items.set(k,String(v)),items};}
const normalStore=store(),sessionStore=store();
const elements=new Map(),el=id=>elements.get(id)||elements.set(id,{id,value:'',disabled:false,textContent:''}).get(id);
const setup={Math,Number,Array,Date,JSON,Map,Set,console,localStorage:normalStore,sessionStorage:sessionStore,
 document:{getElementById:el,pointerLockElement:null},performance:{now:()=>0},
 closeArsenal:()=>{},refreshCameraInterface:()=>{},normalizeLoadoutSave:()=>{},menu:()=>{},
 panel:()=>{},confirm:()=>true,$:el};
vm.createContext(setup);
vm.runInContext(src('00-core-save.js').split('const restoreInput=')[0],setup);
vm.runInContext(src('21a-developer-mode.js'),setup);
function expr(code){return vm.runInContext(code,setup);}
async function run(){
 check(await setup.developerPasswordMatches('tamu'),'default password was rejected');
 check(!await setup.developerPasswordMatches('wrong'),'wrong password accepted');
 expr('save.credits=123;save.perms[0]=4;persist()');
 const mainBefore=normalStore.getItem('neonrift3d-save');
 setup.showDeveloperPanel();
 el('devOld').value='wrong';el('devNew').value='anotherPassword';
 await el('devChange').onclick();
 check(el('devMessage').textContent.includes('неверен'),'wrong old password did not fail');
 check(await setup.developerPasswordMatches('tamu'),'failed change affected password');
 el('devOld').value='tamu';el('devNew').value='newDeveloperPassword';
 await el('devChange').onclick();
 check(!(await setup.developerPasswordMatches('tamu')),'old password still works after replacement');
 check(await setup.developerPasswordMatches('newDeveloperPassword'),'new password not accepted');
 setup.developerEnter();
 check(expr('devMode===true'),'developer mode did not activate');
 check(expr('save.credits===0&&save.perms.every(x=>x===0)'),'test arena did not start without purchases');
 check(expr('Object.keys(save.bodyArmor.owned).length===0'),'armor unlocked without purchase');
 check(setup.developerCanAfford(1000000000),'infinite credits not available');
 setup.developerBuy(1000000000);
 check(expr('save.credits===0'),'purchase deducted imaginary developer credits');
 check(setup.developerStageAccessible(100)&&!setup.developerStageAccessible(101),
  'developer access must include all legal levels, not out of range');
 expr('save.perms[4]=40;save.bodyArmor.owned[9]=10;persist()');
 check(normalStore.getItem('neonrift3d-save')===mainBefore,'developer autosave contaminated normal save');
 check(!!normalStore.getItem('neonrift3d-developer-sandbox-v1'),'developer sandbox not saved');
 setup.developerLeave();
 check(expr('devMode===false&&save.credits===123&&save.perms[0]===4'),'normal game was not restored');
 check(!setup.developerCanAfford(200),'infinite credits leaked into normal game');
 check(!setup.developerStageAccessible(300),'normal campaign became unlocked');
 setup.developerEnter();
 check(expr('save.perms[4]===40&&save.bodyArmor.owned[9]===10'),'developer purchases not restored');
 setup.developerResetSandbox();
 check(expr('save.perms.every(x=>x===0)&&Object.keys(save.bodyArmor.owned).length===0'),
  'reset did not relock developer purchases');
 setup.developerLeave();
 check(normalStore.getItem('neonrift3d-save')===mainBefore,'reset contaminated normal save');

 // Flight eligibility: catalog suits 10+ fly immediately; lesser suits need
 // their own tenth upgrade; a missing or unequipped suit cannot fly.
 setup.spawnX=6.5;setup.spawnZ=6.5;
 const loadout=src('12a-loadout-economy.js');
 vm.runInContext(loadout.slice(loadout.indexOf('function armorGrantsFlight('),loadout.indexOf('function armorUpgradePrice(')),setup);
 setup.equippedArmorStats=()=>({id:expr('save.bodyArmor.equipped'),level:expr('save.bodyArmor.owned[save.bodyArmor.equipped]')||0,maxDurability:300,reduction:.1});
 const playerSource=src('12-arsenal-and-game.js');
 vm.runInContext(playerSource.slice(playerSource.indexOf('const PERM_COMPOUND='),
  playerSource.indexOf('function freshGame(')),setup);
 expr('save.bodyArmor={owned:{8:9},equipped:8}');
 check(!setup.newPlayer().flightUnlocked,'flight unlocked for catalog #9 at level 9');
 expr('save.bodyArmor.owned[8]=10');
 check(setup.newPlayer().flightUnlocked,'flight did not unlock for #9 at level 10');
 expr('save.bodyArmor={owned:{9:0},equipped:9}');
 check(setup.newPlayer().flightUnlocked,'flight must unlock for catalog #10 at level 0');
 setup.equippedArmorStats=()=>({id:-1,maxDurability:0,reduction:0});
 check(!setup.newPlayer().flightUnlocked,'flight unlocked with no suit equipped');

 // Flight eligibility, rising, descending, ceiling, fall, no fake autojump.
 const floor=Array.from({length:20},()=>Array(20).fill(0));
 const phy={Math,Number,Array,Float32Array,console,sectorStyle:15,mapSize:20,mapCells:floor,
  mapRooms:[],game:{state:'playing',p:null},arsenalOpened:false,input:{keys:{},jumpHeld:false,jumpQueued:false},
  save:{settings:{audio:false}},glReady:false,toast:()=>{},refreshFlightButtons:()=>{},
  flightSpeedMultiplier:()=>1,normalizeFlightThrottle:()=>1,
  sound:()=>{},burst:()=>{},worldSolidBodyCollision:()=>false,
  clamp:(v,a,b)=>Math.max(a,Math.min(v,b))};
 vm.createContext(phy);vm.runInContext(src('03-height-and-collision.js'),phy);
 const p={x:8.5,z:8.5,feetY:0,vy:0,grounded:true,flying:false,flightUnlocked:false};
 phy.game.p=p;
 check(!phy.toggleFlight()&&!p.flying,'flight enabled without level 10 suit');
 p.flightUnlocked=true;
 check(phy.toggleFlight()&&p.flying,'suit level 10 did not allow flight');
 phy.input.keys.Space=true;
 for(let i=0;i<300;i++)phy.updateVertical(p,1/60);
 near(p.feetY,15-1.95-.2,'flight passed through high ceiling');
 check(p.flying&&!p.grounded,'flight mode exited at ceiling');
 phy.input.keys.Space=false;phy.input.keys.ControlLeft=true;
 for(let i=0;i<250;i++)phy.updateVertical(p,1/60);
 near(p.feetY,0,'descending did not land on floor');
 check(p.flying&&p.grounded,'flight did not stay enabled after landing');
 phy.input.keys.ControlLeft=false;
 phy.toggleFlight();
 check(!p.flying,'flight mode failed to switch off');
 phy.sectorStyle=0;p.feetY=0;p.flightUnlocked=true;phy.toggleFlight();
 phy.input.keys.Space=true;
 for(let i=0;i<200;i++)phy.updateVertical(p,1/60);
 near(p.feetY,4.25-1.95-.2,'low ceiling was ignored');
 phy.input.keys.Space=false;
 phy.sectorStyle=15;p.feetY=10;p.grounded=false;p.flying=false;p.vy=0;
 phy.updateVertical(p,1/60);
 check(p.feetY>9.9,'turning flight off at altitude teleported player downward');
 // High-ceiling stages include platforms far above ordinary jumping range.
 phy.sectorStyle=15;phy.mapRooms=[{x:2.5,z:2.5,w:12,h:12},{x:18.5,z:18.5,w:12,h:12}];
 phy.makeStairHeights(14);
 const skyCount=vm.runInContext('skyDeckSpecs.length',phy);
 check(skyCount>=1,'no airborne platform was generated in sky-sector fixture');
 const sky=vm.runInContext('skyDeckSpecs[0]',phy);
 check(sky.y>=7&&sky.y<=10,'sky platform too low for meaningful flight');
 p.x=sky.x;p.z=sky.z;p.feetY=0;p.grounded=true;p.vy=0;p.flying=true;
 phy.input.keys.Space=true;
 for(let i=0;i<260;i++)phy.updateVertical(p,1/60);
 check(p.feetY<sky.y-1.95-.16,'player flew straight through airborne platform from below');
 phy.input.keys.Space=false;
 // The real solid-registry descent sweep stops on a thin elevated platform.
 const solid={Math,Number,Array,console,mapSize:12,glReady:true};vm.createContext(solid);
 vm.runInContext(src('04a-static-world-solids.js'),solid);
 solid.resetWorldSolids();solid.registerWorldSolid(4,5,4,6,5.15,6);
 near(solid.worldSolidFeetBarrier(5,5,.23,6,4),5.15,'thin platform not caught by swept descent');
 check(solid.worldSolidFeetBarrier(5,5,.23,4,3)===null,'descent collision reported outside platform');
 console.log(`STAGE14: ${count} developer-mode, password, save isolation and flight checks passed`);
}
run().catch(e=>{console.error(e);process.exitCode=1});
