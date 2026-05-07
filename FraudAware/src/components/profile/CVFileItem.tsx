import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CVFile } from '../../../data/profileDetails';

const NAVY = '#202871';
const SUBTLE = '#7A88A6';
const FILE_ICON_BG = '#FDECEC';
const FILE_ICON_COLOR = '#C62828';
const REMOVE_RED = '#E63946';

type Props = {
  file: CVFile;
  onRemove?: () => void;
  onPress?: () => void;
};

export default function CVFileItem({ file, onRemove, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={file.name}
    >
      <View style={styles.fileBadge}>
        <Ionicons name="document-text" size={20} color={FILE_ICON_COLOR} />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.name} numberOfLines={1}>
          {file.name}
        </Text>
        <Text style={styles.size}>{file.size}</Text>
      </View>
      <Pressable
        onPress={onRemove}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${file.name}`}
        style={({ pressed }) => [
          styles.removeBtn,
          pressed && { opacity: 0.6 },
        ]}
      >
        <Ionicons name="close" size={18} color={REMOVE_RED} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  rowPressed: {
    opacity: 0.85,
  },
  fileBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: FILE_ICON_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: NAVY,
    marginBottom: 2,
  },
  size: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: SUBTLE,
  },
  removeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
