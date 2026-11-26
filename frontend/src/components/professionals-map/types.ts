import type { Palette } from "@/src/theme";

export type MapProfessional = {
  id: string;
  name: string;
  specialty?: string;
  latitude: number;
  longitude: number;
};

export type ProfessionalsMapProps = {
  professionals: MapProfessional[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isDark: boolean;
  colors: Palette;
  testID?: string;
};

/** Centro padrão (São Paulo) quando não há profissional com coordenadas. */
export const DEFAULT_CENTER = { latitude: -23.5605, longitude: -46.6543 };
