// Semua teks layar ada di sini. Kunci "id" dan "en" harus sama persis.
const id = {
  appTagline:
    "Aplikasi manajemen rumah tangga untuk meningkatkan keterlibatan dan kesadaran anggota keluarga terhadap tugas rumah.",
  languageLabel: "Bahasa",
  email: "Email",
  password: "Kata sandi",
  passwordHint: "Minimal 8 karakter",
  familyName: "Nama keluarga",
  fatherName: "Nama Ayah",
  register: "Daftar",
  registerTitle: "Daftarkan keluarga",
  login: "Masuk",
  loginTitle: "Masuk ke KITA",
  logout: "Keluar",
  haveAccount: "Sudah punya akun?",
  noAccount: "Belum punya akun?",
  loading: "Memuat…",
  checkEmail:
    "Akun dibuat. Buka email konfirmasi yang kami kirim, lalu masuk dengan email dan kata sandi ini.",
  greeting: "Halo",
  noFamily: "Akun ini belum terhubung ke keluarga.",
  errorGeneric: "Terjadi kesalahan. Coba lagi.",
  errorLogin: "Email atau kata sandi salah, atau email belum dikonfirmasi.",
};

const en: typeof id = {
  appTagline:
    "A household management app that raises family members' engagement with, and awareness of, household chores.",
  languageLabel: "Language",
  email: "Email",
  password: "Password",
  passwordHint: "At least 8 characters",
  familyName: "Family name",
  fatherName: "Father's name",
  register: "Sign up",
  registerTitle: "Register your family",
  login: "Log in",
  loginTitle: "Log in to KITA",
  logout: "Log out",
  haveAccount: "Already have an account?",
  noAccount: "No account yet?",
  loading: "Loading…",
  checkEmail:
    "Account created. Open the confirmation email we sent, then log in with this email and password.",
  greeting: "Hello",
  noFamily: "This account is not linked to a family yet.",
  errorGeneric: "Something went wrong. Please try again.",
  errorLogin: "Wrong email or password, or the email is not confirmed yet.",
};

export const messages = { id, en };

export type Language = keyof typeof messages;
export const languages = Object.keys(messages) as Language[];
export const defaultLanguage: Language = "id";
