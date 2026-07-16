import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { InchatBannerNotification } from '../../context/InchatContext';

type Props = {
  notification: InchatBannerNotification;
  onOpen: () => void;
  onDismiss: () => void;
};

const AUTO_DISMISS_MS = 6500;

export default function InchatNotificationBanner({
  notification,
  onOpen,
  onDismiss,
}: Props) {
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-140)).current;
  const dismissing = useRef(false);

  const dismiss = useCallback(
    (direction: 'left' | 'right' | 'up' = 'up') => {
      if (dismissing.current) return;
      dismissing.current = true;

      const animation =
        direction === 'up'
          ? Animated.timing(translateY, {
              toValue: -160,
              duration: 180,
              useNativeDriver: true,
            })
          : Animated.timing(translateX, {
              toValue: direction === 'left' ? -420 : 420,
              duration: 180,
              useNativeDriver: true,
            });

      animation.start(onDismiss);
    },
    [onDismiss, translateX, translateY]
  );

  useEffect(() => {
    dismissing.current = false;
    translateX.setValue(0);
    translateY.setValue(-140);

    Animated.spring(translateY, {
      toValue: 0,
      damping: 18,
      stiffness: 180,
      mass: 0.8,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => dismiss('up'), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [dismiss, notification.id, translateX, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 8 || gesture.dy < -8,
        onPanResponderMove: (_, gesture) => {
          translateX.setValue(gesture.dx);
          if (gesture.dy < 0) {
            translateY.setValue(gesture.dy);
          }
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx < -70) {
            dismiss('left');
            return;
          }
          if (gesture.dx > 70) {
            dismiss('right');
            return;
          }
          if (gesture.dy < -40) {
            dismiss('up');
            return;
          }

          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }),
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
            }),
          ]).start();
        },
        onPanResponderTerminate: () => {
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }),
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
            }),
          ]).start();
        },
      }),
    [dismiss, translateX, translateY]
  );

  const openThread = () => {
    onDismiss();
    onOpen();
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.overlay, { paddingTop: insets.top + 8 }]}
    >
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.banner,
          notification.flagged && styles.flaggedBanner,
          {
            transform: [{ translateX }, { translateY }],
          },
        ]}
      >
        <Pressable
          onPress={openThread}
          accessibilityRole="button"
          accessibilityLabel={
            notification.flagged
              ? `Possible scam message from ${notification.senderName}`
              : `New message from ${notification.senderName}`
          }
          style={styles.content}
        >
          <View
            style={[
              styles.avatar,
              notification.flagged && styles.flaggedAvatar,
            ]}
          >
            {notification.avatarUrl ? (
              <Image
                source={{ uri: notification.avatarUrl }}
                style={styles.avatarImage}
              />
            ) : (
              <Ionicons
                name={notification.flagged ? 'warning' : 'business'}
                size={21}
                color={notification.flagged ? '#B42318' : '#202871'}
              />
            )}
          </View>

          <View style={styles.copy}>
            <View style={styles.titleRow}>
              <Text
                numberOfLines={1}
                style={[
                  styles.title,
                  notification.flagged && styles.flaggedTitle,
                ]}
              >
                {notification.flagged
                  ? 'Possible scam message'
                  : notification.senderName}
              </Text>
              <Text style={styles.now}>now</Text>
            </View>
            {notification.flagged ? (
              <Text numberOfLines={1} style={styles.sender}>
                From {notification.senderName}
              </Text>
            ) : null}
            <Text numberOfLines={2} style={styles.message}>
              {notification.body}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => dismiss('up')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          style={styles.close}
        >
          <Ionicons name="close" size={18} color="#667085" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    paddingHorizontal: 12,
    justifyContent: 'flex-start',
  },
  banner: {
    width: '100%',
    minHeight: 82,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E7EC',
    borderRadius: 16,
    shadowColor: '#101828',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 10,
  },
  flaggedBanner: {
    backgroundColor: '#FFF7F6',
    borderColor: '#FDA29B',
    borderLeftWidth: 5,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    paddingRight: 36,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#EEF0FF',
    marginRight: 11,
  },
  flaggedAvatar: {
    backgroundColor: '#FEE4E2',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  copy: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    color: '#202871',
    fontSize: 14,
    fontWeight: '700',
  },
  flaggedTitle: {
    color: '#B42318',
  },
  now: {
    color: '#98A2B3',
    fontSize: 11,
    marginLeft: 8,
  },
  sender: {
    color: '#B42318',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  message: {
    color: '#475467',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  close: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
