
import React, { useState } from 'react';
import { StyleSheet, ScrollView, View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../components/Header';

const TEXT_ACCENT = '#202871';
const INPUT_BORDER = '#202871';
const INPUT_FILL = '#F4F6F9';
const PLACEHOLDER_GREY = '#9CA3AF';
const BTN_BG = '#202871';
const BTN_TEXT = '#FFFFFF';

export default function EmployerCheckScreen() {
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
      setResult(data);
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
          <Text style={styles.title}>Check Employer Legitimacy</Text>
          <Text style={styles.subtitle}>
            Enter company details to verify legitimacy. All fields are optional except Company Name.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Company Name *"
            placeholderTextColor={PLACEHOLDER_GREY}
            value={companyName}
            onChangeText={setCompanyName}
            autoCapitalize="words"
          />
          <TextInput
            style={styles.input}
            placeholder="Website URL (optional)"
            placeholderTextColor={PLACEHOLDER_GREY}
            value={website}
            onChangeText={setWebsite}
            autoCapitalize="none"
            keyboardType="url"
          />
          <TextInput
            style={styles.input}
            placeholder="Email (optional)"
            placeholderTextColor={PLACEHOLDER_GREY}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
            placeholder="Job Post Text (optional)"
            placeholderTextColor={PLACEHOLDER_GREY}
            value={jobPost}
            onChangeText={setJobPost}
            multiline
          />
          <TouchableOpacity
            style={[styles.button, !companyName || loading ? styles.buttonDisabled : null]}
            onPress={handleCheck}
            disabled={!companyName || loading}
          >
            {loading ? <ActivityIndicator color={BTN_TEXT} /> : <Text style={styles.buttonText}>Check Employer</Text>}
          </TouchableOpacity>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {result && (
            <View>
              {/* Main Prediction Result Card */}
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>Verification Result</Text>
                {result.prediction && (
                  <View style={[styles.predictionBadge, result.prediction === 'Legit' ? styles.legitBadge : result.prediction === 'Fake' ? styles.fakeBadge : styles.unknownBadge]}>
                    <Text style={styles.predictionText}>{result.prediction}</Text>
                    {result.probability !== undefined && (
                      <Text style={styles.probabilityText}>{(result.probability * 100).toFixed(1)}% confidence</Text>
                    )}
                  </View>
                )}
                {result.confidence && (
                  <Text style={styles.confidenceText}>Confidence Level: <Text style={{ fontWeight: 'bold' }}>{result.confidence}</Text></Text>
                )}
                {result.warning && (
                  <Text style={styles.warningText}>{result.warning}</Text>
                )}
              </View>
              {/* Evidence Card */}
              {result.evidence && Array.isArray(result.evidence) && result.evidence.length > 0 && (
                <View style={styles.evidenceCard}>
                  <Text style={styles.evidenceTitle}>Evidence Collected</Text>
                  {result.evidence.map((ev: string, idx: number) => (
                    <View key={idx} style={styles.evidenceItemContainer}>
                      <Text style={styles.evidenceBullet}>✓</Text>
                      <Text style={styles.evidenceItem}>{ev}</Text>
                    </View>
                  ))}
                </View>
              )}
              {/* Recommendation Card */}
              {result.recommendation && (
                <View style={styles.recommendationCard}>
                  <Text style={styles.recommendationTitle}>Recommendation</Text>
                  <Text style={styles.recommendationText}>{result.recommendation}</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: TEXT_ACCENT,
    marginBottom: 8,
    fontFamily: 'Poppins_500Medium',
  },
  subtitle: {
    fontSize: 16,
    color: '#798AA3',
    marginBottom: 18,
    fontFamily: 'Poppins_400Regular',
  },
  input: {
    alignSelf: 'stretch',
    minHeight: 48,
    borderWidth: 2,
    borderColor: INPUT_BORDER,
    borderRadius: 8,
    backgroundColor: INPUT_FILL,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
    fontSize: 14,
    color: TEXT_ACCENT,
    marginBottom: 10,
    fontFamily: 'Poppins_400Regular',
  },
  button: {
    alignSelf: 'stretch',
    backgroundColor: BTN_BG,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    color: BTN_TEXT,
    fontFamily: 'Poppins_500Medium',
    letterSpacing: 0.2,
  },
  error: {
    color: '#B00020',
    marginTop: 10,
    fontSize: 15,
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
