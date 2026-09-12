const encoder = new TextEncoder();
const decoder = new TextDecoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n=0;n<256;n++) { let c=n; for(let k=0;k<8;k++) c=(c&1)?0xedb88320^(c>>>1):c>>>1; table[n]=c>>>0; }
  return table;
})();

export function crc32(bytes) {
  let crc=0xffffffff;
  for (const b of bytes) crc = CRC_TABLE[(crc^b)&0xff] ^ (crc>>>8);
  return (crc^0xffffffff)>>>0;
}

function concat(chunks) {
  const total=chunks.reduce((n,c)=>n+c.length,0); const out=new Uint8Array(total); let offset=0;
  for(const chunk of chunks){ out.set(chunk,offset); offset+=chunk.length; } return out;
}
function view(size){ return new DataView(new ArrayBuffer(size)); }
function bytesOf(v){ return new Uint8Array(v.buffer); }

export async function makeZip(entries) {
  const locals=[]; const centrals=[]; let offset=0;
  for(const entry of entries){
    const nameBytes=encoder.encode(entry.name);
    const data = entry.data instanceof Uint8Array ? entry.data : entry.data instanceof Blob ? new Uint8Array(await entry.data.arrayBuffer()) : encoder.encode(String(entry.data ?? ''));
    const crc=crc32(data);
    const local=view(30);
    local.setUint32(0,0x04034b50,true); local.setUint16(4,20,true); local.setUint16(6,0x0800,true); local.setUint16(8,0,true);
    local.setUint16(10,0,true); local.setUint16(12,0,true); local.setUint32(14,crc,true); local.setUint32(18,data.length,true); local.setUint32(22,data.length,true);
    local.setUint16(26,nameBytes.length,true); local.setUint16(28,0,true);
    locals.push(bytesOf(local),nameBytes,data);

    const central=view(46);
    central.setUint32(0,0x02014b50,true); central.setUint16(4,20,true); central.setUint16(6,20,true); central.setUint16(8,0x0800,true); central.setUint16(10,0,true);
    central.setUint16(12,0,true); central.setUint16(14,0,true); central.setUint32(16,crc,true); central.setUint32(20,data.length,true); central.setUint32(24,data.length,true);
    central.setUint16(28,nameBytes.length,true); central.setUint16(30,0,true); central.setUint16(32,0,true); central.setUint16(34,0,true); central.setUint16(36,0,true);
    central.setUint32(38,0,true); central.setUint32(42,offset,true);
    centrals.push(bytesOf(central),nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const centralBytes=concat(centrals); const localBytes=concat(locals);
  const end=view(22); end.setUint32(0,0x06054b50,true); end.setUint16(4,0,true); end.setUint16(6,0,true); end.setUint16(8,entries.length,true); end.setUint16(10,entries.length,true);
  end.setUint32(12,centralBytes.length,true); end.setUint32(16,localBytes.length,true); end.setUint16(20,0,true);
  return new Blob([localBytes,centralBytes,bytesOf(end)],{type:'application/zip'});
}

export async function readZip(blob) {
  const data=new Uint8Array(await blob.arrayBuffer()); const dv=new DataView(data.buffer,data.byteOffset,data.byteLength);
  let eocd=-1; for(let i=data.length-22;i>=Math.max(0,data.length-65557);i--){ if(dv.getUint32(i,true)===0x06054b50){ eocd=i; break; } }
  if(eocd<0) throw new Error('Invalid ZIP: end record not found.');
  const count=dv.getUint16(eocd+10,true); const centralOffset=dv.getUint32(eocd+16,true); let pos=centralOffset; const out=new Map();
  for(let i=0;i<count;i++){
    if(dv.getUint32(pos,true)!==0x02014b50) throw new Error('Invalid ZIP central directory.');
    const method=dv.getUint16(pos+10,true); const compressedSize=dv.getUint32(pos+20,true); const nameLen=dv.getUint16(pos+28,true); const extraLen=dv.getUint16(pos+30,true); const commentLen=dv.getUint16(pos+32,true); const localOffset=dv.getUint32(pos+42,true);
    const name=decoder.decode(data.slice(pos+46,pos+46+nameLen));
    if(method!==0) throw new Error(`ZIP entry ${name} uses unsupported compression.`);
    if(dv.getUint32(localOffset,true)!==0x04034b50) throw new Error('Invalid ZIP local header.');
    const localNameLen=dv.getUint16(localOffset+26,true); const localExtraLen=dv.getUint16(localOffset+28,true); const start=localOffset+30+localNameLen+localExtraLen;
    out.set(name,data.slice(start,start+compressedSize));
    pos += 46+nameLen+extraLen+commentLen;
  }
  return out;
}
