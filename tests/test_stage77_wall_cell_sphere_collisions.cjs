'use strict';
// V77: rockets and other finite-radius projectiles must interact with the
// exact physical boxes that are drawn INSIDE solid map tiles. Previous sphere
// tracing skipped these spatial buckets while hitscan correctly included them.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../src');
const source=name=>fs.readFileSync(path.join(root,name),'utf8');
const cells=Array.from({length:16},()=>Array(16).fill(0));
for(let i=0;i<16;i++)cells[0][i]=cells[15][i]=cells[i][0]=cells[i][15]=1;
cells[5][5]=1;
const drawings=[];
const c={Math,Set,Map,Float32Array,Number,Array,
 mapSize:16,mapCells:cells,glReady:true,box:(out,...args)=>drawings.push(args.slice(0,6)),
 ceilingHeight:()=>4.25,floorHeightAtCell:()=>0,deckAtCell:()=>0};
vm.createContext(c);
vm.runInContext(source('04a-static-world-solids.js'),c);
const combat=source('14-combat-raycast.js');
vm.runInContext(combat.slice(combat.indexOf('function rayAABB('),combat.indexOf('function rayEnemy(')),c);
let assertions=0;function check(condition,reason){assert.ok(condition,reason);assertions++;}
const approx=(a,b,tolerance=.00001)=>check(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const p=(x,y,z)=>({x,y,z});
const down=p(0,-1,0),forward=p(0,0,1),across=p(1,0,0);
c.resetWorldSolids();
// Visible overhanging metal at Y=4.8--5.0 occupies a FULL wall-grid cell.
// Wall tile height is only 4.25, so the projectile MUST hit the metal first.
c.worldSolidBox([],5.20,4.80,5.20,5.80,5.00,5.80,[.7,.7,.7]);
check(c.worldSolidStats().boxes===1,'registered visible steel box');
check(drawings.length===1&&drawings[0].every((v,i)=>v===[5.2,4.8,5.2,5.8,5,5.8][i]),
 'drawn and physical boxes have identical coordinates');
const origin=p(5.5,5.6,5.5);
let bullet=c.rayWall(origin,down,2);
let rocket=c.sweepWorldSphere(origin,down,2,.05);
check(bullet?.kind==='structure'&&rocket?.kind==='structure',
 'hitscan AND rocket strike the actual overhanging steel, not the wall below');
approx(bullet.t,.60);approx(rocket.t,.55);
check(rocket.t<bullet.t,'sphere touches steel before its center ray');
check(rocket.solid?.box[1]===4.80,'returned sphere collider is the visual metal');
// Across the wall's edge, the sphere touches a narrow side overhang.
let sideOrigin=p(4.85,4.90,5.5);
let h=c.sweepWorldSphere(sideOrigin,across,1,.08);
check(h?.kind==='structure','cross-cell rocket hits solid overhang');
approx(h.t,.27);
// Registered beams in an otherwise empty tile still work as before.
c.worldSolidBox([],9.20,2.90,9.20,9.80,3.02,9.80,[.5,.5,.5]);
h=c.sweepWorldSphere(p(9.5,3.5,9.5),down,1,.06);
check(h?.kind==='structure','walkable tile still checks solids');
approx(h.t,.42);
// Empty space next to a protruding beam remains physically clear.
check(c.rayWall(p(6.25,4.9,5.5),across,.30)===null,
 'no invisible wall beside steel');
check(c.sweepWorldSphere(p(6.25,4.9,5.5),across,.30,.04)===null,
 'no invisible rocket collider beside steel');
// Direct hits and thin-body contacts do not require an additional step/frame.
check(c.worldSolidBodyCollision(5.5,5.5,.18,4.72,.35),
 'player body is stopped by registered solid in a solid grid tile');
// Another wall obstacle behind the metal cannot hide its nearer collider.
for(let n=0;n<100;n++){
 const r=.015+n*.001;
 h=c.sweepWorldSphere(origin,down,2,r);
 check(h?.kind==='structure','solid protrusion remains first for every tested rocket radius');
 approx(h.t,.60-r,.00002);
}
// Low-end fallback draws no WebGL-only steel and must not invent an obstacle.
c.glReady=false;c.resetWorldSolids();drawings.length=0;
c.worldSolidBox([],5.20,4.80,5.20,5.80,5.00,5.80,[.7,.7,.7]);
check(c.worldSolidStats().boxes===0,'Canvas fallback has no invisible WebGL solid');
check(c.sweepWorldSphere(origin,down,2,.05)?.kind==='wall',
 'Canvas fallback still collides with its simple map walls');
check(/const GAME_BUILD='(77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),'Stage77 build');
check(/const MP_VERSION=(30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(source('21b-multiplayer-lobby.js')),
 'client/host reject pre-fix collision semantics');
console.log(`Stage77: ${assertions} wall-cell hitscan/swept-rocket/body/clearance checks passed`);
