'use strict';
// Stage99: bonus holograms may be non-solid, but collect / placement must be
// limited by the SAME walls, equipment AABBs and elevated decks as the game.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
const N=24,tiles=Array.from({length:N},(_,z)=>Array.from({length:N},(_,x)=>+(x===0||z===0||x===N-1||z===N-1)));
const deck=new Float32Array(N*N);let checks=0,backendTests=0;
const ok=(a,m)=>{assert.ok(a,m);checks++;};
const floor=(x,z)=>0;
const p={x:6.5,z:8.5,feetY:0,grounded:true,hp:60,maxhp:100,energy:30,maxEnergy:100,
 armor:20,maxArmor:100,bodyArmor:0,bodyArmorMax:100,magnet:1};
const game={sector:9,state:'playing',p,nodes:[],devices:[],mission:{type:'purge',caches:[]},
 loot:[],bullets:[],particles:[],tracers:[],scorch:[],nodesDestroyed:0,totalCredits:0};
const c={console,Math,Number,Set,Map,Array,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 mapSize:N,mapCells:tiles,deckCells:deck,game,mpMatch:null,worldSolidGrid:[],worldSolidCount:0,
 glReady:false,touchOnly:false,save:{credits:0,settings:{quality:0}},
 ceilingHeight:()=>5.5,floorHeight:floor,floorHeightAtCell:()=>0,
 deckAtCell:(x,z)=>deck[z*N+x]||0,
 supportHeight:(a,x,z)=>{const y=deck[Math.floor(z)*N+Math.floor(x)]||0;return y&&(a?.feetY||0)>=y-.28?y:0;},
 collide:(x,z,r)=>{
  for(let iz=Math.floor(z-r);iz<=Math.floor(z+r);iz++)
   for(let ix=Math.floor(x-r);ix<=Math.floor(x+r);ix++)if(tiles[iz]?.[ix]===1)return true;
  return false;
 },sound:()=>{},toast:()=>{},damagePlayer:()=>{},burst:()=>{},
 v3:(x,y,z)=>({x,y,z}),clamp:(v,lo,hi)=>Math.max(lo,Math.min(hi,v)),
 distance:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),TAU:Math.PI*2};
vm.createContext(c);
vm.runInContext(src('04a-static-world-solids.js'),c,{filename:'04a-static-world-solids.js'});
const ray=src('14-combat-raycast.js');
vm.runInContext(ray.slice(ray.indexOf('function rayAABB('),ray.indexOf('function rayEnemy(')),c,{filename:'14 rayWall'});
const sharedFx=src('13-enemy-navigation-spawn.js');
vm.runInContext(sharedFx.slice(sharedFx.indexOf('function advanceSharedWorldFx(')),c);
const ability=src('18-ai-and-abilities.js');
vm.runInContext(ability.slice(ability.indexOf('function updateBullets(')),c,{filename:'18 updateBullets'});
const coin=(x,z,feetY)=>({x,z,type:'credits',life:20,...(feetY===undefined?{}:{feetY})});
const pickup=()=>{game.loot=[coin(8.10,8.5)];c.updateBullets(.1);return game.loot.length===0;};
for(const gl of [false,true]){
 game.totalCredits=0;c.save.credits=0;
 c.glReady=gl;c.resetWorldSolids();tiles[8][7]=1;
 ok(!pickup(),`pickup through map wall (${gl})`);
 ok(game.totalCredits===0,`blocked bonus still granted (${gl})`);
 tiles[8][7]=0;
 ok(pickup(),`clear corridor bonus was not collected (${gl})`);
 ok(game.totalCredits>0,`unblocked credit missing (${gl})`);
 game.totalCredits=0;c.save.credits=0;
 // A real metal station has a visible .72m-wide base, not the old .68m box.
 game.devices=[{id:1,kind:'battery',x:7.4,z:8.5,used:false}];
 ok(c.worldSolidBodyCollision(7.756,8.5,.01,0,1.0),`visual .36 station rim nonphysical (${gl})`);
 ok(!pickup(),`loot magnet tunnels through equipment housing (${gl})`);
 game.devices[0].used=true;
 ok(!pickup(),`used-but-still-rendered station lost solidity (${gl})`);
 game.devices=[];
 c.resetWorldSolids();
 // A thin real WebGL rail blocks LOS, not merely full map walls.
 if(gl){c.registerWorldSolid(7.00,.04,8.2,7.06,1.4,8.8,'railing');
  ok(!pickup(),'pickup through a 6cm mesh-registered steel rail');c.resetWorldSolids();}
 ok(pickup(),`steel removed but loot cannot be reached (${gl})`);
 backendTests++;
}
// Two physical storeys: the XZ projection can be inches apart even though
// the item rests ON a 2.20m plate, not on the player's ground floor.
const pos=8*N+8;deck[pos]=2.2;
p.x=8.22;p.z=8.5;p.feetY=0;p.magnet=4;
const raised=coin(8.52,8.5,2.2);
ok(!c.worldLootPickupClear(p,raised),'vacuuming loot through actual deck from underneath');
p.feetY=2.2;
ok(c.worldLootPickupClear(p,raised),'player on same deck cannot collect reachable loot');
p.feetY=0;p.magnet=1;
// Bonus generators must preserve deck altitude, not make a raised enemy's
// visible drop jump to the ground when the enemy dies on the balcony.
let spawned=c.worldLootSpawn({x:8.52,z:8.5,feetY:2.2},'heal',16);
ok(!!spawned&&Math.abs(spawned.feetY-2.2)<1e-5,'roof drop lost its physical floor level');
spawned=c.worldLootSpawn({x:8.52,z:8.5,feetY:6.0,airborne:true},'energy',16);
ok(!!spawned&&spawned.feetY===0,'flying enemy loot should fall to ground, not hover in air');
deck[pos]=0;
// Avoid spawning resources inside the visible steel machinery. Check the
// saved world coordinate itself rather than only a convenient neighbour.
game.devices=[{id:7,kind:'repair',x:10.5,z:10.5,used:false}];
const drop=c.worldLootSpawn({x:10.5,z:11.18,feetY:0},'plates',23,0,-.60);
ok(!drop||!c.worldSolidBodyCollision(drop.x,drop.z,.13,drop.feetY+.1,.72),
 'generated pickup physically overlaps a visible steel device');
ok(!drop||!c.collide(drop.x,drop.z,.17),'spawned pickup intersects a solid wall');
// An unobstructed source spawns loot and remains reachable to the operator.
game.devices=[];
const source={x:6.5,z:8.5,feetY:0};
const valid=c.worldLootSpawn(source,'heal',16,.21,.1);
ok(!!valid,'safe open space fails to spawn loot');
ok(c.worldLootPickupClear({...p,x:valid.x,z:valid.z,feetY:0,magnet:.1},valid),
 'source and loot on the same floor should have a valid physical ray');
// Legacy saves (no feetY in loot) continue to work without migration.
ok(c.worldLootPickupClear({x:6.5,z:8.5,feetY:0,magnet:2},coin(6.55,8.5)),
 'legacy bonus without feetY no longer collectible');
console.log(`Stage99 loot physics: ${checks} PASS / ${backendTests} render backends / 3D deck / metal hull / safe drops`);
