import { generateQuotePdf } from "@/lib/pdf";
import { getSettings } from "@/lib/settings";

type QuoteWithRelations = {
  number: string;
  createdAt: Date;
  validUntil: Date | null;
  discount: number;
  vatRate: number;
  notes: string | null;
  items: { name: string; quantity: number; unitPrice: number; billing: string; unitLabel: string | null }[];
  customer: { name: string; company: string | null; email: string | null; phone: string | null };
  user: { name: string; email: string; phone: string | null };
};

/** Shared by the PDF download route and the "send quote" action. */
export async function renderQuotePdf(quote: QuoteWithRelations): Promise<Uint8Array> {
  const settings = await getSettings();
  return generateQuotePdf(
    {
      number: quote.number,
      createdAt: quote.createdAt,
      validUntil: quote.validUntil,
      discount: quote.discount,
      vatRate: quote.vatRate,
      notes: quote.notes,
      items: quote.items,
      customer: quote.customer,
      user: quote.user,
    },
    {
      companyName: settings.companyName,
      companyAddress: settings.companyAddress,
      companyEmail: settings.companyEmail,
      companyPhone: settings.companyPhone,
    }
  );
}
