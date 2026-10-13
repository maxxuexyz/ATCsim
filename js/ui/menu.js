let selectedAirport=null;
const renderAirportCards=()=>{
  $('#cards').innerHTML=AIRPORTS.map(a=>`
    <article class="airport-card" data-ap="${a.id}" tabindex="0" role="button" aria-label="Select ${a.name}">
      <div class="airport-visual">
        <div class="airport-label">RADAR / AIRFIELD PREVIEW</div>
        <div class="airport-radar-ring"></div>
        <div class="airport-runway"></div>
        <div class="airport-approach"></div>
        <div class="airport-map-code">${a.id}</div>
      </div>
      <div class="airport-info">
        <div>
          <div class="airport-ready"><i></i>${a.status}</div>
          <div class="airport-code">${a.id}</div>
          <div class="airport-name">${a.name}</div>
          <div class="airport-country">${a.city} · ${a.country}</div>
          <div class="airport-specs">
            <div class="airport-spec"><small>RUNWAYS</small><b>${a.runways}</b></div>
            <div class="airport-spec"><small>APPROACH</small><b>${a.approach}</b></div>
            <div class="airport-spec"><small>ROLE</small><b>${a.role}</b></div>
            <div class="airport-spec"><small>SECTOR</small><b>${a.sector}</b></div>
          </div>
        </div>
        <div class="airport-card-action"><span>SELECT AIRPORT</span><span>→</span></div>
      </div>
    </article>
  `).join('');
  $('#airportCount').textContent=String(AIRPORTS.length).padStart(2,'0');
  $('#airportCount').nextElementSibling.textContent=AIRPORTS.length===1?'AIRPORT AVAILABLE':'AIRPORTS AVAILABLE';
};
renderAirportCards();

const selectAirport=id=>{
  const airport=AIRPORTS.find(a=>a.id===id);
  if(!airport)return;
  selectedAirport=airport.id;
  document.querySelectorAll('.airport-card').forEach(c=>c.classList.toggle('selected',c.dataset.ap===id));
  const st=$('.airport-footer-status');
  st.classList.add('active');
  $('#selectedAirportLabel').textContent=`${airport.id} · ${airport.name.toUpperCase()}`;
  $('#airportStart').disabled=false;
  $('#airportStart').dataset.airport=id;
};
const openSelectedAirport=()=>{
  if(!selectedAirport)return;
  if(selectedAirport==='RIX'){
    $('#cfgt').textContent='RIGA APPROACH';
    show('m-cfg');
  }
};
$('#airportStart').onclick=openSelectedAirport;
const updateSessionModeUI=()=>{
  const endless=CFG.mode==='ENDLESS';
  document.querySelectorAll('[data-g="tm"]').forEach(b=>b.disabled=endless);
  document.querySelectorAll('[data-g="mode"]').forEach(b=>b.classList.toggle('on',(b.dataset.v||'')===CFG.mode));
};
updateSessionModeUI();

const uiBeep=(kind='click')=>{try{if(!AU)AU=new(window.AudioContext||window.webkitAudioContext)();AU.resume();if(mute)return;const f=kind==='back'?280:kind==='start'?720:420;beep(f,kind==='start'?.11:.055,0,'sine',kind==='start'?.055:.035);if(kind==='start')beep(980,.08,.07,'sine',.035)}catch(e){}};
document.addEventListener('pointerdown',e=>{const b=e.target.closest('#ov button');if(b&&!b.disabled){b.classList.add('press');setTimeout(()=>b.classList.remove('press'),120)}},{passive:true});
document.addEventListener('click',e=>{const b=e.target.closest('#ov button');if(b&&!b.disabled){const kind=b.id==='go'?'start':b.dataset.go==='m-main'?'back':'click';uiBeep(kind)}}); 
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-go]'),o=e.target.closest('[data-g]'),p=e.target.closest('[data-ap]');
  if(t){
    if(t.dataset.go==='m-main'&&e.target.closest('#m-rep'))resetSessionState();
    show(t.dataset.go);
  }
  if(o){
    document.querySelectorAll(`[data-g=${o.dataset.g}]`).forEach(x=>x.classList.toggle('on',x===o));
    CFG[o.dataset.g]=o.dataset.v;
    if(o.dataset.g==='mode')updateSessionModeUI();
  }
  if(p)selectAirport(p.dataset.ap);
});
document.addEventListener('keydown',e=>{
  const p=e.target.closest('[data-ap]');
  if(p&&(e.key==='Enter'||e.key===' ')){e.preventDefault();selectAirport(p.dataset.ap)}
});


