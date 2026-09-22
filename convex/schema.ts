import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";
export const status = v.union(
  ...[
    "Purchased",
    "Monitoring",
    "Price Drop",
    "Checking Policy",
    "Eligible",
    "Claim Ready",
    "Sending",
    "Request Sent",
    "Merchant Replied",
    "Refund Approved",
    "Recovered",
    "Not Eligible",
    "Expired",
    "Needs Review",
    "Check Failed",
  ].map((s) => v.literal(s)),
);
export const receiptFields = {
  merchant: v.string(),
  productName: v.string(),
  orderNumber: v.string(),
  purchasePrice: v.number(),
  currency: v.string(),
  purchaseDate: v.string(),
  productUrl: v.string(),
  merchantWebsite: v.string(),
  buyerEmail: v.string(),
  quantity: v.number(),
};
export default defineSchema({
  ...authTables,
  profiles: defineTable({
    userId: v.id("users"),
    inboxId: v.optional(v.string()),
    seeded: v.boolean(),
    seedVersion: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_inboxId", ["inboxId"]),
  // Real products at real stores, shared by every sample workspace. A cron
  // refreshes the live price and photo through Firecrawl.
  catalog: defineTable({
    slug: v.string(),
    productName: v.string(),
    brand: v.string(),
    merchant: v.string(),
    category: v.string(),
    productUrl: v.string(),
    policyUrl: v.string(),
    samplePaid: v.number(),
    sampleDaysAgo: v.number(),
    currency: v.string(),
    currentPrice: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
    priceQuote: v.optional(v.string()),
    checkedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  }).index("by_slug", ["slug"]),
  purchases: defineTable({
    userId: v.id("users"),
    ...receiptFields,
    policyUrl: v.string(),
    imageUrl: v.optional(v.string()),
    catalogSlug: v.optional(v.string()),
    currentPrice: v.optional(v.number()),
    potentialRecovery: v.number(),
    status,
    category: v.string(),
    isDemo: v.boolean(),
    confirmed: v.boolean(),
    lastCheckedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    runId: v.optional(v.string()),
    checkStartedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_orderNumber", ["userId", "orderNumber"])
    .index("by_status_and_lastCheckedAt", ["status", "lastCheckedAt"])
    .index("by_catalogSlug", ["catalogSlug"]),
  priceSnapshots: defineTable({
    purchaseId: v.id("purchases"),
    price: v.number(),
    currency: v.string(),
    sourceUrl: v.string(),
    retrievedAt: v.number(),
    content: v.string(),
    pageTitle: v.string(),
    availability: v.string(),
    productIdentifier: v.string(),
    isDemo: v.boolean(),
  }).index("by_purchaseId", ["purchaseId"]),
  policies: defineTable({
    purchaseId: v.id("purchases"),
    sourceUrl: v.string(),
    content: v.string(),
    retrievedAt: v.number(),
    policyType: v.string(),
    adjustmentsAllowed: v.boolean(),
    windowDays: v.union(v.number(), v.null()),
    eligible: v.boolean(),
    confidence: v.number(),
    reason: v.string(),
    exclusions: v.array(v.string()),
    evidence: v.array(v.object({ quote: v.string(), sourceUrl: v.string() })),
    isDemo: v.boolean(),
  }).index("by_purchaseId", ["purchaseId"]),
  claims: defineTable({
    purchaseId: v.id("purchases"),
    userId: v.id("users"),
    status,
    requestedAmount: v.number(),
    recoveredAmount: v.number(),
    draftSubject: v.string(),
    draftBody: v.string(),
    recipient: v.string(),
    sentAt: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
    messageId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    sendAttemptId: v.optional(v.string()),
    sendError: v.optional(v.string()),
    replySummary: v.optional(v.string()),
  })
    .index("by_purchaseId", ["purchaseId"])
    .index("by_userId", ["userId"])
    .index("by_threadId", ["threadId"]),
  emails: defineTable({
    userId: v.id("users"),
    claimId: v.optional(v.id("claims")),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    messageId: v.string(),
    threadId: v.string(),
    sender: v.string(),
    recipient: v.string(),
    subject: v.string(),
    body: v.string(),
    receivedAt: v.number(),
    classification: v.optional(v.string()),
  })
    .index("by_claimId", ["claimId"])
    .index("by_messageId", ["messageId"]),
  events: defineTable({
    purchaseId: v.id("purchases"),
    title: v.string(),
    detail: v.string(),
    provider: v.string(),
    at: v.number(),
    kind: v.union(
      v.literal("success"),
      v.literal("info"),
      v.literal("warning"),
    ),
  }).index("by_purchaseId", ["purchaseId"]),
  usage: defineTable({ key: v.string(), count: v.number() }).index("by_key", [
    "key",
  ]),
  webhookEvents: defineTable({
    eventId: v.string(),
    processedAt: v.number(),
  }).index("by_eventId", ["eventId"]),
});
