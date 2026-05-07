import React from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { JOB_SEARCH_COLORS } from './jobSearchTheme';
import type { SortOption } from './types';

type Props = {
  visible: boolean;
  value: SortOption;
  anchor: { x: number; y: number } | null;
  onClose: () => void;
  onChange: (value: SortOption) => void;
};

const OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'alphabetical', label: 'Alphabetical (A to Z)' },
  { key: 'highest_salary', label: 'Highest Salary' },
  { key: 'newly_posted', label: 'Newly Posted' },
  { key: 'ending_soon', label: 'Ending Soon' },
];

export default function JobsSortSheet({
  visible,
  value,
  anchor,
  onClose,
  onChange,
}: Props) {
  const screen = Dimensions.get('window');
  const menuWidth = 220;
  const left = Math.min(
    Math.max(12, (anchor?.x ?? screen.width - 20) - menuWidth + 10),
    screen.width - menuWidth - 12
  );
  const top = Math.max(80, (anchor?.y ?? 88) + 18);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={[styles.card, { left, top, width: menuWidth }]}>
              <Text style={styles.title}>Sort options</Text>
              {OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => {
                    onChange(opt.key);
                    onClose();
                  }}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.65 }]}
                >
                  <Text style={[styles.rowText, value === opt.key && styles.rowTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  card: {
    position: 'absolute',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: JOB_SEARCH_COLORS.divider,
  },
  title: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: JOB_SEARCH_COLORS.primaryText,
    marginBottom: 8,
  },
  row: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: JOB_SEARCH_COLORS.divider,
  },
  rowText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: JOB_SEARCH_COLORS.primaryText,
  },
  rowTextActive: {
    fontFamily: 'Poppins_500Medium',
  },
});
