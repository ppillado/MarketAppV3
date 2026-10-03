import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Offer } from '@/types/offer';

import { useOfferVote } from '../OfferVotesProvider';

/** Discreet community validation: "👍 Confirmar" / "👎 Agotado/Error". */
export function VoteBar({ offer }: { offer: Offer }) {
  const { myVote, confirmations, reports, pending, toggle } = useOfferVote(offer);

  return (
    <View style={styles.row}>
      <VoteButton
        emoji="👍"
        label="Confirmar"
        count={confirmations}
        active={myVote === 'confirm'}
        disabled={pending}
        tone="accent"
        accessibilityLabel={`Confirmar que el precio sigue vigente. ${confirmations} confirmaciones`}
        onPress={() => toggle('confirm')}
      />
      <VoteButton
        emoji="👎"
        label="Agotado/Error"
        count={reports}
        active={myVote === 'report'}
        disabled={pending}
        tone="danger"
        accessibilityLabel={`Reportar como agotado o con error. ${reports} reportes`}
        onPress={() => toggle('report')}
      />
    </View>
  );
}

type VoteButtonProps = {
  emoji: string;
  label: string;
  count: number;
  active: boolean;
  disabled: boolean;
  tone: 'accent' | 'danger';
  accessibilityLabel: string;
  onPress: () => void;
};

function VoteButton({
  emoji,
  label,
  count,
  active,
  disabled,
  tone,
  accessibilityLabel,
  onPress,
}: VoteButtonProps) {
  const theme = useTheme();
  const color = theme[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active, disabled }}
      hitSlop={6}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        active
          ? { borderColor: color, backgroundColor: `${color}26` }
          : { borderColor: theme.backgroundSelected },
        pressed && styles.pressed,
      ]}>
      <ThemedText style={styles.emoji}>{emoji}</ThemedText>
      <ThemedText type="small" style={{ color: active ? color : theme.textSecondary }}>
        {label}
      </ThemedText>
      {count > 0 && (
        <ThemedText type="smallBold" style={{ color: active ? color : theme.textSecondary }}>
          {count}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two + Spacing.half,
    borderRadius: 999,
    borderWidth: 1,
  },
  emoji: {
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.6,
  },
});
