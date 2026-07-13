import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import LogoFallback from '../components/profile/LogoFallback';
import JobTagChip from '../components/jobs/JobTagChip';
import { HeroRecruiterSlot } from '../components/jobs/JobPostedByRow';
import ChatIcon from '../components/icons/ChatIcon';
import {
  formatPostedAt,
  formatSalary,
  formatShortDate,
  type Job,
} from '../../data/jobs';
import { getJobById } from '../api/jobApi';
import { getPublicRecruiterProfile } from '../api/recruiterApi';
import { mapApiJobToJob } from '../utils/jobMapper';
import { useBookmarks } from '../context/BookmarksContext';
import { useUser } from '../context/UserContext';
import type { RootStackParamList } from '../navigation/rootStackParams';
import type { PublicRecruiterProfile } from '../types/recruiter';
import { canMessageRecruiter } from '../utils/recruiterHelpers';

const NAVY = '#202871';
const DEEP = '#42498A';
const MUTED = '#858BBD';
const BORDER = '#D6DAEA';
const CARD_BG = '#F7F8FE';
const PAGE_BG = '#FFFFFF';

type RouteParams = RootStackParamList;
type Tab = 'overview' | 'company';

export default function JobDetailsScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RouteParams, 'JobDetails'>>();
  const { token, user } = useUser();
  const jobId = route.params?.jobId;

  const [job, setJob] = useState<Job | undefined>();
  const [recruiter, setRecruiter] = useState<PublicRecruiterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recruiterLoading, setRecruiterLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const { isBookmarked, toggleBookmark } = useBookmarks();

  useEffect(() => {
    if (!jobId) {
      setJob(undefined);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const response = await getJobById(jobId, token);
        if (!cancelled) {
          setJob(mapApiJobToJob(response.job));
        }
      } catch {
        if (!cancelled) {
          setJob(undefined);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId, token]);

  useEffect(() => {
    if (!job?.postedBy || !token) {
      setRecruiter(null);
      return;
    }

    if (user?.id && job.postedBy === user.id) {
      setRecruiter(null);
      return;
    }

    let cancelled = false;
    setRecruiterLoading(true);

    (async () => {
      try {
        const response = await getPublicRecruiterProfile(job.postedBy!, token);
        if (!cancelled) {
          setRecruiter(response.recruiter);
        }
      } catch {
        if (!cancelled) {
          setRecruiter(null);
        }
      } finally {
        if (!cancelled) {
          setRecruiterLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [job?.postedBy, token, user?.id]);

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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <DetailHeader
          onBack={() => navigation.goBack()}
          isBookmarked={false}
          onBookmark={() => {}}
        />
        <View style={styles.empty}>
          <ActivityIndicator color={NAVY} size="large" />
        </View>
      </SafeAreaView>
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
    navigation.navigate('ApplyJob', { jobId: job.id });
  };

  const isOwnJob = Boolean(user?.id && job.postedBy && job.postedBy === user.id);
  const canChat = canMessageRecruiter(job.postedBy, user?.id);

  const openRecruiterProfile = () => {
    if (!job.postedBy) return;
    navigation.navigate('RecruiterProfile', {
      recruiterId: job.postedBy,
      jobId: job.id,
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <DetailHeader
        onBack={() => navigation.goBack()}
        isBookmarked={job ? isBookmarked(job.id) : false}
        onBookmark={() => {
          if (job) toggleBookmark(job.id);
        }}
      />
      <View style={styles.fixedTop}>
        <HeroCard
          job={job}
          isOwnJob={isOwnJob}
          recruiterLoading={recruiterLoading}
          recruiter={recruiter}
          showRecruiter={canChat}
          onRecruiterPress={openRecruiterProfile}
        />
        <Tabs active={tab} onChange={setTab} />
      </View>
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.contentScrollInner}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'overview' ? <OverviewSection job={job} /> : <CompanySection job={job} />}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Pressable
            onPress={() => toggleBookmark(job.id)}
            accessibilityRole="button"
            accessibilityLabel={
              isBookmarked(job.id) ? 'Unsave this job' : 'Save this job'
            }
            style={({ pressed }) => [
              styles.saveBtn,
              canChat && !isOwnJob && styles.saveBtnCompact,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.saveText}>
              {isBookmarked(job.id) ? 'Saved' : 'Save'}
            </Text>
          </Pressable>
          {canChat && !isOwnJob ? (
            <Pressable
              onPress={openRecruiterProfile}
              accessibilityRole="button"
              accessibilityLabel="Message recruiter"
              style={({ pressed }) => [
                styles.messageBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <ChatIcon size={20} color={NAVY} />
              <Text style={styles.messageText}>Message</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={handleApply}
            accessibilityRole="button"
            accessibilityLabel="Apply to this job"
            style={({ pressed }) => [
              styles.applyBtn,
              canChat && !isOwnJob && styles.applyBtnCompact,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.applyText}>Apply</Text>
          </Pressable>
        </View>
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

function HeroCard({
  job,
  isOwnJob,
  recruiterLoading,
  recruiter,
  showRecruiter,
  onRecruiterPress,
}: {
  job: Job;
  isOwnJob: boolean;
  recruiterLoading: boolean;
  recruiter: PublicRecruiterProfile | null;
  showRecruiter: boolean;
  onRecruiterPress: () => void;
}) {
  const postedLabel = job.postedAt ? formatPostedAt(job.postedAt) : '';
  const endsLabel = job.endsAt ? `Ends ${formatShortDate(job.endsAt)}` : '';
  const dateMeta = [postedLabel ? `Posted ${postedLabel}` : '', endsLabel]
    .filter(Boolean)
    .join(' · ');

  const showRecruiterSection =
    isOwnJob || recruiterLoading || (showRecruiter && Boolean(recruiter));

  return (
    <View style={styles.heroCard}>
      <View style={styles.heroTopRow}>
        <LogoFallback
          source={job.companyLogo}
          fallback={job.companyFallback}
          size={48}
          borderRadius={10}
        />

        <View style={styles.heroTitleCol}>
          <Text style={styles.heroTitle} numberOfLines={2}>
            {job.title}
          </Text>

          <View style={styles.heroCompanyRow}>
            <Text style={styles.heroCompany} numberOfLines={1}>
              {job.companyName}
            </Text>
            {job.isVerified ? (
              <Ionicons name="checkmark-circle" size={14} color="#2E7DEB" />
            ) : null}
          </View>

          <Text style={styles.heroMetaLine} numberOfLines={1}>
            <Ionicons name="location-outline" size={13} color={MUTED} />
            {'  '}
            {job.location}
            {'  ·  '}
            {formatSalary(job)}
          </Text>

          <View style={styles.heroTags}>
            <JobTagChip label={job.type} />
            <JobTagChip label={job.mode} />
          </View>
        </View>
      </View>

      {showRecruiterSection ? <View style={styles.heroDivider} /> : null}

      <HeroRecruiterSlot
        isOwnJob={isOwnJob}
        recruiterLoading={recruiterLoading}
        recruiter={recruiter}
        showRecruiter={showRecruiter}
        onRecruiterPress={onRecruiterPress}
      />

      {dateMeta ? (
        <Text
          style={[
            styles.heroDateMeta,
            !showRecruiterSection && styles.heroDateMetaTight,
          ]}
          numberOfLines={1}
        >
          {dateMeta}
        </Text>
      ) : null}
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

      {(job.requirements ?? job.skills) &&
        (job.requirements ?? job.skills)?.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.sectionTitle}>Requirements</Text>
          <View style={styles.skillsWrap}>
            {(job.requirements ?? job.skills)?.map((s) => (
              <JobTagChip key={s} label={s} />
            ))}
          </View>
        </View>
        )}

      {(job.benefits ?? job.perks) && (job.benefits ?? job.perks)?.length > 0 && (
        <View style={styles.block}>
          <Text style={styles.sectionTitle}>Benefits</Text>
          <BulletList items={(job.benefits ?? job.perks) as string[]} />
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
  fixedTop: {
    paddingHorizontal: 16,
  },
  contentScroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  contentScrollInner: {
    paddingBottom: 24,
  },
  /** ----- HERO CARD ----- */
  heroCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignSelf: 'stretch',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroTitleCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  /** Job title — Poppins SemiBold 16 · #202871 */
  heroTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: NAVY,
    lineHeight: 22,
  },
  heroCompanyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  /** Company — Poppins Regular 13 · #858BBD */
  heroCompany: {
    flexShrink: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: MUTED,
  },
  heroMetaLine: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: MUTED,
    lineHeight: 18,
  },
  heroDivider: {
    alignSelf: 'stretch',
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 8,
  },
  heroTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  heroDateMeta: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: MUTED,
    marginTop: 6,
  },
  heroDateMetaTight: {
    marginTop: 8,
  },
  /** ----- TABS ----- */
  tabsRow: {
    flexDirection: 'row',
    marginTop: 12,
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
  footerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  saveBtn: {
    flex: 0.42,
    borderWidth: 1,
    borderColor: NAVY,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  saveBtnCompact: {
    flex: 0.34,
  },
  saveText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    color: NAVY,
    letterSpacing: 0.2,
  },
  applyBtn: {
    flex: 0.58,
    backgroundColor: NAVY,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnCompact: {
    flex: 0.34,
  },
  messageBtn: {
    flex: 0.32,
    borderWidth: 1,
    borderColor: NAVY,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    gap: 6,
  },
  messageText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: NAVY,
  },
  /** Apply — Poppins Regular 16 · #FFFFFF */
  applyText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
