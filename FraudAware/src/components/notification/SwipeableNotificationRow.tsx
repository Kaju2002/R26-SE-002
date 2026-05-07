import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NotificationItem from './NotificationItem';
import type { AppNotification } from '../../../data/notifications';

const DELETE_BG = '#E63946';
const DELETE_WIDTH = 88;
const OPEN_THRESHOLD = DELETE_WIDTH / 2;
const FLICK_VELOCITY = 0.6;

type Props = {
  item: AppNotification;
  showDivider?: boolean;
  onPress?: () => void;
  onDelete: () => void;
};

/**
 * Swipe uses a single clipped row: [ content | delete ] translated together.
 * Avoids absoluteFill "behind" layers that can clip incorrectly with transforms on Android.
 */
export default function SwipeableNotificationRow({
  item,
  showDivider,
  onPress,
  onDelete,
}: Props) {
  const { width: windowW } = useWindowDimensions();
  const [clipW, setClipW] = useState(0);
  const rowWidth = clipW > 0 ? clipW : windowW;

  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const animateTo = (toValue: number, opening: boolean) => {
    isOpen.current = opening;
    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      friction: 8,
      tension: 80,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
      onPanResponderGrant: () => {
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, g) => {
        const base = isOpen.current ? -DELETE_WIDTH : 0;
        const next = base + g.dx;
        const clamped = Math.min(8, Math.max(-DELETE_WIDTH * 1.25, next));
        translateX.setValue(clamped);
      },
      onPanResponderRelease: (_, g) => {
        const base = isOpen.current ? -DELETE_WIDTH : 0;
        const final = base + g.dx;
        const flickedOpen = g.vx < -FLICK_VELOCITY;
        const flickedClosed = g.vx > FLICK_VELOCITY;

        if (flickedOpen) {
          animateTo(-DELETE_WIDTH, true);
        } else if (flickedClosed) {
          animateTo(0, false);
        } else if (final < -OPEN_THRESHOLD) {
          animateTo(-DELETE_WIDTH, true);
        } else {
          animateTo(0, false);
        }
      },
      onPanResponderTerminate: () => {
        animateTo(isOpen.current ? -DELETE_WIDTH : 0, isOpen.current);
      },
    })
  ).current;

  const close = () => {
    if (isOpen.current) {
      animateTo(0, false);
    }
  };

  useEffect(() => () => translateX.stopAnimation(), [translateX]);

  const handleRowPress = () => {
    if (isOpen.current) {
      close();
      return;
    }
    onPress?.();
  };

  const handleDelete = () => {
    Animated.timing(translateX, {
      toValue: -rowWidth - DELETE_WIDTH,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      onDelete();
    });
  };

  return (
    <View
      style={styles.clip}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - clipW) > 0.5) {
          setClipW(w);
        }
      }}
    >
      <Animated.View
        style={[
          styles.innerRow,
          { width: rowWidth + DELETE_WIDTH, transform: [{ translateX }] },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={[styles.contentSlot, { width: rowWidth }]}>
          <NotificationItem
            item={item}
            showDivider={showDivider}
            onPress={handleRowPress}
          />
        </View>

        <Pressable
          onPress={handleDelete}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${item.title}`}
          style={({ pressed }) => [
            styles.deleteColumn,
            pressed && { opacity: 0.9 },
          ]}
        >
          <View style={styles.deleteInner}>
            <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
            <Text style={styles.deleteLabel}>Delete</Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    width: '100%',
    overflow: 'hidden',
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  contentSlot: {
    backgroundColor: '#FFFFFF',
  },
  deleteColumn: {
    width: DELETE_WIDTH,
    backgroundColor: DELETE_BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  /** Nudge trash + label slightly upward (optical alignment with notification text block) */
  deleteInner: {
    alignItems: 'center',
    gap: 4,
    marginTop: -10,
  },
  deleteLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
