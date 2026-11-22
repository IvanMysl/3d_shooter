// Integration with the actual procedural WebGL scene builder. A stub renderer
// records boxes but does not need a video card; all geometry coordinates come
// from src/05-world-mesh.js (not a hand-written duplicate).
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../src');
const file=n=>fs.readFileSync(path.join(root,n),'utf8');
const N=34,tiles=Array.from({length:N},()=>Array(N).fill(0));
for(let i=0;i<N;i++)tiles[0][i]=tiles[N-1][i]=tiles[i][0]=tiles[i][N-1]=1;
for(let z=4;z<=7;z++)tiles[z][4]=1;
const deck=new Float32Array(N*N),ground=new Float32Array(N*N);
for(let z=14;z<18;z++)for(let x=14;x<20;x++)deck[z*N+x]=2.2;
for(let z=11;z<14;z++)for(let x=14;x<20;x++)ground[z*N+x]=.65;
const rooms=Array.from({length:12},(_,i)=>({x:6+i*2,z:7+i*2,w:11,h:11}));
let rendered=0;
const ctx={console,Math,Number,Set,Map,Float32Array,
 mapSize:N,mapCells:tiles,glReady:true,touchOnly:false,
 gl:{deleteBuffer(){}},worldMesh:null,worldChunks:[],meshStats:{},
 toMesh:v=>({b:{},n:v.length/10}),box:()=>{rendered++},quad:()=>{},
 rcolor:v=>v,buildFloorDecal:()=>{},
 deckAtCell:(x,z)=>deck[z*N+x]||0,
 floorHeightAtCell:(x,z)=>ground[z*N+x]||0,
 ceilingHeight:()=>5.6,
 save:{settings:{quality:2}},
 themes:Array.from({length:18},()=>({wall:[.2,.2,.2],floor:[.1,.1,.1],accent:[.7,.3,.2]})),
 sectorStyle:15,mapRooms:rooms,mapFeatures:[],landmarkSpecs:[],
 landmarkCells:()=>[],spawnX:16.5,spawnZ:16.5,
 portal:{x:19.5,z:19.5},TAU:Math.PI*2,
 clamp:(x,a,b)=>Math.max(a,Math.min(b,x))
};
vm.createContext(ctx);
vm.runInContext(file('04a-static-world-solids.js')+file('05-world-mesh.js')+file('14-combat-raycast.js'),ctx);
const check=source=>vm.runInContext(source,ctx);
const scene=style=>{ctx.sectorStyle=style;check('createWorldMesh(5)');return check('worldSolidStats()');};
let stats=scene(15);
assert.ok(stats.boxes>500&&stats.gridReferences>stats.boxes,JSON.stringify(stats));
assert.ok(rendered>stats.boxes,`Expected all meshes (incl. paint) to be emitted: ${rendered} vs ${stats.boxes}`);
// Rail at upper level exists physically, and cannot be tunneled through even
// by a boss projectile with a nonzero sphere radius.
let hit=check('rayWall({x:15.5,y:2.86,z:14.50},{x:0,y:0,z:-1},2)');
assert.equal(hit.kind,'structure');assert.ok(Math.abs(hit.z-14.028)<.0001);
hit=check('sweepWorldSphere({x:15.5,y:3.03,z:14.50},{x:0,y:0,z:-1},2,.20)');
assert.equal(hit.kind,'structure');
assert.ok(Math.abs(hit.y-2.90)<.001,'Sphere contact should be on rail top');
// On the upper bridge there is now enough headroom; adjacent rails still stop
// the player, without introducing phantom obstructions in the lower passage.
assert.equal(check('worldSolidBodyCollision(15.5,16.5,.23,2.2,1.95)'),false);
assert.equal(check('worldSolidBodyCollision(15.5,14.02,.23,2.2,1.95)'),true);
assert.equal(check('worldSolidBodyCollision(15.5,16.5,.23,0,1.95)'),false);
// Reloading after changing quality must NOT keep stale boxes from last build.
const highCount=stats.boxes;
ctx.save.settings.quality=0;stats=scene(15);
assert.ok(stats.boxes>40&&stats.boxes<highCount);
assert.equal(check('worldSolidBodyCollision(15.5,16.5,.23,2.2,1.95)'),false);
// Staircase variants are generated from the same floor map. Extra dressing
// should not cover the elevated approach route after scene clearance.
ctx.save.settings.quality=2;stats=scene(4);
assert.ok(stats.boxes>100);
assert.equal(check('worldSolidBodyCollision(16.5,12.5,.23,.65,1.95)'),false);
// Different high-bridge thematic styles still preserve required passage.
for(const style of [14,16,17]){
 stats=scene(style);
 assert.ok(stats.boxes>500,`Missing geometry in style ${style}`);
 assert.equal(check('worldSolidBodyCollision(15.5,16.5,.23,2.2,1.95)'),false,
    `Bridge blocked in style ${style}`);
}
console.log('SCENE SOLIDITY: actual world meshes, railings, thick projectiles, navigation clearance, quality rebuild and 5 themes passed');
