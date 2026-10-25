/* Instagram Reel recorder: switches the canvas to a 1080×1920 (9:16) world, records it in real time with
   MediaRecorder together with the music, and downloads the file. Shares globals with app.js. */
(function(){
 const $=id=>document.getElementById(id),panel=$('reelPanel'),hud=$('reelHud'),audio=window.medusaAudio;
 const MIME=['video/mp4;codecs=avc1.640028,mp4a.40.2','video/mp4;codecs=avc1,mp4a','video/mp4','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
 const mime=()=>window.MediaRecorder?MIME.find(t=>MediaRecorder.isTypeSupported(t))||'':'';
 let rec=null;
 function show(open){panel.hidden=!open;$('reelToggle').setAttribute('aria-expanded',String(open));if(open)sync();}
 function sync(){
  const file=audio.mode==='file'&&!!audio.buffer,hasAudio=!!audio.context&&!!audio.source,type=mime();
  $('reelWhole').disabled=!file;if(!file&&$('reelLength').value==='whole')$('reelLength').value='30';
  $('reelFromStart').disabled=!file;$('reelAudio').disabled=!hasAudio;if(!hasAudio)$('reelAudio').checked=false;
  $('reelFormat').textContent=!type?'這個瀏覽器不支援錄影，請改用新版 Chrome、Edge 或 Safari。':type.startsWith('video/mp4')?'輸出 MP4（H.264），可直接上傳 IG。':'這個瀏覽器只能輸出 WebM，上傳 IG 前需轉成 MP4（建議改用新版 Chrome 或 Safari 直接得到 MP4）。';
  $('reelStart').disabled=!type;
 }
 function guides(){
  // Match the letterboxed 9:16 frame and mark the areas Instagram's own UI covers.
  const H=Math.min(innerHeight,innerWidth*16/9),W=H*9/16,box=$('reelFrame');
  Object.assign(box.style,{width:W+'px',height:H+'px',left:(innerWidth-W)/2+'px',top:(innerHeight-H)/2+'px'});
 }
 async function start(){
  const type=mime();if(!type||rec)return;
  const length=$('reelLength').value,withAudio=$('reelAudio').checked&&!$('reelAudio').disabled,watermark=$('reelMark').checked;
  show(false);window.reelActive=true;window.reelWatermark=watermark;document.body.classList.add('reel');resize();guides();
  try{
   if(audio.mode==='file'&&audio.buffer){if($('reelFromStart').checked&&!$('reelFromStart').disabled)await audio.restart();else if(audio.status!=='playing')await audio.play();}
   // Capture exactly the frames that are drawn: with captureStream(0) the page hands each finished frame to the
   // recorder (window.reelCapture, called at the end of app.js render), so frames are never duplicated or skipped by
   // a capture clock running out of step with rendering. Browsers without requestFrame fall back to a 30 fps clock.
   const probe=$('ocean').captureStream(0),vt=probe.getVideoTracks()[0];let stream=probe;
   if(vt&&typeof vt.requestFrame==='function')window.reelCapture=()=>vt.requestFrame();else{probe.getTracks().forEach(t=>t.stop());stream=$('ocean').captureStream(30);window.reelCapture=null;}
   if(withAudio){const a=audio.recordStream();if(a)for(const t of a.getAudioTracks())stream.addTrack(t);}
   const recorder=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:12e6,audioBitsPerSecond:192e3}),chunks=[];
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   recorder.onstop=()=>{stream.getVideoTracks().forEach(t=>t.stop());save(new Blob(chunks,{type:type.split(';')[0]}),type);};
   rec={recorder,started:performance.now(),limit:length==='whole'?Infinity:+length*1000,whole:length==='whole'};
   recorder.start(1000);tick();
  }catch(e){cleanup();alert('無法開始錄影：'+(e.message||e));}
 }
 function tick(){
  if(!rec)return;const t=performance.now()-rec.started;
  $('reelTime').textContent=`● ${String(Math.floor(t/60000)).padStart(2,'0')}:${String(Math.floor(t/1000)%60).padStart(2,'0')}`+(rec.limit<Infinity?` / ${rec.limit/1000} 秒`:' / 整首');
  if(t>=rec.limit||(rec.whole&&audio.status==='ended'))stop();else requestAnimationFrame(tick);
 }
 function stop(){if(!rec)return;const r=rec.recorder;rec=null;if(r.state!=='inactive')r.stop();cleanup();}
 function cleanup(){window.reelCapture=null;window.reelActive=false;window.reelWatermark=false;document.body.classList.remove('reel');resize();}
 function save(blob,type){
  const d=new Date(),p=n=>String(n).padStart(2,'0'),ext=type.startsWith('video/mp4')?'mp4':'webm';
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`manta-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.${ext}`;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),60000);
 }
 $('reelToggle').onclick=()=>show(panel.hidden);$('reelClose').onclick=()=>show(false);
 $('reelStart').onclick=start;$('reelStop').onclick=stop;
 addEventListener('keydown',e=>{if(e.key==='Escape'&&rec)stop();});
 addEventListener('resize',()=>{if(window.reelActive)guides();});
 audio.addEventListener('change',()=>{if(!panel.hidden)sync();});
})();
