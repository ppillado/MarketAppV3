import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AuthUser } from '@/features/auth/useAuthUser';

const AVATAR_SIZE = 64;

/** Who the user is right now: a guest (anonymous) or a Google-linked account. */
export function AccountCard({ user }: { user: AuthUser | null }) {
  const theme = useTheme();
  const google = user?.google ?? null;

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.card, { borderColor: theme.backgroundSelected }]}>
      {google?.avatarUrl ? (
        <Image source={{ uri: google.avatarUrl }} style={styles.avatar} contentFit="cover" />
      ) : (
        <View
          style={[
            styles.avatar,
            styles.avatarFallback,
            { backgroundColor: theme.backgroundSelected },
          ]}>
          <SymbolView
            name={{ ios: 'person.fill', android: 'person', web: 'person' }}
            tintColor={theme.textSecondary}
            size={32}
          />
        </View>
      )}

      <View style={styles.info}>
        <ThemedText type="smallBold" style={styles.name} numberOfLines={1}>
          {google ? (google.name ?? 'Tu cuenta') : 'Invitado'}
        </ThemedText>
        {google?.email && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {google.email}
          </ThemedText>
        )}

        <View
          style={[
            styles.badge,
            google
              ? { backgroundColor: `${theme.accent}26`, borderColor: theme.accent }
              : { borderColor: theme.backgroundSelected },
          ]}>
          <SymbolView
            name={
              google
                ? { ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }
                : {
                    ios: 'person.crop.circle.badge.questionmark',
                    android: 'no_accounts',
                    web: 'no_accounts',
                  }
            }
            tintColor={google ? theme.accent : theme.textSecondary}
            size={14}
          />
          <ThemedText
            type="smallBold"
            style={[styles.badgeText, { color: google ? theme.accent : theme.textSecondary }]}>
            {google ? 'Cuenta Google' : 'Cuenta anónima'}
          </ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three + Spacing.one,
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: Spacing.one,
    alignItems: 'flex-start',
  },
  name: {
    fontSize: 20,
    lineHeight: 26,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.one,
    paddingVertical: Spacing.half,
    paddingHorizontal: Spacing.two,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
