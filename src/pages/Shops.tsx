import { useStore } from '../store';
import { ShopsBrowser } from '../components/ShopsBrowser';

export default function Shops() {
  const { t, stationId, shops, stations } = useStore();
  const st = stations.find((s) => s.id === stationId)!;
  const has = shops.some((s) => (s.stationIds ?? [s.stationId]).includes(stationId));
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold">{t('shops_title')}</h1>
        <p className="text-sm text-ink/60">{st.name} · {st.lines.map((line) => line.toUpperCase()).join(' / ')}</p>
      </div>
      {has ? <ShopsBrowser /> : <div className="glass p-6 text-sm">{t('no_demo_shops')}</div>}
    </div>
  );
}
