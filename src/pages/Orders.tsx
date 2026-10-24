import { Link } from 'react-router-dom';
import { ClipboardList, Clock, ChevronRight } from 'lucide-react';
import { useStore } from '../store';
import { Empty, StatusChip } from '../components/ui';
import { fmtDateTime, fmtTime, inr } from '../lib/format';

export default function Orders() {
  const { t, orders } = useStore();
  if (!orders.length) return <div className="py-10"><Empty icon={ClipboardList} title={t('no_orders')} action={<Link to="/shops" className="btn btn-primary">{t('explore')}</Link>} /></div>;
  const sorted = [...orders].sort((a, b) => b.createdAt - a.createdAt);
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-extrabold">{t('orders_title')}</h1>
      <div className="grid gap-3 md:grid-cols-2">
        {sorted.map((o) => (
          <Link key={o.id} to={`/orders/${o.id}`} className="glass flex items-center gap-3 p-4 transition hover:-translate-y-0.5">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2"><span className="font-bold">{o.id}</span><StatusChip status={o.status} />{o.seeded && <span className="chip bg-amber-100 text-amber-800">Demo</span>}</div>
              <div className="text-sm font-semibold">{o.shopName}</div>
              <div className="truncate text-xs text-ink/60">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</div>
              <div className="flex items-center gap-3 text-xs text-ink/55"><span className="flex items-center gap-1"><Clock size={12} />{fmtTime(o.pickup)}</span><span>{fmtDateTime(o.createdAt)}</span></div>
            </div>
            <div className="text-right"><div className="font-extrabold">{inr(o.total)}</div><ChevronRight size={18} className="ml-auto text-ink/40" /></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
