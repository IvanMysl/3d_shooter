'use strict';
// Stage100: level completion is a physical THREE-dimensional portal entry.
// Merely being close in XZ through a steel rail, another deck or a wall must
// never bypass the same collision that blocks player movement and bullets.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
const N=24,tiles=Array.from({length:N},(_,z)=>Array.from({length:N},(_,x)=>+(x===0||z===0||x===N-1||z===N-1)));
let checks=0;const check=(value,msg)=>{assert.ok(value,msg);checks++;};
const p={x:9.5,z:9.5,feetY:0},portal={x:10.5,z:9.5};
const game={state:'playing',p,portalReady:true,nodes:[],devices:[],mission:{type:'purge',caches:[]}};
const c={Math,Number,Array,Set,Map,Int8Array,Int16Array,Int32Array,Uint8Array,Float32Array,
 console,mapSize:N,mapCells:tiles,glReady:false,game,portal,mpMatch:null,
 floorHeight:()=>0,floorHeightAtCell:()=>0,deckAtCell:()=>0,ceilingHeight:()=>6,
 collide:(x,z,r)=>{for(let zi=Math.floor(z-r);zi<=Math.floor(z+r);zi++)for(let xi=Math.floor(x-r);xi<=Math.floor(x+r);xi++)if(tiles[zi]?.[xi]===1)return true;return false;},
 distance:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),v3:(x,y,z)=>({x,y,z}),
 clamp:(v,a,b)=>Math.max(a,Math.min(b,v))};
vm.createContext(c);
for(const f of ['04a-static-world-solids.js','14-combat-raycast.js']){
 const s=src(f);vm.runInContext(f==='14-combat-raycast.js'?s.slice(s.indexOf('function rayAABB('),s.indexOf('function rayEnemy(')):s,c,{filename:f});
}
const gameplay=src('19-gameplay-update.js'),name='function physicalPortalContact(';
const begin=gameplay.indexOf(name),end=gameplay.indexOf('function portalNext(',begin);
check(begin>=0&&end>begin,'production 3D portal contact must exist');
vm.runInContext(gameplay.slice(begin,end),c,{filename:'physicalPortalContact'});
for(const gl of [false,true]){
 c.glReady=gl;c.resetWorldSolids();
 p.x=9.5;p.z=9.5;p.feetY=0;
 check(c.physicalPortalContact(p),`gl=${gl}: valid nearby ground entrance`);
 p.x=9.31;check(!c.physicalPortalContact(p),`gl=${gl}: beyond physical gate radius`);
 p.x=9.5;p.feetY=2.4;
 check(!c.physicalPortalContact(p),`gl=${gl}: ground portal entered from different storey`);
 p.feetY=1.10;check(c.physicalPortalContact(p),`gl=${gl}: valid airborne/jumping portal entry`);
 p.feetY=0;
 game.devices=[{x:10,z:9.5,kind:'battery',used:false}];
 check(!c.physicalPortalContact(p),`gl=${gl}: portal through REAL device casing`);
 game.devices=[];
 check(c.physicalPortalContact(p),`gl=${gl}: equipment removed, portal physically accessible`);
 if(gl){c.registerWorldSolid(9.95,.03,9.0,10.01,2.4,10.0,'rail');
  check(!c.physicalPortalContact(p),'webgl steel rail must physically block extraction');
  c.resetWorldSolids();
  // At the very last 9mm, the real rail still exists: do NOT ignore it
  // merely because the ray is close to its intended endpoint.
  c.registerWorldSolid(10.491,.03,9.0,10.496,2.1,10.0,'thin-door-lip');
  check(!c.physicalPortalContact(p),'last 9mm of real steel may not be penetrated');
  c.resetWorldSolids();}
 // Deck is a solid even in Canvas: player on bridge above ground portal.
 const old=c.deckAtCell;c.deckAtCell=(x,z)=>Math.floor(x)===10&&Math.floor(z)===9?2.2:0;
 p.feetY=2.20;check(!c.physicalPortalContact(p),`gl=${gl}: portal beneath true bridge is inaccessible from above`);
 c.deckAtCell=old;
 // Full-height tile wall must block/forbid the operator regardless of 2D centre distance.
 p.x=9.5;p.feetY=0;tiles[9][9]=1;
 check(!c.physicalPortalContact(p),`gl=${gl}: player located inside real wall cannot exit`);
 tiles[9][9]=0;
}
console.log(`Stage100 physical portal contact: ${checks} PASS`);
