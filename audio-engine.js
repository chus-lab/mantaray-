'use strict';
class AudioEngine extends EventTarget {
  constructor(){super();this.context=null;this.mode=null;this.status='idle';this.buffer=null;this.stream=null;this.source=null;this.nodes=[];this.token=0;this.elapsed=0;this.offset=0;this.duration=0;this.seed=2;this.session=0;this.sensitivity=1;this.volume=.65;this.muted=false;this.features=new MusicModel.Features();this.message='選擇音樂來源，讓魟魚聽見聲音。';}
  notify(){this.dispatchEvent(new Event('change'));}
  async contextReady(){
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)throw new Error('這個瀏覽器不支援音訊分析，請改用新版桌面瀏覽器。');
    if(!this.context||this.context.state==='closed')this.context=new Audio();
    if(this.context.state==='suspended')await this.context.resume();
  }
  stopNodes(){
    if(this.source){this.source.onended=null;try{this.source.stop?.();}catch{}this.source.disconnect();this.source=null;}
    for(const n of this.nodes){try{n.disconnect();}catch{}}this.nodes=[];
    if(this.stream){for(const t of this.stream.getTracks()){t.onended=null;t.stop();}this.stream=null;}
  }
  disconnect(message='已斷開音訊；魟群保留。'){
    this.token++;this.stopNodes();this.buffer=null;this.status='idle';this.message=message;
    this.features.reset();this.context?.suspend().catch(()=>{});this.notify();
  }
  newSession(seed=this.seed){this.seed=seed;this.session++;this.elapsed=0;this.offset=0;this.features.reset();this.dispatchEvent(new Event('session'));}
  graph(source,audible){
    const c=this.context;this.analyser=c.createAnalyser();this.analyser.fftSize=2048;this.analyser.smoothingTimeConstant=.35;
    const splitter=c.createChannelSplitter(2),stereo=c.createGain();stereo.channelCount=2;stereo.channelCountMode='explicit';stereo.channelInterpretation='speakers';this.left=c.createAnalyser();this.right=c.createAnalyser();this.left.fftSize=this.right.fftSize=2048;
    source.connect(this.analyser);source.connect(stereo);stereo.connect(splitter);splitter.connect(this.left,0);splitter.connect(this.right,1);
    this.output=c.createGain();this.output.gain.value=audible?(this.muted?0:this.volume):0;source.connect(this.output);this.output.connect(c.destination);if(this.recordDest)source.connect(this.recordDest);
    this.nodes=[this.analyser,stereo,splitter,this.left,this.right,this.output];
    this.wave=new Float32Array(2048);this.leftWave=new Float32Array(2048);this.rightWave=new Float32Array(2048);this.spectrum=new Float32Array(1024);
  }
  async capture(mode){
    this.disconnect('');const request=++this.token;this.mode=mode;this.status='connecting';this.message='請在瀏覽器視窗中選擇來源並允許音訊。';this.notify();
    let stream;
    try{
      if(!navigator.mediaDevices)throw new Error('此環境無法存取音訊裝置，請用 HTTPS 在桌面瀏覽器開啟。');
      const permission=mode==='live'
        ?navigator.mediaDevices.getDisplayMedia?.({video:true,audio:true,systemAudio:'include',selfBrowserSurface:'exclude'})
        :navigator.mediaDevices.getUserMedia?.({video:false,audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false,channelCount:2}});
      if(!permission)throw new Error(mode==='live'?'此瀏覽器不支援分頁音訊擷取。請用支援分享音訊的桌面 Chrome／Edge，或選音樂檔。':'此瀏覽器不支援麥克風輸入。');
      stream=await permission;
      if(request!==this.token){stream.getTracks().forEach(t=>t.stop());return;}
      if(!stream.getAudioTracks().length)throw new Error('沒有收到音訊軌。請重新連接、選擇播放音樂的分頁並勾選「分享音訊」；若沒有此選項，請改用其他來源。');
      await this.contextReady();if(request!==this.token){stream.getTracks().forEach(t=>t.stop());return;}
      this.stream=stream;this.source=this.context.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));this.graph(this.source,false);
      for(const track of stream.getTracks())track.onended=()=>{if(request===this.token)this.disconnect('音訊分享已停止；魟群保留。重新連接會開始新的生命週期。');};
      this.duration=0;this.newSession(Math.floor(Math.random()*10000));this.status='playing';this.started=this.context.currentTime;
      this.message=mode==='live'?'已連接分頁音訊。換曲時請按「開始新曲」。':'麥克風已連接，不會將收音回放至喇叭。換曲時請按「開始新曲」。';this.notify();
    }catch(error){stream?.getTracks().forEach(t=>t.stop());if(request!==this.token)return;this.stopNodes();this.context?.suspend().catch(()=>{});this.status='error';this.message=this.errorText(error);this.notify();}
  }
  errorText(error){return ({NotAllowedError:'未取得音訊權限。可重新連接，或改用音樂檔；魟魚作品仍可觀看。',NotFoundError:'找不到可用的音訊來源，請確認裝置或分頁正在播放。',NotReadableError:'無法讀取音訊，請確認系統權限及裝置是否被占用。',InvalidStateError:'請直接按「連接音訊」並在作用中的瀏覽器視窗選擇來源。'})[error.name]||error.message||'音訊連接失敗，請重試。';}
  async loadFile(file){
    if(!file)return;this.disconnect('');const request=++this.token;this.mode='file';this.status='loading';this.message='正在讀取音樂，檔案只留在你的瀏覽器。';this.notify();
    try{
      if(file.size>120*1024*1024)throw new Error('請選擇小於 120 MB 的音樂檔。');
      await this.contextReady();const bytes=await file.arrayBuffer();
      const fingerprint=await crypto.subtle.digest('SHA-256',bytes);const seed=new DataView(fingerprint).getUint32(0)%100000;
      const buffer=await this.context.decodeAudioData(bytes);
      if(request!==this.token)return;
      if(buffer.duration>1800)throw new Error('這個版本支援 30 分鐘以內的曲目。');
      this.buffer=buffer;this.duration=buffer.duration;this.title=file.name;this.newSession(seed);this.status='ready';this.message='音樂已就緒。按「播放音樂」開始；音量與頻譜將即時驅動魟魚。';this.notify();
    }catch(error){if(request!==this.token)return;this.buffer=null;this.status='error';this.message=error.name==='EncodingError'?'無法解碼此檔案，請改用瀏覽器支援的 MP3、WAV 或 M4A。':this.errorText(error);this.notify();}
  }
  async play(){
    if(this.mode!=='file'||!this.buffer)return;
    const request=this.token;await this.contextReady();if(request!==this.token)return;
    this.stopNodes();if(this.offset>=this.duration)this.newSession(this.seed);
    this.source=this.context.createBufferSource();this.source.buffer=this.buffer;this.graph(this.source,true);
    this.started=this.context.currentTime;this.source.onended=()=>{if(request!==this.token||this.status!=='playing')return;this.offset=this.elapsed=this.duration;this.status='ended';this.message='曲目已結束。完整魟群保留，重新播放會開始新生命週期。';this.notify();};
    this.source.start(0,this.offset);this.status='playing';this.message='正在播放與分析。魟魚在本曲結束前只增不減。';this.notify();
  }
  async toggle(){
    if(this.mode==='file'){
      if(this.status==='playing'){this.elapsed=Math.min(this.duration,this.offset+this.context.currentTime-this.started);this.offset=this.elapsed;this.stopNodes();this.status='paused';this.message='音樂與生命演算已暫停。';this.notify();}else if(this.buffer)await this.play();
    }else if(this.stream){
      if(this.status==='playing'){this.offset=this.elapsed;this.status='paused';this.message='魟魚已暫停；來源仍在播放及收音。';}
      else if(this.status==='paused'){await this.contextReady();this.started=this.context.currentTime;this.status='playing';this.message='已恢復即時反應。';}
      this.notify();
    }
  }
  async restart(){
    if(this.mode==='file'&&this.buffer){this.stopNodes();this.newSession(this.seed);this.status='ready';await this.play();}
    else if(this.stream){await this.contextReady();this.newSession(Math.floor(Math.random()*10000));this.started=this.context.currentTime;this.status='playing';this.message='新的曲目生命週期已開始。';this.notify();}
  }
  finish(){if(!this.stream)return;this.offset=this.elapsed;this.stopNodes();this.status='ended';this.message='本曲已結束，已停止收音並保留族群。連接音訊即可開始下一首。';this.context?.suspend().catch(()=>{});this.notify();}
  // Recording tap: the music at full level (independent of the playback volume) as a MediaStream.
  recordStream(){if(!this.context)return null;if(!this.recordDest){this.recordDest=this.context.createMediaStreamDestination();try{this.source?.connect(this.recordDest);}catch{}}return this.recordDest.stream;}
  setVolume(v){this.volume=v;if(this.output&&this.mode==='file')this.output.gain.setTargetAtTime(this.muted?0:v,this.context.currentTime,.03);}
  sample(dt){
    if(this.status!=='playing'||!this.analyser)return this.features.value;
    this.elapsed=this.offset+this.context.currentTime-this.started;if(this.duration)this.elapsed=Math.min(this.elapsed,this.duration);
    this.analyser.getFloatTimeDomainData(this.wave);this.analyser.getFloatFrequencyData(this.spectrum);this.left.getFloatTimeDomainData(this.leftWave);this.right.getFloatTimeDomainData(this.rightWave);
    return this.features.measure(this.wave,this.spectrum,this.context.sampleRate,dt,this.elapsed,this.leftWave,this.rightWave,this.sensitivity);
  }
}
window.medusaAudio=new AudioEngine();
addEventListener('pagehide',()=>window.medusaAudio.disconnect());
