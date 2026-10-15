/* 6주차 실습 2: 태양계 조건과 충돌 사건에 반응하는 니바 행성 */
(() => {
'use strict';
const cv=document.querySelector('#cv'),gl=D.context(cv);if(!gl)return;
const VS=`#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
uniform mat4 uVP,uModel;
uniform mat3 uNormalMat;
out vec3 vP,vN,vLocal;out vec2 vUV;
void main(){
 vec4 world=uModel*vec4(aPos,1.0);
 vP=world.xyz;vN=uNormalMat*aNormal;vLocal=aPos;vUV=aUV;
 gl_Position=uVP*world;
}`;
const FS=`#version 300 es
precision highp float;
const float PI=3.14159265;
in vec3 vP,vN,vLocal;in vec2 vUV;out vec4 outColor;
uniform sampler2D uColor,uNormal,uARM,uEnv;
uniform vec3 uEye,uSunPos,uLightColor;
uniform float uPower,uAmbient,uEnvPower,uSolarCondition,uImpactAmount,uNormalStrength;
uniform int uDisplayMode,uApplyMasks;

vec3 srgbToLinear(vec3 c){
 return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));
}
vec3 linearToSrgb(vec3 c){
 return mix(12.92*c,1.055*pow(c,vec3(1.0/2.4))-.055,step(vec3(.0031308),c));
}
float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float climateMask(vec3 localPosition,float solarCondition){
 float iceBoundary=mix(.96,.26,solarCondition);
 return smoothstep(iceBoundary-.035,iceBoundary+.035,abs(normalize(localPosition).y));
}
float impactMask(vec2 uv,float amount){
 vec2 gridUV=uv*vec2(14.0,7.0),cell=floor(gridUV),f=fract(gridUV);
 float mask=0.0;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 offset=vec2(float(x),float(y)),cellId=cell+offset;
  float seed=hash21(cellId);
  float enabled=smoothstep(seed-.018,seed+.018,amount);
  if(amount<=0.0)enabled=0.0;
  vec2 jitter=vec2(hash21(cellId+vec2(13.2,7.1)),hash21(cellId+vec2(31.7,19.3)))*.5+.25;
  vec2 delta=f-offset-jitter;delta.x*=.72;
  float radius=mix(.12,.28,hash21(cellId+vec2(57.1,3.7)));
  float distanceToCenter=length(delta);
  float interior=1.0-smoothstep(radius*.52,radius*.68,distanceToCenter);
  float rim=(1.0-smoothstep(radius*.9,radius*1.04,distanceToCenter))
           *smoothstep(radius*.72,radius*.9,distanceToCenter);
  mask=max(mask,(interior*.32+rim*.9)*enabled);
 }
 return clamp(mask,0.0,1.0);
}
vec3 directPBR(vec3 N,vec3 V,vec3 L,vec3 base,float rough,float metal,float power){
 float noL=max(dot(N,L),0.0),noV=max(dot(N,V),0.0);
 if(noL<=0.0||noV<=0.0)return vec3(0.0);
 vec3 H=normalize(V+L);
 float noH=max(dot(N,H),0.0),voH=max(dot(V,H),0.0);
 float a=rough*rough,a2=a*a;
 float dDenom=noH*noH*(a2-1.0)+1.0;
 float D=a2/max(PI*dDenom*dDenom,.000001);
 float k=(rough+1.0)*(rough+1.0)/8.0;
 float Gv=noV/(noV*(1.0-k)+k),Gl=noL/(noL*(1.0-k)+k);
 vec3 F0=mix(vec3(.04),base,metal);
 vec3 F=F0+(1.0-F0)*pow(1.0-voH,5.0);
 vec3 specular=D*Gv*Gl*F/max(4.0*noV*noL,.0001);
 vec3 diffuse=(1.0-F)*(1.0-metal)*base/PI;
 return power*noL*(diffuse+specular)*uLightColor;
}
void main(){
 float climate=climateMask(vLocal,uSolarCondition);
 float impact=impactMask(vUV,uImpactAmount);
 if(uApplyMasks==0){climate=0.0;impact=0.0;}
 if(uDisplayMode==1){
  outColor=vec4(vec3(climate),1.0);return;
 }
 if(uDisplayMode==2){
  outColor=vec4(vec3(impact),1.0);return;
 }
 vec3 stone=srgbToLinear(texture(uColor,vUV).rgb);
 vec3 ice=srgbToLinear(vec3(.48,.78,.91));
 vec3 crater=srgbToLinear(vec3(.24,.105,.055));
 vec3 base=mix(stone,ice,climate);
 base=mix(base,crater,impact);
 vec3 arm=texture(uARM,vUV).rgb;
 float ao=clamp(arm.r,0.0,1.0);
 float rough=mix(arm.g,.84,climate);
 rough=mix(rough,.94,impact);
 float metal=mix(arm.b,.04,climate);
 metal=mix(metal,.12,impact);
 vec3 tangentNormal=texture(uNormal,vUV).rgb*2.0-1.0;
 tangentNormal.xy*=uNormalStrength;
 tangentNormal=normalize(tangentNormal);
 vec3 dp1=dFdx(vP),dp2=dFdy(vP);
 vec2 duv1=dFdx(vUV),duv2=dFdy(vUV);
 vec3 T=normalize(dp1*duv2.y-dp2*duv1.y);
 vec3 B=normalize(-dp1*duv2.x+dp2*duv1.x);
 vec3 N=normalize(mat3(T,B,normalize(vN))*tangentNormal);
 vec3 V=normalize(uEye-vP),toSun=uSunPos-vP;
 float sunDistance=length(toSun);
 vec3 L=toSun/max(sunDistance,.0001);
 float attenuation=uPower/max(sunDistance*sunDistance,.5);
 vec3 color=directPBR(N,V,L,base,rough,metal,attenuation)
           +base*(1.0-metal)*uAmbient*ao;
 vec3 R=reflect(-V,N);
 vec2 envUV=vec2(atan(R.z,R.x)/(2.0*PI)+.5,
                 asin(clamp(R.y,-1.0,1.0))/PI+.5);
 float maxLod=log2(float(max(textureSize(uEnv,0).x,textureSize(uEnv,0).y)));
 vec3 envColor=srgbToLinear(textureLod(uEnv,envUV,rough*maxLod).rgb);
 float noV=max(dot(N,V),0.0);
 vec3 F0=mix(vec3(.04),base,metal);
 vec3 envF=F0+(1.0-F0)*pow(1.0-noV,5.0);
 color+=envColor*envF*uEnvPower*ao;
 color=max(color,vec3(0.0));color=color/(1.0+color);
 outColor=vec4(linearToSrgb(color),1.0);
}`;
const sunVS=`#version 300 es
layout(location=0) in vec3 aPos;uniform mat4 uVP,uModel;
void main(){gl_Position=uVP*uModel*vec4(aPos,1.0);}`;
const sunFS=`#version 300 es
precision highp float;uniform vec3 uSunColor;uniform float uSunGlow;out vec4 outColor;
vec3 linearToSrgb(vec3 c){return mix(12.92*c,1.055*pow(c,vec3(1.0/2.4))-.055,step(vec3(.0031308),c));}
void main(){vec3 c=uSunColor*uSunGlow;c=c/(1.0+c);outColor=vec4(linearToSrgb(c),1.0);}`;
const prog=D.program(gl,VS,FS),U=D.uniforms(gl,prog,[
 'uVP','uModel','uNormalMat','uEye','uSunPos','uLightColor','uPower','uAmbient','uEnvPower',
 'uSolarCondition','uImpactAmount','uNormalStrength','uDisplayMode','uApplyMasks',
 'uColor','uNormal','uARM','uEnv'
]);
const sunProg=D.program(gl,sunVS,sunFS),SU=D.uniforms(gl,sunProg,['uVP','uModel','uSunColor','uSunGlow']);
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
  const a=i*width+j,b=a+width;idx.push(a,b,a+1,a+1,b,b+1);
 }
 return {pos:new Float32Array(pos),nrm:new Float32Array(nrm),uv:new Float32Array(uv),idx:new Uint16Array(idx)};
}
const mesh=D.upload(gl,makeSphere(56));
const textures={},jobs=[];let failed=false;
function load(name){
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([128,128,255,255]));
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
 jobs.push(new Promise(resolve=>{const img=new Image();img.onload=()=>{
  gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
  gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);resolve();
 };img.onerror=()=>{failed=true;resolve();};img.src='assets/week06/'+name;}));
 return tex;
}
textures.color=load('rock_boulder_dry_Diffuse.jpg');
textures.normal=load('rock_boulder_dry_nor_gl.jpg');
textures.arm=load('rock_boulder_dry_arm.png');
textures.env=load('studio_small_09_tonemapped.jpg');
Promise.all(jobs).then(()=>{document.querySelector('#status').textContent=failed?'텍스처 로딩 실패: HTTP 서버와 파일 경로 확인':'재질 텍스처 로딩 완료 · 니바 행성의 환경과 사건을 조절해 보세요';});

const solar=document.querySelector('#solar-condition'),impactAmount=document.querySelector('#impact-amount');
const display=document.querySelector('#display-mode'),compareButton=document.querySelector('#compare-toggle');
const rotateButton=document.querySelector('#rotate-toggle'),labels=document.querySelector('#labels');
const rangeLabels=[
 [solar,'solar-condition-value',v=>`${Math.round(v)} · 거리 ${distanceFor(v).toFixed(1)} AU`],
 [impactAmount,'impact-amount-value',v=>`${Math.round(v)}%`]
];
function distanceFor(value){return 2.4+2.4*value/100;}
function updateLabels(){for(const [input,id,format] of rangeLabels)document.querySelector('#'+id).textContent=format(Number(input.value));}
solar.addEventListener('input',updateLabels);impactAmount.addEventListener('input',updateLabels);updateLabels();
const cam=D.orbit(cv,{dist:12,pitch:.22,yaw:.86,min:5,max:30});
let fittedAspect=0,fitDistance=12;
function cameraFitDistance(aspect){
 const focal=1/Math.tan(Math.PI/8);
 const systemHalfWidth=4.8*.5+.8;
 return Math.max(8.4,systemHalfWidth*Math.sqrt(1+Math.pow(focal/(.82*aspect),2))+.6);
}
document.querySelector('#reset').onclick=()=>{cam.dist=fitDistance;cam.yaw=.86;cam.pitch=.22;};
let compare=false,running=true,previousTime=null,spin=0,orbit=-.3;
rotateButton.onclick=()=>{running=!running;rotateButton.setAttribute('aria-pressed',String(running));rotateButton.textContent=running?'자전·공전 멈춤':'자전·공전 재개';};
compareButton.onclick=()=>{compare=!compare;compareButton.setAttribute('aria-pressed',String(compare));compareButton.textContent=compare?'기본/변화 비교 끄기':'기본/변화 비교';display.disabled=compare;};
display.addEventListener('change',()=>{document.querySelector('#display-note').textContent=display.value==='0'?'태양빛을 받은 니바의 현재 PBR 재질입니다.':display.value==='1'?'검정=서리 없음, 흰색=서리 마스크입니다.':'검정=충돌 흔적 없음, 흰색=충돌 흔적입니다.';});
const view=D.M4.create(),proj=D.M4.create(),vp=D.M4.create(),model=D.M4.create(),sunModel=D.M4.create();
const origin=[0,0,0],sunColor=new Float32Array([1.0,.57,.22]);
document.querySelector('#display-note').textContent='자전·공전이 진행 중입니다. 두 슬라이더와 비교·진단 화면을 사용해 보세요.';
document.querySelector('#note').textContent='니바: 별에서 멀어질수록 극지 서리가 확장되고, 충돌 누적량이 커질수록 독립적인 크레이터 흔적이 늘어납니다.';
document.querySelector('#labels').innerHTML='';
D.loop((time)=>{
 if(document.hidden)return;
 if(previousTime!==null&&running){const dt=Math.min(time-previousTime,.05);spin+=dt*.32;orbit+=dt*.08;}
 previousTime=time;
 D.fit(cv);
 const aspect=cv.width/cv.height;
 if(Math.abs(aspect-fittedAspect)>.02){
  const nextFit=cameraFitDistance(aspect);
  if(fittedAspect)cam.dist*=nextFit/fitDistance;else cam.dist=nextFit;
  fittedAspect=aspect;fitDistance=nextFit;
 }
 gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
 const diagnostic=!compare&&Number(display.value)!==0;
 gl.clearColor(diagnostic?0:.025,diagnostic?0:.035,diagnostic?0:.055,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 const solarValue=Number(solar.value)/100,iceDistance=distanceFor(Number(solar.value));
 const halfWidth=compare?Math.floor(cv.width/2):cv.width;
 const planetPosition=[Math.cos(orbit)*iceDistance,0,Math.sin(orbit)*iceDistance];
 const sceneCenter=[planetPosition[0]*.5,0,planetPosition[2]*.5];
 const viewCenter=compare?origin:sceneCenter;
 const viewDistance=compare?Math.max(6.8,Math.min(8.0,cam.dist*.62)):cam.dist;
 const cp=Math.cos(cam.pitch),eye=[
  viewCenter[0]+viewDistance*cp*Math.sin(cam.yaw),
  viewCenter[1]+viewDistance*Math.sin(cam.pitch),
  viewCenter[2]+viewDistance*cp*Math.cos(cam.yaw)
 ];
 D.M4.lookAt(view,eye,viewCenter,[0,1,0]);
 const sunRelativePosition=compare?[-planetPosition[0],0,-planetPosition[2]]:origin;
 gl.useProgram(prog);gl.uniform3fv(U.uEye,eye);gl.uniform3fv(U.uSunPos,sunRelativePosition);
 gl.uniform3fv(U.uLightColor,[1.0,.82,.62]);
 gl.uniform1f(U.uPower,30.0);gl.uniform1f(U.uAmbient,.12);gl.uniform1f(U.uEnvPower,.42);
 gl.uniform1f(U.uSolarCondition,solarValue);gl.uniform1f(U.uImpactAmount,Number(impactAmount.value)/100);
 gl.uniform1f(U.uNormalStrength,2.2);
 textures.color&&[textures.color,textures.normal,textures.arm,textures.env].forEach((tex,i)=>{
  gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.uniform1i(U[['uColor','uNormal','uARM','uEnv'][i]],i);
 });
 D.M4.identity(model);if(!compare)D.M4.translate(model,model,planetPosition);
 D.M4.rotateZ(model,model,.16);D.M4.rotateY(model,model,spin);
 D.M4.scale(model,model,[.76,.76,.76]);
 gl.uniformMatrix4fv(U.uModel,false,model);gl.uniformMatrix3fv(U.uNormalMat,false,D.M4.normalFrom(model));
 const sunScale=compare ? .52 : .55;
 D.M4.identity(sunModel);D.M4.scale(sunModel,sunModel,[sunScale,sunScale,sunScale]);
 if(compare){
  labels.innerHTML='<span class="compare-label">기본 표면</span><span class="compare-label">마스크 적용</span>';
  gl.viewport(0,0,halfWidth,cv.height);D.M4.perspective(proj,Math.PI/4,halfWidth/cv.height,.1,100);D.M4.multiply(vp,proj,view);
  gl.useProgram(prog);gl.uniformMatrix4fv(U.uVP,false,vp);gl.uniform1i(U.uDisplayMode,0);gl.uniform1i(U.uApplyMasks,0);gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);
  gl.viewport(halfWidth,0,cv.width-halfWidth,cv.height);D.M4.perspective(proj,Math.PI/4,(cv.width-halfWidth)/cv.height,.1,100);D.M4.multiply(vp,proj,view);
  gl.useProgram(prog);gl.uniformMatrix4fv(U.uVP,false,vp);gl.uniform1i(U.uDisplayMode,0);gl.uniform1i(U.uApplyMasks,1);gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);
 }else{
  labels.innerHTML='';
  gl.viewport(0,0,cv.width,cv.height);D.M4.perspective(proj,Math.PI/4,cv.width/cv.height,.1,100);D.M4.multiply(vp,proj,view);
  if(Number(display.value)===0){gl.useProgram(sunProg);gl.uniformMatrix4fv(SU.uVP,false,vp);gl.uniformMatrix4fv(SU.uModel,false,sunModel);gl.uniform3fv(SU.uSunColor,sunColor);gl.uniform1f(SU.uSunGlow,5.0);gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);}
  gl.useProgram(prog);gl.uniformMatrix4fv(U.uVP,false,vp);gl.uniform1i(U.uDisplayMode,Number(display.value));gl.uniform1i(U.uApplyMasks,1);gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);
 }
 gl.bindVertexArray(null);
});
})();
