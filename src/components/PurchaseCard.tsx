import { ArrowRight, TrendingDown } from "lucide-react";
import type { Doc } from "../../convex/_generated/dataModel";
import { money, priceGap, shortDate } from "../lib/format";
import { ProductImage, StatusPill } from "./ui";

type Purchase = Doc<"purchases">;

function nextStep(p: Purchase, gap: number): string {
  switch (p.status) {
    case "Price Drop":
      return `See if you can get ${money(gap, p.currency)} back`;
    case "Eligible":
    case "Claim Ready":
      return "Review your request";
    case "Merchant Replied":
      return "Read the store's reply";
    case "Refund Approved":
      return "Confirm the refund arrived";
    case "Needs Review":
    case "Check Failed":
      return "Take a look";
    default:
      return "View details";
  }
}

export default function PurchaseCard({ purchase: p, onOpen }: { purchase: Purchase; onOpen: () => void }) {
  const gap = priceGap(p.purchasePrice, p.currentPrice, p.quantity);
  const claimable = p.potentialRecovery > 0 ? p.potentialRecovery : gap;
  return (
    <button className="card" onClick={onOpen}>
      <div className="card-media">
        <ProductImage src={p.imageUrl} category={p.category} />
        <span className="store-chip">{p.merchant}</span>
        {p.isDemo && <span className="sample-chip">Sample</span>}
      </div>
      <div className="card-body">
        <h3>{p.productName}</h3>
        <p className="muted small">
          Bought {shortDate(p.purchaseDate)}
          {p.quantity > 1 ? ` · ${p.quantity} items` : ""}
        </p>
        <div className="price-row">
          <div>
            <small>You paid</small>
            <strong>{money(p.purchasePrice, p.currency)}</strong>
          </div>
          <div>
            <small>Today</small>
            <strong className={gap > 0 ? "text-good" : ""}>
              {p.currentPrice === undefined ? "Checking…" : money(p.currentPrice, p.currency)}
            </strong>
          </div>
        </div>
        {claimable > 0 && p.status !== "Recovered" && (
          <div className="drop-callout">
            <TrendingDown size={16} />
            Down {money(claimable, p.currency)} since you bought it
          </div>
        )}
        <div className="card-foot">
          <StatusPill status={p.status} />
          <span className="card-cta">
            {nextStep(p, claimable)} <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </button>
  );
}
