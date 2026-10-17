import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { AssistantVerdict } from '../api/assistantApi';
import { CHECK_LABELS, VERDICT_COLOURS, describeCheck } from '../components/assistant/AssistantResultCard';
import { companyGiven } from './assistantStorage';

/** Built and shared on the phone only; nothing is sent to a server. */
export type ReportInput = {
  verdict: AssistantVerdict;
  checkedAt: Date;
  /** What the user sent, only when they chose to include it. */
  messages?: string[];
};

const WARNING_STEPS = [
  'Do not pay any registration, training, uniform or visa fee.',
  'Do not share your NIC, bank details, passwords or OTP codes.',
  "Stop replying until you have confirmed the job through the company's official website or phone number.",
  'If you have already paid or shared details, contact your bank at once and report it to the police.',
];
const SAFE_STEPS = [
  'A real employer never asks you to pay to get a job.',
  "Confirm the offer through the company's official website or phone number before sending documents.",
  'If they later ask for money or OTP codes, stop and check again in FraudAware.',
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function list(items: string[]): string {
  return items.length ? `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>` : '';
}

function nextSteps(verdict: AssistantVerdict): string[] {
  const warning = verdict.colour === 'red' || verdict.colour === 'orange';
  const fromCompanyCheck = verdict.checks
    .flatMap((c) => (Array.isArray(c.details?.next_steps) ? (c.details?.next_steps as unknown[]) : []))
    .filter((s): s is string => typeof s === 'string');
  const steps = [...(warning ? WARNING_STEPS : SAFE_STEPS), ...fromCompanyCheck];
  return [...new Set(steps)].slice(0, 7);
}

export function buildReportHtml({ verdict, checkedAt, messages }: ReportInput): string {
  const colour = VERDICT_COLOURS[verdict.colour];
  const company = companyGiven(verdict);
  const companyRows = company
    ? [
        ['Company name', company.company_name],
        ['Website', company.website_url],
        ['Email', company.email],
      ]
        .filter(([, value]) => value)
        .map(([label, value]) => `<tr><th>${label}</th><td>${escapeHtml(String(value))}</td></tr>`)
        .join('')
    : '';

  const checks = verdict.checks
    .map((check) => {
      const d = describeCheck(check);
      const reasons = check.status === 'done' || check.status === 'failed' ? list(check.reasons) : '';
      return `<div class="check">
        <div class="check-head"><span>${CHECK_LABELS[check.source]}</span>
        <span style="color:${d.colour}">${escapeHtml(d.text)}</span></div>${reasons}</div>`;
    })
    .join('');

  const checkedMessages = messages?.length
    ? `<h2>What was checked</h2>${messages.map((m) => `<pre>${escapeHtml(m)}</pre>`).join('')}`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #111827; margin: 32px; font-size: 13px; }
  h1 { color: #202871; font-size: 22px; margin: 0; }
  h2 { color: #202871; font-size: 15px; margin: 22px 0 8px; }
  .meta { color: #5B6473; margin-top: 4px; }
  .verdict { border: 1px solid ${colour.border}; background: ${colour.bg}; border-radius: 10px; padding: 14px 16px; margin-top: 18px; }
  .verdict h3 { color: ${colour.main}; margin: 0 0 4px; font-size: 18px; }
  .check { border-bottom: 1px solid #E5E7EE; padding: 8px 0; }
  .check-head { display: flex; justify-content: space-between; font-weight: 600; }
  ul { margin: 6px 0 0; padding-left: 18px; }
  li { margin: 3px 0; }
  table { border-collapse: collapse; }
  th { text-align: left; color: #5B6473; font-weight: 500; padding: 3px 16px 3px 0; }
  pre { white-space: pre-wrap; font-family: inherit; background: #F3F4F8; border-radius: 8px; padding: 10px; }
  .disclaimer { color: #5B6473; font-size: 11px; margin-top: 22px; }
</style></head>
<body>
  <h1>FraudAware job check report</h1>
  <div class="meta">Checked on ${escapeHtml(checkedAt.toLocaleString())}</div>
  <div class="verdict"><h3>${escapeHtml(verdict.title)}</h3>
    ${verdict.note ? `<div>${escapeHtml(verdict.note)}</div>` : ''}</div>
  ${companyRows ? `<h2>Company details given</h2><table>${companyRows}</table>` : ''}
  <h2>Checks</h2>${checks}
  <h2>What to do next</h2>${list(nextSteps(verdict))}
  ${checkedMessages}
  <p class="disclaimer">${escapeHtml(verdict.disclaimer)}<br />
  This report was created on your phone by FraudAware.</p>
</body></html>`;
}

/** Creates the PDF and opens the share sheet (save to Files, WhatsApp, email, ...). */
export async function shareAssistantReport(input: ReportInput): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html: buildReportHtml(input) });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Share FraudAware report',
  });
}
