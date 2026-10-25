/* Slider panel for an ABYSS environment: builds one labelled range input per parameter in SCHEMA, writes through
   env.setParam, and shows live FPS / fog resolution. Styling is left to the host page (label, output, h2). */
import {SCHEMA} from './abyss-env.js';

export function mountPanel(container,env){
 const fmt=(v,step)=>step>=1?String(Math.round(v)):(+v.toFixed(3)).toString();
 for(const [title,rows] of SCHEMA){
  const sec=document.createElement('section'),h=document.createElement('h2');h.textContent=title;sec.append(h);
  for(const [key,name,min,max,step] of rows){
   const label=document.createElement('label'),out=document.createElement('output'),input=document.createElement('input');
   Object.assign(input,{type:'range',min,max,step,value:env.params[key]});
   label.append(name+' ',out,input);out.textContent=fmt(env.params[key],step);
   input.oninput=()=>{const v=+input.value;env.setParam(key,v);out.textContent=fmt(v,step);};
   sec.append(label);}
  container.append(sec);}
 const stats=document.createElement('div');stats.className='stats';stats.innerHTML='<span>FPS <strong>—</strong></span><span>霧解析度 <strong>—</strong></span>';
 container.append(stats);const [fps,res]=stats.querySelectorAll('strong');
 env.onStats(s=>{fps.textContent=Math.round(s.fps)||'—';res.textContent=Math.round(s.fogScale*100)+'%';});
}
