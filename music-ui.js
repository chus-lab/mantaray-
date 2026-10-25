'use strict';
(()=>{
 const audio=window.medusaAudio,$=id=>document.getElementById(id),musicPanel=$('musicPanel');
 const format=t=>Number.isFinite(t)?`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`:'即時';
 function show(open){musicPanel.hidden=!open;$('musicToggle').setAttribute('aria-expanded',String(open));if(open){$('controls').hidden=true;$('panelToggle').setAttribute('aria-expanded','false');$('toggleIcon').textContent='+';}}
 window.closeMusicPanel=()=>show(false);$('musicToggle').onclick=()=>show(musicPanel.hidden);$('musicClose').onclick=()=>{show(false);$('musicToggle').focus();};
 function options(){const mode=$('sourceMode').value;for(const key of ['live','mic','file'])$(key+'Options').hidden=key!==mode;$('connectAudio').hidden=mode==='file';$('connectAudio').textContent=mode==='mic'?'連接麥克風':'連接即時音訊';$('volumeControl').hidden=mode!=='file';}
 $('sourceMode').onchange=()=>{audio.disconnect('已切換來源。連接成功後會開始新的曲目生命週期。');options();};options();
 $('connectAudio').onclick=()=>audio.capture($('sourceMode').value);
 $('disconnectAudio').onclick=()=>audio.disconnect();
 $('audioFile').onchange=()=>{const file=$('audioFile').files[0];if(file){$('fileName').textContent=file.name;audio.loadFile(file);} $('audioFile').value='';};
 async function run(action){try{await action();}catch(error){audio.message=audio.errorText(error);audio.notify();}}
 $('audioPlay').onclick=()=>run(()=>audio.toggle());$('newSong').onclick=()=>run(()=>audio.restart());$('endSong').onclick=()=>audio.finish();
 $('sensitivity').oninput=()=>{audio.sensitivity=+$('sensitivity').value;$('sensitivityVal').textContent=audio.sensitivity.toFixed(1)+'×';};
 $('volume').oninput=()=>{audio.setVolume(+$('volume').value/100);$('volumeVal').textContent=$('volume').value+'%';};
 $('openLink').onclick=()=>{try{const url=new URL($('musicLink').value);if(url.protocol!=='https:'||!['youtube.com','www.youtube.com','music.youtube.com','youtu.be','open.spotify.com'].includes(url.hostname))throw new Error('請貼上有效的 HTTPS YouTube 或 Spotify 曲目連結。');window.open(url.href,'_blank','noopener,noreferrer');}catch(error){$('audioStatus').textContent=error.message;$('audioStatus').classList.add('error');}};
 $('musicImmerse').onclick=()=>{show(false);window.immerseMedusa();};$('manualMode').onclick=()=>window.manualMedusa();
 function sync(){
  $('audioStatus').textContent=audio.message;$('audioStatus').classList.toggle('error',audio.status==='error');
  const busy=['connecting','loading'].includes(audio.status);$('connectAudio').disabled=busy;$('audioFile').disabled=busy;$('sourceMode').disabled=busy;
  $('disconnectAudio').disabled=!busy&&!audio.stream&&!audio.buffer;
  $('transport').hidden=!audio.buffer&&!audio.stream;$('endSong').hidden=audio.mode==='file';
  $('audioPlay').textContent=audio.mode==='file'?(audio.status==='playing'?'Ⅱ 暫停音樂':audio.status==='ended'?'重新播放':'▷ 播放音樂'):(audio.status==='playing'?'Ⅱ 暫停魟魚':'▷ 恢復魟魚');
  $('newSong').textContent=audio.mode==='file'?'從頭開始':'開始新曲';
  $('volumeVal').textContent=audio.muted?'靜音':Math.round(audio.volume*100)+'%';
  $('audioDuration').textContent=audio.duration?format(audio.duration):'即時';
  $('sceneCaption').textContent=audio.status==='playing'?'音樂每增加一層，海裡便多一個生命。':audio.status==='ended'?'曲子已結束，這片海記得每個生命。':'連接音樂，讓節奏成為呼吸。';
 }
 audio.addEventListener('change',sync);sync();
 window.updateMusicMeters=(f,count)=>{
  for(const key of ['bass','mid','treble'])$(key+'Meter').value=f[key];$('densityRead').textContent=Math.round(f.density*100)+'%';$('bpmRead').textContent=f.bpm?Math.round(f.bpm):'—';$('countRead').textContent=count+' / 8';
  $('audioTime').textContent=format(audio.elapsed);$('songProgress').value=audio.duration?audio.elapsed/audio.duration:0;
  $('signalHint').textContent=audio.status==='playing'&&audio.features.silent>4?'目前沒有明顯音訊。請確認來源正在播放；安靜不會減少魟魚。':'頻譜密度是聲音層次的估計，不代表實際樂器數量。';
 };
})();
