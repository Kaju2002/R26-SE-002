import React, { useCallback, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { INCHAT_BORDER } from './inchatStyles';

const MAX_CHARS = 2000;

/** Brand-aligned send accent (matches reference paper-plane blue tone). */
const SEND_ICON = '#2563EB';
const ICON_GRAY = '#5F6368';

type AttachmentRow = {
  key: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
};

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  sending?: boolean;
  /** When true, composer cannot send (e.g. conversation blocked). */
  disabled?: boolean;
  placeholder?: string;
  /** Camera capture — parent handles permissions + append. */
  onTakePhoto?: () => void | Promise<void>;
  /** Photo/video from library. */
  onPickFromLibrary?: () => void | Promise<void>;
  /** PDF, DOC, or DOCX attachment. */
  onPickDocument?: () => void | Promise<void>;
};

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
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  const trimmedLen = value.trim().length;
  const sendDisabled = disabled || sending || trimmedLen === 0;
  const showSend = !disabled && trimmedLen > 0;
  const resolvedPlaceholder = disabled ? 'You blocked this conversation' : placeholder;

  const clampText = useCallback((t: string) => (t.length <= MAX_CHARS ? t : t.slice(0, MAX_CHARS)), []);

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

  const onMicPress = useCallback(() => {
    Alert.alert('Voice message', 'Voice recording is not available in this demo.');
  }, []);

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
    {
      key: 'mention',
      icon: 'at',
      label: 'Mention a person',
      onPress: () =>
        Alert.alert('Mention', 'Type @ followed by a name in your message.'),
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
      disabled={disabled}
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
    <TouchableOpacity
      style={styles.iconHit}
      onPress={onMicPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Record voice message"
    >
      <MaterialCommunityIcons name="microphone" size={26} color={ICON_GRAY} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.wrap}>
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
          editable={!sending && !disabled}
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
  },
  inputPill: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
    paddingHorizontal: 16,
    paddingVertical: PlatformIOSPadding(),
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

/** Extra vertical padding so single-line text sits centered in the pill */
function PlatformIOSPadding(): number {
  return Platform.OS === 'ios' ? 11 : 10;
}
