import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import EditProfileField from './EditProfileField';
import { dateToMonthYear, monthYearToDate } from '../../utils/formDataHelpers';

const NAVY = '#202871';

type Props = {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  maximumDate?: Date;
  minimumDate?: Date;
};

export default function EditMonthYearField({
  label,
  value,
  onChange,
  placeholder = 'MM/YYYY',
  maximumDate,
  minimumDate,
}: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [pickerDate, setPickerDate] = useState(() => monthYearToDate(value));

  const openPicker = () => {
    setPickerDate(monthYearToDate(value));
    setShowPicker(true);
  };

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'dismissed' || !selected) return;
    }
    if (selected) {
      setPickerDate(selected);
      onChange(dateToMonthYear(selected));
    }
  };

  return (
    <View>
      <EditProfileField
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        trailingIcon="calendar"
        editable={false}
        onPress={openPicker}
        onTrailingIconPress={openPicker}
      />

      {showPicker && (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          onChange={onPickerChange}
        />
      )}

      {Platform.OS === 'ios' && showPicker && (
        <View style={styles.iosPickerActions}>
          <TouchableOpacity
            onPress={() => setShowPicker(false)}
            style={styles.iosPickerDone}
            accessibilityRole="button"
          >
            <Text style={styles.iosPickerDoneText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  iosPickerActions: {
    alignItems: 'flex-end',
    marginTop: -6,
    marginBottom: 12,
  },
  iosPickerDone: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  iosPickerDoneText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: NAVY,
  },
});
