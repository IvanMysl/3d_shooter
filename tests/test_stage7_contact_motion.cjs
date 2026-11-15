// Stage 7: check collision along the WHOLE movement and embedded impacts.
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const base=path.join(__dirname,'../src');
const read=n=>fs.readFileSync(path.join(base,n),'utf8');
const grid=Array.from({length:14},()=>Array(14).fill(0));
const p={x:2.5,z:3.5,feetY:0},game={p};
const env={Math,Number,Array,Map,Float32Array,console,game,mapSize:14,mapCells:grid,
 sectorStyle:0,mapRooms:[],floorHeightAtCell:()=>0,deckAtCell:()=>0,
 glReady:true,worldSolidBodyCollision:()=>false,
 sound:()=>{},save:{settings:{audio:false}},input:{jumpQueued:false}};
vm.createContext(env);vm.runInContext(read('03-height-and-collision.js'),env);
let tests=0;
function check(val,message){assert.ok(val,message);tests++;}
// More than one cell in one frame: never emerge on the other side of solid tile.
grid[3][5]=1; env.tryMoveEntity(p,5,0,.23);
check(p.x>=4.5&&p.x<4.78,`tunneled through wall: ${p.x}`);
grid[3][5]=0;p.x=2.5;
// A thin rail is smaller than the frame movement, yet the player's radius is not.
env.worldSolidBodyCollision=(x,z,r)=>x+r>3.56&&x-r<3.64&&z>3&&z<4;
env.tryMoveEntity(p,2.8,0,.23);
check(p.x<3.34,`tunneled through an actual thin rail: ${p.x}`);
// A wall should still allow X/Z sliding instead of freezing the whole diagonal.
p.x=3.1;p.z=3.5;const startZ=p.z;
env.worldSolidBodyCollision=(x,z,r)=>x+r>3.56&&x-r<3.64&&z>2.9&&z<5.3;
env.tryMoveEntity(p,.9,1.15,.23);
check(p.x<3.34&&p.z>startZ+.7,`lost sliding: (${p.x}, ${p.z})`);
// Very small normal frame movements remain unchanged.
env.worldSolidBodyCollision=()=>false;p.x=2.2;p.z=2.2;
env.tryMoveEntity(p,.04,-.06,.23);
check(Math.abs(p.x-2.24)<1e-8&&Math.abs(p.z-2.14)<1e-8,'ordinary steps changed');
// Finite input guard prevents NaN corrupting checkpoints/physics state.
const stableX=p.x,stableZ=p.z;env.tryMoveEntity(p,NaN,1,.23);
check(p.x===stableX&&p.z===stableZ,'invalid movement mutated player');
// Enemies should still be able to walk up multiple regular 0.215m steps.
const mob={x:2.5,z:6.5,feetY:0};
env.floorHeightAtCell=(x,z)=>x>=3&&x<4?.215:x>=4&&x<5?.43:0;
env.tryMoveEntity(mob,2.0,0,.23);
check(mob.x>4.25&&Math.abs(mob.feetY-.43)<1e-8,`enemy failed to climb normal stairs: ${JSON.stringify(mob)}`);
// Embedded projectile, especially under the surface of a stair, must explode
// at the nearest real face, not two metres away at a side-wall.
const ray=read('14-combat-raycast.js');
const primitives=ray.slice(ray.indexOf('function rayAABB('),ray.indexOf('function rayWall('));
const geometry={Math,Number,Map,Set,console,v3:(x,y,z)=>({x,y,z})};
vm.createContext(geometry);vm.runInContext(primitives,geometry);
const b=[5,-100,5,6,.34,6];
let hit=geometry.sweptSphereAABB({x:5.5,y:.32,z:5.5},{x:1,y:0,z:0},3,b,.18);
check(hit&&hit.t===0&&hit.y===.34&&hit.ny===1,`embedded shell missed stair surface: ${JSON.stringify(hit)}`);
hit=geometry.sweptSphereAABB({x:5.3,y:1,z:5.5},{x:1,y:0,z:0},3,[5,0,5,6,2,6],.13);
check(hit?.t===0&&Math.abs(hit.x-5)<1e-8,'embedded narrow wall contact not on near face');
hit=geometry.sweptSphereAABB({x:4,y:.31,z:5.5},{x:1,y:0,z:0},3,b,.18);
check(hit&&hit.t>0&&hit.x===5,'outside direct shot should still hit the box face');
// Use the actual rayWall routine to protect energy and hitscan impacts too.
const worldSource=ray.slice(ray.indexOf('function rayWall('),ray.indexOf('function rayEllipsoid('));
Object.assign(geometry,{mapSize:14,mapCells:grid,glReady:false,
 ceilingHeight:()=>4.25,deckAtCell:()=>0,floorHeightAtCell:()=>.34});
vm.runInContext(worldSource,geometry);
hit=geometry.rayWall({x:5.5,y:.32,z:5.5},{x:1,y:0,z:0},2);
check(hit?.kind==='floor'||hit?.kind==='stairs','embedded ray not detected');
check(Math.abs(hit.y-.34)<1e-8&&hit.ny===1,'hitscan impact stuck inside step');
hit=geometry.sweepWorldSphere({x:5.5,y:.32,z:5.5},{x:1,y:0,z:0},2,.18);
check(hit?.t===0&&Math.abs(hit.y-.34)<1e-8&&hit.ny===1,
 'full world-sweep impact from inside a stair must be on its top');
console.log(`STAGE7 CONTACT/MOTION: ${tests} deterministic tests passed`);
