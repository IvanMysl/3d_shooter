
function buildRobotThruster(kind){
  const M=robotMaker(),{panel,rod}=M,P=robotPalette(kind);
  panel(0,0,0,.43,.23,.54,RF.dark);
  rod([0,-.10,0],[0,.09,0],.16,RF.iron);
  panel(0,.13,.02,.36,.06,.36,P.highlight);
  for(let i=0;i<4;i++){
    const a=i*TAU/4;
    rod([0,.10,0],[Math.cos(a)*.19,.10,Math.sin(a)*.19],.025,P.highlight);
  }
  return M.finish();
}

function buildRobotMuzzle(kind){
 const M=robotMaker(),{poly,rod,panel}=M,P=robotPalette(kind);
 const glow=P.glow;
 // Pulsing emitter with armored petals, small enough to remain a genuine object.
 const body=kind==='artillery'||kind==='boss'?0.18:.11;
 rod([0,0,-.06],[0,0,.15],body,RF.soot,0,10);
 rod([0,0,.10],[0,0,.19],body*.63,glow,.75,9);
 for(let i=0;i<6;i++){
  const a=TAU*i/6,x=Math.cos(a),y=Math.sin(a);
  rod([x*body*.68,y*body*.68,.04],[x*body*1.04,y*body*1.04,.14],.014,RF.light,0,6);
 }
 panel(0,0,.19,body*.70,body*.70,.025,glow,1.2);
 return M.finish();
}

// FOUNDRY V: local-space, GPU-baked enemy mechanisms for dynamic damage feedback.
// Muzzle, regulator and reactor cores are built ONCE for each archetype.
function buildRobotReactor(kind){
 const M=robotMaker(),{panel,poly,rod,slab,fastener}=M,P=robotPalette(kind);
 const heavy=['boss','artillery','brute','warden'].includes(kind);
 const w=heavy?.41:.27, cy=heavy?1.31:1.29, zz=heavy?.77:.63;
 // Heat-damaged chest panel: blackened opened grille and triangular emissive reactor.
 panel(0,cy,zz,w*1.55,w*1.34,.04,RF.soot);
 panel(0,cy,zz+.045,w*1.14,w*.88,.035,RF.iron);
 poly([[-w*.36,cy-w*.29],[0,cy+w*.32],[w*.36,cy-w*.29]],zz+.069,zz+.116,P.glow,1.2);
 for(let side of [-1,1]){
  rod([side*w*.44,cy-w*.32,zz+.07],[side*w*.51,cy+w*.36,zz+.08],.016,RF.light,0,7);
  fastener(side*w*.53,cy,zz+.09,.018);
 }
 for(let j=0;j<4;j++)slab(0,cy-w*.45-j*.051,zz+.03,w*.95-j*.04,.018,.024,j===2?RF.brass:RF.soot);
 return M.finish();
}
function buildRobotServo(kind){
 const M=robotMaker(),{panel,rod,slab}=M,P=robotPalette(kind);
 // Independent, suspended jaw/stabilizer beneath a tracked head optics module.
 panel(0,1.85,.50,.29,.055,.09,RF.dark);
 panel(0,1.84,.553,.19,.032,.029,P.glow,.44);
 for(const side of [-1,1]){
  rod([side*.185,1.83,.40],[side*.215,1.75,.35],.027,RF.iron,0,8);
  slab(side*.19,1.78,.42,.045,.067,.08,P.trim);
 }
 return M.finish();
}
function robotWrapAngle(a){return Math.atan2(Math.sin(a),Math.cos(a));}
function robotApproachAngle(from,to,t){return from+robotWrapAngle(to-from)*Math.max(0,Math.min(1,t));}
function robotAnimationProfile(kind){
 switch(kind){
 case 'raider':return {turn:4.6,gait:9.5,lead:.32,lean:.13};
 case 'sniper':return {turn:1.35,gait:5.4,lead:.16,lean:.043};
 case 'brute':case 'boss':return {turn:1.38,gait:4.6,lead:.12,lean:.051};
 case 'scout':case 'charger':return {turn:3.5,gait:11.4,lead:.19,lean:.092};
 case 'drone':case 'medic':return {turn:3.0,gait:7.2,lead:.28,lean:.15};
 default:return {turn:2.5,gait:7.1,lead:.2,lean:.078};
 }
}
// FOUNDRY VI — layered, destructible visual armor. These are true local-space
// hard-surface meshes, not sprites. All meshes are shared by each enemy class.
function buildRobotArmorPlate(kind,place){
 const M=robotMaker(),{panel,poly,rod,fastener,vent}=M,P=robotPalette(kind);
 const heavy=['boss','brute','artillery','warden'].includes(kind);
 const insect=['scout','charger'].includes(kind);
 const flyer=['drone','medic'].includes(kind);
 const metal=place==='chest'?P.highlight:P.base;
 const xscale=heavy?1.22:(insect?.78:flyer?.88:1),zz=insect?.69:flyer?.69:(heavy?.59:.56);
 if(place==='chest'){
  const cy=insect?1.09:flyer?1.26:1.35;
  const w=(heavy?.87:.66)*xscale, hh=insect?.31:flyer?.40:.54;
  // A protruding armored cuirass with three inset forged facets.
  poly([[-w*.48,cy-hh*.36],[-w*.55,cy+hh*.13],[-w*.30,cy+hh*.57],[w*.30,cy+hh*.57],[w*.55,cy+hh*.13],[w*.48,cy-hh*.36],[0,cy-hh*.59]],zz,zz+.145,RF.dark);
  poly([[-w*.42,cy-hh*.29],[-w*.47,cy+hh*.16],[-w*.25,cy+hh*.45],[-.06,cy+hh*.24],[-.08,cy-hh*.36]],zz+.15,zz+.213,metal);
  poly([[w*.42,cy-hh*.29],[w*.47,cy+hh*.16],[w*.25,cy+hh*.45],[.06,cy+hh*.24],[.08,cy-hh*.36]],zz+.15,zz+.213,metal);
  poly([[-.06,cy+hh*.22],[0,cy+hh*.43],[.06,cy+hh*.22],[.048,cy-hh*.38],[-.048,cy-hh*.38]],zz+.171,zz+.24,P.glow,.14);
  for(let side of [-1,1]){
   panel(side*w*.35,cy+hh*.20,zz+.218,w*.14,.038,.036,RF.light);
   fastener(side*w*.42,cy-hh*.15,zz+.220,.018);
  }
  for(let j=0;j<3;j++)vent(0,cy-hh*.33-j*.045,zz+.224,1,w*.42,RF.soot);
 }else{
  const side=place==='left'?-1:1;
  if(insect){
   poly([[side*.29,.94],[side*.57,.84],[side*.71,1.02],[side*.50,1.24],[side*.30,1.13]],zz-.20,zz+.11,metal);
   panel(side*.49,1.10,zz+.14,.14,.09,.055,P.trim);
  }else if(flyer){
   poly([[side*.39,1.17],[side*.83,1.10],[side*1.01,1.26],[side*.66,1.49],[side*.39,1.42]],zz-.35,zz+.13,metal);
   rod([side*.55,1.17,zz+.16],[side*.88,1.17,zz+.19],.027,RF.iron,0,7);
  }else{
   const cy=heavy?1.69:1.60,w=heavy?.43:.35;
   poly([[side*.39,cy-.26],[side*(.39+w),cy-.16],[side*(.44+w),cy+.16],[side*.60,cy+.30],[side*.37,cy+.15]],zz-.30,zz+.04,metal);
   panel(side*.61,cy+.02,zz+.065,.20,.065,.039,P.highlight);
   rod([side*.43,cy-.19,zz+.068],[side*.67,cy-.11,zz+.080],.029,RF.iron,0,7);
   fastener(side*.58,cy+.19,zz+.066,.022);
  }
 }
 return M.finish();
}
function buildRobotExposedPanel(kind){
 const M=robotMaker(),{panel,poly,rod,slab,fastener}=M,P=robotPalette(kind);
 const hh=['boss','brute','warden','artillery'].includes(kind)?1.43:1.34;
 const depth=['scout','charger'].includes(kind)?.73:.69;
 // The plate disappears after a hit; hoses, ribs, glow and torn mounts remain.
 panel(0,hh,depth,.61,.54,.045,RF.soot);
 poly([[-.23,hh-.18],[-.29,hh+.20],[.16,hh+.24],[.22,hh-.19]],depth+.04,depth+.074,RF.iron);
 for(let side of [-1,1]){
  rod([side*.22,hh-.20,depth+.08],[side*.14,hh+.24,depth+.09],.035,RF.brass,0,9);
  rod([side*.10,hh-.15,depth+.10],[side*.13,hh+.15,depth+.10],.024,RF.light,0,7);
  fastener(side*.30,hh+.22,depth+.08,.021);
 }
 poly([[0,hh+.19],[.12,hh+.02],[0,hh-.13],[-.12,hh+.02]],depth+.09,depth+.13,P.glow,1.14);
 for(let j=0;j<3;j++)slab(.16,hh-.14+j*.12,depth+.11,.11,.020,.022,RF.dark);
 return M.finish();
}
function buildRobotEliteRig(kind){
 const M=robotMaker(),{panel,poly,rod,fastener,slab}=M,P=robotPalette(kind);
 const insect=['scout','charger'].includes(kind),flyer=['drone','medic'].includes(kind),big=['boss','brute','warden','artillery'].includes(kind);
 const headY=insect?1.30:flyer?1.45:2.18;
 for(const side of [-1,1]){
  rod([side*.24,headY-.12,-.05],[side*.35,headY+.25,-.02],.034,RF.iron,0,8);
  rod([side*.35,headY+.24,-.02],[side*.43,headY+.37,.08],.016,RF.light,0,6);
  panel(side*.43,headY+.36,.10,.11,.065,.095,P.glow,.86);
  if(big){
   poly([[side*.48,1.71],[side*.85,1.77],[side*.87,1.97],[side*.59,2.12]],-.20,.15,P.highlight);
   fastener(side*.71,1.87,.16,.025);
  }
 }
 slab(0,headY+.13,.02,.19,.12,.18,RF.dark);
 panel(0,headY+.14,.125,.13,.07,.037,P.glow,.69);
 return M.finish();
}
function buildRobotDebrisMesh(){
 const M=robotMaker(),{poly,panel}=M;
 poly([[-.28,-.14],[-.17,.20],[.12,.24],[.31,-.06],[.05,-.23]],-.06,.055,RF.steel);
 panel(-.045,.02,.07,.24,.05,.016,RF.light);
 return M.finish();
}
let robotDebrisMesh=null;
// Three enemy airframes have different, truly 3-D silhouettes; their cores,
// animated thrusters and shootable wing volumes remain the shared drone rig.
// All curved skin/joint geometry is baked once, not regenerated per frame.
function buildRobotAirframeVariant(kind){
 const M=robotMaker(),{ellipsoid,poly,panel,rod}=M;
 if(kind==='skyhunter'){
   // Fast interceptor: needle nose, swept feather-like forward wings, twin tails.
   ellipsoid(0,1.19,.25,.32,.19,.55,[.22,.31,.40],0,14,8);
   ellipsoid(0,1.21,.68,.10,.095,.17,[.37,.49,.56],.17,12,6);
   for(const side of [-1,1]){
     poly([[side*.32,1.28],[side*.73,1.40],[side*1.14,1.20],[side*.72,1.12]],-.31,.23,[.30,.40,.47]);
     rod([side*.48,1.35,.10],[side*1.02,1.22,-.19],.029,[.46,.58,.62],0,10);
     poly([[side*.52,1.31],[side*.64,1.55],[side*.91,1.57],[side*.85,1.27]],-.55,-.39,[.17,.24,.32]);
     ellipsoid(side*.84,1.00,-.38,.16,.12,.23,[.18,.25,.32],0,12,6);
   }
   rod([0,1.39,-.12],[0,1.48,-.50],.033,[.44,.56,.65],0,10);
 }else if(kind==='skyguard'){
   // Heavy hovering sentinel: recessed round command dome and shield nacelles.
   ellipsoid(0,1.28,.07,.43,.30,.43,[.30,.34,.40],0,14,7);
   ellipsoid(0,1.43,.26,.28,.13,.27,[.53,.53,.48],0,14,7);
   panel(0,1.33,.49,.47,.13,.085,[.68,.51,.26],.43);
   for(const side of [-1,1]){
     ellipsoid(side*.82,1.16,-.08,.27,.28,.40,[.36,.40,.44],0,10,6);
     ellipsoid(side*.82,1.13,.23,.17,.19,.13,[.57,.49,.35],.35,10,6);
     rod([side*.37,1.38,-.25],[side*.81,1.47,-.28],.078,[.47,.49,.48],0,12);
     poly([[side*.44,1.58],[side*.72,1.62],[side*.89,1.48],[side*.63,1.42]],-.48,-.12,[.52,.52,.49]);
   }
 }else if(kind==='stormray'){
   // Manta-style hunter: wide pinioned wings and smooth bioluminescent dorsal keel.
   ellipsoid(0,1.19,-.05,.39,.16,.51,[.19,.33,.36],0,16,8);
   ellipsoid(0,1.32,.25,.16,.085,.35,[.34,.58,.53],.25,14,7);
   for(const side of [-1,1]){
     poly([[0,1.17],[side*.46,1.33],[side*1.18,1.25],[side*.92,1.05],[side*.35,1.03]],-.59,.12,[.24,.42,.43]);
     rod([side*.24,1.27,.28],[side*1.03,1.21,-.37],.028,[.43,.69,.60],.13,12);
     ellipsoid(side*.70,1.13,-.36,.15,.085,.19,[.15,.27,.28],0,10,6);
     poly([[side*.16,1.30],[side*.31,1.52],[side*.48,1.56],[side*.53,1.32]],-.50,-.26,[.29,.49,.48]);
   }
 }
 return M.finish();
}
const airRobotVariants={};
function initRobotFoundry(){
  const keys=['scout','charger','shooter','brute','sniper','medic','warden','artillery','raider','drone','boss'];
  for(const kind of keys){
    robotFoundry[kind]={
      body:buildRobotBody(kind),bodyLite:buildRobotBody(kind,false),damage:buildRobotDamageOverlay(kind),
      limb:buildRobotLimb(kind,false),leg:buildRobotLimb(kind,true),
      insect:buildRobotInsectLeg(kind),thruster:buildRobotThruster(kind),
      sensor:buildRobotAnimatedSensors(kind),
      upperArm:buildRobotArticulatedPart(kind,'upperArm'),
      foreArm:buildRobotArticulatedPart(kind,'foreArm'),
      upperLeg:buildRobotArticulatedPart(kind,'upperLeg'),
      lowerLeg:buildRobotArticulatedPart(kind,'lowerLeg'),
      muzzle:buildRobotMuzzle(kind),reactor:buildRobotReactor(kind),servo:buildRobotServo(kind),
      armorChest:buildRobotArmorPlate(kind,'chest'),armorLeft:buildRobotArmorPlate(kind,'left'),
      armorRight:buildRobotArmorPlate(kind,'right'),exposed:buildRobotExposedPanel(kind),
      eliteRig:buildRobotEliteRig(kind)
    };
  }
 for(const kind of ['skyhunter','skyguard','stormray'])airRobotVariants[kind]=buildRobotAirframeVariant(kind);
 if(glReady)robotDebrisMesh=buildRobotDebrisMesh();
}
function drawEnemyModel(e,g,p){
  const dx=e.x-p.x,dz=e.z-p.z,d=Math.hypot(dx,dz);
  if(d>39 || e.dead)return;
  // Shared animated drone core; advanced flyers have individual airframe skins.
  const kind=e.boss?'boss':e.airborne?'drone':e.type,pack=robotFoundry[kind]||robotFoundry.shooter;
  if(!pack)return;
  // Advanced flyers have their own complete airframe. Rendering a whole
  // humanoid drone *under* the manta/interceptor skin superimposed two robots
  // (most obvious when a stormray came close to the camera).
  const completeAirframe=e.airborne?airRobotVariants[e.type]:null;
  const r=e.boss?1.75:Math.max(.76,Math.min(1.31,e.radius/.51));
  const floor=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
  const hover=kind==='drone'||kind==='medic';
  const dMotion=clamp(Number(e.robotMotion)||0,0,1);
  const phase=Number(e.robotCycle)||0;
  const bob=hover?Math.sin(g.t*3.2+e.id)*.048:
        (Math.sin(phase*2)*.030*dMotion + Math.sin(g.t*.8+e.id)*.006);
  const foot=floor+bob+(hover?.13:0);
  const yaw=Number.isFinite(e.robotYaw)?e.robotYaw:Math.atan2(p.x-e.x,p.z-e.z),ss=Math.sin(yaw),cc=Math.cos(yaw);
  const world=(x,y,z)=>[e.x+x*cc+z*ss,foot+y,-x*ss+e.z+z*cc];
  const mobile=touchOnly||save.settings.quality===0;
  const full=(!mobile&&d<18)||(mobile&&d<8)||(e.boss&&d<20);
  const reduced=(!full || (save.settings.quality===0&&d>5));
  const tint=e.flash>0?[1.22,1.10,1.08]:e.airborne?
    e.color.map(c=>.76+.49*c):[1,1,1];
  const pitchOffset=e.stun>0?Math.sin(g.t*17+e.id)*.03:0;
  gl.uniform1f(u.uMatOverride,4);
  gl.uniform1f(u.uRobotDamage,clamp(1-e.hp/Math.max(1,e.maxhp),0,1));
  const hitKick=Math.max(0,Number(e.hitReact)||0);
  const hitTilt=hitKick*.33*Math.sin((.24-hitKick)*34);
  const turnLean=Number(e.robotLean)||0;
  const inertia=Number(e.robotInertia)||0;
  const attackPulse=Number(e.attackPulse)||0;
  const servoPitch=(e.boss?0.025:0.015)*Math.sin(g.t*1.15+e.id*.68);
  const bodyTilt=clamp(hitTilt+turnLean*.43-inertia*.22+servoPitch,-.3,.3);
  try{
    // Mobile and distant targets keep the existing low-detail silhouette;
    // the advanced mesh is reserved for close inspection / high detail.
    if(completeAirframe&&full)draw(completeAirframe,e.x,foot,e.z,r,r,r,yaw,tint,0,bodyTilt);
    else draw((full?pack.body:pack.bodyLite)||pack.body,e.x,foot,e.z,r,r,r,yaw,tint,0,bodyTilt);
    // Armor has a *visible lifecycle*: protruding plates break away permanently.
    // Stage is derived from HP, so older saves load without extra migration.
    if(full&&!completeAirframe){
      const condition=e.maxProtection>0?clamp((e.protection||0)/e.maxProtection,0,1):clamp(e.hp/Math.max(1,e.maxhp),0,1);
      if(condition>.46 && pack.armorChest)draw(pack.armorChest,e.x,foot,e.z,r,r,r,yaw,tint,0,bodyTilt);
      else if(pack.exposed)draw(pack.exposed,e.x,foot,e.z,r,r,r,yaw,tint,.11+(Number(e.robotDamageHeat)||0)*.12,bodyTilt);
      if(condition>.71 && pack.armorLeft)draw(pack.armorLeft,e.x,foot,e.z,r,r,r,yaw,tint,0,bodyTilt);
      if(condition>.29 && pack.armorRight)draw(pack.armorRight,e.x,foot,e.z,r,r,r,yaw,tint,0,bodyTilt);
      if((e.elite||e.boss)&&pack.eliteRig)draw(pack.eliteRig,e.x,foot,e.z,r,r,r,yaw,tint,.07,bodyTilt);
      // Volumetric optic flare; brighter when target is locked or taking aim.
      const opticPower=e.telegraph>0?.84:(e.attack<.37?.46:.13);
      const flicker=e.stun>0?.3:.85+.15*Math.sin(g.t*9+e.id);
      const yy=kind==='scout'||kind==='charger'?r*1.03:kind==='drone'?r*1.06:r*1.94;
      const zz=kind==='scout'||kind==='charger'?r*.92:kind==='drone'?r*1.04:r*.51;
      const at=world(0,yy,zz);
      if(d<(mobile?4.5:13) && e.spawn>.2){
        draw(geom.orb,...at,r*.046,r*.029,r*.014,yaw,e.color,opticPower*flicker*.7);
      }
    }
    if(kind==='drone'){
      for(const side of [-1,1]){
        if(!reduced){
          const pt=world(side*r*.97,r*1.06,-r*.28);
          draw(pack.thruster,...pt,r*.65,r*.65,r*.65,yaw+g.t*(side>0?3.4:-3.4),tint,0,turnLean*side*.6);
        }
      }
    }else if(kind==='scout'||kind==='charger'){
      const n=reduced?2:4;
      for(let j=0;j<n;j++){
        const side=j%2?1:-1,front=n===2?1:(j<2?1:-1);
        const pt=world(side*r*.39,r*.91,front*r*.36);
        const swing=(Math.sin(phase+side*1.70+front*2.2)*.28 + turnLean*side*.38)*dMotion;
        draw(pack.insect,...pt,r,r,r,yaw+(side<0?Math.PI:0),tint,0,swing);
      }
      if(full && pack.sensor){
        draw(pack.sensor,e.x,foot,e.z,r,r,r,yaw+Math.sin(g.t*1.35+e.id)*.045,tint,0);
      }
    }else if(kind==='medic'){
      if(full){
        const C=enemies.medic.color,pt=world(0,r*.67,0);
        draw(geom.ring,...pt,r*.91,.044*r,r*.91,g.t*.54,C,.24);
      }
    }else{
      for(const side of [-1,1]){
        const step=Math.sin(phase+(side>0?Math.PI:0));
        const reverse=1-2*clamp(Number(e.robotReverse)||0,0,1);
        const strafe=clamp(Number(e.robotStrafe)||0,-1,1);
        const stride=(step*reverse+strafe*.28)*.25*dMotion;
        const stepLift=Math.pow(Math.max(0,step),1.4)*.14*dMotion;
        const hBase=.92*r;
        const legPt=world(side*r*.25,hBase+stepLift*r,-stride*.09*r);
        const armPt=world(side*r*.52,1.44*r,step*.04*r*dMotion);
        if(!reduced && pack.upperLeg && pack.lowerLeg){
          const legTilt=stride*.7;
          draw(pack.upperLeg,...legPt,r,r,r,yaw,tint,0,legTilt);
          const kneePt=world(side*r*.25,hBase+stepLift*r-.42*r*Math.cos(legTilt),
            -stride*.09*r-.42*r*Math.sin(legTilt));
          const kneeTilt=-legTilt*.65+stepLift*.47+(e.type==='raider'?.04:0);
          draw(pack.lowerLeg,...kneePt,r,r,r,yaw,tint,0,kneeTilt);
        }else{
          draw(pack.leg,...legPt,r,r,r,yaw,tint,0,stride*.55);
        }
        if(!reduced && pack.upperArm && pack.foreArm){
          const armTilt=-stride*.39-(kind==='sniper'?.04:0)+attackPulse*.95 +(Number(e.robotAttackState)||0)*.25;
          draw(pack.upperArm,...armPt,r,r,r,yaw,tint,0,armTilt);
          const elbowPt=world(side*r*.52,1.44*r-.405*r*Math.cos(armTilt),
            step*.04*r*dMotion-.405*r*Math.sin(armTilt));
          draw(pack.foreArm,...elbowPt,r,r,r,yaw,tint,0,-armTilt*.52+.045+attackPulse*.18);
        }else if(e.boss||d<17){
          draw(pack.limb,...armPt,r,r,r,yaw,tint,0,-stride*.30);
        }
      }
      if(full&&pack.sensor){
        // Fine optic module turns with small independent tracking micro-movements.
        const scan=Math.sin(g.t*1.45+e.id*.48)*.028+pitchOffset;
        const eyeYaw=Number.isFinite(e.robotEyeYaw)?e.robotEyeYaw:yaw;
        draw(pack.sensor,e.x,foot,e.z,r,r,r,eyeYaw+scan,tint,0);
        if(pack.servo && d<12){
          // Independent trackable jaw, with subtle vertical servo vibration.
          draw(pack.servo,e.x,foot+Math.sin(g.t*4.2+e.id)*.006*r,e.z,r,r,r,eyeYaw+scan,tint,0);
        }
      }
      if(e.boss&&full){
        const col=e.color||[.91,.42,.21];
        for(const side of [-1,1]){
          const pt=world(side*r*.78,r*1.53,r*.62);
          draw(geom.cylinder,...pt,r*.106,r*.106,r*.23,yaw,col,.24);
        }
      }
    }
    if(full&&(Number(e.attackPulse)||0)>0.005&&pack.muzzle){
      const f=clamp((Number(e.attackPulse)||0)/.19,0,1);
      const offset=kind==='scout'||kind==='charger'?[0,r*.95,r*.97]:kind==='drone'?[0,r*1.03,r*1.04]:kind==='artillery'||kind==='boss'?[r*.65,r*1.49,r*.58]:[r*.54,r*.92,r*.75];
      const pt=world(...offset);
      draw(pack.muzzle,...pt,r*(.60+f*.56),r*(.60+f*.56),r*(.60+f*.56),yaw,tint,f*1.35);
    }
    if(full&&e.hp/e.maxhp<.54&&pack.damage){
      draw(pack.damage,e.x,foot,e.z,r,r,r,yaw,[1,1,1],0);
    }
    if(e.elite&&full){
      const pt=world(0,r*.98,-r*.24);
      draw(geom.ring,...pt,r*.58,.027*r,r*.58,g.t*.20,[.74,.43,.18],.13);
    }
    // Dying armor: a compact vent at the reactor, not a permanent floor shadow.
    if(e.hp<e.maxhp*.47&&full){
      // Reactor heat pulse reveals inner mechanics through broken armor.
      const damage=clamp(1-e.hp/Math.max(1,e.maxhp),0,1);
      const pulse=.09+.30*Math.max(0,Math.sin(g.t*(9+damage*9)+e.id)) + (Number(e.robotDamageHeat)||0)*.25;
      if(pack.reactor && d<(mobile?6.5:20))draw(pack.reactor,e.x,foot,e.z,r,r,r,yaw,[1,1,1],pulse);
    }
    if(e.maxhp>=120){
      const health=clamp(e.hp/e.maxhp,0,1),pt=world(0,r*2.44,0);
      draw(geom.cube,...pt,r*1.45,.038,.085,yaw,RF.dark,0);
      const hpPt=world(-r*.725*(1-health),r*2.445,.015);
      draw(geom.cube,...hpPt,r*1.45*health,.042,.087,yaw,health>.33?[.25,.79,.59]:[.92,.30,.23],.54);
    }
  }finally{
    gl.uniform1f(u.uMatOverride,-1);
    gl.uniform1f(u.uRobotDamage,0);
  }
}
