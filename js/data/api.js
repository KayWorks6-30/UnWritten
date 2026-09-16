export async function api(path, options={}) {
  const response = await fetch(path, { ...options, headers:{ 'accept':'application/json', ...(options.headers||{}) } });
  const type=response.headers.get('content-type')||'';
  const payload=type.includes('application/json') ? await response.json() : null;
  if(!response.ok){
    const err=new Error(payload?.error || `Request failed (${response.status}).`);
    err.status=response.status;
    err.details=payload?.details;
    throw err;
  }
  return payload;
}
