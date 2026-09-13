/** คำนวณยอดรวม + ส่วนลดโปรโมชั่น (pure function) */
export function calcBillTotals(billItems = [], promotions = []) {
  const subTotal = billItems.reduce(
    (acc, i) => acc + (Number(i.price) || 0) * (Number(i.qty) || 0),
    0
  );

  let discount = 0;
  const activePromos = [];

  (promotions || []).forEach((promo) => {
    if (!promo || !Array.isArray(promo.items) || promo.items.length === 0) return;
    const promoPrice = Number(promo.discount_price) || 0;

    if (promo.type === "qty") {
      const minQty = Number(promo.min_qty) || 0;
      if (minQty <= 0) return;

      const cartItem = billItems.find((i) => i.productId === promo.items[0]?.id);
      const cartQty = Number(cartItem?.qty) || 0;
      if (!cartItem || cartQty < minQty) return;

      const sets = Math.floor(cartQty / minQty);
      const discPerSet = (Number(cartItem.price) || 0) * minQty - promoPrice;
      if (sets > 0 && discPerSet > 0) {
        discount += sets * discPerSet;
        activePromos.push(`${promo.name} (${sets} ชุด)`);
      }
    } else if (promo.type === "bundle") {
      const sets = promo.items.map((p) => {
        const b = billItems.find((x) => x.productId === p?.id);
        const req = Number(p?.qty) > 0 ? Number(p.qty) : 1;
        return b ? Math.floor((Number(b.qty) || 0) / req) : 0;
      });

      const maxSets = Math.min(...sets);
      if (!Number.isFinite(maxSets) || maxSets <= 0) return;

      const normalPrice = promo.items.reduce((acc, p) => {
        const item = billItems.find((x) => x.productId === p?.id);
        const req = Number(p?.qty) > 0 ? Number(p.qty) : 1;
        return acc + (item ? (Number(item.price) || 0) * req : 0);
      }, 0);

      const discPerSet = normalPrice - promoPrice;
      if (discPerSet > 0) {
        discount += maxSets * discPerSet;
        activePromos.push(`${promo.name} (${maxSets} ชุด)`);
      }
    }
  });

  discount = Math.max(0, Math.min(discount, subTotal));
  return { subTotal, discount, totalsale: subTotal - discount, activePromos };
}

/** ทำให้ qty ที่ค้างว่าง/ผิดรูป กลับมาเป็นตัวเลขที่ใช้งานได้ */
export function normalizeItems(billItems = []) {
  return billItems.map((item) => {
    const qty = Number(item.qty);
    const fallback = Number(item.lastQty) || 1;
    return { ...item, qty: Number.isFinite(qty) && qty > 0 ? qty : fallback };
  });
}

/** ตัด field ชั่วคราวออกก่อนส่งเข้า DB */
export function toDbItems(billItems = []) {
  return billItems
    .map(({ lastQty, tempId, stock, ...rest }) => ({
      ...rest,
      qty: Number(rest.qty) || 0,
    }))
    .filter((i) => i.qty > 0);
}
