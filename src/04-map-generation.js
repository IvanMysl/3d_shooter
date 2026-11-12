
// A central safe hub, linked combat chambers and alternative routes. Every
// generated room is reachable; decorative objects never obstruct collision cells.
// MEGAWORLD: seeded sectors, five spatial blueprints, navigable halls and routes.
function buildMap(level){
  mapSize=55+8*Math.min(2,Math.floor((level-1)/6));
  const center=Math.floor(mapSize/2),boss=level%5===0;
  let seed=(Math.imul(level,2654435761) ^ 0x75931c5b)>>>0;
  const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const irand=(lo,hi)=>lo+Math.floor(rng()*(hi-lo+1));
  const m=Array.from({length:mapSize},()=>Array(mapSize).fill(1));
  const rooms=[];
  sectorStyle=(level===legacyResumeSector?(level-1)%legacyResumeDivisor:(level-1)%18);
  sectorArchitecture=['ЦИТАДЕЛЬ','РЕАКТОРНЫЕ КОЛЬЦА','ХРАМ ПЕРЕХОДОВ','НЕБЕСНЫЕ ДОКИ','АРХИВ ЛАБИРИНТОВ','ГРУЗОВЫЕ ВЕРФИ','КАРАНТИННЫЙ КОМПЛЕКС','ЗАТОПЛЕННЫЙ ТРАНЗИТ','ЗВЁЗДНАЯ ОБСЕРВАТОРИЯ','ПОДЗЕМНОЕ МЕТРО','КРИСТАЛЬНАЯ ГАВАНЬ','ТИТАНОВАЯ КУЗНЯ','ВЕРТИКАЛЬНАЯ ВЕРФЬ','ЛЕСТНИЧНАЯ ЦИТАДЕЛЬ','ВОЗДУШНЫЙ КОЛЛЕКТОР','ТИТАНОВЫЙ АТРИУМ','КРИОГЕННЫЙ ШПИЛЬ','ГРАВИТАЦИОННАЯ ФАБРИКА'][sectorStyle];
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
  if(sectorStyle<5){
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
    // QUARANTINE LAB: four large isolated research wings connected by
    // pressurised access tunnels and smaller decontamination chambers.
    const span=mapSize*.29;
    for(const [dx,dz] of [[-span,-span],[span,-span],[span,span],[-span,span]]){
      const r=chamber(center+dx,center+dz,13,13);
      road(hub,r,1); // Narrow sterilisation corridors.
      chamber(r.x+(dx<0?3:-3),r.z+(dz<0?3:-3),5,5);
    }
    for(let k=0;k<4;k++)road(anchors[2*k],anchors[(2*((k+1)%4))],1,k%2===0);
    for(let k=0;k<4;k++){let p=anchors[k*2];rect(p.x-2,p.z-2,5,5);}
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
    // UNDERGROUND METRO: one long underground boulevard with platform
    // pairs, lateral tunnels and multiple bypasses at station ends.
    rect(center-3,4,7,mapSize-8);
    for(let i=0;i<5;i++){
      const z=7+i*(mapSize-14)/4;
      for(const side of [-1,1]){
        const p=chamber(center+side*(mapSize*.27),z,12,7);
        road(p,{x:center,z:p.z},2,i%2===0);
      }
    }
    for(let i=0;i<4;i++){
      road(anchors[2*i],anchors[2*i+2],1);
      road(anchors[2*i+1],anchors[2*i+3],1,true);
    }
    rect(4,center-2,mapSize-8,5);
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
  // Tall boss amphitheatre; wide approaches to avoid combat bottlenecks.
  if(boss){rect(center-11,center-11,23,23);anchors.forEach(p=>road(hub,p,2));}
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
  if(!reachable()){for(const [x,z] of covers)m[z][x]=0;}
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