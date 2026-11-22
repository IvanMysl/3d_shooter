// Stage 3: static scene solids share their exact AABBs with the world renderer.
// One spatial bucket per grid tile; projectiles and the camera query ONLY the
// tiles intersected by the ray. No per-frame rebuild and no network assets.
let worldSolidGrid=[],worldSolidCount=0,worldSolidIndexed=0,worldDecorClearance=false;
function resetWorldSolids(){
 worldSolidGrid=new Array(Math.max(0,mapSize*mapSize));
 worldSolidCount=0;worldSolidIndexed=0;
}
function registerWorldSolid(x0,y0,z0,x1,y1,z1,kind='structure'){
 if(!glReady||!mapSize)return;
 if(![x0,y0,z0,x1,y1,z1].every(Number.isFinite))return;
 const loX=Math.min(x0,x1),hiX=Math.max(x0,x1);
 const loY=Math.min(y0,y1),hiY=Math.max(y0,y1);
 const loZ=Math.min(z0,z1),hiZ=Math.max(z0,z1);
 if(hiX-loX<.001||hiY-loY<.001||hiZ-loZ<.001)return;
 // Stage110: even very low closed metal volumes are physical. Surface-only
 // markings are explicitly excluded by worldSolidBox, not by absolute height.
 const minX=Math.max(0,Math.floor(loX)),maxX=Math.min(mapSize-1,Math.floor(hiX));
 const minZ=Math.max(0,Math.floor(loZ)),maxZ=Math.min(mapSize-1,Math.floor(hiZ));
 if(maxX<minX||maxZ<minZ)return;
 const solid={box:[loX,loY,loZ,hiX,hiY,hiZ],kind};
 worldSolidCount++;
 for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
  const key=z*mapSize+x;
  (worldSolidGrid[key]||(worldSolidGrid[key]=[])).push(solid);
  worldSolidIndexed++;
 }
}
// Raised stairs and elevated bridges remain traversable. Decorative gantries
// are omitted *at mesh generation time*, not merely excluded from collision,
// when they would leave insufficient headroom over an accessible upper floor.
// Essential bridge plates, posts and rails are emitted before this mode starts.
function worldDecorObstructsRoute(x0,y0,z0,x1,y1,z1,force=false){
 if(!worldDecorClearance&&!force)return false;
 const loY=Math.min(y0,y1),hiY=Math.max(y0,y1);
 const a=Math.max(0,Math.floor(Math.min(x0,x1)-.26));
 const b=Math.min(mapSize-1,Math.floor(Math.max(x0,x1)+.26));
 const c=Math.max(0,Math.floor(Math.min(z0,z1)-.26));
 const d=Math.min(mapSize-1,Math.floor(Math.max(z0,z1)+.26));
 for(let z=c;z<=d;z++)for(let x=a;x<=b;x++){
  if(mapCells[z]?.[x]!==0)continue;
  const upper=Math.max(floorHeightAtCell(x,z),deckAtCell(x,z));
  if(upper>.15&&loY<upper+2.25&&hiY>upper+.16)return true;
 }
 return false;
}
// WORLD-MESH ONLY. Never call for animated robots or first-person weapons.
// This draws the same six-faced geometric box while registering its projectile
// collision boundary, so the two representations cannot drift apart.
function worldSolidBox(dst,x0,y0,z0,x1,y1,z1,color,emission=0,sides=[1,1,1,1,1,1]){
 if(worldDecorObstructsRoute(x0,y0,z0,x1,y1,z1))return;
 box(dst,x0,y0,z0,x1,y1,z1,color,emission,sides);
 // A single upward-facing painted surface is not a closed obstacle.
 if(sides[4]&&!sides[0]&&!sides[1]&&!sides[2]&&!sides[3]&&!sides[5])return;
 registerWorldSolid(x0,y0,z0,x1,y1,z1);
}
// STAGE86 — equipment hulls use one shared, exact AABB representation for
// the WebGL chassis, Canvas silhouette, operator, robots and projectiles.
// Animated light rings, holographic cores and warning auras are *effects*:
// they are deliberately not solid. The steel base and vertical chassis are.
// World equipment is not part of the baked map mesh. Rebuild its small spatial
// index when the entity arrays, level, or member counts change (including a
// checkpoint restore); a destroyed reactor remains indexed but is skipped.
let worldEquipmentIndexCache=null;
// STAGE91: the absent-archive branch must have STABLE identity. A fresh []
// here invalidated the entire equipment grid on every NPC edge/physics query
// in 80 non-recovery levels, defeating both equipment and navigation caches.
const worldEquipmentEmpty=Object.freeze([]);
// The station's drawn steel base is .72m wide (drawDevices bevel), so its
// collider must extend +/- .36m too. The earlier .34m box left a 2cm wide
// visible, non-solid metal rim on every side.
const EQUIPMENT_HULL_DEVICE=.36,EQUIPMENT_HULL_NODE=.37;
// STAGE87: the metal DATA-ARCHIVE PEDESTAL is solid; the floating crystal,
// scanning light and navigation markers remain intangible holograms.
// Both renderers use this exact .62m x .62m x .30m steel footprint.
const ARCHIVE_PLINTH_RADIUS=.31,ARCHIVE_PLINTH_BOTTOM=.02,ARCHIVE_PLINTH_TOP=.32;
function worldEquipmentGrid(){
 const g=typeof game==='undefined'?null:game;
 // PvP arenas have their own authoritative state and no campaign equipment.
 if((typeof mpMatch!=='undefined'&&mpMatch?.active)||!g||!mapSize)return null;
 const nodes=g.nodes||worldEquipmentEmpty,devices=g.devices||worldEquipmentEmpty,
  archives=g.mission?.type==='recovery'?(g.mission.caches||worldEquipmentEmpty):worldEquipmentEmpty;
 let cache=worldEquipmentIndexCache;
 if(cache&&cache.game===g&&cache.map===mapCells&&cache.size===mapSize&&
  cache.nodes===nodes&&cache.devices===devices&&cache.archives===archives&&
  cache.nodesLength===nodes.length&&cache.devicesLength===devices.length&&
  cache.archivesLength===archives.length)return cache.grid;
 const grid=new Array(mapSize*mapSize);
 const insert=(entity,kind,r,y1,bottom=.04)=>{
  if(!Number.isFinite(entity.x)||!Number.isFinite(entity.z))return;
  const y=floorHeight(entity.x,entity.z);
  const b=[entity.x-r,y+bottom,entity.z-r,entity.x+r,y+y1,entity.z+r];
  const solid={box:b,kind,entity,node:kind==='node'?entity:null};
  const minX=Math.max(0,Math.floor(b[0])),maxX=Math.min(mapSize-1,Math.floor(b[3]));
  const minZ=Math.max(0,Math.floor(b[2])),maxZ=Math.min(mapSize-1,Math.floor(b[5]));
  for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
   const key=z*mapSize+x;
   (grid[key]||(grid[key]=[])).push(solid);
  }
 };
 for(const n of nodes)insert(n,'node',EQUIPMENT_HULL_NODE,1.27);
 for(const d of devices)insert(d,'equipment',EQUIPMENT_HULL_DEVICE,1.30);
 // Used archives leave their metal bases in place. A recovered crystal must
 // never turn into an invisible barrier or erase a visible steel pedestal.
 for(const c of archives)insert(c,'archive',ARCHIVE_PLINTH_RADIUS,
  ARCHIVE_PLINTH_TOP,ARCHIVE_PLINTH_BOTTOM);
 worldEquipmentIndexCache={game:g,map:mapCells,size:mapSize,nodes,devices,archives,
  nodesLength:nodes.length,devicesLength:devices.length,archivesLength:archives.length,grid};
 return grid;
}
function worldEquipmentCell(x,z){
 if(x<0||z<0||x>=mapSize||z>=mapSize)return [];
 return worldEquipmentGrid()?.[z*mapSize+x]||[];
}
function worldEquipmentActive(solid){return solid.kind!=='node'||!solid.entity.dead;}
function worldEquipmentStats(){
 const grid=worldEquipmentGrid()||[];const all=new Set();
 for(const tile of grid)for(const s of tile||[])if(worldEquipmentActive(s))all.add(s);
 return {bodies:all.size,nodes:[...all].filter(s=>s.kind==='node').length,
  devices:[...all].filter(s=>s.kind==='equipment').length,
  archives:[...all].filter(s=>s.kind==='archive').length};
}
// STAGE99: pickups are visual holographic drops, but walls, solid equipment,
// bridges and their true elevations must still separate the operator from a
// drop. A 2D magnet may not vacuum resources through steel or another floor.
function worldLootPickupClear(p,drop){
 if(!p||!drop||![p.x,p.z,drop.x,drop.z].every(Number.isFinite))return false;
 const playerFeet=Number.isFinite(p.feetY)?p.feetY:floorHeight(p.x,p.z);
 const dropFeet=Number.isFinite(drop.feetY)?drop.feetY:floorHeight(drop.x,drop.z);
 const range=1+Math.max(0,Number(p.magnet)||0);
 if(Math.hypot(p.x-drop.x,p.z-drop.z,Math.max(0,Math.abs(playerFeet-dropFeet)-.35))>=range)return false;
 const origin={x:p.x,y:playerFeet+.85,z:p.z};
 const target={x:drop.x,y:dropFeet+.48,z:drop.z};
 const dx=target.x-origin.x,dy=target.y-origin.y,dz=target.z-origin.z;
 const length=Math.hypot(dx,dy,dz);
 if(length<=1e-6)return true;
 const hit=rayWall(origin,{x:dx/length,y:dy/length,z:dz/length},length);
 return !hit||hit.t>=length-.002;
}
// Preserve the floor/deck of a fallen robot and never place visible resources
// inside a metal hull or beyond a separating wall. Legacy loot without feetY
// still renders/collects at floor level. The bounded ring search is invoked
// only when loot is CREATED, not once per render frame.
function worldLootSpawn(source,type,life,offsetX=0,offsetZ=0){
 if(!source||![source.x,source.z].every(Number.isFinite))return null;
 const base=Number.isFinite(source.feetY)&&!source.airborne?
  source.feetY:floorHeight(source.x,source.z);
 const center={x:source.x,y:base+.53,z:source.z};
 const test=(x,z)=>{
  if(!Number.isFinite(x)||!Number.isFinite(z)||
     x<.7||z<.7||x>mapSize-.7||z>mapSize-.7)return null;
  const feet=supportHeight({feetY:base},x,z);
  if(Math.abs(feet-base)>.245||collide(x,z,.17)||
     worldSolidBodyCollision(x,z,.17,feet+.10,.72))return null;
  const end={x,y:feet+.5,z},dx=x-center.x,dy=end.y-center.y,dz=z-center.z;
  const length=Math.hypot(dx,dy,dz);
  if(length>1e-6){const hit=rayWall(center,{x:dx/length,y:dy/length,z:dz/length},length);
   if(hit&&hit.t<length-.002)return null;}
  return {x,z,feetY:feet,type,life};
 };
 const originX=source.x+offsetX,originZ=source.z+offsetZ;
 const exact=test(originX,originZ);if(exact)return exact;
 for(const radius of [.34,.65,.95,1.25,1.65,2.1]){
  for(let k=0;k<20;k++){
   const angle=k*Math.PI/10;
   const candidate=test(source.x+Math.cos(angle)*radius,
                        source.z+Math.sin(angle)*radius);
   if(candidate)return candidate;
  }
 }
 // No bonus is worth leaving an unreachable prop in a wall or on a wrong deck.
 return null;
}
function worldSolidRayCell(o,d,limit,travelled,cx,cz,best){
 const solids=[...(glReady?(worldSolidGrid[cz*mapSize+cx]||[]):[]),
  ...worldEquipmentCell(cx,cz)];
 for(const solid of solids){
  if(!worldEquipmentActive(solid))continue;
  const h=rayAABB(o,d,limit,...solid.box);
  if(!h||h.t+1e-7<travelled||h.t>limit+1e-7)continue;
  if(!best||h.t<best.t-1e-8){
   best={...h,kind:solid.kind,cellX:cx,cellZ:cz,solid,node:solid.node};
  }
 }
 return best;
}

// Body-vs-static geometry for the operator. Only projected 3D volume matters;
// flush decorative seams are excluded during registration above. Preserve
// legacy AI pathing (which uses the map grid) until navigation can route
// around these finer obstacles without deadlocks.
// Stage105: deckCells are the AUTHORITATIVE visible, .17m-thick elevated
// floor plates (also used by the rocket/ballistic sweep). Canvas does not
// bake the WebGL mesh, so a tall ground robot must still hit their underside.
// This is a circular XZ body against the actual whole-tile plate, not a
// square collision that creates imaginary corner barriers. Standing ON a
// deck does not make its supporting floor collide with the actor's legs.
function worldDeckBodyCollision(x,z,r,feet,height){
 if(typeof deckCells==='undefined'||typeof deckAtCell!=='function'||
    !deckCells?.length||!Number.isFinite(feet)||!(height>0))return false;
 const loX=Math.max(0,Math.floor(x-r)),hiX=Math.min(mapSize-1,Math.floor(x+r));
 const loZ=Math.max(0,Math.floor(z-r)),hiZ=Math.min(mapSize-1,Math.floor(z+r));
 for(let cz=loZ;cz<=hiZ;cz++)for(let cx=loX;cx<=hiX;cx++){
  const deck=deckAtCell(cx,cz);
  if(!(deck>feet+.004&&deck-.17<feet+height-.004))continue;
  const dx=x-Math.max(cx,Math.min(x,cx+1));
  const dz=z-Math.max(cz,Math.min(z,cz+1));
  if(dx*dx+dz*dz<r*r-1e-7)return true;
 }
 return false;
}
// Stage108: a grounded round body starts touching a bridge before its CENTRE
// enters the deck tile. Permit the same 24.5cm walk-up used for solid stairs,
// but only at actual circle-vs-plate overlap; never pull an actor up from
// below a tall bridge, nor widen its visible footprint into empty space.
function worldDeckStepSupport(x,z,r,feet,maxStep=.245){
 if(typeof deckCells==='undefined'||!deckCells?.length||
    ![x,z,r,feet,maxStep].every(Number.isFinite)||!(r>0)||!(maxStep>0))return null;
 const loX=Math.max(0,Math.floor(x-r)),hiX=Math.min(mapSize-1,Math.floor(x+r));
 const loZ=Math.max(0,Math.floor(z-r)),hiZ=Math.min(mapSize-1,Math.floor(z+r));
 let top=null;
 for(let cz=loZ;cz<=hiZ;cz++)for(let cx=loX;cx<=hiX;cx++){
  const deck=deckAtCell(cx,cz);
  if(!(deck>feet+.001&&deck<=feet+maxStep+.00001))continue;
  const dx=x-Math.max(cx,Math.min(x,cx+1));
  const dz=z-Math.max(cz,Math.min(z,cz+1));
  if(dx*dx+dz*dz>=r*r-1e-7)continue;
  if(top===null||deck>top)top=deck;
 }
 return top;
}
// STAGE107: the suspended deck is a real [tile XZ] x [deck-.17, deck]
// steel volume, not a point support sampled at the actor's centre.
// Use the SAME circular XZ footprint test as worldDeckBodyCollision for
// swept head, feet and resting contacts (Canvas and WebGL). Zero overlap at
// a mathematical corner is not contact: do not invent invisible extensions.
function worldDeckVerticalContact(x,z,r,from,to,mode){
 if(typeof deckCells==='undefined'||!deckCells?.length||
    ![x,z,r,from,to].every(Number.isFinite)||!(r>0)||!mapSize)return null;
 if(mode==='head'&&to<=from||mode==='feet'&&to>=from)return null;
 const loX=Math.max(0,Math.floor(x-r)),hiX=Math.min(mapSize-1,Math.floor(x+r));
 const loZ=Math.max(0,Math.floor(z-r)),hiZ=Math.min(mapSize-1,Math.floor(z+r));
 let contact=null;
 for(let cz=loZ;cz<=hiZ;cz++)for(let cx=loX;cx<=hiX;cx++){
  const deck=deckAtCell(cx,cz);if(!(deck>0))continue;
  const dx=x-Math.max(cx,Math.min(x,cx+1));
  const dz=z-Math.max(cz,Math.min(z,cz+1));
  if(dx*dx+dz*dz>=r*r-1e-7)continue;
  const boundary=mode==='head'?deck-.17:deck;
  const crossed=mode==='head'?from<=boundary+.001&&to>boundary:
   mode==='feet'?from>=boundary-.001&&to<boundary:
   mode==='support'?Math.abs(from-boundary)<=to:false;
  if(!crossed)continue;
  if(contact===null||(mode==='head'?boundary<contact:boundary>contact))contact=boundary;
 }
 return contact;
}
function worldDeckHeadBarrier(x,z,r,previousHead,nextHead){
 return worldDeckVerticalContact(x,z,r,previousHead,nextHead,'head');
}
function worldDeckFeetBarrier(x,z,r,previousFeet,nextFeet){
 return worldDeckVerticalContact(x,z,r,previousFeet,nextFeet,'feet');
}
function worldDeckStandingSupport(x,z,r,feet,tolerance=.045){
 return worldDeckVerticalContact(x,z,r,feet,tolerance,'support');
}
// Merge contacts from two *real* sets of steel surfaces. Selecting the first
// underside while ascending / highest top while descending prevents tunneling
// across multiple overlapping decks on an unusually long simulation frame.
function worldLowestContact(a,b){return a===null?b:b===null?a:Math.min(a,b);}
function worldHighestContact(a,b){return a===null?b:b===null?a:Math.max(a,b);}
function worldSolidBodyCollision(x,z,r,feet,height=1.92){
 // Always check physically drawn/ballistically solid deck plates, including
 // in the software renderer where worldSolidCount is intentionally zero.
 if(typeof worldTerrainFootprint==='function'&&worldTerrainFootprint(x,z,r)>feet+.004)return true;
 if(worldDeckBodyCollision(x,z,r,feet,height))return true;
 if(!(glReady&&worldSolidCount)&&!(typeof game!=='undefined'&&(game?.nodes?.length||game?.devices?.length||game?.mission?.caches?.length)))return false;
 const loX=Math.max(0,Math.floor(x-r)),hiX=Math.min(mapSize-1,Math.floor(x+r));
 const loZ=Math.max(0,Math.floor(z-r)),hiZ=Math.min(mapSize-1,Math.floor(z+r));
 for(let cz=loZ;cz<=hiZ;cz++)for(let cx=loX;cx<=hiX;cx++){
  const solids=[...(glReady?(worldSolidGrid[cz*mapSize+cx]||[]):[]),
   ...worldEquipmentCell(cx,cz)];
  for(const solid of solids){
   if(!worldEquipmentActive(solid))continue;
   const b=solid.box;
   if(b[1]>=feet+height-.004||b[4]<=feet+.004)continue;
   // Flush wall adornments and raised floor graphics are already handled by
   // their parent wall / support surface, but posts and rails are physical.
   const dx=x-Math.max(b[0],Math.min(x,b[3]));
   const dz=z-Math.max(b[2],Math.min(z,b[5]));
   if(dx*dx+dz*dz<r*r-1e-7)return true;
  }
 }
 return false;
}
// Stage110: a grounded actor can step onto genuine low steel, just like a
// stair. Do not ignore the metal at the feet or auto-lift airborne bodies.
// All candidate heights are relative to the OLD feet: stacked plates cannot
// manufacture extra step height. The caller checks the final whole-body pose.
function worldSolidStepSupport(x,z,r,feet,maxStep=.245){
 if(![x,z,r,feet,maxStep].every(Number.isFinite)||!(r>0)||!(maxStep>0))return null;
 if(!(glReady&&worldSolidCount)&&!(typeof game!=='undefined'&&(game?.nodes?.length||game?.devices?.length||game?.mission?.caches?.length)))return null;
 const loX=Math.max(0,Math.floor(x-r)),hiX=Math.min(mapSize-1,Math.floor(x+r));
 const loZ=Math.max(0,Math.floor(z-r)),hiZ=Math.min(mapSize-1,Math.floor(z+r));
 let highest=null;
 for(let cz=loZ;cz<=hiZ;cz++)for(let cx=loX;cx<=hiX;cx++){
  for(const solid of [...(glReady?(worldSolidGrid[cz*mapSize+cx]||[]):[]),...worldEquipmentCell(cx,cz)]){
   if(!worldEquipmentActive(solid))continue;
   const b=solid.box,top=b[4];
   if(!(top>feet+.001&&top<=feet+maxStep+.00001))continue;
   const dx=x-Math.max(b[0],Math.min(x,b[3])),dz=z-Math.max(b[2],Math.min(z,b[5]));
   if(dx*dx+dz*dz<r*r-1e-7&&(highest===null||top>highest))highest=top;
  }
 }
 return highest;
}
// Minimum underside crossed by a jumping player's head this frame.
// The check is swept, so short jumps cannot pass through thin crossbars.
function worldSolidHeadBarrier(x,z,r,previousHead,nextHead){
 if(!(glReady&&worldSolidCount)&&!(typeof game!=='undefined'&&(game?.nodes?.length||game?.devices?.length||game?.mission?.caches?.length))||nextHead<=previousHead)return null;
 const loX=Math.max(0,Math.floor(x-r)),hiX=Math.min(mapSize-1,Math.floor(x+r));
 const loZ=Math.max(0,Math.floor(z-r)),hiZ=Math.min(mapSize-1,Math.floor(z+r));
 let nearest=null;
 for(let cz=loZ;cz<=hiZ;cz++)for(let cx=loX;cx<=hiX;cx++){
  for(const solid of [...(glReady?(worldSolidGrid[cz*mapSize+cx]||[]):[]),
   ...worldEquipmentCell(cx,cz)]){
   if(!worldEquipmentActive(solid))continue;
   const b=solid.box;
   if(b[1]<previousHead-.001||b[1]>=nextHead)continue;
   const dx=x-Math.max(b[0],Math.min(x,b[3]));
   const dz=z-Math.max(b[2],Math.min(z,b[5]));
   if(dx*dx+dz*dz<r*r-1e-7&&(nearest===null||b[1]<nearest))nearest=b[1];
  }
 }
 return nearest;
}
// Highest top surface crossed by descending flying feet in this frame.
// Swept vertical contact prevents falling through thin gantries at low FPS.
function worldSolidFeetBarrier(x,z,r,previousFeet,nextFeet){
 if(!(glReady&&worldSolidCount)&&!(typeof game!=='undefined'&&(game?.nodes?.length||game?.devices?.length||game?.mission?.caches?.length))||nextFeet>=previousFeet)return null;
 const loX=Math.max(0,Math.floor(x-r)),hiX=Math.min(mapSize-1,Math.floor(x+r));
 const loZ=Math.max(0,Math.floor(z-r)),hiZ=Math.min(mapSize-1,Math.floor(z+r));
 let highest=null;
 for(let cz=loZ;cz<=hiZ;cz++)for(let cx=loX;cx<=hiX;cx++){
  for(const solid of [...(glReady?(worldSolidGrid[cz*mapSize+cx]||[]):[]),
   ...worldEquipmentCell(cx,cz)]){
   if(!worldEquipmentActive(solid))continue;
   const b=solid.box;
   if(b[4]>previousFeet+.001||b[4]<=nextFeet)continue;
   const dx=x-Math.max(b[0],Math.min(x,b[3]));
   const dz=z-Math.max(b[2],Math.min(z,b[5]));
   if(dx*dx+dz*dz<r*r-1e-7&&(highest===null||b[4]>highest))highest=b[4];
  }
 }
 return highest;
}
// Once a descending operator lands on a narrow beam/gantry, its top must
// remain a real support on the NEXT frame. Otherwise the terrain-only floor
// query marks the player airborne and blocks another Space jump even while
// the boots visibly rest on metal. Only surfaces at the current foot height
// count; lower decorative parts and distant rooftops cannot lift the player.
function worldSolidStandingSupport(x,z,r,feet,tolerance=.045){
 if(!(glReady&&worldSolidCount)&&!(typeof game!=='undefined'&&(game?.nodes?.length||game?.devices?.length||game?.mission?.caches?.length))||!Number.isFinite(feet))return null;
 const loX=Math.max(0,Math.floor(x-r)),hiX=Math.min(mapSize-1,Math.floor(x+r));
 const loZ=Math.max(0,Math.floor(z-r)),hiZ=Math.min(mapSize-1,Math.floor(z+r));
 let highest=null;
 for(let cz=loZ;cz<=hiZ;cz++)for(let cx=loX;cx<=hiX;cx++){
  for(const solid of [...(glReady?(worldSolidGrid[cz*mapSize+cx]||[]):[]),
   ...worldEquipmentCell(cx,cz)]){
   if(!worldEquipmentActive(solid))continue;
   const b=solid.box,top=b[4];
   if(Math.abs(top-feet)>tolerance)continue;
   const dx=x-Math.max(b[0],Math.min(x,b[3]));
   const dz=z-Math.max(b[2],Math.min(z,b[5]));
   if(dx*dx+dz*dz<r*r-1e-7&&(highest===null||top>highest))highest=top;
  }
 }
 return highest;
}
function worldSolidStats(){return {boxes:worldSolidCount,gridReferences:worldSolidIndexed,tiles:worldSolidGrid.filter(Boolean).length};}
