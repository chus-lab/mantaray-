'use strict';
// #ocean is the composite: the 3D stage (stage3d.js) is copied in each frame, then the data overlay and watermark.
const canvas=document.getElementById('ocean'),ctx=canvas.getContext('2d');
const G=window.MedusaGeometry,M=window.MusicModel,A=window.medusaAudio,TAU=Math.PI*2;
const params={energy:0,flow:1,light:.9,hue:0};
const population=new M.Population(2);window.medusaPopulation=population;
let w=0,h=0,dpr=1,last=null,lastPaint=0,time=0,age=0,phase=0,wave=0,travel=0,seed=2,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,pointer=0,targetPointer=0,dirty=true,audioSession=false,beatGlow=0,bodyLight=.75,soft=M.empty(),groupScale=1,growth=.25,pulseRate=.82,lastUI=0;
let sound=M.empty(),visual={...params},bodyAlpha=1;
const controls=document.getElementById('controls'),toggle=document.getElementById('panelToggle');
function panel(open){controls.hidden=!open;toggle.setAttribute('aria-expanded',String(open));document.getElementById('toggleIcon').textContent=open?'−':'+';}
panel(false);toggle.onclick=()=>{panel(controls.hidden);if(!controls.hidden)window.closeMusicPanel?.();};
// Reel recording renders a fixed 540×960 world at 2× (1080×1920 pixels), letterboxed on screen.
function resize(){const ow=w,oh=h;if(window.reelActive){w=540;h=960;dpr=2;}else{w=innerWidth;h=innerHeight;dpr=Math.min(devicePixelRatio||1,1.5);}
 // Keep swimmers in the same relative place when the frame changes size (e.g. entering 9:16 recording).
 if(ow&&oh&&(ow!==w||oh!==h)&&typeof population!=='undefined')for(const m of population.members){if(m.x===undefined)continue;const sx=w/ow,sy=h/oh;m.x*=sx;m.y*=sy;m.vx*=sx;m.vy*=sy;if(m.chain)for(const n of m.chain){n.x*=sx;n.px*=sx;n.y*=sy;n.py*=sy;}}canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);window.Stage?.resize(w,h,dpr);dirty=true;}addEventListener('resize',resize);resize();
for(const key of ['energy','flow','light']){const input=document.getElementById(key);input.oninput=()=>{params[key]=+input.value/100;document.getElementById(key+'Val').textContent=input.value+'%';dirty=true;};}
document.querySelectorAll('[data-hue]').forEach(b=>b.onclick=()=>{params.hue=+b.dataset.hue;document.querySelectorAll('[data-hue]').forEach(x=>{const active=x===b;x.classList.toggle('active',active);x.setAttribute('aria-pressed',String(active));});dirty=true;});
function resetWorld(nextSeed){time=age=phase=wave=travel=0;seed=nextSeed;population.reset(seed);sound=M.empty();soft=M.empty();beatGlow=0;groupScale=1;growth=.25;dirty=true;}
A.addEventListener('session',()=>{audioSession=true;paused=false;resetWorld(A.seed);});
A.addEventListener('change',()=>{dirty=true;if(A.status==='ended'){population.finished=true;if(A.duration){age=1;growth=1;time=A.elapsed;}}syncControls();});
function syncControls(){
 const locked=audioSession;document.getElementById('manualFields').disabled=locked;document.getElementById('manualBadge').textContent=locked?'AUDIO':'MANUAL';
 document.getElementById('manualHint').textContent=locked?'參數由音樂驅動。即時來源的暫停只停止魟魚，來源仍會播放。':'連接音樂後，下列參數會由聲音驅動。';
 document.getElementById('pause').textContent=(audioSession?A.status!=='playing':paused)?'▷ 繼續':'Ⅱ 暫停';
 document.getElementById('pause').disabled=audioSession&&!['playing','paused','ready'].includes(A.status);
 document.getElementById('reset').textContent=audioSession?'開始新曲':'↻ 重新生長';
 document.getElementById('reset').disabled=audioSession&&!A.buffer&&!A.stream;
}
window.pauseMedusa=async()=>{try{if(audioSession)await A.toggle();else paused=!paused;}catch(e){A.message=A.errorText(e);A.notify();}last=null;dirty=true;syncControls();};
document.getElementById('pause').onclick=window.pauseMedusa;
document.getElementById('reset').onclick=async()=>{if(audioSession){try{await A.restart();}catch(e){A.message=A.errorText(e);A.notify();}}else resetWorld(++seed);};
window.manualMedusa=()=>{A.disconnect('已切換為手動演算。');audioSession=false;paused=false;resetWorld(++seed);syncControls();};
let exitTimer;
function revealExit(){if(!document.body.classList.contains('immersed'))return;document.body.classList.add('show-exit');clearTimeout(exitTimer);exitTimer=setTimeout(()=>document.body.classList.remove('show-exit'),2500);}
// Immersive view uses real fullscreen when the browser allows it; the CSS overlay stays as fallback.
window.immerseMedusa=()=>{const el=document.documentElement,req=el.requestFullscreen||el.webkitRequestFullscreen;if(req&&!document.fullscreenElement){try{const r=req.call(el,{navigationUI:'hide'});r?.catch?.(()=>{});}catch(e){}}document.body.classList.add('immersed');document.activeElement?.blur();revealExit();dirty=true;};
document.getElementById('immersive').onclick=window.immerseMedusa;
function exit(){if(document.fullscreenElement||document.webkitFullscreenElement)(document.exitFullscreen||document.webkitExitFullscreen).call(document)?.catch?.(()=>{});document.body.classList.remove('immersed','show-exit');clearTimeout(exitTimer);document.getElementById('immersive').focus();dirty=true;}
document.getElementById('exit').onclick=exit;
const onFull=()=>{if(!document.fullscreenElement&&!document.webkitFullscreenElement&&document.body.classList.contains('immersed'))exit();resize();};document.addEventListener('fullscreenchange',onFull);document.addEventListener('webkitfullscreenchange',onFull);
addEventListener('keydown',e=>{if(e.key==='Escape')exit();if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();window.pauseMedusa();}if(e.key.toLowerCase()==='m'&&A.mode==='file'){A.muted=!A.muted;A.setVolume(A.volume);A.notify();}});
addEventListener('pointermove',e=>{targetPointer=(e.clientX/w-.5)*2;revealExit();});addEventListener('pointerdown',revealExit);addEventListener('pointerout',e=>{if(!e.relatedTarget)targetPointer=0;});document.addEventListener('visibilitychange',()=>{last=null;dirty=true;});
let bodyA=190,bodyB=275,bodyWhite=false;
// Tone at mix t: always hue → white (saturation drains, lightness rises); the ghost has no two-hue mode.
function tone(t,light,a){const m=M.clamp(t),shift=audioSession?visual.hue*.3:visual.hue;if(bodyWhite){const d=((bodyB-bodyA+540)%360)-180;return `hsla(${bodyA+d*(1-m)**1.5+shift},${100-88*m}%,${light-14*(1-m)+(94-light)*m*.85}%,${a})`;}const d=((bodyB-bodyA+540)%360)-180;return `hsla(${bodyA+d*m+shift},100%,${light}%,${a})`;}
// Same colour as tone(), as linear-ish 0–1 RGB, memoised: the line batch asks for tens of thousands of colours a
// frame but only a few hundred distinct ones (mix quantised to 1/64, lightness to 1/4).
const toneCache=new Map();let toneKey='',toneTable=null;
function toneRGB(t,light){const shift=audioSession?visual.hue*.3:visual.hue,k=bodyA+'|'+bodyB+'|'+shift+'|'+bodyWhite;
 // One table per colour pair (looked up once per call only when the pair changes), then a numeric index into it.
 if(k!==toneKey){toneKey=k;toneTable=toneCache.get(k);if(!toneTable){if(toneCache.size>64)toneCache.clear();toneTable=new Map();toneCache.set(k,toneTable);}}
 const mi=Math.round(M.clamp(t)*64),li=Math.round(light*4),idx=mi*1000+li;let hit=toneTable.get(idx);
 if(!hit){hit=toneRGB0(mi/64,li/4);toneTable.set(idx,hit);}return hit;}
function toneRGB0(t,light){const m=M.clamp(t),shift=audioSession?visual.hue*.3:visual.hue,d=((bodyB-bodyA+540)%360)-180;let hh,s,l;
 // Saturation drains and lightness rises only near the top of the mix (m², m³): margins and patches turn white,
 // the rest of the wing keeps the manta's own hue.
 if(bodyWhite){hh=bodyA+d*(1-m)**1.5+shift;s=(100-80*m**2.2)/100;l=(light-10*(1-m)+(94-light)*m**3*.85)/100;}else{hh=bodyA+d*m+shift;s=1;l=light/100;}
 hh=((hh%360)+360)%360/360;const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q,f=x=>{x=(x+1)%1;return x<1/6?p+(q-p)*6*x:x<.5?q:x<2/3?p+(q-p)*(2/3-x)*6:p;};
 return [f(hh+1/3),f(hh),f(hh-1/3)];}
// Lines go to the stage as segments; WebGL lines are 1px, so width is folded into opacity.
function pushLine(points,s0,s1,rgb,a,width){const k=a*M.clamp(width/.6,.6,2.4);for(let i=s0;i<s1;i++)Stage.push(points[i],points[i+1],rgb[0],rgb[1],rgb[2],k);}
// Interwoven two-tone: each line takes its own fixed mix, spread evenly by the golden ratio.
// Bell lines fade between the two tones along their length; tentacles take their tone from where they sit around the bell.
const along=f=>f,loop=f=>.5-.5*Math.cos(f*TAU);let around=a=>.5;
const len0=p=>Math.max(1,Math.floor((p.length-1)/2));
function stroke(points,t,alpha,width=.65,gain){
 // t is a fixed 0–1 mix, or a function of position along the line (coloured in short chunks).
 // gain(f), optional: multiplies opacity per segment — the feathered shoulder patches.
 const a=M.clamp(alpha*(.3+bodyLight*.9)*bodyAlpha),light=62+bodyLight*12,len=points.length-1;
 if(gain){for(let i=0;i<len;i++){const f=(i+.5)/len,g=gain(f);pushLine(points,i,i+1,toneRGB(typeof t==='function'?t(f):t,light),M.clamp(a*g),width*(1+(g-1)*.25));}return;}
 const n=typeof t==='function'?Math.min(16,len0(points)):1;
 for(let c=0;c<n;c++){const s0=Math.floor(len*c/n),s1=Math.floor(len*(c+1)/n);pushLine(points,s0,s1,toneRGB(n>1?t((c+.5)/n):t,light),a,width);}
}
// spin: how often (often) and how fast (speed) each form barrel-rolls. act: species behaviour — glide [every, ±, length, ±] in s,
// loop (feeding circles), leap (breach toward the viewer), orbit (patrol circle, fraction of the frame), jitter (twitchy heading).
// Species presets: proportions for the same parametric body. `ear` is how each species listens:
// band weights for contraction power, reaction time (s), startle sensitivity, depth steering and glow.
// Shared by drawJelly, swimStep and the selector.
const SPECIES={
 classic:{spin:{often:1,speed:.8},act:{glide:[22,25,1.5,2]},name:'巨型鬼蝠魟',pattern:'T',latin:'MOBULA BIROSTRIS',span:1.75,thick:.16,body:.22,sweep:0,tipY:.12,lobeLen:.32,curl:1,tailLen:1.1,noise:0,ripple:.5,lean:0,tentLen:.7,armLen:.5,freq:[.3,.6],amp:1,thrust:.8,sea:{n:90,rgb:[150,185,215],speed:.6,size:1,alpha:1},ear:{bass:.8,mid:.4,treble:.2,react:.4,startle:.4,depth:.4,glow:.3}},
 reef:{spin:{often:1.4,speed:1},act:{glide:[20,25,2,2],loop:[14,16]},name:'礁鬼蝠魟',pattern:'Y',latin:'MOBULA ALFREDI',span:1.55,thick:.18,body:.26,sweep:-.3,tipY:.05,lobeLen:.36,curl:1.2,tailLen:.9,noise:0,ripple:.8,lean:0,tentLen:.6,armLen:.5,freq:[.35,.7],amp:1.2,thrust:.85,sea:{n:110,rgb:[140,205,200],speed:.7,size:1,alpha:1},ear:{bass:1,mid:.4,treble:.15,react:.6,startle:.3,depth:.45,glow:.3}},
 devil:{spin:{often:2,speed:1.5},act:{glide:[25,20,1,1.5],leap:[10,14]},name:'飛躍蝠鱝',latin:'MOBULA MUNKIANA',span:1.45,thick:.13,body:.18,sweep:.3,tipY:.2,lobeLen:.26,curl:.8,tailLen:1.3,noise:0,ripple:.3,lean:0,tentLen:.8,armLen:.5,freq:[.6,1.1],amp:.9,thrust:1.15,sea:{n:100,rgb:[200,175,210],speed:1,size:1,alpha:1},ear:{bass:.5,mid:.5,treble:.7,react:.15,startle:1,depth:.5,glow:.7}},
 wide:{spin:{often:.6,speed:.6},act:{glide:[12,10,3,3]},name:'寬翼滑翔',latin:'WIDE-WING FORM',span:2.2,thick:.14,body:.2,sweep:.2,tipY:.18,lobeLen:.3,curl:1,tailLen:1,noise:0,ripple:.4,lean:0,tentLen:.6,armLen:.5,freq:[.22,.45],amp:1.3,thrust:.7,sea:{n:70,rgb:[140,180,225],speed:.45,size:1.1,alpha:.9},ear:{bass:1.2,mid:.2,treble:.05,react:1.2,startle:.1,depth:.4,glow:.1}},
 banking:{spin:{often:1,speed:.9},act:{glide:[22,20,2,2],orbit:.28},name:'傾斜轉彎',latin:'BANKING FORM',span:1.75,thick:.16,body:.22,sweep:0,tipY:.12,lobeLen:.32,curl:1,tailLen:1.2,noise:.02,ripple:.6,lean:.3,tentLen:.75,armLen:.5,freq:[.35,.7],amp:1.1,thrust:.9,sea:{n:90,rgb:[165,190,225],speed:.8,size:1,alpha:1},ear:{bass:.7,mid:.6,treble:.3,react:.4,startle:.6,depth:.4,glow:.4}},
 noisy:{spin:{often:1.6,speed:1.2},act:{glide:[30,20,1,2],jitter:1},name:'噪聲魟影',latin:'NOISE FORM',span:1.7,thick:.16,body:.22,sweep:0,tipY:.12,lobeLen:.34,curl:1.3,tailLen:1.4,noise:.12,ripple:1.4,lean:0,tentLen:.9,armLen:.5,freq:[.6,1.1],amp:1.1,thrust:1,sea:{n:150,rgb:[195,205,215],speed:1.2,size:.9,alpha:1.1},ear:{bass:.4,mid:.4,treble:.9,react:.12,startle:.9,depth:.5,glow:1}}
};
let speciesKey='classic';try{const saved=localStorage.getItem('manta-species');if(SPECIES[saved])speciesKey=saved;}catch(e){}
const sea={n:100,rgb:[133,162,205],speed:1,size:1,alpha:1};
function setSpecies(key){if(!SPECIES[key])return;speciesKey=key;try{localStorage.setItem('manta-species',key);}catch(e){}const sel=document.getElementById('species');if(sel)sel.value=key;const sig=document.getElementById('speciesSig');if(sig)sig.textContent=SPECIES[key].latin;dirty=true;}
// Swimming physics: underwater flight. The pectoral fins flap continuously as a travelling wave and make lift-based
// thrust on both strokes (more on the downstroke), T ∝ f·A². The flat body has little drag along its heading and
// a lot sideways, so velocity follows the nose. Turns come from flapping one wing harder and banking into the turn.
// Seen from above, gravity points into the screen, so there is no sinking and no "head up"; mantas also need water
// over the gills (ram ventilation), so they never stop: below cruising speed the flap strengthens again.
// Music sets the flap frequency (locked to the BPM, downstroke on the beat), amplitude and the occasional glide.
function jellyRadius(member){const bornAge=Math.max(0,time-member.born),birthScale=member.id===0?1:.25+.75*(1-Math.exp(-bornAge/16));// Reel (9:16): a smaller body (13% of the width; the camera also sees wider there) so a manta can still swim across and turn in the narrow frame.
 return (window.reelActive?w*.13:Math.min(w*(w<700?.27:.25),h*.23,Math.max(40,h-170)/4.2))*growth*groupScale*member.size*birthScale;}
const ease=x=>x*x*(3-2*x);
function swimStep(m,dt){
 const sp=SPECIES[speciesKey],r=jellyRadius(m),hsh=k=>{const x=Math.sin(m.seed*12.9898+k*78.233)*43758.5453;return x-Math.floor(x);};
 if(m.vx===undefined){m.depth=m.id?12+22*hsh(31):16+(hsh(31)-.5)*2;m.x=m.x??(m.id?w*(.2+.6*hsh(5)):w*.5);m.y=m.y??(m.id?h*(.35+.4*hsh(6)):h*.5);m.ang=hsh(7)*TAU;m.vx=Math.sin(m.ang)*r*.3;m.vy=-Math.cos(m.ang)*r*.3;m.fp=hsh(8)*TAU;m.amp=.5;m.bank=0;m.av=0;m.n=0;m.glide=0;m.nextGlide=time+15+hsh(9)*20;}
 const ear=sp.ear;if(audioSession){m.lvl=M.smooth(m.lvl??0,M.clamp(sound.bass*ear.bass+sound.mid*ear.mid+sound.treble*ear.treble),dt,ear.react);m.fluxAvg=M.smooth(m.fluxAvg??sound.flux,sound.flux,dt,2);m.eng=M.smooth(m.eng??0,sound.energy,dt,ear.react*2);}
 const drive=audioSession?m.eng??0:params.energy,heft=M.clamp(Math.sqrt(r/180),.7,2.2);
 // Flap frequency: the species' natural range; with music, the BPM divided down until it fits that range.
 let f=(sp.freq[0]+(sp.freq[1]-sp.freq[0])*M.clamp(drive))*(1+(hsh(10)-.5)*.1);
 if(audioSession&&sound.bpm){let fb=sound.bpm/60;while(fb>sp.freq[1]*1.15)fb/=2;while(fb<sp.freq[0]*.85)fb*=2;f=M.smooth(m.f??f,fb,dt,1);}
 m.f=f;
 // Phase lock: on a beat, nudge the stroke so the downstroke (fp ≡ 0) lands on it.
 if(audioSession&&sound.beat){const d=Math.atan2(Math.sin(-m.fp),Math.cos(-m.fp));m.fpCorr=d*.5;}
 // The correction is bled in over ~0.35s (a brief speed-up or slow-down of the stroke), never applied as a jump.
 if(m.fpCorr){const k=1-Math.exp(-dt/.35),c=m.fpCorr*k;m.fp+=c;m.fpCorr-=c;if(Math.abs(m.fpCorr)<1e-3)m.fpCorr=0;}
 const prevFp=m.fp;m.fp+=dt*TAU*f;if(Math.floor(m.fp/TAU)>Math.floor(prevFp/TAU))m.n++;
 // Glides: wings held out, flapping paused for a few seconds; never while slow.
 const speed=Math.hypot(m.vx,m.vy),cruise=r*.12;
 if(!m.glide&&!m.loopT&&!m.leapT&&time>=m.nextGlide&&speed>cruise&&(!audioSession||(m.eng??0)<.35)){const g=sp.act.glide;m.glide=g[2]+hsh(11+m.n%5)*g[3];m.nextGlide=time+g[0]+hsh(12+m.n%7)*g[1];}
 if(m.glide)m.glide=Math.max(0,m.glide-dt);
 // Startle: a spike in spectral change makes a hard power stroke and a sharp turn.
 if(audioSession&&ear.startle&&time-(m.startleAt??-9)>1.5&&sound.flux>(m.fluxAvg??0)*(3-ear.startle*1.2)+.12){m.startleAt=time;m.turnKick=(hsh(13+m.n%9)<.5?-1:1)*(1.2+ear.startle);m.glide=0;}
 const kick=M.clamp(1-(time-(m.startleAt??-9))/1.2);
 m.beatEnv=M.smooth(m.beatEnv??0,audioSession&&sound.beat?1:0,dt,sound.beat?.06:.45);if(audioSession&&sound.beat)m.beatHold=.08;m.beatHold=Math.max(0,(m.beatHold??0)-dt);if(m.beatHold)m.beatEnv=M.smooth(m.beatEnv,1,dt,.06);
 let wantAmp=audioSession?.3+(m.lvl??0)*.8+m.beatEnv*.35:.35+params.energy*.6;
 if(speed<cruise)wantAmp=Math.max(wantAmp,.55);if(m.leapT&&breach(m).u<.5)wantAmp=Math.max(wantAmp,1.15);if(m.loopT)wantAmp=Math.max(wantAmp,.8);if(m.feedT)wantAmp=Math.min(wantAmp,.45);if((m.lureT??0)>0&&Math.hypot(m.x-m.lureX,m.y-m.lureY)>((m.lureR??1.2)+1)*r)wantAmp=Math.max(wantAmp,1.2);if(m.glide)wantAmp=0;wantAmp+=kick*.5;
 m.amp=M.smooth(m.amp??.5,M.clamp(wantAmp,0,1.3),dt,m.glide?.8:.3);
 // Thrust on both strokes, peaking mid-downstroke: (1 + .4·cos fp) ≥ .6.
 const stroke=1+.4*Math.cos(m.fp),thrust=sp.thrust*r*14*f*(m.amp*sp.amp)**2*stroke;
 // Steering target: a slowly wandering point inside the frame, pushed away from the walls and from other mantas.
 m.wt=(m.wt??hsh(14)*100)+dt*(audioSession?.1:.05);
 // Swim bounds. Reel: margins from the frame's width, and kept clear of the strips Instagram covers (top 14%,
 // bottom 20%), so the mantas stay in the visible part of the video.
 const reel=window.reelActive,l0=reel?w*.06+r*.9:24+r*1.5,r0=Math.max(l0,w-l0),t0=reel?h*.14+r*.9:72+r*1.3,b0=Math.max(t0+r*.8,reel?h*.8-r*.9:h-85-r*1.3);
 let tx=w*(.5+.34*Math.sin(m.wt*1.3+hsh(15)*6)),ty=h*(.5+.28*Math.sin(m.wt*.9+hsh(16)*6)-(audioSession?(soft.centroid-.4)*ear.depth*.5:0));
 // Orbit (傾斜轉彎): patrol a wide circle, the target running ahead on it, so the body stays banked into the turn.
 if(sp.act.orbit){const dir=hsh(17)<.5?-1:1,R=Math.min(w,h)*sp.act.orbit,a0=Math.atan2(m.y-h/2,m.x-w/2)+dir*.7;tx=w/2+Math.cos(a0)*R;ty=h/2+Math.sin(a0)*R;}
 // Jitter (噪聲魟影): the wandering target twitches, so the heading keeps correcting.
 if(sp.act.jitter){tx+=Math.sin(time*2.3+m.seed)*r*1.5*sp.act.jitter;ty+=Math.cos(time*1.9+m.seed*2)*r*1.5*sp.act.jitter;}
 // Follow (webcam): heads straight for the hand while far; within its ring it circles at m.lureR body radii (1.2 for
 // the nearest manta, wider for the rest), and glows faintly while close (m.curious).
 m.lureT=Math.max(0,(m.lureT??0)-dt);m.flash=Math.max(0,(m.flash??0)-dt*1.6);m.flick=M.smooth(m.flick??0,m.flickT??0,dt,m.flickT?.15:.3);
 const ring=(m.lureR??1.2)*r;m.curious=M.smooth(m.curious??0,m.lureT>0&&Math.hypot(m.x-m.lureX,m.y-m.lureY)<ring+r?1:0,dt,.5);
 if(m.lureT>0&&!(kick>0)){const dl=Math.hypot(m.x-m.lureX,m.y-m.lureY);m.lureA=(m.lureA??Math.atan2(m.y-m.lureY,m.x-m.lureX))+dt*.6;
  const k=Math.min(1,m.lureT),orbit=dl<ring+r,gx=orbit?m.lureX+Math.cos(m.lureA)*ring:m.lureX,gy=orbit?m.lureY+Math.sin(m.lureA)*ring:m.lureY;tx+=(gx-tx)*k;ty+=(gy-ty)*k;}
 // Feeding loop (礁鬼蝠魟): a tight full circle in place, slowed down, as when somersaulting through plankton.
 if(sp.act.loop){m.nextLoop=m.nextLoop??time+sp.act.loop[0]*hsh(18)+6;if(!m.loopT&&time>=m.nextLoop&&!m.glide){m.loopT=TAU*(2+Math.floor(hsh(19+m.n%5)*2));m.nextLoop=time+sp.act.loop[0]+hsh(20+m.n%7)*sp.act.loop[1];}}
 // Leap (飛躍蝠鱝): a burst of fast strokes, then it breaches toward the viewer and spins before dropping back.
 // Breach (飛躍蝠鱝): a burst of strokes carries it up to the surface, out into the air with a roll, and back down.
 if(sp.act.leap){m.nextLeap=m.nextLeap??time+4+hsh(21)*sp.act.leap[0];if(!m.leapT&&time>=m.nextLeap&&!breachBusy(m)){m.leapT=LEAP;m.nextLeap=time+sp.act.leap[0]+LEAP+hsh(22+m.n%7)*sp.act.leap[1];}}
 if(m.leapT)m.leapT=Math.max(0,m.leapT-dt);
 // Avoidance counts only neighbours within ~4 m of depth; others simply pass in front of or behind this one.
 for(const o of population.members){if(o===m||o.vx===undefined||!Number.isFinite(o.x)||Math.abs((m.depth??16)-(o.depth??16))>4)continue;const dx=m.x-o.x,dy=m.y-o.y,d=Math.hypot(dx,dy)||1,near=(r+jellyRadius(o))*1.6;if(d<near){tx+=dx/d*(near-d)*3;ty+=dy/d*(near-d)*3;}}
 // Look ahead: if the nose is about to leave the frame, aim back toward the middle.
 const hx=Math.sin(m.ang),hy=-Math.cos(m.ang),ax=m.x+hx*r*2.5,ay=m.y+hy*r*2.5;
 if(ax<l0||ax>r0||ay<t0||ay>b0){tx=w/2+(tx-w/2)*.3;ty=h/2+(ty-h/2)*.3;}
 const want=Math.atan2(tx-m.x,-(ty-m.y)),diff=Math.atan2(Math.sin(want-m.ang),Math.cos(want-m.ang));
 // Turn rate is limited and needs speed (a wing needs flow); the body banks into the turn, ω·v sets the bank.
 const flow=M.clamp(speed/(cruise*1.5),.25,1.2);// Called by a fist: turn toward the hand more decisively.
 const lureTurn=(m.lureT??0)>0?1.7:1;let wantW=M.clamp(diff*.9*lureTurn,-.9*lureTurn,.9*lureTurn)*flow+(m.turnKick??0)*kick;
 // Somersault (礁鬼蝠魟): backward flips about the span axis, ~2.6s each, almost in place; wantW → 0 holds the heading.
 if(m.loopT){const step=dt*TAU/2.6;m.flip=((m.flip??0)+step)%TAU;m.loopT=Math.max(0,m.loopT-step);wantW*=.2;if(!m.loopT)m.flip=0;}
 // Feeding (all species): lobes unroll and the mouth opens while somersaulting, and in short bouts every ~40–80s.
 m.nextFeed=m.nextFeed??time+20+hsh(23)*40;if(!m.feedT&&time>=m.nextFeed){m.feedT=5+hsh(24+m.n%5)*4;m.nextFeed=time+40+hsh(25+m.n%7)*40;}
 if(m.feedT)m.feedT=Math.max(0,m.feedT-dt);m.feed=M.smooth(m.feed??0,m.loopT||m.feedT?1:0,dt,.6);
 m.av=M.smooth(m.av??0,wantW,dt,.6*heft);if(kick<=0)m.turnKick=0;m.ang+=m.av*dt;
 m.bank=M.smooth(m.bank??0,M.clamp(-m.av*.55,-.8,.8),dt,.35);
 // Asymmetric flapping: the outside wing beats harder than the inside one.
 m.asym=M.clamp(m.av*.35,-.4,.4);
 // Forces along the heading; strong sideways drag aligns the velocity with the nose. Gentle current with music.
 const hx2=Math.sin(m.ang),hy2=-Math.cos(m.ang),fwd=m.vx*hx2+m.vy*hy2,lat=-m.vx*hy2+m.vy*hx2;
 let ux=0;if(audioSession)ux=soft.pan*w*.03;m.ux=ux;
 const dFwd=((m.loopT?thrust*.2:thrust)-fwd*Math.abs(fwd)*1.6/r-fwd*(m.loopT?1.2:.15))/heft,dLat=-lat*2.5;
 const nf=fwd+dFwd*dt,nl=lat+dLat*dt;m.vx=nf*hx2-nl*hy2;m.vy=nf*hy2+nl*hx2;
 m.x+=(m.vx+ux)*dt;m.y+=m.vy*dt;
 // Hard walls only as a safety net; the look-ahead normally turns them away first.
 if(m.x<l0){m.x=l0;m.vx=Math.abs(m.vx)*.3;}if(m.x>r0){m.x=r0;m.vx=-Math.abs(m.vx)*.3;}if(m.y<t0){m.y=t0;m.vy=Math.abs(m.vy)*.3;}if(m.y>b0){m.y=b0;m.vy=-Math.abs(m.vy)*.3;}
 // Values the drawing, spin and data readout read: c = downstroke progress, power = amplitude, sqz = thrust.
 m.c=.5+.5*Math.cos(m.fp);m.power=m.amp;m.sqz=thrust/Math.max(r,1);m.cyc=m.fp;m.tAng=M.smooth(m.tAng??m.ang,m.ang,dt,.3+.35*sp.tentLen);
 chainStep(m,dt,r);
}
// Trailing chain: a verlet rope hanging from the bell rim in screen space. Tentacles and arms read their
// bend from it, so they stream behind on thrust, swing out on turns and drift back while coasting.
const CHAIN=20;
function chainStep(m,dt,r){
 const sp=SPECIES[speciesKey],total=Math.max(sp.tentLen*2.05,sp.armLen*1.75,.4)*r,seg=total/(CHAIN-1);
 const ax=Math.sin(m.tAng??m.ang),ay=-Math.cos(m.tAng??m.ang),soft=1/(1+.6*sp.tentLen);
 if(!m.chain){m.chain=[];for(let i=0;i<CHAIN;i++){const p=[m.x-ax*seg*i,m.y-ay*seg*i];m.chain.push({x:p[0],y:p[1],px:p[0],py:p[1]});}}
 if(dt<=0)return;
 const k=Math.min(dt,.05),turb=r*(audioSession?.25+sound.flux*1.2+sound.density*.4:.25+visual.flow*.3);
 for(let i=1;i<CHAIN;i++){const n=m.chain[i],vx=(n.x-n.px)*.94,vy=(n.y-n.py)*.94;n.px=n.x;n.py=n.y;
  const fx=Math.sin(time*.9+i*.7+m.seed)*turb+(m.ux??0)*(i/CHAIN)*1.5,fy=r*.5+Math.cos(time*.7+i*.5+m.seed*2)*turb*.4;n.x+=vx+fx*k*k;n.y+=vy+fy*k*k;}
 const a=m.chain[0];a.x=a.px=m.x;a.y=a.py=m.y;
 for(let it=0;it<4;it++){
  for(let i=1;i<CHAIN;i++){const p=m.chain[i-1],n=m.chain[i],dx=n.x-p.x,dy=n.y-p.y,d=Math.hypot(dx,dy)||1,f=(d-seg)/d;
   if(i===1){n.x-=dx*f;n.y-=dy*f;}else{n.x-=dx*f*.5;n.y-=dy*f*.5;p.x+=dx*f*.5;p.y+=dy*f*.5;}}
  // Root stiffness: the first nodes stay close to the bell axis, the tips are free.
  for(let i=1;i<CHAIN;i++){const st=.22*(1-i/CHAIN)**2*soft,n=m.chain[i];n.x+=(m.x-ax*seg*i-n.x)*st;n.y+=(m.y-ay*seg*i-n.y)*st;}
 }
}
// Body-local displacement at distance d (bell radii) below the rim.
function chainLag(m,r){
 const c=m.chain;if(!c)return null;const sp=SPECIES[speciesKey],total=Math.max(sp.tentLen*2.05,sp.armLen*1.75,.4),seg=total/(CHAIN-1);
 const ca=Math.cos(m.ang),sa=Math.sin(m.ang),ax=sa,ay=-ca;
 const local=[];for(let i=0;i<CHAIN;i++){const dx=(c[i].x-(m.x-ax*seg*r*i))/r,dy=(c[i].y-(m.y-ay*seg*r*i))/r;local.push([dx*ca+dy*sa,-dx*sa+dy*ca]);}
 return d=>{const f=Math.max(0,Math.min(CHAIN-1.001,d/seg)),i=Math.floor(f),t=f-i,a=local[i],b=local[i+1];return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];};
}
// Manta (after the parametric design sheet): a wireframe planform M(u,v;P) with hinged, flapping wings, two cephalic
// Spin: a twirl about the ghost's vertical axis, eased (slow → fast → slow). Free mode: every 20–45s or after
// touching a wall. Music: on a startle or a hard bass beat; stronger bass spins faster. At least 4s rest between.
// The skirt follows the head on an underdamped spring, so it trails on the way in and flicks past on the stop.
// A ghost's own spin can sweep its nearest neighbour into a follow-up twirl.
const smoother=x=>x*x*x*(x*(x*6-15)+10);
function spinStep(m,dt){
 const rnd=()=>Math.random(),pers=SPECIES[speciesKey].spin;
 if(m.spinAng===undefined){m.spinAng=m.skirtAng=m.skirtVel=m.spinVel=0;m.nextSpin=time+(20+rnd()*25)/pers.often;m.spinRest=0;}
 m.spinRest=Math.max(0,m.spinRest-dt);
 if(!m.spin&&!m.spinRest){
  let go=false,force=.5;
  if(audioSession){if(m.startleAt!==m.lastSpinStartle&&time-(m.startleAt??-9)<.2){go=true;force=1;}else if(sound.beat&&sound.bass>.6-(pers.often-1)*.15){go=true;force=sound.bass;}}
  else if(time>=m.nextSpin){go=true;force=.4+rnd()*.4;}
  if(m.wantSpin){go=true;force=Math.max(force,.7);}
  // Swept along: a neighbour's twirl started this one, a beat later, the same way round and a little weaker.
  let dir=rnd()<.5?-1:1,induced=false;
  if(!go&&m.pendingSpin&&time>=m.pendingSpin.at){go=true;force=m.pendingSpin.force;dir=m.pendingSpin.dir;induced=true;}
  if(go){const turns=induced?1:rnd()<.35+force*.3?2:1,dur=(2.1-force*.9)*(turns===2?1.25:1)/pers.speed;m.spin={t:0,dur,from:m.spinAng,turns:turns*dir};m.lastSpinStartle=m.startleAt;m.pendingSpin=null;
   // Only a ghost's own spin spreads, and only to its nearest free neighbour within ~3.5 body radii (60% of the time),
   // so a crowd never cascades into everyone spinning at once.
   if(!induced&&rnd()<.6){const r=jellyRadius(m);let best=null,bd=r*3.5;for(const o of population.members){if(o===m||o.spin||o.spinRest||o.pendingSpin||!Number.isFinite(o.x))continue;const d=Math.hypot(o.x-m.x,o.y-m.y);if(d<bd){bd=d;best=o;}}
    if(best)best.pendingSpin={at:time+.3+bd/(r*3.5)*.4,dir,force:force*.7};}}
 }
 // A pending spin that waited too long (its target was busy) is dropped.
 if(m.pendingSpin&&time>m.pendingSpin.at+1.5)m.pendingSpin=null;
 m.wantSpin=0;
 const prev=m.spinAng;
 if(m.spin){const sp=m.spin;sp.t+=dt;const p=Math.min(1,sp.t/sp.dur);m.spinAng=sp.from+sp.turns*TAU*smoother(p);if(p>=1)m.spin=null;}
 m.spinVel=m.spin&&dt>0?(m.spinAng-prev)/dt:0;
 // Once stopped, fold the angle back into one turn; shift the skirt by the same amount so nothing jumps.
 if(!m.spin&&Math.abs(m.spinAng)>TAU){const end=m.spinAng;m.spinAng%=TAU;m.skirtAng+=m.spinAng-end;}
 if(!m.spin&&m.spinAng!==prev){m.spinRest=4;m.nextSpin=time+(20+rnd()*25)/pers.often;}
 // Spring: stiffness 30, damping ratio ≈ .35 → visible overshoot when the head stops.
 const k=30,c=2*Math.sqrt(k)*.35,acc=k*(m.spinAng-m.skirtAng)-c*(m.skirtVel-m.spinVel);m.skirtVel+=acc*dt;m.skirtAng+=m.skirtVel*dt;
}
// lobes and a whip tail on the drag chain. Contraction is the wing downstroke; a "spin" is a barrel roll about the body axis.
const MG=window.MantaGeometry;
function drawJelly(member){
 const sp=SPECIES[speciesKey],count=population.members.length,bornAge=Math.max(0,time-member.born);
 if(member.vx===undefined)swimStep(member,0);
 // A leap lifts the manta toward the viewer: it grows, then falls back (sin over the 2.2s leap).
 const radius=jellyRadius(member)*.62,c=member.c??0,breath=.6-1.6*c;
 const pers=sp.spin,spinN=M.clamp(Math.abs(member.spinVel??0)/(9*pers.speed));
 // Roll about the body axis (yaw in the projection, since local y is the body axis) and a slight nose-down pitch toward the viewer.
 const view={cx:member.x,cy:member.y,radius,yaw:Math.sin(time*.13+member.seed)*.08+pointer*.2+(member.spinAng??0)+(member.bank??0),pitch:-.3+Math.sin(time*.17+member.id)*.08,roll:member.ang+sp.lean+pointer*.04};
 const swell=audioSession?.75+soft.bass*.8+beatGlow*.3:.85+visual.flow*.25;
 // Flap: downstroke on contraction (c → 1), slow upstroke on recovery, plus a gentle glide undulation.
 // Flap: continuous stroke from the swim model (fp = 0 is mid-downstroke); amplitude falls to a held glide.
 const state={lag:chainLag(member,radius),phase:member.cyc??phase,breath,seed:member.seed,pointer:pointer*.5,span:sp.span*(1+spinN*.05),thick:sp.thick,body:sp.body,sweep:sp.sweep,tipY:sp.tipY,
  flap:(.08+.55*sp.amp*(member.amp??.5)*(audioSession?.8+soft.bass*.3:1)+(audioSession?(member.beatEnv??0)*.15:0)),flapPh:member.fp??0,asym:member.asym??0,ripple:sp.ripple*(audioSession?.6+soft.mid*1.2:1),wave:wave*.7+member.id*.9,
  noise:sp.noise*(audioSession?.6+soft.treble*1.2:1),lobeLen:sp.lobeLen,unfurl:member.feed??0,mouth:member.feed??0,curl:sp.curl*(1+.15*Math.sin(time*.8+member.seed)+(audioSession?soft.treble*.3:0)),tailLen:sp.tailLen*(audioSession?.85+soft.mid*.4:1)};
 around=a=>.5+.5*Math.sin(a+view.yaw*2);bodyWhite=true;// Each manta keeps the colour pair it was born with (golden-angle hues by birth order, tilted by the music at birth).
 bodyA=member.a??195;bodyB=member.b??230;bodyAlpha=member.id===0?1:M.clamp((bornAge/7)**1.5,.04,1);
 const mature=member.id===0?1:1-Math.exp(-bornAge/5),life=.6+.4*M.clamp((growth-.25)/.75);const flk=member.flick??0;
 bodyLight=M.clamp(((member.flash??0)*.7+(member.curious??0)*.25*(.6+.4*Math.sin(time*3))+visual.light*(.25+.75*mature)+(audioSession?beatGlow*.2*member.size*mature+(soft.treble-.3)*sp.ear.glow*.18*mature:0))*life);
 // Glow (✌): eases up to 0.85 with lines ~1.6× as opaque, then breathes gently like light catching a wet surface:
 // a slow swell (~0.5 per second, about ±7% brightness) — well below anything that reads as flicker — while a soft
 // glint drifts across the wings (in sheen below). Each manta breathes on its own timing.
 const shimmer=flk?Math.sin(time*TAU*.5+member.seed*3)*.6+Math.sin(time*TAU*.23+member.seed)*.4:0;
 if(flk){bodyLight+=(.85+.06*shimmer-bodyLight)*flk;bodyAlpha*=1+(.6+.12*shimmer)*flk;}
 // Somersault: rotate the whole body about the span (x) axis around its centre before projecting; the centre traces a
 // small circle along the heading, so the flip reads as going over and coming back.
 const fl=member.flip??0,cf=Math.cos(fl),sf=Math.sin(fl);view.cx+=Math.sin(member.ang)*radius*.25*sf;view.cy+=-Math.cos(member.ang)*radius*.25*sf+radius*.12*(1-cf);
 const rot=fl?p=>[p[0],p[1]*cf-p[2]*sf,p[1]*sf+p[2]*cf]:p=>p;
 // Depth layer: each manta holds its own distance (±3 m around the stage plane); a leap brings it ~3 m closer.
 // Distance from the camera (m): each manta's own layer, 12–34 m; a leap brings it ~3 m closer.
 const B=breach(member),lift=B.lift,dist=member.depth??16;
 // proj: world space for the stage. proj2: screen space for the data overlay, scaled by perspective (D / dist).
 const view2={...view,radius:radius*Stage.D/dist},proj2=p=>G.project(rot(p),view2),proj=p=>Stage.local(rot(p),view,dist,lift),chords=count>3?24:34,spans=count>3?32:46,N=count>3?56:80,steps=count>3?20:28;
 // Chordwise lines (constant v) across the full span, and spanwise lines (constant u) from leading to trailing edge.
 // Surface colour: deep indigo over the thick body, cyan across the wings, white at the margins, plus an
 // iridescent band sweeping outward with each flap and a slow shimmer travelling chordwise.
 // Shoulder patches: white areas on a dark back. T (M. birostris): their front edge runs straight across, parallel to
 // the head. Y (M. alfredi): the front edge sweeps back toward the midline, leaving a dark Y between them.
 // Y patches cover less area than T, so they get a stronger opacity gain to read as clearly.
 const pat=sp.pattern,pgain=pat==='Y'?4.6:3.2,sm=(a,b,x)=>{const q=M.clamp((x-a)/(b-a));return q*q*(3-2*q);};
 // Soft field 0–1 over the planform (a = |u|, v): boundaries wobble with low-frequency noise (fixed per manta) and fade
 // over a band, so the white blends into the dark back instead of ending at a hard line.
 const sd=member.seed,wob=(x,y,k)=>.035*Math.sin(x*13+y*5+sd*k)+.02*Math.sin(x*37-y*11+sd*k*1.7)+.01*Math.sin(x*79+y*27+k);
 // The patch field depends only on (a, v) and this manta's seed, so it is memoised per manta (and species) on a 1/200 grid.
 if(member._patchFor!==speciesKey){member._patch=new Map();member._patchFor=speciesKey;}const pcache=member._patch;
 const patch=(a,v)=>{if(!pat)return 0;const key=Math.round(a*200)*1000+Math.round(v*200);let hv=pcache.get(key);if(hv===undefined){hv=patch0(a,v);pcache.set(key,hv);}return hv;};
 const patch0=(a,v)=>{const t=M.clamp((a-.1)/.42);
  const vf=(pat==='T'?.08+.03*t:.08+.3*(1-sm(.05,.75,t))**1.4)+wob(a,v,1),vb=.5-.3*t**1.1+wob(a,v,2),am=.08+wob(v,a,3);
  // Feather bands ≈ .1–.15 wide: several segments across each edge, so opacity ramps instead of stepping.
  return sm(am,am+.1,a)*sm(vf,vf+.12,v)*(1-sm(vb-.15,vb,v))*(1-sm(.36,.62,a+wob(v,a,4)));};
 const fp=member.fp??0,sheen=(u,v)=>{const a=Math.abs(u),edge=Math.max(a**2,Math.abs(2*v-1)**6),pc=patch(a,v);
  return M.clamp((pat?(a<.6?.35:.7):1)*(1-pc*.6)*(.12+.55*edge+.22*a*Math.max(0,Math.cos(fp-a*1.1-v*.5))+.12*Math.sin(wave*1.3-a*6+v*5+member.seed)+(audioSession?beatGlow*.15:0))+pc*.6
   // ✌ glint: a soft highlight band sliding slowly across the wings (one pass every ~4 s).
   +flk*.4*Math.max(0,Math.sin(a*3.2-v*2.4-time*2+member.seed))**4);};
 for(let i=0;i<=chords;i++){const v=i/chords;let pts=[];for(let k=0;k<=N;k++)pts.push(proj(MG.surface(-1+2*k/N,v,state)));stroke(pts,f=>sheen(2*f-1,v),.12+.1*Math.sin(v*Math.PI)+.05*Math.sin(v*20-wave),.55,pat&&(f=>.55+pgain*patch(Math.abs(2*f-1),v)));}
 for(let j=0;j<=spans;j++){const u=-1+2*j/spans,a=Math.abs(u);let pts=[];for(let k=0;k<=steps;k++)pts.push(proj(MG.surface(u,k/steps,state)));stroke(pts,f=>sheen(u,f),.1+.14*(1-a)+(j%8===0?.15:0),j%8===0?.8:.5,pat&&(f=>.55+pgain*patch(a,f)));}
 // Outline: leading edge, trailing edge and the dorsal midline, drawn brighter.
 for(const v of [0,1]){let pts=[];for(let k=0;k<=160;k++)pts.push(proj(MG.surface(-1+2*k/160,v,state)));stroke(pts,f=>.35+.65*sheen(2*f-1,v),.36,1.1);}
 {let pts=[];for(let k=0;k<=40;k++)pts.push(proj(MG.surface(0,k/40,state)));stroke(pts,.8,.3,.9);}
 for(const side of [-1,1])for(let strand=0;strand<4;strand++){let pts=[];for(let k=0;k<=30;k++){const p=MG.lobe(k/30,side,state);p[0]+=side*strand*.018*(1-k/30);p[2]+=strand*.012;pts.push(proj(p));}stroke(pts,.3,.3-strand*.04,.7);}
 for(let strand=0;strand<3;strand++){let pts=[];for(let k=0;k<=40;k++){const p=MG.tail(k/40,state);p[0]+=(strand-1)*.012*(1-k/40);pts.push(proj(p));}stroke(pts,along,.28-strand*.06,.6);}
 // Mouth: a terminal slit across the head between the lobes, opening into an oval while feeding.
 {const mo=state.mouth,mz=MG.surface(0,.02,state);let pts=[];for(let k=0;k<=36;k++){const a=k/36*TAU;pts.push(proj([Math.cos(a)*.17,mz[1]-.01+Math.sin(a)*(.012+.07*mo),mz[2]+.02]));}stroke(pts,.15+.4*mo,.35+.2*mo,.9);}
 // Eyes: on the sides of the head, just behind the lobe roots, following the surface.
 for(const side of [-1,1]){const c=MG.surface(side*.16,.07,state);let pts=[];for(let k=0;k<=16;k++){const a=k/16*TAU;pts.push(proj([c[0]+side*.03+Math.cos(a)*.022,c[1]+Math.sin(a)*.016,c[2]-.02]));}stroke(pts,.95,.6,1);}
 drawSkeleton(state,proj,count);
 // Breach effects: a bubble trail while rising and sinking, a splash of bubbles and a flash of surface light at the
 // moments it leaves and re-enters the water.
 if(member.leapT){const P=proj([0,0,0]),R=Stage.surfaceLift;
  if(Math.abs(B.lift-member._lastLift)>.05&&B.lift<R)bubbleEmit(P,2,.5);
  if((member._lastLift??0)<R&&B.lift>=R){bubbleEmit([P[0],P[1]-2,P[2]],40,1.6);breachFlash=1;}
  if((member._lastLift??0)>=R&&B.lift<R){bubbleEmit([P[0],P[1]-1,P[2]],60,2);breachFlash=Math.max(breachFlash,.8);member.wantSpin=0;}
  if(B.u>=.32&&(member._lastU??0)<.32)member.wantSpin=1;
  member._lastLift=B.lift;member._lastU=B.u;}else{member._lastLift=0;member._lastU=0;}
 // Body fill: a translucent dark surface just under the dorsal lines. It writes depth, so a nearer manta hides
 // the lines of one behind it.
 {const nu=count>3?16:24,nv=count>3?6:9,grid=dz=>{const g=[];for(let i=0;i<=nu;i++){const row=[];for(let j=0;j<=nv;j++){const p=MG.surface(-1+2*i/nu,j/nv,state);p[2]+=dz;row.push(proj(p));}g.push(row);}return g;};
  const layer=(g,al,white)=>{for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){Stage.tri(g[i][j],g[i+1][j],g[i+1][j+1],al,white);Stage.tri(g[i][j],g[i+1][j+1],g[i][j+1],al,white);}};
  // Dark body only, 80% transparent (opacity .2); it still writes depth for occlusion.
  layer(grid(.06),.2*bodyAlpha,0);}
 // Data overlay anchors, in true screen pixels through the rendering camera (so they stay on the body while the camera
 // moves), plus the body's on-screen bounding box (wing outline) so labels can sit clear of the wings.
 if(showData){const S=p=>Stage.screen(proj(p)),out=[];for(let k=0;k<=16;k++){const u=-1+2*k/16;out.push(S(MG.surface(u,0,state)),S(MG.surface(u,1,state)));}
  // The box is the body outline only: the tail is a thin line, and counting it would push labels far from the body.
  const tl=S(MG.tail(1,state));let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const q of out){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1]);}
  // Head-to-body length on screen (front of the head to the end of the body, tail excluded): decides whether this
  // manta shows data — on above 5% of the frame height, off again below 4% (so it does not flicker at the edge).
  // In a 9:16 Reel the same manta measures only ~30% as much (smaller body, wider view), so there it is 1.5% / 1.2%.
  const ap=S(MG.surface(0,0,state)),be=S(MG.surface(0,1,state)),len=Math.hypot(be[0]-ap[0],be[1]-ap[1]);
  const on=window.reelActive?.015:.05,off=window.reelActive?.012:.04;member.dataOn=member.dataOn?len>=h*off:len>h*on;
  member.hud={r:radius*1.6*Stage.D/dist,len,box:[x0,y0,x1,y1],apex:ap,skirt:S(MG.surface(.6,.3,state)),hemL:S(MG.surface(-1,0,state)),centre:S(MG.surface(0,.5,state)),tail:tl};}
}
// Internal structure (after the second design sheet): parallel jointed pectoral radials,
// a segmented central spine, the core cage around the body cavity, the cephalic ring joint, ribbed lobe spirals
// and vertebrae shrinking down the tail. All points sit on (or just under) the same surface, so they flap with it.
function drawSkeleton(state,proj,count){
 const S=MG.surface,in_=p=>(p[2]+=.03,p),steps=count>3?16:24;
 // Batch drawing: one polyline (pts) or many short segments (ticks) in a single path and colour.
 const segs=(pts,ticks,alpha,width)=>{const rgb=toneRGB(.55,62+bodyLight*12),a=M.clamp(alpha*(.3+bodyLight*.9)*bodyAlpha);
  if(pts)pushLine(pts,0,pts.length-1,rgb,a,width);if(ticks)for(const s of ticks)pushLine(s,0,1,rgb,a,width);};
 // Pectoral radials: many parallel cartilage rays at fixed chord v, running from the body to the fin edge.
 // Each is jointed; joints crowd toward the tip (s_k = 1 − (1 − k/K)^1.5) and the ray thins outward.
 const rayN=count>3?20:30,K=count>3?8:12;
 for(const side of [-1,1])for(let i=1;i<rayN;i++){const v=i/rayN;let pts=[],ticks=[];for(let k=0;k<=steps;k++)pts.push(proj(in_(S(side*(.12+.88*k/steps),v,state))));
  segs(pts,null,.16,.5);
  for(let k=1;k<K;k++){const s=1-(1-k/K)**1.5,u=side*(.12+.88*s),dv=.35/rayN*(1-s*.7);ticks.push([proj(in_(S(u,v-dv,state))),proj(in_(S(u,v+dv,state)))]);}
  segs(null,ticks,.2,.5);}
 // Central spine with vertebra ticks, widest mid-body.
 {let pts=[];for(let k=0;k<=40;k++)pts.push(proj(in_(S(0,.04+.92*k/40,state))));stroke(pts,.85,.45,1.4);
  for(let k=0;k<=18;k++){const v=.08+.86*k/18,wd=.05*Math.sin(Math.PI*(.15+.75*k/18));stroke([proj(in_(S(-wd,v,state))),proj(in_(S(wd,v,state)))],.8,.4,1);}}
 // Core cage: concentric ovals around the body cavity, joined by short struts.
 for(let ring=0;ring<3;ring++){const rx=.2-ring*.05,rv=.32-ring*.08;let pts=[];for(let k=0;k<=48;k++){const a=k/48*TAU;pts.push(proj(in_(S(rx*Math.cos(a),.5+rv*Math.sin(a),state))));}stroke(pts,loop,.28-ring*.05,.8);}
 for(let k=0;k<12;k++){const a=k/12*TAU;stroke([0,2].map(r=>proj(in_(S((.2-r*.05)*Math.cos(a),.5+(.32-r*.08)*Math.sin(a),state)))),.5,.18,.6);}
 // Cephalic ring joint across the head, with a socket at each lobe root.
 {let pts=[];for(let k=0;k<=30;k++)pts.push(proj(in_(S(-.16+.32*k/30,.07+.03*Math.sin(Math.PI*k/30),state))));stroke(pts,.3,.4,1.1);
  for(const side of [-1,1]){const c=MG.lobe(0,side,state);let ring=[];for(let k=0;k<=20;k++){const a=k/20*TAU;ring.push(proj([c[0]+Math.cos(a)*.05,c[1]+Math.sin(a)*.035,c[2]]));}stroke(ring,.3,.4,.9);}}
 // Lobe spiral supports: ribs across the curled fin.
 for(const side of [-1,1])for(let k=1;k<12;k++){const q=k/12,a=MG.lobe(q,side,state),b=[a[0]+side*.06*(1-q),a[1],a[2]+.04*(1-q)];stroke([proj(a),proj(b)],.3,.3,.6);}
 // Tail vertebrae: ticks shrinking as r₀e^{−λt}.
 for(let k=0;k<22;k++){const q=k/22,p=MG.tail(q,state),n=MG.tail(q+.01,state),dx=n[0]-p[0],dy=n[1]-p[1],l=Math.hypot(dx,dy)||1,wd=.03*Math.exp(-2.2*q);
  stroke([proj([p[0]-dy/l*wd,p[1]+dx/l*wd,p[2]]),proj([p[0]+dy/l*wd,p[1]-dx/l*wd,p[2]])],.7,.35,.8);}
}
// Live readout: English-only values beside each ghost, placed level with the body part they belong to
// (apex, skirt, hem, centre, trailing chain).
let showData=false;try{showData=localStorage.getItem('manta-data')==='1';}catch(e){}
{const b=document.getElementById('dataToggle');const sync=()=>{b.setAttribute('aria-pressed',String(showData));b.textContent=(showData?'◉':'○')+' DATA';};sync();b.onclick=()=>{showData=!showData;try{localStorage.setItem('manta-data',showData?'1':'0');}catch(e){}sync();dirty=true;};}
function drawData(){
 // Every manta's body is kept clear of labels; only mantas long enough on screen (m.dataOn) get labels.
 const f=(v,d=2)=>(v??0).toFixed(d),all=population.members.filter(m=>m.hud&&Number.isFinite(m.x)),ms=all.filter(m=>m.dataOn);if(!ms.length)return;
 const maxR=Math.max(1,...ms.map(o=>o.hud.r)),txt=l=>typeof l==='string'?l:l.t;
 const deg=v=>((v*180/Math.PI)%360+360)%360,mmss=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s%60)).padStart(2,'0');
 const Hd=window.HandInput,handOn=window.CamInput?.active&&Hd?.present;
 // The gesture the camera reads now and what it does (open palm counts as a wave only while waving).
 const gesture=handOn&&(Hd.closed?'握拳 → 召喚':Hd.peace?'兩指 → 發光':palm.on?'晃動 → 驚嚇':Hd.gesture==='open'?'張開':'辨識中');
 // The gesture line is mint green (#6bffc0) at 90% opacity whenever the camera sees a hand, whatever the manta's
 // size, steady (no breathing). It flares toward white for ~1.2 s when the gesture changes.
 if(gesture!==gestureLast){gestureLast=gesture;gestureAt=time;}
 const gestureLine=handOn&&{t:'手勢：'+gesture,hi:M.clamp(1-(time-gestureAt)/1.2),gesture:true};
 // Placement. Every manta's body box is taken first; labels are then placed, nearest (largest) manta first and its
 // groups in order of importance (heading, distance, flap, colour, beat/gesture), each beside its anchor just outside the body box — on the anchor's side, else the
 // other side, else just below or above the body — sliding a little if needed. A group that still collides with a body or another label is
 // left out, so captions never cover a wing or each other. Reel: kept between the strips Instagram covers.
 const occ=all.map(m=>{const b=m.hud.box;return [b[0]-4,b[1]-4,b[2]+4,b[3]+4];});
 const clash=a=>occ.some(o=>a[0]<o[2]&&a[2]>o[0]&&a[1]<o[3]&&a[3]>o[1]);
 const top=window.reelActive?h*.14+4:6,bottom=window.reelActive?h*.8-4:h-6;
 ctx.save();ctx.textBaseline='middle';
 for(const m of [...ms].sort((a,b)=>b.hud.r-a.hud.r)){const H=m.hud,r=H.r,[bx0,,bx1]=H.box,cx=(bx0+bx1)/2;
  // Text size follows each manta's size relative to the largest on screen: the largest reads at 12px, the others
  // scale by (r / largest)^0.7 (a half-size manta gets ~7px), never below 6px; ×0.9 in a Reel. Smaller ones read dimmer.
  const size=Math.max(6,12*Math.pow(r/maxR,.7))*(window.reelActive?.9:1),lh=size*1.3,alpha=(.3+.7*M.clamp(r/maxR,.3,1))*.6;
  const bl=jellyRadius(m)*.62*2.4,speed=Math.hypot(m.vx??0,m.vy??0)/Math.max(1,bl),depth=m.depth??16;
  // Reel: a lighter set for the small vertical frame — colour and age, plus the gesture when the camera sees a hand.
  const groups=window.reelActive?[
   [H.hemL,['體色：'+Math.round(m.a??195)+'° / '+Math.round(m.b??230)+'°','年齡：'+mmss(Math.max(0,time-(m.born??0)))]],
   gestureLine&&[H.tail,[gestureLine]]].filter(Boolean):[
   [H.apex,['朝向：'+f(deg(m.ang??0),0)+'°']],
   [H.centre,['距離：'+f(depth,1)+' 公尺','速度：'+f(speed)+' 身長/秒']],
   [H.skirt,['拍翅：'+f(m.f)+' 次/秒 · 幅度 '+f(m.amp),'傾斜：'+f((m.bank??0)*180/Math.PI,1)+'°']],
   [H.hemL,['體色：'+Math.round(m.a??195)+'° / '+Math.round(m.b??230)+'°','年齡：'+mmss(Math.max(0,time-(m.born??0)))]],
   // Only meaningful with music / with the camera on.
   (audioSession||handOn)&&[H.tail,[audioSession&&('節拍：'+(sound.bpm?(Math.abs(m.fpCorr??0)<.3?'同步':'對拍中'):'無節拍')),gestureLine].filter(Boolean)]].filter(Boolean);
  ctx.font=`${size.toFixed(1)}px ui-monospace,Menlo,"PingFang TC","Noto Sans TC",monospace`;
  for(const [p,lines] of groups){if(!p||!Number.isFinite(p[0]))continue;
   const tw=Math.max(...lines.map(l=>ctx.measureText(txt(l)).width)),gh=lines.length*lh,pref=p[0]<cx?-1:1;let spot=null;
   search:for(const side of [pref,-pref]){const x=side<0?bx0-10-tw:bx1+10;if(x<6||x+tw>w-6)continue;
    for(const k of [0,1,-1,2,-2,3,-3,4,-4]){const y=M.clamp(p[1]-gh/2+k*lh,top,bottom-gh),box=[x-3,y-2,x+tw+3,y+gh+2];if(!clash(box)){spot={x,y,box};break search;}}}
   // No room beside the body (screen edge, or another manta): try just below it, then just above, sliding sideways.
   if(!spot)search2:for(const y0 of [H.box[3]+8,H.box[1]-8-gh]){if(y0<top||y0+gh>bottom)continue;
    for(const k of [0,1,-1,2,-2,3,-3]){const x=M.clamp(p[0]-tw/2+k*tw*.6,6,w-6-tw);for(let n=0;n<3;n++){const y=y0+(y0>H.box[1]?1:-1)*n*lh,box=[x-3,y-2,x+tw+3,y+gh+2];
     if(y>=top&&y+gh<=bottom&&!clash(box)){spot={x,y,box};break search2;}}}}
   if(!spot)continue;occ.push(spot.box);ctx.textAlign='left';
   // First line bright, second dim; a line that just changed (hi) flares toward warm white.
   lines.forEach((l,i)=>{const g=typeof l==='string'?0:l.hi||0;
    ctx.fillStyle=typeof l!=='string'&&l.gesture?`rgba(${Math.round(107+148*g)},255,${Math.round(192+63*g)},.9)`:g>0?`rgba(255,${Math.round(228+12*g)},${Math.round(234-60*g)},${Math.min(1,(.95+.5*g)*alpha)})`:i?`rgba(140,165,175,${.8*alpha})`:`rgba(215,228,234,${.95*alpha})`;
    ctx.fillText(txt(l),spot.x,spot.y+lh*(i+.5));});}}
 ctx.restore();
}
function render(){
 if(!window.Stage)return;
 // The sea is the shared ABYSS environment. Species set its pace; music swells the current, the particles and the light
 // on top of whatever the environment panel is set to (modulate multiplies, it never overwrites the panel).
 const want=SPECIES[speciesKey].sea,k=1-Math.exp(-.016/1.2);for(const key of ['n','speed','size','alpha'])sea[key]+=(want[key]-sea[key])*k;
 const E=Stage.env;E.modulate('flowSpeed',sea.speed*(audioSession?.7+soft.energy*1.2:1));E.modulate('flowAmp',audioSession?.8+soft.bass*.9:1);
 E.modulate('pBright',sea.alpha*(audioSession?.7+soft.treble*.9+beatGlow*.3:1));// The music drives the light shafts only: nearly gone in quiet passages (×0.15), up to ~×3.5 at full level, with a
 // flare on each beat that fades in ~0.3 s. The overall light stays steady.
 E.modulate('shaftGain',(audioSession?.15+(soft.light??0)*2.6+beatGlow*.9:1)*(1+breachFlash*2));E.modulate('lightIntensity',(.9+visual.light*.15)*(1+breachFlash*.9));
 // Far to near, so semi-opaque bodies layer correctly.
 // Recording a Reel renders 1080×1920: trim particles and fog steps so the video stays smooth.
 E.modulate('count',window.reelActive?.6:1);E.modulate('steps',window.reelActive?.75:1);
 for(const member of [...population.members].sort((a,b)=>(b.depth??16)-(a.depth??16)))drawJelly(member);
 // Cinematic camera input: music levels, the beat, and the mantas' mean position (−1…1 across the screen).
 let fx=0,fy=0,nm=0;for(const m of population.members)if(Number.isFinite(m.x)){fx+=m.x/w*2-1;fy+=1-m.y/h*2;nm++;}
 bubbleStep();const leapLift=Math.max(0,...population.members.map(m=>breach(m).lift));
 Stage.render(pointer,{lift:leapLift,auto:autoCam,music:audioSession,eShort:soft.light??0,eLong:soft.longLight??0,beat:audioSession&&sound.beat,beatStrength:soft.bass,focusX:nm?fx/nm:0,focusY:nm?fy/nm:0});
 // Live: the WebGL stage is its own canvas behind #ocean, which only carries the overlay — no per-frame copy.
 // Recording: the Reel captures #ocean, so the stage frame is copied in first.
 if(window.reelActive){ctx.globalCompositeOperation='copy';ctx.drawImage(Stage.canvas,0,0,w,h);ctx.globalCompositeOperation='source-over';}else ctx.clearRect(0,0,w,h);
 if(showData)drawData();
 drawHandDebug();
 if(window.reelActive&&window.reelWatermark){ctx.save();ctx.textAlign='center';ctx.fillStyle='rgba(220,232,238,.55)';ctx.font='300 13px Inter,Helvetica Neue,sans-serif';ctx.fillText('ALATA',w/2,h*.17);ctx.font='300 8px Inter,Helvetica Neue,sans-serif';ctx.fillStyle='rgba(160,180,195,.5)';ctx.fillText(SPECIES[speciesKey].latin+' · SONIC MANTA',w/2,h*.17+15);ctx.restore();}
 if(window.reelActive)window.reelCapture?.();
 dirty=false;
}
function meters(){
 const secs=audioSession?A.elapsed:age;document.getElementById('age').textContent=String(Math.floor(secs/60)).padStart(2,'0')+':'+String(Math.floor(secs%60)).padStart(2,'0');
 document.getElementById('growth').textContent=growth.toFixed(3);document.getElementById('pulse').textContent=pulseRate.toFixed(2);document.getElementById('population').textContent=population.members.length;
 document.getElementById('state').textContent=audioSession?({playing:'音樂驅動',paused:'已暫停',ready:'音樂就緒',ended:'本曲結束',idle:'音訊已斷開',error:'等待音訊'})[A.status]||'準備音訊':paused?'已暫停':'自由演算';
 if(audioSession)for(const key of ['energy','flow','light']){document.getElementById(key).value=visual[key]*100;document.getElementById(key+'Val').textContent=Math.round(visual[key]*100)+'%';}
 window.updateMusicMeters?.(sound,population.members.length);
}
function frame(now){
 requestAnimationFrame(frame);if(document.hidden){last=null;return;}
 // While recording a Reel: a steady 30 fps (evenly spaced frames read smoother in the video than an uneven 40–60).
 if(now-lastPaint<(window.reelActive?31:15))return;
 const dt=last===null?0:Math.min((now-last)/1000,.12);last=now;lastPaint=now;
 const running=audioSession?A.status==='playing':!paused;
 if(running){
  if(audioSession){sound=A.sample(dt);time=A.elapsed;age=Math.max(age,A.duration?A.elapsed/A.duration:1-Math.exp(-A.elapsed/180));growth=.25+.75*age;population.update(sound,dt,time);}
  else {sound=M.empty();time+=dt;age+=dt*(.25+params.energy*1.5);growth=.25+.75*(1-Math.exp(-age/85));}
  beatGlow=audioSession&&sound.beat?1:beatGlow*Math.exp(-dt*3.5);if(audioSession){visual.energy=.02+sound.energy*.3;visual.flow=.65+sound.flux*.2+sound.density*.15;visual.light=M.clamp(.2+sound.energy*.3+sound.treble*.25);visual.hue=M.smooth(visual.hue,30-sound.centroid*55,dt,1.5);}else visual={...params};
  {const fr=SPECIES[speciesKey].freq,dr=audioSession?soft.energy??sound.energy:params.energy;pulseRate=population.members[0]?.f??fr[0]+(fr[1]-fr[0])*M.clamp(dr);}
  phase+=dt*pulseRate*TAU;if(sound.beat){const target=3*Math.PI/2;const delta=Math.atan2(Math.sin(target-phase),Math.cos(target-phase));phase+=delta*.06;}
  for(const k of ['pan','centroid','mid','treble','width'])soft[k]=M.smooth(soft[k],sound[k],dt,.7);soft.bass=M.smooth(soft.bass,sound.bass,dt,.25);soft.energy=M.smooth(soft.energy??0,sound.energy,dt,1.5);
  // Faster envelope just for the sea's light, so swells and drops in the music read in the water within ~0.35s.
  soft.light=M.smooth(soft.light??0,M.clamp(sound.energy*1.5+sound.bass*.5),dt,.35);
  // Long-term level (~8 s) for the camera: it reacts to the music rising above or falling below its recent level.
  soft.longLight=M.smooth(soft.longLight??0,soft.light,dt,8);
  camStep(dt);for(const m of population.members){swimStep(m,dt);spinStep(m,dt);}
  wave+=dt*(.8+visual.flow*1.4);travel+=dt*(.08+visual.energy*.14+visual.flow*.035)*(.6+.8*Math.max(0,-Math.cos(phase))+beatGlow*.4);
  pointer=M.smooth(pointer,targetPointer,dt,.4);groupScale=M.smooth(groupScale,1/Math.sqrt(1+(population.members.length-1)*.12),dt,3);render();
 }else if(dirty){if(!audioSession)visual={...params};render();}
 if(now-lastUI>120||dirty){meters();lastUI=now;}
}
syncControls();requestAnimationFrame(frame);
setSpecies(speciesKey);{const w0=SPECIES[speciesKey].sea;Object.assign(sea,w0,{rgb:[...w0.rgb]});}document.getElementById('species').onchange=e=>setSpecies(e.target.value);

// Webcam motion → the water and the mantas. The strongest moving cells (up to 4, spread apart) become stirs in the
// particle field at the mantas' depth: they ease in fast (~0.12 s) and fade over ~0.6 s. Strong motion close to a
// manta startles it — it turns away and beats hard, the same reflex as a sudden sound.
const stirs=[0,1,2,3].map(()=>({x:0,y:0,s:0}));const palm={flips:[]},vee={flips:[]};let gestureLast=null,gestureAt=-9;
// Camera (0–1, mirrored) → screen pixels, cropping the camera picture to the frame's shape instead of stretching it.
// A 4:3 webcam on the 9:16 Reel frame keeps only its centre ~42% of the width, so the hand lands where it appears
// and a small sideways move travels as far on screen as it does in the camera picture (no squeeze, no drift).
// Breach profile over LEAP seconds (u = 0…1): rise to the surface (eased), out of the water in a short arc above it,
// then down again to its own depth. lift is in metres above the swimming depth; Stage.surfaceLift reaches the surface.
const LEAP=5;
function breach(m){if(!m.leapT)return {u:0,lift:0};const u=1-m.leapT/LEAP,R=window.Stage?Stage.surfaceLift:28,sm=(a,b,x)=>{const q=M.clamp((x-a)/(b-a));return q*q*(3-2*q);};
 const lift=u<.32?(R+.5)*sm(0,.32,u):u<.5?R+.5+2.5*Math.sin(Math.PI*(u-.32)/.18):(R+.5)*(1-sm(.5,.85,u));return {u,lift};}
// Only one manta breaches at a time (the camera follows it).
const breachBusy=m=>population.members.some(o=>o!==m&&o.leapT>0);
// Bubbles: rising rings in world space (metres), drawn into the line batch; they wobble, grow a little and vanish at
// the surface or after a few seconds.
const bubbles=[];let breachFlash=0,bubbleLast=performance.now();
function bubbleEmit(p,n,spread){for(let i=0;i<n&&bubbles.length<400;i++)bubbles.push({x:p[0]+(Math.random()-.5)*spread,y:p[1]+(Math.random()-.5)*spread*.6,z:p[2]+(Math.random()-.5)*spread,
 r:.04+Math.random()*.12,v:1.2+Math.random()*1.8,ph:Math.random()*6.28,life:2.5+Math.random()*2.5});}
function bubbleStep(){const now=performance.now(),dt=Math.min(.1,(now-bubbleLast)/1000);bubbleLast=now;breachFlash=Math.max(0,breachFlash-dt*1.4);
 const top=window.Stage?-20+Stage.surfaceLift:8;
 for(let i=bubbles.length-1;i>=0;i--){const b=bubbles[i];b.life-=dt;b.y+=b.v*dt;b.ph+=dt*6;b.x+=Math.sin(b.ph)*.25*dt;b.r*=1+dt*.05;
  if(b.life<=0||b.y>top){bubbles.splice(i,1);continue;}
  const a=Math.min(1,b.life)*.55,n=8;for(let k=0;k<n;k++){const t0=k/n*TAU,t1=(k+1)/n*TAU;Stage.push([b.x+Math.cos(t0)*b.r,b.y+Math.sin(t0)*b.r,b.z],[b.x+Math.cos(t1)*b.r,b.y+Math.sin(t1)*b.r,b.z],.75,.92,1,a);}}}
function camToScreen(x,y){const v=window.CamInput?.video,ca=v&&v.videoWidth?v.videoWidth/v.videoHeight:4/3,fa=w/h;
 if(fa<ca){const s=fa/ca;x=(x-.5)/s+.5;}else{const s=ca/fa;y=(y-.5)/s+.5;}return [x*w,y*h];}
function camStep(dt){
 const C=window.CamInput;if(!C||!window.Stage)return;const picks=[];
 if(C.active){const list=[];for(let i=0;i<C.cells.length;i++)if(C.cells[i]>.06)list.push(i);list.sort((a,b)=>C.cells[b]-C.cells[a]);
  for(const i of list){const [cx,cy]=camToScreen((i%C.CW+.5)/C.CW,(Math.floor(i/C.CW)+.5)/C.CH);if(picks.some(p=>Math.hypot(p.x-cx,p.y-cy)<w*.15))continue;picks.push({x:cx,y:cy,s:C.cells[i]});if(picks.length===4)break;}}
 stirs.forEach((st,k)=>{const p=picks[k],ox=st.x,oy=st.y;if(p&&(p.s>st.s*.6||st.s<.05)){st.x=p.x;st.y=p.y;}
  // Speed = distance travelled per second (screen widths), as an exponential average over ~0.5 s: every move adds
  // jump/τ and the total decays. A slow hand stepping one grid cell every half second reads ~0.12; a wave, which goes
  // back and forth (so its average position barely moves), still covers a lot of distance and reads ~1.
  // A jump to a far spot (a different moving thing) is not counted.
  const jump=Math.hypot(st.x-ox,st.y-oy)/w;st.v=(st.v??0)*Math.exp(-dt/.5)+(st.s>.05&&jump<.25?jump/.5:0);
  st.fx=st.fx===undefined||jump>=.25?st.x:M.smooth(st.fx,st.x,dt,.12);st.fy=st.fy===undefined||jump>=.25?st.y:M.smooth(st.fy,st.y,dt,.12);
  // Fast: moving quickly, or a big vigorous movement filling much of the frame.
  st.fast=st.s>.25&&st.v>.45||C.level>.45&&st.s>.6;
  st.s=M.smooth(st.s,p?Math.min(1,p.s*2):0,dt,p?.12:.8);const q=Stage.toWorld(st.x,st.y);Stage.env.setStir(k,q[0],q[1],q[2],st.s);});
 // Fist → the mantas come: while the tracked hand is closed, every manta swims to it, ranked by distance — the nearest
 // circles it closely, the others at wider rings. Open the hand (or take it away) and they drift off after ~1.5 s.
 for(const m of population.members)if(m.pendingStartle&&time>=m.pendingStartle.at){startle(m,m.pendingStartle.x,m.pendingStartle.y,m.pendingStartle.close??.5,false);m.pendingStartle=null;}
 const Hd=window.HandInput;
 // ✌ shown → the lines on the mantas glow, steadily, for as long as the two fingers are up; they ease back ~0.3 s
 // after. This runs even when the hand has left the frame, so the glow always ends. While ✌ is up, and for 1 s
 // after, the open-palm wave is ignored, so the hand moving or the recogniser briefly losing the gesture never makes
 // the mantas roll.
 const peaceNow=!!(C.active&&Hd?.present&&Hd.peace);if(peaceNow)vee.seen=time;
 for(const m of population.members)m.flickT=peaceNow?1:0;
 if(!C.active||!Hd?.present)return;const [hx,hy]=camToScreen(Hd.x,Hd.y);
 // Open palm waved → scare. A wave is the palm going back and forth: it travels (path rate) and reverses at least
 // once within ~1 s. Measured on the unsmoothed palm position, and fast waves that blur the hand out of tracking
 // still count: strong camera motion right where the palm was in the last 0.6 s adds to the path.
 // Every manta then turns away, rolls and flashes; nearer ones first and harder, like a ripple. At most once / 2 s.
 const [rx,ry]=camToScreen(Hd.rawX??Hd.x,Hd.rawY??Hd.y),dx=rx-(palm.px??rx),dy=ry-(palm.py??ry);palm.px=rx;palm.py=ry;
 let blur=0;if(performance.now()-(Hd.seenAt??0)<600)for(const st of stirs)if(st.s>.3&&Math.hypot(st.x-rx,st.y-ry)<w*.12)blur=Math.max(blur,st.s);
 palm.rate=(palm.rate??0)*Math.exp(-dt/.5)+(Math.hypot(dx,dy)/w+blur*dt*.6)/.5;
 if(Math.abs(dx)>w*.002){const s=Math.sign(dx);if(palm.dir&&s!==palm.dir)palm.flips.push(time);palm.dir=s;}
 palm.flips=palm.flips.filter(f=>time-f<1);
 // Waving: on as soon as the wave is detected, and it stays on while the palm keeps going back and forth (a reversal
 // or strong blur within the last ~0.8 s). The first wave sends a ripple (nearer mantas first); while it continues,
 // every manta keeps rolling — a new roll starts as soon as the previous one ends — and keeps fleeing.
 const waving=!Hd.closed&&!Hd.peace&&time-(vee.seen??-9)>1&&(palm.rate>.16&&palm.flips.length>=1||blur>.6&&palm.rate>.12||palm.on&&palm.rate>.1&&(time-(palm.flips.at(-1)??-9)<.8||blur>.4));
 if(waving){const far=Math.hypot(w,h);
  for(const m of population.members){if(!Number.isFinite(m.x))continue;const d=Math.hypot(m.x-hx,m.y-hy),close=1-Math.min(1,d/(far*.6));
   if(!palm.on)m.pendingStartle={at:time+.05+(1-close)*.45,x:hx,y:hy,close:.35+.65*close};
   else if(!m.spin&&!m.pendingStartle&&time-(m.startleAt??-9)>.3){startle(m,hx,hy,Math.max(.4,.35+.65*close),false);m.spinRest=0;}}
  palm.last=time;}
 palm.on=waving;
 if(!Hd.closed)return;
 const order=population.members.filter(m=>Number.isFinite(m.x)).sort((a,b)=>Math.hypot(a.x-hx,a.y-hy)-Math.hypot(b.x-hx,b.y-hy));
 // Ring radii in body radii: the nearest almost touches the hand (0.55), the rest close in behind it.
 order.forEach((m,i)=>{m.lureX=hx;m.lureY=hy;m.lureT=1.5;m.lureR=.55+.75*i;});
}
// The manta nearest to a stir (on screen); only it is lured, so one comes over instead of the whole group.
function nearestTo(st){let b=null,d=Infinity;for(const o of population.members){if(!Number.isFinite(o.x))continue;const k=Math.hypot(o.x-st.x,o.y-st.y);if(k<d){d=k;b=o;}}return b;}
function startle(m,sx,sy,close,spread){
 const dx=m.x-sx,dy=m.y-sy;m.startleAt=time;m.glide=0;m.lureT=0;m.flash=1;
 m.turnKick=(Math.sin(m.ang)*dy+Math.cos(m.ang)*dx>0?1:-1)*(1.2+1.6*close);if(close>.35)m.wantSpin=1;
 if(spread)for(const o of population.members){if(o===m||!Number.isFinite(o.x)||o.pendingStartle||time-(o.startleAt??-9)<2)continue;
  if(Math.hypot(o.x-m.x,o.y-m.y)<jellyRadius(m)*2&&Math.abs((o.depth??16)-(m.depth??16))<6)o.pendingStartle={at:time+.15+Math.random()*.25,x:sx,y:sy};}
}
{const b=document.getElementById('camInputToggle');const sync=()=>{const on=!!window.CamInput?.active;b.setAttribute('aria-pressed',String(on));b.textContent=(on?'◉':'○')+' 鏡頭互動';};sync();
 // While on, the button shows a live motion meter (▮ per 20%), so it is clear the camera is seeing movement.
 setInterval(()=>{const C=window.CamInput,Hd=window.HandInput;if(C?.active){const k=Math.round(Math.min(1,C.level)*5);
  b.textContent='◉ 鏡頭互動 '+(Hd?.loading?'載入手部辨識…':Hd?.error?'（僅動作）':Hd?.present?(Hd.closed?'✊':'✋'):'')+' '+'▮'.repeat(k)+'▯'.repeat(5-k);}},150);
 b.onclick=async()=>{const C=window.CamInput;if(C.active)C.stop();else{b.textContent='… 開啟相機';if(!await C.start())alert(C.error+' 鏡頭互動需要相機權限；影像只在本機分析，不會顯示、上傳或錄進影片。');}sync();};}
// Hand diagnostic (only while 鏡頭互動 is on, never in a Reel): one status line, so it is visible what the camera
// actually recognises.
function drawHandDebug(){
 const C=window.CamInput,Hd=window.HandInput;if(!C?.active||window.reelActive)return;ctx.save();
 const s=!Hd?'手部辨識未載入':Hd.loading?'手部辨識：載入模型中…':Hd.error?Hd.error:!Hd.ready?'手部辨識：等待中':!Hd.present?`手部：未偵測到手（已分析 ${Hd.frames} 幀）`:
  `手部：${Hd.closed?'✊ 握拳 → 召喚魟':Hd.peace?'✌ 兩指 → 魟的線條發光':Hd.gesture==='open'?'✋ 張開':'… 辨識中'}　彎曲角 ${(Hd.bends||[]).map(b=>Math.round(b)+'°').join(' ')}　伸展 ${(Hd.ratios||[]).map(r=>r.toFixed(2)).join(' ')}`;
 ctx.font='12px ui-monospace,Menlo,monospace';ctx.textAlign='left';ctx.textBaseline='bottom';ctx.fillStyle='rgba(215,235,240,.8)';ctx.fillText(s,24,h-92);ctx.restore();}
// Auto camera toggle (remembered per browser).
let autoCam=true;try{autoCam=localStorage.getItem('manta3d-autocam')!=='0';}catch(e){}
{const b=document.getElementById('camToggle');const sync=()=>{b.setAttribute('aria-pressed',String(autoCam));b.textContent=(autoCam?'◉':'○')+' 自動運鏡';};sync();
 b.onclick=()=>{autoCam=!autoCam;try{localStorage.setItem('manta3d-autocam',autoCam?'1':'0');}catch(e){}sync();dirty=true;};}
// The stage module loads after these classic scripts; size it and draw once it is ready.
addEventListener('stage-ready',()=>{resize();dirty=true;const el=document.getElementById('envFields');if(el)Stage.mountPanel(el);});
