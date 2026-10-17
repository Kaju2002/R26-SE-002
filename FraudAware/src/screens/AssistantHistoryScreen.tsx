import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';
import AssistantResultCard, {
  VERDICT_COLOURS,
  buildShareText,
} from '../components/assistant/AssistantResultCard';
import {
  clearRecentChecks,
  deleteRecentCheck,
  getRecentChecks,
  type RecentCheck,
} from '../utils/assistantStorage';
import { shareAssistantReport } from '../utils/assistantReport';

const NAVY = '#202871';
const MUTED = '#5B6473';
const BORDER = '#E5E7EE';

function subtitle(check: RecentCheck): string {
  const when = new Date(check.checkedAt).toLocaleString();
  const company = check.company?.company_name || check.company?.website_url || check.company?.email;
  return company ? `${company} · ${when}` : when;
}

/** Finished assistant checks saved on this phone (newest first). */
export default function AssistantHistoryScreen() {
  const navigation = useNavigation();
  const { user } = useUser();
  const userId = user?.id ?? 'unknown';
  const [checks, setChecks] = useState<RecentCheck[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getRecentChecks(userId).then((list) => {
        if (active) setChecks(list);
      });
      return () => {
        active = false;
      };
    }, [userId])
  );

  const onReport = useCallback(async (check: RecentCheck) => {
    setReportId(check.id);
    try {
      await shareAssistantReport({ verdict: check.verdict, checkedAt: new Date(check.checkedAt) });
    } catch {
      Alert.alert('Report not created', 'The PDF report could not be created. Please try again.');
    } finally {
      setReportId(null);
    }
  }, []);

  const onDelete = useCallback(
    (check: RecentCheck) => {
      Alert.alert('Delete this check?', 'It is removed from this phone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void deleteRecentCheck(userId, check.id).then(setChecks),
        },
      ]);
    },
    [userId]
  );

  const onClearAll = useCallback(() => {
    Alert.alert('Delete all recent checks?', 'They are removed from this phone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete all',
        style: 'destructive',
        onPress: () => void clearRecentChecks(userId).then(() => setChecks([])),
      },
    ]);
  }, [userId]);

  const renderItem = ({ item }: { item: RecentCheck }) => {
    const open = item.id === openId;
    const colour = VERDICT_COLOURS[item.verdict.colour];
    return (
      <View style={styles.item}>
        <Pressable
          onPress={() => setOpenId(open ? null : item.id)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        >
          <View style={[styles.dot, { backgroundColor: colour.main }]} />
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colour.main }]}>{item.verdict.title}</Text>
            <Text style={styles.rowSub} numberOfLines={1}>
              {subtitle(item)}
            </Text>
          </View>
          <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={24} color={MUTED} />
        </Pressable>
        {open ? (
          <View style={styles.details}>
            <AssistantResultCard
              verdict={item.verdict}
              onShare={() => void Share.share({ message: buildShareText(item.verdict) })}
              onReport={() => void onReport(item)}
              reportBusy={reportId === item.id}
            />
            <Pressable onPress={() => onDelete(item)} hitSlop={8} style={styles.deleteBtn}>
              <MaterialCommunityIcons name="trash-can-outline" size={18} color="#B42318" />
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

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
          <Text style={styles.headerTitle}>Recent checks</Text>
          <Text style={styles.headerSubtitle}>Saved only on this phone</Text>
        </View>
        {checks && checks.length > 0 ? (
          <Pressable onPress={onClearAll} hitSlop={8} accessibilityRole="button">
            <Text style={styles.clearText}>Clear all</Text>
          </Pressable>
        ) : null}
      </View>

      {checks === null ? (
        <View style={styles.centered}>
          <ActivityIndicator color={NAVY} />
        </View>
      ) : (
        <FlatList
          data={checks}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          contentContainerStyle={checks.length ? styles.list : styles.centered}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="clipboard-text-search-outline" size={40} color={MUTED} />
              <Text style={styles.emptyText}>
                No checks yet. Results from the assistant appear here when a check is finished.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  clearText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: '#B42318',
  },
  centered: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: 14,
    gap: 10,
  },
  item: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
  },
  rowSub: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: MUTED,
  },
  details: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  deleteBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: '#B42318',
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: MUTED,
    textAlign: 'center',
  },
});
