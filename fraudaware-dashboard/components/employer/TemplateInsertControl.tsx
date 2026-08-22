'use client';

import { useEffect, useRef, useState } from 'react';
import {
  applyTemplateVariables,
  listTemplates,
  TEMPLATE_CATEGORY_LABELS,
  type MessageTemplate,
  type TemplateVariables,
} from '@/lib/api/templateApi';
import { getStoredToken } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

type Props = {
  variables?: TemplateVariables;
  /** When true, only apply body (InChat). */
  bodyOnly?: boolean;
  onApply: (result: { subject: string; body: string; template: MessageTemplate }) => void;
  className?: string;
};

export default function TemplateInsertControl({
  variables = {},
  bodyOnly = false,
  onApply,
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const load = async () => {
    const token = getStoredToken();
    if (!token) {
      setError('Sign in required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await listTemplates(token);
      setTemplates(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) void load();
  };

  const handlePick = (template: MessageTemplate) => {
    onApply({
      subject: applyTemplateVariables(template.subject || '', variables),
      body: applyTemplateVariables(template.body, variables),
      template,
    });
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-lg border border-[#E5E7EE] px-3 py-1.5 text-xs font-semibold transition hover:border-[#202871]"
        style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
      >
        Use template
      </button>

      {open ? (
        <div className="absolute left-0 z-20 mt-2 w-72 overflow-hidden rounded-xl border border-[#E5E7EE] bg-white shadow-lg">
          <div
            className="border-b border-[#EEF0F8] px-3 py-2 text-xs font-semibold"
            style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
          >
            {bodyOnly ? 'Insert into message' : 'Fill subject & message'}
          </div>
          {loading ? (
            <p
              className="px-3 py-4 text-sm"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              Loading…
            </p>
          ) : error ? (
            <p className="px-3 py-4 text-sm text-red-600" style={{ fontFamily: 'var(--font-poppins)' }}>
              {error}
            </p>
          ) : templates.length === 0 ? (
            <p
              className="px-3 py-4 text-sm"
              style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
            >
              No templates yet. Create some under Templates.
            </p>
          ) : (
            <ul className="scrollbar-hide max-h-56 overflow-y-auto py-1">
              {templates.map((template) => (
                <li key={template.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(template)}
                    className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-[#F7F8FE]"
                  >
                    <span
                      className="text-sm font-semibold"
                      style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                    >
                      {template.name}
                    </span>
                    <span
                      className="text-[11px]"
                      style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                    >
                      {TEMPLATE_CATEGORY_LABELS[template.category] || template.category}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
