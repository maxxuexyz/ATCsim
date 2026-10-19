/* Browser boundary for the non-uniform Web Speech API and serialized PTT runs. */
(function(root,factory){
  const api=factory();
  root.createSpeechRecognitionAdapter=api.createSpeechRecognitionAdapter;
  root.createPttRecognitionController=api.createPttRecognitionController;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis,function(){
  function createSpeechRecognitionAdapter(host=globalThis){
    const Constructor=host.SpeechRecognition||host.webkitSpeechRecognition||null;
    const apiName=host.SpeechRecognition?'SpeechRecognition':host.webkitSpeechRecognition?'webkitSpeechRecognition':null;
    return {
      supported:typeof Constructor==='function',
      apiName,
      onDeviceApiAvailable:!!(Constructor&&typeof Constructor.available==='function'),
      create({lang='en-US',continuous=false,interimResults=true,maxAlternatives=5,processLocally=false,handlers={}}={}){
        if(typeof Constructor!=='function')throw new Error('Speech recognition is not supported by this browser.');
        const recognition=new Constructor();
        recognition.lang=lang;
        recognition.continuous=continuous;
        recognition.interimResults=interimResults;
        recognition.maxAlternatives=maxAlternatives;
        if(processLocally&&'processLocally' in recognition)recognition.processLocally=true;
        recognition.onstart=event=>handlers.start?.(event);
        recognition.onresult=event=>handlers.result?.(event);
        recognition.onerror=event=>handlers.error?.(event);
        recognition.onend=event=>handlers.end?.(event);
        return {
          start(track){if(track)recognition.start(track);else recognition.start()},
          stop(){recognition.stop()},
          abort(){recognition.abort()},
          raw:recognition
        };
      }
    };
  }

  function createPttRecognitionController({
    adapter,acquireAudio,onState=()=>{},onResult=()=>({}),onComplete=()=>{},onFailure=()=>{},
    startRecognition=(engine,audio)=>engine.start(audio?.track),maxRetries=1,retryDelayMs=180,
    releaseWaitMs=1400,finalSettleMs=220
  }){
    let sequence=0,current=null;
    const clearTimer=(session,key)=>{if(session?.[key]){clearTimeout(session[key]);session[key]=null}};
    const active=session=>current===session&&!session.cancelled&&!session.finished;
    const state=(session,value,detail={})=>{if(!active(session))return;session.state=value;onState(value,session,detail)};
    const cleanupAudio=session=>{try{session.audio?.cleanup?.()}catch(e){}session.audio=null};
    const finish=(session,success,reason='')=>{
      if(!active(session))return false;
      session.finished=true;session.state=success?'CLOSED':'ERROR';
      for(const key of ['retryTimer','releaseTimer','settleTimer'])clearTimer(session,key);
      try{if(session.engine&&!success)session.engine.abort()}catch(e){}
      session.engine=null;cleanupAudio(session);
      if(success)onComplete(session);else onFailure(reason,session);
      onState(session.state,session,{reason});
      return true;
    };
    const scheduleFinish=(session)=>{
      clearTimer(session,'releaseTimer');
      session.releaseTimer=setTimeout(()=>finish(session,session.finalSeen,session.finalSeen?'':'No final speech result was received.'),releaseWaitMs);
    };
    const retry=(session,reason)=>{
      if(!active(session)||!session.held||session.finalSeen||session.retries>=maxRetries)return false;
      session.retries++;
      try{session.engine?.abort()}catch(e){}
      session.engine=null;
      state(session,'RETRYING',{reason,attempt:session.retries});
      clearTimer(session,'retryTimer');
      session.retryTimer=setTimeout(()=>{
        session.retryTimer=null;
        if(!active(session)||!session.held)return;
        startAttempt(session);
      },retryDelayMs);
      return true;
    };
    const startAttempt=session=>{
      if(!active(session)||!session.held)return;
      session.attempts++;
      const attemptId=session.attempts;
      const sameAttempt=()=>active(session)&&session.attempts===attemptId;
      let engine;
      try{
        engine=adapter.create({handlers:{
          start:event=>{if(sameAttempt()&&session.held)state(session,'CAPTURING',{attempt:attemptId,listening:true})},
          result:event=>{
            if(!sameAttempt())return;
            const summary=onResult(event,session)||{};
            session.hasResult=!!summary.hasResult||session.hasResult;
            session.finalSeen=!!summary.final||session.finalSeen;
            if(session.released&&session.finalSeen){
              clearTimer(session,'releaseTimer');
              clearTimer(session,'settleTimer');
              session.settleTimer=setTimeout(()=>finish(session,true),finalSettleMs);
            }else if(session.held&&session.hasResult){
              state(session,'CAPTURING',{attempt:attemptId,listening:true,resultReady:true});
            }
          },
          error:event=>{
            if(!sameAttempt())return;
            const code=String(event?.error||'unknown').toLowerCase();
            if(code==='aborted'&&(session.cancelled||session.released))return;
            if(session.released){if(!session.finalSeen)scheduleFinish(session);return}
            if(['no-speech','network'].includes(code)&&!session.finalSeen){retry(session,code);return}
            finish(session,false,code==='not-allowed'||code==='service-not-allowed'
              ?'Microphone or speech recognition permission was denied.'
              :code==='audio-capture'?'The selected microphone is unavailable.':`Speech recognition failed (${code}).`);
          },
          end:()=>{
            if(!sameAttempt())return;
            session.engine=null;
            if(session.released){
              if(session.finalSeen){clearTimer(session,'releaseTimer');clearTimer(session,'settleTimer');session.settleTimer=setTimeout(()=>finish(session,true),finalSettleMs)}
              else scheduleFinish(session);
              return;
            }
            if(!session.hasResult){retry(session,'recognition ended before returning a result');return}
            state(session,'CAPTURING',{attempt:attemptId,listening:false,resultReady:true});
          }
        }});
        session.engine=engine;
        state(session,'CAPTURING',{attempt:session.attempts,listening:false});
        startRecognition(engine,session.audio);
      }catch(error){
        session.engine=null;
        if(!retry(session,String(error?.message||error)))finish(session,false,String(error?.message||error));
      }
    };
    const press=async()=>{
      if(!adapter?.supported) {onFailure('Speech recognition is not supported by this browser.',null);return false}
      if(current&&!['CLOSED','ERROR'].includes(current.state))return false;
      const session={id:++sequence,state:'REQUESTING',held:true,released:false,cancelled:false,finished:false,
        retries:0,attempts:0,hasResult:false,finalSeen:false,engine:null,audio:null,retryTimer:null,releaseTimer:null,settleTimer:null};
      current=session;state(session,'REQUESTING');
      try{session.audio=await acquireAudio(session)}catch(error){
        if(active(session))finish(session,false,String(error?.message||error));
        return false;
      }
      if(!active(session)||!session.held){cleanupAudio(session);if(active(session))finish(session,false,'PTT released before microphone access completed.');return false}
      startAttempt(session);return true;
    };
    const release=()=>{
      const session=current;
      if(!active(session)||!session.held)return false;
      session.held=false;session.released=true;
      state(session,'FINALIZING',{waitingForResult:!session.finalSeen});
      clearTimer(session,'retryTimer');
      if(session.engine){try{session.engine.stop()}catch(e){} scheduleFinish(session)}
      else if(session.state==='REQUESTING')scheduleFinish(session);
      else if(session.finalSeen)finish(session,true);
      else finish(session,false,'No speech was captured.');
      return true;
    };
    const cancel=(reason='cancelled')=>{
      const session=current;if(!active(session))return false;
      session.cancelled=true;session.finished=true;session.state='CLOSED';
      for(const key of ['retryTimer','releaseTimer','settleTimer'])clearTimer(session,key);
      try{session.engine?.abort()}catch(e){}
      session.engine=null;cleanupAudio(session);current=null;
      onState('CLOSED',session,{reason,cancelled:true});return true;
    };
    return {press,release,cancel,get state(){return current?.state||'CLOSED'},get current(){return current}};
  }

  return {createSpeechRecognitionAdapter,createPttRecognitionController};
});
