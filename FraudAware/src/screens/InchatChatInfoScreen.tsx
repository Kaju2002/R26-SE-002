import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ChatStackParamList } from '../navigation/chatStackTypes';
import { useInchat } from '../context/InchatContext';
import { deriveInchatThreadDetails } from '../utils/deriveInchatThreadDetails';
import { INCHAT_BORDER, INCHAT_MUTED, INCHAT_NAVY } from '../components/inchat/inchatStyles';

type Props = NativeStackScreenProps<ChatStackParamList, 'InchatChatInfo'>;

const GRID_GAP = 6;
const GRID_PAD = 16;
const COLS = 3;
const TILE =
  (Dimensions.get('window').width - GRID_PAD * 2 - GRID_GAP * (COLS - 1)) / COLS;

function openRemoteUrl(url: string) {
  Linking.openURL(url).catch(() => {
    Alert.alert('Could not open', 'Unable to open this file.');
  });
}

export default function InchatChatInfoScreen({ navigation, route }: Props) {
  const { threadId } = route.params;
  const { threadsForList, getCombinedMessages } = useInchat();
  const thread = useMemo(
    () => threadsForList.find((entry) => entry.id === threadId),
    [threadId, threadsForList]
  );
  const messages = getCombinedMessages(threadId);
  const details = useMemo(() => deriveInchatThreadDetails(messages), [messages]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const onOpenDoc = useCallback((url: string) => {
    openRemoteUrl(url);
  }, []);

  const initials =
    thread?.initials ||
    (thread?.participantName || 'C')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') ||
    'C';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={INCHAT_NAVY} />
        </Pressable>
        <Text style={styles.topTitle}>Chat info</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileBlock}>
          {thread?.avatarUrl ? (
            <Image source={{ uri: thread.avatarUrl }} style={styles.profileAvatar} />
          ) : (
            <View style={[styles.profileAvatar, styles.profileAvatarFallback]}>
              <Text style={styles.profileInitials}>{initials}</Text>
            </View>
          )}
          <Text style={styles.profileName} numberOfLines={2}>
            {thread?.participantName ?? 'Conversation'}
          </Text>
          {thread?.jobTitle || thread?.subtitle ? (
            <Text style={styles.profileSub} numberOfLines={2}>
              {thread.jobTitle || thread.subtitle}
            </Text>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Media ({details.media.length})</Text>
        {details.media.length === 0 ? (
          <Text style={styles.emptyHint}>No shared media yet.</Text>
        ) : (
          <View style={styles.mediaGrid}>
            {details.media.map((item) => (
              <Pressable
                key={item.id}
                style={styles.mediaTile}
                onPress={() => setPreviewUrl(item.url)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.fileName}`}
              >
                <Image source={{ uri: item.url }} style={styles.mediaImage} />
              </Pressable>
            ))}
          </View>
        )}

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>
          Documents ({details.documents.length})
        </Text>
        {details.documents.length === 0 ? (
          <Text style={styles.emptyHint}>No files shared in this conversation.</Text>
        ) : (
          <View style={styles.docList}>
            {details.documents.map((doc) => (
              <Pressable
                key={doc.id}
                style={styles.docRow}
                onPress={() => onOpenDoc(doc.url)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${doc.fileName}`}
              >
                <View style={styles.docIcon}>
                  <MaterialCommunityIcons
                    name="file-document-outline"
                    size={22}
                    color="#D32F2F"
                  />
                </View>
                <View style={styles.docCopy}>
                  <Text style={styles.docName} numberOfLines={2}>
                    {doc.fileName}
                  </Text>
                  {doc.sizeLabel ? (
                    <Text style={styles.docSize}>{doc.sizeLabel}</Text>
                  ) : null}
                </View>
                <MaterialCommunityIcons
                  name="open-in-new"
                  size={18}
                  color={INCHAT_MUTED}
                />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={Boolean(previewUrl)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewUrl(null)}
      >
        <View style={styles.previewBackdrop}>
          <Pressable
            style={styles.previewClose}
            onPress={() => setPreviewUrl(null)}
            accessibilityRole="button"
            accessibilityLabel="Close preview"
          >
            <MaterialCommunityIcons name="close" size={28} color="#fff" />
          </Pressable>
          {previewUrl ? (
            <Image
              source={{ uri: previewUrl }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          ) : null}
          {previewUrl ? (
            <Pressable
              style={styles.previewOpenLink}
              onPress={() => openRemoteUrl(previewUrl)}
            >
              <Text style={styles.previewOpenLinkText}>Open original</Text>
            </Pressable>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: INCHAT_BORDER,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '800',
    color: INCHAT_NAVY,
  },
  scroll: {
    paddingBottom: 40,
  },
  profileBlock: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
  },
  profileAvatar: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: '#F3F5F8',
  },
  profileAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitials: {
    fontSize: 28,
    fontWeight: '800',
    color: INCHAT_NAVY,
  },
  profileName: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: '800',
    color: INCHAT_NAVY,
    textAlign: 'center',
  },
  profileSub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: INCHAT_MUTED,
    textAlign: 'center',
  },
  sectionTitle: {
    marginTop: 8,
    marginHorizontal: GRID_PAD,
    fontSize: 15,
    fontWeight: '700',
    color: INCHAT_NAVY,
  },
  sectionTitleSpaced: {
    marginTop: 28,
  },
  emptyHint: {
    marginTop: 10,
    marginHorizontal: GRID_PAD,
    fontSize: 13,
    fontWeight: '500',
    color: INCHAT_MUTED,
  },
  mediaGrid: {
    marginTop: 12,
    paddingHorizontal: GRID_PAD,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  mediaTile: {
    width: TILE,
    height: TILE,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F3F5F8',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: INCHAT_BORDER,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  docList: {
    marginTop: 10,
    marginHorizontal: GRID_PAD,
    gap: 4,
  },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#F7F8FC',
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FEECEC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docCopy: {
    flex: 1,
    minWidth: 0,
  },
  docName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  docSize: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: INCHAT_MUTED,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewClose: {
    position: 'absolute',
    top: 54,
    right: 20,
    zIndex: 2,
    padding: 8,
  },
  previewImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.7,
  },
  previewOpenLink: {
    position: 'absolute',
    bottom: 48,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  previewOpenLinkText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
