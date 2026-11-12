

// Fine motor modules: four separate articulated pieces per biped. Shorter
// limb pivots allow knees and elbows to move independently, unlike a single box.
function buildRobotArticulatedPart(kind,which){
  const M=robotMaker(),{panel,slab,rod,fastener}=M,P=robotPalette(kind);
  const width=['boss','brute','artillery','warden'].includes(kind)?1.17:(kind==='raider'?.85:1);
  const W=width, A=P.base,H=P.highlight;
  if(which==='upperLeg'){
    rod([0,-.04,0],[0,-.42,.025],.10*W,RF.iron,0,11);
    panel(0,-.20,.06,.36*W,.34,.32,RF.dark);
    panel(0,-.20,.24,.31*W,.36,.125,A);
    panel(0,-.13,.32,.24*W,.15,.045,H);
    rod([.16*W,-.02,-.035],[.17*W,-.39,.08],.039,RF.light,0,9);
    rod([-.13*W,-.05,.04],[-.13*W,-.38,.04],.030,RF.iron,0,9);
    panel(0,-.42,.07,.30*W,.12,.31,RF.iron);
    for(let side of [-1,1])fastener(side*.12*W,-.41,.24,.019);
  }else if(which==='lowerLeg'){
    rod([0,-.02,0],[0,-.32,.01],.086*W,RF.iron,0,10);
    panel(0,-.18,.05,.38*W,.32,.29,RF.dark);
    panel(0,-.15,.23,.31*W,.25,.10,A);
    panel(0,-.23,.29,.23*W,.10,.035,H);
    rod([-.14*W,-.03,-.055],[-.14*W,-.31,-.04],.033,RF.light,0,9);
    rod([.14*W,-.03,-.055],[.14*W,-.31,-.04],.035,RF.iron,0,9);
    slab(0,-.43,.19,.44*W,.14,.54,RF.soot);
    panel(0,-.37,.42,.37*W,.12,.14,A);
    panel(0,-.46,.37,.36*W,.033,.18,RF.iron);
    for(let side of [-1,1]){
      panel(side*.13*W,-.43,.49,.10,.038,.08,H);
      fastener(side*.16*W,-.18,.30,.024);
    }
  }else if(which==='upperArm'){
    panel(0,-.04,.05,.38*W,.31,.47,RF.dark);
    panel(0,.02,.14,.36*W,.20,.42,H);
    panel(0,-.13,.29,.29*W,.20,.12,A);
    rod([0,-.15,-.02],[0,-.39,.075],.075*W,RF.iron,0,9);
    rod([.15*W,-.13,-.12],[.14*W,-.37,-.04],.033,RF.light,0,8);
    panel(0,-.40,.11,.25,.15,.22,RF.iron);
    for(let side of [-1,1])fastener(side*.12*W,-.41,.23,.019);
  }else if(which==='foreArm'){
    rod([0,-.015,0],[0,-.32,.07],.073*W,RF.iron,0,9);
    panel(0,-.17,.12,.26*W,.28,.39,RF.dark);
    panel(0,-.14,.33,.24*W,.26,.105,A);
    panel(0,-.11,.40,.16*W,.054,.022,H);
    slab(0,-.37,.22,.25*W,.15,.27,RF.iron);
    for(let side of [-1,1]){
      rod([side*.06,-.40,.22],[side*.13,-.49,.39],.03,RF.dark,0,8);
      rod([side*.08,-.41,.20],[side*.12,-.48,.30],.019,RF.light,0,7);
    }
    if(kind==='shooter'||kind==='sniper'||kind==='artillery'){
      panel(0,-.24,.39,.19,.17,.35,RF.dark);
      rod([0,-.23,.42],[0,-.23,.73],.045,RF.iron,0,9);
      rod([0,-.23,.73],[0,-.23,.80],.062,RF.soot,0,9);
      panel(0,-.16,.53,.16,.033,.17,P.glow,.18);
    }
    if(kind==='raider'){
      rod([0,-.30,.33],[0,-.54,.78],.050,P.highlight,0,8);
      rod([0,-.54,.78],[0,-.61,.95],.020,RF.light,0,7);
    }
  }
  return M.finish();
}

function buildRobotAnimatedSensors(kind){
  const M=robotMaker(),{panel,rod,slab,fastener}=M,P=robotPalette(kind);
  const G=P.glow;
  if(kind==='scout'||kind==='charger'){
    panel(0,1.01,.94,.35,.13,.05,RF.soot);
    for(let side of [-1,1]){
      panel(side*.11,1.025,.98,.105,.045,.026,G,.42);
      rod([side*.25,1.09,.70],[side*.35,1.21,1.01],.023,RF.light,0,7);
    }
  }else if(kind==='drone'){
    panel(0,1.02,1.0,.27,.17,.07,RF.soot);
    panel(0,1.04,1.055,.18,.052,.025,G,.85);
    for(let side of [-1,1])panel(side*.22,1.0,.96,.055,.11,.03,RF.light);
  }else if(kind==='medic'){
    panel(0,1.28,.62,.28,.24,.06,RF.soot);
    slab(0,1.28,.655,.045,.18,.02,G,1.1);
    slab(0,1.28,.657,.18,.045,.02,G,1.1);
  }else{
    // Separate floating optic/face armor enables scanning motion.
    panel(0,1.88,.405,.39,.18,.095,RF.soot);
    panel(0,1.91,.468,.31,.095,.038,RF.dark);
    for(let side of [-1,1]){
      panel(side*.096,1.915,.49,.126,.038,.018,G,.96,.25);
      panel(side*.246,1.855,.36,.085,.23,.11,P.base);
    }
    panel(0,1.764,.445,.20,.069,.06,P.trim);
    for(let i=-1;i<=1;i++)slab(i*.043,1.748,.485,.027,.018,.024,RF.light);
    if(kind==='boss'||kind==='brute'){
      panel(0,2.07,.18,.35,.15,.30,P.highlight);
      for(let side of [-1,1])panel(side*.24,2.03,.2,.125,.26,.31,P.base);
    }
  }
  return M.finish();
}

// Baked alternate plating exposed after armor loss. Drawn only for close,
// damaged enemies; on death no decal or permanent ground shadow is created.
function buildRobotDamageOverlay(kind){
  const M=robotMaker(),{panel,poly,rod,slab}=M,P=robotPalette(kind);
  const insect=kind==='scout'||kind==='charger',flyer=kind==='drone',medic=kind==='medic';
  const C=RF.soot,B=RF.brass,K=RF.iron;
  if(insect){
    poly([[-.25,1.10],[-.06,1.19],[.09,1.14],[-.04,.99]],.60,.65,C);
    for(let j=0;j<3;j++)rod([-.20+j*.13,1.03,.63],[-.14+j*.13,1.15,.67],.022,B,0,7);
    panel(.21,1.08,.58,.18,.07,.035,P.glow,.13);
  }else if(flyer){
    panel(-.26,1.15,.66,.31,.13,.047,C);
    panel(-.26,1.15,.70,.18,.030,.027,P.glow,.17);
    for(let j=0;j<4;j++)rod([.11+j*.060,.91,.62],[.17+j*.060,1.06,.73],.017,K,0,6);
  }else if(medic){
    panel(-.30,1.25,.54,.27,.35,.085,C);
    for(let j=0;j<3;j++)rod([-.39+j*.12,1.10,.61],[-.34+j*.12,1.39,.63],.025,B,0,7);
    panel(-.27,1.24,.68,.13,.034,.027,P.glow,.15);
  }else{
    const wid=kind==='boss'?1.23:1;
    // Torn oblique plates reveal the dark chassis, hydraulic lines and wires.
    poly([[-.29*wid,1.28],[-.23*wid,1.56],[-.08*wid,1.53],[.02,1.42],[-.04*wid,1.20]],.492,.56,C);
    poly([[.16*wid,1.47],[.32*wid,1.46],[.23*wid,1.26],[.10*wid,1.23]],.492,.57,K);
    for(let j=0;j<4;j++){
      const x=-.24*wid+j*.095*wid;
      rod([x,1.26,.57],[x+.07,1.43,.59],.020,j%2?B:RF.light,0,7);
    }
    panel(.19*wid,1.37,.60,.15,.07,.04,P.glow,.13);
    panel(-.19*wid,1.16,.53,.26,.10,.047,RF.dark);
    slab(-.19*wid,1.12,.565,.17,.032,.025,RF.light);
    if(kind==='boss'||kind==='brute'){
      poly([[.37,1.62],[.64,1.62],[.61,1.43],[.42,1.47]],.52,.61,RF.soot);
      for(let j=0;j<3;j++)rod([.41+j*.075,1.47,.64],[.44+j*.075,1.63,.65],.025,B,0,7);
    }
  }
  return M.finish();
}


// Robot Foundry IV: manufacturing-layer meshes add cast-iron ribs, complex layered
// ceramic armor, functional hinges and class-specific silhouettes. They are baked
// into the archetype's static GPU buffer (zero extra draw calls per enemy).
function robotArmorKit(M,kind){
 const {panel,slab,poly,rod,fastener,vent}=M, P=robotPalette(kind);
 const heavy=['boss','brute','artillery','warden'].includes(kind),wide=heavy?1.13:(kind==='sniper'?.69:kind==='raider'?.82:1);
 const dark=RF.soot,base=P.base,bright=P.highlight,trim=P.trim;
 const small=(x,y,z,s=.04)=>fastener(x,y,z,s,RF.light);
 if(kind==='scout'||kind==='charger'){
  // Segmented insect carapace plates do not obscure the two front optics.
  for(let z=-.31;z<.26;z+=.18){
   panel(0,1.29,z,.51,.072,.23,bright);
   panel(-.23,1.26,z,.13,.035,.18,RF.iron);
   panel(.23,1.26,z,.13,.035,.18,RF.iron);
   small(-.18,1.30,z+.12,.014);small(.18,1.30,z+.12,.014);
  }
  for(let side of [-1,1]){
   rod([side*.26,1.25,.15],[side*.47,1.09,.13],.047,RF.iron);
   panel(side*.44,1.07,.15,.16,.12,.20,trim);
   panel(side*.30,.94,.50,.22,.12,.10,dark);
  }
  return;
 }
 if(kind==='drone'){
  for(let side of [-1,1]){
   const s=side;
   for(let j=0;j<3;j++){
    const x=s*(.58+j*.24),z=-.08-j*.08;
    panel(x,1.14,z,.24,.07,.32,j%2?base:bright);
    slab(x,1.185,z,.15,.015,.23,dark);
   }
   rod([s*.71,.91,-.15],[s*1.11,.89,-.29],.046,RF.iron);
   panel(s*1.03,.88,-.09,.25,.10,.21,RF.iron);
   panel(s*.58,1.10,.21,.11,.08,.17,P.glow,.23);
  }
  vent(0,1.22,.44,4,.31,dark);
  return;
 }
 if(kind==='medic'){
  for(let side of [-1,1]){
   panel(side*.28,1.27,.50,.23,.36,.068,bright);
   for(let k=0;k<3;k++)slab(side*.28,1.14+k*.11,.558,.16,.022,.021,dark);
   rod([side*.36,1.06,-.22],[side*.47,.89,-.39],.047,RF.light);
  }
  panel(0,1.72,.11,.39,.09,.28,RF.light);
  small(-.18,1.67,.30,.018);small(.18,1.67,.30,.018);
  return;
 }
 // Layered lamellar chest plates with exposed chassis seam and small bevelled edges.
 for(let side of [-1,1]){
  const x=side*.23*wide;
  panel(x,1.48,.52,.23*wide,.18,.12,bright);
  panel(x,1.32,.53,.26*wide,.14,.12,base);
  panel(x,1.21,.535,.25*wide,.075,.12,trim);
  slab(x,1.37,.608,.17*wide,.014,.019,RF.light);
  small(x+side*.067,1.51,.606,.015);small(x-side*.071,1.24,.603,.014);
  // Shoulder pauldron, external hinge and fasteners.
  panel(side*.52*wide,1.58,.36,.28*wide,.23,.24,bright);
  panel(side*.57*wide,1.44,.47,.24*wide,.12,.11,base);
  rod([side*.43*wide,1.47,.13],[side*.62*wide,1.40,.14],.065,RF.iron);
  rod([side*.43*wide,1.47,.13],[side*.62*wide,1.40,.14],.029,RF.light);
  small(side*.57*wide,1.58,.50,.018);
  // Hip armor and protected waist joints.
  panel(side*.30*wide,.94,.39,.18,.12,.21,trim);
  for(let j=0;j<3;j++)slab(side*.30*wide,.85-j*.065,.45,.15,.033,.055,j===0?base:RF.iron);
  small(side*.30*wide,.96,.49,.016);
 }
 for(let j=0;j<3;j++){
  slab(-.074+j*.074,1.29,.621,.028,.16,.017,RF.iron);
 }
 // Vents on upper back are functional radiators rather than random cubes.
 for(let side of [-1,1]){
  panel(side*.25,1.41,-.39,.33,.35,.09,RF.dark);
  for(let k=0;k<5;k++)slab(side*.25,1.26+k*.065,-.45,.21,.024,.022,k%2?RF.iron:RF.soot);
 }
 if(kind==='sniper'){
  for(let j=0;j<4;j++){
   slab(.37,1.62,-.45+j*.20,.20,.029,.06,RF.iron);
  }
  panel(.41,1.72,.56,.24,.09,.25,dark);
  panel(.41,1.77,.56,.16,.026,.15,P.glow,.24);
 } else if(kind==='artillery'||kind==='boss'){
  for(let s of [-1,1])for(let j=0;j<2;j++){
   const x=s*(.59*wide+j*.08);
   rod([x,1.49,-.59],[x,1.49,.40],.038,RF.iron);
   panel(x,1.49,.42,.094,.075,.055,RF.soot);
  }
  panel(0,1.58,.60,.34,.10,.077,RF.iron);
 } else if(kind==='warden'){
  for(let s of [-1,1]){
   rod([s*.52,1.67,-.23],[s*.68,1.67,-.60],.051,RF.iron);
   panel(s*.68,1.67,-.57,.20,.13,.16,P.glow,.18);
  }
 } else if(kind==='raider'){
  for(let s of [-1,1]){
   panel(s*.26,.96,.52,.10,.20,.045,P.glow,.30);
   rod([s*.31,1.51,-.32],[s*.47,1.88,-.47],.028,RF.light);
  }
 } else if(kind==='brute'){
  for(let side of [-1,1]){
   poly([[side*.27,1.67],[side*.57,1.72],[side*.72,1.59],[side*.52,1.40]],.46,.57,bright);
   panel(side*.50,1.57,.605,.22,.042,.032,dark);
  }
 }
}


// FOUNDRY IV: silhouette and articulation engineering. Each archetype receives
// class-specific hard-surface armor with chamfered plates, mechanical cavities,
// constrained joints and a legible optics/cooling system. Geometry is baked once.
function robotForgeSilhouette(M,kind){
 const {panel,poly,slab,rod,fastener,vent}=M;
 const P=robotPalette(kind),armor=P.base,edge=P.highlight,shadow=RF.soot,metal=RF.iron;
 const vivid=P.glow,lead=RF.light,trim=P.trim;
 const shape=(a,z0,z1,col=armor,glow=0)=>poly(a,z0,z1,col,glow);
 const rivet=(x,y,z)=>fastener(x,y,z,.012,RF.light);
 const tracer=(a,b)=>rod(a,b,.011,RF.light,0,6);
 const pip=(x,y,z,r=.018)=>rod([x,y,z],[x,y,z+.013],r,vivid,.3,7);
 const boltRows=(x,y,z,w,n=3)=>{for(let j=0;j<n;j++)rivet(x-w/2+w*j/(n-1),y,z)};
 const duct=(x,y,z,h)=>{
   panel(x,y,z,.18,h,.11,RF.dark);
   for(let i=0;i<5;i++)slab(x,y-h*.35+i*h*.17,z+.070,.12,.015,.025,metal);
 };
 const cheek=(side,x,y,z,scale=1)=>{
   const s=side;
   shape([[s*(x-.03)*scale,y-.18],[s*(x+.09)*scale,y-.12],[s*(x+.15)*scale,y+.05],[s*(x+.03)*scale,y+.19],[s*(x-.055)*scale,y+.075]],z-.07,z+.08,armor);
   pip(s*(x+.05)*scale,y-.037,z+.1,.016);
 };
 if(kind==='scout'||kind==='charger'){
   // Organic insect-machine silhouette: segmented back, mandibular protective
   // horns, antenna housings and external joint struts for quadruped legs.
   for(let i=0;i<4;i++){
     const z=-.39+i*.25,ext=.39-(i%2)*.025;
     shape([[-ext,1.14],[-ext*.66,1.36],[0,1.40],[ext*.66,1.36],[ext,1.14]],z-.11,z+.12,i%2?edge:armor);
     slab(0,1.403,z,.22,.018,.12,shadow);
     boltRows(0,1.29,z+.129,.52,3);
   }
   for(const side of [-1,1]){
     const x=side;
     shape([[x*.18,.84],[x*.29,.92],[x*.49,.97],[x*.57,.80],[x*.35,.66]],.52,.66,edge);
     rod([x*.44,.81,.55],[x*.58,.60,.77],.05,metal,0,9);
     rod([x*.58,.60,.77],[x*.51,.57,.97],.026,lead,0,7);
     shape([[x*.16,1.05],[x*.26,1.13],[x*.33,1.19],[x*.19,1.18]],.78,.98,shadow);
     pip(x*.25,1.123,1.00,.021);
     rod([x*.31,1.31,.12],[x*.66,1.36,.02],.035,metal,0,8);
   }
   if(kind==='charger'){
     for(const s of [-1,1]){
       rod([s*.41,1.22,.74],[s*.60,1.43,1.19],.067,RF.iron,0,9);
       shape([[s*.49,1.32],[s*.59,1.50],[s*.68,1.41]],1.12,1.31,lead);
     }
   }else{
     // rear counter-balance and horizontal cooling fins
     rod([0,1.02,-.5],[0,.96,-.92],.09,metal,0,10);
     for(let i=0;i<3;i++)slab(0,1.1+i*.075,-.66,.45-i*.065,.022,.20,shadow);
   }
   return;
 }
 if(kind==='drone'){
   // A winged spacecraft-inspired drone, not a hovering cube.
   shape([[-.42,1.02],[0,1.38],[.42,1.02],[0,.88]],.35,.83,edge);
   panel(0,1.11,.86,.23,.13,.10,shadow);
   for(const side of [-1,1]){
     const s=side;
     shape([[s*.50,1.17],[s*.88,1.26],[s*1.46,1.08],[s*1.32,.94],[s*.85,1.00]],-.28,.07,armor);
     shape([[s*.70,1.22],[s*1.14,1.14],[s*1.23,1.09],[s*.75,1.13]],.07,.11,edge);
     rod([s*.57,.97,-.09],[s*1.33,.96,-.35],.046,metal,0,9);
     rod([s*1.16,.91,-.47],[s*1.16,1.12,-.47],.12,RF.dark,0,12);
     pip(s*1.25,.94,-.32,.04);
     panel(s*1.27,.99,-.16,.18,.095,.13,vivid,.19);
     shape([[s*.61,1.04],[s*.80,1.00],[s*.91,.91],[s*.70,.91]],.34,.49,trim);
   }
   // chin camera cluster
   for(let j=-1;j<=1;j++)pip(j*.09,1.023,.994,.018);
   return;
 }
 if(kind==='medic'){
   for(const side of [-1,1]){
     const s=side;
     shape([[s*.28,1.52],[s*.55,1.46],[s*.68,1.24],[s*.48,1.18],[s*.29,1.30]],.20,.42,RF.light);
     rod([s*.48,1.30,-.2],[s*.65,1.52,-.39],.056,metal,0,9);
     duct(s*.46,1.18,.45,.25);
     pip(s*.57,1.05,.54,.022);
     rod([s*.69,1.03,.13],[s*.85,.73,.28],.035,lead,0,8);
     panel(s*.84,.72,.34,.18,.08,.14,vivid,.2);
   }
   // illuminated halo around triage insignia and power injection ports
   for(let j=0;j<4;j++){
     const a=j*Math.PI*.5;
     pip(Math.cos(a)*.245,1.27+Math.sin(a)*.245,.565,.024);
   }
   return;
 }
 const giant=kind==='boss',heavy=giant||kind==='brute'||kind==='warden'||kind==='artillery';
 const slim=kind==='sniper',fast=kind==='raider';
 const width=giant?1.30:heavy?1.17:slim?.75:fast?.85:1;
 // Faceted breastplate with central vent channel and layered abdominal cover.
 shape([[-.39*width,1.56],[-.29*width,1.73],[-.08*width,1.72],[-.03*width,1.42],[-.24*width,1.27],[-.43*width,1.36]],.48,.65,edge);
 shape([[.39*width,1.56],[.29*width,1.73],[.08*width,1.72],[.03*width,1.42],[.24*width,1.27],[.43*width,1.36]],.48,.65,armor);
 panel(0,1.37,.68,.079,.29,.042,shadow);
 for(let i=0;i<3;i++)slab(0,1.29+i*.09,.712,.044,.022,.03,i===1?vivid:lead,i===1?.22:0);
 for(const side of [-1,1]){
   const s=side;
   // Canted, flared shoulder pauldron; actual silhouette-shaping geometry.
   shape([[s*.39*width,1.75],[s*.62*width,1.80],[s*.76*width,1.68],[s*.80*width,1.52],[s*.59*width,1.47],[s*.44*width,1.52]],.09,.43,edge);
   shape([[s*.52*width,1.71],[s*.68*width,1.70],[s*.73*width,1.59],[s*.60*width,1.61]],.45,.52,trim);
   rod([s*.46*width,1.43,.1],[s*.63*width,1.41,.14],.08,metal,0,11);
   rod([s*.46*width,1.43,.1],[s*.63*width,1.41,.14],.036,lead,0,8);
   for(let i=0;i<3;i++)pip(s*(.53+i*.047)*width,1.58,.535,.015);
   // side waist cooling fins with distinct cast shadows
   duct(s*.47*width,1.13,.04,.37);
   shape([[s*.25*width,.94],[s*.45*width,1.02],[s*.49*width,.83],[s*.29*width,.74]],.28,.46,armor);
   tracer([s*.28*width,.88,.44],[s*.34*width,.80,.49]);
 }
 // recessed goggle sockets and armored frowning eyebrow, distinguishing head.
 shape([[-.27*width,1.99],[-.19*width,2.05],[.18*width,2.05],[.28*width,1.97],[.18*width,1.92],[-.18*width,1.92]],.30,.40,trim);
 panel(0,1.882,.438,.31*width,.09,.06,shadow);
 for(const s of [-1,1])cheek(s,.23,1.854,.32,width);
 // side collars and dorsal coolant manifold
 for(const s of [-1,1]){
   rod([s*.28*width,1.64,-.27],[s*.43*width,1.82,-.40],.046,metal,0,8);
   shape([[s*.34*width,1.79],[s*.51*width,1.72],[s*.51*width,1.58],[s*.36*width,1.62]],-.40,-.24,shadow);
 }
 for(let j=-2;j<=2;j++){
   const x=j*.088*width;
   slab(x,1.45,-.49,.055,.28,.072,j%2?metal:RF.dark);
 }
 // Thin raised emblems / warning chevrons without texture dependencies.
 for(const s of [-1,1]){
   tracer([s*.24*width,1.40,.685],[s*.30*width,1.42,.684]);
   tracer([s*.30*width,1.42,.684],[s*.36*width,1.40,.68]);
 }
 if(slim){
   // dedicated long-range optics, active stabilisers and slender head fin
   rod([0,2.01,-.06],[0,2.27,-.27],.038,metal,0,8);
   shape([[-.11,2.25],[0,2.34],[.11,2.25]],-.30,-.13,edge);
   for(let s of [-1,1])rod([s*.4,1.63,-.31],[s*.70,1.89,-.41],.026,lead,0,8);
   pip(.41,1.72,.81,.042);
 } else if(fast){
   // sweeping shock vanes and thigh blades distinguish the fast unit
   for(let s of [-1,1]){
     shape([[s*.4,1.65],[s*.67,1.79],[s*.57,1.43]],-.52,-.28,edge);
     shape([[s*.30,.78],[s*.47,.72],[s*.34,.46]],.2,.42,armor);
   }
 } else if(kind==='warden'){
   // broad forked shield generators, no oversized translucent billboard
   for(let s of [-1,1]){
     rod([s*.46,1.64,-.33],[s*.80,1.76,-.47],.055,metal,0,9);
     shape([[s*.60,1.74],[s*.90,1.81],[s*.99,1.56],[s*.67,1.51]],-.54,-.39,edge);
     pip(s*.81,1.64,-.375,.038);
   }
 } else if(giant||kind==='artillery'){
   // Shoulder missile launchers with exposed multi-cell shutters.
   for(let s of [-1,1]){
     shape([[s*.56,1.70],[s*.84,1.72],[s*.88,1.39],[s*.58,1.40]],-.57,-.15,shadow);
     for(let i=0;i<3;i++){
       const x=s*(.65+i*.073);
       rod([x,1.53,-.60],[x,1.53,-.12],.038,metal,0,8);
       pip(x,1.53,-.11,.024);
     }
   }
   if(giant){
     shape([[-.31,2.02],[-.26,2.24],[0,2.31],[.26,2.24],[.31,2.02]],-.14,.20,edge);
     for(let s of [-1,1]){
       rod([s*.32,2.04,-.14],[s*.55,2.25,-.29],.047,metal,0,9);
       shape([[s*.47,2.19],[s*.60,2.29],[s*.67,2.15]],-.35,-.19,trim);
     }
   }
 } else if(kind==='brute'){
   for(let s of [-1,1]){
     shape([[s*.54,1.70],[s*.79,1.65],[s*.84,1.39],[s*.63,1.34]],.22,.49,edge);
     panel(s*.67,1.52,.515,.19,.058,.045,shadow);
     pip(s*.69,1.46,.55,.028);
   }
 }
 // Inspection markings and recessed screws are deliberately sparse.
 rivet(-.24*width,1.52,.665);rivet(.24*width,1.52,.665);
 rivet(-.25*width,1.27,.62);rivet(.25*width,1.27,.62);
}

function buildRobotBody(kind,withDetails=true){
  const M=robotMaker(),{panel,slab,poly,rod,fastener,vent}=M;
  const P=robotPalette(kind),A=P.base,H=P.highlight,G=P.glow;
  const insect=kind==='scout'||kind==='charger',flyer=kind==='drone',medic=kind==='medic';
  const giant=kind==='boss',heavy=kind==='brute'||kind==='warden'||kind==='artillery'||giant;
  const sniper=kind==='sniper',quick=kind==='raider';
  if(insect){
    // Long segmented carapace, wedge-shaped head, articulated mandibles.
    poly([[-.38,.73],[-.53,1.00],[-.40,1.20],[0,1.30],[.40,1.20],[.53,1.0],[.38,.73]],-.53,.40,RF.dark);
    panel(0,1.07,-.02,.86,.37,.83,A);
    poly([[-.29,.93],[-.40,1.10],[-.25,1.25],[.25,1.25],[.40,1.10],[.29,.93]],.27,.50,H);
    for(let s of [-1,1]){
      panel(s*.36,1.03,.35,.24,.31,.13,P.trim);
      rod([s*.28,.93,.53],[s*.50,.67,.74],.055,RF.iron);
      panel(s*.44,.83,.68,.17,.19,.14,A);
    }
    poly([[-.25,.72],[-.34,.97],[0,1.06],[.34,.97],[.25,.72]],.47,.76,RF.iron);
    panel(0,.97,.77,.42,.10,.09,RF.dark);
    for(let s of [-1,1])panel(s*.13,.98,.83,.17,.05,.035,G,1.3,.27);
    for(let z of [-.40,-.22,-.04]){
      slab(0,1.28,z,.59,.045,.055,RF.edge);
      fastener(-.30,1.25,z,.019);
      fastener(.30,1.25,z,.019);
    }
    if(kind==='charger'){
      for(let s of [-1,1])rod([s*.21,1.10,.64],[s*.41,1.32,1.12],.069,H);
      panel(0,1.12,.88,.18,.31,.18,P.trim);
    }else{
      slab(0,.95,-.70,.26,.10,.52,RF.dark);
      panel(0,.94,-.88,.14,.07,.12,G,.7);
    }
    if(withDetails){robotDetailMesh(M,kind);robotArmorKit(M,kind);robotForgeSilhouette(M,kind);}return M.finish();
  }
  if(flyer){
    // Wide swept-wing aerial body with asymmetric stabilizers and two ducted thrusters.
    poly([[-.48,.86],[-.54,1.03],[-.23,1.26],[.23,1.26],[.54,1.03],[.48,.86]],-.40,.55,RF.dark);
    panel(0,1.08,.16,.74,.30,.75,A);
    poly([[-.29,1.08],[-.24,1.27],[0,1.33],[.24,1.27],[.29,1.08]],.44,.68,H);
    for(let s of [-1,1]){
      poly([[s*.24,1.04],[s*.58,1.23],[s*1.16,1.11],[s*1.31,.91],[s*.85,.82]],-.43,.18,A);
      rod([s*.40,1.03,.18],[s*1.12,.96,-.28],.052,RF.iron);
      panel(s*.97,.99,-.18,.34,.16,.50,RF.dark);
      rod([s*1.04,.85,-.34],[s*1.04,1.12,-.34],.17,RF.iron);
      panel(s*1.04,1.10,-.34,.43,.035,.43,H);
      panel(s*.72,.91,.14,.10,.07,.17,G,.63);
    }
    panel(0,1.03,.78,.39,.21,.15,RF.soot);
    panel(0,1.04,.89,.29,.072,.06,G,1.25);
    for(let s of [-1,1])rod([s*.16,.80,-.22],[s*.25,.52,-.37],.065,RF.iron);
    if(withDetails){robotDetailMesh(M,kind);robotArmorKit(M,kind);robotForgeSilhouette(M,kind);}return M.finish();
  }
  if(medic){
    // Suspended triage drone with a stacked chassis, medicinal cross and repair mandibles.
    poly([[-.43,.82],[-.56,1.13],[-.39,1.41],[.39,1.41],[.56,1.13],[.43,.82]],-.34,.40,RF.dark);
    panel(0,1.22,.20,.74,.63,.40,A);
    panel(0,1.27,.46,.55,.41,.10,RF.light);
    slab(0,1.27,.54,.11,.32,.055,G,1.0);
    slab(0,1.27,.54,.32,.11,.056,G,1.0);
    panel(0,1.65,.08,.54,.13,.46,H);
    panel(0,.76,.17,.65,.12,.48,RF.iron);
    for(let s of [-1,1]){
      rod([s*.39,1.17,.06],[s*.69,.88,.12],.063,RF.iron);
      panel(s*.67,.91,.15,.24,.22,.36,H);
      rod([s*.69,.86,.18],[s*.83,.68,.48],.035,G,.35);
    }
    vent(0,1.49,.44,3,.32);
    if(withDetails){robotDetailMesh(M,kind);robotArmorKit(M,kind);robotForgeSilhouette(M,kind);}return M.finish();
  }
  // Articulated combat infantry: NOT a cube with a glowing ball.
  const wide=heavy?1.13:sniper?.69:quick?.82:1;
  const chestWidth=.84*wide, shoulder=.49*wide;
  poly([[-.22,.73],[-.38,.89],[-.30,1.08],[.30,1.08],[.38,.89],[.22,.73]],-.20,.29,RF.dark);
  poly([[-shoulder,1.05],[-chestWidth*.67,1.55],[-chestWidth*.32,1.69],[chestWidth*.32,1.69],[chestWidth*.67,1.55],[shoulder,1.05],[.27,.96],[-.27,.96]],-.33,.28,RF.iron);
  // Front armored shell with distinct asymmetric upper plates.
  poly([[-.33*wide,1.17],[-.41*wide,1.48],[-.19,1.61],[-.018,1.48],[-.05,1.19]],.29,.39,A);
  poly([[.05,1.19],[.018,1.48],[.19,1.61],[.41*wide,1.48],[.33*wide,1.17]],.29,.39,H);
  panel(0,1.06,.37,.62*wide,.28,.11,P.trim);
  panel(0,1.35,.425,.13,.39,.095,RF.dark);
  // Glowing power bus: narrow, inset and physically restrained.
  panel(0,1.34,.487,.065,.26,.03,G,.8,.24);
  for(let s of [-1,1]){
    vent(s*.25,1.24,.425,3,.17,RF.dark);
    panel(s*.29,1.43,.455,.065,.036,.02,RF.brass,.13);
    // Back scapular assembly and raised shoulder brackets.
    panel(s*.47*wide,1.48,-.04,.37*wide,.28,.42,P.trim);
    panel(s*.47*wide,1.60,.03,.33*wide,.15,.45,A);
    fastener(s*.30,1.52,.452,.023);
  }
  // Segmented pelvis and protective tassets.
  panel(0,.87,.20,.60*wide,.26,.39,A);
  panel(0,.83,.44,.34,.16,.10,H);
  for(let s of [-1,1]){
    poly([[s*.18,.86],[s*.31*wide,.84],[s*.36*wide,.57],[s*.24,.58]],.26,.40,P.trim);
    panel(s*.18,.79,.45,.07,.10,.025,RF.brass,.15);
  }
  // Neck and angled combat helmet; optical sockets are recessed.
  rod([0,1.59,.02],[0,1.78,.02],.12,RF.iron);
  panel(0,1.82,.07,.48*wide,.40,.43,RF.dark);
  poly([[-.24*wide,1.76],[-.28*wide,1.97],[-.14,2.06],[.14,2.06],[.28*wide,1.97],[.24*wide,1.76],[0,1.70]],.10,.32,A);
  panel(0,1.87,.36,.40*wide,.17,.10,RF.soot);
  for(let s of [-1,1]){
    panel(s*.092,1.89,.43,.155,.052,.035,G,1.8,.29);
    panel(s*.25*wide,1.84,.24,.095,.20,.19,P.trim);
    rod([s*.29*wide,1.89,.04],[s*.31*wide,1.92,-.29],.035,RF.iron);
  }
  panel(0,1.73,.34,.17,.08,.08,P.trim);
  if(heavy){
    // Layered shield-like pectorals and massive collar shields.
    for(let s of [-1,1]){
      panel(s*.43*wide,1.57,.18,.30,.24,.58,H);
      panel(s*.45*wide,1.63,.32,.24,.07,.10,RF.dark);
      fastener(s*.54*wide,1.57,.49,.025);
    }
    panel(0,1.58,-.30,.60,.36,.28,RF.iron);
  }
  if(quick){
    for(let s of [-1,1]){
      rod([s*.26,1.44,-.22],[s*.52,1.63,-.52],.045,H);
      panel(s*.30,.99,.44,.12,.20,.045,G,.32);
    }
  }
  if(sniper){
    // A proper exposed rail weapon mounted along the back: elongated barrel,
    // scope and articulated stabilizers.
    slab(.42,1.54,-.18,.13,.15,1.35,RF.dark);
    rod([.42,1.53,-.64],[.42,1.53,1.07],.064,RF.iron);
    rod([.38,1.62,-.40],[.38,1.62,.49],.033,H);
    panel(.42,1.65,.42,.19,.09,.28,G,.44);
    panel(.42,1.49,1.07,.23,.18,.10,P.trim);
    vent(.41,1.72,.12,3,.18);
  }
  if(kind==='warden'){
    // Rear shield emitter and side shield coils.
    panel(0,1.34,-.48,.77,.63,.14,RF.dark);
    panel(0,1.34,-.59,.40,.40,.05,G,.42);
    for(let s of [-1,1]){
      rod([s*.46,1.54,-.22],[s*.58,1.12,-.35],.075,H);
      panel(s*.59,1.27,-.42,.19,.27,.12,G,.26);
    }
  }
  if(kind==='artillery'||giant){
    // Twin missile racks with visible barrel openings.
    for(let s of [-1,1]){
      panel(s*.68*wide,1.48,-.30,.37,.37,.65,RF.dark);
      panel(s*.68*wide,1.47,.07,.32,.27,.12,A);
      for(let j of [-1,1])rod([s*.68*wide+j*.07,1.47,-.61],[s*.68*wide+j*.07,1.47,.30],.042,RF.soot);
      panel(s*.68*wide,1.47,.33,.22,.10,.035,G,.4);
    }
  }
  if(giant){
    panel(0,1.39,.46,.52,.39,.14,P.trim);
    panel(0,1.41,.58,.30,.30,.035,G,.70);
    for(let s of [-1,1]){
      panel(s*.39,.98,.41,.15,.22,.06,RF.brass,.15);
      rod([s*.31,2.00,-.15],[s*.55,2.28,-.36],.045,RF.iron);
      panel(s*.56,2.18,-.35,.15,.15,.16,A);
    }
  }
  // Tiny industrial stencils, bolt heads and weld lines baked in GPU mesh.
  for(const s of [-1,1]){
    fastener(s*.31,1.12,.40,.026);
    fastener(s*.25,1.57,.43,.022);
    fastener(s*.25,.79,.43,.024);
  }
  if(withDetails){robotDetailMesh(M,kind);robotArmorKit(M,kind);robotForgeSilhouette(M,kind);}return M.finish();
}
function buildRobotLimb(kind,leg){
  const M=robotMaker(),{panel,poly,slab,rod,fastener}=M;
  const P=robotPalette(kind),wide=['brute','warden','artillery','boss'].includes(kind)?1.16:1;
  if(leg){
    // Origin at hip; upper piston, knee knuckle, armored shin, boot.
    rod([0,-.04,0],[0,-.37,.04],.095*wide,RF.iron);
    panel(0,-.24,.08,.30*wide,.40,.31,P.base);
    panel(0,-.25,.27,.21*wide,.29,.05,P.highlight);
    rod([.13,-.12,.02],[.13,-.43,.10],.032,RF.light);
    rod([0,-.45,.06],[0,-.50,.06],.14*wide,RF.dark);
    panel(0,-.49,.22,.24*wide,.20,.14,P.trim);
    rod([0,-.52,.04],[0,-.73,-.02],.095*wide,RF.iron);
    panel(0,-.70,.10,.36*wide,.31,.30,P.base);
    panel(0,-.73,.28,.27*wide,.20,.06,P.highlight);
    slab(0,-.875,.19,.41*wide,.14,.53,RF.dark);
    panel(0,-.84,.40,.31*wide,.10,.13,P.base);
    fastener(.10,-.48,.29,.027);
    // Angled knee cap and segmented tread guards make the legs read as machinery.
    poly([[-.16,-.39],[-.09,-.28],[.13,-.28],[.19,-.39],[.14,-.48],[-.15,-.48]],.29,.39,P.highlight);
    for(let j=0;j<3;j++)slab(0,-.88,.37+j*.056,.31*wide,.026,.018,j===1?RF.iron:RF.dark);
    for(const side of [-1,1]){
      rod([side*.13,-.56,-.10],[side*.16,-.73,-.09],.026,RF.light,0,8);
      fastener(side*.12,-.47,.35,.018);
    }
  }else{
    // Origin at shoulder; separate elbow and claw/weapon tool.
    panel(0,-.06,.02,.35*wide,.30,.43,P.base);
    panel(0,.03,.10,.35*wide,.15,.44,P.highlight);
    rod([0,-.19,.03],[0,-.46,.13],.087*wide,RF.iron);
    panel(0,-.40,.19,.23,.23,.17,P.trim);
    rod([0,-.49,.08],[0,-.68,.20],.071,RF.iron);
    panel(0,-.64,.19,.23,.24,.35,P.base);
    panel(0,-.68,.40,.18,.11,.13,P.highlight);
    for(const s of [-1,1])rod([s*.06,-.77,.26],[s*.09,-.86,.39],.032,RF.iron);
    fastener(0,-.41,.29,.035);
    // Joint shroud and accessible piston wiring: breaks up square forearms.
    poly([[-.13,-.47],[-.085,-.34],[.09,-.34],[.14,-.47],[.095,-.55],[-.09,-.55]],.27,.40,P.highlight);
    rod([-.12,-.13,-.09],[-.12,-.61,-.06],.022,RF.light,0,8);
    for(let j=0;j<3;j++)slab(0,-.66+j*.058,.39,.21,.017,.031,RF.dark);
    if(kind==='sniper'){
      slab(0,-.45,.37,.14,.13,.55,RF.dark);
      rod([0,-.45,.30],[0,-.45,.89],.05,RF.iron);
    }
    if(kind==='raider')rod([0,-.45,.36],[0,-.71,.88],.06,P.highlight);
  }
  return M.finish();
}
function buildRobotInsectLeg(kind){
  const M=robotMaker(),{panel,rod}=M,P=robotPalette(kind);
  rod([0,0,0],[.23,-.23,.03],.07,RF.iron);
  panel(.16,-.18,.04,.18,.19,.25,P.base);
  rod([.23,-.23,.03],[.35,-.51,.14],.065,P.highlight);
  rod([.35,-.51,.14],[.45,-.59,.32],.034,RF.dark);
  rod([.36,-.52,.14],[.45,-.57,.36],.022,RF.brass);
  return M.finish();
}