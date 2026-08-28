import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useFocusEffect,
  useNavigation,
  type NavigationProp,
} from '@react-navigation/native';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
} from '@expo-google-fonts/poppins';
import NotificationsHeader from '../components/notification/NotificationsHeader';
import { listMySupportTickets } from '../api/supportApi';
import { useUser } from '../context/UserContext';
import type { RootStackParamList } from '../navigation/rootStackParams';
import type { SupportTicket, SupportTicketStatus } from '../types/support';

const NAVY = '#202871';
const MUTED = '#5B6473';
const DIVIDER = '#E5E7EE';

const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  closed: 'Closed',
};

const STATUS_COLORS: Record<SupportTicketStatus, string> = {
  open: '#2563EB',
  in_progress: '#D97706',
  closed: '#6B7280',
};

function ticketLabel(ticket: SupportTicket) {
  return ticket.ticketNumber || ticket.id.slice(-6).toUpperCase();
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export default function SupportTicketsScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { token } = useUser();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });

  const loadTickets = useCallback(async () => {
    if (!token) {
      setTickets([]);
      setError('Sign in to view your support tickets.');
      setLoading(false);
      return;
    }

    setError(null);
    try {
      const result = await listMySupportTickets(token, { limit: 50 });
      setTickets(result.items);
    } catch (err) {
      setTickets([]);
      setError(err instanceof Error ? err.message : 'Could not load tickets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadTickets();
    }, [loadTickets])
  );

  if (!fontsLoaded) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={NAVY} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <NotificationsHeader
        title="Help & Support"
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.actionsRow}>
        <Pressable
          style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.85 }]}
          onPress={() => navigation.navigate('SupportCreateTicket')}
        >
          <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.newBtnText}>New ticket</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={NAVY} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : tickets.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="chatbubbles-outline" size={42} color={MUTED} />
          <Text style={styles.emptyTitle}>No support tickets yet</Text>
          <Text style={styles.emptyBody}>
            Open a ticket and our team will get back to you.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadTickets();
              }}
              tintColor={NAVY}
            />
          }
        >
          {tickets.map((ticket) => (
            <Pressable
              key={ticket.id}
              style={({ pressed }) => [
                styles.card,
                pressed && { opacity: 0.9 },
              ]}
              onPress={() =>
                navigation.navigate('SupportTicketDetail', {
                  ticketId: ticket.id,
                })
              }
            >
              <View style={styles.cardTop}>
                <Text style={styles.ticketNumber}>{ticketLabel(ticket)}</Text>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: `${STATUS_COLORS[ticket.status]}18` },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: STATUS_COLORS[ticket.status] },
                    ]}
                  >
                    {STATUS_LABELS[ticket.status]}
                  </Text>
                </View>
              </View>
              <Text style={styles.subject} numberOfLines={1}>
                {ticket.subject}
              </Text>
              <Text style={styles.preview} numberOfLines={2}>
                {ticket.description}
              </Text>
              <Text style={styles.date}>{formatDate(ticket.updatedAt)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  actionsRow: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: NAVY,
    borderRadius: 12,
    paddingVertical: 12,
  },
  newBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  errorText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#B42318',
    textAlign: 'center',
  },
  emptyTitle: {
    marginTop: 8,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: NAVY,
  },
  emptyBody: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: DIVIDER,
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  ticketNumber: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    color: MUTED,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
  },
  subject: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: NAVY,
    marginBottom: 4,
  },
  preview: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: MUTED,
    lineHeight: 18,
  },
  date: {
    marginTop: 10,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#858BBD',
  },
});
