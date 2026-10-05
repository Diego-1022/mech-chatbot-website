import handler from "vinext/server/fetch-handler";
export default {
  fetch(request:Request,env:Cloudflare.Env,ctx:ExecutionContext){
    // Sites identity headers have no authority on independently hosted Workers.
    const headers=new Headers(request.headers);
    for(const name of [...headers.keys()])if(name.startsWith("oai-authenticated-user-"))headers.delete(name);
    return handler.fetch(new Request(request,{headers}),env,ctx);
  },
};
