/* ─────────────── HOW TO PLAY ─────────────── */
const HELP_PAGES=[
  {
    kicker:'01 / YOUR ROLE', title:'RUN THE APPROACH',
    intro:'You are the approach controller. Guide arrivals toward the runway while keeping every aircraft safely separated.',
    tiles:[['01','SCAN','Watch positions, altitudes and conflict alerts.'],['02','CONTROL','Select an aircraft and issue a clear instruction.'],['03','SEQUENCE','Build a steady, safe arrival flow.'],['04','HAND OFF','Transfer aircraft when they are ready.']],
    note:'Your priority: keep traffic safe, then keep it moving.'
  },
  {
    kicker:'02 / RADAR', title:'READ THE PICTURE',
    intro:'The radar is your workspace. Use the symbol for position and the datablock for aircraft details.',
    tiles:[['CALLSIGN','Identity','Who you are speaking to.'],['TYPE · ALT','Aircraft · altitude','Type and current height.'],['SPEED','Knots','Current indicated speed.'],['ROUTE','Fix / heading','Where it is going next.']],
    note:'Drag a datablock to move it. Double-click to reset its position.'
  },
  {
    kicker:'03 / SELECT', title:'CHOOSE YOUR TRAFFIC',
    intro:'Click an aircraft symbol or datablock. Its details and available controls appear in the side panel.',
    tiles:[['CHECK','Altitude','Confirm its current level.'],['CHECK','Route','See its next fix or approach.'],['ACT','Use a control','The selected aircraft receives the instruction.']],
    note:'You can select another aircraft while an earlier instruction is being carried out.'
  },
  {
    kicker:'04 / CLEARANCES', title:'GIVE A CLEAR INSTRUCTION',
    intro:'Use the aircraft controls in the side panel, or issue a supported command by voice.',
    tiles:[['HEADING','Turn','Assign a heading.'],['ALTITUDE','Climb / descend','Set a target altitude.'],['SPEED','Adjust','Set a target speed.'],['ROUTE','Direct / ILS','Change route or clear an approach.'],['HANDOFF','Tower / Center','Transfer control when available.']],
    note:'Instructions take effect after a short simulated delay. Check the aircraft response on radar.'
  },
  {
    kicker:'05 / VOICE', title:'TALK TO THE PILOT',
    intro:'Hold ALT to transmit. Say the callsign first, then one instruction in plain, concise language.',
    samples:['“BTI373, heading 270.”','“BTI373, descend 5000 feet.”','“BTI373, direct SIGUL.”'],
    note:'Voice speed commands set the aircraft’s target speed; they do not change the datablock display setting.'
  },
  {
    kicker:'06 / READBACK', title:'CLOSE THE LOOP',
    intro:'Pilots read back clearances. Listen for mistakes and correct them promptly.',
    tiles:[['ISSUE','Give clearance','Use the panel or voice.'],['LISTEN','Check readback','Compare it with your instruction.'],['CORRECT','Say “negative”','Then repeat the correct clearance.']],
    note:'Uncorrected readback errors can affect your session score.'
  },
  {
    kicker:'07 / ARRIVALS', title:'BUILD A SAFE SEQUENCE',
    intro:'Arrivals enter from different directions. Shape their paths and spacing before they reach final.',
    tiles:[['VECTOR','Heading','Turn traffic toward the approach.'],['SPACE','Altitude · speed','Create room between aircraft.'],['APPROACH','ILS','Clear suitably positioned traffic.']],
    note:'The active runway is in the top bar. Changing it requires confirmation.'
  },
  {
    kicker:'08 / DEPARTURES + HANDOFFS', title:'SHARE THE SECTOR',
    intro:'Departures and arrivals share the same airspace. Watch both flows and keep the airport area clear.',
    tiles:[['DEPARTURE','Guide it out','Use heading, altitude and speed.'],['TOWER','Contact Tower','Available when the aircraft is ready.'],['CENTER','Contact Center','Available for qualifying departures.']],
    note:'Handoff controls appear when their conditions are met.'
  },
  {
    kicker:'09 / START HERE', title:'YOUR FIRST MINUTE',
    intro:'Start with one aircraft. Read its datablock, make one safe change, then watch what happens.',
    tiles:[['01','SCAN','Find the closest traffic or alert.'],['02','SELECT','Open its details.'],['03','INSTRUCT','Give one clear command.'],['04','VERIFY','Check the readback and radar.']],
    note:'Ready? Select an airport and take control.'
  }
];
let helpPage=0;
const renderHelp=()=>{
  const page=HELP_PAGES[helpPage];
  const tiles=page.tiles?.map(([eyebrow,title,copy])=>`<div class="help-tile"><span>${eyebrow}</span><b>${title}</b><small>${copy}</small></div>`).join('')||'';
  const samples=page.samples?.map((sample,i)=>`<div class="help-sample"><span>0${i+1}</span><b>${sample}</b></div>`).join('')||'';
  $('#helpPage').innerHTML=`<div class="help-card"><div class="help-step">${page.kicker}</div><h1 class="help-title">${page.title}</h1><p class="help-intro">${page.intro}</p>${tiles?`<div class="help-tiles">${tiles}</div>`:''}${samples?`<div class="help-samples">${samples}</div>`:''}<div class="help-callout"><b>FIELD NOTE</b><span>${page.note}</span></div></div>`;
  $('#helpPageNum').textContent=String(helpPage+1).padStart(2,'0');
  $('#helpPageTotal').textContent=String(HELP_PAGES.length).padStart(2,'0');
  $('#helpProgress').innerHTML=HELP_PAGES.map((_,i)=>`<i class="${i<=helpPage?'on':''}"></i>`).join('');
  $('[data-help-prev]').disabled=helpPage===0;
  const next=$('[data-help-next]');
  next.innerHTML=helpPage===HELP_PAGES.length-1?'START PLAYING <strong>→</strong>':'NEXT <strong>→</strong>';
};
const openHelp=()=>{
  helpPage=0;
  renderHelp();
  show('m-help');
};
const closeHelp=()=>show('m-main');
const nextHelp=()=>{
  if(helpPage<HELP_PAGES.length-1){
    helpPage++;
    renderHelp();
  }else{
    show('m-air');
  }
};
const prevHelp=()=>{
  if(helpPage>0){
    helpPage--;
    renderHelp();
  }else{
    closeHelp();
  }
};
renderHelp();

document.addEventListener('click',e=>{
  const goHelp=e.target.closest('[data-go="m-help"]');
  if(goHelp){
    e.preventDefault();
    openHelp();
    return;
  }
  const next=e.target.closest('[data-help-next]');
  if(next){
    e.preventDefault();
    nextHelp();
    return;
  }
  const prev=e.target.closest('[data-help-prev]');
  if(prev&&!prev.disabled){
    e.preventDefault();
    prevHelp();
    return;
  }
  const close=e.target.closest('[data-help-close]');
  if(close){
    e.preventDefault();
    closeHelp();
    return;
  }
});
document.addEventListener('keydown',e=>{
  if(!$('#m-help')?.classList.contains('on'))return;
  if(e.key==='ArrowRight'){e.preventDefault();nextHelp()}
  else if(e.key==='ArrowLeft'){e.preventDefault();prevHelp()}
  else if(e.key==='Escape'){e.preventDefault();closeHelp()}
});
