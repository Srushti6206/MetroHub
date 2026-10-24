import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, MapPin, Info, AlertTriangle, ShoppingBag } from 'lucide-react';
import { useStore } from '../store';
import { Empty } from '../components/ui';
import { fmtTime, inr, nowMin, roundUp5 } from '../lib/format';
import type { Order } from '../types';

function slots(from: number, count: number) {
  return Array.from({ length: count }, (_, i) => Math.min(1435, from + i * 5)).filter((v, i, a) => a.indexOf(v) === i);
}

export default function Checkout() {
  const { t, groups, stationId, stations, placeOrders, toast } = useStore();
  const nav = useNavigate();
  const station = stations.find((s) => s.id === stationId)!;
  const stationOperational = !!station && Object.values(station.statusByLine).includes('operational');
  const now = nowMin();
  const maxPrep = Math.max(0, ...groups.map((g) => g.maxPrep));
  const arrivalOpts = useMemo(() => slots(roundUp5(now + 5), 36), [now]);
  const [arrival, setArrival] = useState(arrivalOpts[2]);
  const earliest = roundUp5(Math.max(arrival, now + maxPrep));
  const pickupOpts = useMemo(() => slots(earliest, 13), [earliest]);
  const [pickup, setPickup] = useState(earliest);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState<Order[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const effPickup = Math.max(pickup, earliest);
  const total = groups.reduce((a, g) => a + g.total, 0);

  if (done) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-8">
        <div className="glass slide-up space-y-4 p-8 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ok/15 text-ok"><CheckCircle2 size={34} /></span>
          <h1 className="text-2xl font-extrabold">{t('placed_title')}</h1>
          <p className="text-sm text-ink/65">{t('placed_d')}</p>
          <div className="space-y-2 text-left">
            {done.map((o) => (
              <Link key={o.id} to={`/orders/${o.id}`} className="neu flex items-center justify-between p-3">
                <span><span className="block text-xs text-ink/55">{o.shopName}</span><span className="font-bold">{o.id}</span></span>
                <span className="text-sm font-bold text-metro">{t('track_order')} →</span>
              </Link>
            ))}
          </div>
          <p className="text-xs text-ink/50">{t('demo_checkout')}</p>
          <button className="btn btn-primary w-full" onClick={() => nav(`/orders/${done[0].id}`)}>{t('track_order')}</button>
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return <div className="py-10"><Empty icon={ShoppingBag} title={t('cart_empty')} action={<Link to="/shops" className="btn btn-primary">{t('explore')}</Link>} /></div>;
  }

  const submit = async () => {
    if (submitting) return;
    if (!stationOperational) { setError(t('order_station_unverified')); return; }
    if (groups.some((g) => g.hasUnavailable)) { setError(t('unavail_note')); return; }
    if (effPickup < arrival || effPickup < roundUp5(now + maxPrep) ) { setError(t('err_pickup')); return; }
    setSubmitting(true);
    setError('');
    try {
      const created = await placeOrders({ arrival, pickup: effPickup, note });
      if (!created.length) { setError(t('err_empty')); return; }
      toast(t('placed_title'));
      setDone(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The backend could not place the order. Your remaining cart items were kept.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-extrabold">{t('checkout_title')}</h1>
      <p className="flex items-center gap-2 rounded-2xl bg-amber-50 p-3 text-xs font-semibold text-amber-800"><Info size={14} />{t('demo_checkout')}</p>
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <section className="glass space-y-3 p-5">
            <div className="flex items-center gap-2 font-bold"><MapPin size={16} className="text-metro" />{t('pickup_point')}</div>
            <div className="text-sm"><span className="font-semibold">{station.name}</span><br />{t('pickup_point_val')}</div>
            {!stationOperational && <p className="text-xs font-semibold text-amber-800">{t('order_station_unverified')}</p>}
          </section>
          <section className="glass space-y-4 p-5">
            <div className="flex items-center gap-2 font-bold"><Clock size={16} className="text-metro" />{t('arrival')} & {t('pickup_time')}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-semibold">{t('arrival')}
                <select className="input" value={arrival} onChange={(e) => { setArrival(+e.target.value); setError(''); }}>
                  {arrivalOpts.map((m) => <option key={m} value={m}>{fmtTime(m)}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm font-semibold">{t('pickup_time')}
                <select className="input" value={effPickup} onChange={(e) => { setPickup(+e.target.value); setError(''); }}>
                  {pickupOpts.map((m) => <option key={m} value={m}>{fmtTime(m)}</option>)}
                </select>
              </label>
            </div>
            <p className="text-xs text-ink/60">{t('prep_needed')}: ~{maxPrep} {t('min')} · {t('earliest')}: {fmtTime(earliest)} <span className="text-ink/40">(simulated)</span></p>
          </section>
          <section className="glass space-y-2 p-5">
            <label className="text-sm font-bold">{t('instructions')}</label>
            <textarea className="input min-h-20" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. less spicy, no onion" />
          </section>
        </div>

        <aside className="glass sticky top-28 space-y-3 self-start p-5">
          <h2 className="text-lg font-extrabold">{t('order_summary')}</h2>
          {groups.map((g) => (
            <div key={g.shop.id} className="space-y-1 text-sm">
              <div className="font-bold">{g.shop.name}</div>
              {g.lines.map((l) => <div key={l.product.id} className="flex justify-between text-ink/70"><span>{l.qty} × {l.product.name}</span><span>{inr(l.qty * l.product.price)}</span></div>)}
              {g.discount > 0 && <div className="flex justify-between text-ok"><span>{g.offer?.title}</span><span>−{inr(g.discount)}</span></div>}
            </div>
          ))}
          <div className="flex justify-between border-t border-ink/10 pt-3 text-lg font-extrabold"><span>{t('grand_total')}</span><span>{inr(total)}</span></div>
          {error && <p className="flex items-start gap-1.5 rounded-xl bg-red-50 p-2 text-xs font-semibold text-red-700"><AlertTriangle size={14} className="shrink-0" />{error}</p>}
          <button className="btn btn-primary w-full" onClick={() => void submit()} disabled={submitting || !stationOperational}>{submitting ? 'Submitting…' : t('place_order')}</button>
        </aside>
      </div>
    </div>
  );
}
