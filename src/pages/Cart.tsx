import { Link } from 'react-router-dom';
import { ShoppingBag, Trash2, AlertTriangle, Tag } from 'lucide-react';
import { useStore } from '../store';
import { Cover, Empty, Qty, VegDot } from '../components/ui';
import { inr } from '../lib/format';

export default function Cart() {
  const { t, groups, setQty, removeFromCart, clearCart } = useStore();

  if (groups.length === 0) {
    return (
      <div className="py-10">
        <Empty icon={ShoppingBag} title={t('cart_empty')} desc={t('cart_empty_d')} action={<Link to="/shops" className="btn btn-primary">{t('explore')}</Link>} />
      </div>
    );
  }

  const subtotal = groups.reduce((a, g) => a + g.subtotal, 0);
  const discount = groups.reduce((a, g) => a + g.discount, 0);
  const total = subtotal - discount;
  const blocked = groups.some((g) => g.hasUnavailable);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold">{t('cart_title')}</h1>
        <button className="btn btn-ghost !py-2" onClick={clearCart}><Trash2 size={14} />{t('clear_cart')}</button>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.shop.id} className="glass overflow-hidden">
              <div className="flex items-center gap-3 border-b border-white/70 p-3">
                <Cover shop={g.shop} className="h-10 w-10 rounded-xl" size={18} />
                <div className="flex-1"><div className="font-bold">{g.shop.name}</div><div className="text-xs text-ink/55">{t('demo_shop')} · {t('prep')} ~{g.maxPrep} {t('min')}</div></div>
                <div className="font-extrabold">{inr(g.total)}</div>
              </div>
              <ul className="divide-y divide-white/70">
                {g.lines.map((l) => (
                  <li key={l.product.id} className={`flex items-center gap-3 p-3 ${l.ok ? '' : 'bg-red-50/60'}`}>
                    <VegDot veg={l.product.veg} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{l.product.name}</div>
                      <div className="text-xs text-ink/55">{inr(l.product.price)} × {l.qty} = {inr(l.product.price * l.qty)}</div>
                      {!l.ok && <div className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-red-600"><AlertTriangle size={12} />{t('unavailable')}</div>}
                    </div>
                    {l.ok && <Qty value={l.qty} onChange={(n) => setQty(l.product.id, n)} />}
                    <button aria-label={t('remove')} className="neu grid h-9 w-9 place-items-center text-red-600" onClick={() => removeFromCart(l.product.id)}><Trash2 size={15} /></button>
                  </li>
                ))}
              </ul>
              {(g.offer || g.nextOffer) && (
                <div className="flex items-center gap-2 bg-metro/5 px-4 py-2 text-xs font-semibold text-metro">
                  <Tag size={13} />
                  {g.offer ? `${g.offer.title} — −${inr(g.discount)}` : `${t('offer_hint', { n: inr(g.nextOfferGap ?? 0) })}: ${g.nextOffer!.title}`}
                </div>
              )}
            </section>
          ))}
        </div>

        <aside className="glass sticky top-28 space-y-3 self-start p-5">
          <h2 className="text-lg font-extrabold">{t('order_summary')}</h2>
          <div className="flex justify-between text-sm"><span>{t('subtotal')}</span><span>{inr(subtotal)}</span></div>
          <div className="flex justify-between text-sm text-ok"><span>{t('offer_discount')}</span><span>−{inr(discount)}</span></div>
          <div className="flex justify-between border-t border-ink/10 pt-3 text-lg font-extrabold"><span>{t('grand_total')}</span><span>{inr(total)}</span></div>
          <p className="text-xs text-ink/55">{t('no_fees')}</p>
          {blocked && <p className="flex items-start gap-1.5 rounded-xl bg-red-50 p-2 text-xs font-semibold text-red-700"><AlertTriangle size={14} className="shrink-0" />{t('unavail_note')}</p>}
          {blocked ? <button className="btn btn-primary w-full" disabled>{t('checkout')}</button> : <Link to="/checkout" className="btn btn-primary w-full">{t('checkout')}</Link>}
        </aside>
      </div>
    </div>
  );
}
