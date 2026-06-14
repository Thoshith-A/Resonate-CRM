import type { SegmentRules } from "@resonate/shared";
import { prisma } from "../db";
import { notFound } from "../api";
import { compileRules } from "../segments/compile";
import { renderForCustomer } from "./template";

export type RenderPreviewResult = {
  rendered: string;
  sample: { name: string; city: string } | null;
};

/**
 * Render a message template against a REAL customer from the segment, so the
 * builder's live preview shows true merge output (reusing the tested
 * renderForCustomer — the same path the send pipeline uses). Returns sample:
 * null when the segment currently matches no one; the template is then shown
 * unrendered.
 */
export async function renderPreview(
  segmentId: string,
  template: string,
): Promise<RenderPreviewResult> {
  const segment = await prisma.segment.findUnique({ where: { id: segmentId } });
  if (!segment) {
    throw notFound(`No segment with id ${segmentId}`);
  }

  const where = compileRules(segment.rules as unknown as SegmentRules);
  const customer = await prisma.customer.findFirst({
    where,
    select: { name: true, city: true, lastOrderAt: true, totalSpend: true },
    orderBy: { totalSpend: "desc" },
  });

  if (!customer) {
    return { rendered: template, sample: null };
  }

  return {
    rendered: renderForCustomer(template, customer),
    sample: { name: customer.name, city: customer.city },
  };
}
