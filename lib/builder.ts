import type { CurrentUser } from "@/lib/session";
import { getSellerProducts } from "@/lib/seller";
import { getSellableProductIds } from "@/lib/access";
import { getSettings } from "@/lib/settings";

/** Products shaped for the quote builder (client component props). */
export async function getBuilderProducts(user: CurrentUser) {
  const [products, sellable, settings] = await Promise.all([
    getSellerProducts(user),
    getSellableProductIds(user),
    getSettings(),
  ]);
  return products.map((p) => ({
    id: p.id,
    name: p.name,
    family: p.family,
    color: p.color,
    imageUrl: p.imageUrl,
    commissionRate: p.commissionRate,
    maxDiscount: p.maxDiscount ?? settings.defaultMaxDiscount ?? null,
    canSell: sellable.includes(p.id),
    plans: p.plans.map((pl) => ({
      id: pl.id,
      name: pl.name,
      price: pl.price,
      billing: pl.billing,
      unitLabel: pl.unitLabel,
      description: pl.description,
    })),
  }));
}
