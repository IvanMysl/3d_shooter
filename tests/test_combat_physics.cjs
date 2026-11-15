// Deterministic regression tests for geometry, damage and equipment.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=(file)=>fs.readFileSync(path.join(root,'src',file),'utf8');
const get=(text,start,end)=>text.slice(text.indexOf(start),end?text.indexOf(end,text.indexOf(start)):undefined);
const tiles=Array.from({length:14},()=>Array(14).fill(0)),heights=Array.from({length:14},()=>Array(14).fill(0)),decks=Array.from({length:14},()=>Array(14).fill(0));
for(let i=0;i<14;i++){tiles[0][i]=tiles[13][i]=tiles[i][0]=tiles[i][13]=1;}
heights[4][4]=.86;decks[8][8]=2.2;tiles[4][6]=1;
const context={
 console,Math,Set,Number,Array,Map,Float32Array,TAU:Math.PI*2,
 touchOnly:false,glReady:false,mapSize:14,mapCells:tiles,ceilingHeight:()=>4.25,
 floorHeightAtCell:(x,z)=>heights[z]?.[x]||0,deckAtCell:(x,z)=>decks[z]?.[x]||0,
 floorHeight:(x,z)=>heights[Math.floor(z)]?.[Math.floor(x)]||0,
 game:{enemies:[]},clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),
};
vm.createContext(context);
const rays=read('14-combat-raycast.js');
vm.runInContext(get(rays,'function clipDecalPoly(','function rebuildDecalMesh(')+get(rays,'function v3('),context);
const v=(x,y,z)=>({x,y,z}),eps=(a,b,tol=.003)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
let h=context.rayWall(v(4.5,1.47,4.5),v(0,-1,0),5);
assert.equal(h.kind,'stairs');eps(h.t,.61);eps(h.y,.86);assert.equal(h.ny,1);
h=context.rayWall(v(3.5,.4,4.5),v(1,0,0),5);
assert.equal(h.kind,'stairs');eps(h.x,4);assert.equal(h.nx,-1);
h=context.rayWall(v(4.5,1.5,4.5),v(0,-1,0),5);
eps(h.y,.86);
h=context.rayWall(v(8.5,1,8.5),v(0,1,0),5);
assert.equal(h.kind,'bridge');eps(h.y,2.03);assert.equal(h.ny,-1);
h=context.rayWall(v(8.5,3,8.5),v(0,-1,0),5);
assert.equal(h.kind,'bridge');eps(h.y,2.2);assert.equal(h.ny,1);
h=context.rayWall(v(4.5,1.4,4.5),v(1,0,0),5);
assert.equal(h.kind,'wall');eps(h.x,6);assert.equal(h.nx,-1);
h=context.rayWall(v(2.5,1.3,2.5),v(0,-1,0),5);
assert.equal(h.kind,'floor');eps(h.y,0);
// The old one-radius sphere missed torso/arms and point-blank contact.
const armored={id:1,x:8,z:5,feetY:0,boss:false,radius:.69,type:'brute',dead:false};
context.game.enemies=[armored];
let enemy=context.rayEnemy(v(5,1.5,5),v(1,0,0),10);
assert.equal(enemy.enemy,armored);assert.ok(enemy.t<2.2);
enemy=context.rayEnemy(v(8,1.5,5),v(1,0,0),10);
assert.equal(enemy.enemy,armored);eps(enemy.t,.001);
const poly=[{u:-1,v:-1},{u:1,v:-1},{u:1,v:1},{u:-1,v:1}];
const c=context.clipDecalPoly(context.clipDecalPoly(poly,'u',-.1,.3),'v',-.2,.2);
assert.ok(c.length>=3);for(const pt of c){assert.ok(pt.u>=-.10001&&pt.u<=.30001&&pt.v>=-.20001&&pt.v<=.20001);}
// Test damage reduction, wear, and independent weapon stats without a browser.
const damageCtx={...context,Math,game:{state:'playing',enemies:[],p:{crit:0,damage:1}},distance:(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),
  spawnRobotArmorDebris:()=>{},showDamage:()=>{},sound:()=>{},awardKill:()=>{},setTimeout:()=>{},gameOver:()=>{},
  $:()=>({classList:{add(){},remove(){}},style:{}})};
vm.createContext(damageCtx);
const en=read('13-enemy-navigation-spawn.js');
vm.runInContext(get(en,'function hurtEnemy(','function burst('),damageCtx);
const target=()=>({hp:300,maxhp:300,protection:150,maxProtection:150,protectionRating:.6,type:'brute',x:4,z:4,dead:false});
const full=target();damageCtx.game.enemies=[full];damageCtx.hurtEnemy(full,100,{penetration:0});
eps(full.hp,260);assert.ok(full.protection<150&&full.protection>75);
const pierced=target();damageCtx.game.enemies=[pierced];damageCtx.hurtEnemy(pierced,100,{penetration:.8});
assert.ok(pierced.hp<full.hp);assert.ok(pierced.protection>full.protection);
// Physical armor is distinct from legacy rechargeable shield.
const player=damageCtx.game.p;Object.assign(player,{hp:200,maxhp:200,armor:0,armorDelay:0,bodyArmor:120,bodyArmorMax:120,bodyArmorReduction:.4,iframes:0,shield:0});
damageCtx.damagePlayer(100);eps(player.hp,140);assert.ok(player.bodyArmor<120);
console.log('COMBAT PHYSICS: 12 geometry/armor assertions passed');
