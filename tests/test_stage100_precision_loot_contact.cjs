'use strict';
// Stage100: a real steel end-lip cannot be ignored by magnet pickup just
// because it lies in the final centimetre of the 3D ray to a legacy drop.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
const N=22,mapCells=Array.from({length:N},()=>Array(N).fill(0));
let checks=0;function check(v,msg){assert.ok(v,msg);checks++;}
const game={state:'playing',nodes:[],devices:[],mission:{type:'purge',caches:[]},loot:[],p:{x:9.5,z:9.5,feetY:0,magnet:3}};
const c={console,Math,Number,Set,Map,Array,Int16Array,Int32Array,Int8Array,Uint8Array,Float32Array,
 mapSize:N,mapCells,game,mpMatch:null,glReady:true,worldSolidGrid:[],worldSolidCount:0,
 floorHeight:()=>0,floorHeightAtCell:()=>0,deckAtCell:()=>0,
 ceilingHeight:()=>5.5,supportHeight:()=>0,collide:()=>false,
 v3:(x,y,z)=>({x,y,z}),clamp:(v,lo,hi)=>Math.max(lo,Math.min(hi,v))};
vm.createContext(c);
vm.runInContext(source('04a-static-world-solids.js'),c);
const ray=source('14-combat-raycast.js');vm.runInContext(ray.slice(ray.indexOf('function rayAABB('),ray.indexOf('function rayEnemy(')),c);
const player=game.p,drop={x:10.5,z:9.5,feetY:0,type:'credits',life:10};
for(const gl of [false,true]){
 c.glReady=gl;c.resetWorldSolids();game.nodes=[];game.devices=[];
 check(c.worldLootPickupClear(player,drop),`gl=${gl}: free same-floor resource pickup`);
 game.devices=[{x:10,z:9.5,used:false,kind:'repair'}];
 check(!c.worldLootPickupClear(player,drop),`gl=${gl}: no pickup through physical station`);
 game.devices=[];check(c.worldLootPickupClear(player,drop),`gl=${gl}: no phantom station after removal`);
}
c.glReady=true;c.resetWorldSolids();
c.registerWorldSolid(10.491,.03,9.05,10.496,1.0,9.95,'steel-end-lip');
check(!c.worldLootPickupClear(player,drop),'resource collected through 5mm thick real steel at final 9mm');
c.resetWorldSolids();
check(c.worldLootPickupClear(player,drop),'removing real steel restores drop collection');
// A real 2.2m-high bridge plate separates lower-floor and upper-floor loot.
const oldDeck=c.deckAtCell;
c.deckAtCell=(x,z)=>Math.floor(x)===10&&Math.floor(z)===9?2.2:0;
check(!c.worldLootPickupClear(player,{...drop,feetY:2.2}),
 'loot on upper floor collected through a real bridge plate');
c.deckAtCell=oldDeck;
console.log(`Stage100 precise 3D loot pickup: ${checks} PASS`);
