function resetSessionState(){
  /* Return the simulator to a genuinely fresh radar state.  Keep setup/settings
     selections intact, but clear every mutable object belonging to the previous
     session so no aircraft, conflicts, messages or progression can leak forward. */
  ac=[];sel=null;activePosition='APP';id=0;mg=[];ls={};AR={};cf=[];lossH=[];EVENT_LOG.length=0;
  ST.land=ST.dep=ST.sep=ST.conf=ST.tcas=ST.ga=ST.emg=ST.emgH=ST.miss=ST.low=ST.readback=0;
  ST.gaps=[];ST.tm=[];
  for(const k of Object.keys(spawnLastArr))delete spawnLastArr[k];
  for(const k of Object.keys(spawnLastDep))delete spawnLastDep[k];
  EM=[];T=0;EX=0;lastSnap=0;sp=0;run=0;acc=0;sig='';fl=0;vx=0;vy=0;
  lastDep=-99;nA=0;nxA=0;nxD=20;nE=140;nW=rnd(420,720);
  drag=null;pan=null;ms={x:0,y:0};msgVersion=0;uiMsgVersion=-1;slg='';
  RUNWAY_PENDING=false;PENDING_RWN=null;OLD_RWN=null;OLD_GEO=null;rwyChgT=0;
  try{hideDbMenu()}catch(e){}
  cancelVoiceRecognition('session reset');voiceSessionCompleted=0;
  voicePTTState='CLOSED';voiceHasResult=false;voiceTone(false);voiceStatus('standby','MIC STANDBY');
  slg='';uiMsgVersion=-1;
}
function startSim(){resetSessionState();VOICE_LOG=[];voiceRawTranscript='';voiceTranscript='';voiceAlternatives=[];lvl=+CFG.tr;SESS=CFG.mode==='ENDLESS'?Infinity:+CFG.tm*60;wd=pick([350,10,30,180,200,170]);setRwy(pick([18,36]));seedSurfaceDemoTraffic();RUNWAY_PENDING=false;PENDING_RWN=null;OLD_RWN=null;OLD_GEO=null;$('#rwb').textContent='CHANGE';$('#rwb').classList.remove('runway-confirm');qnh=Math.round(rnd(995,1036));let w=CFG.wx;if(w=='AUTO')w=pick(['CLEAR','CLEAR','CLOUD','RAIN']);GAP=.06;
if(w=='STORM'){ws=Math.round(rnd(20,30));vis=3;wxt='THUNDERSTORM';wxc='overcast 1000 feet';GAP=.15}else if(w=='RAIN'){ws=Math.round(rnd(12,20));vis=5;wxt='RAIN';wxc='broken cloud 1800 feet';GAP=.09}else if(w=='CLOUD'){ws=Math.round(rnd(7,18));vis=8;wxt='CLOUD BKN 1200';wxc='broken cloud 1200 feet'}else{ws=Math.round(rnd(7,18));vis=10;wxt='CLEAR';wxc='clear skies'}
for(const k of Object.keys(spawnLastArr))delete spawnLastArr[k];for(const k of Object.keys(spawnLastDep))delete spawnLastDep[k];
EM=[];{const n=pick({LOW:[0,0,1],NORMAL:[0,1,1,2],HIGH:[1,2,2]}[CFG.em]),k=Number.isFinite(SESS)?SESS/1200:1,e0=rnd(240,520);if(n>0)EM.push(e0*k);if(n>1)EM.push(Math.min(1000,e0+rnd(300,420))*k)}nW=rnd(.35,.6)*SESS;
$('#ov').style.display='none';run=1;setSp(1);try{AU=AU||new(window.AudioContext||window.webkitAudioContext)();AU.resume()}catch(e){}initVoiceControl();nxA=T+4;nxD=T+[90,60,40,30][lvl];msg('TWR→APP',`Runway ${RWN} active, wind ${wd}/${ws}.`)}
$('#go').onclick=startSim;
const sv=()=>{try{localStorage.setItem('apc_set',JSON.stringify(SET))}catch(e){}},ap=()=>{VOL=SET.vol;cv.style.filter=`brightness(${SET.br})`;$('#ov').classList.toggle('noanim',!SET.anim)};
try{Object.assign(SET,JSON.parse(localStorage.getItem('apc_set')||'{}'))}catch(e){}
const fillSet=()=>{$('#sv').value=SET.vol*100;$('#sb').value=SET.br*100;$('#c1').checked=!!SET.trails;$('#c2').checked=!!SET.pred;$('#c3').checked=!!SET.lab;$('#c4').checked=!!SET.anim;$('#svv').textContent=Math.round(SET.vol*100)+'%';$('#sbv').textContent=Math.round(SET.br*100)+'%'};fillSet();ap();
$('#m-set').oninput=()=>{SET.vol=$('#sv').value/100;SET.br=$('#sb').value/100;SET.trails=$('#c1').checked;SET.pred=$('#c2').checked;SET.lab=$('#c3').checked;SET.anim=$('#c4').checked;$('#svv').textContent=Math.round(SET.vol*100)+'%';$('#sbv').textContent=Math.round(SET.br*100)+'%';ap();sv()};
const initMicSettings=()=>{try{voiceMicDeviceId=voiceMicStoredId()}catch(e){};refreshVoiceInputDevices({requestPermission:false,silent:true}).catch(()=>{});};
initMicSettings();
$('#micRefresh').onclick=async()=>{const b=$('#micRefresh');if(!b)return;b.disabled=true;voiceMicSetStatus('SCANNING…','warn');await refreshVoiceInputDevices({requestPermission:true});b.disabled=false;};
$('#micSelect').onchange=()=>{selectVoiceInputDevice($('#micSelect').value)};
function end(){
  cancelVoiceRecognition('session ended');
  run=0;voiceMicStop();voiceStatus('standby','MIC STANDBY');
  const g=ST.gaps,av=g.length?g.reduce((a,b)=>a+b)/g.length:0;
  const et=`${EX/60|0}:${String(EX%60|0).padStart(2,'0')}`;
  const events=EVENT_LOG.filter(e=>!/(VOICE|PTT|MIC|RECOGNITION|SPEECH|STALE|FINALIZING|START RETRY|START FAILED|WINDOW BLUR)/i.test(String(e)));
  const eventHtml=events.length?events.slice(-40).map(e=>{
    const m=String(e).match(/^(\d{2}:\d{2}:\d{2})\s+(.*)$/),tm=m?m[1]:'—',tx=m?m[2]:String(e);
    const critical=/(LOSS OF SEPARATION|TCAS|EMERGENCY|ENGINE FAILURE|MEDICAL)/i.test(tx),warn=/(GO-AROUND|CONFLICT|WIND CHANGE|REJECTS HANDOFF)/i.test(tx);
    return `<div class="rep-event ${critical?'critical':warn?'warn':''}"><span class="rep-event-time">${tm}</span><span class="rep-event-marker"></span><span class="rep-event-text">${tx}</span></div>`;
  }).join(''):'<div class="rep-empty">NO SIGNIFICANT ATC EVENTS</div>';
  const clean=ST.sep===0&&ST.conf===0&&ST.tcas===0;
  const status=clean?'CLEAN SECTOR':'REVIEW REQUIRED';
  const rewardState=window.apcDebriefRewardState||{};
  const towerHandoffs=Number(rewardState.towerHandoffs||0),centerHandoffs=Number(rewardState.centerHandoffs||0);
  const spacingMetric=av>0?`<div class="rep-metric"><b>${av.toFixed(1)}<i> NM</i></b><span>AVERAGE FINAL SPACING</span></div>`:'';
  $('#m-rep').innerHTML=`
    <div class="rep-shell">
      <div class="rep-hero">
        <div class="rep-kicker">RIGA APPROACH · SESSION DEBRIEF</div>
        <h1 class="rep-title">SESSION COMPLETE</h1>
        <div class="rep-status">
          <div class="rep-status-main"><span class="rep-dot ${clean?'':'warn'}"></span><span>${status}</span></div>
          <div class="rep-status-context">${clean?'SAFE SEPARATION MAINTAINED':'REVIEW THE SAFETY EVENTS BELOW'}</div>
        </div>
      </div>
      <section class="rep-reward-panel" id="repRewardPanel" aria-label="Session rewards">
        <div class="rep-reward-head"><div><span class="rep-section-kicker">SESSION REWARDS</span><small id="repRewardLabel">REWARD CLAIM</small></div><span id="repRewardStatus" class="rep-reward-status">SYNCING</span></div>
        <div class="rep-reward-values">
          <div class="rep-reward-value xp"><small>XP EARNED</small><b id="repXpEarned">···</b></div>
          <div class="rep-reward-value miles"><small>MILES EARNED</small><b id="repMilesEarned">···</b></div>
        </div>
        <div class="rep-reward-progress" id="repRewardProgress">
          <div class="rep-reward-totals"><span>PROFILE TOTAL</span><b><i id="repTotalXp">—</i> XP <em>·</em> <i id="repTotalMiles">—</i> MILES</b></div>
          <div class="rep-progress-label"><span id="repLevelText">LEVEL PROGRESS</span><b id="repXpToNext">—</b></div>
          <div class="rep-progress-track"><span id="repProgressFill"></span></div>
          <div id="repLevelUp" class="rep-level-up" hidden></div>
        </div>
        <p id="repRewardNote" class="rep-reward-note" aria-live="polite"></p>
      </section>
      <div class="rep-group-grid">
        <div class="rep-panel rep-group"><div class="rep-panel-head"><span class="rep-panel-title">TRAFFIC FLOW</span><span class="rep-panel-note">SESSION SUMMARY</span></div><div class="rep-metric-grid">
          <div class="rep-metric accent"><b>${ST.land+ST.dep}</b><span>AIRCRAFT HANDLED</span></div><div class="rep-metric"><b>${et}</b><span>SESSION DURATION</span></div>
          <div class="rep-metric"><b>${ST.land}</b><span>ARRIVALS</span></div><div class="rep-metric"><b>${ST.dep}</b><span>DEPARTURES</span></div>
        </div></div>
        <div class="rep-panel rep-group"><div class="rep-panel-head"><span class="rep-panel-title">HANDOFFS &amp; EVENTS</span><span class="rep-panel-note">YOUR OPERATIONS</span></div><div class="rep-metric-grid">
          <div class="rep-metric accent"><b>${towerHandoffs}</b><span>TOWER HANDOFFS</span></div><div class="rep-metric accent"><b>${centerHandoffs}</b><span>CENTER HANDOFFS</span></div>
          <div class="rep-metric"><b>${ST.emgH}</b><span>EMERGENCIES HANDLED<small>${ST.emg?`${ST.emg} DECLARED`:'NONE DECLARED'}</small></span></div><div class="rep-metric"><b>${ST.ga}</b><span>GO-AROUNDS</span></div>
        </div></div>
        <div class="rep-panel rep-group"><div class="rep-panel-head"><span class="rep-panel-title">SAFETY &amp; SPACING</span><span class="rep-panel-note">SECTOR OUTCOME</span></div><div class="rep-metric-grid">
          <div class="rep-metric ${ST.sep?'warn':'good'}"><b>${ST.sep}</b><span>SEPARATION LOSSES</span></div><div class="rep-metric ${ST.conf?'warn':''}"><b>${ST.conf}</b><span>CONFLICT ALERTS</span></div>
          <div class="rep-metric ${ST.tcas?'warn':''}"><b>${ST.tcas}</b><span>TCAS EVENTS</span></div>${spacingMetric}
        </div></div>
      </div>
      <div class="rep-panel rep-event-panel"><div class="rep-panel-head"><span class="rep-panel-title">NOTABLE ATC EVENTS</span><span class="rep-panel-note">OPERATIONAL LOG</span></div><div class="rep-events">${eventHtml}</div></div>
      <div class="rep-actions"><button id="viewVoiceLog" class="secondary">VIEW VOICE LOG</button><button data-go="m-main" class="primary">RETURN TO MENU</button></div>
    </div>
    <div id="voiceDetail" class="voice-detail" aria-hidden="true"><div class="voice-detail-card"><div class="voice-detail-head"><div><div class="rep-panel-title">Voice log</div><small>DETAILED PTT / SPEECH RECOGNITION RECORD</small></div><button id="closeVoiceLog" class="voice-detail-close">CLOSE</button></div><div class="voice-detail-actions"><button id="copyVoiceLog">COPY LOG</button><button id="downloadVoiceLog">DOWNLOAD LOG</button></div><div id="voiceLogBox" class="voice-detail-log"></div><div id="voiceLogEmpty" class="voice-log-empty">No voice commands recorded.</div></div></div>`;
  show('m-rep');renderVoiceLog();$('#ov').style.display='flex';window.apcUpdateDebriefRewards?.();
  $('#viewVoiceLog').onclick=()=>{$('#voiceDetail').classList.add('on');$('#voiceDetail').setAttribute('aria-hidden','false')};
  $('#closeVoiceLog').onclick=()=>{$('#voiceDetail').classList.remove('on');$('#voiceDetail').setAttribute('aria-hidden','true')};
  $('#voiceDetail').onclick=e=>{if(e.target.id==='voiceDetail')$('#closeVoiceLog').click()};
}
document.addEventListener('click',e=>{
  if(e.target.id==='copyVoiceLog'){copyVoiceLog()}
  if(e.target.id==='downloadVoiceLog'){downloadVoiceLog()}
  if(e.target.closest('#m-rep')&&e.target.dataset.go==='m-main'){}
});
$('#mt').onclick=()=>{mute=!mute;$('#mt').textContent=mute?'SND OFF':'SND ON'};
$('#rwb').onclick=()=>{if(!run)return;if(RUNWAY_PENDING){
  const old=RWN,next=PENDING_RWN;
  if(next!==18&&next!==36)return;
  setRwy(next);
  RUNWAY_PENDING=false;PENDING_RWN=null;OLD_RWN=null;OLD_GEO=null;
  $('#rwb').textContent='CHANGE';$('#rwb').classList.remove('runway-confirm');sig='';msg('TWR→APP',`Runway ${old} → ${RWN} change confirmed`);return
}
const old=RWN,next=RWN===36?18:36;
PENDING_RWN=next;
OLD_RWN=next;
OLD_GEO=runwayGeometry(next);
RUNWAY_PENDING=true;
$('#rwb').textContent='CONFIRM';$('#rwb').classList.add('runway-confirm');sig='';msg('TWR→APP',`Runway ${old} → ${next}. Confirm change.`)};
let endConfirmTimer=0;
$('#end').onclick=()=>{
  if(!run)return;
  const b=$('#end');
  if(b.dataset.confirm==='1'){clearTimeout(endConfirmTimer);b.dataset.confirm='';b.textContent='END SESSION';end();return}
  b.dataset.confirm='1';b.textContent='ARE YOU SURE?';
  clearTimeout(endConfirmTimer);
  endConfirmTimer=setTimeout(()=>{if(b.dataset.confirm==='1'){b.dataset.confirm='';b.textContent='END SESSION'}},5000);
};
let pauseMenuActive=false,pauseMenuSpeed=1;
const settingsBackButton=$('#m-set .config-actions-back button');
const openPauseMenu=()=>{
  if(!run||pauseMenuActive)return;
  pauseMenuSpeed=sp||ls0b||1;
  setSp(0);
  if(voicePTT||voiceListening)try{stopListening()}catch(e){}
  pauseMenuActive=true;
  $('#pauseEndConfirm').textContent='';
  const endButton=$('[data-pause-end]');
  endButton.dataset.confirm='';endButton.querySelector('span').textContent='END SESSION';
  settingsBackButton.dataset.go='m-pause';
  $('#ov').style.display='flex';show('m-pause');
};
const closePauseMenu=()=>{
  if(!pauseMenuActive)return;
  pauseMenuActive=false;
  settingsBackButton.dataset.go='m-main';
  $('#ov').style.display='none';
  setSp(pauseMenuSpeed||1);
};
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||!run)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(pauseMenuActive)closePauseMenu();else openPauseMenu();
},true);
document.addEventListener('click',e=>{
  if(e.target.closest('[data-pause-resume]')){closePauseMenu();return}
  if(e.target.closest('[data-pause-settings]')){
    if(!pauseMenuActive)return;
    settingsBackButton.dataset.go='m-pause';show('m-set');return;
  }
  const endButton=e.target.closest('[data-pause-end]');
  if(!endButton||!pauseMenuActive)return;
  if(endButton.dataset.confirm==='1'){
    endButton.dataset.confirm='';pauseMenuActive=false;settingsBackButton.dataset.go='m-main';end();return;
  }
  endButton.dataset.confirm='1';
  endButton.querySelector('span').textContent='CONFIRM END SESSION';
  $('#pauseEndConfirm').textContent='THIS WILL END THE CURRENT SESSION';
});
requestAnimationFrame(loop);
