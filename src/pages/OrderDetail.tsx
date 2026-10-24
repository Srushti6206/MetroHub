import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, FastForward, Info, MapPin } from 'lucide-react';
import { useStore, FLOW } from '../store';
import { Empty, StatusChip, Timeline } from '../components/ui';
import { fmtDateTime, fmtTime, inr } from '../lib/format';

export default function OrderDetail() {
  const { orderId } = useParams();
  const { t, orders, stations, advanceOrder, toast } = useStore();
  const o = orders.find((x) => x.id === orderId);
  if (!o) return <div className="py-10"><Empty icon={ClipboardList} title={t('order_missing')} action={<Link to="/orders" className="btn btn-primary">{t('back_orders')}</Link>} /></div>;
  const station = stations.find((s) => s.id === o.stationId);
  const canAdvance = FLOW.indexOf(o.status) >= 0 && o.status !== 'collected';

  return (
    <div className="space-y-5">
      <Link to="/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-metro"><ArrowLeft size={14} />{t('back_orders')}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold">{o.id}</h1><StatusChip status={o.status} />
        {o.seeded && <span className="chip bg-amber-100 text-amber-800">Demo order</span>}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="glass space-y-4 p-5">
          <Timeline order={o} />
          {canAdvance && (
            <div className="space-y-2 border-t border-ink/10 pt-4">
              <button className="btn btn-primary w-full" onClick={async () => { if (await advanceOrder(o.id)) toast(t('simulated_note')); }}><FastForward size={15} />{t('advance')}</button>
              <p className="flex items-start gap-1.5 text-xs text-ink/55"><Info size={13} className="mt-0.5 shrink-0" />{t('simulated_note')}</p>
            </div>
          )}
        </section>
        <section className="glass space-y-4 p-5">
          <div><div className="text-xs text-ink/55">{o.shopName} · {t('demo_shop')}</div><div className="text-lg font-extrabold">{t('items')}</div></div>
          <ul className="space-y-1.5 text-sm">
            {o.items.map((i) => <li key={i.productId} className="flex justify-between"><span>{i.qty} × {i.name}</span><span>{inr(i.qty * i.price)}</span></li>)}
          </ul>
          <div className="space-y-1 border-t border-ink/10 pt-3 text-sm">
            <div className="flex justify-between"><span>{t('subtotal')}</span><span>{inr(o.subtotal)}</span></div>
            {o.discount > 0 && <div className="flex justify-between text-ok"><span>{o.offerTitle}</span><span>−{inr(o.discount)}</span></div>}
            <div className="flex justify-between text-lg font-extrabold"><span>{t('total')}</span><span>{inr(o.total)}</span></div>
          </div>
          <dl className="grid grid-cols-2 gap-3 border-t border-ink/10 pt-3 text-sm">
            <div><dt className="text-xs text-ink/55">{t('station')}</dt><dd className="font-semibold">{station?.name}</dd></div>
            <div><dt className="text-xs text-ink/55">{t('order_id')}</dt><dd className="font-semibold">{o.id}</dd></div>
            <div><dt className="text-xs text-ink/55">{t('arrival')}</dt><dd className="font-semibold">{fmtTime(o.arrival)}</dd></div>
            <div><dt className="text-xs text-ink/55">{t('pickup_time')}</dt><dd className="font-semibold">{fmtTime(o.pickup)} <span className="text-[10px] text-ink/45">(simulated)</span></dd></div>
          </dl>
          <div className="flex items-start gap-2 rounded-2xl bg-lav p-3 text-sm"><MapPin size={16} className="mt-0.5 shrink-0 text-metro" /><div><div className="font-semibold">{o.pickupPoint}</div><div className="text-xs text-ink/65">{t('pickup_help')}</div>{o.note && <div className="mt-1 text-xs">“{o.note}”</div>}</div></div>
          <div className="text-xs text-ink/45">{fmtDateTime(o.createdAt)}</div>
        </section>
      </div>
    </div>
  );
}
