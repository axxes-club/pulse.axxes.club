import { expect,it } from 'vitest';
import { reportWindow } from '@/lib/analytics/timezone';
it('compares complete local days across daylight saving with equal calendar ranges',()=>{const w=reportWindow(1,'America/New_York',new Date('2026-03-09T12:00:00Z'));expect(new Date(w.start).toISOString()).toBe('2026-03-08T05:00:00.000Z');expect(new Date(w.end).toISOString()).toBe('2026-03-09T04:00:00.000Z');expect(new Date(w.previousStart).toISOString()).toBe('2026-03-07T05:00:00.000Z')});
