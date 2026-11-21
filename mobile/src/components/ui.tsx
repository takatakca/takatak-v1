// Building blocks of every screen (TAKATAK dark navy theme). Native components only (Pressable, TextInput, ScrollView); haptics on actions.
import { ReactNode, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, fonts, radius, shadow, type } from '../lib/theme';
import { Icon, IconName } from './Icon';

export const tap = () => { Haptics.selectionAsync().catch(() => undefined); };
export const success = () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined); };

export function Screen({ children, refreshing, onRefresh, padded = true, scroll = true, footer }: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void; padded?: boolean; scroll?: boolean; footer?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[padded && styles.padded, { paddingBottom: 32 + (footer ? 0 : insets.bottom) }]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : <View style={[{ flex: 1 }, padded && styles.padded]}>{children}</View>;
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {body}
      {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

export function Eyebrow({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }, style]}>
      <View style={{ width: 18, height: 1.5, backgroundColor: colors.accent }} />
      <Text style={type.label}>{children}</Text>
    </View>
  );
}

export function Card({ children, style, onPress, accent }: { children: ReactNode; style?: ViewStyle | ViewStyle[]; onPress?: () => void; accent?: boolean }) {
  const content = <View style={[styles.card, accent && styles.cardAccent, style as ViewStyle]}>{children}</View>;
  if (!onPress) return content;
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.995 : 1 }] }]} accessibilityRole="button">
      {content}
    </Pressable>
  );
}

type ButtonProps = { title: string; onPress: () => unknown; variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold'; icon?: IconName; disabled?: boolean; loading?: boolean; style?: ViewStyle; small?: boolean };
export function Button({ title, onPress, variant = 'primary', icon, disabled, loading, style, small }: ButtonProps) {
  const v = buttonVariants[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={() => { tap(); onPress(); }}
      style={({ pressed }) => [styles.button, small && styles.buttonSmall, { backgroundColor: v.bg, borderColor: v.border }, pressed && { opacity: 0.85 }, inactive && { opacity: 0.5 }, style]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : (
        <>
          {icon ? <Icon name={icon} size={small ? 16 : 19} color={v.fg} /> : null}
          <Text style={[styles.buttonText, small && { fontSize: 13.5 }, { color: v.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}
const buttonVariants = {
  primary: { bg: colors.primary, fg: colors.white, border: colors.primary },
  secondary: { bg: colors.raised, fg: colors.ink, border: colors.lineStrong },
  ghost: { bg: 'transparent', fg: colors.accent, border: 'transparent' },
  danger: { bg: 'transparent', fg: colors.red, border: 'rgba(255,107,122,0.4)' },
  gold: { bg: colors.white, fg: colors.canvas, border: colors.white },
};

export function Field({ label, hint, error, ...props }: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.faint}
        {...props}
        onFocus={e => { setFocused(true); props.onFocus?.(e); }}
        onBlur={e => { setFocused(false); props.onBlur?.(e); }}
        style={[styles.input, props.multiline && { minHeight: 110, textAlignVertical: 'top', paddingTop: 12 }, focused && styles.inputFocus, error ? { borderColor: colors.red } : null, props.style]}
      />
      {error ? <Text style={[type.small, { color: colors.red, marginTop: 6 }]}>{error}</Text> : hint ? <Text style={[type.small, { marginTop: 6 }]}>{hint}</Text> : null}
    </View>
  );
}

export function Badge({ label, tone = 'navy' }: { label: string; tone?: 'navy' | 'gold' | 'green' | 'wine' | 'red' | 'muted' }) {
  const t = { navy: [colors.ink, colors.raised], gold: [colors.accentInk, colors.accentSoft], green: [colors.green, colors.greenPale], wine: [colors.primary, colors.primarySoft], red: [colors.red, colors.redBg], muted: [colors.muted, colors.sunken] }[tone];
  return (
    <View style={{ backgroundColor: t[1], borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' }}>
      <Text style={{ color: t[0], fontFamily: fonts.semibold, fontSize: 11.5, letterSpacing: 0.2 }}>{label}</Text>
    </View>
  );
}

export function Row({ icon, title, subtitle, right, onPress, tint = colors.accent, last }: { icon?: IconName; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; tint?: string; last?: boolean }) {
  const inner = (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      {icon ? <View style={[styles.rowIcon, { backgroundColor: tint === colors.primary ? colors.primarySoft : colors.raised }]}><Icon name={icon} size={19} color={tint} /></View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={[type.small, { marginTop: 2 }]} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron" size={18} color={colors.faint} /> : null)}
    </View>
  );
  if (!onPress) return inner;
  return <Pressable accessibilityRole="button" onPress={() => { tap(); onPress(); }} style={({ pressed }) => pressed && { backgroundColor: colors.sunken }}>{inner}</Pressable>;
}

export function Empty({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16 }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.accentLine }}>
        <Icon name={icon} size={24} color={colors.accentInk} />
      </View>
      <Text style={[type.heading, { marginTop: 14, textAlign: 'center' }]}>{title}</Text>
      {text ? <Text style={[type.small, { marginTop: 6, textAlign: 'center', maxWidth: 300 }]}>{text}</Text> : null}
      {action ? <View style={{ marginTop: 16 }}>{action}</View> : null}
    </View>
  );
}

export function Loading() {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: colors.canvas }}><ActivityIndicator color={colors.primary} size="large" /></View>;
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.error}>
      <Icon name="info" size={18} color={colors.red} />
      <Text style={[type.small, { color: colors.red, flex: 1 }]}>{message}</Text>
      {onRetry ? <Pressable onPress={onRetry} hitSlop={10}><Text style={{ color: colors.red, fontFamily: fonts.semibold, fontSize: 13 }}>Réessayer</Text></Pressable> : null}
    </View>
  );
}

export function Notice({ children, icon = 'shield' }: { children: ReactNode; icon?: IconName }) {
  return (
    <View style={styles.notice}>
      <Icon name={icon} size={17} color={colors.accentInk} />
      <Text style={[type.small, { flex: 1, color: colors.ink2 }]}>{children}</Text>
    </View>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string; count?: number }[]; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {options.map(o => {
        const active = o.id === value;
        return (
          <Pressable key={o.id} onPress={() => { tap(); onChange(o.id); }} accessibilityRole="tab" accessibilityState={{ selected: active }}
            style={[styles.seg, active && styles.segActive]}>
            <Text style={[styles.segText, active && { color: colors.white }]}>{o.label}{o.count ? `  ${o.count}` : ''}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function ProgressBar({ ratio, color = colors.primary }: { ratio: number; color?: string }) {
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.sunken, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%`, height: 6, backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  padded: { paddingHorizontal: 20, paddingTop: 12 },
  footer: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.canvas, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: 18, ...shadow },
  cardAccent: { borderTopWidth: 2, borderTopColor: colors.accent },
  button: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  buttonSmall: { minHeight: 40, paddingHorizontal: 14 },
  buttonText: { fontFamily: fonts.semibold, fontSize: 15.5, letterSpacing: 0.1 },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink2, marginBottom: 7 },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md, paddingHorizontal: 14, fontSize: 16, fontFamily: fonts.regular, color: colors.ink, backgroundColor: colors.sunken },
  inputFocus: { borderColor: colors.primary, borderWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, lineHeight: 20 },
  error: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.redBg, borderRadius: radius.md, padding: 12, marginVertical: 8 },
  notice: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.accentLine },
  seg: { paddingHorizontal: 15, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lineStrong, justifyContent: 'center', backgroundColor: colors.surface },
  segActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.ink2 },
});
