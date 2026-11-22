// STAGE 10: live robot-vs-robot collision and local detours, without breaking
// existing static collision, bridge clearance, or the Canvas fallback.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
const N=19,empty=()=>Array.from({length:N},(_,z)=>Array.from({length:N},(_,x)=>x===0||z===0||x===N-1||z===N-1?1:0));
const p={x:14.5,z:9.5,feetY:0},g={p,t:0,enemies:[]};
const c={console,Math,Number,Array,Map,Set,Int8Array,Int16Array,Float32Array,
 mapSize:N,mapCells:empty(),game:g,navField:null,navClock:0,glReady:true,
 mapRooms:[],sectorStyle:0,TAU:Math.PI*2,clamp:(n,a,b)=>Math.min(b,Math.max(a,n)),hypot:Math.hypot,
 save:{settings:{audio:false}},input:{jumpQueued:false}};
vm.createContext(c);
vm.runInContext(src('03-height-and-collision.js')+src('04a-static-world-solids.js')+
 src('13-enemy-navigation-spawn.js')+src('13a-enemy-world-navigation.js'),c);
let checks=0;const check=(val,msg)=>{assert.ok(val,msg);checks++;};
const bot=(x,z,id,extra={})=>({x,z,id,feetY:0,maxhp:120,radius:.56,type:'shooter',orbit:id%2?-1:1,...extra});
const sep=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const near=(a,b)=>c.enemyCrowdRadius(a)+c.enemyCrowdRadius(b);
function reset(){c.resetWorldSolids();g.enemies=[];g.t=0;c.mapCells=empty();}

// A robot may not move THROUGH another robot, even at a long delta.
reset();let mover=bot(3.5,9.5,1),stationary=bot(6.5,9.5,2);
g.enemies=[mover,stationary];
c.moveEntity(mover,7,0,.25);
check(mover.x<stationary.x-near(mover,stationary)+.03,'long jump tunneled through NPC');
check(sep(mover,stationary)>=near(mover,stationary)-.03,'dynamic collision penetrated');
// While chasing the player, it must detour around a stationary robot.
mover.x=3.5;mover.z=9.5;g.t=0;
let min=1000;for(let i=0;i<650;i++){
 const h=c.enemyHeading(mover,p);c.enemyMove(mover,h.dx*.047,h.dz*.047,.25);g.t+=.033;
 min=Math.min(min,sep(mover,stationary));
 if(sep(mover,p)<1.15)break;
}
check(min>=near(mover,stationary)-.022,`NPC collision during detour (distance ${min})`);
check(mover.x>10,`NPC could not detour around stationary ally (${mover.x},${mover.z})`);

// Different levels: a bot on the upper deck never blocks a bot below it.
reset();const lower=bot(5.0,5,3,{type:"scout",radius:.48}),upper=bot(6.1,5,4,{feetY:2.2});g.enemies=[lower,upper];
check(c.enemyCrowdAllows(lower,6.1,5,.25),'upper bridge NPC blocked lower passage');
c.moveEntity(lower,1.1,0,.25);
check(lower.x>5.9,'lower-level robot failed to pass under upper actor');
const tall=bot(5.0,5,15);g.enemies=[tall,upper];
check(c.enemyBodyHeight(tall)>upper.feetY&&!c.enemyCrowdAllows(tall,6.1,5,.25),'tall body really intersects upper actor');
// In the same z/x footprint, a boss requires more lateral room than a scout.
reset();const boss=bot(7.0,9.5,5,{boss:true,radius:1.03,maxhp:750});
const tiny=bot(5.5,9.5,6);g.enemies=[boss,tiny];
check(c.enemyCrowdRadius(boss)>c.enemyCrowdRadius(tiny),'boss not larger than scout');
c.moveEntity(tiny,2,0,.25);
check(sep(boss,tiny)>=near(boss,tiny)-.025,'small bot entered boss volume');
// Initially overlapping spawned actors are allowed to escape, not frozen.
reset();const a=bot(8,8,7),b=bot(8,8,8);g.enemies=[a,b];
check(c.enemyCrowdAllows(a,7.7,8,.25),'initial overlap cannot separate');
c.moveEntity(a,-.8,0,.25);
check(a.x<7.5,'overlapping NPCs could not separate');
// Dead actors must not block surviving ones.
reset();const living=bot(5,9.5,9),dead=bot(6,9.5,10,{dead:true});g.enemies=[living,dead];
c.moveEntity(living,2,0,.25);check(living.x>6.7,'dead NPC still has physical body');
// Fallback renderer has no worldSolids, but robots remain tangible.
reset();c.glReady=false;const f1=bot(3.5,9.5,11),f2=bot(6.5,9.5,12);g.enemies=[f1,f2];
for(let i=0;i<600;i++){
 const dx=p.x-f1.x,dz=p.z-f1.z,d=Math.hypot(dx,dz)||1;
 c.enemyMove(f1,dx/d*.047,dz/d*.047,.25);g.t+=.033;
 if(sep(f1,p)<1.2)break;
}
check(f1.x>10,'Canvas fallback robots did not navigate around one another');
check(sep(f1,f2)>near(f1,f2)-.03,'Canvas fallback allowed actor overlap');
// A modest capped crowd can update repeatedly with finite positions.
reset();c.glReady=true;g.enemies=Array.from({length:14},(_,i)=>bot(3.5+(i%5)*.86,3.5+Math.floor(i/5)*.92,100+i));
for(let t=0;t<150;t++){
 for(const enemy of g.enemies){const h=c.enemyHeading(enemy,p);c.enemyMove(enemy,h.dx*.035,h.dz*.035,.25);
  check(Number.isFinite(enemy.x)&&Number.isFinite(enemy.z),'crowd produced invalid coordinate');}
 g.t+=.04;
}
console.log(`STAGE10 CROWD COLLISIONS: ${checks} assertions passed; detours, multi-floor, boss, initial overlap, Canvas and 14-actor update`);
