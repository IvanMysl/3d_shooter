// Stage 6: Exact swept sphere/box contact, robotic broadphase and regression
// against a slow, independent convex minimization reference. No GPU required.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../src');
const source=fs.readFileSync(path.join(root,'14-combat-raycast.js'),'utf8');
const snippet=source.slice(source.indexOf('function rayAABB('),source.indexOf('function rayWall('));
const robots=source.slice(source.indexOf('function rayEllipsoid('),source.indexOf('function sparkImpact('));
const game={t:0,enemies:[]};
const ctx={console,Math,Set,Number,Array,Map,game,v3:(x,y,z)=>({x,y,z}),floorHeight:()=>0};
vm.createContext(ctx);
vm.runInContext(snippet+'\n'+robots,ctx);
const v=(x,y,z)=>({x,y,z});
const close=(a,b,eps=2e-5)=>assert.ok(Math.abs(a-b)<eps,`${a} vs ${b}`);
const box=[6,1,6,7,2,7],eps=1e-8;
let checks=0;
function check(condition,msg){assert.ok(condition,msg);checks++;}
const hit=(o,d,length,r)=>ctx.sweptSphereAABB(o,d,length,box,r);
// Previous expanded-AABB algorithm wrongly reported this as a collision:
// y and x are both 0.2 away from the metal, sqrt(.2^2+.2^2) > .25.
check(hit(v(5.8,2.2,4),v(0,0,1),5,.25)===null,
  'A bullet that misses a box corner in two axes must NOT hit a squared-off phantom corner');
// Equal distance to a round edge: exact arrival is 6 - sqrt(r^2 - .2^2).
let h=hit(v(5,1.9,5.8),v(1,0,0),3,.25);
check(h,'Swept sphere must collide with the rounded corner edge');
close(h.t,1-.15);close(h.x,6);close(h.y,1.9);close(h.z,6);
close(h.nx,-.6);close(h.nz,-.8);
checks+=6;
// A larger body overlaps a metal rail even if its centerline misses it.
h=hit(v(6.5,2.24,5),v(0,0,1),3,.25);
check(h&&h.t>.9&&h.t<1.01,'near-face impact detected');
// Direct face contact, an initially overlapping sphere, and a zero-radius ray.
h=hit(v(5,1.5,6.5),v(1,0,0),3,.2);close(h.t,.8);close(h.x,6);checks+=2;
h=hit(v(6.1,1.5,6.5),v(1,0,0),3,.2);close(h.t,0);checks++;
h=hit(v(5,1.5,6.5),v(1,0,0),3,0);close(h.t,1);checks++;
function sampleDistance(o,d,t,b){
 const p=[o.x+d.x*t,o.y+d.y*t,o.z+d.z*t];
 let sum=0;for(let a=0;a<3;a++){const q=Math.max(b[a]-p[a],0,p[a]-b[a+3]);sum+=q*q;}
 return sum;
}
function reference(o,d,max,b,r){
 let a=0,z=max;
 // Distance to a convex box along a line is convex. Find the minimizer.
 for(let i=0;i<85;i++){const q=(z-a)/3;
  if(sampleDistance(o,d,a+q,b)<sampleDistance(o,d,z-q,b))z-=q;else a+=q;
 }
 const tMin=(a+z)/2,rr=r*r;
 if(sampleDistance(o,d,tMin,b)>rr-1e-8)return null;
 if(sampleDistance(o,d,0,b)<=rr)return 0;
 a=0;z=tMin;
 for(let i=0;i<75;i++){const t=(a+z)/2;if(sampleDistance(o,d,t,b)<=rr)z=t;else a=t;}
 return z;
}
let seed=123456;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
let compared=0;
for(let k=0;k<1200;k++){
 const b=[2+random()*5,0.1+random()*3,2+random()*5,0,0,0];
 b[3]=b[0]+.05+random()*1.7;b[4]=b[1]+.05+random()*1.3;b[5]=b[2]+.05+random()*1.7;
 const o=v(1+random()*9,random()*5,1+random()*9);
 let d=v(random()*2-1,random()*2-1,random()*2-1),norm=Math.hypot(d.x,d.y,d.z);
 d=v(d.x/norm,d.y/norm,d.z/norm);
 const length=.1+random()*8,radius=.03+random()*.45;
 const accurate=reference(o,d,length,b,radius);
 const result=ctx.sweptSphereAABB(o,d,length,b,radius);
 // Ignore cases within epsilon of perfect tangency, numerically ill-conditioned.
 if(accurate===null)check(result===null,'Spurious corner hit in randomized sphere sweep '+k);
 else{
  check(result!==null,'Lost true sphere contact '+k);
  if(result){close(result.t,accurate,.002);checks++;}
 }
 compared++;
}
// The full world-sweep code (not just the primitive) must ignore phantom
// corners and stop projectiles on real rounded metal edges.
const meshSource=fs.readFileSync(path.join(root,'04a-static-world-solids.js'),'utf8');
const worldSource=source.slice(source.indexOf('function rayWall('),source.indexOf('function rayEllipsoid('));
const cells=Array.from({length:16},()=>Array(16).fill(0));
const geo={Math,Number,Set,Map,console,mapSize:16,mapCells:cells,glReady:true,
 ceilingHeight:()=>4.25,floorHeightAtCell:()=>0,deckAtCell:()=>0,box:()=>{},game,
 v3:v};
vm.createContext(geo);
vm.runInContext(meshSource+snippet+worldSource,geo);
geo.resetWorldSolids();
geo.registerWorldSolid(...box,'structure');
check(geo.sweepWorldSphere(v(5.8,2.2,4),v(0,0,1),5,.25)===null,
 'Full collision grid rejects a phantom corner');
h=geo.sweepWorldSphere(v(5,1.9,5.8),v(1,0,0),3,.25);
check(h?.kind==='structure','Full collision grid returns a physical metal impact');
if(h){close(h.t,.85);close(h.x,6);close(h.z,6);checks+=3;}
// Rounded edge normal is physical, but its bullet-hole is a PLANAR clipping
// polygon on one selected metal face. This avoids floating diagonal stickers.
const marks=fs.readFileSync(path.join(root,'17-weapon-combat.js'),'utf8');
const markSource=marks.slice(marks.indexOf('function addSurfaceMark('),marks.indexOf('function addImpact('));
Object.assign(ctx,{MAX_WALL_MARKS:100,rand:(a,b)=>(a+b)/2,TAU:Math.PI*2});
vm.runInContext('let decalDirty=false;'+markSource,ctx);
ctx.game.decals=[];
ctx.addSurfaceMark({...h,kind:'structure',solid:{box}}, {name:'РАКЕТНИЦА',mode:'projectile',blast:2,color:[1,0.6,0.2]});
const decal=ctx.game.decals[0];
check(decal?.nx===0&&decal?.ny===0&&decal?.nz===-1,
 'Corner mark is attached to the real Z face, not the oblique sphere normal');
check(decal?.bounds?.[0]===box[0]&&decal?.bounds?.[5]===box[5],
 'Decal retained face bounds for clipping');
// A large distant enemy population must not trigger limb tests every pellet.
const robot=(x,z,type='drone')=>({id:x*100+z,type,dead:false,x,z,feetY:0,radius:.51,robotYaw:0});
game.enemies=Array.from({length:500},(_,i)=>robot(70+i,80+i));
let invoked=0;
vm.runInContext('const origAccessoryRay=robotAccessoryRay; robotAccessoryRay=function(...args){globalThis.accessoryInvocations++;return origAccessoryRay(...args)}',Object.assign(ctx,{accessoryInvocations:0}));
let rh=ctx.rayEnemy(v(5,1,5),v(1,0,0),18);
check(rh===null,'No distant robot intercepts a short shot');
check(ctx.accessoryInvocations===0,'Distant robots were rejected before costly rig proxy generation');
const d=robot(8,8);game.enemies=[d];
check(ctx.robotNearRay(v(9.29,1.15,5),v(0,0,1),15,d),'Broadphase contains real wing-tip shots');
rh=ctx.rayEnemy(v(9.29,1.15,5),v(0,0,1),15);
check(rh?.part==='wing','Broadphase never discards a real wing');
check(ctx.robotNearArea(d,v(9.3,1,5.5),2),'Blast broadphase accepts exposed wing');
check(!ctx.robotNearArea(d,v(60,1,60),2),'Remote robots excluded from blast sampling');
console.log(`STAGE6 PRECISION: ${checks} checks, including ${compared} independent randomized sphere sweeps and robot broadphase`);
