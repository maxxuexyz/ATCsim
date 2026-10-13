
const D=Math.PI/180,$=s=>document.querySelector(s),pick=a=>a[Math.random()*a.length|0],rnd=(a,b)=>a+Math.random()*(b-a),cl=(v,a,b)=>Math.max(a,Math.min(b,v)),dh=(f,t)=>((t-f+540)%360)-180,P=(b,r)=>({x:Math.sin(b*D)*r,y:Math.cos(b*D)*r,b,r});
const TY={A220:{n:'Airbus A220-300',v:130,b:25,a:1.6,c:3000,d:2400,x:250},A320:{n:'Airbus A320',v:138,b:25,a:1.4,c:2500,d:2200,x:250},A321:{n:'Airbus A321',v:140,b:25,a:1.3,c:2200,d:2200,x:250},B738:{n:'Boeing 737-800',v:142,b:25,a:1.4,c:2500,d:2200,x:250},E190:{n:'Embraer E190',v:130,b:25,a:1.6,c:2800,d:2100,x:250},AT72:{n:'ATR 72-600',v:112,b:22,a:1.2,c:1400,d:1500,x:210},B789:{n:'Boeing 787-9 (H)',v:145,b:20,a:1.2,c:2200,d:2000,x:250},B38M:{n:'Boeing 737 MAX 8',v:140,b:25,a:1.5,c:2600,d:2200,x:250}};
const FX={};[['KOLKA',330,38],['SIGUL',20,38],['DOBEL',270,38],['BALVI',200,29],['TIGAT',2,27],['LUMAX',90,14],['RUMBA',188,6],['ODKIN',290,14]].forEach(([n,b,r])=>{const p=P(b,r);FX[n]={x:p.x-1.0,y:p.y-4.0,b,r,n}});
const OUT=['KOLKA','SIGUL','DOBEL','BALVI'],INN=['TIGAT','LUMAX','RUMBA','ODKIN'];
const COASTLINES=[[[-110,-30],[-105,-10],[-100,15],[-95,30],[-85,40],[-60,50],[-45,60],[-35,50],[-20,25],[-10,15],[0,10],[10,15],[15,30],[15,50],[20,70],[15,90],[10,110],[20,150],[40,160],[70,165]]];
const BORDERS=[[[-110,-30],[-80,-25],[-40,-35],[0,-45],[40,-55],[80,-60],[120,-60]],[[15,90],[40,85],[70,80],[100,85],[130,95]],[[120,-60],[140,-40],[150,-10],[140,20],[130,50],[130,95]]];

/* RIX SID / STAR procedure database.
   Routes are ordered navigation chains.  Do not collapse intermediate fixes:
   the renderer and aircraft NAV logic consume these arrays in sequence. */
const STARS={
  18:{
    'KOLKA':{n:'TIGAT 2A',r:['KOLKA','TIGAT']},
    'SIGUL':{n:'LUMAX 2A',r:['SIGUL','TIGAT']},
    'DOBEL':{n:'LUMAX 2B',r:['DOBEL','KOLKA','TIGAT']},
    'BALVI':{n:'TIGAT 2C',r:['BALVI','ODKIN','KOLKA','TIGAT']},
    'LUMAX':{n:'LUMAX 2D',r:['LUMAX','SIGUL','TIGAT']}
  },
  36:{
    'KOLKA':{n:'KOLK2A',r:['KOLKA','ODKIN','RUMBA']},
    'SIGUL':{n:'SIGU1A',r:['SIGUL','LUMAX','RUMBA']},
    'DOBEL':{n:'DOBE1A',r:['DOBEL','ODKIN','RUMBA']},
    'BALVI':{n:'BALV1A',r:['BALVI','RUMBA']},
    'LUMAX':{n:'LUMA2A',r:['LUMAX','RUMBA']}
  }
};
const SIDS={
  18:{
    'KOLKA':{n:'TIGAT 1B',r:['ODKIN','KOLKA']},
    'SIGUL':{n:'TIGAT 1C',r:['LUMAX','SIGUL']},
    'DOBEL':{n:'LUMAX 1B',r:['ODKIN','DOBEL']},
    'BALVI':{n:'ODKIN 1B',r:['RUMBA','BALVI']}
  },
  36:{
    'KOLKA':{n:'ODKIN 2B',r:['ODKIN','KOLKA']},
    'SIGUL':{n:'TIGAT 2C',r:['TIGAT','SIGUL']},
    'DOBEL':{n:'ODKIN 2D',r:['ODKIN','DOBEL']},
    'BALVI':{n:'ODKIN 2B',r:['ODKIN','BALVI']}
  }
};

const RIX_ARR=[
  /* NORTH / NORTHWEST — Scandinavia, Finland, Estonia */
  {o:'ARN',c:'BT',t:['A220'],x:['KOLKA']},{o:'OSL',c:'BT',t:['A220'],x:['KOLKA']},
  {o:'CPH',c:'BT',t:['A220'],x:['KOLKA']},{o:'TLL',c:'BT',t:['A220'],x:['SIGUL']},
  {o:'HEL',c:'BT',t:['A220'],x:['SIGUL']},{o:'VNO',c:'BT',t:['A220'],x:['SIGUL']},
  {o:'ARN',c:'BT',t:['A220'],x:['KOLKA']},
  {o:'OSL',c:'D8',t:['B738','B38M'],x:['KOLKA']},{o:'ARN',c:'D8',t:['B738','B38M'],x:['KOLKA']},
  {o:'CPH',c:'D8',t:['B738','B38M'],x:['KOLKA']},
  {o:'HEL',c:'AY',t:['E190','AT72','A320'],x:['SIGUL']},{o:'TMP',c:'AY',t:['A320'],x:['SIGUL']},
  {o:'CPH',c:'SK',t:['A320'],x:['KOLKA']},

  /* WEST — Western Europe */
  {o:'STN',c:'FR',t:['B738','B38M'],x:['DOBEL']},{o:'DUB',c:'FR',t:['B738'],x:['DOBEL']},
  {o:'BVA',c:'FR',t:['B738'],x:['DOBEL']},{o:'BGY',c:'FR',t:['B738'],x:['DOBEL']},
  {o:'ATH',c:'FR',t:['B738'],x:['BALVI']},
  {o:'FRA',c:'LH',t:['A320','A321'],x:['DOBEL']},{o:'MUC',c:'LH',t:['A320'],x:['DOBEL']},
  {o:'BER',c:'LH',t:['A320'],x:['DOBEL']},
  {o:'AMS',c:'BT',t:['A220'],x:['DOBEL']},
  {o:'AMS',c:'BT',t:['A220'],x:['LUMAX']},

  /* SOUTH / SOUTHWEST — Southern Europe, Balkans, Turkey */
  {o:'WAW',c:'LO',t:['E190','B738'],x:['BALVI']},
  {o:'IST',c:'TK',t:['B738','A321'],x:['BALVI']}
];
const RIX_DEP=[
  /* NORTH / NORTHWEST */
  {d:'ARN',c:'BT',t:['A220'],x:['KOLKA']},{d:'OSL',c:'BT',t:['A220'],x:['KOLKA']},
  {d:'CPH',c:'BT',t:['A220'],x:['KOLKA']},{d:'TLL',c:'BT',t:['A220'],x:['SIGUL']},
  {d:'HEL',c:'BT',t:['A220'],x:['SIGUL']},{d:'VNO',c:'BT',t:['A220'],x:['SIGUL']},
  {d:'ARN',c:'BT',t:['A220'],x:['KOLKA']},
  {d:'OSL',c:'D8',t:['B738','B38M'],x:['KOLKA']},{d:'ARN',c:'D8',t:['B738','B38M'],x:['KOLKA']},
  {d:'CPH',c:'D8',t:['B738','B38M'],x:['KOLKA']},
  {d:'HEL',c:'AY',t:['E190','AT72'],x:['SIGUL']},{d:'TMP',c:'AY',t:['A320'],x:['SIGUL']},
  {d:'CPH',c:'SK',t:['A320'],x:['KOLKA']},

  /* WEST */
  {d:'STN',c:'FR',t:['B738','B38M'],x:['DOBEL']},{d:'DUB',c:'FR',t:['B738'],x:['DOBEL']},
  {d:'BVA',c:'FR',t:['B738'],x:['DOBEL']},{d:'BGY',c:'FR',t:['B738'],x:['DOBEL']},
  {d:'ATH',c:'FR',t:['B738'],x:['BALVI']},
  {d:'FRA',c:'LH',t:['A320','A321'],x:['DOBEL']},{d:'MUC',c:'LH',t:['A320'],x:['DOBEL']},
  {d:'BER',c:'LH',t:['A320'],x:['DOBEL']},
  {d:'AMS',c:'BT',t:['A220'],x:['DOBEL']},

  /* SOUTH / SOUTHWEST */
  {d:'WAW',c:'LO',t:['E190','B738'],x:['BALVI']},
  {d:'IST',c:'TK',t:['B738','A321'],x:['BALVI']}
];

let wd=pick([350,10,30,180,200,170]),ws=Math.round(rnd(7,18)),N36,RWN,C,U,TH;
let OLD_RWN=null, OLD_GEO=null, rwyChgT=0, RUNWAY_PENDING=false, PENDING_RWN=null;
/* Canonical physical runway geometry.
   Displayed designators remain 36/18. The physical centerline is
   translated to the airfield position and aligned to the runway
   orientation shown in the reference image (~004° / 184°). */
const AIRFIELD_SHIFT=[-1.0,6.5];
const RWY_ROT=-9*D;
const RWY_HALF=.857;
const runwayGeometry=rwn=>{
  const nominalHeading=rwn==36?355:175;

  const baseU=[
    Math.sin(nominalHeading*D),
    Math.cos(nominalHeading*D)
  ];

  const u=[
    baseU[0]*Math.cos(RWY_ROT)-baseU[1]*Math.sin(RWY_ROT),
    baseU[0]*Math.sin(RWY_ROT)+baseU[1]*Math.cos(RWY_ROT)
  ];

  const heading=(Math.atan2(u[0],u[1])/D+360)%360;

  const center=[
    AIRFIELD_SHIFT[0],
    AIRFIELD_SHIFT[1]
  ];

  const threshold=[
    center[0]-u[0]*RWY_HALF,
    center[1]-u[1]*RWY_HALF
  ];

  const oppositeThreshold=[
    center[0]+u[0]*RWY_HALF,
    center[1]+u[1]*RWY_HALF
  ];

  return {
    rwn,
    nominalHeading,
    heading,
    u,
    threshold,
    oppositeThreshold,
    center
  };
};
