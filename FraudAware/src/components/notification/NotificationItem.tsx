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
      <Text
        style={[
          styles.title,
          (item.type === 'scam' || item.flagged) && styles.scamTitle,
        ]}
      >
        {item.title}
      </Text>
      <Text style={styles.meta}>
        {item.date}
        <Text style={styles.metaSep}>{' · '}</Text>
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
    paddingTop: 12,
    paddingBottom: 12,
  },
  rowPressed: {
    backgroundColor: '#F7F8FE',
  },
  title: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    lineHeight: 22,
    color: TITLE,
    marginBottom: 4,
  },
  scamTitle: {
    color: '#B42318',
  },
  meta: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: META,
    marginBottom: 4,
  },
  metaSep: {
    color: '#B0B6D4',
  },
  body: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: BODY,
  },
  divider: {
    height: 1,
    backgroundColor: DIVIDER,
    marginTop: 12,
    marginHorizontal: -20,
  },
});
