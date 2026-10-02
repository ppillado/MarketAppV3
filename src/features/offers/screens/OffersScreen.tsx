import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { distanceInMeters } from '@/lib/geo';

import { OfferCard } from '../components/OfferCard';
import { MOCK_OFFERS, MOCK_USER_COORDS } from '../mockOffers';

const offers = [...MOCK_OFFERS].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

export default function OffersScreen() {
  // Fixed reference time per mount, so "hace X min" stays consistent while scrolling.
  const [now] = useState(() => Date.now());

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.container}>
        <FlatList
          data={offers}
          keyExtractor={(offer) => offer.id}
          renderItem={({ item }) => (
            <OfferCard
              offer={item}
              distanceMeters={distanceInMeters(MOCK_USER_COORDS, item.coords)}
              now={now}
            />
          )}
          ListHeaderComponent={
            <View style={styles.header}>
              <ThemedText type="subtitle">Ofertas</ThemedText>
              <ThemedText themeColor="textSecondary">
                Precios reportados por tus vecinos en el Gran Concepción.
              </ThemedText>
            </View>
          }
          ItemSeparatorComponent={Separator}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: BottomTabInset + Spacing.five },
          ]}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function Separator() {
  return <View style={styles.separator} />;
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
  },
  header: {
    gap: Spacing.one,
    marginBottom: Spacing.four,
  },
  separator: {
    height: Spacing.three,
  },
});
