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
 // Paint-thin tread markings, floor seams and decals are not separate walls.
 // Actual plates, columns, braces, rails, ductwork and overhead equipment are.
 if(hiY<=.15&&hiY-loY<.09)return;
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
function worldDecorObstructsRoute(x0,y0,z0,x1,y1,z1){
 if(!worldDecorClearance)return false;
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
 registerWorldSolid(x0,y0,z0,x1,y1,z1);
}
function worldSolidRayCell(o,d,limit,travelled,cx,cz,best){
 const solids=worldSolidGrid[cz*mapSize+cx];
 if(!solids)return best;
 for(const solid of solids){
  const h=rayAABB(o,d,limit,...solid.box);
  if(!h||h.t+1e-7<travelled||h.t>limit+1e-7)continue;
  if(!best||h.t<best.t-1e-8){
   best={...h,kind:solid.kind,cellX:cx,cellZ:cz,solid};
  }
 }
 return best;
}

// Body-vs-static geometry for the operator. Only projected 3D volume matters;
// flush decorative seams are excluded during registration above. Preserve
// legacy AI pathing (which uses the map grid) until navigation can route
// around these finer obstacles without deadlocks.
function worldSolidBodyCollision(x,z,r,feet,height=1.92){
 if(!glReady||!worldSolidCount)return false;
 const loX=Math.max(0,Math.floor(x-r)),hiX=Math.min(mapSize-1,Math.floor(x+r));
 const loZ=Math.max(0,Math.floor(z-r)),hiZ=Math.min(mapSize-1,Math.floor(z+r));
 for(let cz=loZ;cz<=hiZ;cz++)for(let cx=loX;cx<=hiX;cx++){
  const solids=worldSolidGrid[cz*mapSize+cx];if(!solids)continue;
  for(const solid of solids){
   const b=solid.box;
   if(b[1]>=feet+height-.015||b[4]<=feet+.16)continue;
   // Flush wall adornments and raised floor graphics are already handled by
   // their parent wall / support surface, but posts and rails are physical.
   const dx=x-Math.max(b[0],Math.min(x,b[3]));
   const dz=z-Math.max(b[2],Math.min(z,b[5]));
   if(dx*dx+dz*dz<r*r-1e-7)return true;
  }
 }
 return false;
}
// Minimum underside crossed by a jumping player's head this frame.
// The check is swept, so short jumps cannot pass through thin crossbars.
function worldSolidHeadBarrier(x,z,r,previousHead,nextHead){
 if(!glReady||!worldSolidCount||nextHead<=previousHead)return null;
 const loX=Math.max(0,Math.floor(x-r)),hiX=Math.min(mapSize-1,Math.floor(x+r));
 const loZ=Math.max(0,Math.floor(z-r)),hiZ=Math.min(mapSize-1,Math.floor(z+r));
 let nearest=null;
 for(let cz=loZ;cz<=hiZ;cz++)for(let cx=loX;cx<=hiX;cx++){
  for(const solid of worldSolidGrid[cz*mapSize+cx]||[]){
   const b=solid.box;
   if(b[1]<previousHead-.001||b[1]>nextHead+.001)continue;
   const dx=x-Math.max(b[0],Math.min(x,b[3]));
   const dz=z-Math.max(b[2],Math.min(z,b[5]));
   if(dx*dx+dz*dz<=r*r&&(nearest===null||b[1]<nearest))nearest=b[1];
  }
 }
 return nearest;
}
// Highest top surface crossed by descending flying feet in this frame.
// Swept vertical contact prevents falling through thin gantries at low FPS.
function worldSolidFeetBarrier(x,z,r,previousFeet,nextFeet){
 if(!glReady||!worldSolidCount||nextFeet>=previousFeet)return null;
 const loX=Math.max(0,Math.floor(x-r)),hiX=Math.min(mapSize-1,Math.floor(x+r));
 const loZ=Math.max(0,Math.floor(z-r)),hiZ=Math.min(mapSize-1,Math.floor(z+r));
 let highest=null;
 for(let cz=loZ;cz<=hiZ;cz++)for(let cx=loX;cx<=hiX;cx++){
  for(const solid of worldSolidGrid[cz*mapSize+cx]||[]){
   const b=solid.box;
   if(b[4]>previousFeet+.001||b[4]<nextFeet-.001)continue;
   const dx=x-Math.max(b[0],Math.min(x,b[3]));
   const dz=z-Math.max(b[2],Math.min(z,b[5]));
   if(dx*dx+dz*dz<=r*r&&(highest===null||b[4]>highest))highest=b[4];
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
 if(!glReady||!worldSolidCount||!Number.isFinite(feet))return null;
 const loX=Math.max(0,Math.floor(x-r)),hiX=Math.min(mapSize-1,Math.floor(x+r));
 const loZ=Math.max(0,Math.floor(z-r)),hiZ=Math.min(mapSize-1,Math.floor(z+r));
 let highest=null;
 for(let cz=loZ;cz<=hiZ;cz++)for(let cx=loX;cx<=hiX;cx++){
  for(const solid of worldSolidGrid[cz*mapSize+cx]||[]){
   const b=solid.box,top=b[4];
   if(Math.abs(top-feet)>tolerance)continue;
   const dx=x-Math.max(b[0],Math.min(x,b[3]));
   const dz=z-Math.max(b[2],Math.min(z,b[5]));
   if(dx*dx+dz*dz<=r*r&&(highest===null||top>highest))highest=top;
  }
 }
 return highest;
}
function worldSolidStats(){return {boxes:worldSolidCount,gridReferences:worldSolidIndexed,tiles:worldSolidGrid.filter(Boolean).length};}
