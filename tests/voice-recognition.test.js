const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {createSpeechRecognitionAdapter,createPttRecognitionController}=require('../js/voice/recognition-adapter.js');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('detects standard, prefixed, and unavailable recognition APIs',()=>{
 class Standard{};class Prefixed{};
 assert.equal(createSpeechRecognitionAdapter({SpeechRecognition:Standard}).supported,true);
 assert.equal(createSpeechRecognitionAdapter({webkitSpeechRecognition:Prefixed}).apiName,'webkitSpeechRecognition');
 assert.equal(createSpeechRecognitionAdapter({}).supported,false);
});
test('release accepts a late final result and completes exactly once',async()=>{
 const engines=[];const events=[];const adapter={supported:true,create({handlers}){const e={handlers,start(){},stop(){},abort(){}};engines.push(e);return e}};
 const c=createPttRecognitionController({adapter,acquireAudio:async()=>null,onResult:()=>({hasResult:true,final:true}),onComplete:s=>events.push(s.id),finalSettleMs:5,releaseWaitMs:100});
 await c.press();c.release();engines[0].handlers.result({});await delay(20);
 assert.deepEqual(events,[1]);assert.equal(c.state,'CLOSED');
});
test('release during microphone permission wait prevents start and closes late tracks',async()=>{
 let resolveAudio,started=0,stopped=0,complete=0;
 const adapter={supported:true,create(){return {start(){started++},stop(){},abort(){}}}};
 const c=createPttRecognitionController({adapter,acquireAudio:()=>new Promise(r=>resolveAudio=r),onComplete:()=>complete++,releaseWaitMs:100});
 const pressing=c.press();c.release();resolveAudio({track:{},cleanup(){stopped++}});await pressing;await delay(5);
 assert.equal(started,0);assert.equal(stopped,1);assert.equal(complete,0);
});
test('recovery is bounded and stops after PTT release',async()=>{
 const engines=[];let completed=0;
 const adapter={supported:true,create({handlers}){const e={handlers,start(){},stop(){},abort(){}};engines.push(e);return e}};
 const c=createPttRecognitionController({adapter,acquireAudio:async()=>null,maxRetries:1,retryDelayMs:5,onComplete:()=>completed++});
 await c.press();engines[0].handlers.error({error:'no-speech'});c.release();await delay(20);
 assert.equal(engines.length,1);assert.equal(completed,0);assert.equal(c.state,'ERROR');
});
test('old attempt end events cannot change the retried attempt state',async()=>{
 const engines=[];const adapter={supported:true,create({handlers}){const e={handlers,start(){},stop(){},abort(){}};engines.push(e);return e}};
 const c=createPttRecognitionController({adapter,acquireAudio:async()=>null,maxRetries:1,retryDelayMs:1});
 await c.press();engines[0].handlers.error({error:'network'});await delay(10);assert.equal(engines.length,2);
 engines[0].handlers.end();assert.equal(c.state,'CAPTURING');c.cancel();
});
test('parser compatibility retains callsign alias and normalized descent command',()=>{
 const source=require('fs').readFileSync(require.resolve('../js/voice/voice.js'),'utf8');
 const sandbox={window:{addEventListener(){}},document:{addEventListener(){},visibilityState:'visible'},navigator:{},localStorage:{getItem(){return null}},console,setTimeout,clearTimeout,performance:{now:()=>0}};
 vm.createContext(sandbox);vm.runInContext(source+';globalThis.__voiceTest={normalizeVoiceText,parseVoiceCommand};',sandbox);
 sandbox.ac=[{cs:'BT123'}];sandbox.FX={};sandbox.RWN=18;
 const {normalizeVoiceText,parseVoiceCommand}=sandbox.__voiceTest;
 assert.equal(normalizeVoiceText('Aerobatic 123 descend through five thousand'),'AIR BALTIC 123 DESCEND TO FIVE THOUSAND');
 const parsed=parseVoiceCommand('AEROBATIC 123 DESCEND THROUGH FIVE THOUSAND');
 assert.equal(parsed.type,'altitude');assert.equal(parsed.a.cs,'BT123');
});
