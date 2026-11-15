
// Atmospheric sci-fi hangar vista behind all menus, generated inside the HTML.
const dcMenuCanvas=document.createElement('canvas');dcMenuCanvas.id='dcMenuScene';
dcMenuCanvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:.72';
const dcOverlay=$('overlay');dcOverlay.insertBefore(dcMenuCanvas,dcOverlay.firstChild);
const dcMenuCtx=dcMenuCanvas.getContext('2d',{alpha:false});let dcSceneW=0,dcSceneH=0,dcSceneDirty=true;
function dcMenuResize(){
 const dpr=Math.min(1.25,devicePixelRatio||1);dcSceneW=innerWidth;dcSceneH=innerHeight;
 dcMenuCanvas.width=Math.max(1,Math.round(dcSceneW*dpr));dcMenuCanvas.height=Math.max(1,Math.round(dcSceneH*dpr));dcMenuCtx.setTransform(dpr,0,0,dpr,0,0);
 dcSceneDirty=true;requestAnimationFrame(dcDrawMenu);
}
addEventListener('resize',dcMenuResize);dcMenuResize();
function dcDrawMenu(now){
 if(dcOverlay.classList.contains('hidden')||!dcSceneDirty)return;
 dcSceneDirty=false;
 const ctx=dcMenuCtx,w=dcSceneW,h=dcSceneH,vx=w*.5,vy=h*.42,t=now*.00012;
 const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#04101a');sky.addColorStop(.5,'#0a242a');sky.addColorStop(1,'#030b11');
 ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 const glow=ctx.createRadialGradient(vx,vy,1,vx,vy,w*.44);glow.addColorStop(0,'rgba(71,217,185,.18)');glow.addColorStop(.4,'rgba(22,88,94,.08)');glow.addColorStop(1,'rgba(12,32,40,0)');
 ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
 ctx.save();ctx.translate(vx,vy);ctx.rotate(t*.3);
 for(const radius of [54,81,117]){ctx.strokeStyle='rgba(122,231,206,'+(radius===81?.28:.11)+')';ctx.lineWidth=radius===81?3:1.2;ctx.beginPath();ctx.arc(0,0,radius,0,TAU);ctx.stroke();}
 for(let k=0;k<20;k++){const a=k*TAU/20,rad=117;ctx.beginPath();ctx.moveTo(rad*.87*Math.cos(a),rad*.87*Math.sin(a));ctx.lineTo(rad*1.12*Math.cos(a),rad*1.12*Math.sin(a));ctx.strokeStyle=k%2?'rgba(226,172,109,.17)':'rgba(124,224,202,.27)';ctx.stroke();}
 ctx.restore();
 // Deep industrial tunnel: perspective rails, vertical struts and ceiling ribs.
 for(const side of [-1,1]){
   ctx.strokeStyle='rgba(106,196,192,.11)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(vx,vy);ctx.lineTo(vx+side*w*.78,h);ctx.stroke();
   for(let i=0;i<11;i++){
     const z=(i+.8)/11,scale=Math.pow(z,1.65),x=vx+side*(55+scale*w*.59),top=vy-scale*h*.43,bot=vy+scale*h*.64;
     ctx.fillStyle='rgba(5,14,19,'+(.31+.32*scale)+')';
     ctx.beginPath();ctx.moveTo(x-side*18*scale,bot);ctx.lineTo(x+side*19*scale,bot);ctx.lineTo(x+side*9*scale,top);ctx.lineTo(x-side*11*scale,top);ctx.closePath();ctx.fill();
     ctx.strokeStyle='rgba(114,204,191,'+(.10+.14*scale)+')';ctx.lineWidth=1+2*scale;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bot);ctx.stroke();
   }
 }
 for(let i=1;i<9;i++){
   let y=vy+Math.pow(i/9,1.55)*(h-vy);
   ctx.strokeStyle='rgba(132,195,186,'+(.045+.095*i/9)+')';ctx.lineWidth=1+i/7;
   ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();
 }
 for(let i=0;i<50;i++){
   const x=(i*103.7 + now*.004*(i%3+1))%w,y=(i*83.5 + 16*Math.sin(t*9+i)+h*.24)%h;
   ctx.fillStyle='rgba(160,229,206,'+(.03+.05*(.5+.5*Math.sin(t*19+i)))+')';ctx.fillRect(x,y,1.3,1.3);
 }
 let vg=ctx.createLinearGradient(0,0,w,0);vg.addColorStop(0,'rgba(1,8,13,.82)');vg.addColorStop(.3,'rgba(1,8,13,.12)');vg.addColorStop(.7,'rgba(1,8,13,.12)');vg.addColorStop(1,'rgba(1,8,13,.82)');ctx.fillStyle=vg;ctx.fillRect(0,0,w,h);
}
// Pause/map/login screens use a single static backdrop. Repeated 2D canvas
// compositing on a 120-Hz monitor wasted GPU power even without gameplay.
new MutationObserver(()=>{if(!dcOverlay.classList.contains('hidden')){dcSceneDirty=true;requestAnimationFrame(dcDrawMenu);}})
 .observe(dcOverlay,{attributes:true,attributeFilter:['class']});
requestAnimationFrame(dcDrawMenu);

const dcMenuBase=menu;
menu=function(){
  dc.splashUntil=0;$('missionSplash')?.classList.remove('visible');
  dcMenuBase();
  const panel=$('panel');if(!panel)return;
  const element=document.createElement('section');element.className='dcMissionCard';
  const level=save.campaign.highestUnlocked,info=missionInfo(level);
  element.style.cssText='display:flex;gap:13px;align-items:center;justify-content:space-between;border:1px solid #8dbdb565;border-left:3px solid #eac18b;border-radius:7px;background:linear-gradient(105deg,#263c3bcc,#0b202ab9);padding:12px 15px;margin:13px 0;';
  element.innerHTML='<div><small style="display:block;color:#eac18b;font-size:10px;letter-spacing:.18em;font-weight:850">СЛЕДУЮЩАЯ ОПЕРАЦИЯ · '+String(level).padStart(2,'0')+'</small><strong style="display:block;color:#eef4ed;font-size:15px;margin-top:3px">'+stageName(level)+'</strong><span style="display:block;color:#a7c7c4;font-size:11px;margin-top:3px">'+info.name+' · '+info.hint+'</span></div><div style="color:#f4cf9a;font-size:23px">'+info.icon+'</div>';
  const stats=panel.querySelector('.quickstats');
  if(stats)stats.insertAdjacentElement('beforebegin',element);
};

let adaptiveScale=1,performanceSlow=0,performanceFast=0;function resize(){let dpr=glReady?Math.min(devicePixelRatio||1,save.settings.quality===0?(touchOnly?1.0:1.2):save.settings.quality===1?(touchOnly?1.18:1.65):(touchOnly?1.30:1.8)):Math.min(devicePixelRatio||1,1.2);dpr*=adaptiveScale;const w=Math.round(innerWidth*dpr),h=Math.round(innerHeight*dpr);if(glCanvas.width!==w||glCanvas.height!==h){glCanvas.width=w;glCanvas.height=h;glCanvas.style.width=innerWidth+'px';glCanvas.style.height=innerHeight+'px';if(glReady)gl.viewport(0,0,w,h)}}addEventListener('resize',resize);
