// Read the configured credential in memory only; never echo it or provider errors.
import { execFileSync } from "node:child_process";
const url = process.argv[2];
if (!url || !url.startsWith("https://")) throw new Error("Supply a public HTTPS URL.");
let key;
try { key = execFileSync(process.execPath, ["node_modules/convex/bin/main.js", "env", "get", "FIRECRAWL_API_KEY", "--prod"], {encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim(); }
catch { throw new Error("Firecrawl credential unavailable."); }
try {
 const response = await fetch("https://api.firecrawl.dev/v2/scrape", {method:"POST", headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({url,formats:["markdown"],onlyMainContent:true,maxAge:0}),signal:AbortSignal.timeout(75000)});
 const data = await response.json();
 console.log(JSON.stringify({status:response.status,success:data.success===true,readable:!!data.data?.markdown,contains399:data.data?.markdown?.includes("399.00")??false,contains14Days:data.data?.markdown?.includes("14 calendar days")??false}));
 if(!response.ok||!data.success)process.exitCode=1;
} catch { console.error("Firecrawl probe failed; no credentials or provider payload logged.");process.exitCode=1; }
