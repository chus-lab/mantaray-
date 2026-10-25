/* Audio measurements and population rules; independent of browser permissions. */
(function(root){
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:0));
  const smooth=(a,b,dt,tau)=>a+(b-a)*(1-Math.exp(-dt/tau));
  const empty=()=>({rms:0,energy:0,bass:0,mid:0,treble:0,flux:0,centroid:0,density:0,pan:0,width:0,beat:false,bpm:0,peakHz:0});
  class Features {
    constructor(){this.reset();}
    reset(){this.value=empty();this.previous=null;this.average=.01;this.lastBeat=-10;this.intervals=[];this.silent=0;}
    measure(wave,spectrum,sampleRate,dt,now,left,right,sensitivity=1){
      dt=clamp(dt,.001,.15);let sum=0,l=0,r=0,cross=0;
      for(let i=0;i<wave.length;i++){sum+=wave[i]**2;if(left&&right){l+=left[i]**2;r+=right[i]**2;cross+=left[i]*right[i];}}
      const rms=Math.sqrt(sum/wave.length),audible=rms*sensitivity>.003;
      const hz=sampleRate/(spectrum.length*2),bands=[0,0,0],regions=new Float64Array(8);
      let power=0,weighted=0,positive=0,peak=0,peakHz=0;
      if(!this.previous||this.previous.length!==spectrum.length)this.previous=new Float32Array(spectrum.length);
      for(let i=1;i<spectrum.length;i++){
        const f=i*hz;if(f<30||f>16000)continue;
        const amp=10**(clamp(spectrum[i],-120,0)/20),p=amp*amp;
        power+=p;weighted+=p*f;bands[f<250?0:f<4000?1:2]+=p;
        const region=clamp(Math.floor(Math.log2(f/40)),0,7);regions[region]+=p;
        positive+=Math.max(0,amp-this.previous[i]);this.previous[i]=amp;
        if(p>peak){peak=p;peakHz=f;}
      }
      const energy=audible?clamp(1-Math.exp(-rms*10*sensitivity)):0;
      const flux=audible?clamp(positive*.7):0;
      const maxRegion=Math.max(...regions,1e-12);
      const occupied=audible?[...regions].filter(x=>x>maxRegion*.025&&x>1e-7).length:0;
      const density=audible?clamp((occupied-1)/7*.9+flux*.1):0;
      const oldAverage=this.average;this.average=smooth(this.average,rms,dt,.5);
      const beat=audible&&now-this.lastBeat>.28&&rms>Math.max(.008,oldAverage*1.35)&&flux>.012;
      if(beat){const interval=now-this.lastBeat;if(interval>.3&&interval<1.5)this.intervals.push(interval);this.intervals=this.intervals.slice(-8);this.lastBeat=now;}
      if(!audible)this.silent+=dt;else this.silent=0;
      let bpm=0;if(this.intervals.length>=3&&now-this.lastBeat<3){const sorted=[...this.intervals].sort((a,b)=>a-b);bpm=60/sorted[Math.floor(sorted.length/2)];}
      const target={rms,energy,bass:audible?clamp(Math.sqrt(bands[0])*5*sensitivity):0,mid:audible?clamp(Math.sqrt(bands[1])*5*sensitivity):0,treble:audible?clamp(Math.sqrt(bands[2])*8*sensitivity):0,flux,centroid:power>1e-12&&audible?clamp(Math.log2(Math.max(80,weighted/power)/80)/7):0,density,pan:audible&&l+r>1e-10?clamp((Math.sqrt(r)-Math.sqrt(l))/(Math.sqrt(r)+Math.sqrt(l)),-1,1):0,width:audible&&l*r>1e-16?clamp((1-cross/Math.sqrt(l*r))*.5):0,peakHz:audible?peakHz:0};
      for(const key of Object.keys(target)){const tau=['pan','centroid','peakHz','width'].includes(key)?1.5:key==='density'?1:.12;this.value[key]=smooth(this.value[key],target[key],dt,tau);}
      this.value.beat=beat;this.value.bpm=bpm;return this.value;
    }
  }
  // Procedural two-tone colour: hues live on a 300° wheel that skips the 90–150° greens
  // (they read as one colour), and the two tones are always 100–150° apart. About a third pair
  // their first tone with white instead (cyan → white, gold → white …).
  const wheel=x=>{x=((x%300)+300)%300;return x<90?x:x+60;};
  const twoTone=(id,rnd,f)=>{if(id===0)return {a:190,b:275};const base=id*137.5+rnd(2)*80+f.centroid*60,gap=(100+rnd(3)*50)*(rnd(4)<.5?-1:1);return {a:wheel(base),b:wheel(base+gap),white:rnd(5)<.35};};
  class Population {
    constructor(seed=2){this.reset(seed);}
    reset(seed=2){this.seed=seed;this.members=[];this.stable=0;this.lastBirth=0;this.finished=false;this.add(0,empty());}
    add(now,f){const id=this.members.length,seed=this.seed+id*17.31,rnd=k=>{const x=Math.sin(seed*12.9898+k*78.233)*43758.5453;return x-Math.floor(x);};this.members.push({id,seed,born:now,size:1.2*.85**id,...twoTone(id,rnd,f),ribbon: .8+f.mid*.55,side:f.pan});this.lastBirth=now;}
    update(f,dt,now){
      if(this.finished||this.members.length>=8)return false;
      const target=1+Math.min(7,Math.floor(clamp(f.density)*8));
      this.stable=target>this.members.length&&f.energy>.025?this.stable+Math.min(dt,.15):0;
      // Harder to be born as the population grows: needs 5 s of sustained density, and the gap after the
      // previous birth lengthens with each member (8 s, 13 s, 18 s … 38 s).
      if(this.stable>=5&&now-this.lastBirth>=8+(this.members.length-1)*5){this.add(now,f);this.stable=0;return true;}return false;
    }
  }
  const api={Features,Population,clamp,smooth,empty};if(typeof module!=='undefined')module.exports=api;else root.MusicModel=api;
})(typeof window==='undefined'?globalThis:window);
