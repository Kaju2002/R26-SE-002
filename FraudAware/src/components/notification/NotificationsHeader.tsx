import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const NAVY = '#202871';

type Props = {
  title?: string;
  onBackPress?: () => void;
  onMorePress?: () => void;
};

export default function NotificationsHeader({
  title = 'Notifications',
  onBackPress,
  onMorePress,
}: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onBackPress}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={({ pressed }) => [
          styles.iconBtn,
          pressed && { opacity: 0.6 },
        ]}
      >
        <Ionicons name="chevron-back" size={26} color={NAVY} />
      </Pressable>

      <Text style={styles.title}>{title}</Text>

      <Pressable
        onPress={onMorePress}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="More options"
        style={({ pressed }) => [
          styles.iconBtn,
          pressed && { opacity: 0.6 },
        ]}
      >
        <Image
          source={require('../../../assets/icons/dot.png')}
          style={styles.moreIcon}
          resizeMode="contain"
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** "Notifications" — Poppins Medium 18 · #202871 */
  title: {
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 18,
    color: NAVY,
    marginLeft: 4,
  },
  moreIcon: {
    width: 22,
    height: 22,
    tintColor: NAVY,
  },
});
