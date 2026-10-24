import raw from '../../data/stations.json';
import type { LineCode, Station, StationStatus } from '../types';

const statusNotes = raw.status_notes as Record<StationStatus, string>;
const stations = new Map<string, Station>();

for (const line of raw.lines) {
  for (const entry of line.stations) {
    const code = line.code as LineCode;
    const status = entry.status as StationStatus;
    const current = stations.get(entry.id);
    if (current) {
      current.lines.push(code);
      current.sequence[code] = entry.order;
      current.statusByLine = { ...current.statusByLine, [code]: status };
      current.aliases = Array.from(new Set([...(current.aliases ?? []), ...(entry.aliases ?? [])]));
      current.sourceUrls = Array.from(new Set([...(current.sourceUrls ?? []), raw.sources[code], ...(status !== 'operational' && line.status_source_url ? [line.status_source_url] : [])]));
      current.interchange = current.lines.length > 1;
    } else {
      stations.set(entry.id, {
        id: entry.id, name: entry.name, lines: [code], sequence: { [code]: entry.order },
        status, statusByLine: { [code]: status }, aliases: entry.aliases ?? [],
        interchange: false, hasDemoShops: entry.id === 'district-court',
        sourceUrl: raw.sources[code], sourceUrls: [raw.sources[code], ...(status !== 'operational' && line.status_source_url ? [line.status_source_url] : [])], statusNote: statusNotes[status],
      });
    }
  }
}

export const STATIONS: Station[] = [...stations.values()];
export const LINE_INFO = {
  purple: { name: 'Purple Line', no: 'Line 1', color: '#6558E8' },
  aqua: { name: 'Aqua Line', no: 'Line 2', color: '#17b8d4' },
  line3: { name: 'Hinjawadi–Shivajinagar Line 3', no: 'Line 3', color: '#f59e0b' },
} as const;
