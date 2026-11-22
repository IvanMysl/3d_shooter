'use strict';
// Real event receiver and real particle emitter, no dummy effects.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.resolve(__dirname,'../src',n),'utf8');
const fx=src('13-enemy-navigation-spawn.js');
const combat=src('21e-multiplayer-combat.js');
const calls=[];
const ctx={Math,Number,TAU:Math.PI*2,rand:(a,b)=>(a+b)/2,sound:(...a)=>calls.push(a),
  game:{p:{x:10,feetY:2,z:20},particles:[],impactFx:[],tracers:[]},
  mpMatch:{active:true,token:'pulse-test',self:0,actors:new Map([[0,{}],[1,{}]])},
  save:{settings:{quality:0}},weapons:[{name:'РАКЕТЫ',blast:3.4,color:[1,.2,.1]},{name:'ИОННЫЙ',color:[.1,.2,1]}],MP_CAP:8,glReady:false};
vm.createContext(ctx);
vm.runInContext(fx.slice(fx.indexOf('function burst(')),ctx);
vm.runInContext(combat.slice(combat.indexOf('function mpCombatReceiveEffect('),combat.indexOf('// Keep host-authoritative collision')),ctx);
const event={type:'pulse',token:'pulse-test',gun:0,id:0,a:[10,3.03,20],b:[10,3.03,20]};
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++};
ctx.mpCombatReceiveEffect(event);
check(ctx.game.particles.length===45,'local pulse must produce 45 actual particles');
check(ctx.game.particles.every(p=>p.x===10&&p.y===3.03&&p.z===20),'origin at actor height');
check(ctx.game.particles.every(p=>JSON.stringify(p.col)==='[0.36,0.95,1]'),'cyan independent of weapon');
check(ctx.game.particles.every(p=>p.life>0&&p.life===p.maxLife&&[p.vx,p.vy,p.vz].every(Number.isFinite)),'animated finite particles');
check(JSON.stringify(calls[0])==='[190,0.28,"sawtooth",0.2]','same local sound as campaign');
check(ctx.game.impactFx.length===0,'not fake bullet impact');
ctx.mpCombatReceiveEffect({...event,id:1,gun:1,a:[13,3.03,20],b:[13,3.03,20]});
check(ctx.game.particles.length===90,'remote pulse produces full effect');
check(ctx.game.particles.slice(45).every(p=>p.x===13&&p.col[0]===.36),'remote effect at remote actor');
check(calls.length===2&&calls[1][3]>0&&calls[1][3]<.2,'remote spatial attenuation');
ctx.mpCombatReceiveEffect({...event,id:1,a:[90,3.03,20],b:[90,3.03,20]});
check(calls.length===2,'distant pulse silent');
const prior=ctx.game.particles.length;
for(const bad of [{token:'bad'},{gun:99},{a:[NaN,3,20]},{b:[10,3,Infinity]}])ctx.mpCombatReceiveEffect({...event,...bad});
check(ctx.game.particles.length===prior,'invalid packets do not emit');
ctx.mpCombatReceiveEffect({...event,type:'blast'});
check(ctx.game.impactFx.length===1&&ctx.game.particles.length===prior+20,'ordinary blast uses full shared explosion effect');
console.log(`Stage119: ${checks} checks PASS`);
