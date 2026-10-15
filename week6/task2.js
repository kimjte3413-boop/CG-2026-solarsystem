/* 6주차 실습 2: UV 구형 행성의 조건부 표면 마스크 */
(() => {
'use strict';
const cv=document.querySelector('#cv'), gl=D.context(cv); if(!gl)return;
const VS=`#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
uniform mat4 uVP;
out vec3 vP,vN; out vec2 vUV;
void main(){vP=aPos;vN=aNormal;vUV=aUV;gl_Position=uVP*vec4(aPos,1.);}`;
const FS=`#version 300 es
precision highp float;
const float PI=3.14159265;
in vec3 vP,vN; in vec2 vUV; out vec4 outColor;
uniform sampler2D uColor,uNormal,uARM,uColor2,uNormal2,uARM2,uEnv;
uniform vec3 uEye,uLight,uTint;
uniform float uRough,uMetal,uNormalStrength,uPower,uAmbient,uEnvPower,uMaskThreshold,uMaskDetail;

vec3 srgbToLinear(vec3 c){
 return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));
}
vec3 linearToSrgb(vec3 c){
 return mix(12.92*c,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));
}

vec3 directPBR(vec3 N,vec3 V,vec3 L,vec3 base,float rough,float metal){
 float noL=max(dot(N,L),0.0),noV=max(dot(N,V),0.0);
 if(noL<=0.0||noV<=0.0)return vec3(0.0);
 vec3 H=normalize(V+L);
 float noH=max(dot(N,H),0.0),voH=max(dot(V,H),0.0);
 float a=rough*rough,a2=a*a;
 float dDenom=noH*noH*(a2-1.0)+1.0;
 float D=a2/max(PI*dDenom*dDenom,0.000001);
 float k=(rough+1.0)*(rough+1.0)/8.0;
 float Gv=noV/(noV*(1.0-k)+k);
 float Gl=noL/(noL*(1.0-k)+k);
 vec3 F0=mix(vec3(0.04),base,metal);
 vec3 F=F0+(1.0-F0)*pow(1.0-voH,5.0);
 vec3 specular=D*Gv*Gl*F/max(4.0*noV*noL,0.0001);
 vec3 diffuse=(1.0-F)*(1.0-metal)*base/PI;
 return uPower*noL*(diffuse+specular);
}

void main(){
 vec3 N=normalize(vN),V=normalize(uEye-vP),L=normalize(uLight);
 vec3 baseA=srgbToLinear(texture(uColor,vUV).rgb);
 vec3 baseB=srgbToLinear(texture(uColor2,vUV).rgb);
 float latitudeMask=1.0-smoothstep(uMaskThreshold,uMaskThreshold+0.08,abs(vP.y));
 float detail=texture(uColor,vUV*vec2(12.0,8.0)).r;
 float detailMask=smoothstep(0.35,0.62,1.0-detail);
 float mask=latitudeMask*mix(1.0,detailMask,uMaskDetail);
 vec3 base=mix(baseA,baseB,mask)*uTint;

 vec3 armA=texture(uARM,vUV).rgb,armB=texture(uARM2,vUV).rgb;
 float ao=clamp(mix(armA.r,armB.r,mask),0.0,1.0);
 float rough=clamp(mix(armA.g,armB.g,mask)*uRough,0.04,1.0);
 float metal=clamp(mix(armA.b,armB.b,mask)*uMetal,0.0,1.0);

 vec3 tangentNormalA=texture(uNormal,vUV).rgb*2.0-1.0;
 vec3 tangentNormalB=texture(uNormal2,vUV).rgb*2.0-1.0;
 vec3 tangentNormal=mix(tangentNormalA,tangentNormalB,mask);
 tangentNormal.xy*=uNormalStrength;
 tangentNormal=normalize(tangentNormal);
 vec3 dp1=dFdx(vP),dp2=dFdy(vP);
 vec2 duv1=dFdx(vUV),duv2=dFdy(vUV);
 vec3 T=normalize(dp1*duv2.y-dp2*duv1.y);
 vec3 B=normalize(-dp1*duv2.x+dp2*duv1.x);
 N=normalize(mat3(T,B,N)*tangentNormal);

 vec3 color=directPBR(N,V,L,base,rough,metal)
           +base*(1.0-metal)*uAmbient*ao;

 vec3 R=reflect(-V,N);
 vec2 envUV=vec2(atan(R.z,R.x)/(2.0*PI)+0.5,
                 asin(clamp(R.y,-1.0,1.0))/PI+0.5);
 float maxLod=log2(float(max(textureSize(uEnv,0).x,textureSize(uEnv,0).y)));
 vec3 envColor=srgbToLinear(textureLod(uEnv,envUV,rough*maxLod).rgb);
 float noV=max(dot(N,V),0.0);
 vec3 F0=mix(vec3(0.04),base,metal);
 vec3 envF=F0+(1.0-F0)*pow(1.0-noV,5.0);
 color+=envColor*envF*uEnvPower*ao;

 color=max(color,vec3(0.0));
 color=color/(1.0+color); // HDR → 표시 범위
 outColor=vec4(linearToSrgb(color),1.0);
}`;
const prog=D.program(gl,VS,FS),U=D.uniforms(gl,prog,[
 'uVP','uEye','uLight','uTint','uRough','uMetal','uNormalStrength','uPower','uAmbient','uEnvPower','uMaskThreshold','uMaskDetail',
 'uColor','uNormal','uARM','uColor2','uNormal2','uARM2','uEnv'
]);
function makeSphere(seg){
 const pos=[],nrm=[],uv=[],idx=[],around=seg*2,width=around+1;
 for(let i=0;i<=seg;i++){
  const phi=Math.PI*i/seg;
  for(let j=0;j<=around;j++){
   const theta=2.0*Math.PI*j/around;
   const x=Math.sin(phi)*Math.cos(theta),y=Math.cos(phi),z=Math.sin(phi)*Math.sin(theta);
   pos.push(x,y,z);nrm.push(x,y,z);uv.push(j/around,i/seg);
  }
 }
 for(let i=0;i<seg;i++)for(let j=0;j<around;j++){
  const a=i*width+j,b=a+width;
  idx.push(a,b,a+1,a+1,b,b+1);
 }
 return {pos:new Float32Array(pos),nrm:new Float32Array(nrm),uv:new Float32Array(uv),idx:new Uint16Array(idx)};
}
const mesh=D.upload(gl,makeSphere(48));
const assets={wood_planks:['Diffuse','nor_gl','arm'],rusty_metal_04:['Diffuse','nor_gl','arm'],rock_boulder_dry:['Diffuse','nor_gl','arm']};
const textures={},jobs=[];let failed=false;
function load(name){
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([128,128,255,255]));
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
 jobs.push(new Promise(resolve=>{const img=new Image();img.onload=()=>{
  gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  resolve();
 };img.onerror=()=>{failed=true;resolve();};
 img.src='assets/week06/'+name+(name.endsWith('_arm')?'.png':'.jpg');}));
 return tex;
}
for(const [asset,kinds] of Object.entries(assets))textures[asset]=kinds.map(kind=>load(asset+'_'+kind));
const envTex=load('studio_small_09_tonemapped');
const color2=load('rusty_metal_04_Diffuse'),normal2=load('rusty_metal_04_nor_gl'),arm2=load('rusty_metal_04_arm');
Promise.all(jobs).then(()=>{document.querySelector('#status').textContent=failed?'텍스처 로딩 실패: HTTP 서버와 파일 경로 확인':'텍스처 로딩 완료 · 표면 마스크를 조절해 보세요';});
document.querySelector('#ui').innerHTML='';
const S=D.UI('#ui',[
 {id:'rough',label:'roughness 배율',min:.05,max:1,step:.01,value:1},
 {id:'metal',label:'metallic 배율',min:0,max:1,step:.01,value:1},
 {id:'normal',label:'normal 강도',min:0,max:10,step:.1,value:5},
 {id:'power',label:'직접광 세기',min:0,max:8,step:.1,value:4},
 {id:'ambient',label:'상수 ambient',min:0,max:1,step:.01,value:.15},
 {id:'env',label:'환경맵 반사 세기',min:0,max:3,step:.1,value:1.5},
]);
const threshold=document.querySelector('#mask-threshold'),detailControl=document.querySelector('#mask-detail');
function updateMaskLabels(){
 document.querySelector('#mask-threshold-value').textContent=Number(threshold.value).toFixed(2);
 document.querySelector('#mask-detail-value').textContent=Number(detailControl.value).toFixed(2);
}
threshold.addEventListener('input',updateMaskLabels);
detailControl.addEventListener('input',updateMaskLabels);

const cam=D.orbit(cv,{dist:3.7,pitch:.15});document.querySelector('#reset').onclick=()=>{cam.dist=3.7;cam.yaw=0;cam.pitch=.15;};
const view=D.M4.create(),proj=D.M4.create(),vp=D.M4.create();
document.querySelector('#note').textContent='돌 표면에 위도 경계와 Diffuse 세부값 조건으로 녹슨 금속 무늬를 섞었습니다.';
let visible=true;new IntersectionObserver(e=>visible=e[0].isIntersecting).observe(cv);
D.loop(()=>{
 if(!visible||document.hidden)return;
 D.fit(cv);gl.viewport(0,0,cv.width,cv.height);D.clearColor(gl);gl.enable(gl.DEPTH_TEST);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 const eye=cam.eye([0,0,0]);D.M4.lookAt(view,eye,[0,0,0],[0,1,0]);D.M4.perspective(proj,Math.PI/4,cv.width/cv.height,.1,100);D.M4.multiply(vp,proj,view);
 gl.useProgram(prog);gl.uniformMatrix4fv(U.uVP,false,vp);gl.uniform3fv(U.uEye,eye);
 gl.uniform3fv(U.uLight,[.6,.7,1.]);gl.uniform3fv(U.uTint,[1,1,1]);
 for(const [key,value] of Object.entries({uRough:S.rough,uMetal:S.metal,uNormalStrength:S.normal,uPower:S.power,uAmbient:S.ambient,uEnvPower:S.env,uMaskThreshold:Number(threshold.value),uMaskDetail:Number(detailControl.value)}))gl.uniform1f(U[key],value);
 [...textures.rock_boulder_dry,color2,normal2,arm2,envTex].forEach((tex,i)=>{
  gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.uniform1i(U[['uColor','uNormal','uARM','uColor2','uNormal2','uARM2','uEnv'][i]],i);
 });
 gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);gl.bindVertexArray(null);
});
})();
