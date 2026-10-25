/* Manta surface M(u,v;P), after the parametric design sheet. Unit scale: body length L = 2 (head y≈-1, tail root y≈.75);
   x is the span, y runs head → tail, z is dorsal (−) / ventral (+) depth.
   Planform: u ∈ [-1,1] across the span, v ∈ [0,1] from leading to trailing edge. The edges are cubic Béziers in a = |u|,
   the right half mirrors the left (P_r = M·P_l, M = diag(1,−1,1) in the sheet's frame). Thickness is a Gaussian
     h(u,v) = H₀·exp(−(u²/a_t² + v'²/b_t²))
   and the wings hinge along the body: each span station rotates by θ(a) = flap·a^1.4, travelling outward as a wave. */
(function(root){
 const TAU=Math.PI*2;
 const bez=(t,p0,p1,p2,p3)=>{const m=1-t;return m*m*m*p0+3*m*m*t*p1+3*m*t*t*p2+t*t*t*p3;};
 // Leading / trailing edge (y) at span fraction a. Both meet at the wing tip, so the chord closes to a point.
 function edges(a,s){
  const tip=s.tipY??.12,le=bez(a,-.7,-.76,-.3+(s.sweep??0)*.2,tip),te=bez(a,.48,.26,.32,tip);
  // Body and pelvic fins: the trailing edge reaches further back near the midline.
  return [le,te+(s.body??.22)*Math.exp(-((a/.22)**2))];
 }
 function noise(u,v,s){const t=s.phase??0;return (Math.sin(3*u+7.3*v+t*.7)+Math.sin(5*u-4.1*v-t*.5+1.7)*.6+Math.sin(9*u+11*v+t*1.3+s.seed)*.3)/1.9*(s.noise??0);}
 function surface(u,v,s){
  const a=Math.abs(u),side=Math.sign(u)||1,S=(s.span??1.75)*(1+.04*(s.breath??0)),[le,te]=edges(a,s);
  const y0=le+(te-le)*v,vc=v*2-1;
  // Dorsal dome: thickest over the body, thin over the wings; ripple runs chordwise.
  const thick=(s.thick??.16)*Math.exp(-(a*a/.09+vc*vc/1.6))*Math.sin(Math.PI*v)**.6+.012*Math.sin(Math.PI*v)*(1-a);
  const ripple=(s.ripple??0)*a*Math.sin(a*9-v*4-(s.wave??0)*2)*.03;
  // Flap: a hinge wave travelling out to the tip (later at the tip, bigger there) and back along the chord.
  const th=(s.flap??0)*(1+(s.asym??0)*side)*a**1.4*Math.cos((s.flapPh??0)-a*1.1-v*.5),x0=a*S;
  let x=side*x0*Math.cos(th*.9),z=-x0*Math.sin(th)-thick+ripple+noise(u,v,s)*a;
  const lr=s.lag?s.lag(Math.max(0,y0+.2)*.4):[0,0],trail=Math.max(0,y0+.2)*.3;
  return [x+lr[0]*trail+(s.pointer??0)*.05*a,y0+lr[1]*trail*.5,z];
 }
 // Cephalic lobe: a log spiral r = r₀e^{kθ} rolled forward from the head corner, curling inward.
 function lobe(q,side,s){
  const curl=s.curl??1,th=q*Math.PI*1.1*curl,r=(s.lobeLen??.32)*1.4*Math.exp(-.35*th)*(1-.3*q);
  const bx=.24,by=-.73,x=bx+Math.sin(th*.55)*r*.35,y=by-Math.sin(th)*r*.9,z=-r*(1-Math.cos(th))*.6-.03;
  // Unrolled (feeding): a flat paddle reaching forward and slightly inward, funnelling water to the mouth.
  const f=s.unfurl??0;if(!f)return [side*x,y,z];
  const L=(s.lobeLen??.32)*1.4,ux=bx-.06*q,uy=by-q*L*1.1,uz=-.02-.03*q;
  return [side*(x+(ux-x)*f),y+(uy-y)*f,z+(uz-z)*f];
 }
 // Tail: a thin whip from the body tip, tapering (r = r₀e^{−λt}) and carried by the drag chain.
 function tail(q,s){
  const len=s.tailLen??1.3,y0=edges(0,s)[1]-.05,d=q*len,lr=s.lag?s.lag(.4+d):[0,0],lb=s.lag?s.lag(.4):[0,0];
  const sw=Math.sin(q*5-(s.wave??0)*1.5)*.06*q;
  return [(lr[0]-lb[0])+sw,y0+d+(lr[1]-lb[1])*.6,.04*Math.sinh(q*1.2)];
 }
 const api={edges,surface,lobe,tail};if(typeof module!=='undefined')module.exports=api;else root.MantaGeometry=api;
})(typeof window==='undefined'?globalThis:window);
