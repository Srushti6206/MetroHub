export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

export function nowMin(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function fmtTime(m: number): string {
  const mm = ((Math.round(m) % 1440) + 1440) % 1440;
  const h = Math.floor(mm / 60);
  const min = mm % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(min).padStart(2, '0')} ${ap}`;
}

export const roundUp5 = (m: number) => Math.ceil(m / 5) * 5;

export function newOrderId(): string {
  const a = Math.random().toString(36).slice(2, 5).toUpperCase();
  const b = Date.now().toString(36).slice(-3).toUpperCase();
  return `PMH-${a}${b}`;
}

export function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}
