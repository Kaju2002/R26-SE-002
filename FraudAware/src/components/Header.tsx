import React, { useCallback, useState } from 'react';
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ProfileDrawer from './ProfileDrawer';
import { useProfile } from '../context/ProfileContext';
import { useNotificationsUnread } from '../context/NotificationsUnreadContext';

const NAVY = '#202871';
const GREETING_GREY = '#8A93B0';
const BADGE_RED = '#E53935';

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
  const { profile } = useProfile();
  const { unreadCount, refreshUnreadCount } = useNotificationsUnread();
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });

  useFocusEffect(
    useCallback(() => {
      void refreshUnreadCount();
    }, [refreshUnreadCount])
  );

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
  const badgeLabel =
    unreadCount > 99 ? '99+' : unreadCount > 0 ? String(unreadCount) : null;

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
            {profile?.avatar ? (
              <Image
                source={{ uri: profile.avatar }}
                style={styles.avatar}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]} />
            )}
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
              {profile?.fullName || 'User'}
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
            accessibilityLabel={
              badgeLabel
                ? `Notifications, ${unreadCount} unread`
                : 'Notifications'
            }
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
            {badgeLabel ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badgeLabel}</Text>
              </View>
            ) : null}
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
  avatarPlaceholder: {
    borderWidth: 1,
    borderColor: NAVY,
  },
  greetingCol: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    fontSize: 14,
    color: GREETING_GREY,
    lineHeight: 20,
  },
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
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: BADGE_RED,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: 'Poppins_600SemiBold',
    lineHeight: 11,
  },
});
