const setRwy=n=>{
  if(RWN){OLD_RWN=RWN;OLD_GEO=runwayGeometry(RWN);rwyChgT=T}
  N36=n==36;
  RWN=n;
  const geo=runwayGeometry(RWN);
  C=geo.heading;
  U=geo.u;
  TH=geo.threshold;
};setRwy(Math.cos((wd-355)*D)>=0?36:18);OLD_RWN=null;OLD_GEO=null;let SESS=1200;const hw=()=>Math.round(ws*Math.cos((wd-C)*D));
let T=0,EX=0,lastSnap=0,sp=0,ls0=1,run=0,lvl=1,sel=null,ac=[],id=0,mg=[],ls={},AR={},cf=[],lossH=[],lastDep=-99,nA=0,nxA=0,nxD=20,nE=140,acc=0,sig='',fl=0,vx=0,vy=0,sc=8,W=0,H=0,dpr=1,drag=null,pan=null,ms={x:0,y:0};
/* Position switching changes the controller's view, never the live session. */
let activePosition='APP';
const ST={land:0,dep:0,sep:0,conf:0,tcas:0,ga:0,emg:0,emgH:0,miss:0,low:0,readback:0,gaps:[],tm:[]};
const EVENT_LOG=[];
const MAX_EVENT_LOG=1000;
const MAX_MESSAGE_LOG=60;
const MAX_VOICE_LOG=1000;
const MAX_HISTORY=1000;
const boundedPush=(arr,v,max)=>{arr.push(v);if(arr.length>max)arr.splice(0,arr.length-max);return v};
const logE=(m)=>{boundedPush(EVENT_LOG,`${clk()}  ${m}`,MAX_EVENT_LOG);};
const TRANSITION_LEVEL=60;
let vis=10,wxt='CLEAR',wxc='clear skies',qnh=1013,GAP=.06,VOL=.8,SET={vol:.8,br:1,trails:1,pred:1,lab:0,anim:1},CFG={tr:1,wx:'AUTO',rw:'AUTO',em:'NORMAL',tm:20,mode:'TIMED'},AU,mute=0,EM=[],nW=rnd(420,720);{const n=pick([0,1,1,2]);if(n>0)EM.push(rnd(240,520));if(n>1)EM.push(Math.min(1000,EM[0]+rnd(300,420)))}
const beep=(f,d,t0=0,ty='sine',v=.08)=>{if(!AU||mute)return;const o=AU.createOscillator(),g=AU.createGain(),t=AU.currentTime+t0;o.type=ty;o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v*VOL,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(AU.destination);o.start(t);o.stop(t+d+.05)};
const SND={arr:()=>{beep(660,.3);beep(880,.4,.2)},dep:()=>{beep(520,.18,0,'triangle');beep(780,.28,.14,'triangle')},emg:()=>{for(let i=0;i<4;i++){beep(920,.15,i*.32,'square',.05);beep(660,.15,i*.32+.16,'square',.05)}}};
const clk=()=>{const h=52200+(T|0);return[h/3600%24|0,h/60%60|0,h%60].map(v=>String(v).padStart(2,'0')).join(':')};
let msgVersion=0;
const msg=(s,x)=>{boundedPush(mg,`<div><b class="${s.slice(0,3)}">${s}</b> ${clk()} ${x}</div>`,MAX_MESSAGE_LOG);msgVersion++;return msgVersion};

/* Pilot readback simulation: ~5% of applicable numerical readbacks contain
   one small misunderstanding. The aircraft still executes the actual ATC
   instruction; only the spoken readback is incorrect. */
const readbackNumberDelta=(kind,value)=>{
  const n=Number(value);
  if(!Number.isFinite(n))return null;
  if(kind==='ALT'){
    const candidates=[n-2000,n-1000,n+1000,n+2000].filter(v=>v>=500&&v<=20000);
    return candidates.length?pick(candidates):null;
  }
  if(kind==='HDG')return pick([(n+10)%360,(n-10+360)%360]);
  if(kind==='SPD'){
    const candidates=[n-10,n+10].filter(v=>v>=100&&v<=350);
    return candidates.length?pick(candidates):null;
  }
  return null;
};
const makeIncorrectReadback=(rb)=>{
  const text=String(rb||'');
  let m=text.match(/\b(FL)(\d{2,3})\b/);
  if(m){
    const wrong=readbackNumberDelta('ALT',+m[2]*100);
    if(wrong!==null)return text.slice(0,m.index)+`FL${Math.round(wrong/100)}`+text.slice(m.index+m[0].length);
  }
  m=text.match(/\b(?:CLIMB|CLIMBING|DESCEND|DESCENDING|DESCENT|MAINTAIN)(?:\s+TO)?\s+(\d{3,5})\b/i);
  if(m){
    const wrong=readbackNumberDelta('ALT',+m[1]);
    if(wrong!==null)return text.slice(0,m.index+m[0].indexOf(m[1]))+String(Math.round(wrong))+text.slice(m.index+m[0].indexOf(m[1])+m[1].length);
  }
  m=text.match(/\b(\d{3,5})(?=\s*(?:FEET|FT)\b)/);
  if(m){
    const wrong=readbackNumberDelta('ALT',+m[1]);
    if(wrong!==null)return text.slice(0,m.index)+String(Math.round(wrong))+text.slice(m.index+m[0].length);
  }
  m=text.match(/\bHEADING\s+(\d{3})\b/i);
  if(m){
    const wrong=readbackNumberDelta('HDG',+m[1]);
    if(wrong!==null)return text.slice(0,m.index+8)+String(Math.round(wrong)%360).padStart(3,'0')+text.slice(m.index+m[0].length);
  }
  m=text.match(/\bSPEED\s+(\d{3})\b/i);
  if(m){
    const wrong=readbackNumberDelta('SPD',+m[1]);
    if(wrong!==null)return text.slice(0,m.index+6)+String(Math.round(wrong))+text.slice(m.index+m[0].length);
  }
  return null;
};
const instructionKey=(text)=>{
  const u=String(text||'').toUpperCase().replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
  let m;
  m=u.match(/\b(?:HEADING|TURN(?:\s+(?:LEFT|RIGHT))?\s+HEADING|TURNING)\s+(\d{1,3})\b/);
  if(m)return `HDG:${(+m[1])%360}`;
  m=u.match(/\b(?:CLIMB|DESCEND|DESCENT|MAINTAIN)(?:\s+AND\s+MAINTAIN)?\s+(?:TO\s+)?(?:FL)?(\d{2,5})\b/);
  if(m)return `ALT:${m[1]}`;
  m=u.match(/\b(?:SPEED|REDUCE SPEED|INCREASE SPEED)(?:\s+TO)?\s+(\d{3})\b/);
  if(m)return `SPD:${m[1]}`;
  m=u.match(/\bILS\s+(?:RUNWAY\s*)?(18|36)\b/);
  if(m)return `ILS:${m[1]}`;
  m=u.match(/\bDIRECT\s+([A-Z0-9]+)\b/);
  if(m)return `DCT:${m[1]}`;
  if(/\bTOWER\b/.test(u))return 'TWR';
  if(/\bCENTER\b/.test(u))return 'CTR';
  if(/\bRESUME\s+OWN\s+NAVIGATION\b/.test(u))return 'RSM';
  return u;
};
const preparePilotReadback=(controllerText,correctReadback)=>{
  const incorrect=Math.random()<0.04?makeIncorrectReadback(correctReadback):null;
  if(!incorrect)return {rb:correctReadback,pending:null};
  return {rb:incorrect,pending:{started:T,deadline:T+60,expectedKey:instructionKey(controllerText),correctReadback,errorCounted:false}};
};
const clearReadbackWatch=a=>{if(a)a.readbackWatch=null};
const checkReadbackCorrection=(a,controllerText)=>{
  if(!a||!a.readbackWatch||a.readbackWatch.errorCounted)return false;
  if(instructionKey(controllerText)===a.readbackWatch.expectedKey){
    clearReadbackWatch(a);
    return true;
  }
  return false;
};
const expireReadbackWatch=a=>{
  if(!a||!a.readbackWatch||a.readbackWatch.errorCounted)return;
  if(T>=a.readbackWatch.deadline){
    a.readbackWatch.errorCounted=true;
    ST.readback++;
    const cs=getSpokenCallsign(a.cs);
    msg('APP',`<span class="r">READBACK ERROR — ${cs} incorrect readback not corrected within 60 seconds</span>`);
    logE(`READBACK ERROR ${cs} incorrect readback not corrected within 60 seconds`);
  }
};
const issue=(a,t,rb,f)=>{
  if(!a||typeof f!=='function')return;
  const correction=checkReadbackCorrection(a,t);
  if(!correction)msg(a.owner||'APP',`${a.cs} ${t}`);
  const prepared=preparePilotReadback(t,rb);
  /* Keep the original aircraft reference with the queued instruction.
     The callback must never depend on the mutable global selection (sel),
     and a removed aircraft must not be able to crash the simulation. */
  (a.q=a.q||[]).push({
    t:T+rnd(2,5),
    rb:prepared.rb,
    apply:()=>{if(ac.includes(a))f()},
    pendingReadback:prepared.pending
  });
};
const weatherQnhSpoken=()=>String(qnh).split('').join(' ');
const weatherControllerText=()=>`information: wind ${String(wd).padStart(3,'0')} degrees ${ws} knots, visibility ${vis} kilometres, ${wxc}, QNH ${weatherQnhSpoken()}`;
const weatherReadbackText=()=>`wind ${String(wd).padStart(3,'0')} degrees ${ws} knots, visibility ${vis} kilometres, ${wxc}, QNH ${weatherQnhSpoken()}`;
const giveWeather= a=>{
  if(!a||a.twr||a.ctr||a.ga)return false;
  issue(a,weatherControllerText(),weatherReadbackText(),()=>{a.weatherReceived=qnh;a.weatherReceivedAt=T});
  sig='';
  return true;
};
const voiceIssueImmediate=(a,rb,f)=>{
  if(!a||typeof f!=='function')return false;
  f();
  msg(a.cs,`"${rb}, ${getSpokenCallsign(a.cs)}."`);
  sig='';
  return true;
};const snap=a=>{a.dx=a.x;a.dy=a.y;a.dh=a.h;a.da=a.alt;a.dv=a.spd};const rm=a=>{if(a)a.readbackWatch=null;ac=ac.filter(x=>x!==a);if(sel===a)sel=null};
const lv=v=>v>=7000?'FL'+v/100:v,h3=v=>String(Math.round(v/100)).padStart(3,'0');
