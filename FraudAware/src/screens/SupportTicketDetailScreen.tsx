import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
} from '@expo-google-fonts/poppins';
import NotificationsHeader from '../components/notification/NotificationsHeader';
import {
  addMySupportTicketMessage,
  getMySupportTicket,
} from '../api/supportApi';
import { useUser } from '../context/UserContext';
import type { RootStackParamList } from '../navigation/rootStackParams';
import type { SupportMessage, SupportTicket } from '../types/support';

const NAVY = '#202871';
const MUTED = '#5B6473';
const BORDER = '#E5E7EE';

function ticketLabel(ticket: SupportTicket) {
  return ticket.ticketNumber || ticket.id.slice(-6).toUpperCase();
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function MessageBubble({ message }: { message: SupportMessage }) {
  const isUser = message.author === 'user';

  return (
    <View
      style={[
        styles.bubbleRow,
        isUser ? styles.bubbleRowUser : styles.bubbleRowAdmin,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAdmin,
        ]}
      >
        {!isUser ? (
          <Text style={styles.authorName}>{message.authorName}</Text>
        ) : null}
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
          {message.body}
        </Text>
        <Text style={[styles.bubbleTime, isUser && styles.bubbleTimeUser]}>
          {formatMessageTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

export default function SupportTicketDetailScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'SupportTicketDetail'>>();
  const { token } = useUser();
  const listRef = useRef<FlatList<SupportMessage>>(null);

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });

  const loadTicket = useCallback(async () => {
    if (!token) {
      setError('Sign in to view this ticket.');
      setLoading(false);
      return;
    }

    setError(null);
    try {
      const item = await getMySupportTicket(token, route.params.ticketId);
      setTicket(item);
    } catch (err) {
      setTicket(null);
      setError(err instanceof Error ? err.message : 'Could not load ticket');
    } finally {
      setLoading(false);
    }
  }, [route.params.ticketId, token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadTicket();
    }, [loadTicket])
  );

  const handleSend = async () => {
    const body = reply.trim();
    if (!body || !token || !ticket) return;

    setSending(true);
    try {
      const updated = await addMySupportTicketMessage(token, ticket.id, body);
      setTicket(updated);
      setReply('');
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    } catch (err) {
      Alert.alert(
        'Could not send message',
        err instanceof Error ? err.message : 'Please try again.'
      );
    } finally {
      setSending(false);
    }
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={NAVY} size="large" />
      </View>
    );
  }

  const isClosed = ticket?.status === 'closed';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <NotificationsHeader
        title={ticket ? ticketLabel(ticket) : 'Ticket'}
        onBackPress={() => navigation.goBack()}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={NAVY} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : ticket ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={8}
        >
          <View style={styles.meta}>
            <Text style={styles.subject}>{ticket.subject}</Text>
            <Text style={styles.metaText}>
              Status: {ticket.status.replace('_', ' ')}
              {ticket.assigneeName ? ` · ${ticket.assigneeName}` : ''}
            </Text>
          </View>

          <FlatList
            ref={listRef}
            data={ticket.messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messages}
            renderItem={({ item }) => <MessageBubble message={item} />}
            onContentSizeChange={() =>
              listRef.current?.scrollToEnd({ animated: false })
            }
          />

          {isClosed ? (
            <View style={styles.closedBanner}>
              <Text style={styles.closedText}>
                This ticket is closed. Open a new ticket if you need more help.
              </Text>
            </View>
          ) : (
            <View style={styles.composer}>
              <TextInput
                style={styles.composerInput}
                value={reply}
                onChangeText={setReply}
                placeholder="Write a reply…"
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={8000}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.sendBtn,
                  (pressed || sending || !reply.trim()) && { opacity: 0.7 },
                ]}
                onPress={() => void handleSend()}
                disabled={sending || !reply.trim()}
              >
                {sending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.sendText}>Send</Text>
                )}
              </Pressable>
            </View>
          )}
        </KeyboardAvoidingView>
      ) : null}
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
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#B42318',
    textAlign: 'center',
  },
  meta: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  subject: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: NAVY,
    marginBottom: 4,
  },
  metaText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: MUTED,
    textTransform: 'capitalize',
  },
  messages: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  bubbleRow: {
    width: '100%',
  },
  bubbleRowUser: {
    alignItems: 'flex-end',
  },
  bubbleRowAdmin: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '86%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: NAVY,
  },
  bubbleAdmin: {
    backgroundColor: '#F3F4F8',
    borderWidth: 1,
    borderColor: BORDER,
  },
  authorName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: NAVY,
    marginBottom: 4,
  },
  bubbleText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  bubbleTextUser: {
    color: '#FFFFFF',
  },
  bubbleTime: {
    marginTop: 6,
    fontFamily: 'Poppins_400Regular',
    fontSize: 10,
    color: MUTED,
  },
  bubbleTimeUser: {
    color: 'rgba(255,255,255,0.75)',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  composerInput: {
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
    backgroundColor: NAVY,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  closedBanner: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: '#F9FAFB',
  },
  closedText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: MUTED,
    textAlign: 'center',
  },
});
