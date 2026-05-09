import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  ListRenderItem,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import type { ChatStackParamList } from '../navigation/chatStackTypes';
import { navigateToMessageAnalyzer } from '../navigation/navigateToMessageAnalyzer';
import { getClassifyUrl } from '../config/messageAnalyzerApi';
import { getOrCreateDeviceUserId } from '../lib/deviceUserId';
import { readClassifyError } from '../utils/readClassifyError';
import { promptAnalysisServerReady } from '../utils/analysisServerGate';
import { useInchat } from '../context/InchatContext';
import type { InchatMessage } from '../../data/inchatMessages';
import { getInchatThreadById } from '../../data/inchatThreads';
import InchatMessageBubble from '../components/inchat/InchatMessageBubble';
import InchatComposer from '../components/inchat/InchatComposer';
import ConversationAnalysisSheet from '../components/analysis/ConversationAnalysisSheet';
import { INCHAT_BORDER, INCHAT_MUTED, INCHAT_NAVY } from '../components/inchat/inchatStyles';
import type { MergeableApiResult } from '../navigation/detectStackTypes';

type Props = NativeStackScreenProps<ChatStackParamList, 'InchatThread'>;
type ThreadRow =
  | { type: 'date'; id: string; label: string }
  | { type: 'message'; id: string; message: InchatMessage };

function transcriptFromMessages(messages: InchatMessage[]): string {
  return messages
    .map((m) => `${m.role === 'user' ? 'You' : 'Recruiter'}: ${m.body}`)
    .join('\n\n');
}

function dateLabelForMessage(message: InchatMessage): string {
  if (message.createdAtIso) {
    const d = new Date(message.createdAtIso);
    const today = new Date();
    const isSameDate =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    return isSameDate
      ? 'Today'
      : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return /\d{1,2}:\d{2}/.test(message.timeLabel) ? 'Today' : message.timeLabel;
}

export default function InchatThreadScreen({ navigation, route }: Props) {
  const { threadId } = route.params;
  const thread = getInchatThreadById(threadId);
  const { getCombinedMessages, appendUserMessage, editUserMessageState } = useInchat();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ThreadRow>>(null);

  const [draft, setDraft] = useState('');
  const [sendBusy, setSendBusy] = useState(false);
  const [analyzeBusy, setAnalyzeBusy] = useState(false);
  const [analysisSheet, setAnalysisSheet] = useState<{
    visible: boolean;
    result: MergeableApiResult | null;
    pastedMessage: string;
  }>({ visible: false, result: null, pastedMessage: '' });

  const [threadMenuVisible, setThreadMenuVisible] = useState(false);

  const messages = useMemo(() => getCombinedMessages(threadId), [getCombinedMessages, threadId]);

  const transcript = useMemo(() => transcriptFromMessages(messages), [messages]);
  const hasTranscript = transcript.trim().length > 0;
  const rows = useMemo<ThreadRow[]>(() => {
    const out: ThreadRow[] = [];
    let prevDate = '';
    for (const m of messages) {
      const d = dateLabelForMessage(m);
      if (d !== prevDate) {
        out.push({ type: 'date', id: `date-${d}-${m.id}`, label: d });
        prevDate = d;
      }
      out.push({ type: 'message', id: m.id, message: m });
    }
    return out;
  }, [messages]);

  useEffect(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages.length]);

  const onMessageLongPress = useCallback(
    (message: InchatMessage) => {
      const isLocalUser = message.role === 'user' && message.id.startsWith('local-');
      if (!isLocalUser) return;
      Alert.alert('Message options', 'Choose an action for your message.', [
        {
          text: 'Delete for me',
          style: 'destructive',
          onPress: () => {
            void editUserMessageState(threadId, message.id, 'delete');
          },
        },
        {
          text: 'Unsend',
          onPress: () => {
            void editUserMessageState(threadId, message.id, 'unsend');
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [editUserMessageState, threadId]
  );

  const renderItem: ListRenderItem<ThreadRow> = useCallback(
    ({ item }) => {
      if (item.type === 'date') {
        return (
          <View style={styles.dateRow}>
            <Text style={styles.datePill}>{item.label}</Text>
          </View>
        );
      }
      const canOpenMenu = item.message.role === 'user' && item.message.id.startsWith('local-');
      if (!canOpenMenu) {
        return <InchatMessageBubble message={item.message} />;
      }
      return (
        <Pressable onLongPress={() => onMessageLongPress(item.message)} delayLongPress={260}>
          <InchatMessageBubble message={item.message} />
        </Pressable>
      );
    },
    [onMessageLongPress]
  );

  const keyExtractor = useCallback((r: ThreadRow) => r.id, []);

  const onSend = useCallback(async () => {
    const text = draft.trim();
    if (!text.length || sendBusy) return;
    setSendBusy(true);
    try {
      await appendUserMessage(threadId, text);
      setDraft('');
    } finally {
      setSendBusy(false);
    }
  }, [appendUserMessage, draft, sendBusy, threadId]);

  const appendAttachmentNote = useCallback(
    async (line: string) => {
      await appendUserMessage(threadId, line);
    },
    [appendUserMessage, threadId]
  );

  const onTakePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take a photo or video.');
      return;
    }
    const pick = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.85,
      allowsEditing: false,
    });
    if (pick.canceled || !pick.assets?.[0]) return;
    const asset = pick.assets[0];
    const kind = asset.type === 'video' ? 'video' : 'photo';
    await appendAttachmentNote(`📎 Sent a ${kind} (demo attachment).`);
  }, [appendAttachmentNote]);

  const onPickFromLibrary = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to attach media.');
      return;
    }
    const pick = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.85,
      allowsEditing: false,
    });
    if (pick.canceled || !pick.assets?.[0]) return;
    await appendAttachmentNote('📎 Shared media from library (demo attachment).');
  }, [appendAttachmentNote]);

  const onAnalyzeConversation = useCallback(async () => {
    const text = transcript.trim();
    if (!text.length) {
      Alert.alert('Nothing to analyze', 'Send at least one message or use the seeded demo thread.');
      return;
    }
    setAnalyzeBusy(true);
    try {
      if (!(await promptAnalysisServerReady())) {
        return;
      }
      const userId = await getOrCreateDeviceUserId();
      const response = await fetch(getClassifyUrl(), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, user_id: userId }),
      });
      if (!response.ok) {
        const errMsg = await readClassifyError(response);
        Alert.alert('Could not analyze', errMsg);
        return;
      }
      const data = (await response.json()) as Record<string, unknown>;
      setAnalysisSheet({
        visible: true,
        result: data,
        pastedMessage: text,
      });
    } catch {
      Alert.alert(
        'Connection error',
        'Could not reach the server. Check Wi‑Fi and that the API is running.'
      );
    } finally {
      setAnalyzeBusy(false);
    }
  }, [transcript]);

  const closeAnalysisSheet = useCallback(() => {
    setAnalysisSheet((s) => ({ ...s, visible: false }));
  }, []);

  const closeThreadMenu = useCallback(() => setThreadMenuVisible(false), []);

  const openThreadMenu = useCallback(() => setThreadMenuVisible(true), []);

  const onMenuCheckConversation = useCallback(() => {
    closeThreadMenu();
    void onAnalyzeConversation();
  }, [closeThreadMenu, onAnalyzeConversation]);

  const onMenuMessageAnalyzer = useCallback(() => {
    closeThreadMenu();
    navigateToMessageAnalyzer(navigation);
  }, [closeThreadMenu, navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={INCHAT_NAVY} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {thread?.participantName ?? 'Conversation'}
          </Text>
          {thread?.subtitle ? (
            <Text style={styles.headerSub} numberOfLines={1}>
              {thread.subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={[
              styles.headerIconBtn,
              (!hasTranscript || analyzeBusy) && styles.headerIconBtnMuted,
            ]}
            onPress={() => void onAnalyzeConversation()}
            disabled={analyzeBusy}
            accessibilityRole="button"
            accessibilityLabel="Check conversation for scams"
          >
            {analyzeBusy ? (
              <ActivityIndicator color={INCHAT_NAVY} size="small" />
            ) : (
              <MaterialCommunityIcons name="shield-check-outline" size={24} color={INCHAT_NAVY} />
            )}
          </Pressable>
          <Pressable
            style={styles.headerIconBtn}
            onPress={openThreadMenu}
            accessibilityRole="button"
            accessibilityLabel="More tools"
          >
            <MaterialCommunityIcons name="dots-vertical" size={24} color={INCHAT_NAVY} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listPad}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No messages in this thread.</Text>
            </View>
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          style={styles.flex}
        />

        <View style={[styles.footerCol, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <InchatComposer
            value={draft}
            onChangeText={setDraft}
            onSend={onSend}
            sending={sendBusy}
            onTakePhoto={onTakePhoto}
            onPickFromLibrary={onPickFromLibrary}
          />
        </View>
      </KeyboardAvoidingView>
      <ConversationAnalysisSheet
        visible={analysisSheet.visible}
        onClose={closeAnalysisSheet}
        result={analysisSheet.result}
        pastedMessage={analysisSheet.pastedMessage}
      />
      <Modal
        visible={threadMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={closeThreadMenu}
        statusBarTranslucent
      >
        <View style={styles.menuOverlay}>
          <Pressable
            style={styles.menuBackdrop}
            onPress={closeThreadMenu}
            accessibilityLabel="Dismiss menu"
          />
          <View
            style={[
              styles.menuPanel,
              {
                top: insets.top + 52,
              },
            ]}
          >
            <Pressable
              style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
              onPress={onMenuCheckConversation}
              accessibilityRole="button"
              accessibilityLabel="Check conversation"
            >
              <MaterialCommunityIcons name="shield-check-outline" size={22} color={INCHAT_NAVY} />
              <Text style={styles.menuRowLabel}>Check conversation</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable
              style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
              onPress={onMenuMessageAnalyzer}
              accessibilityRole="button"
              accessibilityLabel="Open Message Analyzer"
            >
              <MaterialCommunityIcons name="shield-search" size={22} color={INCHAT_NAVY} />
              <Text style={styles.menuRowLabel}>Message Analyzer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: INCHAT_BORDER,
    gap: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: INCHAT_NAVY,
  },
  headerSub: {
    fontSize: 12,
    fontWeight: '600',
    color: INCHAT_MUTED,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconBtnMuted: {
    opacity: 0.38,
  },
  listPad: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 16,
    flexGrow: 1,
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: INCHAT_MUTED,
    fontWeight: '600',
  },
  dateRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  datePill: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    backgroundColor: '#ECEFF4',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  footerCol: {
    backgroundColor: '#fff',
  },
  menuOverlay: {
    flex: 1,
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  menuPanel: {
    position: 'absolute',
    right: 8,
    minWidth: 216,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: INCHAT_BORDER,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  menuRowPressed: {
    backgroundColor: '#F3F5F9',
  },
  menuRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: INCHAT_NAVY,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: INCHAT_BORDER,
    marginHorizontal: 10,
  },
});
