'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.STAGE_SOURCE_ROOT||path.resolve(__dirname,'..');
const src=n=>fs.readFileSync(path.join(root,'src',n),'utf8');
const c={Math,Number,console,Float32Array,Int8Array,Int16Array,Int32Array,Uint8Array,Map,Set,
 mapSize:14,mapCells:Array.from({length:14},()=>Array(14).fill(0)),glReady:false,touchOnly:false,
 game:null,mpMatch:null,sectorStyle:14,worldMapBoss:false,TAU:2*Math.PI,hypot:Math.hypot,
 clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),save:{settings:{audio:false,flightVertical:1}},
 sound:()=>{},burst:()=>{},toast:()=>{},input:{keys:{},jumpQueued:false,jumpHeld:false},
 arsenalOpened:false,box:()=>{},SPRINT_ENERGY_DRAIN:1.8,flightSpeedMultiplier:()=>1,normalizeFlightThrottle:()=>1,
 mpCombatEmit:()=>{},addEventListener:()=>{},useAbility:()=>{},toggleArsenal:()=>{},switchWeapon:()=>{}};
vm.createContext(c);
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js','13a-enemy-world-navigation.js',
 '21d-multiplayer-movement.js','21g-multiplayer-flight-abilities.js'])vm.runInContext(src(n),c,{filename:n});
const flyerSource=src('18-ai-and-abilities.js');
vm.runInContext(flyerSource.slice(flyerSource.indexOf('function updateFlyingRobot('),flyerSource.indexOf('function updateEnemies(')),c);
const ev=s=>vm.runInContext(s,c);let count=0;
const check=(v,m)=>{assert.ok(v,m);count++};const near=(a,b,m)=>check(Math.abs(a-b)<.005,`${m}: ${a} vs ${b}`);
const p=(x,z,feetY,extra={})=>({x,z,feetY,vy:0,grounded:true,flying:false,energy:100,walk:0,...extra});
const cmd={mx:0,mz:1,yaw:Math.PI/2,pitch:0,j:false,s:false,u:false,dn:false};
function reset(gl,h=.9){c.glReady=gl;c.game=null;c.mpMatch=null;c.input.keys={};c.input.jumpQueued=false;ev(`heightCells=new Float32Array(14*14);deckCells=new Float32Array(14*14);resetWorldSolids();heightCells[5*14+6]=${h}`)}
for(const gl of [false,true]){
 const m=gl?'WebGL':'Canvas';reset(gl);
 let a=p(5.5,5.5,0);c.game={p:a};c.tryMoveEntity(a,.4,0);check(a.x<=5.771,m+' tall riser blocks circular edge before center enters');near(a.feetY,0,m+' no boost');
 a=p(5.85,4.8,0);c.game={p:a};c.tryMoveEntity(a,0,.01);near(a.z,4.81,m+' free rounded corner');
 a=p(5.55,5.5,.9);c.game={p:a}; // start truly on the higher tile instead
 a.x=6.1;c.tryMoveEntity(a,-.25,0);near(a.x,5.85,m+' approach cliff');c.updateVertical(a,.016);near(a.feetY,.9,m+' support persists when circular edge remains');check(a.grounded,m+' remains grounded');
 c.tryMoveEntity(a,-.3,0);c.updateVertical(a,.016);check(!a.grounded&&a.feetY<.9&&a.feetY>.8,m+' falls only beyond edge');
 a=p(5.85,5.5,2,{grounded:false,vy:-8});c.game={p:a};c.updateVertical(a,.25);near(a.feetY,.9,m+' swept landing at real raised edge');check(a.grounded,m+' lands');
 a=p(5.5,5.5,0);c.game={p:a};reset(gl,.215);c.game={p:a};c.tryMoveEntity(a,.4,0);near(a.x,5.9,m+' legal step at circle overlap');near(a.feetY,.215,m+' step before center');
 c.tryMoveEntity(a,-.4,0);near(a.feetY,0,m+' legal descent');
 a=p(5.5,5.5,.05,{grounded:false,flying:true,flightUnlocked:true});c.game={p:a};c.tryMoveEntity(a,.4,0);check(a.x<=5.771,m+' airborne cannot auto-step into terrain');near(a.feetY,.05,m+' airborne altitude preserved');
 a=p(5.5,5.5,.24,{grounded:false,flying:true,flightUnlocked:true});c.game={p:a};c.tryMoveEntity(a,.4,0);near(a.x,5.9,m+' flight above real terrain remains free');
 reset(gl);a=p(5.5,5.5,0);for(let i=0;i<4;i++)c.mpMatchMove(a,cmd,1/30);check(a.x<=5.751,m+' PvP tall riser edge blocked');
 a=p(5.5,5.5,0);reset(gl,.215);for(let i=0;i<4;i++)c.mpMatchMove(a,cmd,1/30);check(a.x>5.85,m+' PvP walk-up');near(a.feetY,.215,m+' PvP edge support');
 reset(gl);a=p(5.5,5.5,0,{maxhp:100,type:'scout',radius:.48,airborne:false});c.game={p:p(2,2,0),enemies:[a]};c.tryMoveEntity(a,.4,0,.24);check(a.x<=5.761,m+' robot tall riser edge blocked');check(!c.enemyCanOccupy(a,5.9,5.5,.24),m+' robot sensor agrees');
 check(!c.enemyPathClear(a,6.6,5.5),m+' route cannot pass through a tall column');
 reset(gl,.215);a=p(5.5,5.5,0,{maxhp:100,type:'scout',radius:.48,airborne:false});c.game={p:p(2,2,0),enemies:[a]};c.tryMoveEntity(a,.4,0,.24);near(a.x,5.9,m+' robot legal step');near(a.feetY,.215,m+' robot edge support');
 // A .17m suspended slab must not be treated as harmless when it penetrates
 // just .10m into the feet; nor may a descending flying bot tunnel through it.
 reset(gl,0);ev('deckCells[5*14+6]=2.6');
 if(gl)c.worldSolidBox([],6,2.43,5,7,2.6,6,[.5,.5,.5]);
 check(c.worldDeckBodyCollision(5.85,5.5,.23,2.50,1.95),m+' last 10cm of deck solid');
 check(!c.worldDeckBodyCollision(5.70,5.5,.23,2.50,1.95),m+' no phantom edge slab');
 let fly={x:5.85,z:5.5,feetY:.13,airborne:true,type:'stormray',radius:.48,id:0,stun:1};
 c.game={t:0,p:p(2,2,3)};const h=c.enemyBodyHeight(fly);
 c.updateFlyingRobot(fly,c.game.p,.4);
 near(fly.feetY,2.6-.17-h-.018,m+' flying bot stops precisely under slab');
 fly.feetY=2.8;c.game.p.feetY=0;c.updateFlyingRobot(fly,c.game.p,.6);
 near(fly.feetY,2.618,m+' flying bot swept descent catches slab');
 // Network dash and normal movement must share the exact same contact pose.
 reset(gl);a=p(5.5,5.5,0,{yaw:Math.PI/2,hp:100});c.a=a;
 ev('mpMatch={actors:new Map([[0,{id:0,p:a}]])};mp6Dash(mpMatch.actors.get(0),{mx:0,mz:1});mpMatch=null;');
 check(a.x<=5.751,m+' PvP dash stops before real high column');
 reset(gl,.215);a=p(5.5,5.5,.05,{yaw:Math.PI/2,hp:100,grounded:false,flying:true});c.a=a;
 ev('mpMatch={actors:new Map([[0,{id:0,p:a}]])};mp6Dash(mpMatch.actors.get(0),{mx:0,mz:1});mpMatch=null;');
 check(a.x<=5.751,m+' airborne dash cannot step into low column');near(a.feetY,.05,m+' airborne dash retains actual feet');
}
console.log(`Stage109 solid terrain: ${count} PASS`);
