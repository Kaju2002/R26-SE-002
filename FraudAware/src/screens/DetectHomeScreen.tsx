import React from 'react';
import { StyleSheet, ScrollView, View, Text, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import type { DetectStackParamList } from '../navigation/detectStackTypes';

type Props = NativeStackScreenProps<DetectStackParamList, 'DetectHome'>;

export default function DetectHomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Header />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>Fraud Detector</Text>
          <Text style={styles.subtitle}>What do you want to check?</Text>
        </View>

        {/* Cards Container */}
        <View style={styles.cardsContainer}>
          {/* Card 1: Check Message */}
          <TouchableOpacity 
            style={styles.card}
            onPress={() => navigation.navigate('MessageAnalyzer')}
            activeOpacity={0.7}
          >
            <View style={[styles.cardBorder, styles.messageBorder]} />
            <View style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons 
                  name="message-alert" 
                  size={40} 
                  color="#E53935" 
                />
              </View>
              <Text style={styles.cardTitle}>Check Recruiter Message</Text>
              <Text style={styles.cardSubtitle}>
                Detect psychological manipulation tactics in WhatsApp, Telegram or SMS messages from recruiters
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 2: Check Job Post */}
          <TouchableOpacity 
            style={styles.card}
            onPress={() => navigation.navigate('JobPost')}
            activeOpacity={0.7}
          >
            <View style={[styles.cardBorder, styles.jobBorder]} />
            <View style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons 
                  name="briefcase-search" 
                  size={40} 
                  color="#1565C0" 
                />
              </View>
              <Text style={styles.cardTitle}>Check Job Advertisement</Text>
              <Text style={styles.cardSubtitle}>
                Detect fake job postings from LinkedIn, Indeed or other job platforms
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 3: Employer Legitimacy Check */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('EmployerCheckScreen')}
            activeOpacity={0.7}
          >
            <View style={[styles.cardBorder, styles.employerBorder]} />
            <View style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons
                  name="office-building"
                  size={40}
                  color="#2E7D32"
                />
              </View>
              <Text style={styles.cardTitle}>Check Employer Legitimacy</Text>
              <Text style={styles.cardSubtitle}>
                Verify if a company or recruiter is legitimate using domain, email, and LinkedIn checks
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.bannerText}>🛡️ Powered by AI — Results in under 2 seconds</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  titleSection: {
    marginBottom: 24,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#202871',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#798AA3',
    fontWeight: '500',
  },
  cardsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardBorder: {
    width: 4,
  },
  messageBorder: {
    backgroundColor: '#E53935',
  },
  jobBorder: {
    backgroundColor: '#1565C0',
  },
  employerBorder: {
    backgroundColor: '#2E7D32',
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'flex-start',
  },
  iconContainer: {
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#202871',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#798AA3',
    lineHeight: 18,
    fontWeight: '400',
  },
  infoBanner: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 'auto',
  },
  bannerText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
  },
});
