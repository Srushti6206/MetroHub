import { Link } from 'react-router-dom';
import {
  Coffee, Sandwich, UtensilsCrossed, Croissant, Store, ShoppingBasket, TrainFront, MapPin, Minus, Plus,
  Tag, Leaf, Check, type LucideIcon,
} from 'lucide-react';
import type { Offer, Order, Product, Shop, Status } from '../types';
import { useStore, FLOW } from '../store';
import { inr, fmtTime } from '../lib/format';

export const ICONS: Record<string, LucideIcon> = {
  coffee: Coffee, sandwich: Sandwich, utensils: UtensilsCrossed, croissant: Croissant, store: Store, basket: ShoppingBasket,
};

export function Logo({ light }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="Pune Metro Hub">
      <span className="relative grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-metro to-cyan text-white shadow-lg">
        <TrainFront size={20} />
        <MapPin size={13} className="absolute -bottom-1 -right-1 rounded-full bg-white p-0.5 text-metro" />
      </span>
      <span className={`text-[17px] font-extrabold leading-none tracking-tight ${light ? 'text-white' : 'text-navy'}`}>
        Pune Metro <span className="text-metro">Hub</span>
      </span>
    </Link>
  );
}

export function DemoBadge({ kind = 'demo' }: { kind?: 'demo' | 'verified' }) {
  const { t } = useStore();
  return kind === 'demo' ? (
    <span className="chip bg-amber-100 text-amber-800">{t('demo_shop')}</span>
  ) : (
    <span className="chip bg-ok/15 text-ok"><Check size={12} />{t('verified_biz')}</span>
  );
}

export function VegDot({ veg }: { veg: boolean }) {
  return (
    <span title={veg ? 'Veg' : 'Non-veg'} className={`inline-grid h-4 w-4 place-items-center rounded-[4px] border-2 ${veg ? 'border-ok' : 'border-red-600'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${veg ? 'bg-ok' : 'bg-red-600'}`} />
    </span>
  );
}

export function Cover({ shop, className = '', size = 40 }: { shop: Shop; className?: string; size?: number }) {
  const Icon = ICONS[shop.icon] ?? Store;
  return (
    <div className={`relative grid place-items-center overflow-hidden ${className}`} style={{ background: `linear-gradient(135deg, ${shop.hue[0]}, ${shop.hue[1]})` }}>
      <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/20 blur-xl" />
      <div className="absolute -bottom-8 -left-4 h-24 w-24 rounded-full bg-white/10" />
      <Icon size={size} className="relative text-white drop-shadow" strokeWidth={1.6} />
    </div>
  );
}

export function Qty({ value, onChange, min = 0 }: { value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-2xl bg-[#EEF0FA] p-1 shadow-[inset_2px_2px_5px_#d2d6e8,inset_-2px_-2px_5px_#fff]">
      <button aria-label="Decrease" className="neu grid h-8 w-8 place-items-center" onClick={() => onChange(Math.max(min, value - 1))}><Minus size={14} /></button>
      <span className="w-7 text-center text-sm font-bold tabular-nums">{value}</span>
      <button aria-label="Increase" className="neu grid h-8 w-8 place-items-center" onClick={() => onChange(value + 1)}><Plus size={14} /></button>
    </div>
  );
}

export function ProductCard({ product, shop }: { product: Product; shop?: Shop }) {
  const { t, cart, addToCart, setQty, toast } = useStore();
  const line = cart.find((l) => l.productId === product.id);
  return (
    <div className={`glass flex gap-3 p-3 transition hover:-translate-y-0.5 ${product.available ? '' : 'opacity-60'}`}>
      {shop ? (
        <Cover shop={shop} className="h-24 w-24 shrink-0 rounded-2xl" size={30} />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-2">
          <VegDot veg={product.veg} />
          <h4 className="text-sm font-bold leading-tight">{product.name}</h4>
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-ink/65">{product.desc}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink/60">
          <span>{t('prep')} ~{product.prepMin} {t('min')}</span>
          <span className={product.available ? 'font-semibold text-ok' : 'font-semibold text-red-600'}>
            {product.available ? t('available') : t('unavailable')}
          </span>
        </div>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-base font-extrabold">{inr(product.price)}</span>
          {!product.available ? null : line ? (
            <Qty value={line.qty} onChange={(n) => setQty(product.id, n)} />
          ) : (
            <button className="btn btn-primary !px-3 !py-1.5 !text-xs" onClick={() => { addToCart(product.id); toast(`${product.name} ${t('added')}`); }}>
              <Plus size={14} />{t('add')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function OfferBanner({ offer }: { offer: Offer }) {
  return (
    <span className="chip bg-metro/10 text-metro"><Tag size={12} />{offer.title}</span>
  );
}

export function Empty({ icon: Icon, title, desc, action }: { icon: LucideIcon; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="glass mx-auto flex max-w-md flex-col items-center gap-3 p-10 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-lav text-metro"><Icon size={26} /></span>
      <h3 className="text-lg font-bold">{title}</h3>
      {desc && <p className="text-sm text-ink/65">{desc}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export const STATUS_COLOR: Record<Status, string> = {
  placed: 'bg-lav text-metro',
  accepted: 'bg-cyan/20 text-cyan-800',
  preparing: 'bg-amber-100 text-amber-800',
  ready: 'bg-ok/15 text-ok',
  collected: 'bg-slate-200 text-slate-700',
  rejected: 'bg-red-100 text-red-700',
};

export function StatusChip({ status }: { status: Status }) {
  const { t } = useStore();
  return <span className={`chip ${STATUS_COLOR[status]}`}>{t('st_' + status)}</span>;
}

export function Timeline({ order }: { order: Order }) {
  const { t } = useStore();
  if (order.status === 'rejected') {
    return <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{t('st_rejected')}</div>;
  }
  const cur = FLOW.indexOf(order.status);
  return (
    <ol className="relative space-y-5">
      {FLOW.map((st, i) => {
        const done = i <= cur;
        const at = order.history.find((h) => h.status === st)?.at;
        return (
          <li key={st} className="relative flex gap-3">
            {i < FLOW.length - 1 && <span className={`absolute left-[15px] top-8 h-[calc(100%-4px)] w-0.5 ${i < cur ? 'bg-metro' : 'bg-lav'}`} />}
            <span className={`z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${done ? 'bg-gradient-to-br from-metro to-cyan text-white shadow' : 'bg-lav text-ink/40'} ${i === cur ? 'ring-4 ring-metro/20' : ''}`}>
              {done ? <Check size={15} /> : i + 1}
            </span>
            <div className="pt-1">
              <div className={`text-sm font-semibold ${done ? '' : 'text-ink/45'}`}>{t('st_' + st)}</div>
              {at && <div className="text-xs text-ink/55">{new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function StatCard({ label, value, icon: Icon, tone = 'metro' }: { label: string; value: string | number; icon: LucideIcon; tone?: 'metro' | 'ok' | 'cyan' | 'amber' }) {
  const tones = { metro: 'bg-metro/10 text-metro', ok: 'bg-ok/10 text-ok', cyan: 'bg-cyan/20 text-cyan-800', amber: 'bg-amber-100 text-amber-800' };
  return (
    <div className="glass p-4">
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}><Icon size={18} /></span>
      <div className="mt-3 text-2xl font-extrabold tabular-nums">{value}</div>
      <div className="text-xs font-medium text-ink/60">{label}</div>
    </div>
  );
}

export function PickupLine({ arrival, pickup }: { arrival: number; pickup: number }) {
  return <span>{fmtTime(arrival)} → {fmtTime(pickup)}</span>;
}

export { Leaf };
