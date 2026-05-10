import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DetectStackParamList } from '../navigation/detectStackTypes';

type Props = NativeStackScreenProps<DetectStackParamList, 'EmployerResult'>;

type TraceStep = {
  source?: string;
  status?: string;
  detail?: string;
};

const toArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
};

const titleize = (value: string): string => {
  if (!value) return value;
  return value
    .split(' ')
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}` : part))
    .join(' ');
};

const readableMethod = (method: string): string => {
  const normalized = method.toLowerCase();
  if (normalized === 'cse_api') return 'Colombo Stock Exchange API';
  if (normalized === 'cse_selenium') return 'Colombo Stock Exchange Directory';
  if (normalized === 'eroc') return 'eROC (Registrar of Companies)';
  if (normalized === 'opencorporates') return 'OpenCorporates Registry Data';
  if (normalized === 'website_heuristics') return 'Website Registration Signals';
  if (normalized === 'ddgs_fallback') return 'Open Web Registry Search';
  return method.replace(/_/g, ' ');
};

const statusHeadline = (risk: string, registrationStatus: string): string => {
  if (risk === 'low' && registrationStatus === 'registered') {
    return 'This employer looks trustworthy based on current checks.';
  }
  if (risk === 'high') {
    return 'This employer has multiple warning signals. Please be careful.';
  }
  return 'Some checks passed, but you should verify key details before applying.';
};

const statusDescription = (risk: string, registrationStatus: string): string => {
  if (risk === 'low' && registrationStatus === 'registered') {
    return 'Official registration signals and online checks align with a legitimate employer profile.';
  }
  if (registrationStatus === 'unverified') {
    return 'A registration hint was found, but there is no official confirmation yet.';
  }
  if (risk === 'high') {
    return 'No reliable registration proof and risk indicators were found during the scan.';
  }
  return 'Use caution and confirm registration and contacts through trusted sources.';
};

export default function EmployerResultScreen({ route, navigation }: Props) {
  const resultData = (route.params?.result ?? null) as Record<string, unknown> | null;

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

  const evidence = (resultData.evidence ?? {}) as Record<string, unknown>;
  const registration = toArray(evidence.registration);
  const registrationNotes = toArray(evidence.registration_notes);
  const registrationStatus = String(
    resultData.registration_status ?? evidence.registration_status ?? 'not_found',
  ).toLowerCase();
  const registrationStatusLabel =
    resultData.registration_status_label ??
    evidence.registration_status_label ??
    (registrationStatus === 'registered'
      ? 'Officially registered'
      : registrationStatus === 'unverified'
        ? 'Unverified registration hint'
        : 'Not confirmed');
  const registrationSummary =
    resultData.registration_summary ??
    evidence.registration_summary ??
    (registrationStatus === 'registered'
      ? resultData.government_registration_source ?? evidence.government_registration_source ?? 'Official Sri Lanka registration confirmed'
      : registrationStatus === 'unverified'
        ? 'Sri Lanka registration hint found, but official confirmation was not available'
        : 'No official Sri Lanka registration found');
  const registrationTraceRaw = Array.isArray(resultData.registration_trace)
    ? resultData.registration_trace
    : Array.isArray(evidence.registration_trace)
      ? evidence.registration_trace
      : [];
  const registrationTrace = registrationTraceRaw as TraceStep[];
  const confidenceReasons = toArray(evidence.confidence_reasons).length
    ? toArray(evidence.confidence_reasons)
    : toArray(resultData.confidence_reasons);

  const risk = String(resultData.risk_level ?? '').toLowerCase();
  const score = resultData.legitimacy_score ?? resultData.risk_score ?? resultData.score ?? null;
  const confidenceLevel = String(resultData.confidence ?? '').toLowerCase();
  const registrationMethod = String(resultData.registration_method ?? '').trim();
  const registrationSource = String(resultData.government_registration_source ?? resultData.reg_source ?? '').trim();
  const cseSymbol = String(resultData.cse_symbol ?? '').trim();
  const cseRegisteredName = String(resultData.cse_registered_name ?? '').trim();
  const scoreBreakdown = (resultData.score_breakdown ?? {}) as Record<string, unknown>;
  const scoreRows = [
    { label: 'Model score', value: Number(scoreBreakdown.ml_score ?? 0), max: 40 },
    { label: 'Registration score', value: Number(scoreBreakdown.registration_score ?? 0), max: 30 },
    { label: 'Reputation score', value: Number(scoreBreakdown.reputation_score ?? 0), max: 20 },
    { label: 'Website score', value: Number(scoreBreakdown.website_score ?? 0), max: 10 },
  ];

  const verdictText = String(resultData.verdict ?? '').trim() || 'Result unavailable';
  const riskLabel = risk ? titleize(risk) : 'Unknown';
  const confidenceLabel = confidenceLevel ? titleize(confidenceLevel) : 'N/A';

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
    // Handle unknown / could-not-scan states (represented as -1)
    if (value === -1) {
      if (rule.negativeWhenOne) {
        // prefer existing negative phrasing when unknown
        friendlyNeg.push(`Unable to determine: ${rule.negativeWhenOne}`);
      } else if (rule.positiveWhenOne) {
        friendlyNeg.push(`Unable to determine: ${rule.positiveWhenOne}`);
      } else {
        const label = rule.positiveWhenOne || rule.negativeWhenZero || key;
        friendlyNeg.push(`Unable to determine: ${titleize(String(label))}`);
      }
    }
  });

  (evidence.reputation ?? []).forEach((item: string) => {
    if (!item) return;
    if (/scam/i.test(item)) friendlyNeg.push(item);
    else friendlyPos.push(item);
  });

  if (registrationStatus === 'registered') {
    friendlyPos.unshift(`Official registration found: ${registrationSummary}`);
  } else if (registrationStatus === 'unverified') {
    friendlyNeg.unshift(`Registration hint only: ${registrationSummary}`);
  } else if (risk !== 'low') {
    friendlyNeg.unshift(registrationSummary);
  }

  const positiveItems = Array.from(new Set(friendlyPos)).slice(0, 10);
  const negativeItems = Array.from(new Set(friendlyNeg)).slice(0, 10);
  const topPos = positiveItems.slice(0, 5);
  const topNeg = negativeItems.slice(0, 5);

  const actionableSteps: string[] = [];
  if (risk === 'low') {
    actionableSteps.push('Proceed, but continue communication through official company channels.');
  } else {
    actionableSteps.push('Verify the company through an official registry before sharing personal details.');
    actionableSteps.push('Confirm recruiter identity using a verified company website or LinkedIn page.');
  }
  if (risk !== 'low') {
    actionableSteps.push('Do not pay upfront fees or share financial account details.');
  }
  if (registrationStatus !== 'registered') {
    actionableSteps.push('Ask for a registration number and validate it independently.');
  }

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

  const badgeLabel = `${riskLabel.toUpperCase()}${score ? ` - ${score}%` : ''}`;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Employer Check Result</Text>
          <View style={styles.headerRow}>
            <View style={[styles.badge, { backgroundColor: badgeColor }]}>
              <Text style={[styles.badgeText, { color: badgeTextColor }]}>{badgeLabel}</Text>
            </View>
            <Text style={styles.sub}>{verdictText}</Text>
          </View>
        </View>

        <View style={[styles.resultCard, { borderColor: badgeTextColor }]}>
          <Text style={styles.resultTitle}>Quick Summary</Text>
          <Text style={styles.resultVerdict}>{statusHeadline(risk, registrationStatus)}</Text>
          <Text style={styles.resultBody}>{statusDescription(risk, registrationStatus)}</Text>
          {score !== null && score !== undefined ? <Text style={styles.resultPercent}>{score}% confidence</Text> : null}
          <Text style={styles.confidenceLevel}>
            Risk level: <Text style={[styles.confidenceValue, { color: badgeTextColor }]}>{riskLabel.toUpperCase()}</Text>
          </Text>
          <Text style={styles.confidenceLevel}>Data confidence: <Text style={styles.confidenceValue}>{confidenceLabel}</Text></Text>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.sectionTitle}>Official registration check</Text>
          <View style={[styles.statusPill, registrationStatus === 'registered' ? styles.statusPillGreen : registrationStatus === 'unverified' ? styles.statusPillAmber : styles.statusPillRed]}>
            <Text style={[styles.statusPillText, registrationStatus === 'registered' ? styles.statusPillTextGreen : registrationStatus === 'unverified' ? styles.statusPillTextAmber : styles.statusPillTextRed]}>
              {registrationStatusLabel.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.statusSummary}>{registrationSummary}</Text>
          {registrationSource ? <Text style={styles.statusSource}>Registry source: {registrationSource}</Text> : null}
          {registrationMethod ? <Text style={styles.statusSource}>Verification method: {readableMethod(registrationMethod)}</Text> : null}
          {cseSymbol ? <Text style={styles.statusSource}>CSE symbol: {cseSymbol}</Text> : null}
          {cseRegisteredName ? <Text style={styles.statusSource}>Registered name: {cseRegisteredName}</Text> : null}
        </View>

        {resultData.recommendation ? (
          <View style={styles.recommendBox}>
            <Text style={styles.recommendTitle}>Recommendation</Text>
            <Text style={styles.recommendText}>{resultData.recommendation}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top reasons behind this result</Text>
          {topReasons}
          {confidenceReasons.length > 0 ? (
            <View style={styles.reasonBlock}>
              <Text style={styles.smallTitle}>Model explanation</Text>
              {confidenceReasons.slice(0, 3).map((item, index) => (
                <Text key={`${item}-${index}`} style={styles.reasonText}>• {item}</Text>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How the score was calculated</Text>
          {scoreRows.map((row) => (
            <View key={row.label} style={styles.scoreRow}>
              <View style={styles.scoreRowTop}>
                <Text style={styles.scoreLabel}>{row.label}</Text>
                <Text style={styles.scoreValue}>{row.value.toFixed(1)} / {row.max}</Text>
              </View>
              <View style={styles.scoreTrack}>
                <View
                  style={[
                    styles.scoreFill,
                    {
                      width: `${Math.max(0, Math.min(100, (row.value / row.max) * 100))}%`,
                      backgroundColor: badgeTextColor,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Evidence collected</Text>
          {positiveItems.length ? (
            <View>
              <Text style={styles.smallTitle}>Positive signals</Text>
              {renderRows(positiveItems, 'positive')}
            </View>
          ) : null}
          {negativeItems.length ? (
            <View style={{ marginTop: 6 }}>
              <Text style={styles.smallTitle}>Risk signals</Text>
              {renderRows(negativeItems, 'negative')}
            </View>
          ) : null}
          {!positiveItems.length && !negativeItems.length ? (
            <Text style={styles.muted}>No evidence items collected.</Text>
          ) : null}

          <View style={{ height: 8 }} />
          <Text style={styles.sectionTitle}>Registration details</Text>
          <View style={styles.regBox}>
            <Text style={styles.regBoxTitle}>{registrationStatusLabel}</Text>
            <Text style={styles.regBoxText}>{registrationSummary}</Text>
            {registrationNotes.length > 0 ? (
              <View style={{ marginTop: 8 }}>
                {registrationNotes.map((item, index) => (
                  <Text key={index} style={styles.regNoteText}>• {item}</Text>
                ))}
              </View>
            ) : null}
            {registration.length > 0 ? (
              <View style={{ marginTop: 8 }}>
                {registration.map((item, index) => (
                  <Text key={index} style={styles.regTraceText}>• {item}</Text>
                ))}
              </View>
            ) : null}
            {registrationTrace.length > 0 ? (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.regTraceTitle}>Verification trace</Text>
                {registrationTrace.map((step, index) => (
                  <Text key={index} style={styles.regTraceText}>
                    • {String(step.source ?? 'step')} - {String(step.status ?? 'unknown')}: {String(step.detail ?? '')}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What to do next</Text>
          {actionableSteps.map((step, index) => (
            <Text key={`${step}-${index}`} style={styles.nextStepText}>• {step}</Text>
          ))}
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
  resultVerdict: { fontSize: 20, fontWeight: '900', color: '#202871', marginBottom: 6, lineHeight: 28 },
  resultBody: { color: '#202871', opacity: 0.85, marginBottom: 6 },
  resultPercent: { fontSize: 16, color: '#202871', marginBottom: 6 },
  confidenceLevel: { color: '#6B7280', marginTop: 2 },
  confidenceValue: { fontWeight: '800' },
  recommendBox: { backgroundColor: '#FFF9F0', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FFF1D6', marginBottom: 12 },
  recommendTitle: { fontWeight: '800', color: '#202871', marginBottom: 6 },
  recommendText: { color: '#6B7280' },
  section: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E6EAF4' },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#202871', marginBottom: 8 },
  muted: { color: '#6B7280' },
  statusCard: { backgroundColor: '#F7FBF8', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E6EAF4' },
  statusPill: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 999, marginBottom: 8 },
  statusPillGreen: { backgroundColor: '#E8F5E9' },
  statusPillAmber: { backgroundColor: '#FFF3E0' },
  statusPillRed: { backgroundColor: '#FDECEA' },
  statusPillText: { fontSize: 12, fontWeight: '800' },
  statusPillTextGreen: { color: '#1B5E20' },
  statusPillTextAmber: { color: '#FF8A00' },
  statusPillTextRed: { color: '#C62828' },
  statusSummary: { color: '#202871', fontWeight: '700', marginBottom: 4 },
  statusSource: { color: '#6B7280', fontSize: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  checkIcon: { color: '#1B5E20', fontWeight: '800', marginRight: 8 },
  checkIconRed: { color: '#C62828', fontWeight: '800', marginRight: 8 },
  checkText: { color: '#202871', flex: 1 },
  negativeMain: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3F2', padding: 12, borderRadius: 8 },
  negativeIcon: { color: '#C62828', fontSize: 18, fontWeight: '900', marginRight: 8 },
  negativeMainText: { color: '#C62828', fontWeight: '800', flex: 1 },
  reasonBlock: { marginTop: 10, backgroundColor: '#F7F9FF', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#E6EAF4' },
  reasonText: { color: '#202871', marginTop: 4 },
  scoreRow: { marginTop: 10 },
  scoreRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  scoreLabel: { color: '#202871', fontWeight: '700' },
  scoreValue: { color: '#6B7280', fontWeight: '700' },
  scoreTrack: { height: 8, backgroundColor: '#E6EAF4', borderRadius: 999, overflow: 'hidden' },
  scoreFill: { height: '100%', borderRadius: 999 },
  smallTitle: { fontSize: 12, fontWeight: '800', color: '#202871', marginBottom: 6 },
  regBox: { backgroundColor: '#E8F5E9', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#C8E6C9' },
  regBoxTitle: { color: '#1B5E20', fontWeight: '900', marginBottom: 4 },
  regBoxText: { color: '#1B5E20', fontWeight: '700' },
  regNoteText: { color: '#6B7280', marginTop: 4 },
  regTraceTitle: { color: '#202871', fontWeight: '800', marginBottom: 4 },
  regTraceText: { color: '#1B5E20', marginTop: 4 },
  nextStepText: { color: '#202871', marginTop: 6 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#202871' },
  emptySub: { color: '#6B7280', marginTop: 8 },
  goBack: { marginTop: 14, backgroundColor: '#202871', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  goBackText: { color: '#fff', fontWeight: '700' },
});