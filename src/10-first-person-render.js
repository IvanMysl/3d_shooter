// The first-person gun is deliberately a screen-space viewmodel, placed at a
// different offset from the in-world third-person gun. A tracer launched from
// the operator's world-space gun will therefore appear to come from empty
// space on the other side of the screen. Use this *exact* viewmodel transform
// for the visible local muzzle, independent of desktop/mobile aspect ratio.
function heldWeaponMuzzleLocal(p){
 const idx=clamp(p.weapon|0,0,weapons.length-1);
 const compact=idx===5||idx===9,heavy=idx===2||idx===4||idx===8;
 const long=idx===2||idx===6,twin=idx===1||idx===8;
 const barrelLen=long?.96:compact?.35:heavy?.68:.62;
 const front=Math.max(.90+barrelLen*.5,1.18+.15*.5,
  idx===2?1.35+.22*.5:0,compact?1.01+.16*.5:0)+.025;
 const x=twin?.24+((Math.max(0,p.shots||0)%2===0)?-.084:.084):.24;
 return {x,y:-.28+.022,z:front};
}
function heldWeaponMuzzleWorld(g,p){
 const muzzle=heldWeaponMuzzleLocal(p),yaw=p.yaw,pitch=p.pitch;
 const cy=Math.cos(yaw),sy=Math.sin(yaw),si=Math.sin(pitch),co=Math.cos(pitch);
 const forward=[sy*co,si,cy*co];
 const right=[-cy,0,sy],up=[-sy*si,co,-cy*si];
 const eyeY=1.47+(p.feetY||0)+Math.sin(g.t*10)*(p.walk?.028:0)+(p.recoil||0)*-.045;
 const recoil=Math.min(.37,Math.max(0,p.recoil||0))*.20;
 const walk=p.walk?Math.sin(g.t*10.5)*.010:Math.sin(g.t*1.4)*.002;
 const equip=Math.max(0,(p.equipAnim||0))*.17;
 const x=muzzle.x*.61+.20,y=muzzle.y*.55-.19+walk-equip,z=muzzle.z*.87+.72-recoil;
 return {x:p.x+right[0]*x+up[0]*y+forward[0]*z,
  y:eyeY+right[1]*x+up[1]*y+forward[1]*z,
  z:p.z+right[2]*x+up[2]*y+forward[2]*z};
}
function renderHeldWeapon(g,p,eye,dir){
 // A modular multi-part viewmodel: different silhouettes for all ten guns.
 // Procedural geometry only; no external models or textures are required.
 if(!glReady)return;
 gl.clear(gl.DEPTH_BUFFER_BIT);
 gl.uniform1f(u.uMatOverride,3.);
 const yaw=p.yaw,cy=Math.cos(yaw),sy=Math.sin(yaw);
 const right=[-cy,0,sy],up=[-sy*Math.sin(p.pitch),Math.cos(p.pitch),-cy*Math.sin(p.pitch)];
 const recoil=Math.min(.37,Math.max(0,p.recoil||0))*.20;
 const walk=p.walk?Math.sin(g.t*10.5)*.010:Math.sin(g.t*1.4)*.002;
 const equip=Math.max(0,(p.equipAnim||0))*.17;
 const at=(x,y,z)=>[
   eye[0]+right[0]*x+up[0]*(y+walk-equip)+dir[0]*(z-recoil),
   eye[1]+right[1]*x+up[1]*(y+walk-equip)+dir[1]*(z-recoil),
   eye[2]+right[2]*x+up[2]*(y+walk-equip)+dir[2]*(z-recoil)
 ];
 const idx=p.weapon, w=weapons[idx],glow=w.color;
 const dark=[.09,.115,.126],black=[.032,.045,.055],steel=[.32,.37,.38],
   mid=[.205,.245,.26],edge=[.36,.39,.38],bronze=[.34,.28,.20];
 const x0=.24,y0=-.28;
 const a=(x,y,z)=>at(x*.61+.20,y*.55-.19,z*.87+.72);
 function part(x,y,z,sx,sy,sz,color,e=0,shape=geom.bevel){
   draw(shape,...a(x,y,z),sx*.58,sy*.58,sz*.64,yaw,color,e);
 }
 const compact=(idx===5||idx===9),heavy=(idx===2||idx===4||idx===8);
 const long=(idx===2||idx===6),twin=(idx===1||idx===8);
 const bodyLen=compact?.44:heavy?.76:.61;
 const barrelLen=long?.96:compact?.35:heavy?.68:.62;
 const bw=(idx===1||idx===8)?.18:(idx===2?.1:.13);
 // Faceted alloy lower receiver and distinctive reinforced upper shell.
 part(x0,y0,.45,.27,.20,bodyLen,steel);
 part(x0,y0+.106,.46,.255,.071,bodyLen*.94,mid);
 part(x0,y0-.095,.37,.185,.105,.37,dark);
 part(x0+.135,y0-.205,.23,.116,.26,.19,black);
 part(x0-.11,y0-.26,.20,.11,.23,.14,mid);
 part(x0-.154,y0+.01,.44,.047,.115,bodyLen*.86,black);
 part(x0+.154,y0+.01,.44,.047,.115,bodyLen*.86,black);
 // Ribbed handguard sleeves and ergonomic ergonomic shell fasteners.
 for(let j=0;j<(compact?3:6);j++){
   let z=.33+j*.09;
   part(x0,y0+.15,z,.232,.016,.027,edge);
   part(x0+.14,y0-.03,z,.02,.075,.03,dark);
 }
 // Cylindrical and square profile barrels carry actual circular highlights.
 if(twin){
   for(const xx of [-.084,.084]){
     part(x0+xx,y0+.019,.87,bw*.81,bw*.81,barrelLen,steel,0,geom.cylinder);
     part(x0+xx,y0+.019,1.09,bw*.92,bw*.92,.11,black,0,geom.cylinder);
   }
 }else{
   part(x0,y0+.022,.90,bw,bw,barrelLen,steel,0,geom.cylinder);
   part(x0,y0+.021,1.04,bw*1.32,bw*1.32,.15,black,0,geom.cylinder);
   part(x0,y0+.022,1.18,bw*1.06,bw*1.06,.15,edge,0,geom.cylinder);
 }
 // Rails, metallic side plates, magazine and optical sight.
 part(x0,y0+.17,.66,.08,.07,.66,black);
 for(let q=0;q<4;q++)part(x0,y0+.205,.45+q*.14,.21,.015,.026,steel);
 part(x0,y0+.27,.45,.13,.13,.23,black);
 part(x0,y0+.33,.47,.09,.035,.09,glow,.24);
 part(x0+.17,y0+.027,.40,.015,.085,.23,edge);
 part(x0-.17,y0+.04,.40,.018,.06,.21,bronze);
 part(x0+.18,y0+.075,.40,.02,.03,.035,glow,.8);
 for(const sign of [-1,1]){
   part(x0+sign*.196,y0-.09,.32,.026,.045,.06,black);
   part(x0+sign*.173,y0+.105,.65,.025,.03,.075,steel);
 }
 if(compact){ // Short weapon with an oversized vented muzzle and compact magazine.
   part(x0,y0-.20,.39,.08,.24,.14,dark);
   part(x0,y0+.03,1.01,.17,.17,.16,steel,0,geom.cylinder);
 }
 if(idx===2){ // Electromagnetic railgun: exposed coil cells and twin guide rails.
   for(const side of [-1,1])part(x0+side*.15,y0+.06,1.07,.047,.075,.92,black);
   for(let j=0;j<5;j++)part(x0,y0+.11,.86+j*.16,.30,.035,.042,glow,.35);
   part(x0,y0+.18,1.35,.09,.09,.22,steel);
 }
 if(idx===4||idx===8){ // Heavy launcher: chamber, pressure drum, rocket cage.
   part(x0,y0-.12,.49,.33,.31,.31,mid,0,geom.cylinder);
   for(let j=0;j<4;j++){
      let aa=j*Math.PI*.5;
      part(x0+Math.sin(aa)*.20,y0-.12+Math.cos(aa)*.20,.47,.075,.075,.27,bronze,0,geom.cylinder);
   }
   part(x0,y0+.006,1.19,.29,.27,.13,dark);
 }
 if(idx===3){ // LMG cooling fins, box magazine and bipod attachment.
   part(x0+.15,y0-.24,.34,.25,.31,.24,dark);
   for(let j=0;j<7;j++)part(x0,y0-.025,.80+j*.075,.30,.021,.035,edge);
 }
 if(idx===7||idx===9){ // High-energy emitter: exposed double charged cells.
   for(const side of [-1,1]){
     part(x0+side*.115,y0+.03,.74,.09,.13,.39,black,0,geom.cylinder);
     part(x0+side*.12,y0+.04,.86,.043,.072,.25,glow,.53,geom.cylinder);
   }
 }
 // Gloved support hand: soft joints rather than a floating weapon.
 if(!compact){
   part(x0-.24,y0-.22,.64,.19,.145,.25,[.145,.17,.18]);
   for(let j=0;j<3;j++)part(x0-.15+j*.066,y0-.15,.75,.056,.061,.17,[.19,.22,.22]);
 }
 // Effects sit on the visible front of each barrel in the viewmodel too.
 // Reuse the same weapon-specific bounded-cost flash as the world model.
 drawGunMuzzleFlash(p,idx,heldWeaponMuzzleLocal(p),part,g.t);
 gl.uniform1f(u.uMatOverride,-1.);
}
// Directional glow tails share one tapered GPU mesh. No per-shot allocations
// beyond a few scalars and no change to projectile collision or lifetimes.
function drawEnergyTail(b,color,width,maxLength,glow=1.1){
 const vx=Number(b.vx)||0,vy=Number(b.vy)||0,vz=Number(b.vz)||0;
 const speed=Math.hypot(vx,vy,vz);if(speed<.001)return;
 const len=Math.min(maxLength,.06+speed*.032);
 const point=b.visualPoint||b;
 const x=point.x-vx/speed*len*.5,y=point.y-vy/speed*len*.5,z=point.z-vz/speed*len*.5;
 const yaw=Math.atan2(vx,vz),tilt=-Math.atan2(vy,Math.hypot(vx,vz));
 draw(geom.tracer||geom.cylinder,x,y,z,width,width,len,yaw,color,glow,tilt);
}
function render(){if(!game)return;if(!glReady){renderFallback();return;}const g=game,p=g.p,tt=themes[sectorStyle%themes.length];
// Physically restrained weapon sway and recoil, kept separate from the 3D scene.
const gunEl=$('gun');if(gunEl){const bob=p.walk?Math.sin(g.t*11)*3.5:Math.sin(g.t*1.9)*.65;
 gunEl.style.transform=`translateX(calc(-50% + ${p.walk?Math.cos(g.t*8)*2.7:0}px)) translateY(${bob+(p.recoil||0)*12}px) rotate(${Math.sin(g.t*1.1)*.18}deg)`;}
let width=innerWidth,height=innerHeight;const post=save.settings.quality===2&&!!postProgram&&ensurePost();gl.bindFramebuffer(gl.FRAMEBUFFER,post?postFbo:null);gl.viewport(0,0,glCanvas.width,glCanvas.height);gl.clearColor(...tt.fog,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,materialAlbedo);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,materialNormals);gl.activeTexture(gl.TEXTURE0);let camY=1.47+(p.feetY||0)+Math.sin(g.t*10)*(p.walk? .028:0)+(p.recoil||0)*-.045;const camera=externalCameraEnabled()?operatorCameraPose(p):null;let eye=camera?camera.eye:[p.x,camY,p.z],dir=camera?camera.dir:[Math.sin(p.yaw)*Math.cos(p.pitch),Math.sin(p.pitch),Math.cos(p.yaw)*Math.cos(p.pitch)];matView=lookAt(...eye,eye[0]+dir[0],eye[1]+dir[1],eye[2]+dir[2]);matProj=perspective((touchOnly&&height>width?79:73)*Math.PI/180,width/height,.045,60);gl.uniformMatrix4fv(u.uView,false,matView);gl.uniformMatrix4fv(u.uProj,false,matProj);gl.uniform3fv(u.uEye,eye);gl.uniform3fv(u.uFog,tt.fog);gl.uniform1f(u.uTime,g.t);gl.uniform3fv(u.uAccent,tt.accent);gl.uniform3fv(u.uCamDir,dir);gl.uniform1f(u.uQuality,save.settings.quality);gl.uniform1f(u.uShotFlash,clamp((p.shotGlow||0)*6,0,1.5));gl.uniform1f(u.uMatOverride,-1);backdrop(tt,p,g.t);
const features=mapFeatures.filter(f=>hypot(f.x-p.x,f.z-p.z)<24).sort((a,b)=>hypot(a.x-p.x,a.z-p.z)-hypot(b.x-p.x,b.z-p.z));
const lamps=[];for(let i=0;i<3;i++){let f=features[i];lamps.push(f?f.x:(p.x+dir[0]*7),f?(f.kind===3?3.55:3.15):3.1,f?f.z:(p.z+dir[2]*7));}
gl.uniform3fv(u['uLampPos[0]'],new Float32Array(lamps));drawWorld();drawEnvironmentDetails(g,tt);drawRouteBeacons(g,tt);drawDevices(g);
if(g.portalReady){
  let tm=g.t,xx=portal.x,zz=portal.z,py=floorHeight(xx,zz);
  draw(geom.ring,xx,1.5+py,zz,1.25,1.25,1.25,tm*.7,tt.accent,1.45,.35);
  draw(geom.ring,xx,1.5+py,zz,.87,.87,.87,-tm*1.15,tt.accent,1.5,.8);
  draw(geom.orb,xx,1.5+py,zz,.55,.55,.55,tm,[.35,.72,1],1.5);
  // A short, local, low-cost breadcrumb trail around corners. The arrow and
  // map route are still available in power-saving 2D fallback mode.
  const path=portalRoute(p,13);
  for(let i=2;i<path.length;i+=2){const q=path[i];
    if(hypot(q.x-p.x,q.z-p.z)>13)continue;
    draw(geom.ring,q.x,.061+floorHeight(q.x,q.z),q.z,.25,.021,.25,tm*.4+i,tt.accent,.72);
  }
}
for(const loot of g.loot){let c=loot.type==='heal'?[1,.32,.48]:loot.type==='energy'?[.32,.88,1]:loot.type==='plates'?[.67,.80,.94]:[1,.75,.31];draw(geom.octa,loot.x,.45+(Number.isFinite(loot.feetY)?loot.feetY:floorHeight(loot.x,loot.z))+Math.sin(g.t*4+loot.z)*.12,loot.z,.24,.39,.24,g.t*2,c,1.25)}
if(save.settings.quality>0)for(const s of (g.scorch||[])){
 if(hypot(s.x-p.x,s.z-p.z)>22)continue;
 let r=s.r*Math.min(1,s.life/2);draw(geom.orb,s.x,.021,s.z,r*2,.009,r*2,0,[.037,.041,.047],0);
}
if(g.mission?.type==='recovery')for(const c of g.mission.caches)if(distance(c,p)<31){
 const ground=floorHeight(c.x,c.z),enabled=!c.got&&missionItemActive(g,c,'recovery');
 // Steel body = exact AABB in worldEquipmentGrid: +/- .31 horizontally,
 // ground+.02 to ground+.32 vertically. Top inset is inside that body.
 draw(geom.cube,c.x,ground+.17,c.z,.62,.30,.62,0,[.20,.29,.36],.015);
 draw(geom.cube,c.x,ground+.295,c.z,.37,.045,.37,0,c.got?[.14,.24,.24]:[.26,.50,.57],c.got?.02:.15);
 if(c.got)continue;
 const y=.76+ground+Math.sin(g.t*2.5+c.id)*.13;
 draw(geom.octa,c.x,y,c.z,.30,.43,.30,g.t*.95,enabled?[.56,.91,1]:[.27,.34,.42],enabled?1.1:.14);
 draw(geom.ring,c.x,.34+ground,c.z,.66,.05,.66,g.t,enabled?[.30,.95,1]:[.32,.39,.42],enabled?.7:.10);
}
if(g.arenaEvent?.phase==='warning'){const a=g.arenaEvent;
 const ground=floorHeight(a.x,a.z);const c=a.kind==='thermal'?[1,.28,.13]:[.3,.76,1];
 if(distance(a,p)<30){draw(geom.ring,a.x,ground+.045,a.z,a.r*2,.08,a.r*2,g.t*2,c,1.25);draw(geom.ring,a.x,ground+.08,a.z,.25+((2.65-a.warning)/2.65)*a.r*1.7,.06,.25+((2.65-a.warning)/2.65)*a.r*1.7,-g.t,c,.8);}
}
for(const node of g.nodes){if(node.dead||distance(node,p)>31)continue;
 const type=NODE_TYPES[node.type],col=node.flash>0?[1,1,1]:type.color;
 draw(geom.cube,node.x,.34+floorHeight(node.x,node.z),node.z,.74,.57,.74,0,[.075,.13,.21],.10);
 draw(geom.pylon,node.x,.84+floorHeight(node.x,node.z),node.z,.43,.84,.43,g.t*.10,[.18,.24,.33],.2);
 draw(geom.ring,node.x,1.32+floorHeight(node.x,node.z),node.z,.82,.82,.82,g.t*.72+node.phase,col,1.35,.22);
 if(save.settings.quality>0)draw(geom.ring,node.x,1.32+floorHeight(node.x,node.z),node.z,.70,.70,.70,-g.t*.57+node.phase,col,.9,.8);
 draw(geom.orb,node.x,1.32+floorHeight(node.x,node.z),node.z,.39,.39,.39,g.t*1.4,col,1.75);
}
for(const enemy of g.enemies){if(enemy.dead)continue;
  if(enemy.boss && enemy.ultWarn>0 && distance(p,enemy)<29){
   const yy=.05+(enemy.feetY||0),progress=1-enemy.ultWarn/1.85;
   draw(geom.ring,enemy.x,yy,enemy.z,10.3,.08,10.3,g.t*1.8,[1,.34,.12],1.25);
   draw(geom.ring,enemy.x,yy+.06,enemy.z,2+8.3*progress,.07,2+8.3*progress,-g.t,[1,.71,.24],.96);
  }

  if(enemy.telegraph>0&&enemy.lockTarget&&distance(p,enemy)<28){
    const ex=enemy.lockTarget.x-enemy.x,ez=enemy.lockTarget.z-enemy.z,l=hypot(ex,ez);
    if(l>.1){draw(geom.cube,(enemy.x+enemy.lockTarget.x)*.5,1.02,(enemy.z+enemy.lockTarget.z)*.5,.021,.023,l,Math.atan2(ex,ez),[1,.12,.29],1.4);
    draw(geom.ring,enemy.lockTarget.x,.07,enemy.lockTarget.z,.76,.044,.76,g.t*1.3,[1,.2,.38],1.5);}
  }
  if(save.settings.quality>0&&hypot(enemy.x-p.x,enemy.z-p.z)<19){let r=enemy.radius*(enemy.boss?2.05:1.22);draw(geom.orb,enemy.x,.032+(enemy.type==='drone'?floorHeight(enemy.x,enemy.z):(Number.isFinite(enemy.feetY)?enemy.feetY:floorHeight(enemy.x,enemy.z))),enemy.z,r*2,.012,r*2,0,[.055,.063,.075],0);}
  if(enemy.elite&&save.settings.quality>0){draw(geom.ring,enemy.x,.32+(Number.isFinite(enemy.feetY)?enemy.feetY:floorHeight(enemy.x,enemy.z)),enemy.z,1.1,.08,1.1,g.t,[1,.56,.26],.95);}
  if(enemy.type==='warden'&&save.settings.quality>0){draw(geom.ring,enemy.x,1.35+(Number.isFinite(enemy.feetY)?enemy.feetY:floorHeight(enemy.x,enemy.z)),enemy.z,8.2,.09,8.2,g.t*.25,[.18,.53,1],.68);}
  if(enemy.type==='artillery'&&save.settings.quality>0){draw(geom.ring,enemy.x,.35+(Number.isFinite(enemy.feetY)?enemy.feetY:floorHeight(enemy.x,enemy.z)),enemy.z,.8,.13,.8,g.t,[1,.46,.14],1.0);}
  drawEnemyModel(enemy,g,p);drawEnemyVanguard(enemy,g,p);
}
// Detached armor survives briefly, bounces, then evaporates; never a permanent shadow.
if(glReady && robotDebrisMesh && g.robotDebris?.length){
 gl.uniform1f(u.uMatOverride,4);
 const maxShardsRendered=save.settings.quality===0?8:touchOnly?17:36;
 let visibleShards=0;
 for(const sh of g.robotDebris){
  if(hypot(sh.x-p.x,sh.z-p.z)>18)continue;
  if(visibleShards++>=maxShardsRendered)break;
  const fade=clamp(sh.life/.42,0,1);
  const scale=sh.size*(sh.rested?.76:1);
  draw(robotDebrisMesh,sh.x,sh.y,sh.z,scale,scale,scale,sh.rx,sh.color.map(v=>v*fade),sh.glow?fade*.18:0,sh.rz);
 }
 gl.uniform1f(u.uMatOverride,-1);
}
// One GPU batch for all wall scars: avoids hundreds of draw calls on phones.
if(decalDirty)rebuildDecalMesh();
if(decalMesh)draw(decalMesh,0,0,0,1,1,1,0,[1,1,1],0);
for(const tr of (g.tracers||[])){
 const xx=tr.b.x-tr.a.x,yy=tr.b.y-tr.a.y,zz=tr.b.z-tr.a.z;
 const len=hypot(xx,yy,zz),fade=clamp(tr.life/tr.maxLife,0,1);
 if(len>.01){const yaw=Math.atan2(xx,zz),tilt=-Math.atan2(yy,hypot(xx,zz)),mid=v3((tr.a.x+tr.b.x)/2,(tr.a.y+tr.b.y)/2,(tr.a.z+tr.b.z)/2);
  draw(geom.tracer||geom.cylinder,mid.x,mid.y,mid.z,tr.r*fade*1.65,tr.r*fade*1.65,len,yaw,tr.col,.9+1.3*fade,tilt);
 }
}
for(const f of (g.impactFx||[])){
 if(hypot(f.x-p.x,f.z-p.z)>24)continue;
 let a=clamp(f.life/f.maxLife,0,1),r=f.r*(1+(1-a)*1.35);
 draw(geom.orb,f.x,f.y,f.z,r*.5*a,r*.5*a,r*.5*a,g.t,f.col,1.15*a);
}
for(const b of (g.projectiles||[])){
 const point=b.visualPoint||b;
 if(hypot(point.x-p.x,point.z-p.z)>40)continue;
 draw(geom.spark||geom.orb,point.x,point.y,point.z,b.rad*2,b.rad*2,b.rad*2,g.t*2,b.w.color,2.4);
 if(save.settings.quality>0){
   drawEnergyTail(b,b.w.color,b.rad*1.15,1.25,1.35);
   draw(geom.ring,point.x,point.y,point.z,b.rad*2.5,b.rad*2.5,b.rad*2.5,g.t,b.w.color,.58);
 }
}
if(save.settings.quality>0){
 // Slow-floating luminous dust: subtly conveys depth and air movement.
 for(let i=0;i<12;i++){
  let h=(i*17.23+g.sector*4.71),aa=i*2.399963+g.t*.08;
  let px=p.x+Math.sin(aa)*((i%5)+2.9),pz=p.z+Math.cos(aa)*((i%5)+2.9);
  if(isWall(px,pz))continue;
  let py=1.15+1.45*Math.sin(h+g.t*.26);
  draw(geom.orb,px,py,pz,.014,.014,.014,aa,tt.accent,.25);
 }
}
for(const b of g.bullets){
 const c=b.from==='player'?[.1,1,1]:b.col||[1,.25,.43];
 draw(geom.spark||geom.orb,b.x,b.y,b.z,b.radius*2,b.radius*2,b.radius*2,g.t,c,2.5);
 if(save.settings.quality>0)drawEnergyTail(b,c,b.radius*.66,.92,1.05);
}
let renderedSparks=0;const maxSparks=save.settings.quality===0?75:touchOnly?110:145;
for(let i=g.particles.length-1;i>=0&&renderedSparks<maxSparks;i--){
 const pfx=g.particles[i];renderedSparks++;
 const life=clamp(pfx.life/Math.max(.01,pfx.maxLife||.6),0,1);
 const scale=(.037+.031*life)*Math.sqrt(life);
 const vx=Number(pfx.vx)||0,vy=Number(pfx.vy)||0,vz=Number(pfx.vz)||0;
 const speed=Math.hypot(vx,vy,vz);
 const yaw=speed>.001?Math.atan2(vx,vz):Number(pfx.a)||0;
 const tilt=speed>.001?-Math.atan2(vy,Math.hypot(vx,vz)):0;
 const mesh=save.settings.quality===0?geom.octa:(geom.spark||geom.orb);
 draw(mesh,pfx.x,pfx.y,pfx.z,scale,scale,scale*(1.2+Math.min(3,speed*.38)),yaw,pfx.col||[1,.65,.32],.5+2*life,tilt);
}
// Draw peers with the existing detailed operator model in both camera modes.
if(typeof mpMatchRenderOperators==='function')mpMatchRenderOperators(g);
if(camera?.drawActor)renderOperator(g,p);else renderHeldWeapon(g,p,eye,dir);if(post)showPost(g.t);
}
