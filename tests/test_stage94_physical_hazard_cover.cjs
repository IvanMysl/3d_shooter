'use strict';
// Regresses three real hazards: arena thermo/EMP, coil, reactor explosion.
// On Stage93 the same steel partition does NOT prevent damage; Stage94 must
// obey ray-visible 3D geometry and suppress damage to raised targets.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=process.env.BASELINE_ROOT||path.resolve(__dirname,'..');
const src=name=>fs.readFileSync(path.join(ROOT,'src',name),'utf8');
const N=21,tiles=Array.from({length:N},()=>Array(N).fill(0));
let checks=0,damage=[],enemiesHit=[];
const check=(v,msg)=>{assert.ok(v,msg);checks++;};
const p={x:10,z:8,feetY:0,grounded:true,shield:0,hp:100,maxhp:100,energy:100,maxEnergy:100,armor:0};
const m={type:'purge',done:0,required:0,caches:[],hazardsHit:0,hazardsEvaded:0};
const g={state:'playing',sector:14,p,mission:m,arenaEvent:null,portalReady:false,
 nodes:[],nodesDestroyed:0,devices:[],enemies:[],score:0,spawned:0,target:5,kills:0,
 scorch:[],loot:[],impactFx:[],t:2.1};
const c={Math,Number,console,Array,Set,Map,Int8Array,Int16Array,Int32Array,Uint8Array,Float32Array,
 mapSize:N,mapCells:tiles,worldSolidGrid:[],heightCells:[],deckCells:[],worldSolidCount:0,glReady:true,
 touchOnly:false,mpMatch:null,game:g,save:{credits:0,settings:{quality:0}},
 floorHeight:()=>0,floorHeightAtCell:()=>0,deckAtCell:()=>0,ceilingHeight:()=>5,
 collide:()=>false,spawnX:5.5,spawnZ:8.5,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
 distance:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),hypot:Math.hypot,
 v3:(x,y,z)=>({x,y,z}),robotAccessoryVolumes:()=>[],
 sound:()=>{},burst:()=>{},saveRun:()=>{},toast:()=>{},
 damagePlayer:(amount)=>{damage.push(amount);p.hp-=amount;},
 hurtEnemy:(e,amount)=>{enemiesHit.push({e,amount});e.hp-=amount;},
 input:{jumpQueued:false},enemies:{}};
vm.createContext(c);
for(const name of ['04a-static-world-solids.js','14-combat-raycast.js','15-mission-system.js','16-mission-devices.js'])
 vm.runInContext(src(name),c,{filename:name});
const combat=src('17-weapon-combat.js');
let from=combat.indexOf('function enemyBlastSamples('),to=combat.indexOf('function shootPellet(',from);
check(from>=0&&to>from,'production 3D blast visibility functions found');
vm.runInContext(combat.slice(from,to),c,{filename:'17-weapon-combat.js samples'});
const barrier=(height=2.8)=>{c.resetWorldSolids();c.registerWorldSolid(9.10,.06,7.50,9.22,height,8.50,'steel-wall');};
const enemy=(x=10,z=8,feetY=0)=>({x,z,feetY,radius:.50,type:'scout',dead:false,stun:0,robotYaw:0,hp:300,maxhp:300});
const coil={x:8,z:8,kind:'coil',used:false,phase:0,cooldown:0,charge:0};
g.devices=[coil];
barrier();
check(c.worldSolidStats().boxes===1,'real WebGL steel barrier registered as physics');
check(c.missionCoilPulseExposure(coil,p)===0,'steel blocks all visible body samples from coil');
c.updateDevices(.10);
check(damage.length===0&&coil.cooldown===0,'coil MUST NOT damage through real full-height metal');
c.resetWorldSolids();
check(c.missionCoilPulseExposure(coil,p)===1,'open line reveals player to coil');
c.updateDevices(.10);
check(damage.length===1&&coil.cooldown>0,'uncovered player receives actual coil damage');
const fullDamage=damage[0];
check(fullDamage>5,'coil applies meaningful uncovered damage');
coil.cooldown=0;damage=[];p.hp=100;
barrier(.82);
const partial=c.missionCoilPulseExposure(coil,p);
check(partial>0&&partial<1,'low steel wall gives fractional exposure');
c.updateDevices(.1);
check(damage.length===1&&damage[0]<fullDamage,'low cover attenuates damage');
// The same physical wall must shield the arena's thermal AND EMP wave.
function resolveArena(kind){
 g.arenaEvent={phase:'warning',kind,x:8,z:8,r:3.4,warning:.01};
 c.updateMission(.10);
}
coil.used=true;g.devices=[];damage=[];p.hp=100;
barrier();
const beforeEvade=m.hazardsEvaded;
resolveArena('thermal');
check(!damage.length&&m.hazardsEvaded===beforeEvade+1,'thermal shock blocked by real wall');
c.resetWorldSolids();
resolveArena('thermal');
check(damage.length===1&&damage[0]>0,'uncovered thermal shock damages');
barrier();p.energy=100;p.shield=3;
resolveArena('emp');
check(p.energy===100&&p.shield===3,'solid wall shields against arena EMP');
c.resetWorldSolids();
resolveArena('emp');
check(p.energy<100&&p.shield===0,'uncovered arena EMP drains energy and shield');
// High platforms are separate spaces even with exactly the same XZ.
p.feetY=8;p.energy=100;p.shield=0;damage=[];
resolveArena('thermal');
check(damage.length===0,'elevated player is outside 3D ground-level hazard');
p.feetY=0;
// Source housing disappears when a reactor dies. Cover must still protect
// enemies and the player from its blast; and stop chain reactions through it.
const source={x:8,z:8,type:0,hp:20,maxhp:20,dead:false,radius:.61,phase:0};
const neighbor={x:10,z:8,type:0,hp:20,maxhp:20,dead:false,radius:.61,phase:0};
const e=enemy();g.enemies=[e];g.devices=[];g.nodes=[source,neighbor];g.nodesDestroyed=0;
barrier();damage=[];p.hp=100;enemiesHit=[];
c.damagePowerNode(source,100);
check(source.dead,'hit reactor physically destroyed');
check(!neighbor.dead,'steel divider blocks reactor-to-reactor chain reaction');
check(enemiesHit.length===0,'steel divider protects robot from reactor fire');
check(damage.length===0,'steel divider protects player from reactor blast');
c.resetWorldSolids();
source.dead=false;source.hp=20;neighbor.dead=false;neighbor.hp=20;e.hp=300;g.nodesDestroyed=0;
enemiesHit=[];damage=[];p.hp=100;
c.damagePowerNode(source,100);
check(neighbor.dead,'unobstructed secondary reactor receives physical chain reaction');
check(enemiesHit.some(q=>q.e===e),'open reactor blast damages nearby robot');
check(damage.some(q=>q>0),'open reactor blast damages nearby player');
// A drone on a high deck cannot be damaged based solely on 2D distance.
source.dead=false;source.hp=20;neighbor.dead=true;e.feetY=10;e.hp=300;enemiesHit=[];damage=[];p.feetY=10;g.nodesDestroyed=0;
c.damagePowerNode(source,100);
check(enemiesHit.length===0,'flying/raised robot beyond true 3D blast radius is safe');
check(damage.length===0,'raised player is safe from ground-floor reactor fire');
// Test the real mapCells fallback too, not just the registered WebGL mesh.
globals();
function globals(){
 c.glReady=false;c.resetWorldSolids();p.feetY=0;p.x=10;p.z=8;coil.used=false;coil.cooldown=0;
 g.devices=[coil];tiles[8][9]=1;damage=[];
 check(c.missionCoilPulseExposure(coil,p)===0,'Canvas map wall blocks coil');
 c.updateDevices(.1);
 check(damage.length===0,'Canvas avoids damage through actual wall cell');
 tiles[8][9]=0;
 check(c.missionCoilPulseExposure(coil,p)===1,'Canvas opened corridor permits coil');
}
console.log(`Stage94 solid-cover hazards: ${checks} PASS (coil, arena thermal/EMP, partial shelter, reactor AoE/chain, raised actors, Canvas/WebGL)`);
