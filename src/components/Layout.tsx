import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, Search, ShoppingBag, ClipboardList, Store, Map, User, Globe, TrainFront, Sparkles, RotateCcw, Check } from 'lucide-react';
import { useStore } from '../store';
import { Logo } from './ui';
import { LANGS } from '../i18n';
import { MetroMate } from './MetroMate';
import type { Lang } from '../types';

export function StationSelect({ dark = false }: { dark?: boolean }) {
  const { stationId, setStation, stations, t } = useStore();
  return (
    <label className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold ${dark ? 'glass-dark' : 'neu'}`}>
      <TrainFront size={16} className={dark ? 'text-cyan' : 'text-metro'} />
      <span className="sr-only">{t('station')}</span>
      <select
        value={stationId}
        onChange={(e) => setStation(e.target.value)}
        className="max-w-[150px] cursor-pointer truncate bg-transparent outline-none sm:max-w-[200px]"
      >
        {stations.map((s) => (
          <option key={s.id} value={s.id} className="text-ink">{s.name}</option>
        ))}
      </select>
    </label>
  );
}

export function SearchBar({ className = '', dark = false }: { className?: string; dark?: boolean }) {
  const { t } = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  return (
    <form
      className={`relative ${className}`}
      onSubmit={(e) => { e.preventDefault(); nav(`/shops${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); }}
    >
      <Search size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${dark ? 'text-white/60' : 'text-ink/45'}`} />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('search_ph')}
        aria-label={t('search_ph')}
        className={`input !pl-10 ${dark ? '!border-white/25 !bg-white/10 !text-white placeholder:text-white/55' : ''}`}
      />
    </form>
  );
}

function LangSwitch() {
  const { lang, setLang } = useStore();
  return (
    <label className="neu flex items-center gap-1.5 px-2.5 py-2 text-sm font-semibold">
      <Globe size={15} className="text-metro" />
      <span className="sr-only">Language</span>
      <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="cursor-pointer bg-transparent outline-none">
        {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
      </select>
    </label>
  );
}

function Header() {
  const { t, count, resetDemo, toast } = useStore();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-white/55 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Logo />
        <div className="ml-2 hidden lg:block"><StationSelect /></div>
        <SearchBar className="mx-2 hidden max-w-sm flex-1 md:block" />
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden lg:block"><LangSwitch /></div>
          <Link to="/orders" className="neu hidden items-center gap-2 px-3 py-2 text-sm font-semibold sm:flex"><ClipboardList size={16} className="text-metro" />{t('nav_orders')}</Link>
          <Link to="/cart" className="neu relative grid h-10 w-10 place-items-center" aria-label={t('nav_cart')}>
            <ShoppingBag size={18} className="text-metro" />
            {count > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-gradient-to-br from-metro to-cyan px-1 text-[11px] font-bold text-white">{count}</span>}
          </Link>
          <div className="relative">
            <button className="neu grid h-10 w-10 place-items-center" aria-label={t('profile')} onClick={() => setOpen((v) => !v)}><User size={18} className="text-metro" /></button>
            {open && (
              <div className="glass slide-up absolute right-0 top-12 w-60 p-2 text-sm">
                <div className="px-3 py-2"><div className="font-bold">{t('demo_user')}</div><div className="text-xs text-ink/55">demo@local</div></div>
                <Link to="/owner" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-lav"><Store size={15} />{t('nav_owner')}</Link>
                <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-lav" onClick={() => { resetDemo(); setOpen(false); toast('Demo data reset'); }}><RotateCcw size={15} />{t('reset_demo')}</button>
                <div className="mt-1 px-3 py-2 lg:hidden"><LangSwitch /></div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 pb-3 lg:hidden">
        <StationSelect />
        <SearchBar className="min-w-0 flex-1 md:hidden" />
      </div>
    </header>
  );
}

function BottomNav() {
  const { t, count } = useStore();
  const items = [
    { to: '/', icon: Home, label: t('nav_home'), end: true },
    { to: '/shops', icon: Store, label: t('nav_shops') },
    { to: '/stations', icon: Map, label: t('nav_stations') },
    { to: '/cart', icon: ShoppingBag, label: t('nav_cart'), badge: count },
    { to: '/orders', icon: ClipboardList, label: t('nav_orders') },
  ];
  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 md:hidden">
      <div className="glass flex justify-around p-1.5">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[10px] font-semibold ${isActive ? 'bg-metro/10 text-metro' : 'text-ink/60'}`}>
            <i.icon size={19} />{i.label}
            {!!i.badge && <span className="absolute right-3 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-metro px-1 text-[10px] text-white">{i.badge}</span>}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function DesktopNav() {
  const { t } = useStore();
  const links = [['/', t('nav_home')], ['/stations', t('nav_stations')], ['/shops', t('nav_shops')], ['/orders', t('nav_orders')], ['/owner', t('nav_owner')]];
  return (
    <nav className="mx-auto hidden max-w-7xl gap-1 px-4 pt-3 md:flex">
      {links.map(([to, label]) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `rounded-full px-4 py-1.5 text-sm font-semibold transition ${isActive ? 'bg-metro text-white shadow' : 'text-ink/65 hover:bg-white/70'}`}>{label}</NavLink>
      ))}
    </nav>
  );
}

function Footer() {
  const { t } = useStore();
  return (
    <footer className="mt-16 bg-navy px-4 pb-28 pt-10 text-white/75 md:pb-10">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-3">
        <div className="space-y-3">
          <Logo light />
          <p className="text-sm font-semibold text-white">{t('tagline')}</p>
          <p className="text-xs">Order ahead. Skip the wait. Explore local.</p>
        </div>
        <div className="space-y-2 text-sm">
          <Link className="block hover:text-white" to="/shops">{t('nav_shops')}</Link>
          <Link className="block hover:text-white" to="/stations">{t('nav_stations')}</Link>
          <Link className="block hover:text-white" to="/owner">{t('nav_owner')}</Link>
        </div>
        <div className="space-y-2 text-xs leading-relaxed">
          <p>{t('footer_1')}</p>
          <p>{t('footer_2')}</p>
          <p className="flex gap-1.5"><Check size={13} className="mt-0.5 shrink-0 text-ok" />{t('footer_3')}</p>
        </div>
      </div>
    </footer>
  );
}

function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 md:bottom-6">
      {toasts.map((x) => (
        <div key={x.id} className="slide-up glass pointer-events-auto flex items-center gap-2 !rounded-full bg-navy/90 px-4 py-2 text-sm font-semibold !text-white">
          <Check size={14} className="text-ok" />{x.msg}
        </div>
      ))}
    </div>
  );
}

export default function Layout() {
  const { setMateOpen, t, stations, catalogStatus, backendError, reloadBackend } = useStore();
  return (
    <div className="page-bg min-h-screen">
      <Header />
      <DesktopNav />
      <main className="mx-auto max-w-7xl px-4 pt-4">
        {catalogStatus === 'loading' && <div className="glass my-8 p-6 text-center text-sm font-semibold">Connecting to the project database…</div>}
        {catalogStatus === 'error' && <div className="glass my-8 space-y-3 p-6 text-center">
          <p className="font-semibold text-red-700">Could not load the catalog from Flask/MongoDB.</p>
          <p className="text-sm text-ink/65">{backendError}</p>
          <button className="btn btn-primary" onClick={() => void reloadBackend()}>Retry connection</button>
        </div>}
        {catalogStatus === 'ready' && backendError && <div role="alert" className="my-3 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{backendError}</div>}
        {catalogStatus === 'ready' && stations.length === 0 && <div className="glass my-8 space-y-3 p-6 text-center">
          <p className="text-sm">The backend is connected, but its catalog has no stations yet. Seed the MongoDB catalog, then retry.</p>
          <button className="btn btn-primary" onClick={() => void reloadBackend()}>Retry connection</button>
        </div>}
        {catalogStatus === 'ready' && stations.length > 0 && <Outlet />}
      </main>
      <Footer />
      <button
        onClick={() => setMateOpen(true)}
        disabled={catalogStatus !== 'ready'}
        className="btn btn-primary fixed bottom-24 right-4 z-40 !rounded-full !px-4 !py-3 disabled:opacity-50 md:bottom-6 md:right-6"
        aria-label={t('mate_title')}
      >
        <Sparkles size={18} /><span className="hidden sm:inline">MetroMate AI</span>
      </button>
      <MetroMate />
      <BottomNav />
      <Toasts />
    </div>
  );
}
