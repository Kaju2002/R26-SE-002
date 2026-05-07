import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
} from '@expo-google-fonts/poppins';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import LogoFallback from '../components/profile/LogoFallback';
import JobTagChip from '../components/jobs/JobTagChip';
import {
  findJobById,
  formatLongDate,
  formatShortDate,
  formatSalary,
  type Job,
  type JobContact,
} from '../../data/jobs';

const NAVY = '#202871';
const DEEP = '#42498A';
const MUTED = '#858BBD';
const BORDER = '#D6DAEA';
const CARD_BG = '#F7F8FE';
const PAGE_BG = '#FFFFFF';

type RouteParams = { JobDetails: { jobId: string } };
type Tab = 'overview' | 'company';

export default function JobDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RouteParams, 'JobDetails'>>();
  const jobId = route.params?.jobId;
  const job = jobId ? findJobById(jobId) : undefined;

  const [tab, setTab] = useState<Tab>('overview');
  const [isBookmarked, setIsBookmarked] = useState(false);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={NAVY} size="large" />
      </View>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <DetailHeader
          onBack={() => navigation.goBack()}
          isBookmarked={false}
          onBookmark={() => {}}
        />
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Job not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleApply = () => {
    Alert.alert(
      'Apply to this job?',
      `${job.title} at ${job.companyName}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Apply', onPress: () => Alert.alert('Application sent.') },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <DetailHeader
        onBack={() => navigation.goBack()}
        isBookmarked={isBookmarked}
        onBookmark={() => setIsBookmarked((v) => !v)}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <HeroCard job={job} />
        <Tabs active={tab} onChange={setTab} />
        {tab === 'overview' ? (
          <OverviewSection job={job} />
        ) : (
          <CompanySection job={job} />
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={handleApply}
          accessibilityRole="button"
          accessibilityLabel="Apply to this job"
          style={({ pressed }) => [
            styles.applyBtn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.applyText}>Apply</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function DetailHeader({
  onBack,
  isBookmarked,
  onBookmark,
}: {
  onBack: () => void;
  isBookmarked: boolean;
  onBookmark: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={({ pressed }) => [
          styles.headerBtn,
          pressed && { opacity: 0.6 },
        ]}
      >
        <Ionicons name="chevron-back" size={26} color={NAVY} />
      </Pressable>

      <Pressable
        onPress={onBookmark}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={
          isBookmarked ? 'Remove bookmark' : 'Bookmark job'
        }
        style={({ pressed }) => [
          styles.headerBtn,
          pressed && { opacity: 0.6 },
        ]}
      >
        <Image
          source={require('../../assets/icons/Vector (1).png')}
          style={[
            styles.bookmarkIcon,
            isBookmarked && { tintColor: '#2E7DEB' },
          ]}
          resizeMode="contain"
        />
      </Pressable>
    </View>
  );
}

function HeroCard({ job }: { job: Job }) {
  return (
    <View style={styles.heroCard}>
      <View style={styles.heroLogoWrap}>
        <LogoFallback
          source={job.companyLogo}
          fallback={job.companyFallback}
          size={56}
          borderRadius={12}
        />
      </View>

      <Text style={styles.heroTitle} numberOfLines={2}>
        {job.title}
      </Text>
      <Text style={styles.heroCompany} numberOfLines={1}>
        {job.companyName}
      </Text>

      <View style={styles.heroDivider} />

      <Text style={styles.heroLocation}>{job.location}</Text>
      <Text style={styles.heroSalary}>{formatSalary(job)}</Text>

      <View style={styles.heroTags}>
        <JobTagChip label={job.type} />
        <JobTagChip label={job.mode} />
      </View>

      {(job.postedAt || job.endsAt) && (
        <Text style={styles.heroMeta}>
          {job.postedAt ? `Posted on ${formatLongDate(job.postedAt)}` : ''}
          {job.postedAt && job.endsAt ? '   |   ' : ''}
          {job.endsAt ? `Ends ${formatShortDate(job.endsAt)}` : ''}
        </Text>
      )}
    </View>
  );
}

function Tabs({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <View style={styles.tabsRow}>
      <TabButton
        label="Overview"
        active={active === 'overview'}
        onPress={() => onChange('overview')}
      />
      <TabButton
        label="Company Details"
        active={active === 'company'}
        onPress={() => onChange('company')}
      />
    </View>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={styles.tabBtn}
    >
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
        {label}
      </Text>
      <View
        style={[
          styles.tabUnderline,
          { backgroundColor: active ? DEEP : 'transparent' },
        ]}
      />
    </Pressable>
  );
}

function OverviewSection({ job }: { job: Job }) {
  return (
    <View style={styles.section}>
      {job.description && job.description.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.sectionTitle}>Job Description</Text>
          <BulletList items={job.description} />
        </View>
      )}

      {(job.jobLevel || job.education || job.experience) && (
        <View style={styles.block}>
          <Text style={styles.sectionTitle}>Job Summary</Text>
          <View style={styles.summaryGrid}>
            {job.jobLevel && (
              <SummaryRow label="Job Level" value={job.jobLevel} />
            )}
            {job.education && (
              <SummaryRow label="Education" value={job.education} />
            )}
            {job.experience && (
              <SummaryRow label="Experience" value={job.experience} />
            )}
          </View>
        </View>
      )}

      {job.skills && job.skills.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.sectionTitle}>Required Skills</Text>
          <View style={styles.skillsWrap}>
            {job.skills.map((s) => (
              <JobTagChip key={s} label={s} />
            ))}
          </View>
        </View>
      )}

      {job.perks && job.perks.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.sectionTitle}>Perks &amp; Benefits</Text>
          <BulletList items={job.perks} />
        </View>
      )}
    </View>
  );
}

function CompanySection({ job }: { job: Job }) {
  return (
    <View style={styles.section}>
      {job.about && (
        <View style={styles.block}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.bodyText}>{job.about}</Text>
        </View>
      )}

      {job.contact && (
        <View style={styles.block}>
          <Text style={styles.sectionTitle}>Contact Details</Text>
          <View style={styles.contactList}>
            {job.contact.location && (
              <ContactRow
                label="Location"
                value={job.contact.location}
              />
            )}
            {job.contact.email && (
              <ContactRow
                label="Email"
                value={job.contact.email}
                onPress={() =>
                  Linking.openURL(`mailto:${job.contact?.email}`)
                }
                external
              />
            )}
            {job.contact.phone && (
              <ContactRow
                label="Contact Number"
                value={job.contact.phone}
                onPress={() =>
                  Linking.openURL(`tel:${job.contact?.phone}`)
                }
              />
            )}
            {job.contact.website && (
              <ContactRow
                label="Website"
                value={job.contact.website}
                onPress={() => {
                  const url = job.contact?.website ?? '';
                  Linking.openURL(
                    url.startsWith('http') ? url : `https://${url}`
                  );
                }}
                external
              />
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View style={styles.bulletList}>
      {items.map((item, i) => (
        <View key={`${i}-${item.slice(0, 12)}`} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function ContactRow({
  label,
  value,
  onPress,
  external,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  external?: boolean;
}) {
  const Wrap = onPress ? Pressable : View;
  return (
    <View style={styles.contactRow}>
      <Text style={styles.contactLabel}>{label}</Text>
      <Wrap
        onPress={onPress}
        accessibilityRole={onPress ? 'link' : undefined}
        style={styles.contactValueRow}
      >
        <Text
          style={[
            styles.contactValue,
            onPress && styles.contactValueLink,
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
        {external && (
          <Ionicons
            name="open-outline"
            size={13}
            color={DEEP}
            style={styles.externalIcon}
          />
        )}
      </Wrap>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  splash: {
    flex: 1,
    backgroundColor: PAGE_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: MUTED,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookmarkIcon: {
    width: 22,
    height: 22,
    tintColor: NAVY,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  /** ----- HERO CARD ----- */
  heroCard: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 6,
  },
  heroLogoWrap: {
    marginBottom: 6,
  },
  /** Job title — Poppins Medium 16 · #202871 */
  heroTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    color: NAVY,
    textAlign: 'center',
  },
  /** Company — Poppins Regular 14 · #858BBD */
  heroCompany: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
  },
  heroDivider: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 10,
  },
  /** Location — Poppins Regular 14 */
  heroLocation: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
  },
  /** Salary — Poppins Medium 14 · #202871 */
  heroSalary: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: NAVY,
    textAlign: 'center',
    marginTop: 2,
  },
  heroTags: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  /** Posted/Ends — Poppins Regular 12 · #858BBD */
  heroMeta: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: MUTED,
    marginTop: 12,
    textAlign: 'center',
  },
  /** ----- TABS ----- */
  tabsRow: {
    flexDirection: 'row',
    marginTop: 18,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Tab — Poppins Regular 16 · #42498A */
  tabLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    color: MUTED,
  },
  tabLabelActive: {
    color: DEEP,
    fontFamily: 'Poppins_500Medium',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 24,
    right: 24,
    height: 2,
    borderRadius: 2,
  },
  /** ----- SECTIONS ----- */
  section: {
    paddingTop: 18,
    gap: 22,
  },
  block: {
    gap: 10,
  },
  /** Section title — Poppins Medium 16 · #42498A */
  sectionTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    color: DEEP,
  },
  /** Body text — Poppins Regular 14 · #42498A */
  bodyText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: DEEP,
    lineHeight: 22,
  },
  bulletList: {
    gap: 6,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  bulletDot: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    lineHeight: 22,
    color: DEEP,
    width: 10,
  },
  bulletText: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: DEEP,
    lineHeight: 22,
  },
  summaryGrid: {
    gap: 10,
  },
  summaryRow: {
    gap: 2,
  },
  /** Summary label — Poppins Regular 12 · #858BBD */
  summaryLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: MUTED,
  },
  /** Summary value — Poppins Regular 16 · #202871 */
  summaryValue: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    color: NAVY,
  },
  skillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  contactList: {
    gap: 14,
  },
  contactRow: {
    gap: 2,
  },
  /** Contact label — Poppins Regular 12 · #858BBD */
  contactLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: MUTED,
  },
  contactValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  /** Contact value — Poppins Regular 14 · #202871 */
  contactValue: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: NAVY,
  },
  contactValueLink: {
    color: DEEP,
    textDecorationLine: 'underline',
  },
  externalIcon: {
    marginTop: 1,
  },
  /** ----- FOOTER ----- */
  footer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: PAGE_BG,
  },
  applyBtn: {
    backgroundColor: NAVY,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Apply — Poppins Regular 16 · #FFFFFF */
  applyText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
