import {it,expect} from 'vitest';
import {reportPath} from '../../src/lib/analytics/navigation';
it('keeps overview filters and report navigation inside the embedded workspace',()=>{expect(reportPath('overview',true)).toBe('/embed/overview');expect(reportPath('acquisition',true)).toBe('/embed/acquisition');expect(reportPath('overview',false)).toBe('/dashboard')});
