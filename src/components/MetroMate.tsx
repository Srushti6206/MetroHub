import { useEffect, useRef, useState } from 'react';
import { Bot, Send, X, ShoppingBag, Clock, Info } from 'lucide-react';
import { useStore } from '../store';
import { parseQuery } from '../lib/metromate';
import { inr, fmtTime } from '../lib/format';
import { VegDot } from './ui';
import { api } from '../api/client';

interface ChatItem { id: string; name: string; price: number; prepMin: number; veg: boolean }
interface ChatRecommendation { ok: boolean; items: ChatItem[]; total: number; reasons: string[]; pickupFrom?: number; pickupTo?: number }
interface Msg { from: 'me' | 'ai'; text: string; rec?: ChatRecommendation }

export function MetroMate() {
  const { mateOpen, setMateOpen, t, stationId, cart, prefs, addMany, toast, lang, setPrefs, catalogStatus } = useStore();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, mateOpen]);

  const ask = async (q: string) => {
    if (!q.trim() || sending || catalogStatus !== 'ready') return;
    const query = parseQuery(q, { budget: prefs.budget, veg: prefs.veg });
    const prior = msgs.slice(-6).map((m) => ({ role: m.from === 'me' ? 'user' : 'assistant', content: m.text }));
    setMsgs((m) => [...m, { from: 'me', text: q }]);
    setText('');
    setSending(true);
    try {
      const response = await api.chat({
        message: q, station_id: stationId, budget_paise: query.budget * 100,
        dietary_preferences: query.vegOnly ? ['vegetarian'] : [],
        cart_product_ids: cart.map((line) => line.productId), history: prior,
      });
      const items = response.recommendations.map((item) => ({
        id: item.product_id, name: item.product_name, price: item.price_paise / 100,
        prepMin: item.preparation_minutes, veg: item.is_vegetarian,
      }));
      const ready = response.earliest_ready_at ? new Date(response.earliest_ready_at) : null;
      const pickupFrom = ready ? ready.getHours() * 60 + ready.getMinutes() : undefined;
      const rec: ChatRecommendation = {
        ok: items.length > 0, items, total: response.total_paise / 100, reasons: response.reasons,
        pickupFrom, pickupTo: pickupFrom === undefined ? undefined : pickupFrom + 10,
      };
      const reply = response.fallback_note ? `${response.reply} ${response.fallback_note}` : response.reply;
      setMsgs((m) => [...m, { from: 'ai', text: reply, rec }]);
    } catch (e) {
      setMsgs((m) => [...m, { from: 'ai', text: e instanceof Error ? e.message : 'MetroMate could not reach the backend. Please try again.' }]);
    } finally { setSending(false); }
  };

  if (!mateOpen) return null;
  const quick = ['q1', 'q2', 'q3', 'q4', 'q5'];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-navy/40 p-0 backdrop-blur-sm sm:p-6" onClick={() => setMateOpen(false)}>
      <div
        className="slide-up flex h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/20 bg-gradient-to-b from-navy via-indigo to-navy text-white shadow-2xl sm:h-[640px] sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-label="MetroMate AI"
      >
        <div className="flex items-center gap-3 border-b border-white/10 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-metro to-cyan"><Bot size={20} /></span>
          <div className="flex-1">
            <div className="font-bold">MetroMate AI</div>
            <div className="flex items-center gap-1 text-[11px] text-cyan"><Info size={11} />{t('mate_demo')}</div>
          </div>
          <button aria-label="Close" onClick={() => setMateOpen(false)} className="btn-dark-ghost grid h-9 w-9 place-items-center rounded-xl"><X size={16} /></button>
        </div>

        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2 text-xs">
          <span className="text-white/60">{t('budget')}</span>
          <div className="flex items-center gap-1">
            {[100, 150, 250].map((b) => (
              <button key={b} onClick={() => setPrefs({ budget: b })} className={`rounded-full px-2.5 py-1 font-semibold ${prefs.budget === b ? 'bg-cyan text-navy' : 'bg-white/10'}`}>₹{b}</button>
            ))}
          </div>
          <button onClick={() => setPrefs({ veg: !prefs.veg })} className={`ml-auto rounded-full px-2.5 py-1 font-semibold ${prefs.veg ? 'bg-ok text-white' : 'bg-white/10'}`}>{t('filter_veg')}</button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <div className="glass-dark !rounded-2xl p-3 text-sm">{t('mate_hello')}</div>
          {msgs.map((m, i) => m.from === 'me' ? (
            <div key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-metro px-3.5 py-2 text-sm">{m.text}</div>
          ) : (
            <div key={i} className="glass-dark !rounded-2xl space-y-3 p-3 text-sm">
              <p>{m.text}</p>
              {m.rec?.ok && (
                <>
                  <div className="space-y-2">
                    {m.rec.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
                        <VegDot veg={item.veg} />
                        <div className="min-w-0 flex-1"><div className="truncate font-semibold">{item.name}</div><div className="text-[11px] text-white/55">~{item.prepMin} {t('min')}</div></div>
                        <div className="font-bold">{inr(item.price)}</div>
                      </div>
                    ))}
                    <div className="flex justify-between px-1 text-sm font-extrabold"><span>{t('total_lbl')}</span><span>{inr(m.rec.total)}</span></div>
                  </div>
                  <ul className="list-disc space-y-0.5 pl-4 text-xs text-white/75">
                    {m.rec.reasons.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                  {m.rec.pickupFrom !== undefined && m.rec.pickupTo !== undefined && <div className="flex items-center gap-1.5 text-xs text-cyan"><Clock size={12} />{t('pickup_window')}: {fmtTime(m.rec.pickupFrom)} – {fmtTime(m.rec.pickupTo)} <span className="text-white/50">(simulated)</span></div>}
                  <button
                    className="btn btn-primary w-full"
                    onClick={() => { addMany(m.rec!.items.map((item) => item.id)); toast(t('add_rec') + ' ✓'); }}
                  ><ShoppingBag size={15} />{t('add_rec')} · {inr(m.rec.total)}</button>
                </>
              )}
            </div>
          ))}
          {sending && <div className="glass-dark !rounded-2xl p-3 text-sm text-white/75">Checking the live catalog…</div>}
          <div ref={end} />
        </div>

        <div className="space-y-2 border-t border-white/10 p-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {quick.map((k) => (
              <button key={k} onClick={() => void ask(t(k))} disabled={sending} className="shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20 disabled:opacity-50">{t(k)}</button>
            ))}
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('mate_ph')} lang={lang} disabled={sending} className="input !border-white/20 !bg-white/10 !text-white placeholder:text-white/45" />
          <button className="btn btn-primary !px-3.5" aria-label={t('send')} disabled={sending}><Send size={16} /></button>
          </form>
        </div>
      </div>
    </div>
  );
}
