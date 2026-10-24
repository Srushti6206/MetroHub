import { describe, expect, it } from 'vitest';
import { STATIONS } from './stations';

describe('canonical Pune Metro stations', () => {
  it('uses unique canonical IDs and merges Civil Court as a three-line interchange', () => {
    expect(new Set(STATIONS.map((station) => station.id)).size).toBe(STATIONS.length);
    const civilCourt = STATIONS.filter((station) => station.id === 'district-court');
    expect(civilCourt).toHaveLength(1);
    expect(civilCourt[0].lines).toEqual(['purple', 'aqua', 'line3']);
    expect(civilCourt[0].interchange).toBe(true);
  });

  it('does not mark Line 3 as operational without a verified service notice', () => {
    const maan = STATIONS.find((station) => station.id === 'maan');
    expect(maan?.statusByLine.line3).toBe('requires_verification');
    expect(STATIONS.find((station) => station.id === 'shivajinagar')?.statusByLine.line3).toBe('requires_verification');
  });

  it('marks the published Purple and Aqua Phase 1 stations operational and extensions separately', () => {
    expect(STATIONS.filter((station) => station.statusByLine.aqua === 'operational')).toHaveLength(16);
    expect(STATIONS.find((station) => station.id === 'nigdi')?.statusByLine.purple).toBe('under_construction');
    expect(STATIONS.find((station) => station.id === 'katraj')?.statusByLine.purple).toBe('under_construction');
  });
});
