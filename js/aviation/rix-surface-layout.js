/*
 * RIX surface simulation graph: taxiway nodes/links, stand anchors, holds, and
 * runway handoff points. Visible surface map artwork is separate in
 * rix-surface-map.js, so map edits do not change gameplay routing.
 * Stand rows below are hidden simulation anchors retained for existing traffic
 * flow. They are not drawn on the taxiway-only radar. Labels and holds are data.
 */
const RIX_STAND_ROWS=[
  {apron:'1',taxiway:'P',accessNode:'P_S',y:131,taxiY:127,ids:[100,101,102,103,104,105,106,107,108,109,110,112,113,114,115],x0:62,dx:3,side:'S'},
  {apron:'1',taxiway:'R',accessNode:'P_N',y:119,taxiY:123,ids:[200,204,205,206,207,208,214,215,216,217,218,219,220,221],x0:62,dx:3,side:'N'},
  {apron:'2',taxiway:'Q',accessNode:'Q_S',y:158,taxiY:154,ids:[224,225,226,227,228,229,230],x0:62,dx:3.4,side:'N'},
  {apron:'3',taxiway:'T',accessNode:'T_N',y:75, taxiY:71,ids:[290,291,292,293,300,301,302,303,304,305,306,307,308,309],x0:61,dx:3.2,side:'S'},
  {apron:'3',taxiway:'T',accessNode:'T_S',y:91,taxiY:95,ids:[311,312,313,314,315,316,317,321,322,323,324,325,326,327],x0:61,dx:3.2,side:'N'},
  {apron:'5',taxiway:'U1',accessNode:'U1_N',y:43,taxiY:46,ids:[401,402,461,462,467,468,469,470,471,472,473,474,475,476,477,478,479],x0:62,dx:3,side:'S'},
  {apron:'4',taxiway:'E',accessNode:'E5_S',y:34,taxiY:31,ids:[501,502,503,504,505,511,512],x0:73,dx:2.4,side:'N'}
];
const RIX_STANDS=RIX_STAND_ROWS.flatMap((row,r)=>row.ids.map((id,i)=>({id:String(id),node:`STAND_${id}`,apron:row.apron,side:'E',taxiNode:`STAND_ROW_${r}_${i}`,x:row.x0+i*row.dx,y:row.y,standSide:row.side})));
const RIX_STAND_NODES=Object.fromEntries(RIX_STANDS.flatMap((s,i)=>{const r=RIX_STAND_ROWS.find(row=>row.ids.some(id=>String(id)===s.id));return [[s.node,{x:s.x,y:s.y,label:s.id}],[s.taxiNode,{x:s.x,y:r.taxiY}]]}));
const RIX_STAND_ROW_PATHS=RIX_STAND_ROWS.map((row,r)=>({name:row.taxiway,nodes:[row.accessNode,...row.ids.map((_,i)=>`STAND_ROW_${r}_${i}`)],kind:'apron'}));

const RIX_SURFACE_LAYOUT={
  nodes:{
    /* Long north-south runway: 18 at the north end, 36 at the south. */
    RWY18:{x:46,y:7,label:'18'},RWY_MID:{x:46,y:100},RWY36:{x:46,y:193,label:'36'},
    RWY18_ENTRY_E:{x:46,y:15},RWY36_ENTRY_E:{x:46,y:185},
    /* East main taxiway F and its named runway intersections. */
    F_N:{x:55,y:10},F_G:{x:55,y:28},F_E:{x:55,y:45},F_D:{x:55,y:68},F_C:{x:55,y:99},F_B:{x:55,y:130},F_A:{x:55,y:169},F_S:{x:55,y:190},
    /* Taxiway F branches and apron taxiway spines, all named after the chart. */
    G_W:{x:60,y:28},G_E:{x:69,y:28},G_N:{x:82,y:44},
    D_W:{x:61,y:68},D_E:{x:67,y:73},D_N:{x:96,y:79},
    C_W:{x:61,y:99},C_E:{x:73,y:99},C_N:{x:73,y:88},C_S:{x:70,y:130},
    E_W:{x:61,y:46},E_E:{x:66,y:53},E_N:{x:78,y:58},E_S:{x:82,y:44},
    P_N:{x:70,y:105},P_S:{x:70,y:130},Q_N:{x:82,y:130},Q_S:{x:82,y:163},R_N:{x:89,y:130},R_S:{x:89,y:163},
    S_N:{x:96,y:130},S_S:{x:96,y:163},T_N:{x:59,y:75},T_S:{x:59,y:91},
    U_N:{x:62,y:50},U_S:{x:62,y:65},U1_N:{x:67,y:50},U1_S:{x:67,y:65},
    V_N:{x:86,y:82},V_S:{x:86,y:105},W_N:{x:96,y:82},W_S:{x:96,y:105},
    E5_N:{x:93,y:34},E5_S:{x:93,y:44},
    /* Runway exits and crossing/holding data endpoints. */
    EXIT_G:{x:49,y:29},EXIT_E:{x:49,y:48},EXIT_D:{x:49,y:70},EXIT_C:{x:49,y:99},EXIT_B:{x:49,y:130},EXIT_A:{x:49,y:169},
    HOLD18:{x:52,y:15,label:'HOLD 18'},HOLD36:{x:52,y:185,label:'HOLD 36'},
    H18_BAR_A:{x:50.5,y:12},H18_BAR_B:{x:53.5,y:18},H36_BAR_A:{x:50.5,y:182},H36_BAR_B:{x:53.5,y:188},
    ...RIX_STAND_NODES
  },
  /* Routing graph retained for existing local surface flows. Never render this
     array: it includes legacy apron/stand access links that are not map art. */
  routingTaxiways:[
    {name:'F',nodes:['F_N','F_G','F_E','F_D','F_C','F_B','F_A','F_S']},
    {name:'G',nodes:['F_G','G_W','G_E','G_N','E5_S']},
    {name:'E',nodes:['F_E','E_W','E_E','E_N']},
    {name:'D',nodes:['F_D','D_W','D_E','D_N']},
    {name:'C',nodes:['F_C','C_W','C_E','C_S']},
    {name:'B',nodes:['F_B','P_N','P_S']},
    {name:'A',nodes:['F_A','Q_N','Q_S']},
    {name:'P',nodes:['C_E','P_N','P_S','Q_N']},
    {name:'Q',nodes:['P_S','Q_N','Q_S']},
    {name:'R',nodes:['Q_N','R_N','R_S','Q_S']},
    {name:'S',nodes:['R_N','S_N','S_S','R_S']},
    {name:'T',nodes:['F_D','T_N','T_S','F_C']},
    {name:'U',nodes:['E_E','U_N','U_S','D_W']},
    {name:'U1',nodes:['U_N','U1_N','U1_S','D_E']},
    {name:'V',nodes:['D_N','V_N','V_S','C_E']},
    {name:'W',nodes:['V_S','W_S','W_N','D_N']},
    {name:'E5',nodes:['G_N','E5_N','E5_S']},
    {name:'HOLD',nodes:['F_N','HOLD18']},{name:'HOLD',nodes:['F_S','HOLD36']},
    /* Hidden taxi connectors from map-side taxiways to existing stand targets. */
    ...RIX_STAND_ROW_PATHS
  ],
  intersections:[
    ...[['G','F_G'],['E','F_E'],['D','F_D'],['C','F_C'],['B','F_B'],['A','F_A']].map(([id,node])=>({id:`${id}-F`,node,label:id})),
    ...[['G','G_N'],['E','E_N'],['D','D_N'],['C','C_N'],['B','F_B'],['A','F_A']].map(([id,node])=>({id:`${id}-E`,node,label:id}))
  ],
  runwayExits:[
    {name:'G',nodes:['EXIT_G','F_G'],taxiNode:'F_G'},
    {name:'E',nodes:['EXIT_E','F_E'],taxiNode:'F_E'},
    {name:'D',nodes:['EXIT_D','F_D'],taxiNode:'F_D'},
    {name:'C',nodes:['EXIT_C','F_C'],taxiNode:'F_C'},
    {name:'B',nodes:['EXIT_B','F_B'],taxiNode:'F_B'},
    {name:'A',nodes:['EXIT_A','F_A'],taxiNode:'F_A'}
  ],
  stands:RIX_STANDS,
  holdingPoints:[
    {id:'HOLD18',runway:18,side:'E',node:'HOLD18',bar:['H18_BAR_A','H18_BAR_B'],label:'18'},
    {id:'HOLD36',runway:36,side:'E',node:'HOLD36',bar:['H36_BAR_A','H36_BAR_B'],label:'36'}
  ],
  runwayCrossings:[
    {id:'RWY18_ENTRY',from:'HOLD18',to:'RWY18_ENTRY_E',runway:18,side:'E'},
    {id:'RWY36_ENTRY',from:'HOLD36',to:'RWY36_ENTRY_E',runway:36,side:'E'}
  ],
  runwayEntryPaths:{HOLD18:['RWY18_ENTRY_E'],HOLD36:['RWY36_ENTRY_E']},
  arrivalExitByRunway:{18:'F_E',36:'F_B'}
};
