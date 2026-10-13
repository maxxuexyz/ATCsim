/* ─────────────── VOICE CONTROL V1 ─────────────── */
let voiceRec=null,voiceSupported=false,voiceListening=false,voicePTT=false,voiceLocalReady=false,voicePreparing=false;
let voicePermissionAttempted=false,voiceTranscript='',voiceRawTranscript='',voiceFinal=false,voicePending=false,voiceSessionActive=false,voiceCaptureUntil=0,voiceCommandTimer=null,voiceRestartTimer=null,voiceAlternatives=[],VOICE_LOG=[];
let voiceSessionId=0,voiceActiveSession=0,voiceReleasedAt=0,voiceRecognitionSession=0,voicePTTState='CLOSED',voiceSessionCompleted=0,voiceHasResult=false,voiceSilenceTimer=null;
let voiceInputStream=null,voiceInputTrack=null,voiceMicDeviceId='';
const VOICE_MIC_STORAGE_KEY='apc_voice_mic';
const VOICE_SILENCE_TIMEOUT=2000;
const voiceStatus=(state='standby',label='MIC STANDBY',cmd='')=>{
  const el=$('#voiceStatus');if(!el)return;
  el.classList.remove('listening','error','ready');if(state!=='standby')el.classList.add(state);
  el.querySelector('b').textContent=label;$('#voiceCmd').textContent=cmd?` · ${cmd}`:'';
};
const voiceTone=(on)=>{
  try{if(!AU)AU=new(window.AudioContext||window.webkitAudioContext)();AU.resume();
    if(mute)return;
    beep(on?1050:620,.055,0,'sine',.045);
  }catch(e){}
};
const AIRLINE_CALLSIGNS={
  LO:['POLISH','LOT','LOT POLISH','BULLISH'],
  KL:['KLM','KAY ELL EM','KAY ELL M','K L M','CALEM','CALEB'],
  BT:['AIR BALTIC','AIRBALTIC','AIRBALTICS','BALTIC','OUR BALTIC','OUR BALTICS','I BALTIC','AEROBALTIC','AERO BALTIC','AEROBATIC','AERO BATIC','AIR BAL TIC','AIR BOT','AIRBOT','HERBALTIC','HERBALTICS','HARBAUGHTICK','HARBALTIC','AIRBOTIK'], 
  LH:['LUFTHANSA','LUFTHANSA GERMAN','LUFTHANS'],
  SK:['SCANDINAVIAN','SAS'],
  FR:['RYANAIR','RYAN AIR','REINER','RAINER','RAIN AIR','RYNER','RYNER AIR','RHINET','RHINO','RHINUS','RHINER','GARDINER','ZARINAR','9 AIR','NINE AIR','MARION AIR','RIGHT NOW'],
  D8:['NORWEGIAN','NORWEIGIAN','NORWEGIAN AIR','SOONER'],
  AY:['FINNAIR','FIN AIR','FINNER','FIONA','FINER','THIN AIR','THINER','FINAR','FINR','FERNA','FERNER','FENNEL','FURNITURE','BEEN OUR','FEARNARD','FEAR NOT','FINN'],
  OS:['AUSTRIAN','AUSTRIAN AIRLINES'],
  TK:['TURKISH','TURKISH AIRLINES','CIRCUS'],
  FZ:[
    'FLYDUBAI','FLY DUBAI','FLY DUBAI AIR','FLIGHT DUBAI',
    'FLIGHT TO BUY','FLY TO BUY','FLOODED BY','FLOATED BY',
    'PLOTTED BY','FLIGHTED BY','FLIGHTED BUY','FLIGHT BY','FLYED BY'
  ]
};
const airlineCodeFromCallsign=cs=>{
  const up=String(cs||'').toUpperCase().replace(/\s+/g,'');
  return Object.keys(AIRLINE_CALLSIGNS).sort((a,b)=>b.length-a.length).find(code=>up.startsWith(code)&&/^\d+$/.test(up.slice(code.length)))||null;
};
const airlineForCode=code=>(AIRLINE_CALLSIGNS[code]||[code])[0];
const getSpokenCallsign=cs=>{
  const up=String(cs||'').toUpperCase().replace(/\s+/g,'');
  const code=airlineCodeFromCallsign(up);
  if(!code)return up;
  return `${airlineForCode(code)} ${up.slice(code.length)}`;
};
const DISPLAY_CALLSIGN={
  BT:'BTI',
  FR:'RYR',
  D8:'NAX',
  AY:'FIN',
  LH:'DLH',
  LO:'LOT',
  TK:'THY',
  SK:'SAS'
};
const getDisplayCallsign=cs=>{
  const up=String(cs||'').toUpperCase().replace(/\s+/g,'');
  const code=airlineCodeFromCallsign(up);
  return code&&DISPLAY_CALLSIGN[code]
    ? `${DISPLAY_CALLSIGN[code]}${up.slice(code.length)}`
    : up;
};
const voiceDigits={ZERO:'0',OH:'0',O:'0',ONE:'1',WON:'1',TWO:'2',TO:'2',TOO:'2',TOW:'2',THREE:'3',TREE:'3',FOUR:'4',FOR:'4',FIVE:'5',SIX:'6',SEVEN:'7',EIGHT:'8',ATE:'8',NINE:'9',NINER:'9'};
const voiceNumberWords={...voiceDigits,TEN:10,ELEVEN:11,TWELVE:12,THIRTEEN:13,FOURTEEN:14,FIFTEEN:15,SIXTEEN:16,SEVENTEEN:17,EIGHTEEN:18,NINETEEN:19};
const voiceTens={TWENTY:20,THIRTY:30,FORTY:40,FIFTY:50,SIXTY:60,SEVENTY:70,EIGHTY:80,NINETY:90};
const voiceNoiseWords=new Set(['THE','A','AN','PLEASE','NOW','IMMEDIATELY','CURRENTLY']);
function normalizeVoiceText(t){
  let s=String(t||'').toUpperCase()
    .replace(/[,.!?;:]/g,' ')
    .replace(/-/g,' ')
    .replace(/\bAERO\s*BALTIC\b/g,'AIR BALTIC')
    .replace(/\bAEROBALTIC\b/g,'AIR BALTIC')
    .replace(/\bAEROBATIC\b/g,'AIR BALTIC')
    .replace(/\bAERO\s*BATIC\b/g,'AIR BALTIC')
    .replace(/\bOUR\s+BALTIC\b/g,'AIR BALTIC')
    .replace(/\bOURBALTIC\b/g,'AIR BALTIC')
    .replace(/\bAIRBOT\b/g,'AIR BALTIC')
    .replace(/\bAIR\s*BALTIC\b/g,'AIR BALTIC')
    .replace(/\bAIR\s+BALTI[CQ]\b/g,'AIR BALTIC')
    .replace(/\bAIR\s+BAL\s*TIC\b/g,'AIR BALTIC')
    .replace(/\bTURN\s+(LEFT|RIGHT)S\b/g,'TURN $1')
    .replace(/\bDESCEND\s+THROUGH\b/g,'DESCEND TO')
    .replace(/\bDESCENT\s+THROUGH\b/g,'DESCEND TO')
    .replace(/\bDESCEND\s+TWO\s+(?=\d|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN)\b/g,'DESCEND TO ')
    .replace(/\bDESCENT\s+TWO\s+(?=\d|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN)\b/g,'DESCEND TO ')

    .replace(/\bAIR\s+BAL\s*TIC\b/g,'AIR BALTIC')
    /* Context-safe speech-recognition aliases. */
    .replace(/\bCONTACT\s+OUR\b/g,'CONTACT TOWER')
    .replace(/\bTURN\s+(LEFT|RIGHT)\s+(?:AT|THERE|AND|IN|ON)\s+(?:RING|HANDING|ADDING|SETTING)\b/g,'TURN $1 HEADING')
    .replace(/\b(?:CLAMPED|CLIENT)\s+TO\s+(?:FLY|FLIGHT)\s+LEVEL\b/g,'CLIMB TO FLIGHT LEVEL')
    .replace(/\bFLIGHTED\s+BY\b/g,'FLIGHTED BY')
    /* SpeechRecognition distortions observed in the RIX voice log. */
    .replace(/\bCOMPAQ\s+CENTER\b/g,'CONTACT CENTER')
    .replace(/\bCOMPACT\s+CENTER\b/g,'CONTACT CENTER')
    .replace(/\bCONTACT\s+HOUR\b/g,'CONTACT TOWER')
    .replace(/\bCONTACT\s+OURS\b/g,'CONTACT TOWER')
    .replace(/\b\S+\s+CENT(?:ER)?\b/g,m=>m.replace(/\bCENT\b/,'CENTER'))
    .replace(/\b(?:CLEAR|CLEARED)\s+(?:DIALA'S|AYLA'S|EYE\s+LAST)\s+APPROACH\b/g,'CLEARED ILS APPROACH')
    .replace(/\b(?:CLEAR|CLEARED)\s+THE\s+ILS\s+APPROACH\b/g,'CLEARED ILS APPROACH')
    .replace(/\bROW\s+836\b/g,'RUNWAY 36')
    .replace(/\bROW\s+36\b/g,'RUNWAY 36')
    .replace(/\bPOSITIRECT\b/g,'DIRECT')
    .replace(/\b(?:HE|HE'S|IS)\s+SENT\s+TO\b/g,'DESCEND TO')
    .replace(/\bSENT\s+TO\b/g,'DESCEND TO')
    .replace(/\bSENT\s+(?=\d)/g,'DESCEND ')
    .replace(/\bPERCENT\s+(?=\d)/g,'DESCEND ')
    .replace(/\bTURN\s+RIGHT\s+THEN\s+IN\b/g,'TURN RIGHT HEADING')
    .replace(/\bTURN\s+LEFT\s+THEN\s+IN\b/g,'TURN LEFT HEADING')
    .replace(/\bTURN\s+RIGHT\s+AND\s+IN\b/g,'TURN RIGHT HEADING')
    .replace(/\bTURN\s+LEFT\s+AND\s+IN\b/g,'TURN LEFT HEADING')
    .replace(/\bCLAMP\s+TO\s+FLIGHT\s+LEVEL\b/g,'CLIMB TO FLIGHT LEVEL')
    .replace(/\bFLIGHT\s+LEVEL\s+(\d+)\s+IRAN\b/g,'FLIGHT LEVEL $1')
    .replace(/\bFLIGHT\s+LEVEL\s+(\d+)\s+IS\s+0\b/g,'FLIGHT LEVEL $1')
    .replace(/\bFLIGHT\s+LEVEL\s+(\d+)\s+NOUR?\b/g,'FLIGHT LEVEL $1');
  const fixes=[
    [/\bDECENT\b/g,'DESCEND'],
    [/\bDESCENT\b/g,'DESCEND'],
    [/\bDESCENDING\b/g,'DESCEND'],
    [/\bDESCENDS?\b/g,'DESCEND'],
    [/\bCLIMBING\b/g,'CLIMB'],
    [/\bFLY\s*LEVEL\b/g,'FLIGHT LEVEL'],
    [/\bFLIGHT\s*LEVEL\b/g,'FLIGHT LEVEL'],
    [/\bFLIGHTLEVEL\b/g,'FLIGHT LEVEL'],
    [/\bCAL(?:EM|LEM|AM)\b/g,'KLM'],
    [/\bKAYLEM\b/g,'KLM'],
    [/\bFLY(?:ING)?\s+LEVEL\b/g,'FLIGHT LEVEL'],
    [/\bFLIGHT\s+LE(?:VEL|BEL|VAL)\b/g,'FLIGHT LEVEL'],
    [/\bFLY\s+LE(?:VEL|BEL|VAL)\b/g,'FLIGHT LEVEL'],
    [/\bFLITE\s+LEVEL\b/g,'FLIGHT LEVEL'],
    [/\bHAND\s*OFF\b/g,'HANDOFF'],
    [/\bRIGA\s+TOWER\b/g,'TOWER'],
    [/\bRIGA\s+CENTER\b/g,'CENTER'],
    [/\bCONTACT\s+APPROACH\b/g,'APPROACH'],
    [/\bCLEAR(?:ED)?\s+FOR\b/g,'CLEAR'],
    [/\bPROCEED\s+DIRECT\b/g,'DIRECT'],
    [/\bFLY\s+DIRECT\b/g,'DIRECT'],
    [/\bGO\s+DIRECT\b/g,'DIRECT'],
    [/\bTURN\s+TO\s+HEADING\b/g,'HEADING'],
    [/\bTURN\s+HEADING\b/g,'HEADING'],
    [/\bFLY\s+HEADING\b/g,'HEADING'],
    [/\bTURN\s+(LEFT|RIGHT)\s+HEADING\b/g,'HEADING'],
    [/\bALTITUDE\s+OF\b/g,'ALTITUDE'],
    [/\bCLIMB\s+AND\s+MAINTAIN\b/g,'CLIMB'],
    [/\bDESCEND\s+AND\s+MAINTAIN\b/g,'DESCEND'],
    [/\bREDUCE\s+TO\b/g,'REDUCE SPEED'],
    [/\bINCREASE\s+TO\b/g,'INCREASE SPEED'],
    [/\bSPEED\s+OF\b/g,'SPEED'],
    [/\bSET\s+HEADING\b/g,'HEADING'],
    [/\bSET\s+ALTITUDE\b/g,'ALTITUDE'],
    [/\bSET\s+SPEED\b/g,'SPEED'],
    [/\bDESCEND\s+DOWN\s+TO\b/g,'DESCEND'],
    [/\bCLIMB\s+UP\s+TO\b/g,'CLIMB']
  ];
  for(const [re,to] of fixes)s=s.replace(re,to);
  return s.replace(/\s+/g,' ').trim();
}
function normalizeCallsignText(t){
  let s=normalizeVoiceText(t);
  const wordMap={
    ZERO:'0',OH:'0',O:'0',ONE:'1',WON:'1',TWO:'2',TO:'2',TOO:'2',TOW:'2',
    THREE:'3',TREE:'3',FOUR:'4',FOR:'4',FIVE:'5',SIX:'6',SEVEN:'7',
    EIGHT:'8',ATE:'8',NINE:'9',NINER:'9'
  };
  s=s.split(/\s+/).map(w=>wordMap[w]??w).join(' ');
  const airlineMap=[
    [/\bAIR\s+BALTIC\b/g,'BT'],[/\bAEROBALTIC\b/g,'BT'],[/\bAEROBATIC\b/g,'BT'],[/\bAERO\s+BALTIC\b/g,'BT'],
    [/\b(?:AIRBALTIC|HERBALTIC|HERBALTICS|HARBAUGHTICK|HARBALTIC|AIRBOTIK)\b/g,'BT'],[/\b(?:POLISH|BULLISH)\b/g,'LO'],[/\bLOT\s+POLISH\b/g,'LO'],[/\bKLM\b/g,'KL'],[/\bKAY\s+ELL\s+EM\b/g,'KL'],[/\bKAY\s+ELL\s+M\b/g,'KL'],
    [/\bLUFTHANSA\b/g,'LH'],[/\bSCANDINAVIAN\b/g,'SK'],[/\bSAS\b/g,'SK'],[/\bRYANAIR\b/g,'FR'],[/\bRYAN\s+AIR\b/g,'FR'],
    [/\bNORWEGIAN\b/g,'D8'],[/\b(?:FINNAIR|FINNER|FINER|FENNEL|BEEN\s+OUR)\b/g,'AY'],[/\bAUSTRIAN(?:\s+AIRLINES)?\b/g,'OS'],[/\bTURKISH(?:\s+AIRLINES)?\b/g,'TK'],
    [/\b(?:FLY\s*DUBAI|FLYDUBAI|FLIGHT\s+DUBAI|FLIGHT\s+TO\s+BUY|FLY\s+TO\s+BUY|FLOODED\s+BY|FLOATED\s+BY|PLOTTED\s+BY|FLIGHTED\s+BY|FLIGHTED\s+BUY|FLIGHT\s+BY|FLYED\s+BY)\b/g,'FZ'],
    [/\b(?:RYANAIR|RYAN\s+AIR|REINER|RAINER|RAIN\s+AIR|RYNER(?:\s+AIR)?|RHINO|RHINUS|RHINER|GARDINER|ZARINAR)\b/g,'FR'],
  ];
  for(const [re,to] of airlineMap)s=s.replace(re,to);
  return s.replace(/[^A-Z0-9]/g,'');
}
function parseVoiceNumber(raw,opts={}){
  if(raw===null||raw===undefined)return null;
  let clean=String(raw).toUpperCase()
    .replace(/[,.]/g,' ')
    .replace(/\b(?:DEGREES?|DEG|KNOTS?|KNOTT|FEET|FOOT|FT|NOUGHT|NOT|NODES?|NODE)\b/g,' ')
    .replace(/\s+/g,' ').trim();
  if(!clean)return null;

  /* "TO" is useful as a spoken TWO in callsigns, but it must never become
     a standalone command value such as "speed to". */
  const allowTo=!!opts.allowTo;
  const digitValue=w=>{
    if(/^\d$/.test(w))return w;
    if(w==='TO'||w==='TOO'||w==='TOW')return allowTo?'2':null;
    return voiceDigits[w]!==undefined?voiceDigits[w]:null;
  };

  /* ATC speech often mixes spoken digits with literal digits:
     "1 niner 0", "one 5 6", "niner 55", etc. */
  const tokens=clean.split(' ').filter(w=>w&&!voiceNoiseWords.has(w));
  const digitToken=w=>digitValue(w)!==null;
  if(tokens.length&&tokens.every(digitToken)){
    return +tokens.map(w=>digitValue(w)).join('');
  }
  if(/^(?:\d+)(?:\s+\d+)*$/.test(clean))return +clean.replace(/\s/g,'');

  const words=clean.split(' ').filter(w=>w&&!voiceNoiseWords.has(w));
  let total=0,current=0,seen=false;
  for(const w of words){
    if(w==='TO'||w==='TOO'||w==='TOW'){
      if(!allowTo)return null;
      current+=2;seen=true;
    }else if(voiceNumberWords[w]!==undefined){current+=voiceNumberWords[w];seen=true}
    else if(voiceTens[w]!==undefined){current+=voiceTens[w];seen=true}
    else if(w==='HUNDRED'){current=(current||1)*100;seen=true}
    else if(w==='THOUSAND'){total+=(current||1)*1000;current=0;seen=true}
    else return null;
  }
  return seen?total+current:null;
}
function parseVoiceValue(raw){
  let s=String(raw||'').toUpperCase()
    .replace(/[,.!?;:]/g,' ')
    .replace(/\bFLY\s*LEVEL\b/g,'FLIGHT LEVEL')
    .replace(/\bFLIGHTLEVEL\b/g,'FLIGHT LEVEL')
    .replace(/\bFL\s*(\d+)\b/g,'FLIGHT LEVEL $1')
    .replace(/\b(?:KNOTS?|FEET|FOOT|FT)\b/g,' ')
    .replace(/\s+/g,' ').trim();
  const fl=s.match(/^FLIGHT\s+LEVEL\s+(.+)$/);
  if(fl){const n=parseVoiceNumber(fl[1]);return n===null?null:n*100;}
  return parseVoiceNumber(s);
}
function callsignAliases(a){
  const cs=String(a.cs||'').toUpperCase().replace(/\s+/g,'');
  const code=airlineCodeFromCallsign(cs);
  if(!code)return [cs];
  const digits=cs.slice(code.length);
  const names=AIRLINE_CALLSIGNS[code]||[code];
  const digitWords=digits.split('').map(d=>Object.keys(voiceDigits).find(k=>voiceDigits[k]===d&&k.length>1)||d).join(' ');
  const variants=new Set([cs,`${code} ${digits}`,`${code} ${digitWords}`]);
  names.forEach(n=>{
    variants.add(`${n} ${digits}`);
    variants.add(`${n} ${digitWords}`);
  });
  return [...variants];
}
function compactVoice(s){return String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'')}
function voiceEditDistance(a,b){
  a=compactVoice(a);b=compactVoice(b);
  if(Math.abs(a.length-b.length)>1)return 99;
  const row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}
  return row[b.length];
}
function normalizeCallsignSpeech(t){
  let s=normalizeVoiceText(t)
    .replace(/[\/\\,;:!?().-]+/g,' ')
    .replace(/([A-Z])(\d)/g,'$1 $2')
    .replace(/(\d)([A-Z])/g,'$1 $2');
  const wordMap={
    ZERO:'0',OH:'0',O:'0',ONE:'1',WON:'1',TWO:'2',TO:'__TWO__',TOO:'__TWO__',TOW:'__TWO__',
    THREE:'3',TREE:'3',FOUR:'4',FOR:'4',FIVE:'5',SIX:'6',SEVEN:'7',
    EIGHT:'8',ATE:'8',NINE:'9',NINER:'9'
  };
  s=s.split(/\s+/).map(w=>wordMap[w]??w).join(' ');
  /* Common SpeechRecognition artifacts inside spoken callsign digits:
     "59 or one" / "59R1" can safely collapse to the numeric sequence
     because the simulator's actual callsigns are digits only. */
  s=s.replace(/(\d+)\s+OR\s+(?=\d)/g,'$1 ')
    .replace(/(\d+)\s+R\s+(?=\d)/g,'$1 ');
  return s.replace(/\s+/g,' ').trim();
}
function callsignNumberCandidates(text){
  const tokens=normalizeCallsignSpeech(text).split(' ').filter(Boolean);
  const out=[];
  for(let i=0;i<tokens.length;i++){
    if(!/^\d+$/.test(tokens[i])&&!['__TWO__'].includes(tokens[i]))continue;
    let n=tokens[i]==='__TWO__'?'2':tokens[i],j=i+1;
    while(j<tokens.length&&(/^\d+$/.test(tokens[j])||tokens[j]==='__TWO__')){
      n+=tokens[j]==='__TWO__'?'2':tokens[j];j++;
    }
    out.push({digits:n,start:i,end:j});
  }
  return out;
}
function airlineSpeechScore(text,code){
  const tokens=normalizeCallsignSpeech(text).split(' ').filter(Boolean);
  if(!tokens.length)return 0;
  const aliases=[code,...(AIRLINE_CALLSIGNS[code]||[])];
  let best=0;
  /*
   * Score only the words before the first numeric token. This prevents
   * command values later in the sentence from influencing airline matching.
   */
  const firstNum=tokens.findIndex(t=>/^\d+$/.test(t));
  const prefix=(firstNum<0?tokens:tokens.slice(0,firstNum));
  if(!prefix.length)return 0;
  for(const alias of aliases){
    const at=compactVoice(alias);
    const max=at.length<=4?1:at.length<=7?2:3;
    for(let n=1;n<=Math.min(4,prefix.length);n++){
      const candidate=compactVoice(prefix.slice(-n).join(' '));
      if(!candidate)continue;
      const d=voiceEditDistance(candidate,at);
      if(d<=max){
        const score=1-d/(max+1);
        if(score>best)best=score;
      }
    }
  }
  return best;
}
function fuzzyCallsignMatch(text,a){
  const code=airlineCodeFromCallsign(a.cs);
  if(!code)return false;
  const targetDigits=String(a.cs).slice(code.length);
  const candidates=callsignNumberCandidates(text);
  /*
   * Numeric callsigns are STRICT. A candidate must equal the aircraft's
   * complete numeric callsign exactly. No truncation or edit distance.
   */
  if(!candidates.some(c=>c.digits===targetDigits))return false;
  /*
   * Airline matching is deliberately softer because browser speech
   * recognition commonly corrupts airline names (e.g. FINNER/FENNEL).
   * It is still constrained to the text before the callsign number.
   */
  return airlineSpeechScore(text,code)>0;
}
function findVoiceAircraft(text){
  return ac.filter(a=>!a.twr&&!a.ctr).filter(a=>fuzzyCallsignMatch(text,a));
}
function extractVoiceCallsign(text){
  const matches=[];
  ac.filter(a=>!a.twr&&!a.ctr).forEach(a=>{if(fuzzyCallsignMatch(text,a))matches.push(a)});
  const unique=[...new Set(matches)];
  return unique.length===1?unique[0]:unique.length>1?{ambiguous:true,matches:unique}:null;
}
function stripVoiceCallsign(text,a){
  const tokens=normalizeCallsignSpeech(text).split(' ').filter(Boolean);
  const code=airlineCodeFromCallsign(a?.cs||'');
  const digits=code?String(a.cs).slice(code.length):'';
  if(!code||!digits)return String(text||'').trim();
  for(let i=0;i<tokens.length;i++){
    if(!/^\d+$/.test(tokens[i]))continue;
    let n=tokens[i],j=i+1;
    while(j<tokens.length&&/^\d+$/.test(tokens[j])){n+=tokens[j];j++}
    if(n===digits){
      /*
       * The callsign is at the beginning in normal ATC phraseology.
       * Remove everything through the exact numeric callsign, regardless
       * of the fuzzy airline wording that preceded it.
       */
      return tokens.slice(j).join(' ').replace(/__TWO__/g,'TO').trim();
    }
  }
  return String(text||'').trim();
}
function normalizeQnhAliases(text){
  return String(text||'')
    /* SpeechRecognition commonly hears the aviation acronym QNH as
       "Q&H", and may split the letters into separate tokens. Keep these
       aliases deliberately narrow so unrelated commands are unaffected. */
    .replace(/\bQ\s*&\s*H\b/g,'QNH')
    .replace(/\bQ\s+AND\s+H\b/g,'QNH')
    .replace(/\bQ\s+N\s+H\b/g,'QNH')
    .replace(/\bQ\s+N\s*&\s*H\b/g,'QNH')
    .replace(/\bQ\s+H\b/g,'QNH')
    .replace(/\bQ\s+AND\b/g,'QNH');
}

function normalizeFixAliases(text){
  return String(text||'')
    .replace(/\bSEAGULLS?\b/g,'SIGUL')
    .replace(/\bSEA\s+GULL\b/g,'SIGUL')
    .replace(/\bSEAGUL\b/g,'SIGUL')
    .replace(/\bSIGULL\b/g,'SIGUL')
    .replace(/\bOLTJIN\b/g,'ODKIN')
    .replace(/\bOTKIN\b/g,'ODKIN')
    .replace(/\bATKIN\b/g,'ODKIN')
    .replace(/\bOLD\s+KIN\b/g,'ODKIN')
    .replace(/\bOT\s+KIN\b/g,'ODKIN')
    .replace(/\bAT\s+KIN\b/g,'ODKIN')
    .replace(/\bBAL\s+V(?:EE)?\b/g,'BALVI')
    .replace(/\bGOLKA\b/g,'KOLKA')
    .replace(/\bGOKHA\b/g,'KOLKA')
    .replace(/\bCOCA\b/g,'KOLKA')
    .replace(/\bKOLCA\b/g,'KOLKA')
    .replace(/\bDOBLE\b/g,'DOBEL')
    .replace(/\bDO\s+BEL\b/g,'DOBEL');
}

function qnhGlobalValue(){return typeof qnh==='number'?qnh:null;}

function parseSingleVoiceCommand(body,a){
  /* Normalize QNH aliases before generic AND cleanup. Otherwise
     "Q AND 1032" would become "Q 1032" and lose the pressure marker. */
  body=normalizeQnhAliases(body);
  body=String(body||'').replace(/\bAND\b/g,' ').replace(/\s+/g,' ').trim();
  body=normalizeFixAliases(body);

  /* Session-observed SpeechRecognition recovery. Keep these command-scoped. */
  body=body
    .replace(/^MAINTAINED\s+PRESENT\s+HEAD(?:ING)?$/,'MAINTAIN PRESENT HEADING')
    .replace(/^MAINTAIN\s+PRESENT\s+HEAD$/,'MAINTAIN PRESENT HEADING')
    .replace(/^MAINTAINED\s+PRESENT\s+HEAD$/,'MAINTAIN PRESENT HEADING')
    .replace(/^MAINTAIN\s+CURRENT\s+HEADING$/,'MAINTAIN PRESENT HEADING')
    .replace(/^MAINTAIN\s+YOUR\s+HEADING$/,'MAINTAIN PRESENT HEADING')
    .replace(/^CONTINUE\s+PRESENT\s+HEADING$/,'MAINTAIN PRESENT HEADING')
    .replace(/^CONTINUE\s+CURRENT\s+HEADING$/,'MAINTAIN PRESENT HEADING')
    .replace(/\b(SETTING|ADDING|RING|HANDING|REITERING|REITERATING|WRITING|RIDING)\b(?=\s+\d{1,3}\b)/g,'HEADING')
    .replace(/\bBEAT\s+(?=\d|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE)\b/g,'SPEED ')
    .replace(/\b(NAUGHT|NOUGHT|NOT|NAUGHTY)\b(?=\s*$)/g,'')
    .replace(/\bDESCEND\s+TO\s+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN)\b(?!\s+THOUSAND)/g,(m,n)=>'DESCEND TO '+n+' THOUSAND')
    .replace(/\bDESCEND\s+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN)\b(?!\s+THOUSAND)/g,(m,n)=>'DESCEND '+n+' THOUSAND')
    .replace(/\bDESCENT\s+(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN)\b(?!\s+THOUSAND)/g,(m,n)=>'DESCEND '+n+' THOUSAND');

  /* NEGATIVE is a readback-correction marker, not an aircraft instruction.
     Parse the instruction after it separately so the existing correction
     logic can compare that instruction with the pending readback. */
  const negative=/^NEGATIVE(?:\s+(.+))?$/.exec(body);
  if(negative){
    if(!negative[1])return {type:'negative',a,command:null};
    const command=parseSingleVoiceCommand(negative[1],a);
    return command.type==='invalid'
      ? {type:'invalid',reason:command.reason||'INVALID COMMAND',a}
      : {type:'negative',a,command};
  }

  let m;
  /* Maintain/continue present heading must be checked before generic
     MAINTAIN parsing so it can never be mistaken for altitude/speed. */
  if(/^(?:MAINTAIN|CONTINUE)\s+(?:THE\s+)?(?:PRESENT|CURRENT|YOUR)?\s*HEADING$/.test(body)||
     /^(?:MAINTAIN|CONTINUE)\s+(?:THE\s+)?HEADING$/.test(body)){
    return {type:'maintainHeading',a};
  }
  if(/^(?:MAINTAIN|CONTINUE)\s+(?:THE\s+)?(?:PRESENT|CURRENT|YOUR)?\s*SPEED$/.test(body)){
    return {type:'maintainSpeed',a};
  }
  if(/^(?:RESUME\s+)(?:OWN\s+)?(?:NAVIGATION|NAV)(?:\s+NOW)?$/.test(body)||
     /^RESUME\s+OWN\s+NAVIGATION\s+DIRECT$/.test(body)){
    return {type:'resumeNav',a};
  }

  /* Standalone 'flight level X' / 'fly level X' is a valid altitude
     assignment when SpeechRecognition omits CLIMB/DESCEND. Treat it as
     a maintain/assigned altitude instruction; validation still applies. */
  if((m=body.match(/^(?:FLIGHT\s+LEVEL|FL|FLY\s+LEVEL)\s+(.+)$/))){
    const value=parseVoiceValue('FLIGHT LEVEL '+m[1]);
    return {type:'altitude',a,value,direction:'maintain'};
  }

  /* Heading phrasing is intentionally tolerant because SpeechRecognition
     frequently turns "heading" into words such as "ring", "handing",
     "adding", or inserts filler between TURN LEFT/RIGHT and the value. */
  if((m=body.match(/^(?:(?:TURN\s+(?:LEFT|RIGHT))(?:\s+(?:AT|THERE|AND|IN|ON|SETTING|ADDING|HANDING|RING|EARNING|REITERING|REITERATING|WRITING|RIDING|THEN))*)?\s*(?:HEADING|TURN\s+HEADING|FLY\s+HEADING|TURNING|EARNING|REITERING|REITERATING|WRITING|RIDING)?\s*(?:TO\s+)?(.+?)(?:\s+(?:DEGREES?|DEG))?$/))){
    const hv=parseVoiceNumber(m[1]);
    if(hv!==null)return {type:'heading',a,value:hv};
  }

  /*
   * Altitude clearances may optionally contain a local pressure/QNH.
   * Extract QNH first so it can never become part of the altitude value.
   * Keep the existing altitude parser/value handling unchanged otherwise.
   */
  const extractAltitudeQnh=(raw)=>{
    let text=String(raw||'').replace(/\s+/g,' ').trim();
    let qnh=null;
    const qm=text.match(/\bQNH\s+(.+)$/);
    if(qm){
      qnh=parseVoiceValue(qm[1]);
      /* Recover an obviously truncated QNH only when the supplied digits
         are an exact prefix of the current session QNH. */
      if((qnh===null||qnh<950||qnh>1100)){
        const rawQ=String(qm[1]||'').replace(/\s+/g,'');
        const currentQ=String(qnhGlobalValue()).replace(/\D/g,'');
        if(rawQ.length>=2&&currentQ&&currentQ.startsWith(rawQ)){
          qnh=+currentQ;
        }
      }
      text=text.slice(0,qm.index).trim();
    }
    return {text,qnh};
  };
  if((m=body.match(/^(?:ALTITUDE\s+)?(?:DESCEND|DESCENT|DESCENDS|DESCENDED|DESCENDING)\s+(?:(?:TO|DOWN\s+TO)\s+)?(?:(?:ALTITUDE)\s+)?(.+)$/))){
    const p=extractAltitudeQnh(m[1]);
    return {type:'altitude',a,value:parseVoiceValue(p.text),direction:'descend',qnh:p.qnh};
  }
  if((m=body.match(/^(?:ALTITUDE\s+)?(?:CLIMB|CLIMBED|CLIMBING)\s+(?:(?:TO|UP\s+TO)\s+)?(?:(?:ALTITUDE)\s+)?(.+)$/))){
    const p=extractAltitudeQnh(m[1]);
    return {type:'altitude',a,value:parseVoiceValue(p.text),direction:'climb',qnh:p.qnh};
  }
  if((m=body.match(/(?:ALTITUDE|ALT)\s+(?:TO\s+)?(.+)$/))){
    const p=extractAltitudeQnh(m[1]);
    const value=parseVoiceValue(p.text);
    return {type:'altitude',a,value,direction:'maintain',qnh:p.qnh};
  }
  if((m=body.match(/(?:SPEED|REDUCE\s+SPEED|INCREASE\s+SPEED|SLOW\s+TO|MAINTAIN\s+SPEED)\s+(?:TO\s+)?(.+?)(?:\s+(?:KNOTS?|KNOTT|NOUGHT|NOT|NAUGHT|NAUGHTY|NODES?|NODE))?$/))){
    let rawSpeed=m[1].trim();
    /* Session-observed SpeechRecognition sometimes appends 0/9 to a
       three-digit speed (2509, 2209, 2009, 1809, 1800). Recover only in
       SPEED context and only when the first three digits are valid. */
    let sv=parseVoiceNumber(rawSpeed);
    if(sv!==null){
      const ds=String(sv);
      if(ds.length===4&&/^[0-9]{3}[09]$/.test(ds)){
        const candidate=+ds.slice(0,3);
        if(candidate>=100&&candidate<=350)sv=candidate;
      }
    }
    return {type:'speed',a,value:sv};
  }
  if(/^(?:WEATHER|INFORMATION|ATIS|WEATHER\s+INFORMATION|INFORMATION\s+WEATHER|ADVISE\s+WEATHER|PASS\s+WEATHER|GIVE\s+WEATHER|QNH)$/.test(body))return {type:'weather',a};
  if(/\b(?:CONTACT|HANDOFF|TRANSFER)\b.*\bTOWER\b/.test(body)||/\bTOWER\b.*\b(?:CONTACT|HANDOFF|TRANSFER)\b/.test(body))return {type:'tower',a};
  if(/\b(?:CONTACT|HANDOFF|TRANSFER)\b.*\bCENTER\b/.test(body)||/\bCENTER\b.*\b(?:CONTACT|HANDOFF|TRANSFER)\b/.test(body))return {type:'center',a};
  if(/\bILS\b/.test(body)){
    const clearILS=/\b(?:CLEAR|CLEARED)\b.*\bILS\b|\bILS\b.*\b(?:CLEAR|CLEARED)\b/.test(body);
    const directILS=/^ILS(?:\s+(?:RUNWAY|RWY)?\s*(.+))?$/.test(body);
    if(clearILS||directILS){
      const rm=body.match(/\b(?:RUNWAY|RWY)\s+(.+)$/);
      let runway=rm?parseVoiceNumber(rm[1]):null;
      if(runway===null){
        const im=body.match(/\bILS\s+(\S+(?:\s+\S+)*)$/);
        if(im){
          const candidate=parseVoiceNumber(im[1]);
          if(candidate!==null)runway=candidate;
        }
      }
      if(runway!==null&&![18,36].includes(runway)){
        const rs=String(runway);
        if(rs.length===3&&rs[0]==='1'&&[8,6].includes(+rs.slice(1)))runway=+rs.slice(1);
      }
      return {type:'ils',a,runway};
    }
  }
  if((m=body.match(/(?:DIRECT|PROCEED\s+DIRECT|FLY\s+DIRECT|GO\s+DIRECT)\s+(?:TO\s+)?([A-Z]{4,5})$/))){
    const fix=m[1];
    if(FX[fix])return {type:'direct',a,fix};
  }
  return {type:'invalid',reason:'INVALID COMMAND',a};
}

function voiceCommandStartPositions(body){
  const patterns=[
    /(?:^|\s)(?:MAINTAIN|CONTINUE)\s+(?:THE\s+)?(?:PRESENT|CURRENT|YOUR)?\s*HEADING(?=\s|$)/g,
    /(?:^|\s)RESUME\s+(?:OWN\s+)?(?:NAVIGATION|NAV)(?:\s+DIRECT|\s+NOW)?(?=\s|$)/g,
    /(?:^|\s)(?:TURN\s+(?:LEFT|RIGHT)\s+(?:AT|THERE|AND|IN|ON|SETTING|ADDING|HANDING|RING|EARNING|REITERING|REITERATING|WRITING|RIDING|THEN)\s+)*(?:HEADING|TURN\s+HEADING|FLY\s+HEADING|TURNING|EARNING|REITERING|REITERATING|WRITING|RIDING)(?=\s|$)/g,
    /(?:^|\s)(?:CLIMB|CLIMBED|CLIMBING|DESCEND|DESCENT|DESCENDS|DESCENDED|DESCENDING)(?=\s|$)/g,
    /(?:^|\s)(?:SPEED|REDUCE\s+SPEED|INCREASE\s+SPEED|SLOW\s+TO|MAINTAIN\s+SPEED)(?=\s|$)/g,
    /(?:^|\s)(?:DIRECT|PROCEED\s+DIRECT|FLY\s+DIRECT|GO\s+DIRECT)(?=\s|$)/g,
    /(?:^|\s)(?:CLEAR|CLEARED)\s+(?:FOR\s+)?ILS(?=\s|$)/g,
    /(?:^|\s)ILS(?=\s|$)/g,
    /(?:^|\s)(?:CONTACT|HANDOFF|TRANSFER)\s+(?:TOWER|CENTER)(?=\s|$)/g,
    /(?:^|\s)(?:TOWER|CENTER)\s+(?:CONTACT|HANDOFF|TRANSFER)(?=\s|$)/g,
    /(?:^|\s)(?:WEATHER|INFORMATION|ATIS|ADVISE\s+WEATHER|PASS\s+WEATHER|GIVE\s+WEATHER|QNH)(?=\s|$)/g
  ];
  const hits=[];
  for(const re of patterns){
    let m;
    while((m=re.exec(body))){
      const start=m.index+(m[0][0]===' '?1:0);
      hits.push({start,end:m.index+m[0].length});
    }
  }
  /* Prefer the earliest/longest recognized command and suppress nested
     matches such as ILS inside "CLEARED ILS" or HEADING inside
     "MAINTAIN PRESENT HEADING". */
  hits.sort((a,b)=>a.start-b.start||(b.end-a.end));
  const out=[];
  for(const h of hits){
    const prev=out[out.length-1];
    if(prev&&h.start<prev.end)continue;
    out.push(h);
  }
  return out.map(h=>h.start);
}


function parseVoiceCommand(text){
  let up=normalizeVoiceText(text);
  /* Callsign-only SpeechRecognition distortions observed in this session.
     These are anchored to the beginning of the utterance and require a
     following numeric callsign, so ordinary prose is unaffected. */
  up=up
    .replace(/^(?:9|NINE)\s+AIR(?=\s+\d)/,'RYANAIR')
    .replace(/^MARION\s+AIR(?=\s+\d)/,'RYANAIR')
    .replace(/^RIGHT\s+NOW(?=\s+\d)/,'RYANAIR')
    .replace(/^OR\s+AIR\s+BALTIC(?=\s+\d)/,'AIR BALTIC');
  const found=extractVoiceCallsign(up);
  if(found&&found.ambiguous)return {type:'invalid',reason:'AMBIGUOUS CALLSIGN',matches:found.matches};
  if(!found)return {type:'invalid',reason:'AIRCRAFT NOT FOUND'};
  const a=found;
  let body=stripVoiceCallsign(up,a).replace(/\bAND\b/g,' ').replace(/\s+/g,' ').trim();
  /* Remove observed SpeechRecognition filler only after a valid callsign. */
  body=body
    .replace(/^(?:A|ARE|I|R|RD|R\s+D|R\.\s*D\.)(?=\s+(?:DESCEND|DESCENT)\b)/,'')
    .replace(/^R\s+SENT\s+TO\s+/,'DESCEND TO ')
    .replace(/^RD\s+SENT\s+TO\s+/,'DESCEND TO ')
    .replace(/^R\.\s*SENT\s+TO\s+/,'DESCEND TO ')
    .replace(/\s+/g,' ').trim();
  if(!body)return {type:'invalid',reason:'INVALID COMMAND',a};

  const leadingNegative=/^NEGATIVE\s+(.+)$/i.exec(body);
  if(leadingNegative){
    /* Keep NEGATIVE attached to the first instruction while still allowing
       normal command splitting after it (e.g. NEGATIVE DESCEND 5000 SPEED 180). */
    const inner=leadingNegative[1].trim();
    const starts=voiceCommandStartPositions(inner);
    if(starts.length>1){
      const clauses=[];
      for(let i=0;i<starts.length;i++){
        const end=i+1<starts.length?starts[i+1]:inner.length;
        let clause=inner.slice(starts[i],end).replace(/\s+/g,' ').trim();
        clause=clause.replace(/^(?:AND)\s+/,'').trim();
        const parsed=parseSingleVoiceCommand(clause,a);
        clauses.push(parsed);
      }
      const first=clauses[0];
      if(first.type==='invalid')return first;
      clauses[0]={type:'negative',a,command:first};
      return {type:'compound',a,commands:clauses,body};
    }
    const parsed=parseSingleVoiceCommand(inner,a);
    return parsed.type==='invalid'
      ? parsed
      : {type:'negative',a,command:parsed};
  }

  const starts=voiceCommandStartPositions(body);
  if(starts.length>1){
    const clauses=[];
    for(let i=0;i<starts.length;i++){
      const end=i+1<starts.length?starts[i+1]:body.length;
      let clause=body.slice(starts[i],end).replace(/\s+/g,' ').trim();
      clause=clause.replace(/^(?:AND)\s+/,'').trim();
      const parsed=parseSingleVoiceCommand(clause,a);
      clauses.push(parsed);
    }
    const invalid=clauses.find(c=>c.type==='invalid');
    return {type:'compound',a,commands:clauses,body};
  }

  return parseSingleVoiceCommand(body,a);
}


function voiceLogPush(raw,alternatives,c,result,reason='',meta={}){
  const vals=c&&c.type!=='invalid'?{
    type:c.type||'',callsign:c.a?getSpokenCallsign(c.a.cs):'NOT FOUND',value:c.value??null,direction:c.direction||'',qnh:c.qnh??null,runway:c.runway??null,fix:c.fix||''
  }:{type:'',callsign:c&&c.a?getSpokenCallsign(c.a.cs):'NOT FOUND'};
  boundedPush(VOICE_LOG,{
    time:clk(),
    session:meta.session??voiceActiveSession,
    pttState:meta.pttState??voicePTTState,
    raw:String(raw||''),
    alternatives:(alternatives||[]).map(x=>typeof x==='string'?{text:x,confidence:null}:x),
    normalized:normalizeVoiceText(raw||''),
    parsed:vals,
    result,
    reason:reason||''
  },MAX_VOICE_LOG);
  renderVoiceLog();
}
function voiceLogEvent(result,reason='',meta={}){
  voiceLogPush('',[],{type:'event',a:null,value:null,direction:'',runway:null,fix:''},result,reason,meta);
}
const voiceLogText=()=>{
  if(!VOICE_LOG.length)return 'No voice commands recorded.';
  return VOICE_LOG.map((e,i)=>{
    const al=e.alternatives.length?e.alternatives.map((a,n)=>`${n+1}. "${a.text}"${a.confidence!==null&&a.confidence!==undefined?` (${Number(a.confidence).toFixed(2)})`:''}`).join('\n'):'—';
    const p=e.parsed||{};
    const values=[
      p.callsign?`CALLSIGN: ${p.callsign}`:'',
      p.type?`COMMAND: ${p.type.toUpperCase()}`:'',
      p.value!==null&&p.value!==undefined?`VALUE: ${p.value}`:'',
      p.direction?`DIRECTION: ${p.direction}`:'',
      p.qnh!==null&&p.qnh!==undefined?`QNH: ${p.qnh}`:'',
      p.runway!==null&&p.runway!==undefined?`RUNWAY: ${p.runway}`:'',
      p.fix?`FIX: ${p.fix}`:''
    ].filter(Boolean).join('\n');
    return `[${e.time}]\nPTT SESSION: #${e.session??'—'}\nPTT STATE AT RESULT: ${e.pttState||'—'}\nRAW: "${e.raw}"\nALTERNATIVES:\n${al}\nNORMALIZED:\n"${e.normalized}"\n${values||'PARSED: —'}\nRESULT: ${e.result}${e.reason?`\nREASON: ${e.reason}`:''}`;
  }).join('\n\n');
};
function renderVoiceLog(){
  const box=$('#voiceLogBox'),empty=$('#voiceLogEmpty');
  if(!box)return;
  const txt=voiceLogText();
  if(empty)empty.style.display=VOICE_LOG.length?'none':'block';
  box.textContent=txt;
}
function copyVoiceLog(){
  const txt=voiceLogText();
  navigator.clipboard?.writeText(txt).then(()=>voiceStatus('ready','VOICE LOG COPIED')).catch(()=>{
    const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();voiceStatus('ready','VOICE LOG COPIED');
  });
}
function downloadVoiceLog(){
  const blob=new Blob([voiceLogText()],{type:'text/plain;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`RIX_voice_log_${new Date().toISOString().replace(/[:.]/g,'-')}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function voiceFail(msgText){
  voicePending=false;voiceTranscript='';voiceFinal=false;
  voiceStatus('error','VOICE ERROR',msgText);logE(`VOICE ${msgText}`);msg('APP',`<span class="r">${msgText}</span>`);
  setTimeout(()=>{if(run&&!voiceListening)voiceStatus('standby','MIC STANDBY')},1800);
}
function voiceValidateCommand(c){
  const a=c?.a, voiceCs=a?getSpokenCallsign(a.cs):'AIRCRAFT';
  if(!c||c.type==='invalid')return c?.reason||'INVALID COMMAND';
  if(c.type==='heading'){
    if(c.value===null||c.value<0||c.value>360)return `${voiceCs} — INVALID HEADING`;
  }else if(c.type==='altitude'){
    if(c.value===null)return `${voiceCs} — INVALID ALTITUDE VALUE`;
    if(c.value<500||c.value>20000)return `${voiceCs} — INVALID ALTITUDE`;
    if(c.qnh!==null&&c.qnh!==undefined&&(c.qnh<950||c.qnh>1100))return `${voiceCs} — INVALID QNH`;
  }else if(c.type==='speed'){
    if(c.value===null||c.value<100||c.value>350)return `${voiceCs} — INVALID SPEED`;
  }else if(c.type==='direct'){
    if(!FX[c.fix]||a.twr||a.ctr)return `${voiceCs} — DIRECT NOT AVAILABLE`;
  }else if(c.type==='ils'){
    /* A pending runway selection is not operational yet. ILS clearances
       remain tied to the currently active runway until CONFIRM is pressed. */
    const required=RWN;
    if(c.runway!==null&&c.runway!==RWN)return `${voiceCs} — ILS RWY ${required} REQUIRED`;
    if(Math.hypot(a.x,a.y)>35)return `${voiceCs} — ILS NOT AVAILABLE YET`;
  }else if(c.type==='weather'){
    if(a.twr||a.ctr||a.ga)return `${voiceCs} — WEATHER INFORMATION NOT AVAILABLE`;
  }else if(c.type==='tower'){
    if(!a.handoffReady||a.twr||a.ctr||a.ga)return `${voiceCs} — TOWER HANDOFF NOT AVAILABLE`;
  }else if(c.type==='center'){
    if(!a.dep||a.alt<9000||a.ctr)return `${voiceCs} — CENTER HANDOFF NOT AVAILABLE`;
  }else if(c.type==='maintainHeading'||c.type==='maintainSpeed'||c.type==='resumeNav'){
    /* no additional validation required */
  }else if(c.type==='negative'){
    if(c.command){
      return voiceValidateCommand(c.command);
    }
    /* Standalone NEGATIVE is a valid acknowledgement/rejection marker.
       It does not alter aircraft state and cannot by itself clear a
       pending readback correction because no corrected instruction was given. */
  }else{
    return `${voiceCs} — INVALID COMMAND`;
  }
  return '';
}

function applyVoiceCommandImmediate(c){
  const a=c.a;
  if(c.type==='heading'){
    const hd=c.value===360?360:c.value;
    a.th=hd%360;a.mode='HDG';a.ils=a.loc=a.gs=0;
    if(a.flight){
      a.flight.resumeFix=a.flight.nextFix&&a.flight.nextFix!=='VECTORS'?a.flight.nextFix:(a.flight.resumeFix||a.flight.route?.[0]||'');
      a.flight.nextFix='VECTORS';
    }
    return `HEADING ${String(Math.round(hd)%360).padStart(3,'0')}`;
  }
  if(c.type==='altitude'){
    a.ta=c.value;a.readyDescentSent=false;
    if(c.qnh!==null&&c.qnh!==undefined)a.voiceQnh=c.qnh;
    const base=`${c.direction==='descend'?'DESCEND':c.direction==='climb'?'CLIMB':'MAINTAIN'} ${lv(c.value)}`;
    return c.qnh!==null&&c.qnh!==undefined?`${base} QNH ${c.qnh}`:base;
  }
  if(c.type==='speed'){
    /* Voice speed clearances change the aircraft's commanded/target speed,
       but must never change the controller's manually selected datablock
       speed.  Preserve the existing manual selection before updating ts. */
    if(a.assistSpd===null||a.assistSpd===undefined){
      a.assistSpd=Math.round(a.ts);
    }
    a.ts=c.value;
    return `SPEED ${c.value}`;
  }
  if(c.type==='direct'){
    a.fx=c.fix;a.mode='DCT';
    if(a.flight){a.flight.nextFix=c.fix;a.flight.resumeFix=''}
    return `DIRECT ${c.fix}`;
  }
  if(c.type==='ils'){
    const rwn=c.runway??RWN;
    /* During a pending runway change the controller may intentionally clear
       either runway. Store the runway actually cleared so the aircraft flies
       the approach that was spoken. */
    if(a.flight&&rwn){a.flight.runway=rwn;a.flight.approach='ILS '+rwn}
    a.ils=1;
    return `CLEARED ILS RUNWAY ${rwn}`;
  }
  if(c.type==='tower'){
    a.twr=1;a.position='TWR';a.owner='TWR';
    return 'CONTACT TOWER';
  }
  if(c.type==='center'){
    a.ctr=1;a.owner='CTR';
    return 'CONTACT CENTER';
  }
  if(c.type==='weather'){
    giveWeather(a);
    return 'WEATHER INFORMATION';
  }
  if(c.type==='maintainHeading'){
    /* Preserve the current heading and remain in vector/heading mode. */
    a.th=a.h;
    a.mode='HDG';
    if(a.flight){
      a.flight.resumeFix=a.flight.nextFix&&a.flight.nextFix!=='VECTORS'?a.flight.nextFix:(a.flight.resumeFix||a.flight.route?.[0]||'');
      a.flight.nextFix='VECTORS';
    }
    return `MAINTAIN PRESENT HEADING ${String(Math.round(a.h)%360).padStart(3,'0')}`;
  }
  if(c.type==='maintainSpeed'){
    a.ts=Math.max(100,Math.min(350,a.spd));
    return `MAINTAIN PRESENT SPEED ${Math.round(a.spd)}`;
  }
  if(c.type==='resumeNav'){
    if(a.flight&&a.flight.route){
      const next=a.flight.nextFix&&a.flight.nextFix!=='VECTORS'?a.flight.nextFix:
        (a.flight.resumeFix&&a.flight.resumeFix!=='VECTORS'?a.flight.resumeFix:a.flight.route.find(f=>f===a.fx)||a.flight.route.find(f=>f!==a.fx)||a.flight.route[0]);
      a.mode='NAV';
      if(next){a.fx=next;a.flight.nextFix=next}
      a.flight.resumeFix='';
    }else if(a.fx&&FX[a.fx]){
      a.mode='NAV';
    }
    return 'RESUME OWN NAVIGATION';
  }
  return '';
}

function executeVoiceCommand(text,meta={}){
  const c=parseVoiceCommand(text);
  const raw=meta.raw??voiceRawTranscript??text;
  const alternatives=meta.alternatives??voiceAlternatives;
  const session=meta.session??voiceActiveSession;
  const logMeta={session,pttState:meta.pttState??voicePTTState};
  const reject=reason=>{
    voiceLogPush(raw,alternatives,c,'REJECTED',reason,logMeta);
    voiceFail(reason);
  };
  if(c.type==='invalid'){
    reject(c.reason+(c.reason==='AIRCRAFT NOT FOUND'?'':c.a?` — ${getSpokenCallsign(c.a.cs)}`:''));
    return;
  }

  const a=c.a;
  sig='';
  const voiceCs=getSpokenCallsign(a.cs);
  const commands=c.type==='compound'?c.commands:[c];

  /* Atomic validation: never apply the first instruction if a later
     instruction in the same transmission is invalid. */
  for(const cmd of commands){
    const reason=voiceValidateCommand(cmd);
    if(reason){
      const label=c.type==='compound'
        ? `CLAUSE ${commands.indexOf(cmd)+1}/${commands.length} — ${reason}`
        : reason;
      reject(label);
      return;
    }
  }

  const results=[];
  for(const cmd of commands){
    if(cmd.type==='negative'){
      /* NEGATIVE alone is a valid no-op acknowledgement. If an instruction
         follows NEGATIVE, execute that instruction as the correction itself;
         it is not treated as a second/duplicate clearance. */
      if(cmd.command)results.push(applyVoiceCommandImmediate(cmd.command));
      else results.push('NEGATIVE');
    }else{
      results.push(applyVoiceCommandImmediate(cmd));
    }
  }

  /* One aircraft response for the entire voice transmission. Weather is
     already queued through the normal ATC issue/readback path, so do not
     generate a second synthetic pilot response for a weather-only command. */
  const response=results.filter(Boolean).join(', ');
  const weatherOnly=commands.length===1&&commands[0].type==='weather';
  const standaloneNegative=commands.length===1&&commands[0].type==='negative'&&!commands[0].command;
  if(response&&!weatherOnly&&!standaloneNegative){
    /* For NEGATIVE + instruction, the instruction text is the actual
       correction to compare against the pending incorrect readback. */
    checkReadbackCorrection(a,response);
    const prepared=preparePilotReadback(response,response);
    if(prepared.pending)a.readbackWatch=prepared.pending;
    msg(a.cs,`"${prepared.rb}, ${voiceCs}."`);
  }

  const parsedSummary=c.type==='compound'
    ? commands.map((cmd,i)=>`${i+1}. ${cmd.type.toUpperCase()}${cmd.value!==undefined&&cmd.value!==null?` ${cmd.value}`:''}${cmd.runway!==undefined&&cmd.runway!==null?` RWY ${cmd.runway}`:''}${cmd.fix?` ${cmd.fix}`:''}`).join(' | ')
    : response;

  voiceLogPush(raw,alternatives,c,'ACCEPTED',parsedSummary,logMeta);
  voiceStatus('ready','CMD ✓',`${voiceCs} ${response}`);
  logE(`VOICE ${raw} → ${response}`);
  setTimeout(()=>{if(run&&!voiceListening)voiceStatus('standby','MIC STANDBY')},2200);
}

function voiceMicStoredId(){
  try{return localStorage.getItem(VOICE_MIC_STORAGE_KEY)||''}catch(e){return ''}
}
function voiceMicSaveId(id){
  voiceMicDeviceId=String(id||'');
  try{if(voiceMicDeviceId)localStorage.setItem(VOICE_MIC_STORAGE_KEY,voiceMicDeviceId);else localStorage.removeItem(VOICE_MIC_STORAGE_KEY)}catch(e){}
}
function voiceMicTrackLive(){return !!voiceInputTrack&&voiceInputTrack.readyState==='live'}
function voiceMicStop(){
  try{voiceInputStream?.getTracks().forEach(t=>t.stop())}catch(e){}
  voiceInputStream=null;voiceInputTrack=null;
}
function voiceMicSetStatus(text,state=''){
  const el=$('#micStatus');
  if(!el)return;
  el.textContent=text;
  el.classList.remove('ok','warn','error');
  if(state)el.classList.add(state);
}
async function refreshVoiceInputDevices({requestPermission=true,silent=false}={}){
  if(!navigator.mediaDevices?.enumerateDevices){voiceMicSetStatus('UNAVAILABLE','error');return []}
  let tempStream=null;
  try{
    if(requestPermission){
      const needsLabels=!(await navigator.mediaDevices.enumerateDevices()).some(d=>d.kind==='audioinput'&&d.label);
      if(needsLabels)tempStream=await navigator.mediaDevices.getUserMedia({audio:true});
    }
    const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput');
    const select=$('#micSelect');
    if(select){
      const saved=voiceMicDeviceId||voiceMicStoredId();
      select.innerHTML='<option value="">System default microphone</option>'+devices.map((d,i)=>{
        const label=d.label||`Microphone ${i+1}`;
        const id=String(d.deviceId||'');
        if(!id||id==='default')return '';
        return `<option value="${id.replace(/"/g,'&quot;')}">${label.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</option>`;
      }).join('');
      if(saved&&devices.some(d=>d.deviceId===saved))select.value=saved;else if(saved)voiceMicSaveId('');
    }
    const selected=(voiceMicDeviceId||voiceMicStoredId());
    const found=selected?devices.find(d=>d.deviceId===selected):null;
    voiceMicSetStatus(found?String(found.label||'SELECTED').slice(0,24):'DEFAULT',found?'ok':'');
    return devices;
  }catch(e){
    if(!silent){voiceMicSetStatus('MIC ERROR','error');logE(`VOICE microphone enumeration failed — ${String(e?.message||e)}`)}
    return [];
  }finally{
    try{tempStream?.getTracks().forEach(t=>t.stop())}catch(e){}
  }
}
async function prepareVoiceInputDevice({force=false}={}){
  if(!navigator.mediaDevices?.getUserMedia)return false;
  if(!force&&voiceMicTrackLive())return true;
  const wanted=voiceMicDeviceId||voiceMicStoredId();
  const audio=wanted?{deviceId:{exact:wanted}}:true;
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio});
    const track=stream.getAudioTracks()[0];
    if(!track){stream.getTracks().forEach(t=>t.stop());throw new Error('No microphone track returned')}
    voiceMicStop();
    voiceInputStream=stream;
    voiceInputTrack=track;
    const actual=track.getSettings?.().deviceId||wanted||'';
    if(wanted&&actual&&actual!==wanted){voiceMicSaveId(actual)}
    await refreshVoiceInputDevices({requestPermission:false,silent:true});
    return true;
  }catch(e){
    if(wanted){
      voiceMicSaveId('');
      try{
        const stream=await navigator.mediaDevices.getUserMedia({audio:true});
        const track=stream.getAudioTracks()[0];
        if(track){voiceMicStop();voiceInputStream=stream;voiceInputTrack=track;await refreshVoiceInputDevices({requestPermission:false,silent:true});return true}
        stream.getTracks().forEach(t=>t.stop());
      }catch(e2){}
    }
    voiceMicSetStatus('MIC UNAVAILABLE','error');
    logE(`VOICE microphone setup failed — ${String(e?.message||e)}`);
    return false;
  }
}
async function selectVoiceInputDevice(deviceId){
  voiceMicSaveId(deviceId);
  voiceMicSetStatus('APPLYING…','warn');
  const ok=await prepareVoiceInputDevice({force:true});
  if(ok){
    const select=$('#micSelect');
    const option=select?.selectedOptions?.[0];
    voiceMicSetStatus(option?.textContent?.slice(0,24)||(!voiceMicDeviceId?'DEFAULT':'SELECTED'),'ok');
    if(!voiceListening)voiceStatus('ready','MIC READY',voiceMicDeviceId?'SELECTED MIC':'DEFAULT MIC');
  }
  return ok;
}

async function prepareVoiceRecognition(){
  if(!voiceRec)return false;
  if(voiceLocalReady)return true;
  if(voicePreparing){
    while(voicePreparing)await new Promise(r=>setTimeout(r,50));
    return voiceLocalReady;
  }

  voicePreparing=true;
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  try{
    /*
     * Chrome's normal Web Speech recognition is usually server based.
     * When the browser exposes the on-device API, use it instead so the
     * simulator does not depend on the remote speech service.
     */
    if(SR&&typeof SR.available==='function'&&typeof SR.install==='function'){
      let state='unavailable';
      try{
        state=await SR.available({langs:['en-US'],processLocally:true,quality:'command'});
      }catch(e){state='unavailable'}

      if(state==='available'){
        voiceRec.lang='en-US';
        if(!voiceListening&&'processLocally' in voiceRec)voiceRec.processLocally=true;
        voiceLocalReady=true;
        if(!voiceListening)voiceStatus('ready','MIC READY','ON-DEVICE');
        logE('VOICE on-device recognition ready');
      }else if(state==='downloadable'||state==='downloading'){
        voiceStatus('ready','VOICE SETUP','INSTALLING LOCAL SPEECH');
        let ok=false;
        try{
          ok=await SR.install({langs:['en-US'],processLocally:true,quality:'command'});
        }catch(e){ok=false}
        if(ok){
          voiceRec.lang='en-US';
          if(!voiceListening&&'processLocally' in voiceRec)voiceRec.processLocally=true;
          voiceLocalReady=true;
          if(!voiceListening)voiceStatus('ready','MIC READY','ON-DEVICE');
          logE('VOICE on-device language pack installed');
        }else{
          voiceStatus('error','VOICE SETUP','LOCAL SPEECH INSTALL FAILED');
          logE('VOICE on-device language pack install failed');
        }
      }else{
        /* This browser exposes the API but has no usable local model. */
        voiceRec.lang='en-US';
        if('processLocally' in voiceRec)voiceRec.processLocally=false;
        voiceStatus('ready','MIC READY','REMOTE SPEECH');
        logE('VOICE on-device recognition unavailable; remote fallback');
      }
    }else{
      /*
       * Older Chromium builds do not expose the on-device API. Keep the
       * normal recognition path, but use en-US which is broadly supported.
       */
      voiceRec.lang='en-US';
      voiceStatus('ready','MIC READY');
    }
  }catch(e){
    voiceRec.lang='en-US';
    if('processLocally' in voiceRec)voiceRec.processLocally=false;
    voiceStatus('ready','MIC READY');
  }finally{
    voicePreparing=false;
  }
  return voiceLocalReady||!!voiceRec;
}


function finalizeVoiceSession(session){
  if(!session||session!==voiceActiveSession||voiceSessionCompleted===session)return false;
  if(!voiceTranscript)return false;
  const t=voiceTranscript,raw=voiceRawTranscript,alts=voiceAlternatives.slice();
  clearTimeout(voiceCommandTimer);voiceCommandTimer=null;
  if(voiceSilenceTimer){clearTimeout(voiceSilenceTimer);voiceSilenceTimer=null;}
  voiceTranscript='';voiceRawTranscript='';voiceAlternatives=[];voicePending=false;
  voiceFinal=true;voiceSessionCompleted=session;
  voiceStatus('listening','HEARD',t);
  executeVoiceCommand(t,{raw,alternatives:alts,session,pttState:voicePTTState});
  voicePTT=false;
  voicePTTState='CLOSED';
  voiceSessionActive=false;
  voiceActiveSession=0;
  voiceRecognitionSession=0;
  try{if(voiceRec&&voiceListening)voiceRec.stop()}catch(e){}
  voiceStatus('standby','MIC STANDBY');
  return true;
}
function scheduleVoiceSilenceFinalize(session){
  if(voiceSilenceTimer)clearTimeout(voiceSilenceTimer);
  voiceSilenceTimer=setTimeout(()=>{
    voiceSilenceTimer=null;
    finalizeVoiceSession(session);
  },VOICE_SILENCE_TIMEOUT);
}

function initVoiceControl(){
  if(voicePermissionAttempted)return;
  voicePermissionAttempted=true;
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){voiceStatus('error','VOICE UNAVAILABLE');return}
  voiceSupported=true;
  try{
    voiceRec=new SR();
    voiceRec.lang='en-US';
    voiceRec.continuous=false;
    voiceRec.interimResults=true;
    voiceRec.maxAlternatives=5;

    voiceRec.onstart=()=>{
      voiceListening=true;
      if(voicePTTState==='CAPTURING')voiceStatus('listening','MIC ● LISTENING',voiceLocalReady?'ON-DEVICE':'REMOTE');
    };

    voiceRec.onresult=e=>{
      /*
       * SpeechRecognition is asynchronous. A result can arrive after ALT
       * release because the browser was already processing that utterance.
       * Accept it only when it belongs to the exact recognition session that
       * is still CAPTURING or FINALIZING. Never accept a CLOSED/stale session.
       */
      const eventSession=voiceRecognitionSession;
      const state=voicePTTState;
      if(!eventSession||eventSession!==voiceActiveSession||voiceSessionCompleted===eventSession||!['CAPTURING','FINALIZING'].includes(state)){
        logE(`VOICE RESULT DISCARDED — STALE/CLOSED SESSION #${eventSession||'—'}`);
        voiceLogPush('',[],{type:'invalid',a:null},'DISCARDED','SESSION CLOSED / STALE SESSION',{session:eventSession||voiceSessionId,pttState:'CLOSED'});
        return;
      }

      const options=[];
      for(let i=e.resultIndex;i<e.results.length;i++){
        const r=e.results[i];
        for(let j=0;j<r.length;j++){
          const raw=String(r[j]?.transcript||'').trim();
          const t=normalizeVoiceText(raw);
          if(t)options.push({text:t,raw,final:!!r.isFinal,confidence:Number(r[j]?.confidence)||0});
        }
      }
      if(!options.length)return;

      options.sort((x,y)=>{
        const px=parseVoiceCommand(x.text),py=parseVoiceCommand(y.text);
        const score=c=>c.type!=='invalid'?100+(c.a?20:0):0;
        return score(py)-score(px)||y.confidence-x.confidence;
      });
      const best=options.find(o=>parseVoiceCommand(o.text).type!=='invalid')||options[0];
      voiceAlternatives=options.map(o=>({text:o.raw,confidence:o.confidence,final:o.final}));
      voiceRawTranscript=best.raw;
      voiceTranscript=best.text;
      voiceFinal=options.some(o=>o.final);
      voicePending=!!voiceTranscript;
      voiceHasResult=true;
      /* Do not trust SpeechRecognition's isFinal as the end of the ATC
         utterance. Browsers can mark a result final after a very short pause.
         The simulator now waits for a full 2 seconds with no new speech. */
      voiceStatus('listening','LISTENING',voiceTranscript);
      scheduleVoiceSilenceFinalize(eventSession);
    };

    voiceRec.onerror=e=>{
      voiceListening=false;

      /*
       * An 'aborted' error is expected when stop() is called during
       * FINALIZING. Do not erase a pending transcript or close the session
       * before onresult/onend has had a chance to finish the in-flight result.
       */
      if(e.error==='aborted'){
        if(voicePTTState==='FINALIZING'){
          if(run)voiceStatus('standby','MIC FINALIZING');
          return;
        }
        if(voicePTTState==='CAPTURING'){
          voicePTTState='CLOSED';
          voiceSessionActive=false;
          voiceActiveSession=0;
          voiceRecognitionSession=0;
        }
        if(run&&!voicePTTState)voiceStatus('standby','MIC STANDBY');
        return;
      }

      voicePending=false;
      const errName=String(e.error||'UNKNOWN').toUpperCase();
      if(e.error==='not-allowed'||e.error==='service-not-allowed'){
        voiceStatus('error','VOICE UNAVAILABLE','MICROPHONE PERMISSION DENIED');
        logE('VOICE microphone permission denied');
      }else if(e.error==='network'){
        voiceStatus('error','VOICE NETWORK','REMOTE SPEECH UNAVAILABLE');
        logE(`VOICE network error — local=${voiceLocalReady?'yes':'no'}`);
      }else if(e.error==='language-not-supported'){
        voiceStatus('error','VOICE ERROR','LANGUAGE NOT SUPPORTED');
        logE('VOICE language not supported');
      }else{
        voiceStatus('error','VOICE ERROR',errName);
        logE(`VOICE error: ${errName}`);
      }
      voiceLogEvent('RECOGNITION ERROR',`SpeechRecognition error: ${errName}`,{session:voiceRecognitionSession||voiceActiveSession||voiceSessionId,pttState:voicePTTState});

      if(voicePTTState==='FINALIZING'){
        voicePTTState='CLOSED';
        voiceSessionActive=false;
        voiceSessionCompleted=voiceRecognitionSession;
        voiceActiveSession=0;
        voiceRecognitionSession=0;
      }else if(voicePTTState==='CAPTURING'){
        voicePTT=false;
        voicePTTState='CLOSED';
        voiceSessionActive=false;
        voiceSessionCompleted=voiceRecognitionSession;
        voiceActiveSession=0;
        voiceRecognitionSession=0;
      }
      voiceTone(false);
      clearTimeout(voiceCommandTimer);
      setTimeout(()=>{
        if(run&&!voiceListening&&!voicePTT)voiceStatus('standby','MIC STANDBY');
      },1800);
    };

    voiceRec.onend=()=>{
      voiceListening=false;

      /*
       * stop() can finish before the final result callback. If FINALIZING
       * still has no result, this session genuinely ended without speech.
       * If a transcript is pending, execute it exactly once.
       */
      if(voicePTTState==='FINALIZING'){
        const session=voiceRecognitionSession;
        if(voicePending&&voiceTranscript&&voiceSessionCompleted!==session){
          /* Recognition may end because of the browser's shorter internal
             silence threshold. Keep the session alive and let our 2-second
             debounce timer decide when the command is actually complete. */
          scheduleVoiceSilenceFinalize(session);
          voiceStatus('listening','LISTENING',voiceTranscript);
        }else if(!voiceHasResult){
          voiceLogPush('',[],{type:'invalid',a:null},'NO RESULT','PTT RELEASED BEFORE RESULT',{session,pttState:'FINALIZING'});
          logE(`PTT NO RESULT session #${session}`);
          voicePTTState='CLOSED';
          voiceSessionActive=false;
          voiceActiveSession=0;
          voiceRecognitionSession=0;
          voiceStatus('standby','MIC STANDBY');
        }
        return;
      }

      /*
       * If recognition naturally ends while ALT is still held, keep the
       * session alive. The user can release ALT and the accumulated final
       * result will then execute normally.
       */
      if(voicePTTState==='CAPTURING'){
        if(run)voiceStatus('listening',voicePending?'HEARD':'MIC READY');
        return;
      }

      if(voicePTTState==='CLOSED')voiceStatus('standby','MIC STANDBY');
    };

    voiceStatus('ready','MIC READY');
    /* Prepare the selected physical microphone so SpeechRecognition can be
       started with an explicit MediaStreamTrack instead of the OS default. */
    prepareVoiceInputDevice().catch(e=>logE(`VOICE microphone preparation failed — ${String(e?.message||e)}`));
    refreshVoiceInputDevices({requestPermission:false,silent:true}).catch(()=>{});
    /*
     * Warm up speech recognition while the simulation is starting rather than
     * waiting for ALT/PTT.  The Web Speech on-device availability check is
     * asynchronous; awaiting it inside the ALT key event can lose the browser's
     * user-activation context and cause recognition.start() to be rejected.
     */
    prepareVoiceRecognition().catch(e=>{
      logE(`VOICE preparation failed — ${String(e?.message||e)}`);
    });
  }catch(e){
    voiceSupported=false;
    voiceStatus('error','VOICE UNAVAILABLE');
  }
}


function startListening(){
  if(!run||!voiceSupported||voicePTTState==='CAPTURING'||voicePTT)return;
  if(sp===0){voiceStatus('error','VOICE PAUSED');setTimeout(()=>{if(run&&!voicePTT)voiceStatus('standby','MIC STANDBY')},900);return;}

  clearTimeout(voiceCommandTimer);
  voiceSessionId++;
  const session=voiceSessionId;
  voiceActiveSession=session;
  voiceRecognitionSession=session;
  voiceReleasedAt=0;
  voicePTT=true;
  voicePTTState='CAPTURING';
  voiceSessionActive=true;
  voiceSessionCompleted=0;
  voiceHasResult=false;
  voiceTranscript='';voiceRawTranscript='';voiceAlternatives=[];voiceFinal=false;voicePending=false;
  voiceTone(true);voiceStatus('listening','MIC ● LISTENING');
  logE(`PTT PRESS session #${session}`);
  voiceLogEvent('PTT PRESS','ALT PTT activated',{session,pttState:'CAPTURING'});

  /*
   * Do not await prepareVoiceRecognition() here. ALT/PTT is the user gesture
   * that must reach SpeechRecognition.start() directly. If local speech setup
   * is still running, use the normal remote recognition path for this
   * transmission; local preparation can finish for the next one.
   */
  if(voicePreparing){
    voiceRec.lang='en-US';
    if('processLocally' in voiceRec)voiceRec.processLocally=false;
    voiceStatus('listening','MIC ● LISTENING','REMOTE');
  }

  if(!voiceRec){
    voicePTT=false;
    voicePTTState='CLOSED';
    voiceSessionActive=false;
    voiceSessionCompleted=session;
    voiceActiveSession=0;
    voiceRecognitionSession=0;
    voiceTone(false);
    voiceStatus('error','VOICE UNAVAILABLE','SPEECH RECOGNITION NOT SUPPORTED');
    return;
  }

  try{
    if(voiceMicTrackLive())voiceRec.start(voiceInputTrack);
    else voiceRec.start();
  }catch(e){
    /*
     * Chrome can briefly keep the previous recognition instance in a
     * transitional state. Retry once while ALT is still held; never restart
     * after release and never create a restart loop.
     */
    const msg=String(e?.message||e);
    logE(`VOICE start failed — ${msg}`);
    voiceLogEvent('RECOGNITION START ERROR',msg,{session,pttState:'CAPTURING'});
    setTimeout(()=>{
      if(!run||!voicePTT||voicePTTState!=='CAPTURING'||session!==voiceActiveSession)return;
      try{
        if(voiceMicTrackLive())voiceRec.start(voiceInputTrack);
        else voiceRec.start();
        logE(`VOICE start retry — session #${session}`);
      }catch(e2){
        const msg2=String(e2?.message||e2);
        logE(`VOICE start retry failed — ${msg2}`);
        voiceLogEvent('RECOGNITION START RETRY ERROR',msg2,{session,pttState:'CAPTURING'});
        voicePTT=false;
        voicePTTState='CLOSED';
        voiceSessionActive=false;
        voiceSessionCompleted=session;
        voiceActiveSession=0;
        voiceRecognitionSession=0;
        voiceTone(false);
        voiceStatus('error','VOICE ERROR','LISTENING FAILED');
      }
    },120);
  }
}

function stopListening(){
  if(!voicePTT||voicePTTState!=='CAPTURING')return;

  const session=voiceActiveSession;
  voicePTT=false;
  voicePTTState='FINALIZING';
  voiceReleasedAt=performance.now();
  voiceTone(false);
  clearTimeout(voiceCommandTimer);voiceCommandTimer=null;
  logE(`PTT RELEASE session #${session} → FINALIZING`);

  /*
   * Stop accepting new speech immediately. SpeechRecognition may still emit
   * one result already in flight; onresult accepts it because this exact
   * session is now FINALIZING.
   */
  try{if(voiceRec&&voiceListening)voiceRec.stop()}catch(e){}

  if(voicePending&&voiceTranscript&&voiceSessionCompleted!==session){
    /* Keep the transcript alive until the full 2-second silence window has
       elapsed. A short browser-level pause must never cut the command off. */
    scheduleVoiceSilenceFinalize(session);
    voiceStatus('listening','LISTENING',voiceTranscript);
  }else{
    voiceStatus('listening','MIC FINALIZING');
  }
}

window.addEventListener('blur',()=>{
  const session=voiceActiveSession;
  if(voicePTT){
    logE(`PTT RELEASE session #${session} — WINDOW BLUR`);
    voiceLogEvent('PTT BLUR','Window lost focus; voice session closed',{session,pttState:'CLOSED'});
  }

  /*
   * Window blur is different from a normal ALT release: abort immediately
   * because the user is no longer interacting with the simulator. Never
   * execute a command after focus is lost.
   */
  voicePTT=false;
  voicePTTState='CLOSED';
  voiceSessionActive=false;
  voiceSessionCompleted=session||voiceSessionCompleted;
  voiceActiveSession=0;
  voiceRecognitionSession=0;
  voiceReleasedAt=performance.now();
  voiceTone(false);
  clearTimeout(voiceCommandTimer);voiceCommandTimer=null;
  if(voiceSilenceTimer){clearTimeout(voiceSilenceTimer);voiceSilenceTimer=null;}
  voicePending=false;
  voiceTranscript='';voiceRawTranscript='';voiceAlternatives=[];
  try{if(voiceRec&&voiceListening)voiceRec.abort()}catch(e){}
  voiceListening=false;
  if(run)voiceStatus('standby','MIC STANDBY');
});


window.addEventListener('keydown',e=>{
  if(!run)return;
  const tag=(e.target?.tagName||'').toLowerCase();
  if(['input','select','textarea'].includes(tag)||e.target?.isContentEditable)return;

  if(e.code==='AltLeft'||e.code==='AltRight'||e.key==='Alt'){
    e.preventDefault();
    if(!e.repeat)startListening();
    return;
  }

  if('124'.includes(e.key))setSp(+e.key);
  else if(e.key==='Escape')sel=null;
});

window.addEventListener('keyup',e=>{
  if(e.code==='AltLeft'||e.code==='AltRight'||e.key==='Alt'){
    e.preventDefault();
    stopListening();
  }
});
