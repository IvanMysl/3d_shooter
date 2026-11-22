'use strict';
// Stage114: vertical contacts and removal of dead blockers.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.STAGE_SOURCE_ROOT||path.resolve(__dirname,'..');
const src=n=>fs.readFileSync(path.join(root,'src',n),'utf8');
const N=15;let checks=0,draw=[];
const check=(v,label)=>{assert.ok(v,label);checks++;};
const c={Math,Number,console,Set,Map,Float32Array,Int8Array,Int16Array,Int32Array,Uint8Array,
 touchOnly:false,mapSize:N,mapCells:Array.from({length:N},()=>Array(N).fill(0)),glReady:true,
 worldSolidGrid:[],worldSolidCount:0,game:null,mpMatch:null,sectorStyle:14,worldMapBoss:false,SPRINT_ENERGY_DRAIN:1.8,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
 save:{settings:{audio:false}},sound:()=>{},toast:()=>{},burst:()=>{},box:(...a)=>draw.push(a),
 flightSpeedMultiplier:()=>1,normalizeFlightThrottle:()=>1,input:{},addEventListener:()=>{},useAbility:()=>{},toggleArsenal:()=>{},switchWeapon:()=>{},arsenalOpened:false,navField:null,navClock:0};
vm.createContext(c);
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js',
 '13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js','14-combat-raycast.js','15-mission-system.js','21d-multiplayer-movement.js','21g-multiplayer-flight-abilities.js','18-ai-and-abilities.js'])
 vm.runInContext(src(n),c,{filename:n});
const ev=s=>vm.runInContext(s,c);
function reset(){
 c.mapCells=Array.from({length:N},()=>Array(N).fill(0));
 ev(`heightCells=new Float32Array(${N*N});deckCells=new Float32Array(${N*N});
   resetWorldSolids();enemyNavMask=null;navField=null;
   if(typeof groundChassisRevision!=='undefined'){
     groundChassisRevision=null;groundChassisCache.clear();
   }`);
 c.game={nodes:[],devices:[],nodesDestroyed:0,mission:{type:'purge'},enemies:[],
  p:{x:10.5,z:5.5,feetY:0},t:0};draw=[];
}
const scout=(x=4.5,z=5.5)=>({id:1,x,z,feetY:0,type:'scout',radius:.48,airborne:false});
const brute=(x=4.5,z=5.5)=>({id:2,x,z,feetY:0,type:'brute',radius:1.1,airborne:false});
const boss=(x=4.5,z=5.5)=>({id:3,x,z,feetY:0,type:'boss',radius:1.2,boss:true,airborne:false});
const index=(x,z)=>z*N+x;

const steel=(...b)=>c.worldSolidBox([], ...b,[1,1,1]);
// An approaching head must stop at the lower face of a living robot.
reset();let p={x:5.5,z:5.5,feetY:0,grounded:false,vy:0,flying:true,flightUnlocked:true,energy:100};
let b={...scout(5.5,5.5),feetY:2.2,maxhp:100,hp:100};c.game.p=p;c.game.enemies=[b];c.input.flyUp=true;
c.updateVertical(p,.5);check(Math.abs(p.feetY-(2.2-1.95-.004))<1e-7,'solo flight stops below live robot');
c.updateVertical(p,.5);check(p.feetY<=2.2-1.95,'repeated ascent remains blocked');
b.dead=true;c.updateVertical(p,.2);check(p.feetY>.5,'dead robot cannot impede flight');
// Descending onto a live actor must stop at its top and release on removal.
reset();p={...p,feetY:4,grounded:false,flying:false,vy:-10};b={...scout(5.5,5.5),hp:100,maxhp:100};c.game.p=p;c.game.enemies=[b];c.input.flyUp=false;
const top=c.enemyBodyHeight(b)+.004;c.updateVertical(p,.4);check(Math.abs(p.feetY-top)<1e-7&&p.grounded,'gravity lands on live actor');
c.updateVertical(p,.1);check(Math.abs(p.feetY-top)<1e-7,'support does not drop through living actor');
b.dead=true;c.updateVertical(p,.1);check(p.feetY<top,'dead support disappears');
// PvP has the same vertical contacts even when horizontal input is zero.
reset();p={...p,feetY:0,grounded:false,flying:true,vy:0,energy:100};const o={x:p.x,z:p.z,feetY:2.0,hp:100};
const cmd={mx:0,mz:0,yaw:0,pitch:0,s:false,j:false,u:true,dn:false};
for(let i=0;i<10;i++)c.mpMatchMove(p,cmd,1/30,[o]);check(Math.abs(p.feetY-.046)<1e-7,'PvP flight stops below opponent');
o.hp=0;for(let i=0;i<10;i++)c.mpMatchMove(p,cmd,1/30,[o]);check(p.feetY>.5,'dead PvP opponent is not a barrier');
// Vertical robot AI, not just the helper, must stop beneath a living player.
reset();let e={...scout(5.5,5.5),type:'skyhunter',radius:.48,feetY:.13,maxhp:100,hp:100,airborne:true,stun:1,airLiftBlocked:0};
const H=c.enemyBodyHeight(e);c.game.p={x:e.x,z:e.z,feetY:H+.4};c.game.enemies=[e];
c.updateFlyingRobot(e,c.game.p,.5);check(Math.abs(e.feetY-.396)<1e-7,'airborne NPC stops beneath player');
// Exact intervals: compare repeated random sweeps to independent endpoint bounds.
let seed=51;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
for(let i=0;i<1000;i++){
 const feet=2+rand()*4,height=.5+rand()*2,r=.2+rand(),h=.7+rand()*2;
 const blocker={x:0,z:0,feet,height:h,radius:r},offset=(rand()*2-1)*r*1.1;
 const up=i%2===0,from=up?feet-height-.1-rand():feet+h+.1+rand(),to=up?feet+h+1:feet-height-1;
 const result=c.worldActorVerticalLimit(offset,0,from,to,height,[blocker]);
 const expected=offset*offset>=r*r-1e-9?to:up?feet-height-.004:feet+h+.004;
 check(Math.abs(result-expected)<1e-8,'independent vertical contact '+i);
}
// Exact spawn boundaries use the same vertical body dimensions as movement.
reset();c.game.p={x:5.5,z:5.5,feetY:2.2};
check(!c.enemySpawnSpaceClear(5.5,5.5,.48,2.25,0,.26),'spawn cannot intersect bottom of elevated player');
check(c.enemySpawnSpaceClear(5.5,5.5,.48,2.19,0,.26),'valid vertical gap remains clear');
console.log(`Stage114 vertical living bodies: ${checks} PASS`);
