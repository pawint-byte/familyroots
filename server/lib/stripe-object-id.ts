/** Stripe expandable references may be IDs, expanded objects, or null. */
export function stripeObjectId(value: string | { id: string } | null): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}