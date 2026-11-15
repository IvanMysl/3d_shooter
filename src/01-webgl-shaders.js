

const glCanvas=$('gl'),gl=glCanvas.getContext('webgl',{alpha:false,antialias:true,depth:true,stencil:false,powerPreference:'high-performance',premultipliedAlpha:false});if(gl)document.body.classList.add('webgl');let worldMesh=null, worldChunks=[], meshStats={chunks:0,triangles:0}, glReady=!!gl, fallCtx=null;const floorCanvas=document.createElement('canvas'),floorCtx=floorCanvas.getContext('2d');let fBackAt=0;const touchOnly=matchMedia('(hover:none), (pointer:coarse)').matches;const mm=$('minimap').getContext('2d');let legacyResumeSector=-1;let legacyResumeDivisor=12;let mapCells=[], mapSize=55,spawnX=27.5,spawnZ=27.5,portal={x:27.5,z:27.5},mapFeatures=[],mapRooms=[],sectorArchitecture="ЦИТАДЕЛЬ",sectorStyle=0,miniZoom=true,navField=null,navClock=0,portalRouteField=null;const themes=[{name:'ПРОМЫШЛЕННЫЕ РУИНЫ',wall:[.37,.43,.48],accent:[.14,.8,1],floor:[.29,.33,.36],fog:[.018,.029,.045]},{name:'АЛЫЙ РЕАКТОР',wall:[.42,.37,.40],accent:[1,.27,.35],floor:[.30,.27,.29],fog:[.053,.021,.032]},{name:'ЛЕДЯНОЙ УЗЕЛ',wall:[.38,.44,.47],accent:[.35,.82,1],floor:[.30,.35,.39],fog:[.024,.038,.048]},{name:'ТОКСИЧНЫЙ САД',wall:[.40,.43,.36],accent:[.55,.96,.36],floor:[.29,.33,.28],fog:[.031,.046,.031]},{name:'ХРАМ ПУСТОТЫ',wall:[.40,.38,.46],accent:[.76,.44,1],floor:[.30,.27,.34],fog:[.038,.025,.05]},{name:'ЗОЛОТАЯ КУЗНИЦА',wall:[.46,.41,.34],accent:[1,.67,.27],floor:[.33,.30,.26],fog:[.05,.035,.023]},{name:'СТАЛЬНОЙ ШТОРМ',wall:[.32,.38,.44],accent:[.80,.88,.97],floor:[.26,.30,.34],fog:[.015,.023,.038]},{name:'ИЗОЛЯТОР',wall:[.43,.43,.40],accent:[.96,.72,.30],floor:[.34,.33,.30],fog:[.045,.036,.018]},{name:'АБИСС',wall:[.22,.35,.40],accent:[.18,.93,.74],floor:[.18,.28,.32],fog:[.009,.034,.041]},{name:'ОРБИТА',wall:[.35,.32,.46],accent:[.66,.63,1],floor:[.25,.23,.37],fog:[.022,.015,.043]},{name:'КРИСТАЛЛ',wall:[.33,.43,.47],accent:[.46,.95,.99],floor:[.24,.34,.39],fog:[.014,.033,.044]},{name:'ТИТАН',wall:[.46,.38,.32],accent:[1,.61,.27],floor:[.30,.27,.24],fog:[.046,.030,.018]},{name:'ВЕРТИКАЛЬНАЯ ВЕРФЬ',wall:[.37,.43,.45],accent:[.95,.68,.31],floor:[.26,.30,.33],fog:[.023,.033,.036]},{name:'ЛЕСТНИЧНАЯ ЦИТАДЕЛЬ',wall:[.34,.39,.49],accent:[.31,.95,.85],floor:[.25,.29,.37],fog:[.012,.027,.037]},
{name:'ВОЗДУШНЫЙ КОЛЛЕКТОР',wall:[.39,.47,.51],accent:[.25,.83,1],floor:[.28,.33,.38],fog:[.015,.029,.043]},
{name:'ТИТАНОВЫЙ АТРИУМ',wall:[.48,.43,.37],accent:[1,.74,.36],floor:[.33,.30,.27],fog:[.036,.027,.022]},
 {name:'КРИОГЕННЫЙ ШПИЛЬ',wall:[.33,.45,.49],accent:[.34,.96,1],floor:[.26,.35,.39],fog:[.016,.031,.047]},
 {name:'ГРАВИТАЦИОННАЯ ФАБРИКА',wall:[.43,.37,.45],accent:[.90,.48,1],floor:[.30,.26,.32],fog:[.035,.020,.045]}];
function mix(a,b,t){return a.map((v,i)=>v*(1-t)+b[i]*t)}function rcolor(c,m=1){return c.map(x=>x*m)}
const VS=`attribute vec3 aPos;attribute vec3 aNorm;attribute vec3 aCol;attribute float aEmit;uniform mat4 uProj,uView,uModel;uniform vec3 uTint;uniform float uGlow,uTime;varying vec3 vCol,vPos,vNormal,vLocal;varying float vEmit,vLight;void main(){vec4 wp=uModel*vec4(aPos,1.0);vPos=wp.xyz;vLocal=aPos;mat3 M=mat3(uModel);vec3 v=aNorm/vec3(max(dot(M[0],M[0]),.00001),max(dot(M[1],M[1]),.00001),max(dot(M[2],M[2]),.00001));vec3 n=normalize(M*v);vNormal=n;vLight=.5+.5*max(0.,dot(n,normalize(vec3(-.45,1.,.3))));vCol=aCol*uTint;vEmit=aEmit+uGlow;gl_Position=uProj*uView*wp;}`;
const FS=`
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vCol,vPos,vNormal,vLocal;varying float vEmit,vLight;
uniform vec3 uEye,uFog,uAccent,uCamDir,uLampPos[3];
uniform float uTime,uQuality,uShotFlash,uMatOverride,uRobotDamage;
uniform sampler2D uMatAlbedo,uMatNormal;
float sat(float v){return clamp(v,0.,1.);}
float rnd(vec2 v){return fract(sin(dot(v,vec2(127.1,311.7)))*43758.5453);}
vec3 film(vec3 x){x=max(vec3(0.),x);return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
vec3 efficientLight(vec3 albedo,float metal,float rough,vec3 N,vec3 V,vec3 L,vec3 radiance){
 float d=max(dot(N,L),0.);
 vec3 h=normalize(V+L);
 float s=pow(max(dot(N,h),0.),mix(42.,7.,rough));
 return radiance*(albedo*(1.-metal*.52)*d*.55+mix(vec3(.045),albedo,metal)*s*.19);
}
vec3 brdf(vec3 albedo,float metal,float rough,vec3 N,vec3 V,vec3 L,vec3 radiance){
 float ndl=max(dot(N,L),0.),ndv=max(dot(N,V),.001);
 vec3 H=normalize(V+L);float ndh=max(dot(N,H),0.),vdh=max(dot(V,H),0.);
 float a=max(.075,rough*rough),a2=a*a;
 float denom=(ndh*ndh*(a2-1.)+1.);
 float D=a2/(3.14159*denom*denom+.00001);
 float k=(rough+1.)*(rough+1.)/8.;
 float G=ndl/(ndl*(1.-k)+k)*ndv/(ndv*(1.-k)+k);
 vec3 F0=mix(vec3(.04),albedo,metal);
 vec3 F=F0+(1.-F0)*pow(1.-vdh,5.);
 vec3 spec=(D*G*F)/(4.*max(.001,ndl*ndv)+.001);
 return (albedo*(1.-metal)*(1.-F)/3.14159+spec)*radiance*ndl;
}
void main(){
 vec3 geometric=normalize(vNormal),N=geometric,V=normalize(uEye-vPos+vec3(.00001));
 float horizontal=length(vPos.xz-uEye.xz),dist=length(vPos-uEye);
 bool floorMat=geometric.y>.76&&abs(vPos.y)<.11;
 bool ceilMat=geometric.y<-.76;
 bool wallMat=abs(geometric.y)<.26&&vPos.y>.12;
 bool robotMat=uMatOverride>3.5;
 vec2 tileUV=(floorMat||ceilMat)?vPos.xz:(abs(geometric.x)>.58?vPos.zy:vPos.xy);
 float id=uMatOverride>-.5?uMatOverride:(floorMat?1.:(ceilMat?2.:(wallMat?0.:3.)));
 if(robotMat){
  // Stable, mesh-local machining texture: no sliding when the robot walks or rotates.
  tileUV=vec2(vLocal.x+.27*vLocal.z,vLocal.y+.13*vLocal.z)*3.2;
  float luminosity=dot(vCol,vec3(.28,.58,.14));
  id=vEmit>.26?7.:(luminosity<.20?5.:(luminosity>.46?6.:4.));
 }
 vec2 unit=fract(tileUV);
 vec2 atlas=vec2((id+.007+unit.x*.986)*.125,.007+unit.y*.986);
 vec4 tex=texture2D(uMatAlbedo,atlas);
 vec4 bump=texture2D(uMatNormal,atlas);
 vec3 albedo=vCol*mix(vec3(.90),tex.rgb*1.36,.66);
 float rough=clamp(tex.a,.13,.96), metal=wallMat?.73:(floorMat?.64:(ceilMat?.45:.68));
 if(robotMat){
  metal=id<4.5?.82:(id<5.5?.04:(id<6.5?.23:.46));
  rough=clamp(rough*(id<4.5?.79:1.),.19,.93);
 }
 vec2 cell=floor(tileUV);float variation=rnd(cell+id*17.);
 albedo*=.88+.22*variation;
 if(uQuality>.5){
  vec2 bn=bump.rg*2.-1.;
  vec3 T=(floorMat||ceilMat)?vec3(1.,0.,0.):(abs(geometric.x)>.58?vec3(0.,0.,1.):vec3(1.,0.,0.));
  vec3 B=(floorMat||ceilMat)?vec3(0.,0.,1.):vec3(0.,1.,0.);
  N=normalize(geometric+T*bn.x*(robotMat?.27:.52)+B*bn.y*(robotMat?.27:.52));
 }else{rough=max(rough,.37);}
 // Recessed wall joints and slab bevels are darker: simulated crevice occlusion.
 float joint=1.-smoothstep(.013,.065,min(min(unit.x,1.-unit.x),min(unit.y,1.-unit.y)));
 float cavity=bump.b;
 float ao=clamp(1.-.26*joint-.21*(1.-cavity),.46,1.);
 if(wallMat){ao*=mix(.54,1.,smoothstep(.0,.56,vPos.y));}
 if(ceilMat&&!robotMat)ao*=.77;
 if(robotMat){
  // Scratched metallic bevels, soot inside seams and paint chips at critical damage.
  float chip=rnd(floor(vLocal.xy*17.)+floor(vLocal.z*8.)*7.0);
  float wear=smoothstep(.91,.995,chip)*clamp(uRobotDamage,0.,1.);
  albedo=mix(albedo,albedo*.39+vec3(.014),wear*.76);
  rough=mix(rough,.82,wear*.53);
  ao*=.91;
 }
 if(floorMat){
  // Local oily stains are *not* all-over cyan reflections.
  float stain=rnd(floor(tileUV*2.)+31.);
  metal=mix(metal,.84,step(.90,stain)*.55);
  rough*=mix(1.,.63,step(.90,stain)*.7);
 }
 vec3 C=albedo*(.20+max(geometric.y,0.)*.11)*ao;
 // Industrial skylight as broad, cool fill, with warm spill from the far end.
 C+=(uQuality>1.5?brdf(albedo,metal,rough,N,V,normalize(vec3(-.42,.83,.32)),vec3(1.45,1.55,1.65)):efficientLight(albedo,metal,rough,N,V,normalize(vec3(-.42,.83,.32)),vec3(1.43,1.48,1.53)))*.58*ao;
 C+=efficientLight(albedo,metal,rough,N,V,normalize(vec3(.58,.22,-.63)),vec3(.60,.47,.34))*.18*ao;
 // Player's flashlight: narrower pool, naturally falling off at distance.
 vec3 eyeTo=vPos-uEye;
 float cone=dot(normalize(eyeTo+vec3(.0001)),normalize(uCamDir));
 float flash=smoothstep(.84,.97,cone)*1.65/(1.+dist*.26+dist*dist*.024);
 C+=(uQuality>1.5?brdf(albedo,metal,rough,N,V,normalize(-eyeTo+vec3(.0001)),vec3(3.6,3.65,3.45)):efficientLight(albedo,metal,rough,N,V,normalize(-eyeTo+vec3(.0001)),vec3(3.6,3.65,3.45)))*flash;
 // Up to three nearest luminaire positions, warm/cool alternating.
 for(int i=0;i<3;i++){
  if(i==0||uQuality>.5){
   vec3 lp=uLampPos[i]-vPos;float r2=dot(lp,lp);
   vec3 radiance=mix(vec3(1.14,.83,.56),uAccent*1.45,float(i)-2.*floor(float(i)*.5));
   float att=2.3/(1.+r2*.24+r2*r2*.008);
   C+=efficientLight(albedo,metal,rough,N,V,normalize(lp+vec3(.00001)),radiance)*att;
  }
 }
 // Weapon muzzle casts a brief warm flash on nearby walls.
 float flashDist=1.85*max(0.,uShotFlash)/(1.+dist*dist*.49);
 C+=efficientLight(albedo,metal,rough,N,V,normalize(-eyeTo+vec3(.0001)),vec3(4.5,2.15,.64))*flashDist;
 if(robotMat){
  // Tight cool rim light separates a moving armored silhouette from the environment.
  float rim=pow(1.-max(0.,dot(N,V)),3.5);
  C+=mix(vec3(.23,.47,.60),uAccent*.47,.25)*rim*(uQuality<.5?.075:.24);
  float scar=smoothstep(.94,.995,rnd(floor(vLocal.xy*17.)+floor(vLocal.z*8.)*7.0));
  C+=vec3(.75,.09,.025)*scar*uRobotDamage*.07;
 }
 // A few localized light leaks, deliberately weaker than real surface colors.
 float emit=clamp(vEmit,0.,3.);
 C+=vCol*emit*(.82+.10*sin(uTime*1.7+vPos.x*2.));
 // Low-lying industrial dust catches light in distant passages.
 float dust=smoothstep(8.,34.,dist)*(.10+.07*(1.-sat(vPos.y/4.5)));
 C=mix(C,uFog+uAccent*.024,dust);
 float f=smoothstep(18.,47.,horizontal)*.76;
 C=mix(C,uFog+uAccent*.014,f);
 C=film(C*1.23);
 C=pow(C,vec3(.965));
 gl_FragColor=vec4(C,1.);
}`;
// Offline-generated tileable material atlases. Two 1024×256 textures, 4 industrial materials.
// Stored as GPU textures instead of computing expensive noise in every fragment.
let materialAlbedo=null,materialNormals=null;
function makeMaterialAtlases(){
 const W=2048,H=256,T=256,al=new Uint8Array(W*H*4),nm=new Uint8Array(W*H*4);
 let heights=new Float32Array(W*H);
 const rnd=(x,y,k=0)=>{let q=(Math.imul((x+31417)|0,374761393)^Math.imul((y+821+k*173)|0,668265263))|0;
  q=Math.imul(q^(q>>>13),1274126177);return ((q^(q>>>16))>>>0)/4294967295;};
 const clampByte=(x)=>Math.max(0,Math.min(255,Math.round(x)));
 const near=(v,t,w)=>Math.max(0,1-Math.abs(v-t)/w);
 for(let ty=0;ty<H;ty++)for(let tx=0;tx<W;tx++){
  const mat=Math.floor(tx/T),px=tx%T,u=(px+.5)/T,v=(ty+.5)/T;
  const coarse=rnd(px>>4,ty>>4,mat),fine=rnd(px,ty,mat),grain=rnd(px>>1,ty,mat);
  const scuff=(rnd(px>>3,ty>>5,mat)>.962&&(ty+px*3)%13<4)?1:0;
  let h=.60,rough=.6,metal=1,base=0,rr=0,gg=0,bb=0;
  if(mat===0){ // vertical insulated steel cladding, joints and rivets
   const edge=Math.min(u,1-u,v,1-v),gasket=edge<.018,bevel=edge<.054;
   const recess=(u>.105&&u<.895&&v>.19&&v<.82);
   const rib=near(v,.18,.014)+near(v,.815,.014);
   let bolts=(Math.hypot((u<.5?u-.085:u-.915)*12,(v<.5?v-.11:v-.89)*12)<.25)?1:0;
   h=.56+(bevel?.12:0)-(gasket?.24:0)-(recess?.075:0)+rib*.09+bolts*.15;
   base=139+coarse*25+fine*15-scuff*36;
   if(recess)base-=19;
   if(gasket)base-=74;
   if(rib>.1)base+=25;
   if(bolts)base=79;
   rough=.62+coarse*.13+fine*.13-scuff*.20;
   rr=base*.97;gg=base*1.02;bb=base*1.06;
  }else if(mat===1){ // floor armor plates: bevels, inset mesh, bolts, dark oil
   const edge=Math.min(u,1-u,v,1-v),gasket=edge<.015,bevel=edge<.058;
   const inset=(u>.24&&u<.76&&v>.26&&v<.75),grate=inset&&((Math.floor(u*38)%3)===0);
   const dents=rnd(px>>3,ty>>3,mat)>.95;
   h=.58+(bevel?.085:0)-(gasket?.20:0)-(inset?.065:0)-(grate?.12:0)-(dents?.025:0);
   base=119+coarse*20+fine*17-scuff*27;
   if(inset)base-=17;
   if(grate)base-=47;
   if(gasket)base-=76;
   if(bevel&&!gasket)base+=19;
   rough=.40+coarse*.16+fine*.18;
   rr=base*.95;gg=base*1.02;bb=base*1.06;
  }else if(mat===2){ // black suspended ceiling and cable trays
   const rib=(u%0.245)<.04 || (v%0.25)<.033;
   const vent=(u>.15&&u<.84&&v>.2&&v<.84)&&(Math.floor(v*29)%3===0);
   h=.45+(rib?.13:0)-(vent?.11:0);
   base=81+coarse*18+fine*15+(rib?24:0)-(vent?30:0);
   rough=.77+fine*.12;
   rr=base*.98;gg=base*1.02;bb=base*1.04;
  }else if(mat===3){ // gunmetal mechanical metal for pipes, columns, mesh and props
   const stripe=near(u,.18,.026)+near(u,.81,.022);
   const groove=Math.sin(v*220)>0.96;
   h=.50+stripe*.13-(groove?.03:0);
   base=103+coarse*24+fine*16+stripe*27-scuff*28;
   rough=.42+coarse*.20+fine*.18;
   rr=base*.98;gg=base*1.02;bb=base*1.08;
  }else if(mat===4){ // robot armor: brushed titanium, ceramic-coated ridges and machined scars
   const edge=Math.min(u,1-u,v,1-v),seam=edge<.018;
   const brush=(Math.sin(v*760.+u*16.)*.5+.5);
   const mill=(Math.sin(u*65.)*.5+.5),chip=rnd(px>>2,ty>>2,mat)>.971;
   const bracket=near(u,.19,.025)+near(u,.81,.025);
   h=.63+(bracket>.1?.055:0)-(seam?.115:0)-(chip?.036:0)+brush*.012;
   base=164+coarse*14+fine*12+brush*9+mill*4-(seam?42:0)-(chip?57:0);
   rough=.38+coarse*.12+fine*.085+(chip?.18:0);
   rr=base*.99;gg=base*1.025;bb=base*1.04;
  }else if(mat===5){ // robot seals: black polymer bellows and matte carbon joint protectors
   const rib=(Math.sin(v*108.)>.69),groove=(Math.sin(u*48.)>.87);
   h=.45+(rib?.049:0)-(groove?.030:0);
   base=54+coarse*16+fine*9+(rib?11:0)-(groove?10:0);
   rough=.87+fine*.10;
   rr=base*.92;gg=base*.99;bb=base*1.04;
  }else if(mat===6){ // satin ceramic armor and edge-worn white enamel
   const bevel=Math.min(u,1-u,v,1-v)<.055;
   const brush=Math.sin((u+v*.17)*270.)*.5+.5;
   const polish=rnd(px>>4,ty>>3,mat)>.90;
   h=.65+(bevel?.069:0)+brush*.012-(polish?.034:0);
   base=183+coarse*11+fine*11+brush*7+(bevel?12:0)-(polish?30:0);
   rough=.51+coarse*.10+fine*.07;
   rr=base*.99;gg=base*1.005;bb=base*1.02;
  }else{ // optical faceplates / power channels with restrained internal light guides
   const lattice=Math.abs(Math.sin(u*45.)*Math.sin(v*41.));
   const gap=Math.min(u,1-u,v,1-v)<.045;
   h=.53+(lattice>.9?.036:0)-(gap?.07:0);
   base=136+coarse*13+fine*8+(lattice>.9?18:0)-(gap?37:0);
   rough=.21+fine*.08;
   rr=base*.94;gg=base*1.03;bb=base*1.10;
  }
  // Subtle directional abrasion, edge grime and concentrated oil deposits.
  const edgeDist=Math.min(u,1-u,v,1-v);
  const seamDirt=Math.max(0,1-edgeDist*17)*(4+coarse*14);
  const grit=Math.max(0,rnd(px>>2,ty>>2,mat)-.83)*48;
  const scratch=(mat===0||mat===3)?((rnd(px>>5,ty>>1,mat)> .991)?23:0):0;
  const oil=(mat===1&&rnd(px>>4,ty>>4,mat)>.91)?26:0;
  rr-=seamDirt+grit*.78+oil+scratch*.74;
  gg-=seamDirt+grit+oil+scratch;
  bb-=seamDirt+grit+oil+scratch*1.07;
  // Oxide/rust occupies only sparse isolated patches; no random saturated blue tint.
  const rust=Math.max(0,(coarse*.56+rnd(px>>2,ty>>2,mat)*.44-.81))*2.6;
  rr+=rust*52;gg-=rust*15;bb-=rust*31;
  const idx=(ty*W+tx)*4;
  al[idx]=clampByte(rr);al[idx+1]=clampByte(gg);al[idx+2]=clampByte(bb);al[idx+3]=clampByte(rough*255);
  heights[ty*W+tx]=h;
 }
 // Encode small-scale normal perturbation; avoid seams at atlas tile boundaries.
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const tile=x>>8,low=tile<<8,x0=low+((x-low+255)&255),x1=low+((x-low+1)&255);
  const y0=(y+255)&255,y1=(y+1)&255;
  const dx=(heights[y*W+x1]-heights[y*W+x0])*1.3;
  const dy=(heights[y1*W+x]-heights[y0*W+x])*1.3;
  const ii=(y*W+x)*4;
  nm[ii]=clampByte(128-dx*105);nm[ii+1]=clampByte(128-dy*105);nm[ii+2]=clampByte(heights[y*W+x]*255);nm[ii+3]=255;
 }
 function upload(data){const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);return tex;}
 materialAlbedo=upload(al);materialNormals=upload(nm);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,materialAlbedo);
 gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,materialNormals);
 gl.useProgram(program);gl.uniform1i(u.uMatAlbedo,0);gl.uniform1i(u.uMatNormal,1);
 gl.activeTexture(gl.TEXTURE0);
}
let program, u={},bufferWorld,geom={};function shader(t,s){let h=gl.createShader(t);gl.shaderSource(h,s);gl.compileShader(h);if(!gl.getShaderParameter(h,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(h));return h}function initGL(){program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,VS));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,FS));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);for(const k of ['uProj','uView','uModel','uTint','uGlow','uEye','uFog','uTime','uAccent','uCamDir','uLampPos[0]','uQuality','uShotFlash','uMatOverride','uRobotDamage','uMatAlbedo','uMatNormal'])u[k]=gl.getUniformLocation(program,k);for(const k of ['aPos','aNorm','aCol','aEmit'])u[k]=gl.getAttribLocation(program,k);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);bufferWorld=gl.createBuffer();geom.cube=makeCube();geom.bevel=makeChamferedBox();geom.rounded=makeRoundedBox();geom.octa=makeOcta();geom.orb=makeOrb(10,6);geom.spark=makeSparkOrb(8,5);geom.tracer=makeEnergyBeam(10);geom.ring=makeRing(24);geom.pylon=makePylon();geom.cylinder=makeCylinder(12);initRobotFoundry();makeMaterialAtlases();initScreenFx();}
// Horizon gradient and sparse stars are generated on the GPU, with no assets.
const SCREEN_VS=`attribute vec2 aXY;varying vec2 vUV;void main(){vUV=aXY*.5+.5;gl_Position=vec4(aXY,0.,1.);}`;
const SKY_FS=`precision mediump float;varying vec2 vUV;uniform vec3 uTop,uHorizon,uGlowTint;uniform vec2 uLook;uniform float uClock,uAspect;float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}void main(){float y=vUV.y-.5+uLook.y*.58;float h=smoothstep(-.30,.72,y);vec3 c=mix(uHorizon,uTop,h);float cloud=sin(vUV.x*13.+sin(vUV.y*12.)*1.7+uClock*.016)*sin(vUV.x*29.-vUV.y*20.);c+=uGlowTint*max(0.,cloud)*.014*(1.-h);vec2 cell=floor(vec2(vUV.x*uAspect,vUV.y)*vec2(480.,270.));float star=step(.99835,hs(cell));star*=smoothstep(.05,.9,y)*(.65+.35*sin(uClock*.9+cell.x));c+=vec3(.35,.52,.65)*star;float haze=exp(-pow(y*6.,2.))*.23;c+=uGlowTint*haze;gl_FragColor=vec4(c,1.);}`;
const POST_FS=`precision mediump float;varying vec2 vUV;uniform sampler2D uScene;uniform vec2 uTexel;uniform float uClock;
float lum(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec3 bright(vec2 offs){vec3 c=texture2D(uScene,clamp(vUV+offs*uTexel,.001,.999)).rgb;float b=max(0.,lum(c)-.64);return c*b;}
void main(){vec3 base=texture2D(uScene,vUV).rgb;
 vec3 glow=bright(vec2(0.,0.))*.16;
 glow+=(bright(vec2(3.,0.))+bright(vec2(-3.,0.))+bright(vec2(0.,3.))+bright(vec2(0.,-3.)))*.10;
 glow+=(bright(vec2(8.,5.))+bright(vec2(-8.,5.))+bright(vec2(8.,-5.))+bright(vec2(-8.,-5.)))*.067;
 vec3 c=base+glow*.52;
 float vg=1.-.20*smoothstep(.22,.8,length((vUV-.5)*vec2(1.,.8)));c*=vg;
 float grain=fract(sin(dot(vUV*vec2(1001.,567.)+uClock*.35,vec2(12.9898,78.233)))*43758.5453);
 c+=(grain-.5)*.006;
 gl_FragColor=vec4(clamp(c,0.,1.),1.);}`;
let skyProgram,postProgram,quadBuffer,skyLoc={},postLoc={},postFbo=null,postTexture=null,postDepth=null,postW=0,postH=0;
function screenProgram(fs){const pr=gl.createProgram();gl.attachShader(pr,shader(gl.VERTEX_SHADER,SCREEN_VS));gl.attachShader(pr,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(pr);if(!gl.getProgramParameter(pr,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(pr));return pr;}
function initScreenFx(){skyProgram=screenProgram(SKY_FS);postProgram=screenProgram(POST_FS);quadBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quadBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);for(const k of ['aXY','uTop','uHorizon','uGlowTint','uLook','uClock','uAspect'])skyLoc[k]=k==='aXY'?gl.getAttribLocation(skyProgram,k):gl.getUniformLocation(skyProgram,k);for(const k of ['aXY','uScene','uTexel','uClock'])postLoc[k]=k==='aXY'?gl.getAttribLocation(postProgram,k):gl.getUniformLocation(postProgram,k);}
function screenQuad(location){gl.bindBuffer(gl.ARRAY_BUFFER,quadBuffer);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(location);gl.drawArrays(gl.TRIANGLES,0,6);gl.disableVertexAttribArray(location);}
function backdrop(tt,p,t){if(!skyProgram)return;gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.useProgram(skyProgram);gl.uniform3fv(skyLoc.uTop,tt.fog.map(v=>v*.17));gl.uniform3fv(skyLoc.uHorizon,tt.fog.map(v=>v*1.26));gl.uniform3fv(skyLoc.uGlowTint,tt.accent);gl.uniform2f(skyLoc.uLook,p.yaw,p.pitch);gl.uniform1f(skyLoc.uClock,t);gl.uniform1f(skyLoc.uAspect,glCanvas.width/Math.max(1,glCanvas.height));screenQuad(skyLoc.aXY);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.useProgram(program);}
function ensurePost(){let w=glCanvas.width,h=glCanvas.height;if(postFbo&&postW===w&&postH===h)return true;if(postTexture)gl.deleteTexture(postTexture);if(postDepth)gl.deleteRenderbuffer(postDepth);if(postFbo)gl.deleteFramebuffer(postFbo);postW=w;postH=h;postTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,postTexture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);postDepth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,postDepth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,w,h);postFbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,postFbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,postTexture,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,postDepth);let ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);if(!ok){console.warn('Cinematic postprocessing unavailable');return false}return true;}
function showPost(t){gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,glCanvas.width,glCanvas.height);gl.disable(gl.DEPTH_TEST);gl.useProgram(postProgram);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,postTexture);gl.uniform1i(postLoc.uScene,0);gl.uniform2f(postLoc.uTexel,1/postW,1/postH);gl.uniform1f(postLoc.uClock,t);screenQuad(postLoc.aXY);gl.enable(gl.DEPTH_TEST);gl.useProgram(program);}
