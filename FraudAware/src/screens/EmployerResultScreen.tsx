import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { DetectStackParamList } from '../navigation/detectStackTypes';

type Props = NativeStackScreenProps<DetectStackParamList, 'EmployerResult'>;

type TraceStep = {
  source?: string;
  status?: string;
  detail?: string;
};

const BRAND = '#202871';
const MUTED = '#6B7280';
const PAGE_BG = '#F3F5FA';
const CARD = '#FFFFFF';
const LINE = '#E3E8F3';

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
  const normalized = method.toLowerCase().trim();
  if (normalized === 'cse_api' || normalized === 'cse_listing') return 'Colombo Stock Exchange';
  if (normalized.includes('cse')) return 'Colombo Stock Exchange';
  if (normalized === 'cbsl_licence' || normalized.includes('cbsl')) return 'Central Bank of Sri Lanka';
  if (normalized === 'boi_listing' || normalized.includes('boi')) return 'Board of Investment';
  if (normalized === 'drc_record') return 'DRC / eROC';
  if (normalized === 'eroc_selenium' || normalized === 'eroc') return 'eROC (Registrar of Companies)';
  if (normalized === 'opencorporates') return 'OpenCorporates';
  if (normalized === 'known_entity' || normalized === 'registry_record') {
    return 'Official Sri Lanka registry';
  }
  if (normalized === 'slaasmb_sbe_list' || normalized.includes('slaasmb')) return 'SLAASMB SBE list';
  if (normalized === 'website_heuristics') return 'Website registration signals';
  if (normalized === 'ddgs_fallback') return 'Open web registry search';
  if (normalized.startsWith('official_registry_search')) {
    if (normalized.includes('cbsl')) return 'Central Bank of Sri Lanka';
    if (normalized.includes('cse')) return 'Colombo Stock Exchange';
    if (normalized.includes('boi')) return 'Board of Investment';
    if (normalized.includes('slaasmb')) return 'SLAASMB SBE list';
    return 'Official registry search';
  }
  return method.replace(/_/g, ' ');
};

/** Prefer real registry names; never show "known registered entity" to users. */
const checkedViaLabel = (
  sources: string[],
  method: string,
  governmentSource: string,
): string => {
  const fromSources = sources
    .map((s) => readableMethod(String(s)))
    .filter((label) => {
      const low = label.toLowerCase();
      return low && !low.includes('known registered');
    });
  // De-dupe while keeping order
  const seen = new Set<string>();
  const unique = fromSources.filter((l) => {
    if (seen.has(l)) return false;
    seen.add(l);
    return true;
  });
  if (unique.length) return unique.join(' · ');
  if (governmentSource) return governmentSource;
  if (method) {
    const parts = method.split('+').map((p) => readableMethod(p.trim())).filter(Boolean);
    const uniqParts = parts.filter((l, i) => parts.indexOf(l) === i);
    if (uniqParts.length) return uniqParts.join(' · ');
  }
  return '';
};

const statusHeadline = (risk: string, registrationStatus: string): string => {
  if (risk === 'low' && registrationStatus === 'registered') {
    return 'This employer looks trustworthy';
  }
  if (risk === 'high') {
    return 'Be careful with this employer';
  }
  return 'Verify a few details before you apply';
};

const statusDescription = (risk: string, registrationStatus: string): string => {
  if (risk === 'low' && registrationStatus === 'registered') {
    return 'Official registration and online checks look consistent with a legitimate employer.';
  }
  if (registrationStatus === 'unverified') {
    return 'A registration hint was found, but it is not fully confirmed yet.';
  }
  if (risk === 'high') {
    return 'Strong warning signs were found. Avoid sharing money or personal documents.';
  }
  return 'Some checks passed. Confirm the company through official channels before applying.';
};

const riskTheme = (risk: string) => {
  if (risk === 'high') {
    return {
      soft: '#FDECEA',
      strong: '#C62828',
      label: 'High risk',
      ring: '#F5C6C2',
    };
  }
  if (risk === 'medium') {
    return {
      soft: '#FFF7E0',
      strong: '#D97706',
      label: 'Medium risk',
      ring: '#F6E2B3',
    };
  }
  return {
    soft: '#E8F5E9',
    strong: '#1B5E20',
    label: 'Low risk',
    ring: '#B7DFB9',
  };
};

export default function EmployerResultScreen({ route, navigation }: Props) {
  const [showDetails, setShowDetails] = useState(false);
  const resultData = (route.params?.result ?? null) as Record<string, unknown> | null;

  if (!resultData) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No result yet</Text>
          <Text style={styles.emptySub}>Run an employer check to see a clear trust summary here.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryBtnText}>Back to check</Text>
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
  const registrationStatusLabel = String(
    resultData.registration_status_label ??
      evidence.registration_status_label ??
      (registrationStatus === 'registered'
        ? 'Officially registered'
        : registrationStatus === 'unverified'
          ? 'Unverified hint'
          : 'Not confirmed'),
  );
  const registrationSummary = String(
    resultData.registration_summary ??
      evidence.registration_summary ??
      (registrationStatus === 'registered'
        ? resultData.government_registration_source ??
          evidence.government_registration_source ??
          'Official Sri Lanka registration confirmed'
        : registrationStatus === 'unverified'
          ? 'Registration hint found, but official confirmation was not available'
          : 'No official Sri Lanka registration found'),
  );
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
  const theme = riskTheme(risk);
  const scoreRaw = resultData.legitimacy_score ?? resultData.risk_score ?? resultData.score ?? null;
  const score = scoreRaw === null || scoreRaw === undefined ? null : Number(scoreRaw);
  const confidenceLevel = String(resultData.confidence ?? '').toLowerCase();
  const registrationMethod = String(resultData.registration_method ?? '').trim();
  const registrationSource = String(
    resultData.government_registration_source ?? resultData.reg_source ?? '',
  ).trim();
  const registrationSources = toArray(
    resultData.registration_sources ?? evidence.registration_sources,
  );
  const regName = String(
    resultData.reg_name ?? evidence.reg_name ?? resultData.cse_registered_name ?? '',
  ).trim();
  const regNumber = String(resultData.reg_number ?? evidence.reg_number ?? '').trim();
  const opencorporatesUrl = String(
    resultData.opencorporates_url ?? evidence.opencorporates_url ?? '',
  ).trim();
  const slaasmbSbeName = String(
    resultData.slaasmb_sbe_name ?? evidence.slaasmb_sbe_name ?? '',
  ).trim();
  const cseSymbol = String(resultData.cse_symbol ?? '').trim();
  const cseRegisteredName = String(resultData.cse_registered_name ?? '').trim();
  const checkedVia = checkedViaLabel(registrationSources, registrationMethod, registrationSource);

  const scoreBreakdown = (resultData.score_breakdown ?? {}) as Record<string, unknown>;
  const scoreRows = [
    { label: 'AI model', hint: '40%', value: Number(scoreBreakdown.ml_score ?? 0), max: 40, color: '#3B5BDB' },
    { label: 'Registration', hint: '30%', value: Number(scoreBreakdown.registration_score ?? 0), max: 30, color: '#0F766E' },
    { label: 'Reputation', hint: '20%', value: Number(scoreBreakdown.reputation_score ?? 0), max: 20, color: '#7C3AED' },
    { label: 'Website', hint: '10%', value: Number(scoreBreakdown.website_score ?? 0), max: 10, color: '#2563EB' },
  ];

  const verdictText = String(resultData.verdict ?? '').trim() || 'Result unavailable';
  const riskLabel = risk ? titleize(risk) : 'Unknown';
  const confidenceLabel = confidenceLevel ? titleize(confidenceLevel) : 'N/A';

  const featureRules: Record<
    string,
    {
      positiveWhenOne?: string;
      negativeWhenOne?: string;
      positiveWhenZero?: string;
      negativeWhenZero?: string;
    }
  > = {
    has_https: { positiveWhenOne: 'Website uses HTTPS', negativeWhenZero: 'Website does not use HTTPS' },
    is_http_only: { negativeWhenOne: 'Website is HTTP-only', positiveWhenZero: 'Website is not HTTP-only' },
    has_about: { positiveWhenOne: 'About page found', negativeWhenZero: 'About page not found' },
    has_contact: { positiveWhenOne: 'Contact page found', negativeWhenZero: 'Contact page not found' },
    has_privacy_policy: { positiveWhenOne: 'Privacy Policy found', negativeWhenZero: 'Privacy Policy not found' },
    has_terms: { positiveWhenOne: 'Terms & Conditions found', negativeWhenZero: 'Terms & Conditions not found' },
    has_payment_risk: { negativeWhenOne: 'Payment-risk wording found', positiveWhenZero: 'No payment-risk wording' },
    has_urgency_language: { negativeWhenOne: 'Urgency language found', positiveWhenZero: 'No urgency language' },
    has_suspicious_tld: { negativeWhenOne: 'Suspicious domain pattern', positiveWhenZero: 'Domain looks normal' },
    scrape_failed: { negativeWhenOne: 'Website could not be fully scanned' },
    has_glassdoor: { positiveWhenOne: 'Found on Glassdoor', negativeWhenZero: 'No Glassdoor presence' },
    has_indeed: { positiveWhenOne: 'Found on Indeed', negativeWhenZero: 'No Indeed presence' },
    has_linkedin: { positiveWhenOne: 'LinkedIn presence found', negativeWhenZero: 'No LinkedIn presence' },
    has_topjobs_lk: { positiveWhenOne: 'Listed on TopJobs.lk', negativeWhenZero: 'No TopJobs.lk listing' },
    has_ft_lk: { positiveWhenOne: 'Mentioned in Daily FT', negativeWhenZero: 'No Daily FT mention' },
    has_trustpilot: { positiveWhenOne: 'Found on Trustpilot', negativeWhenZero: 'No Trustpilot presence' },
    has_sitejabber: { positiveWhenOne: 'Found on Sitejabber', negativeWhenZero: 'No Sitejabber presence' },
    has_ikman_lk: { positiveWhenOne: 'Found on ikman.lk', negativeWhenZero: 'No ikman.lk presence' },
    has_social_facebook: { positiveWhenOne: 'Facebook presence found', negativeWhenZero: 'No Facebook presence' },
    has_social_instagram: { positiveWhenOne: 'Instagram presence found', negativeWhenZero: 'No Instagram presence' },
    has_social_x: { positiveWhenOne: 'X / Twitter presence found', negativeWhenZero: 'No X / Twitter presence' },
    has_social_youtube: { positiveWhenOne: 'YouTube presence found', negativeWhenZero: 'No YouTube presence' },
    has_social_reddit: { positiveWhenOne: 'Reddit mentions found', negativeWhenZero: 'No Reddit mentions' },
    has_website_reviews: { positiveWhenOne: 'Reviews / testimonials found', negativeWhenZero: 'No reviews / testimonials found' },
    has_positive_reviews: { positiveWhenOne: 'Positive review signals found online' },
    has_negative_reviews: { negativeWhenOne: 'Negative review signals found online' },
    social_only_presence: { positiveWhenOne: 'Main public presence is social media' },
    has_scam_report: { negativeWhenOne: 'Scam reports found', positiveWhenZero: 'No scam reports found' },
  };

  const presenceKeys = new Set([
    'has_glassdoor',
    'has_indeed',
    'has_linkedin',
    'has_topjobs_lk',
    'has_ft_lk',
    'has_trustpilot',
    'has_sitejabber',
    'has_ikman_lk',
    'has_social_facebook',
    'has_social_instagram',
    'has_social_x',
    'has_social_youtube',
    'has_social_reddit',
    'has_website_reviews',
    'has_positive_reviews',
    'social_only_presence',
  ]);

  const friendlyPos: string[] = [];
  const friendlyNeg: string[] = [];
  const presencePos: string[] = [];
  const featureMap = (evidence.features ?? {}) as Record<string, { value?: number }>;
  // Fallback: API sometimes only puts social flags under features_used
  const featuresUsed = (resultData.features_used ?? {}) as Record<string, unknown>;
  const featureValue = (key: string): number | undefined => {
    const fromEvidence = featureMap[key]?.value;
    if (fromEvidence !== undefined && fromEvidence !== null) return Number(fromEvidence);
    const raw = featuresUsed[key];
    if (raw === undefined || raw === null || raw === '') return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  };

  Object.keys(featureRules).forEach((key) => {
    const value = featureValue(key);
    const rule = featureRules[key];
    if (!rule || value === undefined || value === null) return;

    if (value === 1 && rule.positiveWhenOne) {
      if (presenceKeys.has(key)) presencePos.push(rule.positiveWhenOne);
      else friendlyPos.push(rule.positiveWhenOne);
    }
    if (value === 1 && rule.negativeWhenOne) friendlyNeg.push(rule.negativeWhenOne);
    if (value === 0 && rule.positiveWhenZero) friendlyPos.push(rule.positiveWhenZero);
    // Don't spam "No Facebook" for every missing network — only show missing presence in details
    if (value === 0 && rule.negativeWhenZero && risk !== 'low' && !presenceKeys.has(key)) {
      friendlyNeg.push(rule.negativeWhenZero);
    }
    if (value === -1) {
      if (rule.positiveWhenOne) friendlyNeg.push(`Could not verify: ${rule.positiveWhenOne}`);
      else if (rule.negativeWhenOne) friendlyNeg.push(`Could not verify: ${rule.negativeWhenOne}`);
    }
  });

  toArray(evidence.reputation).forEach((item) => {
    if (/scam|negative review/i.test(item)) friendlyNeg.push(item);
    else if (/facebook|instagram|linkedin|youtube|twitter|reddit|trustpilot|glassdoor|indeed|topjobs|review|social/i.test(item)) {
      presencePos.push(item);
    } else {
      friendlyPos.push(item);
    }
  });

  toArray(evidence.website).forEach((item) => {
    if (/weak|could not|missing|limited/i.test(item)) friendlyNeg.push(item);
    else if (/social media/i.test(item)) presencePos.push(item);
    else friendlyPos.push(item);
  });

  if (registrationStatus === 'registered') {
    friendlyPos.unshift(`Official registration: ${registrationSummary}`);
  } else if (registrationStatus === 'unverified') {
    friendlyNeg.unshift(`Registration hint only: ${registrationSummary}`);
  } else if (risk !== 'low') {
    friendlyNeg.unshift(String(registrationSummary));
  }

  const presenceItems = Array.from(new Set(presencePos));
  const positiveItems = Array.from(new Set([...presenceItems, ...friendlyPos])).slice(0, 14);
  const negativeItems = Array.from(new Set(friendlyNeg)).slice(0, 10);
  // Keep social/review presence visible in the top summary
  const topPos = Array.from(new Set([...presenceItems.slice(0, 4), ...friendlyPos])).slice(0, 6);
  const topNeg = negativeItems.slice(0, 4);

  const actionableSteps: string[] = [];
  if (risk === 'low') {
    actionableSteps.push('Continue through official company email or website channels.');
    actionableSteps.push('Still avoid paying any fees before an interview.');
  } else {
    actionableSteps.push('Confirm the company on an official registry before sharing details.');
    actionableSteps.push('Verify the recruiter on the company website or LinkedIn.');
    actionableSteps.push('Do not pay upfront fees or share bank / OTP information.');
  }
  if (registrationStatus !== 'registered') {
    actionableSteps.push('Ask for a registration number and check it independently.');
  }

  const bandHint =
    score === null
      ? 'Bands: Low ≥ 70 · Medium 45–69 · High < 45'
      : score >= 70
        ? 'Score band: Low risk (70–100)'
        : score >= 45
          ? 'Score band: Medium risk (45–69)'
          : 'Score band: High risk (0–44)';

  const SignalList = ({ items, tone }: { items: string[]; tone: 'good' | 'bad' }) => (
    <View style={styles.signalList}>
      {items.map((item, index) => (
        <View key={`${tone}-${index}`} style={[styles.signalRow, tone === 'good' ? styles.signalGood : styles.signalBad]}>
          <Text style={tone === 'good' ? styles.signalMarkGood : styles.signalMarkBad}>
            {tone === 'good' ? '✓' : '!'}
          </Text>
          <Text style={styles.signalText}>{item}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <Text style={styles.backLink}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.topLabel}>Employer result</Text>
          <View style={{ width: 48 }} />
        </View>

        {/* Hero score */}
        <View style={[styles.hero, { backgroundColor: theme.soft, borderColor: theme.ring }]}>
          <View style={styles.heroTop}>
            <View style={[styles.riskPill, { backgroundColor: CARD }]}>
              <View style={[styles.riskDot, { backgroundColor: theme.strong }]} />
              <Text style={[styles.riskPillText, { color: theme.strong }]}>{theme.label}</Text>
            </View>
            <Text style={styles.heroChip}>{confidenceLabel} data confidence</Text>
          </View>

          <View style={styles.scoreRowHero}>
            <View style={[styles.scoreCircle, { borderColor: theme.strong }]}>
              <Text style={[styles.scoreNumber, { color: theme.strong }]}>
                {score === null || Number.isNaN(score) ? '—' : Math.round(score)}
              </Text>
              <Text style={styles.scoreOutOf}>/ 100</Text>
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>{statusHeadline(risk, registrationStatus)}</Text>
              <Text style={styles.heroBody}>{statusDescription(risk, registrationStatus)}</Text>
              <Text style={styles.heroVerdict}>{verdictText}</Text>
              <Text style={styles.bandHint}>{bandHint}</Text>
            </View>
          </View>
        </View>

        {/* Quick facts */}
        <View style={styles.factRow}>
          <View style={styles.factCard}>
            <Text style={styles.factLabel}>Trust score</Text>
            <Text style={[styles.factValue, { color: theme.strong }]}>
              {score === null || Number.isNaN(score) ? 'N/A' : Math.round(score)}
            </Text>
          </View>
          <View style={styles.factCard}>
            <Text style={styles.factLabel}>Risk</Text>
            <Text style={[styles.factValue, { color: theme.strong }]}>{riskLabel}</Text>
          </View>
          <View style={styles.factCard}>
            <Text style={styles.factLabel}>Registry</Text>
            <Text
              style={[
                styles.factValueSmall,
                {
                  color:
                    registrationStatus === 'registered'
                      ? '#1B5E20'
                      : registrationStatus === 'unverified'
                        ? '#D97706'
                        : '#C62828',
                },
              ]}
              numberOfLines={2}
            >
              {registrationStatusLabel}
            </Text>
          </View>
        </View>

        {/* Registration */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Official registration</Text>
          <View
            style={[
              styles.regBanner,
              registrationStatus === 'registered'
                ? styles.regOk
                : registrationStatus === 'unverified'
                  ? styles.regWarn
                  : styles.regBad,
            ]}
          >
            <Text
              style={[
                styles.regBannerText,
                registrationStatus === 'registered'
                  ? styles.regOkText
                  : registrationStatus === 'unverified'
                    ? styles.regWarnText
                    : styles.regBadText,
              ]}
            >
              {registrationSummary}
            </Text>
          </View>
          {registrationSource ? (
            <Text style={styles.metaLine}>Source: {registrationSource}</Text>
          ) : null}
          {checkedVia ? (
            <Text style={styles.metaLine}>Checked via: {checkedVia}</Text>
          ) : null}
          {regName ? <Text style={styles.metaLine}>Registered name: {regName}</Text> : null}
          {regNumber ? <Text style={styles.metaLine}>Reg. number: {regNumber}</Text> : null}
          {opencorporatesUrl ? (
            <Text style={styles.metaLine}>OpenCorporates: {opencorporatesUrl}</Text>
          ) : null}
          {slaasmbSbeName ? (
            <Text style={styles.metaLine}>SLAASMB SBE: {slaasmbSbeName}</Text>
          ) : null}
          {cseRegisteredName && cseRegisteredName !== regName ? (
            <Text style={styles.metaLine}>Listed as: {cseRegisteredName}</Text>
          ) : null}
          {cseSymbol ? <Text style={styles.metaLine}>CSE symbol: {cseSymbol}</Text> : null}
        </View>

        {/* Score breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How the score was built</Text>
          <Text style={styles.cardSub}>AI 40% · Registration 30% · Reputation 20% · Website 10%</Text>
          {scoreRows.map((row) => {
            const pct = Math.max(0, Math.min(100, (row.value / row.max) * 100));
            return (
              <View key={row.label} style={styles.barBlock}>
                <View style={styles.barTop}>
                  <Text style={styles.barLabel}>
                    {row.label} <Text style={styles.barHint}>({row.hint})</Text>
                  </Text>
                  <Text style={styles.barValue}>
                    {row.value.toFixed(0)}/{row.max}
                  </Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${pct}%`, backgroundColor: row.color }]} />
                </View>
              </View>
            );
          })}
        </View>

        {/* Why */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Why this result</Text>
          {presenceItems.length ? (
            <View style={{ marginBottom: 10 }}>
              <Text style={styles.groupLabel}>Social & online presence</Text>
              <SignalList items={presenceItems.slice(0, 8)} tone="good" />
            </View>
          ) : null}
          {topPos.length ? (
            <View style={{ marginBottom: 10 }}>
              <Text style={styles.groupLabel}>Positive signals</Text>
              <SignalList items={topPos} tone="good" />
            </View>
          ) : null}
          {topNeg.length ? (
            <View>
              <Text style={styles.groupLabel}>Watch-outs</Text>
              <SignalList items={topNeg} tone="bad" />
            </View>
          ) : null}
          {!presenceItems.length && !topPos.length && !topNeg.length ? (
            <Text style={styles.muted}>No strong signals were available for this check.</Text>
          ) : null}
          {confidenceReasons.length > 0 ? (
            <View style={styles.explainBox}>
              <Text style={styles.groupLabel}>Short explanation</Text>
              {confidenceReasons.slice(0, 3).map((item, index) => (
                <Text key={`${item}-${index}`} style={styles.explainText}>
                  • {item}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        {/* Recommendation + next steps */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>What you should do</Text>
          {resultData.recommendation ? (
            <Text style={styles.recommendLead}>{String(resultData.recommendation)}</Text>
          ) : null}
          {actionableSteps.map((step, index) => (
            <View key={`${step}-${index}`} style={styles.stepRow}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        {/* More details */}
        <Pressable style={styles.detailsToggle} onPress={() => setShowDetails((v) => !v)}>
          <Text style={styles.detailsToggleText}>
            {showDetails ? 'Hide technical details' : 'Show technical details'}
          </Text>
          <Text style={styles.detailsChevron}>{showDetails ? '▲' : '▼'}</Text>
        </Pressable>

        {showDetails ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Evidence & verification trace</Text>
            {presenceItems.length ? (
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.groupLabel}>Social & review presence</Text>
                <SignalList items={presenceItems} tone="good" />
              </View>
            ) : null}
            {positiveItems.length ? (
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.groupLabel}>All positive signals</Text>
                <SignalList items={positiveItems} tone="good" />
              </View>
            ) : null}
            {negativeItems.length ? (
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.groupLabel}>All risk signals</Text>
                <SignalList items={negativeItems} tone="bad" />
              </View>
            ) : null}
            {registrationNotes.map((item, index) => (
              <Text key={`note-${index}`} style={styles.metaLine}>
                Note: {item}
              </Text>
            ))}
            {registration.map((item, index) => (
              <Text key={`reg-${index}`} style={styles.metaLine}>
                • {item}
              </Text>
            ))}
            {registrationTrace.length > 0 ? (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.groupLabel}>Registry steps</Text>
                {registrationTrace.slice(0, 12).map((step, index) => (
                  <Text key={`trace-${index}`} style={styles.traceLine}>
                    {String(step.source ?? 'step')} · {String(step.status ?? '—')}
                    {step.detail ? ` — ${String(step.detail)}` : ''}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()} activeOpacity={0.9}>
          <Text style={styles.primaryBtnText}>Check another employer</Text>
        </TouchableOpacity>

        <View style={{ height: 28 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: PAGE_BG },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  backLink: { color: BRAND, fontWeight: '700', fontSize: 15, width: 64 },
  topLabel: { color: BRAND, fontWeight: '800', fontSize: 15 },

  hero: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  riskPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  riskDot: { width: 8, height: 8, borderRadius: 4 },
  riskPillText: { fontWeight: '800', fontSize: 12 },
  heroChip: { color: MUTED, fontSize: 12, fontWeight: '600' },
  scoreRowHero: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  scoreCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: { fontSize: 32, fontWeight: '900', lineHeight: 36 },
  scoreOutOf: { color: MUTED, fontSize: 12, fontWeight: '700', marginTop: -2 },
  heroCopy: { flex: 1 },
  heroTitle: { color: BRAND, fontSize: 18, fontWeight: '900', marginBottom: 4, lineHeight: 24 },
  heroBody: { color: '#334155', fontSize: 13, lineHeight: 19, marginBottom: 6 },
  heroVerdict: { color: BRAND, fontWeight: '700', fontSize: 13 },
  bandHint: { color: MUTED, fontSize: 11, marginTop: 6 },

  factRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  factCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: LINE,
    minHeight: 78,
  },
  factLabel: { color: MUTED, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  factValue: { color: BRAND, fontSize: 20, fontWeight: '900' },
  factValueSmall: { color: BRAND, fontSize: 13, fontWeight: '800', lineHeight: 18 },

  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: LINE,
  },
  cardTitle: { color: BRAND, fontSize: 15, fontWeight: '900', marginBottom: 4 },
  cardSub: { color: MUTED, fontSize: 12, marginBottom: 12 },

  regBanner: { borderRadius: 12, padding: 12, marginBottom: 8 },
  regOk: { backgroundColor: '#E8F5E9' },
  regWarn: { backgroundColor: '#FFF7E0' },
  regBad: { backgroundColor: '#FDECEA' },
  regBannerText: { fontWeight: '700', fontSize: 13, lineHeight: 19 },
  regOkText: { color: '#1B5E20' },
  regWarnText: { color: '#92400E' },
  regBadText: { color: '#9B1C1C' },
  metaLine: { color: MUTED, fontSize: 12, marginTop: 3 },

  barBlock: { marginBottom: 12 },
  barTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barLabel: { color: BRAND, fontWeight: '700', fontSize: 13 },
  barHint: { color: MUTED, fontWeight: '600' },
  barValue: { color: MUTED, fontWeight: '700', fontSize: 12 },
  track: { height: 10, backgroundColor: '#EEF2FF', borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },

  groupLabel: { color: BRAND, fontWeight: '800', fontSize: 12, marginBottom: 8 },
  signalList: { gap: 8 },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  signalGood: { backgroundColor: '#F0FDF4' },
  signalBad: { backgroundColor: '#FFF7ED' },
  signalMarkGood: { color: '#15803D', fontWeight: '900', marginRight: 8, marginTop: 1 },
  signalMarkBad: { color: '#C2410C', fontWeight: '900', marginRight: 8, marginTop: 1 },
  signalText: { color: '#1E293B', flex: 1, fontSize: 13, lineHeight: 18 },
  explainBox: {
    marginTop: 12,
    backgroundColor: '#F7F9FF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: LINE,
  },
  explainText: { color: BRAND, fontSize: 12, lineHeight: 18, marginTop: 4 },

  recommendLead: { color: '#1E293B', fontSize: 14, fontWeight: '700', marginBottom: 12, lineHeight: 20 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 10 },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: { color: BRAND, fontWeight: '800', fontSize: 12 },
  stepText: { color: '#334155', flex: 1, fontSize: 13, lineHeight: 19 },

  detailsToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  detailsToggleText: { color: BRAND, fontWeight: '800', fontSize: 13 },
  detailsChevron: { color: MUTED, fontSize: 12 },
  traceLine: { color: MUTED, fontSize: 11, lineHeight: 16, marginBottom: 4 },

  primaryBtn: {
    backgroundColor: BRAND,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  muted: { color: MUTED, fontSize: 13 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: BRAND },
  emptySub: { color: MUTED, marginTop: 8, textAlign: 'center', lineHeight: 20 },
});
