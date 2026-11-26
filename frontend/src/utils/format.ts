/** Formatação e máscaras de entrada (pt-BR). */

const onlyDigits = (v: string) => (v || "").replace(/\D/g, "");

/** "2018-03-15" -> "15/03/2018" (vazio se não houver data). */
export function isoToBr(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Máscara enquanto digita: 15032018 -> 15/03/2018. */
export function maskDate(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** 12345678909 -> 123.456.789-09 (parcial enquanto digita). */
export function maskCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** 01310100 -> 01310-100. */
export function maskCep(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** CPF parcialmente oculto para exibição: ***.456.789-** */
export function hideCpf(cpf: string | null | undefined): string {
  const d = onlyDigits(cpf || "");
  if (d.length !== 11) return "";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

/** ISO local ("2026-10-12T14:30:00") -> "12/10/2026 14:30". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function formatDate(iso: string | null | undefined): string {
  const full = formatDateTime(iso);
  return full ? full.slice(0, 10) : "";
}
