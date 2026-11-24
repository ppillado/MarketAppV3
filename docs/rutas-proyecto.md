# MarketApp — Mapa de archivos del proyecto

Todos los archivos de código propio, agrupados en **Frontend**, **Backend** y **Conexión y configuración**.
No incluye `node_modules/`, imágenes (`assets/`) ni archivos generados.

---

## 1. FRONTEND (la app en el celular)

### 1.1 Navegación y rutas (Expo Router: cada archivo de `src/app/` es una pantalla)
- [src/app/_layout.tsx](<../src/app/_layout.tsx>) — raíz de la app: carga los proveedores de datos y define la navegación principal
- [src/app/(tabs)/_layout.tsx](<../src/app/(tabs)/_layout.tsx>) — agrupa las 4 pestañas inferiores
- [src/app/(tabs)/index.tsx](<../src/app/(tabs)/index.tsx>) — ruta de la pestaña **Mapa** (abre MapScreen)
- [src/app/(tabs)/offers.tsx](<../src/app/(tabs)/offers.tsx>) — ruta de la pestaña **Ofertas** (abre OffersScreen)
- [src/app/(tabs)/report.tsx](<../src/app/(tabs)/report.tsx>) — ruta de la pestaña **Reportar** (abre ReportScreen)
- [src/app/(tabs)/profile.tsx](<../src/app/(tabs)/profile.tsx>) — ruta de la pestaña **Perfil** (abre ProfileScreen)
- [src/app/store/[id].tsx](<../src/app/store/[id].tsx>) — ruta de la **Ficha de local** (hoja que sube sobre el mapa)
- [src/app/auth-callback.tsx](<../src/app/auth-callback.tsx>) — pantalla a la que vuelve la app después de vincular Google
- [src/components/app-tabs.tsx](<../src/components/app-tabs.tsx>) — barra de pestañas nativa (íconos y nombres)
- [src/components/app-tabs.web.tsx](<../src/components/app-tabs.web.tsx>) — versión web de la barra de pestañas

### 1.2 Pantallas
- [src/features/map/screens/MapScreen.tsx](<../src/features/map/screens/MapScreen.tsx>) — **Mapa**: pines de locales, filtro por categoría, botón "mi ubicación"
- [src/features/offers/screens/OffersScreen.tsx](<../src/features/offers/screens/OffersScreen.tsx>) — **Ofertas**: lista con búsqueda, filtros y orden ("Para ti")
- [src/features/reports/screens/ReportScreen.tsx](<../src/features/reports/screens/ReportScreen.tsx>) — **Reportar**: formulario para publicar una oferta
- [src/features/profile/screens/ProfileScreen.tsx](<../src/features/profile/screens/ProfileScreen.tsx>) — **Perfil**: cuenta, intereses y vinculación con Google
- [src/features/stores/screens/StoreScreen.tsx](<../src/features/stores/screens/StoreScreen.tsx>) — **Ficha de local**: datos del local y sus ofertas vigentes

### 1.3 Componentes visuales
**Mapa**
- [src/features/map/components/PriceMap.tsx](<../src/features/map/components/PriceMap.tsx>) — el mapa (Google Maps en Android, Apple Maps en iOS)
- [src/features/map/components/PriceMap.web.tsx](<../src/features/map/components/PriceMap.web.tsx>) — aviso en web (el mapa solo funciona en celular)
- [src/features/map/components/PriceMap.types.ts](<../src/features/map/components/PriceMap.types.ts>) — tipos que comparten ambas versiones del mapa
- [src/features/map/components/StorePin.tsx](<../src/features/map/components/StorePin.tsx>) — pin de un local con el número de ofertas
- [src/features/map/components/ClusterPin.tsx](<../src/features/map/components/ClusterPin.tsx>) — círculo que agrupa varios locales cercanos
- [src/features/map/components/LocationPermissionBanner.tsx](<../src/features/map/components/LocationPermissionBanner.tsx>) — aviso para pedir permiso de ubicación

**Ofertas**
- [src/features/offers/components/OfferCard.tsx](<../src/features/offers/components/OfferCard.tsx>) — tarjeta de una oferta en la lista
- [src/features/offers/components/OffersToolbar.tsx](<../src/features/offers/components/OffersToolbar.tsx>) — buscador, selector de orden y categorías
- [src/features/offers/components/VoteBar.tsx](<../src/features/offers/components/VoteBar.tsx>) — botones "👍 Confirmar" / "👎 Agotado/Error"
- [src/features/offers/components/TrustBadge.tsx](<../src/features/offers/components/TrustBadge.tsx>) — sello "verificada" / "en revisión"

**Ficha de local**
- [src/features/stores/components/StoreOfferCard.tsx](<../src/features/stores/components/StoreOfferCard.tsx>) — tarjeta de oferta dentro de la ficha del local

**Reportar**
- [src/features/reports/components/FormField.tsx](<../src/features/reports/components/FormField.tsx>) — campo de formulario con etiqueta y mensaje de error
- [src/features/reports/components/NearbyStorePicker.tsx](<../src/features/reports/components/NearbyStorePicker.tsx>) — lista para elegir un local cercano o crear uno nuevo

**Perfil**
- [src/features/profile/components/AccountCard.tsx](<../src/features/profile/components/AccountCard.tsx>) — muestra si eres invitado o tienes cuenta Google
- [src/features/profile/components/InterestsCard.tsx](<../src/features/profile/components/InterestsCard.tsx>) — "Tus intereses": categorías favoritas
- [src/features/profile/components/GoogleLinkButton.tsx](<../src/features/profile/components/GoogleLinkButton.tsx>) — botón oficial "Continuar con Google"

**Comunes**
- [src/components/category-chips.tsx](<../src/components/category-chips.tsx>) — fila de categorías para filtrar (selección simple o múltiple)
- [src/components/category-pill.tsx](<../src/components/category-pill.tsx>) — etiqueta pequeña con la categoría de una oferta
- [src/components/themed-text.tsx](<../src/components/themed-text.tsx>) — texto que se adapta a modo claro/oscuro
- [src/components/themed-view.tsx](<../src/components/themed-view.tsx>) — contenedor que se adapta a modo claro/oscuro
- [src/components/animated-icon.tsx](<../src/components/animated-icon.tsx>) — animación de la pantalla de inicio (splash)
- [src/components/animated-icon.web.tsx](<../src/components/animated-icon.web.tsx>) — versión web de la animación de inicio
- [src/components/animated-icon.module.css](<../src/components/animated-icon.module.css>) — estilos de la animación (web)
- [src/components/external-link.tsx](<../src/components/external-link.tsx>) — enlace que abre páginas externas dentro de la app

### 1.4 Lógica local y estado (lo que se calcula en el celular)
**Estado global ("proveedores")**
- [src/features/location/LocationProvider.tsx](<../src/features/location/LocationProvider.tsx>) — ubicación GPS del usuario y permisos
- [src/features/offers/OffersProvider.tsx](<../src/features/offers/OffersProvider.tsx>) — ofertas cercanas, con caché para abrir sin internet
- [src/features/stores/StoresProvider.tsx](<../src/features/stores/StoresProvider.tsx>) — locales del mapa, con caché
- [src/features/offers/OfferVotesProvider.tsx](<../src/features/offers/OfferVotesProvider.tsx>) — votos del usuario (confirmar/reportar) y ofertas ocultas
- [src/features/preferences/PreferencesProvider.tsx](<../src/features/preferences/PreferencesProvider.tsx>) — categorías favoritas del usuario

**Reglas y algoritmos**
- [src/features/offers/recommendOffers.ts](<../src/features/offers/recommendOffers.ts>) — **algoritmo "Para ti"** (puntaje por categoría, distancia, frescura y votos)
- [src/features/offers/offerTrust.ts](<../src/features/offers/offerTrust.ts>) — reglas de confianza: verificada, en revisión, oculta
- [src/features/reports/offerValidation.ts](<../src/features/reports/offerValidation.ts>) — **validaciones del formulario** (nombre y precio)
- [src/constants/categories.ts](<../src/constants/categories.ts>) — lista de categorías (abarrotes, lácteos, panadería…)
- [src/features/map/constants.ts](<../src/features/map/constants.ts>) — región inicial del mapa (Gran Concepción)

**Hooks (funciones reutilizables de pantalla)**
- [src/features/offers/hooks/useOffers.ts](<../src/features/offers/hooks/useOffers.ts>) — ofertas con la distancia al usuario ya calculada
- [src/features/map/hooks/useStoreClusters.ts](<../src/features/map/hooks/useStoreClusters.ts>) — agrupa pines cercanos según el zoom
- [src/features/reports/hooks/usePhotoPicker.ts](<../src/features/reports/hooks/usePhotoPicker.ts>) — elegir o tomar la foto de la oferta
- [src/features/reports/hooks/useCurrentLocation.ts](<../src/features/reports/hooks/useCurrentLocation.ts>) — ubicación al momento de reportar
- [src/features/stores/hooks/useNearbyStoreSearch.ts](<../src/features/stores/hooks/useNearbyStoreSearch.ts>) — busca locales a menos de 200 m al reportar
- [src/features/stores/hooks/useStoreOffers.ts](<../src/features/stores/hooks/useStoreOffers.ts>) — ofertas de un local para su ficha
- [src/features/auth/useAuthUser.ts](<../src/features/auth/useAuthUser.ts>) — usuario actual (invitado o con Google)

**Utilidades**
- [src/lib/geo.ts](<../src/lib/geo.ts>) — distancia en metros entre dos puntos (fórmula de haversine)
- [src/lib/format.ts](<../src/lib/format.ts>) — formato de precio ($1.990), tiempo ("hace 5 min") y distancia
- [src/lib/text.ts](<../src/lib/text.ts>) — normaliza texto (sin tildes ni mayúsculas) para la búsqueda
- [src/features/offers/mockOffers.ts](<../src/features/offers/mockOffers.ts>) — ofertas de ejemplo si no hay conexión a Supabase

**Tipos de datos**
- [src/types/offer.ts](<../src/types/offer.ts>) — forma de una oferta
- [src/types/store.ts](<../src/types/store.ts>) — forma de un local
- [src/types/geo.ts](<../src/types/geo.ts>) — coordenadas y región del mapa

### 1.5 Tema y estilos
- [src/constants/theme.ts](<../src/constants/theme.ts>) — colores, espaciados y tipografía
- [src/hooks/use-theme.ts](<../src/hooks/use-theme.ts>) — colores del modo actual (claro/oscuro)
- [src/hooks/use-color-scheme.ts](<../src/hooks/use-color-scheme.ts>) — detecta modo claro/oscuro del teléfono
- [src/hooks/use-color-scheme.web.ts](<../src/hooks/use-color-scheme.web.ts>) — lo mismo para la versión web
- [src/global.css](<../src/global.css>) — estilos globales (web)

---

## 2. BACKEND (Supabase: base de datos, seguridad y funciones)

### 2.1 Migraciones (en orden; cada una construye sobre la anterior)
- [supabase/migrations/20261002000000_create_offers.sql](<../supabase/migrations/20261002000000_create_offers.sql>) — tabla **`offers`**, RLS de lectura pública y `nearby_offers`
- [supabase/migrations/20261003000000_submit_offer.sql](<../supabase/migrations/20261003000000_submit_offer.sql>) — primera versión de **`submit_offer`** y bucket de fotos con su política
- [supabase/migrations/20261004000000_offer_votes.sql](<../supabase/migrations/20261004000000_offer_votes.sql>) — tabla **`offer_votes`**, su RLS y `set_offer_vote`
- [supabase/migrations/20261005000000_stores.sql](<../supabase/migrations/20261005000000_stores.sql>) — tabla **`stores`**, `nearby_stores`, `get_store_offers`, `find_nearby_stores`
- [supabase/migrations/20261006000000_offer_categories.sql](<../supabase/migrations/20261006000000_offer_categories.sql>) — categorías en las ofertas y filtros
- [supabase/migrations/20261007000000_user_preferences.sql](<../supabase/migrations/20261007000000_user_preferences.sql>) — tabla **`user_preferences`**, su RLS y funciones de favoritas
- [supabase/migrations/20261008000000_offer_moderation.sql](<../supabase/migrations/20261008000000_offer_moderation.sql>) — **anti-troll**: `offer_should_hide`, versión final de `set_offer_vote`, `nearby_offers` y `nearby_stores`
- [supabase/migrations/20261009000000_submit_offer_store_reuse.sql](<../supabase/migrations/20261009000000_submit_offer_store_reuse.sql>) — **versión final de `submit_offer`** (evita ofertas duplicadas)

### 2.2 Datos de ejemplo
- [supabase/seed.sql](<../supabase/seed.sql>) — 8 ofertas y locales de demostración en el Gran Concepción

---

## 3. CONEXIÓN Y CONFIGURACIÓN (une frontend y backend)

### 3.1 Conexión con Supabase
- [src/lib/supabase.ts](<../src/lib/supabase.ts>) — **crea la conexión con Supabase** (lee las variables de entorno)
- [src/lib/auth.ts](<../src/lib/auth.ts>) — inicio de sesión anónimo automático (sin crear cuenta)
- [src/lib/kv-storage.ts](<../src/lib/kv-storage.ts>) — almacenamiento local en el celular (SQLite) para sesión y caché
- [src/lib/kv-storage.web.ts](<../src/lib/kv-storage.web.ts>) — lo mismo para la versión web (localStorage)

### 3.2 Llamadas al servidor (APIs)
- [src/features/offers/offersApi.ts](<../src/features/offers/offersApi.ts>) — llama a `nearby_offers` y guarda la caché de ofertas
- [src/features/stores/storesApi.ts](<../src/features/stores/storesApi.ts>) — llama a `nearby_stores`, `get_store_offers` y `find_nearby_stores`
- [src/features/reports/reportsApi.ts](<../src/features/reports/reportsApi.ts>) — **sube la foto** y llama a `submit_offer`
- [src/features/offers/votesApi.ts](<../src/features/offers/votesApi.ts>) — llama a `set_offer_vote` y lee los votos del usuario
- [src/features/preferences/preferencesApi.ts](<../src/features/preferences/preferencesApi.ts>) — llama a `get_my_preferences` y `set_favorite_categories`
- [src/features/profile/hooks/useMyOfferCount.ts](<../src/features/profile/hooks/useMyOfferCount.ts>) — cuenta las ofertas publicadas por el usuario

### 3.3 Servicios externos (Google)
- [src/features/auth/googleAuth.ts](<../src/features/auth/googleAuth.ts>) — **vincular cuenta con Google** (OAuth)
- [src/lib/directions.ts](<../src/lib/directions.ts>) — abre Google Maps / Apple Maps con la ruta al local

### 3.4 Configuración del proyecto
- [package.json](<../package.json>) — dependencias y comandos del proyecto
- [app.json](<../app.json>) — configuración de Expo (nombre, permisos, plugins). ⚠️ **No abrir en la presentación: tiene la clave de Google Maps (línea ~23)**
- [eas.json](<../eas.json>) — perfiles de compilación en la nube (desarrollo, preview/APK, producción)
- [.env.example](<../.env.example>) — **plantilla** de variables de entorno, sin valores (✅ seguro de mostrar)
- `.env.local` — ⚠️ **NO ABRIR: contiene las claves reales de Supabase** (no está en git)
- [tsconfig.json](<../tsconfig.json>) — configuración de TypeScript
- [eslint.config.js](<../eslint.config.js>) — reglas de estilo de código (lint)
- [scripts/reset-project.js](<../scripts/reset-project.js>) — script de la plantilla de Expo (no se usa en la app)
