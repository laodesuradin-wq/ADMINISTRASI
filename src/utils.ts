/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const STORAGE_KEY = "SIAK_AMAHOLU_DB";
export const SESSION_KEY = "SIAK_AMAHOLU_SESSION";
export const ADMIN_PASSWORD = "admin123";
export const ADMIN_EMAIL = "laodesuradin@gmail.com";

export function formatTanggalIndonesia(tanggal: string): string {
  if (!tanggal) return "-";
  const bulan = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const t = new Date(tanggal);
  if (isNaN(t.getTime())) return tanggal;

  const hari = t.getDate();
  const namaBulan = bulan[t.getMonth()];
  const tahun = t.getFullYear();

  return `${hari} ${namaBulan} ${tahun}`;
}

export function hitungUmur(tglLahir: string): number {
  if (!tglLahir) return 0;
  const today = new Date();
  const birth = new Date(tglLahir);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function generateNomorSurat(): string {
  const year = new Date().getFullYear();
  return `      /KD/DAL/${year}`;
}
