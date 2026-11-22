'use strict';
// Ground movement must not route a wide/tall robot through solid steel which
// only a scout can pass. The regression fails on Stage102 production source.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.STAGE_SOURCE_ROOT||path.resolve(__dirname,'..');
const src=n=>fs.readFileSync(path.join(root,'src',n),'utf8');
const N=15;let checks=0,draw=[];
const check=(v,label)=>{assert.ok(v,label);checks++;};
const c={Math,Number,console,Set,Map,Float32Array,Int8Array,Int16Array,Int32Array,Uint8Array,
 touchOnly:false,mapSize:N,mapCells:Array.from({length:N},()=>Array(N).fill(0)),glReady:true,
 worldSolidGrid:[],worldSolidCount:0,game:null,mpMatch:null,sectorStyle:14,worldMapBoss:false,SPRINT_ENERGY_DRAIN:1.8,
 TAU:Math.PI*2,hypot:Math.hypot,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
 save:{settings:{audio:false}},sound:()=>{},toast:()=>{},burst:()=>{},box:(...a)=>draw.push(a),
 input:{},addEventListener:()=>{},useAbility:()=>{},toggleArsenal:()=>{},switchWeapon:()=>{},arsenalOpened:false,navField:null,navClock:0};
vm.createContext(c);
for(const n of ['03-height-and-collision.js','04a-static-world-solids.js',
 '13-enemy-navigation-spawn.js','13a-enemy-world-navigation.js','14-combat-raycast.js','15-mission-system.js','21d-multiplayer-movement.js'])
 vm.runInContext(src(n),c,{filename:n});
const ev=s=>vm.runInContext(s,c);
function reset(){
 c.mapCells=Array.from({length:N},()=>Array(N).fill(0));
 ev(`heightCells=new Float32Array(${N*N});deckCells=new Float32Array(${N*N});
   resetWorldSolids();enemyNavMask=null;navField=null;
   if(typeof groundChassisRevision!=='undefined'){
     groundChassisRevision=null;groundChassisCache.clear();
   }`);
 c.game={nodes:[],devices:[],nodesDestroyed:0,mission:{type:'purge'},enemies:[],
  p:{x:10.5,z:5.5,feetY:0},t:0};draw=[];
}
const scout=(x=4.5,z=5.5)=>({id:1,x,z,feetY:0,type:'scout',radius:.48,airborne:false});
const brute=(x=4.5,z=5.5)=>({id:2,x,z,feetY:0,type:'brute',radius:1.1,airborne:false});
const boss=(x=4.5,z=5.5)=>({id:3,x,z,feetY:0,type:'boss',radius:1.2,boss:true,airborne:false});
const index=(x,z)=>z*N+x;
// Low threshold across the full corridor: visible solid, but walkable.
const profile={radius:.26,height:1.68,key:'26:168'};
const edge=(a=5,b=6)=>c.enemyNavEdge(a,5,b,5);
const steel=(...bounds)=>c.worldSolidBox([], ...bounds,[1,1,1]);
for(const top of [.055,.12,.24]){
 reset();steel(5.9,0,5,6.1,top,6); // between centres
 check(c.worldSolidBodyCollision(6,5.5,.26,0,1.68),'metal is not transparent');
 check(edge(),'low step must be routed through');
 check(edge(6,5),'low step reverse');
 check(c.groundChassisEdge(5,5,6,5,profile,new Int8Array(N*N*4)),'profile edge uses low step');
 check(c.missionGroundField(5.5,5.5)[index(6,5)]===1,'mission graph uses the same low step');
 const e={...scout(5.5,5.5),maxhp:100};c.game.enemies=[e];
 for(let i=0;i<100;i++)c.tryMoveEntity(e,.01,0,.26);
 check(Math.abs(e.x-6.5)<1e-6&&Math.abs(e.feetY)<1e-6,'robot actually crosses and descends');
 reset();steel(6.25,0,5,6.75,top,6);
 check(c.enemyNavTile(6,5),'canonical node on low metal');
 check(Math.abs(c.navStandingFeet(6.5,5.5,profile)-top)<1e-6,'node uses true top');
 check(edge()&&edge(6,5),'edge to supported node bidirectional');
}
reset();steel(5.9,0,5,6.1,.246,6);check(!edge(),'high step remains impassable');
reset();steel(5.9,0,5,6.1,.12,6);steel(5.9,1.75,5,6.1,1.85,6);check(!edge(),'raised body hits low headroom');
reset();steel(5.9,0,5,6.1,.09,6);steel(5.9,.09,5,6.1,.26,6);check(!edge(),'stacked rise exceeds legal step');
// A grazing corner occupies a 1.6cm slice BETWEEN fixed sample positions.
reset();steel(5.555,0,5.7599,5.557,2.0,5.8);
check(c.worldSolidBodyCollision(5.556,5.5,.26,0,1.68),'real brief corner contact');
check(![0,.125,.25,.375,.5,.625,.75,.875,1].some(t=>c.worldSolidBodyCollision(5.5+t,5.5,.26,0,1.68)),'old sample grid misses corner');
check(!edge()&&!edge(6,5),'exact event interval blocks narrow corner');
reset();steel(5.555,0,5.76,5.557,2,5.8);check(edge(),'exact tangency is not a phantom obstruction');
// The upper graph must use the same low support and swept geometry.
reset();ev('for(let z=3;z<8;z++)for(let x=3;x<9;x++)deckCells[z*mapSize+x]=2.2');
steel(5.9,2.2,5,6.1,2.32,6);
check(c.upperDeckEdgeClear(5,5,6,5,2.2,profile),'upper low threshold');
check(c.upperDeckField(7.5,5.5,2.2,profile)[index(5,5)]===2,'upper route direct');
const walker={...scout(5.5,5.5),feetY:2.2,maxhp:100};c.game.enemies=[walker];
for(let i=0;i<100;i++)c.tryMoveEntity(walker,.01,0,.26);
check(Math.abs(walker.x-6.5)<1e-6&&Math.abs(walker.feetY-2.2)<1e-6,'actual robot descends from metal onto suspended deck');
steel(5.555,2.2,5.7599,5.557,4.5,5.8);
check(!c.upperDeckEdgeClear(5,5,6,5,2.2,profile),'upper tiny corner detected after topology change');
// A lightweight edge grid is shared across target changes, but geometry
// insertion must force a fresh grid (not simply reuse an old path).
reset();const b=brute();c.groundChassisField(b,c.game.p);
const key=c.upperDeckProfile(b).key,first=ev(`groundChassisEdges.get('${key}')`);
c.groundChassisField(b,{x:9.5,z:5.5});check(first===ev(`groundChassisEdges.get('${key}')`),'reuse profile edges across target movement');
steel(6.2,0,5.2,6.8,3,5.8);c.groundChassisField(b,c.game.p);
check(first!==ev(`groundChassisEdges.get('${key}')`),'new steel invalidates profile edges');
// Solo and PvP must descend the same actual 12cm elevated threshold.
reset();ev('for(let z=3;z<8;z++)for(let x=3;x<9;x++)deckCells[z*mapSize+x]=2.2');
steel(5.9,2.2,5,6.1,2.32,6);
let human={x:5.5,z:5.5,feetY:2.2,grounded:true,flying:false,energy:100,vy:0};c.game.p=human;
for(let i=0;i<100;i++)c.tryMoveEntity(human,.01,0,.23);
check(Math.abs(human.x-6.5)<1e-6&&Math.abs(human.feetY-2.2)<1e-6&&human.grounded,'solo descends onto bridge');
human={x:5.5,z:5.5,feetY:2.2,grounded:true,flying:false,energy:100,vy:0};c.game=null;
for(let i=0;i<10;i++)c.mpMatchMove(human,{mx:0,mz:1,yaw:Math.PI/2,pitch:0,s:false,j:false},1/30);
check(human.x>6.5&&Math.abs(human.feetY-2.2)<1e-6&&human.grounded,'PvP descends onto bridge');
reset();let mf=c.missionField(c.game.p),wf=c.missionWaypointGroundField(c.game.p);
steel(6.2,0,5.2,6.8,3,5.8);
check(c.missionField(c.game.p)!==mf&&c.missionWaypointGroundField(c.game.p)!==wf,'guidance refreshes after actual metal insertion');
// While moving vertically the same XZ path may acquire new head contact.
reset();steel(6,1.8,5,6.25,2,6);
let bot=scout(5.5,5.5),target={x:7.5,z:5.5,feetY:0};
check(c.enemyDirectRoute(bot,target),'short scout clear below beam');
bot.feetY=.3;bot.airborne=true;
check(!c.enemyDirectRoute(bot,target),'direct path cache must not reuse different altitude');
check(!Object.hasOwn(bot,'navSeenRevision')&&JSON.stringify(bot).length<1024,'transient world registry never serialized into checkpoint');
console.log(`Stage111 contact-interval ground/upper navigation: ${checks} PASS`);
