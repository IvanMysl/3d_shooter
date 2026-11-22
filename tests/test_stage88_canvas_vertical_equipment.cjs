'use strict';
// Stage88: the Canvas fallback is not permission to pass vertically through a
// metal equipment body. The SAME AABB must stop flight and gravity in both
// render backends, including the one-frame low-FPS / long-fall case.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0;
function check(ok,description){assert.ok(ok,description);checks++;}
const n=23,c={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 mapSize:n,mapCells:Array.from({length:n},()=>Array(n).fill(0)),mapRooms:[],
 glReady:false,sectorStyle:14,worldMapBoss:false,
 save:{settings:{quality:0,flightVertical:1,audio:false}},
 input:{flyDown:false,flyUp:false,jumpQueued:false,jumpHeld:false,keys:{}},
 flightSpeedMultiplier:()=>1,normalizeFlightThrottle:()=>1,
 clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),hypot:Math.hypot,
 arsenalOpened:false,burst:()=>{}};
vm.createContext(c);
for(const file of ['03-height-and-collision.js','04a-static-world-solids.js'])
 vm.runInContext(source(file),c,{filename:file});
const evaluate=s=>vm.runInContext(s,c);
check(/GAME_BUILD='(?:88|89|90|91|92|93|94|95|96|97|98|99|100|101|102|103|104|105|106|107|108|109|110|111|112|113|114|115)'/.test(source('00-core-save.js')),'Stage88 build');
check(/MP_VERSION=(?:41|42)\b/.test(source('21b-multiplayer-lobby.js')),'Stage88 isolated multiplayer compatibility');
check(!/if\(p\.vy[<>]0\s*&&\s*glReady\)/.test(source('03-height-and-collision.js')),
 'gravity never uses renderer readiness as its collision condition');
check(!/after<before&&glReady/.test(source('03-height-and-collision.js')),
 'flight never uses renderer readiness as its collision condition');
const devices=[{kind:'node',r:.37,top:1.27},{kind:'equipment',r:.36,top:1.30},
 {kind:'archive',r:.31,top:.32}];
let flightTests=0,gravityTests=0,sideTests=0;
function install(kind,x=11.5,z=11.5){
 const entity={x,z,dead:false,got:false,used:false};
 const caches=kind==='archive'?[entity]:[];
 const g={state:'playing',nodes:kind==='node'?[entity]:[],
  devices:kind==='equipment'?[entity]:[],mission:{type:kind==='archive'?'recovery':'purge',caches},
  p:null};
 c.game=g;
 c.worldMesh=null;
 evaluate('resetWorldSolids()');
 return {g,entity};
}
function player(x=11.5,z=11.5,y=2.8,flight=false){
 return {x,z,feetY:y,vy:0,flightUnlocked:true,flying:flight,grounded:false};
}
for(const isWebGL of [false,true])for(const {kind,r,top} of devices){
 c.glReady=isWebGL;
 const {g,entity}=install(kind);
 const solid=evaluate('worldEquipmentCell(11,11)[0]');
 check(solid.kind===kind,`${kind} ${isWebGL}: missing indexed body`);
 check(Math.abs(solid.box[4]-top)<1e-10,`${kind}: wrong visible roof height`);
 check(evaluate('worldSolidBodyCollision(11.5,11.5,.23,0,1.95)'),
  `${kind}: horizontal operator walks through visible body`);
 check(!evaluate('worldSolidBodyCollision(12.5,11.5,.23,0,1.95)'),
  `${kind}: body blocks empty adjacent space`);sideTests+=2;
 // Fast descending flight crosses the ENTIRE height of the body in one tick.
 const p=player(11.5,11.5,top+1.55,true);g.p=p;
 c.input.flyDown=true;c.input.flyUp=false;
 evaluate('updateVertical(game.p,.50)');
 check(p.feetY>=top-1e-8&&p.feetY<top+.03,
  `${kind}/${isWebGL}: flight penetrated steel: feet ${p.feetY}, roof ${top}`);flightTests++;
 // Gravity, also one long frame: cannot fall through the body to the floor.
 const q=player(11.5,11.5,top+1.20,false);q.vy=-3.5;g.p=q;
 c.input.flyDown=false;
 evaluate('updateVertical(game.p,.42)');
 check(q.grounded&&q.feetY>=top&&q.feetY<top+.03,
  `${kind}/${isWebGL}: gravity penetrated steel: ${q.feetY}`);gravityTests++;
 // Standing on top stays supported on the following frame.
 evaluate('updateVertical(game.p,.016)');
 check(q.grounded&&Math.abs(q.feetY-top)<.01,
  `${kind}/${isWebGL}: support vanishes on next frame`);
 // A body above its roof must remain free to move vertically without an
 // invented invisible ceiling or falsely extended column.
 const h=player(11.5,11.5,top+1.15,true);g.p=h;c.input.flyDown=true;
 evaluate('updateVertical(game.p,.035)');
 check(h.feetY>top+.70&&h.feetY<top+1.15,
  `${kind}/${isWebGL}: phantom roof extends far above the actual body`);flightTests++;
 // An intact metal archive plinth stays after recovering its data; used
 // stations stay solid; destroyed reactors disappear from both layers.
 if(kind==='node'){
  entity.dead=true;
  const gone=evaluate('worldSolidFeetBarrier(11.5,11.5,.23,2,0)');
  check(gone===null,`${kind}: destroyed reactor leaves invisible roof`);
  const exit=player(11.5,11.5,top+1.2,true);g.p=exit;c.input.flyDown=true;
  evaluate('updateVertical(game.p,.55)');
  check(exit.feetY<top-.1,`${kind}: destroyed node still blocks descent`);
 }else{
  if(kind==='equipment')entity.used=true;else entity.got=true;
  const roof=evaluate('worldSolidFeetBarrier(11.5,11.5,.23,2,0)');
  check(roof!==null&&Math.abs(roof-top)<1e-8,
   `${kind}: used visible metal support becomes intangible`);
 }
}
// Static WebGL details remain WebGL-only, so the patch does not invent
// invisible world geometry when the Canvas renderer is active.
c.glReady=false;install('node');
check(evaluate('worldSolidStats().boxes')===0,'fallback did not secretly build GPU-only meshes');
const a=player(14.5,14.5,2.1,false);c.game.p=a;a.vy=-3.4;
evaluate('updateVertical(game.p,.4)');
check(a.feetY===0&&a.grounded,'empty fallback floor remains physically unchanged');
console.log(`Stage88 fallback vertical equipment: ${checks} checks / ${flightTests} flight / ${gravityTests} gravity / ${sideTests} horizontal / Canvas+WebGL: PASS`);
