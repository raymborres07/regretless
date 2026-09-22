import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, CheckCheck, ExternalLink, Loader2, Mail, RefreshCw, Search, Send, ShieldCheck, ShieldAlert } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { daysSince, errorText, hostOf, money, priceGap, shortDate, timeAgo } from "../lib/format";
import { Button, Modal, ProductImage, StatusPill } from "./ui";

type Purchase = Doc<"purchases">;
type Claim = Doc<"claims">;
type Policy = Doc<"policies">;

const STEPS = ["Today's price", "Store policy", "Request ready", "Sent to store", "Money back"];
const RUN_TIMEOUT_MS = 180000;

function completedSteps(p: Purchase, hasPolicy: boolean): number {
  switch (p.status) {
    case "Recovered":
      return 5;
    case "Sending":
    case "Request Sent":
    case "Merchant Replied":
    case "Refund Approved":
      return 4;
    case "Eligible":
    case "Claim Ready":
      return 3;
    case "Needs Review":
    case "Not Eligible":
    case "Expired":
      return hasPolicy ? 2 : 1;
    default:
      return p.currentPrice === undefined ? 0 : 1;
  }
}

function Progress({ done, running }: { done: number; running: boolean }) {
  return (
    <ol className="steps" aria-label="Progress">
      {STEPS.map((label, i) => {
        const state = i < done ? "done" : i === done && running ? "active" : "todo";
        return (
          <li key={label} className={`step step-${state}`}>
            <span className="step-dot">{state === "done" ? <Check size={12} strokeWidth={3} /> : state === "active" ? <Loader2 size={12} className="spin" /> : i + 1}</span>
            <span className="step-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function guidance(p: Purchase, gap: number): { title: string; body: string } {
  const store = p.merchant;
  switch (p.status) {
    case "Price Drop":
      return {
        title: `${store} dropped the price by ${money(gap, p.currency)}.`,
        body: `Many stores refund the difference if the price drops soon after you buy. We'll read ${store}'s policy and check your purchase date.`,
      };
    case "Checking Policy":
    case "Sending":
      return { title: "Working on it…", body: "This usually takes under a minute. You can close this window. It updates live." };
    case "Eligible":
    case "Claim Ready":
      return { title: `You can likely get ${money(p.potentialRecovery > 0 ? p.potentialRecovery : gap, p.currency)} back.`, body: `${store}'s policy supports a price adjustment. We wrote the request for you. Review it, then approve.` };
    case "Request Sent":
      return { title: "Request sent. Now we wait.", body: `We'll watch for ${store}'s reply and update this page automatically.` };
    case "Merchant Replied":
      return { title: `${store} replied.`, body: "Read the summary below." };
    case "Refund Approved":
      return { title: "Refund approved!", body: "Let us know once the money shows up on your statement." };
    case "Recovered":
      return { title: "Money back. Nice.", body: "This one is closed." };
    case "Expired":
      return { title: "The price-adjustment window has closed.", body: "The store's deadline passed for this purchase. We'll keep it on file." };
    case "Needs Review":
      return { title: "Not a clear yes.", body: "The store's policy doesn't clearly cover this purchase. See what it says below." };
    case "Check Failed":
      return { title: "We couldn't finish the check.", body: p.error ?? "Try again in a moment." };
    default:
      return {
        title: p.currentPrice === undefined ? "We haven't checked the price yet." : "No price drop yet.",
        body: `We check ${store}'s price regularly and tell you the moment it drops.`,
      };
  }
}

function PolicyVerdict({ policy }: { policy: Policy }) {
  return (
    <section className="panel">
      <div className={`verdict ${policy.eligible ? "verdict-yes" : "verdict-no"}`}>
        {policy.eligible ? <ShieldCheck size={22} /> : <ShieldAlert size={22} />}
        <div>
          <h4>{policy.eligible ? "The store policy covers this" : "The store policy doesn't clearly cover this"}</h4>
          <p>{policy.reason}</p>
        </div>
      </div>
      {policy.windowDays !== null && <p className="muted small">Adjustment window: {policy.windowDays} days after purchase</p>}
      {policy.evidence.map((e, i) => (
        <blockquote key={i}>“{e.quote}”</blockquote>
      ))}
      {policy.exclusions.length > 0 && (
        <details className="fine">
          <summary>Exclusions ({policy.exclusions.length})</summary>
          <ul>
            {policy.exclusions.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </details>
      )}
      <p className="muted tiny">Read by AI on {new Date(policy.retrievedAt).toLocaleDateString()}. Not legal advice. The store makes the final call.</p>
    </section>
  );
}

interface ClaimEditorProps {
  purchase: Purchase;
  claim: Claim;
  emails: Doc<"emails">[];
  busy: boolean;
  act: (fn: () => Promise<unknown>, message?: string) => Promise<void>;
}

function ClaimEditor({ purchase: p, claim: c, emails, busy, act }: ClaimEditorProps) {
  const save = useMutation(api.claims.saveDraft);
  const approve = useMutation(api.claims.approve);
  const received = useMutation(api.claims.confirmRecovery);
  const [draft, setDraft] = useState({ subject: c.draftSubject, body: c.draftBody, recipient: c.recipient });
  const [confirmed, setConfirmed] = useState(false);
  const loaded = useRef("");
  useEffect(() => {
    const version = JSON.stringify([c._id, c.draftSubject, c.draftBody, c.recipient]);
    if (loaded.current !== version) {
      loaded.current = version;
      setDraft({ subject: c.draftSubject, body: c.draftBody, recipient: c.recipient });
    }
  }, [c]);
  const editable = ["Eligible", "Claim Ready"].includes(c.status) && !p.isDemo;
  return (
    <section className="panel">
      <h4 className="panel-title">
        <Mail size={18} /> Your request to {p.merchant}
      </h4>
      {c.draftBody ? (
        <>
          <label className="field">
            Send to
            <input value={draft.recipient} onChange={(e) => setDraft({ ...draft, recipient: e.target.value })} placeholder={`${p.merchant} customer service email`} disabled={!editable} type="email" />
          </label>
          <label className="field">
            Subject
            <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} disabled={!editable} />
          </label>
          <label className="field">
            Message
            <textarea rows={9} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} disabled={!editable} />
          </label>
        </>
      ) : (
        <p className="muted">We'll write the request once the policy check says you qualify.</p>
      )}
      {p.isDemo && c.draftBody && <p className="note">This is a sample order, so we won't email {p.merchant}. Add your own purchase to send a real request.</p>}
      {editable && (
        <>
          <label className="check">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            <span>I checked the details. Send this request to {p.merchant} for me.</span>
          </label>
          <div className="actions">
            <Button kind="secondary" disabled={busy} onClick={() => void act(() => save({ purchaseId: p._id, ...draft }), "Draft saved.")}>
              Save draft
            </Button>
            <Button
              disabled={busy || !confirmed}
              onClick={() =>
                void act(async () => {
                  await save({ purchaseId: p._id, ...draft });
                  await approve({ purchaseId: p._id, confirmed });
                }, "Sending your request…")
              }
            >
              <Send size={16} /> Approve & send
            </Button>
          </div>
        </>
      )}
      {c.sendError && <p className="error-box">{c.sendError}</p>}
      {c.replySummary && (
        <div className="reply">
          <strong>What {p.merchant} said</strong>
          <p>{c.replySummary}</p>
        </div>
      )}
      {c.status === "Refund Approved" && (
        <Button onClick={() => void act(() => received({ purchaseId: p._id, confirmed: true }), "Refund recorded. Nice!")}>
          <CheckCheck size={17} /> I got the money
        </Button>
      )}
      {emails.map((email) => (
        <details className="fine" key={email._id}>
          <summary>
            {email.direction === "inbound" ? "Received" : "Sent"}: {email.subject}
          </summary>
          <pre>{email.body}</pre>
        </details>
      ))}
    </section>
  );
}

function EditLinks({ purchase: p, busy, act }: { purchase: Purchase; busy: boolean; act: ClaimEditorProps["act"] }) {
  const saveUrls = useMutation(api.purchases.setUrls);
  const [productUrl, setProductUrl] = useState(p.productUrl);
  const [policyUrl, setPolicyUrl] = useState(p.policyUrl);
  return (
    <details className="fine" open={!p.productUrl || !p.policyUrl}>
      <summary>Product and policy links</summary>
      <label className="field">
        Product page
        <input value={productUrl} onChange={(e) => setProductUrl(e.target.value)} placeholder="https://store.com/product" type="url" />
      </label>
      <label className="field">
        Store's price-adjustment or price-match policy
        <input value={policyUrl} onChange={(e) => setPolicyUrl(e.target.value)} placeholder="https://store.com/price-match-policy" type="url" />
      </label>
      <Button kind="secondary" disabled={busy} onClick={() => void act(() => saveUrls({ id: p._id, productUrl, policyUrl }), "Links saved.")}>
        Save links
      </Button>
    </details>
  );
}

export default function PurchaseDetail({ id, onClose, notify }: { id: Id<"purchases">; onClose: () => void; notify: (s: string) => void }) {
  const data = useQuery(api.purchases.detail, { id });
  const start = useMutation(api.purchases.startCheck);
  const accept = useMutation(api.claims.acceptInbound);
  const [busy, setBusy] = useState(false);
  async function act(fn: () => Promise<unknown>, message?: string) {
    setBusy(true);
    try {
      await fn();
      if (message) notify(message);
    } catch (e) {
      notify(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <Modal title="Loading…" onClose={onClose} wide>
        <div className="center-pad">
          <Loader2 className="spin" />
        </div>
      </Modal>
    );
  const p: Purchase = data.purchase;
  const c: Claim | null = data.claim;
  const policy: Policy | null = data.policy;
  const events: Doc<"events">[] = data.events;
  const gap = priceGap(p.purchasePrice, p.currentPrice, p.quantity);
  const running = p.status === "Checking Policy" || p.status === "Sending" || (!!p.checkStartedAt && Date.now() - p.checkStartedAt < RUN_TIMEOUT_MS);
  const canCheck = p.confirmed && !running && !["Sending", "Request Sent", "Merchant Replied", "Refund Approved", "Recovered"].includes(p.status);
  const help = guidance(p, gap);
  return (
    <Modal title={p.merchant} onClose={onClose} wide>
      <div className="detail-head">
        <ProductImage src={p.imageUrl} category={p.category} size="detail" />
        <div>
          <h3>{p.productName}</h3>
          <p className="muted">
            Bought {shortDate(p.purchaseDate)} ({daysSince(p.purchaseDate)} days ago) · Order {p.orderNumber}
          </p>
          <div className="row-gap">
            <StatusPill status={p.status} />
            {p.isDemo && <span className="sample-chip inline">Sample order</span>}
          </div>
          {p.productUrl && (
            <a className="store-link" href={p.productUrl} target="_blank" rel="noreferrer">
              View on {hostOf(p.productUrl)} <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>
      {p.isDemo && <p className="note">Real product, real store, and live price. Only the price paid and the order are examples.</p>}
      <div className="compare">
        <div>
          <small>You paid</small>
          <strong>{money(p.purchasePrice, p.currency)}</strong>
        </div>
        <div>
          <small>{p.merchant} today</small>
          <strong>{p.currentPrice === undefined ? "Not checked" : money(p.currentPrice, p.currency)}</strong>
          {p.lastCheckedAt && <span className="tiny muted">checked {timeAgo(p.lastCheckedAt)}</span>}
        </div>
        <div className={gap > 0 ? "compare-gap" : ""}>
          <small>Difference</small>
          <strong>{gap > 0 ? money(gap, p.currency) : "—"}</strong>
        </div>
      </div>
      <Progress done={completedSteps(p, !!policy)} running={running} />
      <section className="next">
        <h4>{help.title}</h4>
        <p>{help.body}</p>
        {p.error && p.status !== "Check Failed" && !running && <p className="note">{p.error}</p>}
        {!p.confirmed ? (
          <Button onClick={() => void act(() => accept({ id }), "Receipt confirmed.")}>
            <Check size={16} /> Confirm receipt details
          </Button>
        ) : (
          canCheck && (
            <Button
              kind={["Eligible", "Claim Ready"].includes(p.status) ? "secondary" : "primary"}
              disabled={busy}
              onClick={() => void act(() => start({ id }), "Checking the price and store policy…")}
            >
              {busy ? <Loader2 size={16} className="spin" /> : p.status === "Price Drop" ? <Search size={16} /> : <RefreshCw size={16} />}
              {p.status === "Price Drop" ? "Check if I qualify" : "Check price & policy now"}
            </Button>
          )
        )}
      </section>
      {policy && <PolicyVerdict policy={policy} />}
      {c && <ClaimEditor purchase={p} claim={c} emails={data.emails} busy={busy} act={act} />}
      {policy?.sourceUrl && (
        <a className="store-link" href={policy.sourceUrl} target="_blank" rel="noreferrer">
          Read {p.merchant}'s full policy <ExternalLink size={13} />
        </a>
      )}
      <details className="fine">
        <summary>Activity ({events.length})</summary>
        <ul className="activity">
          {events.map((e) => (
            <li key={e._id} className={`activity-${e.kind}`}>
              <strong>{e.title}</strong>
              <span>{e.detail}</span>
              <small>{timeAgo(e.at)}</small>
            </li>
          ))}
        </ul>
      </details>
      {!p.isDemo && <EditLinks purchase={p} busy={busy} act={act} />}
    </Modal>
  );
}
