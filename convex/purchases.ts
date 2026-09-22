import {
  query,
  mutation,
  internalQuery,
  internalMutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { receiptFields } from "./schema";
import { ownPurchase, userId, event, quota } from "./lib/access";
import { ensureCatalog } from "./catalog";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { safeUrl } from "./lib/eligibility";

export const dashboard = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const uid = await userId(ctx);
    const purchases = await ctx.db
      .query("purchases")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .order("desc")
      .take(100);
    const claims = await ctx.db
      .query("claims")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .take(100);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .unique();
    return {
      purchases,
      claims,
      profile,
      integrations: {
        openai: !!process.env.OPENAI_API_KEY,
        firecrawl: !!process.env.FIRECRAWL_API_KEY,
        agentmail: !!process.env.AGENTMAIL_API_KEY,
      },
    };
  },
});
export const detail = query({
  args: { id: v.id("purchases") },
  returns: v.any(),
  handler: async (ctx, { id }) => {
    const purchase = await ownPurchase(ctx, id);
    const claim = await ctx.db
      .query("claims")
      .withIndex("by_purchaseId", (q) => q.eq("purchaseId", id))
      .unique();
    return {
      purchase,
      claim,
      policy: await ctx.db
        .query("policies")
        .withIndex("by_purchaseId", (q) => q.eq("purchaseId", id))
        .order("desc")
        .first(),
      snapshots: await ctx.db
        .query("priceSnapshots")
        .withIndex("by_purchaseId", (q) => q.eq("purchaseId", id))
        .order("desc")
        .take(30),
      events: await ctx.db
        .query("events")
        .withIndex("by_purchaseId", (q) => q.eq("purchaseId", id))
        .order("desc")
        .take(50),
      emails: claim
        ? await ctx.db
            .query("emails")
            .withIndex("by_claimId", (q) => q.eq("claimId", claim._id))
            .order("desc")
            .take(20)
        : [],
    };
  },
});
const SEED_VERSION = 2;
const DAY_MS = 86400000;
const CHILD_LIMIT = 200;

async function removeSamples(ctx: MutationCtx, uid: Id<"users">) {
  const rows = await ctx.db
    .query("purchases")
    .withIndex("by_userId", (q) => q.eq("userId", uid))
    .take(100);
  for (const p of rows.filter((r) => r.isDemo)) {
    for (const table of ["priceSnapshots", "events", "policies"] as const) {
      const children = await ctx.db
        .query(table)
        .withIndex("by_purchaseId", (q) => q.eq("purchaseId", p._id))
        .take(CHILD_LIMIT);
      for (const child of children) await ctx.db.delete(child._id);
    }
    const claim = await ctx.db
      .query("claims")
      .withIndex("by_purchaseId", (q) => q.eq("purchaseId", p._id))
      .unique();
    if (claim) {
      const emails = await ctx.db
        .query("emails")
        .withIndex("by_claimId", (q) => q.eq("claimId", claim._id))
        .take(CHILD_LIMIT);
      for (const email of emails) await ctx.db.delete(email._id);
      await ctx.db.delete(claim._id);
    }
    await ctx.db.delete(p._id);
  }
}

async function addSample(ctx: MutationCtx, uid: Id<"users">, item: Doc<"catalog">, index: number) {
  const now = Date.now();
  const current = item.currentPrice;
  const dropped = current !== undefined && current < item.samplePaid;
  const id = await ctx.db.insert("purchases", {
    userId: uid,
    merchant: item.merchant,
    productName: item.productName,
    orderNumber: `SAMPLE-${1001 + index}`,
    purchasePrice: item.samplePaid,
    currency: item.currency,
    purchaseDate: new Date(now - item.sampleDaysAgo * DAY_MS).toISOString().slice(0, 10),
    productUrl: item.productUrl,
    merchantWebsite: new URL(item.productUrl).origin,
    buyerEmail: "",
    quantity: 1,
    policyUrl: item.policyUrl,
    imageUrl: item.imageUrl,
    catalogSlug: item.slug,
    currentPrice: current,
    potentialRecovery: 0,
    status: dropped ? "Price Drop" : "Monitoring",
    category: item.category,
    isDemo: true,
    confirmed: true,
    createdAt: now - index * 1000,
    updatedAt: now,
    lastCheckedAt: item.checkedAt,
  });
  await event(
    ctx,
    id,
    "Sample order added",
    `A sample ${item.merchant} order so you can try Regretless. The product and store policy are real; the price paid is an example.`,
    "Regretless",
    "info",
  );
  if (current === undefined) return;
  await ctx.db.insert("priceSnapshots", {
    purchaseId: id,
    price: current,
    currency: item.currency,
    sourceUrl: item.productUrl,
    retrievedAt: item.checkedAt ?? now,
    content: item.priceQuote ?? "",
    pageTitle: item.productName,
    availability: "Listed",
    productIdentifier: item.slug,
    isDemo: false,
  });
  await event(
    ctx,
    id,
    dropped ? "Price dropped" : "Price checked",
    `${item.merchant} lists it at $${current.toFixed(2)}.`,
    "Firecrawl",
    dropped ? "success" : "info",
  );
}

/** Gives each new workspace sample orders of real products at real stores. */
export const seed = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const uid = await userId(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .unique();
    if (profile?.seedVersion === SEED_VERSION) return null;
    if (profile) await ctx.db.patch(profile._id, { seeded: true, seedVersion: SEED_VERSION });
    else
      await ctx.db.insert("profiles", {
        userId: uid,
        seeded: true,
        seedVersion: SEED_VERSION,
        createdAt: Date.now(),
      });
    await removeSamples(ctx, uid);
    const catalog = await ensureCatalog(ctx);
    for (const [index, item] of catalog.entries()) await addSample(ctx, uid, item, index);
    return null;
  },
});
export const create = mutation({
  args: { ...receiptFields, policyUrl: v.string() },
  returns: v.id("purchases"),
  handler: async (ctx, args) => {
    const uid = await userId(ctx);
    await quota(ctx, `receipts:${uid}`, 20);
    if (
      !Number.isFinite(args.purchasePrice) ||
      args.purchasePrice <= 0 ||
      args.purchasePrice > 100000 ||
      !Number.isInteger(args.quantity) ||
      args.quantity < 1 ||
      args.quantity > 100
    )
      throw new Error("Check price and quantity.");
    if (
      !/^[A-Z]{3}$/.test(args.currency) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(args.purchaseDate) ||
      !Number.isFinite(Date.parse(args.purchaseDate)) ||
      Date.parse(args.purchaseDate) > Date.now()
    )
      throw new Error("Check currency and purchase date.");
    for (const [k, value] of Object.entries(args))
      if (typeof value === "string" && value.length > 2000)
        throw new Error(`The ${k} field is too long.`);
    if (
      !args.productName.trim() ||
      !args.merchant.trim() ||
      !args.orderNumber.trim()
    )
      throw new Error("Product, merchant, and order number are required.");
    if (args.productUrl) safeUrl(args.productUrl);
    if (args.policyUrl) safeUrl(args.policyUrl);
    const existing = await ctx.db
      .query("purchases")
      .withIndex("by_userId_and_orderNumber", (q) =>
        q.eq("userId", uid).eq("orderNumber", args.orderNumber),
      )
      .first();
    if (existing && existing.merchant === args.merchant) return existing._id;
    const now = Date.now();
    const id = await ctx.db.insert("purchases", {
      ...args,
      userId: uid,
      status: "Purchased",
      potentialRecovery: 0,
      category: "package",
      isDemo: args.productUrl.includes("/demo/") || args.policyUrl.includes("/demo/"),
      confirmed: true,
      createdAt: now,
      updatedAt: now,
    });
    await event(
      ctx,
      id,
      "Receipt confirmed",
      "You reviewed and confirmed the extracted purchase details.",
      "Regretless",
    );
    return id;
  },
});
export const setUrls = mutation({
  args: {
    id: v.id("purchases"),
    productUrl: v.string(),
    policyUrl: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const p = await ownPurchase(ctx, a.id);
    if (["Sending", "Request Sent", "Merchant Replied", "Refund Approved", "Recovered"].includes(p.status)) throw new Error("Source evidence is locked for an active or resolved claim.");
    await ctx.db.patch(a.id, {
      productUrl: safeUrl(a.productUrl),
      policyUrl: safeUrl(a.policyUrl),
      updatedAt: Date.now(),
      runId: undefined,
      checkStartedAt: undefined,
      potentialRecovery: 0,
      status: "Purchased",
    });
    const claim = await ctx.db.query("claims").withIndex("by_purchaseId", q => q.eq("purchaseId", a.id)).unique();
    if (claim) await ctx.db.patch(claim._id, { status: "Needs Review", requestedAmount: 0 });
    return null;
  },
});
export const startCheck = mutation({
  args: { id: v.id("purchases") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const p = await ownPurchase(ctx, id);
    if (!p.confirmed) throw new Error("Review and confirm the receipt first.");
    if (!p.productUrl || !p.policyUrl)
      throw new Error("Add the product and policy URLs first.");
    if (p.checkStartedAt && Date.now() - p.checkStartedAt < 180000)
      throw new Error("A check is already running.");
    if (
      [
        "Sending",
        "Request Sent",
        "Merchant Replied",
        "Refund Approved",
        "Recovered",
      ].includes(p.status)
    )
      throw new Error("This claim is already in progress.");
    await quota(ctx, `checks:${p.userId}`, 10);
    await quota(ctx, "checks:global", 100);
    const runId = crypto.randomUUID();
    await ctx.db.patch(id, {
      status: "Monitoring",
      runId,
      checkStartedAt: Date.now(),
      error: undefined,
      potentialRecovery: 0,
    });
    await event(
      ctx,
      id,
      "Checking the current price",
      "Retrieving the supplied product page.",
      "Firecrawl",
      "info",
    );
    await ctx.scheduler.runAfter(0, internal.pipeline.check, { id, runId });
    return null;
  },
});
export const replay = mutation({
  args: { id: v.id("purchases") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const p = await ownPurchase(ctx, id);
    if (!p.isDemo) throw new Error("Only demo purchases can be replayed.");
    if (p.checkStartedAt && Date.now() - p.checkStartedAt < 20000) return null;
    await quota(ctx, `replay:${p.userId}`, 30);
    const runId = crypto.randomUUID();
    await ctx.db.patch(id, {
      status: "Purchased",
      potentialRecovery: 0,
      runId,
      checkStartedAt: Date.now(),
    });
    await event(
      ctx,
      id,
      "Demo replay started",
      "Simulated stages persisted in Convex. No API requests or emails are sent.",
      "Demo",
      "info",
    );
    await ctx.scheduler.runAfter(900, internal.purchases.demoStep, {
      id,
      runId,
      step: 0,
    });
    return null;
  },
});
export const demoStep = internalMutation({
  args: { id: v.id("purchases"), runId: v.string(), step: v.number() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const p = await ctx.db.get(a.id);
    if (!p || !p.isDemo || p.runId !== a.runId) return null;
    const stages = [
      "Monitoring",
      "Price Drop",
      "Checking Policy",
      "Eligible",
      "Claim Ready",
    ];
    const titles = [
      "Product located",
      "Price drop detected",
      "Policy interpreted",
      "Likely eligible",
      "Request generated",
    ];
    if (a.step >= stages.length) return null;
    const amount = Math.max(
      0,
      Math.round(
        (p.purchasePrice - (p.currentPrice ?? p.purchasePrice)) * 100,
      ) / 100,
    );
    await ctx.db.patch(p._id, {
      status: stages[a.step],
      potentialRecovery: a.step >= 3 ? amount : 0,
      updatedAt: Date.now(),
      ...(a.step === 4 ? { checkStartedAt: undefined } : {}),
    });
    await event(
      ctx,
      p._id,
      titles[a.step],
      `Illustrative demo stage${a.step === 1 ? `: $${amount.toFixed(2)} price difference` : ""}.`,
      "Demo",
    );
    if (a.step < 4)
      await ctx.scheduler.runAfter(1250, internal.purchases.demoStep, {
        ...a,
        step: a.step + 1,
      });
    else {
      const c = await ctx.db
        .query("claims")
        .withIndex("by_purchaseId", (q) => q.eq("purchaseId", p._id))
        .unique();
      if (c)
        await ctx.db.patch(c._id, {
          status: "Claim Ready",
          requestedAmount: amount,
        });
    }
    return null;
  },
});
export const getInternal = internalQuery({
  args: { id: v.id("purchases") },
  returns: v.any(),
  handler: async (ctx, { id }) => ctx.db.get(id),
});
