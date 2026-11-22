'use strict';
// Stage57: real AI (enemyHeading + enemyMove) must find a roof staircase from
// the public ground entrance, climb all 13 treads, and descend the SAME
// physical route. Verifies all affected campaign seeds and both WebGL tiers.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
let checks=0;
const check=(ok,msg)=>{assert.ok(ok,msg);checks++;};
const ctx={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],
 legacyResumeSector:-1,legacyResumeDivisor:18,glReady:false,touchOnly:false,
 gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{},quad:()=>{},rcolor:c=>c,
 save:{settings:{quality:0,audio:false}},sound:()=>{},burst:()=>{},
 input:{jumpQueued:false},arsenalOpened:false,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['БОСС'],robotPalette:()=>({}),toast:()=>{},game:null,
 navField:null,navClock:0};
vm.createContext(ctx);
for(const file of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js'])vm.runInContext(source(file),ctx);
const ev=s=>vm.runInContext(s,ctx);
const active=new Set([2,4,6,9]);
check(/const GAME_BUILD='(57|58|59|60|61|62|63|64|65|66|67|68|69|70|71|72|73|74|75|76|77|78|79|80|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),'V57 release');
check(/const MP_VERSION=(11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|40|41|42)\b/.test(source('21b-multiplayer-lobby.js')),
 'AI behavior change multiplayer geometry must have version guard');
function groundEntrance(s,side=-1){
 const u=side*(4+s.steps);
 return s.axis==='x'?{x:s.cx+u+.5,z:s.cz+.5}:
  {x:s.cx+.5,z:s.cz+u+.5};
}
function robotAt(where,feet){return {id:57,x:where.x,z:where.z,feetY:feet,
 type:'scout',maxhp:100,radius:.48,orbit:1,airborne:false};}
function drive(robot,target,goal,goalY,maxFrames=1100,speed=.062){
 ctx.game={p:target,enemies:[robot],particles:[],t:0};
 ctx.rebuildNavigation();
 let best=Infinity,arrived=false,routeSeen=false;
 for(let frame=0;frame<maxFrames;frame++){
  const before={x:robot.x,z:robot.z,y:robot.feetY};
  const heading=ctx.enemyHeading(robot,target);
  check(Number.isFinite(heading.dx)&&Number.isFinite(heading.dz),
   `invalid robot navigation direction on frame${frame}`);
  ctx.enemyMove(robot,heading.dx*speed,heading.dz*speed,.22);
  ctx.game.t+=.033;
  check(Math.hypot(robot.x-before.x,robot.z-before.z)<.105,
   `robot teleported horizontally on frame${frame}`);
  check(Math.abs(robot.feetY-before.y)<.245,
   `robot teleported vertically on frame${frame}: ${before.y}->${robot.feetY}`);
  check(!ctx.worldSolidBodyCollision(robot.x,robot.z,.22,robot.feetY,1.68),
   `robot crossed a visible 3D wall on frame${frame}`);
  routeSeen ||=!!robot.roofNavKey;
  const d=Math.hypot(robot.x-goal.x,robot.z-goal.z);
  best=Math.min(d,best);
  if(d<.70&&Math.abs(robot.feetY-goalY)<.08){arrived=true;break;}
 }
 return {arrived,best,routeSeen};
}
let ascents=0,descents=0,tight=0;
for(const level of [3,5,7,10]){
 const style=(level-1)%18;if(!active.has(style))continue;
 for(const quality of [0]){
  ctx.glReady=true;ctx.touchOnly=quality===0;ctx.save.settings.quality=quality;
  ctx.buildMap(level);
  for(const s of ev('midlevelSpecs')){
   if(s.roofStairCount!==13){tight++;continue;}
   const route=ev(`roofEscapeWaypoints(midlevelSpecs.find(p=>p.cx===${s.cx}&&p.cz===${s.cz}))`);
   check(route.length===15,`level${level}, q${quality}: wrong AI route length`);
   const roof=route.at(-1),foot=groundEntrance(s,-1);
   const bot=robotAt(foot,0),target={...roof,feetY:s.roofY};
   const up=drive(bot,target,roof,s.roofY,1150);
   check(up.arrived&&up.routeSeen,
    `level${level}, q${quality}: bot didn't find public stairs to roof; d=${up.best}`);
   ascents++;
   // Change the target to a distant lower floor point; don't let a roof bot
   // jump off the outer edge or punch through a side wall. It must find and
   // traverse the reversed stair route to the midlevel start.
   const downTarget={...foot,feetY:0};
   const down=drive(bot,downTarget,route[0],s.y,1150);
   check(down.arrived&&down.routeSeen,
    `level${level}, q${quality}: bot didn't descend 13 real roof steps; d=${down.best}`);
   descents++;
  }
 }
}
check(ascents===6&&descents===6,
 `expected six selected public roof routes, got ${ascents}/${descents}`);
check(tight===2,`two selected tight roof sites must remain untouched: ${tight}`);

// Dynamic retarget: a player can jump down while the enemy is halfway up;
// a descending route must start from the current tread, not from the roof.
for(const style of [2,4,6,9])for(const quality of [0]){
 const level=style===4?23:style+1;
 ctx.glReady=true;ctx.touchOnly=quality===0;ctx.save.settings.quality=quality;
 ctx.buildMap(level);
 const s=ev('midlevelSpecs').find(t=>t.roofStairCount===13),
  route=ev(`roofEscapeWaypoints(midlevelSpecs.find(p=>p.cx===${s.cx}&&p.cz===${s.cz}))`);
 const bot=robotAt(route[0],s.y),top=route.at(-1);
 const player={...top,feetY:s.roofY};
 ctx.game={p:player,enemies:[bot],particles:[],t:0};ctx.rebuildNavigation();
 for(let frame=0;frame<110;frame++){
  const h=ctx.enemyHeading(bot,player);
  ctx.enemyMove(bot,h.dx*.048,h.dz*.048,.22);ctx.game.t+=.033;
 }
 check(bot.feetY>s.y+.42&&bot.feetY<s.roofY-.3,
  `style${style}, q${quality}: bot didn't reach the middle of staircase`);
 const ground={...route[0],feetY:s.y};
 const down=drive(bot,ground,route[0],s.y,500,.048);
 check(down.arrived&&down.routeSeen,
  `style${style}, q${quality}: bot didn't replan downward from mid-stair`);
}
console.log(`Stage102 focused roof retarget: ${checks} autonomous ascent/descent, anti-teleport, collision and replanning checks passed (${ascents} climbs, ${descents} descents)`);
