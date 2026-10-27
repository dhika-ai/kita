import type { messages } from "../i18n/messages.ts";
import type { Role } from "./auth.ts";

type MenuItem = {
  href: string;
  label: keyof (typeof messages)["id"];
  roles: Role[];
  icon: string; // path SVG 24x24
};

const everyone: Role[] = ["father", "mother", "child", "art"];
const parents: Role[] = ["father", "mother"];

// Menu per peran. Fitur rilis berikutnya menambah barisnya di sini saat sudah siap.
const menu: MenuItem[] = [
  {
    href: "/",
    label: "home",
    roles: everyone,
    icon: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z",
  },
  {
    href: "/tugas/baru",
    label: "newTask",
    roles: ["father", "mother", "child"],
    icon: "M12 5v14M5 12h14",
  },
  {
    href: "/persetujuan",
    label: "approvals",
    roles: parents,
    icon: "M4 12l5 5L20 6",
  },
  {
    href: "/keluarga",
    label: "familyMembers",
    roles: parents,
    icon: "M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM1 21v-2a6 6 0 0 1 12 0v2zm14 0v-2a6 6 0 0 0-1.5-4A5 5 0 0 1 23 19v2z",
  },
  {
    href: "/master-data",
    label: "masterData",
    roles: parents,
    icon: "M4 6h16M4 12h16M4 18h10",
  },
  {
    href: "/ganti",
    label: "switchUser",
    roles: everyone,
    icon: "M7 7h13l-4-4m4 4-4 4M17 17H4l4 4m-4-4 4-4",
  },
];

export function menuFor(role: Role) {
  return menu.filter((item) => item.roles.includes(role));
}
