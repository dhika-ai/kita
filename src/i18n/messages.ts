// Semua teks layar ada di sini. Kunci "id" dan "en" harus sama persis.
const id = {
  appTagline:
    "Aplikasi manajemen rumah tangga untuk meningkatkan keterlibatan dan kesadaran anggota keluarga terhadap tugas rumah.",
  languageLabel: "Bahasa",
};

const en: typeof id = {
  appTagline:
    "A household management app that raises family members' engagement with, and awareness of, household chores.",
  languageLabel: "Language",
};

export const messages = { id, en };

export type Language = keyof typeof messages;
export const languages = Object.keys(messages) as Language[];
export const defaultLanguage: Language = "id";
