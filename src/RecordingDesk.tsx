import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowRight, Check, Play, RotateCcw } from "lucide-react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import ProductArt from "./ProductArt";
import "./recording.css";

const chapters = ["The receipt", "The price drop", "The evidence", "Your approval", "The bigger idea"];
const narration = [
  "Cashback apps stop working when you hit Buy. Regretless starts working. This fictional purchase shows what happens after checkout: one receipt becomes a case your agent can watch.",
  "You paid $449. The price is now $399. That is fifty dollars most people never notice. These stages are a labeled scenario replay, while the timeline and state changes are really persisted in Convex.",
  "A lower price is not enough. Regretless checks the same item, the purchase date, and the merchant’s policy. Uncertain evidence means manual review, not a made-up promise. Firecrawl retrieval has been tested against our published fictional pages.",
  "The request is editable and sending requires your approval. This is an example draft, not a live OpenAI generation. The AgentMail path is implemented, but this recording does not send an email or claim a real refund.",
  "Price drops are the beginning. The vision is an agent that watches the money hiding after checkout: delivery guarantees, return deadlines, missed promotions and more. Regretless. Your purchase does not stop working for you after checkout.",
];

export default function RecordingDesk({ purchaseId }: { purchaseId: Id<"purchases"> }) {
  const data = useQuery(api.purchases.detail, { id: purchaseId });
  const replay = useMutation(api.purchases.replay);
  const [chapter, setChapter] = useState(0);
  const [notes, setNotes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!data) return <p>Opening the recording desk…</p>;
  const p = data.purchase;
  const dollars = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: p.currency }).format(value);
  const difference = Math.max(0, p.purchasePrice - (p.currentPrice ?? p.purchasePrice));
  async function run() {
    setBusy(true); setError("");
    try { await replay({ id: purchaseId }); }
    catch { setError("Replay could not start. Close this view and check the purchase timeline."); }
    finally { setBusy(false); }
  }
  return <section className="recording-desk">
    <div className="recording-disclosure"><span>ILLUSTRATIVE WALKTHROUGH</span><span>Real Convex state · simulated scenario · no email sent</span></div>
    <nav className="recording-chapters" aria-label="Recording chapters">{chapters.map((title, i) => <button key={title} aria-current={chapter === i ? "step" : undefined} onClick={() => setChapter(i)}><span>{String(i + 1).padStart(2, "0")}</span>{title}</button>)}</nav>
    <div className="recording-scene" key={chapter}>
      {chapter === 0 && <div className="recording-split"><div><p className="recording-kicker">CHECKOUT IS NOT THE FINISH LINE.</p><h2>You bought it.<br/>We stay on it.</h2><p>One receipt. An agent watching what happens next.</p><div className="recording-proof">Saved purchase <Check size={16}/> Convex</div></div><article className="recording-receipt"><div className="recording-art"><ProductArt category="headphones"/></div><p>FICTIONAL RECEIPT · {p.merchant}</p><h3>{p.productName}</h3><dl><div><dt>Order</dt><dd>{p.orderNumber}</dd></div><div><dt>Purchased</dt><dd>{p.purchaseDate}</dd></div><div><dt>You paid</dt><dd>{dollars(p.purchasePrice)}</dd></div></dl><small>Seeded example, not AI-extracted in this walkthrough.</small></article></div>}
      {chapter === 1 && <div className="recording-split"><div><p className="recording-kicker">A GOOD CATCH, AFTER CHECKOUT.</p><h2>The price fell.<br/>Your money shouldn’t.</h2><div className="recording-prices"><span><small>You paid</small>{dollars(p.purchasePrice)}</span><ArrowRight/><span><small>Listed example</small>{dollars(p.currentPrice ?? p.purchasePrice)}</span></div><button className="btn primary" disabled={busy || ["Purchased", "Monitoring", "Price Drop", "Checking Policy", "Eligible"].includes(p.status) && !!p.checkStartedAt} onClick={() => void run()}><Play size={17}/>Replay Convex timeline</button>{error && <p role="alert">{error}</p>}</div><div className="recording-recovery"><span>POTENTIAL DIFFERENCE</span><strong>{dollars(difference)}</strong><p>Not a guaranteed refund.</p><div aria-live="polite"><i/>{p.status}</div><small>Scenario events are stored in your Convex workspace.</small></div></div>}
      {chapter === 2 && <div className="recording-split"><div><p className="recording-kicker">EVIDENCE BEFORE CONFIDENCE.</p><h2>No fine print.<br/>No false promises.</h2><p>The live pipeline checks quoted source evidence before showing a likely eligible claim.</p><ul className="recording-checks"><li><Check/> Same product and variant</li><li><Check/> Current price genuinely lower</li><li><Check/> Purchase within the policy window</li><li><Check/> Human review when uncertain</li></ul></div><article className="recording-policy"><span>PUBLIC DEMO POLICY · FICTIONAL</span><h3>14-day price adjustment</h3><blockquote>“Nova Electronics permits one post-purchase price adjustment within 14 calendar days of purchase”</blockquote><p>This excerpt is from our published test fixture, not a real retailer policy or a live AI interpretation.</p><a href="/demo/nova-policy.html" target="_blank" rel="noreferrer">Read the source policy ↗</a><a href="/demo/nova-headphones.html" target="_blank" rel="noreferrer">View the $399 product fixture ↗</a></article></div>}
      {chapter === 3 && <div className="recording-split"><div><p className="recording-kicker">YOUR AGENT. YOUR SAY.</p><h2>Ready to ask.<br/>Never sends behind<br/>your back.</h2><p>The real workflow lets you edit the draft and approve the exact recipient, subject and body.</p><div className="recording-proof">Sending disabled for fictional purchases</div></div><article className="recording-email"><span>EXAMPLE DRAFT · NOT SENT</span><h3>{data.claim?.draftSubject || "Price-adjustment request"}</h3><div>{data.claim?.draftBody || "Open this purchase’s claim view to review its example request."}</div><footer><span>Human approval required</span><span>{dollars(difference)} potential</span></footer></article></div>}
      {chapter === 4 && <div className="recording-ending"><p className="recording-kicker">LESS BUYER’S REMORSE. MORE BUYER’S POWER.</p><h2>Normally, a price drop<br/>after you buy is regret.<br/><em>We turn it into a claim.</em></h2><p>Prices. Promotions. Delivery guarantees. Return deadlines.</p><strong>regretless.</strong><small>Convex backend + Firecrawl retrieval verified. Live OpenAI and AgentMail execution still awaiting credentials.</small></div>}
    </div>
    <div className="recording-controls"><button className="text-button" onClick={() => { setChapter(0); setError(""); }}><RotateCcw size={14}/>Restart walkthrough</button><button className="text-button" aria-pressed={notes} onClick={() => setNotes(!notes)}>{notes ? "Hide" : "Show"} narration notes</button><button className="btn primary" onClick={() => setChapter((chapter + 1) % chapters.length)}>{chapter === 4 ? "Back to opening" : "Next chapter"}<ArrowRight size={16}/></button></div>
    {notes && <p className="recording-notes">{narration[chapter]}</p>}
  </section>;
}
