/* ─────────────── VOICE CONTROL V2 ─────────────── */
let voiceSupported=false,voiceListening=false,voicePTT=false;
let voicePermissionAttempted=false,voiceTranscript='',voiceRawTranscript='',voiceFinal=false,voicePending=false,voiceSessionActive=false,voiceAlternatives=[],VOICE_LOG=[];
let voiceSessionId=0,voiceActiveSession=0,voiceRecognitionSession=0,voicePTTState='CLOSED',voiceSessionCompleted=0,voiceHasResult=false;
let voiceInputStream=null,voiceInputTrack=null,voiceMicDeviceId='',voiceAdapter=null,voiceController=null,voiceAttemptCandidates=[];
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

function voiceMicStoredId(){try{return localStorage.getItem(VOICE_MIC_STORAGE_KEY)||''}catch(e){return ''}}
function voiceMicSaveId(id){voiceMicDeviceId=String(id||'');try{if(voiceMicDeviceId)localStorage.setItem(VOICE_MIC_STORAGE_KEY,voiceMicDeviceId);else localStorage.removeItem(VOICE_MIC_STORAGE_KEY)}catch(e){}}
function voiceMicTrackLive(){return !!voiceInputTrack&&voiceInputTrack.readyState==='live'}
function voiceMicStop(){try{voiceInputStream?.getTracks().forEach(t=>t.stop())}catch(e){}voiceInputStream=null;voiceInputTrack=null}
function voiceMicSetStatus(text,state=''){const el=$('#micStatus');if(!el)return;el.textContent=text;el.classList.remove('ok','warn','error');if(state)el.classList.add(state)}
async function refreshVoiceInputDevices({requestPermission=false,silent=false}={}){if(!navigator.mediaDevices?.enumerateDevices){voiceMicSetStatus('UNAVAILABLE','error');return []}let temp=null;try{if(requestPermission){const b=await navigator.mediaDevices.enumerateDevices();if(!b.some(d=>d.kind==='audioinput'&&d.label))temp=await navigator.mediaDevices.getUserMedia({audio:true})}const ds=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput'),sel=$('#micSelect');if(sel){const saved=voiceMicDeviceId||voiceMicStoredId();sel.innerHTML='<option value="">System default microphone</option>'+ds.map((d,i)=>{const label=d.label||('Microphone '+(i+1)),id=String(d.deviceId||'');if(!id||id==='default')return '';return '<option value="'+id.replace(/"/g,'&quot;')+'">'+label.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))+'</option>'}).join('');if(saved&&!ds.some(d=>d.deviceId===saved)){const option=document.createElement('option');option.value=saved;option.textContent='Selected microphone unavailable';sel.appendChild(option)}if(saved)sel.value=saved}const selected=voiceMicDeviceId||voiceMicStoredId(),found=ds.find(d=>d.deviceId===selected);voiceMicSetStatus(selected?(found?String(found.label||'SELECTED').slice(0,24):'SELECTED MIC MISSING'):'DEFAULT',selected&&!found?'error':found?'ok':'');return ds}catch(e){if(!silent){voiceMicSetStatus('MIC ERROR','error');logE('VOICE microphone enumeration failed — '+String(e?.message||e))}return []}finally{try{temp?.getTracks().forEach(t=>t.stop())}catch(e){}}}
async function acquireVoiceAudio(session){if(!navigator.mediaDevices?.getUserMedia){if(voiceMicDeviceId||voiceMicStoredId())throw new Error('Selected microphone input is unavailable in this browser. Choose System default or use a browser with microphone track support.');return null}const wanted=voiceMicDeviceId||voiceMicStoredId();let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:wanted?{deviceId:{exact:wanted}}:true})}catch(e){const n=String(e?.name||'');if(n==='NotAllowedError'||n==='SecurityError')throw new Error('Microphone permission was denied. Allow microphone access in the browser and press ALT again.');if(n==='NotFoundError'||n==='OverconstrainedError')throw new Error(wanted?'Selected microphone is unavailable. Choose another microphone in Settings.':'No microphone was found.');throw new Error('Could not open microphone ('+(e?.message||n||'unknown error')+').')}const track=stream.getAudioTracks()[0];if(!track){stream.getTracks().forEach(t=>t.stop());throw new Error('No microphone audio track was returned.')}voiceInputStream=stream;voiceInputTrack=track;let cleaned=false;const cleanup=()=>{if(cleaned)return;cleaned=true;try{stream.getTracks().forEach(t=>t.stop())}catch(e){}if(voiceInputStream===stream){voiceInputStream=null;voiceInputTrack=null}};track.addEventListener?.('ended',()=>{if(voiceController?.current?.id===session.id&&!voiceController.current.finished){voiceController.cancel('selected microphone disconnected');voiceStatus('error','MIC DISCONNECTED','SELECTED INPUT ENDED');logE('VOICE microphone track ended — session #'+session.id)}},{once:true});return {track,selectedDevice:!!wanted,cleanup}}
async function selectVoiceInputDevice(id){if(voiceController?.current&&!voiceController.current.finished)cancelVoiceRecognition('microphone selection changed');voiceMicSaveId(id);voiceMicSetStatus('APPLYING…','warn');await refreshVoiceInputDevices({requestPermission:false,silent:true});const s=$('#micSelect'),o=s?.selectedOptions?.[0];voiceMicSetStatus(o?.textContent?.slice(0,24)||(!voiceMicDeviceId?'DEFAULT':'SELECTED'),'ok');if(voiceSupported)voiceStatus('ready','MIC READY',voiceMicDeviceId?'SELECTED MIC':'SYSTEM DEFAULT');return true}
function voiceCandidateFromEvent(event){const choices=[],results=Array.from(event.results||[]),max=Math.max(0,...results.map(r=>r.length||0));for(let j=0;j<max;j++){const parts=results.map(r=>r[j]||r[0]).filter(Boolean),raw=parts.map(x=>String(x.transcript||'').trim()).filter(Boolean).join(' '),text=normalizeVoiceText(raw);if(text)choices.push({raw,text,confidence:parts.reduce((n,x)=>n+(Number(x.confidence)||0),0)/parts.length,final:parts.length===results.length&&parts.every((x,i)=>!!results[i].isFinal)})}choices.sort((a,b)=>{const pa=parseVoiceCommand(a.text),pb=parseVoiceCommand(b.text),score=c=>c.type!=='invalid'?100+(c.a?20:0):0;return score(pb)-score(pa)||b.confidence-a.confidence});return {choices,best:choices.find(c=>parseVoiceCommand(c.text).type!=='invalid')||choices[0]||null,final:choices.some(c=>c.final)}}
function initVoiceControl(){if(voicePermissionAttempted)return;voicePermissionAttempted=true;voiceAdapter=window.createSpeechRecognitionAdapter?.(window)||null;voiceSupported=!!voiceAdapter?.supported;if(!voiceSupported){voiceStatus('error','VOICE UNAVAILABLE','BROWSER SPEECH RECOGNITION NOT SUPPORTED');logE('VOICE recognition unavailable — SpeechRecognition/webkitSpeechRecognition not exposed by this browser');voiceLogEvent('UNAVAILABLE','This browser does not expose a supported speech recognition API.',{pttState:'CLOSED'});refreshVoiceInputDevices({requestPermission:false,silent:true}).catch(()=>{});return}voiceController=window.createPttRecognitionController({adapter:voiceAdapter,acquireAudio:acquireVoiceAudio,maxRetries:1,retryDelayMs:180,releaseWaitMs:1600,finalSettleMs:250,
 startRecognition(engine,audio){if(!audio?.track){engine.start();return}try{engine.start(audio.track)}catch(e){if(audio.selectedDevice)throw new Error('This browser cannot use the selected microphone with speech recognition. Choose System default or use a browser that supports recognition from a microphone track.');audio.cleanup?.();logE('VOICE browser rejected microphone-track start; retrying with browser default input');engine.start()}},
 onState(state,session,d={}){voicePTTState=state;voiceSessionActive=!!session&&!['CLOSED','ERROR'].includes(state);voicePTT=!!session?.held&&!session.finished;voiceListening=!!d.listening&&voicePTT;voiceActiveSession=voiceSessionActive?session.id:0;voiceRecognitionSession=voiceActiveSession;if(session)voiceSessionId=Math.max(voiceSessionId,session.id);if(state==='REQUESTING')voiceStatus('listening','MIC REQUESTING','WAITING FOR PERMISSION');else if(state==='CAPTURING')voiceStatus('listening',d.listening?'MIC ● LISTENING':d.resultReady?'MIC RESULT READY':'MIC STARTING');else if(state==='RETRYING'){voiceListening=false;voiceStatus('listening','MIC RETRYING','RETRYING ONCE');logE('VOICE retry '+(d.attempt||'')+' — '+(d.reason||''));voiceLogEvent('RECOGNITION RETRY',String(d.reason||''),{session:session?.id,pttState:state})}else if(state==='FINALIZING'){voiceListening=false;voiceTone(false);voiceStatus('listening','MIC FINALIZING',d.waitingForResult?'WAITING FOR FINAL RESULT':'PROCESSING FINAL RESULT')}else if(state==='CLOSED'||state==='ERROR'){voiceListening=false;voicePTT=false;voiceSessionActive=false;voiceActiveSession=0;voiceRecognitionSession=0;voiceTone(false);if(d.reason)logE('VOICE '+(state==='ERROR'?'error':'closed')+' — '+d.reason)}},
 onResult(event,session){const p=voiceCandidateFromEvent(event),b=p.best;if(!b)return {hasResult:false,final:false};voiceAttemptCandidates=p.choices;voiceTranscript=b.text;voiceRawTranscript=b.raw;voiceAlternatives=p.choices.map(c=>({text:c.raw,confidence:c.confidence,final:c.final}));voiceHasResult=true;voicePending=true;voiceFinal=p.final;voiceStatus('listening',session.released?'MIC FINALIZING':'MIC ● LISTENING',b.text);return {hasResult:true,final:p.final}},
 onComplete(session){const a=voiceAttemptCandidates.slice(),b=a.find(c=>c.final&&parseVoiceCommand(c.text).type!=='invalid')||a.find(c=>c.final);if(!b){voiceLogPush('',[],{type:'invalid',a:null},'NO RESULT','FINAL RESULT CONTAINED NO USABLE TRANSCRIPT',{session:session.id,pttState:'CLOSED'});return}voiceSessionCompleted=session.id;voicePending=false;executeVoiceCommand(b.text,{raw:b.raw,alternatives:a.map(c=>({text:c.raw,confidence:c.confidence,final:c.final})),session:session.id,pttState:'CLOSED'});voiceStatus('standby','MIC STANDBY')},
 onFailure(reason,session){voiceListening=false;voicePTT=false;voiceSessionActive=false;voicePending=false;if(session){voiceSessionCompleted=session.id;voiceLogPush(voiceRawTranscript,voiceAlternatives,{type:'invalid',a:null},'NO RESULT',reason,{session:session.id,pttState:session.state})}const low=String(reason||'').toLowerCase(),label=/permission|denied/.test(low)?'MIC PERMISSION':/not supported|cannot use the selected microphone|unavailable in this browser/.test(low)?'MIC UNAVAILABLE':/network/.test(low)?'SPEECH NETWORK ERROR':/no final speech|no speech/.test(low)?'NO SPEECH':'VOICE ERROR';voiceStatus('error',label,reason||'RECOGNITION FAILED');logE('VOICE recognition failed — '+reason);voiceLogEvent('RECOGNITION ERROR',String(reason||'unknown'),{session:session?.id,pttState:session?.state||'ERROR'});voicePTTState='ERROR';voiceTranscript='';voiceRawTranscript='';voiceAlternatives=[];voiceAttemptCandidates=[]}});
 voiceStatus('ready','MIC READY','BROWSER SPEECH RECOGNITION');logE('VOICE recognition API available — '+voiceAdapter.apiName+'; speech service and network availability depend on browser');refreshVoiceInputDevices({requestPermission:false,silent:true}).catch(()=>{});if(navigator.mediaDevices?.addEventListener&&!voiceDeviceChangeHandler){voiceDeviceChangeHandler=()=>{const selected=voiceMicDeviceId||voiceMicStoredId();refreshVoiceInputDevices({requestPermission:false,silent:true}).then(ds=>{if(selected&&!ds.some(d=>d.deviceId===selected)){if(voiceController?.current&&!voiceController.current.finished)cancelVoiceRecognition('selected microphone disconnected');voiceMicSetStatus('SELECTED MIC MISSING','error');voiceStatus('error','MIC DISCONNECTED','SELECT AN AVAILABLE INPUT');logE('VOICE selected microphone disconnected')}})};navigator.mediaDevices.addEventListener('devicechange',voiceDeviceChangeHandler)}}
function startListening(){if(!run||!voiceSupported||!voiceController)return;if(sp===0){voiceStatus('error','VOICE PAUSED');setTimeout(()=>{if(run&&!voicePTT)voiceStatus('standby','MIC STANDBY')},900);return}if(voiceController.current&&!voiceController.current.finished)return;voiceTranscript='';voiceRawTranscript='';voiceAlternatives=[];voiceAttemptCandidates=[];voiceFinal=false;voicePending=false;voiceHasResult=false;voiceTone(true);logE('PTT PRESS session #'+(voiceSessionId+1));voiceLogEvent('PTT PRESS','ALT PTT activated',{session:voiceSessionId+1,pttState:'REQUESTING'});voiceController.press().catch(e=>{voiceTone(false);voiceStatus('error','VOICE ERROR',String(e?.message||e));logE('VOICE start failed — '+(e?.message||e))})}
function stopListening(){if(!voiceController?.current?.held)return;const id=voiceController.current.id;logE('PTT RELEASE session #'+id+' → FINALIZING');voiceLogEvent('PTT RELEASE','ALT PTT released',{session:id,pttState:'FINALIZING'});voiceController.release()}
function cancelVoiceRecognition(reason='cancelled'){const id=voiceController?.current?.id||voiceActiveSession;if(voiceController?.current&&!voiceController.current.finished)voiceController.cancel(reason);voiceMicStop();voicePTT=false;voiceListening=false;voiceSessionActive=false;voiceActiveSession=0;voiceRecognitionSession=0;voicePTTState='CLOSED';voicePending=false;voiceTranscript='';voiceRawTranscript='';voiceAlternatives=[];voiceAttemptCandidates=[];voiceTone(false);if(id)logE('VOICE session #'+id+' cancelled — '+reason)}
function onVoiceFocusLoss(reason='window focus lost'){if(voiceController?.current&&!voiceController.current.finished){const id=voiceController.current.id;voiceLogEvent('PTT CANCELLED',reason,{session:id,pttState:'CLOSED'});cancelVoiceRecognition(reason);if(run)voiceStatus('standby','MIC STANDBY')}}
window.addEventListener('blur',()=>onVoiceFocusLoss('window lost focus'));window.addEventListener('pagehide',()=>onVoiceFocusLoss('page exited'));document.addEventListener?.('visibilitychange',()=>{if(document.visibilityState==='hidden')onVoiceFocusLoss('page hidden')});window.addEventListener('keydown',e=>{if(!run)return;const tag=(e.target?.tagName||'').toLowerCase();if(['input','select','textarea'].includes(tag)||e.target?.isContentEditable)return;if(e.code==='AltLeft'||e.code==='AltRight'||e.key==='Alt'){e.preventDefault();if(!e.repeat)startListening();return}if('124'.includes(e.key))setSp(+e.key);else if(e.key==='Escape')sel=null});window.addEventListener('keyup',e=>{if(e.code==='AltLeft'||e.code==='AltRight'||e.key==='Alt'){e.preventDefault();stopListening()}});
