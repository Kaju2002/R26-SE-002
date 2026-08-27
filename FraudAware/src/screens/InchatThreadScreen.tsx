import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { ChatStackParamList } from '../navigation/chatStackTypes';
import { navigateToMessageAnalyzer } from '../navigation/navigateToMessageAnalyzer';
import { getClassifyUrl } from '../config/messageAnalyzerApi';
import { getOrCreateDeviceUserId } from '../lib/deviceUserId';
import { readClassifyError } from '../utils/readClassifyError';
import { promptAnalysisServerReady } from '../utils/analysisServerGate';
import { useInchat } from '../context/InchatContext';
import { useProfile } from '../context/ProfileContext';
import type { InchatMessage } from '../../data/inchatMessages';
import InchatMessageBubble from '../components/inchat/InchatMessageBubble';
import InchatComposer from '../components/inchat/InchatComposer';
import InchatApplicationSwitcher from '../components/inchat/InchatApplicationSwitcher';
import InchatReportSheet from '../components/inchat/InchatReportSheet';
import ConversationAnalysisSheet from '../components/analysis/ConversationAnalysisSheet';
import { INCHAT_BORDER, INCHAT_MUTED, INCHAT_NAVY } from '../components/inchat/inchatStyles';
import type { MergeableApiResult } from '../navigation/detectStackTypes';
import { applicationChipLabel } from '../utils/groupInchatInbox';

type Props = NativeStackScreenProps<ChatStackParamList, 'InchatThread'>;
type ThreadRow =
  | { type: 'date'; id: string; label: string }
  | { type: 'message'; id: string; message: InchatMessage };

function initialsFromName(name?: string | null): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function transcriptFromMessages(messages: InchatMessage[]): string {
  return messages
    .map((m) => `${m.role === 'user' ? 'You' : 'Contact'}: ${m.body}`)
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

function presenceLabel(isOnline: boolean, lastSeenAt: string | null): string {
  if (isOnline) return 'online';
  if (!lastSeenAt) return 'offline';
  const date = new Date(lastSeenAt);
  if (Number.isNaN(date.getTime())) return 'offline';
  return `last seen ${date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

export default function InchatThreadScreen({ navigation, route }: Props) {
  const { threadId } = route.params;
  const {
    getThreadById,
    getRelatedThreads,
    getCombinedMessages,
    appendUserMessage,
    appendUserImageMessage,
    appendUserDocumentMessage,
    appendUserAudioMessage,
    deleteMessage,
    clearConversation,
    setConversationSaved,
    setConversationStatus,
    loadMessages,
    leaveThread,
    loaded,
    isPeerTyping,
    getPeerPresence,
    setTyping,
  } = useInchat();
  const { profile } = useProfile();
  const thread = getThreadById(threadId);
  const peerAvatarUrl = thread?.avatarUrl;
  const peerInitials =
    thread?.initials || initialsFromName(thread?.participantName);
  const selfAvatarUrl = profile?.avatar || undefined;
  const selfInitials = initialsFromName(profile?.fullName || profile?.shortName);
  const relatedThreads = useMemo(
    () => getRelatedThreads(threadId),
    [getRelatedThreads, threadId]
  );
  const relatedLabels = useMemo(
    () => relatedThreads.map((entry, index) => applicationChipLabel(entry, index)),
    [relatedThreads]
  );
  const relatedActiveIndex = useMemo(
    () => relatedThreads.findIndex((entry) => entry.id === threadId),
    [relatedThreads, threadId]
  );
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ThreadRow>>(null);
  const typingIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingActive = useRef(false);

  const [draft, setDraft] = useState('');
  const [sendBusy, setSendBusy] = useState(false);
  const [analyzeBusy, setAnalyzeBusy] = useState(false);
  const [analysisSheet, setAnalysisSheet] = useState<{
    visible: boolean;
    result: MergeableApiResult | null;
    pastedMessage: string;
  }>({ visible: false, result: null, pastedMessage: '' });

  const [threadMenuVisible, setThreadMenuVisible] = useState(false);
  const [reportSheetVisible, setReportSheetVisible] = useState(false);

  const messages = useMemo(() => getCombinedMessages(threadId), [getCombinedMessages, threadId]);

  useEffect(() => {
    if (!loaded) return;
    void loadMessages(threadId);
  }, [loaded, loadMessages, threadId]);

  useEffect(() => {
    return () => {
      if (typingIdleTimer.current) clearTimeout(typingIdleTimer.current);
      if (isTypingActive.current) {
        setTyping(threadId, false);
        isTypingActive.current = false;
      }
      leaveThread(threadId);
    };
  }, [leaveThread, setTyping, threadId]);

  const peerTyping = isPeerTyping(threadId);
  const peerPresence = getPeerPresence(threadId);

  const onDraftChange = useCallback(
    (text: string) => {
      setDraft(text);
      if (thread?.iBlocked) return;
      const hasText = text.trim().length > 0;

      if (hasText) {
        if (!isTypingActive.current) {
          isTypingActive.current = true;
          setTyping(threadId, true);
        }
        if (typingIdleTimer.current) clearTimeout(typingIdleTimer.current);
        typingIdleTimer.current = setTimeout(() => {
          if (isTypingActive.current) {
            isTypingActive.current = false;
            setTyping(threadId, false);
          }
        }, 1500);
      } else if (isTypingActive.current) {
        if (typingIdleTimer.current) clearTimeout(typingIdleTimer.current);
        isTypingActive.current = false;
        setTyping(threadId, false);
      }
    },
    [setTyping, thread?.iBlocked, threadId]
  );

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
      if (message.deletedForEveryone || message.unsent) return;

      const options: {
        text: string;
        style?: 'destructive' | 'cancel' | 'default';
        onPress?: () => void;
      }[] = [
        {
          text: 'Delete for me',
          style: 'destructive',
          onPress: () => {
            void deleteMessage(threadId, message.id, 'me').catch((error: unknown) => {
              Alert.alert(
                'Could not delete',
                error instanceof Error ? error.message : 'Please try again.'
              );
            });
          },
        },
      ];

      if (message.role === 'user') {
        options.push({
          text: 'Delete for everyone',
          onPress: () => {
            void deleteMessage(threadId, message.id, 'everyone').catch((error: unknown) => {
              Alert.alert(
                'Could not delete',
                error instanceof Error ? error.message : 'Please try again.'
              );
            });
          },
        });
      }

      options.push({ text: 'Cancel', style: 'cancel' });

      Alert.alert('Message options', 'Choose an action for this message.', options);
    },
    [deleteMessage, threadId]
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
      const bubble = (
        <InchatMessageBubble
          message={item.message}
          peerAvatarUrl={peerAvatarUrl}
          peerInitials={peerInitials}
          selfAvatarUrl={selfAvatarUrl}
          selfInitials={selfInitials}
          onReportScam={() => setReportSheetVisible(true)}
        />
      );
      const canOpenMenu = !item.message.deletedForEveryone && !item.message.unsent;
      if (!canOpenMenu) {
        return bubble;
      }
      return (
        <Pressable onLongPress={() => onMessageLongPress(item.message)} delayLongPress={260}>
          {bubble}
        </Pressable>
      );
    },
    [onMessageLongPress, peerAvatarUrl, peerInitials, selfAvatarUrl, selfInitials]
  );

  const keyExtractor = useCallback((r: ThreadRow) => r.id, []);

  const onSend = useCallback(async () => {
    const text = draft.trim();
    if (!text.length || sendBusy || thread?.iBlocked) return;
    if (typingIdleTimer.current) clearTimeout(typingIdleTimer.current);
    if (isTypingActive.current) {
      isTypingActive.current = false;
      setTyping(threadId, false);
    }
    setSendBusy(true);
    try {
      await appendUserMessage(threadId, text);
      setDraft('');
    } finally {
      setSendBusy(false);
    }
  }, [appendUserMessage, draft, sendBusy, setTyping, thread?.iBlocked, threadId]);

  const uploadPickedImage = useCallback(
    async (asset: ImagePicker.ImagePickerAsset) => {
      if (sendBusy || thread?.iBlocked) return;
      setSendBusy(true);
      try {
        await appendUserImageMessage(
          threadId,
          {
            uri: asset.uri,
            fileName: asset.fileName,
            mimeType: asset.mimeType,
          },
          draft
        );
        setDraft('');
      } catch (error) {
        Alert.alert(
          'Could not send image',
          error instanceof Error ? error.message : 'Please try again.'
        );
      } finally {
        setSendBusy(false);
      }
    },
    [appendUserImageMessage, draft, sendBusy, thread?.iBlocked, threadId]
  );

  const onTakePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take a photo.');
      return;
    }
    const pick = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (pick.canceled || !pick.assets?.[0]) return;
    await uploadPickedImage(pick.assets[0]);
  }, [uploadPickedImage]);

  const onPickFromLibrary = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to attach media.');
      return;
    }
    const pick = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (pick.canceled || !pick.assets?.[0]) return;
    await uploadPickedImage(pick.assets[0]);
  }, [uploadPickedImage]);

  const onPickDocument = useCallback(async () => {
    if (sendBusy || thread?.iBlocked) return;
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (pick.canceled || !pick.assets?.[0]) return;

      const asset = pick.assets[0];
      if (asset.size && asset.size > 10 * 1024 * 1024) {
        Alert.alert('File too large', 'Documents cannot exceed 10 MB.');
        return;
      }

      setSendBusy(true);
      await appendUserDocumentMessage(
        threadId,
        {
          uri: asset.uri,
          fileName: asset.name || 'document.pdf',
          mimeType: asset.mimeType || 'application/pdf',
        },
        draft
      );
      setDraft('');
    } catch (error) {
      Alert.alert(
        'Could not send document',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setSendBusy(false);
    }
  }, [
    appendUserDocumentMessage,
    draft,
    sendBusy,
    thread?.iBlocked,
    threadId,
  ]);

  const onSendVoice = useCallback(
    async (payload: {
      uri: string;
      fileName: string;
      mimeType: string;
      durationMs: number;
    }) => {
      if (sendBusy || thread?.iBlocked) return;
      setSendBusy(true);
      try {
        await appendUserAudioMessage(threadId, payload, draft.trim());
        setDraft('');
      } catch (error) {
        Alert.alert(
          'Could not send voice message',
          error instanceof Error ? error.message : 'Please try again.'
        );
      } finally {
        setSendBusy(false);
      }
    },
    [appendUserAudioMessage, draft, sendBusy, thread?.iBlocked, threadId]
  );

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

  const onMenuClearChat = useCallback(() => {
    closeThreadMenu();
    Alert.alert(
      'Clear chat?',
      'This clears messages for you only. The other person still keeps the chat.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear chat',
          style: 'destructive',
          onPress: () => {
            void clearConversation(threadId).catch((error: unknown) => {
              Alert.alert(
                'Could not clear chat',
                error instanceof Error ? error.message : 'Please try again.'
              );
            });
          },
        },
      ]
    );
  }, [clearConversation, closeThreadMenu, threadId]);

  const isBlocked = Boolean(thread?.iBlocked);
  const isArchived = thread?.status === 'archived';
  const isSaved = Boolean(thread?.saved);
  const conversationIsBlocked = thread?.status === 'blocked';

  const onMenuToggleSaved = useCallback(() => {
    closeThreadMenu();
    void setConversationSaved(threadId, !isSaved).catch((error: unknown) => {
      Alert.alert(
        isSaved ? 'Could not remove saved chat' : 'Could not save chat',
        error instanceof Error ? error.message : 'Please try again.'
      );
    });
  }, [closeThreadMenu, isSaved, setConversationSaved, threadId]);

  const onMenuToggleArchive = useCallback(() => {
    closeThreadMenu();
    const nextStatus = isArchived ? 'active' : 'archived';
    Alert.alert(
      isArchived ? 'Unarchive conversation?' : 'Archive conversation?',
      isArchived
        ? 'This conversation will return to your main inbox.'
        : 'This conversation will move to Archived for both participants.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isArchived ? 'Unarchive' : 'Archive',
          onPress: () => {
            void setConversationStatus(threadId, nextStatus)
              .then(() => navigation.goBack())
              .catch((error: unknown) => {
                Alert.alert(
                  isArchived ? 'Could not unarchive' : 'Could not archive',
                  error instanceof Error ? error.message : 'Please try again.'
                );
              });
          },
        },
      ]
    );
  }, [
    closeThreadMenu,
    isArchived,
    navigation,
    setConversationStatus,
    threadId,
  ]);

  const onMenuToggleBlock = useCallback(() => {
    closeThreadMenu();
    if (isBlocked) {
      Alert.alert('Unblock conversation?', 'You will be able to message again.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: () => {
            void setConversationStatus(threadId, 'active').catch((error: unknown) => {
              Alert.alert(
                'Could not unblock',
                error instanceof Error ? error.message : 'Please try again.'
              );
            });
          },
        },
      ]);
      return;
    }

    Alert.alert(
      'Block this conversation?',
      'They will not be told you blocked them. Their messages will not be delivered to you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            void setConversationStatus(threadId, 'blocked').catch((error: unknown) => {
              Alert.alert(
                'Could not block',
                error instanceof Error ? error.message : 'Please try again.'
              );
            });
          },
        },
      ]
    );
  }, [closeThreadMenu, isBlocked, setConversationStatus, threadId]);

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
        <Pressable
          style={styles.headerIdentity}
          onPress={() => navigation.navigate('InchatChatInfo', { threadId })}
          accessibilityRole="button"
          accessibilityLabel="Open chat info, media and documents"
        >
          {thread?.avatarUrl ? (
            <Image
              source={{ uri: thread.avatarUrl }}
              style={styles.headerAvatar}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
              <Text style={styles.headerAvatarInitials}>
                {(thread?.participantName || 'C').slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {thread?.participantName ?? 'Conversation'}
            </Text>
            {thread?.jobTitle ? (
              <Text style={styles.headerJobTitle} numberOfLines={1}>
                {thread.jobTitle}
              </Text>
            ) : null}
            {peerTyping ? (
              <Text style={styles.typingSub} numberOfLines={1}>
                typing…
              </Text>
            ) : (
              <Text style={styles.headerSub} numberOfLines={1}>
                {isBlocked
                  ? 'Blocked'
                  : presenceLabel(peerPresence.isOnline, peerPresence.lastSeenAt)}
              </Text>
            )}
          </View>
        </Pressable>
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

      {relatedThreads.length > 1 ? (
        <View style={styles.headerSwitcherRow}>
          <Text style={styles.switcherHint}>Applications</Text>
          <InchatApplicationSwitcher
            labels={relatedLabels}
            activeIndex={relatedActiveIndex >= 0 ? relatedActiveIndex : 0}
            onSelect={(index) => {
              const next = relatedThreads[index];
              if (next && next.id !== threadId) {
                navigation.replace('InchatThread', { threadId: next.id });
              }
            }}
          />
        </View>
      ) : null}

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
          {isBlocked ? (
            <View style={styles.blockedBanner}>
              <Text style={styles.blockedBannerText}>
                You blocked this conversation. Unblock to message again.
              </Text>
            </View>
          ) : null}
          <InchatComposer
            value={draft}
            onChangeText={onDraftChange}
            onSend={onSend}
            sending={sendBusy}
            disabled={isBlocked}
            onPickDocument={onPickDocument}
            onTakePhoto={onTakePhoto}
            onPickFromLibrary={onPickFromLibrary}
            onSendVoice={onSendVoice}
          />
        </View>
      </KeyboardAvoidingView>
      <ConversationAnalysisSheet
        visible={analysisSheet.visible}
        onClose={closeAnalysisSheet}
        result={analysisSheet.result}
        pastedMessage={analysisSheet.pastedMessage}
      />
      <InchatReportSheet
        visible={reportSheetVisible}
        conversationId={threadId}
        peerLabel={thread?.participantName}
        jobLabel={thread?.jobTitle}
        onClose={() => setReportSheetVisible(false)}
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
              onPress={onMenuToggleSaved}
              accessibilityRole="button"
              accessibilityLabel={isSaved ? 'Remove from saved' : 'Save conversation'}
            >
              <MaterialCommunityIcons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={22}
                color={INCHAT_NAVY}
              />
              <Text style={styles.menuRowLabel}>
                {isSaved ? 'Remove from saved' : 'Save'}
              </Text>
            </Pressable>
            <View style={styles.menuDivider} />
            {!conversationIsBlocked ? (
              <>
                <Pressable
                  style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
                  onPress={onMenuToggleArchive}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isArchived ? 'Unarchive conversation' : 'Archive conversation'
                  }
                >
                  <MaterialCommunityIcons
                    name={isArchived ? 'archive-arrow-up-outline' : 'archive-outline'}
                    size={22}
                    color={INCHAT_NAVY}
                  />
                  <Text style={styles.menuRowLabel}>
                    {isArchived ? 'Unarchive' : 'Archive'}
                  </Text>
                </Pressable>
                <View style={styles.menuDivider} />
              </>
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
              onPress={onMenuMessageAnalyzer}
              accessibilityRole="button"
              accessibilityLabel="Open Message Analyzer"
            >
              <MaterialCommunityIcons name="shield-search" size={22} color={INCHAT_NAVY} />
              <Text style={styles.menuRowLabel}>Message Analyzer</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable
              style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
              onPress={onMenuToggleBlock}
              accessibilityRole="button"
              accessibilityLabel={isBlocked ? 'Unblock conversation' : 'Block conversation'}
            >
              <MaterialCommunityIcons
                name={isBlocked ? 'lock-open-outline' : 'block-helper'}
                size={22}
                color={isBlocked ? INCHAT_NAVY : '#B91C1C'}
              />
              <Text style={[styles.menuRowLabel, !isBlocked && styles.menuRowDanger]}>
                {isBlocked ? 'Unblock' : 'Block'}
              </Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable
              style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
              onPress={onMenuClearChat}
              accessibilityRole="button"
              accessibilityLabel="Clear chat"
            >
              <MaterialCommunityIcons name="broom" size={22} color="#B91C1C" />
              <Text style={[styles.menuRowLabel, styles.menuRowDanger]}>Clear chat</Text>
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
  headerIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    gap: 8,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F3F5F8',
  },
  headerAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarInitials: {
    fontSize: 14,
    fontWeight: '800',
    color: INCHAT_NAVY,
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
  headerJobTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: INCHAT_MUTED,
    marginTop: 1,
  },
  headerSub: {
    fontSize: 12,
    fontWeight: '600',
    color: INCHAT_MUTED,
    marginTop: 2,
  },
  typingSub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
    fontStyle: 'italic',
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
  headerSwitcherRow: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: INCHAT_BORDER,
    backgroundColor: '#FAFBFD',
    gap: 8,
  },
  switcherHint: {
    fontSize: 11,
    fontWeight: '700',
    color: INCHAT_MUTED,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
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
  menuRowDanger: {
    color: '#B91C1C',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: INCHAT_BORDER,
    marginHorizontal: 10,
  },
  blockedBanner: {
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FEF3F2',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FECDCA',
  },
  blockedBannerText: {
    color: '#B42318',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
