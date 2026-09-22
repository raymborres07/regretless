import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { status } from "./schema";
import { event, quota } from "./lib/access";
export const charge = internalMutation({
  args: { userId: v.id("users"), kind: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    await quota(ctx, `${a.kind}:${a.userId}`, 20);
    await quota(ctx, `${a.kind}:global`, 100);
    return null;
  },
});
export const stage = internalMutation({
  args: {
    id: v.id("purchases"),
    runId: v.string(),
    status,
    title: v.string(),
    detail: v.string(),
    provider: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const p = await ctx.db.get(a.id);
    if (!p || p.runId !== a.runId) return null;
    await ctx.db.patch(a.id, { status: a.status, updatedAt: Date.now() });
    await event(ctx, a.id, a.title, a.detail, a.provider);
    return null;
  },
});
export const snapshot = internalMutation({
  args: {
    id: v.id("purchases"),
    runId: v.string(),
    data: v.any(),
    imageUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const p = await ctx.db.get(a.id);
    if (!p || p.runId !== a.runId) return null;
    await ctx.db.insert("priceSnapshots", {
      purchaseId: a.id,
      ...a.data,
      isDemo: p.isDemo,
      retrievedAt: Date.now(),
    });
    await ctx.db.patch(a.id, {
      currentPrice: a.data.price,
      lastCheckedAt: Date.now(),
      ...(a.imageUrl ? { imageUrl: a.imageUrl } : {}),
    });
    return null;
  },
});
export const finish = internalMutation({
  args: {
    id: v.id("purchases"),
    runId: v.string(),
    policy: v.any(),
    result: v.any(),
    draft: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const p = await ctx.db.get(a.id);
    if (!p || p.runId !== a.runId) return null;
    await ctx.db.insert("policies", {
      purchaseId: a.id,
      ...a.policy,
      isDemo: p.isDemo,
      retrievedAt: Date.now(),
    });
    const st = a.result.eligible
      ? "Claim Ready"
      : a.result.expired
        ? "Expired"
        : p.currentPrice !== undefined && p.currentPrice >= p.purchasePrice
          ? "Monitoring"
          : "Needs Review";
    await ctx.db.patch(a.id, {
      status: st,
      potentialRecovery: a.result.amount,
      updatedAt: Date.now(),
      checkStartedAt: undefined,
    });
    const existing = await ctx.db
      .query("claims")
      .withIndex("by_purchaseId", (q) => q.eq("purchaseId", a.id))
      .unique();
    const data = {
      status: st,
      requestedAmount: a.result.amount,
      draftSubject: a.draft?.subject ?? "",
      draftBody: a.draft?.body ?? "",
    };
    if (existing) await ctx.db.patch(existing._id, data);
    else if (a.result.eligible)
      await ctx.db.insert("claims", {
        purchaseId: a.id,
        userId: p.userId,
        ...data,
        recoveredAmount: 0,
        recipient: "",
      });
    await event(
      ctx,
      a.id,
      a.result.eligible
        ? "Claim ready for your approval"
        : "Manual review required",
      a.result.reason,
      "OpenAI",
      a.result.eligible ? "success" : "warning",
    );
    return null;
  },
});
export const fail = internalMutation({
  args: {
    id: v.id("purchases"),
    runId: v.string(),
    message: v.string(),
    status: v.optional(status),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const p = await ctx.db.get(a.id);
    if (p?.runId === a.runId) {
      await ctx.db.patch(a.id, {
        status: a.status ?? "Check Failed",
        error: a.message,
        checkStartedAt: undefined,
        potentialRecovery: 0,
      });
      await event(
        ctx,
        a.id,
        "Check needs attention",
        a.message,
        "Regretless",
        "warning",
      );
    }
    return null;
  },
});
