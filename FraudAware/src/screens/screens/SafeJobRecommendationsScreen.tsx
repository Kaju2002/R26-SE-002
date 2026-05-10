import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  fetchRecommendations,
  Recommendation,
} from '../../api/safeJobApi';

export default function SafeJobRecommendationsScreen() {
  const [jobs, setJobs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

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
        console.log(error);
      } finally {
        setLoading(false);
      }
    }

    loadRecommendations();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#202871" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.job_id.toString()}
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <Text style={styles.rank}>#{index + 1}</Text>

            <Text style={styles.title}>{item.job_title}</Text>

            <Text>
              Skill Match: {(item.relevance * 100).toFixed(1)}%
            </Text>

            <Text>
              Trust Score: {(item.trust_score * 100).toFixed(1)}%
            </Text>

            <Text>
              Overall Fit: {(item.overall_fit * 100).toFixed(1)}%
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FC',
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
  },
  rank: {
    fontSize: 16,
    fontWeight: '700',
    color: '#202871',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    color: '#202871',
  },
});