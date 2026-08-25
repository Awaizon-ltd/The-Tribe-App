import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Vibration,
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

const PIN_LEN = 6;
const KEYS = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']];

/**
 * Shared passcode entry component used across the app.
 * - Square input indicators
 * - Rounded numpad buttons
 * - No icons
 *
 * Props:
 *   onComplete(passcode)  — called once 6 digits are entered
 *   error                 — string shown below indicators; triggers shake + reset
 *   title                 — heading (omit to hide)
 *   subtitle              — subheading (omit to hide)
 *   onCancel              — if provided, a Cancel link is shown below the keypad
 *   cancelLabel           — defaults to "Cancel"
 *   style                 — optional root ViewStyle override
 */
export const PasscodeKeypad = ({
  onComplete,
  error,
  title,
  subtitle,
  onCancel,
  cancelLabel = 'Cancel',
  style,
}) => {
  const { COLORS, FONTS } = useTheme();
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // External error → shake + reset
  useEffect(() => {
    if (!error) return;
    setPin('');
    setSubmitting(false);
    Vibration.vibrate([0, 80, 40, 80]);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [error]);

  // Auto-submit at length
  useEffect(() => {
    if (pin.length === PIN_LEN && !submitting) {
      setSubmitting(true);
      setTimeout(() => onComplete(pin), 100);
    }
  }, [pin]);

  const press = (d) => {
    if (!submitting && pin.length < PIN_LEN) {
      setPin(p => p + d);
      Vibration.vibrate(8);
    }
  };

  const erase = () => {
    if (!submitting && pin.length > 0) {
      setPin(p => p.slice(0, -1));
      Vibration.vibrate(8);
    }
  };

  const s = makeStyles(COLORS, FONTS);

  return (
    <View style={[s.root, style]}>
      {title ? <Text style={s.title}>{title}</Text> : null}
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}

      {/* Square indicators */}
      <Animated.View style={[s.indicators, { transform: [{ translateX: shakeAnim }] }]}>
        {Array.from({ length: PIN_LEN }).map((_, i) => (
          <View
            key={i}
            style={[
              s.indicator,
              i < pin.length && s.indicatorFilled,
              error && s.indicatorError,
            ]}
          />
        ))}
      </Animated.View>

      {/* Error */}
      <View style={s.errorRow}>
        {error ? <Text style={s.errorText}>{error}</Text> : null}
      </View>

      {/* Rounded numpad */}
      <View style={s.keypad}>
        {KEYS.map((row, ri) => (
          <View key={ri} style={s.row}>
            {row.map((key, ki) => {
              if (key === '') return <View key={ki} style={s.keySlot} />;
              if (key === '⌫') return (
                <TouchableOpacity
                  key={ki}
                  style={[s.key, s.keyErase]}
                  onPress={erase}
                  disabled={pin.length === 0 || submitting}
                  activeOpacity={0.6}
                >
                  <Text style={[s.eraseText, (pin.length === 0 || submitting) && s.eraseDim]}>
                    ⌫
                  </Text>
                </TouchableOpacity>
              );
              return (
                <TouchableOpacity
                  key={ki}
                  style={s.key}
                  onPress={() => press(key)}
                  disabled={submitting}
                  activeOpacity={0.6}
                >
                  <Text style={s.keyText}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {onCancel ? (
        <TouchableOpacity style={s.cancelBtn} onPress={onCancel} disabled={submitting}>
          <Text style={s.cancelText}>{cancelLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const makeStyles = (COLORS, FONTS) => StyleSheet.create({
  root: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: FONTS?.sizes?.xxl ?? 22,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: FONTS?.sizes?.sm ?? 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  indicators: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 28,
  },
  // Square input indicator
  indicator: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: 'transparent',
  },
  indicatorFilled: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  indicatorError: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.error + '28',
  },
  errorRow: {
    height: 20,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: FONTS?.sizes?.sm ?? 13,
    color: COLORS.error,
    fontWeight: '600',
    textAlign: 'center',
  },
  keypad: {
    gap: 10,
    marginTop: 32,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  // Rounded numpad button
  key: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  keySlot: {
    width: 72,
    height: 72,
  },
  keyErase: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  keyText: {
    fontSize: FONTS?.sizes?.xxl ?? 26,
    fontWeight: '300',
    color: COLORS.text,
  },
  eraseText: {
    fontSize: 22,
    color: COLORS.text,
  },
  eraseDim: {
    color: COLORS.textTertiary,
  },
  cancelBtn: {
    marginTop: 24,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  cancelText: {
    fontSize: FONTS?.sizes?.sm ?? 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});

export default PasscodeKeypad;
