import { useCallback, useEffect, useRef, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Bell, Loader2, Mail, Plus, ReceiptText, ScanSearch, ShieldCheck } from "lucide-react";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import AddPurchase from "./components/AddPurchase";
import PurchaseCard from "./components/PurchaseCard";
import PurchaseDetail from "./components/PurchaseDetail";
import { Brand, Button, Toast } from "./components/ui";
import { ATTENTION_STATUSES, errorText, money, priceGap } from "./lib/format";

type Purchase = Doc<"purchases">;

export default function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const [error, setError] = useState("");
  const started = useRef(false);
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !started.current) {
      started.current = true;
      void signIn("anonymous").catch((e) => {
        setError(errorText(e));
        started.current = false;
      });
    }
  }, [isLoading, isAuthenticated, signIn]);
  if (isAuthenticated) return <Home />;
  return (
    <div className="splash">
      <Brand />
      {error ? (
        <>
          <p>{error}</p>
          <Button onClick={() => { setError(""); void signIn("anonymous").catch((e) => setError(errorText(e))); }}>Try again</Button>
        </>
      ) : (
        <Loader2 className="spin" />
      )}
    </div>
  );
}

const HOW_IT_WORKS = [
  { icon: ReceiptText, title: "Add what you bought", body: "Paste an order email, forward it, or type it in. Takes a minute." },
  { icon: ScanSearch, title: "We watch the price", body: "We check the store's live price and read its price-match policy for you." },
  { icon: Mail, title: "You approve, we ask", body: "If you qualify, we write the refund request. Nothing is sent without your OK." },
];

function Section({ title, hint, items, onOpen }: { title: string; hint: string; items: Purchase[]; onOpen: (id: Id<"purchases">) => void }) {
  if (items.length === 0) return null;
  return (
    <section className="list-section">
      <div className="section-head">
        <h2>
          {title} <span className="count">{items.length}</span>
        </h2>
        <p className="muted">{hint}</p>
      </div>
      <div className="grid">
        {items.map((p) => (
          <PurchaseCard key={p._id} purchase={p} onOpen={() => onOpen(p._id)} />
        ))}
      </div>
    </section>
  );
}

function Home() {
  const data = useQuery(api.purchases.dashboard);
  const seed = useMutation(api.purchases.seed);
  const [selected, setSelected] = useState<Id<"purchases"> | null>(null);
  const [adding, setAdding] = useState(false);
  const [hideSamples, setHideSamples] = useState(false);
  const [toast, setToast] = useState("");
  const clearToast = useCallback(() => setToast(""), []);
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    void seed({}).catch((e) => setToast(errorText(e)));
  }, [seed]);

  const all: Purchase[] = [...(data?.purchases ?? [])].sort((a, b) => b.createdAt - a.createdAt);
  const hasSamples = all.some((p) => p.isDemo);
  const hasOwn = all.some((p) => !p.isDemo);
  const visible = all.filter((p) => !(hideSamples && p.isDemo));
  const attention = visible.filter((p) => ATTENTION_STATUSES.includes(p.status));
  const watching = visible.filter((p) => !ATTENTION_STATUSES.includes(p.status) && p.status !== "Recovered");
  const done = visible.filter((p) => p.status === "Recovered");
  const usd = visible.filter((p) => p.currency === "USD" && p.status !== "Recovered");
  const dropTotal = usd.reduce((sum, p) => sum + (p.potentialRecovery > 0 ? p.potentialRecovery : priceGap(p.purchasePrice, p.currentPrice, p.quantity)), 0);
  const recovered = (data?.claims ?? []).filter((c) => visible.some((p) => p._id === c.purchaseId)).reduce((sum, c) => sum + c.recoveredAmount, 0);
  const drops = usd.filter((p) => priceGap(p.purchasePrice, p.currentPrice, p.quantity) > 0).length;

  return (
    <div className="page">
      <header className="topbar">
        <Brand />
        <nav className="top-nav">
          <a href="#how">How it works</a>
          <Button onClick={() => setAdding(true)}>
            <Plus size={17} /> Add a purchase
          </Button>
        </nav>
      </header>

      <main className="container">
        <section className="hero">
          <div className="hero-copy">
            <h1>Prices drop after you buy. Get the difference back.</h1>
            <p>Stores like Target will refund you if the price drops soon after you buy, but almost nobody asks. Regretless watches your purchases and does the asking for you.</p>
          </div>
          <div className="summary">
            <small>{drops > 0 ? "Price drops on your purchases" : "Watching for price drops"}</small>
            <strong className="summary-amount">{money(dropTotal)}</strong>
            <span className="muted small">
              {drops > 0 ? `${drops} item${drops === 1 ? "" : "s"} cheaper than you paid` : `${usd.length} purchase${usd.length === 1 ? "" : "s"} on watch`}
            </span>
            {recovered > 0 && <span className="summary-recovered">{money(recovered)} already recovered</span>}
            <span className="summary-safe">
              <ShieldCheck size={14} /> Nothing is sent without your approval
            </span>
          </div>
        </section>

        {hasSamples && !hideSamples && (
          <div className="banner" role="note">
            <Bell size={18} />
            <p>
              <strong>These are sample orders so you can try it out.</strong> The products, store links, store policies and today's prices are real. Only the price paid is an example.
            </p>
            <div className="banner-actions">
              <Button onClick={() => setAdding(true)}>Add your own</Button>
              {hasOwn && (
                <Button kind="ghost" onClick={() => setHideSamples(true)}>
                  Hide samples
                </Button>
              )}
            </div>
          </div>
        )}

        {!data ? (
          <div className="grid">
            {Array.from({ length: 4 }, (_, i) => (
              <div className="card skeleton" key={i} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="empty">
            <ReceiptText size={32} />
            <h2>Add your first purchase</h2>
            <p className="muted">Anything you bought in the last few weeks. We'll tell you if the price drops.</p>
            <Button onClick={() => setAdding(true)}>
              <Plus size={17} /> Add a purchase
            </Button>
          </div>
        ) : (
          <>
            <Section title="Needs your attention" hint="Price drops and requests waiting on you." items={attention} onOpen={setSelected} />
            <Section title="Watching" hint="We check these prices every few hours." items={watching} onOpen={setSelected} />
            <Section title="Money back" hint="Closed and refunded." items={done} onOpen={setSelected} />
          </>
        )}

        <section id="how" className="how">
          <h2>How it works</h2>
          <div className="how-grid">
            {HOW_IT_WORKS.map(({ icon: Icon, title, body }, i) => (
              <article key={title}>
                <span className="how-icon">
                  <Icon size={22} />
                </span>
                <small>Step {i + 1}</small>
                <h3>{title}</h3>
                <p className="muted">{body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <Brand />
        <p className="muted small">Your receipts stay in this browser's private session. AI policy reads are guidance, not legal advice.</p>
        <p className="muted tiny">Built with Convex · OpenAI · Firecrawl · AgentMail</p>
      </footer>

      {selected && <PurchaseDetail id={selected} onClose={() => setSelected(null)} notify={setToast} />}
      {adding && (
        <AddPurchase
          inboxId={data?.profile?.inboxId}
          onClose={() => setAdding(false)}
          notify={setToast}
          onCreated={(id) => {
            setAdding(false);
            setSelected(id);
          }}
        />
      )}
      {toast && <Toast message={toast} onClose={clearToast} />}
    </div>
  );
}
