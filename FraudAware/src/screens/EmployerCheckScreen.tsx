import React, { useMemo, useRef, useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DetectStackParamList } from '../navigation/detectStackTypes';
import { getEmployerPredictUrl } from '../config/employerVerificationApi';

const BRAND = '#202871';
const MUTED = '#6B7280';
const PAGE_BG = '#F3F5FA';
const CARD = '#FFFFFF';
const LINE = '#E3E8F3';
const SOFT = '#EEF1F8';
const PLACEHOLDER = '#9CA3AF';
const GREEN = '#1B5E20';
const AMBER = '#B45309';

type Props = NativeStackScreenProps<DetectStackParamList, 'EmployerCheckScreen'>;
type FocusField = 'company' | 'website' | 'email' | 'job' | null;

export default function EmployerCheckScreen({ navigation }: Props) {
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');
  const [jobPost, setJobPost] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState<FocusField>(null);
  const scrollRef = useRef<ScrollView>(null);

  const filledOptional = useMemo(() => {
    let n = 0;
    if (website.trim()) n += 1;
    if (email.trim()) n += 1;
    if (jobPost.trim()) n += 1;
    return n;
  }, [website, email, jobPost]);

  const canSubmit = companyName.trim().length >= 2 && !loading;
  const strengthLabel =
    filledOptional === 0 ? 'Basic check' : filledOptional === 1 ? 'Good detail' : 'Stronger check';
  const strengthColor = filledOptional === 0 ? MUTED : filledOptional === 1 ? AMBER : GREEN;

  const handleCheck = async () => {
    const name = companyName.trim().replace(/\s+/g, ' ');
    if (name.length < 2) {
      setError('Please enter a company name (at least 2 characters).');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(getEmployerPredictUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: name,
          website_url: website.trim(),
          email: email.trim(),
          job_post: jobPost.trim(),
        }),
      });
      if (!res.ok) throw new Error('Server error — please try again in a moment.');
      const data = await res.json();
      navigation.navigate('EmployerResult', { result: data });
    } catch (e: unknown) {
      const message =
        e instanceof Error && e.message
          ? e.message
          : 'Could not reach the server. Check Wi‑Fi and that the employer API is running.';
      setError(message.includes('Network') || message.includes('fetch')
        ? 'Could not reach the server. Check Wi‑Fi and that the employer API is running.'
        : message);
    } finally {
      setLoading(false);
    }
  };

  const inputBorder = (key: FocusField) =>
    focused === key ? styles.inputFocused : styles.inputIdle;

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Header />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.heroGlow} />
            <View style={styles.heroIconWrap}>
              <MaterialCommunityIcons name="domain" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.heroEyebrow}>Employer Trust</Text>
            <Text style={styles.heroTitle}>Is this company real?</Text>
            <Text style={styles.heroSubtitle}>
              We’ll check registration, online reputation, and website signals — then explain the
              result in plain language.
            </Text>
            <View style={styles.checkRow}>
              {[
                { icon: 'file-certificate-outline' as const, label: 'Registry' },
                { icon: 'star-circle-outline' as const, label: 'Reviews' },
                { icon: 'web' as const, label: 'Website' },
              ].map((item) => (
                <View key={item.label} style={styles.checkChip}>
                  <MaterialCommunityIcons name={item.icon} size={16} color="#FFFFFF" />
                  <Text style={styles.checkChipText}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Strength meter */}
          <View style={styles.strengthCard}>
            <View style={styles.strengthTop}>
              <Text style={styles.strengthTitle}>Check strength</Text>
              <Text style={[styles.strengthValue, { color: strengthColor }]}>{strengthLabel}</Text>
            </View>
            <View style={styles.strengthTrack}>
              {[0, 1, 2].map((i) => {
                const filled = Math.min(3, (companyName.trim() ? 1 : 0) + filledOptional);
                return (
                  <View
                    key={i}
                    style={[
                      styles.strengthSegment,
                      i < filled
                        ? { backgroundColor: strengthColor }
                        : styles.strengthSegmentEmpty,
                    ]}
                  />
                );
              })}
            </View>
            <Text style={styles.strengthHint}>
              Company name is required. Website, email, or job text make the result more reliable.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.formCard}>
            <Text style={styles.sectionLabel}>Company details</Text>

            <Text style={styles.fieldLabel}>
              Company name <Text style={styles.required}>*</Text>
            </Text>
            <View style={[styles.inputWrap, inputBorder('company')]}>
              <MaterialCommunityIcons
                name="office-building-outline"
                size={20}
                color={focused === 'company' ? BRAND : MUTED}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="e.g. People's Bank, Dialog Axiata"
                placeholderTextColor={PLACEHOLDER}
                value={companyName}
                onChangeText={setCompanyName}
                onFocus={() => setFocused('company')}
                onBlur={() => setFocused(null)}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>

            <Text style={styles.fieldLabel}>
              Company website <Text style={styles.optional}>optional</Text>
            </Text>
            <View style={[styles.inputWrap, inputBorder('website')]}>
              <MaterialCommunityIcons
                name="link-variant"
                size={20}
                color={focused === 'website' ? BRAND : MUTED}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="company.com or https://…"
                placeholderTextColor={PLACEHOLDER}
                value={website}
                onChangeText={setWebsite}
                onFocus={() => setFocused('website')}
                onBlur={() => setFocused(null)}
                autoCapitalize="none"
                keyboardType="url"
                autoCorrect={false}
              />
            </View>
            <Text style={styles.fieldHint}>Use the company’s own site — not a job-ad link.</Text>

            <Text style={styles.fieldLabel}>
              Contact email <Text style={styles.optional}>optional</Text>
            </Text>
            <View style={[styles.inputWrap, inputBorder('email')]}>
              <MaterialCommunityIcons
                name="email-outline"
                size={20}
                color={focused === 'email' ? BRAND : MUTED}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="hr@company.com"
                placeholderTextColor={PLACEHOLDER}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>

            <Text style={styles.fieldLabel}>
              Job post text <Text style={styles.optional}>optional</Text>
            </Text>
            <View style={[styles.inputWrap, styles.multilineWrap, inputBorder('job')]}>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="Paste the message or job ad they sent you…"
                placeholderTextColor={PLACEHOLDER}
                value={jobPost}
                onChangeText={setJobPost}
                onFocus={() => {
                  setFocused('job');
                  setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
                }}
                onBlur={() => setFocused(null)}
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Safety tip */}
          <View style={styles.tipCard}>
            <MaterialCommunityIcons name="shield-check-outline" size={22} color={BRAND} />
            <View style={styles.tipCopy}>
              <Text style={styles.tipTitle}>Before you apply</Text>
              <Text style={styles.tipText}>
                Never pay a fee to get a job, and don’t share bank OTPs or ID scans with strangers.
              </Text>
            </View>
          </View>

          {/* What you get */}
          <View style={styles.outcomeCard}>
            <Text style={styles.outcomeTitle}>You’ll see</Text>
            {[
              { icon: 'traffic-light' as const, text: 'A clear Low / Medium / High risk level' },
              { icon: 'file-search-outline' as const, text: 'Whether official registration was found' },
              { icon: 'account-group-outline' as const, text: 'Social & review presence signals' },
            ].map((row) => (
              <View key={row.text} style={styles.outcomeRow}>
                <View style={styles.outcomeIcon}>
                  <MaterialCommunityIcons name={row.icon} size={18} color={BRAND} />
                </View>
                <Text style={styles.outcomeText}>{row.text}</Text>
              </View>
            ))}
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <MaterialCommunityIcons name="alert-circle-outline" size={22} color="#B00020" />
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={() => setError('')} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={20} color="#B00020" />
              </Pressable>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={BRAND} />
              <Text style={styles.loadingTitle}>Checking this employer…</Text>
              <Text style={styles.loadingSub}>
                Registry and web checks can take up to about a minute. Please keep this screen open.
              </Text>
            </View>
          ) : null}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Sticky CTA */}
        <View style={styles.ctaBar}>
          <TouchableOpacity
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            onPress={handleCheck}
            disabled={!canSubmit}
            activeOpacity={0.88}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="shield-search" size={22} color="#FFFFFF" />
                <Text style={styles.buttonText}>Check employer</Text>
              </>
            )}
          </TouchableOpacity>
          {!companyName.trim() ? (
            <Text style={styles.ctaHint}>Enter a company name to continue</Text>
          ) : (
            <Text style={styles.ctaHint}>Results open on the next screen</Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  flex: { flex: 1 },
  content: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  hero: {
    backgroundColor: BRAND,
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    right: -40,
    top: -50,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
    fontFamily: 'Poppins_500Medium',
  },
  heroTitle: {
    fontSize: 26,
    color: '#FFFFFF',
    fontFamily: 'Poppins_700Bold',
    marginBottom: 8,
    lineHeight: 32,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 21,
    marginBottom: 16,
    fontFamily: 'Poppins_400Regular',
  },
  checkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  checkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  checkChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Poppins_500Medium',
  },
  strengthCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: LINE,
  },
  strengthTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  strengthTitle: {
    fontSize: 13,
    color: MUTED,
    fontFamily: 'Poppins_500Medium',
  },
  strengthValue: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'Poppins_700Bold',
  },
  strengthTrack: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  strengthSegment: {
    flex: 1,
    height: 6,
    borderRadius: 999,
  },
  strengthSegmentEmpty: {
    backgroundColor: SOFT,
  },
  strengthHint: {
    fontSize: 12,
    color: MUTED,
    lineHeight: 17,
    fontFamily: 'Poppins_400Regular',
  },
  formCard: {
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: LINE,
  },
  sectionLabel: {
    fontSize: 15,
    color: BRAND,
    fontFamily: 'Poppins_700Bold',
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 13,
    color: BRAND,
    marginBottom: 8,
    marginTop: 10,
    fontFamily: 'Poppins_500Medium',
  },
  required: { color: '#C62828' },
  optional: {
    color: MUTED,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  fieldHint: {
    fontSize: 11,
    color: MUTED,
    marginTop: -2,
    marginBottom: 4,
    marginLeft: 2,
    fontFamily: 'Poppins_400Regular',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SOFT,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    minHeight: 50,
  },
  multilineWrap: {
    alignItems: 'flex-start',
    paddingTop: 10,
    minHeight: 110,
  },
  inputIdle: {
    borderColor: LINE,
  },
  inputFocused: {
    borderColor: BRAND,
    backgroundColor: '#FFFFFF',
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: BRAND,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontFamily: 'Poppins_400Regular',
  },
  multilineInput: {
    minHeight: 90,
    width: '100%',
  },
  tipCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#E8EEFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#D5DEF5',
  },
  tipCopy: { flex: 1 },
  tipTitle: {
    fontSize: 13,
    color: BRAND,
    fontFamily: 'Poppins_700Bold',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 12,
    color: '#3D4A6B',
    lineHeight: 18,
    fontFamily: 'Poppins_400Regular',
  },
  outcomeCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: LINE,
  },
  outcomeTitle: {
    fontSize: 14,
    color: BRAND,
    fontFamily: 'Poppins_700Bold',
    marginBottom: 12,
  },
  outcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  outcomeIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outcomeText: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
    fontFamily: 'Poppins_400Regular',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFEBEE',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  errorText: {
    flex: 1,
    color: '#B00020',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Poppins_400Regular',
  },
  loadingCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: LINE,
  },
  loadingTitle: {
    marginTop: 12,
    fontSize: 15,
    color: BRAND,
    fontFamily: 'Poppins_700Bold',
  },
  loadingSub: {
    marginTop: 6,
    fontSize: 12,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: 'Poppins_400Regular',
  },
  bottomSpacer: { height: 8 },
  ctaBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 10 : 14,
    backgroundColor: PAGE_BG,
    borderTopWidth: 1,
    borderTopColor: LINE,
  },
  button: {
    backgroundColor: BRAND,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Poppins_700Bold',
  },
  ctaHint: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 12,
    color: MUTED,
    fontFamily: 'Poppins_400Regular',
  },
});
