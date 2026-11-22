'use strict';
// Verify live world ray geometry and the complete screen-space visibility gate.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),src=n=>fs.readFileSync(path.join(root,'src',n),'utf8');
const N=19;
let checks=0;const ok=(cond,label)=>{assert.ok(cond,label);checks++;};
const glCanvas={width:1280,height:720,getBoundingClientRect:()=>({left:0,top:0,right:1280,bottom:720,width:1280,height:720})};
const context={console,Math,Number,Map,Set,Float32Array,Int32Array,Uint8Array,Array,Date,performance:{now:()=>0},
 mapSize:N,mapCells:Array.from({length:N},()=>Array(N).fill(0)),glReady:true,game:null,mpMatch:null,worldSolidGrid:[],
 sectorStyle:1,box:()=>{},glCanvas,document:{createElement:()=>({style:{},classList:{toggle:()=>{}},setAttribute:()=>{},remove:()=>{}})},
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(x,a,b)=>Math.min(b,Math.max(a,x)),touchOnly:false,
 save:{settings:{quality:1}},$:(id)=>id==='mpNameTags'?{hidden:true,appendChild:()=>{}}:id==='overlay'?{classList:{contains:()=>true}}:null,
 externalCameraEnabled:()=>false,operatorCameraPose:()=>null,worldMapBoss:false};
vm.createContext(context);
for(const name of ['03-height-and-collision.js','04a-static-world-solids.js','14-combat-raycast.js','21k-multiplayer-nametags.js'])vm.runInContext(src(name),context,{filename:name});
const ev=x=>vm.runInContext(x,context);
const camera={eye:{x:4.5,y:1.5,z:8.5},yaw:Math.PI/2,pitch:0};
const actor={id:1,nick:'Соперник',team:1,p:{x:9.5,z:8.5,feetY:0,hp:100}};
const rect=glCanvas.getBoundingClientRect();
const setCamera=(eye,target)=>{
 const lx=target.x-eye.x,ly=target.y-eye.y,lz=target.z-eye.z,L=Math.hypot(lx,ly,lz),
 z=[-lx/L,-ly/L,-lz/L],xz=Math.hypot(z[0],z[2])||1,x=[z[2]/xz,0,-z[0]/xz],
 y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];
 const view=[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,
 -(x[0]*eye.x+x[1]*eye.y+x[2]*eye.z),-(y[0]*eye.x+y[1]*eye.y+y[2]*eye.z),-(z[0]*eye.x+z[1]*eye.y+z[2]*eye.z),1];
 const f=1/Math.tan(73*Math.PI/360);
 context.matView=new Float32Array(view);context.matProj=new Float32Array([f/(1280/720),0,0,0,0,f,0,0,0,0,-1, -1,0,0,-.1,0]);
};
function reset(){
 context.mapCells=Array.from({length:N},()=>Array(N).fill(0));
 ev(`heightCells=new Float32Array(${N*N});deckCells=new Float32Array(${N*N});resetWorldSolids()`);
 context.game={p:{x:camera.eye.x,z:camera.eye.z,feetY:0},nodes:[],devices:[],enemies:[],t:0};
}
const eye=camera.eye;
const target=(x=actor.p.x,y=actor.p.feetY+1.78,z=actor.p.z)=>({x,y,z});
reset();ok(context.mpNameTagRayVisible(eye,target()),'empty arena: line of sight');
// Visible head and caption when not blocked, including off-axis camera.
setCamera(eye,{x:10.5,y:1.7,z:8.5});
ok(context.mpNameTagProjectWebGL({x:10.5,y:1.9,z:8.5},rect)!==null,'WebGL camera projects point in front');
ok(context.mpNameTagLayout(actor,camera,rect)!==null,'unobstructed peer has visible nameplate');
ok(context.mpNameTagProjectWebGL({x:2.5,y:1.9,z:8.5},rect)===null,'WebGL does not project behind camera');
// Full body solid wall, including a true thin metal barrier.
context.mapCells[8][7]=1;
ok(!context.mpNameTagRayVisible(eye,target()),'map wall hides head');
ok(context.mpNameTagLayout(actor,camera,rect)===null,'full nameplate hidden behind wall');
reset();ev('worldSolidBox([],6,0,8,6.022,2.2,9,[.2,.3,.4])');
ok(!context.mpNameTagRayVisible(eye,target()),'2cm physical rail occludes');
reset();ev('worldSolidBox([],6.2,0,8.3,6.5,2.1,8.7,[.2,.3,.4])');
ok(!context.mpNameTagRayVisible(eye,target()),'registered mesh hull occludes');
// Hanging bridge across camera->head, including lower side, never inferred by map cells.
reset();ev('for(let x=6;x<=7;x++)deckCells[8*mapSize+x]=1.70');
ok(!context.mpNameTagRayVisible(eye,target()),'real bridge plate occludes head');
// Roof slab above ground must occlude an elevated opponent viewed from below.
reset();ev('worldSolidBox([],6,2.2,8,7.3,2.5,9,[.2,.3,.4])');
const high={x:9.5,y:3.9,z:8.5};
ok(!context.mpNameTagRayVisible(eye,high),'physical overhead slab occludes raised enemy');
reset();ok(context.mpNameTagRayVisible(eye,target()),'clear opening restores visibility');
// No fake ESP if only the caption position is exposed while the head is hidden.
reset();ev('worldSolidBox([],6,.2,8,7,1.72,9,[.2,.3,.4])');
ok(!context.mpNameTagRayVisible(eye,target()),'head hidden under parapet');
ok(context.mpNameTagRayVisible(eye,target(9.5,2.5,8.5)),'caption may appear above parapet');
ok(context.mpNameTagLayout(actor,camera,rect)===null,'head is occluded even if caption point has clear sky');
// Side slabs, different-floor height, stable distance/alpha and screen limits.
reset();actor.p.x=35;
ok(context.mpNameTagLayout(actor,camera,rect)===null,'far actor hidden to avoid wall-hack');
actor.p.x=9.5;actor.p.hp=0;
ok(context.mpNameTagLayout(actor,camera,rect)===null,'dead actor never has label');actor.p.hp=100;
reset();const left={x:9.5,y:2.1,z:8.5};
const projected=context.mpNameTagProjectWebGL(left,rect);
ok(projected!==null&&Number.isFinite(projected.x)&&Number.isFinite(projected.y),'finite screen projection');
context.glReady=false;
ok(context.mpNameTagProjectCanvas(left,camera,rect)!==null,'Canvas fallback projects same player');
ok(context.mpNameTagProjectCanvas({x:2.5,y:2.1,z:8.5},camera,rect)===null,'Canvas rejects point behind');
// The Canvas raycast uses the same wall/bridge geometry as physics.
context.mapCells[8][7]=1;
ok(!context.mpNameTagRayVisible(eye,target()),'Canvas fallback wall occlusion');
console.log(`Stage131 3D occlusion/projection: ${checks} PASS`);
