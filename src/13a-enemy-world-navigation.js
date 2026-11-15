// STAGE 9 — Navigation uses the same rendered 3D solids as the projectile engine.
// The flow-field remains inexpensive and shared; an enemy-specific local sensor
// avoids rails, posts and thin separators without a per-robot A* each frame.
// Overpasses retain the established ramp-target logic of enemyHeading().
let enemyNavMask=null,enemyNavEdges=null,enemyNavMaskWorld=null,enemyNavMaskMap=null;
function enemyBodyHeight(e){
 // Includes the actual optic dome and hovering lift, not just the chassis.
 // Heavier flying frames are physically taller and need clear vertical space.
 const scale=Math.max(.76,Math.min(1.31,(Number(e.radius)||.48)/.51));
 return e.boss?2.85:e.airborne?Math.max(2.05,2.12*scale):
   e.type==='brute'||e.type==='warden'||e.type==='artillery'?2.13:1.68;
}
function enemyBodyRadius(e){return Math.max(.22,Math.min(e.airborne ? .67 : .58,(Number(e.radius)||.48)*(e.airborne ? .78 : .45)));}
// STAGE 10 — dynamic actors are not world-mesh boxes. Give each living robot
// a modest physical footprint, and separate crowds only when their vertical
// body intervals overlap. This is deliberately local (maximum 14 regular
// enemies) and does not dirty the static flow-field on every moving frame.
function enemyCrowdRadius(e,r=0){
 const nominal=Math.max(.24,Number(e?.radius)||.48);
 return Math.max(r,Math.min(e?.boss?.90:.69,nominal*(e?.boss?.77:.69)));
}
function enemyCrowdAllows(e,x,z,r=0){
 const others=game?.enemies;
 if(!Array.isArray(others)||others.length<2)return true;
 const baseFeet=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
 const feet=e.airborne?baseFeet:Math.max(baseFeet,supportHeight(e,x,z)),top=feet+enemyBodyHeight(e);
 const mine=enemyCrowdRadius(e,r);
 for(const other of others){
  if(other===e||other.dead||!Number.isFinite(other.x)||!Number.isFinite(other.z))continue;
  const otherFeet=Number.isFinite(other.feetY)?other.feetY:floorHeight(other.x,other.z);
  // NPCs on different floors never interfere through a bridge or ceiling.
  if(top<=otherFeet+.03||feet>=otherFeet+enemyBodyHeight(other)-.03)continue;
  const combined=mine+enemyCrowdRadius(other),vx=x-other.x,vz=z-other.z;
  if(Math.abs(vx)>=combined||Math.abs(vz)>=combined)continue;
  const next=Math.hypot(vx,vz),before=Math.hypot(e.x-other.x,e.z-other.z);
  // If they spawned in overlap, allow retreat and tangential escape; otherwise
  // never step *into* a neighbour's collision radius. No teleport/shoving.
  if(next<combined-.006&&(before>=combined-.006||next<before-.00015))return false;
 }
 return true;
}
function enemyCanOccupy(e,x,z,r=enemyBodyRadius(e)){
 if(!Number.isFinite(x)||!Number.isFinite(z)||collide(x,z,r))return false;
 const feet=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
 const candidate=e.airborne?feet:supportHeight(e,x,z);
 if((!e.airborne&&candidate>feet+.245)||(e.airborne&&feet<floorHeight(x,z)+.12))return false;
 return !worldSolidBodyCollision(x,z,r,Math.max(feet,candidate),enemyBodyHeight(e))&&
   enemyCrowdAllows(e,x,z,r);
}
// Cached *ground-level standard-robot* cell mask, invalidated by actual mesh
// identity, not by number of polygons (two quality settings may use same count).
// Larger enemies still check their own radius and height when they move.
function enemyNavTile(x,z){
 if(x<1||z<1||x>=mapSize-1||z>=mapSize-1||mapCells[z]?.[x]!==0)return false;
 if(!glReady||!worldSolidCount)return true;
 if(!enemyNavMask||enemyNavMask.length!==mapSize*mapSize||
     enemyNavMaskWorld!==worldSolidGrid||enemyNavMaskMap!==mapCells){
  enemyNavMask=new Int8Array(mapSize*mapSize);
  enemyNavEdges=new Int8Array(mapSize*mapSize*4);
  enemyNavMaskWorld=worldSolidGrid;enemyNavMaskMap=mapCells;
 }
 const index=z*mapSize+x;
 if(enemyNavMask[index]===0){
  // A standard 1.68m bot can pass under a 2.03m-high bridge plate.
  const feet=floorHeight(x+.5,z+.5);
  enemyNavMask[index]=worldSolidBodyCollision(x+.5,z+.5,.26,feet,1.68)?-1:1;
 }
 return enemyNavMask[index]>0;
}
function enemyNavEdge(x,z,X,Z){
 // Grid centres can be free while a thin structural bar separates them.
 // Cache the four *edges* per tile; three swept samples catch metal lying
 // at a quarter-cell, not only at the exact tile boundary.
 if(!enemyNavTile(X,Z))return false;
 if(!glReady||!worldSolidCount)return true;
 const dir=X>x?0:X<x?1:Z>z?2:3,opposite=dir^1;
 const key=(z*mapSize+x)*4+dir;
 if(enemyNavEdges[key]!==0)return enemyNavEdges[key]===1;
 const feet=Math.max(floorHeight(x+.5,z+.5),floorHeight(X+.5,Z+.5));
 let clear=true;
 for(const t of [.25,.50,.75]){
  const mx=x+.5+(X-x)*t,mz=z+.5+(Z-z)*t;
  if(worldSolidBodyCollision(mx,mz,.24,feet,1.68)){clear=false;break;}
 }
 enemyNavEdges[key]=clear?1:-1;
 enemyNavEdges[(Z*mapSize+X)*4+opposite]=enemyNavEdges[key];
 return clear;
}
function enemyPathClear(e,tx,tz){
 if(!lineClear(e.x,e.z,tx,tz))return false;
 if(!glReady||!worldSolidCount)return true;
 const span=Math.hypot(tx-e.x,tz-e.z),r=enemyBodyRadius(e);
 if(!(span>.0001))return true;
 const n=Math.max(1,Math.ceil(span/.24));
 // Don't demand the opponent's last few centimetres be robot-passable.
 for(let i=1;i<n;i++){
  const x=e.x+(tx-e.x)*i/n,z=e.z+(tz-e.z)*i/n;
  const feet=e.airborne?(Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z)):supportHeight(e,x,z);
  if(e.airborne&&feet<floorHeight(x,z)+.12)return false;
  if(worldSolidBodyCollision(x,z,r,feet,enemyBodyHeight(e)))return false;
 }
 return true;
}
// Cached direct-route probe; near the target it is sampled frequently enough
// to react to movement, without testing dozens of boxes for every bot each tick.
function enemyDirectRoute(e,p){
 if(!lineClear(e.x,e.z,p.x,p.z))return false;
 if(!glReady||!worldSolidCount)return true;
 const now=Number(game?.t)||0;
 if(e.navSeenUntil>now&&e.navSeenX!==undefined&&
    Math.hypot(e.x-e.navSeenX,e.z-e.navSeenZ)<.42&&
    Math.hypot(p.x-e.navGoalX,p.z-e.navGoalZ)<.42)return !!e.navSeenClear;
 const clear=enemyPathClear(e,p.x,p.z);
 e.navSeenX=e.x;e.navSeenZ=e.z;e.navGoalX=p.x;e.navGoalZ=p.z;
 e.navSeenClear=clear;e.navSeenUntil=now+.22+(e.id%5)*.017;
 return clear;
}
function enemyMove(e,dx,dz,r=enemyBodyRadius(e)){
 const amount=Math.hypot(dx,dz);
 if(!(amount>1e-8))return;
 // Crowd avoidance must run in Canvas fallback as well as WebGL.
 // The shared mover performs continuous actor/body collision per microstep.
 const ux=dx/amount,uz=dz/amount;
 const beforeX=e.x,beforeZ=e.z;
 moveEntity(e,dx,dz,r);
 const advanced=Math.hypot(e.x-beforeX,e.z-beforeZ);
 if(advanced>=amount*.67){
  e.navBlockedTime=Math.max(0,(e.navBlockedTime||0)-amount*.13);
  return;
 }
 // A thin static barrier or a living neighbour blocks our advance. Keep a
 // side for a short interval so a bot
 // doesn't alternate left/right every frame while walking alongside a rail.
 if(!(e.navBlockedTime>0))e.navAvoidSide=e.orbit===-1?-1:1;
 e.navBlockedTime=Math.min(1.4,(e.navBlockedTime||0)+.14);
 const side=e.navAvoidSide||1;
 // If the sought direction is blocked, try tangent/slanted detours. Test
 // farther than a single simulation step to avoid repeatedly hitting a post.
 let best=null;
 for(const a of [side*Math.PI/2,side*Math.PI/3,-side*Math.PI/2,
                  -side*Math.PI/3,side*Math.PI*.8,-side*Math.PI*.8,Math.PI]){
  const vx=ux*Math.cos(a)-uz*Math.sin(a),vz=ux*Math.sin(a)+uz*Math.cos(a);
  const look=Math.min(.58,Math.max(.29,r*.9));
  const can=enemyCanOccupy(e,e.x+vx*look,e.z+vz*look,r);
  if(!can)continue;
  // Prefer progress towards goal, but with a stable side to clear corners.
  const score=Math.cos(a)*.46+((a>0?1:-1)===side?.23:0);
  if(!best||score>best.score)best={vx,vz,score,a};
 }
 if(best){
  const x=e.x,z=e.z;
  moveEntity(e,best.vx*amount,best.vz*amount,r);
  if(Math.hypot(e.x-x,e.z-z)>amount*.28){
   e.navAvoidSide=best.a>=0?1:-1;
   return;
  }
 }
 // If this direction leads into a dead end, flip only occasionally, not
 // every frame. The shared flow-field will do the global detour.
 if(e.navBlockedTime>=1.3){e.navAvoidSide=-side;e.navBlockedTime=.35;}
}
