// Helper test database: membuat database Postgres sementara, menjalankan tiruan auth
// Supabase + semua migrasi, lalu menjalankan SQL sebagai pengguna tertentu.
// Butuh TEST_DATABASE_URL (koneksi superuser) dan perintah `psql`.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const serverUrl = process.env.TEST_DATABASE_URL;
export const skipReason = serverUrl
  ? false
  : "TEST_DATABASE_URL belum diisi, test database dilewati";

const dir = import.meta.dirname;

function psql(url: string, script: string): string {
  return execFileSync(
    "psql",
    [url, "-At", "-q", "-v", "ON_ERROR_STOP=1", "-f", "-"],
    {
      input: script,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  ).trim();
}

function withDatabase(url: string, name: string) {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

export function createTestDb() {
  const name = `kita_test_${randomUUID().replaceAll("-", "")}`;
  psql(serverUrl!, `create database ${name};`);
  const url = withDatabase(serverUrl!, name);

  const migrations = readdirSync(join(dir, "../migrations"))
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(join(dir, "../migrations", file), "utf8"));
  psql(
    url,
    [readFileSync(join(dir, "auth-stub.sql"), "utf8"), ...migrations].join(
      "\n",
    ),
  );

  return {
    /** SQL sebagai superuser (tanpa RLS), untuk menyiapkan data. */
    admin: (script: string) => psql(url, script),
    /** SQL sebagai pengguna login (role authenticated) dengan id auth tertentu. */
    as: (authUserId: string, script: string) =>
      psql(
        url,
        `begin;
set local role authenticated;
set local request.jwt.claims = '${JSON.stringify({ sub: authUserId })}';
${script}
commit;`,
      ),
    /** SQL sebagai pengunjung yang belum login (role anon). */
    anon: (script: string) =>
      psql(url, `begin; set local role anon; ${script} commit;`),
    drop: () => psql(serverUrl!, `drop database ${name} with (force);`),
  };
}
