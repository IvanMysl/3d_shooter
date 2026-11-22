// Stage131: distance-aware multiplayer nameplates, with *physical* line-of-sight.
// Never render an HTML label just because its point projects onto the screen:
// rayWall queries exactly the same real wall, stair, deck, roof and box hulls
// as combat. The head and the floating caption must BOTH be unobstructed.
const MP_NAME_MAX_RANGE=26,MP_NAME_FADE_RANGE=8;
const mpNameNodes=new Map();
function mpNameTagClear(){
 for(const node of mpNameNodes.values())node.remove();
 mpNameNodes.clear();
}
function mpNameTagRayVisible(eye,target){
 if(!eye||!target)return false;
 const dx=target.x-eye.x,dy=target.y-eye.y,dz=target.z-eye.z;
 const distance=Math.hypot(dx,dy,dz);
 if(!Number.isFinite(distance)||distance<.15)return false;
 // Do not report an opponent visible through even the thinnest solid.
 const hit=rayWall(eye,{x:dx/distance,y:dy/distance,z:dz/distance},distance);
 return !hit||hit.t>=distance-.012;
}
function mpNameTagProjectWebGL(target,rect){
 // Reuse the current frame's actual view/projection matrices rather than a
 // guessed camera. Includes the two third-person cameras and FOV changes.
 const a=matView,b=matProj;
 if(!a||!b)return null;
 const x=target.x,y=target.y,z=target.z;
 const vx=a[0]*x+a[4]*y+a[8]*z+a[12];
 const vy=a[1]*x+a[5]*y+a[9]*z+a[13];
 const vz=a[2]*x+a[6]*y+a[10]*z+a[14];
 const depth=-vz;
 if(depth<.15)return null;
 const nx=b[0]*vx/depth,ny=b[5]*vy/depth;
 if(!Number.isFinite(nx)||!Number.isFinite(ny)||Math.abs(nx)>1.05||Math.abs(ny)>1.08)return null;
 return {x:rect.left+(nx*.5+.5)*rect.width,y:rect.top+(.5-ny*.5)*rect.height,depth};
}
function mpNameTagCamera(g){
 const p=g.p,external=externalCameraEnabled()?operatorCameraPose(p):null;
 if(external){
  const eye={x:external.eye[0],y:external.eye[1],z:external.eye[2]};
  return {eye,yaw:Math.atan2(external.dir[0],external.dir[2]),pitch:Math.asin(clamp(external.dir[1],-1,1))};
 }
 return {eye:{x:p.x,y:p.feetY+(glReady?1.47:1.46)+
  (glReady?Math.sin(g.t*10)*(p.walk?.028:0)-(p.recoil||0)*.045:0),z:p.z},yaw:p.yaw,pitch:p.pitch};
}
function mpNameTagProjectCanvas(target,camera,rect){
 const w=glCanvas.width,h=glCanvas.height;
 if(!(w>0&&h>0))return null;
 const fov=(touchOnly&&h>w?82:74)*Math.PI/180;
 const focal=w/(2*Math.tan(fov/2));
 const dx=target.x-camera.eye.x,dz=target.z-camera.eye.z;
 const forward=dx*Math.sin(camera.yaw)+dz*Math.cos(camera.yaw);
 if(forward<=.15)return null;
 const right=-dx*Math.cos(camera.yaw)+dz*Math.sin(camera.yaw);
 const x=w*.5+right/forward*focal;
 const horizon=h*.49+Math.tan(camera.pitch)*focal*.62;
 const y=horizon-(target.y-camera.eye.y)*focal/forward;
 if(x<-w*.05||x>w*1.05||y<-h*.08||y>h*1.08)return null;
 return {x:rect.left+x*rect.width/w,y:rect.top+y*rect.height/h,depth:forward};
}
function mpNameTagLayout(actor,camera,rect){
 if(!actor?.p||actor.p.hp<=0)return null;
 const p=actor.p,head={x:p.x,y:p.feetY+1.78,z:p.z};
 const anchor={x:p.x,y:p.feetY+2.24,z:p.z};
 const distance=Math.hypot(head.x-camera.eye.x,head.y-camera.eye.y,head.z-camera.eye.z);
 if(distance>MP_NAME_MAX_RANGE||distance<.72||!Number.isFinite(distance))return null;
 const screen=glReady?mpNameTagProjectWebGL(anchor,rect):mpNameTagProjectCanvas(anchor,camera,rect);
 if(!screen)return null;
 // Leave the crosshair and top HUD unobstructed. A label should never be
 // treated as a HUD target marker; a wall hides it even when the HUD overlaps.
 const midX=rect.left+rect.width*.5,midY=rect.top+rect.height*.5;
 if(Math.hypot(screen.x-midX,screen.y-midY)<(touchOnly?57:47)||
   screen.y<rect.top+(touchOnly?69:53)||screen.y>rect.bottom-(touchOnly?45:25)||
   screen.x<rect.left+35||screen.x>rect.right-35)return null;
 if(!mpNameTagRayVisible(camera.eye,head)||!mpNameTagRayVisible(camera.eye,anchor))return null;
 const fade=clamp((MP_NAME_MAX_RANGE-distance)/MP_NAME_FADE_RANGE,0,1)*clamp((distance-.7)/1.5,0,1);
 if(fade<.06)return null;
 return {x:screen.x,y:screen.y,opacity:fade,fontSize:clamp(15-distance*.095,11.2,14.3)};
}
function mpNameTagsUpdate(){
 const host=$('mpNameTags'),m=typeof mpMatch!=='undefined'?mpMatch:null,g=game;
 if(!host)return;
 if(!g||g.state!=='playing'||!m?.active||m.preview||m.paused||m.round?.ended||
  !$('overlay')?.classList.contains('hidden')|| (typeof mpChat!=='undefined'&&mpChat.open)){
  host.hidden=true;return;
 }
 host.hidden=false;
 const rect=glCanvas.getBoundingClientRect(),camera=mpNameTagCamera(g),active=new Set();
 for(const [id,actor] of m.actors){
  if(id===m.self||actor.p?.hp<=0)continue;
  active.add(id);
  const layout=mpNameTagLayout(actor,camera,rect);
  let node=mpNameNodes.get(id);
  if(!layout){if(node)node.hidden=true;continue;}
  if(!node){
   node=document.createElement('div');node.className='mpNameTag';
   node.setAttribute('aria-hidden','true');host.appendChild(node);mpNameNodes.set(id,node);
  }
  // Nicknames come from the authenticated match roster and are NEVER parsed
  // as markup, even if a future room allows additional Unicode characters.
  if(node.textContent!==actor.nick)node.textContent=actor.nick;
  const enemyTeam=m.settings?.mode==='teams'&&actor.team!==m.roster.find(x=>x.id===m.self)?.team;
  node.classList.toggle('mpNameEnemy',!!enemyTeam);
  node.style.transform=`translate3d(${layout.x.toFixed(1)}px,${layout.y.toFixed(1)}px,0) translate(-50%,-100%)`;
  node.style.opacity=layout.opacity.toFixed(2);
  node.style.fontSize=layout.fontSize.toFixed(1)+'px';
  node.hidden=false;
 }
 for(const [id,node] of mpNameNodes)if(!active.has(id)){node.remove();mpNameNodes.delete(id);}
}
