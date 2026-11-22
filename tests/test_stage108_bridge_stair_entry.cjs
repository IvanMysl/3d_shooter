'use strict';
// Stage108: A .23m circular body touches a suspended bridge BEFORE its centre
// enters the bridge tile. A genuine <=.245m stair-to-bridge step must work in
// both directions; an unreachable deck must remain solid, and the underpass
// must remain open. This test deliberately FAILS on the unmodified Stage107.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.STAGE_SOURCE_ROOT||path.resolve(__dirname,'..');
const src=n=>fs.readFileSync(path.join(root,'src',n),'utf8');
const c={Math,Number,console,Float32Array,Int8Array,Int16Array,Int32Array,Uint8Array,Map,Set,
 mapSize:14,mapCells:Array.from({length:14},()=>Array(14).fill(0)),
 glReady:false,touchOnly:false,worldSolidGrid:[],worldSolidCount:0,
 game:null,mpMatch:null,sectorStyle:14,worldMapBoss:false,TAU:2*Math.PI,hypot:Math.hypot,
 clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),save:{settings:{audio:false,flightVertical:1}},
 sound:()=>{},burst:()=>{},toast:()=>{},input:{keys:{},jumpQueued:false,jumpHeld:false},
 arsenalOpened:false,box:()=>{},SPRINT_ENERGY_DRAIN:1.8,enemyBodyHeight:()=>1.68,
 enemyCrowdAllows:()=>true,flightSpeedMultiplier:()=>1,normalizeFlightThrottle:()=>1,
 MP3_STEP:1/30,MP6_FLIGHT_VERTICAL:4.4,MP6_FLIGHT_HORIZONTAL:4.4,
 mpCombatEmit:()=>{},addEventListener:()=>{},useAbility:()=>{},toggleArsenal:()=>{},switchWeapon:()=>{}};
vm.createContext(c);
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js',
 '21d-multiplayer-movement.js','21g-multiplayer-flight-abilities.js'])vm.runInContext(src(n),c,{filename:n});
const ev=s=>vm.runInContext(s,c);
let checks=0;const check=(pass,msg)=>{assert.ok(pass,msg);checks++;};
const near=(got,want,msg,tol=.006)=>check(Math.abs(got-want)<tol,`${msg}: ${got} != ${want}`);
function reset(gl=false,axis='x',difference=.22){
 c.glReady=gl;c.game=null;c.mpMatch=null;
 ev('heightCells=new Float32Array(14*14);deckCells=new Float32Array(14*14);resetWorldSolids();');
 const base=1.98,top=base+difference;
 // Two real adjacent tiles: final solid stair at (5,5), bridge at (6,5)
 // (or the rotated configuration at (5,6)). No invented side volume.
 ev('heightCells[5*14+5]=1.98');
 if(axis==='x')ev(`deckCells[5*14+6]=${top}`);
 else ev(`deckCells[6*14+5]=${top}`);
 if(gl){
  if(axis==='x')c.worldSolidBox([],6,top-.17,5,7,top,6,[.5,.5,.5]);
  else c.worldSolidBox([],5,top-.17,6,6,top,7,[.5,.5,.5]);
 }
 return top;
}
function player(x=5.5,z=5.5,feet=1.98,extra={}){
 return {x,z,feetY:feet,vy:0,grounded:true,flying:false,energy:100,walk:0,...extra};
}
const cmd={mx:0,mz:1,yaw:Math.PI/2,pitch:0,j:false,s:false,u:false,dn:false};
for(const gl of [false,true])for(const axis of ['x','z']){
 const mode=(gl?'WebGL':'Canvas')+' '+axis;
 const top=reset(gl,axis);
 const px=axis==='x'?5.8:5.5,pz=axis==='z'?5.8:5.5;
 near(c.worldDeckStepSupport(px,pz,.23,1.98),top,mode+' walk-up face');
 check(c.worldDeckStepSupport(5.7,5.5,.23,1.98)===null||axis==='z',mode+' no phantom slab at outer x');
 check(c.worldDeckStepSupport(axis==='x'?5.83:4.83,axis==='x'?4.83:5.83,.23,1.98)===null,
  mode+' no invented square-corner collision');
 const p=player();c.game={p};
 c.tryMoveEntity(p,axis==='x'?.9:0,axis==='z'?.9:0,.23);
 near(axis==='x'?p.x:p.z,6.4,mode+' SOLO climbs bridge instead of freezing');
 near(p.feetY,top,mode+' SOLO feet rise at actual circle contact');
 c.tryMoveEntity(p,axis==='x'?-.9:0,axis==='z'?-.9:0,.23);
 near(axis==='x'?p.x:p.z,5.5,mode+' SOLO can leave bridge');
 near(p.feetY,1.98,mode+' SOLO keeps support until circle clears deck');
 const e={...player(),maxhp:100,type:'scout',airborne:false};c.game={p:player()};
 c.tryMoveEntity(e,axis==='x'?.9:0,axis==='z'?.9:0,.23);
 near(axis==='x'?e.x:e.z,6.4,mode+' ground robot climbs');
 near(e.feetY,top,mode+' ground robot feet on plate');
 c.tryMoveEntity(e,axis==='x'?-.9:0,axis==='z'?-.9:0,.23);
 near(axis==='x'?e.x:e.z,5.5,mode+' ground robot descends');
 near(e.feetY,1.98,mode+' ground robot does not phase into plate');
 let m=player();for(let i=0;i<9;i++)c.mpMatchMove(m,{...cmd,yaw:axis==='x'?Math.PI/2:0},1/30);
 check((axis==='x'?m.x:m.z)>6.3,mode+' PvP climbs bridge');
 near(m.feetY,top,mode+' PvP foot support up');
 for(let i=0;i<9;i++)c.mpMatchMove(m,{...cmd,mz:-1,yaw:axis==='x'?Math.PI/2:0},1/30);
 check((axis==='x'?m.x:m.z)<5.7,mode+' PvP descends bridge');
 near(m.feetY,1.98,mode+' PvP support down');
 const high=reset(gl,axis,.32),blocked=player();c.game={p:blocked};
 c.tryMoveEntity(blocked,axis==='x'?.9:0,axis==='z'?.9:0,.23);
 check((axis==='x'?blocked.x:blocked.z)<5.78,mode+' high bridge remains impassable');
 near(blocked.feetY,1.98,mode+' high bridge cannot boost player');
 check(c.worldDeckStepSupport(px,pz,.23,1.98)===null,mode+' step height threshold is strict');
 // A suspended 2.20m plate is 0.17m thick, with 2.03m real clearance.
 reset(gl,axis);
 near(c.worldDeckStepSupport(px,pz,.23,0)??0,0,mode+' zero lift from underpass');
 check(!c.worldDeckBodyCollision(axis==='x'?6.5:5.5,axis==='z'?6.5:5.5,.23,0,1.95),
  mode+' actual clearance under high deck');
}
console.log(`Stage108 bridge-stair transitions: ${checks} PASS / solo + robots + multiplayer / Canvas + WebGL / two axes`);
