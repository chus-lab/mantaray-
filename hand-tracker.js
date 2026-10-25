/* Hand tracking on the same webcam stream as camera-input.js (MediaPipe Hand Landmarker, one hand, GPU when
   available). Loaded on demand the first time 鏡頭互動 is switched on; the model (~8 MB) is fetched once and cached
   by the browser. Like the motion analysis, frames stay in this page: nothing is shown, uploaded or recorded.
   Runs on every new camera frame (requestVideoFrameCallback, ~30 per second) rather than on a timer.
   Output on window.HandInput (mirrored, like a mirror):
     present — a hand is in view;  x, y — palm centre, 0–1 across the camera picture (smoothed);  rawX, rawY — unsmoothed
     gesture — 'fist' | 'peace' | 'open' | 'other', decided by a vote over the last 4 frames
     closed  — gesture is a fist;  peace — gesture is ✌ two fingers
     bends, ratios — per finger (index … pinky): bend angle in degrees and tip-to-wrist ÷ knuckle-to-wrist, for the
                     on-screen diagnostic */
const VER='0.10.14';
const H=window.HandInput={ready:false,loading:false,error:'',present:false,x:.5,y:.5,gesture:'other',closed:false,peace:false,
 fist:0,landmarks:null,curled:0,bends:[],ratios:[],frames:0};
let landmarker=null,running=false,lastSeen=0,lastTime=-1;const votes=[];

async function load(){
 if(H.ready||H.loading)return;H.loading=true;
 try{
  const {FilesetResolver,HandLandmarker}=await import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/vision_bundle.mjs`);
  const files=await FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/wasm`);
  const opts=d=>({baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:d},
   runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.6,minHandPresenceConfidence:.6,minTrackingConfidence:.5});
  try{landmarker=await HandLandmarker.createFromOptions(files,opts('GPU'));}catch(e){landmarker=await HandLandmarker.createFromOptions(files,opts('CPU'));}
  H.ready=true;H.error='';
 }catch(e){H.error='手部辨識載入失敗：'+(e?.message||e);console.error('[hand-tracker]',e);}
 H.loading=false;
}
const sub=(a,b)=>[a.x-b.x,a.y-b.y,(a.z??0)-(b.z??0)],len=v=>Math.hypot(v[0],v[1],v[2]);
const dist=(a,b)=>len(sub(a,b));
const angle=(u,v)=>{const d=(u[0]*v[0]+u[1]*v[1]+u[2]*v[2])/Math.max(1e-9,len(u)*len(v));return Math.acos(Math.max(-1,Math.min(1,d)))*180/Math.PI;};

// One finger from the 3D world landmarks (metres; unlike screen positions they do not shrink when the hand tilts).
// Bend: how far the finger turns from its base segment to its tip segment (straight ≈ 0–30°, curled ≈ 90°+);
// ratio: tip-to-wrist ÷ knuckle-to-wrist (straight ≈ 1.6–2, curled ≤ 1.1). Both must agree for a clear call.
function finger(W,mcp){const pip=mcp+1,tip=mcp+3,bend=angle(sub(W[pip],W[mcp]),sub(W[tip],W[pip])),ratio=dist(W[tip],W[0])/Math.max(1e-9,dist(W[mcp],W[0]));
 return {bend,ratio,straight:bend<45&&ratio>1.3,curled:bend>75||ratio<1.1};}
// Raw call for one frame. Fist: all four fingers curled (one may be undecided, none straight). ✌: index and middle
// straight, ring and pinky not straight. Open: at least three straight.
function classify(F){
 const s=F.map(f=>f.straight),c=F.map(f=>f.curled),nS=s.filter(Boolean).length,nC=c.filter(Boolean).length;
 if(nS===0&&nC>=3)return 'fist';
 if(s[0]&&s[1]&&!s[2]&&!s[3])return 'peace';
 if(nS>=3)return 'open';
 return 'other';
}

function step(now){
 const v=window.CamInput?.video;
 if(!running)return;
 if(v&&v.requestVideoFrameCallback)v.requestVideoFrameCallback(step);else setTimeout(()=>step(performance.now()),33);
 if(!landmarker||!window.CamInput?.active||!v||v.readyState<2)return;
 const t=performance.now();if(t<=lastTime)return;lastTime=t;
 let res;try{res=landmarker.detectForVideo(v,t);H.frames++;}catch(e){H.error='辨識錯誤：'+(e?.message||e);return;}
 const L=res.landmarks?.[0];
 if(!L){if(t-lastSeen>300){H.present=false;H.landmarks=null;votes.length=0;H.gesture='other';H.closed=H.peace=false;H.fist=0;}return;}
 lastSeen=t;H.present=true;H.landmarks=L.map(p=>({x:1-p.x,y:p.y}));
 // Palm centre: wrist and the four knuckles. Mirror x so the hand moves like in a mirror.
 const pts=[0,5,9,13,17].map(i=>L[i]),cx=1-pts.reduce((s,p)=>s+p.x,0)/5,cy=pts.reduce((s,p)=>s+p.y,0)/5;
 H.rawX=cx;H.rawY=cy;H.seenAt=t;H.x+=(cx-H.x)*.5;H.y+=(cy-H.y)*.5;
 const W=res.worldLandmarks?.[0]||L,F=[5,9,13,17].map(m=>finger(W,m));
 H.bends=F.map(f=>f.bend);H.ratios=F.map(f=>f.ratio);H.curled=F.filter(f=>f.curled).length;H.fist=H.curled/4;
 // Vote over the last 4 frames (~130 ms): switch as soon as 3 agree, so a change shows quickly but a single
 // misread frame never flips it.
 votes.push(classify(F));if(votes.length>4)votes.shift();
 const count=g=>votes.filter(x=>x===g).length;
 for(const g of ['fist','peace','open'])if(count(g)>=3&&H.gesture!==g){H.gesture=g;break;}
 if(votes.length===4&&!['fist','peace','open'].some(g=>count(g)>=2))H.gesture='other';
 H.closed=H.gesture==='fist';H.peace=H.gesture==='peace';
}
// Start and stop by watching the camera itself (twice a second) rather than relying only on events, so it works
// whatever order the scripts loaded in.
async function sync(){
 const on=!!window.CamInput?.active;
 if(on&&!running){await load();if(H.ready&&window.CamInput?.active&&!running){running=true;step(performance.now());}}
 else if(!on&&running){running=false;H.present=false;H.closed=H.peace=false;H.gesture='other';H.fist=0;H.landmarks=null;votes.length=0;}
}
addEventListener('caminput-start',sync);addEventListener('caminput-stop',sync);setInterval(sync,500);
