// Retain aggregate maxima and representative slow entries in reviewable Git
// evidence. Complete lab traces stay in the ignored local workspace.
export function boundedPerformanceEvidence(report) {
  const result=structuredClone(report);
  result.retention='Aggregates unchanged; six slowest events, five longest frames (three scripts each), five longest tasks per route. Complete entries retained in ignored .local-postgres files.';
  for(const sample of result.samples) for(const route of ['home','booking']) {
    const data=sample[route];
    data.originalEntryCounts={events:data.events.length,frames:data.frames.length,longTasks:data.longTasks.length};
    data.eventCountsByName=Object.fromEntries([...new Set(data.events.map(e=>e.name))].map(name=>[name,data.events.filter(e=>e.name===name).length]));
    data.events.sort((a,b)=>b.duration-a.duration);data.events=data.events.slice(0,6);
    data.frames.sort((a,b)=>b.duration-a.duration);data.frames=data.frames.slice(0,5).map(frame=>({...frame,scripts:[...frame.scripts].sort((a,b)=>b.duration-a.duration).slice(0,3)}));
    data.longTasks.sort((a,b)=>b.duration-a.duration);data.longTasks=data.longTasks.slice(0,5);
  }
  return result;
}
