export type EligibilityInput = { purchasePrice:number; currentPrice:number; currency:string; currentCurrency:string; quantity:number; purchaseDate:string; windowDays:number|null; adjustmentsAllowed:boolean; modelEligible:boolean; confidence:number; sameProduct:boolean; evidenceVerified:boolean; now?:number };
export function calculateEligibility(p:EligibilityInput) {
  const paid=Math.round(p.purchasePrice*100),current=Math.round(p.currentPrice*100);
  const date=Date.parse(`${p.purchaseDate}T00:00:00Z`),now=p.now??Date.now();
  if(![paid,current,p.confidence,p.quantity].every(Number.isFinite)||paid<=0||current<0||!Number.isInteger(p.quantity)||p.quantity<1||p.quantity>100||p.confidence<0||p.confidence>1)return {eligible:false,amount:0,reason:"Invalid price or quantity. Review the receipt.",expired:false};
  if(p.currency!==p.currentCurrency)return {eligible:false,amount:0,reason:"Prices use different currencies.",expired:false};
  if(current>=paid)return {eligible:false,amount:0,reason:"No price drop on this item yet.",expired:false};
  if(!Number.isFinite(date)||date>now||new Date(date).toISOString().slice(0,10)!==p.purchaseDate)return {eligible:false,amount:0,reason:"Purchase date needs review.",expired:false};
  if(p.windowDays!==null&&(!Number.isInteger(p.windowDays)||p.windowDays<1||p.windowDays>365))return {eligible:false,amount:0,reason:"Policy window needs review.",expired:false};
  const days=Math.floor((now-date)/86400000),expired=p.windowDays!==null&&days>p.windowDays;
  if(expired)return {eligible:false,amount:0,reason:"The apparent price-adjustment window has expired.",expired:true};
  if(!p.sameProduct||!p.evidenceVerified||!p.adjustmentsAllowed||!p.modelEligible||p.confidence<0.85||p.windowDays===null)return {eligible:false,amount:0,reason:"Policy or product evidence is uncertain. Manual review required.",expired:false};
  return {eligible:true,amount:((paid-current)*p.quantity)/100,reason:"A lower price and quoted policy support a potential adjustment. Merchant approval required.",expired:false};
}
export function safeUrl(raw:string){const u=new URL(raw),h=u.hostname.toLowerCase();if(u.protocol!=="https:"||u.username||u.password||u.port||!h.includes(".")||/^[\d.]+$/.test(h)||h.includes(":")||/(^|\.)(localhost|local|internal|test|invalid)$/.test(h))throw new Error("Use a public HTTPS product or policy URL.");return u.toString();}
/** Flattens markdown links, emphasis, symbols and smart quotes so a verbatim quote can be matched against page text. */
export function normalizeText(s:string){return s.replace(/!?\[([^\]]*)\]\([^)]*\)/g,"$1").replace(/[*_`#>]/g,"").replace(/[‘’‛]/g,"'").replace(/[“”]/g,'"').replace(/[™®©]/g,"").replace(/\s+/g," ").trim().toLowerCase();}
const MIN_QUOTE=12;
/** True when the quote, or each of its sentences, appears in the source text. */
export function quoteIsPresent(quote:string,source:string){
  if(quote.trim().length<MIN_QUOTE)return false;
  const page=normalizeText(source).replace(/(^|\s)[-•]\s/g," ");
  const q=normalizeText(quote);
  if(page.includes(q))return true;
  const parts=q.split(/(?<=[.!?])\s+/).map(x=>x.trim()).filter(x=>x.length>=MIN_QUOTE);
  return parts.length>0&&parts.every(x=>page.includes(x));
}
