export type OrderLine = {
  product_id: string;
  product_name: string;
  unit_price: number | string;
  quantity: number;
};
export type PendingOrder = {
  order_id: string;
  order_number: string;
  subtotal: number | string;
  discount_amount: number | string;
  shipping_amount: number | string;
  total: number | string;
  expires_at: string;
  items: OrderLine[];
};
export type MercadoPagoPreferenceItem = {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  currency_id: string;
};

export function createPreferenceItems(
  order: PendingOrder,
): MercadoPagoPreferenceItem[] {
  const subtotalCents = Math.round(Number(order.subtotal) * 100);
  const discountCents = Math.round(Number(order.discount_amount) * 100);
  const shippingCents = Math.round(Number(order.shipping_amount) * 100);
  const expectedTotalCents = subtotalCents - discountCents + shippingCents;
  if (
    !Number.isSafeInteger(subtotalCents) ||
    !Number.isSafeInteger(discountCents) ||
    !Number.isSafeInteger(shippingCents) ||
    !Number.isSafeInteger(Math.round(Number(order.total) * 100)) ||
    subtotalCents < 1 || discountCents < 0 || discountCents >= subtotalCents ||
    shippingCents < 0 ||
    expectedTotalCents !== Math.round(Number(order.total) * 100)
  ) {
    throw new Error("O total do pedido não é compatível com o pagamento.");
  }

  type Unit = {
    id: string;
    title: string;
    originalCents: number;
    remainder: number;
    discount: number;
  };
  const units: Unit[] = [];
  let subtotalFromLines = 0;
  for (const line of order.items) {
    if (
      !line.product_id || !line.product_name ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 || line.quantity > 30
    ) {
      throw new Error("Um item do pedido está inválido.");
    }
    const unitCents = Math.round(Number(line.unit_price) * 100);
    if (!Number.isSafeInteger(unitCents) || unitCents < 0) {
      throw new Error("O preço de um item está inválido.");
    }
    subtotalFromLines += unitCents * line.quantity;
    for (let index = 0; index < line.quantity; index += 1) {
      units.push({
        id: line.product_id,
        title: line.product_name,
        originalCents: unitCents,
        remainder: 0,
        discount: 0,
      });
    }
  }
  if (
    !units.length || units.length > 30 || subtotalFromLines !== subtotalCents
  ) {
    throw new Error(
      "Os itens do pedido não correspondem ao subtotal calculado.",
    );
  }

  if (discountCents > 0) {
    let allocated = 0;
    for (const unit of units) {
      const numerator = unit.originalCents * discountCents;
      unit.discount = Math.floor(numerator / subtotalCents);
      unit.remainder = numerator % subtotalCents;
      allocated += unit.discount;
    }
    const remainderOrder = [...units].sort((a, b) => b.remainder - a.remainder);
    for (let index = 0; index < discountCents - allocated; index += 1) {
      remainderOrder[index].discount += 1;
    }
  }

  const grouped = new Map<string, MercadoPagoPreferenceItem>();
  for (const unit of units) {
    const payableCents = unit.originalCents - unit.discount;
    if (payableCents < 0) throw new Error("O desconto do pedido é inválido.");
    const key = `${unit.id}:${payableCents}`;
    const existing = grouped.get(key);
    if (existing) existing.quantity += 1;
    else {grouped.set(key, {
        id: unit.id,
        title: unit.title.slice(0, 240),
        quantity: 1,
        unit_price: payableCents / 100,
        currency_id: "BRL",
      });}
  }

  const result = [...grouped.values()];
  if (shippingCents > 0) {
    result.push({
      id: "shipping",
      title: "Frete",
      quantity: 1,
      unit_price: shippingCents / 100,
      currency_id: "BRL",
    });
  }
  return result;
}
