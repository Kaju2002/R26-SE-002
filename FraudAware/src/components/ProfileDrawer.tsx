import React, { useEffect, useRef } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PROFILE } from '../../data/profile';
import type { RootStackParamList } from '../../App';

const NAVY = '#202871';
const NAVY_DARK = '#0E1140';
const SUBTLE = '#5B6473';
const DIVIDER = '#E5E7EE';
const VERIFIED_BG = '#D8E1FF';
const PREMIUM_BG = '#F4D27A';
const PREMIUM_TEXT = '#1B1B1F';

const ANIM_IN = 280;
const ANIM_OUT = 220;

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.84, 360);

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function ProfileDrawer({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const goToProfile = () => {
    onClose();
    navigation.navigate('Profile');
  };

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: ANIM_IN,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: ANIM_IN,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -DRAWER_WIDTH,
          duration: ANIM_OUT,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: ANIM_OUT,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateX, backdropOpacity]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[styles.drawer, { transform: [{ translateX }] }]}
        >
          <View
            style={[
              styles.topSafePad,
              { height: insets.top + 8 },
            ]}
          />

          <View
            style={[
              styles.headerRow,
              { paddingLeft: insets.left + 18 },
            ]}
          >
            <TouchableOpacity
              onPress={goToProfile}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Open profile page"
            >
              <Image
                source={{ uri: PROFILE.avatar }}
                style={styles.avatar}
                accessibilityLabel="Profile photo"
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close profile"
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color={NAVY_DARK} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingLeft: insets.left + 18 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity
              onPress={goToProfile}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Open profile page"
              style={styles.nameRow}
            >
              <Text style={styles.name} numberOfLines={1}>
                {PROFILE.fullName}
              </Text>
              {PROFILE.isVerified && (
                <View style={styles.verifiedBadge}>
                  <MaterialCommunityIcons
                    name="shield-check"
                    size={14}
                    color={NAVY}
                  />
                </View>
              )}
            </TouchableOpacity>

            <Text style={styles.headline}>{PROFILE.headline}</Text>
            <Text style={styles.location}>{PROFILE.location}</Text>

            <View style={styles.companyRow}>
              <Image
                source={{ uri: PROFILE.company.logo }}
                style={styles.companyLogo}
                resizeMode="contain"
              />
              <Text style={styles.companyName}>{PROFILE.company.name}</Text>
            </View>

            <View style={styles.divider} />

            {PROFILE.stats.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.statRow}
                activeOpacity={0.7}
              >
                <Text style={styles.statValue}>{s.value} </Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </TouchableOpacity>
            ))}

            <View style={styles.divider} />

            {PROFILE.menu.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={styles.menuRow}
                activeOpacity={0.7}
              >
                <Text style={styles.menuLabel}>{m.label}</Text>
              </TouchableOpacity>
            ))}

            <View style={{ height: 24 }} />
          </ScrollView>

          <View
            style={[
              styles.footer,
              {
                paddingLeft: insets.left + 18,
                paddingBottom: insets.bottom + 14,
              },
            ]}
          >
            <View style={styles.dividerThin} />

            <TouchableOpacity style={styles.settingsRow} activeOpacity={0.7}>
              <Ionicons name="settings-outline" size={22} color={NAVY_DARK} />
              <Text style={styles.settingsText}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.premiumBtn}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Text style={styles.premiumText}>{PROFILE.premiumLabel}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 15, 30, 0.45)',
  },
  drawer: {
    width: DRAWER_WIDTH,
    height: '100%',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 6, height: 0 },
    shadowRadius: 16,
    elevation: 16,
  },
  topSafePad: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 14,
    paddingTop: 6,
    paddingBottom: 14,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EAECF2',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingRight: 18,
    paddingBottom: 8,
    flexGrow: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 0,
    marginBottom: 8,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: NAVY_DARK,
    flexShrink: 1,
  },
  verifiedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: VERIFIED_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    fontSize: 13,
    color: '#1B1B1F',
    lineHeight: 19,
    marginBottom: 8,
  },
  location: {
    fontSize: 13,
    color: SUBTLE,
    marginBottom: 14,
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  companyLogo: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  companyName: {
    fontSize: 14,
    fontWeight: '600',
    color: NAVY_DARK,
  },
  divider: {
    height: 1,
    backgroundColor: DIVIDER,
    marginVertical: 16,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: NAVY,
  },
  statLabel: {
    fontSize: 14,
    color: NAVY_DARK,
  },
  menuRow: {
    paddingVertical: 12,
  },
  menuLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: NAVY_DARK,
  },
  footer: {
    paddingRight: 18,
    paddingTop: 6,
  },
  dividerThin: {
    height: 1,
    backgroundColor: DIVIDER,
    marginBottom: 6,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  settingsText: {
    fontSize: 16,
    fontWeight: '600',
    color: NAVY_DARK,
  },
  premiumBtn: {
    backgroundColor: PREMIUM_BG,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  premiumText: {
    fontSize: 15,
    fontWeight: '700',
    color: PREMIUM_TEXT,
  },
});
