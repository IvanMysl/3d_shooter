'use strict';
// Regression for real circular bridge-slab contacts in SOLO + multiplayer.
// Run against Canvas and against the same WebGL-registered physical deck.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.STAGE_SOURCE_ROOT||path.resolve(__dirname,'..');
const src=n=>fs.readFileSync(path.join(root,'src',n),'utf8');
const c={Math,Number,console,Float32Array,Int8Array,Int16Array,Int32Array,Uint8Array,Map,Set,
 mapSize:14,mapCells:Array.from({length:14},()=>Array(14).fill(0)),
 glReady:false,touchOnly:false,worldSolidGrid:[],worldSolidCount:0,
 game:null,mpMatch:null,sectorStyle:14,worldMapBoss:false,TAU:2*Math.PI,hypot:Math.hypot,
 clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),save:{settings:{audio:false,flightVertical:1}},
 sound:()=>{},burst:()=>{},toast:()=>{},input:{keys:{},jumpQueued:false,jumpHeld:false},
 arsenalOpened:false,box:()=>{},SPRINT_ENERGY_DRAIN:1.8,
 flightSpeedMultiplier:()=>1,normalizeFlightThrottle:()=>1,MP3_STEP:1/30,
 addEventListener:()=>{},useAbility:()=>{},toggleArsenal:()=>{},switchWeapon:()=>{}};
vm.createContext(c);
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js',
 '21d-multiplayer-movement.js','21g-multiplayer-flight-abilities.js'])
 vm.runInContext(src(n),c,{filename:n});
const ev=s=>vm.runInContext(s,c);
let checks=0;const check=(v,msg)=>{assert.ok(v,msg);checks++;};
const equal=(a,b,msg,tol=.008)=>check(Math.abs(a-b)<=tol,`${msg}: ${a} vs ${b}`);
function reset(gl=false){
 c.glReady=gl;c.game=null;
 ev('heightCells=new Float32Array(14*14);deckCells=new Float32Array(14*14);resetWorldSolids();');
 ev('deckCells[5*14+6]=2.2');
 if(gl)c.worldSolidBox([],6,2.03,5,7,2.2,6,[.5,.5,.5]);
}
function player(x,z,feet,vy=0,extra={}){
 return {x,z,feetY:feet,vy,grounded:false,flying:false,flightUnlocked:true,
  energy:100,walk:0, ...extra};
}
function solo(p,dt=.08){c.game={state:'playing',p,nodes:[],devices:[],mission:{type:'purge'}};
 c.updateVertical(p,dt);return p;}
const cmd={mx:0,mz:0,yaw:0,pitch:0,j:false,s:false,u:false,dn:false};
function multi(p,options={},dt=1/30){c.mpMatchMove(p,{...cmd,...options},dt);return p;}
const edgeX=5.84,edgeZ=5.5,freeX=5.70;
for(const gl of [false,true]){
 reset(gl);const mode=gl?'WebGL':'Canvas';
 check(c.worldDeckHeadBarrier(edgeX,edgeZ,.23,1.95,2.23)!==null,`${mode} edge head finds bridge`);
 equal(c.worldDeckHeadBarrier(edgeX,edgeZ,.23,1.95,2.23),2.03,`${mode} underside boundary`);
 equal(c.worldDeckFeetBarrier(edgeX,edgeZ,.23,2.33,1.92),2.2,`${mode} landing top`);
 check(c.worldDeckStandingSupport(edgeX,edgeZ,.23,2.204)!==null,`${mode} edge supports boots`);
 check(c.worldDeckHeadBarrier(freeX,edgeZ,.23,1.95,2.23)===null,`${mode} no invisible slab in open air`);
 check(c.worldDeckFeetBarrier(freeX,edgeZ,.23,2.33,1.92)===null,`${mode} no phantom edge platform`);
 check(c.worldDeckStandingSupport(freeX,edgeZ,.23,2.2)===null,`${mode} no phantom grounded support`);
 check(c.worldDeckHeadBarrier(5.86,4.86,.23,1.95,2.23)!==null,`${mode} real circular corner overlap`);
 check(c.worldDeckHeadBarrier(5.83,4.83,.23,1.95,2.23)===null,`${mode} no square-corner barrier`);
 check(!c.worldDeckBodyCollision(6.5,5.5,.23,0,1.95),`${mode} genuine underpass remains accessible`);
 check(c.worldDeckBodyCollision(6.5,5.5,.23,.25,1.95),`${mode} physical slab volume obstructs head`);
 check(!c.worldDeckBodyCollision(6.5,5.5,.23,2.2,1.95),`${mode} standing above slab is legal`);
 // The old code checked only floor tile (5,5) and missed these contacts.
 let p=solo(player(edgeX,edgeZ,0,5));equal(p.feetY,.076,`${mode} solo upward jump stops at edge underside`);
 check(p.vy===0,`${mode} solo jump cancels upward velocity`);
 p=solo(player(edgeX,edgeZ,2.32,-5));equal(p.feetY,2.204,`${mode} solo fall lands on edge`);
 check(p.grounded,`${mode} solo fall reports grounded`);
 solo(p,.02);equal(p.feetY,2.2,`${mode} edge standing remains supported next frame`);
 check(p.grounded,`${mode} edge jump is available next frame`);
 p=solo(player(edgeX,edgeZ,0,0,{flying:true}),.08);equal(p.feetY,0,`${mode} neutral flight stays put`);
 c.input.flyUp=true;solo(p,.09);c.input.flyUp=false;
 equal(p.feetY,.076,`${mode} solo flying helmet blocked at slab edge`);
 p=player(edgeX,edgeZ,2.30,0,{flying:true});c.input.flyDown=true;solo(p,.10);c.input.flyDown=false;
 equal(p.feetY,2.204,`${mode} solo flying feet land on edge`);
 // MP host/client prediction uses the same deterministic vertical contacts.
 p=multi(player(edgeX,edgeZ,0,18));equal(p.feetY,.076,`${mode} multiplayer jump ceiling`);
 p=multi(player(edgeX,edgeZ,2.32,-15));equal(p.feetY,2.204,`${mode} multiplayer falling boots`);
 check(p.grounded,`${mode} multiplayer edge landing grounded`);
 multi(p);equal(p.feetY,2.2,`${mode} multiplayer edge support stable`);
 p=multi(player(edgeX,edgeZ,0,0,{flying:true}),{u:true});
 equal(p.feetY,.076,`${mode} multiplayer flight rising blocked`);
 p=multi(player(edgeX,edgeZ,2.28,0,{flying:true}),{dn:true});
 equal(p.feetY,2.204,`${mode} multiplayer flight descending lands`);
 p=solo(player(freeX,edgeZ,0,5));
 check(p.feetY>.15,`${mode} real space beyond slab stays open above helmet`);
 p=solo(player(freeX,edgeZ,2.32,-5));
 check(p.feetY<2.0&&!p.grounded,`${mode} unsupported edge fall is real gravity`);
}
console.log(`Stage107 real bridge edges: ${checks} PASS / Canvas+WebGL / solo+MP / gravity+flight / support+corners`);
