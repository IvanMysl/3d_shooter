
// --- Ballistics and impact effects. All calculations are in the level's world space. ---
const MAX_WALL_MARKS=touchOnly?115:230;

let decalMesh=null,decalDirty=true;
function rebuildDecalMesh(){
  decalDirty=false;
  if(!glReady||!game)return;
  if(decalMesh){gl.deleteBuffer(decalMesh.b);decalMesh=null}
  const v=[];
  for(const d of game.decals){
    const c=[d.x,d.y,d.z],n=[d.nx,d.ny,d.nz],r=d.r;
    const U=Math.abs(d.nx)>.5?[0,0,1]:[1,0,0];
    const V=Math.abs(d.ny)>.5?[0,0,1]:[0,1,0];
    const point=(a,dist)=>[c[0]+(U[0]*Math.cos(a)+V[0]*Math.sin(a))*dist,c[1]+(U[1]*Math.cos(a)+V[1]*Math.sin(a))*dist,c[2]+(U[2]*Math.cos(a)+V[2]*Math.sin(a))*dist];
    const outline=d.energy?[.16,.065,.035]:[.065,.061,.058];
    const dark=[.008,.009,.012];
    const seg=10;
    for(let i=0;i<seg;i++){
      const a=2*Math.PI*i/seg+d.rot,b=2*Math.PI*(i+1)/seg+d.rot;
      const A=r*(.94+.12*Math.sin(i*7.23+d.rot)),B=r*(.94+.12*Math.sin((i+1)*7.23+d.rot));
      const p1=point(a,A),p2=point(b,B),q1=point(a,A*.65),q2=point(b,B*.65);
      addTri(v,p1,p2,q1,n,outline,d.energy?.035:0);
      addTri(v,p2,q2,q1,n,outline,d.energy?.035:0);
      addTri(v,c,q1,q2,n,dark,0);
    }
  }
  if(v.length)decalMesh=toMesh(v);
}

function v3(x,y,z){return{x,y,z}}
function rayWall(o,d,maxDist){
  let cx=Math.floor(o.x),cz=Math.floor(o.z),sx=d.x>=0?1:-1,sz=d.z>=0?1:-1;
  const ax=Math.abs(d.x),az=Math.abs(d.z),dx=ax>1e-8?1/ax:Infinity,dz=az>1e-8?1/az:Infinity;
  let tx=ax>1e-8?(d.x>0?cx+1-o.x:o.x-cx)*dx:Infinity;
  let tz=az>1e-8?(d.z>0?cz+1-o.z:o.z-cz)*dz:Infinity;
  let hit=null;
  for(let i=0;i<150;i++){
    let t,nx=0,nz=0;
    if(tx<tz){t=tx;cx+=sx;tx+=dx;nx=-sx}else{t=tz;cz+=sz;tz+=dz;nz=-sz}
    if(t>maxDist||!Number.isFinite(t))break;
    if(cx<0||cz<0||cx>=mapSize||cz>=mapSize||mapCells[cz][cx]===1){
      const y=o.y+d.y*t;
      if(y>=0&&y<=ceilingHeight()) {hit={t,x:o.x+d.x*t,y,z:o.z+d.z*t,nx,ny:0,nz,kind:'wall'};break}
    }
  }
  // The floor and ceiling are real collision surfaces, so holes never float in midair.
  for(const [plane,ny,kind] of [[0,1,'floor'],[ceilingHeight(),-1,'ceiling']]){
    if(Math.abs(d.y)<1e-6)continue;
    const t=(plane-o.y)/d.y;
    if(t>.035&&t<maxDist&&(!hit||t<hit.t)){
      const x=o.x+d.x*t,z=o.z+d.z*t;
      if(!isWall(x,z))hit={t,x,y:plane,z,nx:0,ny,nz:0,kind};
    }
  }
  // Cast against the elevated deck as well as ground, to keep bullet holes
  // on the actual platform and prevent shooting through solid metal from below.
  if(Math.abs(d.y)>1e-6 && bridgeSpecs.length){
   const plane=BRIDGE_Y,t=(plane-o.y)/d.y;
   if(t>.035&&t<maxDist&&(!hit||t<hit.t)) {
    const x=o.x+d.x*t,z=o.z+d.z*t;
    if(deckHeight(x,z)>0)hit={t,x,y:plane,z,nx:0,ny:d.y>0?-1:1,nz:0,kind:'bridge'};
   }
  }
  return hit;
}
function rayEnemy(o,d,maxDist,ignored=null,assist=0){
 let closest=null,bt=maxDist;
 if(!game)return null;
 for(const e of game.enemies){
  if(e.dead||ignored&&ignored.has(e.id))continue;
  const y=(e.boss?1.45:1.14)+(Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z)),r=e.radius*(e.boss?1.19:1.06)+assist;
  const ox=o.x-e.x,oy=o.y-y,oz=o.z-e.z;
  const b=ox*d.x+oy*d.y+oz*d.z;
  const c=ox*ox+oy*oy+oz*oz-r*r;
  const disc=b*b-c;
  if(disc<0)continue;
  let t=-b-Math.sqrt(disc);if(t<.03)t=-b+Math.sqrt(disc);
  if(t<.03||t>=bt)continue;
  bt=t;closest={t,x:o.x+d.x*t,y:o.y+d.y*t,z:o.z+d.z*t,enemy:e,kind:'enemy'};
 }
 return closest;
}