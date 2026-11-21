// The official TAKATAK mark (the same file takatak.ca uses, never a redrawn copy) with the live-text wordmark.
import { Image, Text, View } from 'react-native';
import { colors, fonts } from '../lib/theme';

const mark = require('../../assets/logo-mark.png');

export function Mark({ size = 44 }: { size?: number }) {
  return <Image source={mark} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityIgnoresInvertColors />;
}

export function Logo({ size = 1 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 * size }} accessibilityLabel="Groupe TAKATAK">
      <Mark size={42 * size} />
      <View>
        <Text style={{ fontFamily: fonts.display, fontSize: 9 * size, letterSpacing: 4 * size, color: colors.muted }}>GROUPE</Text>
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 22 * size, letterSpacing: 0.6 * size, color: colors.ink, marginTop: -1 }}>
          TAK<Text style={{ color: colors.primary }}>A</Text>TAK
        </Text>
      </View>
    </View>
  );
}
