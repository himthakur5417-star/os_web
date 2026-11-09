export const PAYMENT_ACCESS_DAYS = 365;
export const PAYMENT_CURRENCY = process.env.UPI_CURRENCY || "INR";

export type PaidSubjectId = "nda-mathematics" | "cds-mathematics" | "nda-cds-english";

export interface PaidSubjectConfig {
  id: PaidSubjectId;
  title: string;
  amountEnv: string;
  vaultRoot: string;
}

export const PAID_SUBJECTS: readonly PaidSubjectConfig[] = [
  {
    id: "nda-mathematics",
    title: "NDA Mathematics",
    amountEnv: "UPI_NDA_MATHEMATICS_AMOUNT_PAISE",
    vaultRoot: "NDA mathematics",
  },
  {
    id: "cds-mathematics",
    title: "CDS Mathematics",
    amountEnv: "UPI_CDS_MATHEMATICS_AMOUNT_PAISE",
    vaultRoot: "CDS mathematics",
  },
  {
    id: "nda-cds-english",
    title: "NDA/CDS English",
    amountEnv: "UPI_NDA_CDS_ENGLISH_AMOUNT_PAISE",
    vaultRoot: "NDA CDS English",
  },
];

export const FREE_VAULT_ROOTS = new Set(["PYQ", "Syllabus"]);

export function getPaidSubject(subjectId: string): PaidSubjectConfig | null {
  return PAID_SUBJECTS.find((subject) => subject.id === subjectId) || null;
}

export const DEFAULT_SUBJECT_AMOUNT_PAISE = 14900;

export function getConfiguredAmount(subject: PaidSubjectConfig): number {
  const raw = process.env[subject.amountEnv];
  if (raw && /^\d+$/.test(raw.trim())) {
    const amount = Number(raw);
    if (Number.isSafeInteger(amount) && amount >= 100) return amount;
  }
  return DEFAULT_SUBJECT_AMOUNT_PAISE;
}

export function getPublicSubjectCatalog() {
  return PAID_SUBJECTS.map((subject) => ({
    id: subject.id,
    title: subject.title,
    amountPaise: getConfiguredAmount(subject),
    currency: PAYMENT_CURRENCY,
    accessDays: PAYMENT_ACCESS_DAYS,
    configured: Boolean(getConfiguredAmount(subject)),
  }));
}

export function subjectForVaultRoot(root: string): PaidSubjectConfig | null {
  return PAID_SUBJECTS.find((subject) => subject.vaultRoot.toLowerCase() === root.toLowerCase()) || null;
}

export function subjectForDocumentRef(docRef: string): PaidSubjectId | null {
  if (!docRef) return null;
  if (docRef.startsWith("vault:")) {
    const key = docRef.slice("vault:".length);
    const match = key.match(/^(nda-mathematics|cds-mathematics|nda-cds-english)-chapter-\d+$/);
    return match ? (match[1] as PaidSubjectId) : null;
  }
  const root = docRef.replace(/^[/\\]+/, "").split(/[\\/]/)[0] || "";
  if (!root || FREE_VAULT_ROOTS.has(root)) return null;
  return subjectForVaultRoot(root)?.id || null;
}
