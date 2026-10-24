import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Leaf, List, Map as MapIcon, SearchX, Info } from 'lucide-react';
import { useStore } from '../store';
import { ShopCard } from './ShopCard';
import { Cover, Empty, ProductCard } from './ui';
import type { Cat, Shop } from '../types';

const CATS = ['chai', 'bites', 'meals', 'bakery', 'store', 'essentials'] as const;
const GROUPS: Record<string, Cat[]> = {
  food: ['bites', 'meals', 'bakery', 'snacks'],
  bev: ['chai'],
  ess: ['essentials'],
};

export function ShopsBrowser({ withViews = false }: { withViews?: boolean }) {
  const { t, shops, products, offers, stationId } = useStore();
  const [sp, setSp] = useSearchParams();
  const [view, setView] = useState<'list' | 'map'>('list');
  const q = sp.get('q') ?? '';
  const cat = sp.get('cat') ?? '';
  const group = sp.get('group') ?? '';
  const veg = sp.get('veg') === '1';
  const onlyOffers = sp.get('offers') === '1';

  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v); else n.delete(k);
    setSp(n, { replace: true });
  };

  const { list, prods } = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const inStation = shops.filter((s) => s.stationId === stationId);
    const matchProd = (p: typeof products[number]) =>
      p.available && (!veg || p.veg) && (!group || GROUPS[group].includes(p.category)) &&
      (!ql || p.name.toLowerCase().includes(ql) || p.desc.toLowerCase().includes(ql));
    const list = inStation.filter((s) => {
      if (cat && s.category !== cat) return false;
      if (onlyOffers && !offers.some((o) => o.shopId === s.id && o.active)) return false;
      const sp_ = products.filter((p) => p.shopId === s.id);
      if (veg && !sp_.some((p) => p.available && p.veg)) return false;
      if (group && !sp_.some((p) => p.available && GROUPS[group].includes(p.category))) return false;
      if (ql) {
        const hit = s.name.toLowerCase().includes(ql) || s.desc.toLowerCase().includes(ql) || sp_.some(matchProd);
        if (!hit) return false;
      }
      return true;
    });
    const prods = ql ? products.filter((p) => list.some((s) => s.id === p.shopId) && matchProd(p)).slice(0, 12) : [];
    return { list, prods };
  }, [shops, products, offers, stationId, q, cat, group, veg, onlyOffers]);

  const Toggle = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} className={`neu flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold ${on ? 'neu-on' : ''}`}>{children}</button>
  );

  const byId = (id: string) => shops.find((s) => s.id === id) as Shop;

  return (
    <div className="space-y-5">
      <div className="glass space-y-3 p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/45" />
          <input className="input !pl-10" value={q} onChange={(e) => set('q', e.target.value)} placeholder={t('search_ph')} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Toggle on={!cat} onClick={() => set('cat', '')}>{t('all')}</Toggle>
          {CATS.map((c) => <Toggle key={c} on={cat === c} onClick={() => set('cat', cat === c ? '' : c)}>{t('c_' + c)}</Toggle>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Toggle on={group === 'food'} onClick={() => set('group', group === 'food' ? '' : 'food')}>{t('filter_food')}</Toggle>
          <Toggle on={group === 'bev'} onClick={() => set('group', group === 'bev' ? '' : 'bev')}>{t('filter_bev')}</Toggle>
          <Toggle on={group === 'ess'} onClick={() => set('group', group === 'ess' ? '' : 'ess')}>{t('filter_ess')}</Toggle>
          <Toggle on={veg} onClick={() => set('veg', veg ? '' : '1')}><Leaf size={13} />{t('filter_veg')}</Toggle>
          <Toggle on={onlyOffers} onClick={() => set('offers', onlyOffers ? '' : '1')}>{t('filter_offers')}</Toggle>
          {withViews && (
            <div className="ml-auto flex gap-2">
              <Toggle on={view === 'list'} onClick={() => setView('list')}><List size={14} />{t('list_view')}</Toggle>
              <Toggle on={view === 'map'} onClick={() => setView('map')}><MapIcon size={14} />{t('map_view')}</Toggle>
            </div>
          )}
        </div>
      </div>

      {list.length === 0 ? (
        <Empty icon={SearchX} title={t('no_shops')} desc={t('no_shops_d')} />
      ) : view === 'map' && withViews ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-xs text-ink/60"><Info size={14} />{t('schematic_note')}</p>
          <div className="grid gap-4 md:grid-cols-2">
            {(['concourse', 'nearby'] as const).map((z) => (
              <div key={z} className={`rounded-3xl border-2 border-dashed p-4 ${z === 'concourse' ? 'border-metro/40 bg-metro/5' : 'border-cyan/60 bg-cyan/5'}`}>
                <h3 className="mb-3 text-sm font-bold">{t('zone_' + z)}</h3>
                <div className="flex flex-wrap gap-2">
                  {list.filter((s) => s.zone === z).map((s) => (
                    <Link key={s.id} to={`/shops/${s.id}`} className="glass flex items-center gap-2 !rounded-2xl p-2 pr-4 text-sm font-semibold hover:shadow-lg">
                      <Cover shop={s} className="h-9 w-9 rounded-xl" size={16} />{s.name}
                    </Link>
                  ))}
                  {!list.some((s) => s.zone === z) && <span className="text-xs text-ink/50">—</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {withViews && (['concourse', 'nearby'] as const).map((z) => {
            const zs = list.filter((s) => s.zone === z);
            if (!zs.length) return null;
            return (
              <section key={z} className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-ink/55">{t('zone_' + z)}</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{zs.map((s) => <ShopCard key={s.id} shop={s} />)}</div>
              </section>
            );
          })}
          {!withViews && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.map((s) => <ShopCard key={s.id} shop={s} />)}</div>}
        </>
      )}

      {prods.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-lg font-extrabold">{t('nav_shops')} · “{q}”</h3>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{prods.map((p) => <ProductCard key={p.id} product={p} shop={byId(p.shopId)} />)}</div>
        </section>
      )}
    </div>
  );
}
