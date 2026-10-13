let last=performance.now(),lastUI=0,uiMsgVersion=-1;
function loop(n){
  const dt=Math.min(.1,(n-last)/1000);last=n;
  if(run&&sp){
    EX+=dt;acc+=dt*sp;acc=Math.min(acc,2);
    while(acc>1e-3&&run){const h=Math.min(acc,.25);step(h);acc-=h}
    if(CFG.mode!=='ENDLESS'&&EX>=SESS)end()
  }
  draw();
  /* Radar rendering stays at full animation-frame rate. DOM/UI work is throttled
     because rebuilding traffic/strip/conflict markup every frame causes sustained
     CPU/GC pressure and eventually freezes long sessions. */
  if(n-lastUI>=100){lastUI=n;ui()}
  requestAnimationFrame(loop)
}
document.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>{lvl=+b.dataset.l;document.querySelectorAll('[data-l]').forEach(x=>x.classList.toggle('on',x===b))});
const show=id=>document.querySelectorAll('#ov section').forEach(x=>x.classList.toggle('on',x.id==id));
