/**
 * Message template rendering. The marketer writes a template with
 * {{merge_fields}}; the send pipeline renders one message per customer
 * server-side. Pure and unit-tested (one of the three core test suites).
 *
 * Whitelisted merge fields: first_name, city, last_order_days_ago,
 * total_spend_rupees. Unknown placeholders are left intact (a template typo
 * shouldn't silently vanish text).
 */

/**
 * The only merge fields the renderer fills. The AI drafter validates its
 * output against this same list, so a drafted message can never reference a
 * field the renderer wouldn't substitute (it would ship as literal braces).
 */
export const MERGE_FIELDS = [
  "first_name",
  "city",
  "last_order_days_ago",
  "total_spend_rupees",
] as const;
export type MergeField = (typeof MERGE_FIELDS)[number];

const MERGE_RE = /\{\{\s*([a-z_]+)\s*\}\}/g;

/** Extract the distinct merge-field names referenced in a template. */
export function mergeFieldsUsed(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(MERGE_RE)) {
    if (match[1]) {
      found.add(match[1]);
    }
  }
  return [...found];
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(MERGE_RE, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match,
  );
}

export type MergeCustomer = {
  name: string;
  city: string;
  lastOrderAt: Date | null;
  totalSpend: number;
};

const rupeeFormatter = new Intl.NumberFormat("en-IN");

/** Build the whitelisted merge variables for one customer. */
export function customerMergeVars(
  customer: MergeCustomer,
  now: Date = new Date(),
): Record<string, string> {
  const firstName = customer.name.trim().split(/\s+/)[0] || customer.name;
  const lastOrderDaysAgo = customer.lastOrderAt
    ? String(Math.max(0, Math.floor((now.getTime() - customer.lastOrderAt.getTime()) / 86_400_000)))
    : "a while";
  const totalSpendRupees = rupeeFormatter.format(Math.round(customer.totalSpend / 100));
  return {
    first_name: firstName,
    city: customer.city,
    last_order_days_ago: lastOrderDaysAgo,
    total_spend_rupees: totalSpendRupees,
  };
}

/** Convenience: render a template for a customer. */
export function renderForCustomer(
  template: string,
  customer: MergeCustomer,
  now: Date = new Date(),
): string {
  return renderTemplate(template, customerMergeVars(customer, now));
}
