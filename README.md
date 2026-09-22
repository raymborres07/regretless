# Regretless

**Cashback apps stop working when you hit Buy. Regretless starts working.**

A post-purchase money-recovery agent built with Codex for the Convex All Gas Hackathon. Prices, evidence, drafts and email activity live in Convex, with realtime dashboard subscriptions.

Live app: https://third-clam-324.convex.site

## Run locally

Requires Node.js 22+ and a Convex account.

```sh
npm install
npx convex dev --once
node scripts/configure.mjs
npm run backend
# In another terminal:
npm run dev
```

Put server credentials in the ignored `.env.local` file, preserving the Convex-generated settings. Never prefix secrets with `VITE_` or paste them into chat. Required: `OPENAI_API_KEY`, `FIRECRAWL_API_KEY`, `AGENTMAIL_API_KEY`. Optional: `OPENAI_MODEL` (defaults to `gpt-4.1-mini`). Run `node scripts/configure.mjs` to transfer them to Convex without printing values.

Anonymous Convex Auth creates an isolated workspace in this browser. Clearing browser storage loses access; cross-device accounts and account recovery are not implemented. Do not use this hackathon build as an archive for important receipts.

## What is real, and what is a demo?

- All purchases, events, policies, claims and emails are stored in Convex, including demo fixtures. No client-only fake backend.
- The six initial purchases and $147.38 recovered total are explicitly illustrative, not money actually recovered.
- **Replay demo** schedules labeled synthetic events in Convex. It does not call sponsor APIs or send email.
- **Check live prices** uses Firecrawl's scrape API and OpenAI structured outputs, verifies quoted evidence, checks currency, item matching, price difference and policy window, and drafts only supported requests.
- Manual receipt entry is available without an API key. AI extraction requires OpenAI.
- AgentMail creates a private receipt inbox, sends an explicitly approved draft, and retrieves replies. Demo purchases cannot send real merchant claims.
- Live provider end-to-end extraction and email delivery remain unverified until OpenAI and AgentMail credentials are connected. Missing credentials produce visible errors, not fabricated success.

## Three-minute walkthrough

For a no-credit recording, open **Recording desk** in the top bar. It includes five presentation chapters, optional narration notes, and the existing Convex-backed scenario replay. See [RECORDING.md](RECORDING.md) for a 2:30 script. It deliberately does not simulate a successful real email send or claim live AI execution.

1. Open the dashboard and point out the **Example** labels and recovered/potential totals.
2. Open the Sony headphones card. Replay the illustrative $449 → $399 flow and watch Convex update the timeline live.
3. Open **Policy & evidence**, then **Claim request**. Explain that seed evidence is fictional and sending is disabled for examples.
4. With credentials connected: add an actual receipt, confirm extracted values, supply the product and policy URLs, and click **Check live prices**. Outcomes depend on the retailer's current price and published terms.
5. Connect the receipt inbox. Review the recipient and editable draft, then explicitly approve sending. AgentMail acceptance moves the claim to **Request Sent**.
6. Use **Sync inbox** to retrieve a reply, or configure the webhook below. Approval means **Refund Approved**; the user must confirm receipt of funds before **Recovered**.

Reproducible, publicly hosted retrieval fixtures are at `/demo/nova-headphones.html` and `/demo/nova-policy.html`. These fictional pages model a $399 listing and a 14-day adjustment policy; they are not a real retailer offer. Use these URLs on an existing example purchase to exercise live retrieval and AI reasoning. They must never be used to request money from a real merchant.

## Inbound email

In AgentMail, configure `message.received` events to `https://<deployment>.convex.site/api/agentmail`. Set its signing secret as `AGENTMAIL_WEBHOOK_SECRET` on the corresponding Convex deployment. The endpoint verifies Svix signatures, fetches the authoritative message, deduplicates message IDs, and routes by the owned inbox and thread. Unmatched receipts await user confirmation. The manual **Sync inbox** route works without a webhook.

## Test and deploy

```sh
npm test
npm run build
node scripts/configure.mjs --prod
npx convex deploy -y
npm run deploy -- --skip-convex
```

The production configuration command copies configured sponsor credentials from development when they are not in the local file. Each deployment gets separate auth signing keys. Static Hosting builds with the production Convex URL and serves the entire application on `convex.site`; no local server is needed.

## Architecture and safeguards

`convex/purchases.ts` owns intake, fixtures and monitoring requests; `pipeline.ts` orchestrates Firecrawl and OpenAI; `pipelineStore.ts` persists step results. `claims.ts` gates reviewed sends and owns claim transitions; `mail.ts` integrates AgentMail; `http.ts` verifies inbound webhooks. A six-hour cron checks eligible due purchases, bounded by quotas. The React dashboard subscribes directly to Convex queries.

Public operations enforce authenticated ownership. Provider quotas limit abuse; sender approval is explicit, and an ambiguous sending failure is never automatically retried. Evidence must be quoted from the retrieved source; uncertain policies require review. Source edits invalidate eligibility. Raw receipt text is not retained after extraction; inbound message text and necessary order details are retained for the workflow. No payment-card or postal-address fields are extracted. Policy interpretation is not legal advice and refunds are never guaranteed.

Current limits: single-item extraction, user-supplied policy URLs, 100-purchase dashboard bound, anonymous sessions, no automatic retry/resume of failed provider steps, no attachment/PDF parsing, and no deletion/export UI. Multi-currency receipts are stored; aggregate monetary metrics count USD purchases only without currency conversion. Use a private test deployment before processing sensitive receipts.

Roadmap: missed promotions, delivery guarantees, return deadlines, subscriptions, warranties, recalls and duplicate charges.
