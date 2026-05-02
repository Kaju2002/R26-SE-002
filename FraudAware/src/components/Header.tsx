import React from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Header() {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.headerContainer}>
        {/* Profile Icon */}
        <TouchableOpacity style={styles.profileIcon}>
          <MaterialIcons name="account-circle" size={32} color="#798AA3" />
        </TouchableOpacity>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={18} color="#798AA3" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor="#A0A0A0"
          />
        </View>

        {/* Message Icon */}
        <TouchableOpacity style={styles.messageIcon}>
          <MaterialIcons name="chat-bubble-outline" size={22} color="#202871" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
