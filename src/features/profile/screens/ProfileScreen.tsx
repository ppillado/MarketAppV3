import Constants from 'expo-constants';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { GoogleLinkError, linkGoogleAccount } from '@/features/auth/googleAuth';
import { useAuthUser } from '@/features/auth/useAuthUser';
import { useMyVoteCount } from '@/features/offers/OfferVotesProvider';
import { useTheme } from '@/hooks/use-theme';

import { AccountCard } from '../components/AccountCard';
import { GoogleLinkButton } from '../components/GoogleLinkButton';
import { useMyOfferCount } from '../hooks/useMyOfferCount';

const BENEFITS: { icon: SymbolViewProps['name']; text: string }[] = [
  {
    icon: { ios: 'iphone.and.arrow.forward', android: 'phonelink_setup', web: 'phonelink_setup' },
    text: 'Recupera tus ofertas y votos si cambias de teléfono o reinstalas la app.',
  },
  {
    icon: { ios: 'checkmark.shield.fill', android: 'verified_user', web: 'verified_user' },
    text: 'Tus reportes ganan confianza al venir de una cuenta verificada.',
  },
  {
    icon: { ios: 'lock.fill', android: 'lock', web: 'lock' },
    text: 'Solo usamos tu nombre y correo. Nunca publicamos nada en tu nombre.',
  },
];

export default function ProfileScreen() {
  const theme = useTheme();
  const { user } = useAuthUser();
  const offerCount = useMyOfferCount(user?.id ?? null);
  const voteCount = useMyVoteCount();
  const [linking, setLinking] = useState(false);

  const isLinked = Boolean(user?.google);

  const onLinkGoogle = async () => {
    setLinking(true);
    try {
      const result = await linkGoogleAccount();
      if (result === 'linked') {
        Alert.alert('¡Cuenta vinculada!', 'Tus ofertas y votos ahora están protegidos con Google.');
      }
    } catch (error) {
      Alert.alert(
        'No se pudo vincular',
        error instanceof GoogleLinkError ? error.message : 'Ocurrió un error inesperado.',
      );
    } finally {
      setLinking(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.container}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + Spacing.five }]}
          showsVerticalScrollIndicator={false}>
          <ThemedText type="subtitle">Perfil</ThemedText>

          <AccountCard user={user} />

          <View style={styles.stats}>
            <StatTile label="Ofertas publicadas" value={offerCount} />
            <StatTile label="Votos" value={voteCount} />
          </View>

          {isLinked ? (
            <ThemedView
              type="backgroundElement"
              style={[styles.section, { borderColor: theme.backgroundSelected }]}>
              <View style={styles.sectionHeader}>
                <SymbolView
                  name={{
                    ios: 'checkmark.shield.fill',
                    android: 'verified_user',
                    web: 'verified_user',
                  }}
                  tintColor={theme.accent}
                  size={22}
                />
                <ThemedText type="smallBold" style={styles.sectionTitle}>
                  Tus aportes están protegidos
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                Tu cuenta está vinculada con Google. Tus ofertas y votos quedan asociados a ella.
              </ThemedText>
            </ThemedView>
          ) : (
            <ThemedView
              type="backgroundElement"
              style={[styles.section, { borderColor: theme.backgroundSelected }]}>
              <View style={styles.sectionHeader}>
                <SymbolView
                  name={{
                    ios: 'exclamationmark.triangle.fill',
                    android: 'warning',
                    web: 'warning',
                  }}
                  tintColor={theme.textSecondary}
                  size={20}
                />
                <ThemedText type="smallBold" style={styles.sectionTitle}>
                  Estás usando la app como invitado
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                Tus ofertas y votos están ligados solo a este teléfono. Si desinstalas la app o
                cambias de teléfono, los perderás.
              </ThemedText>

              <View style={styles.benefits}>
                {BENEFITS.map((benefit) => (
                  <View key={benefit.text} style={styles.benefit}>
                    <View style={[styles.benefitIcon, { backgroundColor: `${theme.accent}1F` }]}>
                      <SymbolView name={benefit.icon} tintColor={theme.accent} size={18} />
                    </View>
                    <ThemedText type="small" style={styles.benefitText}>
                      {benefit.text}
                    </ThemedText>
                  </View>
                ))}
              </View>

              <GoogleLinkButton onPress={onLinkGoogle} loading={linking} />
            </ThemedView>
          )}

          <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
            MarketApp {Constants.expoConfig?.version ?? ''} · Gran Concepción
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function StatTile({ label, value }: { label: string; value: number | null }) {
  const theme = useTheme();
  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.stat, { borderColor: theme.backgroundSelected }]}>
      <ThemedText style={styles.statValue}>{value ?? '–'}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.four,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  stat: {
    flex: 1,
    gap: Spacing.half,
    padding: Spacing.three,
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statValue: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 800,
    fontVariant: ['tabular-nums'],
  },
  section: {
    gap: Spacing.three,
    padding: Spacing.three + Spacing.one,
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  benefits: {
    gap: Spacing.three,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
  },
  footer: {
    textAlign: 'center',
  },
});
