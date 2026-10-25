/* ABYSS — a deep-sea environment computed entirely on the GPU from noise functions and time, packaged so any
   Three.js scene can live inside it.
   1. Water (reduced resolution): a full-screen ray march through near-uniform haze (open water is even, with only faint
      variations). Every sample absorbs light per channel (Beer–Lambert, red first) and in-scatters sunlight, weighted
      by the Henyey–Greenstein phase function toward the sun. Light shafts come from the moving surface: each point
      looks back toward the sun to the surface above it, so beams run parallel to the sun direction (converging in
      perspective), sway with the waves and fade with depth. Looking up shows a faint rippling surface and Snell's window.
   2. Particles (marine snow): tens of thousands of points wrapped in a box around the camera, sinking slowly, carried by
      a broad gentle current, lit by the same absorption and by caustics — so near / mid / far layers separate.
   Caustics (abyss-glsl.js) are shared so hosts can light their own subjects with the same moving light net.
   The host owns renderer, camera and loop:
     const env=createAbyss(renderer,{...params});scene.add(env.group);
     each frame: env.update(camera,dt);env.renderFog(renderer);renderer.render(scene,camera);
   env.uniforms (uFogDensity, uAbsorb, uLight, uMaxDist) can be shared with the host's own materials, so subjects
   inside the water fog and dim by the same law (see abyss-glsl.js). */
import * as THREE from 'three';
import {SURFACE,NOISE,ABSORB,SUN,CAUSTICS} from './abyss-glsl.js';

export const DEFAULTS={fogDensity:.045,fogScale:.06,fogContrast:.3,steps:26,lightIntensity:1.2,shaftGain:1,shaftSharp:4,phaseG:.85,absorb:.06,caustics:1,
 flowSpeed:.18,flowAmp:.35,flowScale:.05,sink:1,count:36000,pSize:1.4,pBright:.9,maxDist:70};
// Slider ranges, labels and grouping, used by abyss-panel.js.
export const SCHEMA=[
 ['霧氣 · Volumetric Fog',[['fogDensity','濃度',0,.12,.002],['fogScale','噪聲尺度',.02,.4,.01],['fogContrast','層次對比',0,2,.05],['steps','步進數',8,48,1]]],
 ['光線 · Light Scattering',[['lightIntensity','光強',0,3,.05],['shaftGain','光柱亮度',0,4,.05],['shaftSharp','光柱銳利度',1,12,.5],['phaseG','前向散射 g',0,.95,.01],['absorb','深度吸收',0,.2,.005],['caustics','水紋光影',0,3,.05]]],
 ['海流 · Current Field',[['flowSpeed','流速',0,1,.01],['flowAmp','擾動強度',0,3,.05],['flowScale','渦流尺度',.02,.5,.01],['sink','微粒下沉',0,3,.05]]],
 ['微粒 · Depth Particles',[['count','數量',2000,60000,1000],['pSize','大小',.2,4,.1],['pBright','亮度',0,2,.05]]],
 ['空間 · Depth',[['maxDist','能見距離',20,140,1]]]];

export function createAbyss(renderer,init={}){
 const P={...DEFAULTS,...init};
 // Uniforms shared by the fog, the particles and (optionally) the host's own materials.
 const shared={uTime:{value:0},uFogDensity:{value:P.fogDensity},uAbsorb:{value:P.absorb},uLight:{value:P.lightIntensity},uMaxDist:{value:P.maxDist},uCaustic:{value:P.caustics}};

 // ---------- Fog ----------
 const fogTarget=new THREE.WebGLRenderTarget(2,2,{type:THREE.HalfFloatType,depthBuffer:false});
 const fogMat=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,
  uniforms:{...shared,uCamPos:{value:new THREE.Vector3()},uCamWorld:{value:new THREE.Matrix4()},uProjInv:{value:new THREE.Matrix4()},
   uFogScale:{value:P.fogScale},uFogContrast:{value:P.fogContrast},uSteps:{value:P.steps},uShaftGain:{value:P.shaftGain},uShaftSharp:{value:P.shaftSharp},uG:{value:P.phaseG},uFlow:{value:new THREE.Vector3()}},
  vertexShader:`varying vec2 vNdc;void main(){vNdc=position.xy;gl_Position=vec4(position.xy,0.0,1.0);}`,
  fragmentShader:`precision highp float;varying vec2 vNdc;
  uniform float uTime,uFogDensity,uFogScale,uFogContrast,uSteps,uLight,uShaftGain,uShaftSharp,uG,uAbsorb,uMaxDist;
  uniform vec3 uCamPos,uFlow;uniform mat4 uCamWorld,uProjInv;
  ${NOISE}${ABSORB}${SUN}
  const float SURFACE=${SURFACE.toFixed(1)};
  float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
  // Henyey–Greenstein: how much light scatters toward the eye at angle θ from the light direction.
  float hg(float c,float g){float g2=g*g;return (1.0-g2)/(4.0*3.14159*pow(1.0+g2-2.0*g*c,1.5));}
  // Light reaching p: absorbed over (SURFACE - y), shaped into shafts by the waves on the surface point p sees when it
  // looks toward the sun. Every point on one sun ray reads the same surface spot, so shafts run along SUN_DIR; the
  // wave pattern moves, so they sway. Shafts fade with depth (beams are a shallow-water sight).
  vec3 sun(vec3 p){
   float depth=max(0.0,SURFACE-p.y);vec3 att=exp(-SIGMA*uAbsorb*depth);
   vec2 q=(p.xz+SUN_DIR.xz*(depth/SUN_DIR.y))*0.06;
   float w=snoise(vec3(q,uTime*0.05))*0.6+snoise(vec3(q*2.3+3.1,uTime*0.09))*0.4;
   float shaft=pow(clamp(0.5+0.5*w,0.0,1.0),uShaftSharp)*(0.25+0.75*exp(-depth*0.035));
   // uShaftGain scales only the shafts, not the ambient glow between them.
   return att*(shaft*1.8*uShaftGain+0.12)*uLight;}
  // Near-uniform haze: a gentle ±(0.8 × contrast) variation on a constant density, slightly thicker at depth.
  float density(vec3 p){
   float n=fbm(p*uFogScale+uFlow)*uFogContrast;
   float layer=1.0+0.25*clamp((-p.y-10.0)*0.05,-1.0,1.5);
   return uFogDensity*max(0.0,1.0+n*0.8)*layer;}
  void main(){
   vec4 v=uProjInv*vec4(vNdc,1.0,1.0);vec3 rd=normalize((uCamWorld*vec4(normalize(v.xyz/v.w),0.0)).xyz);
   vec3 ro=uCamPos;float n=uSteps,dt=uMaxDist/n,t=dt*hash(gl_FragCoord.xy+fract(uTime)*91.7);
   vec3 T=vec3(1.0),col=vec3(0.0);
   // Strong forward lobe toward the sun plus an even share of multiply-scattered light, so water looks lit from any angle.
   float ph=hg(dot(rd,SUN_DIR),uG)*4.0+0.7;
   for(int i=0;i<48;i++){
    if(float(i)>=n)break;
    vec3 p=ro+rd*t;float d=density(p);
    // Extinction: the fog itself plus the water's own absorption along the ray.
    vec3 ext=d+SIGMA*uAbsorb*0.35;
    col+=T*d*sun(p)*vec3(0.55,0.85,1.0)*ph*dt*4.0;
    T*=exp(-ext*dt);t+=dt;}
   // Beyond the visible distance: a faint glow overhead fading to black below, brightest toward the sun.
   float up=clamp(rd.y*0.5+0.5,0.0,1.0),camAtt=exp(-SIGMA.b*uAbsorb*max(0.0,SURFACE-ro.y)*0.5);
   vec3 bg=mix(vec3(0.0,0.004,0.012),vec3(0.02,0.09,0.16)*uLight,pow(up,3.0))*exp(-SIGMA*uAbsorb*max(0.0,SURFACE-ro.y)*0.5);
   bg+=vec3(0.04,0.14,0.22)*uLight*pow(max(dot(rd,SUN_DIR),0.0),6.0)*camAtt;
   // The surface seen from below: inside Snell's window (within ~49° of straight up) the sky shows through, rippling;
   // outside it the surface mirrors the dark water. Faint at depth.
   if(rd.y>0.05){float ts=(SURFACE-ro.y)/rd.y;vec3 hit=ro+rd*ts;float win=smoothstep(0.62,0.7,rd.y);
    float rip=0.55+0.45*snoise(vec3(hit.xz*0.25,uTime*0.12));
    bg+=vec3(0.06,0.2,0.3)*uLight*(win*rip+(1.0-win)*0.08*rip)*exp(-SIGMA*uAbsorb*ts*0.5);}
   gl_FragColor=vec4(col+T*bg,1.0);}`});
 const fogScene=new THREE.Scene(),quadCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
 const tri=new THREE.BufferGeometry();tri.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
 const fogQuad=new THREE.Mesh(tri,fogMat);fogQuad.frustumCulled=false;fogScene.add(fogQuad);

 // Background: the fog upscaled with a gentle 5-tap blur (also hides the ray-march jitter), drawn first.
 const compMat=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{uFog:{value:fogTarget.texture},uTexel:{value:new THREE.Vector2()}},
  vertexShader:`varying vec2 vUv;void main(){vUv=position.xy*0.5+0.5;gl_Position=vec4(position.xy,0.0,1.0);}`,
  fragmentShader:`varying vec2 vUv;uniform sampler2D uFog;uniform vec2 uTexel;
  void main(){vec3 c=texture2D(uFog,vUv).rgb*0.4;
   c+=texture2D(uFog,vUv+vec2(uTexel.x,0.0)).rgb*0.15;c+=texture2D(uFog,vUv-vec2(uTexel.x,0.0)).rgb*0.15;
   c+=texture2D(uFog,vUv+vec2(0.0,uTexel.y)).rgb*0.15;c+=texture2D(uFog,vUv-vec2(0.0,uTexel.y)).rgb*0.15;
   // Soft tone curve keeps the shafts from clipping.
   c=1.0-exp(-c*1.6);gl_FragColor=vec4(pow(c,vec3(0.92)),1.0);}`});
 const background=new THREE.Mesh(tri,compMat);background.frustumCulled=false;background.renderOrder=-10;

 // ---------- Particles ----------
 const MAXP=60000,BOX=new THREE.Vector3(90,50,90);
 const pg=new THREE.BufferGeometry(),base=new Float32Array(MAXP*3),seed=new Float32Array(MAXP);
 for(let i=0;i<MAXP;i++){base[i*3]=Math.random();base[i*3+1]=Math.random();base[i*3+2]=Math.random();seed[i]=Math.random();}
 pg.setAttribute('position',new THREE.BufferAttribute(base,3));pg.setAttribute('seed',new THREE.BufferAttribute(seed,1));
 pg.setDrawRange(0,P.count);pg.boundingSphere=new THREE.Sphere(new THREE.Vector3(),1e6);
 const pMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,
  uniforms:{...shared,uCamPos:{value:new THREE.Vector3()},uBox:{value:BOX},uFlow:{value:new THREE.Vector3()},uFlowAmp:{value:P.flowAmp},
   uFlowScale:{value:P.flowScale},uSize:{value:P.pSize},uBright:{value:P.pBright},uScale:{value:1},
   uStir:{value:[0,1,2,3].map(()=>new THREE.Vector4())},uSink:{value:P.sink}},
  vertexShader:`attribute float seed;uniform vec4 uStir[4];uniform float uTime,uFlowAmp,uFlowScale,uSize,uScale,uAbsorb,uFogDensity,uLight,uMaxDist,uSink,uCaustic;uniform vec3 uCamPos,uBox,uFlow;
  varying float vAlpha,vSoft;varying vec3 vTint;
  ${NOISE}${ABSORB}${SUN}
  const float SURFACE=${SURFACE.toFixed(1)};
  ${CAUSTICS}
  void main(){
   // Each particle lives in a box that wraps around the camera, so the field is endless in every direction.
   // Marine snow sinks slowly (3–9 cm/s here, faster for bigger flakes) while the current carries it.
   vec3 p=position*uBox+uFlow*(6.0+4.0*seed)-vec3(0.0,uTime*(0.03+0.06*seed)*uSink,0.0);
   p=uCamPos+mod(p-uCamPos+0.5*uBox,uBox)-0.5*uBox;
   // Current: a broad, gentle curl-noise sway (large scale, small amplitude) on top of the mean drift.
   p+=curl(p*uFlowScale+vec3(0.0,0.0,uTime*0.035))*uFlowAmp*(0.6+0.8*seed);
   // Stirs (xyz = a point the disturbance passes through, w = strength 0–1). Each acts on a cone from the camera
   // through that point (radius 0.6 m + 16% of the distance), so everything along the sight line — near, mid and far —
   // is pushed out from the cone's axis and swirled around it. Stirred particles also brighten (vStir).
   float stirred=0.0;
   for(int i=0;i<4;i++){if(uStir[i].w<0.005)continue;vec3 dir=normalize(uStir[i].xyz-uCamPos),d=p-uCamPos;float t=dot(d,dir);
    vec3 perp=d-dir*t;float R=0.6+0.16*max(t,0.0),f=uStir[i].w*exp(-dot(perp,perp)/(R*R))*smoothstep(0.0,3.0,t);
    vec3 out_=normalize(perp+vec3(1e-4));p+=out_*f*R*0.9+cross(dir,out_)*f*R*0.7*(seed-0.5)*2.0;stirred=max(stirred,f);}
   vec4 mv=modelViewMatrix*vec4(p,1.0);float dist=-mv.z;
   // Depth attenuation: Beer–Lambert on water plus a fog term — the same law as the fog pass.
   float vis=exp(-dist*(uAbsorb*1.1+uFogDensity*0.6))*smoothstep(uMaxDist,uMaxDist*0.6,dist);
   float depthP=max(0.0,SURFACE-p.y),lit=exp(-uAbsorb*1.2*depthP)*uLight*(1.0+uCaustic*1.5*caustic(p,uTime)*exp(-depthP*0.03));
   // Foreground: very near particles grow large and soft (out of focus), the strongest parallax layer.
   float near=smoothstep(3.0,0.8,dist);
   float size=uSize*(0.6+1.8*seed*seed)*(1.0+near*2.5);
   gl_PointSize=clamp(size*uScale/max(dist,0.5),0.0,48.0);
   float tw=0.75+0.25*sin(uTime*(0.4+seed*1.3)+seed*40.0);
   vAlpha=vis*tw*(0.35+0.65*lit)*(1.0-near*0.75)*smoothstep(0.15,0.6,dist)*(1.0+2.5*stirred);vSoft=near;
   vTint=mix(vec3(0.35,0.75,0.95),vec3(0.25,0.35,0.85),clamp(dist/uMaxDist,0.0,1.0))*exp(-SIGMA*uAbsorb*dist*0.25);
   gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`uniform float uBright;varying float vAlpha,vSoft;varying vec3 vTint;
  void main(){vec2 c=gl_PointCoord-0.5;float r=length(c)*2.0;if(r>1.0)discard;
   float core=mix(exp(-r*r*6.0),1.0-smoothstep(0.55,1.0,r),vSoft);
   gl_FragColor=vec4(vTint*core*vAlpha*uBright,1.0);}`});
 const points=new THREE.Points(pg,pMat);points.frustumCulled=false;points.renderOrder=-5;

 const group=new THREE.Group();group.add(background,points);

 // ---------- Parameters ----------
 const set={fogDensity:v=>shared.uFogDensity.value=v,fogScale:v=>fogMat.uniforms.uFogScale.value=v,fogContrast:v=>fogMat.uniforms.uFogContrast.value=v,
  steps:v=>fogMat.uniforms.uSteps.value=v,lightIntensity:v=>shared.uLight.value=v,shaftGain:v=>fogMat.uniforms.uShaftGain.value=v,shaftSharp:v=>fogMat.uniforms.uShaftSharp.value=v,phaseG:v=>fogMat.uniforms.uG.value=v,
  absorb:v=>shared.uAbsorb.value=v,caustics:v=>shared.uCaustic.value=v,sink:v=>pMat.uniforms.uSink.value=v,flowSpeed:()=>{},flowAmp:v=>pMat.uniforms.uFlowAmp.value=v,flowScale:v=>pMat.uniforms.uFlowScale.value=v,
  count:v=>pg.setDrawRange(0,Math.round(v)),pSize:v=>pMat.uniforms.uSize.value=v,pBright:v=>pMat.uniforms.uBright.value=v,maxDist:v=>shared.uMaxDist.value=v};
 // `params` holds what the panel set; `live` lets a host modulate on top each frame (e.g. music) without
 // overwriting the user's values: the applied value is params[k] * (live[k] ?? 1).
 const live={};
 function apply(k){if(set[k])set[k](P[k]*(live[k]??1));}
 function setParam(k,v){P[k]=v;apply(k);}
 function modulate(k,f){live[k]=f;apply(k);}
 for(const k in P)apply(k);

 // ---------- Size & adaptive fog resolution ----------
 let fogScale=.5,W=1,H=1,pr=1,acc=0,frames=0,adaptT=0,fps=0;const listeners=new Set();
 function sizeFog(){fogTarget.setSize(Math.max(2,Math.round(W*pr*fogScale)),Math.max(2,Math.round(H*pr*fogScale)));compMat.uniforms.uTexel.value.set(1/fogTarget.width,1/fogTarget.height);listeners.forEach(f=>f(stats()));}
 function resize(w,h,pixelRatio){W=w;H=h;pr=pixelRatio;pMat.uniforms.uScale.value=H*pr*.22;sizeFog();}
 const stats=()=>({fps,fogScale});

 const flow=new THREE.Vector3();let time=0;
 function update(camera,dt){
  time+=dt;shared.uTime.value=time;
  // Mean current: a slow meandering drift whose heading itself turns with time.
  const a=time*.017,s=P.flowSpeed*(live.flowSpeed??1);flow.x+=Math.cos(a)*s*dt*.25;flow.z+=Math.sin(a*1.3)*s*dt*.25;flow.y+=s*dt*.03;
  camera.updateMatrixWorld();
  const u=fogMat.uniforms;u.uCamPos.value.copy(camera.position);u.uCamWorld.value.copy(camera.matrixWorld);u.uProjInv.value.copy(camera.projectionMatrixInverse);u.uFlow.value.copy(flow).multiplyScalar(.15);
  pMat.uniforms.uCamPos.value.copy(camera.position);pMat.uniforms.uFlow.value.copy(flow);
  // Adaptive quality: every 2s trade fog resolution for frame rate (target ≥ 50 fps).
  acc+=dt;frames++;adaptT+=dt;
  if(acc>=.5){fps=frames/acc;acc=0;frames=0;
   if(adaptT>2){adaptT=0;const next=fps<45?Math.max(.25,fogScale-.08):fps>58&&fogScale<.6?fogScale+.04:fogScale;if(next!==fogScale){fogScale=next;sizeFog();}else listeners.forEach(f=>f(stats()));}}
 }
 function renderFog(r){const prev=r.getRenderTarget();r.setRenderTarget(fogTarget);r.render(fogScene,quadCam);r.setRenderTarget(prev);}
 // Up to 4 disturbances in the particle field: a cone from the camera through world point xyz, strength 0–1.
 // The host eases them in and out.
 function setStir(i,x,y,z,s){pMat.uniforms.uStir.value[i].set(x,y,z,s);}
 return {group,uniforms:shared,params:P,setParam,modulate,setStir,resize,update,renderFog,onStats:f=>listeners.add(f),get time(){return time;}};
}
