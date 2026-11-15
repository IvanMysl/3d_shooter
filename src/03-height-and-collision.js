
// VERTICAL FRONTIER — genuine stair-height terrain, reproducibly generated per sector.
let heightCells=new Float32Array(0), deckCells=new Float32Array(0), stairStages=[], bridgeSpecs=[],skyDeckSpecs=[];
const BRIDGE_Y=2.20, BRIDGE_RISE=.22;
function deckAtCell(x,z){return x>=0&&z>=0&&x<mapSize&&z<mapSize&&deckCells.length?deckCells[z*mapSize+x]||0:0;}
function deckHeight(x,z){return deckAtCell(Math.floor(x),Math.floor(z));}
function supportHeight(a,x,z){
 const ground=floorHeight(x,z), deck=deckHeight(x,z);
 if(!deck)return ground;
 const feet=Number.isFinite(a?.feetY)?a.feetY:ground;
 return feet>=deck-.28?deck:ground;
}
// The four sky-shipyard world families have a genuinely tall atrium.
function ceilingHeight(){return sectorStyle>=14?15.0:4.25;}
const STAIR_RISE=.215, JUMP_VELOCITY=4.8, JUMP_GRAVITY=13.6;
const FLIGHT_SPEED=4.4;
// The solid player body (helmet plus torso). Very thin suit antennas are visual.
const PLAYER_SOLID_HEIGHT=1.95;
function floorHeightAtCell(x,z){
 if(x<0||z<0||x>=mapSize||z>=mapSize||!heightCells.length)return 0;
 return heightCells[z*mapSize+x]||0;
}
function floorHeight(x,z){return floorHeightAtCell(Math.floor(x),Math.floor(z));}
function makeStairHeights(level){
 heightCells=new Float32Array(mapSize*mapSize);deckCells=new Float32Array(mapSize*mapSize);stairStages=[];bridgeSpecs=[];skyDeckSpecs=[];
 const centre=Math.floor(mapSize/2), boss=level%5===0;
 // Every sector has one raised central deck; certain layouts add side decks.
 function stage(cx,cz,radius,maxSteps=4){
  cx=Math.floor(cx);cz=Math.floor(cz);
  if(mapCells[cz]?.[cx]!==0)return false;
  const needs=[];let validCells=0;
  for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
   let x=cx+dx,z=cz+dz;
   if(x<2||z<2||x>=mapSize-2||z>=mapSize-2||mapCells[z][x]!==0)continue;
   validCells++;
   const d=Math.max(Math.abs(dx),Math.abs(dz));
   const steps=Math.min(maxSteps,Math.max(0,radius-d));
   if(steps>0)needs.push({x,z,h:steps*STAIR_RISE});
  }
  if(validCells < (2*radius+1)**2*.79)return false;
  for(const t of needs)heightCells[t.z*mapSize+t.x]=Math.max(heightCells[t.z*mapSize+t.x],t.h);
  stairStages.push({x:cx+.5,z:cz+.5,radius,top:Math.min(maxSteps,radius)*STAIR_RISE});
  return true;
 }
 if(sectorStyle<14)stage(centre,centre,boss?9:6,4);
 // Secondary decks appear in chamber-rich levels, as well as in two new worlds.
 const extra=(level%4===0||level%4===2)?1:2;
 let made=0;
 for(let i=1;i<mapRooms.length&&made<extra;i++){
  const r=mapRooms[(i*5+level)%mapRooms.length];
  if(!r||r.w<9||r.h<9||Math.hypot(r.x-centre,r.z-centre)<(sectorStyle>=14?20:12))continue;
  if(stage(r.x-.5,r.z-.5,Math.min(4,Math.floor(Math.min(r.w,r.h)/2)-1),3))made++;
 }
 // A true two-level overpass: ground traffic can pass under the deck, while
 // players and enemies ascend two ten-step stair flights to the upper floor.
 // The deck is separate from heightCells, preserving the lower passage.
 if(sectorStyle>=14){
  const c=Math.floor(mapSize/2), width=2, halfLen=sectorStyle===15?7:5;
  for(let z=c-halfLen;z<=c+halfLen;z++)for(let x=c-3;x<=c+3;x++){
   if(mapCells[z]?.[x]===0)deckCells[z*mapSize+x]=BRIDGE_Y;
  }
  for(const side of [-1,1])for(let i=0;i<10;i++){
   const x=c+side*(4+i), h=(10-i)*BRIDGE_RISE;
   for(let z=c-width;z<=c+width;z++){
    if(mapCells[z]?.[x]===0)heightCells[z*mapSize+x]=h;
   }
  }
  bridgeSpecs.push({x:c+.5,z:c+.5, y:BRIDGE_Y, width:7,length:halfLen*2+1,stairRun:10,underpass:true});
  stairStages.push({x:c+.5,z:c+.5,radius:14,top:BRIDGE_Y,kind:'overpass'});
  // Two truly airborne 3×3 maintenance platforms. Reachable by flight;
  // ordinary stairs/ground navigation do not magically climb to their height.
  for(let i=0;i<mapRooms.length&&skyDeckSpecs.length<2;i++){
   const room=mapRooms[(i*3+level)%mapRooms.length];
   if(!room||room.w<8||room.h<8)continue;
   const cx=Math.floor(room.x-.5),cz=Math.floor(room.z-.5);
   if(Math.hypot(cx-c,cz-c)<10)continue;
   let clear=true;
   for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
    const x=cx+dx,z=cz+dz;
    if(mapCells[z]?.[x]!==0||deckAtCell(x,z)>0||floorHeightAtCell(x,z)>.3)clear=false;
   }
   if(!clear)continue;
   const altitude=7.25+skyDeckSpecs.length*1.5;
   for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)deckCells[(cz+dz)*mapSize+(cx+dx)]=altitude;
   skyDeckSpecs.push({x:cx+.5,z:cz+.5,y:altitude,radius:1});
  }
 }
}
// Keep ordinary movement unchanged while preventing a long low-FPS frame or
// a dash step from jumping over a thin handrail or an entire wall tile.
// Each short microstep preserves the original X-then-Z slide behavior.
function tryMoveEntity(a,dx,dz,r=.23){
 if(!Number.isFinite(dx)||!Number.isFinite(dz))return;
 const player=!!game&&a===game.p;
 const enemy=!player&&!!a.maxhp&&(!!a.type||a.boss);
 const length=Math.hypot(dx,dz);
 const steps=Math.max(1,Math.ceil(length/Math.max(.13,r*.72)));
 const sx=dx/steps,sz=dz/steps;
 for(let i=0;i<steps;i++){
  const feet=Number.isFinite(a.feetY)?a.feetY:floorHeight(a.x,a.z);
  const permit=(x,z)=>{
   // X and Z slide independently. Crossing X may change the grounded
   // operator's foot level before Z is considered in this same microstep.
   const currentFeet=player&&Number.isFinite(a.feetY)?a.feetY:feet;
   const raised=enemy&&a.airborne?feet:supportHeight(a,x,z);
   if(collide(x,z,r)||
      (enemy&&a.airborne?feet<floorHeight(x,z)+.12:raised>currentFeet+.245))return false;
   // A normal stair is <= .245 m high. Test body clearance at the height
   // the grounded operator will actually occupy after stepping onto it.
   // Testing with the PREVIOUS foot height can mistake a traversable riser
   // for a chest-high obstacle, especially when a tread borders a rail.
   if(player)return !worldSolidBodyCollision(x,z,r,Math.max(currentFeet,raised),PLAYER_SOLID_HEIGHT);
   if(enemy)return !worldSolidBodyCollision(x,z,r,Math.max(feet,raised),enemyBodyHeight(a)) &&
     (typeof enemyCrowdAllows!=='function'||enemyCrowdAllows(a,x,z,r));
   return true;
  };
  // Player support must follow accepted microsteps, not just the final
  // frame. Otherwise a sprint/low-FPS frame can climb the first 0.215 m
  // tread and then reject every higher tread against stale feetY=0.
  const settleStair=()=>{
   if(!player||!a.grounded)return;
   const support=supportHeight(a,a.x,a.z),delta=support-a.feetY;
   if(Math.abs(delta)<=.245)a.feetY=support;
  };
  if(permit(a.x+sx,a.z)){a.x+=sx;settleStair();}
  if(permit(a.x,a.z+sz)){a.z+=sz;settleStair();}
  if(!player&&!(enemy&&a.airborne))a.feetY=supportHeight(a,a.x,a.z);
 }
}
function queueJump(){if(game?.state==='playing'&&!arsenalOpened)input.jumpQueued=true;}
function toggleFlight(){
 if(!game||game.state!=='playing'||arsenalOpened)return false;
 const p=game.p;
 if(!p.flightUnlocked){toast('ПОЛЁТ: КОСТЮМ №10–16 ИЛИ УЛУЧШЕНИЕ LVL 10',1.4);return false;}
 p.flying=!p.flying;
 p.vy=0;if(p.flying){p.grounded=false;input.jumpQueued=false;}
 if(typeof refreshFlightButtons==='function')refreshFlightButtons();
 toast(p.flying?'ПОЛЁТ ВКЛ · SPACE ↑ · SHIFT ↓':'ПОЛЁТ ВЫКЛ',1.5);
 return p.flying;
}
function updateVertical(p,dt){
 const terrain=supportHeight(p,p.x,p.z);
 const beam=typeof worldSolidStandingSupport==='function'?
  worldSolidStandingSupport(p.x,p.z,.23,p.feetY):null;
 const floor=beam===null?terrain:Math.max(terrain,beam);
 const deck=deckHeight(p.x,p.z);
 if(!Number.isFinite(p.feetY)){p.feetY=floor;p.grounded=true;p.vy=0;}
 if(p.flying&&!p.flightUnlocked)p.flying=false;
 if(p.flying){
  const ascend=!!(input.flyUp||input.keys?.Space);
  const descend=!!(input.flyDown||input.keys?.ShiftLeft||input.keys?.ShiftRight||input.keys?.ControlLeft||input.keys?.ControlRight);
  const direction=Number(ascend)-Number(descend);
  const before=p.feetY,maxFeet=Math.max(floor,ceilingHeight()-PLAYER_SOLID_HEIGHT-.2);
  const flightVerticalSpeed=FLIGHT_SPEED*flightSpeedMultiplier('vertical')*normalizeFlightThrottle(save.settings.flightVertical);
  let after=clamp(before+direction*flightVerticalSpeed*dt,floor,maxFeet);
  if(after>before){
   const fromHead=before+PLAYER_SOLID_HEIGHT,toHead=after+PLAYER_SOLID_HEIGHT;
   if(deck>0&&fromHead<=deck-.17+.001&&toHead>deck-.17)after=Math.min(after,deck-.17-PLAYER_SOLID_HEIGHT-.004);
   if(glReady){const bar=worldSolidHeadBarrier(p.x,p.z,.23,fromHead,toHead);
    if(bar!==null)after=Math.min(after,bar-PLAYER_SOLID_HEIGHT-.004);}
  }else if(after<before&&glReady){
   const roof=worldSolidFeetBarrier(p.x,p.z,.23,before,after);
   if(roof!==null)after=Math.max(after,roof+.004);
  }
  p.feetY=clamp(after,floor,maxFeet);p.vy=0;
  p.grounded=p.feetY<=floor+.003;
  input.jumpQueued=false;
  return;
 }
 if(p.grounded){
  if(floor<=p.feetY+.24 && p.feetY-floor<=.245)p.feetY=floor;
  else if(floor<p.feetY-.245){p.grounded=false;p.vy=0;}
  else p.feetY=Math.max(p.feetY,floor);
 }
 // Keyboard-held Space queues a new jump on every landing; touch remains a
 // one-shot tap until a later input-mode revision explicitly changes it.
 if(input.jumpHeld&&p.grounded&&game?.state==='playing'&&!arsenalOpened)input.jumpQueued=true;
 if(input.jumpQueued){
  input.jumpQueued=false;
  if(p.grounded){p.grounded=false;p.vy=JUMP_VELOCITY;p.feetY+=.008;
   if(save.settings.audio)sound(250,.09,'triangle',.045);
  }
 }
 if(!p.grounded){
  p.vy-=JUMP_GRAVITY*dt;
  const prevY=p.feetY;
  p.feetY+=p.vy*dt;
  // The bridge plate occupies [deck-.17,deck]; the entire player body,
  // not just the feet, must stay below its underside when passing under it.
  const lowerDeckLimit=deck-.17-PLAYER_SOLID_HEIGHT;
  if(deck>0 && prevY<=lowerDeckLimit+.001 && p.vy>0 && p.feetY>lowerDeckLimit){
   p.feetY=Math.max(0,lowerDeckLimit-.004);p.vy=0;
  }
  // Suspended metal signs, gantries and crossbars also stop upward movement.
  if(p.vy>0 && glReady){
   const underside=worldSolidHeadBarrier(p.x,p.z,.23,
     prevY+PLAYER_SOLID_HEIGHT,p.feetY+PLAYER_SOLID_HEIGHT);
   if(underside!==null){p.feetY=Math.max(prevY,underside-PLAYER_SOLID_HEIGHT-.004);p.vy=0;}
  }
  if(p.vy<0 && glReady){
   const landing=worldSolidFeetBarrier(p.x,p.z,.23,prevY,p.feetY);
   if(landing!==null){p.feetY=Math.max(p.feetY,landing+.004);p.vy=0;p.grounded=true;}
  }
  if(p.feetY<=floor){
   const impact=Math.max(0,-p.vy);
   p.feetY=floor;p.vy=0;p.grounded=true;
   if(impact>3.1)burst(p.x,floor+.06,p.z,[.46,.73,.76],4);
  }
 }
 const maximum=Math.max(floor,ceilingHeight()-PLAYER_SOLID_HEIGHT-.2);
 if(p.feetY>maximum){p.feetY=maximum;p.vy=Math.min(0,p.vy);}
}
function isWall(x,z){let ix=Math.floor(x),iz=Math.floor(z);return ix<0||iz<0||ix>=mapSize||iz>=mapSize||mapCells[iz][ix]===1}function collide(x,z,r=.22){return isWall(x-r,z-r)||isWall(x+r,z-r)||isWall(x-r,z+r)||isWall(x+r,z+r)}function moveEntity(a,dx,dz,r=.23){tryMoveEntity(a,dx,dz,r)}function lineClear(x,z,X,Z){let dx=X-x,dz=Z-z,n=Math.ceil(hypot(dx,dz)*5);for(let i=1;i<n;i++){let t=i/n;if(isWall(x+dx*t,z+dz*t))return false}return true}
