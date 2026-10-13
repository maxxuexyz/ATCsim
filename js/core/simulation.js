function step(dt){T+=dt;ac.slice().forEach(a=>upd(a,dt));if(T-lastSnap>=.5){lastSnap=T;ac.forEach(snap)}
const f=ac.filter(a=>a.loc&&a.twr).sort((p,q)=>p.s-q.s);for(let i=1;i<f.length;i++)if(f[i].s<5&&f[i].s-f[i-1].s<2.5&&f[i-1].s>0&&!f[i].ga)ga(f[i],'traffic ahead');
sep();
const surfaceTraffic=ac.filter(a=>a.surface);surfaceTraffic.forEach(a=>a.surfaceConflict=false);
for(let i=0;i<surfaceTraffic.length;i++)for(let j=i+1;j<surfaceTraffic.length;j++){
  const A=surfaceTraffic[i],B=surfaceTraffic[j];
  if(Math.hypot(A.surface.x-B.surface.x,A.surface.y-B.surface.y)<3.5)A.surfaceConflict=B.surfaceConflict=true;
}
const arrCaps=[2,4,6,9],depCaps=[1,2,3,4];
if(T>=nxA&&EX<SESS*.7&&ac.filter(a=>!a.dep).length<arrCaps[lvl]){
  arr();
  nxA=T+SPAWN_GAP_A[lvl]*rnd(.78,1.22);
}
if(T>=nxD&&EX<SESS*.83&&T-lastDep>SPAWN_GAP_D[lvl]&&ac.filter(a=>a.dep).length<depCaps[lvl]&&!ac.some(a=>a.loc&&a.s<7)&&!ac.some(a=>!a.dep&&Math.hypot(a.x,a.y)<3)){
  dep();
  nxD=T+SPAWN_GAP_D[lvl]*rnd(.78,1.22);
}
if(EX>=nW){nW=1e9;wd=Math.round((wd+pick([-1,1])*rnd(110,170)+360)%360);msg('TWR→APP',`Wind change: ${wd}°/${ws}KT.`);}
if(EM.length&&EX>=EM[0]){const c=ac.filter(a=>!a.dep&&!a.loc&&!a.emg&&a.alt>3000);if(c.length){const a=pick(c);a.emg=pick(['MED','ENG']);ST.emg++;if(a.emg=='ENG')a.eng=1;msg('APP',`<span class=r>${getSpokenCallsign(a.cs)} ${a.emg=='MED'?'MEDICAL EMERGENCY':'ENGINE FAILURE, reduced performance'} — requests priority landing</span>`);logE(`${getSpokenCallsign(a.cs)} ${a.emg=='MED'?'medical emergency':'engine failure'}`);EM.shift();SND.emg()}else EM[0]=EX+15}}
