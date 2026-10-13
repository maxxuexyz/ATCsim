/* Graph routing over RIX_SURFACE_LAYOUT taxiway node paths. Runway entry links
   are deliberately excluded: only the TWR runway-entry command may use them. */
const surfaceNode=id=>RIX_SURFACE_LAYOUT.nodes[id]||null;
const surfacePoint=id=>{const n=surfaceNode(id);return n?[n.x,n.y]:null};
function surfaceGraph(){
  const graph=new Map();
  const link=(a,b)=>{
    if(!graph.has(a))graph.set(a,[]);if(!graph.has(b))graph.set(b,[]);
    const A=surfaceNode(a),B=surfaceNode(b);if(!A||!B)return;
    const weight=Math.hypot(A.x-B.x,A.y-B.y);
    if(!graph.get(a).some(e=>e.to===b))graph.get(a).push({to:b,weight});
    if(!graph.get(b).some(e=>e.to===a))graph.get(b).push({to:a,weight});
  };
  RIX_SURFACE_LAYOUT.routingTaxiways.forEach(t=>{for(let i=1;i<t.nodes.length;i++)link(t.nodes[i-1],t.nodes[i])});
  /* Stand connectors stay in editable stand records, not handoff logic. */
  RIX_SURFACE_LAYOUT.stands.forEach(s=>link(s.taxiNode,s.node));
  return graph;
}
function findSurfaceRoute(start,end,{blockedNodes=[]}={}){
  if(!surfaceNode(start)||!surfaceNode(end))return null;
  if(start===end)return [];
  const blocked=new Set(blockedNodes),graph=surfaceGraph(),dist=new Map([[start,0]]),prev=new Map(),open=[start],done=new Set();
  while(open.length){
    open.sort((a,b)=>(dist.get(a)??Infinity)-(dist.get(b)??Infinity));
    const at=open.shift();if(done.has(at))continue;done.add(at);if(at===end)break;
    for(const edge of graph.get(at)||[]){
      if(blocked.has(edge.to)&&edge.to!==end)continue;
      const next=dist.get(at)+edge.weight;
      if(next<(dist.get(edge.to)??Infinity)){dist.set(edge.to,next);prev.set(edge.to,at);open.push(edge.to)}
    }
  }
  if(!prev.has(end))return null;
  const route=[];for(let at=end;at!==start;at=prev.get(at))route.unshift(at);
  return route;
}
const getSurfaceStand=id=>RIX_SURFACE_LAYOUT.stands.find(s=>s.id===String(id))||null;
const getSurfaceHoldingPoint=(runway,side)=>RIX_SURFACE_LAYOUT.holdingPoints.find(h=>h.runway===Number(runway)&&h.side===side)||null;
const getRunwayEntryForHold=holdNode=>RIX_SURFACE_LAYOUT.runwayEntryPaths[holdNode]||[];
