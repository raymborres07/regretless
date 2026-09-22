import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { event,quota } from "./lib/access";
export const checkDue=internalMutation({args:{},returns:v.null(),handler:async ctx=>{
 if(!process.env.FIRECRAWL_API_KEY||!process.env.OPENAI_API_KEY)return null;
 for(const status of ["Purchased","Monitoring","Eligible","Claim Ready"]){
 const rows=await ctx.db.query("purchases").withIndex("by_status_and_lastCheckedAt",q=>q.eq("status",status).lte("lastCheckedAt",Date.now()-86400000)).take(10);
 for(const p of rows){if(p.isDemo||!p.confirmed||!p.productUrl||!p.policyUrl||(p.checkStartedAt&&Date.now()-p.checkStartedAt<180000))continue;
 try{await quota(ctx,"checks:global",100);}catch{return null;}
 const runId=crypto.randomUUID();await ctx.db.patch(p._id,{status:"Monitoring",runId,checkStartedAt:Date.now(),potentialRecovery:0});await event(ctx,p._id,"Scheduled price check","Your agent is checking the product and policy again.","Convex","info");await ctx.scheduler.runAfter(0,internal.pipeline.check,{id:p._id,runId});
 }}return null;
}});
