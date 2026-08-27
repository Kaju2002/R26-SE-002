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
import { buildInchatInboxRows, type InchatInboxRow } from '../utils/groupInchatInbox';
import InchatFilterChips from '../components/inchat/InchatFilterChips';
import InchatInboxHeader from '../components/inchat/InchatInboxHeader';
import InchatInboxGroupRow from '../components/inchat/InchatInboxGroupRow';
import { INCHAT_MUTED, INCHAT_NAVY } from '../components/inchat/inchatStyles';

type Props = NativeStackScreenProps<ChatStackParamList, 'InchatInbox'>;

function matchesFilter(thread: InchatThread, filterId: InchatFilterId): boolean {
  switch (filterId) {
    case 'focused':
      return thread.status === 'active';
    case 'jobs':
      return thread.status !== 'archived' && Boolean(thread.jobId);
    case 'unread':
      return thread.status !== 'archived' && thread.unreadCount > 0;
    case 'saved':
      return Boolean(thread.saved);
    case 'archived':
      return thread.status === 'archived';
  }
}

function matchesQuery(thread: InchatThread, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  return (
    thread.participantName.toLowerCase().includes(s) ||
    thread.lastMessagePreview.toLowerCase().includes(s) ||
    (thread.subtitle?.toLowerCase().includes(s) ?? false) ||
    (thread.jobTitle?.toLowerCase().includes(s) ?? false)
  );
}

export default function InchatInboxScreen({ navigation }: Props) {
  const { threadsForList, loaded, error } = useInchat();
  const [query, setQuery] = useState('');
  const [filterId, setFilterId] = useState<InchatFilterId>('focused');
  const showBack = navigation.canGoBack();

  const filteredThreads = useMemo(() => {
    return threadsForList.filter(
      (t) => matchesFilter(t, filterId) && matchesQuery(t, query)
    );
  }, [filterId, query, threadsForList]);

  const inboxRows = useMemo(
    () => buildInchatInboxRows(filteredThreads),
    [filteredThreads]
  );

  const renderItem: ListRenderItem<InchatInboxRow> = useCallback(
    ({ item }) => (
      <InchatInboxGroupRow
        row={item}
        onSelectThread={(threadId) => navigation.navigate('InchatThread', { threadId })}
      />
    ),
    [navigation]
  );

  const keyExtractor = useCallback(
    (item: InchatInboxRow) =>
      item.isGrouped ? `group-${item.display.peerUserId}` : item.display.id,
    []
  );

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
        data={inboxRows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {!loaded ? 'Loading conversations...' : error ? 'Could not load chats' : 'No conversations'}
            </Text>
            <Text style={styles.emptySub}>
              {error
                ? error
                : !loaded
                  ? 'Fetching your InChat threads.'
                  : 'Start a chat from an application, or try another filter.'}
            </Text>
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
