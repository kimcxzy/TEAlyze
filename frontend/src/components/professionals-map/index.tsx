// Mapa NATIVO (iOS/Android). No navegador o Metro usa index.web.tsx (Leaflet).
import { StyleSheet } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";

import { DEFAULT_CENTER, type ProfessionalsMapProps } from "./types";

export function ProfessionalsMap({ professionals, selectedId, onSelect, isDark, colors, testID }: ProfessionalsMapProps) {
  return (
    <MapView
      testID={testID}
      provider={PROVIDER_DEFAULT}
      style={StyleSheet.absoluteFill}
      userInterfaceStyle={isDark ? "dark" : "light"}
      initialRegion={{
        latitude: DEFAULT_CENTER.latitude,
        longitude: DEFAULT_CENTER.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
    >
      {professionals.map((p) => (
        <Marker
          key={p.id}
          coordinate={{ latitude: p.latitude, longitude: p.longitude }}
          title={p.name}
          description={p.specialty}
          onPress={() => onSelect(p.id)}
          pinColor={p.id === selectedId ? colors.success : colors.brandPrimary}
        />
      ))}
    </MapView>
  );
}

export default ProfessionalsMap;
