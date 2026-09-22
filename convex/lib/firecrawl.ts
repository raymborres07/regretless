import { safeUrl } from "./eligibility";

const SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape";
const SCRAPE_TIMEOUT_MS = 75000;
const MAX_MARKDOWN = 70000;

export type ListedPrice = {
  price: number | null;
  currency: string;
  priceText: string;
  productTitle: string;
  inStock: boolean;
};

export type ProductPage = {
  sourceUrl: string;
  content: string;
  imageUrl?: string;
  listing: ListedPrice;
};

const priceSchema = {
  type: "object",
  properties: {
    price: { type: ["number", "null"] },
    currency: { type: "string" },
    priceText: { type: "string" },
    productTitle: { type: "string" },
    inStock: { type: "boolean" },
  },
  required: ["price", "currency", "priceText", "productTitle", "inStock"],
};

const pricePrompt =
  "Return the current selling price for the exact product on this page, as any shopper would pay today. " +
  "Ignore crossed-out/was prices, coupons, member-only deals, trade-ins, installments, and other sellers. " +
  "priceText must be copied exactly as it appears on the page (for example $329.99). Use null when unsure.";

function key(): string {
  const value = process.env.FIRECRAWL_API_KEY;
  if (!value) throw new Error("Firecrawl is not connected yet.");
  return value;
}

async function scrape(url: string, formats: unknown[]): Promise<Record<string, unknown>> {
  const response = await fetch(SCRAPE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url: safeUrl(url), formats, onlyMainContent: true, maxAge: 0, proxy: "auto" }),
    signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Firecrawl retrieval failed (${response.status}). Try another public page.`);
  const body = (await response.json()) as { success?: boolean; data?: Record<string, unknown> };
  if (!body.success || !body.data || typeof body.data.markdown !== "string")
    throw new Error("The page did not return readable evidence.");
  return body.data;
}

/** Retrieves a page as markdown, for policies and other text evidence. */
export async function crawlText(url: string): Promise<{ content: string; sourceUrl: string }> {
  const data = await scrape(url, ["markdown"]);
  return { content: String(data.markdown).slice(0, MAX_MARKDOWN), sourceUrl: url };
}

function asListing(raw: unknown): ListedPrice {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    price: typeof r.price === "number" && Number.isFinite(r.price) ? r.price : null,
    currency: typeof r.currency === "string" && /^[A-Z]{3}$/.test(r.currency) ? r.currency : "USD",
    priceText: typeof r.priceText === "string" ? r.priceText : "",
    productTitle: typeof r.productTitle === "string" ? r.productTitle : "",
    inStock: r.inStock !== false,
  };
}

function safeImage(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** A price counts only when the number itself appears in the retrieved page text. */
export function priceIsOnPage(price: number, content: string): boolean {
  const plain = content.replace(/,/g, "");
  return plain.includes(price.toFixed(2)) || (Number.isInteger(price) && plain.includes(`$${price}`));
}

/** Retrieves a product page with Firecrawl and extracts the listed price and photo. */
export async function crawlProduct(url: string): Promise<ProductPage> {
  const data = await scrape(url, ["markdown", { type: "json", schema: priceSchema, prompt: pricePrompt }]);
  const metadata = (data.metadata ?? {}) as Record<string, unknown>;
  return {
    sourceUrl: url,
    content: String(data.markdown).slice(0, MAX_MARKDOWN),
    imageUrl: safeImage(metadata.ogImage) ?? safeImage(metadata["og:image"]),
    listing: asListing(data.json),
  };
}
