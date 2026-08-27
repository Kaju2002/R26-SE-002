import type { InchatMessage } from '../../data/inchatMessages';

export type InchatMediaItem = {
  id: string;
  url: string;
  fileName: string;
};

export type InchatDocItem = {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeLabel: string;
};

export type InchatThreadMediaDetails = {
  media: InchatMediaItem[];
  documents: InchatDocItem[];
};

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(messageType: InchatMessage['messageType'], mimeType: string): boolean {
  if (messageType === 'image') return true;
  return mimeType.toLowerCase().startsWith('image/');
}

/** WhatsApp-style: derive Media + Documents from conversation messages. */
export function deriveInchatThreadDetails(
  messages: InchatMessage[]
): InchatThreadMediaDetails {
  const media: InchatMediaItem[] = [];
  const documents: InchatDocItem[] = [];

  for (const message of messages) {
    if (message.deletedForEveryone || message.unsent) continue;
    const list = message.attachments ?? [];
    list.forEach((file, index) => {
      if (!file?.url) return;
      const id = `${message.id}-${index}`;
      const mime = file.mimeType || '';
      const fileName = file.fileName || 'File';

  // Skip voice notes from Media / Documents (they play in-chat only).
  if (message.messageType === 'audio' || mime.toLowerCase().startsWith('audio/')) {
    return;
  }

  if (isImage(message.messageType, mime)) {
        media.push({ id, url: file.url, fileName });
        return;
      }

      if (message.messageType === 'file' || mime || fileName) {
        documents.push({
          id,
          url: file.url,
          fileName,
          mimeType: mime,
          sizeLabel: formatFileSize(file.size),
        });
      }
    });
  }

  return {
    media: media.reverse(),
    documents: documents.reverse(),
  };
}
