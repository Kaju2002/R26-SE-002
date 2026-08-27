import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { INCHAT_BORDER } from './inchatStyles';

const MAX_CHARS = 2000;
const SEND_ICON = '#2563EB';
const ICON_GRAY = '#5F6368';
const RECORD_RED = '#E53935';
const MIN_VOICE_MS = 700;

type AttachmentRow = {
  key: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
};

export type VoiceRecordingPayload = {
  uri: string;
  fileName: string;
  mimeType: string;
  durationMs: number;
};

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onTakePhoto?: () => void | Promise<void>;
  onPickFromLibrary?: () => void | Promise<void>;
  onPickDocument?: () => void | Promise<void>;
  onSendVoice?: (payload: VoiceRecordingPayload) => void | Promise<void>;
};

function formatMmSs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function InchatComposer({
  value,
  onChangeText,
  onSend,
  sending,
  disabled = false,
  placeholder = 'Write a message…',
  onTakePhoto,
  onPickFromLibrary,
  onPickDocument,
  onSendVoice,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendingVoiceRef = useRef(false);

  const trimmedLen = value.trim().length;
  const sendDisabled = disabled || sending || trimmedLen === 0;
  const showSend = !disabled && trimmedLen > 0;
  const resolvedPlaceholder = disabled
    ? 'You blocked this conversation'
    : recording
      ? 'Recording… release to send'
      : placeholder;

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      void recordingRef.current?.stopAndUnloadAsync().catch(() => undefined);
    };
  }, []);

  const clampText = useCallback(
    (t: string) => (t.length <= MAX_CHARS ? t : t.slice(0, MAX_CHARS)),
    []
  );

  const handleSend = useCallback(() => {
    if (!sendDisabled) {
      Keyboard.dismiss();
      setMenuOpen(false);
      onSend();
    }
  }, [onSend, sendDisabled]);

  const toggleMenu = useCallback(() => {
    Keyboard.dismiss();
    setMenuOpen((o) => !o);
  }, []);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const stopTicker = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (disabled || sending || sendingVoiceRef.current || recordingRef.current) return;
    if (!onSendVoice) {
      Alert.alert('Voice message', 'Voice recording is not available.');
      return;
    }
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow microphone access to send voice messages.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const next = new Audio.Recording();
      await next.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await next.startAsync();
      recordingRef.current = next;
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setRecording(true);
      setMenuOpen(false);
      Keyboard.dismiss();
      stopTicker();
      tickRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 250);
    } catch (error) {
      recordingRef.current = null;
      setRecording(false);
      Alert.alert(
        'Could not record',
        error instanceof Error ? error.message : 'Microphone failed to start.'
      );
    }
  }, [disabled, onSendVoice, sending, stopTicker]);

  const finishRecording = useCallback(async () => {
    const active = recordingRef.current;
    if (!active) {
      setRecording(false);
      stopTicker();
      return;
    }
    recordingRef.current = null;
    stopTicker();
    setRecording(false);
    const durationMs = Date.now() - startedAtRef.current;
    setElapsedMs(0);

    try {
      await active.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = active.getURI();
      if (!uri || !onSendVoice) return;
      if (durationMs < MIN_VOICE_MS) {
        Alert.alert('Too short', 'Hold the mic a bit longer to record.');
        return;
      }
      sendingVoiceRef.current = true;
      await onSendVoice({
        uri,
        fileName: `voice-${Date.now()}.m4a`,
        mimeType: Platform.OS === 'ios' ? 'audio/mp4' : 'audio/mp4',
        durationMs,
      });
    } catch (error) {
      Alert.alert(
        'Voice send failed',
        error instanceof Error ? error.message : 'Could not send voice message.'
      );
    } finally {
      sendingVoiceRef.current = false;
    }
  }, [onSendVoice, stopTicker]);

  const runAttachment = useCallback(
    async (fn?: () => void | Promise<void>) => {
      closeMenu();
      try {
        await fn?.();
      } catch {
        /* parent may Alert */
      }
    },
    [closeMenu]
  );

  const attachmentRows: AttachmentRow[] = [
    {
      key: 'doc',
      icon: 'file-document-outline',
      label: 'Send a document',
      onPress: () => void runAttachment(onPickDocument),
    },
    {
      key: 'camera',
      icon: 'camera-outline',
      label: 'Take a photo or video',
      onPress: () => void runAttachment(onTakePhoto),
    },
    {
      key: 'library',
      icon: 'image-multiple-outline',
      label: 'Select media from library',
      onPress: () => void runAttachment(onPickFromLibrary),
    },
    {
      key: 'gif',
      icon: 'alpha-g-box-outline',
      label: 'Send a GIF',
      onPress: () =>
        Alert.alert('GIF', 'GIF search is not available in this demo.'),
    },
  ];

  const LeftIconBtn = menuOpen ? (
    <TouchableOpacity
      style={styles.iconHit}
      onPress={closeMenu}
      accessibilityRole="button"
      accessibilityLabel="Close attachment menu"
    >
      <MaterialCommunityIcons name="close" size={26} color={ICON_GRAY} />
    </TouchableOpacity>
  ) : (
    <TouchableOpacity
      style={styles.iconHit}
      onPress={toggleMenu}
      disabled={disabled || recording}
      accessibilityRole="button"
      accessibilityLabel="Attachments"
    >
      <MaterialCommunityIcons name="paperclip" size={26} color={ICON_GRAY} />
    </TouchableOpacity>
  );

  const RightAction = showSend ? (
    <TouchableOpacity
      style={styles.iconHit}
      onPress={handleSend}
      disabled={sendDisabled}
      accessibilityRole="button"
      accessibilityLabel="Send message"
    >
      {sending ? (
        <ActivityIndicator size="small" color={SEND_ICON} />
      ) : (
        <MaterialCommunityIcons name="send" size={26} color={SEND_ICON} />
      )}
    </TouchableOpacity>
  ) : (
    <Pressable
      style={[styles.iconHit, recording && styles.micRecording]}
      onPressIn={() => void startRecording()}
      onPressOut={() => void finishRecording()}
      disabled={disabled || sending || !onSendVoice}
      accessibilityRole="button"
      accessibilityLabel="Hold to record voice message"
    >
      <MaterialCommunityIcons
        name={recording ? 'microphone' : 'microphone'}
        size={26}
        color={recording ? '#fff' : ICON_GRAY}
      />
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      {recording ? (
        <View style={styles.recordingBanner}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>Recording {formatMmSs(elapsedMs)}</Text>
          <Text style={styles.recordingHint}>Release to send</Text>
        </View>
      ) : null}
      <View style={styles.barRow}>
        {LeftIconBtn}
        <TextInput
          style={styles.inputPill}
          value={value}
          onChangeText={(t) => onChangeText(clampText(t))}
          placeholder={resolvedPlaceholder}
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={MAX_CHARS}
          editable={!sending && !disabled && !recording}
          onFocus={() => setMenuOpen(false)}
        />
        {RightAction}
      </View>

      {menuOpen && !disabled ? (
        <View style={styles.menuBlock}>
          {attachmentRows.map((row) => (
            <TouchableOpacity
              key={row.key}
              style={styles.menuRow}
              onPress={row.onPress}
              activeOpacity={0.65}
              accessibilityRole="button"
              accessibilityLabel={row.label}
            >
              <MaterialCommunityIcons name={row.icon} size={24} color={ICON_GRAY} />
              <Text style={styles.menuLabel}>{row.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: INCHAT_BORDER,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: RECORD_RED,
  },
  recordingText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: RECORD_RED,
  },
  recordingHint: {
    fontSize: 12,
    fontWeight: '600',
    color: ICON_GRAY,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  iconHit: {
    width: 40,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    borderRadius: 22,
  },
  micRecording: {
    backgroundColor: RECORD_RED,
  },
  inputPill: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 11 : 10,
    borderRadius: 22,
    backgroundColor: '#F0F2F5',
  },
  menuBlock: {
    marginTop: 14,
    paddingBottom: 4,
    gap: 2,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
});
