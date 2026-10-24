import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Search, ShoppingBag, Store, ArrowLeft } from 'lucide-react';
import { useStore } from '../store';
import { Cover, DemoBadge, Empty, OfferBanner, ProductCard } from '../components/ui';
import { inr } from '../lib/format';

export default function ShopDetail() {
  const { shopId } = useParams();
  const { t, shops, products, offers, groups } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const shop = shops.find((s) => s.id === shopId);
  const items = useMemo(() => products.filter((p) => p.shopId === shopId), [products, shopId]);
  const cats = useMemo(() => Array.from(new Set(items.map((p) => p.category))), [items]);

  if (!shop) return <Empty icon={Store} title={t('not_found')} action={<Link className="btn btn-primary" to="/shops">{t('nav_shops')}</Link>} />;

  const shopOffers = offers.filter((o) => o.shopId === shop.id && o.active);
  const filtered = items.filter((p) => (!cat || p.category === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase()) || p.desc.toLowerCase().includes(q.toLowerCase())));
  const g = groups.find((x) => x.shop.id === shop.id);

  return (
    <div className="space-y-6">
      <Link to="/shops" className="inline-flex items-center gap-1 text-sm font-semibold text-metro"><ArrowLeft size={14} />{t('nav_shops')}</Link>
      <div className="glass overflow-hidden">
        <Cover shop={shop} className="h-40 w-full sm:h-52" size={64} />
        <div className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2"><DemoBadge kind={shop.kind} /><span className="chip bg-lav text-metro">{t('c_' + shop.category)}</span><span className="chip bg-white text-ink/70">{t('zone_' + shop.zone)}</span></div>
          <h1 className="text-3xl font-extrabold">{shop.name}</h1>
          <p className="text-ink/70">{shop.desc}</p>
          {shopOffers.length > 0 && <div className="flex flex-wrap gap-2">{shopOffers.map((o) => <OfferBanner key={o.id} offer={o} />)}</div>}
        </div>
      </div>

      <div className="glass space-y-3 p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/45" />
          <input className="input !pl-10" placeholder={t('search_products')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={`neu px-3.5 py-2 text-xs font-semibold ${!cat ? 'neu-on' : ''}`} onClick={() => setCat('')}>{t('all')}</button>
          {cats.map((c) => <button key={c} className={`neu px-3.5 py-2 text-xs font-semibold ${cat === c ? 'neu-on' : ''}`} onClick={() => setCat(c)}>{t('c_' + c)}</button>)}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty icon={Search} title={t('no_products')} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{filtered.map((p) => <ProductCard key={p.id} product={p} shop={shop} />)}</div>
      )}

      {g && (
        <Link to="/cart" className="btn btn-primary sticky bottom-24 z-30 mx-auto flex w-fit !px-6 !py-3 shadow-2xl md:bottom-6">
          <ShoppingBag size={16} />{t('nav_cart')} · {g.lines.reduce((a, l) => a + l.qty, 0)} · {inr(g.total)}
        </Link>
      )}
    </div>
  );
}
