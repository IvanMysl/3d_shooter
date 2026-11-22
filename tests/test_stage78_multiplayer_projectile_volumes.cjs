'use strict';
// Stage78: host-authoritative PvP projectile collision must use the actual
// visible collision volume, not an infinitely thin ray.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=name=>fs.readFileSync(path.join(__dirname,'../src',name),'utf8');
const cells=Array.from({length:16},()=>Array(16).fill(0));
for(let i=0;i<16;i++)cells[0][i]=cells[15][i]=cells[i][0]=cells[i][15]=1;
const drawn=[],blasts=[];
const m={projectiles:[],actors:new Map([[0,{id:0,p:{hp:100}}]])};
const ctx={Math,Set,Map,Array,Number,Float32Array,glReady:true,mapSize:16,mapCells:cells,
 box:(out,...b)=>drawn.push(b.slice(0,6)),ceilingHeight:()=>4.25,
 floorHeightAtCell:()=>0,deckAtCell:()=>0,mpMatch:m,
 mpCombatTarget:()=>null,mpCombatBlast:(shooter,point,weapon)=>blasts.push({point,weapon}),
 mpCombatPoint:(o,d,t)=>({x:o.x+d.x*t,y:o.y+d.y*t,z:o.z+d.z*t})};
vm.createContext(ctx);
vm.runInContext(src('04a-static-world-solids.js'),ctx);
const raySrc=src('14-combat-raycast.js');
vm.runInContext(raySrc.slice(raySrc.indexOf('function rayAABB('),raySrc.indexOf('function rayEnemy(')),ctx);
const mpSrc=src('21e-multiplayer-combat.js');
vm.runInContext(mpSrc.slice(mpSrc.indexOf('function mpProjectileRadius('),mpSrc.indexOf('function mpCombatRespawn(')),ctx);
let checked=0;
function test(cond,label){assert.ok(cond,label);checked++;}
const weapon={name:'РАКЕТНАЯ УСТАНОВКА',mode:'projectile',range:40,damage:80,speed:17,blast:3.4};
const grenade={name:'ГРОМ · ГРАНАТОМЁТ',mode:'projectile',range:40,damage:100,speed:12,blast:4.1};
ctx.resetWorldSolids();
ctx.worldSolidBox([],8.0,1.0,5.0,8.2,2.0,5.20,[.6,.7,.8]);
test(ctx.worldSolidStats().boxes===1&&drawn.length===1,'visible steel has a single identical collision volume');
const P=(x,y,z)=>({x,y,z}),dir=P(0,0,1);
function shot(start,w,r,dt=1){blasts.length=0;m.projectiles=[{shooter:0,w,pos:start,v:{x:0,y:0,z:1},life:5,...(r===undefined?{}:{rad:r})}];ctx.mpCombatProjectileStep(dt);return {b:blasts[0],remaining:m.projectiles.length,s:m.projectiles[0]};}
let start=P(8.3,1.5,4.5);
test(ctx.rayWall(start,dir,1)===null,'thin centerline misses the edge of solid steel');
test(ctx.sweepWorldSphere(start,dir,1,.13)?.kind==='structure','the real rocket radius grazes the steel');
let result=shot(start,weapon,.13);
test(result.b&&result.remaining===0,'PvP rocket detonates against real physical steel rather than passing through');
test(result.b.point.z<5&&result.b.point.z>4.75,'host PvP explosion occurs on the leading edge, not behind the obstacle');
result=shot(P(8.38,1.5,4.5),weapon,.13);
test(!result.b&&result.remaining===1,'miss near the edge remains a miss, with no invisible extra wall');
result=shot(P(8.3,1.5,4.5),grenade,.20);
test(result.b&&result.b.point.z<4.90,'grenade uses its larger actual collision radius');
result=shot(P(8.3,1.5,4.5),weapon,undefined);
test(result.b,'old/saved PvP projectiles without an explicit radius still collide with their true model diameter');
// Test an open gunport: the exact same data path must not seal a genuine gap.
ctx.resetWorldSolids();
ctx.worldSolidBox([],7.4,1,5,7.75,2,5.2,[1,1,1]);
ctx.worldSolidBox([],8.25,1,5,8.6,2,5.2,[1,1,1]);
result=shot(P(8,1.5,4.5),weapon,.13);
test(!result.b&&result.remaining===1,'PvP rocket passes through a real opening when radius fits');
result=shot(P(8,1.5,4.5),grenade,.20);
test(!result.b&&result.remaining===1,'grenade also passes if physical opening is wider than its diameter');
result=shot(P(8.14,1.5,4.5),grenade,.20);
test(result.b&&result.remaining===0,'grenade edge clips the gunport side armor');
// Parameterized grazing: thousands of radius/offset combinations catch both
// tunneling and false "invisible walls" along the box perimeter.
ctx.resetWorldSolids();
ctx.worldSolidBox([],8.0,1.0,5.0,8.2,2.0,5.20,[.5,.8,.9]);
for(const radius of [.04,.075,.10,.13,.20,.27])for(let i=0;i<90;i++){
 const offset=(i+.25)/89*.30,from=P(8.2+offset,1.5,4.5);
 if(Math.abs(offset-radius)<.0001)continue; // exact tangencies depend on floating-point tolerance
 const r=shot(from,weapon,radius),intersects=offset<radius-1e-7;
 test(!!r.b===intersects,`radius ${radius} offset ${offset.toFixed(4)} physical intersection`);
 if(intersects){
  const expect=5-Math.sqrt(radius*radius-offset*offset);
  test(Math.abs(r.b.point.z-expect)<.00005,
   `accurate first physical contact ${r.b.point.z} expected ${expect}`);
 }
}
// Actual server launch must carry the same radius that the client renders.
ctx.mpCombatOrigin=()=>P(8.3,1.5,4.5);
ctx.mpCombatDirection=()=>dir;
ctx.operatorMuzzlePoint=()=>P(8.3,1.5,4.5);
ctx.directionFromMuzzle=()=>dir;
ctx.mpCombatEmit=()=>{};
ctx.weapons=[weapon,grenade];
m.projectiles=[];
ctx.mpCombatShot(m.actors.get(0),weapon);
test(m.projectiles[0]?.rad===.13,'server rocket spawns with .13 m physical radius');
ctx.mpCombatShot(m.actors.get(0),grenade);
test(m.projectiles[1]?.rad===.20,'server grenade spawns with .20 m physical radius');
test(ctx.mpProjectileRadius(m.projectiles[0].w)===m.projectiles[0].rad &&
 ctx.mpProjectileRadius(m.projectiles[1].w)===m.projectiles[1].rad,
 'all server projectiles and client display share their physical radii');
// Network version protects owners from mismatched collision semantics.
test(Number(src('00-core-save.js').match(/const GAME_BUILD='(\d+)'/)?.[1])>=78,'build is Stage78 or newer');
test(/const MP_VERSION=(31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(src('21b-multiplayer-lobby.js')),'network collision version bumped');
console.log(`Stage78 PvP projectile geometry: ${checked} checks passed`);
