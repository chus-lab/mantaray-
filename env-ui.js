/* Environment panel toggle; the sliders themselves are built by the shared ABYSS panel once the stage is ready. */
(function(){
 const $=id=>document.getElementById(id),panel=$('envPanel');
 function show(open){panel.hidden=!open;$('envToggle').setAttribute('aria-expanded',String(open));if(open){window.closeMusicPanel?.();$('controls').hidden=true;$('reelPanel').hidden=true;}}
 $('envToggle').onclick=()=>show(panel.hidden);$('envClose').onclick=()=>{show(false);$('envToggle').focus();};
 $('musicToggle').addEventListener('click',()=>show(false));$('panelToggle').addEventListener('click',()=>show(false));
})();
