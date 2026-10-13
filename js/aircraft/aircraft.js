function upd(a,dt){
  expireReadbackWatch(a);
  if(a.q&&a.q.length&&T>=a.q[0].t){
    const c=a.q.shift();
    c.apply();
    if(c.pendingReadback)a.readbackWatch=c.pendingReadback;
    msg(a.cs,`"${c.rb}, ${getSpokenCallsign(a.cs)}."`);
  }
if(a.surface){
  const s=a.surface;
  if(s.route&&s.route.length){
    const nodeId=s.route[0],point=surfacePoint(nodeId);
    if(point){const [tx,ty]=point,dx=tx-s.x,dy=ty-s.y,d=Math.hypot(dx,dy),step=Math.min(d,0.22*dt);
    if(d>0){s.x+=dx/d*step;s.y+=dy/d*step;a.h=(Math.atan2(dx,-dy)/D+360)%360}
    if(d<=0.22*dt){s.x=tx;s.y=ty;s.node=nodeId;s.route.shift()}}
    if(!s.route.length){
      if(s.status==='taxi-arrival'){s.status='parked-arrival';s.stand=s.destinationStand;msg('GND',`${getSpokenCallsign(a.cs)} parked at stand ${s.stand}`)}
      else if(s.status==='taxi-departure'){s.status='holding';msg('GND',`${getSpokenCallsign(a.cs)} holding short runway ${a.flight.runway}`)}
      else if(s.status==='taxi-runway'){s.status='takeoff-roll';s.progress=0;msg('TWR',`${getSpokenCallsign(a.cs)} entering runway ${a.flight.runway}, rolling`)}
    }
  }
  if(s.status==='takeoff-roll'){
    s.progress=(s.progress||0)+dt;
    if(s.progress>=6){
      const r=runwayGeometry(a.flight.runway);a.surface=null;a.position='APP';a.owner='APP';a.twr=0;a.mode='NAV';a.x=r.threshold[0]+r.u[0]*1.7;a.y=r.threshold[1]+r.u[1]*1.7;a.h=a.th=r.heading;a.alt=500;a.spd=155;a.ta=3000;a.ts=220;a.ga0=0;snap(a);SND.dep();msg('TWR→APP',`${getSpokenCallsign(a.cs)} airborne, climbing 3000, exit ${a.flight.route.at(-1)}. Contact Approach.`)
    }
  }
  if(s.status==='parked-arrival'){
    s.progress=(s.progress||0)+dt;
    if(s.progress>=15){msg('GND',`${getSpokenCallsign(a.cs)} arrival complete at stand ${s.stand}`);rm(a)}
  }
  return;
}
const runway=runwayGeometry(a.flight?a.flight.runway:RWN);
const myRWN=runway.rwn,
      myH=runway.heading,
      myU=runway.u,
      myTH=runway.threshold;
const dx=a.x-myTH[0],dy=a.y-myTH[1],s=-(dx*myU[0]+dy*myU[1]),cr=dx*myU[1]-dy*myU[0];a.s=s;let th=a.th;
if(a.mode=='NAV'||a.mode=='DCT'){const f=FX[a.fx];if(f){th=(Math.atan2(f.x-a.x,f.y-a.y)/D+360)%360;if(Math.hypot(f.x-a.x,f.y-a.y)<1.5){
if(a.mode=='NAV'&&a.flight&&a.flight.route){const idx=a.flight.route.indexOf(a.fx);if(idx>=0&&idx<a.flight.route.length-1){a.fx=a.flight.route[idx+1];a.flight.nextFix=a.fx;const nf=FX[a.fx];if(nf)th=(Math.atan2(nf.x-a.x,nf.y-a.y)/D+360)%360}else{a.mode='HDG';a.th=a.h;th=a.h;if(a.flight)a.flight.nextFix='VECTORS'}}else{a.mode='HDG';a.th=a.h;th=a.h;if(a.flight)a.flight.nextFix='VECTORS'}}}else{a.mode='HDG';a.th=a.h;th=a.h;if(a.flight)a.flight.nextFix='VECTORS'}}
if(a.ils&&!a.loc&&s>1.5&&s<28&&Math.abs(cr)<1.6&&Math.abs(dh(a.h,myH))<45){a.loc=1;a.mode='LOC';msg('APP',`${getSpokenCallsign(a.cs)} established localiser runway ${myRWN}`)}
if(a.loc){th=myH-cl(cr*22,-28,28);if(!a.gs&&a.alt<=s*318+150)a.gs=1;if(!a.gs&&s<6)return ga(a,'high on approach');
if(s<9&&!a.twr){a.handoffReady=true;const ah=ac.filter(b=>b!==a&&b.loc&&b.flight&&b.flight.runway==myRWN&&b.s<a.s&&b.s>-1);if(ah.length)ST.gaps.push(a.s-Math.max(...ah.map(b=>b.s)))}
if(a.ga0&&s<1.6)return ga(a,'unstable');if(s<.2)return land(a)}
const o=a.alt;
if(a.ra){a.ra.t-=dt;if(a.ra.t<=0){a.ta=Math.round(a.alt/100)*100;a.ra=null}else a.alt=Math.max(1500,a.alt+a.ra.v*1500*dt/60)}
else if(a.gs)a.alt=Math.max(0,Math.min(a.alt,s*318));
else{const d=a.ta-a.alt,r=(d>0?a.cl:a.dn)*(a.eng?.5:1)*dt/60;a.alt+=Math.abs(d)<=r?d:Math.sign(d)*r}
a.vs=(a.alt-o)/dt*60;
let ts=Math.min(a.ts,a.eng?210:a.ty.x,a.alt<10000?250:999);if(a.loc)ts=Math.min(ts,a.ty.v+cl((s-4)*8,0,70));
const dv=ts-a.spd,ak=(dv>0?a.ty.a:a.ty.a*1.3)*dt;a.spd+=Math.abs(dv)<ak?dv:Math.sign(dv)*ak;
const g=a.spd*(1+a.alt/50000),tr=Math.min(3,1091*Math.tan(a.ty.b*D)/g),d=dh(a.h,th);a.h=(a.h+Math.sign(d)*Math.min(Math.abs(d),tr*dt)+360)%360;
a.x+=Math.sin(a.h*D)*g/3600*dt;a.y+=Math.cos(a.h*D)*g/3600*dt;
if((a.tt-=dt)<=0){a.tt=4;a.tr.push([a.x,a.y]);if(a.tr.length>7)a.tr.shift()}
if(Math.hypot(a.x,a.y)>65&&!a.loc){rm(a);if(a.dep){if(!a.ctr){if(a.alt>=9000){ST.dep++;msg('APP→CTR',`${getSpokenCallsign(a.cs)} ${lv(Math.round(a.alt/100)*100)}, contact Center`)}else{ST.low++;msg('APP',`${a.cs} left sector below FL090 — Center rejects handoff`)}}}else{ST.miss++;msg('APP',`${a.cs} left sector without landing`)}}
if(Math.random()<0.005&&!a.twr&&!a.ctr){
 if(a.loc&&a.s<7&&Math.random()<0.15)msg(a.cs,`"${getSpokenCallsign(a.cs)} runway in sight"`);
 else if(!a.loc&&!a.dep&&!a.readyDescentSent&&a.alt>5000&&Math.abs(a.vs)<35&&Math.abs(a.alt-a.ta)<150&&Math.random()<0.1){a.readyDescentSent=true;msg(a.cs,`"${getSpokenCallsign(a.cs)} ready for descent"`)}
}}
const pr=(a,t)=>{const g=a.spd*(1+a.alt/50000)*t/3600,d=a.ta-a.alt;return[a.x+Math.sin(a.h*D)*g,a.y+Math.cos(a.h*D)*g,a.gs?Math.max(0,a.alt-700*t/60):a.alt+Math.sign(d)*Math.min(Math.abs(d),(d>0?a.cl:a.dn)*t/60)]};
function sep(){
  cf=[];
  ac.forEach(a=>a.fl=0);
  const traffic=ac.filter(a=>!a.surface);
  const activeIds=new Set(traffic.map(a=>a.id));
  Object.keys(AR).forEach(k=>{
    const dash=k.indexOf('-');
    const aId=dash>0?+k.slice(0,dash):0;
    const bId=dash>0?+k.slice(dash+1):0;
    if(!activeIds.has(aId)||!activeIds.has(bId)||T-AR[k]>120)delete AR[k];
  });
  Object.keys(ls).forEach(k=>{
    const dash=k.indexOf('-');
    const aId=dash>0?+k.slice(0,dash):0;
    const bId=dash>0?+k.slice(dash+1):0;
    if(!activeIds.has(aId)||!activeIds.has(bId))delete ls[k];
  });
for(let i=0;i<traffic.length;i++)for(let j=i+1;j<traffic.length;j++){const A=traffic[i],B=traffic[j];if(A.twr&&B.twr)continue;const h=Math.hypot(A.x-B.x,A.y-B.y),v=Math.abs(A.alt-B.alt),k=A.id+'-'+B.id;
if(h<3&&v<1000){A.fl=B.fl=2;let e=ls[k];if(!e){e=ls[k]={a:A.cs,b:B.cs,h,v};boundedPush(lossH,e,MAX_HISTORY);ST.sep++;msg('APP',`<span class=r>LOSS OF SEPARATION ${getSpokenCallsign(A.cs)} / ${getSpokenCallsign(B.cs)}</span>`);logE(`Separation loss ${A.cs}/${B.cs}`);}e.h=Math.min(e.h,h);e.v=Math.min(e.v,v);cf.push({A,B,h,t:0,l:2});
if(h<1.5&&v<400&&!A.ra&&!B.ra&&A.alt>1500&&B.alt>1500){const u=A.alt>=B.alt?1:-1;A.ra={t:25,v:u};B.ra={t:25,v:-u};ST.tcas++;msg('APP',`<span class=r>TCAS RA ${getSpokenCallsign(A.cs)} / ${getSpokenCallsign(B.cs)}</span>`)}}
else{delete ls[k];if(h<35)for(let t=10;t<=120;t+=10){const p=pr(A,t),q=pr(B,t);if(Math.hypot(p[0]-q[0],p[1]-q[1])<3&&Math.abs(p[2]-q[2])<1000){A.fl=B.fl=Math.max(A.fl,1);cf.push({A,B,h,t,l:1});if(!AR[k]||T-AR[k]>60){ST.conf++;msg('APP',`<span class=w>${t<50?'SEPARATION ALERT':'CONFLICT PREDICTED'} ${getSpokenCallsign(A.cs)} / ${getSpokenCallsign(B.cs)}</span>`)}AR[k]=T;break}}}}}
