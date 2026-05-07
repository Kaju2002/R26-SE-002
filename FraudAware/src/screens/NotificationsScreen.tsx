import React, { useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import NotificationsHeader from '../components/notification/NotificationsHeader';
import NotificationsTabs, {
  type NotificationTabId,
} from '../components/notification/NotificationsTabs';
import NotificationsList from '../components/notification/NotificationsList';
import ApplicationsNotificationsList from '../components/notification/ApplicationsNotificationsList';
import {
  NOTIFICATIONS,
  type AppNotification,
} from '../../data/notifications';
import {
  APPLICATION_NOTIFICATIONS,
  type ApplicationListItem,
} from '../../data/applicationNotifications';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const NAVY = '#202871';

export default function NotificationsScreen() {
  const navigation = useNavigation();
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
  });

  const [activeTab, setActiveTab] = useState<NotificationTabId>('general');
  const [generalItems, setGeneralItems] = useState<AppNotification[]>(() =>
    NOTIFICATIONS.filter((n) => n.category === 'general')
  );
  const [applicationItems, setApplicationItems] = useState<ApplicationListItem[]>(
    () => [...APPLICATION_NOTIFICATIONS]
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

  const handleDeleteGeneral = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setGeneralItems((prev) => prev.filter((n) => n.id !== id));
  };

  const handleDeleteApplication = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setApplicationItems((prev) => prev.filter((n) => n.id !== id));
  };

  const handleClearAllInActiveTab = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (activeTab === 'general') {
      setGeneralItems([]);
    } else {
      setApplicationItems([]);
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

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <NotificationsHeader
        onBackPress={handleBack}
        onMorePress={openMoreMenu}
      />
      <NotificationsTabs active={activeTab} onChange={setActiveTab} />
      <View style={styles.body}>
        {activeTab === 'general' ? (
          <NotificationsList
            items={generalItems}
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
});
