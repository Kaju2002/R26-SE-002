import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AppNotification } from '../../../data/notifications';

const TITLE = '#202871';
const META = '#858BBD';
const BODY = '#42498A';
const DIVIDER = '#EEF0F8';

type Props = {
  item: AppNotification;
  showDivider?: boolean;
  onPress?: () => void;
};

export default function NotificationItem({
  item,
  showDivider,
  onPress,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.title}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.meta}>
        {item.date}
        <Text style={styles.metaSep}>{'  |  '}</Text>
        {item.time}
      </Text>
      <Text style={styles.body}>{item.body}</Text>
      {showDivider && <View style={styles.divider} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
  },
  rowPressed: {
    backgroundColor: '#F7F8FE',
  },
  /** Title — Poppins Medium 16 · #202871 */
  title: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    color: TITLE,
    marginBottom: 4,
  },
  /** Date · Time — Poppins Regular 12 · #858BBD */
  meta: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: META,
    marginBottom: 8,
  },
  metaSep: {
    color: META,
  },
  /** Body — Poppins Regular 13 · #42498A */
  body: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: BODY,
  },
  divider: {
    height: 1,
    backgroundColor: DIVIDER,
    marginTop: 12,
    marginHorizontal: -20,
  },
});
