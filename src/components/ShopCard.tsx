import { Link } from 'react-router-dom';
import { Leaf, ArrowRight, Zap } from 'lucide-react';
import type { Shop } from '../types';
import { useStore } from '../store';
import { Cover, DemoBadge, OfferBanner } from './ui';
import { inr } from '../lib/format';
import { LINE_INFO } from '../data/stations';

export function ShopCard({ shop }: { shop: Shop }) {
  const { t, products, offers, stations } = useStore();
  const items = products.filter((p) => p.shopId === shop.id);
  const avail = items.filter((p) => p.available);
  const offer = offers.find((o) => o.shopId === shop.id && o.active);
  const min = avail.length ? Math.min(...avail.map((p) => p.price)) : 0;
  const max = avail.length ? Math.max(...avail.map((p) => p.price)) : 0;
  const hasVeg = avail.some((p) => p.veg);
  const linked = stations.filter((station) => (shop.stationIds ?? [shop.stationId]).includes(station.id));
  const locationLabel = shop.locationType === 'inside_station' ? t('loc_inside') : shop.locationType === 'station_premises' ? t('loc_premises') : shop.locationType === 'nearby_outside' ? t('loc_nearby') : t('loc_sample_unknown');
  return (
    <article className="glass group flex flex-col overflow-hidden transition duration-200 hover:-translate-y-1 hover:shadow-2xl">
      <Link to={`/shops/${shop.id}`}><Cover shop={shop} className="h-36 w-full" size={46} /></Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <DemoBadge kind={shop.kind} />
          <span className="chip bg-lav text-metro">{t('c_' + shop.category)}</span>
        </div>
        <h3 className="text-lg font-extrabold leading-tight">{shop.name}</h3>
        <p className="line-clamp-2 text-sm text-ink/65">{shop.desc}</p>
        {linked.length > 0 && <p className="text-xs text-ink/60">{linked.map((station) => `${station.name} · ${station.lines.map((line) => LINE_INFO[line].name).join(' / ')}`).join(' · ')}</p>}
        <p className="text-[11px] font-semibold text-amber-800">{shop.verificationStatus === 'verified' ? locationLabel : t('loc_sample_unknown')}{shop.distanceMetres != null ? ` · ${shop.distanceMetres} m` : ''}</p>
        {shop.address && <p className="text-xs text-ink/60">{shop.address}</p>}
        {shop.verificationStatus === 'verified' && shop.dataSource?.startsWith('https://') && <a className="text-xs text-metro underline" href={shop.dataSource} target="_blank" rel="noreferrer">{t('open_source')}</a>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-ink/70">
          {avail.length > 0 && <span>{inr(min)} – {inr(max)}</span>}
          {hasVeg && <span className="flex items-center gap-1 text-ok"><Leaf size={12} />{t('veg_options')}</span>}
          <span className={avail.length ? 'text-ok' : 'text-red-600'}>● {avail.length ? t('open_demo') : t('closed_all')}</span>
        </div>
        {offer && <div><OfferBanner offer={offer} /></div>}
        <div className="mt-auto flex gap-2 pt-2">
          <Link to={`/shops/${shop.id}`} className="btn btn-ghost flex-1 !px-3">{t('explore_shop')}</Link>
          <Link to={`/shops/${shop.id}`} className="btn btn-primary flex-1 !px-3"><Zap size={14} />{t('order_ahead')}<ArrowRight size={14} /></Link>
        </div>
      </div>
    </article>
  );
}
