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
  onSettingsPress?: () => void;
};

export default function ProfileTitleBar({
  title = 'Profile',
  onBackPress,
  onSettingsPress,
}: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {onBackPress && (
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
        )}
        <Text style={styles.title}>{title}</Text>
      </View>
      <Pressable
        onPress={onSettingsPress}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Settings"
        style={({ pressed }) => [
          styles.iconBtn,
          pressed && { opacity: 0.6 },
        ]}
      >
        <Image
          source={require('../../../assets/icons/setting.png')}
          style={styles.icon}
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  /** "Profile" — Poppins Medium 20 · #202871 */
  title: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 20,
    color: NAVY,
    letterSpacing: -0.2,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 24,
    height: 24,
    tintColor: NAVY,
  },
});
