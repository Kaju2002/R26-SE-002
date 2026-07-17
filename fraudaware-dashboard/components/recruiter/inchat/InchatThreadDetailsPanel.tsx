'use client';

import { getMockThreadDetails } from '@/lib/inchat/mockThreadDetails';
import { INCHAT_BORDER, INCHAT_MUTED, INCHAT_NAVY } from '@/lib/inchat/inchatStyles';
import type { InchatAttachment, InchatAttachmentKind, InchatThread } from '@/lib/inchat/types';

type Props = {
  thread: InchatThread;
  hideHeaderSpacer?: boolean;
};

const FILE_ICON_STYLES: Record<
  InchatAttachmentKind,
  { bg: string; label: string; color: string }
> = {
  pdf: { bg: '#FEECEC', label: 'PDF', color: '#D32F2F' },
  fig: { bg: '#F3E8FF', label: 'FIG', color: '#7C3AED' },
  html: { bg: '#E8F4FD', label: 'HTML', color: '#1976D2' },
  zip: { bg: '#FFF8E1', label: 'ZIP', color: '#F9A825' },
  js: { bg: '#FFF3E0', label: 'JS', color: '#EF6C00' },
  doc: { bg: '#E8EAF6', label: 'DOC', color: '#3949AB' },
  image: { bg: '#E8F5E9', label: 'IMG', color: '#388E3C' },
};

function AttachmentRow({ file }: { file: InchatAttachment }) {
  const icon = FILE_ICON_STYLES[file.kind];

  return (
    <button
      type="button"
      onClick={() => alert(`"${file.name}" will open when file storage is connected.`)}
      className="flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left transition hover:bg-[#F7F8FE]"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[10px] font-extrabold"
        style={{ backgroundColor: icon.bg, color: icon.color, fontFamily: 'var(--font-poppins)' }}
      >
        {icon.label}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-semibold text-[#1F2937]"
          style={{ fontFamily: 'var(--font-poppins)' }}
        >
          {file.name}
        </p>
        <p
          className="text-xs font-medium"
          style={{ color: INCHAT_MUTED, fontFamily: 'var(--font-poppins)' }}
        >
          {file.sizeLabel}
        </p>
      </div>
    </button>
  );
}

export default function InchatThreadDetailsPanel({
  thread,
  hideHeaderSpacer = false,
}: Props) {
  const details = getMockThreadDetails(thread.id);

  return (
    <aside
      className="hidden min-h-0 w-[280px] shrink-0 flex-col border-l bg-white xl:flex"
      style={{ borderColor: INCHAT_BORDER }}
    >
      {!hideHeaderSpacer ? (
        <div className="h-[72px] shrink-0 border-b" style={{ borderColor: INCHAT_BORDER }} />
      ) : null}

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <h3
          className="text-[15px] font-semibold"
          style={{ color: INCHAT_NAVY, fontFamily: 'var(--font-poppins)' }}
        >
          Media ({details.media.length})
        </h3>

        {details.media.length === 0 ? (
          <p
            className="mt-3 text-xs font-medium"
            style={{ color: INCHAT_MUTED, fontFamily: 'var(--font-poppins)' }}
          >
            No shared media yet.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {details.media.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => alert('Media preview will be available when chat service is connected.')}
                className="h-[72px] w-[72px] overflow-hidden rounded-lg border transition hover:opacity-90"
                style={{ borderColor: INCHAT_BORDER, backgroundColor: item.tileColor }}
                title={item.label}
              >
                <span
                  className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] font-semibold text-[#42498A]"
                  style={{ fontFamily: 'var(--font-poppins)' }}
                >
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="mt-10">
          <h3
            className="text-[15px] font-semibold"
            style={{ color: INCHAT_NAVY, fontFamily: 'var(--font-poppins)' }}
          >
            Attachments ({details.attachments.length})
          </h3>

          {details.attachments.length === 0 ? (
            <p
              className="mt-3 text-xs font-medium"
              style={{ color: INCHAT_MUTED, fontFamily: 'var(--font-poppins)' }}
            >
              No files shared in this conversation.
            </p>
          ) : (
            <div className="mt-3 space-y-1">
              {details.attachments.map((file) => (
                <AttachmentRow key={file.id} file={file} />
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
