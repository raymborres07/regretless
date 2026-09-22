# Hackathon log

- **Project:** Regretless
- **Event:** Convex All Gas Hackathon
- **What it does:** Tracks post-purchase price drops, evaluates policy evidence, and prepares human-approved recovery requests.
- **Live app:** https://third-clam-324.convex.site
- **Repo:** https://github.com/raymborres07/regretless
- **Frontend:** Convex static hosting
- **Convex deployment:** https://third-clam-324.convex.cloud
- **Components:** @convex-dev/static-hosting, @convex-dev/rate-limiter
- **Convex features:** schema, indexes, realtime queries, mutations, actions, HTTP actions, scheduled functions, crons
- **Auth:** Convex Auth
- **AI models:** gpt-4.1-mini (OpenAI Responses API, structured outputs)
- **Started:** 2026-09-22T01:50:52Z
- **Last updated:** 2026-09-22T15:14:30Z

## Log

### 2026-09-22
Started the public build log for the Convex All Gas Hackathon and selected
Convex static hosting as the frontend target. No application code or deployment
exists yet.

### 2026-09-22 — application build
Built a React dashboard with private anonymous sessions, six explicitly labeled
example purchases, receipt confirmation, source evidence, editable claims and a
realtime timeline (`src/App.tsx`, `convex/purchases.ts`, `convex/schema.ts`).
Implemented Firecrawl/OpenAI evidence processing and approval-gated AgentMail
sending, signed inbound webhooks and reply classification. These email and AI
paths are implemented but not live-verified: two provider credentials remain missing.

### 2026-09-22 — verification and deployment
Passed 35 automated eligibility and authorization tests and the production build.
Deployed backend and frontend through Convex Static Hosting; the hosted dashboard
loads with authenticated seed data. Real Firecrawl calls successfully retrieved
the explicitly fictional $399 product page and 14-day policy fixture.
Documented setup, demo limitations and safety in README.md. Source inspection and
observed commands are evidence; there is no Git history yet. No email was sent.
Verified the hosted replay reaches Claim Ready with $50. Improved small-screen
purchase readability and retained the demo disclosure. Monetary aggregates count
USD only. The public-source credential-pattern scan and log address scan were clean.

### 2026-09-22 — recording walkthrough
Added a five-chapter recording desk with large visuals, optional narration notes,
and the existing Convex-backed scenario replay (`src/RecordingDesk.tsx`). Kept
simulated evidence and unsent email clearly labeled; no provider execution is
fabricated. Added a 2:30 script in RECORDING.md. Build and 35 tests pass; local
browser checks cover chapter navigation and narration controls. Publishing is
frontend-only with the user's explicit approval; no backend changes or email sends.
Published the recording UI through Convex Static Hosting to the existing live URL.

### 2026-09-22 — one-minute app recording
Recorded the normal application against development: dashboard, receipt paste,
manual entry, example replay, policy review and the unsent claim draft. Exported
a silent 1920×1080 MP4 of exactly 60 seconds with short intro/outro and chapter
captions; checked representative frames and media metadata. Added timestamped
voiceover cues in artifacts/VOICEOVER-60s.md. No live AI or email execution is implied.

### 2026-09-22 — pitch guide
Added a script that generates a three-page, three-minute pitch and click guide
PDF for the submission video (`scripts/create-pitch-pdf.py`). Submission
material only; no application or backend changes. Evidence is file modification
time; there is no Git history yet.

### 2026-09-22 — real products and consumer redesign
Replaced the fictional sample stores with real products at Target (Sony
WH-1000XM5, Sony WF-1000XM5, AirPods Pro 2, Ninja AF141) linked to Target's real
price-match policy; only the sample price paid is invented and labelled. A shared
`catalog` table and a 6-hour cron use Firecrawl JSON extraction to pull the live
price and product photo, verify the price appears on the page, and push it live to
every workspace (`convex/catalog.ts`, `convex/lib/firecrawl.ts`, `convex/crons.ts`).
Rebuilt the UI as a consumer app: plain-language statuses, one next step per
purchase, progress tracker, simple add-purchase flow (`src/components/`).
Verified on the dev deployment: Target listed the WH-1000XM5 at $299.99 (a $100
drop against the $399.99 sample). OpenAI and AgentMail keys are not yet set, so
policy reading and sending were not exercised. 38 tests and the build pass. ASICS
was dropped because asics.com blocked retrieval.

### 2026-09-23 — live policy check verified
Connected OpenAI and ran the full check on the dev deployment: Firecrawl verified
Target's $299.99 price for the Sony WH-1000XM5, OpenAI read Target's real
price-match policy, and the purchase moved to Claim Ready for $100 with 4 policy
quotes verified word-for-word against the retrieved page, plus an OpenAI-drafted
request clearly labelled as a sample. Fixed quote verification so markdown links,
trademark symbols and multi-sentence quotes no longer cause false rejections, and
the fetched URL, not the model's, is attached to each quote
(`convex/lib/eligibility.ts`, `convex/pipeline.ts`). 40 tests pass.

### 2026-09-23 — production deploy and pitch guide
Deployed the backend and frontend to https://third-clam-324.convex.site and loaded
live Target prices on production. A fresh visitor sees the real-product samples,
and the live check on production returned eligible at 95% confidence with 3
verified Target policy quotes. Rewrote the three-minute pitch and click guide for
the new flow (`scripts/create-pitch-pdf.py`). AgentMail sending is not yet
configured on either deployment.

