'use strict';
// V83: 100 genuinely physical extraction defenses, preserving every old
// campaign route and the exact renderer/body/projectile collision agreement.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=n=>fs.readFileSync(path.join(__dirname,'../src',n),'utf8');
let checks=0;function check(v,msg){assert.ok(v,msg);checks++;}
const draws=[];
const c={Math,console,Float32Array,Int16Array,Int32Array,Int8Array,Uint8Array,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),
 rand:(a,b)=>a+Math.random()*(b-a),mapSize:0,mapCells:[],mapRooms:[],mapFeatures:[],
 legacyResumeSector:-1,legacyResumeDivisor:18,glReady:false,touchOnly:false,
 gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:(dst,...args)=>{draws.push(args.slice(0,6));},quad:()=>{},rcolor:v=>v,
 save:{settings:{quality:0,audio:false}},sound:()=>{},burst:()=>{},
 input:{jumpQueued:false},arsenalOpened:false,
 themes:Array.from({length:18},()=>({wall:[.25,.29,.32],floor:[.15,.18,.2],accent:[.2,.8,.75]})),
 enemies:{scout:{hp:100,radius:.48,speed:1,damage:5,range:10,color:[1,.5,.2],score:5}},
 bossNames:['БОСС'],robotPalette:()=>({}),toast:()=>{},game:null,navField:null,navClock:0};
vm.createContext(c);
for(const name of ['03-height-and-collision.js','04a-static-world-solids.js',
 '04-map-generation.js','05-world-mesh.js','13-enemy-navigation-spawn.js',
 '13a-enemy-world-navigation.js','14-combat-raycast.js'])
 vm.runInContext(src(name),c,{filename:name});
const ev=e=>vm.runInContext(e,c);
const zlib=require('node:zlib'),crypto=require('node:crypto');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'stage82_map_baseline.json')));
function hash(value){return crypto.createHash('sha256').update(value).digest('hex')}
let additions=0;const byLevel=[];
const first=Math.max(1,Number(process.env.FIRST||1)),last=Math.min(100,Number(process.env.LAST||100));
for(const old of fixture.mapStages){
 if(old.level<first||old.level>last)continue;
 c.glReady=false;c.buildMap(old.level);
 check(c.mapSize===old.size,`L${old.level}: terrain dimensions changed`);
 check(c.portal.x===old.portal[0]&&c.portal.z===old.portal[1],
  `L${old.level}: old extraction site moved`);
 for(const name of ['tacticalZone','secondaryYard','bossCourtPlan','ordinaryCourtPlan',
  'relayFortPlan','heightCells','deckCells','stairStages']){
   const current=hash(ev(`JSON.stringify(${name})`));
   check(current===old[name],`L${old.level}: old ${name} changed`);
 }
 const previous=zlib.inflateRawSync(Buffer.from(old.grid,'base64'));
 const now=Buffer.from(c.mapCells.flat());
 check(now.length===previous.length,`L${old.level}: changed map dimension`);
 const planned=new Set(ev('extractionCourtPlan.tiles').map(p=>p.z*c.mapSize+p.x));
 let delta=0;
 for(let i=0;i<now.length;i++){
   if(previous[i]===now[i])continue;
   check(previous[i]===0&&now[i]===1,
    `L${old.level}: existing wall removed at cell ${i}`);
   check(planned.has(i),`L${old.level}: unexpected physical change at cell ${i}`);
   delta++;
 }
 check(delta===planned.size,`L${old.level}: physical plan not exactly installed`);
 additions+=delta;byLevel.push(delta);
}
console.log(JSON.stringify({status:'PASS',checks,baseMaps:byLevel.length,
 additions,min:Math.min(...byLevel),max:Math.max(...byLevel)}));
