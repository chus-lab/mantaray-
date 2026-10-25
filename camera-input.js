/* Webcam motion: frame differencing on a tiny 64×48 grey image, ~20 times a second. No model, no recognition — it
   only measures where the picture changes. The video never leaves this page, is never shown and is never recorded.
   Output (mirrored, like a mirror: your right hand is on the right of the screen):
     CamInput.cells  — 16×12 grid of motion 0–1 (share of pixels that changed in each cell), smoothed
     CamInput.level  — overall motion 0–1
   A whole-frame change (lights switched, camera bumped) is ignored rather than read as motion. */
(function(){
 const GW=64,GH=48,CW=16,CH=12,PIX=18;
 const video=document.createElement('video');video.muted=true;video.playsInline=true;
 const can=document.createElement('canvas');can.width=GW;can.height=GH;const g=can.getContext('2d',{willReadFrequently:true});
 let stream=null,prev=null,timer=0;
 const api=window.CamInput={video,active:false,cells:new Float32Array(CW*CH),level:0,CW,CH,error:'',
  async start(){
   if(api.active)return true;
   try{stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},frameRate:{ideal:30},facingMode:'user'},audio:false});}
   catch(e){api.error=({NotAllowedError:'未取得相機權限。',NotFoundError:'找不到相機。',NotReadableError:'相機正被其他程式使用。'})[e.name]||e.message||'無法開啟相機。';return false;}
   video.srcObject=stream;await video.play().catch(()=>{});prev=null;api.active=true;api.error='';
   timer=setInterval(step,50);dispatchEvent(new Event('caminput-start'));return true;},
  stop(){clearInterval(timer);timer=0;if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;api.active=false;api.cells.fill(0);api.level=0;prev=null;dispatchEvent(new Event('caminput-stop'));}};
 function step(){
  if(!api.active||video.readyState<2)return;
  // Mirror horizontally so motion lands where the viewer sees it.
  g.setTransform(-1,0,0,1,GW,0);g.drawImage(video,0,0,GW,GH);
  const d=g.getImageData(0,0,GW,GH).data,grey=new Uint8Array(GW*GH);
  for(let i=0;i<GW*GH;i++)grey[i]=(d[i*4]*77+d[i*4+1]*150+d[i*4+2]*29)>>8;
  if(!prev){prev=grey;return;}
  const raw=new Float32Array(CW*CH),sx=GW/CW,sy=GH/CH;let moved=0;
  for(let y=0;y<GH;y++)for(let x=0;x<GW;x++){const i=y*GW+x;if(Math.abs(grey[i]-prev[i])>PIX){moved++;raw[Math.floor(y/sy)*CW+Math.floor(x/sx)]++;}}
  prev=grey;const share=moved/(GW*GH),global=share>.55;
  // Cells rise fast and fall over ~0.4 s, so a gesture leaves a short trail.
  for(let i=0;i<raw.length;i++){const v=global?0:Math.min(1,raw[i]/(sx*sy)*1.6);api.cells[i]=v>api.cells[i]?v:api.cells[i]*.88;}
  api.level=global?api.level*.88:Math.max(share*3,api.level*.9);}
 addEventListener('pagehide',()=>api.stop());
})();
