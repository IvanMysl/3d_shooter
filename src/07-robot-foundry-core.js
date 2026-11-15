
// NEON RIFT: ROBOT FOUNDRY II — true procedural hard-surface geometry.
// Mesh data is baked ONCE per archetype into GPU vertex buffers. Animated limbs
// are separate rigid parts; per-enemy allocations are kept small for mobile.
const robotFoundry={};
const RF={
 dark:[.055,.073,.089], rubber:[.084,.099,.112], iron:[.17,.205,.236],
 steel:[.29,.35,.39], ceramic:[.37,.43,.47], light:[.58,.65,.68],
 edge:[.12,.145,.16], brass:[.50,.37,.20], soot:[.027,.040,.053]
};
function robotMaker(){
  const v=[];
  function facet(a,b,c,t,em=0){
    const p=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],q=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
    let n=[p[1]*q[2]-p[2]*q[1],p[2]*q[0]-p[0]*q[2],p[0]*q[1]-p[1]*q[0]];
    const len=Math.hypot(...n)||1;n=n.map(x=>x/len);
    addTri(v,a,b,c,n,t,em);
  }
  function smoothFacet(a,b,c,na,nb,nc,col,em=0){
    // Analytic per-vertex normals remove the visible polygon bands on
    // machine joints and domed composite shells, with unchanged shader format.
    for(const [p,n] of [[a,na],[b,nb],[c,nc]])v.push(...p,...n,...col,em);
  }
  function ellipsoid(cx,cy,cz,rx,ry,rz,col,em=0,segs=12,rings=7){
    const sample=(theta,phi)=>{
      const sa=Math.sin(theta),co=Math.cos(theta);
      const u=sa*Math.cos(phi),w=sa*Math.sin(phi);
      const point=[cx+rx*u,cy+ry*co,cz+rz*w];
      const norm=[u/rx,co/ry,w/rz],len=Math.hypot(...norm)||1;
      return [point,norm.map(t=>t/len)];
    };
    for(let i=0;i<rings;i++)for(let j=0;j<segs;j++){
      const t1=Math.PI*i/rings,t2=Math.PI*(i+1)/rings;
      const a=TAU*j/segs,b=TAU*(j+1)/segs;
      const p=sample(t1,a),q=sample(t1,b),r=sample(t2,a),s=sample(t2,b);
      if(i!==0)smoothFacet(p[0],q[0],r[0],p[1],q[1],r[1],col,em);
      if(i!==rings-1)smoothFacet(q[0],s[0],r[0],q[1],s[1],r[1],col,em);
    }
  }
  function panel(cx,cy,cz,w,h,d,col,em=0,bevel=.15){
    const x=cx-w/2,y=cy-h/2,ex=cx+w/2,ey=cy+h/2;
    const px=w*bevel,py=h*bevel;
    const outline=[[x+px,y],[ex-px,y],[ex,y+py],[ex,ey-py],[ex-px,ey],[x+px,ey],[x,ey-py],[x,y+py]];
    const zz0=cz-d/2,zz1=cz+d/2;
    const centre=[cx,cy,zz1];
    for(let i=0;i<8;i++){
      const j=(i+1)%8,a=outline[i],b=outline[j];
      facet(centre,[a[0],a[1],zz1],[b[0],b[1],zz1],col,em);
      facet([a[0],a[1],zz0],[b[0],b[1],zz0],[b[0],b[1],zz1],col,em);
      facet([a[0],a[1],zz0],[b[0],b[1],zz1],[a[0],a[1],zz1],col,em);
    }
  }
  function poly(shape,z0,z1,col,em=0){
    const n=shape.length,fc=shape.reduce((a,b)=>[a[0]+b[0]/n,a[1]+b[1]/n],[0,0]);
    for(let i=0;i<n;i++){
      const j=(i+1)%n,a=shape[i],b=shape[j];
      facet([fc[0],fc[1],z1],[a[0],a[1],z1],[b[0],b[1],z1],col,em);
      facet([fc[0],fc[1],z0],[b[0],b[1],z0],[a[0],a[1],z0],col,em);
      facet([a[0],a[1],z0],[a[0],a[1],z1],[b[0],b[1],z1],col,em);
      facet([a[0],a[1],z0],[b[0],b[1],z1],[b[0],b[1],z0],col,em);
    }
  }
  function slab(cx,cy,cz,w,h,d,col,em=0){box(v,cx-w/2,cy-h/2,cz-d/2,cx+w/2,cy+h/2,cz+d/2,col,em);}
  function rod(a,b,r,col,em=0,sides=9){
    const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dx,dy,dz)||1;
    const N=[dx/length,dy/length,dz/length],seed=Math.abs(N[1])>.86?[1,0,0]:[0,1,0];
    let U=[N[1]*seed[2]-N[2]*seed[1],N[2]*seed[0]-N[0]*seed[2],N[0]*seed[1]-N[1]*seed[0]],ul=Math.hypot(...U)||1;U=U.map(t=>t/ul);
    const V=[N[1]*U[2]-N[2]*U[1],N[2]*U[0]-N[0]*U[2],N[0]*U[1]-N[1]*U[0]];
    const normal=phi=>U.map((u,i)=>u*Math.cos(phi)+V[i]*Math.sin(phi));
    const point=(org,phi)=>org.map((c,i)=>c+r*normal(phi)[i]);
    for(let i=0;i<sides;i++){
      const p=TAU*i/sides,q=TAU*(i+1)/sides;
      const a0=point(a,p),a1=point(a,q),b0=point(b,p),b1=point(b,q);
      const n0=normal(p),n1=normal(q);
      smoothFacet(a0,a1,b0,n0,n1,n0,col,em);
      smoothFacet(a1,b1,b0,n1,n1,n0,col,em);
      facet(a,a1,a0,col,em);facet(b,b0,b1,col,em);
    }
  }
  function fastener(x,y,z,r=.025,c=RF.light){rod([x,y,z-.016],[x,y,z+.016],r,c,0,7)}
  function vent(x,y,z,n=4,w=.24,col=RF.dark){
    for(let i=0;i<n;i++)slab(x,y+(i-(n-1)/2)*.048,z,w,.018,.025,col);
  }
  return {v,panel,poly,slab,rod,ellipsoid,fastener,vent,finish:()=>toMesh(v)};
}
function robotPalette(kind){
  const styles={
    scout:[.31,.52,.49],charger:[.56,.43,.21],shooter:[.37,.42,.49],
    brute:[.49,.38,.32],sniper:[.36,.35,.41],medic:[.32,.44,.38],
    warden:[.30,.41,.56],artillery:[.48,.38,.27],raider:[.39,.32,.49],
    drone:[.32,.43,.51],boss:[.48,.37,.39]
  };
  const base=styles[kind]||styles.shooter;
  return {base,trim:base.map(v=>v*.48),highlight:base.map(v=>Math.min(.73,v*1.34)),glow:(enemies[kind]?.color||[.97,.43,.33])};
}
// ROBOT FOUNDRY II: per-class baked hard-surface details and asymmetrical silhouettes.
// Shapes are real vertices in the 3D scene (no billboards, external textures or online assets).
function robotDetailMesh(M,kind){
  const {panel,slab,poly,rod,fastener,vent}=M,P=robotPalette(kind),A=P.base,H=P.highlight,G=P.glow;
  const shade=P.trim,hard=RF.iron,dark=RF.dark,bright=RF.light;
  const frame=(x,y,z,w,h,depth,col=hard)=>{
    panel(x,y,z,w,h,depth,col,0,.21);
    panel(x,y,z+depth*.48,w*.73,h*.67,.029,RF.soot,0,.19);
    fastener(x-w*.34,y+h*.31,z+depth*.56,.022);
    fastener(x+w*.34,y-h*.31,z+depth*.56,.022);
  };
  const mark=(x,y,z)=>{ // industrial stencil: 3-digit geometric identification strip
    slab(x,y,z,.20,.018,.023,RF.light);
    slab(x-.07,y-.052,z,.034,.068,.017,RF.light);
    slab(x+.065,y-.052,z,.03,.068,.017,RF.brass);
  };
  const cooling=(x,y,z,s=1)=>{
    panel(x,y,z,.33*s,.23*s,.04,RF.dark);
    for(let i=0;i<5;i++)slab(x+(i-2)*.051*s,y,z+.03*s,.015*s,.17*s,.026*s,RF.iron);
    for(let i=0;i<2;i++)fastener(x+(i?1:-1)*.15*s,y+.106*s,z+.03*s,.009*s);
  };
  const hinge=(x,y,z,r=.11)=>{
    rod([x,y,z-.035],[x,y,z+.045],r,RF.iron,0,10);
    rod([x,y,z+.05],[x,y,z+.067],r*.72,H,0,10);
    rod([x,y,z+.07],[x,y,z+.083],r*.22,RF.soot,0,9);
  };
  const layered=(x,y,z,w,h)=>{
    panel(x,y,z,w,h,.10,shade,0,.24);
    panel(x,y+.018,z+.074,w*.85,h*.75,.056,A,0,.18);
    slab(x,y-h*.15,z+.109,w*.60,.015,.028,RF.dark);
    for(const side of [-1,1])fastener(x+side*w*.35,y+h*.19,z+.115,.018);
  };
  const antenna=(x,y,z,ht=0.37)=>{
    rod([x,y,z],[x,y+ht*.68,z-.045],.022,RF.iron,0,8);
    rod([x,y+ht*.68,z-.045],[x,y+ht,z-.065],.010,RF.brass,0,8);
    panel(x,y+ht,z-.065,.075,.055,.065,G,.18);
  };
  const capacitor=(x,y,z,ht=.38)=>{
    rod([x,y-ht*.5,z],[x,y+ht*.5,z],.060,RF.dark,0,9);
    for(let i=0;i<4;i++){
      const yy=y-ht*.35+i*ht*.24;
      rod([x,yy,z-.01],[x,yy+.01,z+.01],.084,i===2?G:RF.iron,i===2?.12:0,9);
    }
    rod([x,y-ht*.49,z],[x,y+ht*.49,z],.027,RF.light,0,8);
  };
  const gun=(x,y,z,len=.68)=>{
    panel(x,y,z,.24,.22,.37,RF.dark);
    panel(x,y+.125,z-.045,.16,.054,.39,H);
    rod([x,y-.01,z+.05],[x,y-.01,z+.05+len],.072,RF.iron,0,11);
    rod([x,y-.01,z+.05+len],[x,y-.01,z+.12+len],.095,RF.soot,0,10);
    rod([x,y-.01,z+.16+len],[x,y-.01,z+.17+len],.049,G,.17,10);
    for(let i=0;i<3;i++)panel(x,y+.08,z+.23+i*.13,.16,.033,.035,RF.dark);
  };
  const scar=(x,y,z)=>{
    rod([x-.13,y+.034,z],[x-.024,y-.012,z+.008],.008,RF.soot,0,5);
    rod([x-.022,y-.014,z],[x+.093,y-.049,z+.009],.007,RF.brass,0,5);
  };
  if(kind==='scout'||kind==='charger'){
    for(const side of [-1,1]){
      layered(side*.39,1.07,.32,.26,.27);
      hinge(side*.43,.85,.46,.092);
      hinge(side*.40,.82,-.34,.085);
      rod([side*.24,1.22,.28],[side*.47,1.28,.45],.035,RF.iron,0,8);
    }
    // Segment carapace into overlap plates and place the vented power spine.
    for(let i=0;i<5;i++){
      const z=-.49+i*.17;
      panel(0,1.29,z,.60-i*.025,.06,.15,i%2?H:A,0,.18);
      for(const side of [-1,1])fastener(side*(.24-i*.009),1.32,z+.078,.012);
    }
    for(let side of [-1,1]){
      panel(side*.28,.99,.80,.10,.09,.035,G,.38);
      rod([side*.26,1.03,.80],[side*.37,1.12,1.04],.035,RF.dark,0,7);
    }
    if(kind==='charger'){
      for(const side of [-1,1]){
        rod([side*.31,1.1,.73],[side*.52,1.38,1.30],.052,H,0,9);
        rod([side*.52,1.38,1.30],[side*.62,1.35,1.46],.026,RF.light,0,7);
      }
    }
    mark(0,1.16,.84);
    return;
  }
  if(kind==='drone'){
    // Swept aerospace armoring, exposed lift fans, sensor radome and engines.
    for(let side of [-1,1]){
      frame(side*.65,1.13,.06,.38,.19,.10);
      panel(side*.96,1.06,.25,.34,.045,.42,A);
      panel(side*1.12,.96,-.11,.25,.08,.37,RF.iron);
      rod([side*.94,.88,-.35],[side*.94,1.20,-.35],.109,RF.soot,0,12);
      rod([side*.94,.87,-.35],[side*.94,1.21,-.35],.058,RF.iron,0,10);
      for(let i=0;i<6;i++){
        const a=i*TAU/6;
        rod([side*.94,.97,-.35],[side*.94+.16*Math.cos(a),.97,-.35+.16*Math.sin(a)],.019,bright,0,6);
      }
      panel(side*.69,.88,.47,.19,.07,.05,G,.45);
    }
    panel(0,1.03,.86,.29,.17,.10,RF.soot);
    for(let i=-1;i<=1;i++)panel(i*.10,1.04,.925,.08,.056,.018,i===0?G:RF.light,i===0?.65:.02);
    antenna(0,1.34,-.12,.35);
    cooling(0,.86,.60,.80);
    return;
  }
  if(kind==='medic'){
    for(let side of [-1,1]){
      capacitor(side*.48,1.19,-.09,.58);
      rod([side*.38,1.34,.02],[side*.74,1.07,.05],.05,RF.iron,0,9);
      layered(side*.59,1.13,.31,.26,.35);
      rod([side*.71,.88,.24],[side*.87,.72,.64],.041,RF.light,0,9);
      rod([side*.87,.72,.64],[side*.82,.64,.78],.025,G,.24,7);
    }
    frame(0,1.16,.48,.42,.44,.07,RF.light);
    slab(0,1.16,.57,.07,.26,.035,G,1.3);
    slab(0,1.16,.57,.26,.07,.034,G,1.3);
    vent(0,.89,.56,4,.3);
    antenna(0,1.67,-.02,.33);
    return;
  }
  // Shared infantry details — distinctive layered armor, shoulder hinges,
  // service piping, exposed substructure and machined edge highlights.
  const wide=['brute','warden','artillery','boss'].includes(kind)?1.17:1;
  for(const side of [-1,1]){
    layered(side*.30*wide,1.38,.445,.27,.33);
    panel(side*.52*wide,1.64,.07,.35,.15,.42,H);
    hinge(side*.55*wide,1.39,.12,.103*wide);
    cooling(side*.27*wide,.88,-.36,.61);
    rod([side*.30*wide,.92,-.20],[side*.45*wide,1.34,-.32],.029,RF.light,0,8);
    rod([side*.23*wide,1.55,-.37],[side*.48*wide,1.53,-.19],.033,RF.iron,0,9);
    fastener(side*.50*wide,1.70,.25,.025);
    panel(side*.31*wide,.68,.41,.11,.18,.045,shade);
    // Three-layer hip skirts create a realistic overlapping silhouette.
    for(let i=0;i<3;i++)panel(side*(.29+i*.025)*wide,.70-i*.045,.27+i*.018,.15,.10,.13,i===1?H:A);
  }
  frame(0,1.12,-.45,.45,.49,.11);
  cooling(0,1.03,.48,.72);
  layered(0,1.59,.28,.26,.135);
  slab(0,1.03,-.47,.15,.33,.18,RF.iron);
  antenna(.26*wide,1.96,-.22,.32);
  mark(-.29*wide,1.53,.46);
  if(kind==='shooter'){
    // Rifleman: right-shoulder rotary optics, left tactical control box.
    gun(.59,1.29,.15,.52);
    panel(-.51,1.43,-.16,.31,.29,.36,RF.dark);
    panel(-.51,1.48,.04,.20,.07,.03,G,.34);
    antenna(-.48,1.63,-.23,.20);
    scar(.25,1.38,.53);
  }else if(kind==='sniper'){
    // Recon sniper: long slender rail, dual optics, bipod and targeting cable.
    gun(.46,1.51,.21,1.20);
    rod([.47,1.64,-.37],[.47,1.64,1.24],.033,RF.light,0,10);
    panel(.46,1.75,.24,.14,.13,.38,RF.dark);
    rod([.47,1.75,.12],[.47,1.75,.53],.044,G,.27,9);
    for(let side of [-1,1])rod([.46,1.43,.66],[.46+side*.18,1.04,.70],.028,RF.iron,0,9);
    antenna(-.33,1.96,-.11,.53);
  }else if(kind==='brute'){
    // Close-range heavy: raised impact guards, serrated fore-collar, blast pads.
    for(let side of [-1,1]){
      layered(side*.57,1.52,.37,.36,.40);
      panel(side*.58,1.29,.49,.24,.18,.17,H);
      rod([side*.59,1.72,-.24],[side*.70,1.92,-.14],.080,RF.iron,0,9);
      panel(side*.69,1.91,-.12,.17,.25,.18,shade);
      hinge(side*.31,.91,.28,.12);
      scar(side*.48,1.55,.64);
    }
    panel(0,1.72,.48,.51,.19,.15,RF.dark);
    for(let i=0;i<5;i++)slab((i-2)*.099,1.74,.57,.077,.034,.022,RF.brass);
  }else if(kind==='warden'){
    // Guardian: flared side shield emitters and modular barrier cells.
    for(let side of [-1,1]){
      panel(side*.81,1.35,.06,.44,.82,.22,RF.dark);
      panel(side*.84,1.37,.19,.28,.63,.10,A);
      for(let j=0;j<4;j++)panel(side*.85,1.09+j*.17,.26,.20,.09,.028,j===2?G:RF.light,j===2?.24:0);
      rod([side*.55,1.45,-.36],[side*.72,1.61,-.34],.052,G,.18,10);
    }
    frame(0,1.40,.58,.34,.32,.08,H);
    panel(0,1.4,.65,.22,.22,.035,G,.55);
  }else if(kind==='artillery'){
    // Long-range artillery: three-barrel missile tubes and stabilizer fins.
    for(let side of [-1,1]){
      panel(side*.81,1.53,-.27,.54,.54,.84,RF.dark);
      panel(side*.81,1.53,.20,.48,.49,.11,A);
      for(let j=-1;j<=1;j++){
        rod([side*.81+j*.125,1.52,.18],[side*.81+j*.125,1.52,.75],.072,RF.soot,0,11);
        rod([side*.81+j*.125,1.52,.76],[side*.81+j*.125,1.52,.80],.044,RF.brass,0,8);
      }
      panel(side*.81,1.83,-.36,.30,.10,.48,H);
      rod([side*.65,1.43,-.67],[side*.56,1.18,-.55],.045,RF.light,0,9);
    }
    mark(0,1.32,.52);
  }else if(kind==='raider'){
    // Raider: lean skeleton, swept blades, purple energy capacitors.
    for(let side of [-1,1]){
      rod([side*.31,1.55,-.24],[side*.63,1.84,-.60],.055,H,0,9);
      rod([side*.63,1.84,-.60],[side*.66,2.03,-.82],.025,RF.light,0,7);
      panel(side*.41,1.04,.33,.13,.47,.07,A);
      rod([side*.43,.86,-.05],[side*.60,.58,.05],.035,RF.iron,0,9);
      capacitor(side*.53,1.40,-.28,.38);
    }
    frame(0,1.39,.47,.30,.23,.10);
    panel(0,1.39,.54,.16,.10,.02,G,.65);
  }else if(kind==='boss'){
    // Titan command frame: oversized plated spine, multiple independent weapon pods,
    // layered reactor chassis and heavy field-generator spars.
    for(let side of [-1,1]){
      layered(side*.61,1.59,.28,.53,.49);
      gun(side*.81,1.43,.38,.65);
      for(let j=-1;j<=1;j++)rod([side*.82+j*.105,1.23,-.40],[side*.82+j*.105,1.23,.66],.055,RF.soot,0,10);
      panel(side*.55,1.01,.44,.29,.42,.14,shade);
      rod([side*.36,1.89,-.35],[side*.69,2.16,-.47],.048,H,0,8);
      panel(side*.68,2.18,-.47,.16,.24,.25,A);
      cooling(side*.29,1.51,.59,.58);
    }
    frame(0,1.34,.56,.55,.53,.14,H);
    panel(0,1.32,.68,.36,.35,.055,G,.52);
    for(let j=0;j<4;j++)panel(0,1.11+j*.14,.70,.25-.035*j,.026,.020,j===2?RF.light:RF.dark,j===2?.07:0);
    antenna(0,2.10,-.27,.50);
  }
  // Deterministic manufacturing scratches: close-up detail, not random per frame.
  scar(-.23*wide,1.22,.50);
  if(kind!=='medic')scar(.19*wide,.89,.47);
}
