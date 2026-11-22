'use strict';
// Independently derive max vertex heights from REAL Robot Foundry procedural
// mesh creation, then assert the movement/spawn hull contains the rendered bot.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.STAGE_SOURCE_ROOT||path.resolve(__dirname,'..');
const src=n=>fs.readFileSync(path.join(root,'src',n),'utf8');
const names=['scout','charger','shooter','brute','sniper','medic','warden','artillery','raider','drone','boss'];
const env={Math,Number,console,TAU:Math.PI*2,
 enemies:Object.fromEntries(names.map(k=>[k,{color:[1,1,1]}])),
 addTri:(v,a,b,c,n,t,em)=>{for(const p of [a,b,c])v.push(...p,...n,...t,em)},
 box:(v,x0,y0,z0,x1,y1,z1,t,em)=>{
  v.push(x0,y0,z0,0,1,0,...t,em);v.push(x1,y1,z1,0,1,0,...t,em);
 },
 toMesh:v=>{let top=-Infinity;for(let i=1;i<v.length;i+=10)top=Math.max(top,v[i]);return {top};}};
vm.createContext(env);
for(const n of ['07-robot-foundry-core.js','08-robot-foundry-rigs.js','09-robot-foundry-artifacts.js','13a-enemy-world-navigation.js'])
 vm.runInContext(src(n),env,{filename:n});
let checks=0;const check=(ok,m)=>{assert.ok(ok,m);checks++;};
const radii={scout:.42,charger:.47,shooter:.52,brute:.69,sniper:.47,medic:.50,
 warden:.68,artillery:.61,raider:.53,drone:.48,boss:1.03};
for(const name of names){
 const bounds=vm.runInContext(`({body:buildRobotBody('${name}'),lite:buildRobotBody('${name}',false),elite:buildRobotEliteRig('${name}'),sensor:buildRobotAnimatedSensors('${name}')})`,env);
 const max=Math.max(bounds.body.top,bounds.lite.top,bounds.sensor.top);
 check(Number.isFinite(max)&&max>1.0,`empty robot foundry mesh: ${name}`);
 for(const elite of [false,true]){
  const type=name==='boss'?'boss':name;
  const size=radii[name]*(elite&&name!=='boss'?1.13:1);
  const scale=name==='boss'?1.75:Math.max(.76,Math.min(1.31,size/.51));
  const drawnTop=Math.max(max,elite||name==='boss'?bounds.elite.top:0)*scale;
  const animatedTop=drawnTop+(name==='medic'?.178:.055);
  const h=env.enemyBodyHeight({type,boss:name==='boss',radius:size,elite,airborne:name==='drone'});
  check(h>=animatedTop-1e-5,
   `${name} ${elite?'elite':'regular'}: body collider ${h.toFixed(3)}m BELOW rendered top ${animatedTop.toFixed(3)}m`);
 }
}
console.log(`Stage105 actual Robot Foundry mesh/collider parity: ${checks} PASS`);
