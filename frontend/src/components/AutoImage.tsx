import { useEffect, useState } from "react";
import { Image, type ImageStyle, type StyleProp } from "react-native";

// Proporção (largura / altura) de cada imagem já medida: evita medir de novo
// ao voltar para o feed e impede a tela de "pular" quando a imagem carrega.
const ratioCache = new Map<string, number>();
const keyOf = (uri: string) => `${uri.length}:${uri.slice(-48)}`;

/** Proporção usada enquanto a imagem ainda está sendo medida. */
const PLACEHOLDER_RATIO = 4 / 3;

type Props = {
  uri: string;
  backgroundColor?: string;
  /**
   * Altura máxima (opcional). Sem ela a imagem aparece inteira, no tamanho
   * proporcional real; com ela, imagens muito altas são reduzidas para caber
   * (nunca cortadas).
   */
  maxHeight?: number;
  style?: StyleProp<ImageStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

/**
 * Imagem que ocupa a largura toda e se ajusta à proporção REAL da foto
 * (retrato, paisagem, quadrada...), sem cortar nem esticar.
 */
export function AutoImage({ uri, backgroundColor, maxHeight, style, testID, accessibilityLabel }: Props) {
  const key = keyOf(uri);
  const [ratio, setRatio] = useState<number | null>(ratioCache.get(key) ?? null);

  useEffect(() => {
    const cached = ratioCache.get(key);
    if (cached) {
      setRatio(cached);
      return;
    }
    let alive = true;
    Image.getSize(
      uri,
      (w, h) => {
        const r = w > 0 && h > 0 ? w / h : 1;
        ratioCache.set(key, r);
        if (alive) setRatio(r);
      },
      () => {
        if (alive) setRatio(1);
      }
    );
    return () => {
      alive = false;
    };
  }, [uri, key]);

  return (
    <Image
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      source={{ uri }}
      resizeMode="contain"
      style={[{ width: "100%", aspectRatio: ratio ?? PLACEHOLDER_RATIO, backgroundColor, maxHeight }, style]}
    />
  );
}
