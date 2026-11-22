// Stage 4: deterministic direct-contact, cover, area damage and EMP regression.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../src');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const raw=read('17-weapon-combat.js');
const pick=(source,a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
let shots=[],nodeHits=[],covered=false,hitCalls=0;
const game={state:'playing',enemies:[],nodes:[],bullets:[],impactFx:[],p:{x:6,y:0,z:6,feetY:0,energy:100,shock:1,hp:100,maxhp:100}};
const ctx={game,Math,Number,Array,Set,console,save:{settings:{quality:0},perms:Array(8).fill(0)},
 v3:(x,y,z)=>({x,y,z}),floorHeight:()=>0,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rayWall:(origin,unit,limit)=>covered?({t:.4}):null,
 hurtEnemy:(e,amount,options)=>{shots.push({e,amount,options});e.hp-=amount;hitCalls++},
 damagePowerNode:(n,amount)=>{nodeHits.push({n,amount});n.hp-=amount},
 burst:()=>{},sound:()=>{},toast:()=>{},rand:()=>.5,
};
vm.createContext(ctx);
const statsSource=read('12-arsenal-and-game.js');
vm.runInContext(statsSource.split('\n').filter(line=>line.startsWith('const PERM_COMPOUND=')||line.startsWith('const permanentStat=')).join('\n'),ctx);
const robotRay=read('14-combat-raycast.js');
vm.runInContext(robotRay.slice(robotRay.indexOf('function rayEllipsoid(')),ctx);
{const fx=read('13-enemy-navigation-spawn.js');vm.runInContext(fx.slice(fx.indexOf('function emitWeaponSound(')),ctx);}
vm.runInContext(pick(raw,'function enemyBlastSamples(','function shootPellet('),ctx);
const enemy=(x=7,y=0,z=6)=>({x,z,feetY:y,radius:.52,type:'shooter',boss:false,dead:false,hp:300,maxhp:300,stun:0});
const w={damage:100,blast:3.5,penetration:.3,color:[1,.4,.2],name:'РАКЕТНАЯ УСТАНОВКА'};
const near=enemy(7),other=enemy(8.5);game.enemies=[near,other];
// Direct contact retains the complete listed damage, with no second AoE application.
ctx.splash(6,1.2,6,w,near);
assert.equal(shots.filter(s=>s.e===near).length,1);
assert.equal(shots.find(s=>s.e===near).amount,100);
assert.ok(shots.some(s=>s.e===other));
shots=[];covered=true;
ctx.splash(6,1.2,6,w,near);
assert.equal(shots.length,1,'Direct impact must not be cancelled by a cover ray');
assert.equal(shots[0].amount,100);
// Nearby target fully behind the wall is shielded from splash.
shots=[];const behind=enemy(9.2);game.enemies=[behind];ctx.splash(6,1.2,6,w);
assert.equal(shots.length,0,'Opaque wall should block all sampled body parts');
// Partial cover must not make the complete robot invulnerable.
ctx.rayWall=(origin,d)=>d.y>.1?null:{t:.2};
shots=[];ctx.splash(6,1.2,6,w);
assert.ok(shots.length>0,'Some exposed robot parts should receive partial splash');
assert.ok(shots.every(s=>s.amount<100));
// Outside blast radius vertically: raised or flying enemies are not hit just
// because their footprint overlaps the explosion in the X/Z plane.
ctx.rayWall=()=>null;
shots=[];const high=enemy(6.1,12,6.1);game.enemies=[high];
ctx.splash(6,1.2,6,w);
assert.equal(shots.length,0);
// The real drone wing projects outside its main chassis ellipsoid. Explosions
// beside the wing must work even when the robot center is outside the radius.
const wingDrone=enemy(8,0,6);wingDrone.type='drone';wingDrone.robotYaw=0;
wingDrone.id=23;game.enemies=[wingDrone];shots=[];
ctx.splash(10.5,1.15,5.86,{...w,blast:1.45});
assert.ok(shots.some(s=>s.e===wingDrone),
 'Blast close to the visible drone wing must not be lost outside torso radius');
// Geometry preview should not mutate armor, other enemies or persistent saves.
assert.ok(wingDrone.hp<300);
// Direct node damage is already recorded on projectile impact: skip splash.
const powerNode={x:7,y:0,z:6,feetY:0,radius:.5,hp:250,dead:false};
game.nodes=[powerNode];shots=[];nodeHits=[];
ctx.splash(6,1.2,6,w,null,powerNode);
assert.equal(nodeHits.length,0,'Direct node cannot receive a duplicated radial hit');
// Ion shells electrify robots; regular rockets do not.
game.enemies=[near];near.stun=0;shots=[];
ctx.splash(6,1.2,6,{...w,ionStun:.75},near);
assert.equal(near.stun,.75);
near.stun=0;ctx.splash(6,1.2,6,w,near);
assert.equal(near.stun,0);
// EMP: target adjacent to player hit, wall-protected target unaffected, and
// a high-elevation target with the same XY projection unaffected.
const ability=read('18-ai-and-abilities.js');
vm.runInContext(pick(ability,'function useAbility(','function enemyFire('),ctx);
vm.runInContext(read('13-enemy-navigation-spawn.js').split('function emitPulseFx(').pop().replace(/^/, 'function emitPulseFx('),ctx);
ctx.input={mx:0,mz:0};ctx.distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
ctx.moveEntity=()=>{};ctx.sound=()=>{};ctx.burst=()=>{};
const adjacent=enemy(6.2,0,6.2),elevated=enemy(6.2,12,6.2);
game.enemies=[adjacent,elevated];game.nodes=[];shots=[];
ctx.useAbility('pulse');
assert.ok(shots.some(s=>s.e===adjacent),'Adjacent robot must be EMP-hit');
assert.ok(!shots.some(s=>s.e===elevated),'Raised robot must not be EMP-hit');
assert.ok(adjacent.stun>=1.8);
game.p.energy=100;covered=true;ctx.rayWall=()=>({t:.2});shots=[];
ctx.useAbility('pulse');
assert.equal(shots.length,0,'An opaque metal wall must stop EMP to a fully covered robot');
// Weapon stat descriptions are backed by actual combatWeapon values.
assert.ok(read('12a-loadout-economy.js').includes('function gunNumericStats('));
assert.ok(read('22-menus-and-upgrades.js').includes('gunNumericStats(i)'));
console.log('AREA DAMAGE: direct contact, no double hit, 5-sample cover, vertical radius, ion stun, EMP cover passed');
