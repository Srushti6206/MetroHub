import { useState } from 'react';
import { Search, TrainFront, ShieldCheck } from 'lucide-react';
import { useStore } from '../store';
import { LINE_INFO } from '../data/seed';
import { ShopsBrowser } from '../components/ShopsBrowser';

export default function Stations() {
  const { t, stationId, setStation, shops, stations } = useStore();
  const [q, setQ] = useState('');
  const list = stations.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));
  const cur = stations.find((s) => s.id === stationId)!;
  const count = shops.filter((s) => s.stationId === stationId).length;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">{t('nav_stations')}</h1>
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="glass space-y-3 self-start p-4">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/45" />
            <input className="input !pl-10" placeholder={t('search_station')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="space-y-2">
            {list.map((s) => (
              <button key={s.id} onClick={() => setStation(s.id)} className={`neu flex w-full items-center gap-3 p-3 text-left ${s.id === stationId ? 'neu-on' : ''}`}>
                <TrainFront size={18} className="shrink-0 text-metro" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{s.name}</span>
                  <span className="mt-1 flex gap-1">
                    {s.lines.map((l) => <span key={l} className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: LINE_INFO[l].color }}>{LINE_INFO[l].no}</span>)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="space-y-5">
          <div className="glass space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold">{cur.name}</h2>
              {cur.interchange && <span className="chip bg-metro/10 text-metro">{t('interchange')}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {cur.lines.map((l) => (
                <span key={l} className="chip text-white" style={{ background: LINE_INFO[l].color }}>{LINE_INFO[l].name} · {LINE_INFO[l].no}</span>
              ))}
            </div>
            <p className="flex items-start gap-1.5 text-xs text-ink/65"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-ok" />{t('verified_line')}. punemetrorail.org</p>
          </div>
          {count === 0 ? <div className="glass p-6 text-sm">{t('no_demo_shops')}</div> : <ShopsBrowser withViews />}
        </section>
      </div>
    </div>
  );
}
