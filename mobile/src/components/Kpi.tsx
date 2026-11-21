// One result tile: value, change against the previous period, and a small trend line.
import { Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Icon } from './Icon';
import { change, compact } from '../lib/format';
import { colors, fonts, radius, type } from '../lib/theme';
import type { Kpi } from '../lib/types';

function Spark({ series, width = 120, height = 34 }: { series: number[]; width?: number; height?: number }) {
  if (series.length < 2) return <View style={{ height }} />;
  const max = Math.max(...series), min = Math.min(...series);
  const span = max - min || 1;
  const pts = series.map((v, i) => [(i / (series.length - 1)) * width, height - 3 - ((v - min) / span) * (height - 6)] as const);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <Defs>
        <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.primary} stopOpacity="0.35" />
          <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d={`${line} L${width} ${height} L0 ${height} Z`} fill="url(#fill)" />
      <Path d={line} stroke={colors.accent} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function KpiTile({ label, kpi, suffix }: { label: string; kpi: Kpi; suffix?: string }) {
  const delta = kpi.available ? change(kpi.value, kpi.previous) : null;
  const up = (delta ?? 0) >= 0;
  return (
    <View style={{ flex: 1, minWidth: 0, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.line }}>
      <Text style={[type.small, { fontSize: 12 }]} numberOfLines={1}>{label}</Text>
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 24, color: kpi.available ? colors.ink : colors.faint, marginTop: 6 }} numberOfLines={1}>
        {kpi.available ? `${compact(kpi.value)}${suffix ?? ''}` : '—'}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2, minHeight: 16 }}>
        {delta !== null ? (
          <>
            <Icon name={up ? 'up' : 'down'} size={13} color={up ? colors.green : colors.red} strokeWidth={2.2} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: up ? colors.green : colors.red }}>{Math.abs(delta)} %</Text>
          </>
        ) : <Text style={[type.small, { fontSize: 11.5 }]} numberOfLines={1}>{kpi.available ? 'Période précédente vide' : 'Pas encore relié'}</Text>}
      </View>
      <View style={{ marginTop: 8 }}><Spark series={kpi.available ? kpi.series : []} /></View>
    </View>
  );
}
