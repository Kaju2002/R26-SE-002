export function appendFormField(
  form: FormData,
  key: string,
  value: string | boolean | number | undefined | null
) {
  if (value === undefined || value === null) return;
  form.append(key, typeof value === 'boolean' ? String(value) : String(value));
}

export function appendImageField(form: FormData, fieldName: string, imageUri: string) {
  const ext = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';

  form.append(fieldName, {
    uri: imageUri,
    name: `${fieldName}.${ext}`,
    type: mime,
  } as unknown as Blob);
}

export function appendDocumentField(
  form: FormData,
  fieldName: string,
  uri: string,
  name: string,
  mimeType: string
) {
  form.append(fieldName, {
    uri,
    name,
    type: mimeType,
  } as unknown as Blob);
}

export function formatMonthYear(date: string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function dateToMonthYear(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

export function monthYearToDate(
  value: string | null | undefined,
  fallback?: Date
): Date {
  const parsed = parseMonthYear(value || '');
  if (parsed) {
    const d = new Date(parsed);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return fallback ?? new Date(new Date().getFullYear() - 1, 0, 1);
}

export function parseMonthYear(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, '0');
    return `${slashMatch[2]}-${month}-01`;
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-01`;
  }

  return trimmed;
}
