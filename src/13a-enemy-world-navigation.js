// STAGE 9 — Navigation uses the same rendered 3D solids as the projectile engine.
// The flow-field remains inexpensive and shared; an enemy-specific local sensor
// avoids rails, posts and thin separators without a per-robot A* each frame.
// Overpasses retain the established ramp-target logic of enemyHeading().
let enemyNavMask=null,enemyNavEdges=null,enemyNavMaskWorld=null,enemyNavMaskMap=null,enemyNavMaskEquipment=null;
let enemyNavMaskDestroyed=-1,enemyNavMaskWorldCount=-1,
 enemyNavMaskHeights=null,enemyNavMaskGame=null;
// Stage105 — physical height must bound the VISIBLE, scaled robot mesh.
// These numbers are the actual maximum Y values of the full-detail meshes
// built by robotMaker()/buildRobotBody() in 08-robot-foundry-rigs.js. A 1.31x
// brute is over 3m tall; the old 2.13m collider let it walk THROUGH beams.
// The boss is drawn at a fixed 1.75x scale and its rigid body reaches 4.60m.
// Antennas of an elite rig are also visible physical parts of its silhouette.
const ROBOT_MESH_TOP=Object.freeze({scout:1.412,charger:1.500,shooter:2.307,
 brute:2.307,sniper:2.518,medic:2.027,warden:2.307,artillery:2.307,
 raider:2.307,boss:2.627});
function enemyBodyHeight(e){
 const scale=e.boss?1.75:Math.max(.76,Math.min(1.31,(Number(e.radius)||.48)/.51));
 if(e.airborne)return Math.max(2.05,2.12*scale);
 const kind=e.boss?'boss':e.type;
 const mesh=ROBOT_MESH_TOP[kind]||2.307;
 const eliteMesh=e.boss||e.elite?
  (kind==='scout'||kind==='charger'?1.693:kind==='medic'?1.843:2.573):0;
 // Extra 6cm for the articulated/bobbing upper body; no fake ducking.
 return Math.max(1.68,(Math.max(mesh,eliteMesh)*scale)+(kind==='medic'?.19:.06));
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
 const baseFeet=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
 const pose=worldActorMovePlan(x,z,Math.max(r,enemyBodyRadius(e)),baseFeet,!e.airborne,true);
 if(!pose)return false;
 return worldActorBlockers(e,r,false,true).every(o=>worldActorPairClear(e.x,e.z,x,z,baseFeet,pose.feet,enemyBodyHeight(e),o,o.radius));
}
function enemyCanOccupy(e,x,z,r=enemyBodyRadius(e)){
 if(!Number.isFinite(x)||!Number.isFinite(z)||collide(x,z,r))return false;
 const feet=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
 const pose=worldActorMovePlan(x,z,r,feet,!e.airborne,true);
 if(!pose)return false;
 return !worldSolidBodyCollision(x,z,r,pose.feet,enemyBodyHeight(e))&&
   enemyCrowdAllows(e,x,z,r);
}
// Stage111: a navigation node is a real reachable standing pose, not
// a body placed at the terrain altitude inside a 12cm steel threshold.
const groundStandardProfile=Object.freeze({radius:.26,height:1.68,key:'26:168'});
function navStandingFeet(x,z,profile,base=null){
 const r=profile.radius;
 const feet=base===null?worldTerrainFootprint(x,z,r):base;
 const pose=worldActorMovePlan(x,z,r,feet,true,true);
 return pose&&!worldSolidBodyCollision(x,z,r,pose.feet,profile.height)?pose.feet:null;
}
// On a cardinal edge, each circle-vs-rectangle overlap is a single exact
// interval. Probe every interval (and boundary), including short corner
// contacts between the old fixed .125/.25m sample positions. No new geometry.
function navPhysicalEdge(x,z,X,Z,profile,base=null){
 if(x<1||z<1||X<1||Z<1||x>=mapSize-1||z>=mapSize-1||X>=mapSize-1||Z>=mapSize-1||
    Math.abs(X-x)+Math.abs(Z-z)!==1||mapCells[z]?.[x]!==0||mapCells[Z]?.[X]!==0)return false;
 const r=profile.radius,h=profile.height,ax=Math.min(x,X)+.5,az=Math.min(z,Z)+.5;
 const alongX=x!==X,along=alongX?ax:az,across=alongX?az:ax;
 const sx=alongX?1:0,sz=alongX?0:1,events=[0,1],seen=new Set();
 const add=(b,epsilon=1e-7)=>{
  const lo=alongX?b[0]:b[2],hi=alongX?b[3]:b[5];
  const crossLo=alongX?b[2]:b[0],crossHi=alongX?b[5]:b[3];
  const d=Math.max(crossLo-across,0,across-crossHi),q=r*r-epsilon-d*d;
  if(q<=0)return false;
  const reach=Math.sqrt(q),enter=lo-reach-along,leave=hi+reach-along;
  if(leave<=0||enter>=1)return false;
  if(enter>0)events.push(enter);if(leave<1)events.push(leave);return true;
 };
 // Broadphase is the swept circle's bounding rectangle, not the entire map.
 // Include height/deck tiles and local active equipment in both renderers.
 let complex=false;
 let flat=null;
 for(let j=Math.max(0,Math.floor(az-r));j<=Math.min(mapSize-1,Math.floor(az+sz+r));j++)
 for(let i=Math.max(0,Math.floor(ax-r));i<=Math.min(mapSize-1,Math.floor(ax+sx+r));i++){
  const ground=floorHeightAtCell(i,j),deck=deckAtCell(i,j),wall=mapCells[j]?.[i]!==0;
  if(flat===null)flat=ground;
  if(wall||deck>0||ground!==flat){if(add([i,0,j,i+1,0,j+1],wall?1e-9:1e-7))complex=true;}
  // In case the first tile was higher than a later tile, include all terrain
  // contacts, not only cells whose height differs from the first one.
  if(ground>0)add([i,0,j,i+1,0,j+1]);
  for(const list of [glReady?worldSolidGrid[j*mapSize+i]:null,worldEquipmentCell(i,j)]){
   if(!list)continue;
   for(const solid of list){if(seen.has(solid)||!worldEquipmentActive(solid))continue;
    seen.add(solid);if(add(solid.box))complex=true;
   }
  }
 }
 if(!complex&&base===null)return true;
 const a=navStandingFeet(ax,az,profile,base),b=navStandingFeet(ax+sx,az+sz,profile,base);
 if(a===null||b===null)return false;
 // No local solids, wall, deck or changing terrain: the entire corridor is
 // constant height. This matters for the large Canvas mission flood fills.
 if(!complex)return Math.abs(a-b)<.00001;
 events.sort((a,b)=>a-b);
 const probes=[0];
 for(let i=1;i<events.length;i++){
  const previous=events[i-1],next=events[i];
  if(next-previous>1e-10){probes.push((previous+next)/2,next);}
 }
 // Both directions must be possible from the canonical node support. This
 // is deliberately conservative for stairs that need several stacked lifts.
 const walk=(from,to,reverse)=>{
  let feet=from;
  for(let i=0;i<probes.length;i++){
   const t=probes[reverse?probes.length-1-i:i];
   const px=ax+sx*t,pz=az+sz*t;
   const pose=worldActorMovePlan(px,pz,r,feet,true,true);
   if(!pose||worldSolidBodyCollision(px,pz,r,pose.feet,h))return false;
   feet=pose.feet;
  }
  return Math.abs(feet-to)<.00001;
 };
 return walk(a,b,false)&&walk(b,a,true);
}
// Cached standard ground graph. Include deck/renderer identity in addition
// to mesh count and live equipment revisions; never reuse a stale route.
let enemyNavMaskDecks=null,enemyNavMaskGL=null;
function enemyNavTile(x,z){
 if(x<1||z<1||x>=mapSize-1||z>=mapSize-1||mapCells[z]?.[x]!==0)return false;
 const equipment=worldEquipmentGrid(),destroyed=Number(game?.nodesDestroyed)||0;
 if(!enemyNavMask||!enemyNavEdges||enemyNavMaskDestroyed!==destroyed||enemyNavMask.length!==mapSize*mapSize||
     enemyNavMaskWorld!==worldSolidGrid||enemyNavMaskWorldCount!==worldSolidCount||
     enemyNavMaskHeights!==heightCells||enemyNavMaskDecks!==deckCells||enemyNavMaskGL!==glReady||enemyNavMaskGame!==game||
     enemyNavMaskMap!==mapCells||enemyNavMaskEquipment!==equipment){
  enemyNavMask=new Int8Array(mapSize*mapSize);enemyNavEdges=new Int8Array(mapSize*mapSize*4);
  enemyNavMaskWorld=worldSolidGrid;enemyNavMaskMap=mapCells;enemyNavMaskEquipment=equipment;
  enemyNavMaskDestroyed=destroyed;enemyNavMaskWorldCount=worldSolidCount;
  enemyNavMaskHeights=heightCells;enemyNavMaskDecks=deckCells;enemyNavMaskGL=glReady;enemyNavMaskGame=game;
 }
 const index=z*mapSize+x;
 if(enemyNavMask[index]===0)enemyNavMask[index]=navStandingFeet(x+.5,z+.5,groundStandardProfile)===null?-1:1;
 return enemyNavMask[index]>0;
}
function enemyNavEdge(x,z,X,Z){
 if(Math.abs(x-X)+Math.abs(z-Z)!==1||!enemyNavTile(x,z)||!enemyNavTile(X,Z))return false;
 // Keep the explicit terrain step guard even when a test mutates a height
 // in-place; production terrain is replaced atomically when a map loads.
 if(Math.abs(floorHeightAtCell(x,z)-floorHeightAtCell(X,Z))>.245)return false;
 const dir=X>x?0:X<x?1:Z>z?2:3,key=(z*mapSize+x)*4+dir;
 if(!enemyNavEdges[key]){
  const clear=navPhysicalEdge(x,z,X,Z,groundStandardProfile);
  enemyNavEdges[key]=clear?1:-1;enemyNavEdges[(Z*mapSize+X)*4+(dir^1)]=enemyNavEdges[key];
 }
 return enemyNavEdges[key]===1;
}
// Stage112: mission routes use the operator's real .23m radius and 1.95m
// body height, not a scout's .26m / 1.68m proxy. Separate cache prevents
// player route queries from corrupting the shared NPC ground graph.
const playerNavProfile=Object.freeze({radius:.23,height:1.95,key:'23:195'});
let playerNavGraph=null;
function playerNavState(){
 const revision=[game,mapCells,heightCells,deckCells,glReady,worldSolidGrid,worldSolidCount,worldEquipmentGrid(),Number(game?.nodesDestroyed)||0,mapSize];
 if(!playerNavGraph||revision.some((v,i)=>v!==playerNavGraph.revision[i]))
  playerNavGraph={revision,tiles:new Int8Array(mapSize*mapSize),edges:new Int8Array(mapSize*mapSize*4)};
 return playerNavGraph;
}
function playerNavTile(x,z){
 if(x<1||z<1||x>=mapSize-1||z>=mapSize-1||mapCells[z]?.[x]!==0)return false;
 const graph=playerNavState(),idx=z*mapSize+x;
 if(!graph.tiles[idx])graph.tiles[idx]=navStandingFeet(x+.5,z+.5,playerNavProfile)===null?-1:1;
 return graph.tiles[idx]>0;
}
function playerNavEdge(x,z,X,Z){
 if(Math.abs(x-X)+Math.abs(z-Z)!==1||!playerNavTile(x,z)||!playerNavTile(X,Z))return false;
 if(Math.abs(floorHeightAtCell(x,z)-floorHeightAtCell(X,Z))>.245)return false;
 const graph=playerNavState(),dir=X>x?0:X<x?1:Z>z?2:3,idx=(z*mapSize+x)*4+dir;
 if(!graph.edges[idx]){
  graph.edges[idx]=navPhysicalEdge(x,z,X,Z,playerNavProfile)?1:-1;
  graph.edges[(Z*mapSize+X)*4+(dir^1)]=graph.edges[idx];
 }
 return graph.edges[idx]===1;
}
function enemyPathClear(e,tx,tz){
 if(!lineClear(e.x,e.z,tx,tz))return false;
 const span=Math.hypot(tx-e.x,tz-e.z),r=enemyBodyRadius(e);
 if(!(span>.0001))return true;
 const n=Math.max(1,Math.ceil(span/.24));
 let pose={feet:Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z),grounded:!e.airborne};
 let x=e.x,z=e.z;
 // Exact contact intervals within local segments, including the endpoint.
 for(let i=1;i<=n;i++){
  const X=e.x+(tx-e.x)*i/n,Z=e.z+(tz-e.z)*i/n;
  pose=worldActorSweepPlan(x,z,X,Z,r,pose.feet,pose.grounded,true,enemyBodyHeight(e));
  if(!pose)return false;x=X;z=Z;
 }
 return true;
}
// STAGE90 — Canvas shortcuts still have real raised terrain, even without a
// WebGL mesh or any dynamic equipment. The cheap shortcut may be used only
// when its *actual ground path* has no step beyond the walker's 0.245m limit.
// Sampling at the same 0.24m spacing as enemyPathClear keeps the result
// conservative without performing expensive per-sample 3D AABB queries.
// Flying/upper-deck robots need the full 3D check, never a ground-only shortcut.
function enemyFlatShortcutSafe(e,p){
 if(e.airborne)return false;
 const r=enemyBodyRadius(e),start=worldTerrainFootprint(e.x,e.z,r), feet=Number.isFinite(e.feetY)?e.feetY:start;
 if(Math.abs(feet-start)>.26)return false;
 if(Number.isFinite(p.feetY)&&Math.abs(p.feetY-floorHeight(p.x,p.z))>.26)return false;
 const dx=p.x-e.x,dz=p.z-e.z,span=Math.hypot(dx,dz),n=Math.max(1,Math.ceil(span/.24));
 let previous=start,x0=e.x,z0=e.z;
 for(let i=1;i<=n;i++){
  const X=e.x+dx*i/n,Z=e.z+dz*i/n;
  for(const t of worldMotionProbes(x0,z0,X,Z,r)){
   const x=x0+(X-x0)*t,z=z0+(Z-z0)*t,current=worldTerrainFootprint(x,z,r);
   if(collide(x,z,r)||Math.abs(current-previous)>.245||worldDeckBodyCollision(x,z,r,current,enemyBodyHeight(e)))return false;
   previous=current;
  }
  x0=X;z0=Z;
 }
 return true;
}
// Cached direct-route probe; near the target it is sampled frequently enough
// to react to movement, without testing dozens of boxes for every bot each tick.
// Keep large transient references OUT of the enumerable enemy object: saveRun
// serializes game.enemies verbatim. Weak keys also release discarded robots.
const enemyDirectRevisionCache=new WeakMap();
function enemyDirectRoute(e,p){
 if(!Number.isFinite(e.x)||!Number.isFinite(e.z)||
    !Number.isFinite(p.x)||!Number.isFinite(p.z)||
    !lineClear(e.x,e.z,p.x,p.z))return false;
 // A player standing on a real upper deck cannot be reached by a ground
 // robot via the *underpass* directly beneath it. Require stair/roof routing
 // until the robot has physically reached that elevation. Flying robots can
 // still use their own true 3D line-of-travel check.
 if(!e.airborne&&Number.isFinite(p.feetY)&&
    p.feetY>floorHeight(p.x,p.z)+.30&&
    Math.abs(p.feetY-(Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z)))>.35)return false;
 // Stage89: a Canvas scene (or a WebGL scene with zero baked mesh boxes)
 // can STILL contain visible, solid reactor/station/archive housings. The
 // movement engine always checks those AABBs; do not skip them in the AI's
 // direct-route probe merely because the static world mesh is unavailable.
 // Preserve the cheap route on truly empty, flat maps.
 // Most nearby equipment is nowhere near THIS particular shortcut. Before
 // launching a swept multi-sample AABB test, use a conservative 1.5m
 // broadphase around the segment. That exceeds the largest NPC footprint +
 // current steel half-width, so it cannot hide a genuine body collision.
 const padding=1.5,loX=Math.min(e.x,p.x)-padding,hiX=Math.max(e.x,p.x)+padding,
  loZ=Math.min(e.z,p.z)-padding,hiZ=Math.max(e.z,p.z)+padding;
 const nearPath=o=>o&&o.x>=loX&&o.x<=hiX&&o.z>=loZ&&o.z<=hiZ;
 const hasNearbyEquipment=!!(game?.nodes?.some(n=>!n.dead&&nearPath(n))||
  game?.devices?.some(nearPath)||
  (game?.mission?.type==='recovery'&&game.mission.caches?.some(nearPath)));
 if((!glReady||!worldSolidCount)&&!isBalconySector()&&!hasNearbyEquipment&&
    enemyFlatShortcutSafe(e,p))return true;
 const now=Number(game?.t)||0;
 // A destroyed reactor physically disappears. Its former no-go route must
 // reopen immediately, even within the short memoization window.
 const destroyed=Number(game?.nodesDestroyed)||0;
 const revision=[mapCells,heightCells,deckCells,glReady,worldSolidGrid,worldSolidCount,worldEquipmentGrid(),destroyed,e.feetY,p.feetY,enemyBodyRadius(e),enemyBodyHeight(e),!!e.airborne];
 const previousRevision=enemyDirectRevisionCache.get(e);
 if(previousRevision&&revision.every((v,i)=>v===previousRevision[i])&&e.navSeenUntil>now&&e.navSeenX!==undefined&&e.navSeenDestroyed===destroyed&&
    e.x===e.navSeenX&&e.z===e.navSeenZ&&
    p.x===e.navGoalX&&p.z===e.navGoalZ)return !!e.navSeenClear;
 const clear=enemyPathClear(e,p.x,p.z);
 e.navSeenX=e.x;e.navSeenZ=e.z;e.navGoalX=p.x;e.navGoalZ=p.z;
 e.navSeenClear=clear;e.navSeenUntil=now+.22+(e.id%5)*.017;
 e.navSeenDestroyed=destroyed;enemyDirectRevisionCache.set(e,revision);
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
