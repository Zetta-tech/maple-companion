import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CecWorkFields, CecWorkReview, blankCecEvidence } from '../web/CecWorkFields.js';
import { testCecEmployment } from './support/test-cec.js';

describe('interval evidence intake and exact confirmation display', () => {
  it('places the date relationship error beside the interval field with the job date',()=>{
    const html=renderToStaticMarkup(<CecWorkFields value={{...blankCecEvidence(),startDate:'2023-01-15'}} jobStartDate="2025-01-15" onChange={()=>{}}/>);
    expect(html).toContain('aria-invalid="true"');expect(html).toContain('id="cec-start-error"');expect(html).toContain('2025-01-15');
    expect(html).toContain('Correct the interval, or review the job start date above');
  });
  it('does not create interval facts when a legacy record is rendered', () => {
    const absent = renderToStaticMarkup(<CecWorkFields onChange={() => { throw Error('Render cannot change data'); }} />);
    expect(absent).not.toContain('value="2025');
    expect(absent).not.toContain('checked=""');
    expect(renderToStaticMarkup(<CecWorkReview />)).toBe('');
    expect(blankCecEvidence()).toMatchObject({ hoursPerWeek: null, physicallyInCanada: 'unknown', fullTimeStudy: 'unknown', endDate: null });
  });
  it('shows added evidence, removed evidence and changed qualifying answers before approval', () => {
    const first = testCecEmployment().cecWork!;
    const added = renderToStaticMarkup(<CecWorkReview newValue={first} />);
    for (const text of ['Not recorded', '2025-01-01', '2025-12-31', '30', 'Authorized work under temporary resident status', 'NOC lead statement and main duties match']) expect(added).toContain(text);
    const changed = renderToStaticMarkup(<CecWorkReview oldValue={first} newValue={{ ...first, fullTimeStudy: 'yes', hoursPerWeek: 15 }} />);
    expect(changed).toContain('15'); expect(changed).toContain('30'); expect(changed).toContain('Any full-time study'); expect(changed).toContain('changed');
    expect(renderToStaticMarkup(<CecWorkReview oldValue={first} />)).toContain('Not recorded');
  });
  it('shows the essential-duties question and compares absent old evidence without inventing consent', () => {
    const current = testCecEmployment().cecWork!;
    const { nocEssentialDutiesMatch: _, ...legacy } = current;
    expect(renderToStaticMarkup(<CecWorkFields value={legacy} onChange={() => { throw Error('Render cannot change data'); }} />))
      .toContain('Did you perform all essential duties');
    const html = renderToStaticMarkup(<CecWorkReview oldValue={legacy} newValue={current} />);
    expect(html).toContain('All essential NOC duties performed');
    expect(html).toContain('Not recorded');
    expect(legacy).not.toHaveProperty('nocEssentialDutiesMatch');
  });
});
