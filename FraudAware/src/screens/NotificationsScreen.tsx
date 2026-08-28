import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
} from '@expo-google-fonts/poppins';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/rootStackParams';
import NotificationsHeader from '../components/notification/NotificationsHeader';
import NotificationsTabs, {
  type NotificationTabId,
} from '../components/notification/NotificationsTabs';
import NotificationsList from '../components/notification/NotificationsList';
import ApplicationsNotificationsList from '../components/notification/ApplicationsNotificationsList';
import type { AppNotification } from '../../data/notifications';
import type { ApplicationListItem } from '../../data/applicationNotifications';
import {
  clearNotifications,
  deleteNotification,
  listNotifications,
} from '../api/notificationApi';
import {
  mapApiNotificationsToApplicationItems,
  mapApiNotificationsToGeneralItems,
} from '../utils/notificationMapper';
import { useUser } from '../context/UserContext';
import { useNotificationsUnread } from '../context/NotificationsUnreadContext';
import { navigateToInchatThread } from '../navigation/navigateToInchatThread';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const NAVY = '#202871';

export default function NotificationsScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Notifications'>>();
  const { token } = useUser();
  const { markAllReadAndClearBadge } = useNotificationsUnread();

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
  });

  const [activeTab, setActiveTab] = useState<NotificationTabId>('general');
  const [generalItems, setGeneralItems] = useState<AppNotification[]>([]);
  const [applicationItems, setApplicationItems] = useState<ApplicationListItem[]>([]);
  const [generalLoading, setGeneralLoading] = useState(false);
  const [applicationsLoading, setApplicationsLoading] = useState(false);

  const loadGeneralNotifications = useCallback(async () => {
    if (!token) {
      setGeneralItems([]);
      setGeneralLoading(false);
      return;
    }

    setGeneralLoading(true);
    try {
      const response = await listNotifications(token, {
        category: 'general',
        limit: 50,
      });
      setGeneralItems(mapApiNotificationsToGeneralItems(response.notifications));
    } catch {
      setGeneralItems([]);
    } finally {
      setGeneralLoading(false);
    }
  }, [token]);

  const loadApplications = useCallback(async () => {
    if (!token) {
      setApplicationItems([]);
      setApplicationsLoading(false);
      return;
    }

    setApplicationsLoading(true);
    try {
      const response = await listNotifications(token, {
        category: 'applications',
        limit: 50,
      });
      setApplicationItems(
        mapApiNotificationsToApplicationItems(response.notifications)
      );
    } catch {
      setApplicationItems([]);
    } finally {
      setApplicationsLoading(false);
    }
  }, [token]);

  const loadNotifications = useCallback(async () => {
    await Promise.all([loadGeneralNotifications(), loadApplications()]);
  }, [loadGeneralNotifications, loadApplications]);

  useFocusEffect(
    useCallback(() => {
      const tab = route.params?.initialTab;
      if (tab === 'applications' || tab === 'general') {
        setActiveTab(tab);
      }
      void (async () => {
        await loadNotifications();
        // Opening the inbox clears the Home bell badge
        await markAllReadAndClearBadge();
      })();
    }, [route.params?.initialTab, loadNotifications, markAllReadAndClearBadge])
  );

  if (!fontsLoaded) {
    return (
      <View style={styles.fontSplash}>
        <ActivityIndicator color={NAVY} size="large" />
      </View>
    );
  }

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Home' as never);
  };

  const handleDeleteGeneral = async (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setGeneralItems((prev) => prev.filter((n) => n.id !== id));

    if (!token) return;

    try {
      await deleteNotification(token, id);
    } catch {
      loadGeneralNotifications();
    }
  };

  const handleDeleteApplication = async (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setApplicationItems((prev) => prev.filter((n) => n.id !== id));

    if (!token) return;

    try {
      await deleteNotification(token, id);
    } catch {
      loadApplications();
    }
  };

  const handleClearAllInActiveTab = async () => {
    if (!token) return;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (activeTab === 'general') {
      setGeneralItems([]);
    } else {
      setApplicationItems([]);
    }

    try {
      await clearNotifications(token, activeTab);
    } catch {
      loadNotifications();
    }
  };

  const handleGeneralPress = (id: string) => {
    const item = generalItems.find((entry) => entry.id === id);
    if (!item) return;

    if (item.jobId) {
      navigation.navigate('JobDetails', { jobId: item.jobId });
      return;
    }

    if (item.conversationId) {
      navigateToInchatThread(navigation, item.conversationId);
      return;
    }

    if (item.ticketId) {
      navigation.navigate('SupportTicketDetail', { ticketId: item.ticketId });
    }
  };

  const openMoreMenu = () => {
    const visibleCount =
      activeTab === 'general' ? generalItems.length : applicationItems.length;
    Alert.alert(
      'Notifications',
      undefined,
      [
        {
          text:
            visibleCount > 0
              ? `Clear all in ${activeTab === 'general' ? 'General' : 'Applications'}`
              : 'Clear all (nothing to clear)',
          style: 'destructive',
          onPress:
            visibleCount > 0
              ? () =>
                  Alert.alert(
                    'Clear all?',
                    `This will remove all ${visibleCount} notification${visibleCount === 1 ? '' : 's'} in ${activeTab === 'general' ? 'General' : 'Applications'}. This action cannot be undone.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Clear all',
                        style: 'destructive',
                        onPress: handleClearAllInActiveTab,
                      },
                    ]
                  )
              : undefined,
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const isLoading =
    activeTab === 'general' ? generalLoading : applicationsLoading;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <NotificationsHeader
        onBackPress={handleBack}
        onMorePress={openMoreMenu}
      />
      <NotificationsTabs active={activeTab} onChange={setActiveTab} />
      <View style={styles.body}>
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={NAVY} size="small" />
          </View>
        ) : activeTab === 'general' ? (
          <NotificationsList
            items={generalItems}
            onItemPress={handleGeneralPress}
            onItemDelete={handleDeleteGeneral}
          />
        ) : (
          <ApplicationsNotificationsList
            items={applicationItems}
            onItemDelete={handleDeleteApplication}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fontSplash: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  body: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
