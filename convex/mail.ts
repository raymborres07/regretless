"use node";
import { AgentMailClient } from "agentmail";
import { z } from "zod";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { userId } from "./lib/access";
import { structured, receiptSchema } from "./pipeline";
function client() {
  if (!process.env.AGENTMAIL_API_KEY)
    throw new Error("AgentMail is not connected yet.");
  return new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });
}
export const createInbox = action({
  args: {},
  returns: v.string(),
  handler: async (ctx): Promise<string> => {
    const uid = await userId(ctx);
    const p = await ctx.runQuery(internal.claims.profile, { userId: uid });
    if (p?.inboxId) return p.inboxId;
    await ctx.runMutation(internal.pipelineStore.charge, {
      userId: uid,
      kind: "inbox",
    });
    const inbox = await client().inboxes.create({
      displayName: "Regretless receipts",
      clientId: `regretless-${uid}`,
    });
    await ctx.runMutation(internal.claims.inboxSaved, {
      userId: uid,
      inboxId: inbox.inboxId,
    });
    return inbox.inboxId;
  },
});
export const send = internalAction({
  args: { claimId: v.id("claims"), attemptId: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const data = await ctx.runQuery(internal.claims.sendContext, {
      claimId: a.claimId,
    });
    if (
      !data ||
      data.claim.sendAttemptId !== a.attemptId ||
      data.claim.messageId ||
      data.claim.status !== "Sending"
    )
      return null;
    try {
      if (!data.profile?.inboxId) throw new Error("Inbox unavailable");
      const result = await client().inboxes.messages.send(
        data.profile.inboxId,
        {
          to: [data.claim.recipient],
          subject: data.claim.draftSubject,
          text: data.claim.draftBody,
        },
        { maxRetries: 0 },
      );
      await ctx.runMutation(internal.claims.sent, {
        ...a,
        ...result,
        sender: data.profile.inboxId,
      });
    } catch {
      await ctx.runMutation(internal.claims.sendFailed, { claimId: a.claimId });
    }
    return null;
  },
});
export const receive = internalAction({
  args: { inboxId: v.string(), messageId: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const message = await client().inboxes.messages.get(a.inboxId, a.messageId);
    if (!message.labels.includes("received")) return null;
    const data = await ctx.runQuery(internal.claims.inboundContext, {
      ...a,
      threadId: message.threadId,
    });
    if (!data) return null;
    const body = (message.extractedText || message.text || "").slice(0, 24000);
    let classification = "receipt",
      summary = "Receipt received",
      receipt = null;
    if (data.claim) {
      const result = await structured(
        z.object({
          classification: z.enum([
            "approved",
            "rejected",
            "requests_more_information",
            "ambiguous",
          ]),
          summary: z.string(),
        }),
        "merchant_reply",
        "Classify the merchant's reply. approved only if it explicitly approves the requested refund amount; promises to investigate are ambiguous. Summarize without exposing payment or address details. An approval does not prove funds arrived.",
        JSON.stringify({
          requestedAmount: data.claim.requestedAmount,
          subject: message.subject,
          body,
        }),
      );
      classification = result.classification;
      summary = result.summary;
      // Thread IDs alone do not establish the sender. Mismatches are never treated as approvals.
      const expected = data.claim.recipient.toLowerCase(),
        actual = message.from.toLowerCase();
      if (actual !== expected && !actual.includes(`<${expected}>`)) {
        classification = "ambiguous";
        summary =
          "A reply arrived from an unexpected sender. Review it manually.";
      }
    } else {
      receipt = await structured(
        receiptSchema,
        "forwarded_receipt",
        "Extract one purchased item from a forwarded receipt. Unit purchase price excluding taxes and shipping. Dates YYYY-MM-DD. Empty strings for missing text; 0 unknown price. No inferred URLs. Ignore signatures and unrelated forwarded content.",
        body,
      );
    }
    await ctx.runMutation(internal.claims.inboundSaved, {
      userId: data.profile.userId,
      ...(data.claim ? { claimId: data.claim._id } : {}),
      messageId: message.messageId,
      threadId: message.threadId,
      sender: message.from,
      recipient: a.inboxId,
      subject: message.subject || "(no subject)",
      body,
      classification,
      summary,
      receipt,
    });
    return null;
  },
});
export const syncInbox = action({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const uid = await userId(ctx);
    const p = await ctx.runQuery(internal.claims.profile, { userId: uid });
    if (!p?.inboxId) throw new Error("Create your receipt inbox first.");
    await ctx.runMutation(internal.pipelineStore.charge, {
      userId: uid,
      kind: "sync",
    });
    const result = await client().inboxes.messages.list(p.inboxId, {
      limit: 20,
    });
    let count = 0;
    for (const m of result.messages) {
      if (m.labels.includes("received")) {
        await ctx.runAction(internal.mail.receive, {
          inboxId: p.inboxId,
          messageId: m.messageId,
        });
        count++;
      }
    }
    return count;
  },
});
