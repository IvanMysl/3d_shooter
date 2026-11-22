// STAGE 9: deterministic NPC movement, real static 3D boxes and shared BFS.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
const N=17, cells=Array.from({length:N},(_,z)=>Array.from({length:N},(_,x)=>x===0||z===0||x===N-1||z===N-1?1:0));
const p={x:12.5,z:8.5,feetY:0},g={p,t:0};
const c={console,Math,Number,Array,Map,Set,Int8Array,Int16Array,Float32Array,
 mapSize:N,mapCells:cells,game:g,navField:null,navClock:0,glReady:true,
 mapRooms:[],sectorStyle:0,TAU:Math.PI*2,clamp:(n,a,b)=>Math.min(b,Math.max(a,n)),hypot:Math.hypot,
 save:{settings:{audio:false}},input:{jumpQueued:false}};
vm.createContext(c);
vm.runInContext(source('03-height-and-collision.js')+source('04a-static-world-solids.js')+
 source('13-enemy-navigation-spawn.js')+source('13a-enemy-world-navigation.js'),c);
let count=0;const check=(ok,msg)=>{assert.ok(ok,msg);count++;};
const setup=()=>{c.resetWorldSolids();};
const bot=(x=3.5,z=8.5,extra={})=>({x,z,feetY:0,radius:.56,maxhp:120,type:'shooter',id:4,orbit:1,...extra});
const e=bot();
// Thin railing crossing an otherwise-open grid corridor.
setup();c.registerWorldSolid(6.2,0,7.75,9.8,2.2,8.25,'rail');
check(!c.enemyNavTile(7,8),'a metal barrier centre counted as passable');
check(c.enemyNavTile(7,6),'clear parallel cell marked blocked');
check(!c.enemyDirectRoute(e,p),'robot saw through physical rail with clear 2D map');
c.rebuildNavigation();
let h=c.enemyHeading(e,p);check(h.dx||h.dz,'BFS yielded no heading around rail');
const targets=[];for(let t=0;t<1050;t++){
 h=c.enemyHeading(e,p);c.enemyMove(e,h.dx*.055,h.dz*.055,.252);
 g.t+=.033;
 if(t%100===0)targets.push([+e.x.toFixed(2),+e.z.toFixed(2)]);
 check(!c.worldSolidBodyCollision(e.x,e.z,.252,e.feetY,c.enemyBodyHeight(e)),`entered rail at ${JSON.stringify([t,e.x,e.z])}`);
 if(Math.hypot(p.x-e.x,p.z-e.z)<1.2)break;
}
check(e.x>10.8 && Math.hypot(p.x-e.x,p.z-e.z)<1.2,`enemy failed 3D detour: ${JSON.stringify(targets)} end=${JSON.stringify([e.x,e.z])}`);
// Long dash cannot tunnel through a narrow post even if no wall map tile.
const b=bot(5.0,8.0,{id:5});c.moveEntity(b,7,0,.252);
check(b.x<6,'big dash crossed a physical post/rail');
// Top of a suspended bridge is an obstacle, underneath is accessible only
// with sufficient real headroom; heavy boss must not pass through the plate.
setup();c.registerWorldSolid(4,2.03,4,6,2.20,6,'bridge');
const small=bot(5,3,{id:6,type:'scout',radius:.42});
check(c.enemyCanOccupy(small,5,5,.25),'short scout cannot pass under elevated bridge');
check(!c.enemyCanOccupy(bot(5,3,{id:9}),5,5,.25),'taller shooter must not pass under 2.03m plate');
const boss=bot(5,3,{id:7,boss:true,radius:1.03,maxhp:500});
check(!c.enemyCanOccupy(boss,5,5,.45),'big boss passed inside bridge plate');
// World changes must invalidate cached navigation; tiles previously blocked
// have to become passable without reloading the page.
setup();check(c.enemyNavTile(7,8),'solid-cache kept stale barrier after mesh rebuild');
// Step-up and collision regression; no robot gets blocked by .215 m steps.
const ascending=bot(5.5,6.5,{id:8});
vm.runInContext('heightCells=new Float32Array(mapSize*mapSize);heightCells[6*mapSize+6]=.215',c);
c.moveEntity(ascending,.80,0,.25);
check(ascending.x>6.15&&ascending.feetY>.2,'stair tread blocked ascent');
console.log(`STAGE9 NAVIGATION: ${count} assertions passed; detour=${JSON.stringify(targets)}`);
