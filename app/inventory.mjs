export function usageTrend(records, productId, end, days = 7) {
  const totals = new Map();
  for (const record of records) {
    if (record.product_id === productId) {
      totals.set(record.taken_date, (totals.get(record.taken_date) ?? 0) + record.quantity);
    }
  }
  const period = Array.from({ length: days * 2 }, (_, index) => {
    const date = new Date(end + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() + index - days * 2 + 1);
    const key = date.toISOString().slice(0, 10);
    return { date: key, quantity: totals.get(key) ?? 0 };
  });
  const previous = period.slice(0, days).reduce((sum, item) => sum + item.quantity, 0);
  const current = period.slice(days).reduce((sum, item) => sum + item.quantity, 0);
  return { points: period.slice(days), current, previous, rising: current > 0 && (previous === 0 || current >= previous * 1.25) };
}

export function stockStatus(product) {
  if (product.stock === null) return 'Belum dihitung';
  if (product.stock === 0) return 'Habis';
  return product.stock <= product.minimum ? 'Stok menipis' : 'Stok aman';
}

export function categoryActivity(products, receipts, withdrawals, start, end) {
  const byProduct = new Map();
  const byCategory = new Map();
  for (const { id, category } of products) {
    if (!byCategory.has(category)) byCategory.set(category, { category, products: 0, incoming: 0, outgoing: 0 });
    const row = byCategory.get(category);
    row.products += 1;
    byProduct.set(id, row);
  }
  for (const [records, direction] of [[receipts, 'incoming'], [withdrawals, 'outgoing']]) {
    for (const { product_id, taken_date } of records) {
      const row = byProduct.get(product_id);
      if (row && taken_date >= start && taken_date <= end) row[direction] += 1;
    }
  }
  return [...byCategory.values()].sort((a, b) => a.category.localeCompare(b.category, 'id'));
}
