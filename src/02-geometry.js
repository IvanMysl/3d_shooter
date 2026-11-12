
function geomBegin(){return []}function addTri(dst,v1,v2,v3,n,c,e=0){for(const v of [v1,v2,v3])dst.push(v[0],v[1],v[2],n[0],n[1],n[2],c[0],c[1],c[2],e)}function quad(dst,a,b,c,d,n,color,e=0){addTri(dst,a,b,c,n,color,e);addTri(dst,a,c,d,n,color,e)}function box(dst,x1,y1,z1,x2,y2,z2,c,e=0,sides=[1,1,1,1,1,1]){if(sides[0])quad(dst,[x1,y1,z2],[x2,y1,z2],[x2,y2,z2],[x1,y2,z2],[0,0,1],c,e);if(sides[1])quad(dst,[x2,y1,z1],[x1,y1,z1],[x1,y2,z1],[x2,y2,z1],[0,0,-1],c,e);if(sides[2])quad(dst,[x1,y1,z1],[x1,y1,z2],[x1,y2,z2],[x1,y2,z1],[-1,0,0],c,e);if(sides[3])quad(dst,[x2,y1,z2],[x2,y1,z1],[x2,y2,z1],[x2,y2,z2],[1,0,0],c,e);if(sides[4])quad(dst,[x1,y2,z2],[x2,y2,z2],[x2,y2,z1],[x1,y2,z1],[0,1,0],c,e);if(sides[5])quad(dst,[x1,y1,z1],[x2,y1,z1],[x2,y1,z2],[x1,y1,z2],[0,-1,0],c,e)}
function toMesh(verts){const v=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,v);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);return {b:v,n:verts.length/10}}function makeCube(){let d=[];box(d,-.5,-.5,-.5,.5,.5,.5,[1,1,1]);return toMesh(d)}function makeOcta(){let d=[],T=[0,.72,0],B=[0,-.72,0],q=[[.6,0,0],[0,0,.6],[-.6,0,0],[0,0,-.6]];for(let i=0;i<4;i++){let a=q[i],b=q[(i+1)%4];let n=[(a[0]+b[0])*.6,.7,(a[2]+b[2])*.6];addTri(d,T,a,b,n,[1,1,1]);addTri(d,B,b,a,[n[0],-.7,n[2]],[1,1,1])}return toMesh(d)}function makeOrb(segs,rings){let d=[];for(let y=0;y<rings;y++){const a=Math.PI*y/rings,b=Math.PI*(y+1)/rings;for(let j=0;j<segs;j++){let t=TAU*j/segs,u=TAU*(j+1)/segs;let P=(phi,th)=>[Math.sin(phi)*Math.cos(th)*.5,Math.cos(phi)*.5,Math.sin(phi)*Math.sin(th)*.5];let p1=P(a,t),p2=P(a,u),p3=P(b,u),p4=P(b,t);let nx=p1[0]+p2[0]+p3[0]+p4[0],ny=p1[1]+p2[1]+p3[1]+p4[1],nz=p1[2]+p2[2]+p3[2]+p4[2],nn=hypot(nx,ny,nz)||1;
quad(d,p1,p2,p3,p4,[nx/nn,ny/nn,nz/nn],[1,1,1])}}return toMesh(d)}function makeRing(n){let d=[];for(let i=0;i<n;i++){let a=i*TAU/n,b=(i+1)*TAU/n;let p=(r,t,y)=>[r*Math.cos(t),y,r*Math.sin(t)];quad(d,p(.48,a,-.03),p(.55,a,-.03),p(.55,b,-.03),p(.48,b,-.03),[0,1,0],[1,1,1]);quad(d,p(.48,a,.03),p(.48,b,.03),p(.55,b,.03),p(.55,a,.03),[0,1,0],[1,1,1])}return toMesh(d)}function makeChamferedBox(){
 let d=[],bevel=.09;
 const outline=[[-.5+bevel,-.5],[.5-bevel,-.5],[.5,-.5+bevel],[.5,.5-bevel],[.5-bevel,.5],[-.5+bevel,.5],[-.5,.5-bevel],[-.5,-.5+bevel]];
 const back=outline.map(p=>[p[0],p[1],-.5]),front=outline.map(p=>[p[0],p[1],.5]);
 for(let i=0;i<8;i++){
  let j=(i+1)%8,a=outline[i],b=outline[j],n=[(a[1]-b[1]),(b[0]-a[0]),0],L=Math.hypot(n[0],n[1]);
  quad(d,back[i],back[j],front[j],front[i],[n[0]/L,n[1]/L,0],[1,1,1]);
 }
 for(let i=1;i<7;i++){addTri(d,front[0],front[i],front[i+1],[0,0,1],[1,1,1]);addTri(d,back[0],back[i+1],back[i],[0,0,-1],[1,1,1]);}
 return toMesh(d);
}
function makeCylinder(segments=12){
 const d=[],r=.5;
 for(let j=0;j<segments;j++){
   let a=j*TAU/segments,b=(j+1)*TAU/segments;
   const n1=[Math.cos(a),Math.sin(a),0],n2=[Math.cos(b),Math.sin(b),0];
   const A=[r*n1[0],r*n1[1],-.5], B=[r*n2[0],r*n2[1],-.5];
   const C=[r*n2[0],r*n2[1],.5],D=[r*n1[0],r*n1[1],.5];
   addTri(d,A,B,D,n1,[1,1,1]);addTri(d,D,B,C,n2,[1,1,1]);
   addTri(d,[0,0,.5],D,C,[0,0,1],[1,1,1]);
   addTri(d,[0,0,-.5],B,A,[0,0,-1],[1,1,1]);
 }
 return toMesh(d);
}
function makePylon(){let d=[];box(d,-.23,-.5,-.23,.23,.5,.23,[1,1,1]);return toMesh(d)}
const ID=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);let matModel=new Float32Array(16),matView=new Float32Array(16),matProj=new Float32Array(16);function model(x,y,z,sx=1,sy=1,sz=1,rot=0,tilt=0){const c=Math.cos(rot),s=Math.sin(rot),v=Math.cos(tilt),w=Math.sin(tilt);return new Float32Array([sx*c,0,-sx*s,0,sy*s*w,sy*v,sy*c*w,0,sz*s*v,-sz*w,sz*c*v,0,x,y,z,1])}function perspective(fov,aspect,near,far){let f=1/Math.tan(fov/2);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0])}
function lookAt(ex,ey,ez,tx,ty,tz){let z=[ex-tx,ey-ty,ez-tz],zl=hypot(...z)||1;z=z.map(v=>v/zl);let x=[z[2],0,-z[0]],xl=hypot(...x)||1;x=x.map(v=>v/xl);let y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-(x[0]*ex+x[1]*ey+x[2]*ez),-(y[0]*ex+y[1]*ey+y[2]*ez),-(z[0]*ex+z[1]*ey+z[2]*ez),1])}
function draw(mesh,x,y,z,sx,sy,sz,rot,tint,glow=0,tilt=0){if(!mesh)return;gl.bindBuffer(gl.ARRAY_BUFFER,mesh.b);let stride=40;gl.vertexAttribPointer(u.aPos,3,gl.FLOAT,false,stride,0);gl.vertexAttribPointer(u.aNorm,3,gl.FLOAT,false,stride,12);gl.vertexAttribPointer(u.aCol,3,gl.FLOAT,false,stride,24);gl.vertexAttribPointer(u.aEmit,1,gl.FLOAT,false,stride,36);for(const k of ['aPos','aNorm','aCol','aEmit'])gl.enableVertexAttribArray(u[k]);gl.uniformMatrix4fv(u.uModel,false,model(x,y,z,sx,sy,sz,rot,tilt));gl.uniform3fv(u.uTint,tint);gl.uniform1f(u.uGlow,glow);gl.drawArrays(gl.TRIANGLES,0,mesh.n)}function drawWorld(){
if(worldMesh)draw(worldMesh,0,0,0,1,1,1,0,[1,1,1],0);
if(!game)return;
const p=game.p,viewDist=save.settings.quality===0?30:39;
for(const chunk of worldChunks){if(hypot(chunk.x-p.x,chunk.z-p.z)>viewDist+8)continue;
draw(chunk.mesh,0,0,0,1,1,1,0,[1,1,1],0)}
}