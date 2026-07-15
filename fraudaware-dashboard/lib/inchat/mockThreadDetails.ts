import type { InchatThreadDetails } from './types';

/** Per-thread shared media and file attachments (demo data). */
export const MOCK_THREAD_DETAILS: Record<string, InchatThreadDetails> = {
  'th-kwame': {
    media: [
      { id: 'm1', label: 'ID sample', tileColor: '#E8EBFA' },
    ],
    attachments: [
      { id: 'a1', name: 'applicant-cv.pdf', sizeLabel: '1.2MB', kind: 'pdf' },
      { id: 'a2', name: 'operations-role-brief.pdf', sizeLabel: '840KB', kind: 'pdf' },
      { id: 'a3', name: 'screening-checklist.doc', sizeLabel: '320KB', kind: 'doc' },
      { id: 'a4', name: 'interview-slots.html', sizeLabel: '4KB', kind: 'html' },
      { id: 'a5', name: 'onboarding-pack.zip', sizeLabel: '8MB', kind: 'zip' },
    ],
  },
  'th-amina': {
    media: [
      { id: 'm1', label: 'Role overview', tileColor: '#FDE8E8' },
      { id: 'm2', label: 'Office photo', tileColor: '#E8F4FD' },
    ],
    attachments: [
      { id: 'a1', name: 'remote-analyst-jd.pdf', sizeLabel: '2MB', kind: 'pdf' },
      { id: 'a2', name: 'salary-band-summary.pdf', sizeLabel: '560KB', kind: 'pdf' },
      { id: 'a3', name: 'assessment-link.html', sizeLabel: '1KB', kind: 'html' },
    ],
  },
  'th-david': {
    media: [],
    attachments: [
      { id: 'a1', name: 'requested-documents.pdf', sizeLabel: '1.5MB', kind: 'pdf' },
      { id: 'a2', name: 'document-checklist.doc', sizeLabel: '220KB', kind: 'doc' },
    ],
  },
  'th-priya': {
    media: [
      { id: 'm1', label: 'Assessment', tileColor: '#EEF0F8' },
    ],
    attachments: [
      { id: 'a1', name: 'financial-analyst-test.pdf', sizeLabel: '3MB', kind: 'pdf' },
      { id: 'a2', name: 'submission-guide.fig', sizeLabel: '2.1MB', kind: 'fig' },
      { id: 'a3', name: 'results-template.xlsx', sizeLabel: '180KB', kind: 'doc' },
      { id: 'a4', name: 'case-study-pack.zip', sizeLabel: '12MB', kind: 'zip' },
      { id: 'a5', name: 'tracker.js', sizeLabel: '24KB', kind: 'js' },
    ],
  },
  'th-michael': {
    media: [],
    attachments: [
      { id: 'a1', name: 'technical-assessment.pdf', sizeLabel: '2MB', kind: 'pdf' },
      { id: 'a2', name: 'coding-challenge.html', sizeLabel: '6KB', kind: 'html' },
    ],
  },
  'th-fraudaware': {
    media: [],
    attachments: [
      { id: 'a1', name: 'recruiter-safety-guide.pdf', sizeLabel: '900KB', kind: 'pdf' },
    ],
  },
};

export function getMockThreadDetails(threadId: string): InchatThreadDetails {
  return MOCK_THREAD_DETAILS[threadId] ?? { media: [], attachments: [] };
}
