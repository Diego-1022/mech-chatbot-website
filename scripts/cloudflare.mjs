import {spawnSync} from "node:child_process";
import {readFileSync,existsSync,readdirSync,unlinkSync} from "node:fs";
import path from "node:path";
const [command,...args]=process.argv.slice(2);
const env={...process.env,VITE_DEPLOYMENT_TARGET:"cloudflare"};
let argv;
if(command==="build"||command==="dev")argv=["scripts/run-framework.mjs",command,...args];
else if(command==="deploy"){
 const source=JSON.parse(readFileSync("wrangler.cloudflare.json","utf8"));
 const built=JSON.parse(readFileSync("dist/server/wrangler.json","utf8"));
 if(source.d1_databases[0].database_id.startsWith("00000000-") || built.name!==source.name || built.d1_databases[0].database_id!==source.d1_databases[0].database_id)throw Error("Configure a real D1 database and run npm run build:cloudflare first.");
 argv=["node_modules/wrangler/bin/wrangler.js","deploy","--config","dist/server/wrangler.json",...args];
}else throw Error("Use build, dev or deploy.");
const result=spawnSync(process.execPath,argv,{env,stdio:"inherit"});
if(result.error)throw result.error;
if(command==="build" && result.status===0){
 // The Vite plugin copies local .dev.vars for production preview. Deployment
 // secrets must come from the account's secret store, never the build bundle.
 const output=path.resolve("dist");
 function strip(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){
   const file=path.resolve(dir,entry.name);
   if(!file.startsWith(output+path.sep))throw Error("Unexpected output path");
   if(entry.isDirectory())strip(file);
   else if(/^\.dev\.vars(?:\.|$)|^\.env(?:\.|$)/.test(entry.name))unlinkSync(file);
 }}
 if(existsSync(output))strip(output);
}
process.exit(result.status??1);
