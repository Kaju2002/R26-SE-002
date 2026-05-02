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
            style={[styles.card, styles.messageCardBg]}
            onPress={() => navigation.navigate('MessageAnalyzer')}
            activeOpacity={0.7}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardTopRow}>
                <View style={[styles.iconContainer, styles.messageIconBg]}>
                  <MaterialCommunityIcons
                    name="shield-account-outline"
                    size={26}
                    color="#C62828"
                  />
                </View>
                <Text style={[styles.cardTag, styles.messageTag]}>Message Safety</Text>
                <MaterialCommunityIcons name="chevron-right" size={22} color="#9AA7BD" style={styles.cardArrow} />
              </View>
              <Text style={styles.cardTitle}>Check Recruiter Message</Text>
              <Text style={styles.cardSubtitle}>
                Detect psychological manipulation tactics in WhatsApp, Telegram or SMS messages from recruiters
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 2: Check Job Post */}
          <TouchableOpacity 
            style={[styles.card, styles.jobCardBg]}
            onPress={() => navigation.navigate('JobPost')}
            activeOpacity={0.7}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardTopRow}>
                <View style={[styles.iconContainer, styles.jobIconBg]}>
                  <MaterialCommunityIcons
                    name="clipboard-search-outline"
                    size={26}
                    color="#0D47A1"
                  />
                </View>
                <Text style={[styles.cardTag, styles.jobTag]}>Post Verification</Text>
                <MaterialCommunityIcons name="chevron-right" size={22} color="#9AA7BD" style={styles.cardArrow} />
              </View>
              <Text style={styles.cardTitle}>Check Job Advertisement</Text>
              <Text style={styles.cardSubtitle}>
                Detect fake job postings from LinkedIn, Indeed or other job platforms
              </Text>
            </View>
          </TouchableOpacity>

          {/* Card 3: Employer Legitimacy Check */}
          <TouchableOpacity
            style={[styles.card, styles.employerCardBg]}
            onPress={() => navigation.navigate('EmployerCheckScreen')}
            activeOpacity={0.7}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardTopRow}>
                <View style={[styles.iconContainer, styles.employerIconBg]}>
                  <MaterialCommunityIcons
                    name="domain"
                    size={26}
                    color="#1B5E20"
                  />
                </View>
                <Text style={[styles.cardTag, styles.employerTag]}>Employer Trust</Text>
                <MaterialCommunityIcons name="chevron-right" size={22} color="#9AA7BD" style={styles.cardArrow} />
              </View>
              <Text style={styles.cardTitle}>Check Employer Legitimacy</Text>
              <Text style={styles.cardSubtitle}>
                Verify if a company or recruiter is legitimate using domain, email, and LinkedIn checks
              </Text>
            </View>
          </TouchableOpacity>
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
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8EDF3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  messageCardBg: {
    backgroundColor: '#FFF6F6',
  },
  jobCardBg: {
    backgroundColor: '#F5F9FF',
  },
  employerCardBg: {
    backgroundColor: '#F4FBF5',
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'flex-start',
  },
  cardTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTag: {
    marginLeft: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  messageTag: {
    color: '#B71C1C',
    backgroundColor: '#FDECEC',
  },
  jobTag: {
    color: '#0D47A1',
    backgroundColor: '#EAF2FF',
  },
  employerTag: {
    color: '#1B5E20',
    backgroundColor: '#EAF6EC',
  },
  messageIconBg: {
    backgroundColor: '#FDECEC',
  },
  jobIconBg: {
    backgroundColor: '#EAF2FF',
  },
  employerIconBg: {
    backgroundColor: '#EAF6EC',
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
    paddingRight: 32,
  },
  cardArrow: {
    marginLeft: 'auto',
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
