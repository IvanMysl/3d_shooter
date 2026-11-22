
// --- Ballistics and impact effects. All calculations are in the level's world space. ---
const MAX_WALL_MARKS=touchOnly?115:230;

let decalMesh=null,decalDirty=true;
function clipDecalPoly(poly,coord,min,max){
 const inside=(p,b,isMin)=>isMin?p[coord]>=b-1e-7:p[coord]<=b+1e-7;
 for(const [bound,isMin] of [[min,true],[max,false]]){
  const out=[];
  for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length],ain=inside(a,bound,isMin),bin=inside(b,bound,isMin);
   if(ain)out.push(a);
   if(ain!==bin){const den=b[coord]-a[coord],t=Math.abs(den)>1e-12?(bound-a[coord])/den:0;
    out.push({u:a.u+(b.u-a.u)*t,v:a.v+(b.v-a.v)*t});}
  }
  poly=out;if(poly.length<3)return [];
 }
 return poly;
}
function rebuildDecalMesh(){
 decalDirty=false;
 if(!glReady||!game)return;
 if(decalMesh){gl.deleteBuffer(decalMesh.b);decalMesh=null;}
 const vertices=[];
 for(const mark of game.decals){
  const n=[mark.nx,mark.ny,mark.nz],c=[mark.x,mark.y,mark.z],r=mark.r;
  const axis= Math.abs(mark.nx)>.5?'x':Math.abs(mark.ny)>.5?'y':'z';
  const U=axis==='x'?[0,0,1]:[1,0,0];
  const V=axis==='y'?[0,0,1]:[0,1,0];
  const x=Number.isInteger(mark.cellX)?mark.cellX:Math.floor(mark.x-.001*mark.nx);
  const z=Number.isInteger(mark.cellZ)?mark.cellZ:Math.floor(mark.z-.001*mark.nz);
  // Rectangular face bounds in the decal's local (u,v) plane.
  const cu=c[0]*U[0]+c[1]*U[1]+c[2]*U[2];
  const cv=c[0]*V[0]+c[1]*V[1]+c[2]*V[2];
  const umin=(axis==='x'?z:x)-cu,umax=umin+1;
  const vmin=(axis==='y'?z:0)-cv;
  const vmax=(axis==='y'?z+1:mark.kind==='stairs'?floorHeightAtCell(x,z):ceilingHeight())-cv;
  let bounds=[umin,umax,vmin,vmax];
  if(mark.bounds){
   // Thin rails, pillars and boxes clip impact marks to their true face.
   const b=mark.bounds;
   const uAxis=axis==='x'?2:0,vAxis=axis==='y'?2:1;
   bounds=[b[uAxis]-cu,b[uAxis+3]-cu,b[vAxis]-cv,b[vAxis+3]-cv];
  }
  if(bounds[3]<=bounds[2]+1e-5)continue;
  const outline=mark.energy?[.16,.065,.035]:[.065,.061,.058],dark=[.008,.009,.012];
  const point=(a,size)=>({u:Math.cos(a)*size,v:Math.sin(a)*size});
  const emit=(poly,color,glow)=>{
   poly=clipDecalPoly(poly,'u',bounds[0],bounds[1]);
   if(poly.length<3)return;
   poly=clipDecalPoly(poly,'v',bounds[2],bounds[3]);
   if(poly.length<3)return;
   const world=q=>[c[0]+U[0]*q.u+V[0]*q.v,c[1]+U[1]*q.u+V[1]*q.v,c[2]+U[2]*q.u+V[2]*q.v];
   for(let i=1;i<poly.length-1;i++)addTri(vertices,world(poly[0]),world(poly[i]),world(poly[i+1]),n,color,glow);
  };
  for(let i=0;i<12;i++){
   const a=TAU*i/12+mark.rot,b=TAU*(i+1)/12+mark.rot;
   const A=r*(.94+.12*Math.sin(i*7.23+mark.rot)),B=r*(.94+.12*Math.sin((i+1)*7.23+mark.rot));
   const p1=point(a,A),p2=point(b,B),q1=point(a,A*.65),q2=point(b,B*.65);
   emit([p1,p2,q1],outline,mark.energy?.035:0);
   emit([p2,q2,q1],outline,mark.energy?.035:0);
   emit([{u:0,v:0},q1,q2],dark,0);
  }
 }
 if(vertices.length)decalMesh=toMesh(vertices);
}
function v3(x,y,z){return{x,y,z}}
// Exact swept collision against the visible stair/ground tiles, walls and bridge plates.
// A wall, riser, stair top and bridge underside are all finite solid volumes.
function rayAABB(o,d,maxDist,x0,y0,z0,x1,y1,z1){
 let enter=-Infinity,exit=Infinity,nx=0,ny=0,nz=0;
 for(const [axis,lo,hi] of [['x',x0,x1],['y',y0,y1],['z',z0,z1]]){
  const v=d[axis],s=o[axis];
  if(Math.abs(v)<1e-10){if(s<lo-1e-8||s>hi+1e-8)return null;continue;}
  let a=(lo-s)/v,b=(hi-s)/v,sign=v>0?-1:1;
  if(a>b){const tmp=a;a=b;b=tmp;}
  if(a>enter){enter=a;nx=axis==='x'?sign:0;ny=axis==='y'?sign:0;nz=axis==='z'?sign:0;}
  exit=Math.min(exit,b);if(exit+1e-9<enter)return null;
 }
 if(exit<0||enter>maxDist)return null;
 if(enter<=0){
  // Firing from inside a collider must not let shots escape before hitting it.
  const k=Math.max(Math.abs(d.x),Math.abs(d.y),Math.abs(d.z));
  nx=Math.abs(d.x)===k?-Math.sign(d.x):0;ny=Math.abs(d.y)===k?-Math.sign(d.y):0;nz=Math.abs(d.z)===k?-Math.sign(d.z):0;
 }
 return {t:Math.max(0,enter),nx,ny,nz};
}
// When a projectile is born *inside* a solid (e.g. at the lip of a stair),
// attach its impact to the nearest actual outward face. Using the shot's
// direction chooses distant side faces on long, thin floor/stair volumes.
function embeddedSolidSurface(o,b){
 const epsilon=1e-8;
 if(o.x<b[0]-epsilon||o.x>b[3]+epsilon||o.y<b[1]-epsilon||
    o.y>b[4]+epsilon||o.z<b[2]-epsilon||o.z>b[5]+epsilon)return null;
 const faces=[
  {distance:o.x-b[0],axis:'x',value:b[0],nx:-1,ny:0,nz:0},
  {distance:b[3]-o.x,axis:'x',value:b[3],nx:1,ny:0,nz:0},
  {distance:o.y-b[1],axis:'y',value:b[1],nx:0,ny:-1,nz:0},
  {distance:b[4]-o.y,axis:'y',value:b[4],nx:0,ny:1,nz:0},
  {distance:o.z-b[2],axis:'z',value:b[2],nx:0,ny:0,nz:-1},
  {distance:b[5]-o.z,axis:'z',value:b[5],nx:0,ny:0,nz:1}
 ];
 faces.sort((a,b)=>a.distance-b.distance);
 const face=faces[0];
 return {...o,[face.axis]:face.value,nx:face.nx,ny:face.ny,nz:face.nz};
}
// Precise continuous collision of a finite-radius sphere with a box.
// Expanding the box and tracing a point (the usual broadphase) is NOT exact:
// it treats the square space around its edges/corners as solid and can make
// plasma balls explode while visibly missing a handrail. The distance to a
// box is piecewise quadratic as the center crosses each of its six planes.
// Solve those short intervals exactly; the fast face path costs one AABB test.
function sweptSphereAABB(o,d,maxDist,b,radius){
 const r=Math.max(0,Number(radius)||0);
 if(r<1e-8)return rayAABB(o,d,maxDist,...b);
 const expanded=rayAABB(o,d,maxDist,b[0]-r,b[1]-r,b[2]-r,b[3]+r,b[4]+r,b[5]+r);
 if(!expanded)return null;
 const axes=[['x',0,3],['y',1,4],['z',2,5]];
 const nearest=(t)=>{
  const c={x:o.x+d.x*t,y:o.y+d.y*t,z:o.z+d.z*t};
  const p={x:clampNumber(c.x,b[0],b[3]),y:clampNumber(c.y,b[1],b[4]),z:clampNumber(c.z,b[2],b[5])};
  const n={x:c.x-p.x,y:c.y-p.y,z:c.z-p.z};
  return {p,n,dist2:n.x*n.x+n.y*n.y+n.z*n.z};
 };
 function clampNumber(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
 const EPS=1e-9,rr=r*r;
 let t=expanded.t,contact=nearest(t);
 if(contact.dist2>rr+EPS){
  const cuts=[t,maxDist];
  for(const [axis,lo,hi] of axes){
   const speed=d[axis];if(Math.abs(speed)<1e-12)continue;
   for(const edge of [b[lo],b[hi]]){
    const q=(edge-o[axis])/speed;
    if(q>t+1e-10&&q<maxDist-1e-10)cuts.push(q);
   }
  }
  cuts.sort((a,b)=>a-b);
  let entry=null;
  for(let k=0;k<cuts.length-1;k++){
   const a=cuts[k],end=cuts[k+1];if(end-a<1e-11)continue;
   const mid=(a+end)*.5;
   let A=0,B=0,C=-rr;
   for(const [axis,lo,hi] of axes){
    const v=o[axis]+d[axis]*mid;
    const edge=v<b[lo]?b[lo]:v>b[hi]?b[hi]:null;
    if(edge===null)continue;
    const u=o[axis]-edge,w=d[axis];
    A+=w*w;B+=u*w;C+=u*u;
   }
   const f=a=>A*a*a+2*B*a+C;
   if(f(a)<=EPS){entry=a;break;}
   if(A<1e-12)continue;
   const discriminant=B*B-A*C;
   if(discriminant<0)continue;
   const q=(-B-Math.sqrt(Math.max(0,discriminant)))/A;
   if(q>=a-1e-8&&q<=end+1e-8){entry=Math.max(a,q);break;}
  }
  if(entry===null)return null; // a path through a corner of the inflated box only
  t=entry;contact=nearest(t);
  if(contact.dist2>rr+1e-6)return null;
 }
 const mag=Math.sqrt(contact.dist2);
 if(t<=1e-8){
  const surface=embeddedSolidSurface(o,b);
  if(surface)return {t:0,...surface};
 }
 return {t,
  nx:mag>1e-7?contact.n.x/mag:expanded.nx,
  ny:mag>1e-7?contact.n.y/mag:expanded.ny,
  nz:mag>1e-7?contact.n.z/mag:expanded.nz,
  x:contact.p.x,y:contact.p.y,z:contact.p.z};
}
function rayWall(o,d,maxDist){
 if(!(maxDist>0))return null;
 let cx=Math.floor(o.x),cz=Math.floor(o.z);
 const sx=d.x>0?1:-1,sz=d.z>0?1:-1;
 const deltaX=Math.abs(d.x)>1e-10?1/Math.abs(d.x):Infinity;
 const deltaZ=Math.abs(d.z)>1e-10?1/Math.abs(d.z):Infinity;
 let tx=Number.isFinite(deltaX)?(d.x>0?cx+1-o.x:o.x-cx)*deltaX:Infinity;
 let tz=Number.isFinite(deltaZ)?(d.z>0?cz+1-o.z:o.z-cz)*deltaZ:Infinity;
 let travelled=0;
 for(let i=0;i<Math.min(250,Math.ceil(maxDist*3)+4);i++){
  const segmentEnd=Math.min(maxDist,tx,tz),inside=cx>=0&&cz>=0&&cx<mapSize&&cz<mapSize;
  const wall=!inside||mapCells[cz]?.[cx]===1;
  const candidates=[];
  if(wall)candidates.push({box:[cx,0,cz,cx+1,ceilingHeight(),cz+1],kind:'wall'});
  else{
   const h=floorHeightAtCell(cx,cz);
   candidates.push({box:[cx,-100,cz,cx+1,h,cz+1],kind:h>.001?'stairs':'floor'});
   const deck=deckAtCell(cx,cz);
   if(deck>0)candidates.push({box:[cx,deck-.17,cz,cx+1,deck,cz+1],kind:'bridge'});
   // Canvas fallback uses a simple enclosed roof. In WebGL, roof tiles
   // and other solid details are captured from the actual drawn geometry.
   if(!glReady)candidates.push({box:[cx,ceilingHeight()+.10,cz,cx+1,ceilingHeight()+2,cz+1],kind:'ceiling'});
  }
  let best=null;
  for(const ob of candidates){
   const h=rayAABB(o,d,maxDist,...ob.box);
   if(!h||h.t>segmentEnd+1e-7||h.t+1e-7<travelled)continue;
   if(!best||h.t<best.t)best={...h,kind:ob.kind,cellX:cx,cellZ:cz,box:ob.box};
  }
  // The same broadphase grid is shared with the rendered box geometry.
  if(inside)best=worldSolidRayCell(o,d,segmentEnd,travelled,cx,cz,best);
  if(best){
   const impact={...best,x:o.x+d.x*best.t,y:o.y+d.y*best.t,z:o.z+d.z*best.t};
   if(impact.t<=1e-8){
    const surface=embeddedSolidSurface(o,impact.solid?.box||impact.box);
    if(surface)Object.assign(impact,surface);
   }
   return impact;
  }
  if(segmentEnd>=maxDist||!Number.isFinite(segmentEnd))break;
  travelled=segmentEnd;
  if(tx<=tz){cx+=sx;tx+=deltaX;}else{cz+=sz;tz+=deltaZ;}
 }
 return null;
}
// Continuous collision for finite-radius enemy plasma bolts and rockets.
// Sweeps the projectile center against each candidate solid expanded by its
// radius (Minkowski AABB). Spatial broadphase is the short segment's swept
// 2D bounds, including neighboring cells so railings and corners cannot tunnel.
function sweepWorldSphere(o,d,maxDist,radius){
 if(!(maxDist>0))return null;
 const r=Math.max(0,Math.min(.48,Number(radius)||0));
 if(r<.001)return rayWall(o,d,maxDist);
 const end={x:o.x+d.x*maxDist,y:o.y+d.y*maxDist,z:o.z+d.z*maxDist};
 const x0=Math.max(-1,Math.floor(Math.min(o.x,end.x)-r));
 const x1=Math.min(mapSize,Math.floor(Math.max(o.x,end.x)+r));
 const z0=Math.max(-1,Math.floor(Math.min(o.z,end.z)-r));
 const z1=Math.min(mapSize,Math.floor(Math.max(o.z,end.z)+r));
 let best=null;
 const seen=new Set();
 const test=(b,kind,cx,cz,solid=null)=>{
  const hit=sweptSphereAABB(o,d,maxDist,b,r);
  if(!hit||(best&&hit.t>=best.t-1e-8))return;
  // Starting embedded in a solid: use the closest *real* face, never
  // the shot-axis face far away inside a long floor slab.
  if(hit.t<=1e-8){
   const surface=embeddedSolidSurface(o,b);
   if(surface)Object.assign(hit,surface);
  }
  best={...hit,kind,cellX:cx,cellZ:cz,box:b,solid,node:solid?.node||null};
 };
 for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
  const inside=x>=0&&z>=0&&x<mapSize&&z<mapSize;
  if(!inside||mapCells[z]?.[x]===1){
   test([x,0,z,x+1,ceilingHeight(),z+1],'wall',x,z);
  }else{
   const h=floorHeightAtCell(x,z);
   test([x,-100,z,x+1,h,z+1],h>.001?'stairs':'floor',x,z);
   const deck=deckAtCell(x,z);
   if(deck>0)test([x,deck-.17,z,x+1,deck,z+1],'bridge',x,z);
   if(!glReady)test([x,ceilingHeight()+.10,z,x+1,ceilingHeight()+2,z+1],'ceiling',x,z);
  }
  // V77: worldSolidBox also draws frames, roof braces and overhangs in
  // otherwise SOLID wall cells. Hitscan already checks those volumes there.
  // A swept rocket must do so as well, including parts ABOVE the map wall's
  // ceiling (where the wall itself would not stop the projectile). A wall
  // bucket is not permission to skip its registered 3D geometry.
  if(inside){
   for(const solid of [...(glReady?(worldSolidGrid[z*mapSize+x]||[]):[]),
    ...worldEquipmentCell(x,z)]){
    if(!worldEquipmentActive(solid))continue;
    if(seen.has(solid))continue;
    seen.add(solid);test(solid.box,solid.kind,x,z,solid);
   }
  }
 }
 return best;
}
// Hit the visible robot silhouette: a wide chest/arms ellipse and head ellipse,
// based on the SAME model scaling used by drawEnemyModel(), not a tiny sphere.
function rayEllipsoid(o,d,center,rx,ry,rz,maxDist){
 const ox=(o.x-center.x)/rx,oy=(o.y-center.y)/ry,oz=(o.z-center.z)/rz;
 const vx=d.x/rx,vy=d.y/ry,vz=d.z/rz;
 const a=vx*vx+vy*vy+vz*vz,b=ox*vx+oy*vy+oz*vz,c=ox*ox+oy*oy+oz*oz-1;
 if(a<1e-12)return null;
 const disc=b*b-a*c;if(disc<0)return null;
 // Origin inside robot = immediate hit, not the exit surface behind it.
 const t=c<=0?.001:(-b-Math.sqrt(disc))/a;
 if(t<0||t>maxDist)return null;
 return t;
}
// Robot Foundry renders appendages as additional moving meshes around the
// chassis. The old chassis/head-only ellipsoids failed to register hits to
// visible drone wings, feet, insect legs and certain weapons. Keep their
// existing, generous central volumes for aim compatibility and ADD local-space
// accessory volumes at the same rig-relative coordinates as drawEnemyModel().
// All accessories rotate with the chassis. They are deliberately conservative
// filled volumes; no GPU triangle readback is needed for shots or explosions.
function robotAccessoryVolumes(e){
 const kind=e.boss?'boss':e.airborne?'drone':e.type;
 const r=e.boss?1.75:Math.max(.76,Math.min(1.31,e.radius/.51));
 const out=[],put=(part,x,y,z,rx,ry,rz)=>out.push({part,x:x*r,y:y*r,z:z*r,rx:rx*r,ry:ry*r,rz:rz*r});
 if(kind==='drone'){
  // Drawn swept wings reach +/-1.31r, whereas the central ellipsoid only
  // covered about +/-1.12r. The thrusters share the wing's rear edge.
  for(const side of [-1,1]){
   put('wing',side*.94,1.02,-.14,.43,.23,.51);
   put('thruster',side*1.04,1.06,-.34,.24,.28,.28);
  }
 }else if(kind==='scout'||kind==='charger'){
  // Locomoting insect legs are independently drawn at +/-0.39r, +/-0.36r;
  // these slender proxies reach below the shell but do not fill empty sky.
  for(const side of [-1,1])for(const fore of [-1,1])
   put('leg',side*.65,.57,fore*.51,.30,.41,.32);
  if(kind==='charger')for(const side of [-1,1])
   put('horn',side*.31,1.20,.89,.12,.17,.31);
 }else if(kind==='medic'){
  for(const side of [-1,1])put('manipulator',side*.69,.83,.26,.22,.24,.34);
 }else{
  // Leg meshes descend almost to floor level; the torso ellipsoid ended at
  // roughly 0.15r above it and shots at the boots could pass through.
  const motion=Math.max(0,Math.min(1,Number(e.robotMotion)||0));
  const phase=Number(e.robotCycle)||0;
  for(const side of [-1,1]){
   const step=Math.sin(phase+(side>0?Math.PI:0));
   const lift=Math.pow(Math.max(0,step),1.4)*.14*motion;
   put('leg',side*.25,.46+lift,-step*.025*motion,.27,.49,.37);
  }
  if(kind==='sniper')put('railgun',.42,1.54,.73,.15,.16,.47);
  if(kind==='artillery'||kind==='boss')for(const side of [-1,1])
   put('launcher',side*.77,1.48,-.21,.31,.32,.52);
 }
 return out;
}
function robotAccessoryRay(o,d,e,maxDist,assist=0){
 const base=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
 const kind=e.boss?'boss':e.airborne?'drone':e.type,hover=kind==='drone'||kind==='medic';
 const gTime=Number(game?.t)||0,id=Number(e.id)||0;
 const bob=hover?Math.sin(gTime*3.2+id)*.048:
  (Math.sin((Number(e.robotCycle)||0)*2)*.030*(Number(e.robotMotion)||0)+Math.sin(gTime*.8+id)*.006);
 const foot=base+bob+(hover?.13:0);
 const yaw=Number.isFinite(e.robotYaw)?e.robotYaw:0,cc=Math.cos(yaw),ss=Math.sin(yaw);
 // Inverse of the exact local -> world conversion in drawEnemyModel().
 const ox=o.x-e.x,oz=o.z-e.z;
 const localOrigin=v3(ox*cc-oz*ss,o.y-foot,ox*ss+oz*cc);
 const localDir=v3(d.x*cc-d.z*ss,d.y,d.x*ss+d.z*cc);
 let closest=null;
 for(const v of robotAccessoryVolumes(e)){
  const t=rayEllipsoid(localOrigin,localDir,v3(v.x,v.y,v.z),
    v.rx+assist,v.ry+assist,v.rz+assist,maxDist);
  if(t!==null&&(closest===null||t<closest.t))closest={t,part:v.part};
 }
 return closest;
}
// Conservative robot broadphase. It only rejects robots whose entire
// visible proxy envelope is too far from the shot segment. Important for
// shotguns and high-rate guns on mobile: no per-limb calculations for robots
// on the far side of the arena. The margin is deliberately larger than all
// arm, leg, wing, weapon, head and boss geometry in robotAccessoryVolumes().
function robotNearRay(o,d,maxDist,e,assist=0){
 const r=e.boss?1.75:Math.max(.76,Math.min(1.31,e.radius/.51));
 const base=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
 const dx=e.x-o.x,dy=base+1.25*r-o.y,dz=e.z-o.z;
 const t=Math.max(0,Math.min(maxDist,dx*d.x+dy*d.y+dz*d.z));
 const xx=dx-d.x*t,yy=dy-d.y*t,zz=dz-d.z*t;
 const reach=2.8*r+Math.max(0,assist);
 return xx*xx+yy*yy+zz*zz<=reach*reach;
}
// Early blast rejection uses the same deliberately generous physical envelope.
// In particular, a distant robot center cannot reject an actually exposed wing.
function robotNearArea(e,origin,radius){
 const r=e.boss?1.75:Math.max(.76,Math.min(1.31,e.radius/.51));
 const base=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
 return Math.hypot(e.x-origin.x,base+1.25*r-origin.y,e.z-origin.z)<=radius+2.8*r;
}
function rayEnemy(o,d,maxDist,ignored=null,assist=0){
 let closest=null,bt=maxDist;if(!game)return null;
 for(const e of game.enemies){
  if(e.dead||(ignored&&ignored.has(e.id)))continue;
  if(!robotNearRay(o,d,bt,e,assist))continue;
  const scale=e.boss?1.75:Math.max(.76,Math.min(1.31,e.radius/.51));
  const base=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
  const squat=e.type==='scout'||e.type==='charger'||e.airborne||e.type==='drone';
  const cy=base+(squat?1.02:1.28)*scale;
  let t=rayEllipsoid(o,d,v3(e.x,cy,e.z),scale*(squat?1.12:1.42)+assist,scale*(squat?.87:1.13)+assist,scale*1.03+assist,bt);
  let part='torso';
  const headY=base+(squat?1.52:2.07)*scale;
  const head=rayEllipsoid(o,d,v3(e.x,headY,e.z),scale*.48+assist,scale*.45+assist,scale*.53+assist,bt);
  if(head!==null&&(t===null||head<t)){t=head;part='head';}
  const accessory=robotAccessoryRay(o,d,e,bt,assist);
  if(accessory&&(t===null||accessory.t<t)){t=accessory.t;part=accessory.part;}
  if(t===null||t>=bt)continue;
  bt=t;closest={t,x:o.x+d.x*t,y:o.y+d.y*t,z:o.z+d.z*t,enemy:e,kind:'enemy',part};
 }
 return closest;
}
