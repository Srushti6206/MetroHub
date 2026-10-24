import { useMemo, useState } from 'react';
import { Search, TrainFront, ShieldCheck } from 'lucide-react';
import { useStore } from '../store';
import { LINE_INFO } from '../data/seed';
import { ShopsBrowser } from '../components/ShopsBrowser';
import type { LineCode, StationStatus } from '../types';

const LINE_CODES: LineCode[] = ['purple', 'aqua', 'line3'];
const statusKey: Record<StationStatus, string> = {
  operational: 'status_operational',
  under_construction: 'status_under_construction',
  planned: 'status_planned',
  requires_verification: 'status_requires_verification',
};

export default function Stations() {
  const { t, stationId, setStation, shops, stations } = useStore();
  const [q, setQ] = useState('');
  const [lineFilter, setLineFilter] = useState<LineCode | ''>('');
  const [statusFilter, setStatusFilter] = useState<StationStatus | ''>('');
  const list = useMemo(() => stations.filter((s) => {
    const search = `${s.name} ${(s.aliases ?? []).join(' ')}`.toLowerCase();
    const lineMatch = !lineFilter || s.lines.includes(lineFilter);
    const statusMatch = !statusFilter || (lineFilter
      ? s.statusByLine[lineFilter] === statusFilter
      : Object.values(s.statusByLine).includes(statusFilter));
    return search.includes(q.toLowerCase()) && lineMatch && statusMatch;
  }), [stations, q, lineFilter, statusFilter]);
  const cur = stations.find((s) => s.id === stationId) ?? stations[0];
  if (!cur) return <div className="glass p-6 text-sm">{t('empty_stations')}</div>;
  const count = shops.filter((s) => (s.stationIds ?? [s.stationId]).includes(stationId)).length;
  const groups = (lineFilter ? [lineFilter] : LINE_CODES).map((code) => ({
    code, stations: list.filter((s) => s.lines.includes(code)).sort((a, b) => (a.sequence[code] ?? 0) - (b.sequence[code] ?? 0)),
  })).filter((group) => group.stations.length);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">{t('nav_stations')}</h1>
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="glass space-y-3 self-start p-4">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/45" />
            <input className="input !pl-10" placeholder={t('search_station')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select aria-label={t('filter_line')} className="input" value={lineFilter} onChange={(e) => setLineFilter(e.target.value as LineCode | '')}>
            <option value="">{t('all_lines')}</option>{LINE_CODES.map((code) => <option key={code} value={code}>{LINE_INFO[code].name}</option>)}
          </select>
          <select aria-label={t('filter_status')} className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StationStatus | '')}>
            <option value="">{t('all_statuses')}</option>{Object.entries(statusKey).map(([status, key]) => <option key={status} value={status}>{t(key)}</option>)}
          </select>
          {groups.map(({ code, stations: groupStations }) => <div key={code} className="space-y-2">
            <h3 className="px-1 text-xs font-bold uppercase tracking-wide text-ink/55">{LINE_INFO[code].name}</h3>
            {groupStations.map((s) => (
              <button key={s.id} onClick={() => setStation(s.id)} className={`neu flex w-full items-center gap-3 p-3 text-left ${s.id === stationId ? 'neu-on' : ''}`}>
                <TrainFront size={18} className="shrink-0 text-metro" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{s.name}</span>
                  <span className="mt-1 block text-[10px] text-ink/55">{t(statusKey[s.statusByLine[code] ?? s.status])}</span>
                </span>
              </button>
            ))}
          </div>)}
          {!groups.length && <p className="px-2 py-4 text-sm text-ink/60">No stations match those filters.</p>}
        </aside>

        <section className="space-y-5">
          <div className="glass space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold">{cur.name}</h2>
              {cur.interchange && <span className="chip bg-metro/10 text-metro">{t('interchange')}</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {cur.lines.map((line) => (
                <span key={line} className="chip text-white" style={{ background: LINE_INFO[line].color }}>
                  {LINE_INFO[line].name} · {t(statusKey[cur.statusByLine[line] ?? cur.status])}
                </span>
              ))}
            </div>
            <p className="flex items-start gap-1.5 text-xs text-ink/65">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-ok" />{cur.statusNote}{' '}
              {(cur.sourceUrls ?? (cur.sourceUrl ? [cur.sourceUrl] : [])).map((url, index) => <a key={url} className="underline" href={url} target="_blank" rel="noreferrer">{index ? t('open_status_source') : t('open_source')}</a>)}
            </p>
          </div>
          {count === 0 ? <div className="glass p-6 text-sm">{t('no_verified_outlets')}</div> : <ShopsBrowser withViews />}
        </section>
      </div>
    </div>
  );
}
