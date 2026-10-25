/* 3D stage for the mantas: a Three.js scene inside the shared ABYSS environment.
   app.js keeps its simulation in screen pixels (x, y, radius). The stage maps that onto a vertical plane D metres in
   front of a fixed camera, so a manta's pixel size equals its real size there; each manta then sits a few metres in
   front of or behind that plane. app.js pushes line segments (world xyz + rgba) every frame; they are drawn as one
   LineSegments batch whose shader applies the same water absorption and fog extinction as the environment, so
   mantas deeper in the scene fade, dim and turn blue exactly like the water around them. Bloom softens the lines.
   The WebGL frame is copied into app.js's 2D canvas (#ocean) each frame, so the data overlay, the watermark and the
   Reel recorder (which captures #ocean) work unchanged. */
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {createAbyss} from './shared/abyss/abyss-env.js';
import {mountPanel} from './shared/abyss/abyss-panel.js';
import {SURFACE,ABSORB,NOISE,SUN,CAUSTICS} from './shared/abyss/abyss-glsl.js';

const D=16,FOV=50,BASE=new THREE.Vector3(0,-20,0);
// The stage draws into its own canvas, placed behind the 2D overlay (#ocean) with the same full-window, letterboxed layout.
const canvas=document.createElement('canvas');canvas.id='stage3d';canvas.setAttribute('aria-hidden','true');canvas.style.zIndex='-2';document.body.prepend(canvas);
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
const camera=new THREE.PerspectiveCamera(FOV,1,.1,400),scene=new THREE.Scene();
camera.position.copy(BASE);
// A slightly darker, clearer sea than the demo, so the subject reads through it.
const env=createAbyss(renderer,{fogDensity:.035,lightIntensity:1.1,absorb:.05,count:30000,pBright:.8});scene.add(env.group);

// ---------- Line batch ----------
const MAXSEG=260000,pos=new Float32Array(MAXSEG*6),col=new Float32Array(MAXSEG*8);
const geo=new THREE.BufferGeometry(),pAttr=new THREE.BufferAttribute(pos,3),cAttr=new THREE.BufferAttribute(col,4);
pAttr.setUsage(THREE.DynamicDrawUsage);cAttr.setUsage(THREE.DynamicDrawUsage);
geo.setAttribute('position',pAttr);geo.setAttribute('acolor',cAttr);geo.boundingSphere=new THREE.Sphere(new THREE.Vector3(),1e6);
const lineMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending,uniforms:{...env.uniforms,uDim:{value:1}},
 vertexShader:`attribute vec4 acolor;uniform float uFogDensity,uAbsorb,uLight,uTime,uCaustic;varying vec4 vC;
 ${NOISE}${ABSORB}${SUN}
 const float SURFACE=${SURFACE.toFixed(1)};
 ${CAUSTICS}
 void main(){
  vec3 wp=(modelMatrix*vec4(position,1.0)).xyz;float dist=length(wp-cameraPosition);
  // Extinction along the line of sight: fog plus water absorption (red first) — matches the fog pass.
  vec3 T=exp(-(uFogDensity*0.55+SIGMA*uAbsorb*0.35)*dist);
  // Light from the surface, relative to the camera's depth: higher parts brighter, deeper parts dimmer and bluer.
  vec3 L=exp(-SIGMA*uAbsorb*max(0.0,SURFACE-wp.y)),Lc=exp(-SIGMA*uAbsorb*max(0.0,SURFACE-cameraPosition.y));
  vec3 lit=mix(vec3(1.0),L/max(Lc,vec3(1e-3)),0.6)*clamp(0.55+0.4*uLight,0.3,1.35); // capped: the music's light swings show in the water more than on the mantas
  // The lines take only part of the water's colour filtering (they glow), so each manta keeps its own hue;
  // distance still dims them through the opacity term.
  // Caustics: the surface's moving light net plays over the manta's lines (weaker with depth).
  float cz=1.0+uCaustic*1.4*caustic(wp,uTime)*exp(-max(0.0,SURFACE-wp.y)*0.03);
  vC=vec4(acolor.rgb*mix(vec3(1.0),T,0.45)*min(mix(vec3(1.0),lit,0.5),vec3(2.0))*cz,acolor.a*(0.35+0.65*T.b));
  gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.0);}`,
 fragmentShader:`uniform float uDim;varying vec4 vC;void main(){gl_FragColor=vec4(vC.rgb*vC.a*uDim,1.0);}`});
const lines=new THREE.LineSegments(geo,lineMat);lines.frustumCulled=false;lines.renderOrder=0;scene.add(lines);
// Body fills: triangles (world xyz + alpha) drawn before the lines, writing depth.
// Two layers per manta, stacked toward the viewer: white translucent (deepest) < dark body < lines.
const MAXTRI=80000,tpos=new Float32Array(MAXTRI*9),talpha=new Float32Array(MAXTRI*3),twhite=new Float32Array(MAXTRI*3);
const tgeo=new THREE.BufferGeometry(),tpAttr=new THREE.BufferAttribute(tpos,3),taAttr=new THREE.BufferAttribute(talpha,1);
tpAttr.setUsage(THREE.DynamicDrawUsage);taAttr.setUsage(THREE.DynamicDrawUsage);tgeo.setAttribute('position',tpAttr);tgeo.setAttribute('aalpha',taAttr);const twAttr=new THREE.BufferAttribute(twhite,1);twAttr.setUsage(THREE.DynamicDrawUsage);tgeo.setAttribute('awhite',twAttr);tgeo.boundingSphere=new THREE.Sphere(new THREE.Vector3(),1e6);
const fillMat=new THREE.ShaderMaterial({transparent:true,depthWrite:true,depthTest:true,side:THREE.DoubleSide,uniforms:{...env.uniforms},
 vertexShader:`attribute float aalpha,awhite;uniform float uFogDensity,uAbsorb,uLight,uTime,uCaustic;varying float vA,vW,vT,vC;
 ${NOISE}${ABSORB}${SUN}
 const float SURFACE=${SURFACE.toFixed(1)};
 ${CAUSTICS}
 void main(){vec3 wp=(modelMatrix*vec4(position,1.0)).xyz;float dist=length(wp-cameraPosition);
  // Distance is shown by colour (vT: share of the body's own colour left), not by opacity, so an opaque layer stays
  // opaque and the white one behind never shows through.
  vC=uCaustic*caustic(wp,uTime)*exp(-max(0.0,SURFACE-wp.y)*0.03);vW=awhite;vA=aalpha;vT=exp(-(uFogDensity*0.55+SIGMA.b*uAbsorb*0.35)*dist);gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.0);}`,
 // Dark body, or (awhite = 1) the white, faintly blue translucent layer beneath it.
 fragmentShader:`uniform float uLight;varying float vA,vW,vT,vC;void main(){vec3 c=mix(vec3(0.0,0.006,0.02),vec3(0.86,0.94,1.0),vW)+vec3(0.05,0.12,0.16)*vC;
  // Toward the deep-water colour with distance (roughly the fog's own tone).
  gl_FragColor=vec4(mix(vec3(0.02,0.07,0.13)*clamp(uLight,0.3,2.0),c,vT),vA);}`});
const fills=new THREE.Mesh(tgeo,fillMat);fills.frustumCulled=false;fills.renderOrder=1;scene.add(fills);
let nt=0;
function tri(a,b,c,al,white=0){if(nt>=MAXTRI)return;const i=nt*9,j=nt*3;tpos.set(a,i);tpos.set(b,i+3);tpos.set(c,i+6);talpha[j]=talpha[j+1]=talpha[j+2]=al;twhite[j]=twhite[j+1]=twhite[j+2]=white;nt++;}
// Lines test depth (a nearer body hides them) but do not write it; drawn after the fills.
lineMat.depthTest=true;lines.renderOrder=2;
// Lines behind a body (another manta's, or a manta's own when it rolls belly-up) are not lost: a second pass draws
// only the hidden parts (depth test inverted) at a third of their brightness, as if seen through the translucent body.
const hiddenMat=lineMat.clone();hiddenMat.uniforms={...lineMat.uniforms,uDim:{value:.35}};hiddenMat.depthFunc=THREE.GreaterDepth;
const hiddenLines=new THREE.LineSegments(geo,hiddenMat);hiddenLines.frustumCulled=false;hiddenLines.renderOrder=2;scene.add(hiddenLines);
// Particles also test depth, so drifting motes pass behind a body instead of glowing through it.
for(const o of env.group.children)if(o.isPoints){o.material.depthTest=true;o.renderOrder=3;}
let n=0;
function push(a,b,r,g,bl,al){if(n>=MAXSEG)return;const i=n*6,j=n*8;
 pos[i]=a[0];pos[i+1]=a[1];pos[i+2]=a[2];pos[i+3]=b[0];pos[i+4]=b[1];pos[i+5]=b[2];
 col[j]=col[j+4]=r;col[j+1]=col[j+5]=g;col[j+2]=col[j+6]=bl;col[j+3]=col[j+7]=al;n++;}

// ---------- Composer (bloom) ----------
const composer=new EffectComposer(renderer,new THREE.WebGLRenderTarget(2,2,{type:THREE.HalfFloatType,samples:4}));
composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(2,2),.75,.5,.22);composer.addPass(bloom);

// ---------- Screen ↔ world ----------
let W=1,H=1,unit=1;
// Portrait frames (the 9:16 Reel) get a much wider vertical view (72°, pulled back so more of the sea shows; the
// camera's push-in is cut to 40% there), so the horizontal view does not shrink to a slit and the
// group still fits side by side; the simulation's screen → world mapping (unit) follows the actual field of view.
let fov=FOV;
function resize(w,h,dpr){W=w;H=h;renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);composer.setPixelRatio(dpr);composer.setSize(w,h);
 fov=w<h?72:FOV;camera.fov=fov;camera.aspect=w/h;camera.updateProjectionMatrix();env.resize(w,h,dpr);unit=2*D*Math.tan(fov*Math.PI/360)/h;}
// Body-local point (unit = body radius, y down) → world, with the same yaw / pitch / roll order as MedusaGeometry.project.
// view.cx/cy/radius are pixels; zoff (metres) moves this manta toward (+) or away from (−) the camera.
function local(p,v,dist=D,lift=0){
 let k=v._k;if(!k)k=v._k=[Math.cos(v.yaw),Math.sin(v.yaw),Math.cos(v.pitch),Math.sin(v.pitch),Math.cos(v.roll),Math.sin(v.roll),v.radius*unit];
 const x=p[0]*k[0]+p[2]*k[1],z=-p[0]*k[1]+p[2]*k[0],y=p[1]*k[2]-z*k[3],d=p[1]*k[3]+z*k[2],sx=x*k[4]-y*k[5],sy=x*k[5]+y*k[4],R=k[6];
 // The screen position is kept: the centre is pushed out along its sight line to `dist`, while the body keeps its
 // real size, so nearer mantas look bigger and farther ones smaller.
 // lift (metres) raises the whole body straight up in the water — used for a breach.
 const s=dist/D;return [BASE.x+(v.cx-W/2)*unit*s+sx*R,BASE.y-(v.cy-H/2)*unit*s-sy*R+lift,BASE.z-dist-d*R];}

// ---------- Frame ----------
let last=performance.now();
// ---------- Cinematic camera ----------
// The mantas live at fixed world positions (mapped from the simulation's virtual screen through BASE / D), so the
// render camera can move freely around them. Moves are kept small — push-in ≤ ~25%, orbit ≤ ~13°, small pans —
// so the swimmers, whose bounds are computed for the virtual screen, stay in frame.
// Free mode: slow incommensurate loops. With music: the camera pushes in while the music rises above its own recent
// level, drifts back and up in quiet passages, and gives a tiny damped nudge on each beat.
// It also leans gently toward where the mantas are (their mean screen position).
const cam={t:0,dolly:0,yaw:0,pitch:0,px:0,py:0,fx:0,fy:0,kick:0,kv:0};
const sm=(a,b,dt,tau)=>a+(b-a)*(1-Math.exp(-dt/tau));
function cinematic(dt,c){
 cam.t+=dt;const t=cam.t,on=c&&c.auto,k=W<H?.45:1; // portrait: smaller sideways moves, the frame is narrow
 let dolly=0,yaw=0,pitch=0,px=0,py=0;
 if(on){
  // Loops of 47–83 s; never repeat in step with each other.
  dolly=1.6+1.4*Math.sin(t*.075);yaw=.12*Math.sin(t*.053+1.3);pitch=.06*Math.sin(t*.041+.4);px=.9*Math.sin(t*.061+2.1);py=.5*Math.sin(t*.047);
  if(c.music){const rise=Math.max(-1,Math.min(1,(c.eShort-c.eLong)*3));
   // Rising music: push in (up to +4 m), level the view; quiet: pull back, lift and look down a little.
   dolly=1.4+2.6*Math.max(0,rise)+1.2*(c.eLong-.3)-1.6*Math.max(0,-rise);pitch+=-.05*Math.max(0,-rise);py+=.8*Math.max(0,-rise);
   if(c.beat)cam.kv+=.9*Math.min(1,c.beatStrength??1);}
  // Frame the group: follow the mantas' mean position by up to ~1.5 m.
  cam.fx=sm(cam.fx,(c.focusX??0)*1.5,dt,3);cam.fy=sm(cam.fy,(c.focusY??0)*1.2,dt,3);px+=cam.fx;py+=cam.fy;}
 // Heavy smoothing: every move eases over seconds.
 cam.dolly=sm(cam.dolly,Math.max(-1.5,Math.min(4,dolly))*(W<H?.4:1),dt,on&&c.music?1.6:3);cam.yaw=sm(cam.yaw,yaw*k,dt,3);cam.pitch=sm(cam.pitch,pitch,dt,3);cam.px=sm(cam.px,px*k,dt,2.5);cam.py=sm(cam.py,py,dt,2.5);
 // Beat nudge: a critically damped spring (≈ 4 cm, settles in ~0.4 s).
 cam.kv+=(-60*cam.kick-14*cam.kv)*dt;cam.kick+=cam.kv*dt;
 // Breach: the camera tilts up to follow a manta rising to the surface (c.lift, metres), easing back down after.
 cam.lift=sm(cam.lift??0,c&&c.lift?c.lift:0,dt,c&&c.lift>(cam.lift??0)?.5:.9);
 const target=new THREE.Vector3(BASE.x+cam.px*.6,BASE.y+cam.py*.6+cam.lift*.85,BASE.z-D),r=D-cam.dolly+cam.lift*.15;
 camera.position.set(target.x+Math.sin(cam.yaw)*Math.cos(cam.pitch)*r+cam.px*.4,target.y+Math.sin(cam.pitch)*r+cam.py*.4,target.z+Math.cos(cam.yaw)*Math.cos(cam.pitch)*r+cam.kick*.05);
 camera.lookAt(target);}
function render(pointer=0,c=null){
 const now=performance.now(),dt=Math.min(.1,(now-last)/1000);last=now;
 cinematic(dt,c);
 // Pointer parallax on top: the camera slides a little, the mantas stay put in the water.
 camera.position.x+=pointer*1.4;camera.rotateY(-pointer*.035);
 geo.setDrawRange(0,n*2);tgeo.setDrawRange(0,nt*3);
 for(const a of [tpAttr,taAttr,twAttr]){if(a.addUpdateRange){a.clearUpdateRanges();a.addUpdateRange(0,nt*(a===tpAttr?9:3));}a.needsUpdate=true;}
 for(const a of [pAttr,cAttr]){if(a.addUpdateRange){a.clearUpdateRanges();a.addUpdateRange(0,n*(a===pAttr?6:8));}a.needsUpdate=true;}
 env.update(camera,dt);env.renderFog(renderer);composer.render();n=0;nt=0;}

// Screen pixel of the simulation's virtual screen → world point at `dist` metres (same mapping as local()).
const toWorld=(px,py,dist=D)=>{const s=dist/D;return [BASE.x+(px-W/2)*unit*s,BASE.y-(py-H/2)*unit*s,BASE.z-dist];};
// World → screen pixels (of the simulation's screen, like m.x / m.y), through the camera actually rendering.
const _v=new THREE.Vector3();
const screen=p=>{_v.set(p[0],p[1],p[2]).project(camera);return [(_v.x*.5+.5)*W,(-_v.y*.5+.5)*H,_v.z];};
window.Stage={canvas,env,push,tri,local,toWorld,screen,D,surfaceLift:SURFACE-BASE.y,resize,render,mountPanel:el=>mountPanel(el,env),get unit(){return unit;}};
dispatchEvent(new Event('stage-ready'));
