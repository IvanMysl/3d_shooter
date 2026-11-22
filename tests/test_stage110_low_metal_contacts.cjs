'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.STAGE_SOURCE_ROOT||path.resolve(__dirname,'..'), src=n=>fs.readFileSync(path.join(root,'src',n),'utf8');
const draws=[];
const c={Math,Number,console,Float32Array,Int8Array,Int16Array,Int32Array,Uint8Array,Map,Set,
 mapSize:14,mapCells:Array.from({length:14},()=>Array(14).fill(0)),glReady:true,touchOnly:false,
 game:null,mpMatch:null,sectorStyle:14,worldMapBoss:false,TAU:2*Math.PI,hypot:Math.hypot,
 clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),save:{settings:{audio:false,flightVertical:1}},
 sound:()=>{},burst:()=>{},toast:()=>{},input:{keys:{},jumpQueued:false,jumpHeld:false},
 arsenalOpened:false,box:(...args)=>draws.push(args),SPRINT_ENERGY_DRAIN:1.8,flightSpeedMultiplier:()=>1,normalizeFlightThrottle:()=>1,
 mpCombatEmit:()=>{},addEventListener:()=>{},useAbility:()=>{},toggleArsenal:()=>{},switchWeapon:()=>{}};
vm.createContext(c);
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js','13a-enemy-world-navigation.js','21d-multiplayer-movement.js','21g-multiplayer-flight-abilities.js','14-combat-raycast.js'])vm.runInContext(src(n),c,{filename:n});
const ev=s=>vm.runInContext(s,c);let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++},near=(a,b,m)=>ok(Math.abs(a-b)<.0001,`${m}: ${a} != ${b}`);
const p=(x,z,feetY,extra={})=>({x,z,feetY,vy:0,grounded:true,flying:false,energy:100,walk:0,...extra});
const cmd={mx:0,mz:1,yaw:Math.PI/2,pitch:0,j:false,s:false,u:false,dn:false};
function reset(gl=true){c.glReady=gl;c.game=null;c.mpMatch=null;c.input.keys={};c.input.jumpQueued=false;draws.length=0;ev('heightCells=new Float32Array(14*14);deckCells=new Float32Array(14*14);resetWorldSolids()')}
const box=(...b)=>c.worldSolidBox([], ...b,[.4,.4,.4]);
for(const top of [.055,.09,.12,.16,.24]){
 reset();box(6,0,5,6.1,top,6);
 ok(draws.length===1&&c.worldSolidStats().boxes===1,'closed low steel registered');
 ok(c.worldSolidBodyCollision(5.85,5.5,.23,0,1.95),'must not swallow low metal in 16cm feet tolerance');
 ok(!c.worldSolidBodyCollision(5.76,5.5,.23,0,1.95),'no enlarged box');
 ok(!c.worldSolidBodyCollision(5.85,5.5,.23,top,1.95),'standing on a real top is not a collision');
 near(c.worldSolidStepSupport(5.85,5.5,.23,0),top,'real grounded step');
 let a=p(5.5,5.5,0);c.game={p:a};c.tryMoveEntity(a,.4,0);near(a.x,5.9,'grounded solo walks onto steel');near(a.feetY,top,'boots above steel');c.updateVertical(a,.016);near(a.feetY,top,'remains supported');
 c.tryMoveEntity(a,-.4,0);near(a.feetY,0,'walks back down');
 a=p(5.5,5.5,.01,{grounded:false,flying:true,flightUnlocked:true});c.game={p:a};c.tryMoveEntity(a,.4,0);ok(a.x<=5.771,'airborne cannot use foot tolerance');near(a.feetY,.01,'airborne cannot auto-step');
 a=p(5.5,5.5,0);c.game=null;for(let i=0;i<4;i++)c.mpMatchMove(a,cmd,1/30);ok(a.x>5.85,'PvP crosses low obstacle');near(a.feetY,top,'PvP boots above steel');
 a=p(5.5,5.5,0,{maxhp:100,type:'scout',radius:.48,airborne:false});c.game={p:p(2,2,0),enemies:[a]};c.tryMoveEntity(a,.4,0,.24);near(a.x,5.9,'robot crosses low obstacle');near(a.feetY,top,'robot boots above steel');
 const h=c.rayWall({x:5.5,y:top/2,z:5.5},{x:1,y:0,z:0},1);ok(h&&Math.abs(h.x-6)<1e-5,'low steel stops bullets');
}
reset();box(6,0,5,6.1,.246,6);let a=p(5.5,5.5,0);c.game={p:a};c.tryMoveEntity(a,.4,0);ok(a.x<=5.771,'above legal step blocks');
reset();box(6,0,5,6.1,.12,6);box(6,1.96,5,6.1,2.1,6);a=p(5.5,5.5,0);c.game={p:a};c.tryMoveEntity(a,.4,0);ok(a.x<=5.771,'step cannot squeeze body into overhead solid');
reset();box(6,0,5,6.1,.09,6);box(6,.09,5,6.1,.26,6);a=p(5.5,5.5,0);c.game={p:a};c.tryMoveEntity(a,.4,0);ok(a.x<=5.771,'stacked plates cannot combine to exceed step height');
// Contact with an exactly tangent edge is not a support or ceiling; a real
// overlap just inside the edge must give the same result in every direction.
reset();box(6,2,5,6.1,2.1,6);
for(const [x,z] of [[5.77,5.5],[6.33,5.5],[6.05,4.77],[6.05,6.23]]){
 ok(!c.worldSolidBodyCollision(x,z,.23,1,1.95),'tangent body clear');ok(c.worldSolidHeadBarrier(x,z,.23,1.9,2.1)===null,'tangent head clear');ok(c.worldSolidFeetBarrier(x,z,.23,2.2,1.8)===null,'tangent feet clear');ok(c.worldSolidStandingSupport(x,z,.23,2.1)===null,'no phantom standing support');
}
for(const [x,z] of [[5.771,5.5],[6.329,5.5],[6.05,4.771],[6.05,6.229]]){
 ok(c.worldSolidBodyCollision(x,z,.23,1,1.95),'real contact');near(c.worldSolidHeadBarrier(x,z,.23,1.9,2.1),2,'real head contact');near(c.worldSolidFeetBarrier(x,z,.23,2.2,1.8),2.1,'real feet contact');near(c.worldSolidStandingSupport(x,z,.23,2.1),2.1,'real support');
}
// The previous 8mm jump pre-offset could teleport the helmet through a
// ceiling with just 5mm clearance before its vertical sweep even started.
reset();box(5,1.955,5,6,1.975,6);a=p(5.5,5.5,0);c.game={p:a};c.input.jumpQueued=true;c.updateVertical(a,.016);ok(a.feetY<=.005&&a.vy===0,'solo jump cannot bypass 5mm clearance');
a=p(5.5,5.5,0);c.game=null;c.mpMatchMove(a,{...cmd,mz:0,j:true},1/30);ok(a.feetY<=.005&&a.vy===0,'PvP jump cannot bypass 5mm clearance');
reset();c.worldSolidBox([],5,2,5,6,2.01,6,[.4,.4,.4],0,[0,0,0,0,1,0]);ok(draws.length===1&&c.worldSolidStats().boxes===0,'flat decorative face is not invisible volume');
ok(!c.worldSolidBodyCollision(5.5,5.5,.23,1,1.95),'no phantom obstruction from paint');
for(const gl of [false,true]){
 reset(gl);c.game={nodes:[],devices:[{x:6.5,z:5.5}],mission:{type:'purge'}};
 ok(c.worldSolidBodyCollision(6.5,5.5,.23,1.20,1.95),'last 10cm of equipment solid in both renderers');
 ok(!c.worldSolidBodyCollision(6.5,5.5,.23,1.30,1.95),'equipment top free');
 near(c.worldSolidFeetBarrier(6.5,5.5,.23,1.5,1.0),1.30,'equipment swept landing');
}
console.log(`Stage110 exact low metal contacts: ${checks} PASS`);
