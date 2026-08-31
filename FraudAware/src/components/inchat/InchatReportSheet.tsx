import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createConversationReport,
  submitChatReportFeedback,
  type ChatReport,
} from '../../api/chatReportApi';
import { REPORT_REASON_OPTIONS, type ReportReasonCode } from '../../api/reportApi';
import { useUser } from '../../context/UserContext';
import { useProfile } from '../../context/ProfileContext';
import { tacticKeyToChipLabel } from '../../utils/tacticLabels';
import { INCHAT_BORDER, INCHAT_MUTED, INCHAT_NAVY } from './inchatStyles';

type Props = {
  visible: boolean;
  conversationId: string;
  peerLabel?: string;
  jobLabel?: string;
  onClose: () => void;
  onSubmitted?: (report: ChatReport) => void;
};

export default function InchatReportSheet({
  visible,
  conversationId,
  peerLabel,
  jobLabel,
  onClose,
  onSubmitted,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const scrollMaxH = Math.round(windowHeight * 0.42);
  const sheetBottomPad = Platform.OS === 'ios' ? Math.max(insets.bottom, 10) : 6;
  const { token } = useUser();
  const { profile } = useProfile();
  const [reasonCode, setReasonCode] = useState<ReportReasonCode>('payment_request');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<ChatReport | null>(null);
  const [feedbackBusy, setFeedbackBusy] = useState(false);

  const reset = useCallback(() => {
    setReasonCode('payment_request');
    setDetails('');
    setBusy(false);
    setError(null);
    setSubmitted(null);
    setFeedbackBusy(false);
  }, []);

  const handleClose = useCallback(() => {
    if (busy || feedbackBusy) return;
    reset();
    onClose();
  }, [busy, feedbackBusy, onClose, reset]);

  const tacticsLine = useMemo(() => {
    if (!submitted?.tacticsSummary?.length) return null;
    return submitted.tacticsSummary.map(tacticKeyToChipLabel).slice(0, 4).join(' · ');
  }, [submitted]);

  const onSubmit = useCallback(async () => {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      const report = await createConversationReport(token, conversationId, {
        reasonCode,
        details: details.trim(),
        peerLabel,
        jobLabel,
        reporterName: profile?.fullName || profile?.shortName,
      });
      setSubmitted(report);
      onSubmitted?.(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit report');
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    conversationId,
    details,
    jobLabel,
    onSubmitted,
    peerLabel,
    profile?.fullName,
    profile?.shortName,
    reasonCode,
    token,
  ]);

  const onFeedback = useCallback(
    async (feedback: 'helpful' | 'false_alarm') => {
      if (!token || !submitted || feedbackBusy) return;
      setFeedbackBusy(true);
      try {
        const updated = await submitChatReportFeedback(token, submitted.id, feedback);
        setSubmitted(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save feedback');
      } finally {
        setFeedbackBusy(false);
      }
    },
    [feedbackBusy, submitted, token]
  );

  const renderFormBody = () => (
    <>
      <Text style={styles.lead}>
        We’ll save flagged messages, tactics, and a timeline for CareerNet review.
      </Text>
      <Text style={styles.label}>Why are you reporting?</Text>
      <View style={styles.reasons}>
        {REPORT_REASON_OPTIONS.map((option) => {
          const active = option.code === reasonCode;
          return (
            <Pressable
              key={option.code}
              style={[styles.reasonChip, active && styles.reasonChipActive]}
              onPress={() => setReasonCode(option.code)}
            >
              <Text style={[styles.reasonText, active && styles.reasonTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.label}>Details (optional)</Text>
      <TextInput
        style={styles.input}
        value={details}
        onChangeText={setDetails}
        placeholder="What felt suspicious?"
        placeholderTextColor="#9CA3AF"
        multiline
        maxLength={2000}
        textAlignVertical="top"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );

  const renderSubmittedBody = () => (
    <>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>
          {submitted!.flaggedCount} flagged ·{' '}
          {submitted!.riskLevel === 'high' ? 'High risk' : 'Caution'}
        </Text>
        {tacticsLine ? <Text style={styles.summaryMeta}>{tacticsLine}</Text> : null}
        <Text style={styles.summaryMeta}>
          Reason:{' '}
          {REPORT_REASON_OPTIONS.find((o) => o.code === submitted!.reasonCode)?.label ||
            submitted!.reasonCode}
        </Text>
      </View>

      <Text style={styles.label}>Timeline</Text>
      {(submitted!.timeline || []).length ? (
        (submitted!.timeline || []).map((point, index) => (
          <View key={`${point.messageId || index}-${point.at}`} style={styles.timelineRow}>
            <View
              style={[
                styles.timelineDot,
                point.riskLevel === 'high' && styles.timelineDotHigh,
              ]}
            />
            <View style={styles.timelineCopy}>
              <Text style={styles.timelineLabel} numberOfLines={2}>
                {point.label}
              </Text>
              <Text style={styles.timelineTime}>
                {point.at
                  ? new Date(point.at).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'}
                {point.tactics?.length
                  ? ` · ${point.tactics.map(tacticKeyToChipLabel).join(', ')}`
                  : ''}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>No flagged timeline points yet.</Text>
      )}

      <Text style={[styles.label, { marginTop: 14 }]}>Was this warning helpful?</Text>
      {submitted!.feedback === 'none' ? (
        <View style={styles.feedbackRow}>
          <Pressable
            style={[styles.feedbackBtn, feedbackBusy && styles.btnDisabled]}
            disabled={feedbackBusy}
            onPress={() => void onFeedback('helpful')}
          >
            <Text style={styles.feedbackBtnText}>Helpful</Text>
          </Pressable>
          <Pressable
            style={[styles.feedbackBtnGhost, feedbackBusy && styles.btnDisabled]}
            disabled={feedbackBusy}
            onPress={() => void onFeedback('false_alarm')}
          >
            <Text style={styles.feedbackBtnGhostText}>False alarm</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.thanks}>
          Thanks — marked as {submitted!.feedback === 'helpful' ? 'helpful' : 'false alarm'}.
        </Text>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={handleClose}
          disabled={busy || feedbackBusy}
        />
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <View style={[styles.sheet, { paddingBottom: sheetBottomPad }]}>
            {busy ? (
              <View style={styles.submittingOverlay} pointerEvents="auto">
                <ActivityIndicator size="large" color={INCHAT_NAVY} />
                <Text style={styles.submittingTitle}>Submitting evidence pack</Text>
                <Text style={styles.submittingHint}>Saving flagged messages and timeline…</Text>
              </View>
            ) : null}

            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title}>
                {submitted ? 'Evidence pack saved' : 'Report this chat'}
              </Text>
              <Pressable
                onPress={handleClose}
                hitSlop={10}
                accessibilityRole="button"
                disabled={busy || feedbackBusy}
              >
                <MaterialCommunityIcons name="close" size={22} color={INCHAT_MUTED} />
              </Pressable>
            </View>

            {!submitted ? (
              <View style={[styles.formBody, busy && styles.formDisabled]} pointerEvents={busy ? 'none' : 'auto'}>
                {renderFormBody()}
              </View>
            ) : (
              <ScrollView
                style={{ maxHeight: scrollMaxH }}
                contentContainerStyle={styles.body}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {renderSubmittedBody()}
              </ScrollView>
            )}

            {!submitted ? (
              <Pressable
                style={[styles.primaryBtn, busy && styles.btnDisabled]}
                onPress={() => void onSubmit()}
                disabled={busy}
                accessibilityState={{ busy }}
                accessibilityLabel={busy ? 'Submitting evidence pack' : 'Submit evidence pack'}
              >
                {busy ? (
                  <View style={styles.btnLoadingRow}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.primaryBtnText}>Submitting…</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryBtnText}>Submit evidence pack</Text>
                )}
              </Pressable>
            ) : (
              <Pressable style={styles.primaryBtn} onPress={handleClose}>
                <Text style={styles.primaryBtnText}>Done</Text>
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.35)',
  },
  kav: {
    width: '100%',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  submittingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  submittingTitle: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: '800',
    color: INCHAT_NAVY,
    textAlign: 'center',
  },
  submittingHint: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: INCHAT_MUTED,
    textAlign: 'center',
  },
  formDisabled: {
    opacity: 0.45,
  },
  btnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: INCHAT_NAVY,
  },
  formBody: {
    paddingBottom: 4,
  },
  body: {
    paddingBottom: 8,
  },
  lead: {
    fontSize: 13,
    lineHeight: 18,
    color: INCHAT_MUTED,
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  reasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  reasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: INCHAT_BORDER,
    backgroundColor: '#F9FAFB',
  },
  reasonChipActive: {
    borderColor: INCHAT_NAVY,
    backgroundColor: '#EEF0F8',
  },
  reasonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  reasonTextActive: {
    color: INCHAT_NAVY,
  },
  input: {
    minHeight: 84,
    borderWidth: 1,
    borderColor: INCHAT_BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#111827',
  },
  error: {
    color: '#B42318',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  primaryBtn: {
    marginTop: 10,
    backgroundColor: INCHAT_NAVY,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    padding: 12,
    marginBottom: 14,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 4,
  },
  summaryMeta: {
    fontSize: 12,
    lineHeight: 17,
    color: '#78350F',
    fontWeight: '500',
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    backgroundColor: '#F59E0B',
  },
  timelineDotHigh: {
    backgroundColor: '#EF4444',
  },
  timelineCopy: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  timelineTime: {
    marginTop: 2,
    fontSize: 11,
    color: INCHAT_MUTED,
  },
  empty: {
    fontSize: 12,
    color: INCHAT_MUTED,
    marginBottom: 8,
  },
  feedbackRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  feedbackBtn: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#059669',
    alignItems: 'center',
    paddingVertical: 11,
  },
  feedbackBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  feedbackBtnGhost: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: INCHAT_BORDER,
    alignItems: 'center',
    paddingVertical: 11,
    backgroundColor: '#fff',
  },
  feedbackBtnGhostText: {
    color: '#374151',
    fontWeight: '700',
    fontSize: 13,
  },
  thanks: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 8,
  },
});
