
// VERTICAL FRONTIER — genuine stair-height terrain, reproducibly generated per sector.
let heightCells=new Float32Array(0), deckCells=new Float32Array(0), stairStages=[], bridgeSpecs=[],skyDeckSpecs=[];
// A main ground floor plus multiple raised, stair-accessible balcony decks.
// Plans are built deterministically with the map; realized specs are validated
// before being exposed to rendering, navigation and elevated robot spawning.
let balconyPlans=[],balconySpecs=[],galleryPlans=[],gallerySpecs=[],skyFeaturePlans=[],skyFeatureSpecs=[],midlevelPlans=[],midlevelSpecs=[];
// V61–63: fourteen individually planned landmark families replace monotonous
// central squares. True floor heights, drawn treads and raycast collisions
// all derive from the very same tile silhouettes.
let landmarkPlans=[],landmarkSpecs=[],worldMapBoss=false;
// V66: compact, genuinely climbable tactical lookouts adjoining the eight
// ground-level annexes. The annex centre remains FLAT and ground-navigable.
// The profile encodes a different seven-bay upper parapet outline per level.
let tacticalRisePlan=null,tacticalRiseSpecs=[];
const tacticalRiseNames=['ПЕРЕКРЁСТНАЯ ГАЛЕРЕЯ','ОБЗОРНОЕ КОЛЬЦО',
 'ДВОЙНЫЕ ПРИЧАЛЫ','ЛОМАНЫЙ СЕРПАНТИН','РАЗДВОЕННЫЙ БАСТИОН',
 'КАСКАДНЫЙ ПРИЧАЛ','ТРЕУГОЛЬНАЯ ТЕРРАСА','РАСЩЕПЛЁННЫЙ МОСТ'];
function tacticalRiseCells(spec){
 const cells=new Map();
 const add=(u,v,h=1.32)=>{
  const q=tacticalRotate(u,v,spec.orientation),x=spec.cx+q.x,z=spec.cz+q.z;
  const key=z*mapSize+x;
  cells.set(key,{x,z,h,u,v});
 };
 const line=(a,b,c,d)=>{
  const steps=Math.max(Math.abs(c-a),Math.abs(d-b));
  for(let t=0;t<=steps;t++)add(Math.round(a+(c-a)*t/steps),
   Math.round(b+(d-b)*t/steps));
 };
 // Six continuous 22cm risers; a real player/bot steps straight off the
 // ordinary floor at u=0, with no flying, jumping or teleport required.
 for(let k=1;k<=6;k++)for(let v=-1;v<=1;v++)add(k,v,k*.22);
 for(let u=7;u<=13;u++)for(let v=-1;v<=1;v++)add(u,v);
 // Eight ACTUALLY different walkable topologies, not colored floor decals.
 switch(spec.kind){
  case 0:line(9,-1,9,-5);line(12,-1,12,-4);break;
  case 1:
   line(9,-1,9,-5);line(13,-1,13,-5);line(9,-5,13,-5);break;
  case 2:
   line(8,-1,8,-5);line(11,-1,11,-5);
   line(8,-5,13,-5);break;
  case 3:
   line(7,-1,7,-3);line(7,-3,9,-3);line(9,-3,9,-5);
   line(9,-5,12,-5);line(12,-5,12,-1);break;
  case 4:
   line(7,-1,7,-3);line(7,-3,11,-3);line(11,-3,11,-5);
   line(13,-1,13,-4);break;
  case 5:
   for(let u=7;u<=9;u++)add(u,-2);
   for(let u=9;u<=12;u++)add(u,-3);
   line(9,-2,9,-3);line(12,-1,12,-4);break;
  case 6:
   for(let u=8;u<=12;u++)add(u,-2);
   for(let u=9;u<=11;u++)add(u,-3);
   add(10,-4);break;
  case 7:
   line(7,-2,13,-2);line(9,-2,9,-4);
   line(13,-2,13,-5);break;
 }
 // Seven individually accessible one-tile firing bays make the raised
 // footprint different in EVERY one of the first 100 campaign levels.
 for(let bit=0;bit<7;bit++)if((spec.profile&(1<<bit))!==0)add(7+bit,2);
 return [...cells.values()];
}
function landmarkCells(plan){
 const cells=new Map(),{cx,cz,kind}=plan,top=6*.22;
 const add=(dx,dz,h=top)=>{
  const x=cx+dx,z=cz+dz,key=z*mapSize+x,prev=cells.get(key);
  if(!prev||h>prev.h)cells.set(key,{x,z,h});
 };
 if(kind==='citadel'){
  // Rectangular, two-tile-wide fortress rampart. The northern and southern
  // central gaps keep the courtyard connected to the old street network.
  for(let dz=-4;dz<=4;dz++)for(let dx=-5;dx<=5;dx++)
   if((Math.abs(dx)>=3||Math.abs(dz)>=2)&&
      !(Math.abs(dx)<=1&&Math.abs(dz)>=2))add(dx,dz);
 }else if(kind==='reactor'){
  // Hollow oval ring surrounding a genuine open reactor well on ground level.
  for(let dz=-5;dz<=5;dz++)for(let dx=-6;dx<=6;dx++){
   const d=(dx/6)**2+(dz/5)**2;
   if(d>=.39&&d<=1.10)add(dx,dz);
  }
 }else if(kind==='docks'){
  // Long boarding arm and asymmetric cross-dock; the raised T can be walked.
  for(let dz=-5;dz<=5;dz++)for(let dx=-1;dx<=1;dx++)add(dx,dz);
  for(let dx=-7;dx<=7;dx++)for(let dz=3;dz<=5;dz++)add(dx,dz);
 }else if(kind==='shipyard'){
  // Parallel dry-dock piers linked by a central transverse catwalk.
  for(let dz=-5;dz<=5;dz++)for(let dx of [-6,-5,-4,4,5,6])add(dx,dz);
  for(let dx=-6;dx<=6;dx++)for(let dz=-1;dz<=1;dz++)add(dx,dz);
 }else if(kind==='flood'){
  // An S-shaped waterworks causeway, with four offset pumping platforms.
  // It has no flat square courtyard or repeated parallel piers.
  for(let dx=-6;dx<=6;dx++){
   const offset=dx<-2?-2:dx<3?2:0;
   for(let dz=-1;dz<=1;dz++)add(dx,offset+dz);
  }
  for(const [ax,az] of [[-5,-5],[-1,4],[3,-4],[4,2]])
   for(let dz=0;dz<3;dz++)for(let dx=0;dx<3;dx++)add(ax+dx,az+dz);
 }else if(kind==='observatory'){
  // Six broad radial astronomical arms surrounding a hexagonal hub.
  for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++)
   if(dx*dx+dz*dz<=8)add(dx,dz);
  for(let arm=0;arm<6;arm++){
   const a=arm*Math.PI/3,ca=Math.cos(a),sa=Math.sin(a);
   for(let k=2;k<=9;k++)for(let width=-1;width<=1;width++)
    add(Math.round(k*ca-width*sa),Math.round(k*sa+width*ca));
  }
 }else if(kind==='harbor'){
  // E-shaped raised harbor: three projecting berths on one long quay.
  for(let dz=-6;dz<=6;dz++)for(let dx=-7;dx<=-5;dx++)add(dx,dz);
  for(const row of [-5,0,5])for(let dx=-7;dx<=6;dx++)
   for(let width=-1;width<=1;width++)add(dx,row+width);
 }else if(kind==='forge'){
  // Anvil footprint: long middle beam and two broad furnace shoulders.
  for(let dx=-7;dx<=7;dx++)for(let dz=-1;dz<=1;dz++)add(dx,dz);
  for(let dx of [-6,-5,-4,-3,3,4,5,6])
   for(let dz=-4;dz<=4;dz++)add(dx,dz);
  for(let dx=-2;dx<=2;dx++)for(let dz=-3;dz<=3;dz++)
   if(Math.abs(dx)>=1||Math.abs(dz)>=2)add(dx,dz);
 }else if(kind==='vertical'){
  // Switchback conveyor: three long offset decks joined on alternating ends.
  for(const row of [-6,-1,4])for(let dx=-6;dx<=6;dx++)
   for(let width=0;width<2;width++)add(dx,row+width);
  for(let dz=-6;dz<=0;dz++)for(let dx=5;dx<=6;dx++)add(dx,dz);
  for(let dz=-1;dz<=5;dz++)for(let dx=-6;dx<=-5;dx++)add(dx,dz);
 }else if(kind==='stairkeep'){
  // Diamond ziggurat around an OPEN central court: six genuine successive
  // altitude bands. Unlike a circular raised platform, there is no solid
  // middle and the player can follow a rising diagonal perimeter.
  for(let dz=-8;dz<=8;dz++)for(let dx=-8;dx<=8;dx++){
   const dist=Math.abs(dx)+Math.abs(dz);
   if(dist>=3&&dist<=8)add(dx,dz,(9-dist)*.22);
  }
 }else if(kind==='collector'){
  // Four bent rotor blades, not a ring or rectangular industrial maze.
  for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)add(dx,dz);
  for(let dx=2;dx<=7;dx++)for(let dz=-1;dz<=1;dz++)add(dx,dz);
  for(let dz=-7;dz<=-2;dz++)for(let dx=-1;dx<=1;dx++)add(dx,dz);
  for(let dx=-8;dx<=-2;dx++)for(let dz=-1;dz<=1;dz++)add(dx,dz);
  for(let dz=2;dz<=7;dz++)for(let dx=-1;dx<=1;dx++)add(dx,dz);
  // Asymmetric return tips give the entire windmill its own tactical shape.
  for(let dx=4;dx<=7;dx++)for(let dz=1;dz<=2;dz++)add(dx,dz);
  for(let dx=-8;dx<=-5;dx++)for(let dz=-3;dz<=-2;dz++)add(dx,dz);
 }else if(kind==='atrium'){
  // Two nested, open U-shaped processional balconies. Unlike a hollow
  // reactor ring, both horseshoes have wide open ends and a central throat.
  for(let dz=-6;dz<=6;dz++)for(let dx of [-7,-6,-5,5,6,7])add(dx,dz);
  for(let dx=-7;dx<=7;dx++)for(let dz=4;dz<=6;dz++)add(dx,dz);
  for(let dz=-3;dz<=3;dz++)for(let dx of [-3,-2,2,3])add(dx,dz);
  for(let dx=-3;dx<=3;dx++)for(let dz=2;dz<=3;dz++)add(dx,dz);
  for(let dx=3;dx<=7;dx++)for(let dz=-1;dz<=1;dz++)add(dx,dz);
 }else if(kind==='cryo'){
  // Three staggered hexagonal cold cells on one walkable central track.
  for(let dx=-7;dx<=7;dx++)for(let dz=-1;dz<=1;dz++)add(dx,dz);
  for(const [ax,az] of [[-5,-4],[0,5],[5,-4]])
   for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++)
    if(Math.abs(dx)+Math.abs(dz)<=4)add(ax+dx,az+dz);
 }else if(kind==='gravity'){
  // Three open spiral field paths, rather than any concentric ring.
  for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)add(dx,dz);
  for(let arm=0;arm<3;arm++)for(let k=2;k<=24;k++){
   const radius=1.4+k*.30,a=arm*2*Math.PI/3+k*.17;
   const x=Math.round(Math.cos(a)*radius),z=Math.round(Math.sin(a)*radius);
   for(let off=-1;off<=1;off++)add(x+off,z);
  }
  for(let dx=1;dx<=8;dx++)for(let dz=-1;dz<=1;dz++)add(dx,dz);
 }
 const stairs=(side,axis,edge)=>{
  for(let k=1;k<=6;k++)for(let breadth=-1;breadth<=1;breadth++){
   const x=axis==='x'?side*(edge+k):breadth;
   const z=axis==='z'?side*(edge+k):breadth;
   add(x,z,(7-k)*.22);
  }
 };
 if(kind==='citadel')for(const side of [-1,1])stairs(side,'x',5);
 if(kind==='reactor')for(const side of [-1,1])stairs(side,'x',6);
 if(kind==='docks')stairs(-1,'z',5);
 if(kind==='shipyard')for(const side of [-1,1])stairs(side,'x',6);
 if(kind==='flood'||kind==='harbor')stairs(1,'x',6);
 if(kind==='observatory')stairs(1,'x',9);
 if(kind==='forge')stairs(1,'x',7);
 if(kind==='vertical')stairs(1,'x',6);
 if(kind==='collector'||kind==='cryo')stairs(1,'x',7);
 if(kind==='atrium')stairs(1,'x',7);
 if(kind==='gravity')stairs(1,'x',8);
 // The stairkeep's six concentric diagonal bands ARE its staircases.
 return [...cells.values()];
}
function isBalconySector(){return sectorStyle===2||sectorStyle===4||sectorStyle===6||sectorStyle===9;}
// V64: architecture for the four extremely dense balcony cities is anchored
// to their EXISTING two walkable guardhouse roofs. Giving these worlds a
// third independent 13-cell stair corridor would erase an older roof route.
// Build real structural towers on the OUTSIDE of the shelter side walls,
// leaving the roof centre, its fire escape and its front door untouched.
function balconyArchitecturalBoxes(terrace,style,level){
 const boxes=[],roof=ceilingHeight(),y=terrace.roofY;
 if(![2,4,6,9].includes(style)||!Number.isFinite(y))return boxes;
 const shift=(level*17+style*23)%7*.047;
 const offset=terrace.wing<0?1:0;
 const xy=(u,v)=>terrace.axis==='x'?
  {x:terrace.cx+u,z:terrace.cz+v*terrace.wing+offset}:
  {x:terrace.cx+v*terrace.wing+offset,z:terrace.cz+u};
 const add=(role,u0,u1,v0,v1,lo,hi)=>{
  const a=xy(u0,v0),b=xy(u1,v1);
  if(hi<=lo+.015)return;
  boxes.push({role,box:[Math.min(a.x,b.x),lo,Math.min(a.z,b.z),
   Math.max(a.x,b.x),hi,Math.max(a.z,b.z)]});
 };
 const cap=roof-.54-shift;
 if(style===2){
  // Two castle bastions, closed rectangular turrets and actual merlons.
  for(const side of [-1,1]){
   const u=side<0?-1.52:2.15;
   add('bastionTower',u,u+.39,3.23,4.24,y,cap-.23);
   add('bastionCrown',u-.10,u+.49,3.12,4.36,cap-.27,cap);
  }
 }else if(style===4){
  // Dramatic arch above the observation deck; head clearance is kept.
  for(const u of [-1.48,2.17]){
   add('theatreColumn',u,u+.29,3.31,4.32,y,cap);
  }
  add('theatreLintel',-1.48,2.46,3.30,3.54,
   Math.max(y+2.19,roof-.63),roof-.38);
 }else if(style===6){
  // Offset high-rise blocks break the ordinary repeated skyline.
  add('districtHighrise',-1.55,-1.12,3.11,4.51,y,cap);
  add('districtMidrise',2.14,2.58,3.20,4.43,y,cap-.69);
  add('districtAerialTrim',-1.68,-1.02,3.14,4.37,cap-.28,cap+.03);
 }else if(style===9){
  // Two irregular cliff fins, a rugged silhouette unlike straight towers.
  add('gorgeWestFin',-1.69,-1.10,3.21,4.57,y,cap-.15);
  add('gorgeEastFin',2.12,2.77,3.33,4.40,y,cap-.61);
  add('gorgeSpire',-1.50,-1.25,3.46,4.08,cap-.18,cap+.08);
 }
 return boxes;
}
// Gallery routes deliberately run OUTSIDE the stair flights. Their side
// branches meet the balcony decks at the centre; the main span clears the
// complete five-tile stair width, keeping all 10/14 risers walkable.
function balconyGalleryCells(a,b){
 if(!a||!b||a.steps!==b.steps)return [];
 const midpoint=Math.floor(mapSize/2),out=new Map();
 const add=(x,z)=>{if(x>=2&&z>=2&&x<mapSize-2&&z<mapSize-2)out.set(z*mapSize+x,{x,z});};
 if(a.cz===b.cz){
  const sign=a.cz<midpoint?-1:1,Z=a.cz+sign*5;
  for(let z=Math.min(a.cz,Z);z<=Math.max(a.cz,Z);z++){
   for(const x of [a.cx,a.cx+1,b.cx,b.cx+1])add(x,z);
  }
  for(let x=Math.min(a.cx,b.cx);x<=Math.max(a.cx,b.cx);x++){
   add(x,Z);add(x,Z+sign);
  }
 }else if(a.cx===b.cx){
  const sign=a.cx<midpoint?-1:1,X=a.cx+sign*5;
  for(let x=Math.min(a.cx,X);x<=Math.max(a.cx,X);x++){
   for(const z of [a.cz,a.cz+1,b.cz,b.cz+1])add(x,z);
  }
  for(let z=Math.min(a.cz,b.cz);z<=Math.max(a.cz,b.cz);z++){
   add(X,z);add(X+sign,z);
  }
 }
 return [...out.values()];
}
// Stage52: independently shaped high-altitude rooms attach to the Stage51
// galleries. Their central holes / cut-out corners are intentionally EMPTY;
// a player can jump through them to the only ground floor below.
function skyFeatureCells(spec){
 const points=new Map();
 const add=(x,z)=>{if(x>=2&&z>=2&&x<mapSize-2&&z<mapSize-2)
  points.set(z*mapSize+x,{x,z});};
 const {cx,cz,kind,cut,link}=spec;
 if(kind==='ring'){
  for(let dz=-5;dz<=5;dz++)for(let dx=-5;dx<=5;dx++){
   if(Math.max(Math.abs(dx),Math.abs(dz))<3)continue; // central lightwell
   if(Math.abs(dx)===5&&Math.abs(dz)===5)continue; // eight-sided silhouette
   add(cx+dx,cz+dz);
  }
 }else if(kind==='wing'){
  for(let dz=-2;dz<=2;dz++)for(let dx=-3;dx<=3;dx++){
   if(Math.abs(dx)===3&&Math.abs(dz)===2)continue;
   add(cx+dx,cz+dz);
  }
 }else if(kind==='court'){
  for(let dz=-3;dz<=3;dz++)for(let dx=-2;dx<=5;dx++){
   if(dx>=2&&(cut==='south'?dz>=1:dz<=-1))continue;
   add(cx+dx,cz+dz);
  }
 }else if(kind==='ledge'){
  for(let dz=-3;dz<=3;dz++)for(let dx=-5;dx<=2;dx++){
   if(dx<=-2&&dz<=-1)continue;
   add(cx+dx,cz+dz);
  }
 }
 if(link){
  if(link.axis==='x')for(let x=Math.min(link.x0,link.x1);x<=Math.max(link.x0,link.x1);x++){
   add(x,link.z);add(x,link.z+1);
  }
  else for(let z=Math.min(link.z0,link.z1);z<=Math.max(link.z0,link.z1);z++){
   add(link.x,z);add(link.x+1,z);
  }
 }
 return [...points.values()];
}
// Stage54: a T-shaped raised tactical landing with TWO gradual entrances.
// These are real raised *ground* tiles, not invisible suspended decorations:
// raycasts, walking physics, blast shielding and robot paths use the same map.
function midlevelCells(spec){
 const points=new Map(),{cx,cz,axis,steps,wing}=spec,y=steps*.22;
 const add=(u,v,h)=>{
  const x=axis==='x'?cx+u:cx+v,z=axis==='x'?cz+v:cz+u;
  points.set(z*mapSize+x,{x,z,h});
 };
 for(let u=-3;u<=3;u++)for(let v=-2;v<=2;v++)add(u,v,y);
 for(let u=-1;u<=1;u++)for(let v=3;v<=4;v++)add(u,v*wing,y);
 for(const side of [-1,1])for(let k=1;k<=steps;k++)for(let v=-1;v<=1;v++)
  add(side*(3+k),v,(steps+1-k)*.22);
 return [...points.values()];
}
function midlevelCoverBoxes(spec){
 const cell=(u,v)=>spec.axis==='x'?{x:spec.cx+u,z:spec.cz+v}:
   {x:spec.cx+v,z:spec.cz+u};
 const covers=[];
 for(const u of [-2,2]){
  const p=cell(u,spec.wing*2),y=spec.y;
  covers.push(spec.axis==='x'?
   [p.x+.13,y+.03,p.z+.18,p.x+.87,y+.86,p.z+.48]:
   [p.x+.18,y+.03,p.z+.13,p.x+.48,y+.86,p.z+.87]);
 }
 // The third barricade protects the narrow lookout tongue. Leave the
 // main centreline empty so even wide robots can traverse the upper tier.
 const tip=cell(0,spec.wing*4),y=spec.y;
 covers.push(spec.axis==='x'?
  [tip.x+.08,y+.03,tip.z+.21,tip.x+.92,y+.76,tip.z+.50]:
  [tip.x+.21,y+.03,tip.z+.08,tip.x+.50,y+.76,tip.z+.92]);
 return covers;
}
// Stage55: the outer two wing cells form a REAL roofed guard room. Exterior
// clearance is carved at ground level so its side windows open to the arena,
// not into a randomly generated hidden map wall.
function midlevelShelterBufferCells(spec){
 const out=[];
 const add=(u,v)=>out.push(spec.axis==='x'?
  {x:spec.cx+u,z:spec.cz+v*spec.wing}:
  {x:spec.cx+v*spec.wing,z:spec.cz+u});
 for(const u of [-2,2])for(const v of [3,4])add(u,v);
 for(let u=-1;u<=1;u++)add(u,5);
 return out;
}
function midlevelShelterBoxes(spec){
 const y=spec.y,components=[];
 // u = longitudinal coordinate; v = wing-outward coordinate. Rotate all
 // AABBs consistently for both X/Z terraces and either direction of wing.
 const add=(role,u0,u1,v0,v1,lo,hi)=>{
  // A negative wing starts its tile at (centre-v), with the physical
  // interior running to +1 in world coordinates. Mirroring a continuous
  // wall without this one-tile offset would move the door *inside* the room
  // and leave its roof hanging beyond the last solid floor tile.
  const offset=spec.wing<0?1:0;
  const xy=(u,v)=>spec.axis==='x'?
   {x:spec.cx+u,z:spec.cz+v*spec.wing+offset}:
   {x:spec.cx+v*spec.wing+offset,z:spec.cz+u};
  const a=xy(u0,v0),b=xy(u1,v1);
  components.push({role,box:[Math.min(a.x,b.x),y+lo,Math.min(a.z,b.z),
    Math.max(a.x,b.x),y+hi,Math.max(a.z,b.z)]});
 };
 // The windows are genuine gaps between two SOLID wall sections. A body
 // cannot pass through the window because the sill still blocks its feet.
 for(const [name,u0,u1] of [['left',-1.07,-.88],['right',1.88,2.07]]){
  add(name+'Sill',u0,u1,3,5,.02,.94);
  add(name+'Header',u0,u1,3,5,1.88,2.64);
 }
 add('backWall',-1.07,2.07,4.91,5.10,.02,2.64);
 add('doorLeft',-1.07,-.76,2.91,3.09,.02,2.64);
 add('doorRight',1.76,2.07,2.91,3.09,.02,2.64);
 add('doorLintel',-.76,1.76,2.91,3.09,2.24,2.64);
 // Match the shared deck ballistic thickness exactly (.17 m) now that the
 // solid rooftop also advertises its upper support height to actors.
 add('roof',-1.11,2.11,2.90,5.11,2.67,2.84);
 return components;
}
// Stage59: a real pass-through defensive gate guarding the entry to every
// half-height observation post. Both piers and the overhead crosspiece are
// 3D SOLIDS; the wide central opening contains NO collision proxy. Keep the
// supports in the two outside walkway lanes, avoiding the older u=±2 cover.
function midlevelGuardGateBoxes(spec){
 const result=[],y=spec.y,offset=spec.wing<0?1:0;
 const xy=(u,v)=>spec.axis==='x'?
  {x:spec.cx+u,z:spec.cz+v*spec.wing+offset}:
  {x:spec.cx+v*spec.wing+offset,z:spec.cz+u};
 const add=(role,u0,u1,v0,v1,lo,hi)=>{
  const a=xy(u0,v0),b=xy(u1,v1);
  result.push({role,box:[Math.min(a.x,b.x),y+lo,Math.min(a.z,b.z),
   Math.max(a.x,b.x),y+hi,Math.max(a.z,b.z)]});
 };
 add('leftPier',-.98,-.78,2.34,2.66,.02,2.52);
 add('rightPier',1.78,1.98,2.34,2.66,.02,2.52);
 // A 2.34m underpass clears the standing player's 1.95m physical body
 // and a standard robot, but really stops upward shots and jumping heads.
 add('lintel',-.98,1.98,2.34,2.66,2.34,2.52);
 return result;
}
// Stage56: a wraparound 13-tread fire escape climbs from the existing terrace
// (the first tread meets its edge) up to the ACTUAL guardhouse roof. It goes
// around the back of the building, preserving both firing windows and the
// front door. The side is selected per map from two mirror-image routes.
function midlevelRoofStairCells(spec){
 if(spec.roofFlank===0)return []; // preserve original two terraces if space is tight
 const flank=spec.roofFlank||-1;
 const route=[[-3,3],[-3,4],[-3,5],[-3,6],[-3,7],[-2,7],[-1,7],
  [0,7],[1,7],[2,7],[2,6],[2,5],[1,5]];
 return route.map(([u,v],i)=>{
  u*=flank<0?1:-1;
  const x=spec.axis==='x'?spec.cx+u:spec.cx+v*spec.wing;
  const z=spec.axis==='x'?spec.cz+v*spec.wing:spec.cz+u;
  return {x,z,h:spec.steps*.22+(i+1)*.22,index:i+1};
 });
}
function midlevelRoofDeckCells(spec){
 const cells=[];
 for(let u=-1;u<=1;u++)for(let v=3;v<=4;v++)cells.push(spec.axis==='x'?
  {x:spec.cx+u,z:spec.cz+v*spec.wing}:
  {x:spec.cx+v*spec.wing,z:spec.cz+u});
 return cells;
}
// Stage58: genuine three-dimensional roof battlements. The fire-escape
// entrance is deliberately OPEN across its whole one-tile width. Each solid
// is a world-space AABB and will be sent to the SAME geometry/physics API;
// the three front sections provide a low central firing slit between two
// high ballistic shields. The two tight V56 roofs remain unchanged.
function midlevelRoofParapetBoxes(spec){
 if(spec.roofStairCount!==13)return [];
 const result=[],y=spec.roofY,offset=spec.wing<0?1:0;
 const map=(u,v)=>spec.axis==='x'?
  {x:spec.cx+u,z:spec.cz+v*spec.wing+offset}:
  {x:spec.cx+v*spec.wing+offset,z:spec.cz+u};
 const add=(role,u0,u1,v0,v1,h)=>{
  const a=map(u0,v0),b=map(u1,v1);
  result.push({role,box:[Math.min(a.x,b.x),y,Math.min(a.z,b.z),
   Math.max(a.x,b.x),y+h,Math.max(a.z,b.z)]});
 };
 // Three distinct front plates: low centre is actually shoot-through ABOVE
 // its lip; the two tall corner shields really stop shots at chest height.
 // Put the walls flush with the OUTER deck edge. A standard .48m robot
 // standing at the centre of the edge tile must still have enough room;
 // shifting a wall 7cm *inside* the tile would invalidate rooftop spawning.
 add('frontLeft',-1,0,2.925,3.0,.82);
 add('frontCentre',0,1,2.925,3.0,.38);
 add('frontRight',1,2,2.925,3.0,.82);
 add('sideLeft',-1.075,-1.0,3.0,5.0,.69);
 add('sideRight',2.0,2.075,3.0,5.0,.69);
 // The escape route ends in the roof tile u=-roofFlank at v=4. In front
 // of it (v=5) we omit the back parapet completely to leave a true door.
 for(let u=-1;u<=1;u++)if(u!==-spec.roofFlank)
  add('back'+u,u,u+1,5.0,5.075,.76);
 return result;
}
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
function ceilingHeight(){
 // Boss arenas have an actual taller skyline AND taller solid world walls.
 // Normal stages stay comparatively intimate, even with climbable landmarks.
 return worldMapBoss?(sectorStyle>=14?20.5:isBalconySector()?18.5:17.5):
  sectorStyle>=14?12.0:isBalconySector()?7.4:4.25;
}
const STAIR_RISE=.215, JUMP_VELOCITY=4.8, JUMP_GRAVITY=13.6;
const FLIGHT_SPEED=4.4;
// The solid player body (helmet plus torso). Very thin suit antennas are visual.
const PLAYER_SOLID_HEIGHT=1.95;
function floorHeightAtCell(x,z){
 if(x<0||z<0||x>=mapSize||z>=mapSize||!heightCells.length)return 0;
 return heightCells[z*mapSize+x]||0;
}
function floorHeight(x,z){return floorHeightAtCell(Math.floor(x),Math.floor(z));}
// Stage109: the same solid height-cell columns as rayWall and the mesh.
// A circular actor contacts any overlapped column, not only its centre tile.
function worldTerrainFootprint(x,z,r=.23){
 const centre=floorHeight(x,z);
 if(!(r>0)||!heightCells.length)return centre;
 let top=centre;
 const rr=r*r-1e-7;
 for(let cz=Math.max(0,Math.floor(z-r));cz<=Math.min(mapSize-1,Math.floor(z+r));cz++)
 for(let cx=Math.max(0,Math.floor(x-r));cx<=Math.min(mapSize-1,Math.floor(x+r));cx++){
  const h=floorHeightAtCell(cx,cz);if(h<=top)continue;
  const dx=x-Math.max(cx,Math.min(x,cx+1)),dz=z-Math.max(cz,Math.min(z,cz+1));
  if(dx*dx+dz*dz<rr)top=h;
 }
 return top;
}
// Ground support is a real top surface beneath the feet. A suspended plate
// must not snap a flying actor through its underside merely because its
// centre enters that cell. Swept vertical checks establish landing contact.
function worldActorGround(x,z,r,feet){
 let top=worldTerrainFootprint(x,z,r);
 if(!Number.isFinite(feet))return top;
 const plate=worldDeckStandingSupport(x,z,r,feet);
 const solid=worldSolidStandingSupport(x,z,r,feet);
 if(plate!==null&&plate<=feet+.004)top=Math.max(top,plate);
 if(solid!==null&&solid<=feet+.004)top=Math.max(top,solid);
 return top;
}
// Shared candidate pose for solo, PvP, Dash and robot local navigation.
// Airborne bodies keep actual altitude; walk-up tolerance is ONLY grounded.
// Walkers without gravity reject cliffs; humans retain height and fall.
function worldActorMovePlan(x,z,r,feet,grounded,strictDrop=false){
 if(collide(x,z,r))return null;
 const terrain=worldTerrainFootprint(x,z,r);
 if(!grounded)return terrain>feet+.004?null:{feet,grounded:false};
 let ground=worldActorGround(x,z,r,feet);
 // Stage111: a grounded walker may descend a real short step onto a lower
 // suspended deck or steel surface. The resting-contact tolerance (.045m)
 // is NOT the maximum legal descent. Keep airborne movement unchanged.
 if(ground<feet-.004){
  const lower=feet-.24501;
  const plate=worldDeckFeetBarrier(x,z,r,feet,lower);
  const steel=typeof worldSolidFeetBarrier==='function'?worldSolidFeetBarrier(x,z,r,feet,lower):null;
  if(plate!==null)ground=Math.max(ground,plate);
  if(steel!==null)ground=Math.max(ground,steel);
 }
 const step=worldDeckStepSupport(x,z,r,feet);
 const metal=typeof worldSolidStepSupport==='function'?worldSolidStepSupport(x,z,r,feet):null;
 const support=Math.max(ground,step===null?ground:step,metal===null?ground:metal);
 const delta=support-feet;
 if(delta>.24501||strictDrop&&delta<-.24501)return null;
 return delta<-.24501?{feet,grounded:false}:{feet:support,grounded:true};
}
// Stage112: exact XZ sweep of a circular footprint against a rectangle.
// The rounded rectangle is the union of two edge strips and four corner
// disks. The intersection with a line is convex, so union endpoints are
// sufficient. Same radius and epsilon as the discrete overlap predicates.
function worldCircleRectInterval(x,z,X,Z,r,b,epsilon=1e-7){
 const dx=X-x,dz=Z-z,rr=r*r-epsilon;
 if(!(rr>0))return null;
 const R=Math.sqrt(rr),lx=b[0],lz=b[2],hx=b[3],hz=b[5];
 let enter=Infinity,leave=-Infinity;
 const add=(a,c)=>{a=Math.max(0,a);c=Math.min(1,c);if(c>a){enter=Math.min(enter,a);leave=Math.max(leave,c);}};
 // Exact cardinal fast path (used by ordinary X/Z slide movement).
 if(dx===0||dz===0){
  const alongX=dz===0,along=alongX?x:z,delta=alongX?dx:dz;
  const across=alongX?z:x,lo=alongX?lx:lz,hi=alongX?hx:hz;
  const d=Math.max((alongX?lz:lx)-across,0,across-(alongX?hz:hx)),q=rr-d*d;
  if(q<=0)return null;
  const reach=Math.sqrt(q);
  if(delta===0)return along>lo-reach&&along<hi+reach?[0,1]:null;
  const a=(lo-reach-along)/delta,c=(hi+reach-along)/delta;add(Math.min(a,c),Math.max(a,c));
 }else{
  const strip=(a,b,c,d)=>{
   const tx0=(a-x)/dx,tx1=(c-x)/dx,tz0=(b-z)/dz,tz1=(d-z)/dz;
   add(Math.max(Math.min(tx0,tx1),Math.min(tz0,tz1)),Math.min(Math.max(tx0,tx1),Math.max(tz0,tz1)));
  };
  strip(lx-R,lz,hx+R,hz);strip(lx,lz-R,hx,hz+R);
  const speed2=dx*dx+dz*dz;
  for(const cx of [lx,hx])for(const cz of [lz,hz]){
   const ux=cx-x,uz=cz-z,cross=ux*dz-uz*dx;
   const q=rr-cross*cross/speed2;
   if(q<=0)continue;
   const t=(ux*dx+uz*dz)/speed2,half=Math.sqrt(q/speed2);add(t-half,t+half);
  }
 }
 return leave>enter?[enter,leave]:null;
}
// Collect every contact boundary and the interior of every resulting interval.
// Terrain/deck cells and indexed mesh/equipment share their real geometry;
// a tangent adds no solid thickness. Only local spatial buckets are visited.
function worldMotionProbes(x,z,X,Z,r){
 const events=[0,1],seen=new Set();
 const add=(b,epsilon)=>{
  const t=worldCircleRectInterval(x,z,X,Z,r,b,epsilon);
  if(t){if(t[0]>0)events.push(t[0]);if(t[1]<1)events.push(t[1]);}
 };
 for(let j=Math.max(0,Math.floor(Math.min(z,Z)-r));j<=Math.min(mapSize-1,Math.floor(Math.max(z,Z)+r));j++)
 for(let i=Math.max(0,Math.floor(Math.min(x,X)-r));i<=Math.min(mapSize-1,Math.floor(Math.max(x,X)+r));i++){
  if(mapCells[j]?.[i]===1)add([i,0,j,i+1,0,j+1],1e-9);
  if(floorHeightAtCell(i,j)>0||deckAtCell(i,j)>0)add([i,0,j,i+1,0,j+1],1e-7);
  if(typeof worldEquipmentCell!=='function')continue; // isolated legacy test fixtures
  for(const list of [glReady?worldSolidGrid[j*mapSize+i]:null,worldEquipmentCell(i,j)]){
   if(!list)continue;
   for(const solid of list){if(seen.has(solid)||!worldEquipmentActive(solid))continue;seen.add(solid);add(solid.box,1e-7);}
  }
 }
 events.sort((a,b)=>a-b);
 const probes=[];
 for(let i=1;i<events.length;i++){
  const a=events[i-1],b=events[i];
  if(b>a){if(events.length>2)probes.push((a+b)/2);probes.push(b);}
 }
 return probes;
}
// Atomic segment: no movement is committed on failure. Walkers may step up
// and down at genuine support boundaries; airborne actors retain their feet.
// Use bounded broadphase per segment; callers keep established microsteps.
// Stage113: continuous horizontal contact with a stationary actor during
// this sequential simulation substep. Clip the circle test to the interval
// of vertically overlapping bodies. Existing overlap may only retreat.
function worldActorPairClear(x,z,X,Z,feet,endFeet,height,o,radius){
 const dx=X-x,dz=Z-z,dy=endFeet-feet,ux=x-o.x,uz=z-o.z;
 const rr=radius*radius,lower=o.feet-height+.004,upper=o.feet+o.height-.004;
 let lo=0,hi=1;
 if(dy===0){if(feet<=lower||feet>=upper)return true;}
 else{const a=(lower-feet)/dy,b=(upper-feet)/dy;lo=Math.max(0,Math.min(a,b));hi=Math.min(1,Math.max(a,b));if(hi<=lo)return true;}
 const d2=t=>(ux+dx*t)**2+(uz+dz*t)**2;
 const start=d2(lo),speed2=dx*dx+dz*dz;
 if(start<rr-1e-9&&lo===0&&feet>lower&&feet<upper){
  // An already overlapping pair may escape, never move deeper into it.
  return ux*dx+uz*dz>=-1e-10;
 }
 const t=speed2?Math.max(lo,Math.min(hi,-(ux*dx+uz*dz)/speed2)):lo;
 return d2(t)>=rr-1e-9;
}
function worldActorBlockers(a,r,player,enemy){
 const out=[];
 if(typeof enemyCrowdRadius!=='function'||!game)return out;
 const mine=enemy?enemyCrowdRadius(a,r):r;
 for(const o of game.enemies||[]){
  if(o===a||o.dead||(Number.isFinite(o.hp)&&o.hp<=0)||!Number.isFinite(o.x)||!Number.isFinite(o.z))continue;
  out.push({x:o.x,z:o.z,feet:Number.isFinite(o.feetY)?o.feetY:floorHeight(o.x,o.z),height:enemyBodyHeight(o),radius:mine+enemyCrowdRadius(o)-(enemy?.006:0)});
 }
 if(enemy&&game.p&&game.p!==a&&Number.isFinite(game.p.x)&&Number.isFinite(game.p.z)){
  const o=game.p;out.push({x:o.x,z:o.z,feet:Number.isFinite(o.feetY)?o.feetY:floorHeight(o.x,o.z),height:PLAYER_SOLID_HEIGHT,radius:mine+.23});
 }
 return out;
}
function worldMPBlockers(p,others,radius){
 return others.filter(o=>o&&o!==p&&!o.dead&&(!Number.isFinite(o.hp)||o.hp>0)&&Number.isFinite(o.feetY)&&Number.isFinite(o.x)&&Number.isFinite(o.z)).map(o=>({x:o.x,z:o.z,feet:o.feetY,height:PLAYER_SOLID_HEIGHT,radius}));
}
// Stage114: continuous vertical contact with the same living cylinders as
// horizontal movement. A tangent is free; dead actors are not supports.
// Keep a 4mm separation at a freshly reached face. A pre-existing overlap
// may escape toward the nearer face, but cannot traverse the other body.
function worldActorVerticalLimit(x,z,from,to,height,blockers=[]){
 if(!Number.isFinite(from)||!Number.isFinite(to)||from===to)return from;
 let limit=to;
 for(const o of blockers){
  if(![o.x,o.z,o.feet,o.height,o.radius].every(Number.isFinite)||o.height<=0||o.radius<=0)continue;
  if((x-o.x)**2+(z-o.z)**2>=o.radius**2-1e-9)continue;
  const lower=o.feet-height,upper=o.feet+o.height;
  if(from<=lower+.004){
   if(to>lower+.004)limit=Math.min(limit,Math.max(from,lower-.004));
  }else if(from>=upper-.004){
   if(to<upper-.004)limit=Math.max(limit,Math.min(from,upper+.004));
  }else{
   const nearerUp=upper-from<=from-lower;
   if((to>from&&!nearerUp)||(to<from&&nearerUp))limit=from;
  }
 }
 return limit;
}
function worldActorVerticalFloor(x,z,feet,floor,blockers=[]){
 if(!Number.isFinite(feet))return floor;
 for(const o of blockers){
  const top=o.feet+o.height+.004;
  if(Number.isFinite(top)&&Math.abs(feet-top)<=.005&&
     (x-o.x)**2+(z-o.z)**2<o.radius**2-1e-9)floor=Math.max(floor,top);
 }
 return floor;
}
function worldActorSweepPlan(x,z,X,Z,r,feet,grounded,strictDrop=false,height=1.95,blockers=[]){
 let pose={feet,grounded},lastX=x,lastZ=z;
 const dx=X-x,dz=Z-z;
 for(const t of worldMotionProbes(x,z,X,Z,r)){
  const px=x+dx*t,pz=z+dz*t,old=pose;
  pose=worldActorMovePlan(px,pz,r,old.feet,old.grounded,strictDrop);
  if(!pose||(height>0&&worldSolidBodyCollision(px,pz,r,pose.feet,height)))return null;
  for(const o of blockers)if(!worldActorPairClear(lastX,lastZ,px,pz,old.feet,pose.feet,height,o,o.radius))return null;
  lastX=px;lastZ=pz;
 }
 return pose;
}
// Find a verified safe prefix, never a later free point beyond a collision.
// Keep the full-segment predicate atomic for route planning.
function worldActorAdvance(x,z,X,Z,r,feet,grounded,strictDrop,height,blockers=[]){
 const plan=t=>worldActorSweepPlan(x,z,x+(X-x)*t,z+(Z-z)*t,r,feet,grounded,strictDrop,height,blockers);
 const whole=plan(1);if(whole)return {...whole,x:X,z:Z,complete:true};
 const first=plan(1/4096);if(!first)return null;
 let lo=1/4096,hi=1,best=first;
 // 12 bisections on a <=.5m simulation microstep give submillimetre resolution.
 for(let i=0;i<12;i++){const t=(lo+hi)/2,q=plan(t);if(q){lo=t;best=q;}else hi=t;}
 return best&&lo>1e-5?{...best,x:x+(X-x)*lo,z:z+(Z-z)*lo,complete:false}:null;
}
function makeStairHeights(level){
 heightCells=new Float32Array(mapSize*mapSize);deckCells=new Float32Array(mapSize*mapSize);stairStages=[];bridgeSpecs=[];skyDeckSpecs=[];balconySpecs=[];gallerySpecs=[];skyFeatureSpecs=[];midlevelSpecs=[];landmarkSpecs=[];tacticalRiseSpecs=[];
 const centre=Math.floor(mapSize/2), boss=level%5===0;
 // Every sector has one raised central deck; certain layouts add side decks.
 function stage(cx,cz,radius,maxSteps=4){
  cx=Math.floor(cx);cz=Math.floor(cz);
  // Do not overwrite the new hand-authored procession steps with old, generic
  // concentric stages selected from the procedural room list.
  if(landmarkPlans.some(p=>Math.hypot(cx-p.cx,cz-p.cz)<16))return false;
  // Keep the entire new long six-riser approach clear of generic stages.
  if(tacticalRisePlan&&tacticalRiseCells(tacticalRisePlan).some(p=>
    Math.abs(cx-p.x)<=radius+1&&Math.abs(cz-p.z)<=radius+1))return false;
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
 if(sectorStyle<14&&!isBalconySector())stage(centre,centre,boss?9:6,4);
 // Secondary decks appear in chamber-rich levels, as well as in two new worlds.
 const extra=(level%4===0||level%4===2)?1:2;
 let made=0;
 for(let i=1;i<mapRooms.length&&made<extra&&!isBalconySector();i++){
  const r=mapRooms[(i*5+level)%mapRooms.length];
  if(!r||r.w<9||r.h<9||Math.hypot(r.x-centre,r.z-centre)<(sectorStyle>=14?20:12))continue;
  if(stage(r.x-.5,r.z-.5,Math.min(4,Math.floor(Math.min(r.w,r.h)/2)-1),3))made++;
 }
 // Mount every silhouette as real 22cm riser tiles after generic floor stages
 // have been reserved. Raised surfaces remain visible/ballistically solid at
 // both quality tiers and traversable for players and grounded robots.
 for(const plan of landmarkPlans){
  const cells=landmarkCells(plan);
  if(!cells.length||cells.some(p=>p.x<2||p.z<2||p.x>=mapSize-2||p.z>=mapSize-2||
     mapCells[p.z]?.[p.x]!==0||floorHeightAtCell(p.x,p.z)>.01||deckAtCell(p.x,p.z)>.01))continue;
  for(const p of cells)heightCells[p.z*mapSize+p.x]=p.h;
  landmarkSpecs.push({...plan,y:6*.22,cells:cells.length,
   spawns:[{x:plan.cx+.5,z:plan.cz+.5}]});
  stairStages.push({x:plan.cx+.5,z:plan.cz+.5,radius:12,top:6*.22,kind:'landmark'});
 }
 // Every upper balcony is at either 2.20m (10 broad treads) or 3.08m
 // (14 treads). The whole approach remains on the single ground-floor map.
 // Elevated plates are separate from the floor, so ground traffic can pass
 // underneath. All geometry and collision heights share these exact cells.
 function installBalcony(spec,planIndex){
  const {cx,cz,axis,side,steps}=spec;
  const altitude=steps*BRIDGE_RISE,deckLength=4,deckWidth=5;
  const low=-1,high=2;
  const cell=(u,v)=>axis==='x'?{x:cx+u,z:cz+v}:{x:cx+v,z:cz+u};
  const edge=side>0?high:low;
  let clear=true;
  for(let u=low;u<=high;u++)for(let v=-2;v<=2;v++){
   const p=cell(u,v);
   // A new entrance may JOIN an already-installed raised arena at the SAME
   // height. The lower risers, however, must remain clear underneath it.
   if(mapCells[p.z]?.[p.x]!==0||
      deckAtCell(p.x,p.z)>0&&Math.abs(deckAtCell(p.x,p.z)-altitude)>.02||
      floorHeightAtCell(p.x,p.z)>.01)clear=false;
  }
  for(let k=1;k<=steps;k++)for(let v=-2;v<=2;v++){
   const p=cell(edge+side*k,v);
   if(mapCells[p.z]?.[p.x]!==0||deckAtCell(p.x,p.z)>0||floorHeightAtCell(p.x,p.z)>.01)clear=false;
  }
  if(!clear)return;
  for(let u=low;u<=high;u++)for(let v=-2;v<=2;v++){
   const p=cell(u,v);deckCells[p.z*mapSize+p.x]=altitude;
  }
  for(let k=1;k<=steps;k++)for(let v=-2;v<=2;v++){
   const p=cell(edge+side*k,v);
   heightCells[p.z*mapSize+p.x]=(steps+1-k)*BRIDGE_RISE;
  }
  balconySpecs.push({...spec,planIndex,y:altitude,width:deckWidth,length:deckLength,
   entry:cell(edge+side*steps,0),top:cell(edge,0)});
  stairStages.push({x:cx+.5,z:cz+.5,radius:steps+4,top:altitude,kind:'balcony'});
 }
 // Primary staircases must exist before the long galleries are generated.
 // Reserve the appended alternate flights until AFTER the shaped arenas,
 // preventing their landing plates from pre-empting elevated arena geometry.
 for(const [planIndex,spec] of balconyPlans.entries())if(!spec.alternate)
  installBalcony(spec,planIndex);
 // Stage51: real, traversable U-shaped sky galleries. At most three spans;
 // each cell is a regular deck plate with the exact same collision / rails.
 for(const plan of galleryPlans){
  const a=balconySpecs.find(s=>s.planIndex===plan[0]);
  const b=balconySpecs.find(s=>s.planIndex===plan[1]);
  if(!a||!b||a.steps!==b.steps)continue;
  const cells=balconyGalleryCells(a,b),y=a.steps*BRIDGE_RISE;
  if(cells.length<12||cells.length>110)continue;
  if(cells.some(({x,z})=>mapCells[z]?.[x]!==0||
   floorHeightAtCell(x,z)>.05&&Math.abs(deckAtCell(x,z)-y)>.02||
   deckAtCell(x,z)>0&&Math.abs(deckAtCell(x,z)-y)>.02))continue;
  let installed=0;
  for(const {x,z} of cells){if(deckAtCell(x,z)<.01)installed++;
   deckCells[z*mapSize+x]=y;}
  // Points in the MIDDLE of each two-cell-wide main span leave enough
  // clearance for a 0.48m walking robot and for the handrails on both sides.
  const spawns=[];
  if(a.cz===b.cz){
   const sign=a.cz<Math.floor(mapSize/2)?-1:1,Z=a.cz+sign*5;
   for(let x=Math.min(a.cx,b.cx)+4;x<=Math.max(a.cx,b.cx)-4;x+=3){
    if(Math.abs(deckAtCell(x,Z)-y)<.05&&Math.abs(deckAtCell(x,Z+sign)-y)<.05)
     spawns.push({x:x+.5,z:Z+(sign>0?1:0)});
   }
  }else{
   const sign=a.cx<Math.floor(mapSize/2)?-1:1,X=a.cx+sign*5;
   for(let z=Math.min(a.cz,b.cz)+4;z<=Math.max(a.cz,b.cz)-4;z+=3){
    if(Math.abs(deckAtCell(X,z)-y)<.05&&Math.abs(deckAtCell(X+sign,z)-y)<.05)
     spawns.push({x:X+(sign>0?1:0),z:z+.5});
   }
  }
  gallerySpecs.push({from:a.planIndex,to:b.planIndex,y,cells:cells.length,newCells:installed,spawns});
 }
 // Real elevated observation rings, spectator wings, and broken courtyards.
 // Every new component starts on an existing accessible gallery and is
 // installed ONLY when its parent bridge truly exists at the same altitude.
 for(const spec of skyFeaturePlans){
  const parent=gallerySpecs[spec.galleryIndex];
  if(!parent)continue;
  const y=parent.y,cells=skyFeatureCells(spec);
  if(cells.length<20||cells.length>125)continue;
  if(cells.some(({x,z})=>mapCells[z]?.[x]!==0||
      floorHeightAtCell(x,z)>.05&&Math.abs(deckAtCell(x,z)-y)>.02||
      deckAtCell(x,z)>0&&Math.abs(deckAtCell(x,z)-y)>.02))continue;
  let added=0;
  for(const {x,z} of cells){if(deckAtCell(x,z)<.01)added++;
   deckCells[z*mapSize+x]=y;}
  const spawns=[];
  for(const {x,z} of cells){
   if(((x+z)%3)!==0)continue;
   if([[1,0],[-1,0],[0,1],[0,-1]].every(([dx,dz])=>
      Math.abs(deckAtCell(x+dx,z+dz)-y)<.05))spawns.push({x:x+.5,z:z+.5});
  }
  skyFeatureSpecs.push({...spec,y,cells:cells.length,newCells:added,spawns});
 }
 for(const [planIndex,spec] of balconyPlans.entries())if(spec.alternate)
  installBalcony(spec,planIndex);
 // Stage54: semi-height ground terraces (1.10/1.54m) physically rise with
 // their stair tiles. No suspended deck can overlap their entire footprint.
 for(const plan of midlevelPlans){
  const cells=midlevelCells(plan),y=plan.steps*.22;
  const roofStairs=midlevelRoofStairCells(plan),roofY=y+2.84;
  if(cells.some(p=>mapCells[p.z]?.[p.x]!==0||
     floorHeightAtCell(p.x,p.z)>.01||deckAtCell(p.x,p.z)>.01)||
     roofStairs.some(p=>mapCells[p.z]?.[p.x]!==0||
      floorHeightAtCell(p.x,p.z)>.01||deckAtCell(p.x,p.z)>.01))continue;
  for(const p of cells)heightCells[p.z*mapSize+p.x]=p.h;
  // Stage56 wraparound fire escape: no teleport, fake tilted paint, or
  // separate collision mesh. Every riser is the real height-map floor that
  // already stops player bodies, walking robots, hitscan and moving shells.
  for(const p of roofStairs)heightCells[p.z*mapSize+p.x]=p.h;
  // The roof is a real worldSolidBox in the static mesh; this second-layer
  // navigation *height* does not draw another plate. Walking below the roof
  // remains possible because supportHeight uses the actor's current feet.
  for(const p of midlevelRoofDeckCells(plan))deckCells[p.z*mapSize+p.x]=roofY;
  const spawns=[];
  for(let u=-2;u<=2;u++){
   const x=plan.axis==='x'?plan.cx+u:plan.cx;
   const z=plan.axis==='x'?plan.cz:plan.cz+u;
   spawns.push({x:x+.5,z:z+.5});
  }
  // An actual interior spawn just behind the wide door, before the central
  // low barricade. Its headroom and contact volume are tested at load time.
  const inside=plan.axis==='x'?
   {x:plan.cx+.5,z:plan.cz+3*plan.wing+.5}:
   {x:plan.cx+3*plan.wing+.5,z:plan.cz+.5};
  spawns.push(inside);
  const roofSpawns=[{x:plan.axis==='x'?plan.cx+.5:plan.cx+3*plan.wing+.5,
   z:plan.axis==='x'?plan.cz+3*plan.wing+.5:plan.cz+.5,feetY:roofY}];
  midlevelSpecs.push({...plan,y,cells:cells.length,spawns,roofY,
   roofStairCount:roofStairs.length,roofSpawns});
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
 // Install last: never overwrite any preexisting landmark, bridge or balcony.
 // The level builder selected the orientation against every protected route.
 if(tacticalRisePlan){
  const cells=tacticalRiseCells(tacticalRisePlan);
  const valid=cells.length>=35&&cells.every(p=>p.x>=2&&p.z>=2&&
   p.x<mapSize-2&&p.z<mapSize-2&&mapCells[p.z]?.[p.x]===0&&
   floorHeightAtCell(p.x,p.z)<.01&&
   // Airborne 7.25/8.75m maintenance platforms leave ample headroom for a
   // 1.32m path UNDER them. A 2.2m old bridge does not; preserve its access.
   (deckAtCell(p.x,p.z)<.01||
    deckAtCell(p.x,p.z)>p.h+PLAYER_SOLID_HEIGHT+.35));
  if(valid){
   for(const p of cells)heightCells[p.z*mapSize+p.x]=p.h;
   tacticalRiseSpecs.push({...tacticalRisePlan,cells:cells.length,y:1.32,
    entry:{x:tacticalRisePlan.cx+.5,z:tacticalRisePlan.cz+.5},
    lookout:tacticalRotate(10,0,tacticalRisePlan.orientation)});
   stairStages.push({x:tacticalRisePlan.cx+.5,z:tacticalRisePlan.cz+.5,
    radius:14,top:1.32,kind:'tacticalLookout'});
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
 const length=Math.hypot(dx,dz),steps=Math.max(1,Math.ceil(length/Math.max(.13,r*.72)));
 const sx=dx/steps,sz=dz/steps;
 for(let i=0;i<steps;i++)for(const [ax,az] of [[sx,0],[0,sz]]){
  if(ax===0&&az===0)continue;
  const x=a.x+ax,z=a.z+az;
  const feet=Number.isFinite(a.feetY)?a.feetY:worldTerrainFootprint(a.x,a.z,r);
  const walking=player?!!a.grounded&&!a.flying:enemy?!a.airborne:true;
  const blockers=player||enemy?worldActorBlockers(a,r,player,enemy):[];
  const pose=worldActorAdvance(a.x,a.z,x,z,r,feet,walking,enemy&&!a.airborne,
   player?PLAYER_SOLID_HEIGHT:enemy?enemyBodyHeight(a):0,blockers);
  if(!pose)continue;
  a.x=pose.x;a.z=pose.z;a.feetY=pose.feet;
  if(player&&walking&&!pose.grounded){a.grounded=false;a.vy=0;}
 }
}
function queueJump(){if(game?.state==='playing'&&!arsenalOpened)input.jumpQueued=true;}
function toggleFlight(){
 if(typeof mpMatch!=='undefined'&&mpMatch?.active)return false;
 if(!game||game.state!=='playing'||arsenalOpened)return false;
 const p=game.p;
 if(!p.flightUnlocked){toast('ПОЛЁТ: КОСТЮМ №10–16 ИЛИ УЛУЧШЕНИЕ LVL 10',1.4);return false;}
 p.flying=!p.flying;
 p.vy=0;if(p.flying){p.grounded=false;input.jumpQueued=false;}
 if(typeof refreshFlightButtons==='function')refreshFlightButtons();
 toast(p.flying?(game.preview&&touchOnly?'ПОЛЁТ ВКЛ · КНОПКИ ↑ / ↓':'ПОЛЁТ ВКЛ · SPACE ↑ · SHIFT ↓'):'ПОЛЁТ ВЫКЛ',1.5);
 return p.flying;
}
function updateVertical(p,dt){
 const blockers=worldActorBlockers(p,.23,true,false);
 const floor=worldActorVerticalFloor(p.x,p.z,p.feetY,worldActorGround(p.x,p.z,.23,p.feetY),blockers);
 if(!Number.isFinite(p.feetY)){p.feetY=floor;p.grounded=true;p.vy=0;}
 if(p.flying&&!p.flightUnlocked)p.flying=false;
 if(p.flying){
  const ascend=!!(input.flyUp||input.keys?.Space);
  const descend=!!(input.flyDown||input.keys?.ShiftLeft||input.keys?.ShiftRight||input.keys?.ControlLeft||input.keys?.ControlRight);
  const direction=Number(ascend)-Number(descend);
  const before=p.feetY,maxFeet=Math.max(floor,ceilingHeight()-PLAYER_SOLID_HEIGHT-.2);
  const flightVerticalSpeed=FLIGHT_SPEED*flightSpeedMultiplier('vertical')*normalizeFlightThrottle(save.settings.flightVertical);
  let after=clamp(before+direction*flightVerticalSpeed*dt,floor,maxFeet);
  // Stage88: equipment remains physically solid in Canvas fallback too.
  // worldSolid*Barrier already skips unavailable WebGL mesh solids, but still
  // queries the SAME metal equipment AABBs visible in the Canvas renderer.
  if(after>before){
   const fromHead=before+PLAYER_SOLID_HEIGHT,toHead=after+PLAYER_SOLID_HEIGHT;
   const bar=worldLowestContact(worldDeckHeadBarrier(p.x,p.z,.23,fromHead,toHead),
    worldSolidHeadBarrier(p.x,p.z,.23,fromHead,toHead));
   if(bar!==null)after=Math.min(after,bar-PLAYER_SOLID_HEIGHT-.004);
  }else if(after<before){
   const roof=worldHighestContact(worldDeckFeetBarrier(p.x,p.z,.23,before,after),
    worldSolidFeetBarrier(p.x,p.z,.23,before,after));
   if(roof!==null)after=Math.max(after,roof+.004);
  }
  after=worldActorVerticalLimit(p.x,p.z,before,after,PLAYER_SOLID_HEIGHT,blockers);
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
  if(p.grounded){p.grounded=false;p.vy=JUMP_VELOCITY;
   if(save.settings.audio)sound(250,.09,'triangle',.045);
  }
 }
 if(!p.grounded){
  p.vy-=JUMP_GRAVITY*dt;
  const prevY=p.feetY;
  p.feetY+=p.vy*dt;
  // Stage107: sweep the entire circular helmet and boots against bridge
  // plates and any additional WebGL/equipment AABBs, regardless of renderer.
  if(p.vy>0){
   const fromHead=prevY+PLAYER_SOLID_HEIGHT,toHead=p.feetY+PLAYER_SOLID_HEIGHT;
   const underside=worldLowestContact(worldDeckHeadBarrier(p.x,p.z,.23,fromHead,toHead),
    worldSolidHeadBarrier(p.x,p.z,.23,fromHead,toHead));
   if(underside!==null){p.feetY=Math.max(prevY,underside-PLAYER_SOLID_HEIGHT-.004);p.vy=0;}
  }
  if(p.vy<0){
   const landing=worldHighestContact(worldDeckFeetBarrier(p.x,p.z,.23,prevY,p.feetY),
    worldSolidFeetBarrier(p.x,p.z,.23,prevY,p.feetY));
   if(landing!==null){p.feetY=Math.max(p.feetY,landing+.004);p.vy=0;p.grounded=true;}
  }
  const limited=worldActorVerticalLimit(p.x,p.z,prevY,p.feetY,PLAYER_SOLID_HEIGHT,blockers);
  if(limited!==p.feetY){p.grounded=p.feetY<prevY;p.feetY=limited;p.vy=0;}
  if(p.feetY<=floor){
   const impact=Math.max(0,-p.vy);
   p.feetY=floor;p.vy=0;p.grounded=true;
   if(impact>3.1)burst(p.x,floor+.06,p.z,[.46,.73,.76],4);
  }
 }
 const maximum=Math.max(floor,ceilingHeight()-PLAYER_SOLID_HEIGHT-.2);
 if(p.feetY>maximum){p.feetY=maximum;p.vy=Math.min(0,p.vy);}
}
function isWall(x,z){let ix=Math.floor(x),iz=Math.floor(z);return ix<0||iz<0||ix>=mapSize||iz>=mapSize||mapCells[iz][ix]===1}
// Stage79: the player and robots have a CIRCULAR horizontal footprint, not
// a square. The old four-corners-of-a-square test blocked an operator beside
// an exposed tile corner even when the circle did not touch visible masonry.
// Use the exact 2D circle-vs-AABB predicate, consistent with 3D solid boxes.
// Check all intersecting map tiles, including the exterior boundary; return
// false for corner tangency rather than inventing an invisible diagonal wall.
function collide(x,z,r=.22){
 if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(r)||r<0||!mapSize)return true;
 if(x-r<0||z-r<0||x+r>mapSize||z+r>mapSize)return true;
 if(r===0)return isWall(x,z);
 const rr=r*r-1e-9;
 for(let cz=Math.floor(z-r);cz<=Math.min(mapSize-1,Math.floor(z+r));cz++){
  for(let cx=Math.floor(x-r);cx<=Math.min(mapSize-1,Math.floor(x+r));cx++){
   if(mapCells[cz]?.[cx]!==1)continue;
   const dx=x-Math.max(cx,Math.min(x,cx+1));
   const dz=z-Math.max(cz,Math.min(z,cz+1));
   if(dx*dx+dz*dz<rr)return true;
  }
 }
 return false;
}
function moveEntity(a,dx,dz,r=.23){tryMoveEntity(a,dx,dz,r)}
function lineClear(x,z,X,Z){let dx=X-x,dz=Z-z,n=Math.ceil(hypot(dx,dz)*5);for(let i=1;i<n;i++){let t=i/n;if(isWall(x+dx*t,z+dz*t))return false}return true}
