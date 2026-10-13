let slg='';
function strips(){const active=ac.filter(a=>!a.surface&&!a.twr&&!a.ctr),ds=active.filter(a=>!a.dep).sort((p,q)=>Math.hypot(p.x-TH[0],p.y-TH[1])-Math.hypot(q.x-TH[0],q.y-TH[1])),dp=active.filter(a=>a.dep);
const f=(a)=>{const own=a.owner,proc=a.flight?a.flight.procedure:'VECTOR',route=a.flight?(a.flight.route||[]):[],exit=route.length?route[route.length-1]:'';
return `<div class="sp ${sel===a?'s ':''}${a.emg?'e ':a.fl?'c ':''}${a.dep?'d ':''}${a.loc?'f ':''}${own!=='APP'?'h ':''}" data-id="${a.id}">
<div style="display:flex;justify-content:space-between"><b>${getDisplayCallsign(a.cs)}</b><span class="dm">${a.t}</span></div>
<div class="dm">${a.flight?a.flight.origin+' → '+a.flight.destination:''} · ${proc}</div>
<div style="display:flex;justify-content:space-between;margin-top:2px"><span>${lv(Math.round(a.da/100)*100)} ${Math.round(a.dv)}KT</span><span>${a.dep?'EXIT '+exit:(a.flight?(a.flight.approach||'ILS '+a.flight.runway):'ILS '+RWN)}</span></div>
<div style="margin-top:2px;font-size:9px"><b class="${own}">${own}</b> · ${a.emg?'<span class="r">EMERGENCY</span>':(a.ra?'<span class="r">TCAS RA</span>':(a.dep?'DEPARTURE':'ARRIVAL'))}</div></div>`;};
const h=`<div class="dm" style="margin-bottom:5px">ARRIVALS ${ds.length}</div>`+ds.map(a=>f(a)).join('')+`<div class="dm" style="margin:6px 0 5px">DEPARTURES ${dp.length}</div>`+dp.map(a=>f(a)).join('');if(h!=slg){slg=h;$('#sl').innerHTML=h}}
$('#sl').onpointerdown=e=>{const d=e.target.closest('[data-id]');if(d){const a=ac.find(x=>x.id==d.dataset.id);if(a&&!a.twr&&!a.ctr&&!a.surface){sel=a;slg=''}}};
const taxiRouteBlocked=(route,target)=>{
 const edgeKey=(a,b)=>[a,b].sort().join('::'),edges=route.slice(1).map((node,i)=>edgeKey(route[i],node));
 return ac.some(other=>{
  if(other===target||!other.surface)return false;
  if(route.slice(1).includes(other.surface.node))return true;
  const occupied=(other.surface.route||[]).map((node,i)=>i?edgeKey(other.surface.route[i-1],node):null).filter(Boolean);
  return edges.some(edge=>occupied.includes(edge));
 });
};
function dct(a,fix){if(!a||!FX[fix]||a.twr||a.ctr)return;issue(a,`Direct ${fix}`,`Direct ${fix}`,()=>{a.fx=fix;a.mode='DCT';if(a.flight){a.flight.nextFix=fix;a.flight.resumeFix=''}});sig=''}
$('#pp').addEventListener('click',e=>{const b=e.target.closest('[data-c]');if(!b||!sel)return;const c=b.dataset.c;
if(c==='squawk'){
 const code=b.dataset.code||$('#pp .squawk-row input')?.value.trim()||'';
 if(!sel.flight||!/^[0-7]{4}$/.test(code)){msg(activePosition,`Invalid squawk for ${getSpokenCallsign(sel.cs)}. Use 2000 or four digits from 0 to 7.`);return}
 sel.flight.squawk=code;msg(activePosition,`${getSpokenCallsign(sel.cs)}, squawk ${code}`);sig='';ui();
}
else if(c==='ils'&&Math.hypot(sel.x,sel.y)<=35){
 const clearRwy=+b.dataset.rwy||(sel.flight?sel.flight.runway:RWN);
 if(!([18,36].includes(clearRwy))||clearRwy!==RWN){return}
 const target=sel;
 issue(target,`cleared ILS runway ${clearRwy}`,`Cleared ILS runway ${clearRwy}`,()=>{
   if(target.flight){target.flight.runway=clearRwy;target.flight.approach='ILS '+clearRwy}
   target.ils=1;
 });
 sig=''
}
else if(c==='ils0'){const target=sel;const clearedRwy=target.flight?target.flight.runway:RWN;issue(target,`cancel ILS runway ${clearedRwy}`,`Cancel ILS`,()=>{target.ils=0;target.loc=target.gs=0;target.mode='NAV'});sig=''}
else if(c==='ho'&&sel.handoffReady&&!sel.twr&&!sel.ctr&&!sel.ga){const target=sel;issue(target,`handoff to Tower`,`Contact Tower`,()=>{target.twr=1;target.position='TWR';target.owner='TWR'});sig=''}
else if(c==='hoctr'&&sel.dep&&sel.alt>=9000&&!sel.ctr){const target=sel;issue(target,`handoff to Center`,`Contact Center`,()=>{target.ctr=1;target.owner='CTR'});sig=''}
else if(c==='rsm'&&sel.flight&&sel.flight.resumeFix&&FX[sel.flight.resumeFix]){const target=sel;const f=target.flight.resumeFix;issue(target,`Resume own navigation`,`Resume own navigation`,()=>{target.mode='NAV';target.fx=f;target.flight.nextFix=f;target.flight.resumeFix=''});sig=''}
else if(c==='surface-gnd'&&activePosition==='TWR'&&sel.surface?.status==='vacated'){
 const target=sel,stand=availableSurfaceStand(target),route=stand?findSurfaceRoute(target.surface.node,stand.node):null;
 if(route&&!taxiRouteBlocked(route,target))issue(target,`Handoff to Ground, taxi to stand ${stand.id}`,`Taxi to stand ${stand.id}`,()=>{target.position='GND';target.owner='GND';target.twr=0;target.surface.status='taxi-arrival';target.surface.destinationStand=stand.id;target.surface.route=route;target.surface.progress=0});else msg('TWR',`${getSpokenCallsign(target.cs)} hold position, taxi route to stand ${stand.id} is unavailable`);sig='';
}
else if(c==='surface-taxi-out'&&activePosition==='GND'&&sel.surface?.status==='parked'){
 const target=sel,s=target.surface,stand=getSurfaceStand(s.stand),hold=stand&&getSurfaceHoldingPoint(target.flight.runway,stand.side),route=hold&&findSurfaceRoute(s.node,hold.node);
 const blocked=!route||taxiRouteBlocked(route,target);
 if(!blocked)issue(target,`Taxi to runway ${target.flight.runway} holding point ${hold.id}`,`Taxi to holding point runway ${target.flight.runway}`,()=>{s.status='taxi-departure';s.holdNode=hold.node;s.route=route;s.progress=0});else msg('GND',`${getSpokenCallsign(target.cs)} taxi route blocked or unavailable, hold position`);sig='';
}
else if(c==='surface-twr'&&activePosition==='GND'&&sel.surface?.status==='holding'){
 const target=sel,entryPath=getRunwayEntryForHold(target.surface.holdNode);issue(target,`Handoff to Tower at runway ${target.flight.runway}`,`Contact Tower`,()=>{target.position='TWR';target.owner='TWR';target.twr=1;target.surface.status='holding';target.surface.entryPath=entryPath});sig='';
}
else if(c==='surface-takeoff'&&activePosition==='TWR'&&sel.surface?.status==='holding'){
 const target=sel,entryPath=target.surface.entryPath||getRunwayEntryForHold(target.surface.holdNode);issue(target,`Cross runway and cleared for takeoff runway ${target.flight.runway}`,`Cross runway, cleared for takeoff runway ${target.flight.runway}`,()=>{target.surface.status='taxi-runway';target.surface.progress=0;target.surface.route=entryPath.slice()});sig='';
}
});
function ui(){strips();const q=f=>ac.filter(f).length;
$('#activeSectorLabel').textContent=activePosition==='APP'?'APPROACH CONTROL':activePosition==='TWR'?'TOWER · RUNWAY CONTROL':'GROUND · APRON & TAXI';
$('#tb').dataset.position=activePosition;
document.querySelectorAll('[data-position]').forEach(b=>{const on=b.dataset.position===activePosition;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on))});
$('#tp').innerHTML=activePosition==='APP'?`<span>ARRIVALS<b>${q(a=>!a.dep&&!a.surface&&!a.twr&&!a.ctr)}</b></span><span>DEPARTURES<b>${q(a=>a.dep&&!a.surface&&!a.twr&&!a.ctr)}</b></span><span>FINAL<b>${q(a=>a.loc&&!a.surface&&!a.twr)}</b></span><span>HANDOFF<b>${q(a=>a.twr||a.ctr)}</b></span><span>EMERGENCIES<b>${q(a=>a.emg&&!a.surface)}</b></span><span>CONFLICTS<b>${cf.length}</b></span><span>SEP LOSS<b>${ST.sep}</b></span><span>GO-AROUNDS<b>${ST.ga}</b></span><span>TCAS RA<b>${ST.tcas}</b></span><span>READBACK ERRORS<b>${ST.readback}</b></span>`:`<span>POSITION<b>${activePosition}</b></span><span>ON SURFACE<b>${q(a=>a.surface&&a.position===activePosition)}</b></span><span>ARRIVALS<b>${q(a=>a.surface&&a.dep===0)}</b></span><span>DEPARTURES<b>${q(a=>a.surface&&a.dep===1)}</b></span><span>HOLDING<b>${q(a=>a.surface?.status==='holding')}</b></span><span>RUNWAY<b>${RWN}</b></span><span>CONFLICTS<b>${q(a=>a.surfaceConflict)}</b></span><span>SESSION<b>CONTINUES</b></span>`;
$('#ck').textContent=clk();$('#rw').textContent=RWN;$('#wx').innerHTML=`WIND ${String(wd).padStart(3,'0')}°/${ws}KT · VIS ${vis}KM · ${wxt}`;$('#qnh').textContent=`QNH ${qnh} HPA`;$('#tl').textContent=TRANSITION_LEVEL;const rs=CFG.mode==='ENDLESS'?null:Math.max(0,SESS-EX)|0;$('#rm').textContent=rs===null?'ENDLESS':`${rs/60|0}:${String(rs%60).padStart(2,'0')}`;
document.querySelectorAll('[data-s]').forEach(b=>b.classList.toggle('on',b.dataset.s==(sp?(b.dataset.s=='p'?'p':sp):0)&&(b.dataset.s!='p'||sp>0)||(b.dataset.s=='0'&&!sp)));
 const sg=sel?[activePosition,sel.id,sel.ta,sel.ts,sel.alt,sel.mode,sel.fx,sel.spd,sel.ils,sel.loc,sel.twr,sel.ctr,sel.eng,sel.handoffReady,sel.flight&&sel.flight.runway,sel.surface?.status,sel.surface?.stand,sel.surface?.route?.length,sel.alt>=9000|0,Math.floor(Math.hypot(sel.x,sel.y))].join():'-'+activePosition;if(sg!=sig){sig=sg;$('#pp').innerHTML=pnl(sel)}
const alHTML=cf.slice().sort((p,q)=>p.t-q.t).map(c=>`<div class="${c.l==2?'r':'w'}">${c.l==2?'LOSS OF SEPARATION':c.t<50?'SEPARATION ALERT':'CONFLICT PREDICTED'} — ${c.A.cs} / ${c.B.cs} ${c.h.toFixed(1)}NM ${String(c.t/60|0).padStart(2,'0')}:${String(c.t%60).padStart(2,'0')}</div>`).join('');$('#al').innerHTML=alHTML||'<span class="dm">No conflicts</span>';
if(msgVersion!==uiMsgVersion){uiMsgVersion=msgVersion;$('#fd').innerHTML=mg.slice(-30).join('');$('#fd').scrollTop=1e5}}
document.querySelectorAll('[data-position]').forEach(b=>b.addEventListener('click',()=>{if(!run)return;activePosition=b.dataset.position;sel=null;sig='';slg='';ui()}));
