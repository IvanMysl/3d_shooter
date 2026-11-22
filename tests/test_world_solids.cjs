// Stage 3: verify real geometry solids, spatial indexing, sweeps, roof holes,
// ray impacts, decal clipping, and no invisible collision in Canvas fallback.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../src');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
const tiles=Array.from({length:16},()=>Array(16).fill(0));
for(let i=0;i<16;i++)tiles[0][i]=tiles[15][i]=tiles[i][0]=tiles[i][15]=1;
const drawCalls=[];
const game={decals:[],enemies:[]};
const context={console,Math,Set,Number,Array,Map,Float32Array,
  mapSize:16,mapCells:tiles,glReady:true,game,gl:{deleteBuffer(){}},
  ceilingHeight:()=>4.25,floorHeightAtCell:()=>0,deckAtCell:()=>0,
  box:(...args)=>drawCalls.push(args),
  toMesh:verts=>({b:{},n:verts.length/10,verts:verts.slice()}),
  addTri:(verts,a,b,c)=>verts.push(...a,...b,...c),
  TAU:Math.PI*2, save:{settings:{quality:2}},
};
vm.createContext(context);
vm.runInContext(read('04a-static-world-solids.js'),context);
const ray=read('14-combat-raycast.js');
vm.runInContext('let decalMesh=null,decalDirty=true;\n'+ray.slice(ray.indexOf('function clipDecalPoly('),ray.indexOf('function rayEnemy(')),context);
const v=(x,y,z)=>({x,y,z});
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
const beam=(...b)=>context.worldSolidBox([], ...b, [.3,.4,.5]);
context.resetWorldSolids();
assert.equal(context.worldSolidStats().boxes,0);
// A handrail extends into two adjacent tile buckets; ray detects the exact face.
beam(5.08,2.82,6.95,5.92,2.90,7.05);
assert.equal(drawCalls.length,1);
assert.equal(context.worldSolidStats().boxes,1);
assert.ok(context.worldSolidStats().gridReferences>=2);
let h=context.rayWall(v(5.5,2.85,6.0),v(0,0,1),3);
assert.equal(h.kind,'structure');approx(h.z,6.95);assert.equal(h.nz,-1);
// Camera ray cast against handrail intersects the same actual obstacle.
h=context.rayWall(v(5.5,2.85,8.0),v(0,0,-1),3);
assert.equal(h.kind,'structure');approx(h.z,7.05);assert.equal(h.nz,1);
// Rail can also stop swept enemy bullets, not just hitscan weapons.
h=context.rayWall(v(5.5,2.85,6.94),v(0,0,1),.10);
assert.ok(h&&h.t<.02);
// A column standing under a bridge blocks shots even though tile is walkable.
beam(8.04,0,8.08,8.20,2.03,8.26);
h=context.rayWall(v(7.5,1.04,8.17),v(1,0,0),3);
assert.equal(h.kind,'structure');approx(h.x,8.04);
// Full ceiling is NOT a solid in WebGL where the roof is actually open.
assert.equal(context.rayWall(v(10.5,3.8,10.5),v(0,1,0),3),null);
context.registerWorldSolid(10,4.34,10,11,4.38,11,'ceiling');
h=context.rayWall(v(10.5,3.8,10.5),v(0,1,0),3);
assert.equal(h.kind,'ceiling');approx(h.y,4.34);
// Far-away objects should not stop a short ray in a different bucket.
assert.equal(context.rayWall(v(2.5,1.6,2.5),v(1,0,0),2),null);
// Segment precisely touching the front face counts, but one shorter does not.
h=context.rayWall(v(7.5,1.04,8.17),v(1,0,0),.54);
assert.ok(h&&h.t<=.54);
assert.equal(context.rayWall(v(7.5,1.04,8.17),v(1,0,0),.53),null);
// Thick balls hit with their radius even when their center ray misses.
h=context.sweepWorldSphere(v(5.5,3.03,6.0),v(0,0,1),3,.20);
assert.equal(h.kind,'structure');approx(h.y,2.90);
assert.ok(h.t<1.0,'Sphere must contact rail before its center crosses');
// Explosions from inside a solid are projected onto a real face.
h=context.sweepWorldSphere(v(8.10,1.2,8.17),v(1,0,0),.30,.20);
assert.equal(h.kind,'structure');approx(h.x,8.04);
// Under a bridge, the player's head is stopped at the metal underside.
context.registerWorldSolid(11,2.03,11,12,2.2,12,'bridge');
assert.equal(context.worldSolidHeadBarrier(11.5,11.5,.23,1.96,2.10),2.03);
assert.equal(context.worldSolidBodyCollision(11.5,11.5,.23,0,1.95),false);
assert.equal(context.worldSolidBodyCollision(11.5,11.5,.23,.12,1.95),true);
// The contact origin inside a piece must not tunnel through.
h=context.rayWall(v(8.10,1,8.17),v(1,0,0),.4);approx(h.t,0);
// Mark polygon projection is clipped against actual thin rail face, not a full cell.
game.decals=[{x:5.5,y:2.85,z:6.925,nx:0,ny:0,nz:-1,r:.25,rot:.1,
  energy:false,bounds:[5.08,2.82,6.95,5.92,2.90,7.05]}];
vm.runInContext('rebuildDecalMesh()',context);
const vertices=vm.runInContext('decalMesh.verts',context);
assert.ok(vertices.length>0,'Expected clipped triangles');
for(let i=0;i<vertices.length;i+=3){
 assert.ok(vertices[i]>=5.08-1e-6 && vertices[i]<=5.92+1e-6);
 assert.ok(vertices[i+1]>=2.82-1e-6 && vertices[i+1]<=2.90+1e-6);
}
// An initial no-GL fallback must keep its previous simplified ceiling, not
// make the hidden WebGL-only rail a collision object.
context.glReady=false;context.resetWorldSolids();
beam(5.08,2.82,6.95,5.92,2.90,7.05);
assert.equal(context.worldSolidStats().boxes,0);
assert.equal(context.rayWall(v(5.5,2.85,6.0),v(0,0,1),3),null);
h=context.rayWall(v(10.5,3.8,10.5),v(0,1,0),3);
assert.equal(h.kind,'ceiling');
// Rebuilding a map or switching quality never leaves phantom old boxes.
context.glReady=true;context.resetWorldSolids();
assert.equal(context.worldSolidStats().boxes,0);
assert.equal(context.rayWall(v(5.5,2.85,6.0),v(0,0,1),3),null);
const mesh=read('05-world-mesh.js');
// Stage 12 deliberately converts three walkable stair accent call sites to
// visual-only box(): these ~1 cm tread trims must not block the operator.
// Stage50 adds genuine side-rail primitives. Stage54 adds a single shared
// terrace-cover primitive; Stage55 adds a reusable roofed-room primitive;
// Stage58 adds one for roof battlements; Stage59 adds the physical passage gate.
// V61 adds new genuinely solid landmark towers/cranes and boss vaults. Keep
// the historical minimum, but allow further physical architecture to grow.
assert.ok((mesh.match(/worldSolidBox\(v,/g)||[]).length>=197,
 'a structural rendering/collision call site silently disappeared');
assert.ok(mesh.includes('box(v,x+.12,stepY+.003'));
assert.ok(mesh.includes('box(v,x+.86,stepY+.003'));
assert.ok(mesh.includes('registerWorldSolid(x,roofH+.09,z'));
console.log('WORLD SOLIDS: 24 collision/decal/bridge/rebuild checks passed');
