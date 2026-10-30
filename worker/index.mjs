const security={
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY',
 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
 'Strict-Transport-Security':'max-age=31536000'
};
export default {
 async fetch(request,env){
  const url=new URL(request.url);let response;
  if(url.pathname.startsWith('/api/')){
   if(!['GET','POST','PUT','PATCH'].includes(request.method))return Response.json({error:'Method not allowed.'},{status:405,headers:security});
   if(request.method!=='GET'&&(request.headers.get('X-Mathroom-Request')!=='1'||request.headers.has('Origin')&&request.headers.get('Origin')!==url.origin))return Response.json({error:'Request verification failed.'},{status:403,headers:security});
   const headers=new Headers();for(const key of ['content-type','cookie','x-file-name','x-mathroom-request'])if(request.headers.has(key))headers.set(key,request.headers.get(key));
   try{response=await fetch(env.SUPABASE_API+url.pathname+url.search,{method:request.method,headers,body:request.method==='GET'?undefined:request.body,redirect:'manual',duplex:'half'})}catch{return Response.json({error:'Workspace temporarily unavailable. Please retry.'},{status:503,headers:security})}
  }else response=await env.ASSETS.fetch(request);
  const headers=new Headers(response.headers);for(const [key,value]of Object.entries(security))headers.set(key,value);
  if(url.pathname.startsWith('/api/'))headers.set('Cache-Control','no-store');
  return new Response(response.body,{status:response.status,headers});
 }
};
