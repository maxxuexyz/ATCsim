function mk(o){const t=TY[o.t],a=Object.assign({id:++id,x:0,y:0,h:0,alt:0,spd:0,vs:0,mode:'HDG',th:0,ta:0,ts:250,fx:'',ils:0,loc:0,gs:0,twr:0,ctr:0,dep:0,emg:0,eng:0,ga:0,ga0:0,ra:null,tr:[],tt:0,s:99,t0:T,fl:0,cl:t.c,dn:t.d,owner:'APP',position:'APP',handoffReady:false,lx:null,ly:null,labelManual:false,labelOffset:null,readyDescentSent:false,assistAlt:null,assistSpd:null,readbackWatch:null},o);a.ty=t;ac.push(a);return a}

const spawnLastArr={},spawnLastDep={};
const surfaceDemoTraffic=[];
function seedSurfaceDemoTraffic(){
 surfaceDemoTraffic.length=0;
 const stands=(RIX_SURFACE_MAP.aprons||[]).flatMap(apron=>apron.stands||[]).slice().sort(()=>Math.random()-.5),chosen=[];
 for(const stand of stands){
   if(chosen.every(other=>Math.hypot(stand.to[0]-other.to[0],stand.to[1]-other.to[1])>=9))chosen.push(stand);
   if(chosen.length===4)break;
 }
 const mix=chosen.map((_,i)=>i<Math.ceil(chosen.length/2)).sort(()=>Math.random()-.5);
 chosen.forEach((stand,i)=>{
   const dep=mix[i],entry=pick(dep?RIX_DEP:RIX_ARR),fix=pick(entry.x),t=pick(entry.t),proc=(dep?SIDS:STARS)[RWN][fix],route=proc.r;
   const heading=stand.to[1]<stand.from[1]?180:0;
   surfaceDemoTraffic.push({
     id:`SURFACE-${stand.id}`,cs:entry.c+(100+Math.random()*899|0),t,ty:TY[t],dep:dep?1:0,
     owner:'GND',position:'GND',alt:0,spd:0,h:heading,ta:0,ts:0,mode:'GROUND',
     surface:{node:`DEMO_STAND_${stand.id}`,x:stand.from[0]+(stand.to[0]-stand.from[0])*.82,y:stand.from[1]+(stand.to[1]-stand.from[1])*.82,stand:stand.id,status:dep?'parked':'parked-arrival',designOnly:1,labelOffset:null},
     flight:dep
       ?{type:'DEPARTURE',origin:'RIX',destination:entry.d,procedure:proc.n,route,nextFix:route[0],runway:RWN}
       :{type:'ARRIVAL',origin:entry.o,destination:'RIX',procedure:proc.n,route,nextFix:route[0],runway:RWN,approach:'ILS '+RWN}
   });
 });
}
const availableSurfaceStand=(exclude=null)=>RIX_SURFACE_LAYOUT.stands.find(s=>!ac.some(a=>a!==exclude&&a.surface&&(a.surface.stand===s.id||a.surface.destinationStand===s.id)))||null;
const SPAWN_GAP_A=[300,210,145,100];
const SPAWN_GAP_D=[360,255,175,120];
const chooseTrafficEntry=(list,lastMap,gap)=>{
  const eligible=list.filter(f=>{
    const key=f.x[0];
    return T-(lastMap[key]??-Infinity)>=gap;
  });
  const pool=(eligible.length?eligible:list.slice().sort((a,b)=>(lastMap[a.x[0]]??-Infinity)-(lastMap[b.x[0]]??-Infinity)).slice(0,Math.min(3,list.length)));
  const fData=pick(pool);
  const ef=pick(fData.x);
  lastMap[ef]=T;
  return {fData,ef};
};
function arr(r=rnd(50,60)){const {fData,ef}=chooseTrafficEntry(RIX_ARR,spawnLastArr,SPAWN_GAP_A[lvl]),entryFix=FX[ef],proc=STARS[RWN][ef],rt=proc.r;
const t=pick(fData.t),b=(entryFix.b+rnd(-5,5)+360)%360,p=P(b,r),cs=fData.c+(100+Math.random()*899|0);
const a=mk({cs,t,x:p.x,y:p.y,alt:pick([11000,12000,13000,14000]),mode:'NAV',fx:rt[0]});
a.flight={type:'ARRIVAL',origin:fData.o,destination:'RIX',procedure:proc.n,route:rt,nextFix:rt[0],runway:RWN,approach:'ILS '+RWN};
a.spd=a.ts=Math.min(250,a.ty.x);a.ta=a.alt;a.assistAlt=Math.round(a.ta/100)*100;a.assistSpd=Math.round(a.ts);a.h=a.th=(Math.atan2(entryFix.x-a.x,entryFix.y-a.y)/D+360)%360;a.ga0=Math.random()<GAP;snap(a);SND.arr();msg('APP',`${getSpokenCallsign(a.cs)} ${a.t} entered sector, ${lv(a.alt)} on ${a.flight.procedure}`)}
function dep(){const {fData,ef}=chooseTrafficEntry(RIX_DEP,spawnLastDep,SPAWN_GAP_D[lvl]),proc=SIDS[RWN][ef],rt=proc.r;
 const t=pick(fData.t),cs=fData.c+(100+Math.random()*899|0),runway=runwayGeometry(RWN);
 const openStands=RIX_SURFACE_LAYOUT.stands.filter(s=>!ac.some(a=>a.surface&&(a.surface.stand===s.id||a.surface.destinationStand===s.id)));
 if(!openStands.length){msg('GND','No free stands, departure generation delayed');return}
 const stand=pick(openStands),standPoint=surfacePoint(stand.node);
 const a=mk({cs,t,x:0,y:0,h:runway.heading,alt:0,spd:0,dep:1,th:runway.heading,ta:3000,ts:220,fx:rt[0],mode:'GROUND',position:'GND',owner:'GND',surface:{node:stand.node,x:standPoint[0],y:standPoint[1],status:'parked',stand:stand.id,route:[],progress:0}});
 a.flight={type:'DEPARTURE',origin:'RIX',destination:fData.d,procedure:proc.n,route:rt,nextFix:rt[0],runway:RWN};a.assistAlt=Math.round(a.ta/100)*100;a.assistSpd=Math.round(a.ts);
 lastDep=T;snap(a);msg('GND',`${getSpokenCallsign(a.cs)} at stand ${stand.id}, request taxi`)}
function ga(a,w){const runway=runwayGeometry(a.flight&&a.flight.runway?a.flight.runway:RWN);a.loc=a.ils=a.gs=a.twr=0;a.ga0=0;a.ga=1;a.mode='HDG';a.th=runway.heading;a.ta=3000;a.ts=190;a.assistAlt=3000;a.assistSpd=190;a.owner='APP';if(a.flight){a.flight.nextFix='VECTORS';a.flight.resumeFix=''}ST.ga++;logE(`${getSpokenCallsign(a.cs)} go-around`);msg('TWR→APP',`${getSpokenCallsign(a.cs)} going around (${w}), runway heading, climbing 3000`)}
function land(a){ST.land++;if(a.emg)ST.emgH++;boundedPush(ST.tm,T-a.t0,MAX_HISTORY);const exit=RIX_SURFACE_LAYOUT.arrivalExitByRunway[a.flight.runway],p=surfacePoint(exit);a.loc=a.gs=0;a.alt=0;a.spd=0;a.mode='GROUND';a.position='TWR';a.owner='TWR';a.surface={node:exit,x:p[0],y:p[1],status:'vacated',stand:'',route:[],progress:0};a.q=[];a.readbackWatch=null;msg('TWR',`${getSpokenCallsign(a.cs)} landed runway ${a.flight.runway}, vacated via taxiway ${RIX_SURFACE_LAYOUT.runwayExits.find(e=>e.taxiNode===exit)?.name||'A'}`);}
