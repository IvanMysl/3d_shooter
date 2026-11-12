
function drawEnvironmentDetails(g,tt){
  // Small animated holograms: intentionally few draw calls on mobile.
  const reduced=save.settings.quality===0;
  const features=reduced?mapFeatures.filter(f=>f.kind===3):mapFeatures;
  for(const f of features){
    if(distance(g.p,f)>18)continue;
    const height=f.kind===3?3.65:2.85;
    const sz=f.kind===3?.65:.38;
    const t=g.t*1.2+f.phase;
    draw(geom.ring,f.x,height,f.z,sz,sz,sz,t,tt.accent,.7,Math.PI*.34);
    if(!reduced)draw(geom.octa,f.x,height+.14+Math.sin(t*1.7)*.15,f.z,.18,.34,.18,-t*1.5,tt.accent,1.55);
  }
}
function drawRouteBeacons(g,tt){
 if(!g.portalReady || save.settings.quality===0)return;
 const path=portalRoute(g.p,28);
 // Six modest 3D markers along reachable paths; unlike direct wall-through arrows.
 for(let i=3;i<path.length;i+=4){
  const pt=path[i],d=hypot(pt.x-g.p.x,pt.z-g.p.z);
  if(d<3||d>21||isWall(pt.x,pt.z))continue;
  const bob=.22+Math.sin(g.t*3+i)*.05;
  draw(geom.ring,pt.x,bob,pt.z,.33,.045,.33,g.t*.36,tt.accent,.62);
  draw(geom.octa,pt.x,bob+.30,pt.z,.08,.23,.08,g.t*.7,tt.accent,.7);
 }
}
function drawEnemyVanguard(e,g,p){
  if(save.settings.quality===0||e.dead)return;
  const d=hypot(e.x-p.x,e.z-p.z);if(d>15)return;
  const s=e.radius, tt=g.t*3.3+e.id, bob=Math.sin(tt)*.06;
  const metal=[.22,.28,.33],black=[.052,.069,.075],silver=[.49,.57,.61];
  const warning=e.elite?[1,.64,.26]:e.color;
  const rot=Math.atan2(p.x-e.x,p.z-e.z);
  // Separate articulated shoulder bearing, armor cap and illuminated status.
  for(const side of [-1,1]){
    const rx=e.x+side*s*.68,rz=e.z;
    draw(geom.orb,rx,.98+bob,rz,s*.22,s*.24,s*.26,tt*.12,metal,.02);
    draw(geom.bevel,rx+side*s*.14,1.06+bob,rz,s*.32,s*.17,s*.34,rot,metal,.015);
    draw(geom.cube,rx+side*s*.17,.89+bob,rz+s*.26,s*.17,s*.055,s*.15,rot,warning,.42);
    if(!e.boss){
      const phase=Math.sin(tt+side*2.3)*.12;
      draw(geom.pylon,rx+side*s*.12,.41+phase,rz,s*.19,s*.39,s*.25,rot,black,.015);
      draw(geom.bevel,rx+side*s*.12,.1+phase,rz+s*.14,s*.31,s*.09,s*.4,rot,silver,.01);
    }
  }
  if(!e.boss){
    draw(geom.bevel,e.x,1.49+bob,e.z,s*.58,s*.12,s*.48,rot,metal,.03);
    draw(geom.cube,e.x,1.51+bob,e.z+s*.18,s*.38,s*.065,s*.11,rot,warning,.3);
  }else{
    draw(geom.ring,e.x,1.67+bob,e.z,s*1.56,s*1.56,s*1.56,g.t*.42,warning,.46);
  }
}