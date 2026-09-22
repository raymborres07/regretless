import { internalAction, internalMutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { crawlProduct, priceIsOnPage } from "./lib/firecrawl";
import { event } from "./lib/access";

const TARGET_POLICY = "https://www.target.com/help/articles/policies-guidelines/price-match-guarantee";
const FAN_OUT_LIMIT = 500;

/**
 * Real products and real store policies. Only `samplePaid` and `sampleDaysAgo`
 * are invented: they describe the example order a visitor starts with.
 */
export const CATALOG = [
  {
    slug: "sony-wh1000xm5",
    productName: "Sony WH-1000XM5 Wireless Noise-Canceling Headphones",
    brand: "Sony",
    merchant: "Target",
    category: "headphones",
    productUrl: "https://www.target.com/p/sony-wh-1000xm5-bluetooth-wireless-noise-canceling-headphones-black/-/A-86314264",
    policyUrl: TARGET_POLICY,
    samplePaid: 399.99,
    sampleDaysAgo: 6,
  },
  {
    slug: "airpods-pro-2",
    productName: "Apple AirPods Pro 2 with MagSafe Case (USB-C)",
    brand: "Apple",
    merchant: "Target",
    category: "earbuds",
    productUrl: "https://www.target.com/p/airpods-pro-2nd-generation-with-magsafe-case-usb-c/-/A-85978622",
    policyUrl: TARGET_POLICY,
    samplePaid: 249.99,
    sampleDaysAgo: 9,
  },
  {
    slug: "ninja-af141",
    productName: "Ninja Pro 4-in-1 Air Fryer, 5 Qt (AF141)",
    brand: "Ninja",
    merchant: "Target",
    category: "kitchen",
    productUrl: "https://www.target.com/p/ninja-air-fryer-pro-4-in-1-af141/-/A-90569368",
    policyUrl: TARGET_POLICY,
    samplePaid: 129.99,
    sampleDaysAgo: 3,
  },
  {
    slug: "sony-wf1000xm5",
    productName: "Sony WF-1000XM5 Noise-Canceling Earbuds",
    brand: "Sony",
    merchant: "Target",
    category: "earbuds",
    productUrl: "https://www.target.com/p/sony-wf1000xm5-b-true-wireless-bluetooth-noise-canceling-earbuds-black/-/A-88914420",
    policyUrl: TARGET_POLICY,
    samplePaid: 329.99,
    sampleDaysAgo: 4,
  },
] as const;

/** Inserts or updates the static catalog fields; keeps live price data. */
export async function ensureCatalog(ctx: MutationCtx): Promise<Doc<"catalog">[]> {
  const rows: Doc<"catalog">[] = [];
  for (const item of CATALOG) {
    const existing = await ctx.db
      .query("catalog")
      .withIndex("by_slug", (q) => q.eq("slug", item.slug))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { ...item });
      rows.push({ ...existing, ...item });
    } else {
      const id = await ctx.db.insert("catalog", { ...item, currency: "USD" });
      const created = await ctx.db.get(id);
      if (created) rows.push(created);
    }
  }
  return rows;
}

export const ensure = internalMutation({
  args: {},
  returns: v.array(v.object({ slug: v.string(), productUrl: v.string() })),
  handler: async (ctx) =>
    (await ensureCatalog(ctx)).map(({ slug, productUrl }) => ({ slug, productUrl })),
});

/** Shared live-price refresh for the sample products; runs on a cron. */
export const refresh = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const items = await ctx.runMutation(internal.catalog.ensure, {});
    for (const item of items) {
      try {
        const page = await crawlProduct(item.productUrl);
        const { price, priceText } = page.listing;
        const verified = price !== null && price > 0 && priceIsOnPage(price, page.content);
        await ctx.runMutation(internal.catalog.record, {
          slug: item.slug,
          price: verified ? price : undefined,
          priceQuote: verified ? priceText : undefined,
          imageUrl: page.imageUrl,
          error: verified ? undefined : "The listed price could not be verified on the page.",
        });
      } catch (error) {
        await ctx.runMutation(internal.catalog.record, {
          slug: item.slug,
          error: error instanceof Error ? error.message.slice(0, 300) : "Price check failed.",
        });
      }
    }
    return null;
  },
});

const WATCHING = ["Purchased", "Monitoring", "Price Drop"];

export const record = internalMutation({
  args: {
    slug: v.string(),
    price: v.optional(v.number()),
    priceQuote: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const row = await ctx.db
      .query("catalog")
      .withIndex("by_slug", (q) => q.eq("slug", a.slug))
      .unique();
    if (!row) return null;
    const now = Date.now();
    await ctx.db.patch(row._id, {
      error: a.error,
      ...(a.imageUrl ? { imageUrl: a.imageUrl } : {}),
      ...(a.price !== undefined ? { currentPrice: a.price, priceQuote: a.priceQuote, checkedAt: now } : {}),
    });
    if (a.price === undefined) return null;
    // Live update every sample workspace that is still only watching the price.
    const purchases = await ctx.db
      .query("purchases")
      .withIndex("by_catalogSlug", (q) => q.eq("catalogSlug", a.slug))
      .take(FAN_OUT_LIMIT);
    for (const p of purchases) {
      if (!WATCHING.includes(p.status) || p.checkStartedAt) continue;
      const status = a.price < p.purchasePrice ? "Price Drop" : "Monitoring";
      await ctx.db.patch(p._id, {
        currentPrice: a.price,
        imageUrl: a.imageUrl ?? p.imageUrl,
        lastCheckedAt: now,
        status,
        updatedAt: now,
      });
      if (p.currentPrice !== a.price)
        await event(
          ctx,
          p._id,
          status === "Price Drop" ? "Price dropped" : "Price checked",
          `${row.merchant} lists it at $${a.price.toFixed(2)} today.`,
          "Firecrawl",
          status === "Price Drop" ? "success" : "info",
        );
    }
    return null;
  },
});
