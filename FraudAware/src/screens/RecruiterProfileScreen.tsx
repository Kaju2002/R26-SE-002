import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
} from '@expo-google-fonts/poppins';
import LogoFallback from '../components/profile/LogoFallback';
import RecruiterPostedJobCard from '../components/recruiter/RecruiterPostedJobCard';
import ChatIcon from '../components/icons/ChatIcon';
import { getPublicRecruiterProfile } from '../api/recruiterApi';
import { getAppliedJobs, getJobById, getJobsByRecruiter } from '../api/jobApi';
import { useUser } from '../context/UserContext';
import { useInchat } from '../context/InchatContext';
import { navigateToInchatThread } from '../navigation/navigateToInchatThread';
import type { RootStackParamList } from '../navigation/rootStackParams';
import type { PublicRecruiterProfile } from '../types/recruiter';
import type { Job } from '../../data/jobs';
import { mapApiJobToJob, mapApiJobsToJobs } from '../utils/jobMapper';

const NAVY = '#202871';
const DEEP = '#42498A';
const MUTED = '#858BBD';
const BORDER = '#D6DAEA';
const CARD_BG = '#F7F8FE';
const VERIFIED = '#2E7DEB';

type RouteParams = RouteProp<RootStackParamList, 'RecruiterProfile'>;

function navigateToEmployerCheck(navigation: NavigationProp<RootStackParamList>) {
  navigation.navigate('MainTabs', {
    screen: 'Detect',
    params: { screen: 'EmployerCheckScreen' },
  } as never);
}

export default function RecruiterProfileScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteParams>();
  const { token } = useUser();
  const { startConversationFromApplication } = useInchat();
  const { recruiterId, jobId } = route.params;

  const [recruiter, setRecruiter] = useState<PublicRecruiterProfile | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJobsCount, setActiveJobsCount] = useState(0);
  const [contextJob, setContextJob] = useState<Job | undefined>();
  const [applicationId, setApplicationId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [startingChat, setStartingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });

  const loadProfile = useCallback(async () => {
    if (!token) {
      setError('Please sign in to view recruiter profiles.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [profileRes, jobsRes, jobRes, appliedRes] = await Promise.all([
        getPublicRecruiterProfile(recruiterId, token),
        getJobsByRecruiter(recruiterId, { status: 'active', limit: 20 }, token),
        jobId ? getJobById(jobId, token).catch(() => null) : Promise.resolve(null),
        jobId
          ? getAppliedJobs(token, { limit: 100 }).catch(() => null)
          : Promise.resolve(null),
      ]);

      setRecruiter(profileRes.recruiter);
      setJobs(mapApiJobsToJobs(jobsRes.jobs));
      setActiveJobsCount(jobsRes.pagination.total);
      if (jobRes?.job) {
        setContextJob(mapApiJobToJob(jobRes.job));
      } else {
        setContextJob(undefined);
      }
      const match = appliedRes?.applications.find((entry) => entry.jobId === jobId);
      setApplicationId(match?.id);
    } catch (err) {
      setRecruiter(null);
      setJobs([]);
      setContextJob(undefined);
      setApplicationId(undefined);
      setError(err instanceof Error ? err.message : 'Failed to load recruiter profile');
    } finally {
      setLoading(false);
    }
  }, [jobId, recruiterId, token]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const otherJobs = useMemo(() => {
    if (!jobId) return jobs;
    return jobs.filter((job) => job.id !== jobId);
  }, [jobId, jobs]);

  const onChatPress = useCallback(async () => {
    if (!applicationId) {
      Alert.alert(
        'Apply to message',
        'Message the recruiter after you apply to this job. Your chat is linked to your application.',
        [{ text: 'OK' }]
      );
      return;
    }
    if (startingChat) return;
    setStartingChat(true);
    try {
      const threadId = await startConversationFromApplication(applicationId);
      navigateToInchatThread(navigation, threadId);
    } catch (err) {
      Alert.alert(
        'Could not start chat',
        err instanceof Error ? err.message : 'Please try again.'
      );
    } finally {
      setStartingChat(false);
    }
  }, [applicationId, navigation, startConversationFromApplication, startingChat]);

  if (!fontsLoaded) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={NAVY} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={26} color={NAVY} />
        </Pressable>
        <Text style={styles.headerTitle}>Recruiter profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={NAVY} size="large" />
        </View>
      ) : error || !recruiter ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Recruiter not found.'}</Text>
          <Pressable
            onPress={() => void loadProfile()}
            style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              {recruiter.avatar ? (
                <Image source={{ uri: recruiter.avatar }} style={styles.heroAvatar} />
              ) : (
                <View
                  style={[
                    styles.heroAvatar,
                    styles.heroAvatarFallback,
                    { backgroundColor: recruiter.initialsFallback?.bg ?? '#EEF0F8' },
                  ]}
                >
                  <Text
                    style={[
                      styles.heroInitials,
                      { color: recruiter.initialsFallback?.color ?? NAVY },
                    ]}
                  >
                    {recruiter.initialsFallback?.text ?? '?'}
                  </Text>
                </View>
              )}

              <Text style={styles.heroName}>{recruiter.fullName}</Text>
              {recruiter.headline ? (
                <Text style={styles.heroHeadline}>{recruiter.headline}</Text>
              ) : null}

              {recruiter.company.name ? (
                <View style={styles.companyRow}>
                  <LogoFallback
                    source={
                      recruiter.company.logoUri
                        ? { uri: recruiter.company.logoUri }
                        : undefined
                    }
                    fallback={recruiter.company.fallback}
                    size={22}
                    borderRadius={6}
                  />
                  <Text style={styles.companyName}>{recruiter.company.name}</Text>
                  {recruiter.company.isVerified ? (
                    <Ionicons name="checkmark-circle" size={14} color={VERIFIED} />
                  ) : null}
                </View>
              ) : null}

              {recruiter.location ? (
                <Text style={styles.location}>
                  <Ionicons name="location-outline" size={13} color={MUTED} />
                  {'  '}
                  {recruiter.location}
                </Text>
              ) : null}

              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{activeJobsCount}</Text>
                  <Text style={styles.statLabel}>Active jobs</Text>
                </View>
                {recruiter.isVerified ? (
                  <View style={styles.statCard}>
                    <Ionicons name="shield-checkmark" size={18} color={VERIFIED} />
                    <Text style={styles.statLabel}>Verified</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {recruiter.summary ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About</Text>
                <Text style={styles.bodyText}>{recruiter.summary}</Text>
              </View>
            ) : null}

            {recruiter.company.name ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Company</Text>
                <View style={styles.infoCard}>
                  <View style={styles.companyHeader}>
                    <LogoFallback
                      source={
                        recruiter.company.logoUri
                          ? { uri: recruiter.company.logoUri }
                          : undefined
                      }
                      fallback={recruiter.company.fallback}
                      size={40}
                      borderRadius={10}
                    />
                    <Text style={styles.infoTitle}>{recruiter.company.name}</Text>
                  </View>
                  {contextJob?.about ? (
                    <Text style={styles.bodyText}>{contextJob.about}</Text>
                  ) : null}
                  {recruiter.company.website ? (
                    <Pressable
                      onPress={() => {
                        const url = recruiter.company.website ?? '';
                        Linking.openURL(url.startsWith('http') ? url : `https://${url}`);
                      }}
                      style={styles.linkRow}
                    >
                      <Ionicons name="globe-outline" size={16} color={NAVY} />
                      <Text style={styles.linkText}>{recruiter.company.website}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trust</Text>
              <View style={styles.infoCard}>
                {recruiter.company.isVerified ? (
                  <View style={styles.trustRow}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={VERIFIED} />
                    <Text style={styles.trustText}>Verified employer</Text>
                  </View>
                ) : (
                  <Text style={styles.bodyText}>
                    Always verify the employer independently before sharing personal or financial
                    details.
                  </Text>
                )}
                <Pressable
                  onPress={() => navigateToEmployerCheck(navigation)}
                  style={({ pressed }) => [styles.outlineBtn, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.outlineBtnText}>Check employer</Text>
                </Pressable>
              </View>
            </View>

            {(contextJob || otherJobs.length > 0) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Jobs</Text>
                <View style={styles.jobsList}>
                  {contextJob ? (
                    <RecruiterPostedJobCard
                      job={contextJob}
                      highlighted
                      onPress={() =>
                        navigation.navigate('JobDetails', { jobId: contextJob.id })
                      }
                    />
                  ) : null}
                  {otherJobs.map((job) => (
                    <RecruiterPostedJobCard
                      key={job.id}
                      job={job}
                      onPress={() => navigation.navigate('JobDetails', { jobId: job.id })}
                    />
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {!recruiter.isSelf && recruiter.allowMessages ? (
            <View style={styles.footer}>
              <Pressable
                onPress={() => void onChatPress()}
                disabled={startingChat}
                accessibilityRole="button"
                accessibilityLabel={`Chat with ${recruiter.fullName}`}
                style={({ pressed }) => [styles.chatBtn, pressed && { opacity: 0.9 }]}
              >
                <ChatIcon size={20} color="#FFFFFF" />
                <Text style={styles.chatBtnText}>
                  {startingChat
                    ? 'Opening…'
                    : `Chat with ${recruiter.fullName.split(' ')[0]}`}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 17,
    color: NAVY,
    marginRight: 44,
  },
  headerSpacer: {
    width: 0,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  errorText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: DEEP,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: NAVY,
  },
  retryText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: NAVY,
  },
  scroll: {
    flex: 1,
  },
  scrollInner: {
    paddingBottom: 120,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 8,
  },
  heroAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 4,
  },
  heroAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInitials: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 28,
  },
  heroName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 22,
    color: NAVY,
    textAlign: 'center',
  },
  heroHeadline: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  companyName: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: DEEP,
  },
  location: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: MUTED,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  statCard: {
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 4,
  },
  statValue: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: NAVY,
  },
  statLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: MUTED,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  sectionTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    color: DEEP,
  },
  bodyText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: DEEP,
    lineHeight: 22,
  },
  infoCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    backgroundColor: CARD_BG,
    padding: 14,
    gap: 10,
  },
  companyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoTitle: {
    flex: 1,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: NAVY,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkText: {
    flex: 1,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: NAVY,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trustText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: DEEP,
  },
  outlineBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: NAVY,
  },
  outlineBtnText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: NAVY,
  },
  jobsList: {
    gap: 10,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: NAVY,
    borderRadius: 14,
    paddingVertical: 14,
  },
  chatBtnText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
});
