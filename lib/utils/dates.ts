/** Returns a YYYY-MM-DD string for n days ago (UTC midnight). */
export function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split("T")[0];
}

/** Returns today's date as YYYY-MM-DD (UTC). */
export function today(): string {
  return new Date().toISOString().split("T")[0];
}

/** Returns yesterday's date as YYYY-MM-DD (UTC). */
export function yesterday(): string {
  return daysAgo(1);
}

export function groupByDay<T extends { created: number }>(
  items: T[]
): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const date = new Date(item.created * 1000).toISOString().split("T")[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
