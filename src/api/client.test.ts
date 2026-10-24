import { describe, expect, it } from 'vitest';
import { mapStationSeedKeys } from './client';

describe('station seed ID migration', () => {
  it('maps saved legacy station selections to their canonical IDs', () => {
    expect(mapStationSeedKeys([
      { seed_key: 'deccan-gymkhana', id: 'deccan-db-id' },
      { seed_key: 'pune-railway-station', id: 'rail-db-id' },
    ])).toEqual({
      'deccan-gymkhana': 'deccan-db-id', deccan: 'deccan-db-id',
      'pune-railway-station': 'rail-db-id', 'pune-rly': 'rail-db-id',
    });
  });
});
