import React, { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
} from '@expo-google-fonts/poppins';
import { useNavigation } from '@react-navigation/native';
import ProfileDrawer from './ProfileDrawer';
import { PROFILE } from '../../data/profile';

const NAVY = '#202871';
const GREETING_GREY = '#8A93B0';

type HeaderProps = {
  onProfilePress?: () => void;
  onBookmarksPress?: () => void;
  onNotificationsPress?: () => void;
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning,';
  if (h < 17) return 'Good Afternoon,';
  return 'Good Evening,';
}

export default function Header({
  onProfilePress,
  onBookmarksPress,
  onNotificationsPress,
}: HeaderProps) {
  const navigation = useNavigation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });

  const handleProfilePress = () => {
    if (onProfilePress) {
      onProfilePress();
      return;
    }
    setDrawerOpen(true);
  };

  const handleNotificationsPress = () => {
    if (onNotificationsPress) {
      onNotificationsPress();
      return;
    }
    navigation.navigate('Notifications' as never);
  };

  const handleBookmarksPress = () => {
    if (onBookmarksPress) {
      onBookmarksPress();
      return;
    }
  };

  const greetingFont = fontsLoaded ? 'Poppins_400Regular' : undefined;
  const nameFont = fontsLoaded ? 'Poppins_500Medium' : undefined;

  return (
    <>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.row}>
          <Pressable
            onPress={handleProfilePress}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            hitSlop={6}
            style={({ pressed }) => [
              styles.avatarRing,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Image
              source={{ uri: PROFILE.avatar }}
              style={styles.avatar}
              resizeMode="cover"
            />
          </Pressable>

          <View style={styles.greetingCol}>
            <Text
              style={[styles.greeting, { fontFamily: greetingFont }]}
              numberOfLines={1}
            >
              {getGreeting()}
            </Text>
            <Text
              style={[styles.userName, { fontFamily: nameFont }]}
              numberOfLines={1}
            >
              {PROFILE.fullName}
            </Text>
          </View>

          <Pressable
            onPress={handleBookmarksPress}
            accessibilityRole="button"
            accessibilityLabel="Saved jobs"
            hitSlop={10}
            style={({ pressed }) => [
              styles.iconBtn,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Image
              source={require('../../assets/icons/Bookmarks.png')}
              style={styles.icon}
              resizeMode="contain"
            />
          </Pressable>

          <Pressable
            onPress={handleNotificationsPress}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            hitSlop={10}
            style={({ pressed }) => [
              styles.iconBtn,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Image
              source={require('../../assets/icons/mdi_bell-badge-outline.png')}
              style={styles.icon}
              resizeMode="contain"
            />
          </Pressable>
        </View>
      </SafeAreaView>

      <ProfileDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}

const AVATAR_SIZE = 52;

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  avatarRing: {
    width: AVATAR_SIZE + 4,
    height: AVATAR_SIZE + 4,
    borderRadius: (AVATAR_SIZE + 4) / 2,
    borderWidth: 1.5,
    borderColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: '#EEF0F8',
  },
  greetingCol: {
    flex: 1,
    minWidth: 0,
  },
  /** "Good Morning," — Poppins Regular 14 · muted */
  greeting: {
    fontSize: 14,
    color: GREETING_GREY,
    lineHeight: 20,
  },
  /** Full name — Poppins Medium 18 · #202871 */
  userName: {
    fontSize: 18,
    color: NAVY,
    lineHeight: 24,
    marginTop: 2,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 24,
    height: 24,
    tintColor: NAVY,
  },
});
