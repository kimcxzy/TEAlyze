import { Alert, Platform } from "react-native";

type ButtonSpec = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void | Promise<void>;
};

/**
 * Mensagem simples, só com "OK". Substitui `Alert.alert(titulo, msg)`.
 */
export function showAlert(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

/**
 * Confirmação com duas opções (cancelar / confirmar). Substitui
 * `Alert.alert(titulo, msg, [{cancelar}, {confirmar, onPress}])`.
 *
 * Os textos dos botões são só cosméticos no navegador (window.confirm usa
 * OK/Cancelar do próprio navegador) — o que importa é qual callback roda.
 */
export function showConfirm(
  title: string,
  message: string,
  confirmButton: ButtonSpec,
  cancelButton?: ButtonSpec
) {
  if (Platform.OS === "web") {
    const confirmed = window.confirm(`${title}\n\n${message}`);
    if (confirmed) {
      confirmButton.onPress?.();
    } else {
      cancelButton?.onPress?.();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: cancelButton?.text || "Cancelar", style: cancelButton?.style || "cancel", onPress: cancelButton?.onPress },
    { text: confirmButton.text, style: confirmButton.style || "destructive", onPress: confirmButton.onPress },
  ]);
}
