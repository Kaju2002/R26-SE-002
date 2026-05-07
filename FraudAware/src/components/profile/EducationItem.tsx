import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LogoFallback from './LogoFallback';
import type { EducationItem as EducationItemData } from '../../../data/profileDetails';

const NAVY = '#202871';
const SUBTLE = '#5B6473';
const META = '#7A88A6';

type Props = {
  item: EducationItemData;
  onEdit?: () => void;
  showDivider?: boolean;
};

export default function EducationItem({ item, onEdit, showDivider }: Props) {
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
          <Text style={styles.degree}>{item.degree}</Text>
          <Text style={styles.institution}>{item.institution}</Text>
          <Text style={styles.duration}>{item.duration}</Text>
        </View>
        <Pressable
          onPress={onEdit}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.degree}`}
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
  degree: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: NAVY,
    marginBottom: 1,
  },
  institution: {
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
