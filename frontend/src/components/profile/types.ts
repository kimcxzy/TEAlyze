/** Resposta de GET /profile (e PUT /profile). */
export type ProfileData = {
  role: "caregiver" | "professional";
  account: {
    id: string;
    email: string;
    name: string;
    phone: string;
    birthdate: string | null; // AAAA-MM-DD
    created_at: string;
  };
  caregiver: { cpf: string | null; relationship: string; occupation: string } | null;
  patient: {
    id: string;
    name: string;
    cpf: string | null;
    support_level: number | null;
    cid11: string;
    diagnosis_date: string | null;
    history: string;
    notes: string;
  } | null;
  professional: {
    cpf: string | null;
    registry: string;
    registry_body: string;
    verified: boolean;
    specialty: string;
    formation: string;
    bio: string;
    experience_years: number | null;
    address: string;
    number: string;
    district: string;
    city: string;
    state: string;
    zip: string;
    latitude: number | null;
    longitude: number | null;
    teleconsulta: boolean;
  } | null;
  aq: { score: number; interpretation: string; submitted_at: string } | null;
  stats: {
    appointments: number;
    upcoming_appointments: number;
    laudos: number;
    laudos_valid: number;
  };
};
