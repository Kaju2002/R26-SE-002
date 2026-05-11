import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
} from '@expo-google-fonts/poppins';
import PostJobChipSelect from './PostJobChipSelect';
import PostJobDetectHint from './PostJobDetectHint';
import PostJobLogoField from './PostJobLogoField';
import PostJobOverviewCompanyTabs, {
  type PostJobFormTab,
} from './PostJobOverviewCompanyTabs';
import PostJobSalaryFields from './PostJobSalaryFields';
import PostJobSectionCard from './PostJobSectionCard';
import PostJobTextField from './PostJobTextField';
import { JOB_MODE_OPTIONS, JOB_TYPE_OPTIONS } from './postJobOptions';
import { POST_JOB } from './postJobTheme';
import type { JobMode, JobType } from '../../../data/jobs';

const TAB_BAR_FALLBACK = 68;
const TAB_GAP = 14;
const FOOTER_EXTRA = 12;
const MIN_DESC = 15;

function parseSalaryPair(minStr: string, maxStr: string): {
  ok: boolean;
  message?: string;
  min?: number;
  max?: number;
} {
  const tMin = minStr.trim();
  const tMax = maxStr.trim();
  if (tMin === '' && tMax === '') return { ok: true };
  if (tMin === '' || tMax === '') {
    return { ok: false, message: 'Enter both minimum and maximum salary, or leave both empty.' };
  }
  const min = Number.parseInt(tMin, 10);
  const max = Number.parseInt(tMax, 10);
  if (Number.isNaN(min) || Number.isNaN(max) || min < 0 || max < 0) {
    return { ok: false, message: 'Salary must be valid numbers.' };
  }
  if (min > max) {
    return { ok: false, message: 'Minimum salary cannot be greater than maximum.' };
  }
  return { ok: true, min, max };
}

export default function PostJobForm() {
  const tabBarHeight = useBottomTabBarHeight();
  const bottomInset = tabBarHeight > 0 ? tabBarHeight : TAB_BAR_FALLBACK;

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });

  const [panelTab, setPanelTab] = useState<PostJobFormTab>('overview');

  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [location, setLocation] = useState('');
  const [jobType, setJobType] = useState<JobType>(JOB_TYPE_OPTIONS[0]);
  const [jobMode, setJobMode] = useState<JobMode>(JOB_MODE_OPTIONS[0]);
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [currency, setCurrency] = useState('GHS');
  const [salaryPeriod, setSalaryPeriod] = useState('monthly');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [skills, setSkills] = useState('');
  const [jobLevel, setJobLevel] = useState('');
  const [education, setEducation] = useState('');
  const [experience, setExperience] = useState('');
  const [benefitsLines, setBenefitsLines] = useState('');
  const [perksLines, setPerksLines] = useState('');
  const [about, setAbout] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [closingDate, setClosingDate] = useState('');

  const scrollBottomPad = useMemo(
    () => 24 + bottomInset + TAB_GAP + FOOTER_EXTRA + 56,
    [bottomInset]
  );

  const canSubmit = useMemo(() => {
    if (title.trim().length === 0) return false;
    if (companyName.trim().length === 0) return false;
    if (location.trim().length === 0) return false;
    if (description.trim().length < MIN_DESC) return false;
    const sal = parseSalaryPair(salaryMin, salaryMax);
    return sal.ok;
  }, [title, companyName, location, description, salaryMin, salaryMax]);

  const handleSubmit = () => {
    const sal = parseSalaryPair(salaryMin, salaryMax);
    if (!sal.ok) {
      Alert.alert('Check salary', sal.message ?? 'Invalid salary range.');
      return;
    }
    if (description.trim().length < MIN_DESC) {
      Alert.alert('Description', `Add at least ${MIN_DESC} characters describing the role.`);
      return;
    }

    Alert.alert(
      'Submitted for review',
      'Moderation will review your listing before it goes live. Employer verification and the Verified badge are handled by the platform—not on this form.',
      [{ text: 'OK' }]
    );
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={POST_JOB.navy} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.fixedTop}>
        <Text style={styles.screenTitle}>Post a job</Text>
        <Text style={styles.screenSubtitle}>
          Match the job detail layout: Overview holds the role; Company details holds logo & contact.
        </Text>
        <PostJobOverviewCompanyTabs active={panelTab} onChange={setPanelTab} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollInner, { paddingBottom: scrollBottomPad }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {panelTab === 'overview' ? (
          <>
            <PostJobSectionCard title="Job basics">
              <PostJobTextField
                label="Job title"
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Senior Operations Analyst"
              />
              <PostJobTextField
                label="Company name"
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="Employer name as it should appear on the listing"
              />
              <PostJobTextField
                label="Location"
                value={location}
                onChangeText={setLocation}
                placeholder="City or region"
              />
              <PostJobChipSelect
                label="Employment type"
                options={JOB_TYPE_OPTIONS}
                value={jobType}
                onChange={(v) => setJobType(v as JobType)}
              />
              <PostJobChipSelect
                label="Work arrangement"
                options={JOB_MODE_OPTIONS}
                value={jobMode}
                onChange={(v) => setJobMode(v as JobMode)}
              />
            </PostJobSectionCard>

            <PostJobSectionCard title="Compensation">
              <PostJobSalaryFields
                salaryMin={salaryMin}
                salaryMax={salaryMax}
                currency={currency}
                salaryPeriod={salaryPeriod}
                onSalaryMin={setSalaryMin}
                onSalaryMax={setSalaryMax}
                onCurrency={setCurrency}
                onSalaryPeriod={setSalaryPeriod}
              />
            </PostJobSectionCard>

            <PostJobSectionCard title="Role details">
              <PostJobTextField
                label="Job description"
                value={description}
                onChangeText={setDescription}
                placeholder="Responsibilities, schedule, how to apply"
                multiline
                minHeight={120}
              />
              <PostJobTextField
                label="Requirements (optional)"
                value={requirements}
                onChangeText={setRequirements}
                placeholder="Qualifications, certifications…"
                multiline
                minHeight={88}
              />
              <PostJobTextField
                label="Skills (optional)"
                value={skills}
                onChangeText={setSkills}
                placeholder="Comma-separated, e.g. Excel, SQL, Customer service"
              />
            </PostJobSectionCard>

            <PostJobSectionCard title="Job summary">
              <PostJobTextField
                label="Job level (optional)"
                value={jobLevel}
                onChangeText={setJobLevel}
                placeholder="e.g. Mid-level, Senior"
              />
              <PostJobTextField
                label="Education (optional)"
                value={education}
                onChangeText={setEducation}
                placeholder="e.g. Bachelor’s degree"
              />
              <PostJobTextField
                label="Experience (optional)"
                value={experience}
                onChangeText={setExperience}
                placeholder="e.g. 3+ years in operations"
              />
            </PostJobSectionCard>

            <PostJobSectionCard title="Benefits">
              <PostJobTextField
                label="Benefits (optional)"
                value={benefitsLines}
                onChangeText={setBenefitsLines}
                placeholder={'One benefit per line — same as bullet list on job detail'}
                multiline
                minHeight={96}
              />
              <PostJobTextField
                label="Perks (optional)"
                value={perksLines}
                onChangeText={setPerksLines}
                placeholder={'One perk per line'}
                multiline
                minHeight={88}
              />
            </PostJobSectionCard>
          </>
        ) : (
          <>
            <PostJobSectionCard title="Company branding">
              <PostJobLogoField imageUri={logoUri} onImageChange={setLogoUri} />
            </PostJobSectionCard>

            <PostJobSectionCard title="About & contact">
              <PostJobTextField
                label="About the company"
                value={about}
                onChangeText={setAbout}
                placeholder="Paragraph shown under Company details on the job page"
                multiline
                minHeight={100}
              />
              <PostJobTextField
                label="Application email"
                value={email}
                onChangeText={setEmail}
                placeholder="hr@company.com"
                keyboardType="email-address"
              />
              <PostJobTextField
                label="Phone"
                value={phone}
                onChangeText={setPhone}
                placeholder="+233 …"
                keyboardType="phone-pad"
              />
              <PostJobTextField
                label="Website"
                value={website}
                onChangeText={setWebsite}
                placeholder="https://"
                keyboardType="url"
              />
              <PostJobTextField
                label="Closing date (optional)"
                value={closingDate}
                onChangeText={setClosingDate}
                placeholder="e.g. 2026-06-30"
              />
            </PostJobSectionCard>
          </>
        )}

        <PostJobDetectHint />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomInset + FOOTER_EXTRA }]}>
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.submitBtn,
            !canSubmit && styles.submitBtnDisabled,
            pressed && canSubmit && { opacity: 0.92 },
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
        >
          <Text style={[styles.submitLabel, !canSubmit && styles.submitLabelDisabled]}>
            Submit for review
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: POST_JOB.pageBg,
  },
  fixedTop: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    backgroundColor: POST_JOB.pageBg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: POST_JOB.border,
  },
  scroll: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  screenTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 22,
    color: POST_JOB.navy,
    marginBottom: 6,
  },
  screenSubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: POST_JOB.muted,
    marginBottom: 4,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: POST_JOB.pageBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: POST_JOB.border,
  },
  submitBtn: {
    backgroundColor: POST_JOB.navy,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: POST_JOB.disabledBg,
  },
  submitLabel: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: POST_JOB.white,
  },
  submitLabelDisabled: {
    color: POST_JOB.disabledText,
  },
});
