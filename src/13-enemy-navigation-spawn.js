
// BFS flow-field for enemy navigation. Updated <2 Hz; no per-enemy A*.
// Authoritative revision for the shared ground flow-field. Navigation tile,
// edge, balcony and roof caches also observe reactor destruction in Stage91.
let navFieldDestroyed=-1,navFieldWorldCount=-1,navFieldEquipment=null,
 navFieldMap=null,navFieldHeights=null,navFieldWorld=null;
function rebuildNavigation(){
  if(!game)return;
  const sz=mapSize,px=clamp(Math.floor(game.p.x),0,sz-1),pz=clamp(Math.floor(game.p.z),0,sz-1);
  const val=new Int16Array(sz*sz);val.fill(32767);
  const qx=new Int16Array(sz*sz),qz=new Int16Array(sz*sz);
  let head=0,tail=0;val[pz*sz+px]=0;qx[tail]=px;qz[tail++]=pz;
  while(head<tail){const x=qx[head],z=qz[head++],d=val[z*sz+x]+1;
    for(const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0]]){
      const X=x+dx,Z=z+dz;
      if(X<1||Z<1||X>=sz-1||Z>=sz-1||mapCells[Z][X])continue;
      if(!enemyNavEdge(x,z,X,Z))continue;
      const ix=Z*sz+X;if(d>=val[ix])continue;
      val[ix]=d;qx[tail]=X;qz[tail++]=Z;
    }
  }
  navField=val;navClock=.65;navFieldDestroyed=Number(game?.nodesDestroyed)||0;
  navFieldWorldCount=worldSolidCount;navFieldEquipment=worldEquipmentGrid();
  navFieldMap=mapCells;navFieldHeights=heightCells;navFieldWorld=worldSolidGrid;
}
// Stage50: upper balconies have their own stair entrances. A ground-only
// flow-field towards the player's X/Z tile sends bots into a sheer edge;
// use a shared cached flow-field to the lower stair entrance instead.
function balconyEntranceField(b){
 const destroyed=Number(game?.nodesDestroyed)||0,equipment=worldEquipmentGrid();
 if(b.navField&&b.navMap===mapCells&&b.navWorld===worldSolidGrid&&
    b.navDestroyed===destroyed&&b.navEquipment===equipment&&b.navWorldCount===worldSolidCount&&
    b.navHeights===heightCells&&b.navDecks===deckCells&&b.navGL===glReady)return b.navField;
 const size=mapSize,dist=new Int16Array(size*size);dist.fill(32767);
 const q=new Int32Array(size*size);let read=0,write=0;
 const x=b.entry.x+(b.axis==='x'?b.side:0);
 const z=b.entry.z+(b.axis==='z'?b.side:0);
 if(mapCells[z]?.[x]!==0)return null;
 const start=z*size+x;dist[start]=0;q[write++]=start;
 while(read<write){
  const current=q[read++],cx=current%size,cz=(current/size)|0,d=dist[current]+1;
  for(const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0]]){
   const X=cx+dx,Z=cz+dz,k=Z*size+X;
   if(X<1||Z<1||X>=size-1||Z>=size-1||mapCells[Z][X]||d>=dist[k])continue;
   if(!enemyNavEdge(cx,cz,X,Z))continue;
   dist[k]=d;q[write++]=k;
  }
 }
 b.navField=dist;b.navMap=mapCells;b.navWorld=worldSolidGrid;
 b.navDestroyed=destroyed;b.navEquipment=equipment;b.navWorldCount=worldSolidCount;
 b.navHeights=heightCells;b.navDecks=deckCells;b.navGL=glReady;
 return dist;
}
// A single cached upper-deck flow field keeps walking robots on narrow
// connected galleries instead of taking a straight diagonal off the edge.
// Rebuild only when the upper target changes grid cell (not per enemy/frame).
// Upper-level paths need a separate physically swept edge graph. The ground
// enemyNavEdge() cannot be reused: it tests legs at FLOOR altitude and would
// incorrectly reject real overhead bridges or ignore a barrier ON the deck.
// Cache the standard 1.68m walker's 3D edges per deck elevation and rebuild
// on changes to the actual static mesh, equipment or live-reactor revision.
let upperDeckNavMap=null,upperDeckNavDecks=null,upperDeckNavWorld=null,
 upperDeckNavEquipment=null,upperDeckNavDestroyed=-1,upperDeckNavWorldCount=-1,
 upperDeckNavCache=new Map(),upperDeckEdgeCache=new Map();
// STAGE102 — the Stage101 deck flow assumed EVERY walker was a .22m-radius,
// 1.68m-tall scout. A boss/brute with a real larger chassis could therefore
// be directed through a corridor its own movement collider rejected. Cache
// actual, conservatively rounded physical profiles, not visual robot names.
const upperDeckStandardProfile=Object.freeze({radius:.22,height:1.68,key:'22:168'});
function upperDeckProfile(e){
 if(!e)return upperDeckStandardProfile;
 // The boss movement call uses e.radius*.50 (ordinary walkers *.45);
 // its radius can slightly exceed the nominal enemyBodyRadius() cap.
 // A route must clear the *larger* actual movement circle.
 const nominal=Number(e.radius)||.48;
 const movementRadius=Math.max(enemyBodyRadius(e),nominal*(e.boss?.50:.45));
 const radius=Math.max(.22,Math.ceil(movementRadius*100-1e-8)/100);
 const height=Math.max(1.68,Math.ceil(enemyBodyHeight(e)*100-1e-8)/100);
 return {radius,height,key:Math.round(radius*100)+':'+Math.round(height*100)};
}
let upperDeckNavHeights=null,upperDeckNavGL=null;
function refreshUpperDeckNavigation(){
 const equipment=worldEquipmentGrid(),destroyed=Number(game?.nodesDestroyed)||0;
 if(upperDeckNavMap!==mapCells||upperDeckNavDecks!==deckCells||upperDeckNavHeights!==heightCells||upperDeckNavGL!==glReady||
    upperDeckNavWorld!==worldSolidGrid||upperDeckNavWorldCount!==worldSolidCount||
    upperDeckNavEquipment!==equipment||upperDeckNavDestroyed!==destroyed){
  upperDeckNavMap=mapCells;upperDeckNavDecks=deckCells;upperDeckNavHeights=heightCells;upperDeckNavGL=glReady;
  upperDeckNavWorld=worldSolidGrid;upperDeckNavWorldCount=worldSolidCount;
  upperDeckNavEquipment=equipment;upperDeckNavDestroyed=destroyed;
  upperDeckNavCache.clear();upperDeckEdgeCache.clear();
 }
}
function upperDeckEdgeClear(x,z,X,Z,y,profile=upperDeckStandardProfile){
 if(x<1||z<1||X<1||Z<1||x>=mapSize-1||z>=mapSize-1||
    X>=mapSize-1||Z>=mapSize-1||
    Math.abs(x-X)+Math.abs(z-Z)!==1||
    mapCells[z]?.[x]!==0||mapCells[Z]?.[X]!==0||
    Math.abs(deckAtCell(x,z)-y)>.05||Math.abs(deckAtCell(X,Z)-y)>.05)return false;
 if(!(glReady&&worldSolidCount)&&!game?.nodes?.length&&
    !game?.devices?.length&&!game?.mission?.caches?.length&&profile.radius<=.5&&
    floorHeightAtCell(x,z)<=y+.004&&floorHeightAtCell(X,Z)<=y+.004&&
    deckAtCell(x,z)<=y+.004&&deckAtCell(X,Z)<=y+.004)return true;
 refreshUpperDeckNavigation();
 const cacheKey=Math.round(y*100)+':'+profile.key;
 const dir=X>x?0:X<x?1:Z>z?2:3;
 let edges=upperDeckEdgeCache.get(cacheKey);
 if(!edges){edges=new Int8Array(mapSize*mapSize*4);upperDeckEdgeCache.set(cacheKey,edges);}
 const key=(z*mapSize+x)*4+dir;
 if(edges[key])return edges[key]===1;
 const passable=navPhysicalEdge(x,z,X,Z,profile,y);
 const value=passable?1:-1;
 edges[key]=value;
 edges[(Z*mapSize+X)*4+(dir^1)]=value;
 return passable;
}
function upperDeckField(tx,tz,y,profile=upperDeckStandardProfile){
 const size=mapSize,X=Math.floor(tx),Z=Math.floor(tz),key=Z*size+X;
 if(X<1||Z<1||X>=size-1||Z>=size-1||mapCells[Z]?.[X]!==0||
    Math.abs(deckAtCell(X,Z)-y)>.05)return null;
 refreshUpperDeckNavigation();
 const target=key+':'+Math.round(y*100)+':'+profile.key;
 if(upperDeckNavCache.has(target))return upperDeckNavCache.get(target);
 const field=new Int16Array(size*size);field.fill(32767);
 if(navStandingFeet(X+.5,Z+.5,profile,y)===null)return field;
 const queue=new Int32Array(size*size);let read=0,write=0;
 field[key]=0;queue[write++]=key;
 while(read<write){
  const current=queue[read++],x=current%size,z=(current/size)|0,d=field[current]+1;
  for(const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0]]){
   const xx=x+dx,zz=z+dz,k=zz*size+xx;
   if(xx<1||zz<1||xx>=size-1||zz>=size-1||d>=field[k]||
      !upperDeckEdgeClear(x,z,xx,zz,y,profile))continue;
   field[k]=d;queue[write++]=k;
  }
 }
 if(upperDeckNavCache.size>=8)upperDeckNavCache.delete(upperDeckNavCache.keys().next().value);
 upperDeckNavCache.set(target,field);
 return field;
}
function upperDeckHeading(e,tx,tz,y){
 const cx=Math.floor(e.x),cz=Math.floor(e.z),size=mapSize;
 if(cx<1||cz<1||cx>=size-1||cz>=size-1||
    Math.abs(deckAtCell(cx,cz)-y)>.05)return null;
 const profile=upperDeckProfile(e);
 const field=upperDeckField(tx,tz,y,profile);
 if(!field||field[cz*size+cx]===32767)return null;
 let best=field[cz*size+cx],gx=tx,gz=tz;
 if(best>0){
  gx=cx+.5;gz=cz+.5;
  for(const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0]]){
   const X=cx+dx,Z=cz+dz,d=field[Z*size+X];
   if(d<best&&upperDeckEdgeClear(cx,cz,X,Z,y,profile)){
    best=d;gx=X+.5;gz=Z+.5;
   }
  }
 }
 const dist=hypot(gx-e.x,gz-e.z);
 return dist>.01?{dx:(gx-e.x)/dist,dz:(gz-e.z)/dist}:{dx:0,dz:0};
}
function balconyRouteHeading(e,p){
 if(e.airborne||typeof balconySpecs==='undefined'||!balconySpecs.length)return null;
 const pFeet=Number.isFinite(p.feetY)?p.feetY:floorHeight(p.x,p.z);
 const eFeet=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
 const pDeck=deckHeight(p.x,p.z),eDeck=deckHeight(e.x,e.z);
 // Keep climbing until the bot actually ENTERS the upper deck. The last
 // stair tread lies only .22m below it, so a loose altitude comparison alone
 // would prematurely exit stair navigation and strand bots near the top.
 const onPlayerDeck=eDeck>1.5&&eFeet>=eDeck-.30&&Math.abs(eDeck-pDeck)<.05;
 const climbing=pDeck>1.5&&pFeet>=pDeck-.3&&!onPlayerDeck;
 const descending=eDeck>1.5&&eFeet>=eDeck-.3&&pFeet<eDeck-.45;
 if(!climbing&&!descending){e.balconyClimb=false;return null;}
 const x=climbing?p.x:e.x,z=climbing?p.z:e.z;
 let b=null,near=Infinity;
 for(const candidate of balconySpecs){
  const d=hypot(x-(candidate.cx+.5),z-(candidate.cz+.5));
  if(d<near&&Math.abs(candidate.y-(climbing?pDeck:eDeck))<.05){near=d;b=candidate;}
 }
 if(!b)return null;
 const goalKey=b.cx+','+b.cz+','+b.axis;
 const footX=b.entry.x+.5+(b.axis==='x'?b.side:0);
 const footZ=b.entry.z+.5+(b.axis==='z'?b.side:0);
 const topX=b.top.x+.5,topZ=b.top.z+.5;
 const nearEntrance=hypot(e.x-footX,e.z-footZ)<1.1;
 if(climbing){
  if(e.balconyGoal!==goalKey){
   e.balconyClimb=false;e.balconyGoal=goalKey;
  }
  if(nearEntrance||eFeet>.3)e.balconyClimb=true;
 }else{
  e.balconyGoal=goalKey;e.balconyClimb=true;
  // Walk along the elevated gallery BACK to the stair landing first.
  // A direct line to its ground entrance would jump through the rails.
  if(hypot(e.x-topX,e.z-topZ)>1.0){
   const h=upperDeckHeading(e,topX,topZ,b.y);
   if(h)return h;
  }
 }
 const tx=climbing&&e.balconyClimb?topX:footX;
 const tz=climbing&&e.balconyClimb?topZ:footZ;
 if(climbing&&!e.balconyClimb&&!enemyDirectRoute(e,{x:footX,z:footZ})){
  const field=balconyEntranceField(b),cx=Math.floor(e.x),cz=Math.floor(e.z);
  if(field&&cx>1&&cz>1&&cx<mapSize-2&&cz<mapSize-2){
   let best=field[cz*mapSize+cx],gx=cx+.5,gz=cz+.5;
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const X=cx+dx,Z=cz+dz,d=field[Z*mapSize+X];
    if(d<best&&enemyNavEdge(cx,cz,X,Z)){best=d;gx=X+.5;gz=Z+.5;}
   }
   if(best<32767){const length=hypot(gx-e.x,gz-e.z);
    if(length>.01)return {dx:(gx-e.x)/length,dz:(gz-e.z)/length};}
  }
 }
 const d=hypot(tx-e.x,tz-e.z)||1;
 return {dx:(tx-e.x)/d,dz:(tz-e.z)/d};
}
// Stage57: autonomous roof access. A single-layer X/Z flow field cannot
// distinguish the ground beneath a guardhouse from its roof. Walking robots
// therefore get a cached *entrance* field followed by 13 real-height tread
// waypoints and the existing physical roof deck. On retreat the sequence is
// reversed; no teleport, free flight or raycast-only fake passage is used.
function roofEscapeWaypoints(s){
 if(s.roofWaypoints)return s.roofWaypoints;
 const p=(u,v,y)=>s.axis==='x'?{x:s.cx+u+.5,z:s.cz+v*s.wing+.5,y}:
  {x:s.cx+v*s.wing+.5,z:s.cz+u+.5,y};
 const way=[p(s.roofFlank*3,2,s.y)];
 for(const cell of midlevelRoofStairCells(s))
  way.push({x:cell.x+.5,z:cell.z+.5,y:cell.h});
 way.push(p(-s.roofFlank,4,s.roofY));
 s.roofWaypoints=way;
 return way;
}
function roofEscapeSpecAt(a){
 if(!a||a.airborne||!midlevelSpecs.length)return null;
 const feet=Number.isFinite(a.feetY)?a.feetY:floorHeight(a.x,a.z);
 const x=Math.floor(a.x),z=Math.floor(a.z),deck=deckAtCell(x,z);
 for(const s of midlevelSpecs){
  if(s.roofStairCount!==13)continue;
  if(Math.abs(deck-s.roofY)<.04&&feet>=s.roofY-.30)return s;
  if(roofEscapeWaypoints(s).some(w=>Math.floor(w.x)===x&&
    Math.floor(w.z)===z&&Math.abs(w.y-feet)<.30))return s;
 }
 return null;
}
function roofEntranceField(s){
 const destroyed=Number(game?.nodesDestroyed)||0,equipment=worldEquipmentGrid();
 if(s.roofNavField&&s.roofNavMap===mapCells&&
    s.roofNavWorld===worldSolidGrid&&s.roofNavHeights===heightCells&&
    s.roofNavDestroyed===destroyed&&s.roofNavEquipment===equipment&&
    s.roofNavWorldCount===worldSolidCount&&s.roofNavDecks===deckCells&&s.roofNavGL===glReady)
  return s.roofNavField;
 const n=mapSize,start=roofEscapeWaypoints(s)[0],sx=Math.floor(start.x),sz=Math.floor(start.z);
 const dist=new Int16Array(n*n);dist.fill(32767);
 const queue=new Int32Array(n*n);let head=0,tail=0;
 if(mapCells[sz]?.[sx]!==0)return null;
 const initial=sz*n+sx;dist[initial]=0;queue[tail++]=initial;
 while(head<tail){
  const key=queue[head++],x=key%n,z=(key/n)|0,d=dist[key]+1;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=x+dx,Z=z+dz,k=Z*n+X;
   if(X<1||Z<1||X>=n-1||Z>=n-1||mapCells[Z][X]||
      dist[k]<=d||!enemyNavEdge(x,z,X,Z))continue;
   dist[k]=d;queue[tail++]=k;
  }
 }
 s.roofNavField=dist;s.roofNavMap=mapCells;
 s.roofNavWorld=worldSolidGrid;s.roofNavHeights=heightCells;
 s.roofNavDestroyed=destroyed;s.roofNavEquipment=equipment;s.roofNavWorldCount=worldSolidCount;
 s.roofNavDecks=deckCells;s.roofNavGL=glReady;
 return dist;
}
function roofEntranceHeading(e,s){
 const field=roofEntranceField(s),n=mapSize,x=Math.floor(e.x),z=Math.floor(e.z);
 if(!field||x<1||z<1||x>=n-1||z>=n-1)return {dx:0,dz:0};
 const d=field[z*n+x],start=roofEscapeWaypoints(s)[0];
 if(d===32767)return {dx:0,dz:0};
 if(d===0){const length=hypot(start.x-e.x,start.z-e.z)||1;
  return {dx:(start.x-e.x)/length,dz:(start.z-e.z)/length};}
 let best=d,gx=x+.5,gz=z+.5;
 for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const X=x+dx,Z=z+dz,k=Z*n+X;
  if(X<1||Z<1||X>=n-1||Z>=n-1||field[k]>=best||
      !enemyNavEdge(x,z,X,Z))continue;
  best=field[k];gx=X+.5;gz=Z+.5;
 }
 const length=hypot(gx-e.x,gz-e.z)||1;
 return {dx:(gx-e.x)/length,dz:(gz-e.z)/length};
}
function roofEscapeHeading(e,p){
 if(e.airborne||!midlevelSpecs.length)return null;
 const playerOn=roofEscapeSpecAt(p),enemyOn=roofEscapeSpecAt(e);
 const playerRoof=playerOn&&deckHeight(p.x,p.z)>0&&
  (p.feetY||0)>=playerOn.roofY-.3?playerOn:null;
 const enemyRoof=enemyOn&&deckHeight(e.x,e.z)>0&&
  (e.feetY||0)>=enemyOn.roofY-.3?enemyOn:null;
 if(playerRoof&&enemyRoof===playerRoof){
  e.roofNavKey=null;
  return upperDeckHeading(e,p.x,p.z,playerRoof.roofY);
 }
 // If a robot is on another roof, descend its OWN staircase before
 // considering the player's distant roof. Never cut across the empty air.
 const target=enemyOn&&(enemyOn!==playerRoof)?enemyOn:playerRoof;
 if(!target){e.roofNavKey=null;return null;}
 const ascending=!!playerRoof&&enemyRoof!==playerRoof&&
  (!enemyOn||enemyOn===playerRoof);
 const route=roofEscapeWaypoints(target),direction=ascending?1:-1;
 const stateKey=target.cx+','+target.cz+','+target.roofFlank+','+direction;
 if(e.roofNavKey!==stateKey){
  e.roofNavKey=stateKey;e.roofNavDirection=direction;
  const feet=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
  let closest=0,score=Infinity;
  for(let i=0;i<route.length;i++){
   const w=route[i],d=(e.x-w.x)**2+(e.z-w.z)**2+4*(feet-w.y)**2;
   if(d<score){score=d;closest=i;}
  }
  // Far away robots first navigate to the public entrance via the same
  // physical step-aware edge tests as the ordinary ground flow field.
  e.roofNavIndex=ascending&&score>3?0:closest;
 }
 let i=e.roofNavIndex;
 const advance=()=>{
  const w=route[i],feet=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
  return w&&hypot(e.x-w.x,e.z-w.z)<.30&&Math.abs(feet-w.y)<.30;
 };
 for(let k=0;k<2&&advance();k++){i+=direction;}
 e.roofNavIndex=i;
 if(i<0||i>=route.length){e.roofNavKey=null;return null;}
 if(ascending&&i===0&&hypot(e.x-route[0].x,e.z-route[0].z)>.42)
  return roofEntranceHeading(e,target);
 const waypoint=route[i],d=hypot(waypoint.x-e.x,waypoint.z-e.z)||1;
 return {dx:(waypoint.x-e.x)/d,dz:(waypoint.z-e.z)/d};
}
function enemyHeading(e,p){
  const roofHeading=roofEscapeHeading(e,p);
  if(roofHeading)return roofHeading;
  if(!e.airborne&&bridgeSpecs.length && p.feetY>BRIDGE_Y-.38 && (e.feetY||0)<BRIDGE_Y-.30){
    const c=Math.floor(mapSize/2);
    if(!e.rampSide)e.rampSide=e.x<c?-1:1;
    const side=e.rampSide;
    const outer={x:c+side*13.5,z:c+.5},inner={x:c+side*2.5,z:c+.5};
    if(e.rampAccess || hypot(e.x-outer.x,e.z-outer.z)<1.4)e.rampAccess=true;
    const target=e.rampAccess?inner:outer;
    const dx=target.x-e.x,dz=target.z-e.z,d=hypot(dx,dz)||1;
    return {dx:dx/d,dz:dz/d};
  }
  if(e.rampAccess&&(e.feetY||0)>BRIDGE_Y-.38)e.rampAccess=false;
  if(!e.airborne&&gallerySpecs.length){
   const pd=deckHeight(p.x,p.z),ed=deckHeight(e.x,e.z);
   if(pd>1.5&&Math.abs(pd-ed)<.05&&
      (p.feetY||0)>=pd-.30&&(e.feetY||0)>=ed-.30){
    const h=upperDeckHeading(e,p.x,p.z,pd);
    if(h)return h;
   }
  }
  const balconyHeading=balconyRouteHeading(e,p);
  if(balconyHeading)return balconyHeading;
  let d=hypot(p.x-e.x,p.z-e.z)||1;
  if(enemyDirectRoute(e,p))return {dx:(p.x-e.x)/d,dz:(p.z-e.z)/d};
  const profile=upperDeckProfile(e);
  // The ordinary flow stays shared and fast; only bodies larger/taller than
  // its actual .24m/1.68m probes need a different physical route.
  const largeGround=!e.airborne&&(profile.radius>.245||profile.height>1.68);
  const chosenField=largeGround?groundChassisField(e,p):navField;
  if(!chosenField)return {dx:(p.x-e.x)/d,dz:(p.z-e.z)/d};
  const x=Math.floor(e.x),z=Math.floor(e.z),sz=mapSize;
  if(x<1||z<1||x>=sz-1||z>=sz-1)return {dx:0,dz:0};
  let best=chosenField[z*sz+x],targetX=x+.5,targetZ=z+.5;
  const offsets=[[0,1],[0,-1],[1,0],[-1,0]];
  const cached=largeGround?groundChassisCache.get((Math.floor(p.z)*sz+Math.floor(p.x))+':'+profile.key):null;
  for(const [mx,mz] of offsets){const X=x+mx,Z=z+mz;
    if(X<1||Z<1||X>=sz-1||Z>=sz-1||mapCells[Z]?.[X]!==0||
       !(largeGround?groundChassisEdge(x,z,X,Z,profile,cached.edges):enemyNavEdge(x,z,X,Z)))continue;
    const cost=chosenField[Z*sz+X];if(cost<best){best=cost;targetX=X+.5;targetZ=Z+.5;}
  }
  // There is no physically connected path for this chassis. A zero heading
  // is safer than falling back to a straight vector through solid steel.
  if(largeGround&&best===32767)return {dx:0,dz:0};
  let dx=targetX-e.x,dz=targetZ-e.z,mag=hypot(dx,dz);
  if(mag<.13){
   if(largeGround)return {dx:0,dz:0};
   return {dx:(p.x-e.x)/d,dz:(p.z-e.z)/d};
  }
  return {dx:dx/mag,dz:dz/mag};
}
// STAGE103 — the shared ground flow uses a small scout silhouette. Heavy and
// boss walkers were steered into narrow real steel passages, where their ACTUAL
// movement radius/head height rejected every step. These walkers get a cached
// profile-specific field using the SAME physical 3D AABBs as movement.
// Keep the old scout field (including its cheap Canvas path) untouched.
let groundChassisRevision=null,groundChassisCache=new Map(),groundChassisEdges=new Map();
function groundChassisEdge(x,z,X,Z,profile,edges){
 const n=mapSize;
 if(x<1||z<1||X<1||Z<1||x>=n-1||z>=n-1||X>=n-1||Z>=n-1||
    Math.abs(X-x)+Math.abs(Z-z)!==1||
    mapCells[z]?.[x]!==0||mapCells[Z]?.[X]!==0||
    Math.abs(floorHeightAtCell(x,z)-floorHeightAtCell(X,Z))>.245)return false;
 const direction=X>x?0:X<x?1:Z>z?2:3,idx=(z*n+x)*4+direction;
 if(edges[idx])return edges[idx]===1;
 const clear=navPhysicalEdge(x,z,X,Z,profile);
 edges[idx]=clear?1:-1;
 edges[(Z*n+X)*4+(direction^1)]=edges[idx];
 return clear;
}
function groundChassisField(e,p){
 if(e.airborne||!game||!p)return null;
 const profile=upperDeckProfile(e),n=mapSize;
 const px=Math.floor(p.x),pz=Math.floor(p.z);
 if(px<1||pz<1||px>=n-1||pz>=n-1)return null;
 const equipment=worldEquipmentGrid(),destroyed=Number(game.nodesDestroyed)||0;
 const revision=[game,mapCells,heightCells,deckCells,glReady,worldSolidGrid,worldSolidCount,equipment,destroyed,n];
 if(!groundChassisRevision||revision.some((value,i)=>value!==groundChassisRevision[i])){
  groundChassisRevision=revision;groundChassisCache.clear();groundChassisEdges.clear();
 }
 const target=pz*n+px,cacheKey=target+':'+profile.key;
 if(groundChassisCache.has(cacheKey))return groundChassisCache.get(cacheKey).field;
 const field=new Int16Array(n*n);field.fill(32767);
 let edges=groundChassisEdges.get(profile.key);
 if(!edges){if(groundChassisEdges.size>=8)groundChassisEdges.delete(groundChassisEdges.keys().next().value);
  edges=new Int8Array(n*n*4);groundChassisEdges.set(profile.key,edges);}
 const q=new Int32Array(n*n);let head=0,tail=0;
 const tileOpen=(x,z)=>x>=1&&z>=1&&x<n-1&&z<n-1&&
  mapCells[z]?.[x]===0&&navStandingFeet(x+.5,z+.5,profile)!==null;
 // A large robot may not fit in the player's own cell. In that case it
 // should reach the nearest physically valid attack position instead of
 // pretending that an obstructed cell is traversable.
 if(tileOpen(px,pz)){field[target]=0;q[tail++]=target;}
 else for(let d=1;d<=2;d++)for(let dz=-d;dz<=d;dz++)for(let dx=-d;dx<=d;dx++){
  if(Math.abs(dx)+Math.abs(dz)!==d)continue;
  const x=px+dx,z=pz+dz,key=z*n+x;
  if(!tileOpen(x,z)||field[key]!==32767)continue;
  field[key]=0;q[tail++]=key;
 }
 while(head<tail){
  const index=q[head++],x=index%n,z=(index/n)|0,d=field[index]+1;
  for(const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0]]){
   const X=x+dx,Z=z+dz;
   if(X<1||Z<1||X>=n-1||Z>=n-1||d>=field[Z*n+X]||
      !groundChassisEdge(x,z,X,Z,profile,edges))continue;
   const next=Z*n+X;field[next]=d;q[tail++]=next;
  }
 }
 if(groundChassisCache.size>=8)groundChassisCache.delete(groundChassisCache.keys().next().value);
 groundChassisCache.set(cacheKey,{field,edges});
 return field;
}
// STAGE 11 — A spawn is a physical placement, not merely a free map tile.
// Stage 10 made moving actors tangible, but the old random generator could
// materialise them inside an existing robot. Never use the portal as an unsafe
// last resort; a temporarily full arena should retry the wave later instead.
function enemySpawnSpaceClear(x,z,bodyRadius=.48,bodyHeight=1.9,spawnFeet=floorHeight(x,z),playerClearance=.60){
 const g=game;
 if(!g||!Number.isFinite(x)||!Number.isFinite(z)||
    x<1||z<1||x>=mapSize-1||z>=mapSize-1)return false;
 const r=Math.max(.25,Number(bodyRadius)||.48);
 // The renderer only controls STATIC mesh registration. A station, living
 // reactor or archive plinth remains a real worldEquipmentGrid AABB in Canvas.
 // Spawn clearance must match the movement/raycast system in BOTH modes.
 if(collide(x,z,Math.max(.45,r))||
    worldSolidBodyCollision(x,z,r,spawnFeet,bodyHeight))return false;
 const feet=spawnFeet,top=feet+bodyHeight;
 if(Math.hypot(x-g.p.x,z-g.p.z)<r+playerClearance &&
    feet<(g.p.feetY||0)+PLAYER_SOLID_HEIGHT-.004 && top>(g.p.feetY||0)+.004)return false;
 for(const e of g.enemies){
  if(e.dead||!Number.isFinite(e.x)||!Number.isFinite(e.z))continue;
  const ef=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
  if(top<=ef+.004||feet>=ef+enemyBodyHeight(e)-.004)continue;
  // A small buffer lets freshly spawned neighbours begin walking freely.
  if(Math.hypot(x-e.x,z-e.z)<r+enemyCrowdRadius(e)+.08)return false;
 }
 return true;
}
// A meaningful share of walking robots can start ON a balcony, not just on
// the lower floor. Reuse the same 3D spawn clearance, armour and crowd rules.
function randMidlevelSpawn(minDist=6,bodyRadius=.48,bodyHeight=1.9){
 if(!game||!midlevelSpecs.length)return null;
 const initial=Math.floor(Math.random()*midlevelSpecs.length);
 for(let i=0;i<midlevelSpecs.length;i++){
  const terrace=midlevelSpecs[(initial+i)%midlevelSpecs.length];
  const start=Math.floor(Math.random()*terrace.spawns.length);
  for(let j=0;j<terrace.spawns.length;j++){
   const point=terrace.spawns[(start+j)%terrace.spawns.length];
   const x=point.x,z=point.z,y=terrace.y;
   if(Math.abs(floorHeight(x,z)-y)>.035||
      hypot(x-game.p.x,z-game.p.z)<minDist)continue;
   if(enemySpawnSpaceClear(x,z,bodyRadius,bodyHeight,y))return {x,z,feetY:y};
  }
 }
 return null;
}
// Stage56: rooftop sentries can appear on a physically reachable roof. The
// geometry/support and clearances are checked at the ROOF altitude, not at
// the room's floor. Skip tight layouts without a ground-access fire escape.
function randRoofSpawn(minDist=6,bodyRadius=.48,bodyHeight=1.9){
 if(!game||!midlevelSpecs.length)return null;
 const first=Math.floor(Math.random()*midlevelSpecs.length);
 for(let i=0;i<midlevelSpecs.length;i++){
  const spec=midlevelSpecs[(first+i)%midlevelSpecs.length];
  if(spec.roofStairCount!==13)continue;
  for(const p of spec.roofSpawns||[]){
   if(Math.abs(deckHeight(p.x,p.z)-spec.roofY)>.025||
      hypot(p.x-game.p.x,p.z-game.p.z)<minDist)continue;
   if(enemySpawnSpaceClear(p.x,p.z,bodyRadius,bodyHeight,spec.roofY))
    return {x:p.x,z:p.z,feetY:spec.roofY};
  }
 }
 return null;
}
function randBalconySpawn(minDist=6,bodyRadius=.48,bodyHeight=1.9){
 if(!game||typeof balconySpecs==='undefined'||!balconySpecs.length)return null;
 for(let attempt=0;attempt<38;attempt++){
  const feature=skyFeatureSpecs.length&&Math.random()<.35?
   skyFeatureSpecs[Math.floor(Math.random()*skyFeatureSpecs.length)]:null;
  const gallery=!feature&&gallerySpecs.length&&Math.random()<.54?
   gallerySpecs[Math.floor(Math.random()*gallerySpecs.length)]:null;
  const elevated=feature?.spawns?.length?feature:gallery?.spawns?.length?gallery:null;
  const point=elevated?elevated.spawns[Math.floor(Math.random()*elevated.spawns.length)]:null;
  const b=point?null:balconySpecs[Math.floor(Math.random()*balconySpecs.length)];
  const x=point?point.x+(Math.random()-.5)*.18:b.cx+.5+(Math.random()-.5)*1.35;
  const z=point?point.z+(Math.random()-.5)*.18:b.cz+.5+(Math.random()-.5)*1.35;
  const y=point?elevated.y:b.y;
  if(Math.abs(deckHeight(x,z)-y)>.01)continue;
  if(hypot(x-game.p.x,z-game.p.z)<minDist)continue;
  if(enemySpawnSpaceClear(x,z,bodyRadius,bodyHeight,y))return {x,z,feetY:y};
 }
 return null;
}
function randFloor(minDist=7,bodyRadius=.48,bodyHeight=1.9){
 const g=game;if(!g)return null;
 if(midlevelSpecs.length&&bodyRadius<=.60&&bodyHeight<=2.3&&Math.random()<.13){
  const roof=randRoofSpawn(minDist,bodyRadius,bodyHeight);
  if(roof)return roof;
 }
 // The Stage50 balcony-spawn contract stays strictly ABOVE 2.15m. Mid-height
 // terraces are raised GROUND, so they belong in the regular floor-spawn
 // pool, not the upper-deck helper. Airborne robots and bosses use old rules.
 if(midlevelSpecs.length&&bodyRadius<=.60&&bodyHeight<=2.3&&Math.random()<.23){
  const mid=randMidlevelSpawn(minDist,bodyRadius,bodyHeight);
  if(mid)return mid;
 }
 let backup=null;
 for(let t=0;t<240;t++){
  const x=2+Math.random()*(mapSize-4),z=2+Math.random()*(mapSize-4);
  if(!enemySpawnSpaceClear(x,z,bodyRadius,bodyHeight))continue;
  const d=hypot(x-g.p.x,z-g.p.z);
  if(d<minDist)continue;
  if(d<Math.min(22,mapSize*.38)&&(d>11||!lineClear(g.p.x,g.p.z,x,z)))return {x,z};
  if(!backup)backup={x,z};
 }
 if(backup)return backup;
 // A predictable fallback is vital in a crowded arena: random retries can
 // miss the last free tile. Search cell centres and a small offset grid, but
 // do not summon a robot inside another robot or the portal's structures.
 const offsets=[[.5,.5],[.28,.28],[.72,.72],[.28,.72],[.72,.28]];
 let best=null,bestScore=-Infinity;
 for(let z=1;z<mapSize-1;z++)for(let x=1;x<mapSize-1;x++){
  if(mapCells[z]?.[x]!==0)continue;
  for(const [u,v] of offsets){
   const xx=x+u,zz=z+v,d=hypot(xx-g.p.x,zz-g.p.z);
   if(d<minDist||!enemySpawnSpaceClear(xx,zz,bodyRadius,bodyHeight))continue;
   // Prefer the original spawning band near the player, without depending on
   // PRNG luck. Never sacrifice collision validity for proximity.
   const score=-Math.abs(d-Math.min(15,Math.max(minDist,11)))+.0001*(xx+zz);
   if(score>bestScore){best={x:xx,z:zz};bestScore=score;}
  }
 }
 return best;
}
// Stage95 — choose a spawn by the FINAL physical silhouette, not a generic
// scout radius. Bosses, heavy frames and every fifth elite otherwise appear
// partly inside a wall/metal chassis despite safe-scanning for a smaller bot.
function spawnEnemy(type,boss=false,forceElite=false){
 const g=game,air=!boss&&['drone','skyhunter','skyguard','stormray'].includes(type);
 const prop=boss?{name:bossNames[((g.sector/5)|0)-1>=0?(((g.sector/5)|0)-1)%bossNames.length:0],
  hp:430+g.sector*55,speed:.58,damage:17+g.sector*1.2,range:14,
  color:[1,.25,.62],radius:1.03,score:1300}:enemies[type]||enemies.scout;
 // The hunt/signal commander must use its FINAL elite silhouette during
 // position selection, before any champion-specific HP/armour mutations.
 const elite=!boss&&(forceElite||(g.sector>=3&&g.spawned%5===4));
 const radius=(Number(prop.radius)||.48)*(elite?1.13:1);
 const physical={radius,boss,airborne:air,elite,type:boss?'boss':type};
 const spawnRadius=Math.max(boss?.84:air?.66:.48,
  enemyBodyRadius(physical),enemyCrowdRadius(physical));
 const flightHeight=air?Math.max(2.12,2.12*Math.max(.76,Math.min(1.31,radius/.51))):1.9;
 // Spawn must reserve the same full rendered head height as walking,
 // navigation and checkpoint recovery; 2.2m was too short for a 3m brute.
 const spawnHeight=Math.max(enemyBodyHeight(physical)+.08,
  boss?3.1:air?flightHeight+.18:
   ['brute','warden','artillery'].includes(type)?2.2:1.9);
 const p=(!boss&&!air&&typeof balconySpecs!=='undefined'&&balconySpecs.length&&Math.random()<.36?
  randBalconySpawn(6,spawnRadius,spawnHeight):null)||
  randFloor(boss?11:6,spawnRadius,spawnHeight);
 if(!p)return null;
 let scale=1+Math.max(0,g.sector-1)*.055;let obj={id:++g.idCounter,x:p.x,z:p.z,feetY:Number.isFinite(p.feetY)?p.feetY:floorHeight(p.x,p.z),type:boss?'boss':type,boss,airborne:air,elite,orbit:Math.random()<.5?-1:1,telegraph:0,lockTarget:null,variant:boss?((Math.floor(g.sector/5)-1)%bossNames.length):0,hp:prop.hp*scale,maxhp:prop.hp*scale,speed:prop.speed*(1+g.sector*.015),damage:prop.damage*scale,range:prop.range,color:boss?themes[sectorStyle%themes.length].accent:prop.color,radius,score:prop.score,attack:rand(.3,1.7),spawn:0,flash:0,bossPhase:0,trail:0,charge:0,stun:0,dead:false,robotYaw:Math.atan2(g.p.x-p.x,g.p.z-p.z),robotEyeYaw:Math.atan2(g.p.x-p.x,g.p.z-p.z),robotCycle:Math.random()*6.283,robotMotion:0,robotTurn:0,robotLean:0,robotStrafe:0,robotReverse:0,robotInertia:0,robotAttackState:0,robotDamageHeat:0};if(obj.airborne)obj.feetY=floorHeight(p.x,p.z)+.13;if(obj.elite){obj.hp*=2.1;obj.maxhp=obj.hp;obj.damage*=1.28;obj.speed*=1.12;obj.score*=2.5;obj.color=[Math.min(1,prop.color[0]*.6+.42),Math.min(1,prop.color[1]*.58+.23),Math.min(1,prop.color[2]*.6+.48)];}const armorKind=boss?'boss':type;
 const armorClasses={boss:[Math.round(obj.maxhp*.80),.74],brute:[145,.56],warden:[200,.69],artillery:[110,.48],skyguard:[145,.56]};
 const armorSpec=armorClasses[armorKind]||(obj.elite?[Math.round(obj.maxhp*.43),.42]:null);
 if(armorSpec){obj.protection=Math.round(armorSpec[0]*(boss?1:scale));obj.maxProtection=obj.protection;obj.protectionRating=armorSpec[1];}
 else {obj.protection=0;obj.maxProtection=0;obj.protectionRating=0;}
 g.enemies.push(obj);if(boss){g.boss=obj;$('bossTitle').textContent=prop.name;$('bossWrap').style.display='block';toast('☠ БОСС: '+prop.name,2.6);sound(85,.28,'sawtooth',.22)}return obj}
function spawnWave(dt){const g=game;if(g.spawned>=g.target||g.portalReady)return;g.waveDelay-=dt;if(g.waveDelay>0)return;if(g.sector%5===0){if(!spawnEnemy('boss',true)){g.waveDelay=.75;return;}g.spawned=1;return}let active=g.enemies.filter(x=>!x.dead).length;if(active>=Math.min(6+g.sector*.4,14)){g.waveDelay=.6;return}let pool=['scout','scout','scout','shooter','charger'];if(g.sector>2)pool.push('brute');if(g.sector>3)pool.push('sniper','medic');if(g.sector>5)pool.push('warden');if(g.sector>8)pool.push('artillery');if(g.sector>11)pool.push('drone');if(g.sector>=14)pool.push('skyhunter');if(g.sector>=20)pool.push('skyguard');if(g.sector>=26)pool.push('stormray');if(sectorStyle>=14&&g.sector>=20)pool.push('skyhunter','stormray');if(g.sector>=8)pool.push('raider');// Radio interception is an actual TWO-PHASE operation: do not summon
 // its marked commander before the physical battery stations are linked.
 // Reserve the final wave slot while scanning, even if every other enemy
 // has already been killed. This prevents a late-game objective soft-lock.
 const waitingSignal=g.mission?.type==='signal'&&
  (g.mission.signalDone||0)<(g.mission.signalRequired||0)&&
  !g.mission.commanderKilled&&!g.mission.sentinelId;
 if(waitingSignal&&g.spawned>=g.target-1){g.waveDelay=.6;return;}
 let isHunt=['hunt','signal'].includes(g.mission?.type)&&!g.mission.sentinelId&&
  !g.mission.commanderKilled&&!waitingSignal&&g.spawned>=Math.floor(g.target*.48);
 let e=spawnEnemy(isHunt?(g.sector>8?'warden':'brute'):pick(pool),false,isHunt);if(!e){g.waveDelay=.75;return;}if(isHunt){e.elite=true;e.maxhp*=2.45;e.hp=e.maxhp;e.damage*=1.35;e.score*=3;e.color=[1,.64,.22];e.maxProtection=Math.max(e.maxProtection||0,Math.round(e.maxhp*.45));e.protection=e.maxProtection;e.protectionRating=Math.max(e.protectionRating||0,.44);g.mission.sentinelId=e.id;toast('♜ КОМАНДИР ОБНАРУЖЕН · ПОВЫШЕННАЯ УГРОЗА',2.4)}g.spawned++;g.waveDelay=rand(.42,.95)*Math.pow(.98,g.sector);}
// A capped, short-lived debris system: no enduring robot shadow / corpse decals.
function spawnRobotArmorDebris(e,count=3,lethal=false){
 const g=game;if(!g)return;
 if(!Array.isArray(g.robotDebris))g.robotDebris=[];
 const cap=touchOnly?34:66;
 const palette=robotPalette(e.boss?'boss':e.type);
 const floor=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
 const level=lethal?1.10:1.36;
 const speed=lethal?3.7:2.1;
 const angle=Number.isFinite(e.robotYaw)?e.robotYaw:0;
 for(let i=0;i<count;i++){
   const a=Math.random()*TAU,side=(i%2?1:-1);
   const r=(lethal?.14:.11)+Math.random()*.16;
   g.robotDebris.push({x:e.x+Math.cos(a)*.15,z:e.z+Math.sin(a)*.15,
     y:floor+level+Math.random()*.38, vx:Math.cos(a)*(speed*.45+Math.random()*speed*.55),
     vy:1.05+Math.random()*(lethal?2.0:1.3),vz:Math.sin(a)*(speed*.45+Math.random()*speed*.55),
     rx:Math.random()*TAU,rz:Math.random()*TAU, spin:(Math.random()-.5)*12,
     size:r, life:lethal?3.4:2.1, ttl:lethal?3.4:2.1,
     color:((i%4)===0?palette.highlight:(i%3===0?RF.iron:palette.base)).slice(),
     glow:(i%7)===0, rested:false, bounces:0});
 }
 if(g.robotDebris.length>cap)g.robotDebris.splice(0,g.robotDebris.length-cap);
}
// STAGE104 — steel fragments are actually drawn as 3D meshes, but previously
// their motion only tested a flat wall cell and floorHeight(). A shard could
// fly THROUGH a real steel beam, a reactor casing or an elevated bridge.
// Use the same exact, continuous swept-sphere AABB as rockets, with a sphere
// radius fitted inside the visual shard. No separate, nonphysical obstacle map.
function updateRobotDebris(dt){
 const g=game;if(!g||!Array.isArray(g.robotDebris)||!g.robotDebris.length)return;
 const out=[];
 for(const sh of g.robotDebris){
  sh.life-=dt;
  if(sh.life<=0||![sh.x,sh.y,sh.z].every(Number.isFinite))continue;
  if(!sh.rested){
   // The visual fragment is an irregular .76–1.0 scaled mesh. A conservative
   // inscribed sphere prevents both tunnelling and invisible inflated corners.
   const radius=Math.max(.018,Math.min(.14,(Number(sh.size)||.12)*.43));
   sh.vy-=9.5*dt;
   const dx=sh.vx*dt,dy=sh.vy*dt,dz=sh.vz*dt;
   const distance=Math.hypot(dx,dy,dz);
   if(distance>1e-9){
    const dir={x:dx/distance,y:dy/distance,z:dz/distance};
    const hit=sweepWorldSphere({x:sh.x,y:sh.y,z:sh.z},dir,distance,radius);
    if(hit){
     const t=Math.max(0,hit.t-.001);
     sh.x+=dir.x*t;sh.y+=dir.y*t;sh.z+=dir.z*t;
     // Starting in a surface (possible with legacy checkpoint coordinates):
     // use the actual closest face rather than leave the shard stuck inside.
     if(hit.t<=.00001&&Number.isFinite(hit.x)&&Number.isFinite(hit.y)&&Number.isFinite(hit.z)){
      sh.x=hit.x+hit.nx*(radius+.001);
      sh.y=hit.y+hit.ny*(radius+.001);
      sh.z=hit.z+hit.nz*(radius+.001);
     }
     const vx=sh.vx,vy=sh.vy,vz=sh.vz;
     const toward=vx*hit.nx+vy*hit.ny+vz*hit.nz;
     if(toward<0){
      const restitution=.28,friction=.61;
      sh.vx=(vx-toward*hit.nx)*friction-toward*hit.nx*restitution;
      sh.vy=(vy-toward*hit.ny)*friction-toward*hit.ny*restitution;
      sh.vz=(vz-toward*hit.nz)*friction-toward*hit.nz*restitution;
     }else{sh.vx*=.45;sh.vy*=.45;sh.vz*=.45;}
     if(hit.ny>.60){
      sh.bounces=(sh.bounces||0)+1;
      if(sh.bounces>=2||Math.abs(sh.vy)<.42){
       sh.rested=true;sh.vx=0;sh.vy=0;sh.vz=0;
      }
     }
    }else{sh.x+=dx;sh.y+=dy;sh.z+=dz;}
   }
   sh.rx+=sh.spin*dt;sh.rz-=sh.spin*.67*dt;
  }
  out.push(sh);
 }
 g.robotDebris=out;
}

function awardKill(e){const g=game;spawnRobotArmorDebris(e,e.boss?15:e.elite?9:6,true);g.kills++;g.combo++;g.comboAt=g.t;g.score+=e.score*(1+Math.min(g.combo,15)*.06)|0;g.p.hp=Math.min(g.p.maxhp,g.p.hp+g.p.vamp);save.kills++;if(e.elite){toast('★ ЭЛИТА УНИЧТОЖЕНА · БОНУС ОЧКОВ',1.2);}if(Math.random()<.34||e.boss||e.elite){let type=e.boss?'heal':Math.random()<.20?'heal':Math.random()<.65?'energy':'credits';{const drop=worldLootSpawn(e,type,16);if(drop)g.loot.push(drop);}}
 if(e.elite||(!e.boss&&Math.random()<.10)){const drop=worldLootSpawn(e,'plates',23,.18,-.17);if(drop)g.loot.push(drop);}
 if(['hunt','signal'].includes(g.mission?.type)&&e.id===g.mission.sentinelId){
  if(g.mission.type==='signal'){g.mission.commanderKilled=true;missionRefreshCombinedProgress(g.mission);}
  else g.mission.done=1;
  g.score+=450;toast('♜ КОМАНДИР УСТРАНЁН',1.5);}burst(e.x,1.2+(e.feetY||0),e.z,e.color,e.boss?34:11);/* Robot deaths should not leave a permanent dark floor shadow.
   Keep kill feedback via particles and loot only; reserve scorch marks for
   weapon and environmental impacts rather than enemy disposal. */if(e.boss)for(let k=0;k<6;k++){const drop=worldLootSpawn(e,'credits',22,rand(-.8,.8),rand(-.8,.8));if(drop)g.loot.push(drop);}if(g.spawned>=g.target&&!g.enemies.some(x=>!x.dead))maybeFinishMission(g)}
function hurtEnemy(e,damage,options={}){
 if(e.dead||!game)return;
 const crit=Math.random()<game.p.crit;
 let dm=damage*game.p.damage*(crit?game.p.critDamage:1);
 if(e.type!=='warden'&&game.enemies.some(z=>!z.dead&&z.type==='warden'&&z.stun<=0&&distance(z,e)<4.2))dm*=.72;
 const prevHp=e.hp,prevProtection=Math.max(0,Number(e.protection)||0);
 const maxProtection=Math.max(0,Number(e.maxProtection)||0);
 const rating=clamp(Number(e.protectionRating)||0,0,.94);
 const penetration=clamp(Number(options.penetration)||0,0,1);
 let blocked=0;
 if(prevProtection>0&&rating>0){
  // Armor has REAL hit-point durability. Penetrating damage bypasses reduction.
  // If the final plate runs out mid-hit, the uncovered portion hits the chassis.
  const desiredBlock=dm*rating*(1-penetration);
  blocked=Math.min(desiredBlock,prevProtection/1.18);
  e.protection=Math.max(0,prevProtection-blocked*1.18);
 }
 const chassis=Math.max(0,dm-blocked);
 e.hp-=chassis;
 const before=maxProtection>0?prevProtection/maxProtection:prevHp/e.maxhp;
 const after=maxProtection>0?Math.max(0,e.protection)/maxProtection:e.hp/e.maxhp;
 const armorStage=v=>v>.71?0:v>.46?1:v>.29?2:3;
 if(armorStage(after)>armorStage(before)&&e.hp>0)
  spawnRobotArmorDebris(e,(e.boss?6:3)*(armorStage(after)-armorStage(before)));
 e.flash=.13;e.hitReact=.24;
 e.robotDamageHeat=Math.min(1,(Number(e.robotDamageHeat)||0)+Math.min(.6,chassis/Math.max(1,e.maxhp)*3));
 game.score+=Math.ceil(chassis*.4);showDamage(e,Math.round(chassis),crit);
 if(e.hp<=0){e.dead=true;awardKill(e)}else sound(blocked>0?108:170,.055,'triangle',.035);
}
function damagePlayer(d,source=null){const p=game.p;if(game.state!=='playing')return;
 if(p.shield>0){
  if(game.t-(p.lastShieldHitAt??-100)>.16){p.lastShieldHitAt=game.t;
   if(typeof operatorHitReaction==='function')operatorHitReaction(p,source,{blocked:true});}
  return;
 }
 if(p.iframes>0)return;
 p.armorDelay=0;let amount=d;if(p.armor>0){const fraction=clamp(.72+(p.armorTier||0)*.035,.72,.86),a=Math.min(amount*fraction,p.armor);p.armor-=a;amount-=a;
 const bar=$('bars');bar.classList.add('armorHit');setTimeout(()=>bar.classList.remove('armorHit'),180);
 }
 if((p.bodyArmor||0)>0&&(p.bodyArmorReduction||0)>0){
  const reduced=amount*p.bodyArmorReduction;
  const wear=Number.isFinite(p.bodyArmorWear)&&p.bodyArmorWear>0?p.bodyArmorWear:1.12;
  const absorbed=Math.min(reduced,p.bodyArmor/wear);
  p.bodyArmor=Math.max(0,p.bodyArmor-absorbed*wear);
  amount=Math.max(0,amount-absorbed);
  if(absorbed>0){
   const bar=$('bars');
   bar.classList.add('suitHit');
   setTimeout(()=>bar.classList.remove('suitHit'),240);
  }
 }
 // A fully operational pilot has a one-hit shock limiter. Even a late-boss
 // bomb cannot erase an otherwise healthy character outright when the suit
 // wears out; a *second* mistake is still deadly, so dodging remains vital.
 if(p.hp>=p.maxhp*.80)amount=Math.min(amount,p.maxhp*.72);
 p.hp=Math.max(0,p.hp-amount);p.iframes=.35;
 if(typeof operatorHitReaction==='function')operatorHitReaction(p,source);
 $('damageFlash').style.opacity=String(clamp(amount/75,.08,.29));setTimeout(()=>$('damageFlash').style.opacity='0',95);sound(115,.14,'sawtooth',.1);if(p.hp<=0)gameOver()}
function burst(x,y,z,col,count=9){const g=game;for(let i=0;i<count;i++){let a=rand(0,TAU),v=rand(.4,3.5),vy=rand(-.4,2.8),life=rand(.25,.85);g.particles.push({x,y,z,vx:Math.cos(a)*v,vz:Math.sin(a)*v,vy,life,maxLife:life,a:rand(0,TAU),col})}}

// Stage119: one audiovisual EMI effect for campaign and PvP. No damage logic.
function emitPulseFx(x,y,z,volume=.2){
 burst(x,y,z,[.36,.95,1],45);
 if(volume>0)sound(190,.28,'sawtooth',volume);
}

// Stage120: presentation shared by campaign, real PvP and local practice.
function emitWeaponSound(w,gain=1){
 if(gain>0)sound(w.pierce?135:w.blast?110:w.shots>1?165:w.rate<.09?280:218,w.blast?.24:.10,w.pierce||w.blast?'sawtooth':'triangle',(w.blast?.12:.058)*gain);
}
function emitDashFx(x,y,z,gain=1){burst(x,y,z,[.33,1,1],14);if(gain>0)sound(380,.14,'triangle',.07*gain);}
function emitShieldFx(x,y,z,gain=1){burst(x,y,z,[.58,.58,1],18);if(gain>0)sound(460,.2,'sine',.13*gain);}
function emitRepairFx(x,y,z,kind='hp',gain=1){
 burst(x,y,z,kind==='hp'?[.22,1,.66]:kind==='bodyArmor'?[.96,.78,.37]:[.45,.73,1],10);
 if(gain>0)sound(kind==='hp'?640:kind==='bodyArmor'?500:440,.10,'sine',.07*gain);
}
function emitExplosionFx(x,y,z,w,r=w.blast||1.15,gain=1){
 burst(x,y,z,w.color||[1,.6,.3],save.settings.quality===0?20:44);
 game.impactFx.push({x,y,z,life:.48,maxLife:.48,r:r*.64,col:w.color||[1,.5,.1],explosion:true});
 if(game.impactFx.length>38)game.impactFx.shift();
 if(gain>0)sound(w.name.includes('ГРОМ')?73:99,.4,'sawtooth',.19*gain);
}

// Stage121: same presentation lifecycle for all modes. This is strictly
// visual; never mutate collision, damage, score, energy or network state.
function emitShotTracer(o,end,w,width=1,localView=false){
 const g=game;if(!g)return;
 const life=w.pierce?.22:.13;
 g.tracers.push({a:{...o},b:{...end},life,maxLife:life,r:(w.pierce?.052:.017)*width,col:w.color,localView});
 const cap=typeof touchOnly!=='undefined'&&touchOnly?35:65;
 if(g.tracers.length>cap)g.tracers.splice(0,g.tracers.length-cap);
}
function advanceSharedImpactFx(g,dt){
 if(g.decals){const n=g.decals.length;g.decals=g.decals.filter(d=>(d.life-=dt)>0);if(n!==g.decals.length)decalDirty=true;}
 if(g.impactFx)g.impactFx=g.impactFx.filter(f=>(f.life-=dt)>0);
}
function advanceSharedWorldFx(g,dt){
 if(g.particles){
  for(const b of g.particles){b.life-=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;b.vy-=dt*(b.fxGravity??2);}
  g.particles=g.particles.filter(b=>b.life>0);
  if(g.particles.length>140)g.particles.splice(0,g.particles.length-140);
 }
 if(g.tracers)g.tracers=g.tracers.filter(t=>(t.life-=dt)>0);
 if(g.scorch)g.scorch=g.scorch.filter(a=>(a.life-=dt)>0);
}

// Muzzle intensity and recoil are properties of the emitted shot, not mode.
function applyWeaponShotPose(p,w){
 p.shotGlow=Math.max(p.shotGlow||0,.115+(w.recoil||.3)*.065);
 p.recoil=Math.min(1.8,(p.recoil||0)+(w.recoil||.3)*.68);
}

function emitOverheatFx(){
 if(typeof toast==='function')toast('ПЕРЕГРЕВ ОРУЖИЯ',.75);
 sound(70,.15);
}
