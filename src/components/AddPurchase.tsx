import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { ArrowLeft, Copy, Loader2, Mail, PenLine, ReceiptText, RefreshCw, Sparkles } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { errorText } from "../lib/format";
import { Button, Modal } from "./ui";

type Receipt = {
  merchant: string;
  productName: string;
  orderNumber: string;
  purchasePrice: number;
  currency: string;
  purchaseDate: string;
  productUrl: string;
  merchantWebsite: string;
  buyerEmail: string;
  quantity: number;
};

type Mode = "choose" | "paste" | "form" | "email";
const MAX_RECEIPT_BYTES = 30000;

const blank = (): Receipt => ({
  merchant: "",
  productName: "",
  orderNumber: "",
  purchasePrice: 0,
  currency: "USD",
  purchaseDate: new Date().toISOString().slice(0, 10),
  productUrl: "",
  merchantWebsite: "",
  buyerEmail: "",
  quantity: 1,
});

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

interface AddPurchaseProps {
  inboxId?: string;
  onClose: () => void;
  onCreated: (id: Id<"purchases">) => void;
  notify: (s: string) => void;
}

export default function AddPurchase({ inboxId, onClose, onCreated, notify }: AddPurchaseProps) {
  const extract = useAction(api.pipeline.extract);
  const create = useMutation(api.purchases.create);
  const createInbox = useAction(api.mail.createInbox);
  const syncInbox = useAction(api.mail.syncInbox);
  const [mode, setMode] = useState<Mode>("choose");
  const [text, setText] = useState("");
  const [form, setForm] = useState<Receipt>(blank);
  const [policyUrl, setPolicyUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const set = <K extends keyof Receipt>(key: K, value: Receipt[K]) => setForm({ ...form, [key]: value });
  const back = (
    <button className="back-link" onClick={() => { setMode("choose"); setError(""); }}>
      <ArrowLeft size={15} /> Back
    </button>
  );

  return (
    <Modal title="Add a purchase" onClose={onClose}>
      {mode === "choose" && (
        <div className="choices">
          <p className="muted">Tell us what you bought. We'll watch the price and tell you if you can get money back.</p>
          <button className="choice" onClick={() => setMode("paste")}>
            <ReceiptText size={22} />
            <span>
              <strong>Paste your order confirmation</strong>
              <small>Copy the text of the email or receipt. AI fills in the details for you.</small>
            </span>
          </button>
          <button className="choice" onClick={() => setMode("form")}>
            <PenLine size={22} />
            <span>
              <strong>Type it in</strong>
              <small>Product, store, price and date. About a minute.</small>
            </span>
          </button>
          <button className="choice" onClick={() => setMode("email")}>
            <Mail size={22} />
            <span>
              <strong>Forward receipts by email</strong>
              <small>Get a private address and forward order emails to it.</small>
            </span>
          </button>
        </div>
      )}

      {mode === "paste" && (
        <>
          {back}
          <label className="field">
            Order confirmation text
            <textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the order email here…" maxLength={MAX_RECEIPT_BYTES} />
          </label>
          <label className="file-pick">
            or choose a .txt / .eml file
            <input
              type="file"
              accept=".txt,.eml,text/plain"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > MAX_RECEIPT_BYTES) return setError("Please use a file under 30 KB.");
                setText(await file.text());
              }}
            />
          </label>
          <p className="muted tiny">Tip: remove card numbers and your home address first. You'll review everything before it's saved.</p>
          <Button full disabled={busy || text.trim().length < 20} onClick={() => void run(async () => { setForm({ ...blank(), ...(await extract({ text })) }); setMode("form"); })}>
            {busy ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />} Read my receipt
          </Button>
        </>
      )}

      {mode === "form" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => onCreated(await create({ ...form, merchantWebsite: form.merchantWebsite || originOf(form.productUrl), policyUrl })));
          }}
        >
          {back}
          <div className="form-grid">
            <label className="field span-2">
              What did you buy?
              <input required value={form.productName} onChange={(e) => set("productName", e.target.value)} placeholder="Sony WH-1000XM5 headphones" />
            </label>
            <label className="field">
              Store
              <input required value={form.merchant} onChange={(e) => set("merchant", e.target.value)} placeholder="Target" />
            </label>
            <label className="field">
              Price you paid (each)
              <input required type="number" min="0.01" step="0.01" value={form.purchasePrice || ""} onChange={(e) => set("purchasePrice", Number(e.target.value))} placeholder="399.99" />
            </label>
            <label className="field">
              Date you bought it
              <input required type="date" value={form.purchaseDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set("purchaseDate", e.target.value)} />
            </label>
            <label className="field">
              Quantity
              <input required type="number" min="1" max="100" value={form.quantity} onChange={(e) => set("quantity", Number(e.target.value))} />
            </label>
            <label className="field span-2">
              Order number
              <input required value={form.orderNumber} onChange={(e) => set("orderNumber", e.target.value)} placeholder="From your receipt" />
            </label>
            <label className="field span-2">
              Link to the product
              <input type="url" value={form.productUrl} onChange={(e) => set("productUrl", e.target.value)} placeholder="https://www.target.com/p/…" />
            </label>
            <label className="field span-2">
              Store's price-match policy link <span className="muted">(optional)</span>
              <input type="url" value={policyUrl} onChange={(e) => setPolicyUrl(e.target.value)} placeholder="https://www.target.com/help/…/price-match-guarantee" />
            </label>
          </div>
          <Button type="submit" full disabled={busy}>
            {busy && <Loader2 className="spin" size={17} />} Start watching this purchase
          </Button>
        </form>
      )}

      {mode === "email" && (
        <>
          {back}
          <p className="muted">Forward order confirmations to your private address. We read them and add the purchase for you to confirm.</p>
          {inboxId ? (
            <>
              <div className="inbox-address">
                <code>{inboxId}</code>
                <button className="icon-btn" aria-label="Copy address" onClick={() => void navigator.clipboard.writeText(inboxId).then(() => notify("Address copied."))}>
                  <Copy size={17} />
                </button>
              </div>
              <Button full disabled={busy} onClick={() => void run(async () => { await syncInbox({}); notify("Inbox checked. New receipts show up on your list."); })}>
                <RefreshCw className={busy ? "spin" : ""} size={17} /> Check for new receipts
              </Button>
            </>
          ) : (
            <Button full disabled={busy} onClick={() => void run(async () => { await createInbox({}); })}>
              {busy ? <Loader2 className="spin" size={17} /> : <Mail size={17} />} Create my receipt address
            </Button>
          )}
          <p className="muted tiny">The address belongs to this browser. Forward only what you want to share.</p>
        </>
      )}

      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
    </Modal>
  );
}
