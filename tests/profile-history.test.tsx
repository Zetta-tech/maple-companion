import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { profileHistorySchema, type ProfileHistory } from '../shared/profile-history.js';
import { emptyPersonalIntake, personalIntakeSchema } from '../shared/personal-guide.js';
import { ProfileHistoryEditor } from '../web/ProfileHistoryEditor.js';
import { LanguageSummary, ProfilePage } from '../web/ProfilePage.js';
import { profileSectionFromHash, protectUnsavedProfile } from '../web/profile-navigation.js';

const history:ProfileHistory={version:1,education:[{id:'428b59b8-4a16-4fc4-a415-c0f1be80da39',institution:'Example college',program:'Supply chain',credential:'Postgraduate certificate',startDate:null,endDate:null,notes:''}],languageTests:[{id:'6172ba26-ee90-43cc-bc29-224bcff99555',language:'english',status:'tested',test:'CELPIP-General',date:'2026-07-01',reading:null,writing:null,listening:null,speaking:null,benchmarkConversionReviewed:'unknown',notes:'Highest benchmark reported; exact values unknown.'}]};
describe('profile history and its dedicated route',()=>{
  it('preserves optional absence for old intake and retains incomplete dates/scores without inference',()=>{
    expect(personalIntakeSchema.parse(emptyPersonalIntake)).not.toHaveProperty('history');
    const parsed=personalIntakeSchema.parse({...emptyPersonalIntake,history});
    expect(parsed.history).toEqual(history);expect(parsed.crsEvidence).toBeUndefined();
  });
  it('rejects reversed study periods, duplicate record identities and oversized history',()=>{
    expect(profileHistorySchema.safeParse({...history,education:[{...history.education[0],startDate:'2025-01-01',endDate:'2024-01-01'}]}).success).toBe(false);
    expect(profileHistorySchema.safeParse({...history,education:[history.education[0],history.education[0]]}).success).toBe(false);
    const education=Array.from({length:20},(_,i)=>({...history.education[0]!,id:`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`,institution:'例'.repeat(200),program:'例'.repeat(200),notes:'例'.repeat(500)}));
    expect(profileHistorySchema.safeParse({...history,education}).success).toBe(false);
  });
  it('recognizes dedicated profile routes without hijacking existing workspace anchors',()=>{
    expect(profileSectionFromHash('#profile')).toBe('overview');
    expect(profileSectionFromHash('#profile/languages')).toBe('languages');
    expect(profileSectionFromHash('#profile-workspace')).toBeNull();
    expect(profileSectionFromHash('#profile/unrecognized')).toBeNull();
  });
  it('protects unsaved edits on unload and removes the guard when no longer needed',()=>{
    const addEventListener=vi.fn(),removeEventListener=vi.fn();
    const cleanup=protectUnsavedProfile({addEventListener,removeEventListener});
    const listener=addEventListener.mock.calls[0]![1] as (event:BeforeUnloadEvent)=>void;
    const preventDefault=vi.fn();const event={preventDefault,returnValue:undefined} as unknown as BeforeUnloadEvent;
    listener(event);expect(preventDefault).toHaveBeenCalledOnce();expect(event.returnValue).toBe('');
    cleanup();expect(removeEventListener).toHaveBeenCalledWith('beforeunload',listener);
  });
  it('shows unverified benchmarks as unknown, never maximum or zero scores',()=>{
    const html=renderToStaticMarkup(<LanguageSummary evidence={history.languageTests[0]!} label="English"/>);
    expect(html.match(/Not recorded/g)).toHaveLength(4);expect(html).toContain('Benchmarks need review');expect(html).not.toContain('12 <');
    const editor=renderToStaticMarkup(<ProfileHistoryEditor section="languages" value={{...emptyPersonalIntake,history}} onChange={()=>{}} date="2026-10-25" employmentEndDate={null}/>);
    expect(editor).toContain('Use as current English evidence');expect(editor).toContain('Review and confirm the complete change');
    expect(editor).toContain('value=""');expect(editor).not.toContain('value="12"');
  });
  it('distinguishes unavailable readback from empty history and keeps family out of the overview',()=>{
    const html=renderToStaticMarkup(<ProfilePage section="overview" employment={null} available={false} loading={false} guide={{snapshot:null,loading:false,error:'Offline',dirty:false}} dirty={false}/>);
    expect(html).toContain('Your Guide records are unavailable');expect(html).not.toContain('No education history added yet');expect(html).not.toContain('Spouse');expect(html).toContain('Back to overview');
  });
  it('shows an unsaved history draft without representing it as a saved assessment',()=>{
    const html=renderToStaticMarkup(<ProfilePage section="overview" employment={null} available loading={false} guide={{snapshot:{revision:0,profile:null,intake:emptyPersonalIntake,verified:false,reviewRequired:true,employmentRevision:0},draft:{...emptyPersonalIntake,history},loading:false,error:'',dirty:true}} dirty/>);
    expect(html).toContain('Example college');expect(html).toContain('CELPIP-General');expect(html).toContain('Unsaved changes');expect(html).not.toContain('These are your saved details');expect(html).toContain('before they can support a result');
  });
});
