
function sparkImpact(x,y,z,n,col,num=9){
 const g=game;if(!g)return;
 const cap=save.settings.quality===0?9:20;
 for(let i=0;i<Math.min(num,cap);i++){
   let a=rand(0,TAU),sp=rand(.6,3.0),up=rand(-.2,2);
   g.particles.push({x,y,z,vx:Math.cos(a)*sp+(n.nx||0)*rand(.6,1.9),vy:up+(n.ny||0),vz:Math.sin(a)*sp+(n.nz||0)*rand(.6,1.9),life:rand(.16,.48),a,col});
 }
}
function addSurfaceMark(hit,w,size=1){
 if(!hit||hit.kind==='enemy'||hit.kind==='node'||!game)return;
 const g=game,energy=w.mode==='projectile'||w.blast>0;
 const c=w.color||[1,.65,.3],r=(energy?.20:.105)*(w.name.includes('ДРОБОВИК')?.70:1)*size;
 g.decals.push({x:hit.x+(hit.nx||0)*.025,y:hit.y+(hit.ny||0)*.025,z:hit.z+(hit.nz||0)*.025,nx:hit.nx||0,ny:hit.ny||0,nz:hit.nz||0,r,life:energy?34:52,maxLife:energy?34:52,col:c,energy,rot:rand(0,TAU),kind:hit.kind});
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
function makeTracer(o,end,w,width=1){
 const g=game;if(!g)return;
 g.tracers.push({a:{...o},b:{...end},life:w.pierce?.22:.13,maxLife:w.pierce?.22:.13,r:(w.pierce?.052:.017)*width,col:w.color});
 if(g.tracers.length>(touchOnly?35:65))g.tracers.shift();
}
function muzzleVisual(w){
 const p=game?.p;if(!p)return;
 p.shotGlow=Math.max(p.shotGlow||0,.115+(w.recoil||.3)*.065);
 const el=$('muzzle');el.style.opacity='.95';el.style.setProperty('--flash-color',`rgb(${w.color.map(c=>Math.round(c*255)).join(',')})`);
 clearTimeout(muzzleVisual.tm);muzzleVisual.tm=setTimeout(()=>el.style.opacity='0',72);
 sound(w.pierce?135:w.blast?110:w.shots>1?165:w.rate<.09?280:218,w.blast?.24:.10,w.pierce||w.blast?'sawtooth':'triangle',w.blast?.12:.058);
}
function shotProjectile(w,o,d){
 const g=game;
 if(g.projectiles.length>=42)g.projectiles.shift();
 g.projectiles.push({x:o.x+d.x*.48,y:o.y+d.y*.48,z:o.z+d.z*.48,vx:d.x*w.speed,vy:d.y*w.speed,vz:d.z*w.speed,life:Math.min(5.4,w.range/w.speed),w,rad:w.name.includes('ГРОМ')?.20:.13});
}
function splash(x,y,z,w){
 const g=game;if(!g)return;
 const r=w.blast||2.5;
 for(const e of [...g.enemies]){
   if(e.dead)continue;
   const dd=hypot(e.x-x,e.z-z);
   if(dd<r+e.radius){
     const shield=lineClear(x,z,e.x,e.z)?1:.32;
     hurtEnemy(e,w.damage*shield*(.33+.67*(1-Math.min(1,dd/(r+e.radius)))));
   }
 }
 for(const n of [...g.nodes])if(!n.dead){const d=hypot(n.x-x,n.z-z);if(d<r+n.radius)damagePowerNode(n,w.damage*(.35+.65*(1-Math.min(1,d/(r+n.radius)))));}
 burst(x,y,z,w.color||[1,.6,.3],save.settings.quality===0?20:44);
 g.impactFx.push({x,y,z,life:.48,maxLife:.48,r:r*.64,col:w.color||[1,.5,.1],explosion:true});
 if(g.impactFx.length>38)g.impactFx.shift();
 sound(w.name.includes('ГРОМ')?73:99,.4,'sawtooth',.19);
}
function shootPellet(w,burstIndex=0){
 if(!game||game.state!=='playing')return;
 const g=game,p=g.p;
 const o=v3(p.x,1.47+(p.feetY||0),p.z),ang=p.yaw+rand(-w.spread,w.spread),pitch=clamp(p.pitch+rand(-w.spread*.64,w.spread*.64),-1.13,1.04);
 const d=v3(Math.sin(ang)*Math.cos(pitch),Math.sin(pitch),Math.cos(ang)*Math.cos(pitch));
 if(w.mode==='projectile'){
   shotProjectile(w,o,d);
   return;
 }
 const wall=rayWall(o,d,w.range);
 const node=rayNode(o,d,wall?wall.t:w.range);
 const limit=node?node.t:(wall?wall.t:w.range);
 const ignored=new Set();
 const maxPierce=w.pierce||1;
 let count=0,first=null;
 while(count<maxPierce){
   const hit=rayEnemy(o,d,limit,ignored,touchOnly&&save.settings.aim?.10:0);
   if(!hit)break;
   ignored.add(hit.enemy.id);count++;
   if(!first)first=hit;
   hurtEnemy(hit.enemy,w.damage*Math.pow(.75,count-1));
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
 if(w.shots===1||count>0||Math.random()<.42)makeTracer(v3(o.x+d.x*.44,o.y+d.y*.44,o.z+d.z*.44),target,w,w.shots>1?.48:1);
 if(wall&&!node&&(!first||w.pierce||w.shots>1))addImpact(wall,w,w.pierce?1.8:.85);
}
function fireBurstShot(w){
 if(!game||game.state!=='playing')return;
 muzzleVisual(w);
 const p=game.p;p.recoil=Math.min(1.8,(p.recoil||0)+(w.recoil||.3)*.68);
 for(let k=0;k<w.shots;k++)shootPellet(w);
}
let ammoShots=0;
function shoot(){
 const g=game;if(!g||g.state!=='playing')return;
 const p=g.p,w=weapons[p.weapon];
 if(!w||p.cooldown>0||p.heatLock>0)return;
 if(p.heat>=97){p.heatLock=1;toast('ПЕРЕГРЕВ ОРУЖИЯ',.75);sound(70,.15);return;}
 p.cooldown=w.rate*p.rate;
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
   const ox=s.x,oy=s.y,oz=s.z;
   const length=hypot(s.vx*dt,s.vy*dt,s.vz*dt);
   if(length<1e-6)continue;
   const d=v3(s.vx*dt/length,s.vy*dt/length,s.vz*dt/length),o=v3(ox,oy,oz);
   const wall=rayWall(o,d,length),node=rayNode(o,d,wall?Math.min(length,wall.t):length);
   const enemy=rayEnemy(o,d,node?node.t:(wall?Math.min(length,wall.t):length));
   const hit=enemy||node||wall;
   if(hit){s.x=hit.x;s.y=hit.y;s.z=hit.z;s.dead=true;addImpact(hit,s.w,1.5);if(hit.kind==='node')damagePowerNode(hit.node,s.w.damage);
      splash(hit.x,hit.y,hit.z,s.w);
      
   }else{s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;}
   s.vy-=(s.w.gravity||0)*dt;
   s.life-=dt;
   if(s.life<=0&&!s.dead){s.dead=true;splash(s.x,s.y,s.z,s.w);}
 }
 g.projectiles=g.projectiles.filter(s=>!s.dead);
 for(const n of g.nodes)n.flash=Math.max(0,n.flash-dt);for(const d of g.decals)d.life-=dt;
 const oldMarks=g.decals.length;g.decals=g.decals.filter(d=>d.life>0);if(g.decals.length!==oldMarks)decalDirty=true;
 for(const f of g.impactFx)f.life-=dt;
 g.impactFx=g.impactFx.filter(f=>f.life>0);
}
function showDamage(e,dm,crit){let p=game.p,dx=e.x-p.x,dz=e.z-p.z;const a=Math.atan2(dx,dz)-p.yaw;let v=Math.atan2(Math.sin(a),Math.cos(a));let d=hypot(dx,dz);if(Math.abs(v)>1.1)return;let el=document.createElement('div');el.className='floating';el.textContent=(crit?'✦ ':'')+dm;el.style.left=(50+v/(Math.PI*.38)*40)+'%';el.style.top=(42+rand(-5,5))+'%';el.style.color=crit?'#ffcf6e':'#e9fdff';$('floatText').appendChild(el);setTimeout(()=>el.remove(),790);$('crosshair').classList.add('hit');clearTimeout(showDamage.tm);showDamage.tm=setTimeout(()=>$('crosshair').classList.remove('hit'),90)}