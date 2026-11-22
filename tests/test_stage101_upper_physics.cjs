'use strict';
// Real production movement and elevated BFS. Must FAIL against Stage100.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0; const check=(v,m)=>{assert.ok(v,m);checks++;};
const N=14;
const c={Math,Number,console,Float32Array,Int8Array,Int16Array,Int32Array,Uint8Array,Map,Set,
 mapSize:N,mapCells:Array.from({length:N},()=>Array(N).fill(0)),
 glReady:true,touchOnly:false,worldSolidCount:0,worldSolidGrid:[],mpMatch:null,
 game:null,worldMapBoss:false,sectorStyle:0,
 save:{settings:{audio:false}},sound:()=>{},burst:()=>{},toast:()=>{},
 input:{jumpQueued:false},arsenalOpened:false,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(n,a,b)=>Math.max(a,Math.min(b,n))};
vm.createContext(c);
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js',
 '13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js',
 '14-combat-raycast.js'])vm.runInContext(source(n),c,{filename:n});
const ev=s=>vm.runInContext(s,c);
function reset(){
 ev(`heightCells=new Float32Array(${N*N});deckCells=new Float32Array(${N*N});balconySpecs=[];midlevelSpecs=[];worldMapBoss=false;resetWorldSolids();enemyNavMask=null;enemyNavEdges=null;upperDeckNavMap=null;upperDeckNavDecks=null;upperDeckNavCache.clear();`);
 c.mapCells=Array.from({length:N},()=>Array(N).fill(0));
 c.game={nodes:[],devices:[],mission:{type:'purge'},nodesDestroyed:0,enemies:[],p:{x:10.5,z:5.5,feetY:0},t:0};
}
const robot=(x,z,y,type='scout')=>({id:101,x,z,feetY:y,type,radius:.48,maxhp:100,orbit:1,airborne:false});
reset();
// An upper balcony ends at x=5. A nonflying robot must not instant-drop 2.2m
// in a single horizontal step. The player is deliberately not constrained:
// player edge falls retain their original gravity mechanic.
ev(`for(let z=2;z<=10;z++)for(let x=2;x<=4;x++)deckCells[z*mapSize+x]=2.2;`);
let e=robot(4.65,5.5,2.2);c.game.enemies=[e];
c.moveEntity(e,.55,0,.22);
check(e.x<5.22&&e.x>4.65,`grounded bot stepped off unconnected 2.2m deck (x=${e.x}, y=${e.feetY})`);
check(Math.abs(e.feetY-2.2)<.001,'grounded robot must remain on physical deck');
// A player may walk/jump off the deck and falls via updateVertical.
const p={x:4.65,z:6.5,feetY:2.2,grounded:true,vy:0,flying:false};
c.game.p=p;c.moveEntity(p,.70,0,.23);
check(p.x>5.23,'player should be allowed to walk off a roof');
c.updateVertical(p,.10);check(p.feetY<2.2,'player must fall under gravity');
// Flying enemies may cross an edge without their feet snapping down.
e={...robot(4.65,5.5,2.8),airborne:true};c.game.enemies=[e];
c.moveEntity(e,.55,0,.22);
check(e.x>5.04&&Math.abs(e.feetY-2.8)<.001,'airborne robot must cross gap at preserved altitude');
reset();
// Four real 0.215m stairs: descending and ascending remain passable.
ev(`for(let z=3;z<=7;z++)for(let x=2;x<=9;x++)heightCells[z*mapSize+x]=Math.max(0,(7-x)*.215);`);
e=robot(3.5,5.5,.86);c.game.enemies=[e];c.moveEntity(e,4.0,0,.22);
check(e.x>7.2&&Math.abs(e.feetY)<.01,'valid physical descending stairs must remain traversable');
c.moveEntity(e,-4.0,0,.22);
check(e.x<3.9&&e.feetY>.62,'valid physical ascending stairs must remain traversable');
reset();
// All deck tiles have a solid 2.2m support. A genuine structural steel
// column divides the deck, but a physically open bypass runs at z=9.
ev(`for(let z=2;z<=10;z++)for(let x=2;x<=11;x++)deckCells[z*mapSize+x]=2.2;`);
ev('registerWorldSolid(5.1,2.2,2.0,5.9,4.5,8.8,"barrier")');
c.game.p={x:9.5,z:5.5,feetY:2.2};
check(c.worldSolidBodyCollision(5.5,5.5,.22,2.2,1.68),'test beam really collides on upper deck');
check(!c.worldSolidBodyCollision(5.5,9.5,.22,2.2,1.68),'bypass is physically open');
let field=c.upperDeckField(9.5,5.5,2.2);
const direct=field[5*N+4],step=c.upperDeckHeading(robot(4.5,5.5,2.2),9.5,5.5,2.2);
check(direct>5,`upper BFS must detour around an actual 3D railing, got ${direct}`);
check(step&&Math.abs(step.dx)<.30&&Math.abs(step.dz)>.5,'upper heading should follow physically open detour');
// Rebuilding a different static mesh must invalidate cached upper flow-fields.
ev('resetWorldSolids()');
field=c.upperDeckField(9.5,5.5,2.2);
check(field[5*N+4]===5,'upper BFS should reopen when steel obstruction disappears');
// On an otherwise flat high deck, a live reactor's 3D volume blocks a
// cell; destruction must reopen the route without reloading the map.
reset();
ev(`for(let z=2;z<=10;z++)for(let x=2;x<=11;x++)deckCells[z*mapSize+x]=2.2;heightCells[5*mapSize+6]=2.2;`);
const node={x:6.5,z:5.5,dead:false};c.game.nodes=[node];
field=c.upperDeckField(9.5,5.5,2.2);const blocked=field[5*N+5];
check(blocked>4,`live metal reactor should force a deck detour (${blocked})`);
node.dead=true;c.game.nodesDestroyed=1;
field=c.upperDeckField(9.5,5.5,2.2);
check(field[5*N+5]===4,'destroyed reactor should immediately reopen upper-deck route');
console.log(`Stage101 upper-deck physical navigation: ${checks} checks PASS`);
