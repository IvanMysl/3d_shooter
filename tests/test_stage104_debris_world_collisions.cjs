'use strict';
// Real production swept 3D collider + real production robot-debris movement.
// On Stage103, shard motion crosses map walls, thin WebGL steel and Canvas
// equipment, falls through raised bridges and goes through overhead beams.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=process.env.BASELINE_ROOT||path.resolve(__dirname,'..');
const src=n=>fs.readFileSync(path.resolve(base,'src',n),'utf8');
const N=20,tiles=Array.from({length:N},(_,z)=>Array.from({length:N},(_,x)=>+(x===0||z===0||x===N-1||z===N-1)));
const decks=new Float32Array(N*N);let tests=0;
const ok=(v,message)=>{assert.ok(v,message);tests++;};
const game={robotDebris:[],nodes:[],devices:[],mission:{type:'purge'},nodesDestroyed:0};
const c={Math,Number,Set,Map,Array,Int8Array,Int16Array,Int32Array,Float32Array,console,
 mapSize:N,mapCells:tiles,deckCells:decks,game,glReady:true,mpMatch:null,
 box:()=>{},ceilingHeight:()=>5.0,floorHeightAtCell:()=>0,
 floorHeight:()=>0,deckAtCell:(x,z)=>decks[z*N+x]||0,
 isWall:(x,z)=>tiles[Math.floor(z)]?.[Math.floor(x)]===1,
};
vm.createContext(c);
vm.runInContext(src('04a-static-world-solids.js'),c);
const combat=src('14-combat-raycast.js');
vm.runInContext(combat.slice(combat.indexOf('function rayAABB('),combat.indexOf('function rayEnemy(')),c);
const npc=src('13-enemy-navigation-spawn.js');
vm.runInContext(npc.slice(npc.indexOf('function updateRobotDebris('),npc.indexOf('\nfunction awardKill(')),c);
const shard=(options={})=>({x:5.5,y:1.1,z:5.5,vx:0,vy:0,vz:0,size:.16,
 life:3.0,ttl:3.0,rested:false,bounces:0,rx:0,rz:0,spin:2,...options});
function reset(){tiles.forEach((r,z)=>r.forEach((_,x)=>r[x]=+(x===0||z===0||x===N-1||z===N-1)));decks.fill(0);
 game.robotDebris=[];game.nodes=[];game.devices=[];c.glReady=true;c.resetWorldSolids();}
function step(s,dt){game.robotDebris=[s];c.updateRobotDebris(dt);ok(game.robotDebris.length===1,'visible fragment prematurely vanished');}
reset();
// Thin REAL WebGL mesh rail: one large frame step crosses both faces.
c.worldSolidBox([],6.45,.1,5.05,6.47,2.5,5.95,[.7,.7,.8]);
let s=shard({x:5.5,vx:15});step(s,.12);
ok(s.x<6.45-.03,'fast visible shard tunneled through 2cm steel rail');
ok(s.vx<=0,'steel rail must reflect moving shard');
ok(c.worldSolidStats().boxes===1,'steel beam exists as matching visible/physical AABB');
// A map wall is real in both WebGL and fallback.
reset();tiles[5][6]=1;s=shard({x:5.5,vx:17});step(s,.12);
ok(s.x<6,'shard must not teleport through 1m stone wall');
reset();c.glReady=false;tiles[5][6]=1;s=shard({x:5.5,vx:17});step(s,.12);
ok(s.x<6,'Canvas shard must not pass through visible map wall');
// Equipment AABBs are real even in Canvas: do not rely on glReady.
reset();c.glReady=false;game.devices=[{x:6.5,z:5.5,kind:'battery',used:false}];
s=shard({x:5.5,vx:12});step(s,.12);
ok(s.x<6.14,'Canvas rendered station is a solid 3D collision target');
ok(s.vx<=0,'station reflects debris rather than passing through');
// Destroying a reactor removes its metal collider, not leaving a ghost wall.
reset();c.glReady=false;game.nodes=[{x:6.5,z:5.5,dead:false}];
s=shard({x:5.5,vx:12});step(s,.12);
ok(s.x<6.13,'live reactor casing must stop debris');
game.nodes[0].dead=true;s=shard({x:5.5,vx:12});step(s,.12);
ok(s.x>6.35,'dead reactor must not become an invisible obstacle');
// The actual rendered deck is only .17m thick at 2.03..2.20.
reset();decks[5*N+5]=2.2;
s=shard({x:5.5,y:2.7,z:5.5,vy:-7});step(s,.12);
ok(s.y>=2.2,'falling shard must land ON the raised 3D deck');
ok(s.vy>=0,'deck floor contact redirects downwards velocity');
// Upward shards cannot pass through the lower face of the same bridge.
s=shard({x:5.5,y:1.67,z:5.5,vy:10});step(s,.10);
ok(s.y<2.03,'ceiling underside of deck is solid');
ok(s.vy<=0,'hitting a bridge underside reverses upward motion');
// Shards must bounce on a metal roof (instead of falling through it).
reset();c.worldSolidBox([],5.1,2.0,5.1,5.9,2.10,5.9,[.6,.6,.6]);
s=shard({x:5.5,y:2.85,z:5.5,vy:-9});step(s,.10);
ok(s.y>2.1,'real overhead steel plate is a physical landing surface');
// Wall collision must never cause NaN/Infinity or persistent embedding.
reset();tiles[5][6]=1;s=shard({x:5.5,y:1,z:5.5,vx:25});
for(let k=0;k<12;k++){step(s,.04);ok([s.x,s.y,s.z,s.vx,s.vy,s.vz].every(Number.isFinite),'stable repeated contacts');}
ok(s.x<6,'repeated collision does not tunnel across wall');
// Rested fragments are immobile and still fade away at the same old TTL.
const fixed=shard({rested:true,x:4.5,y:.07,vx:0,vy:0,vz:0,life:.03});
game.robotDebris=[fixed];c.updateRobotDebris(.04);
ok(game.robotDebris.length===0,'expired shard cleaned up correctly');
console.log(`Stage104 physical robot-debris collision: ${tests} PASS`);
