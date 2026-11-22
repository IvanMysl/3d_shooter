// THIRD-PERSON OPERATOR. Single-source armor palette for the hangar preview
// and the in-world character. No new libraries or network assets.
const OPERATOR_CAMERA_DISTANCE=3.35;
function thirdPersonEnabled(){return (game?.preview?game.previewCamera:save.settings.cameraMode)==='third';}
function secondPersonEnabled(){return (game?.preview?game.previewCamera:save.settings.cameraMode)==='second';}
function externalCameraEnabled(){return thirdPersonEnabled()||secondPersonEnabled();}
function cameraModeLabel(){return secondPersonEnabled()?'ВТОРОЕ ЛИЦО':thirdPersonEnabled()?'ТРЕТЬЕ ЛИЦО':'ПЕРВОЕ ЛИЦО';}
function operatorColor(c,k=1){return c.map(v=>clamp(v*k,0,1));}
function operatorSuit(id){return Number.isInteger(id)&&id>=0?BODY_ARMOR_CATALOG[id]||null:null;}
function operatorPalette(id){
 const suit=operatorSuit(id);
 const primary=suit?suit.color:[.19,.275,.32];
 const grade=id<0?0:id+1;
 const accent=grade<1?[.31,.70,.79]:grade<5?[.43,.87,.98]:grade<9?[.75,.59,.99]:[.98,.75,.39];
 return {grade,primary,accent,shadow:operatorColor(primary,.40),light:operatorColor(primary,1.37),black:[.045,.069,.088],joint:[.16,.21,.25],fabric:[.095,.145,.18],visor:[.09,.28,.36]};
}
function normalizedAim(p){
 const c=Math.cos(p.pitch);
 return {x:Math.sin(p.yaw)*c,y:Math.sin(p.pitch),z:Math.cos(p.yaw)*c};
}
function thirdPersonCameraPose(p){
 const focus={x:p.x,y:1.46+(p.feetY||0),z:p.z};
 const forward=normalizedAim(p),right={x:Math.cos(p.yaw),y:0,z:-Math.sin(p.yaw)};
 const desired={x:focus.x-forward.x*OPERATOR_CAMERA_DISTANCE+right.x*.42,
  y:focus.y-forward.y*OPERATOR_CAMERA_DISTANCE+.57,
  z:focus.z-forward.z*OPERATOR_CAMERA_DISTANCE+right.z*.42};
 const vector={x:desired.x-focus.x,y:desired.y-focus.y,z:desired.z-focus.z};
 const total=Math.hypot(vector.x,vector.y,vector.z)||1;
 const trace={x:vector.x/total,y:vector.y/total,z:vector.z/total};
 // A single 3D swept camera sphere catches railings and overhead beams,
 // even when the center ray just misses the edge. It cannot phase through
 // the same static solids that block rockets or enemy plasma.
 const hit=sweepWorldSphere(focus,trace,total,.17);
 const allowed=hit?Math.max(0,hit.t-.08):total;
 if(allowed<1.05){
  // A temporary shoulder-to-eye fallback prevents the model filling the screen
  // when backing against a wall. The selected camera mode is not lost.
  return {eye:[focus.x,focus.y,focus.z],dir:[forward.x,forward.y,forward.z],drawActor:false,distance:0};
 }
 const k=allowed/total,eye=[focus.x+vector.x*k,focus.y+vector.y*k,focus.z+vector.z*k];
 const far=[focus.x+forward.x*14,focus.y+forward.y*14,focus.z+forward.z*14];
 const d=[far[0]-eye[0],far[1]-eye[1],far[2]-eye[2]];
 const len=Math.hypot(...d)||1;
 return {eye,dir:d.map(x=>x/len),drawActor:true,distance:allowed};
}
// Second person: the camera stays in front of the operator and looks back at
// their helmet/armor. Movement and weapon direction remain the operator's
// forward direction, not the camera's reversed viewing direction.
function secondPersonCameraPose(p){
 const focus={x:p.x,y:1.46+(p.feetY||0),z:p.z};
 const front={x:Math.sin(p.yaw),z:Math.cos(p.yaw)};
 const right={x:Math.cos(p.yaw),z:-Math.sin(p.yaw)};
 const desired={x:focus.x+front.x*3.35+right.x*.17,
  y:focus.y+.38,z:focus.z+front.z*3.35+right.z*.17};
 const vx=desired.x-focus.x,vy=desired.y-focus.y,vz=desired.z-focus.z;
 const total=Math.hypot(vx,vy,vz)||1;
 const ray={x:vx/total,y:vy/total,z:vz/total};
 const hit=sweepWorldSphere(focus,ray,total,.17);
 const allowed=hit?Math.max(0,hit.t-.08):total;
 if(allowed<1.05){
  const look=normalizedAim(p);
  return {eye:[focus.x,focus.y,focus.z],dir:[look.x,look.y,look.z],drawActor:false,distance:0};
 }
 const k=allowed/total,eye=[focus.x+vx*k,focus.y+vy*k,focus.z+vz*k];
 const target=[focus.x,focus.y+.05,focus.z];
 const d=[target[0]-eye[0],target[1]-eye[1],target[2]-eye[2]];
 const len=Math.hypot(...d)||1;
 return {eye,dir:d.map(x=>x/len),drawActor:true,distance:allowed};
}
function operatorCameraPose(p){return secondPersonEnabled()?secondPersonCameraPose(p):thirdPersonCameraPose(p);}
function aimFromOperator(origin){
 // In the front-facing mode the camera looks backward at the player, so
 // projecting the reticle ray through it would make shots fire backward.
 if(!thirdPersonEnabled()||!game)return normalizedAim(game?.p||{yaw:0,pitch:0});
 const cam=thirdPersonCameraPose(game.p);
 if(!cam.drawActor)return normalizedAim(game.p);
 const from={x:cam.eye[0],y:cam.eye[1],z:cam.eye[2]};
 const ray={x:cam.dir[0],y:cam.dir[1],z:cam.dir[2]};
 const wall=rayWall(from,ray,80),limit=wall?wall.t:80;
 const node=rayNode(from,ray,limit);
 const enemy=rayEnemy(from,ray,node?node.t:limit);
 const hit=enemy||node||wall;
 const depth=hit?hit.t:80;
 const target={x:from.x+ray.x*depth,y:from.y+ray.y*depth,z:from.z+ray.z*depth};
 const dx=target.x-origin.x,dy=target.y-origin.y,dz=target.z-origin.z;
 const length=Math.hypot(dx,dy,dz);
 const forward=normalizedAim(game.p);
 if(length<.18||(dx*forward.x+dy*forward.y+dz*forward.z)<.15)return forward;
 return {x:dx/length,y:dy/length,z:dz/length};
}
// Local head rotation around the base of the helmet. Rotating every helmet
// component around its own center caused the visor/cheeks to separate.
// Positive camera pitch lifts the FACE, without bending the torso.
function operatorHeadPose(p,x,y,z){
 const pitch=clamp(Number(p.pitch)||0,-1.08,1.06)*.82;
 const c=Math.cos(pitch),s=Math.sin(pitch),neckY=1.58,neckZ=.025;
 const dy=y-neckY,dz=z-neckZ;
 return {x,y:neckY+dy*c+dz*s,z:neckZ+dz*c-dy*s,tilt:-pitch};
}
// The actual muzzle of the operator's weapon, not the old neck-height shot
// origin. The coordinates below follow renderOperatorWeapon's stock pivot,
// barrel lengths, pitch, yaw and recoil. Multi-barrel weapons alternate tubes.
function operatorMuzzleLocal(p,weaponId=p.weapon){
 const idx=clamp(weaponId|0,0,weapons.length-1);
 const compact=idx===5||idx===9,heavy=idx===2||idx===4||idx===8;
 const long=idx===2||idx===6;
 const length=long?.66:compact?.21:heavy?.46:.39;
 const barrel=.55+(long?.09:compact?-.085:0);
 const shot=Math.max(0,Number(p.shots)||0)|0;
 const x=(idx===1||idx===8)?(shot%2===0?-.088:.088):
  idx===6?[-.097,0,.097][shot%3]:0;
 const y=(idx===1||idx===8)?.115:idx===6?.123:.125;
 // Account for the front cylinder face and its round muzzle collar.
 let z=barrel+Math.max(length*.50,length*.44+.045)+.018;
 if(idx===5)z=Math.max(z,.733); // Forward vector compensator.
 return {x,y,z};
}
function operatorMuzzlePoint(p,weaponId=p.weapon){
 const m=operatorMuzzleLocal(p,weaponId);
 const pitch=clamp(Number(p.pitch)||0,-1.08,1.06),si=Math.sin(pitch),co=Math.cos(pitch);
 const yaw=Number(p.yaw)||0,cy=Math.cos(yaw),sy=Math.sin(yaw);
 const recoil=Math.min(.06,(p.recoil||0)*.08);
 const bob=p.walk?Math.sin((Number(game?.t)||0)*11)*.012:0;
 const forward=m.z-recoil;
 const x=.39+m.x,y=.98+m.y*co+forward*si+bob,z=.20+forward*co-m.y*si;
 return {x:p.x+x*cy+z*sy,y:(p.feetY||0)+y,z:p.z-x*sy+z*cy};
}
// Projectiles leave the visible barrel, but converge on the existing sight
// ray to avoid a near-field parallax penalty for offset/right-hand weapons.
function directionFromMuzzle(sightOrigin,sightDir,muzzle,hitDistance){
 const distance=Math.max(1.5,hitDistance);
 const dx=sightOrigin.x+sightDir.x*distance-muzzle.x;
 const dy=sightOrigin.y+sightDir.y*distance-muzzle.y;
 const dz=sightOrigin.z+sightDir.z*distance-muzzle.z;
 const size=Math.hypot(dx,dy,dz)||1;
 return {x:dx/size,y:dy/size,z:dz/size};
}
// One or two short procedural flashes per gun, never new lights, textures,
// particles, intervals or extra PvP packets. On mobile/low detail: one mesh.
function drawGunMuzzleFlash(p,gunId,m,part,t){
 const power=clamp((p.shotGlow||0)*8,0,1);
 if(power<=.05)return;
 const idx=clamp(gunId|0,0,weapons.length-1),color=weapons[idx].color;
 const small=idx===3||idx===5,heavy=idx===1||idx===4||idx===8;
 const radius=(small?.065:heavy?.14:.095)*(.55+power*.70);
 const length=(idx===2?.37:idx===4?.31:idx===8?.22:small?.12:.20)*(.65+power*.8);
 const main=idx===0||idx===7||idx===9?(geom.spark||geom.orb):
  (geom.tracer||geom.octa);
 part(m.x,m.y,m.z+.045*power,radius,radius,length,color,1.35+1.3*power,main);
 const detail=save.settings.quality>0&&!(typeof touchOnly!=='undefined'&&touchOnly);
 if(!detail)return;
 if(idx===1||idx===2||idx===4||idx===8||idx===9){
  // Shotgun pressure ring; railgun magnetic halo; rocket/grenade gas;
  // cryo condensation. Static meshes fade with the same 0.1s shot timer.
  const tint=(idx===4||idx===8)?[.39,.37,.35]:color;
  const spread=idx===1?.24:idx===2?.19:idx===9?.17:.21;
  part(m.x,m.y,m.z-.045,spread*power,spread*power,.06+power*.045,
   tint,((idx===4||idx===8)?.5:1.2)*power,(idx===4||idx===8)?geom.orb:geom.ring);
 }else if(idx===6||idx===7){
  const side=idx===6?.12:.08;
  for(const sign of [-1,1])part(m.x+side*sign,m.y,m.z-.035,
   .035*power,.038*power,.09*power,color,1.1*power,geom.octa);
 }else{
  // Compact secondary spark for the carbine, LMG and vector SMG.
  part(m.x+.065,m.y+.03,m.z-.015,.035*power,.031*power,.09*power,
   color,.75*power,geom.octa);
 }
}
// Shared, cheap player-hit reaction for solo, PvP, first/third/second person.
// The visual position is on the side facing the attacker, while the armor
// pulse wraps the actor so WebGL players can see hits from behind as well.
function operatorHitReaction(p,source=null,{head=false,blocked=false}={}){
 const g=game;if(!g||!p)return;
 p.hitFlash=Math.max(p.hitFlash||0,.44);
 p.hitHead=!!head;p.hitBlocked=!!blocked;
 const from=source&&Number.isFinite(source.x)&&Number.isFinite(source.z)?source:
  {x:p.x+Math.sin(p.yaw||0)*3,z:p.z+Math.cos(p.yaw||0)*3};
 const dx=from.x-p.x,dz=from.z-p.z,len=Math.hypot(dx,dz)||1;
 const x=p.x+dx/len*.53,y=(p.feetY||0)+(head?1.76:1.20),z=p.z+dz/len*.53;
 const col=blocked?[.36,.85,1]:head?[1,.87,.37]:[1,.38,.25];
 g.impactFx.push({x,y,z,life:.39,maxLife:.39,r:head?.43:.51,col});
 if(g.impactFx.length>35)g.impactFx.splice(0,g.impactFx.length-35);
 // Shotguns and rapid fire refresh the armor pulse, not an unbounded shower.
 if(g.t-(p.lastHitSparkAt??-100)>.085){
  p.lastHitSparkAt=g.t;
  const count=save.settings?.quality===0||(typeof touchOnly!=='undefined'&&touchOnly)?3:5;
  for(let i=0;i<count;i++){
   const angle=i*TAU/count+g.t*11,life=.20+.055*(i%3);
   g.particles.push({x,y,z,vx:Math.cos(angle)*(1.1+i*.18),
    vy:.40+i*.23,vz:Math.sin(angle)*(1.1+i*.18),life,maxLife:life,a:angle,col,
    ...(typeof mpMatch!=='undefined'&&mpMatch?.active?{fxGravity:.8}:{})});
  }
  if(g.particles.length>48&&typeof mpMatch!=='undefined'&&mpMatch?.active)
   g.particles.splice(0,g.particles.length-48);
 }
}
// A third-person weapon uses the same ten distinctive silhouette families as
// the cockpit weapon. All components share a glove pivot and rise with camera
// pitch; the old universal rectangular club is completely removed.
function renderOperatorWeapon(g,p,block,c){
 const idx=clamp(p.weapon|0,0,weapons.length-1),w=weapons[idx];
 const dark=[.095,.13,.16],black=[.032,.05,.065],steel=[.35,.43,.48],
  mid=[.18,.26,.32],bronze=[.42,.31,.20],edge=[.54,.62,.66],glow=w.color;
 const pitch=clamp(Number(p.pitch)||0,-1.08,1.06),si=Math.sin(pitch),co=Math.cos(pitch);
 const recoil=Math.min(.06,(p.recoil||0)*.08),bob=p.walk?Math.sin(g.t*11)*.012:0;
 const pivotX=.39,pivotY=.98,pivotZ=.20;
 const part=(x,y,z,sx,sy,sz,color,shine=0,mesh=geom.bevel)=>{
  const forward=z-recoil;
  block(pivotX+x,pivotY+y*co+forward*si+bob,pivotZ+forward*co-y*si,
   sx,sy,sz,color,shine,mesh,-pitch);
 };
 const compact=idx===5||idx===9,heavy=idx===2||idx===4||idx===8;
 const twin=idx===1||idx===8,long=idx===2||idx===6;
 const bodyLen=compact?.27:heavy?.47:.37;
 const barrelLen=long?.66:compact?.21:heavy?.46:.39;
 const bw=twin?.095:idx===4?.15:idx===2?.055:.077;
 // Stock, receiver, ergonomic grip and a support hand stay connected.
 part(0,.064,-.12,.18,.13,.23,dark);
 part(0,.09,.22,.245,.18,bodyLen,mid,0,geom.rounded||geom.bevel);
 part(0,.194,.22,.225,.054,bodyLen*.9,steel);
 part(0,.052,.22,.24,.08,bodyLen*.72,dark);
 part(.11,.12,.21,.030,.105,bodyLen*.73,edge);
 part(-.11,.12,.21,.030,.105,bodyLen*.73,black);
 part(0,-.10,.025,.09,.21,.11,black);
 part(0,-.12,.22,.12,.17,.12,bronze);
 part(0,.25,.19,.095,.085,.15,black);
 part(0,.305,.20,.065,.025,.07,glow,.6);
 // Circular barrels are short, visibly hollow-looking tubes rather than
 // a solid rectangular beam through the character's shoulder.
 const muzzle=.55+(long?.09:compact?-.085:0);
 if(twin){
  for(const x of [-.088,.088]){
   part(x,.115,muzzle,.095,.095,barrelLen,steel,0,geom.cylinder);
   part(x,.115,muzzle+barrelLen*.43,.105,.105,.075,black,0,geom.cylinder);
  }
 }else if(idx===6){
  for(const x of [-.097,0,.097]){
   part(x,.123,muzzle,.072,.072,barrelLen,steel,0,geom.cylinder);
   part(x,.123,muzzle+barrelLen*.43,.085,.085,.065,black,0,geom.cylinder);
  }
 }else{
  part(0,.125,muzzle,bw,bw,barrelLen,steel,0,geom.cylinder);
  part(0,.125,muzzle+barrelLen*.44,bw*1.25,bw*1.25,.09,black,0,geom.cylinder);
 }
 if(!compact){
  part(-.18,-.06,.34,.18,.14,.18,c.joint,0,geom.rounded||geom.bevel);
 }
 if(idx===0){ // Impulse carbine: slender barrel, optic and side vent.
  part(.145,.17,.35,.045,.075,.28,steel);
  part(-.15,.17,.35,.045,.075,.28,steel);
 }else if(idx===1){ // Shotgun: twin pipes, deep pump shroud.
  part(0,-.01,.46,.27,.17,.24,black);
  part(0,.20,.40,.21,.04,.24,bronze);
 }else if(idx===2){ // Railgun: spaced rails and illuminated coil cells.
  for(const side of [-1,1])part(side*.155,.115,.52,.045,.08,.72,black);
  for(let j=0;j<4;j++)part(0,.216,.37+j*.16,.30,.042,.045,glow,.75);
  part(0,.23,.80,.12,.09,.22,edge);
 }else if(idx===3){ // Machine gun: large ammo box and cooling fins.
  part(.13,-.14,.14,.22,.28,.22,black);
  for(let j=0;j<5;j++)part(0,.12,.43+j*.10,.29,.03,.038,edge);
 }else if(idx===4){ // Rocket launcher: high-caliber tube, ring cage.
  part(0,.10,.44,.32,.30,.53,mid,0,geom.cylinder);
  part(0,.10,.75,.34,.34,.08,black,0,geom.cylinder);
  for(const side of [-1,1])part(side*.16,.10,.51,.035,.10,.40,bronze);
 }else if(idx===5){ // Vector: compact, thick forward compensator.
  part(.12,-.07,.22,.105,.22,.14,black);
  part(0,.12,.65,.18,.18,.12,edge,0,geom.cylinder);
 }else if(idx===6){ // Triad: triple independent muzzle guides.
  for(const side of [-1,1])part(side*.14,.16,.46,.043,.045,.38,glow,.4);
 }else if(idx===7){ // Ion: two exposed glowing charge chambers.
  for(const side of [-1,1]){
   part(side*.14,.11,.42,.094,.13,.32,black,0,geom.cylinder);
   part(side*.14,.11,.48,.052,.065,.23,glow,1.1,geom.cylinder);
  }
 }else if(idx===8){ // Grenade launcher: rotating drum.
  part(0,-.065,.25,.32,.30,.30,bronze,0,geom.cylinder);
  for(const side of [-1,1])part(side*.14,-.07,.25,.085,.09,.33,black,0,geom.cylinder);
 }else if(idx===9){ // Cryo emitter: refrigerated twin reservoirs.
  for(const side of [-1,1]){
   part(side*.115,.14,.35,.075,.10,.27,black,0,geom.cylinder);
   part(side*.115,.15,.39,.043,.07,.22,glow,.8,geom.cylinder);
  }
  part(0,.245,.40,.13,.085,.13,edge);
 }
 drawGunMuzzleFlash(p,idx,operatorMuzzleLocal(p,idx),part,g.t);
}
function renderOperator(g,p){
 if(!glReady)return;
 const suitId=p.bodyArmorType>=0?p.bodyArmorType:-1;
 const c=operatorPalette(suitId),w=weapons[p.weapon];
 const yaw=p.yaw,cs=Math.cos(yaw),sn=Math.sin(yaw),feet=p.feetY||0;
 const suitLevel=suitId>=0?(Number(save.bodyArmor?.owned?.[suitId])||0):0;
 const wear=(p.bodyArmorMax>0)?clamp((p.bodyArmor||0)/p.bodyArmorMax,0,1):1;
 const point=(x,y,z)=>[p.x+x*cs+z*sn,feet+y,p.z-x*sn+z*cs];
 const block=(x,y,z,sx,sy,sz,color,shine=0,mesh=geom.bevel,tilt=0)=>draw(mesh,...point(x,y,z),sx,sy,sz,yaw,color,shine,tilt);
 // Curved breastplate and helmet; cheap faceted parts remain at mobile LOD.
 const shell=geom.rounded||geom.bevel;
 const limbShell=((typeof touchOnly!=='undefined'&&touchOnly)||save.settings.quality===0)?geom.bevel:shell;
 const move=p.walk?Math.sin(g.t*11.5)*.28:Math.sin(g.t*1.7)*.015;
 const degree=c.grade,armored=degree>0;
 // Independent legs with armor shells, ankle joints, boot treads and toe caps.
 for(const side of [-1,1]){
  const x=side*.175,phase=move*side;
  block(x,.77,.012,.245,.25,.255,c.shadow,0,geom.bevel,phase*.45);
  block(x,.60,phase*.24,.20,.38,.20,c.fabric,0,limbShell,phase);
  block(x,.52,phase*.27+.032,.225,.19,.255,armored?c.light:c.joint);
  block(x,.36,phase*.35,.19,.30,.20,armored?c.primary:c.fabric,0,limbShell,-phase*.7);
  block(x,.24,phase*.41+.025,.22,.10,.26,c.black);
  block(x,.11,phase*.45+.065,.27,.20,.42,c.shadow,0,limbShell);
  block(x,.10,phase*.45+.18,.265,.10,.23,armored?c.light:c.joint);
  if(armored){block(x,.54,phase*.26+.15,.17,.045,.025,c.accent,.24);block(x,.30,phase*.34+.12,.13,.08,.06,c.light);}
 }
 // Belt with visible equipment and rear canisters.
 block(0,.88,0,.47,.20,.27,c.black);
 block(0,.88,.16,.19,.095,.048,c.light);
 for(const side of [-1,1])block(side*.25,.86,-.015,.09,.17,.21,c.shadow);
 // Ballistic torso: segmented breastplates, collar, spine, breathing tubes.
 block(0,1.18,-.005,.58,.60,.32,armored?c.primary:c.fabric,0,shell);
 block(0,1.19,.175,.49,.44,.07,c.light);
 block(0,1.17,.215,.09,.37,.05,c.shadow);
 for(const side of [-1,1]){
  block(side*.16,1.26,.222,.13,.23,.055,armored?c.primary:c.joint);
  block(side*.19,1.46,.145,.24,.12,.23,c.shadow);
  block(side*.35,1.41,0,.275,armored?.28:.23,.34,armored?c.light:c.joint,0,limbShell);
  // Shoulder actuator, upper arm, forearm gauntlet and gloves.
  block(side*.39,1.22,.015,.18,.23,.185,c.joint,0,geom.cylinder,-move*.26*side);
  block(side*.41,1.065,.09,.175,.28,.20,armored?c.primary:c.fabric,0,limbShell,-move*.21*side);
  block(side*.40,.95,.18,.20,.16,.21,armored?c.light:c.joint);
  block(side*.40,.865,.20,.15,.16,.19,c.black);
  if(armored){block(side*.33,1.43,.16,.09,.095,.06,c.accent,.22);block(side*.40,1.02,.218,.125,.035,.035,c.accent,.12);}
 }
 // Reinforced back frame and layered exhaust vents on advanced suits.
 block(0,1.18,-.225,.45,.43,.16,c.shadow);
 for(const side of [-1,1]){
  block(side*.17,1.12,-.334,.12,.33,.12,c.black);
  if(degree>=4)block(side*.17,1.12,-.405,.085,.23,.07,c.light);
  if(degree>=7)block(side*.17,1.19,-.442,.048,.18,.038,c.accent,.42);
 }
 block(0,1.54,0,.275,.19,.24,c.joint);
 // Anatomically layered helmet, chin, cheeks, visor and optic strip.
 const headBlock=(x,y,z,sx,sy,sz,color,shine=0,mesh=shell)=>{
  const h=operatorHeadPose(p,x,y,z);
  block(h.x,h.y,h.z,sx,sy,sz,color,shine,mesh,h.tilt);
 };
 headBlock(0,1.75,.012,.345,.35,.31,armored?c.primary:c.fabric);
 headBlock(0,1.82,.18,.30,.17,.13,c.black);
 headBlock(0,1.805,.252,.26,.086,.045,c.visor,.18);
 headBlock(0,1.70,.212,.265,.115,.08,armored?c.light:c.joint);
 headBlock(0,1.645,.185,.19,.08,.11,c.black);
 for(const side of [-1,1]){
  headBlock(side*.18,1.74,.03,.085,.24,.23,c.shadow,0,limbShell);
  headBlock(side*.195,1.81,.10,.055,.09,.085,c.accent,.39);
  headBlock(side*.114,1.83,.29,.069,.024,.02,c.accent,.5);
 }
 headBlock(0,1.957,.0,.21,.055,.19,c.light);
 if(degree>=3){
  headBlock(0,2.005,-.06,.08,.12,.11,c.accent,.28);
  headBlock(0,1.82,-.31,.18,.18,.14,c.shadow);
 }
 if(suitLevel>=5){
  // Refinement upgrades add visible hardware every five purchased levels.
  for(const side of [-1,1])block(side*.24,1.15,.257,.035,.24,.031,c.accent,.25);
 }
 if(suitLevel>=10)block(0,1.40,.265,.23,.045,.03,c.accent,.42);
 if(suitLevel>=15)for(const side of [-1,1])block(side*.17,.62,.193,.105,.04,.04,c.accent,.34);
 if(suitLevel>=20)headBlock(0,1.98,.02,.13,.035,.10,c.accent,.65);
 if(armored&&wear<.25){
  // Broken armor remains equipped but loses bright plating as durability falls.
  for(const side of [-1,1])block(side*.14,1.24,.264,.13,.035,.024,c.black,.0);
 }
 if(degree>=9){
  // High-tier rear antenna and luminous spinal conduits are visibly distinct.
  headBlock(0,1.96,-.34,.035,.41,.035,c.light);
  headBlock(0,2.16,-.34,.075,.075,.075,c.accent,.72,geom.orb);
  for(const side of [-1,1])block(side*.11,1.27,-.51,.035,.33,.035,c.accent,.45);
 }
 // The pulse is visible from ALL directions, even if the shooter sees the
 // back/side of the target. The front-only Stage47 plate was occluded in WebGL.
 // All geometry is skipped when not hit, including mobile and solo gameplay.
 const hit=clamp((p.hitFlash||0)/.44,0,1);
 if(hit>0){
  const tint=p.hitBlocked?[.35,.85,1]:p.hitHead?[1,.86,.38]:[1,.36,.29];
  const light=c.light.map((v,i)=>v*(1-hit*.9)+tint[i]*hit*.9);
  block(0,1.20,.249,.48,.40,.053,light,.5+hit*1.2,geom.bevel);
  block(0,1.20,-.268,.48,.40,.053,light,.5+hit*1.2,geom.bevel);
  if(p.hitHead)headBlock(0,1.83,.338,.30,.15,.049,light,.45+hit*1.5,geom.bevel);
  else block(0,1.18,.292,.22,.22,.032,tint,.55+hit*1.35,geom.bevel);
  // Broad halo around the whole body, not a small front-facing detail.
  draw(geom.ring,p.x,feet+1.17,p.z,1.35,1.35,1.35,g.t*4,tint,.7+hit*1.8,.20);
  // On capable desktop renderers two side glints reinforce oblique views;
  // low/mobile quality keeps the cheaper all-direction ring and rear plate.
  if(save.settings.quality>0&&!(typeof touchOnly!=='undefined'&&touchOnly))
   for(const side of [-1,1]){
    const q=point(side*.47,1.24,0);
    draw(geom.orb,...q,.13*hit,.13*hit,.13*hit,g.t,tint,1.2+hit*1.4);
   }
 }
 renderOperatorWeapon(g,p,block,c);
 if(p.shield>0){
  draw(geom.ring,p.x,feet+1.12,p.z,1.10,1.10,1.10,g.t*1.9,[.33,.88,1],1.0,.30);
 }
}
// The same grade/shape language rendered as a cheap illustrated hangar preview.
function renderArmorPreview(canvas,id){
 if(!canvas)return;
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const W=canvas.width,H=canvas.height,c=operatorPalette(id);
 const rgb=(arr,k=1)=>`rgb(${arr.map(v=>Math.round(clamp(v*k,0,1)*255)).join(',')})`;
 ctx.clearRect(0,0,W,H);
 const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#1b313c');bg.addColorStop(.55,'#081721');bg.addColorStop(1,'#030c13');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 ctx.strokeStyle='#31565c88';ctx.lineWidth=1;
 for(let y=24;y<H;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
 const plate=(x,y,w,h,col,stroke='#030a13')=>{
  ctx.beginPath();ctx.moveTo(x-w*.42,y-h*.5);ctx.lineTo(x+w*.42,y-h*.5);ctx.lineTo(x+w*.5,y-h*.32);ctx.lineTo(x+w*.48,y+h*.34);ctx.lineTo(x+w*.29,y+h*.5);ctx.lineTo(x-w*.29,y+h*.5);ctx.lineTo(x-w*.48,y+h*.34);ctx.lineTo(x-w*.5,y-h*.32);ctx.closePath();ctx.fillStyle=col;ctx.fill();ctx.lineWidth=3;ctx.strokeStyle=stroke;ctx.stroke();
 };
 ctx.save();ctx.translate(W/2,H*.52);const scale=Math.min(W/195,H/320);ctx.scale(scale,scale);
 // Back to front: articulated legs, arms, chest, head, weapon.
 for(const s of [-1,1]){
  plate(s*34,74,49,97,rgb(c.fabric));plate(s*34,127,46,44,rgb(c.primary));plate(s*34,169,52,43,rgb(c.shadow));
  plate(s*81,-24,50,52,rgb(c.shadow));plate(s*84,20,43,64,rgb(c.primary));plate(s*85,68,42,39,rgb(c.light));
 }
 plate(0,55,105,46,rgb(c.black));plate(0,-28,122,127,rgb(c.shadow));plate(0,-45,111,93,rgb(c.primary));
 for(const s of [-1,1]){plate(s*27,-50,49,67,rgb(c.light));plate(s*64,-90,49,30,rgb(c.light));}
 plate(0,-96,43,27,rgb(c.black));plate(0,-140,73,79,rgb(c.primary));plate(0,-141,69,28,rgb(c.black));plate(0,-138,61,14,rgb(c.visor));plate(0,-121,53,14,rgb(c.light));
 ctx.fillStyle=rgb(c.accent);for(const s of [-1,1])ctx.fillRect(s*25-12,-140,22,5);
 plate(34,30,46,106,'#15252a');plate(34,-16,47,23,rgb(c.light));plate(34,-45,31,20,rgb(c.accent));
 if(c.grade>=8){ctx.strokeStyle=rgb(c.accent);ctx.lineWidth=3;ctx.strokeRect(-70,-93,140,149);}
 ctx.restore();ctx.font='700 12px ui-monospace,monospace';ctx.textAlign='center';ctx.fillStyle='#b6e1e9';ctx.fillText(id<0?'БАЗОВАЯ ФОРМА':'БРОНЯ / КЛАСС '+String(id+1).padStart(2,'0'),W/2,H-12);
}
function refreshCameraInterface(){
 const active=externalCameraEnabled();
 document.body.classList.toggle('thirdPerson',active);
 document.body.classList.toggle('secondPerson',secondPersonEnabled());
 const touchButton=$('viewTouch');
 if(touchButton){touchButton.textContent=secondPersonEnabled()?'◉ СПЕРЕДИ':thirdPersonEnabled()?'◧ 3D ВИД':'◫ ВИД';touchButton.setAttribute('aria-pressed',String(active));touchButton.setAttribute('aria-label','Камера: '+cameraModeLabel()+'. Переключить вид');}
}
function toggleCameraMode(){
 if(game?.preview){game.previewCamera=thirdPersonEnabled()?'second':secondPersonEnabled()?'first':'third';refreshCameraInterface();return game.previewCamera;}
 save.settings.cameraMode=thirdPersonEnabled()?'second':secondPersonEnabled()?'first':'third';
 persist();refreshCameraInterface();
 if(game?.state==='playing')toast('КАМЕРА: '+cameraModeLabel()+(secondPersonEnabled()?' · ОРУЖИЕ СТРЕЛЯЕТ ВПЕРЁД':''),1.65);
 return save.settings.cameraMode;
}
// Canvas-only silhouette (software raycaster) shares the selected armor palette.
function drawFallbackOperator(ctx,p,size){
 const c=operatorPalette(p.bodyArmorType),S=Math.max(35,size*.56);
 const rgb=(arr,k=1)=>`rgb(${arr.map(v=>Math.round(clamp(v*k,0,1)*255)).join(',')})`;
 const plate=(x,y,w,h,col)=>{
  ctx.beginPath();
  if(typeof ctx.quadraticCurveTo==='function'){
    const a=x-w*.50,b=x+w*.50,t=y-h*.50,d=y+h*.50,r=Math.min(w,h)*.19;
    ctx.moveTo(a+r,t);ctx.lineTo(b-r,t);ctx.quadraticCurveTo(b,t,b,t+r);
    ctx.lineTo(b,d-r);ctx.quadraticCurveTo(b,d,b-r,d);
    ctx.lineTo(a+r,d);ctx.quadraticCurveTo(a,d,a,d-r);
    ctx.lineTo(a,t+r);ctx.quadraticCurveTo(a,t,a+r,t);
  }else{
    ctx.moveTo(x-w*.45,y-h*.48);ctx.lineTo(x+w*.45,y-h*.48);
    ctx.lineTo(x+w*.5,y+h*.30);ctx.lineTo(x+w*.3,y+h*.5);
    ctx.lineTo(x-w*.3,y+h*.5);ctx.lineTo(x-w*.5,y+h*.30);
  }
  ctx.closePath();ctx.fillStyle=col;ctx.fill();ctx.strokeStyle='#06111b';ctx.lineWidth=.014;ctx.stroke();
 };
 ctx.save();ctx.scale(S,S);ctx.translate(0,.065);
 for(const s of [-1,1]){
  plate(s*.19,.27,.27,.48,rgb(c.shadow));plate(s*.19,.50,.25,.16,rgb(c.light));
  plate(s*.36,-.16,.27,.43,rgb(c.primary));plate(s*.40,.12,.24,.30,rgb(c.shadow));
  plate(s*.19,.64,.30,.16,rgb(c.shadow));
 }
 plate(0,-.01,.68,.24,rgb(c.black));plate(0,-.28,.81,.78,rgb(c.primary));
 plate(0,-.28,.69,.59,rgb(c.light));plate(0,-.31,.08,.45,rgb(c.shadow));
 // A single neck-pivot rotation keeps the fallback visor/chin attached to
 // the looking head, as in the fully three-dimensional operator.
 plate(0,-.73,.24,.24,rgb(c.joint));
 ctx.save();ctx.translate(0,-.73);ctx.rotate(-clamp(p.pitch||0,-1.08,1.06)*.30);
 plate(0,-.20,.54,.48,rgb(c.primary));
 plate(0,-.18,.45,.16,rgb(c.black));plate(0,-.18,.39,.064,rgb(c.visor));
 ctx.restore();
 // Illustrated fallback weapon also follows camera pitch and weapon type.
 // Shapes are deliberately distinct; there is no universal club silhouette.
 const gunId=clamp(p.weapon|0,0,weapons.length-1);
 const signal=rgb(weapons[gunId].color),metal='#78949f',low='#162a35';
 ctx.save();ctx.translate(.43,-.21);ctx.rotate(-clamp(p.pitch||0,-1.08,1.06)*.30);
 plate(-.07,.17,.18,.36,low);plate(0,0,.29,.17,low);
 plate(.015,-.06,.23,.048,metal);plate(.27,0,.33,.095,metal);
 plate(.41,0,.065,.13,low);plate(.07,-.16,.13,.055,signal);
 if(gunId===1||gunId===8){plate(.27,-.075,.34,.055,metal);plate(.27,.075,.34,.055,metal);}
 if(gunId===2){for(let i=0;i<4;i++)plate(.11+i*.07,-.075,.045,.07,signal);plate(.19,.10,.36,.035,low);}
 if(gunId===3){plate(.12,.18,.19,.21,low);for(let i=0;i<4;i++)plate(.19+i*.07,-.09,.025,.08,metal);}
 if(gunId===4){plate(.22,0,.50,.26,metal);plate(.46,0,.11,.30,low);}
 if(gunId===5){plate(.17,.13,.22,.24,low);plate(.42,0,.12,.18,metal);}
 if(gunId===6){for(const y of [-.08,0,.08])plate(.31,y,.30,.035,metal);}
 if(gunId===7){for(const y of [-.09,.09])plate(.20,y,.27,.055,signal);}
 if(gunId===8){plate(.11,.11,.26,.24,metal);plate(.11,.11,.19,.19,low);}
 if(gunId===9){for(const y of [-.105,.105])plate(.10,y,.23,.065,signal);}
 ctx.restore();
 if(c.grade>0)for(const s of [-1,1])plate(s*.49,-.46,.19,.17,rgb(c.accent));
 // Match WebGL's hit flash when WebGL is unavailable (Android Canvas path).
 const hit=clamp((p.hitFlash||0)/.44,0,1);
 if(hit>0){
  const shade=p.hitBlocked?'#70eaff':p.hitHead?'#ffe685':'#ff8174';
  ctx.save();ctx.globalAlpha=hit*.78;ctx.fillStyle=shade;ctx.shadowColor=shade;
  ctx.shadowBlur=15*hit;ctx.beginPath();
  ctx.ellipse(0,p.hitHead?-.91:-.28,p.hitHead?.27:.35,p.hitHead?.20:.31,0,0,TAU);
  ctx.fill();ctx.restore();
 }
 ctx.restore();
}

// Reflect saved camera mode (including imported backups) on the initial UI.
refreshCameraInterface();
