import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
} from '@expo-google-fonts/poppins';

import type { RootStackParamList } from '../../navigation/rootStackParams';

import {
  fetchRecommendations,
  Recommendation,
} from '../../api/safeJobApi';

const NAVY = '#202871';

export default function SafeJobRecommendationsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [jobs, setJobs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });

  useEffect(() => {
    async function loadRecommendations() {
      try {
        const data = await fetchRecommendations([
          'employee relations',
          'talent acquisition',
          'communication',
          'onboarding',
        ]);

        setJobs(data);
      } catch (error) {
        console.log('API ERROR:', error);
      } finally {
        setLoading(false);
      }
    }

    loadRecommendations();
  }, []);

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={NAVY} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.heading}>AI Safe Job Recommendations</Text>

        <Text style={styles.subHeading}>
          Fraud-aware personalized job matches
        </Text>
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.job_id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <View style={styles.rankRow}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>#{index + 1}</Text>
              </View>
            </View>

            <Text style={styles.title}>{item.job_title}</Text>

            <View style={styles.scoreContainer}>
              <View style={styles.scoreBox}>
                <Text style={styles.scoreLabel}>Skill Match</Text>
                <Text style={styles.scoreValue}>
                  {(item.relevance * 100).toFixed(1)}%
                </Text>
              </View>

              <View style={styles.scoreBox}>
                <Text style={styles.scoreLabel}>Trust Score</Text>
                <Text style={styles.scoreValue}>
                  {(item.trust_score * 100).toFixed(1)}%
                </Text>
              </View>

              <View style={styles.scoreBox}>
                <Text style={styles.scoreLabel}>Overall Fit</Text>
                <Text style={styles.scoreValue}>
                  {(item.overall_fit * 100).toFixed(1)}%
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Skills You Have</Text>

              <Text style={styles.skillText}>
                {item.skills_you_have.join(', ')}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Skills To Develop</Text>

              <Text style={styles.skillText}>
                {item.skills_to_develop.join(', ')}
              </Text>
            </View>
          </View>
        )}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Powered by Fraud-Aware AI Recommendation Engine
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FD',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },

  backButton: {
    marginBottom: 12,
  },

  backText: {
    fontFamily: 'Poppins_500Medium',
    color: NAVY,
    fontSize: 14,
  },

  heading: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 24,
    color: NAVY,
  },

  subHeading: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },

  listContent: {
    padding: 16,
    paddingBottom: 120,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 3,
  },

  rankRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 10,
  },

  rankBadge: {
    backgroundColor: '#EEF0FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },

  rankText: {
    fontFamily: 'Poppins_600SemiBold',
    color: NAVY,
    fontSize: 12,
  },

  title: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: NAVY,
    marginBottom: 16,
  },

  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },

  scoreBox: {
    flex: 1,
    backgroundColor: '#F7F8FC',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },

  scoreLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
    textAlign: 'center',
  },

  scoreValue: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: NAVY,
  },

  section: {
    marginTop: 18,
  },

  sectionTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: NAVY,
    marginBottom: 6,
  },

  skillText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 22,
  },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
  },

  footerText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#6B7280',
  },
});

