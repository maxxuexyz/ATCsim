/*
 * Editable RIX surface radar artwork. Taxiway geometry is retained here for
 * later map work but is currently hidden; only the runway is drawn. Aircraft
 * routing and stand/hold anchors live in rix-surface-layout.js. This is a
 * gameplay schematic, not an operational chart.
 * Coordinates are north-up: x increases east/right, y increases south/down.
 * The supplied horizontal taxiway diagram was rotated into this coordinate
 * system and kept at its relative proportions. mapRotationDeg applies the
 * small 005-degree true-north correction when the map is drawn.
 *
 * To move/reshape a taxiway, edit its start, segment control points (c1/c2),
 * or endpoint (to). Add/remove a taxiway record and its labels to edit the
 * visible map. Runway connectors start at x=47.9, exactly on the east runway
 * shoulder edge. Keep those points on the runway boundary so paths stop there
 * without crossing it.
 */
var RIX_SURFACE_MAP={
  coordinateSystem:{minX:28,maxX:84,minY:0,maxY:200,northIsAt:'top'},
  twrCoordinateSystem:{minX:28,maxX:84,minY:-496,maxY:698,northIsAt:'top'},
  mapRotationDeg:5,
  display:{runway:true,taxiways:true},
  runway:{
    shoulder:[[44.1,14],[47.9,14],[47.9,188],[44.1,188]],
    measurement:{runwayLengthM:3200,extensionNm:5},
    designators:[{text:'18',at:[46,18]},{text:'36',at:[46,183.5]}]
  },
  /* Apron 1 occupies the area between D and C, east of F. */
  aprons:[{
    name:'1',
    /* Apron 1 meets the east edge of Taxiway F and extends beneath both piers. */
    boundary:{start:[59.0,75],segments:[
      {c1:[66.0,75],c2:[74.0,75],to:[80.6,75]},
      {c1:[82.0,75],c2:[83.2,76.8],to:[83.2,79]},
      {c1:[83.2,90],c2:[83.2,106],to:[83.2,116]},
      {c1:[83.2,118.2],c2:[81.4,120],to:[79.2,120]},
      {c1:[72.2,120],c2:[65.0,120],to:[59.0,120]},
      {c1:[59.0,106],c2:[59.0,88],to:[59.0,75]}
    ]},
    fill:'#35434d',edge:'#596a76',pierFill:'#222c35',pierEdge:'#4b5a65',
    terminals:[
      {name:'B',outline:[[76.0,101],[79.2,101],[80.0,102],[80.0,105],[79.2,106],[76.0,106]],labelAt:[78.0,103.5]},
      {name:'C',outline:[[76.0,85],[79.2,85],[80.0,86],[80.0,89],[79.2,90],[76.0,90]],labelAt:[78.0,87.5]}
    ],
    terminalFill:'#182129',terminalEdge:'#4b5a65',
    walkways:[[[79.6,89.4],[80.9,89.4],[81.3,90],[81.3,101],[80.9,101.6],[79.6,101.6]]],
    walkwayFill:'#4d606b',walkwayEdge:'#71838e',
    terminalCircles:[{center:[78.8,111.1],radius:2.5}],
    terminalCircleFill:'#182129',terminalCircleEdge:'#4b5a65',
    piers:[
      [[60.2,85.3],[76.4,85.3],[77.2,86.1],[77.2,89.7],[76.4,90.5],[60.2,90.5]],
      [[62.9,101.3],[76.4,101.3],[77.2,102.1],[77.2,105.9],[76.4,106.7],[62.9,106.7]]
    ],
    stands:[
      {id:'302',from:[63.0,85.3],to:[63.0,82.8],labelAt:[63.0,81.8],rotate:90},
      {id:'304',from:[67.0,85.3],to:[67.0,82.8],labelAt:[67.0,81.8],rotate:90},
      {id:'306',from:[71.0,85.3],to:[71.0,82.8],labelAt:[71.0,81.8],rotate:90},
      {id:'308',from:[75.0,85.3],to:[75.0,82.8],labelAt:[75.0,81.8],rotate:90},
      {id:'303',from:[63.0,90.5],to:[63.0,93.0],labelAt:[63.0,94.2],rotate:90},
      {id:'305',from:[67.0,90.5],to:[67.0,93.0],labelAt:[67.0,94.2],rotate:90},
      {id:'307',from:[71.0,90.5],to:[71.0,93.0],labelAt:[71.0,94.2],rotate:90},
      {id:'309',from:[75.0,90.5],to:[75.0,93.0],labelAt:[75.0,94.2],rotate:90},
      {id:'102',from:[63.0,101.3],to:[63.0,98.8],labelAt:[63.0,97.0],rotate:90},
      {id:'104',from:[67.0,101.3],to:[67.0,98.8],labelAt:[67.0,97.0],rotate:90},
      {id:'106',from:[71.0,101.3],to:[71.0,98.8],labelAt:[71.0,97.0],rotate:90},
      {id:'108',from:[75.0,101.3],to:[75.0,98.8],labelAt:[75.0,97.0],rotate:90},
      {id:'105',from:[64.0,106.7],to:[64.0,109.2],labelAt:[64.0,110.2],rotate:90},
      {id:'107',from:[69.0,106.7],to:[69.0,109.2],labelAt:[69.0,110.2],rotate:90},
      {id:'109',from:[74.0,106.7],to:[74.0,109.2],labelAt:[74.0,110.2],rotate:90}
    ],
    label:{at:[69.5,116]}
  }],
  taxiways:[
    /* F: the long parallel taxiway on the east side. Extend its south end to
       meet A's rounded runway-36 loop directly (same [x, y] endpoint). */
    {name:'F',start:[58.2,168],segments:[{c1:[58.2,160],c2:[58.2,152],to:[58.2,145]},{c1:[58.2,121],c2:[58.2,87],to:[58.2,66]},{c1:[58.2,53],c2:[58.2,41],to:[58.2,33]}],labels:[{at:[57.15,106],rotate:90},{at:[57.15,48],rotate:90}]},
    /* A: straight runway exit, short two-stage 45-degree bend, slightly longer
       straight section, then one gradual ~30-degree sweep toward F. The final
       point exactly meets F; the sweep intentionally merges into F at a shallow
       angle instead of looping around its southern end. */
    {name:'A',start:[47.9,185.5],segments:[
      {c1:[48.4,185.5],c2:[48.9,185.5],to:[49.4,185.5]},
      /* First 45-degree bend: eastbound to a clearly visible northeast diagonal. */
      {c1:[50.0,185.5],c2:[50.65,185.25],to:[51.25,184.65]},
      /* Hold that diagonal long enough for the two bends to read separately. */
      {c1:[51.65,184.25],c2:[52.05,183.85],to:[52.45,183.45]},
      /* Second 45-degree bend: northeast diagonal to the northbound straight. */
      {c1:[53.05,182.85],c2:[53.35,182.2],to:[53.35,181.6]},
      {c1:[53.35,180.8],c2:[53.35,180.0],to:[53.35,179.2]},
      /* Gentle 30-degree sweep eastward into Taxiway F. */
      {c1:[53.35,175.2],c2:[58.2,170.5],to:[58.2,168.0]}
    ],runwayFlare:{segments:1,width:3.0}, /* Flared runway mouth, tapering across the first segment. */
    labels:[{at:[56.2,173.6],rotate:-55}]},
    /* B: broad curved exit into F. The short lead-in runs along the runway
       edge before easing east, avoiding a square corner at the connection. */
    {name:'B',start:[47.9,153],segments:[
      /* Short straight runway exit, then a visible curved turn onto the diagonal. */
      {c1:[48.2,153],c2:[48.5,153],to:[48.8,153]},
      {c1:[49.45,153],c2:[50.2,151.6],to:[50.7,151.1]},
      /* Hold a clear diagonal before the broad turn into F. */
      {c1:[51.5,150.3],c2:[52.4,149.4],to:[53.3,148.5]},
      {c1:[55.0,146.8],c2:[58.2,144.2],to:[58.2,142.0]}
    ],runwayFlare:{segments:2,width:3.6},labels:[{at:[53.0,148.8],rotate:-43}]},
    /* C: straight cross-link for Y to merge into, then a wide, gradual
       southbound sweep onto F. Keep the curve long enough to read as a turn. */
    {name:'C',start:[47.9,123.5],segments:[
      {c1:[48.4,123.5],c2:[48.9,123.5],to:[49.4,123.5]},
      {c1:[51.3,123.5],c2:[53.7,123.5],to:[56.2,123.5]},
      {c1:[57.5,123.5],c2:[58.2,126.5],to:[58.2,130.5]}
    ],runwayFlare:{segments:1,width:2.4},labels:[{at:[50.5,122.2]}]},
    /* Y: start farther north on the runway, sweep down and east in one broad
       turn, then blend into C with a horizontal tangent before C curves onto F. */
    {name:'Y',start:[47.9,119],segments:[
      {c1:[48.35,119],c2:[48.85,119],to:[49.3,119]},
      {c1:[50.35,119],c2:[51.45,119.55],to:[52.3,120.5]},
      {c1:[53.25,121.25],c2:[54.15,123.5],to:[54.6,123.5]}
    ],runwayFlare:{segments:1,width:3.6,northExtra:3.0,northSegments:2},labels:[{at:[52.4,121.0],rotate:45}]},
    /* D: diagonal exit starts with a rounded runway-edge turn, then sweeps
       into the north side of F as in the reference. */
    {name:'D',start:[46.2,85],segments:[
      /* Begin at the shorter runway position, then sweep north smoothly. */
      {c1:[46.2,81],c2:[47.3,77],to:[49.1,75.5]},
      /* Continue the northward turn smoothly into the diagonal. */
      {c1:[50.5,73.5],c2:[53.5,71.5],to:[55.0,69.1]},
      /* Round into F with a northbound tangent. */
      {c1:[56.4,67.8],c2:[58.2,68.7],to:[58.2,67.0]}
    ],labels:[{at:[52.8,72.8],rotate:-48}]},
    /* E: perpendicular exit with a smooth mouth hidden under the runway edge. */
    {name:'E',start:[46.2,47],segments:[
      {c1:[47.0,47],c2:[48.2,47],to:[49.2,47]},
      {c1:[52.2,47],c2:[55.5,47],to:[58.2,47]}
    ],labels:[{at:[52.6,42]}]},
    /* G: leave the runway eastbound, turn onto a long southbound straight,
       then make a second rounded turn into F like the chart's two-bend path. */
    {name:'G',start:[46.2,16],segments:[
      {c1:[47.0,16],c2:[48.3,16],to:[49.3,16]},
      {c1:[52.0,16],c2:[55.2,18.5],to:[56.2,21]},
      {c1:[56.2,23],c2:[56.2,26],to:[56.2,27]},
      {c1:[56.2,30],c2:[58.2,30],to:[58.2,33]}
    ],labels:[{at:[57.0,25],rotate:90}]},
  ],
  labels:[
    {text:'N',at:[62,8],size:'compass'},
    {text:'RWY 18 / 36',at:[46,100],rotate:-90,size:'runway'}
  ]
};
