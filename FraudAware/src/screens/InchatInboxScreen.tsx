import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  ListRenderItem,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ChatStackParamList } from '../navigation/chatStackTypes';
import { navigateToMessageAnalyzer } from '../navigation/navigateToMessageAnalyzer';
import { useInchat } from '../context/InchatContext';
import {
  INCHAT_FILTER_OPTIONS,
  type InchatFilterId,
  type InchatThread,
} from '../../data/inchatThreads';
import InchatFilterChips from '../components/inchat/InchatFilterChips';
import InchatInboxHeader from '../components/inchat/InchatInboxHeader';
import InchatThreadRow from '../components/inchat/InchatThreadRow';
import { INCHAT_MUTED, INCHAT_NAVY } from '../components/inchat/inchatStyles';

type Props = NativeStackScreenProps<ChatStackParamList, 'InchatInbox'>;

function matchesFilter(thread: InchatThread, filterId: InchatFilterId): boolean {
  if (filterId === 'unread') {
    return thread.unreadCount > 0;
  }
  return thread.filterTags.includes(filterId);
}

function matchesQuery(thread: InchatThread, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  return (
    thread.participantName.toLowerCase().includes(s) ||
    thread.lastMessagePreview.toLowerCase().includes(s) ||
    (thread.subtitle?.toLowerCase().includes(s) ?? false)
  );
}

export default function InchatInboxScreen({ navigation }: Props) {
  const { threadsForList } = useInchat();
  const [query, setQuery] = useState('');
  const [filterId, setFilterId] = useState<InchatFilterId>('focused');
  const showBack = navigation.canGoBack();

  const data = useMemo(() => {
    return threadsForList.filter(
      (t) => matchesFilter(t, filterId) && matchesQuery(t, query)
    );
  }, [filterId, query, threadsForList]);

  const renderItem: ListRenderItem<InchatThread> = useCallback(
    ({ item }) => (
      <InchatThreadRow
        thread={item}
        onPress={() => navigation.navigate('InchatThread', { threadId: item.id })}
      />
    ),
    [navigation]
  );

  const keyExtractor = useCallback((item: InchatThread) => item.id, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <InchatInboxHeader
        query={query}
        onQueryChange={setQuery}
        showBack={showBack}
        onBack={() => navigation.goBack()}
        onComposePress={() => navigateToMessageAnalyzer(navigation)}
      />
      <View style={styles.filterStrip}>
        <InchatFilterChips
          options={INCHAT_FILTER_OPTIONS}
          activeId={filterId}
          onSelect={setFilterId}
        />
      </View>
      <FlatList
        style={styles.list}
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No conversations</Text>
            <Text style={styles.emptySub}>Try another filter or search.</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  /** Pinned under search — does not scroll with threads */
  filterStrip: {
    flexShrink: 0,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  empty: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: INCHAT_NAVY,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
    color: INCHAT_MUTED,
    textAlign: 'center',
  },
});
