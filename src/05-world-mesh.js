
// V67: every fifth level gets an ACTUAL high-altitude boss-only battlefield
// crown: fully modelled box volumes, never lights/flat scenery masquerading
// as solid cover. Five fundamentally different frameworks, four graduated
// evolutions each = twenty independently identifiable boss silhouettes.
const bossSkylineNames=['ЛУЧЕВАЯ КОРОНА','ДВОЙНОЙ НЕБЕСНЫЙ КОЛЬЦЕВОЙ ЗАЛ',
 'ПЕРЕКРЁСТНЫЕ СВОДЫ','ПОДВЕСНЫЕ АМФИТЕАТРЫ','ЗВЁЗДНАЯ ГРИДЬ'];
function bossSkylineBoxes(level,cx,cz,roofH){
 if(level%5!==0)return [];
 const id=level/5-1,kind=id%5,tier=Math.floor(id/5),out=[];
 const base=11.1+tier*.18,upper=Math.min(roofH-1.62,base+2.85);
 const add=(role,x0,y0,z0,x1,y1,z1)=>{
  const b=[cx+Math.min(x0,x1),y0,cz+Math.min(z0,z1),
   cx+Math.max(x0,x1),y1,cz+Math.max(z0,z1)];
  if(b[3]-b[0]<.06||b[5]-b[2]<.06||b[4]-b[1]<.06)return;
  out.push({role,box:b});
 };
 const cross=(x,z,r,y)=>{
  add('radialX',x-r,y,z-.46,x+r,y+.24,z+.46);
  add('radialZ',x-.46,y,z-r,x+.46,y+.24,z+r);
 };
 if(kind===0){
  // Cathedral star: four distinct axial bridges and increasing side spurs.
  const r=6.6+tier*.64;
  cross(0,0,r,base+.52);
  for(const side of [-1,1]){
   add('archLeft',side*r-.41,base+.52,-5.4,side*r+.41,base+1.0,5.4);
   add('archFront',-5.4,base+.52,side*r-.41,5.4,base+1.0,side*r+.41);
  }
  for(let i=0;i<=tier;i++)for(const side of [-1,1]){
   const arm=2.5+i*.93;
   add('branchX',side*arm-.28,upper-.1,-5.2,side*arm+.28,upper+.14,-2.0);
   add('branchZ',2.0,upper-.1,side*arm-.28,5.2,upper+.14,side*arm+.28);
  }
 }else if(kind===1){
  // Open DOUBLE rectangular ring: the centre is a true lightwell.
  for(let ring=0;ring<2;ring++){
   const r=4.1+ring*(3.1+tier*.30),y=base+ring*1.15;
   for(const side of [-1,1]){
    add('squareLong',-r,y,side*r-.37,r,y+.28,side*r+.37);
    add('squareSide',side*r-.37,y,-r,side*r+.37,y+.28,r);
   }
  }
  for(let i=0;i<=tier;i++){
   const r=4.1+i*.8;
   add('upperRib',-r,upper-.04,-1.1,r,upper+.12,-.78);
  }
 }else if(kind===2){
  // A run of offset, multi-height flying cross-vaults, with true gaps.
  const n=2+tier;
  for(let i=0;i<n;i++){
   const off=(i-(n-1)/2)*3.2,y=base+(i%2)*.75;
   add('xVault',-8.2,y,off-.46,8.2,y+.27,off+.46);
   add('zVault',off-.46,y+.42,-8.2,off+.46,y+.69,8.2);
  }
  for(const side of [-1,1])add('outerLintel',side*9.0-.3,upper-.1,-8.8,
   side*9.0+.3,upper+.12,8.8);
  for(const side of [-1,1])add('crossTransept',-8.2,upper-.12,
   side*8.6-.29,8.2,upper+.12,side*8.6+.29);
 }else if(kind===3){
  // Step-down outer galleries surrounding an empty boss-height court.
  for(let band=0;band<3+tier;band++){
   const dist=3.1+band*1.53,y=base+(band%3)*.52;
   const sign=band%2===0?1:-1;
   add('terraceWest',sign*dist-.52,y,-8.5,sign*dist+.52,y+.34,8.5);
   add('terraceReturn',-dist,y+.2,sign*7.2-.38,dist,y+.44,sign*7.2+.38);
  }
  for(const side of [-1,1])add('amphitheatreCrown',-8.5,upper-.08,
    side*9.1-.30,8.5,upper+.15,side*9.1+.30);
 }else{
  // An aerial stellar constellation: real square bays, spokes and rungs.
  const count=6+tier*2,radius=7.8+tier*.22;
  for(let i=0;i<count;i++){
   const a=i*Math.PI*2/count,x=Math.cos(a)*radius,z=Math.sin(a)*radius;
   const y=base+(i%3)*.44;
   add('starBay',x-.62,y,z-.62,x+.62,y+.26,z+.62);
   if(Math.abs(x)>Math.abs(z))add('starSpoke',Math.min(x,0)-.24,y+.07,z-.32,
     Math.max(x,0)+.24,y+.27,z+.32);
   else add('starSpoke',x-.32,y+.07,Math.min(z,0)-.24,
     x+.32,y+.27,Math.max(z,0)+.24);
  }
 }
 return out;
}
// V67: low real bulletproof railing along selected EXPOSED lookout edges.
// Never place cover across an actual step or an internal walking transition.
function tacticalRiseEdgeCover(plan,level){
 if(!plan)return [];
 const cells=tacticalRiseCells(plan),raised=new Map(cells.map(p=>[p.z*mapSize+p.x,p]));
 const result=[];
 for(const p of cells){
  if(p.h<1.319||p.u<7||((p.u*13+p.v*7+level*11)%5)>1)continue;
  const sides=[[0,-1],[1,0],[0,1],[-1,0]];
  // The 13-centimetre-thick guard rail sits OUTSIDE the footway. Standard
  // 26cm robot and full-height player capsules remain free at tile centres.
  for(let i=0;i<4;i++){
   const [dx,dz]=sides[(i+level)%4],other=raised.get((p.z+dz)*mapSize+p.x+dx);
   if(other&&Math.abs(other.h-p.h)<.3)continue;
   const y0=p.h+.13,y1=p.h+.75;
   const b=dx===1?[p.x+.97,y0,p.z+.11,p.x+1.10,y1,p.z+.89]:
    dx===-1?[p.x-.10,y0,p.z+.11,p.x+.03,y1,p.z+.89]:
    dz===1?[p.x+.11,y0,p.z+.97,p.x+.89,y1,p.z+1.10]:
    [p.x+.11,y0,p.z-.10,p.x+.89,y1,p.z+.03];
   result.push({x:p.x,z:p.z,box:b,role:'tacticalGuard'});
   break;
  }
 }
 return result;
}
// V70: ten materially different roof-truss families, eight unique footprint
// variants each, anchored to the ACTUAL Stage68 extra ground courtyards.
// Their undersides clear every normal player's head and every 1.32m lookout.
// The boxes are rendered and physics-registered through worldSolidBox.
const secondaryCanopyNames=['ЛУЧЕВОЙ КЕССОН','ДВА НЕБЕСНЫХ КВАДРАТА',
 'ТРЁХПРОЛЁТНАЯ ГРЕБЁНКА','ПОПЕРЕЧНЫЙ ТРИУМФ',
 'СТУПЕНЧАТАЯ РЕШЁТКА','ВЛОЖЕННЫЕ СКОБЫ','ШЕСТЬ КОНСОЛЕЙ',
 'СМЕЩЁННЫЕ РОМБЫ','ТРОЙНОЙ ПРИЧАЛ','НЕСИММЕТРИЧНЫЙ ТРЕЗУБЕЦ'];
function secondaryCanopyBoxes(level,plan,roofH){
 if(!plan||level%5===0)return [];
 const out=[],cx=plan.cx+.5,cz=plan.cz+.5;
 const add=(role,x0,z0,x1,z1,tier=0)=>{
  const y0=roofH-.64+tier*.04,y1=roofH-.40+tier*.04;
  const p=[tacticalRotate(x0,z0,plan.orientation),
   tacticalRotate(x0,z1,plan.orientation),
   tacticalRotate(x1,z0,plan.orientation),
   tacticalRotate(x1,z1,plan.orientation)];
  const bx0=cx+Math.min(...p.map(v=>v.x)),bx1=cx+Math.max(...p.map(v=>v.x));
  const bz0=cz+Math.min(...p.map(v=>v.z)),bz1=cz+Math.max(...p.map(v=>v.z));
  if(bx1-bx0<.06||bz1-bz0<.06||y1>=roofH-.25)return;
  out.push({role,box:[bx0,y0,bz0,bx1,y1,bz1]});
 };
 const xBeam=(name,x0,x1,z,tier=0)=>add(name,x0,z-.21,x1,z+.21,tier);
 const zBeam=(name,z0,z1,x,tier=0)=>add(name,x-.21,z0,x+.21,z1,tier);
 switch(plan.kind){
  case 0: // cross-ribbed casket and four slotted outboard ribs
   xBeam('casketX',-5,5,0);zBeam('casketZ',-5,5,0);
   for(const s of [-1,1]){
    xBeam('casketEnd',-4,4,s*4);
    zBeam('casketWing',-4,4,s*4);
   }
   break;
  case 1: // two hollow nested rectangular flying frames
   for(const r of [2.7,5.0])for(const s of [-1,1]){
    xBeam('ringLong',-r,r,s*r);
    zBeam('ringSide',-r,r,s*r);
   }
   xBeam('ringCross',-5,5,0);break;
  case 2: // three parallel long ribs, with transverse connecting tails
   for(const z of [-3,0,3])xBeam('combLong',-5,5,z);
   for(const x of [-4,0,4])zBeam('combBridge',-3,3,x);
   for(const s of [-1,1])xBeam('combTooth',s*2,s*5,s*5);
   break;
  case 3: // overhead H with outward flanking counterbeams
   for(const x of [-4,4])zBeam('triumphPylon',-5,5,x);
   xBeam('triumphLintel',-4,4,0);
   for(const z of [-4,4])xBeam('triumphOutrigger',-4,4,z);
   break;
  case 4: // asymmetrically ascending sequence of ladder rungs
   for(const z of [-5,-2,1,4])xBeam('ladderRung',-5+Math.floor((z+5)/3),5,z);
   zBeam('ladderSpine',-5,5,-4);
   zBeam('ladderSpine',-5,5,4);
   xBeam('ladderExit',-1,5,5);break;
  case 5: // two offset open U-shapes and a narrow connecting throat
   for(const s of [-1,1]){
    zBeam('uSide',-5,5,s*4);
    xBeam('uBend',s<0?-4:0,s<0?0:4,s*4);
   }
   xBeam('uBridge',-4,4,0);
   zBeam('uAisle',-3,3,0);break;
  case 6: // cross and diagonal-like staggered six-arm constellation
   xBeam('spokeMain',-5,5,0);zBeam('spokeMain',-5,5,0);
   for(const [x,z] of [[-4,-4],[-4,4],[4,-4],[4,4]]){
    xBeam('spokeBay',x-1,x+1,z);
    zBeam('spokeJoint',z-Math.sign(z)*2,z,x);
   }
   break;
  case 7: // two shifted open rhombus-like square loops
   for(const [ox,oz] of [[-2,-2],[2,2]])for(const s of [-1,1]){
    xBeam('diamondArc',ox-3,ox+3,oz+s*3);
    zBeam('diamondArc',oz-3,oz+3,ox+s*3);
   }
   xBeam('diamondLink',-2,2,0);break;
  case 8: // quay, three dock fingers and separated return passage
   zBeam('harbourSpine',-5,5,-5);
   for(const z of [-4,0,4])xBeam('harbourFinger',-5,5,z);
   zBeam('harbourReturn',-4,4,5);
   xBeam('harbourKeel',-2,3,2);break;
  default: // off-axis three-pronged engine crown
   zBeam('tridentStem',-5,5,-2);
   for(const x of [-5,0,5])zBeam('tridentPoint',-4,4,x);
   xBeam('tridentBridge',-5,5,-4);
   xBeam('tridentCollar',-2,5,2);break;
 }
 // A topologically distinct extra beam for all eight route identities.
 // Endcaps at radius six are outside the common five-tile structural base.
 const ends=[[-6,-6],[0,-6],[6,-6],[6,0],
  [6,6],[0,6],[-6,6],[-6,0]];
 const [ex,ez]=ends[plan.variant];
 add('individualEndcap',ex-.33,ez-.33,ex+.33,ez+.33,1);
 if(plan.variant%2===0){
  xBeam('individualLink',Math.min(0,ex),Math.max(0,ex),0,1);
  zBeam('individualLink',Math.min(0,ez),Math.max(0,ez),ex,1);
 }else{
  zBeam('individualLink',Math.min(0,ez),Math.max(0,ez),0,1);
  xBeam('individualLink',Math.min(0,ex),Math.max(0,ex),ez,1);
 }
 return out;
}
// V71: twenty physically DIFFERENT three-dimensional siege compounds above
// the twenty real boss-approach ground plans (five structures x four variants).
// Unlike distant boss skylines, these frames hang at combat altitude: they
// stop shots and rockets, can be landed on by a flying operator, and leave the
// underlying walking/robot network completely unchanged. Their foundation
// piers extend ONLY from pre-existing solid maze walls toward the court by at
// most 12 cm; even a .26m-radius robot retains the tile's .38m free margin.
const bossSiegeNames=['ШТУРМОВАЯ ЛУЧЕВАЯ ЦИТАДЕЛЬ','ДВОЙНОЙ ОСАДНЫЙ ОБВОД',
 'ТРЁХЪЯРУСНЫЕ ВРАТА','РАЗДЕЛЁННЫЕ БАСТИОНЫ','ВОЗДУШНЫЙ ТРЕЗУБЕЦ'];
function bossSiegeBoxes(level,plan,roofH){
 if(!plan||level%5!==0)return [];
 const out=[],cx=plan.cx+.5,cz=plan.cz+.5,tier=plan.variant;
 const ceiling=roofH-.96;
 const transform=(dx,dz)=>tacticalRotate(dx,dz,plan.orientation);
 const add=(role,x0,y0,z0,x1,y1,z1)=>{
  if(!(y1>y0+.025)||y1>ceiling||y0<0)return;
  const corners=[transform(x0,z0),transform(x0,z1),
    transform(x1,z0),transform(x1,z1)];
  const b=[cx+Math.min(...corners.map(p=>p.x)),y0,
    cz+Math.min(...corners.map(p=>p.z)),
    cx+Math.max(...corners.map(p=>p.x)),y1,
    cz+Math.max(...corners.map(p=>p.z))];
  if(b[3]-b[0]>.025&&b[5]-b[2]>.025)out.push({role,box:b});
 };
 const xBeam=(role,x0,x1,z,y,h=.24,w=.29)=>
  add(role,x0,y,z-w,x1,y+h,z+w);
 const zBeam=(role,z0,z1,x,y,h=.24,w=.29)=>
  add(role,x-w,y,z0,x+w,y+h,z1);
 const y=5.35+tier*.27,upper=y+1.72;
 switch(plan.kind){
  case 0:{ // Long radial nave, four C-shaped fighting transepts.
   xBeam('keepLongNave',-6.3,6.3,0,y,.40,.42);
   zBeam('keepCrossNave',-6.2,6.2,0,y+.36,.32,.38);
   for(const s of [-1,1]){
    xBeam('keepFork',-5,5,s*(3.8+tier*.16),upper);
    zBeam('keepFlank',-5,5,s*5.5,y+.25,.29,.34);
    xBeam('keepTip',s*3.2,s*6.4,s*5.5,upper+.34,.23,.25);
   }
   for(let i=0;i<=tier;i++){
    const a=1.65+i*.92;
    zBeam('keepExtraRib',-3.35,3.35,a,upper+.36+i*.025,.20,.17);
   }
   break;
  }
  case 1:{ // Two nested open rectangle walkways, interrupted at the centre.
   for(let ring=0;ring<2;ring++){
    const r=3.05+ring*(2.36+tier*.22),h=y+ring*1.37;
    for(const s of [-1,1]){
     xBeam('siegeRingX',-r,r,s*r,h,.32,.30);
     zBeam('siegeRingZ',-r,r,s*r,h,.32,.30);
    }
   }
   xBeam('siegeBridge',-5.4,5.4,0,upper+.30,.24,.27);
   for(let i=0;i<=tier;i++)
    zBeam('siegeRingDivider',-3.1,3.1,-2.1+i*1.42,y+.60,.21,.21);
   break;
  }
  case 2:{ // Staggered triple gate towers with REAL different beam heights.
   for(let i=0;i<3;i++){
    const x=-4.6+i*(4.6+tier*.07),h=y+(i%2)*1.10;
    zBeam('gateLine',-6,6,x,h,.39,.40);
    xBeam('gateCrossbar',x-.8,x+.8,-4.7+i*4.7,h+.44,.28,.28);
   }
   for(const z of [-5.1,5.1])
    xBeam('gateOuterTransept',-5.5,5.5,z,upper+.38,.29,.33);
   for(let i=0;i<=tier;i++)
    xBeam('gateStageRung',-4.5,4.5,-3.0+i*1.65,y+.85+i*.07,.19,.19);
   break;
  }
  case 3:{ // Divided western/eastern bastions; open skyward centre slit.
   for(const s of [-1,1]){
    const x=s*(3.45+tier*.16);
    zBeam('splitWall',-5.5,5.5,x,y,.35,.42);
    xBeam('splitNorthWing',s*1.45,s*5.45,-5.15,upper,.30,.34);
    xBeam('splitSouthWing',s*1.45,s*5.45,5.15,upper+.36,.30,.34);
    for(let i=0;i<=tier;i++)
     xBeam('splitInternalTongue',s*2,s*(5.6+i*.11),-3.6+i*2.1,
       upper+.65,.19,.23);
   }
   zBeam('splitWatch',-2.1,2.1,0,upper+.70,.22,.29);
   break;
  }
  default:{ // Massive asymmetrical elevated trident and five lateral piers.
   zBeam('tridentSpine',-6.0,6.0,-1.8,y,.37,.43);
   for(const x of [-5.4,0.1,5.3])
    zBeam('tridentProng',-5.8,5.8,x,upper,.29,.33);
   xBeam('tridentBackbone',-5.6,5.6,-4.65,y+.32,.32,.36);
   xBeam('tridentCollar',-5.2,5.1,3.9,upper+.39,.24,.28);
   for(let i=0;i<=tier;i++)
    xBeam('tridentFin',-5.3+i*.48,3.7+i*.22,-2.2+i*1.36,
     upper+.75,.21,.22);
   break;
  }
 }
 // Graduated command gallery: each of the four boss variants owns a
 // geometrically DIFFERENT crossing, not merely a color/height preset.
 const extra=[[-6,-6],[6,-6],[6,6],[-6,6]][tier];
 xBeam('uniqueCommandBridge',Math.min(0,extra[0]),Math.max(0,extra[0]),
  extra[1],upper+.96,.30,.32);
 zBeam('uniqueCommandReturn',Math.min(0,extra[1]),Math.max(0,extra[1]),
  extra[0],upper+1.28,.27,.27);
 for(let i=0;i<=tier;i++){
  const off=-5.0+i*1.45;
  xBeam('commandSlot',-2.3,2.3,off,upper+1.61+i*.15,.16,.19);
 }
 // A real four-sided perimeter of shallow overhead defensive rails, with
 // spaced forward firing platforms. Their low elevation differentiates
 // this siege fort from the separate high boss-skyline decoration.
 for(const s of [-1,1]){
  xBeam('siegePerimeterX',-5.9,5.9,s*6.25,y+.22,.22,.20);
  zBeam('siegePerimeterZ',-5.9,5.9,s*6.25,y+.52,.22,.20);
  for(const corner of [-1,1])
   add('siegeWatchDeck',s*5.9-.36,upper+.49,
    corner*5.9-.36,s*5.9+.36,upper+.69,corner*5.9+.36);
 }
 // Real support columns are chosen from EXISTING WALL tiles. Each one
 // protrudes just 0.12m toward a neighbouring OPEN tile and remains a
 // projectile/body collider. Never create a phantom visual-only pillar or
 // a new full-width obstruction on the ground.
 const targets=[[-6,-6],[0,-6],[6,-6],[-6,0],[6,0],[-6,6],[0,6],[6,6],
  [-3,-6],[3,6],[6,-3],[-6,3]];
 const found=new Set();
 for(let n=0;n<targets.length;n++){
  const [lx,lz]=targets[(n+tier)%targets.length],origin=transform(lx,lz);
  let closest=null;
  for(let dz=-7;dz<=7;dz++)for(let dx=-7;dx<=7;dx++){
   const X=plan.cx+origin.x+dx,Z=plan.cz+origin.z+dz;
   if(X<2||Z<2||X>=mapSize-2||Z>=mapSize-2||mapCells[Z]?.[X]!==1)continue;
   if(Math.abs(X-plan.cx)>7||Math.abs(Z-plan.cz)>7||
      found.has(Z*mapSize+X))continue;
   const beside=[[1,0],[-1,0],[0,1],[0,-1]].filter(([a,b])=>
    mapCells[Z+b]?.[X+a]===0);
   if(!beside.length)continue;
   const distance=dx*dx+dz*dz;
   if(!closest||distance<closest.distance)closest={X,Z,beside,distance};
  }
  if(!closest)continue;
  const {X,Z,beside}=closest,key=Z*mapSize+X;
  found.add(key);
  const [dx,dz]=beside[0],top=y+2.15+(n%3)*.32;
  const post=[X+.15+Math.min(0,dx*.27),0,
    Z+.15+Math.min(0,dz*.27),X+.85+Math.max(0,dx*.27),top,
    Z+.85+Math.max(0,dz*.27)];
  // The post is world-axis aligned: it already follows the global map wall.
  out.push({role:'wallFoundation',box:post});
  out.push({role:'foundationCrown',box:[post[0]-.075,top-.29,
    post[2]-.075,post[3]+.075,top+.06,post[5]+.075]});
 }
 return out;
}
// V72: real pass-through defensive gatehouses in the 80 ordinary annexes.
// Each structure is selected against the ACTUAL grid of opened secondary
// yard corridors. The bases inhabit old wall cells and project at most 12 cm
// inside the passage; no new wall ever replaces a path or an AI navigation
// tile. Ten gate profiles x eight placement/crest variants are physical.
const secondaryGatewayNames=['КРЕСТОВАЯ ПОТЕРНА','ДВА ВОЗДУШНЫХ ПРОЛЁТА',
 'ПОГРАНИЧНЫЙ КАЗЕМАТ','СТАЛЬНАЯ ГРЕБЁНКА','СТУПЕНЧАТЫЙ ПОРТАЛ',
 'ПРИСТАНЬ СТРАЖЕЙ','ДВОЙНОЙ ТРАВЕРС','ОБВОДНОЙ ШЛЮЗ',
 'КРЫЛАТАЯ БАРРИКАДА','ШАХМАТНЫЕ ЗУБЦЫ'];
function secondaryGatewaySystem(level,plan,roofH){
 const result={parts:[],gateCount:0,groundGates:0,wallBases:0};
 if(!plan||level%5===0)return result;
 const out=result.parts,centreX=plan.cx+.5,centreZ=plan.cz+.5,
  yard=new Set(secondaryYardCells(plan).map(p=>p.z*mapSize+p.x));
 const add=(role,box,group=0)=>{
  if(box.every(Number.isFinite)&&box[3]-box[0]>.025&&
     box[5]-box[2]>.025&&box[4]-box[1]>.025&&
     box[1]>=0&&box[4]<roofH-.19)out.push({role,box,group});
 };
 const candidates=[];
 for(let z=plan.cz-9;z<=plan.cz+9;z++)for(let x=plan.cx-9;x<=plan.cx+9;x++)
  for(const [ax,az] of [[1,0],[0,1]])for(let length=1;length<=7;length++){
   const lx=x-ax,lz=z-az,rx=x+ax*length,rz=z+az*length;
   if(lx<2||lz<2||rx>=mapSize-2||rz>=mapSize-2||
      mapCells[lz]?.[lx]!==1||mapCells[rz]?.[rx]!==1)continue;
   let chosen=0,high=0,valid=true;
   for(let i=0;i<length;i++){
    const X=x+ax*i,Z=z+az*i;
    if(mapCells[Z]?.[X]!==0){valid=false;break;}
    if(yard.has(Z*mapSize+X))chosen++;
    high=Math.max(high,floorHeightAtCell(X,Z),deckAtCell(X,Z));
   }
   if(!valid||chosen<Math.max(1,Math.ceil(length*.4)))continue;
   const lintel=Math.max(2.52,high+2.35);
   if(lintel+.53>=roofH-.19)continue;
   // Pick recognizable wide passages in the SECOND court first, rather
   // than tiny holes or corridors in an unrelated part of the maze.
   const target=tacticalRotate(
     [[-6,-6],[0,-6],[6,-6],[6,0],[6,6],[0,6],[-6,6],[-6,0]][plan.variant][0],
     [[-6,-6],[0,-6],[6,-6],[6,0],[6,6],[0,6],[-6,6],[-6,0]][plan.variant][1],
     plan.orientation);
   const mx=x+ax*(length-.5)/2,mz=z+az*(length-.5)/2;
   const score=chosen*1.7+Math.min(4,length)*.55-
    Math.hypot(mx-plan.cx,mz-plan.cz)*.13-
    Math.hypot(mx-(plan.cx+target.x),mz-(plan.cz+target.z))*.06-high*2.8;
   candidates.push({x,z,ax,az,length,lintel,high,score});
  }
 candidates.sort((a,b)=>b.score-a.score||a.high-b.high||
  a.z-b.z||a.x-b.x||a.ax-b.ax||a.length-b.length);
 const installed=[];
 for(const c of candidates){
  if(installed.length>=2)break;
  if(installed.some(p=>Math.hypot(p.x-c.x,p.z-c.z)<4.5))continue;
  const {x,z,ax,az,length,lintel:y}=c,group=installed.length+1;
  const parts=[];
  // Place a 3D slab in the gate's local (through, cross) coordinates.
  // It is axis-aligned in the world because gates follow orthogonal walls.
  const part=(role,s0,y0,t0,s1,y1,t1)=>{
   const x0=x+ax*s0+az*t0,z0=z+az*s0+ax*t0,
    x1=x+ax*s1+az*t1,z1=z+az*s1+ax*t1;
   if(y1>roofH-.19||y1<=y0+.025)return;
   parts.push({role,box:[Math.min(x0,x1),y0,Math.min(z0,z1),
    Math.max(x0,x1),y1,Math.max(z0,z1)],group});
  };
  // The two piers begin IN THE OLD WALL: only 9cm enters a walking tile.
  part('gateFootLeft',-.29,0,.24,.09,y+.17,.76);
  part('gateFootRight',length-.09,0,.24,length+.29,y+.17,.76);
  part('gateLintel',-.32,y,.20,length+.32,y+.23,.80);
  // Different families change solid beams, NOT merely a colored overlay.
  switch(plan.kind){
   case 0:
    part('crossRib',-.29,y+.27,.47,length+.29,y+.37,.53);
    part('crossRib',length*.48,y+.24,.12,length*.52,y+.39,.88);
    break;
   case 1:
    for(const t of [.22,.78])part('twinHeader',-.30,y+.26,t-.055,
     length+.30,y+.36,t+.055);
    break;
   case 2:
    for(const s of [.10,length-.23])part('bastionCrest',s,y+.22,.14,
     s+.15,y+.47,.86);
    break;
   case 3:
    for(let j=0;j<4;j++){
     const s=(j+.4)*length/4;
     part('combTooth',s,y+.22,.13,s+.09,y+.39,.87);
    }
    break;
   case 4:
    part('stepBar',-.26,y+.24,.16,length*.55,y+.38,.84);
    part('stepBar',length*.45,y+.38,.16,length+.26,y+.51,.84);
    break;
   case 5:
    part('quayReturn',-.26,y+.24,.12,length+.26,y+.32,.26);
    for(const s of [.16,length-.24])
     part('quayTie',s,y+.32,.20,s+.10,y+.47,.82);
    break;
   case 6:
    part('doubleTruss',-.29,y+.27,.12,length+.29,y+.40,.29);
    part('doubleTruss',-.29,y+.27,.71,length+.29,y+.40,.88);
    break;
   case 7:
    part('waterLock',-.28,y+.25,.12,length+.28,y+.35,.27);
    part('waterLock',-.18,y+.35,.73,length+.18,y+.47,.89);
    break;
   case 8:
    for(const t of [.18,.50,.82])part('wingBrace',-.29,y+.22,t-.045,
     length+.29,y+.33,t+.045);
    break;
   default:
    for(let j=0;j<4;j++){
     const s=(j+.35)*length/4;
     part('castleMerlon',s,y+.22,.22,s+.10,y+.46,.78);
    }
  }
  // The eight variants add a TRUE off-centre 3D crest at different places.
  // Its actual AABB is unique even when a map's gate opening has equal width.
  const crestS=.10+(plan.variant+.5)/8*(length-.2);
  part('uniqueCrest',crestS-.085,y+.24,.39,crestS+.085,
   y+.46+(plan.variant%2)*.02,.61);
  for(let k=0;k<plan.variant%3;k++){
   const ss=.14+(k+.5)*Math.max(.24,(length-.3)/3);
   part('uniqueSideSpear',ss-.040,y+.25,.07,ss+.040,y+.39,.21);
  }
  // Reject the WHOLE gate if ANY member would be omitted near an existing
  // raised walkway; otherwise visible beams could appear unsupported.
  if(parts.length<5||parts.some(p=>worldDecorObstructsRoute(...p.box,true)))continue;
  for(const p of parts)add(p.role,p.box,p.group);
  installed.push(c);
  result.gateCount++;
  if(c.high<.15)result.groundGates++;
 }
 // Wall-mounted flank defenders exist even at sites with too many old
 // balconies for a new overhead gate. They NEVER occupy the corridor centre.
 const targets=[[6,0],[-6,0],[0,6],[0,-6],[6,6],[-6,6],[6,-6],[-6,-6]];
 const used=new Set();
 for(let i=0;i<8;i++){
  const [lx,lz]=targets[(i+plan.variant)%8],t=tacticalRotate(lx,lz,plan.orientation);
  let best=null;
  for(let dz=-7;dz<=7;dz++)for(let dx=-7;dx<=7;dx++){
   const X=plan.cx+t.x+dx,Z=plan.cz+t.z+dz,key=Z*mapSize+X;
   if(X<2||Z<2||X>=mapSize-2||Z>=mapSize-2||
      Math.abs(X-plan.cx)>8||Math.abs(Z-plan.cz)>8||
      mapCells[Z]?.[X]!==1||used.has(key))continue;
   const sides=[[1,0],[-1,0],[0,1],[0,-1]].filter(([a,b])=>
     mapCells[Z+b]?.[X+a]===0&&yard.has((Z+b)*mapSize+X+a));
   if(!sides.length)continue;
   const [sideX,sideZ]=sides[0],top=Math.min(roofH-.63,2.50+(i%3)*.18),
    x0=X+.16+Math.min(0,sideX*.28),x1=X+.84+Math.max(0,sideX*.28),
    z0=Z+.16+Math.min(0,sideZ*.28),z1=Z+.84+Math.max(0,sideZ*.28);
   const elements=[
    {role:'defensiveWallRib',box:[x0,0,z0,x1,top,z1]},
    {role:'defensiveWallCap',box:[x0-.035,top-.23,z0-.035,
     x1+.035,top+.08,z1+.035]},
    plan.kind%2===0?
     {role:'wallBladedFin',box:[x0+.16,.51,z0+.14,
      x1-.16,top-.19,z1-.14]}:
     {role:'wallCodedPanel',box:[x0+.13,.85,z0+.16,
      x1-.13,1.15+(i%2)*.12,z1-.16]}
   ];
   // Atomic wall assembly: no detached cap or unsupported blade may survive.
   if(elements.some(p=>p.box[4]>roofH-.19||p.box[4]-p.box[1]<=.025||
     p.box[3]-p.box[0]<=.025||p.box[5]-p.box[2]<=.025||
     worldDecorObstructsRoute(...p.box,true)))continue;
   const distance=dx*dx+dz*dz;
   if(!best||distance<best.distance)best={X,Z,key,elements,distance};
  }
  if(!best)continue;
  used.add(best.key);
  for(const elem of best.elements)add(elem.role,elem.box,3+i);
  result.wallBases++;
 }
 return result;
}
const tacticalSentinelNames=['ДВОЙНЫЕ РОГА','РАЗНОУРОВНЕВЫЙ ТРАВЕРС',
 'СИГНАЛЬНЫЙ ТРЕЗУБЕЦ','СТУПЕНЧАТЫЕ ЛЕЗВИЯ','РАЗДЕЛЁННАЯ КОРОНА',
 'УСИЛИТЕЛЬ ВРАТ','ЗВЁЗДНАЯ РЕШЁТКА','СТРАЖЕВАЯ ГРЕБЁНКА',
 'КАСКАД БРОНЕЩИТОВ','ДВУХОСНЫЙ МАЯК'];
function tacticalSentinelBoxes(level,plan,roofH){
 // V73: every level has its own ACTUAL solid profile, not merely a 2D icon.
 // Ten structural families x ten asymmetric structural variants = 100 sites.
 const family=Math.floor((level-1)/10),variant=(level-1)%10,
  result={parts:[],family,variant,towers:0,groundTowers:0};
 if(!plan)return result;
 const cells=new Set(tacticalCells(plan).map(p=>p.z*mapSize+p.x)),
  targets=[[-6,-6],[6,-6],[-6,6],[6,6],[0,-6],[0,6],[-6,0],[6,0]],
  placed=[],out=result.parts;
 for(let k=0;k<7;k++){
  const target=tacticalRotate(...targets[(k+variant)%targets.length],plan.orientation);
  let best=null;
  for(let oz=-5;oz<=5;oz++)for(let ox=-5;ox<=5;ox++){
   const X=plan.cx+target.x+ox,Z=plan.cz+target.z+oz;
   if(X<2||Z<2||X>=mapSize-2||Z>=mapSize-2||
      Math.abs(X-plan.cx)>8||Math.abs(Z-plan.cz)>8||
      mapCells[Z]?.[X]!==1||
      placed.some(p=>Math.hypot(p.X-X,p.Z-Z)<3.65))continue;
   const dirs=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dz])=>
     mapCells[Z+dz]?.[X+dx]===0&&cells.has((Z+dz)*mapSize+X+dx));
   if(!dirs.length)continue;
   for(const [dx,dz] of dirs){
    const cx=X+.5+dx*.335,cz=Z+.5+dz*.335,
     tangentX=-dz,tangentZ=dx,
     base=2.72+(family%5)*.055+(variant%4)*.027+
       (level%5===0?2.15:roofH>7.5?.36:0),
     top=Math.min(roofH-.89,base+(k%3)*.105),group=k+1,
     parts=[];
    const slab=(role,a0,y0,d0,a1,y1,d1)=>{
     // Only the grounded pier stays almost flush with the old wall. All
     // upper metalwork projects into visible air, but remains above players.
     const advance=role==='sentinelPier'?0:
       role==='individualRivet'?.38:.28;
     const x0=cx+tangentX*a0+dx*(d0+advance),
      z0=cz+tangentZ*a0+dz*(d0+advance),
      x1=cx+tangentX*a1+dx*(d1+advance),
      z1=cz+tangentZ*a1+dz*(d1+advance);
     const box=[Math.min(x0,x1),y0,Math.min(z0,z1),
      Math.max(x0,x1),y1,Math.max(z0,z1)];
     if(box.every(Number.isFinite)&&box[3]-box[0]>.025&&
        box[5]-box[2]>.025&&box[4]-box[1]>.025&&
        box[1]>=0&&box[4]<roofH-.19)parts.push({role,box,group});
    };
    // Every tower has a single continuous old-wall foundation, a crown,
    // two solid upper arms and a 3D marker. No fake collision-only art.
    slab('sentinelPier',-.255,0,-.255,.255,top,.255);
    slab('sentinelCrown',-.36,top-.26,-.36,.36,top+.055,.36);
    slab('sentinelShoulder',-.60,top-.12,-.19,.60,top+.045,.19);
    const reach=.52+(family%3)*.13,hi=top+.115;
    // A continuous metal backbone joins every floating-looking decorative
    // blade to the wall crown. This is drawn AND physically registered.
    slab('sentinelUpperBeam',-reach-.20,top+.015,-.13,
      reach+.20,top+.30,.13);
    switch(family){
     case 0:
      for(const s of [-1,1]){
       slab('hornArm',s*reach-.08,hi,-.20,s*reach+.08,hi+.22,.20);
       slab('hornTip',s*reach-.055,hi+.22,-.15,s*reach+.055,hi+.37,.15);
      }
      break;
     case 1:
      slab('highTraverse',-reach,hi+.06,-.16,reach,hi+.18,.16);
      slab('lowTraverse',-reach*.75,hi-.05,-.22,reach*.75,hi+.01,.22);
      slab('traversePylon',-.10,hi+.18,-.14,.10,hi+.40,.14);
      break;
     case 2:
      for(const s of [-reach,0,reach])
       slab('tridentPike',s-.065,hi,-.18,s+.065,hi+.30,.18);
      slab('tridentBar',-reach-.07,hi+.09,-.07,reach+.07,hi+.16,.07);
      break;
     case 3:
      for(let j=0;j<3;j++){
       const s=(j-1)*reach*.70;
       slab('stepBlade',s-.13,hi+j*.085,-.21,s+.13,hi+.10+j*.085,.21);
      }
      break;
     case 4:
      for(const s of [-1,1]){
       slab('splitRoof',s*reach-.16,hi,-.26,s*reach+.16,hi+.19,.26);
       slab('splitMast',s*reach-.055,hi+.19,-.14,s*reach+.055,hi+.36,.14);
      }
      break;
     case 5:
      for(let j=0;j<3;j++){
       const q=1-j*.23;
       slab('gateAmplifier',-reach*q,hi+j*.085,-.15,
        reach*q,hi+.095+j*.085,.15);
      }
      break;
     case 6:
      slab('starTruss',-reach,hi+.05,-.115,reach,hi+.14,.115);
      slab('starCross',-.10,hi,-.39,.10,hi+.22,.39);
      for(const s of [-1,1])
       slab('starFin',s*.37-.065,hi+.14,-.09,s*.37+.065,hi+.36,.09);
      break;
     case 7:
      for(let j=0;j<5;j++){
       const s=(j-2)*reach*.43;
       slab('combTooth',s-.055,hi,-.18,s+.055,
        hi+.18+(j%2)*.17,.18);
      }
      break;
     case 8:
      for(let j=0;j<3;j++){
       const s=(j-1)*reach*.60;
       slab('cascadingShield',s-.16,hi+j*.085,-.25,s+.16,
        hi+.17+j*.085,.25);
      }
      break;
     default:
      slab('dualBeacon',-reach,hi,-.075,reach,hi+.11,.075);
      slab('dualBeacon',-.075,hi,-.41,.075,hi+.11,.41);
      for(const s of [-reach,reach])
       slab('dualFin',s-.08,hi+.11,-.18,s+.08,hi+.36,.18);
    }
    // A variant changes the tangible placement and size of the individual
    // shield; thus equal families are NOT recoloured duplicates.
    const v=(variant-4.5)*.074;
    slab('individualCrest',v-.09,hi+.13,-.15,v+.09,
     hi+.38+(variant%3)*.025,.15);
    for(let n=0;n<variant%4;n++){
     const s=-.38+n*.24;
     slab('individualRivet',s-.047,hi+.02,-.26,s+.047,
      hi+.11+(n%2)*.045,-.13);
    }
    // Keep a whole silhouette or discard it. A missing collider must never
    // leave a visible floating antenna, and elevated AI routes take priority.
    if(parts.length<5||parts.some(p=>
      worldDecorObstructsRoute(...p.box,true)))continue;
    const ground=Math.max(floorHeightAtCell(X+dx,Z+dz),
      deckAtCell(X+dx,Z+dz))<.15;
    const score=ox*ox+oz*oz+(!ground?32:0)+
      Math.hypot(X-plan.cx,Z-plan.cz)*.015;
    if(!best||score<best.score)
      best={X,Z,score,parts,ground};
   }
  }
  if(!best)continue;
  placed.push(best);
  out.push(...best.parts);
  result.towers++;
  if(best.ground)result.groundTowers++;
 }
 return result;
}
const groundBastionNames=['ГРАНИТНЫЙ САРКОФАГ','ДВОЙНОЙ ЩИТ',
 'КРЕСТОВОЙ БЛОК','ТРЁХСТУПЕНЧАТЫЙ ПАРАПЕТ','СКОШЕННЫЙ ЗАЩИТНИК',
 'ЗУБЧАТЫЙ РЕДУТ','ЧЕТЫРЁХОСНЫЙ ПОСТ','ЛОМАНЫЙ ЧАСТОКОЛ',
 'РАЗДЕЛЁННАЯ ЗМЕЯ','МИНИАТЮРНАЯ ЦИТАДЕЛЬ'];
let lastGroundBastions=null;
function tacticalGroundBastions(level,plan,roofH){
 // V74: genuine knee-/chest-high ground cover. Unlike decorative trim, these
 // are full obstacles: standard bots must walk AROUND the blocked tile.
 const family=(level-1)%10,variant=Math.floor((level-1)/10),
  result={parts:[],sites:[],family,variant};
 if(!plan)return result;
 const cells=tacticalCells(plan),candidates=[];
 for(const {x,z} of cells){
  if(mapCells[z]?.[x]!==0||Math.hypot(x-plan.cx,z-plan.cz)<2.7||
    Math.hypot(x-plan.cx,z-plan.cz)>7.7)continue;
  // The full 3x3 ring is the real detour. Blocking this middle cell cannot
  // sever a previously connected ground corridor; all four neighbours can
  // bypass it through the eight old walkable cells.
  let open=true;
  for(let dz=-1;dz<=1&&open;dz++)for(let dx=-1;dx<=1;dx++){
   if(mapCells[z+dz]?.[x+dx]!==0||
      floorHeightAtCell(x+dx,z+dz)>.15||
      deckAtCell(x+dx,z+dz)>.15){open=false;break;}
  }
  if(!open)continue;
  const ring=[[-1,-1],[0,-1],[1,-1],[1,0],
   [1,1],[0,1],[-1,1],[-1,0]],reachable=[];
  for(let i=0;i<8;i++){
   const [dx,dz]=ring[i],rx=x+dx,rz=z+dz;
   // An old waist-high rail may leave a 26cm bot path open but clip a
   // 34cm player. Inspect INSTALLED solids rather than the 2D map.
   if(worldSolidBodyCollision(rx+.5,rz+.5,.34,0,1.92))continue;
   // Medium/high quality attaches real service cabinets to SOME old walls.
   // Predict those same 3D panels at low quality, so new combat cover sites
   // are stable regardless of each player's graphics setting.
   let panel=false;
   for(const [wx,wz] of [[rx+1,rz],[rx-1,rz],[rx,rz+1],[rx,rz-1]]){
    if(mapCells[wz]?.[wx]!==1||
       (wx*11+wz*19+level*13)%11!==0)continue;
    const front=[[0,1],[0,-1],[-1,0],[1,0]].find(([sx,sz])=>
     mapCells[wz+sz]?.[wx+sx]===0);
    if(front&&front[0]===rx-wx&&front[1]===rz-wz){
     panel=true;break;
    }
   }
   if(!panel)reachable.push(i);
  }
  // The accessible cells around a new blocked centre must form ONE real
  // physical detour. Old attached wall equipment may already block a corner;
  // insisting on all eight corners would discard good yards unnecessarily.
  if(reachable.length<5)continue;
  const allowed=new Set(reachable),seen=new Set([reachable[0]]),queue=[reachable[0]];
  for(let q=0;q<queue.length;q++){
   const i=queue[q];
   for(const j of reachable){
    if(seen.has(j)||Math.abs(ring[i][0]-ring[j][0])+
       Math.abs(ring[i][1]-ring[j][1])!==1)continue;
    const ax=x+ring[i][0]+.5,az=z+ring[i][1]+.5,
     bx=x+ring[j][0]+.5,bz=z+ring[j][1]+.5;
    let clear=true;
    for(const t of [.25,.5,.75]){
     if(worldSolidBodyCollision(ax+(bx-ax)*t,az+(bz-az)*t,.34,0,1.92)){
      clear=false;break;
     }
    }
    if(clear){seen.add(j);queue.push(j);}
   }
  }
  if(seen.size!==allowed.size)continue;
  candidates.push({x,z,detour:reachable.length});
 }
 const targets=[[-5,-5],[5,5],[5,-5],[-5,5],[0,-5],[5,0],[0,5],[-5,0]];
 for(let slot=0;slot<8&&result.sites.length<4;slot++){
  const t=tacticalRotate(...targets[(slot+variant)%8],plan.orientation);
  let best=null;
  for(const c of candidates){
   if(result.sites.some(p=>Math.hypot(p.x-c.x,p.z-c.z)<3.40))continue;
   const {x,z}=c,orientation=(level+slot+plan.orientation)%4,
    dirX=orientation%2===0?1:0,dirZ=orientation%2===1?1:0,
    cx=x+.5,cz=z+.5,group=slot+1,parts=[];
   const slab=(role,u0,y0,v0,u1,y1,v1)=>{
    const x0=cx+dirX*u0+dirZ*v0,z0=cz+dirZ*u0+dirX*v0,
     x1=cx+dirX*u1+dirZ*v1,z1=cz+dirZ*u1+dirX*v1;
    const box=[Math.min(x0,x1),y0,Math.min(z0,z1),
     Math.max(x0,x1),y1,Math.max(z0,z1)];
    if(box.every(Number.isFinite)&&box[3]-box[0]>.025&&
       box[5]-box[2]>.025&&box[4]-box[1]>.025&&
       box[1]>=0&&box[4]<roofH-.19)parts.push({role,box,group});
   };
   const main=.76+(family%3)*.055+(variant%4)*.018,
    upper=main+.14,span=.23+(variant%3)*.025;
   slab('bastionHull',-.33,0,-.32,.33,main,.32);
   slab('bastionCrown',-.39,main-.11,-.37,.39,upper,.37);
   // Ten genuine 3D defensive silhouettes, never just different textures.
   switch(family){
    case 0:
     for(const q of [-1,1])
      slab('stoneEnd',q*.25-.085,upper-.06,-.27,q*.25+.085,upper+.35,.27);
     break;
    case 1:
     for(const q of [-1,1])
      slab('doubleShield',q*.21-.105,upper-.06,-.32,
       q*.21+.105,upper+.36,.32);
     break;
    case 2:
     slab('crossBlade',-.37,upper-.04,-.10,.37,upper+.24,.10);
     slab('crossBlade',-.10,upper-.04,-.40,.10,upper+.24,.40);
     break;
    case 3:
     for(let j=0;j<3;j++)
      slab('stepRamp',-.31+j*.065,upper-.06+j*.08,-.34,
       .31-j*.065,upper+.07+j*.08,.34);
     break;
    case 4:
     for(const q of [-1,1])
      slab('offsetShield',q*.16-.16,upper-.05+(q===1?.03:0),-.30,
       q*.16+.16,upper+.25+(q===1?.12:0),.30);
     break;
    case 5:
     for(let j=0;j<4;j++){
      const u=(j-1.5)*.19;
      slab('sawTooth',u-.065,upper-.04,-.23,u+.065,
       upper+.25+(j%2)*.13,.23);
     }
     break;
    case 6:
     for(const q of [-1,1]){
      slab('fourAxis',q*.22-.07,upper-.06,-.30,
       q*.22+.07,upper+.29,.30);
      slab('fourAxis',-.30,upper-.06,q*.22-.07,
       .30,upper+.29,q*.22+.07);
     }
     break;
    case 7:
     for(let j=0;j<4;j++){
      const u=(j-1.5)*.19;
      slab('stockade',u-.07,upper-.055,-.28,
       u+.07,upper+.22+j*.06,.28);
     }
     break;
    case 8:
     slab('splitSnake',-.36,upper-.05,-.29,-.01,upper+.24,.02);
     slab('splitSnake',.01,upper-.05,-.02,.36,upper+.36,.29);
     break;
    default:
     for(const [u,v] of [[-.24,-.24],[.24,-.24],[-.24,.24],[.24,.24]])
      slab('miniTurret',u-.075,upper-.05,v-.075,u+.075,
       upper+.31,v+.075);
   }
   // Every variant moves a SOLID, thick front armor panel and its braces.
   const offset=(variant-4.5)*.045;
   slab('individualArmor',offset-span,main*.42,-.365,
    offset+span,main*.86+(variant%2)*.045,-.275);
   for(let j=0;j<variant%4;j++){
    const u=(j-1.5)*.14;
    slab('individualAnchor',u-.065,main*.62,-.365,
     u+.065,main*.94,-.25);
   }
   // Atomic build; the supported section may not lose an independent part.
   if(parts.length<4||parts.some(p=>
       worldDecorObstructsRoute(...p.box,true)))continue;
   const score=Math.hypot(c.x-(plan.cx+t.x),c.z-(plan.cz+t.z))+
    (8-c.detour)*.25+
    Math.abs(Math.hypot(c.x-plan.cx,c.z-plan.cz)-5)*.12;
   if(!best||score<best.score||
       (Math.abs(score-best.score)<1e-8&&(c.z<best.z||
        c.z===best.z&&c.x<best.x)))best={x,z,score,parts};
  }
  if(!best)continue;
  result.sites.push({x:best.x,z:best.z});
  result.parts.push(...best.parts);
 }
 return result;
}
// V75: monumental but genuinely SOLID suspended military cantilevers.
// They extend the existing Stage73 wall sentinel piers rather than placing
// new floor-standing pillars across the Stage65/66 ground/raised routes.
// Ten engineering structures x ten geometric signatures = 100 real forms.
const tacticalOverhangNames=['ДВОЙНОЙ КРАНОВЫЙ РОГ','ЛЕСТНИЦА НЕБЕСНЫХ БАЛОК',
 'ТРОЙНАЯ ПЕРЕКРЁСТНАЯ РЕШЁТКА','ДВА РАСХОДЯЩИХСЯ ЛОНЖЕРОНА',
 'РАЗДЕЛЁННЫЙ ЩИТОВОЙ НАВЕС','ПЯТИЗУБЫЙ ГРЕБЕНЧАТЫЙ КРАН',
 'ЧЕТЫРЁХЛУЧЕВОЙ ПЕРЕХВАТЧИК','КАСКАДНЫЙ ПРОТИВОРАКЕТНЫЙ БРУСТВЕР',
 'ДВОЙНАЯ СИГНАЛЬНАЯ КОРОНА','ТЕХНОЛОГИЧЕСКИЙ ПРИЧАЛ'];
let lastTacticalOverhangs=null;
function tacticalOverhangBoxes(level,plan,roofH){
 const family=(level-1)%10,variant=Math.floor((level-1)/10),
  result={parts:[],sites:[],family,variant};
 if(!plan)return result;
 const originals=tacticalSentinelBoxes(level,plan,roofH),
  towers=originals.parts.filter(p=>p.role==='sentinelPier'),
  selected=[],maxGroups=4;
 // The shortest roof is 4.25m. Even there the bottom of every projected
 // horizontal beam is >=3.58m: a 1.32m lookout retains 2.26m headroom.
 const y=roofH<=4.3?3.72:roofH<=8?roofH-.60:
   Math.min(roofH-.65,8.8),span=2.90+(variant%5)*.115,
  width=1.10+(variant%4)*.09;
 // Rotate anchor preference so long-range layouts do not all read the same.
 const ordered=[...towers].sort((a,b)=>{
  const A=a.box,B=b.box,
   ax=(A[0]+A[3])/2,az=(A[2]+A[5])/2,
   bx=(B[0]+B[3])/2,bz=(B[2]+B[5])/2;
  const aim=tacticalRotate(...[[0,-6],[6,0],[0,6],[-6,0]]
    [(level+variant)%4],plan.orientation);
  return Math.hypot(ax-plan.cx-aim.x,az-plan.cz-aim.z)-
    Math.hypot(bx-plan.cx-aim.x,bz-plan.cz-aim.z);
 });
 for(const old of ordered){
  if(result.sites.length>=maxGroups)break;
  const oldB=old.box,px=(oldB[0]+oldB[3])/2,
   pz=(oldB[2]+oldB[5])/2,
   X=Math.floor(px),Z=Math.floor(pz),
   dx=Math.abs(px-X-.5)>.20?Math.sign(px-X-.5):0,
   dz=dx===0?Math.sign(pz-Z-.5):0;
  if(dx===0&&dz===0||selected.some(p=>
   Math.hypot(p.x-px,p.z-pz)<3.5))continue;
  const tx=-dz,tz=dx,group=old.group,parts=[];
  const slab=(role,u0,y0,v0,u1,y1,v1)=>{
   const a=px+tx*u0+dx*v0,b=pz+tz*u0+dz*v0,
    c=px+tx*u1+dx*v1,d=pz+tz*u1+dz*v1,
    box=[Math.min(a,c),y0,Math.min(b,d),
     Math.max(a,c),y1,Math.max(b,d)];
   if(box.every(Number.isFinite)&&box[3]-box[0]>.025&&
    box[5]-box[2]>.025&&box[4]-box[1]>.025&&
    box[1]>=0&&box[4]<roofH-.19)parts.push({role,box,group});
  };
  const bar=(role,u0,v0,u1,v1,low=y-.045,top=y+.135)=>
   slab(role,u0,low,v0,u1,top,v1);
  // The mast starts INSIDE the original physical sentinel pier and is
  // continued up to the identical registered cross-sectional collar.
  slab('overhangMast',-.205,Math.max(0,oldB[4]-.24),-.205,
    .205,y+.11,.205);
  slab('overhangCollar',-.32,y-.15,-.32,.32,y+.12,.32);
  bar('overhangSpine',-.17,-.12,.17,span+.09,y-.09,y+.14);
  bar('overhangCrossbar',-width,span-.72,width,span-.42,y-.07,y+.15);
  switch(family){
   case 0: // Four twin horns reaching forward from the terminal crossbar.
    for(const side of [-1,1]){
     bar('hornRail',side*.70-.085,1.25,side*.70+.085,span+.13);
     bar('hornHead',side*.70-.19,span+.04,side*.70+.19,span+.25);
    }
    break;
   case 1: // Broad rhythmic ladder, every rung crosses the true main spine.
    for(const v of [.8,1.43,2.06,span-.28])
     bar('ladderRung',-width*.90,v-.12,width*.90,v+.12);
    break;
   case 2:
    for(const v of [1.0,1.95,span-.2])
     bar('latticeBridge',-width*.87,v-.125,width*.87,v+.125);
    for(const s of [-1,1])
     bar('latticeRail',s*.55-.08,1.0,s*.55+.08,span-.12);
    break;
   case 3:
    for(const s of [-1,1]){
     bar('outrigger',s*.66-.08,1.46,s*.66+.08,span-.37);
     bar('outriggerFoot',Math.min(0,s*.66)-.075,1.43,
      Math.max(0,s*.66)+.075,1.64);
    }
    break;
   case 4:
    for(const s of [-1,1]){
     bar('shieldPanel',s*.30-.36,span-.78,s*.30+.36,span-.28,
      y-.07,y+.17);
     bar('shieldTip',s*.32-.21,span-.35,s*.32+.21,span+.20);
    }
    break;
   case 5:
    for(let i=0;i<5;i++){
     const u=(i-2)*width*.36;
     bar('combTooth',u-.066,span-.68,u+.066,
      span+.06+(i%2)*.17,y-.045,y+.15);
    }
    break;
   case 6:
    for(const s of [-1,1]){
     bar('interceptArm',Math.min(0,s*width*.90)-.06,1.68,
      Math.max(0,s*width*.90)+.06,1.86);
     bar('interceptNose',s*.83-.10,1.78,s*.83+.10,span-.34);
    }
    break;
   case 7:
    for(let i=0;i<4;i++){
     const v=1.05+i*.52;
     bar('cascadeShield',-width*(1-i*.10),v-.09,
      width*(1-i*.10),v+.13,y-.045,y+.15);
    }
    break;
   case 8:
    bar('signalCross',-width*.95,1.28,width*.95,1.53);
    bar('signalCross',-width*.75,2.24,width*.75,2.46);
    for(const s of [-1,1])
     bar('signalRail',s*.58-.07,1.38,s*.58+.07,span-.40);
    break;
   default:
    for(const v of [.92,1.56,2.24,span-.27])
     bar('dockRung',-width*.83,v-.105,width*.83,v+.105);
    for(const s of [-1,1])
     bar('dockRail',s*.77-.08,.92,s*.77+.08,span-.27);
  }
  // Individual variant is a separate REAL upper armour strip, anchored
  // directly on the load-bearing spine, with variant-dependent dimensions.
  const u=(variant-4.5)*.021;
  bar('individualBadge',u-.062,span-.38,u+.062,
   span-.05,y+.08,y+.25+(variant%3)*.008);
  for(let i=0;i<variant%4;i++){
   const v=.83+i*.45;
   bar('individualBrace',-.30,v-.075,.30,v+.075,y-.04,y+.15);
  }
  // No post hoc carving: if ANY component endangers a pre-existing walkable
  // or 1.32m-high route, the entire visible-and-physical assembly is omitted.
  if(parts.length<5||parts.some(p=>
    worldDecorObstructsRoute(...p.box,true)))continue;
  selected.push({x:px,z:pz});
  result.sites.push({x:px,z:pz,X,Z,dx,dz,group,originalPier:oldB});
  result.parts.push(...parts);
 }
 return result;
}
// V76: every existing V74 ground bastion now carries a GENUINELY SOLID
// shoulder-height firing emplacement. Unlike a painted slot, the two side
// shields and the lintel are separate physical boxes; the central loophole
// contains NO collider and admits an actual hitscan and spherical projectile.
// The footprint remains inside the already-blocked bastion tile, so neither
// ground robot detours nor the player's neighbouring walking cells change.
const bastionWatchNames=['ДВОЙНОЙ РОГ ЧАСОВОГО','СТУПЕНЧАТАЯ БРОНЯ',
 'КРЕСТОВАЯ АНТЕННА','ЗУБЧАТЫЙ ГРЕБЕНЬ','РАЗДВОЕННЫЙ КОЗЫРЁК',
 'ШЕСТЕРЁННАЯ КОРОНА','ЧЕТЫРЕ СТОРОЖЕВЫЕ МАЧТЫ',
 'АСИММЕТРИЧНЫЕ КРЫЛЬЯ','КАСКАД НАКЛАДОК','ДВОЙНОЙ ТРАВЕРС'];
let lastBastionWatchposts=null;
function tacticalBastionWatchposts(level,bastions,roofH){
 const family=Math.floor((level-1)/10),variant=(level-1)%10,
  result={parts:[],sites:[],family,variant};
 if(!bastions?.sites?.length)return result;
 const hulls=bastions.parts.filter(p=>p.role==='bastionHull');
 for(const site of bastions.sites){
  const cx=site.x+.5,cz=site.z+.5,
   hull=hulls.find(p=>Math.abs((p.box[0]+p.box[3])/2-cx)<.03&&
     Math.abs((p.box[2]+p.box[5])/2-cz)<.03);
  if(!hull)continue;
  const group=hull.group,orientation=(level+site.x*3+site.z*5)%4,
   parts=[];
  const slab=(role,u0,y0,v0,u1,y1,v1)=>{
   const corners=[tacticalRotate(u0,v0,orientation),
    tacticalRotate(u0,v1,orientation),
    tacticalRotate(u1,v0,orientation),
    tacticalRotate(u1,v1,orientation)];
   const box=[cx+Math.min(...corners.map(p=>p.x)),y0,
    cz+Math.min(...corners.map(p=>p.z)),
    cx+Math.max(...corners.map(p=>p.x)),y1,
    cz+Math.max(...corners.map(p=>p.z))];
   if(box.every(Number.isFinite)&&box[3]-box[0]>.025&&
    box[5]-box[2]>.025&&box[4]-box[1]>.025&&
    box[1]>=0&&box[4]<roofH-.19)
     parts.push({role,box,group});
  };
  // A real continuous load path: old solid hull -> two tall solid pillars
  // -> head lintel -> ten families of solid connected armour details.
  // The open gun slit is |u|<.20 at 1.60-1.86 m, even for variant 9.
  slab('watchLeftPillar',-.43,.62,-.35,-.22,1.99,.35);
  slab('watchRightPillar',.22,.62,-.35,.43,1.99,.35);
  slab('watchFrontLowerArmor',-.41,.70,-.36,.41,1.27,-.27);
  slab('watchRearFootRail',-.40,.69,.27,.40,1.18,.36);
  slab('watchSolidLintel',-.43,1.93,-.36,.43,2.14,.36);
  switch(family){
   case 0: // Twin real full-depth horns.
    for(const s of [-1,1]){
     slab('watchHorn',s*.30-.08,2.10,-.30,s*.30+.08,2.52,.30);
     slab('watchHornEnd',s*.30-.13,2.45,-.20,
      s*.30+.13,2.57,.20);
    }
    break;
   case 1: // Offset stacked armour, no false sloping surfaces.
    for(let j=0;j<3;j++)
     slab('watchStep',-.41+j*.075,2.10+j*.10,-.30,
      .41-j*.075,2.26+j*.10,.30);
    break;
   case 2:
    slab('watchCrossX',-.42,2.11,-.12,.42,2.25,.12);
    slab('watchCrossZ',-.10,2.11,-.38,.10,2.39,.38);
    slab('watchAntenna',-.07,2.34,-.12,.07,2.57,.12);
    break;
   case 3:
    for(let j=0;j<5;j++){
     const u=(j-2)*.165;
     slab('watchTooth',u-.065,2.10,-.27,u+.065,
      2.38+(j%2)*.10,.27);
    }
    break;
   case 4:
    for(const s of [-1,1]){
     slab('watchSplitCanopy',s*.21-.20,2.10,-.37,
      s*.21+.20,2.28,.37);
     slab('watchSplitTip',s*.32-.075,2.24,-.27,
      s*.32+.075,2.49,.27);
    }
    break;
   case 5:
    for(let j=0;j<4;j++){
     const u=(j-1.5)*.20;
     slab('watchGearTooth',u-.07,2.10,-.34,u+.07,
      2.39+(j%2)*.07,.34);
    }
    slab('watchGearBar',-.42,2.25,-.16,.42,2.34,.16);
    break;
   case 6:
    for(const u of [-.31,.31])for(const v of [-.26,.26])
     slab('watchQuarterMast',u-.07,2.10,v-.07,
      u+.07,2.48,v+.07);
    break;
   case 7:
    slab('watchLeftWing',-.42,2.10,-.38,-.12,2.41,.26);
    slab('watchRightWing',.13,2.10,-.22,.43,2.57,.38);
    break;
   case 8:
    for(let j=0;j<3;j++)
     slab('watchCascadingArmor',-.43+j*.055,2.10+j*.09,-.37,
      .43-j*.055,2.22+j*.09,.37);
    break;
   default:
    for(const v of [-.26,.26])
     slab('watchTraverse',-.42,2.10,v-.085,.42,2.29,v+.085);
    for(const u of [-.32,.32])
     slab('watchTraverseFin',u-.075,2.24,-.36,
      u+.075,2.48,.36);
  }
  // Every variant changes tangible 3D geometry, not just its colour.
  const offset=(variant-4.5)*.043;
  slab('watchIndividualCrest',offset-.075,2.10,-.18,
   offset+.075,2.29+(variant%3)*.025,.18);
  for(let j=0;j<variant%4;j++){
   const v=-.25+j*.16;
   slab('watchIndividualStud',-.35,2.11,v-.047,
    -.23,2.23+(j%2)*.035,v+.047);
  }
  // All pieces are placed atomically. A rejected volume cannot become a
  // drawn-only ornament, and no old elevated passage may lose clearance.
  if(parts.length<7||parts.some(p=>
    worldDecorObstructsRoute(...p.box,true)))continue;
  result.sites.push({x:site.x,z:site.z,group,hull:hull.box,orientation});
  result.parts.push(...parts);
 }
 return result;
}
// Stage106: the terrain heightfield is a SOLID stair volume from y=0 to
// the tread, not a floating shell. A clipped/close camera may see its inner
// bottom if a riser ends at the neighbouring tread. Emit an opaque full-height
// side skin, buried inside the neighbouring solid below its top. The skin
// creates no new collision object; rayWall already treats this exact terrain
// column as a continuous solid volume from the foundation up.
function drawSolidStairRisers(v,x,z,top,n,s,e,w,steel){
 if(!(top>0))return;
 if(n<top-.01)quad(v,[x,top,z],[x+1,top,z],[x+1,0,z],[x,0,z],[0,0,-1],steel);
 if(s<top-.01)quad(v,[x+1,top,z+1],[x,top,z+1],[x,0,z+1],[x+1,0,z+1],[0,0,1],steel);
 if(e<top-.01)quad(v,[x+1,top,z],[x+1,top,z+1],[x+1,0,z+1],[x+1,0,z],[1,0,0],steel);
 if(w<top-.01)quad(v,[x,top,z+1],[x,top,z],[x,0,z],[x,0,z+1],[-1,0,0],steel);
}
function createWorldMesh(level){
  worldDecorClearance=false;
  resetWorldSolids();
  if(!glReady)return;
  let t=themes[sectorStyle%themes.length],v=[],size=mapSize;
  if(worldMesh){gl.deleteBuffer(worldMesh.b);worldMesh=null;}for(const c of worldChunks)gl.deleteBuffer(c.mesh.b);worldChunks=[];meshStats={chunks:0,triangles:0};
  const detail=save.settings.quality!==0, roofH=ceilingHeight();
  const tacticalTiles=typeof tacticalZone!=='undefined'&&tacticalZone&&
    typeof tacticalCells==='function'?
    new Set(tacticalCells(tacticalZone).map(p=>p.z*size+p.x)):null;
  const riseCovers=new Map();
  for(const part of tacticalRiseEdgeCover(
    typeof tacticalRisePlan==='undefined'?null:tacticalRisePlan,level)){
    const key=part.z*size+part.x;
    if(!riseCovers.has(key))riseCovers.set(key,[]);
    riseCovers.get(key).push(part.box);
  }
  const metal=rcolor(t.wall,.49),trim=rcolor(t.wall,1.48),dim=rcolor(t.accent,.46),bright=rcolor(t.accent,.93);
  const midlevelCoverByCell=new Map();
  const midlevelShelterByCell=new Map();
  const midlevelParapetByCell=new Map();
  const midlevelGateByCell=new Map();
  const midlevelRoofDeckCellsSet=new Set();
  const landmarkTiles=new Set();
  for(const site of landmarkSpecs)for(const p of landmarkCells(site))
    landmarkTiles.add(p.z*size+p.x);
  for(const terrace of (typeof midlevelSpecs==='undefined'?[]:midlevelSpecs))
   for(const obstacle of midlevelCoverBoxes(terrace)){
    const x=Math.floor(obstacle[0]),z=Math.floor(obstacle[2]),key=z*size+x;
    if(!midlevelCoverByCell.has(key))midlevelCoverByCell.set(key,[]);
    midlevelCoverByCell.get(key).push(obstacle);
  }
  for(const terrace of (typeof midlevelSpecs==='undefined'?[]:midlevelSpecs)){
    const entrance=terrace.axis==='x'?
      {x:terrace.cx,z:terrace.cz+2*terrace.wing}:
      {x:terrace.cx+2*terrace.wing,z:terrace.cz};
    midlevelGateByCell.set(entrance.z*size+entrance.x,
      midlevelGuardGateBoxes(terrace));
    const x=terrace.axis==='x'?terrace.cx:terrace.cx+3*terrace.wing;
    const z=terrace.axis==='x'?terrace.cz+3*terrace.wing:terrace.cz;
    midlevelShelterByCell.set(z*size+x,midlevelShelterBoxes(terrace));
    midlevelParapetByCell.set(z*size+x,midlevelRoofParapetBoxes(terrace));
    for(const tile of midlevelRoofDeckCells(terrace))
      midlevelRoofDeckCellsSet.add(tile.z*size+tile.x);
  }
  // The old suspended room decorations were authored for flat arenas.
  // Under a shaped upper walkway they become low, solid fake floors at
  // ~3.3m that can catch a jumping player inside an otherwise OPEN lightwell.
  const nearUpperFeature=(x,z)=>
   typeof skyFeatureSpecs!=='undefined'&&skyFeatureSpecs.some(f=>
    Math.abs(x-(f.cx+.5))<8&&Math.abs(z-(f.cz+.5))<8)||
   typeof midlevelSpecs!=='undefined'&&midlevelSpecs.some(f=>
    Math.abs(x-(f.cx+.5))<7&&Math.abs(z-(f.cz+.5))<7)||
   landmarkSpecs.some(s=>Math.abs(x-(s.cx+.5))<15&&
    Math.abs(z-(s.cz+.5))<12);
  for(let z0=1;z0<size-1;z0+=9)for(let x0=1;x0<size-1;x0+=9){
  let v=[];
  for(let z=z0;z<Math.min(z0+9,size-1);z++)for(let x=x0;x<Math.min(x0+9,size-1);x++){
    let open=mapCells[z][x]===0;
    if(open){
      let seed=(x*31+z*17+level*7),base=rcolor(t.floor,.72+(seed%9)*.035);
      if(tacticalTiles?.has(z*size+x))base=rcolor(t.accent,.18+(seed%7)*.022);
      quad(v,[x,0,z+1],[x+1,0,z+1],[x+1,0,z],[x,0,z],[0,1,0],base);
      // Actual elevated stairs: opaque tread planes, vertical risers and
      // metal nosing, matching exactly the physics height map.
      const stepY=floorHeightAtCell(x,z);
      if(stepY>.001){
        const tread=rcolor(t.floor,.88+(seed%5)*.045);
        const riser=rcolor(t.wall,.42);
        const accent=rcolor(t.accent,.56);
        quad(v,[x,stepY,z+1],[x+1,stepY,z+1],[x+1,stepY,z],[x,stepY,z],[0,1,0],tread);
        const n=floorHeightAtCell(x,z-1),s=floorHeightAtCell(x,z+1),e=floorHeightAtCell(x+1,z),w=floorHeightAtCell(x-1,z);
        // Visible risers seal the complete solid stair volume, including at
        // close eye positions. No cosmetic open cavity beneath a solid tile.
        drawSolidStairRisers(v,x,z,stepY,n,s,e,w,riser);
        // Brushed anti-slip treads are paint-thin walkable surface details.
        // Keep them visible, but never register them as collision boxes:
        // a player approaches a riser with feet on the LOWER tread, so the
        // old raised solid strip snagged the body's leading edge before the
        // centre could reach the next floor-height cell.
        if(detail&&(n<stepY-.01||s<stepY-.01)){
          box(v,x+.12,stepY+.003,z+.10,x+.88,stepY+.013,z+.13,accent,.30,[0,0,0,0,1,0]);
          for(let k=0;k<3;k++)box(v,x+.25+k*.17,stepY+.004,z+.3,x+.28+k*.17,stepY+.012,z+.72,rcolor(t.wall,1.30),0,[0,0,0,0,1,0]);
        }
        if(detail&&e<stepY-.01)box(v,x+.86,stepY+.003,z+.14,x+.90,stepY+.014,z+.86,accent,.28,[0,0,0,0,1,0]);
      }
      // Physically solid waist-height cover on selected lookout edges.
      // A metre-tall cover block in the walkway centre would sabotage Z
      // movement; these narrow OUTER edges preserve every ascent.
      for(const cover of riseCovers.get(z*size+x)||[])
        worldSolidBox(v,...cover,rcolor(t.wall,.96),0);
      // Stage54: actual .76/.86m-high steel barricades on the NEW half-height
      // terraces. Draw AND register the SAME three-dimensional boxes; bullets,
      // blast occlusion, rockets, player bodies and robots all hit them.
      for(const cover of midlevelCoverByCell.get(z*size+x)||[]){
        worldSolidBox(v,...cover,rcolor(t.wall,.83),0);
        if(detail)box(v,cover[0]+.025,cover[4]+.002,cover[2]+.025,
          cover[3]-.025,cover[4]+.009,cover[5]-.025,rcolor(t.accent,1.18),.38,[0,0,0,0,1,0]);
      }
      // Stage55: enclosed room with a real door, roof, solid knee-height
      // window sills and upper wall headers. NO collision-only proxy:
      // all nine components are drawn and spatially registered identically.
      for(const part of midlevelShelterByCell.get(z*size+x)||[]){
        const roof=part.role==='roof',frame=part.role.startsWith('door');
        worldSolidBox(v,...part.box,roof?rcolor(t.wall,.44):
          frame?rcolor(t.wall,1.27):rcolor(t.wall,.72),0);
        if(detail&&roof)box(v,part.box[0]+.04,part.box[4]+.002,part.box[2]+.04,
          part.box[3]-.04,part.box[4]+.009,part.box[5]-.04,rcolor(t.accent,.88),.22,[0,0,0,0,1,0]);
      }
      // Stage58: battlements are physical cover, not 2D roof ornaments.
      // Every solid uses precisely the volume that the bullets, rockets and
      // moving character bodies query, at BOTH WebGL quality settings.
      for(const part of midlevelParapetByCell.get(z*size+x)||[]){
        const centre=part.role==='frontCentre',side=part.role.startsWith('side');
        worldSolidBox(v,...part.box,centre?rcolor(t.accent,.68):
          side?rcolor(t.wall,1.30):rcolor(t.wall,.91),0);
      }
      // Stage59: the gate's columns and high lintel are the exact SAME
      // 3D volumes for visible surfaces, body collision and both projectile
      // engines. Its clear centre is a genuinely traversable/shot-through gap.
      for(const part of midlevelGateByCell.get(z*size+x)||[]){
        const pier=part.role!=='lintel';
        worldSolidBox(v,...part.box,pier?rcolor(t.wall,1.27):
          rcolor(t.accent,.72),0);
      }
      // HIGH DECK: real suspended bridge, with underside, braces and railings.
      // Unlike a raised height-map tile this leaves a walkable lower passage.
      const deckY=deckAtCell(x,z);
      // The guardhouse roof IS the deck: its exact 16cm-thick worldSolidBox
      // above is both drawn and collidable. Do not draw a duplicate generic
      // balcony plate/rails at the same coordinates for its nav-height cells.
      if(deckY>0&&!midlevelRoofDeckCellsSet.has(z*size+x)){
        const plate=rcolor(t.floor,.69),frame=rcolor(t.wall,1.35),rail=rcolor(t.wall,1.55),a=rcolor(t.accent,.62);
        worldSolidBox(v,x,deckY-.17,z,x+1,deckY,z+1,plate,0);
        if(detail){
          worldSolidBox(v,x+.06,deckY+.008,z+.09,x+.94,deckY+.019,z+.13,a,.47,[0,0,0,0,1,0]);
          for(let k=0;k<4;k++){let zz=z+.2+k*.19;worldSolidBox(v,x+.12,deckY+.010,zz,x+.88,deckY+.017,zz+.025,frame,0,[0,0,0,0,1,0]);}
        }
        for(const side of [-1,1]){
          const zz=side<0?z:z+1;
          // Leave a real opening where a Z-oriented staircase meets the
          // landing. The old unconditional north/south rail blocked walkers
          // on new alternate approaches even though X stairs were open.
          if(deckAtCell(x,z+side)===0&&floorHeightAtCell(x,z+side)<deckY-.30){
            worldSolidBox(v,x,deckY-.20,zz-.04,x+1,deckY+.015,zz+.04,frame,0);
            // A safety rail must exist at EVERY quality setting: otherwise
            // low graphics settings alter collision and leave upper decks open.
            worldSolidBox(v,x+.08,deckY+.64,zz-.028,x+.92,deckY+.70,zz+.028,rail,0);
            if(detail){
              worldSolidBox(v,x+.08,deckY+.28,zz-.024,x+.92,deckY+.33,zz+.024,rail,0);
              if(x%2===0)worldSolidBox(v,x+.10,deckY+.02,zz-.032,x+.15,deckY+.74,zz+.032,rail,0);
            }
          }
        }
        // Edge protection also runs along X-facing balcony edges. The edge
        // touching a real stair landing has no rail, so walking up never
        // requires jumping. Other edges are low enough to vault over.
        if([2,4,6,9].includes(sectorStyle)){
          for(const side of [-1,1]){
            if(deckAtCell(x+side,z)>0||floorHeightAtCell(x+side,z)>=deckY-.30)continue;
            const xx=side<0?x:x+1;
            worldSolidBox(v,xx-.04,deckY-.20,z,xx+.04,deckY+.015,z+1,frame,0);
            worldSolidBox(v,xx-.028,deckY+.64,z+.08,xx+.028,deckY+.70,z+.92,rail,0);
            if(detail){
              worldSolidBox(v,xx-.024,deckY+.28,z+.08,xx+.024,deckY+.33,z+.92,rail,0);
              if(z%2===0)worldSolidBox(v,xx-.03,deckY+.02,z+.1,xx+.03,deckY+.74,z+.16,rail,0);
            }
          }
        }
        // Structural supports stay at the outer edges of the underpass.
        if((x%4===0)&&((z+1)%4===0)&&deckAtCell(x,z-1)===0){
          worldSolidBox(v,x+.04,0,z+.08,x+.20,deckY-.17,z+.26,frame,0);
          if(detail)worldSolidBox(v,x+.02,.20,z+.065,x+.23,.27,z+.28,a,.21);
        }
      }
      if((x+z+level*3)%11===0){
        worldSolidBox(v,x+.035,.006,z+.05,x+.055,.012,z+.95,dim,.28,[0,0,0,0,1,0]);
        worldSolidBox(v,x+.05,.006,z+.035,x+.95,.012,z+.055,dim,.28,[0,0,0,0,1,0]);
      }
      if(detail&&seed%11===0)buildFloorDecal(v,x,z,t,seed);
      // VANGUARD SET DRESSING: physically modeled infrastructure in static
      // chunks. Ceiling-mounted hardware stays out of the navigation grid.
      if(!landmarkTiles.has(z*size+x)&&detail && sectorStyle<14 && ![2,4,6,9].includes(sectorStyle) && (!touchOnly||save.settings.quality===2||seed%3===0) && (seed%41===9 || seed%53===11)){
        const alloy=rcolor(t.wall,.58),sil=[.055,.067,.073],chrome=rcolor(t.wall,1.42);
        const warm=[.95,.61,.22],light=rcolor(t.accent,1.3);
        const cX=x+.5,cZ=z+.5;
        // Suspended power service cassette with four brackets and vents.
        worldSolidBox(v,x+.16,3.64,z+.18,x+.84,3.85,z+.82,alloy,0);
        worldSolidBox(v,x+.22,3.61,z+.25,x+.78,3.64,z+.75,sil,0);
        for(let a=0;a<6;a++)worldSolidBox(v,x+.26+a*.075,3.598,z+.29,x+.29+a*.075,3.605,z+.72,chrome,0,[0,0,0,0,1,0]);
        for(const ix of [x+.23,x+.77])for(const iz of [z+.26,z+.74])worldSolidBox(v,ix-.028,3.76,iz-.028,ix+.028,4.2,iz+.028,chrome,0);
        worldSolidBox(v,x+.38,3.586,z+.38,x+.62,3.598,z+.62,light,1.15,[0,0,0,0,1,0]);
        if((seed%3)===0){
          for(const iz of [z+.22,z+.77])worldSolidBox(v,x+.14,3.51,iz-.021,x+.86,3.57,iz+.021,chrome,0);
        }
      }
      if(!landmarkTiles.has(z*size+x)&&detail && sectorStyle<14 && ![2,4,6,9].includes(sectorStyle) && (!touchOnly||save.settings.quality===2||seed%3===0) && seed%59===13){
        // Overhead cable bridge and hanging structural lock brackets.
        const dark=rcolor(t.wall,.36),pale=rcolor(t.wall,1.52),alert=[.61,.32,.11];
        worldSolidBox(v,x+.02,3.39,z+.10,x+.98,3.48,z+.18,dark,0);
        worldSolidBox(v,x+.02,3.39,z+.82,x+.98,3.48,z+.90,dark,0);
        for(let j=0;j<4;j++){
          const xx=x+.12+j*.23;
          worldSolidBox(v,xx,3.37,z+.12,xx+.075,3.42,z+.88,pale,0);
          worldSolidBox(v,xx+.014,3.422,z+.22,xx+.059,3.435,z+.78,j===0?alert:dark,0);
        }
        for(const iz of [z+.14,z+.86])for(const ix of [x+.06,x+.93])worldSolidBox(v,ix-.02,3.44,iz-.018,ix+.02,4.21,iz+.018,pale,0);
      }
      if(detail && (!touchOnly||save.settings.quality===2||seed%3===0) && seed%73===7){
        // Removable floor engineering plate with bolted corners and steel seam.
        const base=rcolor(t.floor,.47),edge=rcolor(t.wall,1.75),rubber=[.048,.06,.073];
        worldSolidBox(v,x+.11,.018,z+.12,x+.89,.038,z+.88,edge,0,[0,0,0,0,1,0]);
        worldSolidBox(v,x+.14,.040,z+.15,x+.86,.047,z+.85,base,0,[0,0,0,0,1,0]);
        for(const ix of [x+.18,x+.82])for(const iz of [z+.19,z+.81])worldSolidBox(v,ix-.024,.049,iz-.024,ix+.024,.054,iz+.024,rubber,0,[0,0,0,0,1,0]);
        worldSolidBox(v,x+.47,.05,z+.23,x+.53,.056,z+.77,rubber,0,[0,0,0,0,1,0]);
      }

      if(detail&&(seed%41===0)&&mapCells[z][x]===0){
        // Thin raised maintenance lane marks and numbered tread lugs.
        const hazard=[.52,.29,.095],rubber=[.055,.069,.073];
        worldSolidBox(v,x+.13,.016,z+.11,x+.87,.021,z+.19,rubber,0,[0,0,0,0,1,0]);
        for(let q=0;q<5;q++){
          const xx=x+.15+q*.14;
          worldSolidBox(v,xx,.023,z+.12,xx+.065,.027,z+.18,hazard,0,[0,0,0,0,1,0]);
        }
      }
      if(detail&&seed%13===0){
        // Inset grated service drains, alloy lip, three individual slots.
        const steel=rcolor(t.wall,1.3),pit=rcolor(t.floor,.24);
        worldSolidBox(v,x+.18,.012,z+.20,x+.82,.018,z+.80,steel,0,[0,0,0,0,1,0]);
        worldSolidBox(v,x+.23,.02,z+.25,x+.77,.026,z+.75,pit,0,[0,0,0,0,1,0]);
        for(let j=0;j<4;j++)worldSolidBox(v,x+.26+j*.125,.027,z+.26,x+.278+j*.125,.032,z+.74,steel,0,[0,0,0,0,1,0]);
      }
      if(detail&&seed%23===0){
        // Small floor access hatch with bolts, no collision height.
        const plate=rcolor(t.wall,.78),rim=rcolor(t.wall,1.5);
        worldSolidBox(v,x+.17,.012,z+.16,x+.83,.018,z+.84,plate,0,[0,0,0,0,1,0]);
        for(let dx of [.22,.77])for(let dz of [.21,.79])worldSolidBox(v,x+dx-.025,.019,z+dz-.025,x+dx+.025,.023,z+dz+.025,rim,0,[0,0,0,0,1,0]);
      }
      if((sectorStyle===3||sectorStyle===1)&&seed%23===0){
        worldSolidBox(v,x+.17,.023,z+.16,x+.82,.028,z+.19,bright,1.0,[0,0,0,0,1,0]);
        worldSolidBox(v,x+.17,.023,z+.78,x+.82,.028,z+.81,dim,.8,[0,0,0,0,1,0]);
      }
      if(seed%19===0){
        worldSolidBox(v,x+.24,.023,z+.28,x+.76,.026,z+.73,rcolor(t.floor,1.65),0,[0,0,0,0,1,0]);
        worldSolidBox(v,x+.4,.028,z+.44,x+.6,.034,z+.56,bright,.7,[0,0,0,0,1,0]);
      }
      let adj=0;
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])if(mapCells[z+dz]?.[x+dx]===0)adj++;
      // Covered transit galleries alternate with open, monumental halls.
      if(((adj<=2) || seed%7!==0) && ((x*7+z*3+level)%13!==0)){
        quad(v,[x,roofH+.10,z],[x+1,roofH+.10,z],[x+1,roofH+.10,z+1],[x,roofH+.10,z+1],[0,-1,0],rcolor(t.wall,.43));
        registerWorldSolid(x,roofH+.09,z,x+1,roofH+.13,z+1,'ceiling');
        if(detail&&seed%9===0)worldSolidBox(v,x+.15,roofH+.07,z+.45,x+.85,roofH+.08,z+.55,bright,.78,[0,0,0,0,0,1]);
        if(detail&&seed%9===0){
          const frame=rcolor(t.wall,1.4),light=[.70,.74,.67];
          worldSolidBox(v,x+.12,roofH+.02,z+.10,x+.88,roofH+.06,z+.88,frame,0,[0,0,0,0,0,1]);
          worldSolidBox(v,x+.31,roofH-.01,z+.18,x+.69,roofH,z+.82,light,1.45,[0,0,0,0,0,1]);
        }
      }
    }else{
      const side=[!mapCells[z+1]?.[x],!mapCells[z-1]?.[x],!mapCells[z]?.[x-1],!mapCells[z]?.[x+1]];
      if(!side.some(Boolean))continue;
      let seed=x*11+z*19+level*13;
      let intensity=.71+(seed%7)*.040;
      worldSolidBox(v,x,0,z,x+1,roofH,z+1,rcolor(t.wall,intensity),0,[...side,1,0]);
      // Semi-recessed service wall: protective rails, actual cable raceways,
      // a vent grille, latches, and a caution marker. Static/batched geometry.
      if(detail&&seed%11===0){
        const ink=[.07,.085,.09],body=[.20,.235,.25],rim=[.37,.40,.40],
              ochre=[.70,.40,.13],glass=[.08,.22,.25],lamp=rcolor(t.accent,.62);
        const service=(axis,front)=>{
          // local x-axis is horizontal along a face, depth positive toward viewer
          const box2=(a,b,c,d,e,f,color,glow=0)=>{
            const cx=x+.5,cz=z+.5;
            if(axis==='z'){
              const q=front>0?z+1.07:z-.07;
              worldSolidBox(v,cx+a,b,Math.min(q+c*front,q+f*front),cx+d,e,Math.max(q+c*front,q+f*front),color,glow);
            }else{
              const q=front>0?x+1.07:x-.07;
              worldSolidBox(v,Math.min(q+c*front,q+f*front),b,cz+a,Math.max(q+c*front,q+f*front),e,cz+d,color,glow);
            }
          };
          // Face segments use a small symmetric depth range, requiring only a
          // fraction of a floor tile; invisible for collision purposes.
          box2(-.41,.45,-.033,.41,3.36,.035,ink);
          box2(-.37,.53,-.058,.37,3.23,.062,body);
          box2(-.39,.51,-.078,.39,.59,.080,rim);
          box2(-.39,3.15,-.078,.39,3.23,.080,rim);
          box2(-.31,1.36,-.082,.31,2.29,.084,ink);
          for(let k=0;k<7;k++)box2(-.27,1.48+k*.105,-.092,.27,1.52+k*.105,.096,rim);
          for(let k=0;k<3;k++)box2(-.33,2.59+k*.15,-.094,.33,2.65+k*.15,.095,k===2?ochre:ink,k===2?.12:0);
          box2(.27,.83,-.102,.34,1.09,.108,glass,.15);
          for(let k=0;k<2;k++){
            box2(-.33+k*.60,.64,-.100,-.29+k*.60,.72,.105,ochre,.1);
            box2(-.33+k*.60,2.99,-.105,-.29+k*.60,3.05,.108,lamp,.55);
          }
        };
        if(side[0])service('z',1);else if(side[1])service('z',-1);
        else if(side[2])service('x',-1);else if(side[3])service('x',1);
      }
      // Buttresses and double-height ribs create readable 3D architecture.
      if(side[0]&&seed%3!==0){
        worldSolidBox(v,x+.04,.09,z+.97,x+.22,3.93,z+1.035,trim,0,[1,0,0,0,1,1]);
        worldSolidBox(v,x+.78,.09,z+.97,x+.96,3.93,z+1.035,trim,0,[1,0,0,0,1,1]);
      }
      if(side[1]&&seed%3!==0){
        worldSolidBox(v,x+.04,.09,z-.035,x+.22,3.93,z+.03,trim,0,[1,0,0,0,1,1]);
        worldSolidBox(v,x+.78,.09,z-.035,x+.96,3.93,z+.03,trim,0,[1,0,0,0,1,1]);
      }
      if(side[2]&&seed%3!==0){
        worldSolidBox(v,x-.035,.09,z+.04,x+.03,3.93,z+.22,trim,0,[1,0,0,0,1,1]);
        worldSolidBox(v,x-.035,.09,z+.78,x+.03,3.93,z+.96,trim,0,[1,0,0,0,1,1]);
      }
      if(side[3]&&seed%3!==0){
        worldSolidBox(v,x+.97,.09,z+.04,x+1.035,3.93,z+.22,trim,0,[1,0,0,0,1,1]);
        worldSolidBox(v,x+.97,.09,z+.78,x+1.035,3.93,z+.96,trim,0,[1,0,0,0,1,1]);
      }
      // Three-layer industrial panels: fascia, illuminated seam and foot rail.
      const addFace=(axis,at,sideInt)=>{
        let x1=x+.1,x2=x+.9,z1=z+.1,z2=z+.9;
        if(axis==='z'){
          worldSolidBox(v,x1,.18,at-.023,x2,.37,at+.023,metal,0,[1,1,0,0,1,1]);
          worldSolidBox(v,x1,3.18,at-.022,x2,3.27,at+.022,dim,.52,[1,1,0,0,1,1]);
          worldSolidBox(v,x1,3.94,at-.02,x2,4.05,at+.02,trim,0,[1,1,0,0,1,1]);
          if(detail&&sideInt%5===0){worldSolidBox(v,x+.47,.8,at-.032,x+.53,2.62,at+.032,bright,1.15,[1,1,0,0,1,1]);}
          else if(detail&&sideInt%7===0)worldSolidBox(v,x+.22,1.4,at-.034,x+.78,1.47,at+.034,dim,.8,[1,1,0,0,1,1]);
        }else{
          worldSolidBox(v,at-.023,.18,z1,at+.023,.37,z2,metal,0,[0,0,1,1,1,1]);
          worldSolidBox(v,at-.022,3.18,z1,at+.022,3.27,z2,dim,.52,[0,0,1,1,1,1]);
          worldSolidBox(v,at-.02,3.94,z1,at+.02,4.05,z2,trim,0,[0,0,1,1,1,1]);
          if(detail&&sideInt%5===0)worldSolidBox(v,at-.032,.8,z+.47,at+.032,2.62,z+.53,bright,1.15,[0,0,1,1,1,1]);
          else if(detail&&sideInt%7===0)worldSolidBox(v,at-.034,1.4,z+.22,at+.034,1.47,z+.78,dim,.8,[0,0,1,1,1,1]);
        }
      };
      if(side[0])addFace('z',z+1.009,seed);
      if(side[1])addFace('z',z-.009,seed+3);
      if(side[2])addFace('x',x-.009,seed+7);
      if(side[3])addFace('x',x+1.009,seed+11);
      if(detail&&seed%6===0){
        // Recessed power conduit with two supporting metal clamp brackets.
        const pipe=rcolor(t.wall,1.9),cable=rcolor(t.wall,.32);
        if(side[0]||side[1]){
          const iz=side[0]?z+1.04:z-.04;
          worldSolidBox(v,x+.12,2.53,iz-.038,x+.88,2.61,iz+.038,pipe,0,[1,1,1,1,1,1]);
          for(const xx of [x+.22,x+.74])worldSolidBox(v,xx,2.46,iz-.05,xx+.07,2.69,iz+.05,cable,0);
        }else if(side[2]||side[3]){
          const ix=side[3]?x+1.04:x-.04;
          worldSolidBox(v,ix-.038,2.53,z+.12,ix+.038,2.61,z+.88,pipe,0);
          for(const zz of [z+.22,z+.74])worldSolidBox(v,ix-.05,2.46,zz,ix+.05,2.69,zz+.07,cable,0);
        }
      }
      // Architectural set dressing: wall-mounted breaker boxes, shock braces,
      // hanging cable runs and maintenance placards (pure geometry, no collision).
      if(detail && seed%7===0){
        const panel=rcolor(t.wall,.55),frame=rcolor(t.wall,1.12),dark=[.055,.067,.072],warm=[.87,.47,.15];
        const addCabinet=(axis,sideVal)=>{
          if(axis==='z'){
            const face=sideVal>0?z+1.07:z-.07;
            worldSolidBox(v,x+.24,1.08,face-.035,x+.76,2.32,face+.035,panel,0);
            worldSolidBox(v,x+.20,1.05,face-.055,x+.80,1.13,face+.055,frame,0);
            worldSolidBox(v,x+.25,2.26,face-.055,x+.75,2.32,face+.055,frame,0);
            worldSolidBox(v,x+.31,1.48,face-.063,x+.69,1.88,face+.063,dark,0);
            for(let k=0;k<4;k++)worldSolidBox(v,x+.34,1.54+k*.076,face-.074,x+.66,1.565+k*.076,face+.074,frame,0);
            worldSolidBox(v,x+.59,2.07,face-.075,x+.67,2.14,face+.075,warm,.55);
          }else{
            const face=sideVal>0?x+1.07:x-.07;
            worldSolidBox(v,face-.035,1.08,z+.24,face+.035,2.32,z+.76,panel,0);
            worldSolidBox(v,face-.055,1.05,z+.20,face+.055,1.13,z+.8,frame,0);
            worldSolidBox(v,face-.055,2.26,z+.25,face+.055,2.32,z+.75,frame,0);
            worldSolidBox(v,face-.065,1.48,z+.31,face+.065,1.88,z+.69,dark,0);
            for(let k=0;k<4;k++)worldSolidBox(v,face-.073,1.54+k*.076,z+.34,face+.073,1.565+k*.076,z+.66,frame,0);
            worldSolidBox(v,face-.075,2.07,z+.59,face+.075,2.14,z+.67,warm,.55);
          }
        };
        if(side[0])addCabinet('z',1);else if(side[1])addCabinet('z',-1);
        else if(side[2])addCabinet('x',-1);else if(side[3])addCabinet('x',1);
      }
      if(detail && seed%13===0){
       // Diagonal strengthening struts with tiered bracket and hanging conduit.
       const oxid=rcolor(t.wall,.67),highlight=rcolor(t.wall,1.45);
       if(side[0]||side[1]){
        const zz=side[0]?z+1.059:z-.059;
        for(let j=0;j<4;j++)worldSolidBox(v,x+.15+j*.17,.48+j*.55,zz-.027,x+.20+j*.17,.77+j*.55,zz+.027,oxid,0);
        worldSolidBox(v,x+.12,.44,zz-.064,x+.85,.51,zz+.064,highlight,0);
       }else if(side[2]||side[3]){
        const xx=side[3]?x+1.059:x-.059;
        for(let j=0;j<4;j++)worldSolidBox(v,xx-.027,.48+j*.55,z+.15+j*.17,xx+.027,.77+j*.55,z+.20+j*.17,oxid,0);
        worldSolidBox(v,xx-.064,.44,z+.12,xx+.064,.51,z+.85,highlight,0);
       }
      }
      // Microscale environment dressing: stencil strips, plate bolts, ID plaques,
      // access switches, hose clamps. Grouped in static world chunks, not draw calls.
      if(detail && seed%19===2){
        const black=[.041,.055,.062],outline=[.38,.42,.43],ink=[.67,.61,.39];
        const face=side[0]?['z',z+1.042]:side[1]?['z',z-.042]:side[2]?['x',x-.042]:['x',x+1.042];
        if(face[0]==='z'){
          const Z=face[1];
          worldSolidBox(v,x+.26,2.79,Z-.016,x+.74,3.24,Z+.016,black,0);
          worldSolidBox(v,x+.29,3.12,Z-.024,x+.71,3.19,Z+.024,outline,0);
          for(let j=0;j<4;j++)worldSolidBox(v,x+.31+j*.088,2.88,Z-.024,x+.35+j*.088,2.98,Z+.024,j%2?ink:outline,0);
          for(const X of [x+.27,x+.72])for(const Y of [2.80,3.24])worldSolidBox(v,X-.023,Y-.022,Z-.034,X+.023,Y+.022,Z+.034,ink,0);
        }else{
          const X=face[1];
          worldSolidBox(v,X-.016,2.79,z+.26,X+.016,3.24,z+.74,black,0);
          worldSolidBox(v,X-.024,3.12,z+.29,X+.024,3.19,z+.71,outline,0);
          for(let j=0;j<4;j++)worldSolidBox(v,X-.024,2.88,z+.31+j*.088,X+.024,2.98,z+.35+j*.088,j%2?ink:outline,0);
        }
      }
      if(detail && seed%27===4){
        // Broad removable armored wall cassettes with seam and screw bosses.
        const c=rcolor(t.wall,.89),rim=rcolor(t.wall,1.45),screw=[.11,.12,.13];
        if(side[0]){
          worldSolidBox(v,x+.23,.71,z+1.017,x+.78,1.26,z+1.046,c,0);
          for(const Y of [.75,1.2])for(const X of [x+.27,x+.74])worldSolidBox(v,X-.025,Y-.023,z+1.051,X+.025,Y+.023,z+1.058,screw,0);
          worldSolidBox(v,x+.25,1.17,z+1.056,x+.76,1.21,z+1.064,rim,0);
        }
      }
      // Five distinct facades — far fewer emissive meshes in power-save mode.
      if(detail&&((x*7+z*13+level)%5===0)){
        const b=rcolor(t.accent,sectorStyle===1?.9:.5),steel=rcolor(t.wall,1.45);
        if(side[0]){
          if(sectorStyle===1||sectorStyle===3||sectorStyle===5||sectorStyle===9){worldSolidBox(v,x+.22,1.2,z+.997,x+.78,1.35,z+1.016,b,sectorStyle>=5?.55:1.6,[1,1,0,0,1,1]);worldSolidBox(v,x+.32,1.55,z+.997,x+.68,2.15,z+1.016,steel,0,[1,1,0,0,1,1]);}
          else if(sectorStyle===2||sectorStyle===4){worldSolidBox(v,x+.33,.85,z+.998,x+.39,2.75,z+1.017,b,1.3,[1,1,0,0,1,1]);worldSolidBox(v,x+.61,.85,z+.998,x+.67,2.75,z+1.017,b,1.3,[1,1,0,0,1,1]);}
        }
        if(side[1])worldSolidBox(v,x+.26,2.16,z-.019,x+.74,2.24,z+.003,b,1.3,[1,1,0,0,1,1]);
      }
    }
  }
  if(v.length){let mesh=toMesh(v);worldChunks.push({mesh,x:x0+4.5,z:z0+4.5});meshStats.triangles+=mesh.n/3;}
  }
  v=[];
  // V64: the four balcony world families retain EVERY original stair and
  // roof route. Solid external roof architecture changes their silhouettes
  // without filling narrow walkable passages or faking projectile collision.
  if([2,4,6,9].includes(sectorStyle)&&typeof midlevelSpecs!=='undefined'&&
     typeof balconyArchitecturalBoxes==='function')for(const shelter of midlevelSpecs){
    for(const part of balconyArchitecturalBoxes(shelter,sectorStyle,level)){
      const shade=part.role.includes('Crown')||part.role.includes('Trim')||
        part.role.includes('Spire')||part.role.includes('Lintel')?1.22:.82;
      worldSolidBox(v,...part.box,rcolor(t.accent,shade),.25);
    }
  }
  // V61: place architectural setpieces only where their real raised terrain
  // was installed. All material thicknesses share worldSolidBox's renderer
  // and collision volume. None is just a picture/ghost wall.
  for(const site of landmarkSpecs){
    const {cx,cz,kind,y}=site;
    const base=rcolor(t.wall,.95),bright=rcolor(t.accent,1.2),dark=rcolor(t.wall,.42);
    if(kind==='citadel'){
      // Four slender sentry towers beyond the traversable fortress ramparts.
      for(const dx of [-6,6])for(const dz of [-4,4]){
        const x=cx+dx+.5,z=cz+dz+.5;
        worldSolidBox(v,x-.28,0,z-.28,x+.28,y+2.25,z+.28,base);
        worldSolidBox(v,x-.42,y+2.12,z-.42,x+.42,y+2.28,z+.42,dark);
        worldSolidBox(v,x-.35,y+2.28,z-.35,x+.35,y+2.35,z+.35,bright,.75);
      }
    }else if(kind==='reactor'){
      // The reactor is physically enclosed by solid energized columns;
      // the oval walking ring itself remains empty through the centre.
      for(const dx of [-1.35,1.35])for(const dz of [-1.35,1.35]){
        const x=cx+dx+.5,z=cz+dz+.5;
        worldSolidBox(v,x-.14,0,z-.14,x+.14,3.55,z+.14,dark);
        worldSolidBox(v,x-.09,.64,z-.09,x+.09,3.3,z+.09,bright,1.05);
      }
      worldSolidBox(v,cx-.9,3.5,cz-.9,cx+1.9,3.72,cz+1.9,base);
    }else if(kind==='docks'){
      // A genuine loading gantry crosses the upper boardwalk with sufficient
      // headroom for a 1.95m operator below its solid overhead girder.
      for(const side of [-1,1]){
        const x=cx+side*7.55+.5,z=cz+4.5;
        worldSolidBox(v,x-.24,0,z-.24,x+.24,3.94,z+.24,base);
        worldSolidBox(v,x-.31,3.4,z-.31,x+.31,3.94,z+.31,bright,.48);
      }
      worldSolidBox(v,cx-7.15,3.91,cz+4.35,cx+8.15,4.07,cz+4.65,dark);
    }else if(kind==='shipyard'){
      // Solid cargo stacks flank the TWO parallel piers rather than filling
      // their crosswise accessible bridge.
      for(const dx of [-8.2,8.2])for(const dz of [-3.4,3.4]){
        const x=cx+dx+.5,z=cz+dz+.5;
        worldSolidBox(v,x-.75,0,z-.72,x+.75,1.72,z+.72,dark);
        worldSolidBox(v,x-.65,1.72,z-.62,x+.65,1.81,z+.62,base);
        worldSolidBox(v,x-.51,.75,z-.73,x+.51,.84,z-.715,bright,.7);
      }
    }else if(kind==='flood'){
      // Offset pumping machines flank the bending upper causeway. Unlike
      // painted tanks, their walls protect against both bullets and rockets.
      for(const [dx,dz] of [[-9,-5],[9,5],[-9,5],[9,-5]]){
        const x=cx+dx+.5,z=cz+dz+.5;
        worldSolidBox(v,x-.62,0,z-.63,x+.62,2.72,z+.63,dark);
        worldSolidBox(v,x-.72,2.49,z-.72,x+.72,2.64,z+.72,base);
        worldSolidBox(v,x-.36,1.02,z-.64,x+.36,1.23,z-.61,bright,.95);
        if(worldMapBoss){
          worldSolidBox(v,x-.48,2.64,z-.48,x+.48,roofH-3.1,z+.48,base);
          worldSolidBox(v,x-.65,roofH-3.25,z-.65,x+.65,roofH-2.95,z+.65,bright,.55);
        }
      }
      if(worldMapBoss)worldSolidBox(v,cx-8.75,roofH-3.2,cz-5.18,
        cx+9.75,roofH-2.98,cz-4.82,dark);
    }else if(kind==='observatory'){
      // The central telescope is a real immovable obstacle; six walkable
      // radial arms and their common hub remain open around its narrow base.
      worldSolidBox(v,cx+.20,y,cz+.20,cx+.80,3.78,cz+.80,base);
      worldSolidBox(v,cx-.12,3.59,cz+.17,cx+1.12,3.95,cz+.83,bright,.52);
      worldSolidBox(v,cx+.36,3.84,cz+.30,cx+.64,4.04,cz+.70,dark);
      if(worldMapBoss){
        // Observatory boss: one towering astronomical needle with a wide
        // overhead sighting yoke, distinct from the canal's pump towers.
        worldSolidBox(v,cx+.29,4.04,cz+.29,cx+.71,roofH-2.2,cz+.71,base);
        worldSolidBox(v,cx-6.6,roofH-2.34,cz+.27,
          cx+7.6,roofH-2.01,cz+.73,bright,.38);
      }
    }else if(kind==='harbor'){
      // Three dockside crane legs terminate short of the raised berths.
      for(const dz of [-5,0,5]){
        const x=cx-8.4,z=cz+dz+.5;
        worldSolidBox(v,x-.33,0,z-.32,x+.33,3.82,z+.32,base);
        worldSolidBox(v,x-.25,3.60,z-.40,x+3.2,3.82,z+.40,dark);
        worldSolidBox(v,x+2.9,3.29,z-.14,x+3.11,3.61,z+.14,bright,.75);
        if(worldMapBoss){
          worldSolidBox(v,x-.29,3.8,z-.29,x+.29,8.7,z+.29,base);
          worldSolidBox(v,x-.18,8.42,z-.22,x+8.15,8.72,z+.22,dark);
          worldSolidBox(v,x+7.9,8.13,z-.12,x+8.10,8.42,z+.12,bright,.8);
        }
      }
    }else if(kind==='forge'){
      // Twin blast furnaces outside the transverse anvil. Their solid
      // chimneys leave the main six-step east approach unobstructed.
      for(const side of [-1,1]){
        const x=cx+side*9+.5,z=cz-4.8;
        worldSolidBox(v,x-.78,0,z-.78,x+.78,2.78,z+.78,dark);
        worldSolidBox(v,x-.54,2.64,z-.54,x+.54,3.78,z+.54,base);
        worldSolidBox(v,x-.43,.44,z-.81,x+.43,.66,z-.77,bright,1.15);
        if(worldMapBoss){
          worldSolidBox(v,x-.46,3.78,z-.46,x+.46,roofH-3.2,z+.46,base);
          worldSolidBox(v,x-.61,roofH-3.31,z-.61,x+.61,roofH-3.02,z+.61,bright,.56);
        }
      }
      if(worldMapBoss)worldSolidBox(v,cx-8.85,roofH-3.26,cz-4.95,
        cx+9.85,roofH-3.01,cz-4.65,dark);
    }else if(kind==='vertical'){
      // Container gantries frame, but never block, three walkable switchbacks.
      for(const [dx,dz] of [[-9,-4],[9,4],[-9,3],[9,-3]]){
        const x=cx+dx+.5,z=cz+dz+.5;
        worldSolidBox(v,x-1.00,0,z-.70,x+1.00,1.64,z+.70,dark);
        worldSolidBox(v,x-.86,1.64,z-.62,x+.86,1.72,z+.62,base);
        worldSolidBox(v,x-.54,.89,z-.72,x+.54,1.02,z-.70,bright,.72);
        if(worldMapBoss){
          worldSolidBox(v,x-.51,1.72,z-.44,x+.51,8.15,z+.44,base);
          worldSolidBox(v,x-.69,7.96,z-.61,x+.69,8.25,z+.61,bright,.45);
        }
      }
    }else if(kind==='stairkeep'){
      // Four solid diamond-court obelisks beyond the true six-tier approach.
      for(const dx of [-10,10])for(const dz of [-9,9]){
        const x=cx+dx+.5,z=cz+dz+.5,cap=worldMapBoss?roofH-1.6:3.78;
        worldSolidBox(v,x-.38,0,z-.38,x+.38,cap,z+.38,base);
        worldSolidBox(v,x-.49,cap-.22,z-.49,x+.49,cap+.04,z+.49,bright,.48);
      }
      if(worldMapBoss)for(const dz of [-9,9])
        worldSolidBox(v,cx-9.65,roofH-2.06,cz+dz+.28,
          cx+10.65,roofH-1.81,cz+dz+.72,dark);
    }else if(kind==='collector'){
      // Massive collector towers frame the four bent raised rotor blades,
      // keeping the traversable machine centre and east entrance clear.
      for(const dx of [-10,10])for(const dz of [-8,8]){
        const x=cx+dx+.5,z=cz+dz+.5,top=worldMapBoss?roofH-2.7:6.2;
        worldSolidBox(v,x-.37,0,z-.37,x+.37,top,z+.37,base);
        worldSolidBox(v,x-.53,top-.28,z-.53,x+.53,top+.03,z+.53,bright,.47);
      }
      if(worldMapBoss)for(const dz of [-8,8])
        worldSolidBox(v,cx-9.55,roofH-2.87,cz+dz+.26,
          cx+10.55,roofH-2.57,cz+dz+.74,dark);
    }else if(kind==='atrium'){
      // Two processional portals outside the raised nested horseshoes.
      for(const dz of [-7,7])for(const side of [-1,1]){
        const x=cx+side*9.3+.5,z=cz+dz+.5,top=worldMapBoss?roofH-3.2:5.45;
        worldSolidBox(v,x-.42,0,z-.42,x+.42,top,z+.42,dark);
        worldSolidBox(v,x-.55,top-.28,z-.55,x+.55,top+.05,z+.55,bright,.46);
      }
      if(worldMapBoss)for(const dz of [-7,7])
        worldSolidBox(v,cx-8.95,roofH-3.32,cz+dz+.23,
          cx+9.95,roofH-3.08,cz+dz+.77,base);
    }else if(kind==='cryo'){
      // Four separate refrigerated crystal towers between staggered pods.
      for(const [dx,dz] of [[-10,-8],[-10,8],[10,-8],[10,8]]){
        const x=cx+dx+.5,z=cz+dz+.5,top=worldMapBoss?roofH-2.55:7.1;
        worldSolidBox(v,x-.65,0,z-.65,x+.65,2.15,z+.65,dark);
        worldSolidBox(v,x-.40,2.15,z-.40,x+.40,top,z+.40,base);
        worldSolidBox(v,x-.51,top-.33,z-.51,x+.51,top+.06,z+.51,bright,.72);
      }
    }else if(kind==='gravity'){
      // Three isolated gravity beacons trace a triangular outer field;
      // all are physically solid, including their towering boss variants.
      for(let k=0;k<3;k++){
        const angle=k*2*Math.PI/3+.42,
          x=cx+Math.cos(angle)*11.4+.5,z=cz+Math.sin(angle)*11.4+.5,
          top=worldMapBoss?roofH-2.25:7.85;
        worldSolidBox(v,x-.43,0,z-.43,x+.43,top,z+.43,base);
        worldSolidBox(v,x-.79,top-.58,z-.79,x+.79,top-.38,z+.79,dark);
        worldSolidBox(v,x-.31,top-.26,z-.31,x+.31,top+.04,z+.31,bright,.95);
      }
    }
  }
  // Boss battles are monumental across ALL 18 themes: a large, tall
  // processional structure surrounds the arena without covering its centre.
  // The piers and upper beams are real physics volumes at low and high detail.
  if(level%5===0){
    const x=spawnX,z=spawnZ,top=roofH-.65;
    const alloy=rcolor(t.wall,.73),beacon=rcolor(t.accent,1.25);
    for(const side of [-1,1])for(const back of [-1,1]){
      // Place the procession outside all four centre-set landmark footprints
      // and the mid-level house escapes. At 9.3m it cut a roof stair; at
      // 11.3m it cut the reactor's real access ramp on boss level 20.
      const px=x+side*14.3,pz=z+back*14.3;
      worldSolidBox(v,px-.39,0,pz-.39,px+.39,top,pz+.39,alloy);
      worldSolidBox(v,px-.48,top-.35,pz-.48,px+.48,top+.08,pz+.48,beacon,.27);
    }
    for(const back of [-1,1]){
      const zz=z+back*14.3;
      worldSolidBox(v,x-14.4,top-.05,zz-.29,x+14.4,top+.29,zz+.29,alloy);
      worldSolidBox(v,x-13.8,top+.29,zz-.24,x+13.8,top+.34,zz+.24,beacon,.7);
    }
    // Twenty different overhead flight-combat silhouettes, not the same
    // four columns copied into every arena. All are solid at both qualities.
    for(const part of bossSkylineBoxes(level,x,z,roofH)){
      worldSolidBox(v,...part.box,part.role==='upperRib'||
        part.role==='starBay'?beacon:alloy,0);
    }
  }
  // Unlike bridge rails and walls, later set dressing may be dropped if it
  // obstructs the real elevated walkway; both drawing and collisions agree.
  worldDecorClearance=true;
  // A regular map's second combat yard now has its own visible overhead
  // architecture, NOT just a different cutout in an otherwise repeated maze.
  // Exact solid volumes exist at both qualities; never use fake visual beams.
  const canopy=secondaryCanopyBoxes(level,
   typeof secondaryYard==='undefined'?null:secondaryYard,roofH);
  for(const part of canopy)worldSolidBox(v,...part.box,
    part.role.startsWith('individual')?rcolor(t.accent,.97):
    rcolor(t.wall,1.15),part.role==='individualEndcap'?.46:0);
  // V71: boss approach forts are NOT silhouettes painted behind the arena.
  // They are exact 3D static solids, including their wall-anchored columns;
  // old upper walking routes can veto both a visible part and its collider.
  const siege=bossSiegeBoxes(level,
   typeof bossApproachPlan==='undefined'?null:bossApproachPlan,roofH);
  for(const part of siege){
    const foundation=part.role==='wallFoundation',crown=part.role==='foundationCrown';
    worldSolidBox(v,...part.box,
      foundation?rcolor(t.wall,1.31):
      crown?rcolor(t.accent,1.23):
      part.role.startsWith('unique')?rcolor(t.accent,.93):
      rcolor(t.wall,.97),crown?.43:0);
  }
  // V72: every ordinary level receives wall-anchored physical defences; where
  // the real old ground allows it, the court also gets up to TWO passable
  // physical gatehouses. No phantom wall or collision-only blocker exists.
  const gateways=secondaryGatewaySystem(level,
   typeof secondaryYard==='undefined'?null:secondaryYard,roofH);
  for(const part of gateways.parts){
    const wall=part.role.startsWith('defensive')||part.role.startsWith('wall'),
      crest=part.role.startsWith('unique')||part.role.includes('Crest')||
        part.role.includes('Merlon')||part.role==='defensiveWallCap';
    worldSolidBox(v,...part.box,
      crest?rcolor(t.accent,1.13):wall?rcolor(t.wall,.83):
        rcolor(t.wall,1.25),crest?.26:0);
  }
  // V73: the main tactical annex of EVERY level now has its own tangible
  // sentinel engineering silhouette, independent of graphic quality.
  const sentinels=tacticalSentinelBoxes(level,
   typeof tacticalZone==='undefined'?null:tacticalZone,roofH);
  for(const part of sentinels.parts){
    const crest=part.role.startsWith('individual')||
      part.role.includes('Tip')||part.role==='sentinelCrown';
    worldSolidBox(v,...part.box,
      crest?rcolor(t.accent,1.23):rcolor(t.wall,1.25),crest?.55:0);
  }
  // V74: route-safe, ground-level physical combat cover inside the main
  // tactical yard. These block real projectiles, player bodies and bot flow.
  const bastions=tacticalGroundBastions(level,
    typeof tacticalZone==='undefined'?null:tacticalZone,roofH);
  lastGroundBastions=bastions;
  for(const part of bastions.parts){
    const metal=part.role.startsWith('individual')||
      part.role==='bastionCrown';
    worldSolidBox(v,...part.box,
      metal?rcolor(t.accent,.80):rcolor(t.wall,1.37),metal?.20:0);
  }
  // V75: physically anchored overhead combat-engineering arms. The entire
  // visible volume is always exactly the projectile/body collision volume.
  const overhangs=tacticalOverhangBoxes(level,
    typeof tacticalZone==='undefined'?null:tacticalZone,roofH);
  lastTacticalOverhangs=overhangs;
  for(const part of overhangs.parts){
    const metallic=part.role.startsWith('individual')||
      part.role==='overhangCrossbar';
    worldSolidBox(v,...part.box,
      metallic?rcolor(t.accent,.65):rcolor(t.wall,1.26),metallic?.24:0);
  }
  // V76: waist-to-head-height real combat gunports on old solid bastions.
  // The central aperture has no triangles and no collision volume: actual
  // rockets and hitscan shots pass through while the flanks stop them.
  const watchposts=tacticalBastionWatchposts(level,bastions,roofH);
  lastBastionWatchposts=watchposts;
  for(const part of watchposts.parts){
    const signal=part.role.startsWith('watchIndividual')||
      part.role==='watchSolidLintel';
    worldSolidBox(v,...part.box,
      signal?rcolor(t.accent,.71):rcolor(t.wall,1.31),signal?.26:0);
  }
  // Elevated luminous octagonal floor markings at the safe zone and boss room.
  function circleOnFloor(cx,cz,r,col,segments=28){
    for(let i=0;i<segments;i++){
      let a=TAU*i/segments,b=TAU*(i+1)/segments;
      let A=[cx+Math.cos(a)*r,.039,cz+Math.sin(a)*r];
      let B=[cx+Math.cos(b)*r,.039,cz+Math.sin(b)*r];
      let C=[cx+Math.cos(b)*(r-.06),.039,cz+Math.sin(b)*(r-.06)];
      let D=[cx+Math.cos(a)*(r-.06),.039,cz+Math.sin(a)*(r-.06)];
      quad(v,A,B,C,D,[0,1,0],col,1.15);
    }
  }
  circleOnFloor(spawnX,spawnZ,2.05,dim);
  circleOnFloor(spawnX,spawnZ,1.65,rcolor(t.accent,.3));
  if(level%5===0){circleOnFloor(spawnX,spawnZ,4.8,rcolor(t.accent,.52));circleOnFloor(spawnX,spawnZ,5.0,rcolor(t.accent,.32));}
  // Large environmental structures attached to edges, not the walkable paths.
  for(const f of mapFeatures){
    if(f.kind===3)continue;
    let c=rcolor(t.wall,1.58),light=rcolor(t.accent,.85),x=f.x,z=f.z;
    if(nearUpperFeature(x,z))continue;
    // Suspended luminous frame, deliberately higher than the player's camera.
    worldSolidBox(v,x-.62,3.72,z-.62,x+.62,3.88,z+.62,c,0,[1,1,1,1,0,1]);
    worldSolidBox(v,x-.53,3.71,z-.53,x+.53,3.73,z+.53,light,.88,[1,1,1,1,0,1]);
    if(f.kind===1){
      worldSolidBox(v,x-.64,2.82,z-.65,x-.58,3.71,z-.58,c,0);
      worldSolidBox(v,x+.58,2.82,z+.58,x+.64,3.71,z+.65,c,0);
    }
  }
  // Oversized hanging conduits and floating navigation pylons, inspired by
  // reactor gantries and museum atria: above players and enemies, no hitbox.
  const arch=sectorStyle;
  for(let k=0;k<mapRooms.length;k++){
    const r=mapRooms[k],x=r.x,z=r.z;
    if(k===0||nearUpperFeature(x,z))continue;
    const accent=rcolor(t.accent,k%3===0?1.08:.61);
    const dark=rcolor(t.wall,.75),strut=rcolor(t.wall,1.7);
    const stretch=Math.min(3.7,Math.max(2.5,r.w*.30));
    // Overhead gantries and ducts make each room read as real architecture.
    // The player and enemies never collide with these high-mounted structures.
    if(detail && k%2===0){
      const half=Math.min(3.4,Math.max(1.4,Math.min(r.w,r.h)*.25));
      const steel=rcolor(t.wall,.72),light=rcolor(t.wall,1.22);
      worldSolidBox(v,x-half,3.51,z-.16,x+half,3.82,z+.16,steel,0);
      worldSolidBox(v,x-half,3.48,z-.205,x+half,3.54,z+.205,light,0);
      for(let j=-1;j<=1;j++){
        const xx=x+half*j*.72;
        worldSolidBox(v,xx-.11,3.23,z-.30,xx+.11,3.55,z+.30,steel,0);
        worldSolidBox(v,xx-.075,3.15,z-.20,xx+.075,3.24,z+.20,[.62,.58,.45],.10);
      }
    }
    // Maintenance truss, cross braces and pendant luminaires.
    if(detail&&k%3===1){
      const ox=[.105,.135,.15],frame=[.32,.34,.35],amber=[.65,.44,.20];
      for(let q=-2;q<=2;q++){
        const zz=z+q*.44;
        worldSolidBox(v,x-2.15,3.87,zz-.045,x+2.15,3.95,zz+.045,ox);
      }
      for(let q=-1;q<=1;q++){
        const xx=x+q*.91;
        worldSolidBox(v,xx-.06,3.77,z-1.15,xx+.06,3.96,z+1.15,frame);
        worldSolidBox(v,xx-.09,3.74,z-.34,xx+.09,3.765,z+.34,amber,.10);
      }
      worldSolidBox(v,x-1.4,3.72,z-.075,x+1.4,3.76,z+.075,frame);
      worldSolidBox(v,x-1.27,3.70,z-.055,x+1.27,3.72,z+.055,rcolor(t.accent,.46),.60);
    }
    // Monumental suspended illuminated hex/cross frames.
    worldSolidBox(v,x-stretch,3.92,z-.10,x+stretch,4.07,z+.10,dark,0);
    worldSolidBox(v,x-stretch,3.87,z-.055,x+stretch,3.90,z+.055,accent,1.3);
    worldSolidBox(v,x-.09,3.9,z-stretch,x+.09,4.07,z+stretch,strut,0);
    worldSolidBox(v,x-.045,3.86,z-stretch,x+.045,3.89,z+stretch,accent,.9);
    if(arch===1||arch===3){
      // Extra suspended reactor chamber ribs, bright at center.
      worldSolidBox(v,x-.52,3.45,z-.52,x+.52,3.64,z+.52,dark,0);
      worldSolidBox(v,x-.25,3.42,z-.25,x+.25,3.46,z+.25,accent,1.55);
    }else if(arch===2||arch===4){
      // Ancient floating holographic plaque, no collision.
      worldSolidBox(v,x-.78,3.18,z-.12,x+.78,3.58,z+.12,dark,0);
      worldSolidBox(v,x-.65,3.29,z-.14,x+.65,3.34,z+.14,accent,1.15);
    }
  }
  // DISTINCT LANDMARKS for the new spatial blueprints. All above walking
  // height except shallow, non-collidable floor motifs. Batched per sector.
  if(arch>=5){
    const steel=rcolor(t.wall,.60),edge=rcolor(t.wall,1.35),signal=rcolor(t.accent,.60);
    const rust=[.34,.17,.095],cold=[.64,.73,.78];
    for(let k=1;k<mapRooms.length;k++){
      const r=mapRooms[k],x=r.x,z=r.z;
      if(nearUpperFeature(x,z))continue;
      if(arch===5){ // Container loading bridges and overhead cargo cranes.
        for(const side of [-1,1]){
          worldSolidBox(v,x+side*1.9-.10,2.90,z-2.2,x+side*1.9+.10,3.93,z+2.2,edge);
          worldSolidBox(v,x+side*1.9-.10,3.70,z-2.2,x+side*1.9+.10,3.87,z+2.2,steel);
        }
        worldSolidBox(v,x-2.05,3.62,z-.18,x+2.05,3.78,z+.18,steel);
        worldSolidBox(v,x-.32,3.40,z-.32,x+.32,3.59,z+.32,rust);
        worldSolidBox(v,x-.18,3.35,z-.18,x+.18,3.38,z+.18,signal,.75);
      }else if(arch===6){ // Suspended clean-room filtration and warning rails.
        worldSolidBox(v,x-1.45,3.35,z-.9,x+1.45,3.66,z+.9,cold);
        worldSolidBox(v,x-1.30,3.30,z-.74,x+1.3,3.34,z+.74,steel);
        for(let j=-3;j<=3;j++)worldSolidBox(v,x+j*.35-.04,3.27,z-.69,x+j*.35+.04,3.30,z+.69,edge);
        worldSolidBox(v,x-.8,3.22,z-.85,x+.8,3.25,z-.79,signal,.8);
      }else if(arch===7){ // Submerged pumping mains, oxidised tubing.
        for(const side of [-1,1]){
          worldSolidBox(v,x+side*1.2-.15,3.23,z-1.5,x+side*1.2+.15,3.48,z+1.5,rust);
          for(let q=-1;q<=1;q++)worldSolidBox(v,x+side*1.2-.22,3.2,z+q*.95-.05,x+side*1.2+.22,3.52,z+q*.95+.05,edge);
        }
        worldSolidBox(v,x-1.1,3.03,z-.055,x+1.1,3.11,z+.055,signal,.85);
      }else if(arch===8){ // Orrery ribs: suspended crosses and observatory lenses.
        for(let q=-2;q<=2;q++){
          let xx=x+q*.54;
          worldSolidBox(v,xx-.05,3.12,z-.99,xx+.05,3.78,z+.99,edge);
        }
        worldSolidBox(v,x-1.30,3.55,z-.10,x+1.30,3.78,z+.10,steel);
        worldSolidBox(v,x-.26,3.18,z-.26,x+.26,3.24,z+.26,signal,1.2);
      }else{ // Metro signage, platform beams and departure gantries.
        worldSolidBox(v,x-1.95,3.05,z-.22,x+1.95,3.3,z+.22,steel);
        worldSolidBox(v,x-1.68,3.08,z-.235,x+1.68,3.20,z-.225,signal,.9);
        for(let q=-1;q<=1;q++)worldSolidBox(v,x+q*.72-.055,3.29,z-.46,x+q*.72+.055,3.77,z+.46,edge);
        worldSolidBox(v,x-.67,.034,z-.85,x+.67,.041,z-.73,[.52,.39,.12],0,[0,0,0,0,1,0]);
      }
    }
  }

  // DIRECTOR'S CUT: bold modular setpieces designed for recognizable room silhouettes.
  // Static batched triangles, not per-frame draw calls; no collision volumes.
  if(detail){
    const alloy=rcolor(t.wall,1.22),steel=rcolor(t.wall,.71),graphite=[.085,.118,.134],rim=rcolor(t.wall,1.55);
    const signal=rcolor(t.accent,1.13),signalDim=rcolor(t.accent,.47),warning=[.69,.38,.16],porcelain=[.54,.57,.55];
    const full=!touchOnly||save.settings.quality===2;
    for(let k=1;k<mapRooms.length;k+=full?2:4){
      const room=mapRooms[k],xx=room.x,zz=room.z;
      if(!Number.isFinite(xx)||!Number.isFinite(zz))continue;
      if(nearUpperFeature(xx,zz))continue;
      // Massive suspended service spine with telescoping structural arms.
      // Lower edge > 3m, leaving movement/jumps untouched.
      worldSolidBox(v,xx-1.80,3.27,zz-.25,xx+1.80,3.52,zz+.25,graphite);
      worldSolidBox(v,xx-1.62,3.24,zz-.31,xx+1.62,3.30,zz+.31,rim);
      for(const side of [-1,1]){
        const ax=xx+side*1.47;
        worldSolidBox(v,ax-.14,3.04,zz-.27,ax+.14,3.68,zz+.27,steel);
        worldSolidBox(v,ax-.08,3.06,zz-.32,ax+.08,3.25,zz+.32,alloy);
        worldSolidBox(v,ax-.065,3.10,zz-.335,ax+.065,3.19,zz+.335,signal,.95);
        worldSolidBox(v,ax-.24,3.64,zz-.31,ax+.24,3.80,zz+.31,graphite);
      }
      // Hanging engine core or industrial navigation terminal, varies by room.
      if(k%3===0){
        worldSolidBox(v,xx-.58,2.86,zz-.49,xx+.58,3.22,zz+.49,steel);
        worldSolidBox(v,xx-.48,2.80,zz-.35,xx+.48,2.86,zz+.35,graphite);
        for(let q=-2;q<=2;q++){
          worldSolidBox(v,xx+q*.19-.055,2.76,zz-.30,xx+q*.19+.055,2.81,zz+.30,porcelain);
          worldSolidBox(v,xx+q*.19-.031,2.745,zz-.25,xx+q*.19+.031,2.762,zz+.25,signalDim,.28);
        }
        worldSolidBox(v,xx-.29,2.720,zz-.20,xx+.29,2.747,zz+.20,signal,1.35,[0,0,0,0,0,1]);
      }else{
        for(let q=-3;q<=3;q++){
          const ax=xx+q*.37;
          worldSolidBox(v,ax-.047,3.02,zz-.63,ax+.047,3.31,zz+.63,q%2?alloy:steel);
          if(q%2===0)worldSolidBox(v,ax-.045,3.008,zz-.52,ax+.045,3.025,zz+.52,signalDim,.34,[0,0,0,0,0,1]);
        }
      }
      // Route ID panel and engineering markings on existing room floor.
      if(full){
        worldSolidBox(v,xx-1.16,.015,zz-1.17,xx+1.16,.024,zz-1.10,graphite,0,[0,0,0,0,1,0]);
        for(let q=-5;q<=5;q++){
          const px=xx+q*.195;
          worldSolidBox(v,px-.069,.027,zz-1.15,px+.017,.031,zz-1.11,(q%3===0)?warning:rim,0,[0,0,0,0,1,0]);
        }
      }
    }
    // Landmark gateway in the spawn chamber: broad alloy emblem and lights.
    const sx=spawnX,sz=spawnZ;
    worldSolidBox(v,sx-2.18,3.55,sz-2.20,sx+2.18,3.78,sz-1.97,graphite);
    worldSolidBox(v,sx-1.92,3.52,sz-2.23,sx+1.92,3.55,sz-1.95,signalDim,.74);
    for(let q=-4;q<=4;q++){
      const x=sx+q*.44;
      worldSolidBox(v,x-.10,3.49,sz-2.235,x+.10,3.515,sz-2.225,q%2?porcelain:warning,q%2?0:.32);
    }
  }
  // Hanging luminous gantries and maintenance pipes at major junctions.
  if(detail)for(let k=1;k<mapRooms.length;k+=2){
    let r=mapRooms[k],x=r.x,z=r.z;
    if(nearUpperFeature(x,z))continue;
    let shell=rcolor(t.wall,1.25),dark=rcolor(t.wall,.34),accent=rcolor(t.accent,.72);
    worldSolidBox(v,x-1.7,3.4,z-.21,x+1.7,3.54,z+.21,shell);
    worldSolidBox(v,x-1.65,3.34,z-.17,x+1.65,3.355,z+.17,accent,1.1,[0,0,0,0,0,1]);
    for(let j=-1;j<=1;j++){
      worldSolidBox(v,x+j*.75-.10,3.52,z-.32,x+j*.75+.10,3.78,z+.32,dark);
      worldSolidBox(v,x+j*.75-.075,3.54,z-.34,x+j*.75+.075,3.62,z-.31,accent,.56);
    }
  }
  // Grounded support struts, mechanical conduits and integrated warning lights.
  if(detail)for(let k=1;k<mapRooms.length;k+=3){
    const r=mapRooms[k],x=r.x,z=r.z;const steel=rcolor(t.wall,1.15),dark=rcolor(t.wall,.28),accent=rcolor(t.accent,.77);
    if(nearUpperFeature(x,z))continue;
    // Cross-shaped cable ladder under suspended gantry: 3D depth, not a sprite.
    for(let j=-2;j<=2;j++){
      worldSolidBox(v,x+j*.55-.045,3.49,z-.36,x+j*.55+.045,3.54,z+.36,steel);
      worldSolidBox(v,x+j*.55-.026,3.47,z-.32,x+j*.55+.026,3.49,z+.32,dark);
    }
    worldSolidBox(v,x-1.35,3.48,z-.38,x+1.35,3.55,z-.32,dark);
    worldSolidBox(v,x-1.35,3.48,z+.32,x+1.35,3.55,z+.38,dark);
    for(const sx of [-1,1]){
      let ax=x+sx*1.2;
      worldSolidBox(v,ax-.11,3.55,z-.12,ax+.11,3.92,z+.12,steel);
      worldSolidBox(v,ax-.07,3.62,z-.14,ax+.07,3.75,z-.123,accent,.8);
    }
    // Oil-darkened floor patches directly below service gantries.
    let floorShadow=rcolor(t.floor,.26);
    worldSolidBox(v,x-1.18,.034,z-.28,x+1.18,.039,z+.28,floorShadow,0,[0,0,0,0,1,0]);
  }
  if(detail&&(sectorStyle===16||sectorStyle===17)){
    // Fixed suspended equipment. Kept above the collision volume so it
    // cannot create navigation obstacles or make the portal unreachable.
    const frame=rcolor(t.wall,.62),bright=rcolor(t.accent,.90),alloy=rcolor(t.wall,1.34);
    for(let k=2;k<mapRooms.length;k+=2){
      const r=mapRooms[k],x=r.x,z=r.z;if(!Number.isFinite(x)||!Number.isFinite(z))continue;
      if(sectorStyle===16){
        worldSolidBox(v,x-1.45,3.51,z-.17,x+1.45,3.63,z+.17,alloy);
        for(let j=-2;j<=2;j++){
          const q=x+j*.55;
          worldSolidBox(v,q-.09,3.07,z-.36,q+.09,3.44,z+.36,frame);
          worldSolidBox(v,q-.062,3.23,z-.38,q+.062,3.30,z-.36,bright,.67);
        }
        worldSolidBox(v,x-1.4,3.05,z-.48,x+1.4,3.10,z-.42,bright,.41);
      }else{
        worldSolidBox(v,x-1.6,3.28,z-.27,x+1.6,3.45,z+.27,frame);
        for(let j=-2;j<=2;j++){
          const q=z+j*.55;
          worldSolidBox(v,x-.65,3.21,q-.05,x+.65,3.32,q+.05,alloy);
          worldSolidBox(v,x-.14,3.15,q-.06,x+.14,3.23,q+.06,bright,.8);
        }
        worldSolidBox(v,x-.32,3.31,z-.67,x+.32,3.55,z-.56,alloy);
      }
    }
  }
  // Sector origin station and destination landing pad.
  circleOnFloor(portal.x,portal.z,1.3,rcolor(t.accent,.5));
  circleOnFloor(portal.x,portal.z,.95,rcolor(t.accent,.95));
  worldMesh=toMesh(v);meshStats.triangles+=worldMesh.n/3;meshStats.chunks=worldChunks.length;
  worldDecorClearance=false;

}
