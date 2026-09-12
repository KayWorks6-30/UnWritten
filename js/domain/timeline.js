export function numericOrNull(value){ const n=Number(value); return value!==''&&value!=null&&Number.isFinite(n)?n:null; }
export function eventSortKey(entity){
  const manual=numericOrNull(entity?.fields?.timelineOrder); if(manual!==null) return [0,manual];
  const start=numericOrNull(entity?.fields?.dateStart); if(start!==null) return [1,start];
  const end=numericOrNull(entity?.fields?.dateEnd); if(end!==null) return [1,end];
  return [2,String(entity?.fields?.dateText||'').toLowerCase()];
}
export function compareTimelineEvents(a,b){ const ak=eventSortKey(a),bk=eventSortKey(b); if(ak[0]!==bk[0]) return ak[0]-bk[0]; if(typeof ak[1]==='number'&&typeof bk[1]==='number') return ak[1]-bk[1]; return String(ak[1]).localeCompare(String(bk[1])); }
export function eventRangeLabel(entity){
  const f=entity?.fields||{}; if(f.dateText) return f.dateText;
  const start=numericOrNull(f.dateStart),end=numericOrNull(f.dateEnd); if(start!==null&&end!==null&&start!==end) return `${start}–${end}`; if(start!==null) return String(start); return 'Unknown date';
}
