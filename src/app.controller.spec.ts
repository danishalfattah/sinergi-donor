import { haversineDistanceKm } from './common/utils/geo.util';

describe('geo util', () => {
  it('calculates distance between nearby coordinates', () => {
    const distance = haversineDistanceKm(-7.9666, 112.6326, -7.9721, 112.6304);
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(2);
  });
});
