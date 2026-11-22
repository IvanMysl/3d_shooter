
// A central safe hub, linked combat chambers and alternative routes. Every
// generated room is reachable; decorative objects never obstruct collision cells.
// MEGAWORLD: seeded sectors, five spatial blueprints, navigable halls and routes.
// V65: eight DIFFERENT connected ground-level tactical annexes. Every opened
// tile goes into the same collision grid as the rest of the arena. These plans
// ONLY REMOVE pre-existing maze walls, so they never sever an old route.
// V66: each annex also acquires a ground-accessible 1.32m elevated route.
// V68: eighty non-boss levels gain a SECOND, different, connected ground yard.
// Every opening, bypass and defensive wall uses the original collision grid.
// V69: all twenty boss worlds gain their own connected, physically opened
// approach complex beyond the great central arena (five families x four).
let tacticalZone=null;
let secondaryYard=null;
let bossApproachPlan=null;
// V80: the twenty boss fights no longer share one featureless 23x23 hall.
// Five *solid* tactical wall languages with four materially different
// footprints. Every cell is an ordinary maze wall, rendered in 3D and tested
// by the SAME player, robot, bullet and explosive collision functions.
// Keep three-cell-wide cardinal approaches and the inner six-tile fight court
// open. Nothing is generated on a staircase, balcony, or mission route.
let bossCourtPlan=null;
// V81: every ordinary central battle square is a navigable 17x17 court
// with its OWN registered masonry, not merely a repaint of the same maze.
// Eight engineering languages x ten layouts, all in mapCells, hence physical
// for robots, players, ray casts, swept projectiles and network battles.
let ordinaryCourtPlan=null;
const ordinaryCourtNames=[
 'ДВОЙНЫЕ БАРРИКАДЫ','УГЛОВЫЕ РЕДУТЫ','ЛОМАНЫЕ ДИАГОНАЛИ',
 'ОСАДНЫЕ ЗИГЗАГИ','ЧЕТЫРЁХЛОПАСТНЫЙ ВЕНТИЛЯТОР',
 'ПРОРЕЗАННЫЕ КОЛЬЦА','ДВОЙНЫЕ КАРМАНЫ',
 'ЗУБЧАТЫЕ КОНТРФОРСЫ','СМЕЩЁННЫЕ ЩИТЫ','СЕКТОРНЫЕ БОЙНИЦЫ'];
function ordinaryCourtCells(plan){
 if(!plan)return [];
 const cells=new Map();
 const dot=(x,z)=>{
  // An open 5-cell-wide pair of axial crossings, three-tile radial hub,
  // and two extra exit cells on every side prevent encircled spawns.
  if(Math.max(Math.abs(x),Math.abs(z))>7||
     Math.abs(x)<=2||Math.abs(z)<=2)return;
  const rot=tacticalRotate(x,z,plan.orientation);
  const X=plan.cx+rot.x,Z=plan.cz+rot.z;
  cells.set(Z*mapSize+X,{x:X,z:Z});
 };
 const line=(x0,z0,x1,z1)=>{
  const n=Math.max(Math.abs(x1-x0),Math.abs(z1-z0));
  for(let i=0;i<=n;i++)dot(Math.round(x0+(x1-x0)*i/n),
   Math.round(z0+(z1-z0)*i/n));
 };
 const block=(x,z,w=2,h=2)=>{
  for(let j=0;j<h;j++)for(let i=0;i<w;i++)dot(x+i,z+j);
 };
 switch(plan.kind){
  case 0: // Parallel barrier banks with lateral exit lanes.
   for(const k of [-1,1]){
    line(-7,k*5,-3,k*5);line(3,k*5,7,k*5);
    line(k*5,-7,k*5,-5);
   }break;
  case 1: // Four separate L-shaped corner redoubts.
   for(const x of [-1,1])for(const z of [-1,1]){
    line(4*x,4*z,7*x,4*z);line(4*x,4*z,4*x,7*z);
   }break;
  case 2: // Oblique fracture lines, yielding diagonal firing channels.
   for(const x of [-1,1])for(const z of [-1,1]){
    line(3*x,7*z,7*x,3*z);
   }break;
  case 3: // Four staggered defensive zigzags.
   for(const k of [-1,1]){
    line(k*7,-7,k*5,-5);line(k*5,-5,k*7,-3);
    line(k*7,3,k*5,5);line(k*5,5,k*7,7);
   }break;
  case 4: // Windmill-shaped corner shields, with gaps to route around.
   for(const x of [-1,1])for(const z of [-1,1]){
    line(3*x,5*z,6*x,5*z);line(6*x,5*z,6*x,7*z);
   }break;
  case 5: // Broken concentric firing walls; never a sealed ring.
   for(const k of [-1,1]){
    line(k*3,k*6,k*7,k*6);line(k*6,k*3,k*6,k*7);
    line(k*3,-k*7,k*5,-k*7);
   }break;
  case 6: // Two U-shaped defence pockets facing inwards.
   for(const k of [-1,1]){
    line(k*4,-7,k*7,-7);line(k*7,-7,k*7,-3);
    line(k*4,7,k*7,7);line(k*7,3,k*7,7);
   }break;
  case 7: // Rectangular armoured teeth with separate bays.
   for(const x of [-1,1])for(const z of [-1,1]){
    block(x<0?-7:5,z<0?-6:5,3,2);
    dot(4*x,4*z);
   }break;
  case 8: // Opposed offset firing shields, open ends.
   line(-7,-5,-4,-5);line(-4,-7,-4,-5);
   line(4,-7,4,-4);line(4,-4,7,-4);
   line(-7,4,-4,4);line(-4,4,-4,7);
   line(4,5,7,5);line(7,3,7,5);break;
  default: // Segmented strongpoints rather than a full wall ring.
   for(const x of [-1,1])for(const z of [-1,1]){
    line(3*x,6*z,6*x,6*z);
    block(x<0?-7:6,z<0?-7:6,2,2);
   }break;
 }
 // Eight deterministic and ACTUALLY physical variants per language: four
 // directions x two distinct armour attachments. The extra cells alter
 // available movement/firing lanes, not just the lighting or texture.
 const attachments=[[-6,-3],[6,-3],[6,3],[-6,3]];
 const [ax,az]=attachments[(plan.variant+plan.kind)%4];
 if(plan.variant<4){block(ax-(ax>0?1:0),az-(az>0?1:0));}
 else{
  const sx=ax>0?1:-1,sz=az>0?1:-1;
  line(sx*3,sz*7,sx*7,sz*7);
  block(sx<0?-6:5,sz<0?-4:3,2,2);
 }
 // A three-bit tactical key cut into the inner corner of all four sectors.
 // The key is NOT rotated with the older motif: opposite orientations must
 // not accidentally collapse different layouts to identical wall footprints.
 // Repeating on each side keeps the identity when stairs occupy one corner.
 const mask=plan.variant;
 const signature=[[3,3],[3,4],[4,3]];
 for(let bit=0;bit<3;bit++)if(mask&(1<<bit)){
  const [a,b]=signature[bit];
  for(const sx of [-1,1])for(const sz of [-1,1]){
   const X=plan.cx+sx*a,Z=plan.cz+sz*b;
   cells.set(Z*mapSize+X,{x:X,z:Z});
  }
 }
 return [...cells.values()];
}
// V82: a THIRD, ground-accessible combat destination outside the main court.
// Its 8 engineering families and 10 strictly geometric signatures are not
// render-only decorations: every barricade uses the original mapCells grid.
// The dedicated 13x13 clearing has two independent walking approaches.
let relayFortPlan=null;
const relayFortNames=[
 'РАЗДЕЛЁННЫЙ ТРАНЗИТ','ЧЕТЫРЕ ШЛЮЗА','ПЕРЕХВАТНЫЕ ТЕРРАСЫ',
 'КОСЫЕ БАРЬЕРЫ','ПЕРЕКРЁСТНЫЕ УКРЫТИЯ','ПОСТУПЕННЫЕ ЗУБЦЫ',
 'ОБОРОННАЯ ШАХМАТКА','ПАРНЫЕ ВОГНУТЫЕ ФОРТЫ'];
function relayFortCells(plan){
 if(!plan)return [];
 const points=new Map();
 const radius=plan.radius||7;
 // Dense balcony cities may only admit a genuine 7x7 roadside outpost;
 // these three-corner gun shields are also physical mapCells, never art.
 if(radius===3){
  for(const sx of [-1,1])for(const sz of [-1,1]){
   for(const [dx,dz] of [[2,2],[2,3],[3,2]]){
    const x=plan.cx+sx*dx,z=plan.cz+sz*dz;
    points.set(z*mapSize+x,{x,z});
   }
  }
  const sx=plan.variant%2===0?1:-1,sz=plan.kind%2===0?1:-1;
  const x=plan.cx+sx*3,z=plan.cz+sz*3;
  points.set(z*mapSize+x,{x,z});
  return [...points.values()];
 }
 const compress=a=>radius===7?a:Math.sign(a)*Math.round(2+(Math.abs(a)-3)*(radius-3)/3);
 const dot=(x,z)=>{
  if(Math.abs(x)>6||Math.abs(z)>6||
    Math.abs(x)<=2||Math.abs(z)<=2)return;
  const r=tacticalRotate(compress(x),compress(z),plan.orientation);
  const X=plan.cx+r.x,Z=plan.cz+r.z;
  points.set(Z*mapSize+X,{x:X,z:Z});
 };
 const stroke=(x0,z0,x1,z1)=>{
  const n=Math.max(Math.abs(x1-x0),Math.abs(z1-z0));
  if(!n){dot(x0,z0);return;}
  for(let t=0;t<=n;t++)dot(Math.round(x0+(x1-x0)*t/n),
    Math.round(z0+(z1-z0)*t/n));
 };
 const pad=(x,z,w=2,h=2)=>{
  for(let j=0;j<h;j++)for(let i=0;i<w;i++)dot(x+i,z+j);
 };
 switch(plan.kind){
  case 0: // Paired dividing screens, long flanking diagonal detours.
   for(const z of [-1,1]){
    stroke(-6,z*4,-3,z*4);stroke(3,z*6,6,z*6);
   }break;
  case 1: // Offset lock gates, three open sides around each armoured corner.
   for(const x of [-1,1])for(const z of [-1,1]){
    stroke(3*x,3*z,6*x,3*z);stroke(6*x,3*z,6*x,5*z);
   }break;
  case 2: // Alternating stepped trench banks with gaps on every side.
   for(const z of [-1,1]){
    stroke(-6,3*z,-4,3*z);stroke(-4,3*z,-4,5*z);
    stroke(4,4*z,6,4*z);
   }break;
  case 3: // Four angled firing walls preserve broad axial corridors.
   for(const x of [-1,1])for(const z of [-1,1])
    stroke(3*x,6*z,6*x,3*z);
   break;
  case 4: // Separate quadrant crossfire outposts, no sealed chamber.
   for(const x of [-1,1])for(const z of [-1,1]){
    stroke(4*x,3*z,4*x,6*z);stroke(3*x,5*z,6*x,5*z);
   }break;
  case 5: // Heavy opposing wall teeth with diagonal interleaving.
   for(const x of [-1,1])for(const z of [-1,1]){
    stroke(3*x,4*z,5*x,4*z);stroke(5*x,4*z,5*x,6*z);
    dot(6*x,6*z);
   }break;
  case 6: // Staggered 2x2 bunkers and single interstitial shields.
   for(const x of [-1,1])for(const z of [-1,1]){
    pad(x<0?-6:5,z<0?-6:5,2,2);
    dot(3*x,5*z);
   }break;
  default: // Opposed U-shaped firing pockets with accessible mouths.
   for(const x of [-1,1])for(const z of [-1,1]){
    stroke(3*x,6*z,6*x,6*z);stroke(6*x,6*z,6*x,4*z);
   }break;
 }
 // Ten non-overlapping physical signatures, even for rotation-symmetric
 // families. Reserve four NE cells for the binary signature *after* rotating
 // the engineering motif; removing old marks ensures an exact 4-bit key.
 const a=radius===7?3:2;
 const signature=[[a,a],[a,a+1],[a+1,a],[a+1,a+1]];
 for(let bit=0;bit<4;bit++){
  const [dx,dz]=signature[bit],x=plan.cx+dx,z=plan.cz+dz;
  const key=z*mapSize+x;
  points.delete(key);
  if((plan.variant+1)&(1<<bit))points.set(key,{x,z});
 }
 return [...points.values()];
}
// V83: physical extraction approaches. A portal is a destination, not an
// empty marker hidden in an otherwise reused side room. Ten engineering
// languages x ten actual tactical signatures produce staggered cover, open
// flanks, and side entry choices. These are wall GRID CELLS: renderer and
// movement / projectile physics share exactly the same blocked volume.
let extractionCourtPlan=null;
const extractionCourtNames=[
 'КРЕСТОВЫЕ РЕДУТЫ','РАЗНОСНЫЕ БЛОКПОСТЫ','ЗУБЧАТЫЙ ВЫХОД',
 'ДИАГОНАЛЬНЫЕ ЗАСЛОНЫ','ЧЕТЫРЕ ОТКРЫТЫХ БАСТИОНА',
 'ПРОРЕЗАННЫЕ КАРМАНЫ','СЕКТОРНЫЕ ПРОТИВОЩИТЫ',
 'ШЕВРОННЫЕ ПЕРЕХВАТЫ','РАЗОРВАННЫЕ ПОЛУКОЛЬЦА','КРЕПОСТНЫЕ СКОБЫ'];
function extractionCourtCells(plan){
 if(!plan)return [];
 const found=new Map();
 const put=(x,z)=>{
  // All cardinal walkways remain at least three cells wide, with a broad
  // unblocked centre for spawning the portal and reaching it on foot.
  if(Math.max(Math.abs(x),Math.abs(z))>5||
     Math.abs(x)<=1||Math.abs(z)<=1)return;
  const r=tacticalRotate(x,z,plan.orientation);
  const X=plan.cx+r.x,Z=plan.cz+r.z;
  found.set(Z*mapSize+X,{x:X,z:Z});
 };
 const line=(x0,z0,x1,z1)=>{
  const n=Math.max(Math.abs(x1-x0),Math.abs(z1-z0));
  for(let k=0;k<=n;k++)put(Math.round(x0+(x1-x0)*k/n),
   Math.round(z0+(z1-z0)*k/n));
 };
 const rect=(x,z,w=2,h=2)=>{
  for(let i=0;i<w;i++)for(let j=0;j<h;j++)put(x+i,z+j);
 };
 switch(plan.kind){
  case 0: // Opposed cross-shaped defense cells; diagonal entries remain.
   for(const side of [-1,1]){
    line(side*3,2,side*3,5);line(side*2,-3,side*5,-3);
   }break;
  case 1: // Three staggered barricades, never one solid crosswise wall.
   line(-5,-4,-2,-4);line(2,-3,5,-3);
   line(-4,4,-4,2);line(4,2,4,5);break;
  case 2: // Castle teeth and clear two-sided breakthrough passages.
   for(const side of [-1,1]){
    line(side*2,-5,side*4,-5);
    line(side*5,2,side*5,4);
    put(side*3,3);
   }break;
  case 3: // Discrete oblique armour segments.
   for(const sx of [-1,1])for(const sz of [-1,1])
    line(sx*2,sz*5,sx*5,sz*2);
   break;
  case 4: // Outward-pointed four corner towers.
   for(const sx of [-1,1])for(const sz of [-1,1]){
    line(sx*3,sz*3,sx*5,sz*3);
    line(sx*3,sz*3,sx*3,sz*5);
   }break;
  case 5: // Open U pockets with an exposed approach at the inside.
   for(const sx of [-1,1]){
    line(sx*5,-5,sx*5,-2);
    line(sx*5,5,sx*5,2);
    line(sx*3,-5,sx*5,-5);
   }break;
  case 6: // Corner bays protect the side approaches, never the centre.
   rect(-5,-5,2,2);rect(4,4,2,2);
   line(-5,3,-3,3);line(3,-5,3,-3);break;
  case 7: // Chevrons create distinct firefight angles and flank choices.
   for(const sx of [-1,1])for(const sz of [-1,1]){
    line(sx*2,sz*4,sx*4,sz*2);
    put(sx*5,sz*5);
   }break;
  case 8: // Segmented perimeters with cardinal doors and diagonal gaps.
   for(const sx of [-1,1]){
    line(sx*2,5,sx*5,5);
    line(sx*5,-5,sx*5,-3);
    put(sx*3,-3);
   }break;
  default: // Four linked but non-enclosing corner brackets.
   for(const sx of [-1,1])for(const sz of [-1,1]){
    line(sx*2,sz*4,sx*4,sz*4);
    put(sx*4,sz*3);
   }break;
 }
 // A real four-bit physical key is added after rotation so symmetric
 // patterns have distinct, testable collision silhouettes. These four cells
 // occupy a single quadrant, leaving the cardinal entrance lanes open.
 const signature=[[2,2],[2,3],[3,2],[3,3]];
 for(let bit=0;bit<4;bit++){
  const [dx,dz]=signature[bit],x=plan.cx+dx,z=plan.cz+dz;
  const key=z*mapSize+x;
  found.delete(key);
  if((plan.variant+1)&(1<<bit))found.set(key,{x,z});
 }
 return [...found.values()];
}
const bossCourtNames=['РАЗДВОЕННАЯ КРЕПОСТЬ','ЧЕТЫРЕ УГЛОВЫХ БАСТИОНА',
 'ЛОМАНЫЕ ОСАДНЫЕ ХРЕБТЫ','РАЗОРВАННЫЙ ПЕРИМЕТР','АСИММЕТРИЧНЫЕ ЩИТЫ'];
function bossCourtCells(plan){
 if(!plan)return [];
 const points=new Map(),variant=plan.variant,kind=plan.kind;
 const dot=(x,z)=>{
  // Preserve the actual spawn/centre, upper central stairs and broad routes.
  if(Math.max(Math.abs(x),Math.abs(z))>10||
     Math.max(Math.abs(x),Math.abs(z))<7||
     Math.abs(x)<=2||Math.abs(z)<=2)return;
  const r=tacticalRotate(x,z,plan.orientation),X=plan.cx+r.x,Z=plan.cz+r.z;
  points.set(Z*mapSize+X,{x:X,z:Z});
 };
 const run=(x0,z0,x1,z1)=>{
  const n=Math.max(Math.abs(x1-x0),Math.abs(z1-z0));
  for(let i=0;i<=n;i++)dot(Math.round(x0+(x1-x0)*i/n),
    Math.round(z0+(z1-z0)*i/n));
 };
 const block=(x,z,w,h)=>{
  for(let j=0;j<h;j++)for(let i=0;i<w;i++)dot(x+i,z+j);
 };
 switch(kind){
  case 0: // Facing long shields, wide independent northern/southern gates.
   for(const side of [-1,1]){
    run(side*8,-9,side*8,-4);
    run(side*8,4,side*8,9);
    run(side*9,side*5,side*10,side*5);
   }
   break;
  case 1: // Massive offset L-shaped corner redoubts with open flank aisles.
   for(const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){
    run(sx*7,sz*7,sx*10,sz*7);
    run(sx*7,sz*7,sx*7,sz*9);
   }
   break;
  case 2: // Interrupted diagonal zigzags, never a sealed complete diagonal.
   for(const side of [-1,1]){
    run(side*6,side*9,side*9,side*6);
    run(side*6,-side*9,side*9,-side*6);
    block(side<0?-10:9,side<0?-5:4,2,2);
   }
   break;
  case 3: // Alternating broken perimeter embattlements, not one closed ring.
   for(const side of [-1,1]){
    run(-9,side*9,-5,side*9);
    run(5,side*9,9,side*9);
    run(side*10,-7,side*10,-4);
    run(side*10,4,side*10,7);
   }
   break;
  default: // Three asymmetrical linked bulletproof screens and side wings.
   run(-10,-7,-7,-7);run(-7,-9,-7,-6);
   run(7,-9,7,-6);run(7,-6,10,-6);
   run(-9,7,-6,7);run(-6,7,-6,10);
   run(6,7,10,7);run(9,7,9,10);
   break;
 }
 // Four distinct structural extensions change actual ground silhouettes,
 // not colour, lighting, or purely decorative overhead meshes.
 const variations=[[-9,6],[9,-6],[-6,-9],[6,9]];
 const [ax,az]=variations[variant];
 block(ax-(ax>0?1:0),az-(az>0?1:0),2,2);
 for(let j=0;j<=variant;j++){
  const shift=j*2-variant;
  if(kind%2===0)run(ax>0?9:-9,az>0?4+shift:-4+shift,
    ax>0?10:-10,az>0?4+shift:-4+shift);
  else run(ax>0?7:-7,az>0?8:-8,
    ax>0?7:-7,az>0?9:-9);
 }
 return [...points.values()];
}
const tacticalNames=['КРЕСТОВОЙ УЗЕЛ','КОЛЬЦЕВОЙ ДВОР','ПОРТОВЫЕ ГРЕБЁНКИ',
 'СПИРАЛЬНЫЙ ПРОХОД','ДИАГОНАЛЬНЫЕ НОЖНИЦЫ','ОБОРОННЫЕ КЛЕЩИ',
 'ШЕСТИЛУЧЕВОЙ ФОРПОСТ','ДВОЙНОЙ ДВОР'];
function tacticalRotate(dx,dz,orientation=0){
 if(orientation===1)return {x:-dz,z:dx};
 if(orientation===2)return {x:-dx,z:-dz};
 if(orientation===3)return {x:dz,z:-dx};
 return {x:dx,z:dz};
}
function tacticalCells(plan){
 const cells=new Map();
 const add=(x,z)=>{
  if(Math.abs(x)>6||Math.abs(z)>6)return;
  const p=tacticalRotate(x,z,plan.orientation||0);
  const X=plan.cx+p.x,Z=plan.cz+p.z;
  cells.set(Z*mapSize+X,{x:X,z:Z});
 };
 const pad=(x,z,rx,rz=rx)=>{
  for(let dz=-rz;dz<=rz;dz++)for(let dx=-rx;dx<=rx;dx++)add(x+dx,z+dz);
 };
 const lane=(x0,z0,x1,z1,width=0)=>{
  const steps=Math.max(Math.abs(x1-x0),Math.abs(z1-z0));
  for(let i=0;i<=steps;i++){
   const x=Math.round(x0+(x1-x0)*i/steps),z=Math.round(z0+(z1-z0)*i/steps);
   pad(x,z,width);
  }
 };
 const kind=plan.kind;
 if(kind===0){
  // Four crossroads, with four offset guard yards at the terminal nodes.
  pad(0,0,2);
  for(const [dx,dz] of [[6,0],[-6,0],[0,6],[0,-6]]){
   lane(0,0,dx,dz,1);pad(dx,dz,1);
  }
 }else if(kind===1){
  // A continuous hollow ring with one genuine bridge into its centre.
  for(let z=-5;z<=5;z++)for(let x=-5;x<=5;x++){
   const r=Math.max(Math.abs(x),Math.abs(z));
   if(r>=3&&r<=5)add(x,z);
  }
  pad(0,0,1);lane(0,0,5,0,0);
 }else if(kind===2){
  // Three navigable docking fingers connect to one vertical service quay.
  lane(-5,-5,-5,5,1);
  for(const z of [-4,0,4]){
   lane(-5,z,5,z,1);pad(5,z,1);
  }
 }else if(kind===3){
  // A continuous square spiral returns from perimeter to the inner hub.
  const path=[[-5,-5],[5,-5],[5,5],[-5,5],[-5,-2],[2,-2],
   [2,2],[-2,2],[-2,0],[0,0]];
  for(let i=1;i<path.length;i++)lane(...path[i-1],...path[i],0);
  pad(0,0,1);
 }else if(kind===4){
  // Crossing diagonal sight-lines around a compact open central plaza.
  lane(-6,-6,6,6,1);lane(-6,6,6,-6,1);pad(0,0,2);
  for(const x of [-5,5])for(const z of [-5,5])pad(x,z,1);
 }else if(kind===5){
  // Defensive pincers attack the same lane from two offset side aisles.
  lane(0,-6,0,6,1);
  for(const side of [-1,1]){
   lane(0,-4,side*5,-5,1);lane(side*5,-5,side*5,5,0);
   lane(side*5,5,0,4,1);
  }
 }else if(kind===6){
  // Six spokes end in different firing bays, with a broad hexagonal core.
  pad(0,0,2);
  for(let i=0;i<6;i++){
   const a=i*Math.PI/3,dx=Math.round(Math.cos(a)*6),dz=Math.round(Math.sin(a)*6);
   lane(0,0,dx,dz,1);pad(dx,dz,1);
  }
 }else{
  // Two asymmetric courtyards with a narrow throat and second bypass.
  pad(-4,-2,2);pad(4,2,2);
  lane(-4,-2,4,2,1);lane(-4,2,4,-2,1);
  pad(0,0,1);
 }
 return [...cells.values()];
}
const secondaryYardNames=[
 'ДВОЙНОЙ РУБЕЖ','БОКОВАЯ ПОТЕРНА','РОМБОВЫЙ ПЕРЕХВАТ',
 'ТРОЙНОЙ ЗИГЗАГ','ДВОРЫ С ОБХОДОМ','ЧЕТЫРЕ ПОСТА',
 'ВЕЕР ВЫЛАЗОК','СДВОЕННЫЕ КОЛЬЦА','КОСОЙ КОРИДОР',
 'ШАХМАТНАЯ ЦИТАДЕЛЬ'
];
function secondaryYardCells(plan){
 const cells=new Map();
 const add=(x,z)=>{
  if(Math.abs(x)>7||Math.abs(z)>7)return;
  const p=tacticalRotate(x,z,plan.orientation);
  const X=plan.cx+p.x,Z=plan.cz+p.z;
  cells.set(Z*mapSize+X,{x:X,z:Z});
 };
 const pad=(x,z,rx=0,rz=rx)=>{
  for(let dz=-rz;dz<=rz;dz++)for(let dx=-rx;dx<=rx;dx++)add(x+dx,z+dz);
 };
 const lane=(x0,z0,x1,z1,width=0)=>{
  const steps=Math.max(Math.abs(x1-x0),Math.abs(z1-z0));
  if(!steps){pad(x0,z0,width);return;}
  for(let i=0;i<=steps;i++){
   const x=Math.round(x0+(x1-x0)*i/steps);
   const z=Math.round(z0+(z1-z0)*i/steps);
   pad(x,z,width);
  }
 };
 const elbow=(x0,z0,x1,z1,viaX=true)=>{
  if(viaX){lane(x0,z0,x1,z0);lane(x1,z0,x1,z1);}
  else{lane(x0,z0,x0,z1);lane(x0,z1,x1,z1);}
 };
 switch(plan.kind){
  case 0: // twin defended parallel avenues, three accessible crossbridges
   for(const x of [-4,4])lane(x,-5,x,5,1);
   for(const z of [-4,0,4])lane(-4,z,4,z);
   break;
  case 1: // stepped E-pattern: one continuous logistics spine and side fingers
   lane(-5,-5,-5,5,1);
   for(const z of [-4,0,4]){lane(-5,z,4,z);pad(4,z,1);}
   lane(4,-4,4,0);break;
  case 2: // hollow diamond around a central firing position
   for(const [x0,z0,x1,z1] of [[0,-5,5,0],[5,0,0,5],
    [0,5,-5,0],[-5,0,0,-5]])lane(x0,z0,x1,z1,1);
   lane(-5,0,5,0);pad(0,0,1);break;
  case 3: // zigzag with an independent reverse-flanking return passage
   {const points=[[-5,-5],[4,-5],[4,-1],[-4,-1],[-4,3],[5,3],[5,5]];
    for(let k=1;k<points.length;k++)lane(...points[k-1],...points[k]);}
   lane(-5,-5,-5,5);lane(-5,5,5,5);pad(0,0,1);break;
  case 4: // opposite plazas joined by a bent throat and exterior bypass
   pad(-4,-3,2);pad(4,3,2);
   elbow(-4,-3,4,3,true);elbow(-4,-3,4,3,false);
   break;
  case 5: // four separately defensible rooms and two crossed connectors
   for(const x of [-4,4])for(const z of [-4,4])pad(x,z,1);
   lane(-4,-4,4,-4);lane(-4,4,4,4);
   lane(-4,-4,-4,4);lane(4,-4,4,4);
   lane(-4,0,4,0);pad(0,0,1);break;
  case 6: // broad service core, radial exits, offset facing galleries
   pad(0,0,2);
   for(const [x,z] of [[-5,0],[5,0],[0,-5],[0,5],[-4,-4],[4,4]])
    lane(0,0,x,z,1);
   lane(-5,-3,-5,3);lane(5,-3,5,3);break;
  case 7: // two overlapping rings with distinct interior crosswalks
   for(const [ox,oz] of [[-2,-2],[2,2]]){
    for(let z=-3;z<=3;z++)for(let x=-3;x<=3;x++)
     if(Math.max(Math.abs(x),Math.abs(z))>=2)add(ox+x,oz+z);
   }
   lane(-2,-2,2,2,1);pad(0,0,1);break;
  case 8: // angled double chicane, high-cover corners preserved as solid maze
   lane(-5,-5,5,-5,1);lane(5,-5,5,5,1);
   lane(5,5,-5,5,1);lane(-5,5,-5,-2);
   lane(-5,-2,2,-2);lane(2,-2,2,2);lane(2,2,-2,2);
   pad(0,0,1);break;
  default: // alternating four guard courts linked by offset corridors
   for(const [x,z] of [[-4,-4],[4,-4],[-4,4],[4,4]])pad(x,z,1);
   lane(-4,-4,4,-4);lane(-4,4,4,4);
   elbow(-4,-4,4,4,false);elbow(4,-4,-4,4,true);
   pad(0,0,1);lane(-4,0,4,0);
 }
 // Eight unique flanking entrances for EACH base topology; these are real
 // passages, never recoloured or merely decorative clones. Local marker
 // endpoints live at radius seven, beyond every family's entire base,
 // including its one-tile shoulder widths. Each profile must be distinct.
 const entrances=[[-7,-7],[0,-7],[7,-7],[7,0],
  [7,7],[0,7],[-7,7],[-7,0]];
 const target=entrances[plan.variant];
 elbow(0,0,target[0],target[1],plan.variant%2===0);
 return [...cells.values()];
}
const bossApproachNames=[
 'ЛУЧЕВОЙ ФОРТ','ИМПЕРСКИЕ ВРАТА','ДВА КОЛЬЦА ОСАДЫ',
 'РАЗОРВАННЫЕ БАСТИОНЫ','ЗИГЗАГИ ШТУРМА'
];
function bossApproachCells(plan){
 const cells=new Map();
 const add=(x,z)=>{
  if(Math.abs(x)>7||Math.abs(z)>7)return;
  const t=tacticalRotate(x,z,plan.orientation);
  const X=plan.cx+t.x,Z=plan.cz+t.z;
  cells.set(Z*mapSize+X,{x:X,z:Z});
 };
 const pad=(x,z,rx=0,rz=rx)=>{
  for(let dz=-rz;dz<=rz;dz++)for(let dx=-rx;dx<=rx;dx++)add(x+dx,z+dz);
 };
 const lane=(x0,z0,x1,z1,width=0)=>{
  const steps=Math.max(Math.abs(x1-x0),Math.abs(z1-z0));
  if(!steps){pad(x0,z0,width);return;}
  for(let i=0;i<=steps;i++)pad(
   Math.round(x0+(x1-x0)*i/steps),
   Math.round(z0+(z1-z0)*i/steps),width);
 };
 const elbow=(x0,z0,x1,z1,horizontalFirst=true)=>{
  if(horizontalFirst){lane(x0,z0,x1,z0);lane(x1,z0,x1,z1);}
  else{lane(x0,z0,x0,z1);lane(x0,z1,x1,z1);}
 };
 switch(plan.kind){
  case 0: // six long assault spokes into one generous forward command court
   pad(0,0,2);
   for(const [x,z] of [[-5,0],[5,0],[0,-5],[0,5],[-4,-4],[4,4]])
    lane(0,0,x,z,1);
   lane(-5,-3,-5,3);lane(5,-3,5,3);
   break;
  case 1: // two different gatehouses with long, parallel side passages
   pad(-4,-3,2);pad(4,3,2);
   lane(-4,-3,4,-3,1);lane(4,-3,4,3,1);
   lane(-4,-3,-4,3,1);lane(-4,3,4,3,1);
   pad(0,0,1);lane(-4,0,4,0);
   break;
  case 2: // offset solid concentric rings, both with true access to the core
   for(let z=-5;z<=5;z++)for(let x=-5;x<=5;x++){
    const r=Math.max(Math.abs(x),Math.abs(z));
    if(r>=4||r===2)add(x,z);
   }
   pad(0,0,1);lane(-5,0,5,0);lane(0,-5,0,5);
   break;
  case 3: // four offset bastion courtyards with two crosswise bypasses
   for(const [x,z] of [[-4,-3],[4,-3],[-4,3],[4,3]])pad(x,z,1);
   lane(-4,-3,4,-3);lane(-4,3,4,3);
   lane(-4,-3,-4,3);lane(4,-3,4,3);
   lane(-4,0,4,0);lane(0,-3,0,3);
   pad(0,0,1);
   break;
  default: // interwoven siege zigzags and an independent defensive exit
   {const points=[[-5,-5],[5,-5],[5,-1],[-4,-1],[-4,3],[5,3],[5,5]];
    for(let k=1;k<points.length;k++)lane(...points[k-1],...points[k],1);}
   lane(-5,-5,-5,5);lane(-5,5,5,5);
   pad(0,0,2);
 }
 // The four processional flanks are located beyond the largest base
 // footprints, so their intersections cannot collapse to the same design.
 const approaches=[[-7,-7],[7,-7],[7,7],[-7,7]];
 const end=approaches[plan.variant];
 elbow(0,0,end[0],end[1],plan.variant%2===0);
 return [...cells.values()];
}
function buildMap(level){
  mapSize=55+8*Math.min(2,Math.floor((level-1)/6));
  const center=Math.floor(mapSize/2),boss=level%5===0;
  worldMapBoss=boss;
  let seed=(Math.imul(level,2654435761) ^ 0x75931c5b)>>>0;
  const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const irand=(lo,hi)=>lo+Math.floor(rng()*(hi-lo+1));
  const m=Array.from({length:mapSize},()=>Array(mapSize).fill(1));
  const rooms=[];
  sectorStyle=(level===legacyResumeSector?(level-1)%legacyResumeDivisor:(level-1)%18);
  sectorArchitecture=['ЦИТАДЕЛЬ','РЕАКТОРНЫЕ КОЛЬЦА','БАСТИОНЫ НАД ПЛОЩАДЬЮ','НЕБЕСНЫЕ ДОКИ','АМФИТЕАТР КАРНИЗОВ','ГРУЗОВЫЕ ВЕРФИ','ГОРОД БАЛКОНОВ','ЗАТОПЛЕННЫЙ ТРАНЗИТ','ЗВЁЗДНАЯ ОБСЕРВАТОРИЯ','КАМЕННЫЙ КАНЬОН','КРИСТАЛЬНАЯ ГАВАНЬ','ТИТАНОВАЯ КУЗНЯ','ВЕРТИКАЛЬНАЯ ВЕРФЬ','ЛЕСТНИЧНАЯ ЦИТАДЕЛЬ','ВОЗДУШНЫЙ КОЛЛЕКТОР','ТИТАНОВЫЙ АТРИУМ','КРИОГЕННЫЙ ШПИЛЬ','ГРАВИТАЦИОННАЯ ФАБРИКА'][sectorStyle];
  function carve(x,z,r=0){for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){
    let xx=x+dx,zz=z+dz;
    if(xx>1&&zz>1&&xx<mapSize-2&&zz<mapSize-2)m[zz][xx]=0;
  }}
  function rect(x,z,w,h){for(let j=z;j<z+h;j++)for(let i=x;i<x+w;i++)carve(i,j)}
  function road(a,b,wide=1,reverse=false){
    let horizontalFirst=reverse?false:(((a.x*17+a.z*11+b.x*7+level)%3)!==0);
    if(horizontalFirst){for(let x=Math.min(a.x,b.x);x<=Math.max(a.x,b.x);x++)carve(x,a.z,wide);for(let z=Math.min(a.z,b.z);z<=Math.max(a.z,b.z);z++)carve(b.x,z,wide)}
    else{for(let z=Math.min(a.z,b.z);z<=Math.max(a.z,b.z);z++)carve(a.x,z,wide);for(let x=Math.min(a.x,b.x);x<=Math.max(a.x,b.x);x++)carve(x,b.z,wide)}
  }
  const hub={x:center,z:center};
  rect(center-(boss?11:6),center-(boss?11:6),boss?23:13,boss?23:13);
  rooms.push(hub);
  if(sectorStyle>=14)rect(center-16,center-16,33,33); // guaranteed safe two-floor transit hub
  // Ten genuinely different spatial blueprints. Alternate routes are always
  // carved into the same connected cell grid used by AI and projectile tracing.
  const count=12,ringR=(mapSize-1)*.34;
  let anchors=[];
  const chamber=(x,z,w=9,h=9)=>{
    x=clamp(Math.round(x),6,mapSize-7);z=clamp(Math.round(z),6,mapSize-7);
    const p={x,z,w,h};anchors.push(p);
    rect(x-Math.floor(w/2),z-Math.floor(h/2),w,h);rooms.push(p);
    return p;
  };
  if(sectorStyle===0||sectorStyle===1||sectorStyle===3){
    // Original circular citadel network; each variant has its own cross links.
    for(let k=0;k<count;k++){
      const a=k*TAU/count-Math.PI/2,r=ringR+irand(-2,2);
      chamber(center+Math.cos(a)*r+irand(-2,2),center+Math.sin(a)*r+irand(-2,2),irand(7,11),irand(7,11));
    }
    anchors.forEach((p,k)=>{
      road(p,hub,sectorStyle===0||boss?2:1);
      if(k%2===0||sectorStyle!==4)road(p,anchors[(k+1)%count],sectorStyle===1?2:1);
      if(sectorStyle===3&&k%3===0)road(p,anchors[(k+3)%count],1,true);
    });
  }else if(sectorStyle===2){
    // FOUR BASTIONS: open central square, fortress courts at the corners;
    // each bastion receives its own climbable upper firing balcony below.
    rect(center-10,center-10,21,21);
    for(const dx of [-17,17])for(const dz of [-14,14]){
      const fort=chamber(center+dx,center+dz,13,11);
      road(fort,{x:center+Math.sign(dx)*9,z:fort.z},2);
      road({x:center+Math.sign(dx)*9,z:fort.z},hub,1,dz>0);
    }
    road(anchors[0],anchors[1],2);road(anchors[2],anchors[3],2);
    road(anchors[0],anchors[2],1,true);road(anchors[1],anchors[3],1,true);
  }else if(sectorStyle===4){
    // AMPHITHEATRE: broad central arena; radial spectator arcades outside it.
    rect(center-13,center-13,27,27);
    for(let k=0;k<8;k++){
      const a=k*TAU/8,rad=mapSize*.33;
      chamber(center+Math.cos(a)*rad,center+Math.sin(a)*rad,11,11);
    }
    anchors.forEach((p,k)=>{
      road(p,hub,k%2===0?2:1);
      road(p,anchors[(k+1)%anchors.length],1,k%2===1);
    });
  }else if(sectorStyle===5){
    // CARGO SHIPYARD: two rows of long rectangular hangars; broad freight
    // corridors, transverse gantries and a central transport spine.
    for(const side of [-1,1])for(let i=0;i<5;i++){
      const x=7+i*(mapSize-14)/4,z=center+side*(mapSize*.26);
      chamber(x,z,8,11);
    }
    rect(center-2,5,5,mapSize-10);
    rect(5,center-2,mapSize-10,5);
    anchors.forEach((p,k)=>{road(p,{x:p.x,z:center},2);road({x:p.x,z:center},hub,2);
      if(k%5!==4)road(p,anchors[k+1],1);
    });
  }else if(sectorStyle===6){
    // BALCONY CITY: one long main street with alternating tenement courts,
    // diagonal bypasses and upper galleries overlooking the street.
    rect(center-4,4,9,mapSize-8);
    rect(5,center-3,mapSize-10,7);
    for(let i=0;i<4;i++)for(const side of [-1,1]){
      const z=center-18+i*12,x=center+side*17;
      const r=chamber(x,z,11,11);
      road(r,{x:center,z:r.z},2,i%2===0);
      if(i>0)road(r,anchors[2*(i-1)+(side===-1?0:1)],1,side>0);
    }
  }else if(sectorStyle===7){
    // FLOODED TRANSIT: winding channel with lateral pumping-station chambers.
    const left=7,right=mapSize-8;
    let last=hub;
    for(let i=0;i<11;i++){
      const u=i/10,x=left+(right-left)*u;
      const z=center+Math.sin(i*1.16)*(mapSize*.23);
      const p=chamber(x,z,(i%3===0?11:7),(i%3===0?10:8));
      road(last,p,i%3===0?2:1,i%2===0);last=p;
      if(i>2&&i%3===0)road(p,anchors[i-3],1,true);
    }
    road(last,hub,1,true);
    rect(center-3,center-3,7,7);
  }else if(sectorStyle===8){
    // OBSERVATORY: concentric viewing decks with radial routes and a central
    // telescope nave. Distinct loops create several ways around obstacles.
    for(let ring=0;ring<2;ring++){
      const radius=ring===0?mapSize*.21:mapSize*.36;
      for(let k=0;k<8;k++){
        const a=k*TAU/8+(ring?Math.PI/8:0);
        chamber(center+Math.cos(a)*radius,center+Math.sin(a)*radius,ring?8:7,ring?8:7);
      }
    }
    for(let ring=0;ring<2;ring++)for(let k=0;k<8;k++){
      const p=anchors[ring*8+k];
      road(p,anchors[ring*8+(k+1)%8],1);
      if(ring===0)road(p,hub,1);
      else road(p,anchors[k],1,true);
    }
    rect(center-8,center-4,17,9);
  }else if(sectorStyle===10){
    // CRYSTAL HARBOR: two transverse harbor lanes, four quay decks,
    // loop bridges around water channels, plus maintenance slips.
    rect(5,center-2,mapSize-10,5);rect(center-2,5,5,mapSize-10);
    for(let side of [-1,1])for(let k=0;k<5;k++){
      const xx=8+k*(mapSize-16)/4, zz=center+side*mapSize*.28;
      const p=chamber(xx,zz,10,k%2===0?9:12);
      road(p,{x:p.x,z:center},1,k%2===0);
      if(k>0)road(p,anchors[anchors.length-2],1,true);
    }
    for(let u=0;u<4;u++){
      const x=8+u*(mapSize-16)/3;
      rect(Math.floor(x)-1,8,3,mapSize-16);
    }
  }else if(sectorStyle===11){
    // TITANIUM FORGE: concentric rectangular furnace rings,
    // cross-shaped slag channels and broad service bypasses.
    for(let radius=9;radius<mapSize*.44;radius+=9){
      const r=Math.round(radius);
      for(const side of [-1,1])for(let k=-1;k<=1;k++){
        const p=chamber(center+k*r*.74,center+side*r,8,8);
        road(p,{x:center,z:center+side*r},2,k%2===0);
      }
      rect(center-r,center-r,2*r+1,3);rect(center-r,center+r-2,2*r+1,3);
      rect(center-r,center-r,3,2*r+1);rect(center+r-2,center-r,3,2*r+1);
    }
    rect(center-2,4,5,mapSize-8);rect(4,center-2,mapSize-8,5);
  }else if(sectorStyle===12){
    // VERTICAL SHIPYARD: freight chambers connected with a spine and
    // raised gantries / accessible stair decks in the later elevation pass.
    rect(center-3,5,7,mapSize-10);
    for(let k=0;k<4;k++){
      const zz=10+k*(mapSize-20)/3;
      for(const side of [-1,1]){
        const r=chamber(center+side*(mapSize*.27),zz,11,11);
        road(r,{x:center,z:zz},2,k%2===0);
        if(k>0)road(r,anchors[anchors.length-3],1,true);
      }
    }
    rect(7,center-2,mapSize-14,5);
  }else if(sectorStyle===13){
    // STAIRKEEP: monumental central amphitheatre plus paired stair landings.
    rect(center-10,center-10,21,21);
    for(let ring=0;ring<2;ring++){
      const radius=ring===0?mapSize*.24:mapSize*.37;
      for(let k=0;k<8;k++){
        const angle=k*TAU/8+(ring?Math.PI/8:0);
        chamber(center+Math.cos(angle)*radius,center+Math.sin(angle)*radius,11,11);
      }
    }
    anchors.forEach((r,k)=>{
      road(r,k<8?hub:anchors[k-8],2,k%2===0);
      road(r,anchors[(k<8?0:8)+((k+1)%8)],1);
    });
    rect(center-3,4,7,mapSize-8);
  }else if(sectorStyle===14){
    // SKY COLLECTOR: a giant open industrial crossing, two wide service
    // boulevards, elevated central tram bridge and 12 distribution galleries.
    rect(center-3,4,7,mapSize-8);
    rect(4,center-3,mapSize-8,7);
    for(let k=0;k<6;k++)for(const side of [-1,1]){
      const x=7+k*(mapSize-14)/5,z=center+side*(mapSize*.34);
      const p=chamber(x,z,9+(k%2)*2,10);
      road(p,{x:p.x,z:center},2,k%2===0);
      if(k>0)road(p,anchors[anchors.length-3],1,true);
    }
    for(let i=0;i<3;i++){
      const zz=7+i*(mapSize-14)/2;
      rect(center-13,Math.round(zz)-1,27,3);
    }
  }else if(sectorStyle===15){
    // TITANIUM ATRIUM: oversized concentric reactor sanctum with two
    // service rings, intersecting ramps and a walkable upper inspection deck.
    rect(center-18,center-9,37,19);
    for(let ring=0;ring<2;ring++)for(let k=0;k<8;k++){
      const a=k*TAU/8+(ring?Math.PI/8:0);
      const r=ring?mapSize*.37:mapSize*.27;
      const p=chamber(center+Math.cos(a)*r,center+Math.sin(a)*r,11,11);
      road(p,ring?anchors[k]:hub,2,k%2===0);
      if(k>0)road(p,anchors[ring*8+((k+7)%8)],1);
    }
    rect(center-2,4,5,mapSize-8);
    rect(4,center-2,mapSize-8,5);
  }else if(sectorStyle===16){
    // CRYOGENIC SPIRE: a long insulated transport shaft, staggered cold
    // chambers and transverse bypasses with a south-to-north main passage.
    rect(center-2,4,5,mapSize-8);
    for(let k=0;k<7;k++){
      const z=6+k*(mapSize-12)/6;
      const side=(k%2===0?-1:1),span=mapSize*.28;
      const r=chamber(center+side*span,z,9,11);
      road(r,{x:center,z:r.z},1,k%2===0);
      // Alternate compression chambers on the opposite side.
      const other=chamber(center-side*span*.75,z+((k%3)-1)*2,7,7);
      road(other,{x:center,z:other.z},1,k%2!==0);
      if(k>0){road(r,anchors[(k-1)*2],1,true);road(other,anchors[(k-1)*2+1],1,false);}
    }
    // Two wide cross-decks break the uniform corridor silhouette.
    rect(5,center-8,mapSize-10,3);
    rect(5,center+6,mapSize-10,3);
  }else if(sectorStyle===17){
    // GRAVITY FACTORY: an expanding spiral of industrial halls with
    // occasional cross-cuts back to the core and multiple loop bypasses.
    let prev=hub;
    for(let k=0;k<15;k++){
      const angle=k*TAU/4.8+.28,rr=6+1.15*k;
      const r=chamber(center+Math.cos(angle)*rr,center+Math.sin(angle)*rr,8+(k%3),9+(k%2));
      road(prev,r,1+(k%4===0?1:0),k%2===0);
      if(k%4===2)road(hub,r,1,true);
      if(k>=5&&k%5===0)road(r,anchors[k-5],1,k%2!==0);
      prev=r;
    }
    road(prev,hub,2,true);
    // Massive service quadrants with central magnetic stabilizer.
    rect(center-3,center-3,7,7);
    rect(5,center-2,mapSize-10,5);
  }else{
    // STONE CANYON: a zigzag main ravine and wider open overlooks;
    // the balcony ledges above its turns are reachable by ground stairs.
    rect(center-3,4,7,mapSize-8);
    let previous=hub;
    for(let i=0;i<7;i++){
      const z=7+i*(mapSize-14)/6;
      const x=center+(i%2===0?-16:16);
      const ledge=chamber(x,z,11,10);
      road(ledge,{x:center,z:ledge.z},2,i%2===1);
      road(previous,ledge,1,i%2===0);
      previous=ledge;
    }
    rect(6,center-2,mapSize-12,5);
  }
  // Service alcoves and optional second loops increase traversable area.
  for(let k=0;k<(sectorStyle<5?10:5)+(mapSize-55)/4;k++){
    const r=irand(3,mapSize-9),z=irand(3,mapSize-9);
    let w=irand(4,7),h=irand(4,7);
    rect(r,z,w,h);
    const p={x:r+Math.floor(w/2),z:z+Math.floor(h/2),w,h};
    const nearest=anchors.slice().sort((a,b)=>hypot(a.x-p.x,a.z-p.z)-hypot(b.x-p.x,b.z-p.z))[0];
    road(p,nearest,sectorStyle===4?1:2);rooms.push(p);
  }
  // One level-specific tactical zone in the OUTER combat field. Large boss
  // halls are preserved; ordinary stages gain a compact, differently shaped
  // encounter instead of another instance of the same maze concept.
  const tacticKind=((Math.floor((level-1)/18)*5)+sectorStyle*3)%8;
  const orientation=(level+sectorStyle)%4;
  const tacticalCandidates=[];
  for(let cz=9;cz<=mapSize-10;cz+=4)for(let cx=9;cx<=mapSize-10;cx+=4){
    if(hypot(cx-center,cz-center)<mapSize*.33)continue;
    // Leave the entire already-unique 1.32m landmark and its six real risers
    // intact. A separate tactical annex must start on ordinary ground.
    if(!isBalconySector()&&Math.abs(cx-center)<18&&
       Math.abs(cz-(center-(sectorStyle>=14?16:12)))<18)continue;
    const plan={cx,cz,kind:tacticKind,orientation},tiles=tacticalCells(plan);
    if(tiles.some(p=>p.x<3||p.z<3||p.x>=mapSize-3||p.z>=mapSize-3))continue;
    const chosen=new Set(tiles.map(p=>p.z*mapSize+p.x));
    let oldWallOpenings=0,coverWalls=0;
    for(let z=cz-6;z<=cz+6;z++)for(let x=cx-6;x<=cx+6;x++)if(m[z]?.[x]){
      if(chosen.has(z*mapSize+x))oldWallOpenings++;
      else coverWalls++;
    }
    if(oldWallOpenings<14||coverWalls<14)continue;
    tacticalCandidates.push({plan,score:oldWallOpenings*.65+coverWalls*.19-
      hypot(cx-center,cz-center)*.11});
  }
  tacticalCandidates.sort((a,b)=>b.score-a.score||a.plan.cx-b.plan.cx||a.plan.cz-b.plan.cz);
  const selected=tacticalCandidates.length?
    tacticalCandidates[(Math.floor(level/7)+sectorStyle)%Math.min(5,tacticalCandidates.length)]:null;
  if(selected){
    tacticalZone={...selected.plan,name:tacticalNames[tacticKind]};
    for(const p of tacticalCells(tacticalZone))carve(p.x,p.z);
    const annex={x:tacticalZone.cx,z:tacticalZone.cz};
    road(annex,hub,1,level%2===0);
    // Two other entrances turn the annex into a genuine flanking loop; a
    // single L-shaped spur could cross a bridge's solid stair cheek.
    const neighbors=anchors.slice().sort((a,b)=>
      hypot(a.x-tacticalZone.cx,a.z-tacticalZone.cz)-
      hypot(b.x-tacticalZone.cx,b.z-tacticalZone.cz));
    for(let k=0;k<Math.min(2,neighbors.length);k++)
      road(annex,neighbors[k],1,(level+k)%2===1);
    rooms.push({x:tacticalZone.cx,z:tacticalZone.cz,w:12,h:12});
  }else tacticalZone=null;
  secondaryYard=null;
  bossApproachPlan=null;
  // A second, separately planned encounter on every ordinary level. Unlike
  // the first eight shared motifs, ten families each have eight genuinely
  // distinct flanking footprints (80 designs over 80 non-boss levels).
  if(!boss){
    const kind=Math.floor((level-1)/10)%10;
    const slot=(level-1)%10,variant=slot<4?slot:slot-1;
    const orientation=(level*7+sectorStyle)%4;
    const options=[];
    for(let cz=9;cz<=mapSize-10;cz+=3)for(let cx=9;cx<=mapSize-10;cx+=3){
      if(hypot(cx-center,cz-center)<mapSize*.32)continue;
      if(tacticalZone&&hypot(cx-tacticalZone.cx,cz-tacticalZone.cz)<20)continue;
      if(hypot(cx-center,cz-(center-(sectorStyle>=14?16:12)))<14)continue;
      if(isBalconySector()&&[-17,17].some(dx=>[-14,14].some(dz=>
        hypot(cx-center-dx,cz-center-dz)<12)))continue;
      const plan={cx,cz,kind,variant,orientation},tiles=secondaryYardCells(plan);
      if(tiles.some(p=>p.x<=3||p.z<=3||p.x>=mapSize-4||p.z>=mapSize-4))continue;
      const local=new Set(tiles.map(p=>p.z*mapSize+p.x));
      let oldWalls=0,remainingWalls=0;
      for(let z=cz-7;z<=cz+7;z++)for(let x=cx-7;x<=cx+7;x++){
        if(!m[z]?.[x])continue;
        if(local.has(z*mapSize+x))oldWalls++;
        else remainingWalls++;
      }
      if(oldWalls<12||remainingWalls<15)continue;
      options.push({plan,score:oldWalls*.61+remainingWalls*.21-
        hypot(cx-center,cz-center)*.1});
    }
    options.sort((a,b)=>b.score-a.score||a.plan.cx-b.plan.cx||a.plan.cz-b.plan.cz);
    const choice=options.length?
      options[(level+sectorStyle)%Math.min(6,options.length)]:null;
    if(choice){
      secondaryYard={...choice.plan,name:secondaryYardNames[kind]};
      for(const p of secondaryYardCells(secondaryYard))carve(p.x,p.z);
      const gate={x:secondaryYard.cx,z:secondaryYard.cz};
      road(gate,hub,1,level%2===0);
      if(tacticalZone)road(gate,{x:tacticalZone.cx,z:tacticalZone.cz},0,level%3===0);
      const nearest=anchors.slice().sort((a,b)=>
        hypot(a.x-gate.x,a.z-gate.z)-hypot(b.x-gate.x,b.z-gate.z))[0];
      if(nearest)road(gate,nearest,1,level%2===1);
      rooms.push({...gate,w:12,h:12});
    }
  }else{
    // Stage69: the five monumental overhead themes now have twenty DISTINCT
    // ground assault complexes as well. Keep the original 23x23 boss hall,
    // stairs and roof structures intact: these cells only REMOVE maze walls.
    const order=level/5-1,kind=order%5,variant=Math.floor(order/5);
    const orientation=(level+sectorStyle*3)%4;
    const choices=[];
    for(let cz=9;cz<=mapSize-10;cz+=3)for(let cx=9;cx<=mapSize-10;cx+=3){
      if(hypot(cx-center,cz-center)<mapSize*.26)continue;
      if(tacticalZone&&hypot(cx-tacticalZone.cx,cz-tacticalZone.cz)<14)continue;
      if(!isBalconySector()&&
        hypot(cx-center,cz-(center-(sectorStyle>=14?16:12)))<14)continue;
      // The four balcony families place their two mid-height roofed posts
      // near the central east-west strip. Keep a ground assault site away.
      if(isBalconySector()&&Math.abs(cz-center)<10&&
         Math.abs(cx-center)<23)continue;
      if(isBalconySector()&&[-17,17].some(dx=>[-14,14].some(dz=>
        hypot(cx-center-dx,cz-center-dz)<9)))continue;
      const plan={cx,cz,kind,variant,orientation},tiles=bossApproachCells(plan);
      if(tiles.some(p=>p.x<=3||p.z<=3||p.x>=mapSize-4||p.z>=mapSize-4))continue;
      const local=new Set(tiles.map(p=>p.z*mapSize+p.x));
      let opened=0,cover=0;
      for(let z=cz-7;z<=cz+7;z++)for(let x=cx-7;x<=cx+7;x++){
        if(!m[z]?.[x])continue;
        if(local.has(z*mapSize+x))opened++;
        else cover++;
      }
      if(opened<8||cover<6)continue;
      choices.push({plan,score:opened*.30+cover*1.2-
        hypot(cx-center,cz-center)*.08});
    }
    choices.sort((a,b)=>b.score-a.score||a.plan.cx-b.plan.cx||a.plan.cz-b.plan.cz);
    const selected=choices.length?choices[0]:null;
    if(selected){
      bossApproachPlan={...selected.plan,name:bossApproachNames[kind]};
      for(const p of bossApproachCells(bossApproachPlan))carve(p.x,p.z);
      const approach={x:bossApproachPlan.cx,z:bossApproachPlan.cz};
      road(approach,hub,1,level%2===0);
      if(tacticalZone)road(approach,{x:tacticalZone.cx,z:tacticalZone.cz},0,level%3===0);
      const near=anchors.slice().sort((a,b)=>
        hypot(a.x-approach.x,a.z-approach.z)-hypot(b.x-approach.x,b.z-approach.z))[0];
      if(near)road(approach,near,1,level%2===1);
      rooms.push({...approach,w:12,h:12});
    }
  }
  // Covers may never re-seal a deliberate walkable tactical corridor. Keep
  // this separate from rooftop placement reservations: those are crowded.
  const tacticalProtected=new Set(tacticalZone?
    tacticalCells(tacticalZone).map(p=>p.z*mapSize+p.x):[]);
  if(secondaryYard)for(const p of secondaryYardCells(secondaryYard))
    tacticalProtected.add(p.z*mapSize+p.x);
  if(bossApproachPlan)for(const p of bossApproachCells(bossApproachPlan))
    tacticalProtected.add(p.z*mapSize+p.x);
  // Stage50: balcony approaches are carved into the *same* traversable
  // ground grid. There is no second ground floor and no flight requirement.
  // Stair treads and deck plates are installed later from these plans.
  balconyPlans=[];galleryPlans=[];skyFeaturePlans=[];midlevelPlans=[];landmarkPlans=[];
  const galleryProtected=new Set();
  // V61–63: fourteen explicitly different physical landmark blueprints replace
  // the old generic centred square / repeated flat combat-floor formula.
  // Their open ground is carved before cover placement and connectivity BFS.
  const landmarkKind={0:'citadel',1:'reactor',3:'docks',5:'shipyard',
    7:'flood',8:'observatory',10:'harbor',11:'forge',12:'vertical',13:'stairkeep',
    14:'collector',15:'atrium',16:'cryo',17:'gravity'}[sectorStyle];
  if(landmarkKind){
    // Existing industrial sky bridges span the central arena. Place their
    // distinct, ground-accessible low landmarks beyond their true supports,
    // retaining enough vertical headroom to pass under those upper decks.
    const spec={kind:landmarkKind,cx:center,
      cz:center-(sectorStyle>=14?16:12)};
    landmarkPlans.push(spec);
    for(const p of landmarkCells(spec)){
      carve(p.x,p.z,1);
      galleryProtected.add(p.z*mapSize+p.x);
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])
        galleryProtected.add((p.z+dz)*mapSize+p.x+dx);
    }
    // Both ground-floor approaches and the elevated stairs are part of the
    // same reachable world; no flight or teleport is required.
    const eastDistance=landmarkKind==='gravity'?15:
      sectorStyle>=14?14:landmarkKind==='observatory'?16:
      landmarkKind==='forge'?14:landmarkKind==='stairkeep'?10:13;
    const foot=landmarkKind==='docks'?{x:center,z:center-24}:
      {x:center+eastDistance,z:center-12};
    road(foot,hub,1,landmarkKind==='reactor');
  }
  if(isBalconySector()){
    function balconySite(cx,cz,axis,side,steps=10,featureIndex=null){
      cx=Math.round(cx);cz=Math.round(cz);
      const edge=side>0?2:-1;
      const point=(u,v)=>axis==='x'?{x:cx+u,z:cz+v}:{x:cx+v,z:cz+u};
      const foot=point(edge+side*(steps+1),0);
      for(let u=-1;u<=2;u++)for(let v=-3;v<=3;v++){
        const p=point(u,v);carve(p.x,p.z);
      }
      for(let k=1;k<=steps+1;k++)for(let v=-3;v<=3;v++){
        const p=point(edge+side*k,v);carve(p.x,p.z);
      }
      // Keep open ground beneath the exposed overlook. Without this buffer
      // a player could jump off the balcony straight into an uncarved wall.
      const opposite=side>0?-1:2;
      for(let k=1;k<=3;k++)for(let v=-3;v<=3;v++){
        const p=point(opposite-side*k,v);carve(p.x,p.z);
      }
      // Tie the lower stair entrance back to existing public walkways.
      road(foot,hub,1,axis==='z');
      balconyPlans.push({cx,cz,axis,side,steps,
        ...(featureIndex===null?{}:{alternate:true,featureIndex})});
    }
    if(sectorStyle===2){
      for(const dx of [-17,17])for(const dz of [-14,14]){
        balconySite(center+dx,center+dz,'x',dx<0?1:-1,dz<0?14:10);
      }
    }else if(sectorStyle===4){
      for(const side of [-1,1]){
        balconySite(center+side*18,center-7,'x',-side,10);
        balconySite(center+side*18,center+7,'x',-side,14);
        balconySite(center+side*7,center+side*19,'z',-side,10);
      }
    }else if(sectorStyle===6){
      for(const [i,z] of [center-18,center-6,center+6,center+18].entries()){
        const side=i%2===0?-1:1;
        balconySite(center+side*17,z,'x',-side,z===center+18?14:10);
      }
    }else{
      for(let i=0;i<5;i++){
        const side=i%2===0?-1:1;
        balconySite(center+side*17,center-18+i*9,'x',-side,i%2===0?14:10);
      }
    }
    // Stage51: horizontal galleries over the bastions/amphitheatre, and
    // longitudinal gallery runs over the balcony city/canyon. Each route
    // starts and finishes at a real, stair-accessible overlook. Its U shape
    // leaves every stair flight open to the sky.
    galleryPlans=sectorStyle===2?[[0,2],[1,3]]:
      sectorStyle===4?[[0,3],[1,4]]:
      sectorStyle===6?[[0,2]]:[[0,2],[2,4],[1,3]];
    for(const [a,b] of galleryPlans){
      for(const {x,z} of balconyGalleryCells(balconyPlans[a],balconyPlans[b])){
        carve(x,z);
        galleryProtected.add(z*mapSize+x);
      }
    }
    // Stage52: height-based combat arenas instead of repeating the same
    // straight bridge. Each shaped platform joins one proven gallery;
    // all the cells beneath remain part of the single main ground floor.
    if(sectorStyle===2){
      // Place the lightwell BEYOND the two opposed stair flights. The
      // two-tile central spine slips safely between their outer edges.
      skyFeaturePlans.push({kind:'ring',galleryIndex:0,cx:center,cz:center-5,
        link:{axis:'z',x:center,z0:center-19,z1:center-10}});
    }else if(sectorStyle===4){
      for(const dx of [-9,9])skyFeaturePlans.push({kind:'wing',galleryIndex:0,
        cx:center+dx,cz:center-18,
        link:{axis:'z',x:center+dx,z0:center-16,z1:center-12}});
      skyFeaturePlans.push({kind:'wing',galleryIndex:1,cx:center,cz:center+18,
        link:{axis:'z',x:center,z0:center+13,z1:center+16}});
    }else if(sectorStyle===6){
      skyFeaturePlans.push({kind:'court',cut:'north',galleryIndex:0,
        cx:center-14,cz:center-11,
        link:{axis:'x',x0:center-22,x1:center-16,z:center-11}});
      skyFeaturePlans.push({kind:'court',cut:'south',galleryIndex:0,
        cx:center-14,cz:center-1,
        link:{axis:'x',x0:center-22,x1:center-16,z:center-1}});
    }else{
      skyFeaturePlans.push({kind:'ring',galleryIndex:0,cx:center-16,cz:center-8,
        link:{axis:'x',x0:center-22,x1:center-21,z:center-8}});
      skyFeaturePlans.push({kind:'ledge',galleryIndex:2,cx:center+13,cz:center,
        link:{axis:'x',x0:center+15,x1:center+22,z:center}});
    }
    for(const spec of skyFeaturePlans){
      for(const {x,z} of skyFeatureCells(spec)){
        carve(x,z);
        galleryProtected.add(z*mapSize+x);
      }
      if(spec.kind==='ring')for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){
        const x=spec.cx+dx,z=spec.cz+dz;
        carve(x,z);galleryProtected.add(z*mapSize+x);
      }
    }
    // Stage53: a SECOND approach for seven upper rooms. Unlike teleporting
    // to a balcony, these use exactly the same ordinary 10/14-step physics
    // as Stage50. Existing gallery plan indices stay unchanged (append-only).
    if(sectorStyle===2){
      balconySite(center,center-1,'z',1,14,0);
    }else if(sectorStyle===4){
      balconySite(center-2,center+18,'x',-1,14,2);
      balconySite(center+11,center-18,'x',1,10,1);
      balconySite(center+2,center+18,'x',1,14,2);
    }else if(sectorStyle===6){
      balconySite(center-10,center-11,'x',1,10,0);
      // Offset the second footway north: the lower hub spawn stays FLAT.
      balconySite(center-10,center-4,'x',1,10,1);
    }else{
      balconySite(center-12,center-8,'x',1,14,0);
    }
    // Stage54: reserve room for two genuinely climbable mid-height T-shaped
    // terraces. Their double-ended flights and branching viewing lip make a
    // different combat loop from the tall, suspended Stage50-53 galleries.
    // Search around opposite sides of the arena: every occupied high bridge,
    // existing stair and the central initial spawn is a hard exclusion.
    const reserved=new Set(galleryProtected);
    // The roof escape needs 13 narrow cells around the back of the post.
    // Do not exclude an entire one-cell safety margin around every OLD
    // balcony when selecting it: only *actual* occupied geometry matters.
    const roofHardReserved=new Set(galleryProtected);
    for(const b of balconyPlans){
      const along=(u,v)=>b.axis==='x'?{x:b.cx+u,z:b.cz+v}:{x:b.cx+v,z:b.cz+u};
      const edge=b.side>0?2:-1;
      for(let u=-1;u<=2;u++)for(let v=-3;v<=3;v++){
        const p=along(u,v);reserved.add(p.z*mapSize+p.x);
        if(v>=-2&&v<=2)roofHardReserved.add(p.z*mapSize+p.x);
      }
      for(let k=1;k<=b.steps;k++)for(let v=-3;v<=3;v++){
        const p=along(edge+b.side*k,v);reserved.add(p.z*mapSize+p.x);
        if(v>=-2&&v<=2)roofHardReserved.add(p.z*mapSize+p.x);
      }
    }
    for(let index=0;index<2;index++){
      const targetX=center+(index===0?-11:11),targetZ=center;
      const steps=index===0?5:7,wing=index===0?-1:1;
      let best=null,bestScore=Infinity;
      for(const axis of ['x','z'])for(let cz=9;cz<mapSize-9;cz++)for(let cx=9;cx<mapSize-9;cx++)for(const roofFlank of [-1,1,0]){
        // Include generous margins for the 7/5-step approaches and lookout.
        if((axis==='x'?cx:cz)<steps+7||
           (axis==='x'?cx:cz)>mapSize-steps-8)continue;
        const proposal={cx,cz,axis,steps,wing,roofFlank},tiles=midlevelCells(proposal),
          outside=midlevelShelterBufferCells(proposal),
          fireEscape=midlevelRoofStairCells(proposal);
        let clear=true;
        for(const p of tiles){
          if(p.x<3||p.z<3||p.x>=mapSize-3||p.z>=mapSize-3||
             reserved.has(p.z*mapSize+p.x)||
             Math.hypot(p.x-center,p.z-center)<2.5){clear=false;break;}
        }
        if(clear)for(const p of outside){
          if(p.x<3||p.z<3||p.x>=mapSize-3||p.z>=mapSize-3||
             galleryProtected.has(p.z*mapSize+p.x)){clear=false;break;}
        }
        if(clear)for(const p of fireEscape){
          if(p.x<3||p.z<3||p.x>=mapSize-3||p.z>=mapSize-3||
             roofHardReserved.has(p.z*mapSize+p.x)){clear=false;break;}
        }
        if(!clear)continue;
        const score=(cx-targetX)**2+(cz-targetZ)**2+
          (axis==='z'?0:18)+(sectorStyle===4&&axis==='x'?-12:0)+
          (roofFlank===0?100000:roofFlank>0?.02:0);
        if(score<bestScore){best=proposal;bestScore=score;}
      }
      if(!best)continue;
      midlevelPlans.push(best);
      for(const p of midlevelCells(best)){
        carve(p.x,p.z);
        // Protect the real steps from later cover walls, which otherwise
        // could sit on a tread and prevent either player or robot climbing.
        for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)
          reserved.add((p.z+dz)*mapSize+p.x+dx);
        galleryProtected.add(p.z*mapSize+p.x);
        roofHardReserved.add(p.z*mapSize+p.x);
      }
      // Air and sightlines outside the two real guardhouse windows: leave
      // actual ground-level cells open, rather than decorative blind panes.
      for(const p of midlevelShelterBufferCells(best)){
        carve(p.x,p.z);
        reserved.add(p.z*mapSize+p.x);
        galleryProtected.add(p.z*mapSize+p.x);
        roofHardReserved.add(p.z*mapSize+p.x);
      }
      for(const p of midlevelRoofStairCells(best)){
        carve(p.x,p.z);
        galleryProtected.add(p.z*mapSize+p.x);
        roofHardReserved.add(p.z*mapSize+p.x);
        for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)
          reserved.add((p.z+dz)*mapSize+p.x+dx);
      }
      for(const side of [-1,1]){
        const u=side*(4+best.steps),p=best.axis==='x'?
          {x:best.cx+u,z:best.cz}:{x:best.cx,z:best.cz+u};
        road(p,hub,1,best.axis==='x');
      }
    }
  }
  // V66: connect a short REAL staircase and a uniquely shaped upper lookout
  // to the tactical annex. Its first riser begins immediately next to the
  // original, completely FLAT annex centre. Favor the inward direction, but
  // never occupy an old roof, gallery, stairs, landmark or boss central hall.
  tacticalRisePlan=null;
  // Four balcony-city themes already have several 2.2m/3.08m sky corridors,
  // two elevated guardhouses and independent flights. Their access envelope
  // is too dense for another long free-standing stair without losing routes.
  if(tacticalZone&&!isBalconySector()){
    const toCenter=[
      {orientation:0,score:center-tacticalZone.cx},
      {orientation:1,score:center-tacticalZone.cz},
      {orientation:2,score:tacticalZone.cx-center},
      {orientation:3,score:tacticalZone.cz-center}
    ].sort((a,b)=>b.score-a.score||
      ((a.orientation+level)%4)-((b.orientation+level)%4));
    const balconyOccupied=new Set();
    for(const b of balconyPlans){
      const edge=b.side>0?2:-1;
      const point=(u,v)=>b.axis==='x'?{x:b.cx+u,z:b.cz+v}:
        {x:b.cx+v,z:b.cz+u};
      for(let u=-1;u<=2;u++)for(let v=-3;v<=3;v++){
        const p=point(u,v);balconyOccupied.add(p.z*mapSize+p.x);
      }
      for(let k=1;k<=b.steps;k++)for(let v=-3;v<=3;v++){
        const p=point(edge+b.side*k,v);
        balconyOccupied.add(p.z*mapSize+p.x);
      }
    }
    const siteOffsets=[[0,0],[0,-4],[0,4],[-4,0],[4,0],
      [-6,-6],[-6,6],[6,-6],[6,6],[0,-8],[0,8],[-8,0],[8,0],
      [-8,-8],[-8,8],[8,-8],[8,8],[-12,0],[12,0],[0,-12],[0,12]];
    for(const [ox,oz] of siteOffsets){
     if(tacticalRisePlan)break;
     const site={x:tacticalZone.cx+ox,z:tacticalZone.cz+oz};
     if(site.x<3||site.z<3||site.x>=mapSize-3||site.z>=mapSize-3)continue;
     const directions=toCenter.map(t=>({orientation:t.orientation,
       score:(center-site.x)*[1,0,-1,0][t.orientation]+
         (center-site.z)*[0,1,0,-1][t.orientation]}))
       .sort((a,b)=>b.score-a.score||
         ((a.orientation+level)%4)-((b.orientation+level)%4));
     for(const trial of directions){
      const plan={cx:site.x,cz:site.z,
        orientation:trial.orientation,kind:tacticKind,profile:level-1,
        name:tacticalRiseNames[tacticKind]};
      const tiles=tacticalRiseCells(plan);
      if(tiles.some(p=>p.x<=3||p.z<=3||p.x>=mapSize-4||p.z>=mapSize-4||
        galleryProtected.has(p.z*mapSize+p.x)||
        balconyOccupied.has(p.z*mapSize+p.x)||
        // A raised lookout must not erase an ordinary central staircase.
        (!isBalconySector()&&sectorStyle<14&&
          Math.abs(p.x-center)<=7&&Math.abs(p.z-center)<=7)||
        // The four 20m factory worlds already have an overhead central
        // conveyor and two ten-step access runs through this corridor.
        (sectorStyle>=14&&Math.abs(p.x-center)<=15&&
          Math.abs(p.z-center)<=4)||
        // Four monumental boss-procession columns are real floor-to-ceiling
        // solids at (+/-14.3,+/-14.3). Never put a new lookout through one.
        (boss&&Math.abs(Math.abs(p.x-center-.0)-14.3)<1.3&&
          Math.abs(Math.abs(p.z-center-.0)-14.3)<1.3)||
        Math.hypot(p.x-center,p.z-center)<7))continue;
      tacticalRisePlan=plan;
      // A new annex has a REAL carved corridor back to the existing tactical
      // centre, not a disconnected isolated staircase hidden in the maze.
      road({x:tacticalZone.cx,z:tacticalZone.cz},site,1,level%2===1);
      for(const p of tiles){
        carve(p.x,p.z,1);
        tacticalProtected.add(p.z*mapSize+p.x);
      }
      break;
     }
    }
  }
  // V82: separate relay / supply forts make a third tactical destination on
  // all 80 ordinary stages, not another decoration in the centre. A 15x15
  // ground clearing (shrunk when an established balcony needs the space) is opened FIRST; it cannot isolate any previous route.
  // Two independently carved approaches connect it to the hub and the
  // existing outer secondary yard. Then only physical mapCells walls are
  // installed, outside the five-cell-wide crossroads. No stair, balcony,
  // gallery or pre-existing outer tactical arena may be overwritten.
  relayFortPlan=null;
  if(!boss){
    const ordinal=level-1-Math.floor(level/5),kind=ordinal%8,
      variant=Math.floor(ordinal/8),orientation=(level*3+sectorStyle)%4;
    const reserved=new Set([...galleryProtected,...tacticalProtected]);
    for(const b of balconyPlans){
      const at=(u,v)=>b.axis==='x'?{x:b.cx+u,z:b.cz+v}:
        {x:b.cx+v,z:b.cz+u};
      const edge=b.side>0?2:-1;
      for(let u=-2;u<=3;u++)for(let v=-4;v<=4;v++){
        const p=at(u,v);reserved.add(p.z*mapSize+p.x);
      }
      for(let k=1;k<=b.steps+2;k++)for(let v=-4;v<=4;v++){
        const p=at(edge+b.side*k,v);reserved.add(p.z*mapSize+p.x);
      }
    }
    let selected=null;
    // Tall balcony worlds sometimes have no spare 15x15 square. In that
    // case shrink the SAME physical language to 13x13 or 11x11, rather
    // than overlapping an existing roof/stair or dropping the entire fort.
    for(const radius of [7,6,5,4,3]){
      let candidate=null;
      for(let z=radius+2;z<mapSize-radius-2;z+=2)
      for(let x=radius+2;x<mapSize-radius-2;x+=2){
        if(Math.hypot(x-center,z-center)<(radius>=6?16:13)||
          (secondaryYard&&Math.hypot(x-secondaryYard.cx,z-secondaryYard.cz)<(radius>=6?13:9))||
          (tacticalZone&&Math.hypot(x-tacticalZone.cx,z-tacticalZone.cz)<(radius>=6?13:9))||
          (tacticalRisePlan&&Math.hypot(x-tacticalRisePlan.cx,z-tacticalRisePlan.cz)<(radius>=6?11:8))||
          Math.hypot(x-center,z-(center-(sectorStyle>=14?16:12)))<(radius>=6?11:8))
          continue;
        let clear=true,preOpened=0;
        for(let dz=-radius;dz<=radius&&clear;dz++)
        for(let dx=-radius;dx<=radius;dx++){
          const X=x+dx,Z=z+dz;
          if(X<2||Z<2||X>=mapSize-2||Z>=mapSize-2||
             reserved.has(Z*mapSize+X)){clear=false;break;}
          if(m[Z][X]===0)preOpened++;
        }
        if(!clear)continue;
        const side=2*radius+1;
        const score=side*side-preOpened-
          .015*Math.hypot(x-center,z-center)+
          .001*((x*13+z*7+level)%17);
        if(!candidate||score>candidate.score)candidate={x,z,score,radius};
      }
      if(candidate){selected=candidate;break;}
    }
    if(selected){
      const x=selected.x,z=selected.z,radius=selected.radius;
      rect(x-radius,z-radius,2*radius+1,2*radius+1);
      const gate={x,z};
      road(gate,hub,1,level%2===0);
      if(secondaryYard)road(gate,{x:secondaryYard.cx,z:secondaryYard.cz},
        1,level%3===0);
      else if(tacticalZone)road(gate,{x:tacticalZone.cx,z:tacticalZone.cz},
        1,level%3===0);
      const proposal={cx:x,cz:z,kind,variant,orientation,radius,
        name:relayFortNames[kind]};
      const walls=relayFortCells(proposal);
      for(const p of walls)m[p.z][p.x]=1;
      // Restore the smallest required number of barricade cells if a
      // particular inherited maze route intersects this new fort.
      function relayReachable(){
        const q=[center*mapSize+center],seen=new Uint8Array(mapSize*mapSize);
        seen[q[0]]=1;
        for(let k=0;k<q.length;k++){
          const t=q[k],cx=t%mapSize,cz=(t/mapSize)|0;
          for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
            const X=cx+dx,Z=cz+dz,key=Z*mapSize+X;
            if(X<=0||Z<=0||X>=mapSize-1||Z>=mapSize-1||
               m[Z][X]||seen[key])continue;
            seen[key]=1;q.push(key);
          }
        }
        for(let Z=1;Z<mapSize-1;Z++)for(let X=1;X<mapSize-1;X++)
          if(m[Z][X]===0&&!seen[Z*mapSize+X])return false;
        return true;
      }
      const a=radius===7?3:2;
      const signatureCells=new Set([[a,a],[a,a+1],[a+1,a],[a+1,a+1]]
        .map(([dx,dz])=>(z+dz)*mapSize+x+dx));
      // Keep the variant-defining 4-bit mark intact whenever an ordinary
      // non-signature wall can be removed instead. The corrected order
      // prevents two originally distinct layouts collapsing to the same one.
      const rollback=[...walls.filter(p=>signatureCells.has(p.z*mapSize+p.x)),
        ...walls.filter(p=>!signatureCells.has(p.z*mapSize+p.x))];
      if(!relayReachable())for(let i=rollback.length-1;i>=0&&!relayReachable();i--){
        const p=rollback[i];m[p.z][p.x]=0;
      }
      const tiles=walls.filter(p=>m[p.z][p.x]===1);
      relayFortPlan={...proposal,tiles};
      // This keeps the optional old cover placement out of the entire
      // new traversable fort, including its genuine side entrances.
      for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++)
        tacticalProtected.add((z+dz)*mapSize+x+dx);
      rooms.push({x,z,w:2*radius+1,h:2*radius+1});
    }
  }
  // Tall boss amphitheatre; wide approaches to avoid combat bottlenecks.
  if(boss){rect(center-11,center-11,23,23);anchors.forEach(p=>road(hub,p,2));}
  // V80: install physically real fortress ruins AFTER the broad hall was
  // carved, BEFORE connectivity and spawn analysis. A full-height wall in
  // mapCells is simultaneously visible geometry, AI wall, ray hit and 3D
  // sphere hit. Do not use render-only boxes or invisible physics proxies.
  bossCourtPlan=null;
  if(boss){
    const ordinal=level/5-1,kind=ordinal%5,variant=Math.floor(ordinal/5);
    // Search around the existing roof/stair geometry. Some older balcony
    // layouts occupy a whole edge of the arena; never force a wall through
    // their flight merely to satisfy the new motif's ideal coordinates.
    const bossCourtProtected=new Set(galleryProtected);
    for(const b of balconyPlans){
      const along=(u,v)=>b.axis==='x'?{x:b.cx+u,z:b.cz+v}:
        {x:b.cx+v,z:b.cz+u};
      const edge=b.side>0?2:-1;
      for(let u=-1;u<=2;u++)for(let v=-3;v<=3;v++){
        const q=along(u,v);bossCourtProtected.add(q.z*mapSize+q.x);
      }
      for(let k=1;k<=b.steps+1;k++)for(let v=-3;v<=3;v++){
        const q=along(edge+b.side*k,v);
        bossCourtProtected.add(q.z*mapSize+q.x);
      }
    }
    const orientation=(ordinal*3+sectorStyle)%4;
    let best=null;
    for(const [ox,oz] of [[0,0],[-2,0],[2,0],[0,-2],[0,2],
      [-4,0],[4,0],[0,-4],[0,4],[-2,-2],[2,-2],[-2,2],[2,2],
      [-4,-4],[4,-4],[-4,4],[4,4],[-6,0],[6,0],[0,-6],[0,6]]){
      const proposal={cx:center+ox,cz:center+oz,kind,variant,orientation,
        name:bossCourtNames[kind]};
      const tiles=bossCourtCells(proposal).filter(p=>{
        const dx=p.x-center,dz=p.z-center,key=p.z*mapSize+p.x;
        return Math.max(Math.abs(dx),Math.abs(dz))<=11&&
          Math.hypot(dx,dz)>6.5&&
          Math.abs(dx)>2&&Math.abs(dz)>2&&
          m[p.z]?.[p.x]===0&&!bossCourtProtected.has(key)&&
          !tacticalProtected.has(key);
      });
      const score=tiles.length-0.18*(Math.abs(ox)+Math.abs(oz));
      if(!best||score>best.score)best={proposal,tiles,score};
    }
    const {proposal,tiles}=best;
    for(const p of tiles)m[p.z][p.x]=1;
    bossCourtPlan={...proposal,tiles};
  }
  // V81: the ordinary 13x13 near-empty hub becomes a wider 17x17
  // combat court. Opening old walls cannot disconnect earlier routes;
  // afterwards ONLY mapCells walls are inserted. The same cells generate
  // visible meshes and the real collision geometry. Keep all raised routes
  // clear by consulting the exact gallery/stair reservation mask.
  ordinaryCourtPlan=null;
  if(!boss){
    const ordinal=level-1-Math.floor(level/5),kind=ordinal%10;
    const variant=Math.floor(ordinal/10),baseOrientation=(level+sectorStyle)%4;
    rect(center-8,center-8,17,17);
    // The Stage50 stair runs were carved long before the Stage51 gallery
    // mask, so protect those original real stairs explicitly as well.
    const courtProtected=new Set([...galleryProtected,...tacticalProtected]);
    for(const b of balconyPlans){
      const at=(u,v)=>b.axis==='x'?{x:b.cx+u,z:b.cz+v}:
        {x:b.cx+v,z:b.cz+u};
      const edge=b.side>0?2:-1;
      for(let u=-1;u<=2;u++)for(let v=-3;v<=3;v++){
        const p=at(u,v);courtProtected.add(p.z*mapSize+p.x);
      }
      for(let k=1;k<=b.steps+1;k++)for(let v=-3;v<=3;v++){
        const p=at(edge+b.side*k,v);courtProtected.add(p.z*mapSize+p.x);
      }
    }
    // Try nearby offsets and all quarter-turns; upper walkways and stairs
    // take priority over the new motif. Prefer the largest intact footprint
    // while protecting the five-tile cardinal escape lanes of the TRUE hub.
    let bestCourt=null;
    const offsets=[[0,0],[-1,0],[1,0],[0,-1],[0,1],
      [-2,0],[2,0],[0,-2],[0,2],[-1,-1],[1,-1],[-1,1],[1,1]];
    for(const [ox,oz] of offsets)for(let turn=0;turn<4;turn++){
      const orientation=(baseOrientation+turn)%4;
      const proposal={cx:center+ox,cz:center+oz,kind,variant,orientation,
        name:ordinaryCourtNames[kind]};
      const tiles=ordinaryCourtCells(proposal).filter(p=>
        Math.abs(p.x-center)<=8&&Math.abs(p.z-center)<=8&&
        Math.abs(p.x-center)>2&&Math.abs(p.z-center)>2&&
        m[p.z]?.[p.x]===0&&!courtProtected.has(p.z*mapSize+p.x));
      const score=tiles.length-.045*(Math.abs(ox)+Math.abs(oz))-.015*turn;
      if(!bestCourt||score>bestCourt.score)
        bestCourt={proposal,tiles,score};
    }
    for(const p of bestCourt.tiles)m[p.z][p.x]=1;
    ordinaryCourtPlan={...bestCourt.proposal,tiles:bestCourt.tiles};
  }
  // Distributed navigable cover. Never place walls in protected hub corridors.
  const candidates=[];
  for(let k=0;k<anchors.length;k++){
    let p=anchors[k];candidates.push([p.x+((k&1)?2:-2),p.z+((k%3)?2:-2)]);
  }
  if(boss)for(const dx of [-8,8])for(const dz of [-8,8])candidates.push([center+dx,center+dz]);
  const covers=[];
  for(let [x,z] of candidates){
    if(x<3||z<3||x>=mapSize-3||z>=mapSize-3||m[z][x]!==0)continue;
    if(hypot(x-center,z-center)<7)continue;
    if(galleryProtected.has(z*mapSize+x))continue;
    if(tacticalProtected.has(z*mapSize+x))continue;
    // Cover never blocks either the balcony landing or a single stair tread.
    if(balconyPlans.some(b=>{
      const edge=b.side>0?2:-1;
      const along=b.axis==='x'?x-b.cx:z-b.cz;
      const across=b.axis==='x'?z-b.cz:x-b.cx;
      return Math.abs(across)<=3 && along>=Math.min(-1,edge+b.side*(b.steps+1))-1 &&
       along<=Math.max(2,edge+b.side*(b.steps+1))+1;
    }))continue;
    const clearAround=[[1,0],[-1,0],[0,1],[0,-1]].every(([dx,dz])=>m[z+dz]?.[x+dx]===0);
    if(!clearAround)continue;
    m[z][x]=1; covers.push([x,z]);
  }
  function reachable(){
    let q=[[center,center]],head=0,visited=new Uint8Array(mapSize*mapSize);
    visited[center*mapSize+center]=1;
    while(head<q.length){let [x,z]=q[head++];for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const X=x+dx,Z=z+dz,key=Z*mapSize+X;
      if(X<0||Z<0||X>=mapSize||Z>=mapSize||m[Z][X]||visited[key])continue;
      visited[key]=1;q.push([X,Z]);
    }}
    for(let z=0;z<mapSize;z++)for(let x=0;x<mapSize;x++)if(!m[z][x]&&!visited[z*mapSize+x])return false;
    return true;
  }
  // Covers are optional; undo them first if the assembled world becomes
  // disconnected. The fresh V81 walls are also conditional: remove the
  // smallest necessary tail until EVERY non-wall floor tile is accessible.
  if(!reachable()){
    for(const [x,z] of covers)m[z][x]=0;
    if(!reachable()&&ordinaryCourtPlan){
      for(let i=ordinaryCourtPlan.tiles.length-1;i>=0&&!reachable();i--){
        const p=ordinaryCourtPlan.tiles[i];m[p.z][p.x]=0;
      }
      ordinaryCourtPlan.tiles=ordinaryCourtPlan.tiles.filter(p=>m[p.z][p.x]===1);
    }
  }
  mapCells=m;spawnX=center+.5;spawnZ=center+.5;
  // Portal is anchored in a reachable chamber (not randomly inside a wall).
  // For maze-like layouts use real walking distance rather than straight lines.
  const dist=new Int16Array(mapSize*mapSize);dist.fill(-1);
  const queue=new Int32Array(mapSize*mapSize);let front=0,back=0;
  const st=center*mapSize+center;dist[st]=0;queue[back++]=st;
  while(front<back){const q=queue[front++],x=q%mapSize,z=(q/mapSize)|0;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const X=x+dx,Z=z+dz,k=Z*mapSize+X;
      if(X<1||Z<1||X>=mapSize-1||Z>=mapSize-1||m[Z][X]||dist[k]>=0)continue;
      dist[k]=dist[q]+1;queue[back++]=k;
    }
  }
  const far=anchors.filter(p=>m[p.z]?.[p.x]===0).sort((a,b)=>dist[b.z*mapSize+b.x]-dist[a.z*mapSize+a.x])[0]||hub;
  portal={x:far.x+.5,z:far.z+.5};
  // Capture the ORIGINAL elevation geometry before adding any portal walls.
  // Some older raised plazas are conditional on their full open footprint;
  // even a wall on a nominally flat edge could silently erase a staircase.
  mapRooms=rooms.map(r=>({x:r.x+.5,z:r.z+.5,w:r.w||13,h:r.h||13}));
  makeStairHeights(level);
  const originalElevations=heightCells.slice();
  const originalDecks=deckCells.slice();
  const originalGenericStairs=stairStages.filter(s=>!s.kind).map(s=>({
    x:Math.floor(s.x),z:Math.floor(s.z),radius:s.radius}));
  // V83: real perimeter defenses AT the exit site. Use existing accessible
  // floor instead of carving through older upper decks, ladders or lightwells.
  // The final design is chosen by the number of intact solid pieces, not by
  // the number of decorations. Every installed cell is drawn and collidable.
  extractionCourtPlan=null;
  {
    const kind=(level-1)%10,variant=Math.floor((level-1)/10);
    const protectedCells=new Set([...galleryProtected,...tacticalProtected]);
    for(let z=1;z<mapSize-1;z++)for(let x=1;x<mapSize-1;x++){
      const key=z*mapSize+x;
      if(originalElevations[key]>.001||originalDecks[key]>.001||
         originalGenericStairs.some(s=>Math.abs(x-s.x)<=s.radius+1&&
           Math.abs(z-s.z)<=s.radius+1))protectedCells.add(key);
    }
    for(const b of balconyPlans){
      const at=(u,v)=>b.axis==='x'?{x:b.cx+u,z:b.cz+v}:
        {x:b.cx+v,z:b.cz+u};
      const edge=b.side>0?2:-1;
      for(let u=-2;u<=3;u++)for(let v=-4;v<=4;v++){
        const p=at(u,v);protectedCells.add(p.z*mapSize+p.x);
      }
      for(let k=1;k<=b.steps+2;k++)for(let v=-4;v<=4;v++){
        const p=at(edge+b.side*k,v);
        protectedCells.add(p.z*mapSize+p.x);
      }
    }
    let best=null;
    for(const [ox,oz] of [[0,0],[-1,0],[1,0],[0,-1],[0,1],
      [-2,0],[2,0],[0,-2],[0,2],[-1,-1],[1,-1],[-1,1],[1,1]])
    for(let turn=0;turn<4;turn++){
      const plan={cx:far.x+ox,cz:far.z+oz,
        kind,variant,orientation:(turn+level+sectorStyle)%4,
        name:extractionCourtNames[kind]};
      const tiles=extractionCourtCells(plan).filter(p=>{
        const key=p.z*mapSize+p.x;
        return p.x>2&&p.z>2&&p.x<mapSize-3&&p.z<mapSize-3&&
          m[p.z][p.x]===0&&!protectedCells.has(key)&&
          // Keep a 2.1m unimpeded circle at the original portal even when
          // an offset design centre was chosen to avoid an old balcony.
          Math.hypot(p.x-far.x,p.z-far.z)>2.25&&
          Math.hypot(p.x-center,p.z-center)>7.5;
      });
      const score=tiles.length-.07*(Math.abs(ox)+Math.abs(oz))-.02*turn;
      if(!best||score>best.score)best={plan,tiles,score};
    }
    // A few densely built worlds (notably a boss fortress surrounded by
    // existing roof stairs) have almost no available floor at the anchor.
    // Search the adjoining APPROACH, instead of forcing geometry through
    // the protected stair and creating an invisible or impassable obstacle.
    if(!best||best.tiles.length<8){
      for(let radius=3;radius<=10;radius++)
      for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
        if(Math.max(Math.abs(dx),Math.abs(dz))!==radius||
           Math.abs(dx)+Math.abs(dz)>radius+4)continue;
        for(let turn=0;turn<4;turn++){
          const plan={cx:far.x+dx,cz:far.z+dz,kind,variant,
            orientation:(turn+level+sectorStyle)%4,
            name:extractionCourtNames[kind]};
          const tiles=extractionCourtCells(plan).filter(p=>{
            const key=p.z*mapSize+p.x;
            return p.x>2&&p.z>2&&p.x<mapSize-3&&p.z<mapSize-3&&
              m[p.z][p.x]===0&&!protectedCells.has(key)&&
              Math.hypot(p.x-far.x,p.z-far.z)>2.25&&
              Math.hypot(p.x-center,p.z-center)>7.5;
          });
          const score=tiles.length-.12*(Math.abs(dx)+Math.abs(dz))-.02*turn;
          if(!best||score>best.score)best={plan,tiles,score};
        }
      }
    }
    if(best){
      for(const p of best.tiles)m[p.z][p.x]=1;
      // Never leave an old corridor or robot destination isolated. Remove
      // walls in reverse priority order until every free ground tile is in
      // the original connected component (the old fortress remains intact).
      if(!reachable())for(let i=best.tiles.length-1;i>=0&&!reachable();i--){
        const p=best.tiles[i];m[p.z][p.x]=0;
      }
      const tiles=best.tiles.filter(p=>m[p.z][p.x]===1);
      extractionCourtPlan={...best.plan,portalX:far.x,portalZ:far.z,tiles};
    }
  }
  mapRooms=rooms.map(r=>({x:r.x+.5,z:r.z+.5,w:r.w||13,h:r.h||13}));
  mapFeatures=anchors.filter((r,k)=>k%2===0).map((p,k)=>({x:p.x+.5,z:p.z+.5,kind:k%3,phase:k*1.7}));
  mapFeatures.push({x:spawnX,z:spawnZ,kind:3,phase:0});
  // Wayfinding pylons live above the player's head, never block movement.
  anchors.filter((r,k)=>k%3===1).forEach((r,k)=>mapFeatures.push({x:r.x+.5,z:r.z+.5,kind:4,phase:k*.8}));
  navClock=0;navField=null;portalRouteField=null;
  makeStairHeights(level);
  createWorldMesh(level);
}
function buildFloorDecal(v,x,z,t,seed){
  const c=rcolor(t.accent,(seed%3===0)?.46:.17);
  const sx=x+.1,sz=z+.1;
  if(seed%5===0){
    box(v,sx,.024,sz,x+.9,.029,sz+.04,c,1.3,[0,0,0,0,1,0]);
    box(v,sx,.024,z+.86,x+.9,.029,z+.9,c,.9,[0,0,0,0,1,0]);
  }
  if(seed%4===0){
    box(v,x+.48,.023,z+.2,x+.52,.029,z+.8,c,.65,[0,0,0,0,1,0]);
    box(v,x+.2,.023,z+.48,x+.8,.029,z+.52,c,.65,[0,0,0,0,1,0]);
  }
}
