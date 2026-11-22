'use strict';
// V79: make the contact shape of a character match its actual circular body.
// Old square-corner collision invented an invisible diagonal barrier beside
// visible wall corners; the new exact test must not open real wall passages.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/03-height-and-collision.js'),'utf8');
const size=20,cells=Array.from({length:size},()=>Array(size).fill(0));
for(let k=0;k<size;k++)cells[0][k]=cells[size-1][k]=cells[k][0]=cells[k][size-1]=1;
cells[5][5]=1;
const c={Math,Number,mapSize:size,mapCells:cells,game:null,PLAYER_SOLID_HEIGHT:1.92,
 supportHeight:()=>0,floorHeight:()=>0,floorHeightAtCell:()=>0,deckAtCell:()=>0,heightCells:[],worldSolidStandingSupport:()=>null,worldSolidBodyCollision:()=>false,worldDeckStepSupport:()=>null,worldDeckStandingSupport:()=>null,enemyBodyHeight:()=>1.68};
vm.createContext(c);
vm.runInContext(source.slice(source.indexOf('function worldTerrainFootprint('),source.indexOf('function makeStairHeights(')),c);
vm.runInContext(source.slice(source.indexOf('function tryMoveEntity('),source.indexOf('function queueJump(')),c);
vm.runInContext(source.slice(source.indexOf('function isWall(')),c);
let checked=0;const test=(condition,msg)=>{assert.ok(condition,msg);checked++;};
const ref=(x,z,r)=>{
 if(![x,z,r].every(Number.isFinite)||r<0||x-r<0||z-r<0||x+r>size||z+r>size)return true;
 if(r===0)return cells[Math.floor(z)]?.[Math.floor(x)]===1;
 for(let iz=0;iz<size;iz++)for(let ix=0;ix<size;ix++)if(cells[iz][ix]===1){
  const px=Math.max(ix,Math.min(ix+1,x)),pz=Math.max(iz,Math.min(iz+1,z));
  if(Math.hypot(px-x,pz-z)<r-1e-8)return true;
 }
 return false;
};
// The old test treats a .24m circle as a .48m square.
const old=(x,z,r)=>[[-1,-1],[-1,1],[1,-1],[1,1]].some(([dx,dz])=>{
 const ix=Math.floor(x+dx*r),iz=Math.floor(z+dz*r);
 return ix<0||iz<0||ix>=size||iz>=size||cells[iz][ix]===1;
});
test(old(4.8,4.8,.24),'old square approximation really blocks a clear round corner');
test(!c.collide(4.8,4.8,.24),'exact circular operator can traverse the visible gap');
test(c.collide(4.85,4.85,.24),'circle still collides with real visible corner');
test(c.collide(5.5,5.5,.24),'full solid wall remains solid');
test(!c.collide(4.5,4.8,.24),'safe side of wall stays clear');
const t=5-.24/Math.SQRT2;
test(!c.collide(t,t,.24),'true outside tangency does not create a phantom wall');
test(c.collide(t+.001,t+.001,.24),'penetration after tangency blocks motion');
test(c.collide(-1,4,.24)&&c.collide(20,4,.24),'external world boundary solid');
test(c.collide(NaN,4,.24)&&c.collide(Infinity,4,.24)&&c.collide(4,4,NaN),'invalid input fails closed');
test(c.collide(5.4,5.5,0)&&!c.collide(4.8,4.8,0),'point collision retains map semantics');
// Deterministic randomized wall layouts, positions and radii.
let seed=0x1249aef;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
for(let scenario=0;scenario<36;scenario++){
 for(let z=1;z<size-1;z++)for(let x=1;x<size-1;x++)cells[z][x]=random()<.18?1:0;
 for(let i=0;i<240;i++){
  const x=random()*size,z=random()*size,r=.08+random()*.62;
  const got=c.collide(x,z,r),expect=ref(x,z,r);
  test(got===expect,`map ${scenario} probe ${i} radius ${r.toFixed(3)} at (${x.toFixed(3)},${z.toFixed(3)}) expected ${expect}, got ${got}`);
 }
}
// Real movement microsteps must never cross a wall. Position is checked after
// each high-speed movement, not merely after a static overlap query.
for(let z=1;z<size-1;z++)for(let x=1;x<size-1;x++)cells[z][x]=0;
cells[5][5]=1;
const player={x:4.55,z:4.8,feetY:0,grounded:true};c.game={p:player};
c.tryMoveEntity(player,.25,0,.24);
test(player.x>.775+4&&Math.abs(player.z-4.8)<1e-8,
 'player moves around wall corner instead of hitting a square phantom collider');
c.tryMoveEntity(player,.4,.4,.24);
test(!c.collide(player.x,player.z,.24),'a player moving diagonally never enters solid masonry');
const enemy={x:4.55,z:4.8,feetY:0,maxhp:100,type:'scout'};
c.tryMoveEntity(enemy,.25,0,.24);
test(enemy.x>4.775,'ground robot uses the same physically circular wall contact');
for(let i=0;i<240;i++){
 const dx=(random()-.5)*2.8,dz=(random()-.5)*2.8;
 if(c.collide(player.x,player.z,.24))break;
 c.tryMoveEntity(player,dx,dz,.24);
 test(!c.collide(player.x,player.z,.24),`player movement no tunnelling, move ${i}`);
}
// The physical static box and tile-wall contact both use circle/AABB math.
const b=[5,0,5,6,2.5,6],radius=.24;
for(let i=0;i<800;i++){
 const x=4.4+random()*2.2,z=4.4+random()*2.2;
 // Only the single interior wall tile is present in the sampled 3x3 area.
 const px=Math.max(b[0],Math.min(x,b[3])),pz=Math.max(b[2],Math.min(z,b[5]));
 const expected=(x-px)**2+(z-pz)**2<radius**2-1e-9;
 test(c.collide(x,z,radius)===expected,`tile contact agrees with actual 3D solid volume (${x},${z})`);
}
test(/const GAME_BUILD='(79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(fs.readFileSync(path.join(__dirname,'../src/00-core-save.js'),'utf8')),'V79 build');
test(/const MP_VERSION=(32|33|34|35|36|37|38|39|40|41|42)\b/.test(fs.readFileSync(path.join(__dirname,'../src/21b-multiplayer-lobby.js'),'utf8')),'MP version prevents old square collision peers');
console.log(`Stage79 precise circular player/robot/tile collision: ${checked} checks passed`);
