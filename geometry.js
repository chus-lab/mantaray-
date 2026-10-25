/* Pure geometry. Unit scale is the bell radius; time and phase are continuous. */
(function(root){
 const TAU=Math.PI*2;
 function bell(v,a,s){
  const breath=s.breath??Math.sin(s.phase),wave=Math.sin(a*12-v*10+s.wave),edge=v**5;
  const sc=s.scallop??1,radius=(Math.sin(v*Math.PI*.5)*(1-.09*v)*(1+.065*(s.pulseAmp??1)*breath*(s.pulsePower??1))+edge*.025*sc*wave)*(s.spread??1)*(1-(s.flex??0)*Math.max(0,-breath)*v**4);
  return [Math.cos(a)*radius,-(s.bellH??.91)*Math.cos(v*Math.PI*.5)*(1-.08*(s.pulseAmp??1)*breath)+(s.flex??0)*Math.max(0,-breath)*v**4*.22+edge*sc*(.045*Math.sin(a*12-s.wave)+.025*Math.sin(a*24+s.wave)),Math.sin(a)*radius];
 }
 function ribbon(u,edge,i,s){
  const a=i*TAU/(s.armN??8)+s.seed*.13,len=(1.35+.40*Math.sin(i*2.1+s.seed)**2)*(s.armLen??1);
  const amplitude=.08+s.flow*.19,spiral=a+u*3.4+Math.sin(u*5-s.wave*.6+i)*.3;
  const radius=.22*(1-u)+amplitude*Math.sin(u*5-s.wave*.5+i)*u;
  // Taper the final 35% of each membrane to one shared tip.
  const tipProgress=Math.max(0,Math.min(1,(u-.65)/.35));
  const taper=1-tipProgress*tipProgress;
  const width=(.10+.16*Math.sin(Math.PI*u))*(1-u*.78)*taper*(s.ribbonWidth??1)*(s.armW??1);
  const fold=Math.sin(u*35-s.wave*2+i*.9+edge*2)*.045*Math.sin(u*Math.PI)*taper;
  const vr=.5+.5*Math.sin(i*7.31+s.seed),lr=s.lag?s.lag(u*len*(.85+.3*vr)):[0,0],lag=[lr[0]*(.8+.4*vr),lr[1]*(.8+.4*vr)];
  return [Math.cos(spiral)*radius+Math.cos(spiral+1.3)*edge*width+Math.sin(u*7-s.wave+i)*amplitude*u+s.pointer*u*u*.14+lag[0],u*len-.30*(1-u)**2+fold+.04*Math.sin(s.phase-u*4+i)+lag[1],Math.sin(spiral)*radius+Math.sin(spiral+1.3)*edge*width+fold];
 }
 function tentacle(u,i,s){
  const a=i*TAU/(s.tentN??40),len=(1.55+.50*(.5+.5*Math.sin(i*2.19+s.seed)))*(s.tentLen??1);
  const root=bell(1,a,s),amp=(.06+s.flow*.21+(s.detail??0)*.04)*(s.tentAmp??1);
  // s.lag(d): water-drag displacement (body-local) at distance d below the rim, from the trailing chain simulation.
  const vr=.5+.5*Math.sin(i*12.9898+s.seed),lr=s.lag?s.lag(u*len*(.8+.4*vr)):[0,0],lag=[lr[0]*(.75+.5*vr),lr[1]*(.75+.5*vr)],gather=1-u*(.6+.25*(s.stream??0));
  return [root[0]*gather+amp*u*Math.sin(u*7-s.wave+i*.51)+s.pointer*u*u*.18+lag[0],root[1]+u*len+lag[1],root[2]*gather+amp*u*Math.cos(u*9-s.wave*.8+i)];
 }
 function project(p,view){
  const x=p[0]*Math.cos(view.yaw)+p[2]*Math.sin(view.yaw),z=-p[0]*Math.sin(view.yaw)+p[2]*Math.cos(view.yaw);
  const y=p[1]*Math.cos(view.pitch)-z*Math.sin(view.pitch),depth=p[1]*Math.sin(view.pitch)+z*Math.cos(view.pitch);
  const scale=5/(5+depth);return [view.cx+(x*Math.cos(view.roll)-y*Math.sin(view.roll))*view.radius*scale,view.cy+(x*Math.sin(view.roll)+y*Math.cos(view.roll))*view.radius*scale,depth];
 }
 // A bounded, smooth swimming path. Its phase advances with pulse thrust.
 function swim(q,w,h,r,seed=0){
  const left=24+r*1.42,right=Math.max(left,w-24-r*1.42);
  const top=72+r*1.15,bottom=Math.max(top,h-85-r*2.35);
  const ax=(right-left)*.46,ay=(bottom-top)*.46;
  // Two incommensurate layers per member, so paths never visibly repeat or move in lockstep.
  const k=seed*.731,vx=.78*Math.cos(q)+.11*Math.cos(q*.53+k),vy=Math.cos(q*1.37+.5+k);
  return {cx:(left+right)/2+ax*(.78*Math.sin(q)+.22*Math.sin(q*.53+k)),cy:(top+bottom)/2+ay*(.72*Math.sin(q*1.37+.5+k)+.28*Math.sin(q*.41+k*2)),
   roll:.34*vx,yaw:.25*Math.sin(q+.6+k),trail:-.65*vx,vy};
 }
 const api={bell,ribbon,tentacle,project,swim};if(typeof module!=='undefined')module.exports=api;else root.MedusaGeometry=api;
})(typeof window==='undefined'?globalThis:window);
