import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  ListRenderItem,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
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

function transcriptFromMessages(messages: InchatMessage[]): string {
  return messages
    .map((m) => `${m.role === 'user' ? 'You' : 'Recruiter'}: ${m.body}`)
    .join('\n\n');
}

export default function InchatThreadScreen({ navigation, route }: Props) {
  const { threadId } = route.params;
  const thread = getInchatThreadById(threadId);
  const { getCombinedMessages, appendUserMessage } = useInchat();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<InchatMessage>>(null);

  const [draft, setDraft] = useState('');
  const [sendBusy, setSendBusy] = useState(false);
  const [analyzeBusy, setAnalyzeBusy] = useState(false);
  const [analysisSheet, setAnalysisSheet] = useState<{
    visible: boolean;
    result: MergeableApiResult | null;
    pastedMessage: string;
  }>({ visible: false, result: null, pastedMessage: '' });

  const messages = useMemo(() => getCombinedMessages(threadId), [getCombinedMessages, threadId]);

  const transcript = useMemo(() => transcriptFromMessages(messages), [messages]);
  const hasTranscript = transcript.trim().length > 0;

  useEffect(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages.length]);

  const renderItem: ListRenderItem<InchatMessage> = useCallback(
    ({ item }) => <InchatMessageBubble message={item} />,
    []
  );

  const keyExtractor = useCallback((m: InchatMessage) => m.id, []);

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
        <Pressable
          style={styles.analyzeBtn}
          onPress={() => navigateToMessageAnalyzer(navigation)}
          accessibilityRole="button"
          accessibilityLabel="Open message analyzer"
        >
          <MaterialCommunityIcons name="shield-search" size={22} color={INCHAT_NAVY} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
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
          <TouchableOpacity
            style={[styles.analyzeStrip, (!hasTranscript || analyzeBusy) && styles.analyzeStripDisabled]}
            onPress={onAnalyzeConversation}
            disabled={!hasTranscript || analyzeBusy}
            accessibilityRole="button"
            accessibilityLabel="Analyze full conversation"
          >
            {analyzeBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.analyzeStripLabel}>Analyze conversation</Text>
            )}
          </TouchableOpacity>
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
  analyzeBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
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
  footerCol: {
    backgroundColor: '#fff',
  },
  analyzeStrip: {
    marginHorizontal: 14,
    marginBottom: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: INCHAT_NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  analyzeStripDisabled: {
    opacity: 0.45,
  },
  analyzeStripLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
