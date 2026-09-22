import { mutation, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { ownPurchase, userId, event, quota } from "./lib/access";
export const saveDraft = mutation({
  args: {
    purchaseId: v.id("purchases"),
    subject: v.string(),
    body: v.string(),
    recipient: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    await ownPurchase(ctx, a.purchaseId);
    const c = await ctx.db
      .query("claims")
      .withIndex("by_purchaseId", (q) => q.eq("purchaseId", a.purchaseId))
      .unique();
    if (!c || !["Eligible", "Claim Ready"].includes(c.status))
      throw new Error("This draft can no longer be edited.");
    if (
      a.body.length > 12000 ||
      a.subject.length > 200 ||
      a.recipient.length > 254
    )
      throw new Error("Draft exceeds the permitted length.");
    await ctx.db.patch(c._id, {
      draftSubject: a.subject,
      draftBody: a.body,
      recipient: a.recipient,
    });
    return null;
  },
});
export const approve = mutation({
  args: { purchaseId: v.id("purchases"), confirmed: v.boolean() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const p = await ownPurchase(ctx, a.purchaseId);
    if (!a.confirmed) throw new Error("Explicit approval is required.");
    if (p.isDemo)
      throw new Error(
        "Demo purchases cannot send real merchant claims. Add a real receipt first.",
      );
    const c = await ctx.db
      .query("claims")
      .withIndex("by_purchaseId", (q) => q.eq("purchaseId", p._id))
      .unique();
    if (!c) throw new Error("Generate a claim first.");
    if (c.sendAttemptId) return null;
    if (
      !["Eligible", "Claim Ready"].includes(c.status) ||
      p.potentialRecovery <= 0 ||
      !c.draftBody.trim() ||
      !c.draftSubject.trim()
    )
      throw new Error("A supported claim and completed draft are required.");
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(c.recipient))
      throw new Error("Enter one valid merchant email address.");
    const policy = await ctx.db
      .query("policies")
      .withIndex("by_purchaseId", (q) => q.eq("purchaseId", p._id))
      .order("desc")
      .first();
    if (
      !policy?.eligible ||
      policy.windowDays === null ||
      Date.now() - Date.parse(p.purchaseDate) >
        (policy.windowDays + 1) * 86400000 ||
      Date.now() - (p.lastCheckedAt ?? 0) > 86400000
    )
      throw new Error("Refresh the price and policy evidence before sending.");
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", p.userId))
      .unique();
    if (!profile?.inboxId || !process.env.AGENTMAIL_API_KEY)
      throw new Error("Connect your receipt inbox first.");
    await quota(ctx, `send:${p.userId}`, 3);
    await quota(ctx, "send:global", 20);
    const attemptId = crypto.randomUUID();
    await ctx.db.patch(c._id, { status: "Sending", sendAttemptId: attemptId });
    await ctx.db.patch(p._id, { status: "Sending", updatedAt: Date.now() });
    await event(
      ctx,
      p._id,
      "You approved the request",
      "Sending the exact reviewed draft. No automatic duplicate retries.",
      "AgentMail",
      "info",
    );
    await ctx.scheduler.runAfter(0, internal.mail.send, {
      claimId: c._id,
      attemptId,
    });
    return null;
  },
});
export const confirmRecovery = mutation({
  args: { purchaseId: v.id("purchases"), confirmed: v.boolean() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const p = await ownPurchase(ctx, a.purchaseId);
    if (!a.confirmed) throw new Error("Confirm that the refund has arrived.");
    const c = await ctx.db
      .query("claims")
      .withIndex("by_purchaseId", (q) => q.eq("purchaseId", p._id))
      .unique();
    if (!c || c.status !== "Refund Approved")
      throw new Error("Merchant approval is required first.");
    await ctx.db.patch(c._id, {
      status: "Recovered",
      recoveredAmount: c.requestedAmount,
      resolvedAt: Date.now(),
    });
    await ctx.db.patch(p._id, {
      status: "Recovered",
      potentialRecovery: 0,
      updatedAt: Date.now(),
    });
    await event(
      ctx,
      p._id,
      "Refund received",
      `You confirmed receipt of ${p.currency} ${c.requestedAmount.toFixed(2)}.`,
    );
    return null;
  },
});
export const sendContext = internalQuery({
  args: { claimId: v.id("claims") },
  returns: v.any(),
  handler: async (ctx, { claimId }) => {
    const claim = await ctx.db.get(claimId);
    if (!claim) return null;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", claim.userId))
      .unique();
    return { claim, profile };
  },
});
export const sent = internalMutation({
  args: {
    claimId: v.id("claims"),
    attemptId: v.string(),
    messageId: v.string(),
    threadId: v.string(),
    sender: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const c = await ctx.db.get(a.claimId);
    if (!c || c.sendAttemptId !== a.attemptId || c.messageId) return null;
    const now = Date.now();
    await ctx.db.patch(c._id, {
      status: "Request Sent",
      messageId: a.messageId,
      threadId: a.threadId,
      sentAt: now,
    });
    await ctx.db.patch(c.purchaseId, {
      status: "Request Sent",
      updatedAt: now,
    });
    await ctx.db.insert("emails", {
      userId: c.userId,
      claimId: c._id,
      direction: "outbound",
      messageId: a.messageId,
      threadId: a.threadId,
      sender: a.sender,
      recipient: c.recipient,
      subject: c.draftSubject,
      body: c.draftBody,
      receivedAt: now,
    });
    await event(
      ctx,
      c.purchaseId,
      "Request sent",
      "AgentMail accepted your approved email. Awaiting the merchant's reply.",
      "AgentMail",
    );
    return null;
  },
});
export const sendFailed = internalMutation({
  args: { claimId: v.id("claims") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const c = await ctx.db.get(a.claimId);
    if (c && !c.messageId) {
      await ctx.db.patch(c._id, {
        status: "Needs Review",
        sendError:
          "Delivery could not be confirmed. Check the AgentMail inbox before retrying; automatic resend is disabled to avoid duplicates.",
      });
      await ctx.db.patch(c.purchaseId, { status: "Needs Review" });
      await event(
        ctx,
        c.purchaseId,
        "Delivery needs review",
        "An uncertain delivery is never automatically retried.",
        "AgentMail",
        "warning",
      );
    }
    return null;
  },
});
export const profile = internalQuery({
  args: { userId: v.id("users") },
  returns: v.any(),
  handler: async (ctx, a) =>
    ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", a.userId))
      .unique(),
});
export const inboxSaved = internalMutation({
  args: { userId: v.id("users"), inboxId: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const p = await ctx.db
      .query("profiles")
      .withIndex("by_userId", (q) => q.eq("userId", a.userId))
      .unique();
    if (p) await ctx.db.patch(p._id, { inboxId: a.inboxId });
    else
      await ctx.db.insert("profiles", {
        ...a,
        seeded: false,
        createdAt: Date.now(),
      });
    return null;
  },
});
export const inboundContext = internalQuery({
  args: { inboxId: v.string(), messageId: v.string(), threadId: v.string() },
  returns: v.any(),
  handler: async (ctx, a) => {
    const existing = await ctx.db
      .query("emails")
      .withIndex("by_messageId", (q) => q.eq("messageId", a.messageId))
      .first();
    if (existing) return null;
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_inboxId", (q) => q.eq("inboxId", a.inboxId))
      .unique();
    if (!profile) return null;
    const claim = await ctx.db
      .query("claims")
      .withIndex("by_threadId", (q) => q.eq("threadId", a.threadId))
      .first();
    return { profile, claim: claim?.userId === profile.userId ? claim : null };
  },
});
export const inboundSaved = internalMutation({
  args: {
    userId: v.id("users"),
    claimId: v.optional(v.id("claims")),
    messageId: v.string(),
    threadId: v.string(),
    sender: v.string(),
    recipient: v.string(),
    subject: v.string(),
    body: v.string(),
    classification: v.string(),
    summary: v.string(),
    receipt: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    if (
      await ctx.db
        .query("emails")
        .withIndex("by_messageId", (q) => q.eq("messageId", a.messageId))
        .first()
    )
      return null;
    const { summary, receipt, ...email } = a;
    await ctx.db.insert("emails", {
      ...email,
      direction: "inbound",
      receivedAt: Date.now(),
    });
    if (a.claimId) {
      const c = await ctx.db.get(a.claimId);
      if (!c || c.userId !== a.userId) return null;
      const st =
        a.classification === "approved"
          ? "Refund Approved"
          : "Merchant Replied";
      await ctx.db.patch(c._id, { status: st, replySummary: summary });
      await ctx.db.patch(c.purchaseId, { status: st });
      await event(
        ctx,
        c.purchaseId,
        "Merchant replied",
        summary,
        "AgentMail + OpenAI",
      );
    } else if (
      receipt &&
      receipt.productName &&
      receipt.merchant &&
      Number.isFinite(receipt.purchasePrice) &&
      receipt.purchasePrice > 0
    ) {
      const id = await ctx.db.insert("purchases", {
        ...receipt,
        userId: a.userId,
        policyUrl: "",
        category: "package",
        isDemo: false,
        confirmed: false,
        potentialRecovery: 0,
        status: "Purchased",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await event(
        ctx,
        id,
        "Forwarded receipt detected",
        "Review the extracted receipt before monitoring.",
        "AgentMail + OpenAI",
      );
    }
    return null;
  },
});
export const acceptInbound = mutation({
  args: { id: v.id("purchases") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    await ownPurchase(ctx, id);
    await ctx.db.patch(id, { confirmed: true });
    await event(
      ctx,
      id,
      "Receipt confirmed",
      "You reviewed the forwarded receipt details.",
    );
    return null;
  },
});
