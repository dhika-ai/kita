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
  joinTitle: "Gabung ke keluarga",
  joinIntro: "Kamu diundang bergabung ke KITA. Buat akun untuk masuk.",
  familyMembers: "Anggota keluarga",
  addMember: "Tambah anggota",
  memberName: "Nama",
  role: "Peran",
  role_father: "Ayah",
  role_mother: "Ibu",
  role_child: "Anak",
  role_art: "ART",
  you: "kamu",
  maxMembers: "Maksimal 5 anggota per keluarga.",
  inviteLink: "Link undangan",
  inviteHint:
    "Bagikan link ini ke anggota yang akan masuk dengan akun sendiri.",
  copy: "Salin",
  copied: "Tersalin",
  back: "Kembali",
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
  joinTitle: "Join a family",
  joinIntro: "You have been invited to KITA. Create an account to join.",
  familyMembers: "Family members",
  addMember: "Add member",
  memberName: "Name",
  role: "Role",
  role_father: "Father",
  role_mother: "Mother",
  role_child: "Child",
  role_art: "Helper",
  you: "you",
  maxMembers: "Up to 5 members per family.",
  inviteLink: "Invite link",
  inviteHint:
    "Share this link with members who will log in with their own account.",
  copy: "Copy",
  copied: "Copied",
  back: "Back",
};

export const messages = { id, en };

export type Language = keyof typeof messages;
export const languages = Object.keys(messages) as Language[];
export const defaultLanguage: Language = "id";
