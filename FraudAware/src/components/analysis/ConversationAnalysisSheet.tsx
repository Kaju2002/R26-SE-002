import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MergeableApiResult } from '../../navigation/detectStackTypes';
import { analysisPayloadFromApi } from '../../utils/mergeAnalysisResult';
import { saveAnalysisSnapshot } from '../../utils/saveAnalysisSnapshot';
import AnalysisResultContent from './AnalysisResultContent';

const BUTTON_NAVY = '#202871';

type Props = {
  visible: boolean;
  onClose: () => void;
  result: MergeableApiResult | null;
  pastedMessage: string;
};

export default function ConversationAnalysisSheet({
  visible,
  onClose,
  result,
  pastedMessage,
}: Props) {
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);

  const winH = Dimensions.get('window').height;
  const sheetMaxH = winH * 0.92;
  const scrollMaxH = winH * 0.68;

  const payload = useMemo(() => {
    if (!result || Object.keys(result).length === 0) return null;
    return analysisPayloadFromApi(result, pastedMessage || '');
  }, [result, pastedMessage]);

  const onSave = useCallback(async () => {
    if (!payload) return;
    try {
      setSaving(true);
      await saveAnalysisSnapshot(payload);
      Alert.alert('Saved', 'Analysis saved on this device.');
    } catch {
      Alert.alert('Save failed', 'Could not write to storage.');
    } finally {
      setSaving(false);
    }
  }, [payload]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Dismiss analysis"
        />
        <View
          style={[
            styles.sheet,
            {
              maxHeight: sheetMaxH,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <View style={styles.grabberWrap}>
            <View style={styles.grabber} />
          </View>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Conversation check</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <MaterialCommunityIcons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          {!payload ? (
            <View style={styles.errorPad}>
              <Text style={styles.errorText}>Could not display analysis.</Text>
              <TouchableOpacity style={styles.errorCloseBtn} onPress={onClose}>
                <Text style={styles.errorCloseLabel}>Close</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <ScrollView
                style={[styles.scroll, { maxHeight: scrollMaxH }]}
                contentContainerStyle={styles.scrollInner}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                <AnalysisResultContent payload={payload} />
              </ScrollView>
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.btnOutline}
                  onPress={onSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={BUTTON_NAVY} />
                  ) : (
                    <Text style={styles.btnOutlineText}>Save</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnFilled} onPress={onClose}>
                  <Text style={styles.btnFilledText}>Done</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#FAFAFB',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  grabberWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: BUTTON_NAVY,
  },
  scroll: {},
  scrollInner: {
    paddingBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  btnOutline: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: BUTTON_NAVY,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  btnOutlineText: {
    fontSize: 15,
    fontWeight: '800',
    color: BUTTON_NAVY,
  },
  btnFilled: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BUTTON_NAVY,
  },
  btnFilledText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  errorPad: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 16,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  errorCloseBtn: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
    backgroundColor: BUTTON_NAVY,
  },
  errorCloseLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
});
