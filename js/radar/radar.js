const stt=a=>a.ra?'TCAS RA':a.emg?'EMERGENCY':a.ga?'GO-AROUND':a.ctr?'HANDOFF · CTR':a.twr?'HANDOFF · TWR':a.loc?'ESTABLISHED':a.ils?'APPROACHING':a.dep?(a.alt<3500?'DEPARTING':'CLIMBING'):a.mode=='HDG'?'VECTORING':a.ta<a.alt-100?'DESCENDING':'ENTERING_SECTOR';
const ALT=[2000,3000,4000,5000,6000,7000,8000,10000,12000,14000,16000],SPD=[160,170,180,190,200,210,220,230,250];
function pnl(a){
if(!a)return'<div class="dm" style="line-height:1.5">Click a target to select it.<br>Select a target, then drag it to vector.<br>Drag its label to reposition it.</div>';
const squawkPanel=()=>a.flight?`<div class="squawk-control"><div class="dm">SQUAWK <b>${a.flight.squawk||'UNASSIGNED'}</b></div><div class="squawk-row"><input type="text" inputmode="numeric" maxlength="4" pattern="[0-7]{4}" placeholder="4 OCTAL DIGITS" aria-label="Squawk code for ${getDisplayCallsign(a.cs)}"><button class="action-btn" data-c="squawk">ASSIGN</button><button class="action-btn" data-c="squawk" data-code="2000">2000</button></div></div>`:'';
if(activePosition!=='APP'){
 const s=a.surface,role=activePosition;
 let h=`<h2>${getDisplayCallsign(a.cs)}</h2><div class="dm">${a.ty.n}</div><div class="surface-state-chip">${s?String(s.status).replaceAll('-',' ').toUpperCase():a.loc?'FINAL · RWY '+a.flight?.runway:'APPROACH · TWR CONTROL'}</div>`;
 if(a.flight)h+=`<div class="sel-flight"><div>${a.flight.origin} → ${a.flight.destination}</div><div>${a.dep?'DEPARTURE · '+a.flight.procedure:'ARRIVAL · RWY '+a.flight.runway}</div>${s?.stand?`<div>STAND ${s.stand}</div>`:''}</div>`;
 h+=squawkPanel();
 if(s?.designOnly)return h+'<div class="dm surface-control-note">DESIGN TRAFFIC · STAND DISPLAY</div>';
 if(role==='TWR'&&a.position==='TWR'&&s?.status==='vacated')h+=`<button class="action-btn" data-c="surface-gnd" ${availableSurfaceStand(a)?'':'disabled'}>${availableSurfaceStand(a)?'HANDOFF TO GROUND':'NO STAND AVAILABLE'}</button>`;
 if(role==='TWR'&&a.position==='TWR'&&s?.status==='holding')h+='<button class="action-btn" data-c="surface-takeoff">CLEAR RUNWAY ENTRY & TAKEOFF</button>';
 if(role==='GND'&&a.position==='GND'&&s?.status==='parked')h+='<button class="action-btn" data-c="surface-taxi-out">TAXI TO RUNWAY HOLDING POINT</button>';
 if(role==='GND'&&a.position==='GND'&&s?.status==='parked-arrival')h+='<div class="dm">ARRIVAL COMPLETE · STAND '+s.stand+'</div>';
 if(role==='GND'&&a.position==='GND'&&s?.status==='holding')h+='<button class="action-btn" data-c="surface-twr">HANDOFF TO TOWER</button>';
 return h+'<div class="dm surface-control-note">GND manages apron and taxi routes. TWR manages runway crossings and takeoff clearance.</div>';
}
let h=`<h2>${getDisplayCallsign(a.cs)}</h2><div class="dm">${a.ty.n}</div><div style="margin:4px 0;font-size:10px"><b class="${a.owner}">${a.owner}</b> · ${a.emg?'<span class="r">EMERGENCY</span>':(a.dep?'DEPARTURE':'ARRIVAL')}</div>`;
if(a.flight){
 const procLabel=a.dep?'SID':'STAR', route=a.flight.route?a.flight.route.join(' → '):'VECTORS', next=a.flight.nextFix||'VECTORS', exp=a.dep?(a.flight.route?.[a.flight.route.length-1]||''):(a.flight.approach||'ILS '+RWN);
 h+=`<div class="sel-flight"><div><span class="dm">ROUTE</span> ${a.flight.origin} → ${a.flight.destination}</div><div><span class="dm">${procLabel}</span> ${a.flight.procedure||'—'} <span class="dm">NEXT</span> ${next}</div><div><span class="dm">EXPECT</span> ${exp}</div></div>`;
 h+=squawkPanel();
}
h+=`<div class="sel-state"><span>HDG <b>${String(Math.round(a.dh)%360).padStart(3,'0')}°</b></span><span>ALT <b>${lv(Math.round(a.alt/100)*100)}</b></span><span>SPD <b>${Math.round(a.dv)} KT</b></span></div>`;
if(a.mode==='HDG'&&a.flight&&a.flight.resumeFix&&FX[a.flight.resumeFix])h+='<button class="action-btn" data-c="rsm">RESUME OWN NAVIGATION</button>';
if(!a.dep){
 const rwn=a.flight?a.flight.runway:RWN,dist=Math.hypot(a.x,a.y),ilsReady=dist<=35;
 if(a.ils){
    h+=`<button class="action-btn" data-c="ils0">ILS RWY ${rwn} CLEARED · CANCEL</button>`;
  }else{
    h+=`<button class="action-btn" data-c="ils" data-rwy="${rwn}" ${ilsReady?'':'disabled'}>CLEAR ILS RWY ${rwn}</button>`;
  }
 const ready=a.handoffReady&&!a.twr&&!a.ctr&&!a.ga;
 h+=`<button class="action-btn" data-c="ho" ${ready?'':'disabled'}>HANDOFF TO TWR${ready?'':' · NOT AVAILABLE'}</button>`;
}
if(a.dep&&a.alt>=9000&&!a.ctr)h+='<button class="action-btn" data-c="hoctr">HANDOFF TO CENTER</button>';
return h+'<div class="dm" style="margin-top:4px;font-size:9px">Heading: drag out of target to preview · Voice commands apply headings · Label: drag datablock.</div>';
}
const cv=$('#cv'),ctx=cv.getContext('2d'),X=x=>W/2+(x-vx)*sc,Y=y=>H/2-(y-vy)*sc;
function fit(){dpr=devicePixelRatio||1;const r=$('#cvw').getBoundingClientRect();W=r.width;H=r.height;cv.width=W*dpr;cv.height=H*dpr;if(ls0){sc=Math.min(W,H)/2/50;ls0=0}}
new ResizeObserver(fit).observe($('#cvw'));fit();
let surfaceHits=[];
let surfaceLabelHits=[],surfaceLabelDrag=null;
let surfaceView={left:0,top:0,scale:1},surfaceZoom=1,surfaceOffset={x:0,y:0};
  const surfaceBaseScale=()=>{const c=RIX_SURFACE_MAP.coordinateSystem;return Math.min(Math.max(1,W-48)/(c.maxX-c.minX),Math.max(1,H-76)/(c.maxY-c.minY))};
const SX=x=>surfaceView.left+x*surfaceView.scale,SY=y=>surfaceView.top+y*surfaceView.scale;
function drawSurface(){
 const g=ctx,L=RIX_SURFACE_MAP,cs=L.coordinateSystem;
 surfaceHits=[];surfaceLabelHits=[];g.fillStyle='#070b10';g.fillRect(0,0,W,H);
 const scale=surfaceBaseScale()*surfaceZoom,cx=(cs.minX+cs.maxX)/2,cy=(cs.minY+cs.maxY)/2;
 surfaceView={scale,left:W/2-cx*scale+surfaceOffset.x,top:H/2-cy*scale+surfaceOffset.y};
 g.save();g.beginPath();g.rect(0,0,W,H);g.clip();
 /* Rotate the complete schematic around the airport center. */
 g.translate(SX(cx),SY(cy));g.rotate((L.mapRotationDeg||0)*D);g.translate(-SX(cx),-SY(cy));
 const traceTaxiway=path=>{if(!path.start||!path.segments?.length)return false;g.beginPath();g.moveTo(SX(path.start[0]),SY(path.start[1]));for(const s of path.segments)g.bezierCurveTo(SX(s.c1[0]),SY(s.c1[1]),SX(s.c2[0]),SY(s.c2[1]),SX(s.to[0]),SY(s.to[1]));return true};
 const polygon=(coords,fill,edge)=>{g.beginPath();coords.forEach(([x,y],i)=>i?g.lineTo(SX(x),SY(y)):g.moveTo(SX(x),SY(y)));g.closePath();g.fillStyle=fill;g.fill();g.strokeStyle=edge;g.lineWidth=Math.max(1,scale*.18);g.stroke()};
 const apronShape=(outline,fill,edge)=>{
   if(Array.isArray(outline)){polygon(outline,fill,edge);return}
   if(!outline?.start||!outline.segments?.length)return;
   g.beginPath();g.moveTo(SX(outline.start[0]),SY(outline.start[1]));
   outline.segments.forEach(s=>g.bezierCurveTo(SX(s.c1[0]),SY(s.c1[1]),SX(s.c2[0]),SY(s.c2[1]),SX(s.to[0]),SY(s.to[1])));
   g.closePath();g.fillStyle=fill;g.fill();g.strokeStyle=edge;g.lineWidth=Math.max(1,scale*.18);g.stroke();
 };
 /* Aprons form paved areas beyond the taxiway spines. Draw them first so the
    taxiway paint remains clean where it enters the apron. */
 (L.aprons||[]).forEach(apron=>{
   const fill=apron.fill||'#35434d',edge=apron.edge||'#596a76';
   apronShape(apron.boundary,fill,edge);
   (apron.walkways||[]).forEach(walkway=>polygon(walkway,apron.walkwayFill||fill,apron.walkwayEdge||edge));
   (apron.piers||[]).forEach(pier=>polygon(pier,apron.pierFill||fill,apron.pierEdge||edge));
   (apron.terminals||[]).forEach(terminal=>polygon(terminal.outline,apron.terminalFill||'#182129',apron.terminalEdge||edge));
   if(apron.terminal)polygon(apron.terminal,apron.terminalFill||'#182129',apron.terminalEdge||edge);
   (apron.terminalCircles||[]).forEach(terminal=>{
     g.beginPath();g.arc(SX(terminal.center[0]),SY(terminal.center[1]),terminal.radius*scale,0,Math.PI*2);
     g.fillStyle=apron.terminalCircleFill||'#182129';g.fill();
     g.strokeStyle=apron.terminalCircleEdge||apron.terminalEdge||edge;g.lineWidth=Math.max(1,scale*.18);g.stroke();
   });
   (apron.stands||[]).forEach(stand=>{
     g.beginPath();g.moveTo(SX(stand.from[0]),SY(stand.from[1]));g.lineTo(SX(stand.to[0]),SY(stand.to[1]));
     g.strokeStyle=apron.standMark||'#b7c2ca';g.lineWidth=Math.max(1,scale*.14);g.stroke();
     g.beginPath();g.arc(SX(stand.to[0]),SY(stand.to[1]),Math.max(1.5,scale*.22),0,Math.PI*2);
     g.fillStyle=apron.standMark||'#b7c2ca';g.fill();
   });
 });
 const laneStyle=drawPath=>{
   /* One muted pavement color; no border or centerline strokes. */
   drawPath();g.strokeStyle='#667985';g.lineWidth=Math.max(7,scale*1.65);g.lineJoin='round';g.lineCap='round';g.stroke();
 };
 const drawTaxiway=path=>{
   if(!path.start||!path.segments?.length)return;
   laneStyle(()=>traceTaxiway(path));
   /* A runway exit can flare wider at the pavement edge, then taper back to
      the normal taxiway width. The segment count and flare width live in the
      editable map data, not in the routing graph. */
   const flare=path.runwayFlare;
   if(!flare)return;
   const count=Math.min(Math.max(1,flare.segments||1),path.segments.length);
   for(let i=0;i<count;i++){
     const seg=path.segments[i],p0=i===0?path.start:path.segments[i-1].to;
     for(let step=i===0?0:1;step<=64;step++){
       const t=step/64,u=1-t;
       const x=u*u*u*p0[0]+3*u*u*t*seg.c1[0]+3*u*t*t*seg.c2[0]+t*t*t*seg.to[0];
       const y=u*u*u*p0[1]+3*u*u*t*seg.c1[1]+3*u*t*t*seg.c2[1]+t*t*t*seg.to[1];
       const progress=(i+t)/count,half=scale*(flare.width+(1.65-flare.width)*progress)/2;
       /* Overlapping disks create a smooth variable-width tube without a
          self-intersecting ribbon at tight runway-exit curves. */
       g.beginPath();g.arc(SX(x),SY(y),half,0,Math.PI*2);g.fillStyle='#667985';g.fill();
     }
   }
   /* Optional north-side widening creates an asymmetric runway mouth. */
   if(flare.northExtra>0){
     const sideCount=Math.min(Math.max(1,flare.northSegments||count),path.segments.length),samples=[];
     for(let i=0;i<sideCount;i++){
       const seg=path.segments[i],p0=i===0?path.start:path.segments[i-1].to;
       for(let step=i===0?0:1;step<=64;step++){
         const t=step/64,u=1-t;
         samples.push({i,t,x:u*u*u*p0[0]+3*u*u*t*seg.c1[0]+3*u*t*t*seg.c2[0]+t*t*t*seg.to[0],y:u*u*u*p0[1]+3*u*u*t*seg.c1[1]+3*u*t*t*seg.c2[1]+t*t*t*seg.to[1]});
       }
     }
     const inner=[],outer=[];
     samples.forEach((p,index)=>{
       const prev=samples[Math.max(0,index-1)],next=samples[Math.min(samples.length-1,index+1)],dx=next.x-prev.x,dy=next.y-prev.y,len=Math.hypot(dx,dy)||1,nx=dy/len,ny=-dx/len;
       const progress=Math.min((p.i+p.t)/count,1),half=(p.i<count?flare.width+(1.65-flare.width)*progress:1.65)/2;
       const s=(p.i+p.t)/sideCount,taper=1-s*s*(3-2*s),outerHalf=half+flare.northExtra*taper;
       inner.push([SX(p.x+nx*half),SY(p.y+ny*half)]);
       outer.push([SX(p.x+nx*outerHalf),SY(p.y+ny*outerHalf)]);
     });
     g.beginPath();outer.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));
     for(let i=inner.length-1;i>=0;i--)g.lineTo(inner[i][0],inner[i][1]);
     g.closePath();g.fillStyle='#667985';g.fill();
   }
 };
 /* Draw the editable taxiway paths first; paint the runway afterward so every
    runway connector stops cleanly at the runway edge. */
 const routes=L.display?.taxiways?L.taxiways:[];
 routes.forEach(drawTaxiway);
 if(L.display?.runway!==false){
   polygon(L.runway.shoulder,'#29343e','#536574');
   /* Fine threshold bars make both ends readable without adding visual clutter. */
   if(L.runway.thresholdBars){
     const {northY,southY,count,inset}=L.runway.thresholdBars;
     g.strokeStyle='#a8b5be';g.lineWidth=Math.max(1,scale*.11);
     for(let i=0;i<count;i++)for(const y of [northY+i*inset,southY-i*inset]){
       g.beginPath();g.moveTo(SX(44.55),SY(y));g.lineTo(SX(47.45),SY(y));g.stroke();
     }
   }
 }
 const labelStyle=(x,y,text,color='#d3dde3',size=scale*1.5,rotate=0,minSize=8,maxSize=12)=>{g.save();g.translate(x,y);if(rotate)g.rotate(rotate*D);g.font=`700 ${Math.max(minSize,Math.min(maxSize,size))}px ui-monospace,Menlo,Consolas,monospace`;g.textAlign='center';g.textBaseline='middle';g.lineWidth=3;g.strokeStyle='rgba(7,11,16,.96)';g.strokeText(text,0,0);g.fillStyle=color;g.fillText(text,0,0);g.restore()};
 routes.forEach(route=>(route.labels||[]).forEach(label=>labelStyle(SX(label.at[0]),SY(label.at[1]),`TWY ${route.name}`,'#d3dde3',scale*1.5,label.rotate||0)));
 (L.aprons||[]).forEach(apron=>apron.label&&labelStyle(SX(apron.label.at[0]),SY(apron.label.at[1]),`APRON ${apron.name}`,'#d3dde3',scale*1.5));
 (L.aprons||[]).forEach(apron=>{
   (apron.terminals||[]).forEach(terminal=>terminal.labelAt&&labelStyle(SX(terminal.labelAt[0]),SY(terminal.labelAt[1]),`TERMINAL ${terminal.name}`,'#d3dde3',scale*1.05));
   (apron.stands||[]).forEach(stand=>labelStyle(SX(stand.labelAt[0]),SY(stand.labelAt[1]),stand.id,'#e4ebef',scale*2.1,stand.rotate||0,10,14));
 });
 if(L.display?.runway!==false){
   L.runway.designators.forEach(label=>labelStyle(SX(label.at[0]),SY(label.at[1]),label.text,'#edf3f6',scale*1.7));
   const runwayLabel=L.labels.find(label=>label.size==='runway');if(runwayLabel)labelStyle(SX(runwayLabel.at[0]),SY(runwayLabel.at[1]),'RWY 18/36','#edf3f6',scale*1.5,runwayLabel.rotate||0);
 }
 const compass=L.labels.find(label=>label.size==='compass');if(compass)labelStyle(SX(compass.at[0]),SY(compass.at[1]),compass.text,'#42c9e8',scale*1.7,compass.rotate||0);
 const surfaceAircraft=ac.filter(a=>a.surface).concat(surfaceDemoTraffic);
 const surfaceLabelRects=[];
 const surfacePlane=(x,y,heading)=>{
   const fx=Math.sin(heading*D),fy=-Math.cos(heading*D);
   for(let i=4;i>=1;i--){g.globalAlpha=.18+.12*(5-i);g.beginPath();g.arc(x-fx*i*.65*scale,y-fy*i*.65*scale,Math.max(.55,scale*.18),0,Math.PI*2);g.fillStyle='#f7fafc';g.fill()}
   g.globalAlpha=1;g.save();g.translate(x,y);g.rotate(heading*D);g.scale(scale*.22,scale*.22);g.beginPath();
   g.moveTo(0,-8);g.lineTo(1,-2);g.lineTo(6,1);g.lineTo(6,2.5);g.lineTo(1,1.5);g.lineTo(.9,5);g.lineTo(2.5,6.5);g.lineTo(2.5,7.5);g.lineTo(0,6.5);g.lineTo(-2.5,7.5);g.lineTo(-2.5,6.5);g.lineTo(-.9,5);g.lineTo(-1,1.5);g.lineTo(-6,2.5);g.lineTo(-6,1);g.lineTo(-1,-2);g.closePath();
   g.fillStyle='#fff';g.fill();g.restore();
 };
 const surfaceBlock=(anchorX,anchorY,lines,color,a)=>{
   g.save();g.font='10px ui-monospace,Menlo,Consolas,monospace';g.textBaseline='alphabetic';
   const w=Math.max(...lines.map(line=>g.measureText(line).width))+4,h=32;
   let r;const offset=a?.surface?.labelOffset;
   if(offset)r=[anchorX+offset.x,anchorY+offset.y,w,h];
   else for(const candidate of [[anchorX+12,anchorY-37],[anchorX+12,anchorY+8],[anchorX-w-12,anchorY-37],[anchorX-w-12,anchorY+8]]){
     r=[candidate[0],candidate[1],w,h];
     if(!surfaceLabelRects.some(p=>r[0]<p[0]+p[2]&&r[0]+r[2]>p[0]&&r[1]<p[1]+p[3]&&r[1]+p[3]>p[1]))break;
   }
   surfaceLabelRects.push(r);
   if(a)surfaceLabelHits.push({x:r[0],y:r[1],w:r[2],h:r[3],hitX:r[0]-10,hitY:r[1]-9,hitW:r[2]+20,hitH:r[3]+18,a,anchorX,anchorY});
   const ax=cl(anchorX,r[0],r[0]+r[2]),ay=cl(anchorY,r[1],r[1]+r[3]);g.strokeStyle='#aaa';g.beginPath();g.moveTo(anchorX,anchorY);g.lineTo(ax,ay);g.stroke();g.fillStyle=color;
   lines.forEach((line,i)=>g.fillText(line,r[0]+2,r[1]+9+i*10.5));g.restore();
 };
 surfaceAircraft.forEach(a=>{
   const sx=SX(a.surface.x),sy=SY(a.surface.y),heading=(a.h||0)-(L.mapRotationDeg||0);
   surfacePlane(sx,sy,heading);surfaceHits.push({x:sx,y:sy,a});
   const gate=a.surface.stand||a.surface.destinationStand||a.flight?.gate||'—';
   const lines=a.dep
     ?[getDisplayCallsign(a.cs),`SID ${a.flight?.procedure||'—'}`,`RWY ${a.flight?.runway||RWN}`]
     :[getDisplayCallsign(a.cs),`STAR ${a.flight?.procedure||'—'}`,`GATE ${gate}`];
   surfaceBlock(sx,sy,lines,a.dep?'#b9def4':'#f2e49b',a);
 });
 g.restore();
}
function drawRunwayMeasurements(runway){
 const g=ctx,extension=5,tickHalfWidth=.22,{u,threshold,oppositeThreshold}=runway;
 const ends=[{point:threshold,direction:-1},{point:oppositeThreshold,direction:1}];
 g.save();g.strokeStyle='#4cc9f0';g.lineWidth=1.5;g.setLineDash([]);
 ends.forEach(({point,direction})=>{
   const at=(distance,side=0)=>[
     point[0]+u[0]*direction*distance+u[1]*side,
     point[1]+u[1]*direction*distance-u[0]*side
   ];
   g.beginPath();g.moveTo(X(point[0]),Y(point[1]));
   const end=at(extension);g.lineTo(X(end[0]),Y(end[1]));g.stroke();
   for(let mile=1;mile<=extension;mile++){
     const a=at(mile,-tickHalfWidth),b=at(mile,tickHalfWidth);
     g.beginPath();g.moveTo(X(a[0]),Y(a[1]));g.lineTo(X(b[0]),Y(b[1]));g.stroke();
   }
 });
 g.restore();
}
function draw(){const g=ctx;g.setTransform(dpr,0,0,dpr,0,0);g.fillStyle='#070b10';g.fillRect(0,0,W,H);if(activePosition!=='APP'){drawSurface();return}const cx=X(AIRFIELD_SHIFT[0]),cy=Y(AIRFIELD_SHIFT[1]);g.lineWidth=1;g.font='10px ui-monospace,Menlo,Consolas,monospace';
g.strokeStyle='#192533';g.lineWidth=1;BORDERS.forEach(b=>{g.beginPath();b.forEach(([x,y],i)=>i?g.lineTo(X(x),Y(y)):g.moveTo(X(x),Y(y)));g.stroke()});
g.strokeStyle='#1d3345';g.lineWidth=1.5;COASTLINES.forEach(c=>{g.beginPath();c.forEach(([x,y],i)=>i?g.lineTo(X(x),Y(y)):g.moveTo(X(x),Y(y)));g.stroke()});
[10,20,30,40].forEach(r=>{g.strokeStyle='#14202c';g.lineWidth=1;g.beginPath();g.arc(cx,cy,r*sc,0,7);g.stroke();g.fillStyle='#2b4054';g.fillText(r,cx+3,cy-r*sc-3)});
g.strokeStyle='#3a3320';g.setLineDash([6,5]);g.beginPath();g.arc(cx,cy,45*sc,0,7);g.stroke();g.setLineDash([]);
for(let b=0;b<360;b+=10){const l=b%30?4:9,s=Math.sin(b*D),c=Math.cos(b*D),R=45*sc;g.strokeStyle='#2b4054';g.beginPath();g.moveTo(cx+s*R,cy-c*R);g.lineTo(cx+s*(R-l),cy-c*(R-l));g.stroke();if(!(b%30)){g.fillStyle='#4a6178';g.fillText(String(b).padStart(3,'0'),cx+s*(R+6)-9,cy-c*(R+6)+3)}}
const activeRunway=runwayGeometry(RWN);

/* Keep the runway designators physically fixed.
   The active runway only changes the label highlight color. */
const visualRunway=runwayGeometry(36);
const rwy36=visualRunway.threshold;
const rwy18=visualRunway.oppositeThreshold;

g.lineWidth=3;
g.strokeStyle='#8fa6ba';
g.beginPath();
g.moveTo(X(rwy36[0]),Y(rwy36[1]));
g.lineTo(X(rwy18[0]),Y(rwy18[1]));
g.stroke();

g.lineWidth=1;
drawRunwayMeasurements(visualRunway);

/* Visual runway designators:
   18 must be shown at the top/northern end and 36 at the
   bottom/southern end. This changes labels only; physical
   runway/ILS geometry remains untouched. */
g.fillStyle=RWN===18?'#4cc9f0':'#4a6178';
g.fillText(
  '18',
  X(rwy18[0])+6,
  Y(rwy18[1])-4
);

g.fillStyle=RWN===36?'#4cc9f0':'#4a6178';
g.fillText(
  '36',
  X(rwy36[0])+6,
  Y(rwy36[1])+10
);
Object.values(FX).forEach(f=>{const x=X(f.x),y=Y(f.y);g.strokeStyle='#5b7a92';g.beginPath();g.moveTo(x,y-4);g.lineTo(x+3.5,y+3);g.lineTo(x-3.5,y+3);g.closePath();g.stroke();if(sc>3){g.fillStyle='#5b7a92';g.fillText(f.n,x+6,y+3)}});

cf.filter(c=>SET.pred||c.l==2).forEach(c=>{const p=c.A,q=c.B;g.strokeStyle=c.l==2?'#ff5d5d':'#ffb020';g.setLineDash([3,4]);g.beginPath();g.moveTo(X(p.dx),Y(p.dy));g.lineTo(X(q.dx),Y(q.dy));g.stroke();g.setLineDash([]);g.fillStyle=g.strokeStyle;const m=`${c.h.toFixed(1)}NM`;g.fillText(m,(X(p.dx)+X(q.dx))/2+6,(Y(p.dy)+Y(q.dy))/2)});
const pl=[];
ac.filter(a=>!a.surface&&!a.twr&&!a.ctr).forEach(a=>{const x=X(a.dx),y=Y(a.dy),col=a.fl==2||a.ra?'#ff5d5d':a.fl?'#ffb020':a.emg?'#ff5d5d':a.dep?'#6fe3a0':'#d6e4f0';
g.fillStyle=col;(SET.trails?a.tr:[]).forEach(t=>{g.globalAlpha=.35;g.fillRect(X(t[0])-1,Y(t[1])-1,2,2)});g.globalAlpha=(a.twr||a.ctr)?0.45:1;
if(sel===a){
if(a.flight&&a.flight.route&&(a.mode==='NAV'||a.mode==='DCT')){let rt=a.flight.route,nIdx=rt.indexOf(a.flight.nextFix);if(nIdx<0)nIdx=0;g.lineWidth=2;g.strokeStyle='rgba(76,201,240,0.15)';g.beginPath();for(let i=0;i<nIdx;i++){let f1=FX[rt[i]],f2=FX[rt[i+1]];if(f1&&f2){g.moveTo(X(f1.x),Y(f1.y));g.lineTo(X(f2.x),Y(f2.y));}}g.stroke();g.beginPath();g.strokeStyle='rgba(76,201,240,0.7)';g.moveTo(x,y);let nF=FX[a.flight.nextFix];if(nF){g.lineTo(X(nF.x),Y(nF.y));for(let i=nIdx;i<rt.length-1;i++){let f2=FX[rt[i+1]];if(f2)g.lineTo(X(f2.x),Y(f2.y));}}g.stroke();g.lineWidth=1}
g.strokeStyle='rgba(76,201,240,.5)';g.setLineDash([3,4]);g.beginPath();g.moveTo(x,y);
  if(a.mode==='HDG'){const t=a.loc?runwayGeometry(a.flight?a.flight.runway:RWN).heading:a.th;g.lineTo(x+Math.sin(t*D)*60*sc,y-Math.cos(t*D)*60*sc)}
  g.stroke();g.setLineDash([]);g.strokeStyle='#4cc9f0';g.beginPath();g.arc(x,y,11,0,7);g.stroke()
}
if(a.fl){g.strokeStyle=col;g.beginPath();g.arc(x,y,9,0,7);g.stroke()}
g.beginPath();g.arc(x,y,2.6,0,7);g.fill();const ln=Math.max(18,a.dv*(1+a.da/50000)/60*sc);g.strokeStyle=col;g.lineWidth=1.3;g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.sin(a.dh*D)*ln,y-Math.cos(a.dh*D)*ln);g.stroke();g.lineWidth=1;
const actualAlt=Math.round(a.alt/100)*100;
const selectedAlt=Math.round((a.assistAlt??a.ta)/100)*100;
const actualSpd=Math.round(a.spd);
const selectedSpd=Math.round(a.assistSpd??a.ts);
const altTxt=actualAlt===selectedAlt?h3(actualAlt):`${h3(actualAlt)}=${h3(selectedAlt)}`;
const spdTxt=actualSpd===selectedSpd?String(actualSpd):`${actualSpd}=${selectedSpd}`;
const nextFix=(a.flight&&a.flight.nextFix&&FX[a.flight.nextFix])?a.flight.nextFix:'';
const L=[
  getDisplayCallsign(a.cs)+(a.emg||a.fl==2?' !':''),
  `${a.t} ${altTxt}`,
  `${spdTxt}${nextFix?' →'+nextFix:''}`
];
/*
 * Size the datablock from the text that is actually rendered.
 * The previous fixed width could leave a large gap between the
 * leader line and the visible text when the label was moved.
 */
const DBH=31,DBPAD=2;
const DBW=Math.max(...L.map(t=>g.measureText(t).width))+DBPAD*2;
let r;
if(a.labelManual&&a.labelOffset){
  r=[X(a.dx+a.labelOffset.x),Y(a.dy+a.labelOffset.y),DBW,DBH]
}else{
  for(const o of[[12,-47],[12,8],[-122,-47],[-122,8]]){
    r=[x+o[0],y+o[1],DBW,DBH];
    if(!pl.some(p=>r[0]<p[0]+p[2]&&r[0]+r[2]>p[0]&&r[1]<p[1]+p[3]&&r[1]+r[3]>p[1]))break
  }
}
pl.push(r);a.lb=r;
/* Connect to the nearest point on the actual visible datablock bounds. */
const ax=cl(x,r[0],r[0]+r[2]), ay=cl(y,r[1],r[1]+r[3]);
g.strokeStyle='#aaa';g.beginPath();g.moveTo(x,y);g.lineTo(ax,ay);g.stroke();
g.fillStyle=sel===a?'#4cc9f0':col;
L.forEach((t,i)=>{g.fillText(t,r[0]+2,r[1]+9+i*10.5)});
const typeW=g.measureText(a.t).width;
const gapW=g.measureText(' ').width;
const altW=g.measureText(altTxt).width;
const spdW=g.measureText(spdTxt).width;
a.dbHits={
 /* Only the altitude text itself is clickable for altitude selection. */
 alt:{x:r[0]+2+typeW+gapW,y:r[1]+10.5,w:altW+6,h:11},
 spd:{x:r[0]+2,y:r[1]+21,w:spdW+6,h:11}
};
});g.globalAlpha=1;
if(drag&&drag.on){const a=drag.a,x=X(a.dx),y=Y(a.dy),hd=(Math.atan2(ms.x-x,y-ms.y)/D+360)%360;g.strokeStyle='#4cc9f0';g.beginPath();g.moveTo(x,y);g.lineTo(ms.x,ms.y);g.stroke();g.fillStyle='#fff';g.fillText(String(Math.round(hd)%360).padStart(3,'0')+'°',ms.x+10,ms.y-8)}
if(distanceMeasure)showDistanceMeasure();
}
const pt=e=>{const r=cv.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}};
const hit=p=>activePosition!=='APP'?(surfaceHits.find(h=>Math.hypot(h.x-p.x,h.y-p.y)<20)?.a||null):ac.find(a=>!a.surface&&!a.twr&&!a.ctr&&(Math.hypot(X(a.dx)-p.x,Y(a.dy)-p.y)<14||(a.lb&&p.x>a.lb[0]&&p.x<a.lb[0]+a.lb[2]&&p.y>a.lb[1]&&p.y<a.lb[1]+a.lb[3])));
const hitSurfaceLabel=p=>[...surfaceLabelHits].reverse().find(h=>p.x>=h.hitX&&p.x<=h.hitX+h.hitW&&p.y>=h.hitY&&p.y<=h.hitY+h.hitH)||null;
const dbm=$('#dbm');
const hideDbMenu=()=>{dbm.style.display='none';dbm.innerHTML='';};
document.addEventListener('pointerdown',e=>{if(dbm.style.display==='block'&&!e.target.closest('#dbm')&&!e.target.closest('#cv'))hideDbMenu()},{capture:true});
const dbHit=(a,p)=>{
 if(!a||!a.dbHits)return null;
 for(const k of ['alt','spd']){
   const r=a.dbHits[k];
   if(p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h)return k
 }
 return null;
};

/* Temporary radar distance measurement: double-click + hold/drag. */
let distanceMeasure=null;
let lastRadarPointerDown=0;
let suppressNextDblClick=false;
const distanceMeasureStart=(p,pid)=>{
  distanceMeasure={x:p.x,y:p.y,cx:p.x,cy:p.y,pid};
  suppressNextDblClick=true;
  drag=null;
  pan=null;
  sel=null;
};
const showDistanceMeasure=()=>{
  if(!distanceMeasure)return;
  const dx=distanceMeasure.cx-distanceMeasure.x;
  const dy=distanceMeasure.cy-distanceMeasure.y;
  const nm=Math.hypot(dx,dy)/sc;
  const g=ctx;
  g.save();
  g.setTransform(dpr,0,0,dpr,0,0);
  g.strokeStyle='#4cc9f0';
  g.lineWidth=1;
  g.setLineDash([5,4]);
  g.beginPath();
  g.moveTo(distanceMeasure.x,distanceMeasure.y);
  g.lineTo(distanceMeasure.cx,distanceMeasure.cy);
  g.stroke();
  g.setLineDash([]);
  const mx=(distanceMeasure.x+distanceMeasure.cx)/2;
  const my=(distanceMeasure.y+distanceMeasure.cy)/2;
  const label=`${nm.toFixed(1)} NM`;
  g.font='10px ui-monospace,Menlo,Consolas,monospace';
  const pad=4,w=g.measureText(label).width+pad*2,h=15;
  g.fillStyle='rgba(7,11,16,.88)';
  g.fillRect(mx+8,my-h-2,w,h);
  g.fillStyle='#fff';
  g.fillText(label,mx+8+pad,my-4);
  g.restore();
};
const showDbMenu=(a,type,x,y)=>{
 const vals=type==='alt'
   ? ALT.filter(v=>v>=(a.dep?3000:2000))
   : SPD.filter(v=>v>=a.ty.v+15&&v<=Math.min(a.ty.x,a.eng?210:999));
 const cur=type==='alt'?(a.assistAlt??Math.round(a.alt/100)*100):(a.assistSpd??Math.round(a.spd));
 const label=v=>type==='alt'?lv(v):`${v} KT`;
 dbm.innerHTML=vals.map(v=>`<button data-db="${type}" data-v="${v}" ${+v===Math.round(cur)?'style="background:#12384a;color:#fff"':''}>${label(v)}</button>`).join('');
 const mw=105;
 dbm.style.left=Math.max(4,Math.min(W-mw,x+8))+'px';
 dbm.style.top=Math.max(4,Math.min(H-vals.length*28-8,y+8))+'px';
 dbm.style.display='block';
 dbm.onclick=e=>{
   const b=e.target.closest('[data-db]');if(!b)return;
   const v=+b.dataset.v;
   /* Datablock menus are controller-assistance/reference tools only. */
   if(type==='alt')a.assistAlt=v;
   else if(type==='spd')a.assistSpd=v;
   hideDbMenu();sig='';
 };
};
cv.onpointerdown=e=>{
 cv.setPointerCapture(e.pointerId);
 const p=pt(e);
 if(activePosition!=='APP'){
   const label=hitSurfaceLabel(p);
   if(label){
     sel=label.a;drag=pan=null;surfaceLabelDrag={a:label.a,startX:p.x,startY:p.y,offsetX:label.x-label.anchorX,offsetY:label.y-label.anchorY};
     cv.style.cursor='crosshair';sig='';return;
   }
   const target=hit(p);drag=pan=null;sig='';
   if(target){sel=target;return}
   cv.style.cursor='crosshair';pan={surface:1,x:p.x,y:p.y,left:surfaceOffset.x,top:surfaceOffset.y,mv:0};return;
 }
 const now=performance.now();
 const isDouble=lastRadarPointerDown&&now-lastRadarPointerDown<400&&Math.hypot(p.x-(window.__lastRadarX??p.x),p.y-(window.__lastRadarY??p.y))<14;
 lastRadarPointerDown=now;window.__lastRadarX=p.x;window.__lastRadarY=p.y;
 const a=hit(p);
 const dbType=a?dbHit(a,p):null;
 const onLabel=a&&a.lb&&p.x>=a.lb[0]&&p.x<=a.lb[0]+a.lb[2]&&p.y>=a.lb[1]&&p.y<=a.lb[1]+a.lb[3];
 /* Distance measurement is a radar-surface gesture only. Never intercept
    a datablock double-click, which belongs to the datablock reposition logic. */
 if(isDouble&&!dbType&&!onLabel){
   distanceMeasureStart(p,e.pointerId);
   return;
 }
 const target=a;ms=p;
 if(target){
  hideDbMenu();
  if(onLabel){
   sel=target;
   const lx=p.x-target.lb[0],ly=p.y-target.lb[1];
   drag={a:target,label:1,grabX:lx,grabY:ly,dbType,dbX:p.x,dbY:p.y,dbMoved:false,moved:false};
  }
  else if(dbType){
   sel=target;drag={a:target,dbType,dbX:p.x,dbY:p.y,dbMoved:false};return;
  }
  else{
   /* A press on the aircraft symbol immediately arms heading drag.
      A simple click still only selects the aircraft; movement activates the indicator. */
   if(sel!==target)sel=target;
   drag={a:target,on:0,x:p.x,y:p.y};
  }
 }else{
  hideDbMenu();
  const f=Object.values(FX).find(f=>Math.hypot(X(f.x)-p.x,Y(f.y)-p.y)<10);
  if(f&&sel&&!sel.twr&&!sel.ctr)dct(sel,f.n);else pan={x:p.x,y:p.y,vx,vy,mv:0}
 }
};
cv.onpointermove=e=>{
 const p=pt(e);ms=p;
 if(surfaceLabelDrag){
   const d=surfaceLabelDrag;
   if(Math.hypot(p.x-d.startX,p.y-d.startY)>3)d.a.surface.labelOffset={x:d.offsetX+p.x-d.startX,y:d.offsetY+p.y-d.startY};
   return;
 }
 if(distanceMeasure&&distanceMeasure.pid===e.pointerId){
   distanceMeasure.cx=p.x;distanceMeasure.cy=p.y;cv.style.cursor='crosshair';return;
 }
 if(!drag){const a=hit(p);cv.style.cursor=activePosition!=='APP'?'crosshair':(a&&dbHit(a,p))?'pointer':'crosshair'}
 if(drag&&drag.dbType&&Math.hypot(p.x-drag.dbX,p.y-drag.dbY)>4)drag.dbMoved=true;
  if(drag&&drag.label&&Math.hypot(p.x-drag.dbX,p.y-drag.dbY)>4)drag.moved=true;
  if(drag&&drag.label){const a=drag.a;const topX=p.x-drag.grabX,topY=p.y-drag.grabY;const wx=vx+(topX-W/2)/sc,wy=vy-(topY-H/2)/sc;a.labelOffset={x:wx-a.dx,y:wy-a.dy};a.labelManual=true;return}
 if(drag&&sel===drag.a&&Math.hypot(p.x-drag.x,p.y-drag.y)>24)drag.on=1;
 if(pan){if(Math.hypot(p.x-pan.x,p.y-pan.y)>4)pan.mv=1;if(pan.surface){if(pan.mv)surfaceOffset={x:pan.left+p.x-pan.x,y:pan.top+p.y-pan.y}}else if(pan.mv){vx=pan.vx-(p.x-pan.x)/sc;vy=pan.vy+(p.y-pan.y)/sc}}
};
cv.onpointerup=e=>{
 if(surfaceLabelDrag){surfaceLabelDrag=null;cv.style.cursor='crosshair';return}
 if(distanceMeasure&&distanceMeasure.pid===e.pointerId){
   distanceMeasure=null;
   cv.style.cursor='crosshair';
   return;
 }
 if(drag&&drag.label){
  const d=drag;
  if(!d.moved&&d.dbType)showDbMenu(d.a,d.dbType,d.dbX,d.dbY);
  drag=null;return;
 }
 if(drag&&drag.dbType){
  const d=drag;
  if(!d.dbMoved)showDbMenu(d.a,d.dbType,d.dbX,d.dbY);
  drag=null;return;
 }
 if(drag&&drag.on&&sel===drag.a){
  /* Mouse heading drag is preview-only. It must never issue or apply a heading command. */
  drag=null;
 }
 if(pan&&!pan.mv)sel=null;drag=pan=null;cv.style.cursor='crosshair'
};
cv.onwheel=e=>{e.preventDefault();const p=pt(e);if(activePosition!=='APP'){const c=RIX_SURFACE_MAP.coordinateSystem,cx=(c.minX+c.maxX)/2,cy=(c.minY+c.maxY)/2,oldScale=surfaceBaseScale()*surfaceZoom,wx=cx+(p.x-W/2-surfaceOffset.x)/oldScale,wy=cy+(p.y-H/2-surfaceOffset.y)/oldScale;surfaceZoom=cl(surfaceZoom*Math.exp(-e.deltaY*.0015),.55,4);const nextScale=surfaceBaseScale()*surfaceZoom;surfaceOffset={x:p.x-W/2-(wx-cx)*nextScale,y:p.y-H/2-(wy-cy)*nextScale};return}const wx=vx+(p.x-W/2)/sc,wy=vy-(p.y-H/2)/sc;sc=cl(sc*Math.exp(-e.deltaY*.0015),2.5,40);vx=wx-(p.x-W/2)/sc;vy=wy+(p.y-H/2)/sc};
cv.ondblclick=e=>{
 if(suppressNextDblClick){suppressNextDblClick=false;return}
 if(activePosition!=='APP'){
   const label=hitSurfaceLabel(pt(e));
   if(label){label.a.surface.labelOffset=null;sig='';return}
 }
 const p=pt(e),a=hit(p);
 if(!a)return;
 if(a.lb&&p.x>=a.lb[0]&&p.x<=a.lb[0]+a.lb[2]&&p.y>=a.lb[1]&&p.y<=a.lb[1]+a.lb[3]){
   a.labelManual=false;
   a.labelOffset=null;
   sig='';
   return;
 }
 vx=a.dx;vy=a.dy;
};cv.oncontextmenu=e=>e.preventDefault();
let ls0b=1;const setSp=v=>{if(v>0)ls0b=v;sp=v};
document.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{const v=b.dataset.s;setSp(v=='p'?ls0b:+v)});
onkeydown=e=>{if(!run)return;if(e.key==' '){e.preventDefault();setSp(sp?0:ls0b)}else if('1248'.includes(e.key))setSp(+e.key);else if(e.key=='Escape')sel=null};
