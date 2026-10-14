import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';
import { useAssistantChat, type AssistantUiMessage } from '../hooks/useAssistantChat';
import AssistantResultCard, {
  CHECK_LABELS,
  buildShareText,
} from '../components/assistant/AssistantResultCard';

const NAVY = '#202871';
const MUTED = '#5B6473';
const BORDER = '#E5E7EE';
const MAX_TEXT_CHARS = 10000;

function MessageBubble({ message }: { message: AssistantUiMessage }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
      {!isUser ? (
        <View style={styles.avatar}>
          <MaterialCommunityIcons name="robot-happy-outline" size={18} color={NAVY} />
        </View>
      ) : null}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {message.imageUri ? (
          <Image source={{ uri: message.imageUri }} style={styles.bubbleImage} resizeMode="cover" />
        ) : null}
        {message.text ? (
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{message.text}</Text>
        ) : null}
      </View>
    </View>
  );
}

export default function AssistantScreen() {
  const navigation = useNavigation();
  const { token } = useUser();
  const chat = useAssistantChat(token);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<AssistantUiMessage>>(null);

  const runningLabels = chat.checks
    .filter((c) => c.status === 'running')
    .map((c) => CHECK_LABELS[c.source].toLowerCase());
  const canSend = !chat.sending && draft.trim().length > 0;

  const onSend = useCallback(() => {
    const text = draft.trim();
    if (!text || chat.sending) return;
    setDraft('');
    void chat.sendText(text);
  }, [chat, draft]);

  const onPickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to send a screenshot.');
      return;
    }
    const pick = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });
    const asset = pick.canceled ? undefined : pick.assets?.[0];
    if (!asset?.uri) return;
    void chat.sendImage({ uri: asset.uri, name: asset.fileName, type: asset.mimeType });
  }, [chat]);

  const onShare = useCallback(() => {
    if (chat.result) void Share.share({ message: buildShareText(chat.result) });
  }, [chat.result]);

  const scrollToEnd = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
        >
          <MaterialIcons name="arrow-back" size={24} color={NAVY} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>FraudAware Assistant</Text>
          <Text style={styles.headerSubtitle}>Job post · Company · Recruiter messages</Text>
        </View>
        <View style={styles.headerBadge}>
          <MaterialCommunityIcons name="robot-happy-outline" size={22} color={NAVY} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {runningLabels.length > 0 ? (
          <View style={styles.runningBanner}>
            <ActivityIndicator size="small" color={NAVY} />
            <Text style={styles.runningText}>
              Checking the {runningLabels.join(' and ')}… this can take up to 90 seconds.
            </Text>
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          data={chat.messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MessageBubble message={item} />}
          contentContainerStyle={styles.messages}
          onContentSizeChange={scrollToEnd}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <Text style={styles.notice}>
              Never share passwords, OTP codes or bank PINs here. What you send is checked by
              FraudAware's scam detection services.
            </Text>
          }
          ListFooterComponent={
            <>
              {chat.sending ? (
                <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
                  <View style={styles.avatar}>
                    <MaterialCommunityIcons name="robot-happy-outline" size={18} color={NAVY} />
                  </View>
                  <View style={[styles.bubble, styles.bubbleAssistant, styles.typing]}>
                    <ActivityIndicator size="small" color={NAVY} />
                    <Text style={styles.typingText}>Checking…</Text>
                  </View>
                </View>
              ) : null}
              {chat.result ? <AssistantResultCard verdict={chat.result} onShare={onShare} /> : null}
            </>
          }
        />

        {chat.error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{chat.error.message}</Text>
            {chat.error.canRetry ? (
              <Pressable onPress={chat.retry} hitSlop={8} accessibilityRole="button">
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {chat.chips.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
            keyboardShouldPersistTaps="handled"
          >
            {chat.chips.map((chip) => (
              <Pressable
                key={chip.id}
                onPress={() => void chat.sendChip(chip)}
                disabled={chat.sending}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.chip,
                  (pressed || chat.sending) && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.chipText}>{chip.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={styles.composer}>
          <Pressable
            onPress={() => void onPickImage()}
            disabled={chat.sending}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Send a screenshot"
            style={({ pressed }) => [styles.iconBtn, (pressed || chat.sending) && { opacity: 0.5 }]}
          >
            <MaterialCommunityIcons name="image-outline" size={24} color={NAVY} />
          </Pressable>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Type or paste here…"
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={MAX_TEXT_CHARS}
          />
          <Pressable
            onPress={onSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            style={({ pressed }) => [styles.sendBtn, (!canSend || pressed) && { opacity: 0.5 }]}
          >
            <MaterialIcons name="send" size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 6,
  },
  headerTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 17,
    color: NAVY,
  },
  headerSubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: MUTED,
  },
  headerBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EEF0FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  runningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#EEF0FA',
  },
  runningText: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: NAVY,
  },
  messages: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  notice: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    lineHeight: 16,
    color: MUTED,
    textAlign: 'center',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    width: '100%',
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowAssistant: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEF0FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: NAVY,
  },
  bubbleAssistant: {
    backgroundColor: '#F3F4F8',
    borderWidth: 1,
    borderColor: BORDER,
  },
  bubbleImage: {
    width: 180,
    height: 180,
    borderRadius: 10,
    marginBottom: 4,
  },
  bubbleText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: '#111827',
  },
  bubbleTextUser: {
    color: '#FFFFFF',
  },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typingText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: MUTED,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 14,
    marginBottom: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#FEF3F2',
    borderWidth: 1,
    borderColor: '#FECDCA',
  },
  errorText: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#B42318',
  },
  retryText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: NAVY,
  },
  chips: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    gap: 8,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: NAVY,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  chipText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: NAVY,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  iconBtn: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#111827',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
