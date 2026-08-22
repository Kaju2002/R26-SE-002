'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  TEMPLATE_CATEGORY_LABELS,
  updateTemplate,
  type MessageTemplate,
  type TemplateCategory,
} from '@/lib/api/templateApi';
import type { PortalType } from '@/lib/auth/portalConfig';
import { getStoredToken } from '@/lib/auth/session';
import { colors } from '@/lib/theme/colors';

const CATEGORIES = Object.keys(TEMPLATE_CATEGORY_LABELS) as TemplateCategory[];

type Draft = {
  name: string;
  category: TemplateCategory;
  subject: string;
  body: string;
};

const emptyDraft = (): Draft => ({
  name: '',
  category: 'custom',
  subject: '',
  body: '',
});

export default function EmployerTemplatesPage({
  portal: _portal,
}: {
  portal: Extract<PortalType, 'recruiter' | 'company'>;
}) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [filter, setFilter] = useState<TemplateCategory | 'all'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setError('Sign in required');
      setLoading(false);
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setEditorOpen(true);
    setInfo(null);
  };

  const openEdit = (template: MessageTemplate) => {
    setEditingId(template.id);
    setDraft({
      name: template.name,
      category: template.category,
      subject: template.subject,
      body: template.body,
    });
    setEditorOpen(true);
    setInfo(null);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    const token = getStoredToken();
    if (!token) return;

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateTemplate(token, editingId, draft);
        setInfo('Template updated.');
      } else {
        await createTemplate(token, draft);
        setInfo('Template created.');
      }
      setEditorOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (template: MessageTemplate) => {
    if (!window.confirm(`Delete “${template.name}”?`)) return;
    const token = getStoredToken();
    if (!token) return;
    try {
      await deleteTemplate(token, template.id);
      setInfo('Template deleted.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete template');
    }
  };

  const filtered =
    filter === 'all' ? templates : templates.filter((row) => row.category === filter);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
          >
            Templates
          </h1>
          <p
            className="mt-1 max-w-xl text-sm"
            style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
          >
            Reusable drafts for Email and InChat. Use{' '}
            <code className="rounded bg-[#F0F2F8] px-1 text-xs">{'{{name}}'}</code>,{' '}
            <code className="rounded bg-[#F0F2F8] px-1 text-xs">{'{{jobTitle}}'}</code>,{' '}
            <code className="rounded bg-[#F0F2F8] px-1 text-xs">{'{{company}}'}</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-xl bg-[#202871] px-4 py-2.5 text-sm font-semibold text-white"
          style={{ fontFamily: 'var(--font-poppins)' }}
        >
          New template
        </button>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-600" style={{ fontFamily: 'var(--font-poppins)' }}>
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="mt-4 text-sm text-emerald-700" style={{ fontFamily: 'var(--font-poppins)' }}>
          {info}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            filter === 'all' ? 'bg-[#202871] text-white' : 'bg-[#F0F2F8] text-[#42498A]'
          }`}
          style={{ fontFamily: 'var(--font-poppins)' }}
        >
          All
        </button>
        {CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setFilter(category)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              filter === category ? 'bg-[#202871] text-white' : 'bg-[#F0F2F8] text-[#42498A]'
            }`}
            style={{ fontFamily: 'var(--font-poppins)' }}
          >
            {TEMPLATE_CATEGORY_LABELS[category]}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <p style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed border-[#D8DCEB] bg-[#F7F8FE] px-6 py-12 text-center"
          >
            <p
              className="text-sm font-medium"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              No templates in this category
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-3 text-sm font-semibold text-[#202871] underline"
              style={{ fontFamily: 'var(--font-poppins)' }}
            >
              Create one
            </button>
          </div>
        ) : (
          filtered.map((template) => (
            <article
              key={template.id}
              className="rounded-2xl border border-[#EEF0F8] bg-white px-5 py-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p
                    className="text-base font-semibold"
                    style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                  >
                    {template.name}
                  </p>
                  <p
                    className="mt-0.5 text-xs font-medium"
                    style={{ color: colors.muted, fontFamily: 'var(--font-poppins)' }}
                  >
                    {TEMPLATE_CATEGORY_LABELS[template.category]}
                    {template.subject ? ` · ${template.subject}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(template)}
                    className="rounded-lg border border-[#E5E7EE] px-3 py-1.5 text-xs font-semibold"
                    style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(template)}
                    className="rounded-lg border border-[#FECACA] px-3 py-1.5 text-xs font-semibold text-[#B42318]"
                    style={{ fontFamily: 'var(--font-poppins)' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <pre
                className="mt-3 whitespace-pre-wrap rounded-xl bg-[#F7F8FE] px-3 py-2 text-xs leading-relaxed"
                style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
              >
                {template.body}
              </pre>
            </article>
          ))
        )}
      </div>

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <form
            onSubmit={(event) => void handleSave(event)}
            className="scrollbar-hide max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2
              className="text-lg font-semibold"
              style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
            >
              {editingId ? 'Edit template' : 'New template'}
            </h2>

            <label className="mt-4 block">
              <span
                className="mb-1.5 block text-sm font-medium"
                style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
              >
                Name
              </span>
              <input
                required
                value={draft.name}
                onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
                className="h-11 w-full rounded-xl border border-[#E5E7EE] px-3 text-sm outline-none focus:border-[#202871]"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              />
            </label>

            <label className="mt-4 block">
              <span
                className="mb-1.5 block text-sm font-medium"
                style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
              >
                Category
              </span>
              <select
                value={draft.category}
                onChange={(event) =>
                  setDraft((d) => ({
                    ...d,
                    category: event.target.value as TemplateCategory,
                  }))
                }
                className="h-11 w-full rounded-xl border border-[#E5E7EE] px-3 text-sm outline-none focus:border-[#202871]"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {TEMPLATE_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block">
              <span
                className="mb-1.5 block text-sm font-medium"
                style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
              >
                Email subject (optional for InChat)
              </span>
              <input
                value={draft.subject}
                onChange={(event) => setDraft((d) => ({ ...d, subject: event.target.value }))}
                placeholder="e.g. Update on {{jobTitle}}"
                className="h-11 w-full rounded-xl border border-[#E5E7EE] px-3 text-sm outline-none focus:border-[#202871]"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              />
            </label>

            <label className="mt-4 block">
              <span
                className="mb-1.5 block text-sm font-medium"
                style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
              >
                Body
              </span>
              <textarea
                required
                rows={10}
                value={draft.body}
                onChange={(event) => setDraft((d) => ({ ...d, body: event.target.value }))}
                className="w-full rounded-xl border border-[#E5E7EE] px-3 py-2.5 text-sm outline-none focus:border-[#202871]"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              />
            </label>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-xl border border-[#E5E7EE] px-4 py-2 text-sm font-medium"
                style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#202871] px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
                style={{ fontFamily: 'var(--font-poppins)' }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
