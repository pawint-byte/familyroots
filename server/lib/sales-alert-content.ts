export interface SaleEmail {
  paymentKey: string;
  reference: string;
  product: string;
  buyerName: string;
  buyerEmail: string | null;
  amount: number;
  currency: string;
}

export function isPaidCheckout(session: {
  livemode?: boolean;
  payment_status?: string;
  amount_total?: number | null;
}): boolean {
  return session.livemode === true && session.payment_status === "paid" &&
    typeof session.amount_total === "number" && session.amount_total > 0;
}

export function isPaidRenewal(invoice: { status?: string | null; amount_paid: number; billing_reason?: string | null }) {
  return invoice.status === "paid" && invoice.amount_paid > 0 && invoice.billing_reason !== "subscription_create";
}

export function checkoutProduct(metadata: Record<string, string | undefined>): string | null {
  switch (metadata.type) {
    case "bulk_pack": return `Member-credit pack: ${metadata.packType || "credits"}`;
    case "tier_subscription":
      return ["cultivator", "heritage", "legacy"].includes(metadata.tier || "")
        ? `${metadata.tier!.charAt(0).toUpperCase()}${metadata.tier!.slice(1)} membership` : null;
    case "premium_subscription": return "Premium membership";
    case "milestone_payment": return `Family growth milestone: ${metadata.milestone || ""}`;
    case "merchandise": return "Merchandise";
    case "merchandise_cart": return "Merchandise cart";
    default: return null;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character]!));
}

export function buildSaleEmail(sale: SaleEmail) {
  const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: sale.currency });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  const amount = formatter.format(sale.amount / (10 ** digits));
  const rows = [
    ["Member", sale.buyerName],
    ["Email", sale.buyerEmail || "Not provided"],
    ["Purchase", sale.product],
    ["Amount paid", `${amount} ${sale.currency.toUpperCase()}`],
    ["Payment reference", sale.reference],
  ];
  return {
    subject: `FamilyRoots sale: ${amount} — ${sale.product.replace(/[\r\n]/g, " ")}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;color:#263b2f">
      <h2>Payment received</h2><p>A member completed a verified purchase.</p>
      <table>${rows.map(([label, value]) => `<tr><th style="text-align:left;padding:8px">${label}</th>
      <td style="padding:8px">${escapeHtml(value)}</td></tr>`).join("")}</table>
      <p style="font-size:13px;color:#647067">This confirms payment only. Membership activation
      and merchandise fulfillment are processed separately.</p></div>`,
  };
}

export async function deliverSaleEmail(
  alert: { paymentKey: string; recipients: string[]; subject: string; html: string },
  send: (to: string[], subject: string, html: string, key: string) => Promise<{
    data: { id: string } | null; error: unknown;
  }>,
  markSent: (emailId: string) => Promise<void>,
): Promise<void> {
  const result = await send(alert.recipients, alert.subject, alert.html, `sale-${alert.paymentKey}`);
  if (result.error || !result.data?.id) throw new Error("Sales email was not accepted by the email provider");
  await markSent(result.data.id);
}
