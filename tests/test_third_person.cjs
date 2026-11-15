// Regression for third-person camera collision, trajectory and model assembly.
// Executed in Node without WebGL hardware; the browser suite tests actual input.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../src/09a-player-third-person.js'),'utf8');
const calls=[];
const actor={x:10.5,yaw:0,pitch:0,z:10.5,feetY:0,walk:1,weapon:0,bodyArmorType:-1,shield:0,shotGlow:0};
const s={settings:{cameraMode:'third'}};
const context={Math,Number,Array,Set,Map,console,
  clamp:(v,a,b)=>Math.max(a,Math.min(v,b)),save:s,game:{p:actor},
  BODY_ARMOR_CATALOG:Array.from({length:12},(_,i)=>({name:String(i),color:[.22+i*.035,.28,.41]})),
  document:{body:{classList:{toggle(){}}}},$:()=>null,
  rayWall:()=>null,sweepWorldSphere:()=>null,rayNode:()=>null,rayEnemy:()=>null,
  glReady:true,geom:{bevel:'bevel',cube:'cube',orb:'orb',ring:'ring',cylinder:'cylinder'},
  draw:(...args)=>calls.push(args),weapons:[{color:[.32,.74,1]}],
  persist:()=>true,toast:()=>{},
};
vm.createContext(context);
vm.runInContext(src,context);
const pose=()=>vm.runInContext('thirdPersonCameraPose(game.p)',context);
const aim=()=>vm.runInContext('aimFromOperator({x:game.p.x,y:1.47,z:game.p.z})',context);
let c=pose();assert.equal(c.drawActor,true);assert.ok(c.eye[2]<8&&c.eye[1]>1.5);
assert.ok(Math.hypot(...c.dir)>.9999&&Math.hypot(...c.dir)<1.0001);
let d=aim();assert.ok(d.z>.9&&Number.isFinite(d.y));
// When a camera boom hits a wall, fallback is at eye; no clipping behind it.
context.sweepWorldSphere=()=>({t:.65});c=pose();assert.equal(c.drawActor,false);assert.equal(c.distance,0);assert.ok(c.eye[2]===actor.z);
context.sweepWorldSphere=()=>({t:2.4});c=pose();assert.equal(c.drawActor,true);assert.ok(c.distance<2.4&&c.distance>1.5);
// Shooting cannot be redirected behind the player by a wall very near camera.
context.sweepWorldSphere=()=>({t:.65});d=aim();assert.ok(d.z>.95);
context.sweepWorldSphere=()=>null;
vm.runInContext('renderOperator(game,game.p)',context);const unarmored=calls.length;
assert.ok(unarmored>=50,`Expected articulated unarmored model, got ${unarmored} draw calls`);
const oldColors=JSON.stringify(calls.map(x=>x[8]));calls.length=0;
actor.bodyArmorType=11;
vm.runInContext('renderOperator(game,game.p)',context);
assert.ok(calls.length>unarmored,`High-tier gear must add 3D details: ${calls.length} vs ${unarmored}`);
const newColors=JSON.stringify(calls.map(x=>x[8]));assert.notEqual(oldColors,newColors);
let result=vm.runInContext('toggleCameraMode()',context);
assert.equal(result,'second');assert.equal(pose().drawActor,true); // geometry independent of selected mode
let front=vm.runInContext('secondPersonCameraPose(game.p)',context);
assert.ok(front.drawActor&&front.eye[2]>actor.z+3,`Front camera not in front: ${front.eye}`);
assert.ok(front.dir[2]<-.95,`Front camera not looking at the face: ${front.dir}`);
let frontShot=aim();assert.ok(frontShot.z>.95,'Front-facing camera reversed the weapon');
result=vm.runInContext('toggleCameraMode()',context);assert.equal(result,'first');
result=vm.runInContext('toggleCameraMode()',context);assert.equal(result,'third');
context.sweepWorldSphere=()=>({t:.65});front=vm.runInContext('secondPersonCameraPose(game.p)',context);
assert.ok(!front.drawActor&&front.distance===0,'Front camera clipped through near obstruction');
console.log('CAMERAS: first / third / second, 3D geometry, aim and armor assertions passed');
