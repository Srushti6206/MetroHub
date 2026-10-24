import { Link, useNavigate } from 'react-router-dom';
import { Coffee, Sandwich, UtensilsCrossed, Croissant, Store, ShoppingBasket, Percent, TrainFront, Clock, Compass, ShoppingBag, PackageCheck, Sparkles, ArrowRight, MapPin, Bot } from 'lucide-react';
import { useStore } from '../store';
import { SearchBar, StationSelect } from '../components/Layout';
import { ShopCard } from '../components/ShopCard';
import { ProductCard, Cover } from '../components/ui';
import { LINE_INFO } from '../data/seed';
import { fmtTime, nowMin } from '../lib/format';

export default function Home() {
  const { t, shops, products, stations, stationId, setMateOpen } = useStore();
  const nav = useNavigate();
  const station = stations.find((s) => s.id === stationId)!;
  const stationShops = shops.filter((s) => s.stationId === stationId);
  const now = nowMin();

  const cats = [
    { k: 'chai', icon: Coffee, to: '/shops?cat=chai' },
    { k: 'bites', icon: Sandwich, to: '/shops?cat=bites' },
    { k: 'meals', icon: UtensilsCrossed, to: '/shops?cat=meals' },
    { k: 'bakery', icon: Croissant, to: '/shops?cat=bakery' },
    { k: 'store', icon: Store, to: '/shops?cat=store' },
    { k: 'essentials', icon: ShoppingBasket, to: '/shops?cat=essentials' },
    { k: 'offers', icon: Percent, to: '/shops?offers=1' },
  ];

  const popular = ['vada-junction-combo', 'misal-ghar-misal', 'tiffin-tales-poha', 'chai-tapri-chai', 'baker-basket-croiss', 'metro-mart-bhujia']
    .map((key) => products.find((p) => (p.seedKey ?? p.id) === key)).filter((p) => !!p);

  return (
    <div className="space-y-14">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-navy via-indigo to-[#2b2f78] p-6 text-white shadow-2xl sm:p-10 lg:p-14">
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-metro/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-cyan/30 blur-3xl" />
        <div className="relative grid items-center gap-10 lg:grid-cols-2">
          <div className="space-y-5">
            <span className="chip glass-dark !rounded-full !px-3 !py-1.5 text-cyan"><TrainFront size={13} />{station.name}</span>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">{t('hero_title')}</h1>
            <p className="max-w-lg text-base text-white/75 sm:text-lg">{t('hero_sub')}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <StationSelect dark />
              <SearchBar className="flex-1" dark />
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="btn btn-primary !px-6 !py-3" onClick={() => nav('/shops')}>{t('explore')}<ArrowRight size={16} /></button>
              <button className="btn btn-dark-ghost !px-6 !py-3" onClick={() => setMateOpen(true)}><Sparkles size={16} />{t('meet_ai')}</button>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 text-xs sm:max-w-md">
              {[[Compass, 'how1_t'], [ShoppingBag, 'how2_t'], [PackageCheck, 'how3_t']].map(([I, k], i) => {
                const Icon = I as typeof Compass;
                return <div key={i} className="glass-dark !rounded-2xl flex items-center gap-2 p-2.5 font-semibold"><Icon size={15} className="text-cyan" />{i + 1}. {t(k as string)}</div>;
              })}
            </div>
          </div>

          {/* visual */}
          <div className="relative mx-auto hidden h-[400px] w-full max-w-md lg:block">
            <div className="absolute inset-x-0 top-10 mx-auto h-56 w-72 rotate-[-4deg] rounded-[28px] bg-gradient-to-br from-metro to-cyan p-5 shadow-2xl">
              <TrainFront size={44} className="text-white/90" />
              <div className="mt-3 flex gap-2">{[0, 1, 2, 3].map((i) => <span key={i} className="h-9 flex-1 rounded-lg bg-white/30" />)}</div>
              <div className="mt-4 h-1.5 rounded-full bg-white/50" />
              <div className="mt-2 flex justify-between text-[10px] font-semibold text-white/80"><span>{LINE_INFO.purple.name}</span><span>{LINE_INFO.aqua.name}</span></div>
            </div>
            <div className="glass-dark floaty absolute left-0 top-0 w-60 p-4">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-cyan">{t('upcoming')}</div>
              <div className="font-bold">Puneri Misal Pav</div>
              <div className="text-xs text-white/65">Kasba Misal Ghar · demo</div>
              <div className="mt-2 flex items-center gap-1.5 text-xs"><Clock size={12} className="text-cyan" />{fmtTime(now + 10)} – {fmtTime(now + 15)}</div>
            </div>
            <div className="glass-dark floaty absolute bottom-6 right-0 w-56 p-4" style={{ animationDelay: '1.5s' }}>
              <div className="flex items-center gap-2 text-sm font-bold"><span className="h-2 w-2 rounded-full bg-ok" />{t('st_preparing')}</div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full w-2/3 rounded-full bg-gradient-to-r from-metro to-cyan" /></div>
              <div className="mt-2 text-[11px] text-white/60">{t('simulated_note')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="space-y-4">
        <h2 className="text-2xl font-extrabold">{t('quick_cats')}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {cats.map((c) => (
            <Link key={c.k} to={c.to} className="glass group flex flex-col items-center gap-3 p-4 text-center transition hover:-translate-y-1 hover:shadow-xl">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-metro/15 to-cyan/25 text-metro transition group-hover:scale-110"><c.icon size={22} /></span>
              <span className="text-xs font-bold leading-tight">{t('c_' + c.k)}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED SHOPS */}
      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-extrabold">{t('featured_shops')}</h2>
          <Link to="/shops" className="flex items-center gap-1 text-sm font-semibold text-metro">{t('view_all')}<ArrowRight size={14} /></Link>
        </div>
        {stationShops.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{stationShops.slice(0, 6).map((s) => <ShopCard key={s.id} shop={s} />)}</div>
        ) : (
          <div className="glass p-6 text-sm">{t('no_demo_shops')}</div>
        )}
      </section>

      {/* HOW IT WORKS */}
      <section className="space-y-4">
        <h2 className="text-2xl font-extrabold">{t('how_title')}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[[Compass, 1], [ShoppingBag, 2], [PackageCheck, 3]].map(([I, n]) => {
            const Icon = I as typeof Compass;
            return (
              <div key={n as number} className="glass relative overflow-hidden p-6">
                <span className="absolute -right-2 -top-4 text-8xl font-black text-metro/10">{n as number}</span>
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-metro to-cyan text-white"><Icon size={22} /></span>
                <h3 className="mt-4 text-lg font-extrabold">{t(`how${n}_t`)}</h3>
                <p className="mt-1 text-sm text-ink/65">{t(`how${n}_d`)}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* POPULAR */}
      <section className="space-y-4">
        <h2 className="text-2xl font-extrabold">{t('featured_products')}</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {popular.map((p) => p && <ProductCard key={p.id} product={p} shop={shops.find((s) => s.id === p.shopId)} />)}
        </div>
      </section>

      {/* AI PROMO */}
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-indigo to-navy p-8 text-white shadow-xl sm:p-10">
        <div className="pointer-events-none absolute -right-10 -top-10 h-60 w-60 rounded-full bg-cyan/30 blur-3xl" />
        <div className="relative grid items-center gap-6 md:grid-cols-[1fr_auto]">
          <div className="space-y-3">
            <span className="chip bg-white/10 text-cyan"><Bot size={13} />AI Demo Mode</span>
            <h2 className="text-2xl font-extrabold sm:text-3xl">{t('mate_promo_t')}</h2>
            <p className="max-w-xl text-white/70">{t('mate_promo_d')}</p>
            <div className="flex flex-wrap gap-2 pt-1">{['q1', 'q3', 'q5'].map((k) => <span key={k} className="chip glass-dark !rounded-full">{t(k)}</span>)}</div>
          </div>
          <button className="btn btn-primary !px-6 !py-3" onClick={() => setMateOpen(true)}><Sparkles size={16} />{t('meet_ai')}</button>
        </div>
      </section>

      {/* STATION AREA */}
      <section className="space-y-4">
        <h2 className="text-2xl font-extrabold">{t('station_area')}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {(['concourse', 'nearby'] as const).map((z) => (
            <div key={z} className="glass space-y-3 p-5">
              <div className="flex items-center gap-2 text-sm font-bold"><MapPin size={15} className="text-metro" />{t('zone_' + z)}</div>
              <div className="flex flex-wrap gap-2">
                {stationShops.filter((s) => s.zone === z).map((s) => (
                  <Link key={s.id} to={`/shops/${s.id}`} className="flex items-center gap-2 rounded-2xl bg-white/70 p-1.5 pr-3 text-xs font-semibold hover:bg-white">
                    <Cover shop={s} className="h-8 w-8 rounded-xl" size={14} />{s.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-ink/55">{t('schematic_note')}</p>
      </section>
    </div>
  );
}
