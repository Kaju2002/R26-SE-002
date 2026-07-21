import { getFakeJobApiBaseUrl } from './apiConfig';

export type FakeJobPrediction = {
  prediction: 'fake' | 'suspicious' | 'legitimate' | string;
  confidence: number;
  legitimate_probability: number;
  fake_probability: number;
  message: string;
  extracted_text?: string;
};

export async function predictFakeJobFromText(text: string): Promise<FakeJobPrediction> {
  const response = await fetch(`${getFakeJobApiBaseUrl()}/predict-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  let data: Record<string, unknown> = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const detail =
      typeof data.detail === 'string'
        ? data.detail
        : typeof data.message === 'string'
          ? data.message
          : `Fake-job check failed (${response.status})`;
    throw new Error(detail);
  }

  return {
    prediction: String(data.prediction ?? 'unknown'),
    confidence: Number(data.confidence ?? 0),
    legitimate_probability: Number(data.legitimate_probability ?? 0),
    fake_probability: Number(data.fake_probability ?? 0),
    message: String(data.message ?? ''),
    extracted_text:
      typeof data.extracted_text === 'string' ? data.extracted_text : undefined,
  };
}

export function buildJobRiskText(parts: {
  title: string;
  companyName: string;
  location: string;
  description: string;
  requirements?: string;
  skills?: string;
}): string {
  return [
    `Title: ${parts.title}`,
    `Company: ${parts.companyName}`,
    `Location: ${parts.location}`,
    `Description:\n${parts.description}`,
    parts.requirements?.trim() ? `Requirements:\n${parts.requirements}` : '',
    parts.skills?.trim() ? `Skills: ${parts.skills}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}
