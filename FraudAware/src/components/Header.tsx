import React, { useState } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProfileDrawer from './ProfileDrawer';

type HeaderProps = {
  onProfilePress?: () => void;
};

export default function Header({ onProfilePress }: HeaderProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleProfilePress = () => {
    if (onProfilePress) {
      onProfilePress();
      return;
    }
    setDrawerOpen(true);
  };

  return (
    <>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.profileIcon}
            onPress={handleProfilePress}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <MaterialIcons name="account-circle" size={32} color="#798AA3" />
          </TouchableOpacity>

          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={18} color="#798AA3" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search"
              placeholderTextColor="#A0A0A0"
            />
          </View>

          <TouchableOpacity style={styles.messageIcon}>
            <MaterialIcons name="chat-bubble-outline" size={22} color="#202871" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ProfileDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#E8E8E8',
    borderBottomWidth: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  profileIcon: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 36,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#202871',
    padding: 0,
  },
  messageIcon: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
