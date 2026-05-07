import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { InchatThread } from '../../../data/inchatThreads';
import { INCHAT_BLUE_DOT, INCHAT_BORDER, INCHAT_MUTED, INCHAT_NAVY } from './inchatStyles';

type Props = {
  thread: InchatThread;
  onPress: () => void;
};

export default function InchatThreadRow({ thread, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.92 }]}
      accessibilityRole="button"
      accessibilityLabel={`${thread.participantName}. ${thread.lastMessagePreview}`}
    >
      <View style={styles.avatarWrap}>
        {thread.avatarKind === 'company' ? (
          <View style={[styles.avatar, styles.avatarCompany]}>
            <MaterialCommunityIcons name="domain" size={22} color={INCHAT_NAVY} />
          </View>
        ) : (
          <View style={[styles.avatar, styles.avatarPerson]}>
            <Text style={styles.initials}>{thread.initials ?? '?'}</Text>
          </View>
        )}
      </View>

      <View style={styles.main}>
        <View style={styles.topLine}>
          <Text style={styles.name} numberOfLines={1}>
            {thread.participantName}
          </Text>
          <Text style={styles.time}>{thread.timestampLabel}</Text>
        </View>
        {thread.subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {thread.subtitle}
          </Text>
        ) : null}
        <View style={styles.previewRow}>
          <Text style={styles.preview} numberOfLines={1}>
            {thread.lastMessagePreview}
          </Text>
          {thread.unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>
                {thread.unreadCount > 9 ? '9+' : thread.unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const AVATAR = 52;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: INCHAT_BORDER,
    backgroundColor: '#fff',
  },
  avatarWrap: {
    marginRight: 12,
  },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPerson: {
    backgroundColor: '#EEF0F8',
  },
  avatarCompany: {
    backgroundColor: '#F3F5F8',
    borderWidth: 1,
    borderColor: INCHAT_BORDER,
    borderRadius: 12,
    width: AVATAR,
    height: AVATAR,
  },
  initials: {
    fontSize: 16,
    fontWeight: '700',
    color: INCHAT_NAVY,
  },
  main: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  time: {
    fontSize: 12,
    fontWeight: '600',
    color: INCHAT_MUTED,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: INCHAT_MUTED,
    marginBottom: 4,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  preview: {
    flex: 1,
    fontSize: 14,
    color: INCHAT_MUTED,
    fontWeight: '500',
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: INCHAT_BLUE_DOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },
});
