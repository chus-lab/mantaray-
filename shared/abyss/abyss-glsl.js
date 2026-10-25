/* Shared GLSL for the ABYSS environment and anything placed inside it (so subjects fog, dim and tint exactly like
   the water around them). Export strings are pasted into shaders with template literals. */
// World units are metres; the sea surface lies at y = SURFACE.
export const SURFACE=8;
// 3D simplex noise (Ashima / Stefan Gustavson), fbm and a divergence-free curl field.
export const NOISE=`
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
 const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
 vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
 vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
 vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+2.0*C.xxx;vec3 x3=x0-1.0+3.0*C.xxx;
 i=mod(i,289.0);
 vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
 float n_=1.0/7.0;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.0*floor(p*ns.z*ns.z);
 vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
 vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
 vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
 vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
 vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
 vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
 return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}
float fbm(vec3 p){return 0.62*snoise(p)+0.28*snoise(p*2.03+7.1)+0.10*snoise(p*4.11-3.7);}
// curl(ψ) with ψ = three decorrelated noise potentials: divergence-free, so the water swirls instead of piling up.
vec3 curl(vec3 p){const float e=0.1;
 vec3 dx=vec3(e,0,0),dy=vec3(0,e,0),dz=vec3(0,0,e);
 #define PSI(q) vec3(snoise(q),snoise(q+vec3(31.4,-17.2,5.9)),snoise(q+vec3(-11.3,47.1,23.7)))
 vec3 px0=PSI(p-dx),px1=PSI(p+dx),py0=PSI(p-dy),py1=PSI(p+dy),pz0=PSI(p-dz),pz1=PSI(p+dz);
 return vec3((py1.z-py0.z)-(pz1.y-pz0.y),(pz1.x-pz0.x)-(px1.z-px0.z),(px1.y-px0.y)-(py1.x-py0.x))/(2.0*e);}
`;
// Absorption per channel (1/m): red is lost first, then green; blue survives.
export const ABSORB=`const vec3 SIGMA=vec3(4.2,1.35,0.75);`;

// Light from the surface reaching world point p (scaled by uAbsorb, uLight), without the shafts.
export const DEPTH_LIGHT=`vec3 depthLight(vec3 p,float absorb,float light){return exp(-SIGMA*absorb*max(0.0,${SURFACE.toFixed(1)}-p.y))*light;}`;
// Direction toward the sun, slightly off vertical (so beams slant and converge in perspective). Needs nothing else.
export const SUN=`const vec3 SUN_DIR=normalize(vec3(0.28,1.0,0.18));`;
// Caustics: the moving net of light that surface waves focus onto anything below. Trace from p back toward the sun to
// the surface point, read two ridged wave-noise layers there; deeper points see a larger, softer, weaker pattern.
// Needs NOISE, SUN and a `const float SURFACE` in the shader. Returns roughly 0–1.
export const CAUSTICS=`
float caustic(vec3 p,float t){
 float depth=max(0.0,SURFACE-p.y);vec3 s=p+SUN_DIR*(depth/SUN_DIR.y);
 float blur=1.0+depth*0.06;vec2 q=s.xz*0.35/blur;
 float n1=snoise(vec3(q,t*0.35)),n2=snoise(vec3(q*1.9+7.3,t*0.5));
 return (pow(1.0-abs(n1),6.0)*0.65+pow(1.0-abs(n2),8.0)*0.35)/(0.6+0.4*blur);}`;
