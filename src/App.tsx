/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  Users, 
  FileText, 
  BarChart3, 
  PlusCircle, 
  LogOut, 
  Search, 
  Shield, 
  User as UserIcon, 
  MessageSquare, 
  X, 
  Send,
  Printer,
  FileDown,
  Trash2,
  Edit,
  Save,
  ChevronRight,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Family, AuthSession, LetterType, Resident } from './types';
import { 
  STORAGE_KEY, 
  SESSION_KEY, 
  ADMIN_EMAIL, 
  ADMIN_PASSWORD, 
  formatTanggalIndonesia, 
  hitungUmur, 
  generateNomorSurat 
} from './utils';

// --- COMPONENTS ---

export default function App() {
  const [db, setDb] = useState<Family[]>([]);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [view, setView] = useState<'login' | 'dashboard'>('login');
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [currentFamily, setCurrentFamily] = useState<Family | null>(null);
  const [activeLetter, setActiveLetter] = useState<LetterType | null>(null);
  const [letterData, setLetterData] = useState<any>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{text: string, type: 'user' | 'ai'}[]>([
    { text: "Selamat datang! Saya adalah asisten digital Dusun Amaholu Losy. Ada yang bisa saya bantu terkait layanan administrasi hari ini?", type: 'ai' }
  ]);

  // Load Initial Data
  useEffect(() => {
    const savedDb = localStorage.getItem(STORAGE_KEY);
    if (savedDb) setDb(JSON.parse(savedDb));

    const savedSession = sessionStorage.getItem(SESSION_KEY);
    if (savedSession) {
      setSession(JSON.parse(savedSession));
      setView('dashboard');
    }
  }, []);

  useEffect(() => {
    if (db.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    }
  }, [db]);

  const handleLogin = (user: AuthSession) => {
    setSession(user);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    setView('dashboard');
  };

  const handleLogout = () => {
    if (window.confirm("Yakin ingin logout?")) {
      setSession(null);
      sessionStorage.removeItem(SESSION_KEY);
      setView('login');
      setActiveModal(null);
    }
  };

  const filteredFamilies = useMemo(() => {
    if (!session) return [];
    let base = db;
    if (session.role === 'warga') {
      base = db.filter(f => f.no_kk === session.no_kk);
    }
    
    return base.filter(f => {
      const kepala = f.anggota.find(a => a.hubungan === 'Kepala Keluarga')?.nama || '';
      return f.no_kk.includes(searchTerm) || kepala.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [db, session, searchTerm]);

  // Modals Handler
  const openEditModal = (index: number) => {
    setEditingIndex(index);
    setCurrentFamily(JSON.parse(JSON.stringify(db[index])));
    setActiveModal('family');
  };

  const openNewFamilyModal = () => {
    setEditingIndex(null);
    setCurrentFamily({
      no_kk: '',
      alamat: 'Amaholu Losy',
      rt_rw: '',
      Desa: 'Luhu',
      Kecamatan: 'Huamual',
      Kabupaten: 'Seram Bagian Barat',
      Provinsi: 'Maluku',
      anggota: []
    });
    setActiveModal('family');
  };

  const saveFamily = (family: Family) => {
    if (editingIndex !== null) {
      const newDb = [...db];
      newDb[editingIndex] = family;
      setDb(newDb);
    } else {
      setDb([...db, family]);
    }
    setActiveModal(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <AnimatePresence mode="wait">
        {view === 'login' ? (
          <LoginView key="login" onLogin={handleLogin} />
        ) : (
          <DashboardView 
            key="dashboard"
            session={session!}
            families={filteredFamilies}
            allFamilies={db}
            onLogout={handleLogout}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            openEditModal={openEditModal}
            openNewFamilyModal={openNewFamilyModal}
            openStats={() => setActiveModal('stats')}
            openLetter={(type) => { setActiveLetter(type); setActiveModal('letter'); }}
            onDelete={(index) => {
              if (window.confirm("Hapus data KK ini?")) {
                const newDb = db.filter((_, i) => i !== index);
                setDb(newDb);
              }
            }}
            resetDb={() => {
              const pass = window.prompt("Masukkan password admin untuk reset:");
              if (pass === ADMIN_PASSWORD) {
                setDb([]);
                alert("Database berhasil direset.");
              } else if (pass !== null) {
                alert("Password salah.");
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* MODALS */}
      {activeModal === 'family' && currentFamily && (
        <FamilyModal 
          family={currentFamily} 
          onSave={saveFamily} 
          onClose={() => setActiveModal(null)} 
        />
      )}

      {activeModal === 'stats' && (
        <StatsModal db={db} onClose={() => setActiveModal(null)} />
      )}

      {activeModal === 'letter' && activeLetter && (
        <LetterModal 
          type={activeLetter} 
          db={db}
          session={session!}
          onClose={() => setActiveModal(null)}
          onPreview={(data) => {
            setLetterData(data);
            setActiveModal('preview');
          }}
        />
      )}

      {activeModal === 'preview' && letterData && (
        <PreviewModal 
          data={letterData} 
          onClose={() => setActiveModal('letter')} 
        />
      )}

      {/* CHATBOT */}
      <div className="fixed bottom-6 right-6 z-50">
        <AnimatePresence>
          {showChat && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="mb-4 w-80 h-96 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
            >
              <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <MessageSquare size={18} />
                  <span className="font-semibold text-sm">Asisten SIAK</span>
                </div>
                <button onClick={() => setShowChat(false)} className="hover:opacity-80"><X size={18} /></button>
              </div>
              <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-3">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                      msg.type === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t flex gap-2">
                <input 
                  type="text" 
                  placeholder="Tanya sesuatu..."
                  className="flex-1 bg-slate-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const text = e.currentTarget.value;
                      if (!text) return;
                      setChatMessages([...chatMessages, { text, type: 'user' }]);
                      e.currentTarget.value = '';
                      // AI dummy response
                      setTimeout(() => {
                        let response = "Maaf, saya kurang mengerti. Bisa ditanyakan hal lain?";
                        const lowText = text.toLowerCase();
                        if (lowText.includes('surat')) response = "Anda bisa membuat surat melalui menu 'Layanan Surat' di sidebar.";
                        else if (lowText.includes('statistik')) response = "Statistik hanya bisa dilihat oleh Admin.";
                        else if (lowText.includes('halo')) response = "Halo! Apa ada yang bisa saya bantu hari ini?";
                        setChatMessages(prev => [...prev, { text: response, type: 'ai' }]);
                      }, 500);
                    }
                  }}
                />
                <button className="bg-blue-600 text-white p-2 rounded-full"><Send size={18} /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <button 
          onClick={() => setShowChat(!showChat)}
          className="bg-blue-600 p-4 rounded-full text-white shadow-xl hover:scale-110 transition-transform active:scale-95"
        >
          <MessageSquare />
        </button>
      </div>
    </div>
  );
}

// --- SUB-VIEWS ---

function LoginView({ onLogin }: { onLogin: (u: AuthSession) => void, key?: React.Key }) {
  const [role, setRole] = useState<'warga' | 'admin'>('warga');
  const [noKK, setNoKK] = useState('');
  const [password, setPassword] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [error, setError] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const db = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

    if (role === 'warga') {
      const family = db.find((f: Family) => f.no_kk === noKK);
      if (!family) return setError("Nomor KK tidak ditemukan.");
      const kepala = family.anggota.find((a: Resident) => a.hubungan === 'Kepala Keluarga');
      if (!kepala) return setError("Data Kepala Keluarga tidak ditemukan.");
      if (kepala.nik !== password) return setError("Password (NIK) salah.");
      
      onLogin({ role: 'warga', no_kk: noKK, nama: kepala.nama });
    } else {
      if (adminEmail === ADMIN_EMAIL && adminPass === ADMIN_PASSWORD) {
        onLogin({ role: 'admin', nama: 'Administrator', email: adminEmail });
      } else {
        setError("Email atau Password admin salah.");
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-700 via-blue-900 to-slate-950"
    >
      <div className="w-full max-w-5xl bg-white/10 backdrop-blur-xl border border-white/20 rounded-[40px] overflow-hidden shadow-2xl flex flex-col md:flex-row">
        <div className="w-full md:w-1/2 p-12 text-white flex flex-col justify-center">
          <div className="inline-flex px-3 py-1 bg-white/20 border border-white/30 rounded-full text-[10px] uppercase font-bold tracking-widest mb-6 w-fit">
            SIAK • Official Portal
          </div>
          <h1 className="text-4xl md:text-5xl font-black leading-tight mb-4">
            Selamat Datang di <span className="text-blue-300">SIAK Amaholu Losy</span>
          </h1>
          <p className="text-blue-100/80 mb-8 max-w-md">
            Sistem Informasi Kependudukan terintegrasi untuk pengelolaan data warga dan layanan administrasi mandiri.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Users, title: 'Data Keluarga', desc: 'Akses data KK real-time' },
              { icon: FileText, title: 'Layanan Surat', desc: 'Cetak surat mandiri' },
              { icon: Shield, title: 'Aman & Privat', desc: 'Data terenkripsi lokal' },
              { icon: BarChart3, title: 'Statistik', desc: 'Pantau demografi desa' }
            ].map((f, i) => (
              <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                <f.icon className="text-blue-300 mb-2" size={24} />
                <h4 className="font-bold text-sm mb-1">{f.title}</h4>
                <p className="text-xs text-white/60">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full md:w-1/2 bg-white p-12 flex flex-col justify-center">
          <h2 className="text-3xl font-black text-slate-900 mb-2">Masuk Sistem</h2>
          <p className="text-slate-500 mb-8">Masuk sebagai warga atau petugas administrasi.</p>

          <div className="p-1 bg-slate-100 rounded-2xl flex gap-1 mb-8">
            <button 
              onClick={() => setRole('warga')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${role === 'warga' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
            >
              👨‍👩‍👧 Warga
            </button>
            <button 
              onClick={() => setRole('admin')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${role === 'admin' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
            >
              🛡️ Admin
            </button>
          </div>

          {error && <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm font-medium rounded-xl flex items-center gap-2">
            <Info size={16} /> {error}
          </div>}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {role === 'warga' ? (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase">Nomor Kartu Keluarga</label>
                  <div className="relative">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                      type="text" 
                      placeholder="Masukkan 16 digit No. KK"
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all"
                      value={noKK}
                      onChange={(e) => setNoKK(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase">Password (NIK Kepala Keluarga)</label>
                  <div className="relative">
                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                      type="password" 
                      placeholder="NIK Kepala Keluarga"
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase">Email Admin</label>
                  <div className="relative">
                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                      type="email" 
                      placeholder="laodesuradin@gmail.com"
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase">Password Admin</label>
                  <div className="relative">
                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                      type="password" 
                      placeholder="••••••••"
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all"
                      value={adminPass}
                      onChange={(e) => setAdminPass(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <button type="submit" className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200">
              Masuk Sekarang
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            {role === 'warga' ? (
              <span>Lupa password? Silakan hubungi RT/RW setempat.</span>
            ) : (
              <a href="https://wa.me/082146362670" target="_blank" className="text-blue-600 font-bold">Butuh bantuan akses admin?</a>
            )}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function DashboardView({ 
  session, 
  families, 
  allFamilies,
  onLogout, 
  searchTerm, 
  setSearchTerm,
  openEditModal,
  openNewFamilyModal,
  openStats,
  openLetter,
  onDelete,
  resetDb
}: { 
  session: AuthSession; 
  families: Family[];
  allFamilies: Family[];
  onLogout: () => void;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  openEditModal: (i: number) => void;
  openNewFamilyModal: () => void;
  openStats: () => void;
  openLetter: (t: LetterType) => void;
  onDelete: (i: number) => void;
  resetDb: () => void;
  key?: React.Key;
}) {
  const exportToExcel = () => {
    if (allFamilies.length === 0) return alert("Database kosong.");
    
    const wb = XLSX.utils.book_new();
    
    const familyData = allFamilies.map((f, i) => ({
      No: i + 1,
      "No. KK": f.no_kk,
      Alamat: f.alamat,
      "RT/RW": f.rt_rw,
      Desa: f.Desa,
      Kecamatan: f.Kecamatan,
      Kabupaten: f.Kabupaten,
      Provinsi: f.Provinsi,
      "Kepala Keluarga": f.anggota.find(a => a.hubungan === 'Kepala Keluarga')?.nama || '-'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(familyData), "Data_Keluarga");

    const membersData = allFamilies.flatMap(f => f.anggota.map(a => ({
      "No. KK": f.no_kk,
      Nama: a.nama,
      NIK: a.nik,
      "Tgl Lahir": a.tgl,
      JK: a.jk,
      Hubungan: a.hubungan,
      Bansos: a.bansos
    })));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(membersData), "Data_Penduduk");

    XLSX.writeFile(wb, "SIAK_AMAHOLU_LOSY.xlsx");
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-screen"
    >
      <header className="bg-slate-900 text-white py-4 px-8 flex items-center justify-between border-b-4 border-blue-600 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-xl">S</div>
          <div>
            <h1 className="font-black text-lg leading-none">SIAK AMAHOLU LOSY</h1>
            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-1">Sistem Administrasi Dusun</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
            <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400">
              {session.role === 'admin' ? <Shield size={16} /> : <UserIcon size={16} />}
            </div>
            <div className="text-right">
              <p className="text-xs font-black leading-none">{session.nama}</p>
              <p className="text-[10px] text-white/50 font-bold uppercase mt-1">{session.role}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-red-900/20"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <div className="bg-blue-600 p-4 shadow-xl">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <h2 className="text-white font-bold hidden md:block">Database Kependudukan Amaholu Losy</h2>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari Nama atau No. KK..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white rounded-lg outline-none focus:ring-2 ring-white/50 font-medium"
            />
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-auto p-4 md:p-8 container mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-6">
            {session.role === 'warga' && (
              <div className="bg-blue-50 border border-blue-200 p-6 rounded-3xl flex items-center gap-6">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shrink-0">
                  <UserIcon size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-blue-900 mb-1">Halo, Bpk/Ibu {session.nama}</h3>
                  <p className="text-blue-700/70 text-sm leading-relaxed">
                    Anda login sebagai warga. Data dibawah ini hanya menampilkan rincian keluarga Anda berdasarkan No. KK <b>{session.no_kk}</b>.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              <div className="p-6 border-b flex items-center justify-between">
                <h3 className="font-black text-lg flex items-center gap-2">
                  <Users className="text-blue-600" size={20} /> Data Penduduk
                </h3>
                {session.role === 'admin' && (
                  <button 
                    onClick={openNewFamilyModal}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all"
                  >
                    <PlusCircle size={16} /> Tambah KK Baru
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">No</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">No. KK</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Kepala Keluarga</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Alamat & RT</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Jiwa</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-wider">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {families.map((f, i) => {
                      const kepala = f.anggota.find(a => a.hubungan === 'Kepala Keluarga')?.nama || '-';
                      return (
                        <tr key={f.no_kk} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm text-slate-500">{i + 1}</td>
                          <td className="px-6 py-4 text-sm font-black text-blue-600 cursor-pointer hover:underline" onClick={() => openEditModal(allFamilies.findIndex(it => it.no_kk === f.no_kk))}>
                            {f.no_kk}
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-700">{kepala}</td>
                          <td className="px-6 py-4 text-sm text-slate-500">{f.alamat} (RT {f.rt_rw})</td>
                          <td className="px-6 py-4 text-sm">
                            <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-md font-bold text-xs">{f.anggota.length} Orang</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button 
                                onClick={() => openEditModal(allFamilies.findIndex(it => it.no_kk === f.no_kk))}
                                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                                title="Detail / Edit"
                              >
                                {session.role === 'admin' ? <Edit size={16} /> : <ChevronRight size={16} />}
                              </button>
                              {session.role === 'admin' && (
                                <button 
                                  onClick={() => onDelete(allFamilies.findIndex(it => it.no_kk === f.no_kk))}
                                  className="p-2 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-colors"
                                  title="Hapus"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {families.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                          <p className="font-medium italic">Tidak ada data ditemukan...</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl shadow-slate-900/20">
              <h4 className="text-white font-black flex items-center gap-2 mb-6 pb-4 border-b border-slate-800">
                <FileText className="text-yellow-500" size={20} /> Layanan Surat
              </h4>
              <div className="space-y-3">
                {[
                  "Surat Keterangan Usaha",
                  "Surat Keterangan Tidak Mampu",
                  "Surat Keterangan Kematian",
                  "Surat Keterangan Domisili"
                ].map((type) => (
                  <button 
                    key={type}
                    onClick={() => openLetter(type as LetterType)}
                    className="w-full text-left p-3 rounded-xl bg-white/5 border border-white/5 hover:border-yellow-500/50 hover:bg-yellow-500/10 text-slate-300 hover:text-yellow-500 text-sm font-bold transition-all flex items-center justify-between group"
                  >
                    <span>{type}</span>
                    <ChevronRight size={16} className="opacity-0 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </div>

            {session.role === 'admin' && (
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm">
                <h4 className="font-black flex items-center gap-2 mb-6">
                  <Shield size={20} className="text-blue-600" /> Manajemen
                </h4>
                <div className="space-y-3">
                  <button 
                    onClick={openStats}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold transition-colors"
                  >
                    <BarChart3 size={20} /> Statistik Wilayah
                  </button>
                  <button 
                    onClick={exportToExcel}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold transition-colors"
                  >
                    <FileDown size={20} /> Ekspor Excel
                  </button>
                  <button 
                    onClick={resetDb}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold transition-colors"
                  >
                    <Trash2 size={20} /> Reset Database
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>

      <footer className="bg-slate-900 text-slate-500 py-6 px-8 border-t border-slate-800 text-center text-xs font-medium">
        <p>Pemerintah Dusun Amaholu Losy © 2026 | SIAK Professional Kependudukan</p>
      </footer>
    </motion.div>
  );
}

// --- MODALS ---

function FamilyModal({ family, onSave, onClose }: { family: Family, onSave: (f: Family) => void, onClose: () => void }) {
  const [data, setData] = useState<Family>(JSON.parse(JSON.stringify(family)));

  const addMember = () => {
    const newMember: Resident = {
      nama: '', nik: '', tempat_lahir: '', tgl: '', jk: '', hubungan: '', agama: '', pendidikan: '', pekerjaan: '', bansos: ''
    };
    setData({ ...data, anggota: [...data.anggota, newMember] });
  };

  const removeMember = (index: number) => {
    const newMembers = data.anggota.filter((_, i) => i !== index);
    setData({ ...data, anggota: newMembers });
  };

  const updateMember = (index: number, field: keyof Resident, value: string) => {
    const newMembers = [...data.anggota];
    newMembers[index] = { ...newMembers[index], [field]: value };
    setData({ ...data, anggota: newMembers });
  };

  const handleSumbit = (e: React.FormEvent) => {
    e.preventDefault();
    if (data.no_kk.length !== 16) return alert("No. KK harus 16 digit.");
    if (data.anggota.length === 0) return alert("Minimal harus ada 1 anggota.");
    onSave(data);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-7xl h-[90vh] bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="p-8 border-b flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Formulir Data Keluarga</h2>
            <p className="text-sm text-slate-500 font-medium">{data.no_kk ? 'Perbarui data keluarga terdaftar' : 'Daftarkan keluarga baru ke sistem'}</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-2xl transition-colors"><X size={24} /></button>
        </div>

        <form onSubmit={handleSumbit} className="flex-1 overflow-auto p-8 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-8 bg-blue-50/50 rounded-3xl border border-blue-100">
             <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Nomor Kartu Keluarga</label>
              <input 
                type="text" maxLength={16} required
                value={data.no_kk} onChange={e => setData({...data, no_kk: e.target.value})}
                placeholder="16 Digit No. KK"
                className="w-full bg-white px-4 py-3 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Alamat Lengkap</label>
              <input 
                type="text" required
                value={data.alamat} onChange={e => setData({...data, alamat: e.target.value})}
                className="w-full bg-white px-4 py-3 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider">RT / RW</label>
              <input 
                type="text" required placeholder="001/001"
                value={data.rt_rw} onChange={e => setData({...data, rt_rw: e.target.value})}
                className="w-full bg-white px-4 py-3 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all"
              />
            </div>
            <div className="space-y-2 md:grid md:grid-cols-2 md:gap-2">
              <div>
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Desa</label>
                 <input type="text" readOnly value={data.Desa} className="w-full bg-slate-100 px-3 py-3 border-2 border-slate-200 rounded-xl font-bold opacity-70" />
              </div>
              <div>
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Kecamatan</label>
                 <input type="text" readOnly value={data.Kecamatan} className="w-full bg-slate-100 px-3 py-3 border-2 border-slate-200 rounded-xl font-bold opacity-70" />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black flex items-center gap-2">
                <Users className="text-blue-600" size={24} /> Daftar Anggota Keluarga
              </h3>
              <button 
                type="button" 
                onClick={addMember}
                className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-lg shadow-emerald-900/20 hover:bg-emerald-700 transition-all"
              >
                <PlusCircle size={18} /> Tambah Anggota
              </button>
            </div>

            <div className="overflow-x-auto bg-white rounded-3xl border border-slate-200 shadow-sm">
              <table className="w-full text-left min-w-[1500px]">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Hapus</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Nama Lengkap</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">NIK</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Tempat Lahir</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Tgl Lahir</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">JK</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Hubungan</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Agama</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Pendidikan</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Pekerjaan</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Bansos</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.anggota.map((ag, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <button type="button" onClick={() => removeMember(i)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                      </td>
                      <td className="px-6 py-4"><input className="w-full p-2 border rounded-lg" value={ag.nama} onChange={e => updateMember(i, 'nama', e.target.value)} required /></td>
                      <td className="px-6 py-4"><input className="w-full p-2 border rounded-lg" maxLength={16} value={ag.nik} onChange={e => updateMember(i, 'nik', e.target.value)} required /></td>
                      <td className="px-6 py-4"><input className="w-full p-2 border rounded-lg" value={ag.tempat_lahir} onChange={e => updateMember(i, 'tempat_lahir', e.target.value)} required /></td>
                      <td className="px-6 py-4"><input type="date" className="w-full p-2 border rounded-lg" value={ag.tgl} onChange={e => updateMember(i, 'tgl', e.target.value)} required /></td>
                      <td className="px-6 py-4">
                        <select className="w-full p-2 border rounded-lg" value={ag.jk} onChange={e => updateMember(i, 'jk', e.target.value as any)} required>
                          <option value="">Pilih</option>
                          <option value="Laki-laki">Laki-laki</option>
                          <option value="Perempuan">Perempuan</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <select className="w-full p-2 border rounded-lg" value={ag.hubungan} onChange={e => updateMember(i, 'hubungan', e.target.value as any)} required>
                          <option value="">Pilih</option>
                          <option value="Kepala Keluarga">Kepala Keluarga</option>
                          <option value="Istri">Istri</option>
                          <option value="Anak">Anak</option>
                          <option value="Lainnya">Lainnya</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <select className="w-full p-2 border rounded-lg" value={ag.agama} onChange={e => updateMember(i, 'agama', e.target.value as any)} required>
                          <option value="">Pilih</option>
                          <option value="Islam">Islam</option>
                          <option value="Kristen">Kristen</option>
                          <option value="Katolik">Katolik</option>
                          <option value="Hindu">Hindu</option>
                          <option value="Budha">Budha</option>
                        </select>
                      </td>
                      <td className="px-6 py-4"><input className="w-full p-2 border rounded-lg" value={ag.pendidikan} onChange={e => updateMember(i, 'pendidikan', e.target.value)} required /></td>
                      <td className="px-6 py-4"><input className="w-full p-2 border rounded-lg" value={ag.pekerjaan} onChange={e => updateMember(i, 'pekerjaan', e.target.value)} required /></td>
                      <td className="px-6 py-4">
                        <select className="w-full p-2 border rounded-lg" value={ag.bansos} onChange={e => updateMember(i, 'bansos', e.target.value)}>
                          <option value="">Tidak Ada</option>
                          <option value="PKH">PKH</option>
                          <option value="BPNT">BPNT</option>
                          <option value="BLT">BLT</option>
                          <option value="BPJS">BPJS</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                  {data.anggota.length === 0 && (
                     <tr><td colSpan={11} className="p-8 text-center text-slate-400 italic">Klik tombol "Tambah Anggota" untuk memulai...</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </form>

        <div className="p-8 border-t bg-slate-50 flex justify-end gap-4">
          <button type="button" onClick={onClose} className="px-8 py-3 rounded-2xl font-bold bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-100 transition-all">Batalkan</button>
          <button type="submit" onClick={handleSumbit} className="px-10 py-3 rounded-2xl font-black bg-blue-600 text-white flex items-center gap-2 shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all">
            <Save size={20} /> Simpan Perubahan
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function StatsModal({ db, onClose }: { db: Family[], onClose: () => void }) {
  const stats = useMemo(() => {
    let totalJiwa = 0, l = 0, p = 0, bansos = 0, balita = 0, lansia = 0;
    db.forEach(f => {
      totalJiwa += f.anggota.length;
      f.anggota.forEach(a => {
        if (a.jk === 'Laki-laki') l++;
        if (a.jk === 'Perempuan') p++;
        if (a.bansos) bansos++;
        const age = hitungUmur(a.tgl);
        if (age <= 5) balita++;
        if (age >= 60) lansia++;
      });
    });
    return { family: db.length, souls: totalJiwa, male: l, female: p, bansos, children: balita, elders: lansia };
  }, [db]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-4xl bg-white rounded-3xl p-8 shadow-2xl relative">
        <button onClick={onClose} className="absolute right-6 top-6 p-2 hover:bg-slate-100 rounded-xl"><X /></button>
        <h2 className="text-2xl font-black mb-8 flex items-center gap-2">
          <BarChart3 className="text-blue-600" /> Statistik Wilayah Amaholu Losy
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-blue-600 rounded-3xl text-white">
            <p className="text-xs font-black uppercase opacity-60 tracking-wider mb-2">Total Penduduk</p>
            <p className="text-5xl font-black">{stats.souls}</p>
            <p className="text-sm mt-4 font-bold">Jiwa terdaftar di database</p>
          </div>
          <div className="p-6 bg-slate-100 rounded-3xl">
            <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Total Keluarga</p>
            <p className="text-4xl font-black text-slate-900">{stats.family}</p>
            <p className="text-sm mt-4 text-slate-500 font-bold">Kartu Keluarga (KK)</p>
          </div>
          <div className="p-6 border-2 border-slate-100 rounded-3xl">
            <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Penerima Bansos</p>
            <p className="text-4xl font-black text-emerald-600">{stats.bansos}</p>
            <p className="text-sm mt-4 text-slate-500 font-bold">Program Bantuan Aktif</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {[
            { label: 'Laki-laki', val: stats.male, color: 'text-blue-500' },
            { label: 'Perempuan', val: stats.female, color: 'text-pink-500' },
            { label: 'Balita (≤5 Thn)', val: stats.children, color: 'text-orange-500' },
            { label: 'Lansia (≥60 Thn)', val: stats.elders, color: 'text-purple-500' },
          ].map((s, i) => (
            <div key={i} className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{s.label}</p>
              <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function LetterModal({ type, db, session, onClose, onPreview }: { type: LetterType, db: Family[], session: AuthSession, onClose: () => void, onPreview: (d: any) => void }) {
  const [targetName, setTargetName] = useState('');
  const [nomorSurat, setNomorSurat] = useState(generateNomorSurat());
  const [usaha, setUsaha] = useState('');

  const residentOptions = useMemo(() => {
    let source = db;
    if (session.role === 'warga') source = db.filter(f => f.no_kk === session.no_kk);
    return source.flatMap(f => f.anggota.map(a => ({ ...a, family: f })));
  }, [db, session]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const resident = residentOptions.find(r => r.nama === targetName);
    if (!resident) return alert("Pilih warga dari daftar!");
    
    onPreview({
      type,
      nomor: nomorSurat,
      resident,
      usaha: usaha,
      date: new Date().toISOString()
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg bg-white rounded-[2rem] p-8 shadow-2xl relative">
        <button onClick={onClose} className="absolute right-6 top-6 p-2 hover:bg-slate-100 rounded-xl"><X /></button>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Buat {type}</h2>
        <p className="text-slate-500 text-sm mb-8">Lengkapi data untuk generate dokumen resmi.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase">Cari Nama Warga</label>
            <input 
              list="wargaList"
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold"
              placeholder="Ketik nama lengkap..."
              required
            />
            <datalist id="wargaList">
              {residentOptions.map((r, i) => <option key={i} value={r.nama} />)}
            </datalist>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase">Nomor Surat</label>
            <input 
              value={nomorSurat}
              onChange={(e) => setNomorSurat(e.target.value)}
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-medium"
              required
            />
          </div>

          {type === 'Surat Keterangan Usaha' && (
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase">Jenis Usaha</label>
              <input 
                value={usaha}
                onChange={(e) => setUsaha(e.target.value)}
                placeholder="Contoh: Jual Sembako / Bengkel"
                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-bold"
                required
              />
            </div>
          )}

          <div className="pt-4 flex gap-3">
             <button type="submit" className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 hover:bg-blue-700 flex items-center justify-center gap-2">
              <Printer size={20} /> Preview & Cetak
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function PreviewModal({ data, onClose }: { data: any, onClose: () => void }) {
  const printDoc = () => window.print();

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 overflow-auto">
      <div className="w-full max-w-5xl my-auto">
        <div className="no-print bg-slate-900/50 p-4 sticky top-0 flex justify-between items-center z-10 rounded-b-2xl sm:rounded-2xl mb-8">
          <div className="flex items-center gap-2 text-white">
            <FileText className="text-yellow-500" />
            <span className="font-bold">Preview Dokumen</span>
          </div>
          <div className="flex gap-2">
            <button onClick={printDoc} className="px-6 py-2 bg-yellow-500 text-slate-900 font-black rounded-lg hover:bg-yellow-400 flex items-center gap-2">
              <Printer size={18} /> Cetak Sekarang
            </button>
            <button onClick={onClose} className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20"><X /></button>
          </div>
        </div>

        <div className="bg-white p-8 sm:p-20 shadow-2xl mx-auto w-[210mm] min-h-[297mm] text-black print:shadow-none print:m-0 print:w-full print:p-8" style={{ fontFamily: '"Times New Roman", serif' }}>
          <div className="flex items-start gap-4 pb-4 mb-4 border-b-4 border-black">
            <div className="w-24 h-24 flex items-center justify-center overflow-hidden shrink-0">
               <img src="https://media.istockphoto.com/id/1141706692/vector/eagle-symbol-isolated-vector-graphic-on-white-background.jpg?s=612x612&w=0&k=20&c=qF5XFvR-zI1_bC99R_N2e8yI6Q839DoxuJ2F7iY9h_0=" className="w-full grayscale" alt="Logo" />
            </div>
            <div className="flex-1 text-center font-bold">
              <p className="text-xl leading-8">PEMERINTAH KABUPATEN SERAM BAGIAN BARAT</p>
              <p className="text-xl leading-8">KECAMATAN HUAMUAL</p>
              <p className="text-xl leading-8">NEGERI LUHU</p>
              <p className="text-2xl leading-none mt-2">DUSUN AMAHOLU LOSY</p>
            </div>
          </div>

          <div className="text-center mt-8 mb-10">
            <h3 className="text-xl font-bold uppercase underline inline-block leading-none">{data.type}</h3>
            <p className="mt-2 text-lg">Nomor : {data.nomor}</p>
          </div>

          <div className="text-lg leading-relaxed text-justify space-y-6">
            <p>
              Yang bertanda tangan di bawah ini Kepala Dusun Amaholu Losy, Kecamatan Huamual, Kabupaten Seram Bagian Barat, dengan ini menerangkan bahwa :
            </p>

            <table className="w-full">
              <tbody>
                <tr><td className="w-56 py-1">Nama Lengkap</td><td className="w-4">:</td><td className="font-bold py-1">{data.resident.nama}</td></tr>
                <tr><td className="w-56 py-1">NIK</td><td>:</td><td className="py-1">{data.resident.nik}</td></tr>
                <tr><td className="w-56 py-1">Tempat, Tgl Lahir</td><td>:</td><td className="py-1">{data.resident.tempat_lahir}, {formatTanggalIndonesia(data.resident.tgl)}</td></tr>
                <tr><td className="w-56 py-1">Alamat</td><td>:</td><td className="py-1 leading-snug">
                  Dusun {data.resident.family.alamat}, RT/RW {data.resident.family.rt_rw}, 
                  Desa {data.resident.family.Desa}, Kec. {data.resident.family.Kecamatan}, 
                  Kab. {data.resident.family.Kabupaten}, Prov. {data.resident.family.Provinsi}
                </td></tr>
              </tbody>
            </table>

            {data.type === 'Surat Keterangan Usaha' && (
              <p>Adalah benar yang bersangkutan adalah warga masyarakat Dusun Amaholu Losy yang saat ini memiliki usaha aktif berupa <b>{data.usaha}</b>.</p>
            )}
            
            {data.type === 'Surat Keterangan Domisili' && (
              <p>Adalah benar yang bersangkutan adalah warga masyarakat yang berdomisili menetap di Dusun Amaholu Losy.</p>
            )}

            {data.type === 'Surat Keterangan Tidak Mampu' && (
              <p>Adalah benar yang bersangkutan merupakan warga masyarakat Dusun Amaholu Losy yang tergolong dalam ekonomi keluarga kurang mampu / rentan miskin.</p>
            )}

            {data.type === 'Surat Keterangan Kematian' && (
              <p>Adalah benar almarhum/almarhumah tercatat sebagai warga masyarakat Dusun Amaholu Losy yang telah dinyatakan meninggal dunia.</p>
            )}

            <p>Demikian surat keterangan ini kami berikan kepada yang bersangkutan untuk dapat dipergunakan sebagaimana mestinya.</p>
          </div>

          <div className="mt-16 ml-auto w-80 text-center text-lg">
             <p>Amaholu Losy, {formatTanggalIndonesia(new Date().toISOString())}</p>
             <p className="mt-2">Mengetahui,</p>
             <p className="font-bold">Kepala Dusun Amaholu Losy</p>
             <div className="h-32"></div>
             <p className="font-bold underline uppercase">FAUJI ALI</p>
          </div>
        </div>
      </div>
      
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .fixed { position: relative !important; inset: auto !important; padding: 0 !important; background: white !important; }
          .shadow-2xl { box-shadow: none !important; }
          @page { size: auto; margin: 10mm; }
        }
      `}</style>
    </div>
  );
}
