import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { JOB_SEARCH_COLORS } from './jobSearchTheme';
import {
  DEFAULT_JOB_FILTERS,
  SALARY_CURRENCIES,
  SALARY_SLIDER_BY_CURRENCY,
  SALARY_SLIDER_DEFAULTS,
  formatSalaryAmount,
  type JobFilters,
  type SalaryCurrencyCode,
} from './types';

type Props = {
  visible: boolean;
  value: JobFilters;
  onClose: () => void;
  onApply: (filters: JobFilters) => void;
  onReset: () => void;
};

type SectionKey =
  | 'work'
  | 'locationSalary'
  | 'employment'
  | 'experience'
  | 'education'
  | 'industry';

function RadioOption({
  selected,
  label,
  onPress,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.optionRow, pressed && { opacity: 0.7 }]}
    >
      <Image
        source={
          selected
            ? require('../../../../assets/icons/Radio button checked.png')
            : require('../../../../assets/icons/radioicon.png')
        }
        style={styles.radioIcon}
      />
      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function CheckOption({
  selected,
  label,
  onPress,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.optionRow, pressed && { opacity: 0.7 }]}
    >
      <View
        style={[
          styles.checkBox,
          selected ? styles.checkBoxSelected : styles.checkBoxUnselected,
        ]}
      >
        {selected ? <Text style={styles.checkMark}>✓</Text> : null}
      </View>
      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function JobsFilterSheet({
  visible,
  value,
  onClose,
  onApply,
  onReset,
}: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<JobFilters>(value);
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    work: true,
    locationSalary: true,
    employment: true,
    experience: true,
    education: true,
    industry: true,
  });

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const salaryLabel = useMemo(() => {
    if (!draft.currency) return 'Any currency · Any salary';
    if (!draft.salaryEnabled) {
      return `${draft.currency} · Any salary`;
    }
    return `${formatSalaryAmount(draft.salaryMin, draft.currency)} - ${formatSalaryAmount(draft.salaryMax, draft.currency)}`;
  }, [draft.currency, draft.salaryEnabled, draft.salaryMax, draft.salaryMin]);

  const sliderConfig = draft.currency
    ? SALARY_SLIDER_BY_CURRENCY[draft.currency]
    : SALARY_SLIDER_DEFAULTS;

  const setCurrency = (currency: SalaryCurrencyCode | null) => {
    if (!currency) {
      setDraft((prev) => ({
        ...prev,
        currency: null,
        salaryEnabled: false,
        salaryMin: SALARY_SLIDER_DEFAULTS.lower,
        salaryMax: SALARY_SLIDER_DEFAULTS.upper,
      }));
      return;
    }
    const next = SALARY_SLIDER_BY_CURRENCY[currency];
    setDraft((prev) => ({
      ...prev,
      currency,
      salaryEnabled: false,
      salaryMin: next.lower,
      salaryMax: next.upper,
    }));
  };

  const setSection = (key: SectionKey) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleEmploymentType = (type: JobFilters['types'][number]) => {
    setDraft((prev) => {
      const exists = prev.types.includes(type);
      return {
        ...prev,
        types: exists ? prev.types.filter((t) => t !== type) : [...prev.types, type],
      };
    });
  };

  const toggleTextFilter = (
    key: 'experience' | 'education' | 'industry',
    value: string
  ) => {
    setDraft((prev) => {
      const current = prev[key];
      const exists = current.includes(value);
      return {
        ...prev,
        [key]: exists ? current.filter((v) => v !== value) : [...current, value],
      };
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <SafeAreaView style={styles.sheet} edges={['top', 'bottom']}>
              <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) }]}>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.6 }]}
                >
                  <Image
                    source={require('../../../../assets/icons/close.png')}
                    style={styles.headerIcon}
                  />
                </Pressable>
                <Text style={styles.headerTitle}>Filter Options</Text>
              </View>

              <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                <FilterSection
                  title="Work Type"
                  open={open.work}
                  onToggle={() => setSection('work')}
                >
                  <RadioOption
                    selected={draft.mode === 'On-Site'}
                    label="Onsite (Work from Workplace)"
                    onPress={() => setDraft((prev) => ({ ...prev, mode: 'On-Site' }))}
                  />
                  <RadioOption
                    selected={draft.mode === 'Remote'}
                    label="Remote (Work from Home)"
                    onPress={() => setDraft((prev) => ({ ...prev, mode: 'Remote' }))}
                  />
                  <RadioOption
                    selected={draft.mode === 'Hybrid'}
                    label="Hybrid"
                    onPress={() => setDraft((prev) => ({ ...prev, mode: 'Hybrid' }))}
                  />
                </FilterSection>

                <FilterSection
                  title="Location & Salary"
                  open={open.locationSalary}
                  onToggle={() => setSection('locationSalary')}
                >
                  <Text style={styles.inputLabel}>Location</Text>
                  <View style={styles.locationRow}>
                    <Image
                      source={require('../../../../assets/icons/Location on.png')}
                      style={styles.locationIcon}
                    />
                    <TextInput
                      value={draft.location}
                      onChangeText={(text) => setDraft((prev) => ({ ...prev, location: text }))}
                      placeholder="Tamale"
                      placeholderTextColor={JOB_SEARCH_COLORS.mutedText}
                      style={styles.locationInput}
                    />
                  </View>
                  <Text style={[styles.inputLabel, { marginTop: 8 }]}>Currency</Text>
                  <View style={styles.currencyRow}>
                    <Pressable
                      onPress={() => setCurrency(null)}
                      style={[
                        styles.currencyChip,
                        !draft.currency && styles.currencyChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.currencyChipText,
                          !draft.currency && styles.currencyChipTextActive,
                        ]}
                      >
                        Any
                      </Text>
                    </Pressable>
                    {SALARY_CURRENCIES.map((item) => {
                      const active = draft.currency === item.code;
                      return (
                        <Pressable
                          key={item.code}
                          onPress={() => setCurrency(item.code)}
                          style={[
                            styles.currencyChip,
                            active && styles.currencyChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.currencyChipText,
                              active && styles.currencyChipTextActive,
                            ]}
                          >
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={[styles.inputLabel, { marginTop: 10 }]}>Salary</Text>
                  {draft.currency ? (
                    <>
                      <RangeSlider
                        key={draft.currency}
                        min={sliderConfig.min}
                        max={sliderConfig.max}
                        lowerValue={draft.salaryMin}
                        upperValue={draft.salaryMax}
                        step={sliderConfig.step}
                        onChange={(lowerValue, upperValue) =>
                          setDraft((prev) => ({
                            ...prev,
                            salaryMin: lowerValue,
                            salaryMax: upperValue,
                            salaryEnabled: true,
                          }))
                        }
                      />
                      <View style={styles.salaryValueRow}>
                        <View style={styles.salaryValueBox}>
                          <Text style={styles.salaryValueText}>
                            {draft.salaryEnabled
                              ? formatSalaryAmount(draft.salaryMin, draft.currency)
                              : 'Any'}
                          </Text>
                        </View>
                        <View style={styles.salaryValueBox}>
                          <Text style={styles.salaryValueText}>
                            {draft.salaryEnabled
                              ? formatSalaryAmount(draft.salaryMax, draft.currency)
                              : 'Any'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.periodRow}>
                        <Text style={styles.periodText}>{draft.salaryPeriod}</Text>
                        <Ionicons
                          name="chevron-down"
                          size={14}
                          color={JOB_SEARCH_COLORS.primaryText}
                          style={styles.periodArrow}
                        />
                      </View>
                      <Text style={styles.salaryLabel}>{salaryLabel}</Text>
                      {!draft.salaryEnabled ? (
                        <Text style={styles.salaryHint}>
                          Move the slider to filter by salary in {draft.currency}
                        </Text>
                      ) : null}
                    </>
                  ) : (
                    <Text style={styles.salaryHint}>
                      Choose a currency to filter by salary range
                    </Text>
                  )}
                </FilterSection>

                <FilterSection
                  title="Employment Type"
                  open={open.employment}
                  onToggle={() => setSection('employment')}
                >
                  {(['Full-Time', 'Part-Time', 'Contract', 'Internship'] as const).map(
                    (type) => (
                      <CheckOption
                        key={type}
                        selected={draft.types.includes(type)}
                        label={type}
                        onPress={() => toggleEmploymentType(type)}
                      />
                    )
                  )}
                </FilterSection>

                <FilterSection
                  title="Experience"
                  open={open.experience}
                  onToggle={() => setSection('experience')}
                >
                  {['No Experience', '1-5 years', '6-10 years', '10+ years'].map(
                    (item) => (
                      <CheckOption
                        key={item}
                        selected={draft.experience.includes(item)}
                        label={item}
                        onPress={() => toggleTextFilter('experience', item)}
                      />
                    )
                  )}
                </FilterSection>

                <FilterSection
                  title="Education"
                  open={open.education}
                  onToggle={() => setSection('education')}
                >
                  {[
                    'Less than High School',
                    'High School',
                    "Associate's Degree",
                    "Bachelor's Degree",
                    "Master's Degree",
                    'Doctoral or Professional Degree',
                  ].map((item) => (
                    <CheckOption
                      key={item}
                      selected={draft.education.includes(item)}
                      label={item}
                      onPress={() => toggleTextFilter('education', item)}
                    />
                  ))}
                </FilterSection>

                <FilterSection
                  title="Industry"
                  open={open.industry}
                  onToggle={() => setSection('industry')}
                >
                  {['Arts', 'Accounting', 'Bakery', 'Butchery', 'Business', 'Carpentry'].map(
                    (item) => (
                      <CheckOption
                        key={item}
                        selected={draft.industry.includes(item)}
                        label={item}
                        onPress={() => toggleTextFilter('industry', item)}
                      />
                    )
                  )}
                </FilterSection>
              </ScrollView>

              <View style={styles.footer}>
                <Pressable
                  onPress={() => {
                    setDraft(DEFAULT_JOB_FILTERS);
                    onReset();
                  }}
                  style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.resetText}>Reset</Text>
                </Pressable>
                <Pressable
                  onPress={() => onApply(draft)}
                  style={({ pressed }) => [styles.applyBtn, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.applyText}>Apply</Text>
                </Pressable>
              </View>
            </SafeAreaView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function RangeSlider({
  min,
  max,
  lowerValue,
  upperValue,
  step = 100,
  onChange,
}: {
  min: number;
  max: number;
  lowerValue: number;
  upperValue: number;
  step?: number;
  onChange: (lower: number, upper: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(1);
  const [activeThumb, setActiveThumb] = useState<'lower' | 'upper'>('lower');
  const minGap = Math.max(step, step * 2);

  const lowerX = ((lowerValue - min) / (max - min)) * trackWidth;
  const upperX = ((upperValue - min) / (max - min)) * trackWidth;

  const updateFromX = (x: number, thumb: 'lower' | 'upper' = activeThumb) => {
    const clampedX = Math.max(0, Math.min(trackWidth, x));
    const rawValue = min + (clampedX / trackWidth) * (max - min);
    const rounded = Math.round(rawValue / step) * step;

    if (thumb === 'lower') {
      onChange(Math.min(rounded, upperValue - minGap), upperValue);
    } else {
      onChange(lowerValue, Math.max(rounded, lowerValue + minGap));
    }
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const x = evt.nativeEvent.locationX;
          const lowerDist = Math.abs(x - lowerX);
          const upperDist = Math.abs(x - upperX);
          const thumb = lowerDist <= upperDist ? 'lower' : 'upper';
          setActiveThumb(thumb);
          updateFromX(x, thumb);
        },
        onPanResponderMove: (evt) => updateFromX(evt.nativeEvent.locationX),
      }),
    [lowerX, upperX, trackWidth, lowerValue, upperValue, activeThumb, step, minGap]
  );

  const onTrackLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={styles.sliderWrap} onLayout={onTrackLayout} {...responder.panHandlers}>
      <Image
        source={require('../../../../assets/icons/Slider.png')}
        style={styles.sliderBase}
        resizeMode="stretch"
      />
      <View style={[styles.sliderActiveLine, { left: lowerX, width: upperX - lowerX }]} />
      <View style={[styles.sliderThumb, { left: lowerX - 8 }]} />
      <View style={[styles.sliderThumb, { left: upperX - 8 }]} />
    </View>
  );
}

function FilterSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Pressable onPress={onToggle} style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={JOB_SEARCH_COLORS.primaryText}
          style={styles.expandIcon}
        />
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '100%',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  headerIconBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    width: 16,
    height: 16,
    tintColor: JOB_SEARCH_COLORS.primaryText,
  },
  headerTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 22,
    color: JOB_SEARCH_COLORS.primaryText,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  section: {
    borderWidth: 1,
    borderColor: JOB_SEARCH_COLORS.border,
    borderRadius: 8,
    backgroundColor: JOB_SEARCH_COLORS.cardBackground,
  },
  sectionHeader: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  sectionTitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: JOB_SEARCH_COLORS.primaryText,
  },
  expandIcon: {
    marginRight: 2,
  },
  sectionBody: {
    borderTopWidth: 1,
    borderTopColor: JOB_SEARCH_COLORS.divider,
    padding: 10,
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioIcon: {
    width: 14,
    height: 14,
  },
  optionLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: JOB_SEARCH_COLORS.mutedText,
  },
  optionLabelSelected: {
    color: JOB_SEARCH_COLORS.primaryText,
  },
  inputLabel: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: JOB_SEARCH_COLORS.secondaryText,
  },
  locationRow: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: JOB_SEARCH_COLORS.border,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 6,
  },
  locationIcon: {
    width: 16,
    height: 16,
    tintColor: '#202871',
  },
  locationInput: {
    flex: 1,
    paddingVertical: 0,
    color: JOB_SEARCH_COLORS.primaryText,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
  },
  currencyRow: {
    marginTop: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  currencyChip: {
    minWidth: 52,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: JOB_SEARCH_COLORS.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyChipActive: {
    borderColor: JOB_SEARCH_COLORS.primaryText,
    backgroundColor: JOB_SEARCH_COLORS.primaryText,
  },
  currencyChipText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: JOB_SEARCH_COLORS.mutedText,
  },
  currencyChipTextActive: {
    color: '#FFFFFF',
  },
  sliderWrap: {
    marginTop: 8,
    height: 24,
    justifyContent: 'center',
  },
  sliderBase: {
    width: '100%',
    height: 5,
    tintColor: '#D9DDE8',
  },
  sliderActiveLine: {
    position: 'absolute',
    top: 10,
    height: 4,
    backgroundColor: JOB_SEARCH_COLORS.primaryText,
    borderRadius: 999,
  },
  sliderThumb: {
    position: 'absolute',
    top: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: JOB_SEARCH_COLORS.primaryText,
    backgroundColor: '#FFFFFF',
  },
  salaryValueRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  salaryValueBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: JOB_SEARCH_COLORS.border,
    borderRadius: 8,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  salaryValueText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: JOB_SEARCH_COLORS.primaryText,
  },
  periodRow: {
    marginTop: 8,
    height: 34,
    borderWidth: 1,
    borderColor: JOB_SEARCH_COLORS.border,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  periodText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: JOB_SEARCH_COLORS.primaryText,
  },
  periodArrow: {
    marginRight: 2,
  },
  salaryLabel: {
    marginTop: 6,
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: JOB_SEARCH_COLORS.secondaryText,
  },
  salaryHint: {
    marginTop: 4,
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    color: JOB_SEARCH_COLORS.mutedText,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: JOB_SEARCH_COLORS.divider,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
  },
  resetBtn: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: JOB_SEARCH_COLORS.primaryText,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  resetText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    color: JOB_SEARCH_COLORS.primaryText,
  },
  applyBtn: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: JOB_SEARCH_COLORS.primaryAction,
  },
  applyText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    color: '#FFFFFF',
  },
  checkBox: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxSelected: {
    borderColor: '#202871',
    backgroundColor: '#202871',
  },
  checkBoxUnselected: {
    borderColor: '#A7ACD7',
    backgroundColor: '#FFFFFF',
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 10,
    fontFamily: 'Poppins_500Medium',
  },
});
