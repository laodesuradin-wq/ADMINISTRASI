/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Resident {
  nama: string;
  nik: string;
  tempat_lahir: string;
  tgl: string;
  jk: "Laki-laki" | "Perempuan" | "";
  hubungan: "Kepala Keluarga" | "Istri" | "Anak" | "Lainnya" | "";
  agama: "Islam" | "Kristen" | "Katolik" | "Hindu" | "Budha" | "Konghucu" | "";
  pendidikan: string;
  pekerjaan: string;
  bansos: string;
}

export interface Family {
  no_kk: string;
  alamat: string;
  rt_rw: string;
  Desa: string;
  Kecamatan: string;
  Kabupaten: string;
  Provinsi: string;
  anggota: Resident[];
}

export interface AuthSession {
  role: "warga" | "admin";
  no_kk?: string;
  nama: string;
  email?: string;
}

export type LetterType = 
  | "Surat Keterangan Usaha" 
  | "Surat Keterangan Tidak Mampu" 
  | "Surat Keterangan Kematian" 
  | "Surat Keterangan Pendidikan"
  | "Surat Keterangan Domisili";
