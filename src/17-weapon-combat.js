
function sparkImpact(x,y,z,n,col,num=9){
 const g=game;if(!g)return;
 const cap=save.settings.quality===0?9:20;
 for(let i=0;i<Math.min(num,cap);i++){
   let a=rand(0,TAU),sp=rand(.6,3.0),up=rand(-.2,2);
   const vx=Math.cos(a)*sp+(n.nx||0)*rand(.6,1.9),vz=Math.sin(a)*sp+(n.nz||0)*rand(.6,1.9),life=rand(.16,.48);
   g.particles.push({x,y,z,vx,vy:up+(n.ny||0),vz,life,maxLife:life,a,col});
 }
}
function addSurfaceMark(hit,w,size=1){
 if(!hit||hit.kind==='enemy'||hit.kind==='node'||!game)return;
 const g=game,energy=w.mode==='projectile'||w.blast>0;
 const c=w.color||[1,.65,.3],r=(energy?.20:.105)*(w.name.includes('ДРОБОВИК')?.70:1)*size;
 const bounds=hit.solid?.box||hit.box||null;
 // Corner and edge contacts have genuine diagonal sphere normals, but a
 // bullet mark must lie on one flat metal face. Pick the dominant face ONLY
 // for its decal; preserve the 3D contact normal for sparks and explosions.
 const normal=[hit.nx||0,hit.ny||0,hit.nz||0];
 let face=0;if(Math.abs(normal[1])>Math.abs(normal[face]))face=1;
 if(Math.abs(normal[2])>Math.abs(normal[face]))face=2;
 const decalN=[0,0,0];decalN[face]=Math.sign(normal[face])||1;
 g.decals.push({x:hit.x+decalN[0]*.025,y:hit.y+decalN[1]*.025,z:hit.z+decalN[2]*.025,
  nx:decalN[0],ny:decalN[1],nz:decalN[2],r,life:energy?34:52,maxLife:energy?34:52,
  col:c,energy,rot:rand(0,TAU),kind:hit.kind,cellX:hit.cellX,cellZ:hit.cellZ,bounds:bounds&&bounds.slice()});
 while(g.decals.length>MAX_WALL_MARKS)g.decals.shift();decalDirty=true;
}
function addImpact(hit,w,power=1){
 if(!hit||!game)return;
 const g=game,n={nx:hit.nx||0,ny:hit.ny||0,nz:hit.nz||0};
 if(hit.kind!=='enemy')addSurfaceMark(hit,w,Math.min(2,power));
 sparkImpact(hit.x,hit.y,hit.z,n,w.color||[1,1,1],Math.round(8*power));
 g.impactFx.push({x:hit.x,y:hit.y,z:hit.z,life:.19,maxLife:.19,r:(.13+.14*power),col:w.color||[1,1,1]});
 if(g.impactFx.length>38)g.impactFx.shift();
}
// Common surface presentation for a projectile impact. The caller still
// decides all damage and which objects were struck.
function projectileSurfaceFx(hit,w){
 addImpact(hit,w,1.5);
 return {x:hit.x+(hit.nx||0)*.05,y:hit.y+(hit.ny||0)*.05,z:hit.z+(hit.nz||0)*.05};
}
function makeTracer(o,end,w,width=1,localView=false){
 emitShotTracer(o,end,w,width,localView);
}
function muzzleVisual(w){
 const p=game?.p;if(!p)return;
 const el=$('muzzle');el.style.opacity='.95';el.style.setProperty('--flash-color',`rgb(${w.color.map(c=>Math.round(c*255)).join(',')})`);
 clearTimeout(muzzleVisual.tm);muzzleVisual.tm=setTimeout(()=>el.style.opacity='0',72);
 emitWeaponSound(w);
}
function shotProjectile(w,o,d,localView=false){
 const g=game;
 if(g.projectiles.length>=42)g.projectiles.shift();
 g.projectiles.push({x:o.x+d.x*.035,y:o.y+d.y*.035,z:o.z+d.z*.035,vx:d.x*w.speed,vy:d.y*w.speed,vz:d.z*w.speed,life:Math.min(5.4,w.range/w.speed),w,rad:w.name.includes('ГРОМ')?.20:.13,
  localView,launchAge:0});
}
// Stage 4: a blast affects the actual volumetric robot silhouette, not a
// single point at its center. Cover is sampled at five independent visible
// body parts. A direct projectile impact is always a direct hit; it is not
// cancelled merely because another sample point is hidden by a staircase.
function enemyBlastSamples(e,origin){
 const scale=e.boss?1.75:Math.max(.76,Math.min(1.31,e.radius/.51));
 const base=Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z);
 const squat=e.type==='scout'||e.type==='charger'||e.airborne||e.type==='drone';
 const torsoY=base+(squat?1.02:1.28)*scale;
 const headY=base+(squat?1.52:2.07)*scale;
 const rx=scale*(squat?1.12:1.42),rz=scale*1.03;
 const dx=origin.x-e.x,dz=origin.z-e.z,span=Math.hypot(dx,dz)||1;
 const tx=dx/span,tz=dz/span;
 const front={x:e.x+tx*rx*.65,y:torsoY,z:e.z+tz*rz*.65};
 const points=[front,
  {x:e.x,y:headY,z:e.z},
  {x:e.x,y:base+.50*scale,z:e.z},
  {x:e.x-tz*rx*.57,y:torsoY,z:e.z+tx*rz*.57},
  {x:e.x+tz*rx*.57,y:torsoY,z:e.z-tx*rz*.57}];
 const vertical=Math.max(base+.20,Math.min(headY+.40*scale,origin.y));
 let hullDist=Math.hypot(Math.max(0,span-Math.max(rx,rz)*.70),origin.y-vertical);
 // A blast can graze a real wing, boot or external weapon mount even if the
 // central body is outside the radius. Evaluate the SAME collision proxies
 // as direct shots, then sample the two nearest exposed accessory surfaces.
 const kind=e.boss?'boss':e.airborne?'drone':e.type,hover=kind==='drone'||kind==='medic';
 const t=Number(game?.t)||0,id=Number(e.id)||0;
 const bob=hover?Math.sin(t*3.2+id)*.048:
  (Math.sin((Number(e.robotCycle)||0)*2)*.030*(Number(e.robotMotion)||0)+Math.sin(t*.8+id)*.006);
 const foot=base+bob+(hover?.13:0);
 const yaw=Number.isFinite(e.robotYaw)?e.robotYaw:0,cs=Math.cos(yaw),sn=Math.sin(yaw);
 const extras=[];
 for(const v of robotAccessoryVolumes(e)){
  const center={x:e.x+v.x*cs+v.z*sn,y:foot+v.y,z:e.z-v.x*sn+v.z*cs};
  const ox=origin.x-center.x,oy=origin.y-center.y,oz=origin.z-center.z;
  const lx=ox*cs-oz*sn,lz=ox*sn+oz*cs;
  const den=Math.hypot(v.rx*lx,v.ry*oy,v.rz*lz)||1;
  // Support point of a rotated ellipsoid, on the actual side facing the blast.
  const sx=v.rx*v.rx*lx/den,sy=v.ry*v.ry*oy/den,sz=v.rz*v.rz*lz/den;
  const point={x:center.x+sx*cs+sz*sn,y:center.y+sy,z:center.z-sx*sn+sz*cs};
  const dist=Math.hypot(origin.x-point.x,origin.y-point.y,origin.z-point.z);
  extras.push({point,dist});
 }
 extras.sort((a,b)=>a.dist-b.dist);
 for(const extra of extras.slice(0,2)){
  hullDist=Math.min(hullDist,extra.dist);
  points.push(extra.point);
 }
 return {points,hullDist};
}
function areaVisibility(origin,targets){
 let visible=0;
 for(const point of targets){
  const dx=point.x-origin.x,dy=point.y-origin.y,dz=point.z-origin.z;
  const len=Math.hypot(dx,dy,dz);
  if(len<.16){visible++;continue;}
  const unit=v3(dx/len,dy/len,dz/len);
  // Exclude the final body surface from geometry-only raycast tolerance.
  if(!rayWall(origin,unit,Math.max(0,len-.13)))visible++;
 }
 return targets.length?visible/targets.length:0;
}
function explosiveHitEnemy(e,w,amount){
 hurtEnemy(e,amount,{penetration:w.penetration||0});
 // Ion bolts short-circuit robots; rockets and grenades do not freeze them.
 if(!e.dead&&w.ionStun)e.stun=Math.max(e.stun||0,w.ionStun);
}
function splash(x,y,z,w,directEnemy=null,directNode=null){
 const g=game;if(!g)return;
 const r=w.blast||2.5,origin=v3(x,y,z);
 // A real contact with the hull must inflict the complete listed direct damage.
 // Do not apply splash damage to that same enemy twice.
 if(directEnemy&&!directEnemy.dead)explosiveHitEnemy(directEnemy,w,w.damage);
 for(const e of [...g.enemies]){
  if(e.dead||e===directEnemy||!robotNearArea(e,origin,r))continue;
  const body=enemyBlastSamples(e,origin);
  if(body.hullDist>=r)continue;
  const exposure=areaVisibility(origin,body.points);
  if(exposure<=0)continue;
  const attenuation=.30+.70*Math.pow(1-body.hullDist/r,1.20);
  explosiveHitEnemy(e,w,w.damage*attenuation*exposure);
 }
 for(const n of [...g.nodes])if(!n.dead&&n!==directNode){
  const nodeY=.95+(n.feetY||floorHeight(n.x,n.z));
  const dx=n.x-x,dy=nodeY-y,dz=n.z-z;
  const dist=Math.hypot(dx,dy,dz);
  if(dist>=r+n.radius)continue;
  const target=v3(n.x,nodeY,n.z);
  if(areaVisibility(origin,[target])>0)
   damagePowerNode(n,w.damage*(.35+.65*(1-Math.min(1,dist/(r+n.radius)))));
 }
 emitExplosionFx(x,y,z,w,r);
}
function shootPellet(w,burstIndex=0){
 if(!game||game.state!=='playing')return;
 const g=game,p=g.p;
 const o=v3(p.x,1.47+(p.feetY||0),p.z);
 const targetDir=aimFromOperator(o);
 const baseYaw=Math.atan2(targetDir.x,targetDir.z),basePitch=Math.atan2(targetDir.y,Math.hypot(targetDir.x,targetDir.z));
 const ang=baseYaw+rand(-w.spread,w.spread),pitch=clamp(basePitch+rand(-w.spread*.64,w.spread*.64),-1.13,1.04);
 const d=v3(Math.sin(ang)*Math.cos(pitch),Math.sin(pitch),Math.cos(ang)*Math.cos(pitch));
 // Match the gun that is actually displayed: the first-person viewmodel
 // is deliberately larger and closer to the camera than the world avatar.
 const localView=!externalCameraEnabled();
 const muzzle=localView&&glReady?heldWeaponMuzzleWorld(g,p):operatorMuzzlePoint(p);
 if(w.mode==='projectile'){
   // Parallax correction: the physical rocket/bolt leaves the barrel and
   // converges onto the same sighted obstruction or enemy. Cheap for the
   // low-rate projectile weapons; hitscan damage stays entirely unchanged.
   const wall=rayWall(o,d,w.range);
   const node=rayNode(o,d,wall?wall.t:w.range)||(wall?.kind==='node'?wall:null);
   const limit=node?node.t:(wall?wall.t:w.range);
   const enemy=rayEnemy(o,d,limit);
   const hitDistance=enemy?.t??node?.t??wall?.t??w.range;
   shotProjectile(w,muzzle,directionFromMuzzle(o,d,muzzle,hitDistance),localView);
   return;
 }
 const wall=rayWall(o,d,w.range);
 const node=rayNode(o,d,wall?wall.t:w.range)||(wall?.kind==='node'?wall:null);
 const limit=node?node.t:(wall?wall.t:w.range);
 const ignored=new Set();
 const maxPierce=w.pierce||1;
 let count=0,first=null;
 while(count<maxPierce){
   const hit=rayEnemy(o,d,limit,ignored,touchOnly&&save.settings.aim?.10:0);
   if(!hit)break;
   ignored.add(hit.enemy.id);count++;
   if(!first)first=hit;
   hurtEnemy(hit.enemy,w.damage*Math.pow(.75,count-1),{penetration:w.penetration});
   if(w.freeze)hit.enemy.stun=Math.max(hit.enemy.stun,w.freeze);
   if(count===1||w.pierce)addImpact({...hit,nx:-d.x,ny:-d.y,nz:-d.z},w,.8);
 }
 if(node&&(!first||w.pierce)){
  damagePowerNode(node.node,w.damage*Math.pow(.78,Math.max(0,count-1)));
  addImpact(node,w,1);
 }
 const end=node||wall||first||v3(o.x+d.x*w.range,o.y+d.y*w.range);
 // An enemy stops ordinary rounds; railgun beams penetrate until the wall.
 const target=(w.pierce||!first)?end:first;
 if(w.shots===1||count>0||Math.random()<.42)makeTracer(muzzle,target,w,w.shots>1?.48:1,localView);
 if(wall&&!node&&(!first||w.pierce||w.shots>1))addImpact(wall,w,w.pierce?1.8:.85);
}
function fireBurstShot(w){
 if(!game||game.state!=='playing')return;
 applyWeaponShotPose(game.p,w);
 muzzleVisual(w);
 for(let k=0;k<w.shots;k++)shootPellet(w);
}
let ammoShots=0;
function shoot(){
 if(typeof mpMatch!=='undefined'&&mpMatch?.active){
  if(typeof mpCombatTapFire==='function')mpCombatTapFire();
  return;
 }
 const g=game;if(!g||g.state!=='playing')return;
 const p=g.p,w=combatWeapon(p.weapon);
 if(!w||p.cooldown>0||p.heatLock>0)return;
 if(p.heat>=97){p.heatLock=1;emitOverheatFx();return;}
 // Preserve the sub-frame remainder: otherwise a purchased rate upgrade may
 // produce fewer real shots at some FPS because each shot discards up to dt.
 p.cooldown=w.rate*p.rate+Math.min(0,p.cooldown);
 p.heat=clamp(p.heat+w.heat*p.heatMod,0,105);
 p.shots++;ammoShots++;
 fireBurstShot(w);
 if(w.burst){for(let j=1;j<w.burst;j++)g.burstQueue.push({w,delay:j*w.burstGap});}
}
function updatePlayerOrdnance(dt){
 const g=game;if(!g)return;
 for(const b of g.burstQueue){b.delay-=dt;if(b.delay<=0){fireBurstShot(b.w);b.done=true;}}
 g.burstQueue=g.burstQueue.filter(x=>!x.done);
 for(const s of g.projectiles){
   if(s.dead)continue;
   s.launchAge=(s.launchAge||0)+dt;
   const ox=s.x,oy=s.y,oz=s.z;
   const length=hypot(s.vx*dt,s.vy*dt,s.vz*dt);
   if(length<1e-6)continue;
   const d=v3(s.vx*dt/length,s.vy*dt/length,s.vz*dt/length),o=v3(ox,oy,oz);
   const wall=sweepWorldSphere(o,d,length,s.rad||0),node=rayNode(o,d,wall?Math.min(length,wall.t):length,s.rad||0);
   const enemy=rayEnemy(o,d,node?node.t:(wall?Math.min(length,wall.t):length),null,s.rad||0);
   const hit=enemy||node||wall;
   if(hit){s.x=hit.x;s.y=hit.y;s.z=hit.z;s.dead=true;const visual=projectileSurfaceFx(hit,s.w);if(hit.kind==='node')damagePowerNode(hit.node,s.w.damage);
      splash(visual.x,visual.y,visual.z,s.w,hit.kind==='enemy'?hit.enemy:null,hit.kind==='node'?hit.node:null);
      
   }else{s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;}
   s.vy-=(s.w.gravity||0)*dt;
   s.life-=dt;
   if(s.life<=0&&!s.dead){s.dead=true;splash(s.x,s.y,s.z,s.w);}
 }
 g.projectiles=g.projectiles.filter(s=>!s.dead);
 for(const n of g.nodes)n.flash=Math.max(0,n.flash-dt);
 advanceSharedImpactFx(g,dt);
}
function showDamage(e,dm,crit){let p=game.p,dx=e.x-p.x,dz=e.z-p.z;const a=Math.atan2(dx,dz)-p.yaw;let v=Math.atan2(Math.sin(a),Math.cos(a));let d=hypot(dx,dz);if(Math.abs(v)>1.1)return;let el=document.createElement('div');el.className='floating';el.textContent=(crit?'✦ ':'')+dm;el.style.left=(50+v/(Math.PI*.38)*40)+'%';el.style.top=(42+rand(-5,5))+'%';el.style.color=crit?'#ffcf6e':'#e9fdff';$('floatText').appendChild(el);setTimeout(()=>el.remove(),790);$('crosshair').classList.add('hit');clearTimeout(showDamage.tm);showDamage.tm=setTimeout(()=>$('crosshair').classList.remove('hit'),90)}
