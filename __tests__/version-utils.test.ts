import { describe, it, expect } from 'vitest';
import { calculateNextVersion } from '../scripts/version-utils.ts';

describe('CalVer Strategy', () => {
    // Helper to mock dates consistently
    const mockDate = (isoDate: string) => new Date(isoDate);

    it('should generate clean version for a new day (first build)', () => {
        const currentVersion = '1.0.0';
        const today = mockDate('2026-02-11T12:00:00Z');

        const result = calculateNextVersion(currentVersion, today);
        expect(result).toBe('2026.2.11'); // No suffix (Concept 10/10)
    });

    it('should add suffix -1 for the second build of the day', () => {
        const currentVersion = '2026.2.11';
        const today = mockDate('2026-02-11T15:00:00Z'); // Same day

        const result = calculateNextVersion(currentVersion, today);
        expect(result).toBe('2026.2.11-1');
    });

    it('should increment suffix for subsequent builds same day', () => {
        const currentVersion = '2026.2.11-1';
        const today = mockDate('2026-02-11T16:00:00Z'); // Same day

        const result = calculateNextVersion(currentVersion, today);
        expect(result).toBe('2026.2.11-2');
    });

    it('should increment double-digit suffix correctly', () => {
        const currentVersion = '2026.2.11-9';
        const today = mockDate('2026-02-11T17:00:00Z');

        const result = calculateNextVersion(currentVersion, today);
        expect(result).toBe('2026.2.11-10');
    });

    it('should reset to clean version if day changes (tomorrow)', () => {
        const currentVersion = '2026.2.11-5';
        const tomorrow = mockDate('2026-02-12T08:00:00Z');

        const result = calculateNextVersion(currentVersion, tomorrow);
        expect(result).toBe('2026.2.12'); // New day, clean version
    });

    it('should handle year change correctly', () => {
        const currentVersion = '2026.12.31-3';
        const newYear = mockDate('2027-01-01T00:01:00Z');

        const result = calculateNextVersion(currentVersion, newYear);
        expect(result).toBe('2027.1.1');
    });

    it('should ignore pre-existing SemVer (migration scenario)', () => {
        const currentVersion = '0.5.2-alpha';
        const today = mockDate('2026-02-11T10:00:00Z');

        const result = calculateNextVersion(currentVersion, today);
        expect(result).toBe('2026.2.11');
    });

    it('should NOT use leading zeros (SemVer Compliance)', () => {
        const today = mockDate('2026-02-05T10:00:00Z'); // Feb 5th
        // Should be 2026.2.5 NOT 2026.02.05
        const result = calculateNextVersion('1.0.0', today);
        expect(result).toBe('2026.2.5');
    });
});
