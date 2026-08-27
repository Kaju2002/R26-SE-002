import type {
  InchatAttachment,
  InchatAttachmentKind,
  InchatMediaItem,
  InchatMessage,
  InchatThreadDetails,
} from './types';

const MEDIA_TILE_COLORS = ['#E8EBFA', '#FDE8E8', '#E8F4FD', '#EEF0F8', '#E8F5E9', '#FFF8E1'];

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentKind(fileName: string, mimeType: string): InchatAttachmentKind {
  const name = fileName.toLowerCase();
  const mime = mimeType.toLowerCase();
  if (mime.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.fig')) return 'fig';
  if (mime.includes('html') || name.endsWith('.html') || name.endsWith('.htm')) return 'html';
  if (mime.includes('zip') || name.endsWith('.zip') || name.endsWith('.rar')) return 'zip';
  if (mime.includes('javascript') || name.endsWith('.js') || name.endsWith('.ts')) return 'js';
  if (mime.startsWith('image/')) return 'image';
  return 'doc';
}

function isImageAttachment(messageType: InchatMessage['messageType'], mimeType: string): boolean {
  if (messageType === 'image') return true;
  return mimeType.toLowerCase().startsWith('image/');
}

/**
 * WhatsApp-style sidebar: derive Media / Attachments from live conversation messages.
 * Images → Media grid; PDFs/docs → Attachments list.
 */
export function deriveThreadDetailsFromMessages(
  messages: InchatMessage[]
): InchatThreadDetails {
  const media: InchatMediaItem[] = [];
  const attachments: InchatAttachment[] = [];

  for (const message of messages) {
    if (message.deletedForEveryone || message.unsent) continue;
    const list = message.attachments ?? [];
    if (!list.length) continue;

    list.forEach((file, index) => {
      if (!file?.url) return;
      const mime = file.mimeType || '';
      const name = file.fileName || 'File';
      const id = `${message.id}-${index}`;

      if (message.messageType === 'audio' || mime.toLowerCase().startsWith('audio/')) {
        return;
      }

      if (isImageAttachment(message.messageType, mime)) {
        media.push({
          id,
          label: name,
          tileColor: MEDIA_TILE_COLORS[media.length % MEDIA_TILE_COLORS.length],
          url: file.url,
        });
        return;
      }

      // Documents / other files (PDF, DOC, etc.)
      if (message.messageType === 'file' || mime || name) {
        attachments.push({
          id,
          name,
          sizeLabel: formatFileSize(file.size),
          kind: attachmentKind(name, mime),
          url: file.url,
        });
      }
    });
  }

  // Newest first (WhatsApp-style)
  return {
    media: media.reverse(),
    attachments: attachments.reverse(),
  };
}
