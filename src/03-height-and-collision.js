
// VERTICAL FRONTIER — genuine stair-height terrain, reproducibly generated per sector.
let heightCells=new Float32Array(0), deckCells=new Float32Array(0), stairStages=[], bridgeSpecs=[];
const BRIDGE_Y=2.20, BRIDGE_RISE=.22;
function deckAtCell(x,z){return x>=0&&z>=0&&x<mapSize&&z<mapSize&&deckCells.length?deckCells[z*mapSize+x]||0:0;}
function deckHeight(x,z){return deckAtCell(Math.floor(x),Math.floor(z));}
function supportHeight(a,x,z){
 const ground=floorHeight(x,z), deck=deckHeight(x,z);
 if(!deck)return ground;
 const feet=Number.isFinite(a?.feetY)?a.feetY:ground;
 return feet>=deck-.28?deck:ground;
}
function ceilingHeight(){return sectorStyle>=14?5.60:4.25;}
const STAIR_RISE=.215, JUMP_VELOCITY=4.8, JUMP_GRAVITY=13.6;
function floorHeightAtCell(x,z){
 if(x<0||z<0||x>=mapSize||z>=mapSize||!heightCells.length)return 0;
 return heightCells[z*mapSize+x]||0;
}
function floorHeight(x,z){return floorHeightAtCell(Math.floor(x),Math.floor(z));}
function makeStairHeights(level){
 heightCells=new Float32Array(mapSize*mapSize);deckCells=new Float32Array(mapSize*mapSize);stairStages=[];bridgeSpecs=[];
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
 }
}
function tryMoveEntity(a,dx,dz,r=.23){
 const player=game&&a===game.p;
 const permit=(x,z)=>!collide(x,z,r)&&supportHeight(a,x,z)<=(Number.isFinite(a.feetY)?a.feetY:floorHeight(a.x,a.z))+.245;
 if(permit(a.x+dx,a.z))a.x+=dx;
 if(permit(a.x,a.z+dz))a.z+=dz;
 if(!player)a.feetY=supportHeight(a,a.x,a.z); // Enemies follow steps and the upper walkway.
}
function queueJump(){if(game?.state==='playing'&&!arsenalOpened)input.jumpQueued=true;}
function updateVertical(p,dt){
 const floor=supportHeight(p,p.x,p.z);
 const deck=deckHeight(p.x,p.z);
 if(!Number.isFinite(p.feetY)){p.feetY=floor;p.grounded=true;p.vy=0;}
 if(p.grounded){
  if(floor<=p.feetY+.24 && p.feetY-floor<=.245)p.feetY=floor;
  else if(floor<p.feetY-.245){p.grounded=false;p.vy=0;}
  else p.feetY=Math.max(p.feetY,floor);
 }
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
  // Prevent jumping bodily through the underside of a high bridge.
  if(deck>0 && prevY<deck-1.68 && p.vy>0 && p.feetY>deck-1.68){
   p.feetY=deck-1.68;p.vy=0;
  }
  if(p.feetY<=floor){
   const impact=Math.max(0,-p.vy);
   p.feetY=floor;p.vy=0;p.grounded=true;
   if(impact>3.1)burst(p.x,floor+.06,p.z,[.46,.73,.76],4);
  }
 }
 if(p.feetY>3.35){p.feetY=3.35;p.vy=Math.min(0,p.vy);}
}
function isWall(x,z){let ix=Math.floor(x),iz=Math.floor(z);return ix<0||iz<0||ix>=mapSize||iz>=mapSize||mapCells[iz][ix]===1}function collide(x,z,r=.22){return isWall(x-r,z-r)||isWall(x+r,z-r)||isWall(x-r,z+r)||isWall(x+r,z+r)}function moveEntity(a,dx,dz,r=.23){tryMoveEntity(a,dx,dz,r)}function lineClear(x,z,X,Z){let dx=X-x,dz=Z-z,n=Math.ceil(hypot(dx,dz)*5);for(let i=1;i<n;i++){let t=i/n;if(isWall(x+dx*t,z+dz*t))return false}return true}