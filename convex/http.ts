import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { components,internal } from "./_generated/api";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { auth } from "./auth";
import { Webhook } from "svix";
const http=httpRouter();
auth.addHttpRoutes(http);
http.route({path:"/api/agentmail",method:"POST",handler:httpAction(async(ctx,request)=>{
 const secret=process.env.AGENTMAIL_WEBHOOK_SECRET;if(!secret)return new Response("Webhook not configured",{status:503});
 const body=await request.text();if(body.length>250000)return new Response("Too large",{status:413});
 let payload:unknown;try{payload=new Webhook(secret).verify(body,{"svix-id":request.headers.get("svix-id")||"","svix-timestamp":request.headers.get("svix-timestamp")||"","svix-signature":request.headers.get("svix-signature")||""});}catch{return new Response("Invalid signature",{status:401});}
 if(!payload||typeof payload!=="object")return new Response("Invalid payload",{status:400});
 const p=payload as Record<string,unknown>;if(p.event_type!=="message.received")return new Response("Ignored",{status:200});
 const m=p.message as Record<string,unknown>|undefined;if(!m||typeof m.inbox_id!=="string"||typeof m.message_id!=="string")return new Response("Invalid message",{status:400});
 await ctx.scheduler.runAfter(0,internal.mail.receive,{inboxId:m.inbox_id,messageId:m.message_id});return new Response("Accepted",{status:202});
})});
registerStaticRoutes(http,components.staticHosting);
export default http;
