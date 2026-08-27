import React, { useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { InchatMessage } from '../../../data/inchatMessages';
import { INCHAT_BORDER, INCHAT_MUTED, INCHAT_NAVY } from './inchatStyles';
import InchatVoicePlayer from './InchatVoicePlayer';
import InchatScamSafetyBanner from './InchatScamSafetyBanner';

type Props = {
  message: InchatMessage;
  /** Contact / peer profile photo (received voice notes). */
  peerAvatarUrl?: string | null;
  peerInitials?: string;
  /** Logged-in user profile photo (sent voice notes). */
  selfAvatarUrl?: string | null;
  selfInitials?: string;
  /** Opens Report → evidence pack for this conversation. */
  onReportScam?: () => void;
};

const IMAGE_SIZE = 220;

function formatFileSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function displayFileName(value?: string | null): string {
  const raw = String(value || '').trim();
  if (!raw) return 'Document';
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    return raw;
  }
}

/** Square crop in the bubble; tap opens the full image. */
function MessageImage({ uri, label }: { uri: string; label: string }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  return (
    <>
      <Pressable
        onPress={() => setPreviewOpen(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel={`${label}. Tap to view full image.`}
      >
        <Image
          source={{ uri }}
          style={styles.messageImage}
          resizeMode="cover"
          accessibilityLabel={label}
        />
      </Pressable>
      <Modal
        visible={previewOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewOpen(false)}
        statusBarTranslucent
      >
        <View style={styles.previewOverlay}>
          <Pressable
            style={styles.previewBackdrop}
            onPress={() => setPreviewOpen(false)}
            accessibilityLabel="Close full image"
          />
          <Image
            source={{ uri }}
            style={{
              width: Math.min(windowWidth - 32, 520),
              height: Math.min(windowHeight * 0.78, 720),
            }}
            resizeMode="contain"
            accessibilityLabel={label}
          />
          <Pressable
            style={styles.previewClose}
            onPress={() => setPreviewOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <MaterialCommunityIcons name="close" size={24} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

type ReceiptStatus = 'sent' | 'delivered' | 'read';

function receiptStatus(message: InchatMessage, mine: boolean): ReceiptStatus | null {
  if (!mine || message.unsent) return null;
  if (message.status === 'delivered' || message.status === 'read' || message.status === 'sent') {
    return message.status;
  }
  // Own messages always show at least a sent tick once they exist in the thread.
  return 'sent';
}

function ReceiptTicks({
  status,
  color,
}: {
  status: ReceiptStatus;
  color: string;
}) {
  if (status === 'sent') {
    return (
      <MaterialCommunityIcons
        name="check"
        size={14}
        color={color}
        accessibilityLabel="Message sent"
        style={styles.receiptIcon}
      />
    );
  }

  return (
    <View
      style={styles.doubleTick}
      accessible
      accessibilityLabel={status === 'read' ? 'Message read' : 'Message delivered'}
    >
      <MaterialCommunityIcons name="check" size={14} color={color} style={styles.receiptIcon} />
      <MaterialCommunityIcons
        name="check"
        size={14}
        color={color}
        style={[styles.receiptIcon, styles.secondTick]}
      />
    </View>
  );
}

export default function InchatMessageBubble({
  message,
  peerAvatarUrl,
  peerInitials,
  selfAvatarUrl,
  selfInitials,
  onReportScam,
}: Props) {
  const mine = message.role === 'user';
  const isUnsent = message.unsent === true;
  // FraudAware: warn jobseekers on inbound recruiter messages only.
  const isFlagged = !mine && message.scamAnalysis?.status === 'flagged';
  const status = receiptStatus(message, mine);
  const imageAttachment =
    message.messageType === 'image'
      ? message.attachments?.find((attachment) => attachment.url)
      : undefined;
  const fileAttachment =
    message.messageType === 'file'
      ? message.attachments?.find((attachment) => attachment.url)
      : undefined;
  const audioAttachment =
    message.messageType === 'audio'
      ? message.attachments?.find((attachment) => attachment.url)
      : undefined;
  const voiceAvatarUrl = mine ? selfAvatarUrl : peerAvatarUrl;
  const voiceInitials = mine ? selfInitials || 'ME' : peerInitials || '?';
  const compactMeta =
    !imageAttachment &&
    !fileAttachment &&
    !audioAttachment &&
    !isFlagged &&
    message.body.length <= 28 &&
    !message.body.includes('\n');
  const receiptColor =
    status === 'read' ? '#53BDEB' : mine ? 'rgba(255,255,255,0.92)' : INCHAT_MUTED;

  return (
    <View style={[styles.wrap, mine ? styles.wrapMine : styles.wrapTheirs]}>
      <View
        style={[
          styles.bubble,
          mine ? styles.bubbleMine : styles.bubbleTheirs,
          isFlagged && styles.bubbleFlagged,
          Boolean(imageAttachment || fileAttachment || audioAttachment) &&
            !isFlagged &&
            styles.bubbleWithImage,
          Boolean(audioAttachment) && !isFlagged && styles.bubbleWithAudio,
          isFlagged && styles.bubbleCombined,
        ]}
      >
        <View
          style={[
            isFlagged && styles.bubbleContent,
            isFlagged &&
              Boolean(imageAttachment || fileAttachment || audioAttachment) &&
              styles.bubbleWithImage,
            isFlagged && Boolean(audioAttachment) && styles.bubbleWithAudio,
          ]}
        >
          {imageAttachment ? (
            <MessageImage
              uri={imageAttachment.url}
              label={imageAttachment.fileName || 'Chat image'}
            />
          ) : null}
          {audioAttachment ? (
            <InchatVoicePlayer
              url={audioAttachment.url}
              durationMs={audioAttachment.durationMs}
              mine={mine}
              avatarUrl={voiceAvatarUrl}
              initials={voiceInitials}
            />
          ) : null}
          {fileAttachment ? (
            <Pressable
              style={styles.fileCard}
              onPress={() => {
                void Linking.openURL(fileAttachment.url).catch(() => {
                  Alert.alert('Open failed', 'Could not open this document.');
                });
              }}
              accessibilityRole="link"
              accessibilityLabel={`Open ${displayFileName(fileAttachment.fileName)}`}
            >
              <View style={styles.fileIcon}>
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={26}
                  color={INCHAT_NAVY}
                />
              </View>
              <View style={styles.fileText}>
                <Text style={styles.fileName} numberOfLines={2}>
                  {displayFileName(fileAttachment.fileName)}
                </Text>
                <Text style={styles.fileMeta}>
                  {displayFileName(fileAttachment.fileName).split('.').pop()?.toUpperCase() ||
                    'DOCUMENT'}
                  {fileAttachment.size ? ` · ${formatFileSize(fileAttachment.size)}` : ''}
                </Text>
              </View>
              <MaterialCommunityIcons name="open-in-new" size={19} color={INCHAT_NAVY} />
            </Pressable>
          ) : null}
          {compactMeta ? (
            <View style={styles.compactRow}>
              <Text
                style={[
                  styles.body,
                  styles.compactBody,
                  mine ? styles.bodyMine : styles.bodyTheirs,
                  isUnsent && styles.bodyUnsent,
                ]}
              >
                {message.body}
              </Text>
              <View style={styles.compactMeta}>
                <Text style={[styles.time, mine ? styles.timeMine : styles.timeTheirs]}>
                  {message.timeLabel}
                </Text>
                {status ? <ReceiptTicks status={status} color={receiptColor} /> : null}
              </View>
            </View>
          ) : message.body ? (
            <Text
              style={[
                styles.body,
                mine ? styles.bodyMine : styles.bodyTheirs,
                isUnsent && styles.bodyUnsent,
                Boolean(imageAttachment || fileAttachment || audioAttachment) &&
                  styles.inlineWithImage,
              ]}
            >
              {message.body}
            </Text>
          ) : null}

          {!compactMeta ? (
            <View
              style={[
                styles.metaRow,
                Boolean(imageAttachment || fileAttachment || audioAttachment) &&
                  styles.inlineWithImage,
              ]}
            >
              <Text style={[styles.time, mine ? styles.timeMine : styles.timeTheirs]}>
                {message.timeLabel}
              </Text>
              {status ? <ReceiptTicks status={status} color={receiptColor} /> : null}
            </View>
          ) : null}
        </View>

        {isFlagged ? (
          <InchatScamSafetyBanner
            score={message.scamAnalysis?.score}
            tactics={message.scamAnalysis?.tactics}
            onReport={onReportScam}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
    maxWidth: '88%',
  },
  wrapMine: {
    alignSelf: 'flex-end',
  },
  wrapTheirs: {
    alignSelf: 'flex-start',
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    minWidth: 72,
  },
  bubbleMine: {
    backgroundColor: INCHAT_NAVY,
    borderBottomRightRadius: 4,
  },
  bubbleWithImage: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 4,
  },
  bubbleWithAudio: {
    paddingHorizontal: 6,
    paddingTop: 4,
    paddingBottom: 4,
    minWidth: 230,
  },
  inlineWithImage: {
    paddingHorizontal: 6,
  },
  bubbleTheirs: {
    backgroundColor: '#F3F5F8',
    borderWidth: 1,
    borderColor: INCHAT_BORDER,
    borderBottomLeftRadius: 4,
  },
  bubbleFlagged: {
    overflow: 'hidden',
  },
  bubbleCombined: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  bubbleContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    paddingRight: 4,
  },
  bodyMine: {
    color: '#fff',
  },
  bodyTheirs: {
    color: '#1F2937',
  },
  bodyUnsent: {
    fontStyle: 'italic',
    opacity: 0.8,
  },
  messageImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    maxWidth: '100%',
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
    marginBottom: 6,
  },
  fileCard: {
    width: 250,
    maxWidth: '100%',
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8EAF6',
  },
  fileText: {
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    color: '#1F2937',
  },
  fileMeta: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
    color: INCHAT_MUTED,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  previewBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  previewClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    height: 40,
    width: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
    marginTop: 4,
    gap: 6,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'nowrap',
    gap: 10,
  },
  compactBody: {
    flexShrink: 1,
  },
  compactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 1,
  },
  time: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeMine: {
    color: 'rgba(255,255,255,0.88)',
  },
  timeTheirs: {
    color: INCHAT_MUTED,
  },
  doubleTick: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  receiptIcon: {
    marginTop: 1,
  },
  secondTick: {
    marginLeft: -5,
  },
});
