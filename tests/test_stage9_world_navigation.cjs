// Stage 9: generated 3D bridges, ramps and rails feed NPC movement directly.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../src');const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const N=34,cells=Array.from({length:N},(_,z)=>Array.from({length:N},(_,x)=>x===0||z===0||x===N-1||z===N-1?1:0));
for(let z=4;z<=7;z++)cells[z][4]=1;
const rooms=Array.from({length:12},(_,i)=>({x:6+i*2,z:7+i*2,w:11,h:11}));
const context={console,Math,Number,Set,Map,Int8Array,Int16Array,Float32Array,
 mapSize:N,mapCells:cells,glReady:true,touchOnly:false,gl:{deleteBuffer(){}},
 worldMesh:null,worldChunks:[],meshStats:{},toMesh:v=>({b:{},n:v.length/10}),
 box:()=>{},quad:()=>{},rcolor:v=>v,buildFloorDecal:()=>{},
 save:{settings:{quality:2,audio:false}},
 themes:Array.from({length:18},()=>({wall:[.2,.2,.2],floor:[.1,.1,.1],accent:[.7,.3,.2]})),
 sectorStyle:15,mapRooms:rooms,mapFeatures:[],spawnX:16.5,spawnZ:16.5,portal:{x:19.5,z:19.5},
 TAU:Math.PI*2,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),hypot:Math.hypot,
 input:{jumpQueued:false}, navField:null,navClock:0,
 game:{p:{x:16.5,z:16.5,feetY:2.2},t:0}};
vm.createContext(context);
vm.runInContext(read('03-height-and-collision.js')+read('04a-static-world-solids.js')+
 read('05-world-mesh.js')+read('13-enemy-navigation-spawn.js')+
 read('13a-enemy-world-navigation.js'),context);
vm.runInContext(`heightCells=new Float32Array(mapSize*mapSize);
 deckCells=new Float32Array(mapSize*mapSize);
 for(let z=14;z<18;z++)for(let x=14;x<20;x++)deckCells[z*mapSize+x]=2.2;
 for(let z=11;z<14;z++)for(let x=14;x<20;x++)heightCells[z*mapSize+x]=.65;
 bridgeSpecs=[{x:16.5,z:16.5,y:2.2,width:7,length:11,stairRun:10,underpass:true}];`,context);
const probe=code=>vm.runInContext(code,context);
let n=0;const check=(v,m)=>{assert.ok(v,m);n++;};
const bot=(x,z,feetY,type='scout',radius=.55)=>({id:2,x,z,feetY,type,radius,maxhp:100,boss:type==='boss',orbit:1});
for(const quality of [0,2]){
 context.save.settings.quality=quality;
 for(const style of [14,15,16,17]){
  context.sectorStyle=style;context.createWorldMesh(5);
  const open=bot(15.5,16.5,2.2);
  check(context.enemyCanOccupy(open,15.7,16.5,.25),`upper deck blocked quality=${quality} style=${style}`);
  const underneath=bot(15.5,13.5,0);
  check(context.enemyCanOccupy(underneath,15.5,16.5,.25),`underpass blocked quality=${quality} style=${style}`);
  const boss=bot(15.5,13.5,0,'boss',1.03);
  check(!context.enemyCanOccupy(boss,15.5,16.5,.45),`boss crossed underside quality=${quality} style=${style}`);
  context.rebuildNavigation();
  const before=bot(15.5,14.5,2.2);
  context.enemyMove(before,0,-2.5,.25);
  check(before.z>14.2,`robot tunneled through bridge edge rail: ${before.z}`);
  check(!context.worldSolidBodyCollision(before.x,before.z,.25,before.feetY,context.enemyBodyHeight(before)),
    'robot ended inside mesh');
 }
}
console.log(`STAGE9 WORLD NAV: ${n} checks on real mesh generated in 8 quality/theme combinations`);
