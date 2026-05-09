
import React, { useState } from 'react';
import { StyleSheet, ScrollView, View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../components/Header';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DetectStackParamList } from '../navigation/detectStackTypes';

const TEXT_ACCENT = '#202871';
const INPUT_BORDER = '#202871';
const INPUT_FILL = '#F4F6F9';
const PLACEHOLDER_GREY = '#9CA3AF';
const BTN_BG = '#202871';
const BTN_TEXT = '#FFFFFF';

type Props = NativeStackScreenProps<DetectStackParamList, 'EmployerCheckScreen'>;

export default function EmployerCheckScreen({ navigation }: Props) {
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [email, setEmail] = useState('');
  const [jobPost, setJobPost] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleCheck = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('http://192.168.8.191:8000/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          website_url: website,
          email: email,
          job_post: jobPost,
        }),
      });
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      // Navigate to ResultScreen and pass raw API result for mapping
      navigation.navigate('EmployerResult', { result: data });
    } catch (e: any) {
      setError(e.message || 'Failed to check employer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Header />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>Employer Check</Text>
              </View>
              <Text style={styles.heroMini}>Fast, clear, and easy to read</Text>
            </View>
            <Text style={styles.title}>Check Employer Legitimacy</Text>
            <Text style={styles.subtitle}>
              Enter a company name and any details you have. The check will highlight registration, reputation, and website signals in plain language.
            </Text>
            <View style={styles.pillRow}>
              <View style={styles.pill}><Text style={styles.pillText}>Registration</Text></View>
              <View style={styles.pill}><Text style={styles.pillText}>Website signals</Text></View>
              <View style={styles.pill}><Text style={styles.pillText}>Reputation</Text></View>
            </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>Company Name <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="Enter company name"
              placeholderTextColor={PLACEHOLDER_GREY}
              value={companyName}
              onChangeText={setCompanyName}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Website URL</Text>
            <TextInput
              style={styles.input}
              placeholder="https://example.com"
              placeholderTextColor={PLACEHOLDER_GREY}
              value={website}
              onChangeText={setWebsite}
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="hr@example.com"
              placeholderTextColor={PLACEHOLDER_GREY}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.fieldLabel}>Job Post Text</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="Paste the job post text here"
              placeholderTextColor={PLACEHOLDER_GREY}
              value={jobPost}
              onChangeText={setJobPost}
              multiline
            />

            <TouchableOpacity
              style={[styles.button, !companyName || loading ? styles.buttonDisabled : null]}
              onPress={handleCheck}
              disabled={!companyName || loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color={BTN_TEXT} />
              ) : (
                <Text style={styles.buttonText}>Check Employer</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.helperText}>
              Tip: adding a website and email helps generate stronger evidence.
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>What you’ll get</Text>
            <View style={styles.infoItem}><Text style={styles.infoBullet}>✓</Text><Text style={styles.infoText}>A clear risk level with color highlighting</Text></View>
            <View style={styles.infoItem}><Text style={styles.infoBullet}>✓</Text><Text style={styles.infoText}>User-friendly evidence messages</Text></View>
            <View style={styles.infoItem}><Text style={styles.infoBullet}>✓</Text><Text style={styles.infoText}>Registration and reputation signals</Text></View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F5FA',
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#202871',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#202871',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 5,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  heroBadge: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroMini: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    fontFamily: 'Poppins_500Medium',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.86)',
    marginBottom: 14,
    fontFamily: 'Poppins_400Regular',
    lineHeight: 22,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E3E8F3',
    shadowColor: '#202871',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_ACCENT,
    marginBottom: 8,
    marginTop: 6,
    fontFamily: 'Poppins_500Medium',
  },
  required: {
    color: '#C62828',
  },
  multilineInput: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  input: {
    alignSelf: 'stretch',
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: '#D7DDEA',
    borderRadius: 14,
    backgroundColor: INPUT_FILL,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    color: TEXT_ACCENT,
    marginBottom: 8,
    fontFamily: 'Poppins_400Regular',
  },
  button: {
    alignSelf: 'stretch',
    backgroundColor: BTN_BG,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 10,
    shadowColor: '#202871',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    color: BTN_TEXT,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 0.2,
  },
  helperText: {
    color: '#7D879B',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Poppins_400Regular',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E3E8F3',
    marginBottom: 10,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_ACCENT,
    marginBottom: 10,
    fontFamily: 'Poppins_500Medium',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  infoBullet: {
    color: '#1B5E20',
    fontWeight: '900',
    marginRight: 8,
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    color: TEXT_ACCENT,
    fontFamily: 'Poppins_400Regular',
    lineHeight: 20,
  },
  error: {
    color: '#B00020',
    marginTop: 10,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
  resultCard: {
    backgroundColor: '#F7F8FE',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    marginBottom: 10,
    shadowColor: '#20287133',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_ACCENT,
    marginBottom: 12,
    fontFamily: 'Poppins_500Medium',
  },
  predictionBadge: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  legitBadge: {
    backgroundColor: '#E8F5E9',
    borderColor: '#1B5E20',
    borderWidth: 1,
  },
  fakeBadge: {
    backgroundColor: '#FFEBEE',
    borderColor: '#B00020',
    borderWidth: 1,
  },
  unknownBadge: {
    backgroundColor: '#F3E5F5',
    borderColor: '#6A1B9A',
    borderWidth: 1,
  },
  predictionText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_ACCENT,
    fontFamily: 'Poppins_500Medium',
  },
  probabilityText: {
    fontSize: 14,
    color: TEXT_ACCENT,
    marginTop: 4,
    fontFamily: 'Poppins_400Regular',
  },
  confidenceText: {
    fontSize: 14,
    color: TEXT_ACCENT,
    marginBottom: 8,
    fontFamily: 'Poppins_400Regular',
  },
  warningText: {
    fontSize: 13,
    color: '#D97706',
    fontStyle: 'italic',
    marginTop: 8,
    fontFamily: 'Poppins_400Regular',
  },
  evidenceCard: {
    backgroundColor: '#F7F8FE',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#20287133',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  evidenceTitle: {
    fontSize: 16,
    color: TEXT_ACCENT,
    fontWeight: 'bold',
    marginBottom: 10,
    fontFamily: 'Poppins_500Medium',
  },
  evidenceItemContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  evidenceBullet: {
    fontSize: 14,
    color: '#1B5E20',
    marginRight: 10,
    fontWeight: 'bold',
  },
  evidenceItem: {
    fontSize: 14,
    color: TEXT_ACCENT,
    flex: 1,
    fontFamily: 'Poppins_400Regular',
  },
  recommendationCard: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#1B5E20',
    marginBottom: 10,
  },
  recommendationTitle: {
    fontSize: 15,
    color: TEXT_ACCENT,
    fontWeight: 'bold',
    marginBottom: 6,
    fontFamily: 'Poppins_500Medium',
  },
  recommendationText: {
    fontSize: 13,
    color: TEXT_ACCENT,
    lineHeight: 18,
    fontFamily: 'Poppins_400Regular',
  },
});
