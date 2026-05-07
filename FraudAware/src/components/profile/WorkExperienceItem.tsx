import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LogoFallback from './LogoFallback';
import type { WorkExperience } from '../../../data/profileDetails';

const NAVY = '#202871';
const SUBTLE = '#5B6473';
const META = '#7A88A6';

type Props = {
  item: WorkExperience;
  onEdit?: () => void;
  showDivider?: boolean;
};

export default function WorkExperienceItem({
  item,
  onEdit,
  showDivider,
}: Props) {
  return (
    <View>
      <View style={styles.row}>
        <LogoFallback
          source={item.logo}
          uri={item.logoUri}
          fallback={item.fallback}
          size={44}
          borderRadius={8}
        />
        <View style={styles.textCol}>
          {/** Role — Poppins Medium 14 */}
          <Text style={styles.role}>{item.role}</Text>
          {/** Company — Poppins Regular 12 */}
          <Text style={styles.company}>{item.company}</Text>
          {/** Duration — Poppins Regular 10 */}
          <Text style={styles.duration}>{item.duration}</Text>
        </View>
        <Pressable
          onPress={onEdit}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.role}`}
          style={({ pressed }) => [
            styles.editBtn,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Image
            source={require('../../../assets/icons/edit1.png')}
            style={styles.editIcon}
            resizeMode="contain"
          />
        </Pressable>
      </View>
      {showDivider && <View style={styles.divider} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  role: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: NAVY,
    marginBottom: 1,
  },
  company: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: SUBTLE,
    marginBottom: 2,
  },
  duration: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 10,
    color: META,
  },
  editBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  editIcon: {
    width: 16,
    height: 16,
    tintColor: NAVY,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F2F8',
    marginVertical: 4,
  },
});
