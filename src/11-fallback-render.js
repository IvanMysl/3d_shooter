

// Hand-authored procedural metal plate albedo. Generated at runtime in a
// small offscreen canvas, so the single HTML stays offline and asset-free.
const steelAtlas=new Map();
function makeSteelAtlas(theme,variant){
 const c=document.createElement('canvas');c.width=320;c.height=512;
 const a=c.getContext('2d'),w=c.width,h=c.height,img=a.createImageData(w,h),data=img.data;
 const t=themes[theme],seed=1111+theme*7919+variant*3959;
 const rnd=(x,y)=>{let k=(Math.imul(x+seed,374761393)+Math.imul(y+251,668265263))|0;k=Math.imul(k^(k>>>13),1274126177);return ((k^(k>>>16))>>>0)/4294967295;};
 const bc=[37+t.wall[0]*110,41+t.wall[1]*110,46+t.wall[2]*110];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const edge=Math.min(x,w-1-x),side=edge<18?.53:edge<34?.79:1;
  const lineY=y%102,edgeY=lineY<5||lineY>98?.55:lineY<11||lineY>91?.83:1;
  const n=rnd(x>>2,y>>2),fine=rnd(x,y),scr= Math.sin(y*.47+x*.005)*.019;
  const scratches=rnd(x>>3,y>>6)>.968 && ((x+3*y)%19<3)?1.25:1;
  const oxidation=rnd(x>>4,y>>5)>.82?.86:1;
  const col=side*edgeY*(.82+.25*n+.07*fine+scr)*scratches*oxidation;
  const p=(y*w+x)*4;
  for(let q=0;q<3;q++)data[p+q]=Math.max(0,Math.min(255,bc[q]*col));data[p+3]=255;
 }
 a.putImageData(img,0,0);
 // Machined joint lines and recessed power boxes.
 const stroke='#92a4ab',tint=`rgba(${Math.round(t.accent[0]*245)},${Math.round(t.accent[1]*245)},${Math.round(t.accent[2]*245)},.5)`;
 a.fillStyle='#080f1b';a.fillRect(7,18,306,5);a.fillRect(7,494,306,6);
 a.fillStyle='#172431';a.fillRect(11,38,298,8);a.fillRect(11,469,298,10);
 for(let yy=96;yy<500;yy+=103){
  a.fillStyle='#090f17';a.fillRect(15,yy,290,4);
  a.fillStyle='rgba(195,216,217,.18)';a.fillRect(17,yy+5,286,2);
 }
 a.fillStyle='#07121a';a.fillRect(26,132,268,177);
 a.fillStyle='#253747';a.fillRect(35,141,250,159);
 const g=a.createLinearGradient(0,140,320,302);g.addColorStop(0,'#101e2a');g.addColorStop(.39,'#354451');g.addColorStop(.54,'#142431');g.addColorStop(1,'#192c3a');
 a.fillStyle=g;a.fillRect(43,149,235,145);
 a.strokeStyle='rgba(182,210,221,.38)';a.lineWidth=2;a.strokeRect(39,145,244,153);
 // Vents and real light-facing rim detail.
 for(let yy=166;yy<277;yy+=15){a.fillStyle='#070e16';a.fillRect(65,yy,183,8);a.fillStyle='rgba(149,174,184,.25)';a.fillRect(68,yy+1,180,2)}
 a.fillStyle=tint;a.fillRect(69,276,172,5);
 for(let bx of [20,300])for(let by of [26,115,323,465]){
  a.fillStyle='#070d17';a.beginPath();a.arc(bx,by,6,0,Math.PI*2);a.fill();
  a.fillStyle='#7f939f';a.beginPath();a.arc(bx-1,by-1,2.5,0,Math.PI*2);a.fill();
 }
 if(variant){
  a.fillStyle='rgba(5,9,15,.72)';a.fillRect(90,350,147,90);
  for(let k=0;k<7;k++){
   a.fillStyle=k%2?'#a99b64':'#282c29';a.beginPath();
   a.moveTo(96+k*20,350);a.lineTo(106+k*20,350);a.lineTo(147+k*20,440);a.lineTo(137+k*20,440);a.fill();
  }
  a.font='bold 20px monospace';a.fillStyle='#bbba99';a.fillText('CAUTION',99,334);
 }else{
  a.fillStyle='#0b131b';a.fillRect(65,359,190,56);
  a.strokeStyle='#758c9b';a.lineWidth=2;a.strokeRect(64,358,191,57);
  a.fillStyle=tint;a.fillRect(74,367,172,3);
  a.font='bold 18px monospace';a.fillStyle='#b1cad6';a.fillText('RIFT // 07',79,394);
  a.fillStyle='#657f8e';a.font='12px monospace';a.fillText('RESTRICTED ACCESS',79,408);
 }
 // Grease and weathering spots, short directional scuffs.
 for(let i=0;i<280;i++){
  const x=(rnd(i,seed)*312)|0,y=(rnd(seed,i)*500)|0;
  a.strokeStyle=`rgba(${i%3?8:211},${i%3?14:225},${i%3?17:211},${.025+rnd(i,i)*.13})`;
  a.lineWidth=i%7===0?2:1;a.beginPath();a.moveTo(x,y);a.lineTo(x+rnd(i+5,i)*28,y-1);a.stroke();
 }
 return c;
}
function wallTexture(theme,variant){let id=theme*2+variant;if(!steelAtlas.has(id))steelAtlas.set(id,makeSteelAtlas(theme,variant));return steelAtlas.get(id)}
// Detailed silhouette renderer for the no-WebGL emergency mode; no neon polygons.
function drawFallbackRobot(ctx,e,size,t){
  const S=Math.max(9,size),c=e.flash>0?[1,1,1]:e.color||[.4,.8,.9];
  const accent=`rgb(${Math.round(c[0]*220+35)},${Math.round(c[1]*220+35)},${Math.round(c[2]*220+35)})`;
  const heavy=e.boss||['brute','warden','artillery'].includes(e.type);
  const insect=e.type==='scout'||e.type==='charger',drone=e.airborne||e.type==='drone';
  const walk=Math.sin(Number(e.robotCycle)||0)*.10*clamp(Number(e.robotMotion)||0,0,1);
  ctx.save();ctx.scale(S,S);
  // Damage produces an instantaneous body recoil rather than a permanent shadow.
  const hit=Math.max(0,Number(e.hitReact)||0);
  if(hit>0)ctx.rotate(Math.sin((.24-hit)*39)*hit*.30);
  const fill=(points,col,stroke=false)=>{
    ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.fill();
    if(stroke){ctx.lineWidth=.018;ctx.strokeStyle='#111b25';ctx.stroke();}
  };
  const plate=(x,y,w,h,col)=>{
    if(typeof ctx.quadraticCurveTo!=='function'){
      fill([[x-w*.43,y-h/2],[x+w*.43,y-h/2],[x+w*.5,y-h*.28],[x+w*.5,y+h*.25],[x+w*.34,y+h*.5],[x-w*.34,y+h*.5],[x-w*.5,y+h*.25],[x-w*.5,y-h*.25]],col,true);
      return;
    }
    const a=x-w*.5,b=x+w*.5,t=y-h*.5,d=y+h*.5,r=Math.min(w,h)*.18;
    ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(a+r,t);ctx.lineTo(b-r,t);
    ctx.quadraticCurveTo(b,t,b,t+r);ctx.lineTo(b,d-r);ctx.quadraticCurveTo(b,d,b-r,d);
    ctx.lineTo(a+r,d);ctx.quadraticCurveTo(a,d,a,d-r);ctx.lineTo(a,t+r);
    ctx.quadraticCurveTo(a,t,a+r,t);ctx.closePath();ctx.fill();
    ctx.lineWidth=.018;ctx.strokeStyle='#111b25';ctx.stroke();
  };
  ctx.shadowBlur=0;
  if(drone){
    fill([[-.46,-.08],[-.95,-.37],[-.88,.12],[-.34,.28],[0,.31],[.34,.28],[.88,.12],[.95,-.37],[.46,-.08]],'#283847',true);
    if(e.type==='skyhunter'){
      fill([[-.98,-.35],[-.38,-.17],[0,-.42],[.38,-.17],[.98,-.35],[.64,-.04],[0,.29],[-.64,-.04]],'#374e5c',true);
    }else if(e.type==='skyguard'){
      for(const s of [-1,1])plate(s*.71,-.08,.35,.48,'#69757b');
      plate(0,-.13,.58,.51,'#5b6469');
    }else if(e.type==='stormray'){
      fill([[-1.05,-.20],[-.41,-.25],[0,-.44],[.41,-.25],[1.05,-.20],[.87,.13],[0,.22],[-.87,.13]],'#325c5d',true);
    }
    fill([[-.83,-.24],[-.54,-.16],[-.46,.12],[-.78,.03]],'#647684');
    fill([[.83,-.24],[.54,-.16],[.46,.12],[.78,.03]],'#647684');
    plate(0,.02,.58,.42,'#435965');plate(0,.09,.25,.17,'#0b1522');
    for(const k of [-1,1]){plate(k*.62,-.03,.28,.16,'#23313b');plate(k*.63,-.05,.13,.07,accent);}
    plate(0,.11,.22,.06,accent);
  }else if(insect){
    for(const side of [-1,1])for(const step of [-1,1]){
      ctx.strokeStyle='#283640';ctx.lineWidth=.085;ctx.beginPath();ctx.moveTo(side*.33,step*.05);ctx.lineTo(side*.65,step*.15+.12+walk*side);ctx.lineTo(side*.75,.37+walk*side);ctx.stroke();
      plate(side*.57,.18, .17,.18,'#586a70');
    }
    fill([[-.54,.09],[-.42,-.32],[-.22,-.45],[.22,-.45],[.42,-.32],[.54,.09],[.32,.38],[-.32,.38]],'#354b55',true);
    plate(0,-.18,.66,.40,'#658188');
    plate(0,.21,.53,.26,'#182631');
    for(const side of [-1,1])plate(side*.13,.25,.16,.07,accent);
    if(e.type==='charger')for(const side of [-1,1])fill([[side*.21,-.27],[side*.34,-.52],[side*.39,-.15]],'#a0a7a3');
  }else{
    const wide=heavy?1.23:1;
    // Actual segmented arms/legs rather than spinning octagon sprites.
    for(const side of [-1,1]){
      const x=side*.28*wide;
      ctx.save();ctx.translate(x,.27);ctx.rotate(side*walk);
      plate(0,.09,.28*wide,.41,'#273744');plate(0,.03,.22*wide,.30,'#68767c');
      plate(side*.04,.31,.31,.18,'#27303a');ctx.restore();
      ctx.save();ctx.translate(side*.42*wide,-.18);ctx.rotate(-walk*side);
      plate(0,.0,.30*wide,.26,'#65727a');plate(0,.20,.19,.36,'#24343e');plate(0,.35,.24,.16,'#53626c');ctx.restore();
    }
    plate(0,.13,.57*wide,.17,'#1a2933');
    fill([[-.36*wide,-.39],[-.48*wide,-.17],[-.33*wide,.18],[.33*wide,.18],[.48*wide,-.17],[.36*wide,-.39]],'#263440',true);
    fill([[-.30*wide,-.39],[-.02,-.29],[-.025,-.01],[-.30*wide,-.04]],'#667982',true);
    fill([[.30*wide,-.39],[.02,-.29],[.025,-.01],[.30*wide,-.04]],'#445560',true);
    plate(0,-.16,.11,.34,'#152633');
    plate(0,-.16,.055,.23,accent);
    plate(0,-.55,.36*wide,.31,'#1b2832');
    fill([[-.20*wide,-.69],[-.21*wide,-.50],[-.12*wide,-.43],[.12*wide,-.43],[.21*wide,-.50],[.20*wide,-.69],[0,-.74]],'#5f717a',true);
    plate(0,-.57,.29,.10,'#0b1420');
    for(const side of [-1,1])plate(side*.087,-.57,.135,.043,accent);
    if(heavy){for(const side of [-1,1])plate(side*.50*wide,-.27,.23,.27,'#78858b')}
    if(e.type==='sniper'){
      ctx.strokeStyle='#bcc8d0';ctx.lineWidth=.045;ctx.beginPath();ctx.moveTo(.28,-.36);ctx.lineTo(.38,-.85);ctx.stroke();
      plate(.38,-.58,.12,.18,'#253541');
    }
    if(e.type==='artillery'||e.boss){for(const side of [-1,1]){plate(side*.55,-.53,.29,.25,'#25333d');plate(side*.55,-.53,.12,.09,accent);}}
  }
  // A damaged power core is visible in the low-end renderer too. It flickers
  // on the body itself rather than leaving a mark on the floor after death.
  if(!insect&&!drone && e.hp<e.maxhp*.47){
    const heat=clamp(1-e.hp/Math.max(1,e.maxhp),0,1);
    ctx.fillStyle='#101218';ctx.fillRect(-.12,-.23,.24,.22);
    ctx.fillStyle=`rgba(255,${Math.round(75+heat*42)},38,${.45+heat*.42})`;
    ctx.beginPath();ctx.moveTo(0,-.21);ctx.lineTo(.085,-.13);ctx.lineTo(0,-.02);ctx.lineTo(-.085,-.13);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#7b8991';ctx.lineWidth=.015;ctx.strokeRect(-.12,-.23,.24,.22);
  }
  // Machining highlights, seam fasteners, and layered armor are baked into
  // the cheap no-WebGL silhouette without additional offscreen textures.
  if(!insect&&!drone){
    ctx.save();
    ctx.strokeStyle='rgba(214,232,237,.28)';ctx.lineWidth=.014;
    for(const side of [-1,1]){
      ctx.beginPath();ctx.moveTo(side*.09,-.34);ctx.lineTo(side*.27,-.38);
      ctx.lineTo(side*.32,-.25);ctx.stroke();
      ctx.strokeStyle='rgba(9,17,24,.65)';ctx.beginPath();
      ctx.moveTo(side*.12,-.06);ctx.lineTo(side*.30,-.06);ctx.stroke();
      ctx.fillStyle='#b3b7b1';
      for(const y of [-.32,-.08,.15]){ctx.beginPath();ctx.arc(side*.285,y,.012,0,TAU);ctx.fill();}
    }
    ctx.strokeStyle='rgba(226,237,241,.15)';
    for(let k=-1;k<=1;k++){
      ctx.beginPath();ctx.moveTo(k*.07,.07);ctx.lineTo(k*.07,.16);ctx.stroke();
    }
    ctx.restore();
  }
  const health=clamp((Number(e.hp)||0)/Math.max(1,Number(e.maxhp)||1),0,1);
  if(health<.57){
    ctx.save();
    ctx.globalAlpha=.28+(1-health)*.27;
    ctx.fillStyle='#0d151d';
    const scuffs=insect?[[-.22,-.19,.21,.09],[.22,.09,.14,.11]]:drone?[[-.29,.0,.22,.12]]:[[-.18,-.26,.18,.15],[.23,.05,.15,.12]];
    for(const [x,y,w,h] of scuffs){
      ctx.beginPath();ctx.moveTo(x-w*.5,y-h*.45);ctx.lineTo(x+w*.45,y-h*.36);
      ctx.lineTo(x+w*.25,y+h*.48);ctx.lineTo(x-w*.36,y+h*.34);ctx.closePath();ctx.fill();
    }
    ctx.strokeStyle='rgba(255,139,75,.44)';ctx.lineWidth=.018;
    ctx.beginPath();ctx.moveTo(-.16,-.28);ctx.lineTo(-.04,-.14);ctx.lineTo(.015,-.18);ctx.stroke();
    ctx.restore();
  }
  const hpFraction=clamp(e.hp/Math.max(1,e.maxhp),0,1);
  if(hpFraction<.72){
    ctx.save();ctx.fillStyle='#172b32';ctx.beginPath();ctx.moveTo(-.27,-.16);ctx.lineTo(-.03,-.29);ctx.lineTo(.22,-.02);ctx.lineTo(.07,.30);ctx.closePath();ctx.fill();
    ctx.strokeStyle='#dd7b42';ctx.lineWidth=.026;ctx.beginPath();ctx.moveTo(-.23,-.22);ctx.lineTo(-.05,-.09);ctx.lineTo(-.13,.09);ctx.stroke();ctx.restore();
  }
  if(hpFraction<.47){
    ctx.fillStyle='rgba(255,129,55,'+(.60+.32*Math.sin(t*12+e.id))+')';ctx.beginPath();ctx.moveTo(0,-.13);ctx.lineTo(.13,.10);ctx.lineTo(-.13,.10);ctx.closePath();ctx.fill();
  }
  if(e.elite||e.boss){
    ctx.strokeStyle=e.boss?'#ffb89b':'#ffb969';ctx.lineWidth=.025;ctx.strokeRect(-.55,-.83,1.1,1.3);
    ctx.strokeStyle='#ffc67b';ctx.lineWidth=.036;ctx.beginPath();ctx.moveTo(-.26,-.77);ctx.lineTo(-.36,-1.06);ctx.moveTo(.26,-.77);ctx.lineTo(.36,-1.06);ctx.stroke();
    ctx.fillStyle='#ffdc89';ctx.fillRect(-.42,-1.09,.12,.055);ctx.fillRect(.3,-1.09,.12,.055);
  }
  ctx.restore();
}

function renderFallback(){if(!fallCtx||!game)return;
// Fast ray-cast renderer for browsers where GPU WebGL is unavailable.
const g=game,actor=g.p,pose=externalCameraEnabled()?operatorCameraPose(actor):null;
 const p=pose?.drawActor?{...actor,x:pose.eye[0],z:pose.eye[2],yaw:Math.atan2(pose.dir[0],pose.dir[2]),pitch:Math.asin(clamp(pose.dir[1],-1,1)),feetY:pose.eye[1]-1.46}:actor;
 document.body.classList.toggle('thirdPersonCameraClose',!!pose&&!pose.drawActor);
 const t=themes[sectorStyle%themes.length],W=glCanvas.width,H=glCanvas.height,C=fallCtx;
if(performance.now()-fBackAt<29)return;fBackAt=performance.now();
const w=W,h=H,FOV=(touchOnly&&h>w?82:74)*Math.PI/180,focal=w/(2*Math.tan(FOV/2)),eyeHeight=1.46+(p.feetY||0),horizon=h*.49+Math.tan(p.pitch)*focal*.62;
// A layered night sky, subtle nebula and horizon beams around the arena.
let sky=C.createLinearGradient(0,0,0,h*.78);
sky.addColorStop(0,'#030513');sky.addColorStop(.39,'#09132b');sky.addColorStop(.8,'#12243b');sky.addColorStop(1,'#081222');
C.fillStyle=sky;C.fillRect(0,0,w,h);
const glowR=Math.round(t.accent[0]*255),glowG=Math.round(t.accent[1]*255),glowB=Math.round(t.accent[2]*255);
// Distant illuminated atmosphere: a few inexpensive broad gradients.
let nebula=C.createRadialGradient(w*.57,h*.15,1,w*.57,h*.15,w*.58);
nebula.addColorStop(0,`rgba(${glowR},${glowG},${glowB},.09)`);
nebula.addColorStop(1,`rgba(${glowR},${glowG},${glowB},0)`);
C.fillStyle=nebula;C.fillRect(0,0,w,Math.max(0,horizon));
// Perspective-projected overhead metal gratings and translucent skylights.
// Realistic ceiling parallax even on browsers without GPU WebGL.
const roofStepX=Math.max(5,Math.floor(w/155)),roofStepY=Math.max(3,Math.floor(h/170));
for(let sy=0;sy<Math.min(h,Math.ceil(horizon)-3);sy+=roofStepY){
 let distanceToRoof=(ceilingHeight()+.03-eyeHeight)*focal/Math.max(2,horizon-sy);
 if(distanceToRoof>32)continue;
 for(let sx=0;sx<w;sx+=roofStepX){
  const side=(sx-w*.5)/focal;
  const wx=p.x+Math.sin(p.yaw)*distanceToRoof-Math.cos(p.yaw)*side*distanceToRoof;
  const wz=p.z+Math.cos(p.yaw)*distanceToRoof+Math.sin(p.yaw)*side*distanceToRoof;
  let ix=Math.floor(wx),iz=Math.floor(wz);if(isWall(wx,wz))continue;
  let adj=0;for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])if(!isWall(ix+dx+.5,iz+dz+.5))adj++;
  if(adj>2&&(ix+iz+sectorStyle)%4===0)continue;
  const u=wx-ix,v=wz-iz,edge=u<.08||v<.08||u>.92||v>.92;
  const cloud=(ix*19+iz*31)%11;
  let fade=clamp(1-distanceToRoof/34,.03,.88);
  let base=cloud<3?28:40;
  C.fillStyle=`rgba(${base},${base+16},${base+22},${fade*(edge?.71:.55)})`;
  C.fillRect(sx,sy,roofStepX+1,roofStepY+1);
  if((ix*5+iz*7)%11===0&&(u>.25&&u<.75)&&v>.35&&v<.65){
   C.fillStyle=`rgba(${glowR},${glowG},${glowB},${fade*.50})`;
   C.fillRect(sx,sy,roofStepX+1,roofStepY+1);
  }
 }
}
const flicker=g.t*.85;
for(let j=0;j<48;j++){
 let xx=((j*131+41)%997)/997*w,yy=((j*89+73)%701)/701*Math.max(0,horizon*.92);
 if(yy<0||yy>horizon)continue;
 C.fillStyle=`rgba(159,231,255,${.09+.11*(.5+.5*Math.sin(flicker+j*4.8))})`;
 C.fillRect(xx,yy,1.1,1.1);
}
let floor=C.createLinearGradient(0,horizon,0,h);
floor.addColorStop(0,'#122638');floor.addColorStop(.52,'#07121e');floor.addColorStop(1,'#020610');
C.fillStyle=floor;C.fillRect(0,Math.max(0,horizon),w,h-Math.max(0,horizon));
// Perspective floor with illuminated panel edges, metal seams and reactor tiles.
let floorStart=Math.max(0,Math.ceil(horizon)+3),stepX=Math.max(6,Math.round(w/158)),stepY=Math.max(3,Math.round(h/190));
for(let sy=floorStart;sy<h;sy+=stepY){
 let dist=eyeHeight*focal/Math.max(2,sy-horizon);if(dist>29)continue;
 let strength=clamp(.29-dist*.010,.018,.22);
 for(let sx=0;sx<w;sx+=stepX){
  let side=(sx-w*.5)/focal;
  let fx=p.x+Math.sin(p.yaw)*dist-Math.cos(p.yaw)*side*dist;
  let fz=p.z+Math.cos(p.yaw)*dist+Math.sin(p.yaw)*side*dist;
  let tx=Math.floor(fx),tz=Math.floor(fz),nx=fx-tx,nz=fz-tz;
  if(isWall(fx,fz))continue;
  let grid=nx<.055||nz<.055||nx>.945||nz>.945;const elevated=floorHeightAtCell(tx,tz);if(elevated>.01){C.fillStyle='rgba(157,200,210,'+Math.min(.22,.06+elevated*.12)+')';C.fillRect(sx,sy,stepX,stepY);if(grid){C.fillStyle='rgba(243,184,98,.23)';C.fillRect(sx,sy,stepX,stepY);}}
  if(grid){
   C.fillStyle=`rgba(${glowR},${glowG},${glowB},${strength})`;
   C.fillRect(sx,sy,stepX,stepY);
  }else if((tx*19+tz*29)%13===0&&nx>.26&&nx<.76&&nz>.27&&nz<.72){
   C.fillStyle=`rgba(${glowR},${glowG},${glowB},${strength*.52})`;
   C.fillRect(sx,sy,stepX,stepY);
  }else if((sectorStyle===1||sectorStyle===3)&&(tx*7+tz*11)%9===0&&(nx<.24||nz<.24)){
   C.fillStyle=`rgba(${glowR},${glowG},${glowB},${strength*.66})`;C.fillRect(sx,sy,stepX,stepY);
  }else if((tx+tz)%7===0&&(nx<.13||nz<.13)){
   C.fillStyle='rgba(112,158,178,.085)';C.fillRect(sx,sy,stepX,stepY);
  }else{
    const steel=((tx*13+tz*31)%9)/9;
    const patch=(nx>.12&&nx<.88&&nz>.12&&nz<.88);
    C.fillStyle=`rgba(${42+Math.round(steel*13)},${53+Math.round(steel*19)},${64+Math.round(steel*18)},${patch?clamp(.17-dist*.005,0,.12):.035})`;
    C.fillRect(sx,sy,stepX,stepY);
  }
 }
}
let zbuffer=[],strip=Math.max(2,Math.floor(w/(save.settings.quality===0?260:360)));
for(let sx=0;sx<w;sx+=strip){
 const angle=p.yaw-Math.atan((sx+strip/2-w/2)/focal),dx=Math.sin(angle),dz=Math.cos(angle);
 const mx0=Math.floor(p.x),mz0=Math.floor(p.z);let ix=mx0,iz=mz0;
 let deltaX=Math.abs(1/(dx||1e-8)),deltaZ=Math.abs(1/(dz||1e-8));
 let stepGX=dx<0?-1:1,stepGZ=dz<0?-1:1;
 let sdx=(dx<0?p.x-mx0:mx0+1-p.x)*deltaX,sdz=(dz<0?p.z-mz0:mz0+1-p.z)*deltaZ;
 let hitSide=0,d=0;
 for(let i=0;i<Math.ceil(mapSize*1.5);i++){
  if(sdx<sdz){ix+=stepGX;d=sdx;sdx+=deltaX;hitSide=1}
  else{iz+=stepGZ;d=sdz;sdz+=deltaZ;hitSide=0}
  if(isWall(ix+.01,iz+.01))break;
 }
 d=Math.max(.09,d*Math.cos(angle-p.yaw));for(let j=sx;j<Math.min(w,sx+strip);j++)zbuffer[j]=d;
 let wallBottom=horizon+eyeHeight*focal/d, wallTop=horizon-(ceilingHeight()-eyeHeight)*focal/d;
 let light=clamp(1.10-d/37,.18,1.06)*(hitSide?.77:1);
 let r=Math.round(t.wall[0]*255*light),gg=Math.round(t.wall[1]*255*light),b=Math.round(t.wall[2]*255*light);
 let fx=p.x+dx*(d/Math.max(.01,Math.cos(angle-p.yaw))),fz=p.z+dz*(d/Math.max(.01,Math.cos(angle-p.yaw)));
 let coord=(hitSide?fz:fx)%1;if(coord<0)coord++;
 const variant=(ix*31+iz*19)%7===0?1:0;
 const img=wallTexture(sectorStyle%themes.length,variant);
 C.drawImage(img,Math.min(319,Math.max(0,Math.floor(coord*319))),0,1,512,sx,wallTop,strip+1,wallBottom-wallTop);
 const darkness=clamp(.24+d/48+(hitSide?.14:0),.17,.80);
 C.fillStyle=`rgba(1,7,14,${darkness})`;
 C.fillRect(sx,wallTop,strip+1,wallBottom-wallTop);
 const diffuse=clamp(.32-d*.009,0,.25);
 if(diffuse>0){C.fillStyle=`rgba(${glowR},${glowG},${glowB},${diffuse*.23})`;C.fillRect(sx,wallTop+Math.max(0,(wallBottom-wallTop)*.12),strip+1,(wallBottom-wallTop)*.59);}
 // Every tile has metallic side ribs, a recessed center and a faint panel inset.
 let edge=coord<.12||coord>.88;
 // Procedural stamped alloy plates: repeating welds, brushed scratches, inset hardware.
 let wallH=wallBottom-wallTop;
 for(let i=1;i<=5;i++){
   let lineY=wallTop+wallH*i/6;
   C.fillStyle=`rgba(2,7,16,${clamp(.44-d*.008,.08,.39)})`;
   C.fillRect(sx,lineY,strip+1,Math.max(.6,2*focal/(d*260)));
   C.fillStyle=`rgba(181,211,220,${clamp(.18-d*.006,.02,.15)})`;
   C.fillRect(sx,lineY+Math.max(.7,1*focal/(d*270)),strip+1,Math.max(.5,.5*focal/(d*260)));
 }
 if((ix*17+iz*11)%3===0&&coord>.21&&coord<.78){
  let scuff=(ix*19+iz*13)%5;
  C.fillStyle=`rgba(153,169,171,${clamp(.14-d*.002,0,.13)})`;
  C.fillRect(sx,wallTop+wallH*(.32+scuff*.08),strip+1,Math.max(.6,wallH*.028));
 }

 if(edge){C.fillStyle=`rgba(3,8,19,${clamp(.89-d*.011,.44,.82)})`;C.fillRect(sx,wallTop,strip+1,wallBottom-wallTop)}
 else if(coord<.18||coord>.82){C.fillStyle=`rgba(155,207,236,${clamp(.18-d*.004,.03,.13)})`;C.fillRect(sx,wallTop,strip+1,wallBottom-wallTop)}
 else if((ix*11+iz*17)%4===0){C.fillStyle='rgba(2,5,16,.17)';C.fillRect(sx,wallTop+Math.max(1,12*focal/(d*400)),strip+1,Math.max(1,(wallBottom-wallTop)*.86));}
 let upper=horizon-(3.20-eyeHeight)*focal/d;
 let lower=horizon-(.32-eyeHeight)*focal/d;
 C.fillStyle='rgba(1,4,10,.38)';C.fillRect(sx,wallTop,strip+1,Math.max(1,9*focal/(d*180)));
 C.fillStyle=`rgba(${glowR},${glowG},${glowB},${clamp(.87-d/39,.10,.64)})`;
 C.fillRect(sx,upper,strip+1,Math.max(1.4,5*focal/(d*500)));
 C.fillStyle=`rgba(10,14,26,${clamp(.95-d*.008,.4,.83)})`;
 C.fillRect(sx,lower,strip+1,Math.max(1,(wallBottom-wallTop)*.022));
 if((ix*3+iz*5)%5===0&&coord>.39&&coord<.60){
  let y1=horizon-(2.62-eyeHeight)*focal/d,y2=horizon-(.85-eyeHeight)*focal/d;
  C.fillStyle=`rgba(${glowR},${glowG},${glowB},${clamp(1-d/37,.15,.75)})`;
  C.fillRect(sx,y1,strip+1,y2-y1);
  C.fillStyle='#d8faff9c';C.fillRect(sx,y1,strip+1,Math.max(1,(y2-y1)*.035));
 }
  // Large theme-dependent side murals instead of identical corridors.
  if((sectorStyle===1||sectorStyle===3)&&(ix*5+iz*3)%8===0&&coord>.19&&coord<.82){
    let y1=horizon-(2.9-eyeHeight)*focal/d;
    C.fillStyle=`rgba(${glowR},${glowG},${glowB},${clamp(.74-d/46,.10,.64)})`;
    C.fillRect(sx,y1,strip+1,Math.max(1,7*focal/(d*190)));
  }else if((sectorStyle===2||sectorStyle===4)&&(ix*5+iz*3)%8===0&&coord>.38&&coord<.6){
    let y1=horizon-(2.75-eyeHeight)*focal/d,y2=horizon-(.75-eyeHeight)*focal/d;
    C.fillStyle=`rgba(${glowR},${glowG},${glowB},${clamp(.9-d/40,.08,.56)})`;
    C.fillRect(sx,y1,strip+1,Math.max(1,y2-y1));
  }
  if((ix+iz)%7===0&&coord>.24&&coord<.71){
  let y1=horizon-(1.7-eyeHeight)*focal/d;
  C.fillStyle='rgba(6,12,27,.63)';C.fillRect(sx,y1,strip+1,Math.max(1,(wallBottom-wallTop)*.085));
  if((ix+iz)%14===0){C.fillStyle=`rgba(${glowR},${glowG},${glowB},.3)`;C.fillRect(sx,y1,strip+1,Math.max(1,2*focal/(d*460)));}
 }
}
// Marks are painted in screen-space over the actual raycast wall column.
// Depth checks prevent floating or appearing through a nearer wall.
function proj(p3){
 const dx=p3.x-p.x,dz=p3.z-p.z;
 const f=dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw),r=-dx*Math.cos(p.yaw)+dz*Math.sin(p.yaw);
 if(f<=.05)return null;
 const sx=w/2+r/f*focal,sy=horizon-(p3.y-eyeHeight)*focal/f;
 if(sx< -25||sx>w+25||sy< -30||sy>h+30)return null;
 return{x:sx,y:sy,d:f};
}
// Low-cost perspective representation of the suspended catwalk in the
// software renderer. Ground passage remains visible underneath it.
if(bridgeSpecs.length){
 const c=Math.floor(mapSize/2), half=sectorStyle===15?7:5,polys=[];
 const above=(p.feetY||0)>BRIDGE_Y-.28;
 for(let zz=c-half;zz<=c+half;zz++)for(let xx=c-3;xx<=c+3;xx++){
  if(deckAtCell(xx,zz)<=0||hypot(xx+.5-p.x,zz+.5-p.z)>22)continue;
  const level=above?BRIDGE_Y+.01:BRIDGE_Y-.17;
  const pts=[proj({x:xx,y:level,z:zz}),proj({x:xx+1,y:level,z:zz}),proj({x:xx+1,y:level,z:zz+1}),proj({x:xx,y:level,z:zz+1})];
  if(pts.some(q=>!q))continue;
  const dist=hypot(xx+.5-p.x,zz+.5-p.z);
  polys.push({dist,pts,x:xx,z:zz,above});
 }
 // Higher maintenance platforms use the same filled perspective polygons;
 // they must not be invisible just because WebGL is unavailable.
 for(const sky of skyDeckSpecs)for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
  const xx=Math.floor(sky.x)+dx,zz=Math.floor(sky.z)+dz;
  if(deckAtCell(xx,zz)<sky.y-.01)continue;
  const dist=hypot(xx+.5-p.x,zz+.5-p.z);if(dist>26)continue;
  const aboveSky=(p.feetY||0)>=sky.y-.28;
  const altitude=sky.y+(aboveSky?.01:-.17);
  const pts=[proj({x:xx,y:altitude,z:zz}),proj({x:xx+1,y:altitude,z:zz}),proj({x:xx+1,y:altitude,z:zz+1}),proj({x:xx,y:altitude,z:zz+1})];
  if(pts.some(q=>!q))continue;
  polys.push({dist,pts,x:xx,z:zz,above:aboveSky});
 }
 polys.sort((a,b)=>b.dist-a.dist);
 for(const tile of polys){
  const q=tile.pts;
  C.fillStyle=tile.above?'rgba(126,155,162,.94)':'rgba(53,72,84,.96)';
  C.strokeStyle=tile.above?'rgba(162,235,240,.42)':'rgba(58,125,135,.5)';
  C.lineWidth=Math.max(1,Math.min(2.7,15/(tile.dist+3)));
  C.beginPath();C.moveTo(q[0].x,q[0].y);
  for(let j=1;j<4;j++)C.lineTo(q[j].x,q[j].y);
  C.closePath();C.fill();C.stroke();
 }
 if(above){
  for(const side of [-1,1])for(let iz=c-half;iz<=c+half;iz+=2){
   const z=iz+.5, x=c+(side<0?-3:4);
   const a=proj({x,y:BRIDGE_Y,z}),b=proj({x,y:BRIDGE_Y+.65,z});
   if(a&&b){C.strokeStyle='rgba(178,225,226,.65)';C.lineWidth=2.0;C.beginPath();C.moveTo(a.x,a.y);C.lineTo(b.x,b.y);C.stroke();}
  }
 }
}
for(const d of (g.decals||[])){
 const q=proj(d);if(!q)continue;
 const wallDist=zbuffer[clamp(q.x|0,0,w-1)]||Infinity;
 if(q.d>wallDist+.16)continue;
 const r=Math.max(1,Math.min(28,d.r*focal/q.d)),alpha=clamp(d.life/Math.min(5,d.maxLife),0,1);
 C.save();C.globalAlpha=alpha*.95;C.translate(q.x,q.y);
 C.rotate(d.rot);C.fillStyle=d.energy?'#4b2a1e':'#080c10';
 C.beginPath();C.ellipse(0,0,r*(d.nx?.75:1),r*(d.ny?.5:1),0,0,TAU);C.fill();
 C.fillStyle='#020609';C.beginPath();C.ellipse(0,0,r*.55,r*.47,0,0,TAU);C.fill();
 if(d.energy){C.strokeStyle=`rgb(${d.col.map(c=>Math.round(c*255)).join(',')})`;C.lineWidth=1.35;C.globalAlpha=alpha*.38;C.beginPath();C.arc(0,0,r*1.25,0,TAU);C.stroke()}
 C.restore();
}
for(const tr of (g.tracers||[])){
 const a=proj(tr.a),b=proj(tr.b);if(!a||!b)continue;
 C.save();let fade=clamp(tr.life/tr.maxLife,0,1);
 C.shadowColor=`rgb(${tr.col.map(c=>Math.round(c*255)).join(',')})`;
 // Soft colored halo plus a thin white-hot core, like the tapered WebGL beam.
 C.globalAlpha=.32*fade;C.shadowBlur=16;C.strokeStyle=C.shadowColor;
 C.lineWidth=3+tr.r*45;C.beginPath();C.moveTo(a.x,a.y);C.lineTo(b.x,b.y);C.stroke();
 C.globalAlpha=.86*fade;C.shadowBlur=4;C.strokeStyle='#effcff';C.lineWidth=1+tr.r*9;
 C.beginPath();C.moveTo(a.x,a.y);C.lineTo(b.x,b.y);C.stroke();C.restore();
}
for(const b of (g.projectiles||[])){
 const q=proj(b);if(!q||q.d>(zbuffer[clamp(q.x|0,0,w-1)]||Infinity)+.12)continue;
 let rr=clamp(b.rad*focal/q.d,2,22);C.save();C.shadowBlur=22;C.shadowColor=`rgb(${b.w.color.map(c=>Math.round(c*255)).join(',')})`;
 C.fillStyle='#f4ffff';C.beginPath();C.arc(q.x,q.y,rr,0,TAU);C.fill();C.restore();
}
for(const f of (g.impactFx||[])){
 const q=proj(f);if(!q)continue;
 const fade=clamp(f.life/f.maxLife,0,1),r=clamp(f.r*focal/q.d*(1.4-fade*.4),1,95);
 C.save();C.globalAlpha=.6*fade;C.strokeStyle=`rgb(${f.col.map(c=>Math.round(c*255)).join(',')})`;C.shadowColor=C.strokeStyle;C.shadowBlur=17;C.lineWidth=2;
 C.beginPath();C.arc(q.x,q.y,r,0,TAU);C.stroke();C.restore();
}
for(const e of g.enemies)if(!e.dead&&e.telegraph>0&&e.lockTarget){
 const a=proj({x:e.x,y:1.1,z:e.z}),b=proj({x:e.lockTarget.x,y:.13,z:e.lockTarget.z});
 if(a&&b){C.save();C.strokeStyle='#ff477b';C.shadowBlur=18;C.shadowColor='#ff235d';C.globalAlpha=.62+.28*Math.sin(g.t*21);C.lineWidth=2.1;C.beginPath();C.moveTo(a.x,a.y);C.lineTo(b.x,b.y);C.stroke();C.beginPath();C.arc(b.x,b.y,Math.min(24,10*focal/b.d),0,TAU);C.stroke();C.restore();}
 }
// Third boss phase: explicit ground-wave warning in the software renderer.
for(const e of g.enemies)if(!e.dead&&e.boss&&e.ultWarn>0){
 const q=proj({x:e.x,y:.065+(e.feetY||0),z:e.z});
 if(!q)continue;
 const r=clamp(5.15*focal/q.d,8,Math.min(w,h)*1.7);
 const alpha=.44+.32*Math.sin(g.t*14);
 C.save();C.globalAlpha=alpha;C.strokeStyle='#ff9b4d';
 C.shadowBlur=18;C.shadowColor='#ff5928';C.lineWidth=2.7;
 C.beginPath();C.ellipse(q.x,q.y,r,Math.max(4,r*.30),0,0,TAU);C.stroke();
 C.setLineDash([8,7]);C.beginPath();C.ellipse(q.x,q.y,r*.62,Math.max(3,r*.19),0,0,TAU);C.stroke();C.restore();
}
const items=[];for(const sh of (g.robotDebris||[]))if(sh.life>.1)items.push({type:'robotShard',obj:sh,x:sh.x,z:sh.z,y:sh.y,size:sh.size*1.6,dy:0});for(const f of mapFeatures)items.push({type:'beacon',obj:f,x:f.x,z:f.z,y:f.kind===3?3.6:2.9,size:f.kind===3?1.15:.68,dy:0});for(const e of g.enemies){if(!e.dead)items.push({type:'enemy',obj:e,x:e.x,z:e.z,y:1.18+(Number.isFinite(e.feetY)?e.feetY:floorHeight(e.x,e.z)),size:e.radius*2.5,dy:0})}
for(const c of (g.mission?.caches||[]))if(!c.got)items.push({type:'archive',obj:c,x:c.x,z:c.z,y:.80+floorHeight(c.x,c.z),size:.9,dy:0});for(const d of (g.devices||[]))items.push({type:'device',obj:d,x:d.x,z:d.z,y:.91+floorHeight(d.x,d.z),size:1.05,dy:0});for(const n of g.nodes)if(!n.dead)items.push({type:'node',obj:n,x:n.x,z:n.z,y:1.3+floorHeight(n.x,n.z),size:1.75,dy:0});for(const b of g.bullets)items.push({type:'bullet',obj:b,x:b.x,z:b.z,y:b.y,size:b.radius*2,dy:0});for(const l of g.loot)items.push({type:'loot',obj:l,x:l.x,z:l.z,y:.5+floorHeight(l.x,l.z)+Math.sin(g.t*5+l.x)*.15,size:.55,dy:0});if(g.portalReady)items.push({type:'portal',obj:portal,x:portal.x,z:portal.z,y:1.45+floorHeight(portal.x,portal.z),size:2.6,dy:0});
for(const a of g.particles)items.push({type:'particle',obj:a,x:a.x,z:a.z,y:a.y,size:.1,dy:0});
 if(pose?.drawActor)items.push({type:'operator',obj:actor,x:actor.x,z:actor.z,y:1.01+(actor.feetY||0),size:1.72,dy:0});
items.sort((a,b)=>hypot(b.x-p.x,b.z-p.z)-hypot(a.x-p.x,a.z-p.z));
for(const item of items){const dx=item.x-p.x,dz=item.z-p.z,forward=dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw),right=-dx*Math.cos(p.yaw)+dz*Math.sin(p.yaw);if(forward<=.13)continue;let x=w/2+right/forward*focal;if(x< -w*.4||x>w*1.4)continue;const spriteW=item.size*focal/forward,cx=Math.round(x),depth=zbuffer[clamp(cx|0,0,w-1)]||100;if(forward>depth+.17)continue;const y=horizon-(item.y-eyeHeight)*focal/forward,sz=clamp(spriteW,2,w*4),ob=item.obj;
C.save();C.translate(x,y);let shadow='rgba(30,244,255,.7)',core='#88ffff';if(item.type==='beacon'){
 C.rotate(g.t*.42+ob.phase);C.shadowColor=`rgba(${glowR},${glowG},${glowB},.8)`;
 C.shadowBlur=Math.min(28,sz*.45);C.strokeStyle=`rgba(${glowR},${glowG},${glowB},.8)`;
 C.lineWidth=Math.max(1,sz*.035);C.strokeRect(-sz*.33,-sz*.33,sz*.66,sz*.66);
 C.rotate(-g.t*1.1);C.strokeRect(-sz*.22,-sz*.22,sz*.44,sz*.44);
 C.fillStyle='#d6feff';C.fillRect(-sz*.045,-sz*.045,sz*.09,sz*.09);
 }else if(item.type==='device'){
   const color=deviceColor(ob),rgb=color.map(v=>Math.round(v*255)).join(','),alpha=ob.used?.24:1;
   C.globalAlpha=alpha;C.shadowColor=`rgb(${rgb})`;C.shadowBlur=ob.used?1:18;
   C.fillStyle='#1b2c38';C.strokeStyle=`rgb(${rgb})`;C.lineWidth=Math.max(1,sz*.055);
   C.fillRect(-sz*.30,-sz*.42,sz*.60,sz*.84);C.strokeRect(-sz*.30,-sz*.42,sz*.60,sz*.84);
   C.fillStyle=`rgb(${rgb})`;C.fillRect(-sz*.12,-sz*.12,sz*.24,sz*.24);
   if(ob.kind==='coil'&&!ob.used){C.strokeStyle=ob.active?'#ff482c':'#e9a742';C.beginPath();C.arc(0,0,sz*.53,0,TAU);C.stroke();}
  }else if(item.type==='archive'){C.rotate(g.t*.75);C.shadowColor='#60eeff';C.shadowBlur=18;C.strokeStyle='#81efff';C.lineWidth=Math.max(2,sz*.06);C.strokeRect(-sz*.34,-sz*.34,sz*.68,sz*.68);C.rotate(-g.t*1.4);C.fillStyle='#d6ffff';C.fillRect(-sz*.13,-sz*.13,sz*.26,sz*.26);}else if(item.type==='node'){const ty=NODE_TYPES[ob.type],color=ty.color,Cc=`rgb(${color.map(x=>Math.round(x*255)).join(',')})`;C.rotate(g.t*.53+ob.phase);C.shadowColor=Cc;C.shadowBlur=Math.min(45,sz*.35);C.strokeStyle=Cc;C.lineWidth=Math.max(2,sz*.065);C.strokeRect(-sz*.33,-sz*.33,sz*.66,sz*.66);C.rotate(g.t*.65);C.beginPath();C.arc(0,0,sz*.25,0,TAU);C.stroke();C.fillStyle=ob.flash>0?'white':Cc;C.fillRect(-sz*.11,-sz*.11,sz*.22,sz*.22); }else if(item.type==='robotShard'){
 C.rotate(ob.rx);C.globalAlpha=clamp(ob.life/.5,0,1);C.fillStyle=`rgb(${ob.color.map(v=>Math.round(clamp(v,0,1)*255)).join(',')})`;
 C.strokeStyle='#27323c';C.lineWidth=Math.max(1,sz*.11);
 C.beginPath();C.moveTo(0,-sz*.5);C.lineTo(sz*.5,sz*.32);C.lineTo(-sz*.42,sz*.36);C.closePath();C.fill();C.stroke();
}else if(item.type==='enemy'){drawFallbackRobot(C,ob,sz,g.t);}
 else if(item.type==='operator'){drawFallbackOperator(C,ob,sz);}
else if(item.type==='portal'){C.shadowColor='#63eeff';C.shadowBlur=30;C.strokeStyle='#74eeff';C.lineWidth=Math.max(3,sz*.042);C.rotate(g.t*.75);C.strokeRect(-sz*.3,-sz*.43,sz*.6,sz*.86);C.rotate(-g.t*1.5);C.beginPath();C.ellipse(0,0,sz*.43,sz*.48,.2,0,TAU);C.stroke();C.fillStyle='#45dfff55';C.fillRect(-sz*.13,-sz*.26,sz*.26,sz*.52)}else if(item.type==='bullet'||item.type==='particle'){let rgb=(ob.col||[.6,1,1]).map(c=>Math.round(c*255));C.shadowColor=`rgb(${rgb.join(',')})`;C.shadowBlur=Math.max(10,sz);C.fillStyle=C.shadowColor;C.beginPath();C.arc(0,0,Math.max(2,sz*.45),0,TAU);C.fill()}else{C.shadowColor='#6feaff';C.shadowBlur=15;C.rotate(g.t*2);C.fillStyle=ob.type==='heal'?'#ff638c':ob.type==='energy'?'#67edff':'#ffc976';C.beginPath();C.moveTo(0,-sz*.5);C.lineTo(sz*.32,0);C.lineTo(0,sz*.5);C.lineTo(-sz*.32,0);C.closePath();C.fill()}C.restore()}
}
