import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { Package, Clock, ChefHat, CheckCircle2, IndianRupee, Plus, Pencil, Trash2, Info, X, Tag, Eye } from 'lucide-react';
import { useStore } from '../store';
import { StatCard, StatusChip, VegDot, Empty } from '../components/ui';
import { fmtTime, inr } from '../lib/format';
import type { Cat, Offer, Order, Product } from '../types';

export function OwnerLayout() {
  const { t, shops, ownerShopId, setOwnerShop } = useStore();
  const tabs = [['/owner', t('overview'), true], ['/owner/orders', t('manage_orders'), false], ['/owner/products', t('manage_products'), false]] as const;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-3xl font-extrabold">{t('owner_title')}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-amber-800"><Info size={13} />{t('demo_stats')}</p></div>
        <label className="neu flex items-center gap-2 px-3 py-2 text-sm font-semibold">{t('your_shop')}
          <select className="bg-transparent outline-none" value={ownerShopId} onChange={(e) => setOwnerShop(e.target.value)}>
            {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map(([to, label, end]) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${isActive ? 'bg-metro text-white shadow' : 'bg-white/70 text-ink/70'}`}>{label}</NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}

export function OrderActions({ o }: { o: Order }) {
  const { t, setOrderStatus, toast } = useStore();
  const go = async (s: Order['status']) => { if (await setOrderStatus(o.id, s)) toast(`${o.id}: ${t('st_' + s)}`); };
  if (o.status === 'placed')
    return <div className="flex gap-2"><button className="btn btn-primary !py-2" onClick={() => go('accepted')}>{t('accept')}</button><button className="btn btn-ghost !py-2 !text-red-600" onClick={() => go('rejected')}>{t('reject')}</button></div>;
  if (o.status === 'accepted') return <button className="btn btn-primary !py-2" onClick={() => go('preparing')}>{t('start_prep')}</button>;
  if (o.status === 'preparing') return <button className="btn btn-primary !py-2" onClick={() => go('ready')}>{t('mark_ready')}</button>;
  if (o.status === 'ready') return <button className="btn btn-primary !py-2" onClick={() => go('collected')}>{t('mark_collected')}</button>;
  return null;
}

function OrderCard({ o }: { o: Order }) {
  const { t } = useStore();
  return (
    <div className="glass space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-2"><span className="font-bold">{o.id}</span><StatusChip status={o.status} />{o.seeded && <span className="chip bg-amber-100 text-amber-800">Demo</span>}<span className="ml-auto font-extrabold">{inr(o.total)}</span></div>
      <div className="text-sm text-ink/70">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</div>
      <div className="flex items-center gap-1.5 text-xs text-ink/55"><Clock size={12} />{t('pickup_time')}: {fmtTime(o.pickup)} · {t('arrival')}: {fmtTime(o.arrival)}</div>
      {o.note && <div className="text-xs italic text-ink/60">“{o.note}”</div>}
      <div className="flex items-center justify-between gap-2 pt-1"><OrderActions o={o} /><Link to={`/orders/${o.id}`} className="flex items-center gap-1 text-xs font-semibold text-metro"><Eye size={13} />{t('track_order')}</Link></div>
    </div>
  );
}

export function OwnerOverview() {
  const { t, orders, ownerShopId } = useStore();
  const mine = orders.filter((o) => o.shopId === ownerShopId);
  const live = mine.filter((o) => o.status !== 'rejected');
  const top = useMemo(() => {
    const m = new Map<string, number>();
    live.forEach((o) => o.items.forEach((i) => m.set(i.name, (m.get(i.name) ?? 0) + i.qty)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [live]);
  const sales = live.reduce((a, o) => a + o.total, 0);
  const queue = mine.filter((o) => ['placed', 'accepted', 'preparing', 'ready'].includes(o.status));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label={t('today_orders')} value={mine.length} icon={Package} />
        <StatCard label={t('pending')} value={mine.filter((o) => o.status === 'placed').length} icon={Clock} tone="amber" />
        <StatCard label={t('preparing_n')} value={mine.filter((o) => o.status === 'accepted' || o.status === 'preparing').length} icon={ChefHat} tone="cyan" />
        <StatCard label={t('completed')} value={mine.filter((o) => o.status === 'collected').length} icon={CheckCircle2} tone="ok" />
        <StatCard label={`${t('sales')} (demo)`} value={inr(sales)} icon={IndianRupee} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">{t('queue')}</h2>
          {queue.length ? queue.map((o) => <OrderCard key={o.id} o={o} />) : <div className="glass p-5 text-sm">{t('no_queue')}</div>}
        </section>
        <section className="glass space-y-3 self-start p-5">
          <h2 className="text-lg font-extrabold">{t('top_products')}</h2>
          {top.length ? top.map(([n, q], i) => <div key={n} className="flex items-center gap-2 text-sm"><span className="grid h-6 w-6 place-items-center rounded-full bg-lav text-xs font-bold text-metro">{i + 1}</span><span className="flex-1">{n}</span><b>{q}</b></div>) : <p className="text-sm text-ink/55">—</p>}
        </section>
      </div>
    </div>
  );
}

export function OwnerOrders() {
  const { t, orders, ownerShopId } = useStore();
  const mine = orders.filter((o) => o.shopId === ownerShopId).sort((a, b) => b.createdAt - a.createdAt);
  if (!mine.length) return <Empty icon={Package} title={t('no_queue')} />;
  return <div className="grid gap-3 md:grid-cols-2">{mine.map((o) => <OrderCard key={o.id} o={o} />)}</div>;
}

const CAT_OPTS: Cat[] = ['chai', 'bites', 'meals', 'bakery', 'snacks', 'essentials'];

function ProductForm({ initial, onClose }: { initial: Product; onClose: () => void }) {
  const { t, saveProduct, toast } = useStore();
  const [p, setP] = useState(initial);
  const [err, setErr] = useState('');
  const save = async () => {
    if (!p.name.trim()) return setErr(t('f_name') + ' ✗');
    if (!(p.price > 0)) return setErr(t('f_price') + ' ✗');
    if (await saveProduct({ ...p, name: p.name.trim(), prepMin: Math.max(1, p.prepMin) })) {
      toast(t('save') + ' ✓');
      onClose();
    }
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="glass slide-up w-full max-w-md space-y-3 !bg-white/90 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-lg font-extrabold">{initial.name ? t('edit') : t('add_product')}</h3><button onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <label className="block space-y-1 text-sm font-semibold">{t('f_name')}<input className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></label>
        <label className="block space-y-1 text-sm font-semibold">{t('f_desc')}<textarea className="input" value={p.desc} onChange={(e) => setP({ ...p, desc: e.target.value })} /></label>
        <div className="grid grid-cols-3 gap-2">
          <label className="block space-y-1 text-sm font-semibold">{t('f_price')}<input type="number" min={1} className="input" value={p.price} onChange={(e) => setP({ ...p, price: +e.target.value })} /></label>
          <label className="block space-y-1 text-sm font-semibold">{t('f_prep')}<input type="number" min={1} className="input" value={p.prepMin} onChange={(e) => setP({ ...p, prepMin: +e.target.value })} /></label>
          <label className="block space-y-1 text-sm font-semibold">{t('f_cat')}<select className="input" value={p.category} onChange={(e) => setP({ ...p, category: e.target.value as Cat })}>{CAT_OPTS.map((c) => <option key={c} value={c}>{t('c_' + c)}</option>)}</select></label>
        </div>
        <div className="flex gap-4 text-sm font-semibold">
          <label className="flex items-center gap-2"><input type="checkbox" checked={p.veg} onChange={(e) => setP({ ...p, veg: e.target.checked })} />{t('veg')}</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={p.available} onChange={(e) => setP({ ...p, available: e.target.checked })} />{t('available')}</label>
        </div>
        {err && <p className="text-xs font-semibold text-red-600">{err}</p>}
        <div className="flex justify-end gap-2"><button className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button><button className="btn btn-primary" onClick={() => void save()}>{t('save')}</button></div>
      </div>
    </div>
  );
}

function OfferRow({ o }: { o: Offer }) {
  const { t, saveOffer, deleteOffer } = useStore();
  const [draft, setDraft] = useState(o);
  useEffect(() => setDraft(o), [o]);
  const upd = (patch: Partial<Offer>) => setDraft((current) => {
    const next = { ...current, ...patch };
    next.title = `${next.percent}% off on orders above ₹${next.minSubtotal}`;
    return next;
  });
  const persist = () => {
    if (draft.percent !== o.percent || draft.minSubtotal !== o.minSubtotal || draft.active !== o.active) void saveOffer(draft);
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/60 p-3 text-sm">
      <Tag size={15} className="text-metro" />
      <label className="flex items-center gap-1">%<input type="number" min={1} max={90} className="input !w-16 !py-1" value={draft.percent} onChange={(e) => upd({ percent: Math.min(90, Math.max(1, +e.target.value)) })} onBlur={persist} /></label>
      <label className="flex items-center gap-1">≥ ₹<input type="number" min={0} className="input !w-20 !py-1" value={draft.minSubtotal} onChange={(e) => upd({ minSubtotal: Math.max(0, +e.target.value) })} onBlur={persist} /></label>
      <label className="flex items-center gap-1 font-semibold"><input type="checkbox" checked={draft.active} onChange={(e) => { const next = { ...draft, active: e.target.checked, title: `${draft.percent}% off on orders above ₹${draft.minSubtotal}` }; upd({ active: e.target.checked }); void saveOffer(next); }} />{t('available')}</label>
      <button className="neu ml-auto grid h-8 w-8 place-items-center text-red-600" aria-label={t('delete')} onClick={() => void deleteOffer(o.id)}><Trash2 size={14} /></button>
    </div>
  );
}

export function OwnerProducts() {
  const { t, products, offers, ownerShopId, saveProduct, deleteProduct, saveOffer, toast } = useStore();
  const [editing, setEditing] = useState<Product | null>(null);
  const mine = products.filter((p) => p.shopId === ownerShopId);
  const myOffers = offers.filter((o) => o.shopId === ownerShopId);
  const blank = (): Product => ({ id: `${ownerShopId}-${Date.now().toString(36)}`, shopId: ownerShopId, name: '', desc: '', price: 49, category: 'bites', veg: true, available: true, prepMin: 5 });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">{t('manage_products')}</h2><button className="btn btn-primary" onClick={() => setEditing(blank())}><Plus size={15} />{t('add_product')}</button></div>
      <div className="grid gap-3 md:grid-cols-2">
        {mine.map((p) => (
          <div key={p.id} className="glass flex items-center gap-3 p-3">
            <VegDot veg={p.veg} />
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{p.name}</div><div className="text-xs text-ink/55">{inr(p.price)} · {t('prep')} {p.prepMin} {t('min')}</div></div>
            <label className="flex items-center gap-1 text-xs font-semibold"><input type="checkbox" checked={p.available} onChange={async (e) => { const available = e.target.checked; if (await saveProduct({ ...p, available })) toast(`${p.name}: ${available ? t('available') : t('unavailable')}`); }} />{t('available')}</label>
            <button className="neu grid h-9 w-9 place-items-center" aria-label={t('edit')} onClick={() => setEditing(p)}><Pencil size={14} /></button>
            <button className="neu grid h-9 w-9 place-items-center text-red-600" aria-label={t('delete')} onClick={async () => { if (await deleteProduct(p.id)) toast(`${p.name} ✗`); }}><Trash2 size={14} /></button>
          </div>
        ))}
        {!mine.length && <Empty icon={Package} title={t('no_products')} />}
      </div>

      <section className="glass space-y-3 p-5">
        <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">{t('offers_title')}</h2>
          <button className="btn btn-ghost !py-2" onClick={() => saveOffer({ id: `o-${Date.now().toString(36)}`, shopId: ownerShopId, title: '10% off on orders above ₹99', percent: 10, minSubtotal: 99, active: true })}><Plus size={14} />{t('add_offer')}</button></div>
        {myOffers.map((o) => <OfferRow key={o.id} o={o} />)}
      </section>
      {editing && <ProductForm initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
