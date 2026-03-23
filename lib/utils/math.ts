/** Sum an array of numbers. */
export function sum(values: number[]): number;
/** Sum a field across an array of objects (reads `.data[key]`). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sum(items: any[], key: string): number;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sum(itemsOrValues: any[], key?: string): number {
  if (key === undefined) {
    return (itemsOrValues as number[]).reduce((a, b) => a + (Number(b) || 0), 0);
  }
  return itemsOrValues.reduce((acc: number, item: { data?: Record<string, unknown> }) => {
    return acc + (Number(item?.data?.[key]) || 0);
  }, 0);
}

/** Average an array of numbers. */
export function avg(values: number[]): number;
/** Average a field across an array of objects. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function avg(items: any[], key: string): number;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function avg(itemsOrValues: any[], key?: string): number {
  if (!itemsOrValues.length) return 0;
  if (key === undefined) {
    return sum(itemsOrValues as number[]) / itemsOrValues.length;
  }
  return sum(itemsOrValues, key) / itemsOrValues.length;
}

/** Returns percentage change between current and previous (0 if previous is 0). */
export function calcTrend(current: number, previous: number): number {
  if (!previous) return 0;
  return parseFloat((((current - previous) / previous) * 100).toFixed(1));
}

export function calcRate(numerator: number, denominator: number): string {
  if (!denominator) return "0.00";
  return ((numerator / denominator) * 100).toFixed(2);
}
