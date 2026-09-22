import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx, ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { RateLimiter, DAY } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";
export async function userId(ctx:QueryCtx|MutationCtx|ActionCtx){const id=await getAuthUserId(ctx);if(!id)throw new Error("Please start your private session.");return id;}
export async function ownPurchase(ctx:QueryCtx|MutationCtx,id:Id<"purchases">){const uid=await userId(ctx);const p=await ctx.db.get(id);if(!p||p.userId!==uid)throw new Error("Purchase not found.");return p;}
export async function event(ctx:MutationCtx,purchaseId:Id<"purchases">,title:string,detail:string,provider="Regretless",kind:"success"|"info"|"warning"="success"){await ctx.db.insert("events",{purchaseId,title,detail,provider,kind,at:Date.now()});}
export async function quota(ctx:MutationCtx,key:string,max:number){const limiter=new RateLimiter(components.rateLimiter,{daily:{kind:"fixed window",rate:max,period:DAY}});const result=await limiter.limit(ctx,"daily",{key});if(!result.ok)throw new Error("Daily demo limit reached. Try again tomorrow.");}
