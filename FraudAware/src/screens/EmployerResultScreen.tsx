import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DetectStackParamList } from '../navigation/detectStackTypes';

type Props = NativeStackScreenProps<DetectStackParamList, 'EmployerResult'>;

export default function EmployerResultScreen({ route, navigation }: Props) {
  const resultData = (route.params?.result ?? null) as any;

  if (!resultData) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No result</Text>
          <Text style={styles.emptySub}>Run an employer check to see results here.</Text>
          <TouchableOpacity style={styles.goBack} onPress={() => navigation.goBack()}>
            <Text style={styles.goBackText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const evidence = (resultData.evidence ?? {}) as any;
  const registration = Array.isArray(evidence.registration) ? evidence.registration : [];
  const confidenceReasons = Array.isArray(evidence.confidence_reasons)
    ? evidence.confidence_reasons
    : Array.isArray(resultData.confidence_reasons)
      ? resultData.confidence_reasons
      : [];

  const risk = String(resultData.risk_level ?? '').toLowerCase();
  const score = resultData.legitimacy_score ?? resultData.risk_score ?? resultData.score ?? null;
  const badgeColor = risk === 'high' ? '#FDECEA' : risk === 'medium' ? '#FFF7E0' : '#E8F5E9';
  const badgeTextColor = risk === 'high' ? '#C62828' : risk === 'medium' ? '#FF8A00' : '#1B5E20';

  const featureRules: Record<string, { positiveWhenOne?: string; negativeWhenOne?: string; positiveWhenZero?: string; negativeWhenZero?: string }> = {
    has_https: { positiveWhenOne: 'Company website uses HTTPS', negativeWhenZero: 'Company website does not use HTTPS' },
    is_http_only: { negativeWhenOne: 'Company website is only available over HTTP', positiveWhenZero: 'Company website is not HTTP-only' },
    has_about: { positiveWhenOne: 'Company website has an About page', negativeWhenZero: 'Company website does not have an About page' },
    has_contact: { positiveWhenOne: 'Company website has a Contact page', negativeWhenZero: 'Company website does not have a Contact page' },
    has_privacy_policy: { positiveWhenOne: 'Company website has a Privacy Policy', negativeWhenZero: 'Company website does not have a Privacy Policy' },
    has_terms: { positiveWhenOne: 'Company website has Terms and Conditions', negativeWhenZero: 'Company website does not have Terms and Conditions' },
    has_payment_risk: { negativeWhenOne: 'Payment-risk indicators were found', positiveWhenZero: 'No payment-risk indicators found' },
    has_urgency_language: { negativeWhenOne: 'Urgency language was found', positiveWhenZero: 'No urgency language found' },
    has_suspicious_tld: { negativeWhenOne: 'Suspicious domain indicator found', positiveWhenZero: 'No suspicious domain indicator found' },
    scrape_failed: { negativeWhenOne: 'Website could not be fully scanned' },
    has_glassdoor: { positiveWhenOne: 'Company appears on Glassdoor', negativeWhenZero: 'No Glassdoor presence found' },
    has_indeed: { positiveWhenOne: 'Company appears on Indeed', negativeWhenZero: 'No Indeed presence found' },
    has_linkedin: { positiveWhenOne: 'Company has a LinkedIn presence', negativeWhenZero: 'No LinkedIn presence found' },
    has_topjobs_lk: { positiveWhenOne: 'Company is listed on TopJobs.lk', negativeWhenZero: 'No TopJobs.lk listing found' },
    has_ft_lk: { positiveWhenOne: 'Company was mentioned in Daily FT', negativeWhenZero: 'No Daily FT mention found' },
    has_trustpilot: { positiveWhenOne: 'Company appears on Trustpilot', negativeWhenZero: 'No Trustpilot presence found' },
    has_sitejabber: { positiveWhenOne: 'Company appears on Sitejabber', negativeWhenZero: 'No Sitejabber presence found' },
    has_social_facebook: { positiveWhenOne: 'Website links to Facebook', negativeWhenZero: 'No Facebook link found' },
    has_social_instagram: { positiveWhenOne: 'Website links to Instagram', negativeWhenZero: 'No Instagram link found' },
    has_social_x: { positiveWhenOne: 'Website links to X / Twitter', negativeWhenZero: 'No X / Twitter link found' },
    has_social_youtube: { positiveWhenOne: 'Website links to YouTube', negativeWhenZero: 'No YouTube link found' },
    has_social_reddit: { positiveWhenOne: 'Website links to Reddit', negativeWhenZero: 'No Reddit link found' },
    has_website_reviews: { positiveWhenOne: 'Website contains testimonials or reviews', negativeWhenZero: 'No testimonials or reviews found' },
    has_scam_report: { negativeWhenOne: 'Scam reports were found online', positiveWhenZero: 'No scam reports found' },
  };

  const friendlyPos: string[] = [];
  const friendlyNeg: string[] = [];
  const featureMap = (evidence.features ?? {}) as Record<string, { value?: number }>;

  Object.keys(featureMap).forEach((key) => {
    const value = featureMap[key]?.value;
    const rule = featureRules[key];
    if (!rule || value === undefined || value === null) return;

    if (value === 1 && rule.positiveWhenOne) friendlyPos.push(rule.positiveWhenOne);
    if (value === 1 && rule.negativeWhenOne) friendlyNeg.push(rule.negativeWhenOne);

    if (value === 0 && rule.positiveWhenZero) friendlyPos.push(rule.positiveWhenZero);
    if (value === 0 && rule.negativeWhenZero && risk !== 'low') friendlyNeg.push(rule.negativeWhenZero);
  });

  (evidence.reputation ?? []).forEach((item: string) => {
    if (!item) return;
    if (/scam/i.test(item)) friendlyNeg.push(item);
    else friendlyPos.push(item);
  });

  if (registration.length > 0) {
    friendlyPos.unshift(`Official registration found: ${registration.join('; ')}`);
  } else if (risk !== 'low') {
    friendlyNeg.unshift('No official Sri Lanka registration found');
  }

  const positiveItems = Array.from(new Set(friendlyPos)).slice(0, 10);
  const negativeItems = Array.from(new Set(friendlyNeg)).slice(0, 10);
  const topPos = positiveItems.slice(0, 5);
  const topNeg = negativeItems.slice(0, 5);

  const renderRows = (items: string[], variant: 'positive' | 'negative') =>
    items.map((item, index) => (
      <View key={`${variant}-${index}`} style={styles.checkRow}>
        <Text style={variant === 'positive' ? styles.checkIcon : styles.checkIconRed}>{variant === 'positive' ? '✓' : '✕'}</Text>
        <Text style={styles.checkText}>{item}</Text>
      </View>
    ));

  let topReasons: React.ReactNode = null;
  if (risk === 'low') {
    topReasons = <View>{topPos.length ? renderRows(topPos, 'positive') : <Text style={styles.muted}>No positive signals found.</Text>}</View>;
  } else if (risk === 'high') {
    const primary = topNeg[0] || confidenceReasons[0] || 'Negative signals detected';
    topReasons = (
      <View>
        <View style={styles.negativeMain}>
          <Text style={styles.negativeIcon}>✕</Text>
          <Text style={styles.negativeMainText}>{primary}</Text>
        </View>
        {topNeg.length > 1 ? <View style={{ marginTop: 8 }}>{renderRows(topNeg.slice(1), 'negative')}</View> : null}
      </View>
    );
  } else {
    topReasons = (
      <View>
        {topPos.length ? (
          <View style={{ marginBottom: 8 }}>
            <Text style={styles.smallTitle}>Positive signals</Text>
            {renderRows(topPos.slice(0, 3), 'positive')}
          </View>
        ) : null}
        {topNeg.length ? (
          <View>
            <Text style={styles.smallTitle}>Negative signals</Text>
            {renderRows(topNeg.slice(0, 3), 'negative')}
          </View>
        ) : null}
        {!topPos.length && !topNeg.length ? <Text style={styles.muted}>No clear signals available.</Text> : null}
      </View>
    );
  }

  const badgeLabel = `${String(resultData.risk_level ?? '').toUpperCase()}${score ? ` — ${score}%` : ''}`;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Employer Check Result</Text>
          <View style={styles.headerRow}>
            <View style={[styles.badge, { backgroundColor: badgeColor }]}>
              <Text style={[styles.badgeText, { color: badgeTextColor }]}>{badgeLabel}</Text>
            </View>
            <Text style={styles.sub}>{resultData.verdict}</Text>
          </View>
        </View>

        <View style={[styles.resultCard, { borderColor: badgeTextColor }]}> 
          <Text style={styles.resultTitle}>Verification Result</Text>
          <Text style={styles.resultVerdict}>{resultData.verdict}</Text>
          {score !== null && score !== undefined ? <Text style={styles.resultPercent}>{score}% confidence</Text> : null}
          <Text style={styles.confidenceLevel}>Confidence Level: <Text style={[styles.confidenceValue, { color: badgeTextColor }]}>{String(resultData.risk_level ?? '').toUpperCase()}</Text></Text>
        </View>

        {resultData.recommendation ? (
          <View style={styles.recommendBox}>
            <Text style={styles.recommendTitle}>Recommendation</Text>
            <Text style={styles.recommendText}>{resultData.recommendation}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top reasons</Text>
          {topReasons}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Evidence collected</Text>
          {positiveItems.length || negativeItems.length ? (
            <View>
              {renderRows(positiveItems, 'positive')}
              {negativeItems.length ? <View style={{ marginTop: 6 }}>{renderRows(negativeItems, 'negative')}</View> : null}
            </View>
          ) : (
            <Text style={styles.muted}>No evidence items collected.</Text>
          )}

          <View style={{ height: 8 }} />
          <Text style={styles.sectionTitle}>Registration</Text>
          {registration.length > 0 ? (
            <View style={styles.regBox}>
              {registration.map((item: string, index: number) => (
                <Text key={index} style={styles.regBoxText}>• {item}</Text>
              ))}
            </View>
          ) : (
            <Text style={styles.muted}>No official registration found</Text>
          )}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAFB' },
  scroll: { padding: 16 },
  header: { marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: '#202871' },
  sub: { color: '#6B7280', marginTop: 6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  badge: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, minWidth: 140, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontWeight: '800' },
  resultCard: { backgroundColor: '#F7FBF8', borderRadius: 12, padding: 18, marginBottom: 12, borderWidth: 2 },
  resultTitle: { color: '#202871', fontWeight: '800', marginBottom: 6 },
  resultVerdict: { fontSize: 26, fontWeight: '900', color: '#202871', marginBottom: 6 },
  resultPercent: { fontSize: 16, color: '#202871', marginBottom: 6 },
  confidenceLevel: { color: '#6B7280', marginTop: 2 },
  confidenceValue: { fontWeight: '800' },
  recommendBox: { backgroundColor: '#FFF9F0', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FFF1D6', marginBottom: 12 },
  recommendTitle: { fontWeight: '800', color: '#202871', marginBottom: 6 },
  recommendText: { color: '#6B7280' },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E6EAF4' },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#202871', marginBottom: 8 },
  muted: { color: '#6B7280' },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  checkIcon: { color: '#1B5E20', fontWeight: '800', marginRight: 8 },
  checkIconRed: { color: '#C62828', fontWeight: '800', marginRight: 8 },
  checkText: { color: '#202871', flex: 1 },
  negativeMain: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3F2', padding: 12, borderRadius: 8 },
  negativeIcon: { color: '#C62828', fontSize: 18, fontWeight: '900', marginRight: 8 },
  negativeMainText: { color: '#C62828', fontWeight: '800', flex: 1 },
  smallTitle: { fontSize: 12, fontWeight: '800', color: '#202871', marginBottom: 6 },
  regBox: { backgroundColor: '#E8F5E9', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#C8E6C9' },
  regBoxText: { color: '#1B5E20', fontWeight: '700' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#202871' },
  emptySub: { color: '#6B7280', marginTop: 8 },
  goBack: { marginTop: 14, backgroundColor: '#202871', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  goBackText: { color: '#fff', fontWeight: '700' },
});