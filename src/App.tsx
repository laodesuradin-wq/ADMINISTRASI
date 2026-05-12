/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ChevronDown,
  Info,
  Loader2,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
// @ts-ignore
import html2pdf from 'html2pdf.js';
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
  const [printKKData, setPrintKKData] = useState<Family | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [chatMessages, setChatMessages] = useState<{text: string, type: 'user' | 'ai'}[]>([
    { text: "Selamat datang! Saya adalah asisten digital Dusun Amaholu Losy. Ada yang bisa saya bantu terkait layanan administrasi hari ini?", type: 'ai' }
  ]);

  const [isMobile, setIsMobile] = useState(true);

  // Check for mobile device/screen
  useEffect(() => {
    const handleResize = () => {
      // Strictly mobile width (< 640px)
      setIsMobile(window.innerWidth < 640);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    
    const newMessages = [...chatMessages, { text, type: 'user' as const }];
    setChatMessages(newMessages);
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: text,
        config: {
          systemInstruction: "Anda adalah asisten AI resmi bernama 'Asisten SIAK' untuk Dusun Amaholu Losy, Negeri Luhu, Kecamatan Huamual, Kabupaten Seram Bagian Barat, Maluku. Dusun ini dipimpin oleh Kepala Dusun Fauji Ali. Tugas Anda adalah membantu warga dan administrator dalam hal sistem kependudukan (SIAK). Jawablah dalam Bahasa Indonesia yang ramah, sopan, dan membantu. Anda dapat membantu menjelaskan cara membuat surat keterangan (Domisili, Usaha, Tidak Mampu, Kematian), cara login warga (menggunakan No KK dan password NIK Kepala Keluarga), dan informasi umum tentang dusun. Jika ditanya hal teknis yang tidak Anda ketahui, sarankan menghubungi operator dusun di nomor 082146362670. Berikan jawaban yang ringkas namun informatif.",
        },
      });

      const aiText = response.text || "Maaf, saya sedang mengalami kendala teknis. Silakan coba lagi nanti.";
      setChatMessages(prev => [...prev, { text: aiText, type: 'ai' as const }]);
    } catch (error) {
      console.error("AI Error:", error);
      setChatMessages(prev => [...prev, { text: "Error: Gagal menghubungi pusat data asisten AI.", type: 'ai' as const }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!isMobile) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-8 text-center z-[99999] overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]"></div>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 max-w-sm"
        >
          <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-blue-900 rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-[0_20px_50px_rgba(37,99,235,0.3)] border border-white/20">
            <Shield size={48} className="text-white animate-pulse" />
          </div>
          
          <h1 className="text-4xl font-black text-white tracking-tighter leading-tight mb-4 uppercase text-center">
            MOBILE <br />
            <span className="text-blue-500">ENVIRONMENT</span>
          </h1>
          
          <div className="h-1.5 w-16 bg-amber-500 mx-auto rounded-full mb-10"></div>
          
          <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] leading-relaxed mb-12">
            Peringatan: Antarmuka SIAK Amaholu telah dioptimalkan secara eksklusif untuk perangkat seluler. 
            Sistem mendeteksi layar lebar yang tidak didukung.
          </p>
          
          <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/10 backdrop-blur-md">
            <p className="text-blue-400 text-[9px] font-black uppercase tracking-[0.4em] mb-4">Aksesibilitas</p>
            <p className="text-white/60 text-[10px] font-bold leading-loose uppercase tracking-widest">
              Gunakan Smartphone Anda untuk mendapatkan fungsionalitas penuh aplikasi.
            </p>
          </div>
        </motion.div>
        
        <div className="mt-20 text-slate-700 font-black text-[8px] uppercase tracking-[0.6em]">
          SECURITY ARCHITECTURE • SIAK MOBILE
        </div>
      </div>
    );
  }

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
            openPrintKK={(f) => { setPrintKKData(f); setActiveModal('print-kk'); }}
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
        <div className={activeModal ? "print-root" : ""}>
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
            <div className="print-area-container">
              <PreviewModal 
                data={letterData} 
                onClose={() => setActiveModal('letter')} 
              />
            </div>
          )}

          {activeModal === 'print-kk' && printKKData && (
            <div className="print-area-container">
              <PrintKKModal 
                family={printKKData} 
                onClose={() => setActiveModal(null)} 
              />
            </div>
          )}
        </div>

      {/* CHATBOT */}
      <motion.div 
        drag
        dragMomentum={false}
        className="fixed bottom-6 right-6 z-50 no-print touch-none"
      >
        <AnimatePresence>
          {showChat && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="mb-6 w-[calc(100vw-48px)] max-w-[400px] h-[75vh] max-h-[600px] bg-white rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.25)] border border-white/20 flex flex-col overflow-hidden relative"
            >
              <div className="p-6 bg-gradient-to-r from-slate-900 to-blue-900 text-white flex justify-between items-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10 shadow-inner">
                    <MessageSquare size={24} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-black text-base leading-none tracking-tight">KONSULTASI DIGITAL</h3>
                    <p className="text-[10px] text-blue-400 font-bold uppercase mt-1.5 flex items-center gap-2 tracking-widest">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span> Asisten AI Aktif
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowChat(false)} 
                  className="p-3 hover:bg-white/10 rounded-2xl transition-all active:scale-90"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 p-6 overflow-y-auto bg-slate-50/50 space-y-6 scroll-smooth">
                {chatMessages.map((msg, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    key={i} 
                    className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[88%] px-5 py-4 rounded-[1.5rem] text-[13px] leading-relaxed relative ${
                      msg.type === 'user' 
                        ? 'bg-blue-600 text-white rounded-br-none shadow-xl shadow-blue-500/20 font-medium' 
                        : 'bg-white border border-slate-100 text-slate-700 rounded-bl-none shadow-sm font-semibold'
                    }`}>
                      {msg.text}
                      <div className={`absolute bottom-[-4px] ${msg.type === 'user' ? 'right-0 border-t-[8px] border-t-blue-600 border-l-[8px] border-l-transparent' : 'left-0 border-t-[8px] border-t-white border-r-[8px] border-r-transparent'}`}></div>
                    </div>
                  </motion.div>
                ))}
                {isTyping && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="p-6 bg-white border-t border-slate-100">
                <form 
                  className="flex gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = (e.target as any).message;
                    const text = input.value;
                    if (text) {
                      handleSendMessage(text);
                      input.value = '';
                    }
                  }}
                >
                  <input 
                    autoComplete="off"
                    name="message"
                    type="text" 
                    placeholder="Tanyakan sesuatu..."
                    className="flex-1 bg-slate-100/80 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 ring-blue-500/5 focus:bg-white focus:border-blue-500/20 transition-all border-2 border-transparent"
                    disabled={isTyping}
                  />
                  <button 
                    type="submit"
                    disabled={isTyping}
                    className="bg-gradient-to-br from-blue-600 to-blue-800 text-white w-14 h-14 rounded-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 shadow-xl shadow-blue-500/30 flex items-center justify-center p-0"
                  >
                    <Send size={22} className="relative left-0.5" />
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="flex justify-end items-center gap-4">
            <motion.button 
            onClick={() => setShowChat(!showChat)}
            animate={{ 
              y: showChat ? 0 : [0, -10, 0],
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-[1.5rem] text-white shadow-2xl flex items-center justify-center transition-all duration-500 group relative ${
              showChat ? 'bg-slate-900 rotate-90 shadow-slate-900/40' : 'bg-blue-600 shadow-blue-600/40'
            }`}
          >
            {showChat ? <X size={24} className="md:w-7 md:h-7" /> : (
              <>
                <MessageSquare size={22} className="md:w-7 md:h-7 group-hover:scale-110 transition-transform" />
                <span className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-emerald-500 rounded-full border-[3px] md:border-4 border-white shadow-sm"></span>
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
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
      className="min-h-screen flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden"
    >
      {/* Official background architecture */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:32px_32px]"></div>
        <div className="absolute top-0 right-0 w-[60rem] h-[60rem] bg-blue-600/20 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/2"></div>
      </div>

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-[340px] bg-white rounded-[2.5rem] overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.4)] flex flex-col relative z-10 border border-white/20"
      >
        <div className="w-full p-6 text-white flex flex-col justify-center bg-slate-900 relative overflow-hidden h-[220px]">
          <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
          
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center p-2.5 mb-5 shadow-2xl relative z-10"
          >
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Garuda_Pancasila_Coat_of_Arms_of_Indonesia.svg/800px-Garuda_Pancasila_Coat_of_Arms_of_Indonesia.svg.png" 
              alt="Logo Garuda" 
              className="w-full h-full object-contain brightness-0"
              referrerPolicy="no-referrer"
            />
          </motion.div>

          <div className="relative z-10">
            <h1 className="text-2xl font-black leading-tight mb-1.5 tracking-tighter uppercase font-sans">
              SIAK <span className="text-blue-500">MOBILE</span>
            </h1>
            <div className="h-1 w-10 bg-amber-500 rounded-full mb-3"></div>
            <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">Negeri Luhu • Amaholu Losy</p>
          </div>
        </div>

        <div className="w-full bg-white p-6 md:p-8 flex flex-col justify-center">
          <div className="mb-6">
             <p className="text-blue-600 text-[9px] font-black uppercase tracking-[0.4em] mb-1 leading-none">Otentikasi Seluler</p>
             <h2 className="text-xl font-black text-slate-900 tracking-tight">Masuk Ke Sistem</h2>
          </div>

          <div className="p-2 bg-slate-100 rounded-[2rem] flex gap-2 mb-12">
            <button 
              onClick={() => setRole('warga')}
              className={`flex-1 py-4 rounded-3xl font-black text-xs uppercase tracking-widest transition-all ${role === 'warga' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Akses Publik
            </button>
            <button 
              onClick={() => setRole('admin')}
              className={`flex-1 py-4 rounded-3xl font-black text-xs uppercase tracking-widest transition-all ${role === 'admin' ? 'bg-white text-blue-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Otoritas
            </button>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-10 p-5 bg-rose-50 border-2 border-rose-100 text-rose-600 text-xs font-black uppercase tracking-widest rounded-3xl flex items-center gap-4 shadow-sm"
            >
              <X size={20} className="shrink-0" /> <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-8">
            {role === 'warga' ? (
              <>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Nomor Kartu Keluarga (KK)</label>
                  <div className="relative group">
                    <Users className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" size={22} />
                    <input 
                      type="text" 
                      placeholder="16-digit kode KK"
                      className="w-full pl-16 pr-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] outline-none focus:border-blue-600 focus:bg-white transition-all font-black text-slate-900 placeholder:text-slate-300 shadow-sm"
                      value={noKK}
                      onChange={(e) => setNoKK(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Kunci Pribadi (NIK)</label>
                  <div className="relative group">
                    <Shield className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" size={22} />
                    <input 
                      type="password" 
                      placeholder="NIK Kepala Keluarga"
                      className="w-full pl-16 pr-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] outline-none focus:border-blue-600 focus:bg-white transition-all font-black text-slate-900 placeholder:text-slate-300 shadow-sm"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Identitas Otoritas</label>
                  <div className="relative group">
                    <UserIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" size={22} />
                    <input 
                      type="email" 
                      placeholder="Email Kedinasan Resmi"
                      className="w-full pl-16 pr-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] outline-none focus:border-blue-600 focus:bg-white transition-all font-black text-slate-900 placeholder:text-slate-300 shadow-sm"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Kunci Akses Sistem</label>
                  <div className="relative group">
                    <Shield className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" size={22} />
                    <input 
                      type="password" 
                      placeholder="Masukkan kunci administrator"
                      className="w-full pl-16 pr-8 py-5 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] outline-none focus:border-blue-600 focus:bg-white transition-all font-black text-slate-900 placeholder:text-slate-300 shadow-sm"
                      value={adminPass}
                      onChange={(e) => setAdminPass(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <button type="submit" className="w-full py-5 bg-slate-900 text-white font-black uppercase tracking-[0.2em] rounded-[1.5rem] shadow-[0_20px_50px_rgba(15,23,42,0.3)] hover:bg-slate-800 hover:-translate-y-1 active:translate-y-0 transition-all duration-300 group">
              Otorisasi Masuk
            </button>
          </form>

          <div className="mt-12 flex items-center justify-between">
             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-loose max-w-[180px]">
                Antarmuka Digital Sensus Resmi • Didukung oleh Mesin SIAK v2.6
             </p>
             <div className="flex gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
             </div>
          </div>
        </div>
      </motion.div>
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
  openPrintKK,
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
  openPrintKK: (f: Family) => void;
  onDelete: (i: number) => void;
  resetDb: () => void;
  key?: React.Key;
}) {
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [dataMenuOpen, setDataMenuOpen] = useState(false);
  const [isDatabaseViewOpen, setIsDatabaseViewOpen] = useState(false);

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
      className="flex flex-col h-screen no-print-bg"
    >
      <header className="bg-slate-950 px-4 py-4 flex items-center justify-between sticky top-0 z-40 no-print border-b border-white/5">
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center p-1 shadow-lg overflow-hidden">
            <div className="w-full h-full bg-slate-900 rounded-lg flex items-center justify-center">
               <Shield size={24} className="text-white" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-lg text-white leading-none tracking-tighter uppercase">SIAK <span className="text-blue-500">MOBILE</span></h1>
            </div>
            <div className="inline-block mt-1">
              <span className="text-[8px] bg-amber-500 text-slate-900 px-2 py-0.5 rounded-full font-black uppercase tracking-widest leading-none">AMAHOLU</span>
            </div>
          </div>
        </div>

        <button 
          onClick={onLogout}
          className="w-11 h-11 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-95 transition-all"
        >
          <LogOut size={20} />
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden no-print bg-[#0a0f1e]">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto scrollbar-none pb-20 px-4">
            <div className="pt-6 pb-4 relative z-10">
              <div className="container mx-auto text-center">
                 <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 mb-6">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span> Sistem Digital Terintegrasi
                 </p>
                 
                 {session.role === 'admin' && (
                   <div className="relative group max-w-sm mx-auto mb-8">
                     <input 
                       type="text" 
                       placeholder="Cari Nama atau No. KK..."
                       value={searchTerm}
                       onChange={(e) => setSearchTerm(e.target.value)}
                       className="w-full px-6 py-4 rounded-[1.5rem] bg-slate-900/50 border-2 border-slate-800/80 backdrop-blur-xl text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50 transition-all shadow-2xl font-bold text-sm text-center"
                     />
                   </div>
                 )}
              </div>
            </div>

                {/* Menu Navigasi Mobile Grid */}
                <div className={`grid ${session.role === 'admin' ? 'grid-cols-2' : 'grid-cols-1'} gap-3 bg-white/5 p-3 rounded-[2rem] border border-white/10 backdrop-blur-xl shadow-2xl mb-8`}>
                  {/* Button DATA KEPENDUDUKAN */}
                  <div className="relative group col-span-1">
                    <button 
                      onClick={() => {
                        setDataMenuOpen(!dataMenuOpen);
                        setAdminMenuOpen(false);
                      }}
                      className={`w-full p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] transition-all flex flex-col items-center justify-center gap-3 md:gap-5 border-2 ${
                        dataMenuOpen ? 'bg-blue-600 border-blue-400 text-white shadow-[0_20px_50px_rgba(37,99,235,0.4)]' : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:border-white/10 hover:text-white shadow-none'
                      } active:scale-95`}
                    >
                      <div className={`w-12 h-12 md:w-20 md:h-20 rounded-2xl md:rounded-[2rem] flex items-center justify-center text-3xl md:text-5xl transition-transform ${dataMenuOpen ? 'bg-white/20' : 'bg-blue-500/10'}`}>👥</div>
                      <div className="text-center">
                        <span className="block text-[9px] md:text-xs font-black uppercase tracking-wider mb-1 leading-none">{session.role === 'admin' ? 'Database' : 'Akses Data'}</span>
                        <span className="block text-[11px] md:text-base font-black uppercase tracking-tight opacity-90 leading-tight">{session.role === 'admin' ? 'Kependudukan' : 'Terpadu'}</span>
                      </div>
                      <ChevronDown size={14} className={`transition-all duration-500 ${dataMenuOpen ? 'rotate-180 opacity-100' : 'opacity-30'}`} />
                    </button>

                    <AnimatePresence>
                      {dataMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-md" onClick={() => setDataMenuOpen(false)} />
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[94%] max-w-[340px] bg-white rounded-[2rem] shadow-[0_50px_150px_rgba(0,0,0,0.8)] border border-white/20 z-[101] overflow-hidden flex flex-col max-h-[72vh]"
                          >
                            <div className="bg-slate-900 px-4 py-3 border-b-4 border-blue-600 flex items-center justify-between sticky top-0 z-20">
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-500 border border-blue-500/20 shadow-inner">
                                  <Users size={18} />
                                </div>
                                <div>
                                  <h3 className="font-black text-base text-white tracking-tighter uppercase leading-none">Data Terpadu</h3>
                                  <p className="text-[6px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1 flex items-center gap-1.5">
                                     <Shield size={7} /> Sistem Digital Pusat v3.0
                                  </p>
                                </div>
                              </div>
                              <button 
                                onClick={() => setDataMenuOpen(false)}
                                className="w-8 h-8 bg-white/5 hover:bg-white/10 text-white rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-all font-bold shadow-xl"
                              >
                                <X size={18} />
                              </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-none bg-white">
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { 
                                    label: session.role === 'admin' ? "LIHAT DATA" : "DATA KELUARGA", 
                                    sub: session.role === 'admin' ? "DATABASE" : "AKSES DATA", 
                                    icon: "📋", 
                                    action: () => setIsDatabaseViewOpen(true) 
                                  },
                                  { 
                                    label: session.role === 'admin' ? "TAMBAH KK" : "FORMULIR BARU", 
                                    sub: session.role === 'admin' ? "OPERASI DATA" : "INPUT DATA", 
                                    icon: "📝", 
                                    action: () => openNewFamilyModal() 
                                  },
                                  { label: "EKSPOR DATA", sub: "DOKUMEN EXCEL", icon: "💾", action: () => exportToExcel(), adminOnly: true },
                                  { label: "STATISTIK", sub: "REKAPITULASI", icon: "📊", action: () => openStats(), adminOnly: true }
                                ].map((item, idx) => {
                                  if (item.adminOnly && session.role !== 'admin') return null;
                                  return (
                                    <button 
                                      key={idx}
                                      onClick={() => { item.action(); setDataMenuOpen(false); }}
                                      className="p-3.5 rounded-[1.5rem] bg-[#d4cfe4] border border-slate-200/50 flex flex-col items-start group active:scale-95 transition-all text-left h-full shadow-sm"
                                    >
                                      <div className="mb-2 text-lg group-hover:scale-110 transition-transform">
                                        <span className="opacity-80 grayscale group-hover:grayscale-0 transition-all">{item.icon}</span>
                                      </div>
                                      <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1 leading-none opacity-60">{item.sub}</p>
                                      <h4 className="text-[11px] font-black text-slate-900 tracking-tighter uppercase leading-tight">{item.label}</h4>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="bg-slate-950 p-6 text-center relative overflow-hidden">
                               <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                               <p className="text-blue-500 text-[7px] font-black uppercase tracking-[0.2em] leading-relaxed relative z-10 mx-auto text-center">
                                  SIAK MOBILE • SISTEM INTEGRASI<br/>
                                  PELAYANAN PUBLIK TERPADU<br/>
                                  KEPENDUDUKAN.
                                </p>
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Button DOKUMEN SURAT */}
                  {session.role === 'admin' && (
                    <div className="relative group col-span-1">
                      <button 
                        onClick={() => {
                          setAdminMenuOpen(!adminMenuOpen);
                          setDataMenuOpen(false);
                        }}
                        className={`w-full p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] transition-all flex flex-col items-center justify-center gap-3 md:gap-5 border-2 ${
                          adminMenuOpen ? 'bg-amber-600 border-amber-400 text-white shadow-[0_20px_50px_rgba(217,119,6,0.4)]' : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:border-white/10 hover:text-white shadow-none'
                        } active:scale-95`}
                      >
                        <div className={`w-12 h-12 md:w-20 md:h-20 rounded-2xl md:rounded-[2rem] flex items-center justify-center text-3xl md:text-5xl transition-transform ${adminMenuOpen ? 'bg-white/20' : 'bg-amber-500/10'}`}>📄</div>
                        <div className="text-center">
                          <span className="block text-[9px] md:text-xs font-black uppercase tracking-wider mb-1 leading-none">Administrasi</span>
                          <span className="block text-[11px] md:text-base font-black uppercase tracking-tight opacity-90 leading-tight">Digital Surat</span>
                        </div>
                        <ChevronDown size={14} className={`transition-all duration-500 ${adminMenuOpen ? 'rotate-180 opacity-100' : 'opacity-30'}`} />
                      </button>

                      <AnimatePresence>
                        {adminMenuOpen && (
                          <>
                            <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-md" onClick={() => setAdminMenuOpen(false)} />
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.9, y: 20 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.9, y: 20 }}
                              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[94%] max-w-[340px] bg-white rounded-[2rem] shadow-[0_50px_150px_rgba(0,0,0,0.8)] border border-white/20 z-[101] overflow-hidden flex flex-col max-h-[72vh]"
                            >
                              <div className="bg-slate-900 px-4 py-3 border-b-4 border-blue-600 flex items-center justify-between sticky top-0 z-20">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-9 h-9 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-500 border border-blue-500/20 shadow-inner">
                                    <FileText size={18} />
                                  </div>
                                  <div>
                                    <h3 className="font-black text-base text-white tracking-tighter uppercase leading-none">Administrasi</h3>
                                    <p className="text-[6px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1 flex items-center gap-1.5">
                                       <Shield size={7} /> Layanan Digital Surat v3.0
                                    </p>
                                  </div>
                                </div>
                                <button 
                                  onClick={() => setAdminMenuOpen(false)}
                                  className="w-8 h-8 bg-white/5 hover:bg-white/10 text-white rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-all font-bold shadow-xl"
                                >
                                  <X size={18} />
                                </button>
                              </div>

                              <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-none bg-white">
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { name: "Surat Keterangan Usaha", label: "SK USAHA", sub: "Layanan Usaha", icon: "💼" },
                                    { name: "Surat Keterangan Tidak Mampu", label: "SKTM", sub: "Bantuan Sosial", icon: "🤝" },
                                    { name: "Surat Keterangan Kematian", label: "AKTA MATI", sub: "Saksi Kematian", icon: "🕊️" },
                                    { name: "Surat Keterangan Domisili", label: "DOMISILI", sub: "Bukti Tinggal", icon: "🏠" }
                                  ].map((item) => (
                                    <button 
                                      key={item.name}
                                      onClick={() => { openLetter(item.name as LetterType); setAdminMenuOpen(false); }}
                                      className="p-3.5 rounded-[1.5rem] bg-[#d4cfe4] border border-slate-200/50 flex flex-col items-start group active:scale-95 transition-all text-left h-full shadow-sm"
                                    >
                                      <div className="mb-2 text-lg group-hover:scale-110 transition-transform">
                                        <span className="opacity-80 grayscale group-hover:grayscale-0 transition-all">{item.icon}</span>
                                      </div>
                                      <p className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1 leading-none opacity-60">{item.sub}</p>
                                      <h4 className="text-[11px] font-black text-slate-900 tracking-tighter uppercase leading-tight">{item.label}</h4>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="bg-slate-950 p-6 text-center relative overflow-hidden">
                                 <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                                 <p className="text-blue-500 text-[7px] font-black uppercase tracking-[0.2em] leading-relaxed relative z-10 mx-auto text-center">
                                   SIAK MOBILE • SISTEM INTEGRASI<br/>
                                   PELAYANAN PUBLIK TERPADU<br/>
                                   KEPENDUDUKAN.
                                 </p>
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Button STATISTIK */}
                  {session.role === 'admin' && (
                    <button 
                      onClick={() => {
                        openStats();
                        setDataMenuOpen(false);
                        setAdminMenuOpen(false);
                      }}
                      className="col-span-1 p-4 md:p-8 rounded-[2rem] md:rounded-[3rem] bg-white/5 border-2 border-white/5 text-slate-300 hover:bg-white/10 hover:border-white/10 hover:text-white transition-all flex flex-col items-center justify-center gap-3 md:gap-5 active:scale-95 shadow-none"
                    >
                      <div className="w-12 h-12 md:w-20 md:h-20 bg-emerald-500/10 rounded-2xl md:rounded-[2rem] flex items-center justify-center text-3xl md:text-5xl group-hover:scale-110 transition-transform">📈</div>
                      <div className="text-center">
                        <span className="block text-[9px] md:text-xs font-black uppercase tracking-wider mb-1 leading-none">Visualisasi</span>
                        <span className="block text-[11px] md:text-base font-black uppercase tracking-tight opacity-90 leading-tight">Grafik Warga</span>
                      </div>
                    </button>
                  )}
                </div>

            <main className="p-4 md:p-8 container mx-auto">
        <div className="max-w-6xl mx-auto space-y-8">
          {session.role === 'warga' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-purple-950 rounded-[3.5rem] shadow-[0_20px_80px_rgba(0,0,0,0.3)] border border-white/10 relative overflow-hidden group mb-12 p-8 sm:p-12 text-white"
            >
              <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px]"></div>
              
              <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 bg-blue-600/10 blur-3xl rounded-full scale-150"></div>
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-blue-800 rounded-[2rem] flex items-center justify-center shadow-2xl relative z-10 border-[3px] border-white/10">
                    <UserIcon size={44} className="text-white drop-shadow-lg" />
                  </div>
                </div>
                <div className="text-center md:text-left flex-1">
                  <div className="inline-flex items-center gap-2 px-3 py-0.5 bg-blue-500/20 border border-blue-400/30 rounded-full text-[9px] font-black text-blue-400 uppercase tracking-widest mb-3">
                    <Shield size={10} /> Otentikasi Berhasil
                  </div>
                  <h3 className="text-3xl font-black text-white mb-3 tracking-tighter">Selamat Datang, {session.nama}</h3>
                  <p className="text-slate-300 text-base leading-relaxed max-w-2xl font-medium">
                    Akses portal digital kependudukan diaktifkan. Anda dapat memeriksa validitas data keluarga, mencetak simulasi Kartu Keluarga, dan mengajukan surat administrasi secara mandiri.
                  </p>
                </div>
                <div className="hidden xl:flex flex-col gap-3">
                   <div className="px-6 py-4 bg-white/5 rounded-2xl border border-white/10">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status Kependudukan</p>
                      <p className="font-black text-emerald-400 text-sm">Terdaftar Aktif</p>
                   </div>
                   <div className="px-6 py-4 bg-white/5 rounded-2xl border border-white/10">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Verifikasi System</p>
                      <p className="font-black text-blue-400 text-sm">SIAK Terpadu</p>
                   </div>
                </div>
              </div>
            </motion.div>
          )}

          </div>
        </main>

        <AnimatePresence>
          {isDatabaseViewOpen && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 no-print">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl"
                onClick={() => setIsDatabaseViewOpen(false)}
              />
              
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="relative w-full h-full bg-slate-900 overflow-hidden flex flex-col"
              >
                <div className="bg-slate-950 px-5 py-6 border-b-2 border-blue-600 flex items-center justify-between sticky top-0 z-20 shadow-2xl">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center text-blue-500 border border-blue-500/20">
                      <Users size={20} />
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-white tracking-tight uppercase leading-none">Database Warga</h3>
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1.5">Total: {families.length} Records</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsDatabaseViewOpen(false)}
                    className="w-10 h-10 bg-white/5 text-white rounded-full flex items-center justify-center border border-white/10 active:scale-90 transition-all font-bold"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-none">
                  <div className="relative group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input 
                      type="text" 
                      placeholder="Cari Nama atau No. KK..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-6 py-4 bg-white/5 border-2 border-white/10 rounded-2xl outline-none focus:border-blue-500 focus:bg-slate-800 transition-all font-bold text-white placeholder:text-slate-600 text-sm"
                    />
                  </div>

                  <div className="space-y-4 pb-10">
                    {families.map((f, i) => {
                      const kepalaObj = f.anggota.find(a => a.hubungan === 'Kepala Keluarga');
                      return (
                        <div key={f.no_kk} className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4 hover:border-blue-500/50 transition-all shadow-xl shadow-black/20">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1.5 leading-none">Kepala Keluarga</p>
                              <h4 className="text-sm font-black text-white uppercase tracking-tight leading-tight">{kepalaObj?.nama || '-'}</h4>
                            </div>
                            <div className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[8px] font-mono text-slate-400">
                              #{i + 1}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 pt-2">
                             <div>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 leading-none">No. KK</p>
                                <p className="text-[10px] font-bold text-slate-300 tracking-wider">{f.no_kk}</p>
                             </div>
                             <div>
                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1 leading-none">Wilayah</p>
                                <p className="text-[10px] font-bold text-slate-300 truncate">{f.alamat} / RT {f.rt_rw}</p>
                             </div>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <button 
                              onClick={() => {
                                openEditModal(allFamilies.findIndex(it => it.no_kk === f.no_kk));
                                setIsDatabaseViewOpen(false);
                              }}
                              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-blue-900/40"
                            >
                              {session.role === 'admin' ? 'Kelola Data' : 'Detail'}
                            </button>
                            <button 
                              onClick={() => { openPrintKK(f); setIsDatabaseViewOpen(false); }}
                              className="w-12 h-11 bg-white/5 border border-white/10 text-white rounded-xl flex items-center justify-center active:scale-95 transition-all"
                            >
                              <Printer size={16} />
                            </button>
                            {session.role === 'admin' && (
                              <button 
                                onClick={() => onDelete(allFamilies.findIndex(it => it.no_kk === f.no_kk))}
                                className="w-12 h-11 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl flex items-center justify-center active:scale-95 transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  </div>

      <footer className="bg-slate-900 border-t border-white/5 py-6 px-6 text-center no-print shrink-0">
        <p className="text-slate-600 text-[8px] md:text-xs font-black uppercase tracking-[0.2em] leading-relaxed">
          Pemerintah Dusun Amaholu Losy © 2024<br/>
          <span className="opacity-40 tracking-widest">Sistem Informasi Administrasi Kependudukan</span>
        </p>
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

  const currentRole = JSON.parse(sessionStorage.getItem('auth') || '{}').role;
  const isReadOnly = currentRole === 'warga';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" 
        onClick={onClose} 
      />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-7xl h-[94vh] bg-purple-950 rounded-[3.5rem] shadow-[0_50px_150px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col border border-white/20"
      >
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between border-b-4 border-amber-500 relative overflow-hidden">
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-amber-500 border border-white/10 shadow-inner">
              <Users size={32} />
            </div>
            <div className="text-center md:text-left">
              <h3 className="text-white text-2xl font-black tracking-tighter uppercase leading-tight">
                {isReadOnly ? 'Detail Berkas Kependudukan' : (data.no_kk ? 'Mutasi Data Keluarga' : (
                  <div className="flex flex-col items-center md:items-start">
                    <span>Registrasi Kartu</span>
                    <span>Keluarga</span>
                  </div>
                ))}
              </h3>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="md:hidden w-8 h-8 bg-white/5 hover:bg-white/10 text-white rounded-full flex items-center justify-center transition-all border border-white/10"
          >
            <X size={16} />
          </button>
          <button 
            onClick={onClose} 
            className="hidden md:flex w-12 h-12 bg-white/5 hover:bg-white/10 text-white rounded-full items-center justify-center transition-all border border-white/10 hover:rotate-90"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSumbit} className="flex-1 overflow-y-auto p-5 md:p-14 space-y-8 md:space-y-12 scrollbar-official">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
            <div className="space-y-2 md:space-y-3">
               <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] md:tracking-[0.3em] ml-1 md:ml-2">ID Resmi (KK)</label>
               <input 
                value={data.no_kk} 
                onChange={e => setData({...data, no_kk: e.target.value})}
                maxLength={16}
                disabled={isReadOnly}
                required
                placeholder="KODE 16-DIGIT"
                className="w-full px-5 md:px-7 py-3 md:py-5 bg-white/5 border-2 border-white/10 rounded-xl md:rounded-3xl font-black text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:bg-white/10 transition-all shadow-sm text-sm md:text-base"
              />
            </div>
            <div className="space-y-2 md:space-y-3">
               <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] md:tracking-[0.3em] ml-1 md:ml-2">Alamat</label>
               <input 
                value={data.alamat} 
                onChange={e => setData({...data, alamat: e.target.value})}
                disabled={isReadOnly}
                required
                placeholder="JALAN / DUSUN"
                className="w-full px-5 md:px-7 py-3 md:py-5 bg-white/5 border-2 border-white/10 rounded-xl md:rounded-3xl font-black text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:bg-white/10 transition-all shadow-sm text-sm md:text-base"
              />
            </div>
            <div className="space-y-2 md:space-y-3">
               <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] md:tracking-[0.3em] ml-1 md:ml-2">Wilayah / RT</label>
               <input 
                value={data.rt_rw} 
                onChange={e => setData({...data, rt_rw: e.target.value})}
                disabled={isReadOnly}
                required
                placeholder="00"
                className="w-full px-5 md:px-7 py-3 md:py-5 bg-white/5 border-2 border-white/10 rounded-xl md:rounded-3xl font-black text-white placeholder:text-slate-600 outline-none focus:border-blue-500 focus:bg-white/10 transition-all shadow-sm text-center text-sm md:text-base"
              />
            </div>
          </div>

          <div className="space-y-6 md:space-y-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-10">
              <div className="flex items-center gap-3 md:gap-4">
                 <div className="w-1.5 h-8 md:w-2.5 md:h-10 bg-blue-600 rounded-full"></div>
                 <h4 className="text-xl md:text-2xl font-black text-white tracking-tight">Anggota Keluarga</h4>
              </div>
              {!isReadOnly && (
                <button 
                  type="button"
                  onClick={addMember}
                  className="px-6 py-3 md:px-8 md:py-4 bg-slate-900 text-white rounded-xl md:rounded-[1.5rem] font-black text-[10px] md:text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-95 border-b-4 border-slate-700"
                >
                  <PlusCircle size={16} /> Tambah Registrasi
                </button>
              )}
            </div>

            <div className="space-y-6 md:space-y-8">
              {data.anggota.map((ag, i) => (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={i} 
                  className="p-5 md:p-10 bg-white/5 border-2 border-white/10 rounded-2xl md:rounded-[3rem] relative group hover:border-blue-500/30 transition-all hover:bg-white/10 hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)]"
                >
                  {!isReadOnly && (
                    <button 
                      type="button"
                      onClick={() => removeMember(i)}
                      className="absolute top-4 right-4 md:top-10 md:right-10 w-10 h-10 md:w-12 md:h-12 bg-rose-50 text-rose-500 rounded-xl md:rounded-2xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all border border-rose-100 md:opacity-0 md:group-hover:opacity-100 shadow-sm"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-8 pt-6 md:pt-0">
                    <div className="md:col-span-1">
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 md:mb-3 block">Nama Lengkap</label>
                       <input 
                        value={ag.nama} 
                        onChange={e => updateMember(i, 'nama', e.target.value)}
                        disabled={isReadOnly}
                        required
                        className="w-full px-4 md:px-6 py-2.5 md:py-4 bg-white/5 border-2 border-white/10 rounded-xl md:rounded-2xl font-black text-white text-xs md:text-sm focus:border-blue-600 focus:bg-white/10 outline-none transition-all shadow-sm"
                      />
                    </div>
                    <div>
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 md:mb-3 block">NIK</label>
                       <input 
                        value={ag.nik} 
                        onChange={e => updateMember(i, 'nik', e.target.value)}
                        disabled={isReadOnly}
                        required
                        maxLength={16}
                        className="w-full px-4 md:px-6 py-2.5 md:py-4 bg-white/5 border-2 border-white/10 rounded-xl md:rounded-2xl font-mono font-bold text-white text-xs md:text-sm focus:border-blue-600 focus:bg-white/10 outline-none transition-all shadow-sm"
                      />
                    </div>
                    <div>
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 md:mb-3 block">Hubungan</label>
                       <select 
                        value={ag.hubungan} 
                        onChange={e => updateMember(i, 'hubungan', e.target.value)}
                        disabled={isReadOnly}
                        required
                        className="w-full px-4 md:px-6 py-2.5 md:py-4 bg-white/5 border-2 border-white/10 rounded-xl md:rounded-2xl font-black text-white text-xs md:text-sm focus:border-blue-600 focus:bg-white/10 outline-none transition-all shadow-sm"
                      >
                        <option value="" className="bg-purple-950">Pilih</option>
                        <option value="Kepala Keluarga" className="bg-purple-950">Kepala Keluarga</option>
                        <option value="Istri" className="bg-purple-950">Istri</option>
                        <option value="Anak" className="bg-purple-950">Anak</option>
                        <option value="Lainnya" className="bg-purple-950">Lainnya</option>
                      </select>
                    </div>
                    <div>
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 md:mb-3 block">JK</label>
                       <select 
                        value={ag.jk} 
                        onChange={e => updateMember(i, 'jk', e.target.value)}
                        disabled={isReadOnly}
                        required
                        className="w-full px-4 md:px-6 py-2.5 md:py-4 bg-white/5 border-2 border-white/10 rounded-xl md:rounded-2xl font-black text-white text-xs md:text-sm focus:border-blue-600 focus:bg-white/10 outline-none transition-all shadow-sm"
                      >
                        <option value="" className="bg-purple-950">Pilih</option>
                        <option value="Laki-laki" className="bg-purple-950">Laki-laki</option>
                        <option value="Perempuan" className="bg-purple-950">Perempuan</option>
                      </select>
                    </div>
                    
                    <div>
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 md:mb-3 block">Tempat Lahir</label>
                       <input 
                        value={ag.tempat_lahir} 
                        onChange={e => updateMember(i, 'tempat_lahir', e.target.value)}
                        disabled={isReadOnly}
                        required
                        className="w-full px-4 md:px-6 py-2.5 md:py-4 bg-white/5 border-2 border-white/10 rounded-xl md:rounded-2xl font-bold text-white text-xs md:text-sm focus:border-blue-600 focus:bg-white/10 outline-none"
                      />
                    </div>
                    <div>
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 md:mb-3 block">Tgl Lahir</label>
                       <input 
                        type="date"
                        value={ag.tgl} 
                        onChange={e => updateMember(i, 'tgl', e.target.value)}
                        disabled={isReadOnly}
                        required
                        className="w-full px-4 md:px-6 py-2.5 md:py-4 bg-white/5 border-2 border-white/10 rounded-xl md:rounded-2xl font-bold text-white text-xs md:text-sm focus:border-blue-600 focus:bg-white/10 outline-none"
                      />
                    </div>
                    <div>
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 md:mb-3 block">Pendidikan</label>
                       <input 
                        value={ag.pendidikan} 
                        onChange={e => updateMember(i, 'pendidikan', e.target.value)}
                        disabled={isReadOnly}
                        required
                        className="w-full px-4 md:px-6 py-2.5 md:py-4 bg-white/5 border-2 border-white/10 rounded-xl md:rounded-2xl font-bold text-white text-xs md:text-sm focus:border-blue-600 focus:bg-white/10 outline-none"
                      />
                    </div>
                    <div>
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 md:mb-3 block">Pekerjaan</label>
                       <input 
                        value={ag.pekerjaan} 
                        onChange={e => updateMember(i, 'pekerjaan', e.target.value)}
                        disabled={isReadOnly}
                        required
                        className="w-full px-4 md:px-6 py-2.5 md:py-4 bg-white/5 border-2 border-white/10 rounded-xl md:rounded-2xl font-bold text-white text-xs md:text-sm focus:border-blue-600 focus:bg-white/10 outline-none"
                      />
                    </div>

                    <div>
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 md:mb-3 block">Agama</label>
                       <select 
                        value={ag.agama} 
                        onChange={e => updateMember(i, 'agama', e.target.value)}
                        disabled={isReadOnly}
                        required
                        className="w-full px-4 md:px-6 py-2.5 md:py-4 bg-white/5 border-2 border-white/10 rounded-xl md:rounded-2xl font-black text-white text-xs md:text-sm focus:border-blue-600 focus:bg-white/10 outline-none"
                      >
                        <option value="" className="bg-purple-950">Pilih</option>
                        <option value="Islam" className="bg-purple-950">Islam</option>
                        <option value="Kristen" className="bg-purple-950">Kristen</option>
                        <option value="Katolik" className="bg-purple-950">Katolik</option>
                        <option value="Hindu" className="bg-purple-950">Hindu</option>
                        <option value="Budha" className="bg-purple-950">Budha</option>
                      </select>
                    </div>
                    <div>
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 md:mb-3 block">Bansos</label>
                       <select 
                        value={ag.bansos} 
                        onChange={e => updateMember(i, 'bansos', e.target.value)}
                        disabled={isReadOnly}
                        className="w-full px-4 md:px-6 py-2.5 md:py-4 bg-blue-500/10 border-2 border-blue-500/20 rounded-xl md:rounded-2xl font-black text-blue-400 text-xs md:text-sm focus:border-blue-600 outline-none transition-all shadow-inner"
                      >
                        <option value="" className="bg-purple-950">Tidak Ada</option>
                        <option value="PKH" className="bg-purple-950">PKH</option>
                        <option value="BPNT" className="bg-purple-950">BPNT</option>
                        <option value="BLT" className="bg-purple-950">BLT</option>
                        <option value="BPJS" className="bg-purple-950">BPJS</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </form>

        <div className="bg-slate-900 px-6 py-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 bg-white/10 text-blue-400 rounded-full flex items-center justify-center border border-white/10 shadow-inner">
                <Info size={18} />
             </div>
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-loose max-w-[300px]">
                Seluruh data akan disimpan dalam infrastruktur SIAK yang aman.
             </p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button 
              type="button"
              onClick={onClose} 
              className="flex-1 sm:flex-none px-8 py-3 bg-white/5 border border-white/10 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all font-sans"
            >
              Batalkan
            </button>
            {!isReadOnly && (
              <button 
                type="submit"
                onClick={handleSumbit} 
                className="flex-1 sm:flex-none px-10 py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-[0_20px_50px_rgba(37,99,235,0.3)] active:scale-95 flex items-center justify-center gap-2"
              >
                <Save size={16} /> Simpan Berkas
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function StatsModal({ db, onClose }: { db: Family[], onClose: () => void }) {
  const stats = useMemo(() => {
    let totalJiwa = 0, l = 0, p = 0, bansos = 0, balita = 0, lansia = 0;
    const distribusiAlamat: Record<string, number> = {};
    
    db.forEach(f => {
      totalJiwa += f.anggota.length;
      distribusiAlamat[f.alamat] = (distribusiAlamat[f.alamat] || 0) + 1;
      f.anggota.forEach(a => {
        if (a.jk === 'Laki-laki') l++;
        if (a.jk === 'Perempuan') p++;
        if (a.bansos) bansos++;
        const age = hitungUmur(a.tgl);
        if (age <= 5) balita++;
        if (age >= 60) lansia++;
      });
    });
    return { 
      totalFamilies: db.length, 
      totalResidents: totalJiwa, 
      genderMale: l, 
      genderFemale: p, 
      bansos, 
      children: balita, 
      elders: lansia,
      distribusiAlamat 
    };
  }, [db]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" 
        onClick={onClose} 
      />
      
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-xl h-[92vh] bg-white rounded-[3rem] shadow-[0_50px_150px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col border border-white/20"
      >
        <div className="bg-slate-900 border-b-4 border-blue-600 px-6 py-6 flex items-center justify-between relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center text-blue-500 border border-blue-500/20 shadow-inner">
              <BarChart3 size={24} />
            </div>
            <div>
              <h3 className="text-white text-xl font-black tracking-tighter uppercase leading-none">Statistik</h3>
              <p className="text-slate-400 text-[8px] font-black uppercase tracking-[0.3em] mt-1.5 flex items-center gap-2">
                <Shield size={10} /> Dasbor Ringkasan Eksekutif v2.0
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-11 h-11 bg-white/5 hover:bg-white/10 text-white rounded-full flex items-center justify-center transition-all border border-white/10 active:scale-90"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-10 scrollbar-none bg-white">
          {/* Executive Overview - Image Match */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Penduduk", value: stats.totalResidents, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
              { label: "Keluarga", value: stats.totalFamilies, icon: Shield, color: "text-emerald-500", bg: "bg-emerald-500/10" },
              { label: "Pria", value: stats.genderMale, icon: UserIcon, color: "text-amber-500", bg: "bg-amber-500/10" },
              { label: "Wanita", value: stats.genderFemale, icon: UserIcon, color: "text-rose-500", bg: "bg-rose-500/10" }
            ].map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="p-6 rounded-[2.5rem] bg-[#d4cfe4] border border-slate-200/50 flex flex-col items-start shadow-sm"
              >
                <div className={`mb-6 text-2xl`}>
                  <item.icon size={20} className="text-slate-600 opacity-80" />
                </div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 leading-none opacity-60">{item.label}</p>
                <h4 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-2">
                  {item.value} 
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Jiwa</span>
                </h4>
              </motion.div>
            ))}
          </div>

          <div className="h-px bg-slate-100 w-full opacity-50"></div>

          {/* Gender Indicator - Image Match style */}
          <div className="space-y-6">
             <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
             
             <div className="space-y-8 px-2">
                <div className="space-y-3">
                   <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pria</span>
                      <span className="text-xs font-black text-slate-900">{stats.genderMale} Jiwa</span>
                   </div>
                   <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(stats.genderMale / (stats.totalResidents || 1)) * 100}%` }}
                        className="h-full bg-blue-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                      />
                   </div>
                </div>

                <div className="space-y-3">
                   <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Wanita</span>
                      <span className="text-xs font-black text-slate-900">{stats.genderFemale} Jiwa</span>
                   </div>
                   <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(stats.genderFemale / (stats.totalResidents || 1)) * 100}%` }}
                        className="h-full bg-rose-500 rounded-full shadow-[0_0_20px_rgba(244,63,94,0.3)]"
                      />
                   </div>
                </div>
             </div>
          </div>
        </div>

        <div className="bg-slate-900 p-8 text-center border-t border-white/5 relative overflow-hidden">
           <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
           <p className="text-blue-400 text-[8px] font-black uppercase tracking-[0.4em] leading-relaxed relative z-10 max-w-xs mx-auto">
             Data terhitung secara real-time berdasarkan pembaruan data kependudukan terbaru.
           </p>
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
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        className="w-full max-w-xl bg-white rounded-[2.5rem] shadow-[0_50px_150px_rgba(0,0,0,0.5)] relative max-h-[95vh] overflow-hidden border border-white/20 flex flex-col"
      >
        {/* Header */}
        <div className="bg-slate-900 px-6 py-6 border-b-4 border-blue-600 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10 shadow-inner">
               <FileText className="text-blue-500" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tighter leading-none mb-1 uppercase">Drafting Surat</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Administrasi Digital</p>
            </div>
          </div>
          <button onClick={onClose} className="w-11 h-11 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full transition-all active:scale-95">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 sm:p-10 space-y-8 bg-white">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full">
            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none">Generate {type}</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Pilih Target Warga</label>
              <div className="relative group">
                <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  list="wargaList"
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 focus:bg-white font-black text-slate-900 text-sm transition-all shadow-sm"
                  placeholder="Mulai ketik nama..."
                  required
                />
                <datalist id="wargaList">
                  {residentOptions.map((r, i) => <option key={i} value={r.nama} />)}
                </datalist>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Identifikasi Berkas</label>
              <div className="relative group">
                <FileText className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  value={nomorSurat}
                  onChange={(e) => setNomorSurat(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 focus:bg-white font-bold text-slate-600 text-sm transition-all shadow-sm"
                  required
                />
              </div>
            </div>

            {type === 'Surat Keterangan Usaha' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Objek Usaha / Niaga</label>
                <div className="relative group">
                  <Shield className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                  <input 
                    value={usaha}
                    onChange={(e) => setUsaha(e.target.value)}
                    placeholder="e.g. Toko Kelontong, UMKM"
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 focus:bg-white font-black text-slate-900 text-sm transition-all shadow-sm placeholder:text-slate-400"
                    required
                  />
                </div>
              </div>
            )}

            <div className="pt-4">
              <button type="submit" className="w-full py-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-black uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-blue-500/30 hover:scale-[1.02] active:scale-95 transition-all duration-300 flex items-center justify-center gap-3 text-xs">
                <Printer size={20} /> Cetak & Pratinjau
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="bg-slate-900 px-6 py-6 border-t border-white/10 text-center">
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-loose">
              Data terhitung secara real-time berdasarkan basis data kependudukan terbaru.
           </p>
        </div>
      </motion.div>
    </div>
  );
}

function PreviewModal({ data, onClose }: { data: any, onClose: () => void }) {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const autoScale = () => {
      if (window.innerWidth < 768) {
        const padding = 20;
        const availableWidth = window.innerWidth - padding;
        const docWidth = 794; // approx 210mm
        setZoom(Math.min(availableWidth / docWidth, 1));
      } else {
        setZoom(1);
      }
    };
    autoScale();
    window.addEventListener('resize', autoScale);
    return () => window.removeEventListener('resize', autoScale);
  }, []);

  const downloadPdf = () => {
    if (!printAreaRef.current) return;
    setIsDownloading(true);
    
    const element = printAreaRef.current;
    const opt = {
      margin: 0,
      filename: `${data.type}-${data.resident.nama}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    };

    html2pdf().from(element).set(opt).save().then(() => {
      setIsDownloading(false);
    }).catch((err: any) => {
      console.error(err);
      setIsDownloading(false);
      alert("Gagal mengunduh PDF.");
    });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/98 backdrop-blur-xl flex flex-col overflow-hidden">
      {/* Header - Compact on Mobile */}
      <div className="no-print bg-slate-900/80 backdrop-blur-md p-3 sm:p-5 flex items-center justify-between gap-4 z-50 border-b border-white/10 shadow-2xl">
        <div className="flex items-center gap-3 text-white overflow-hidden">
          <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shrink-0">
            <FileText className="text-white" size={18} />
          </div>
          <div className="overflow-hidden">
            <p className="font-black text-xs sm:text-base uppercase tracking-widest leading-none mb-0.5 sm:mb-1">Pratinjau</p>
            <p className="text-[9px] sm:text-xs opacity-60 font-bold uppercase truncate">{data.type}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Controls for Mobile */}
          <div className="hidden sm:flex items-center bg-white/10 rounded-xl p-1 border border-white/10 mr-2">
            <button onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"><ChevronDown size={16} /></button>
            <span className="px-2 text-[10px] font-black text-white w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(prev => Math.min(2, prev + 0.1))} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"><ChevronRight className="-rotate-90" size={16} /></button>
          </div>

          <button 
            onClick={downloadPdf}
            disabled={isDownloading}
            className="px-4 sm:px-8 py-2 sm:py-4 bg-blue-600 text-white font-black rounded-xl sm:rounded-2xl hover:bg-blue-500 flex items-center justify-center gap-2 shadow-xl shadow-blue-600/20 active:scale-95 transition-all text-[10px] sm:text-sm disabled:opacity-50"
          >
            {isDownloading ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />} 
            <span className="hidden xs:inline">{isDownloading ? 'Memproses...' : 'Unduh PDF'}</span>
            <span className="xs:hidden">{isDownloading ? '...' : 'PDF'}</span>
          </button>
          
          <button onClick={onClose} className="p-2 sm:p-4 bg-white/10 text-white rounded-xl sm:rounded-2xl hover:bg-white/20 transition-all active:scale-95 border border-white/10">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Document Area - Centered and Scalable */}
      <div className="flex-1 overflow-auto p-4 sm:p-10 flex justify-center items-start scrollbar-hide bg-slate-900/40">
        <div 
          style={{ 
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            transition: 'transform 0.2s ease-out'
          }}
          className="shadow-2xl mb-20 origin-top"
        >
          <div ref={printAreaRef} className="bg-white p-8 sm:p-20 text-black print:shadow-none print:m-0 print:w-full print:p-[15mm] text-[12pt] print-area relative" style={{ width: '210mm', minHeight: '297mm', fontFamily: '"Times New Roman", Times, serif' }}>
          <div className="flex items-start gap-4 pb-4 mb-4 border-b-4 border-black">
            <div className="w-24 h-24 flex items-center justify-center overflow-hidden shrink-0">
               <img src="https://media.istockphoto.com/id/1141706692/vector/eagle-symbol-isolated-vector-graphic-on-white-background.jpg?s=612x612&w=0&k=20&c=qF5XFvR-zI1_bC99R_N2e8yI6Q839DoxuJ2F7iY9h_0=" className="w-full grayscale brightness-0" alt="Logo" />
            </div>
            <div className="flex-1 text-center font-bold">
              <p className="text-[14pt] leading-tight mb-1">PEMERINTAH KABUPATEN SERAM BAGIAN BARAT</p>
              <p className="text-[14pt] leading-tight mb-1">KECAMATAN HUAMUAL</p>
              <p className="text-[14pt] leading-tight mb-1">NEGERI LUHU</p>
              <p className="text-[18pt] leading-none mt-2">DUSUN AMAHOLU LOSY</p>
            </div>
          </div>

          <div className="text-center mt-8 mb-10">
            <h3 className="text-[16pt] font-bold uppercase underline inline-block leading-none">{data.type}</h3>
            <p className="mt-2 text-[12pt]">Nomor : {data.nomor}</p>
          </div>

          <div className="text-[12pt] leading-relaxed text-justify space-y-6">
            <p>
              Yang bertanda tangan di bawah ini Kepala Dusun Amaholu Losy, Kecamatan Huamual, Kabupaten Seram Bagian Barat, dengan ini menerangkan bahwa :
            </p>

            <table className="w-full border-collapse">
              <tbody>
                <tr><td className="w-56 py-1 align-top">Nama Lengkap</td><td className="w-4 align-top">:</td><td className="font-bold py-1 uppercase">{data.resident.nama}</td></tr>
                <tr><td className="w-56 py-1 align-top">NIK</td><td className="align-top">:</td><td className="py-1">{data.resident.nik}</td></tr>
                <tr><td className="w-56 py-1 align-top">Tempat, Tgl Lahir</td><td className="align-top">:</td><td className="py-1">{data.resident.tempat_lahir}, {formatTanggalIndonesia(data.resident.tgl)}</td></tr>
                <tr><td className="w-56 py-1 align-top">Alamat</td><td className="align-top">:</td><td className="py-1 leading-snug">
                  Dusun {data.resident.family.alamat}, RT/RW {data.resident.family.rt_rw}, 
                  Desa {data.resident.family.Desa}, Kec. {data.resident.family.Kecamatan}, 
                  Kab. {data.resident.family.Kabupaten}, Prov. {data.resident.family.Provinsi}
                </td></tr>
              </tbody>
            </table>

            <div className="pt-4">
              {data.type === 'Surat Keterangan Usaha' && (
                <p>Adalah benar yang bersangkutan adalah warga masyarakat Dusun Amaholu Losy yang memiliki usaha aktif berupa <b>{data.usaha}</b>.</p>
              )}
              
              {data.type === 'Surat Keterangan Domisili' && (
                <p>Adalah benar yang bersangkutan adalah warga masyarakat yang berdomisili menetap di Dusun Amaholu Losy.</p>
              )}

              {data.type === 'Surat Keterangan Tidak Mampu' && (
                <p>Adalah benar yang bersangkutan merupakan warga masyarakat Dusun Amaholu Losy yang tergolong dalam keluarga ekonomi kurang mampu / rentan miskin.</p>
              )}

              {data.type === 'Surat Keterangan Kematian' && (
                <p>Adalah benar almarhum/almarhumah tercatat sebagai warga masyarakat Dusun Amaholu Losy yang telah dinyatakan meninggal dunia.</p>
              )}

              <p className="mt-4">Demikian surat keterangan ini kami berikan kepada yang bersangkutan untuk dapat dipergunakan sebagaimana mestinya.</p>
            </div>
          </div>

          <div className="mt-16 ml-auto w-80 text-center text-[12pt]">
             <p>Amaholu Losy, {formatTanggalIndonesia(new Date().toISOString())}</p>
             <p className="mt-2">Mengetahui,</p>
             <p className="font-bold">Kepala Dusun Amaholu Losy</p>
             <div className="h-20"></div>
             <p className="font-bold underline uppercase">FAUJI ALI</p>
          </div>
        </div>
      </div>
    </div>
      
    <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0 !important; }
          .print-area { 
            position: absolute !important; 
            top: 0 !important; 
            left: 0 !important; 
            width: 100% !important; 
            height: auto !important; 
            padding: 15mm !important; 
            margin: 0 !important; 
            box-shadow: none !important;
            visibility: visible !important;
          }
          body > *:not(.print-root) { display: none !important; }
          .print-root { visibility: visible !important; }
          .print-root > *:not(.print-area-container) { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}

function PrintKKModal({ family, onClose }: { family: Family, onClose: () => void }) {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const autoScale = () => {
      if (window.innerWidth < 1024) { // KK is landscape (297mm), needs more scale
        const padding = 20;
        const availableWidth = window.innerWidth - padding;
        const docWidth = 1122; // approx 297mm
        setZoom(Math.min(availableWidth / docWidth, 1));
      } else {
        setZoom(1);
      }
    };
    autoScale();
    window.addEventListener('resize', autoScale);
    return () => window.removeEventListener('resize', autoScale);
  }, []);

  const downloadPdf = () => {
    if (!printAreaRef.current) return;
    setIsDownloading(true);
    
    const element = printAreaRef.current;
    const opt = {
      margin: 0,
      filename: `Kartu-Keluarga-${family.no_kk}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'landscape' as const }
    };

    html2pdf().from(element).set(opt).save().then(() => {
      setIsDownloading(false);
    }).catch((err: any) => {
      console.error(err);
      setIsDownloading(false);
      alert("Gagal mengunduh PDF.");
    });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/98 backdrop-blur-xl flex flex-col overflow-hidden">
      {/* Header - Compact on Mobile */}
      <div className="no-print bg-slate-900/80 backdrop-blur-md p-3 sm:p-5 flex items-center justify-between gap-4 z-50 border-b border-white/10 shadow-2xl">
        <div className="flex items-center gap-3 text-white overflow-hidden">
          <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg shrink-0">
            <Printer className="text-white" size={18} />
          </div>
          <div className="overflow-hidden">
            <p className="font-black text-xs sm:text-base uppercase tracking-widest leading-none mb-0.5 sm:mb-1">Kartu Keluarga</p>
            <p className="text-[9px] sm:text-xs opacity-60 font-bold uppercase truncate">KK: {family.no_kk}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="hidden md:flex items-center bg-white/10 rounded-xl p-1 border border-white/10 mr-2">
            <button onClick={() => setZoom(prev => Math.max(0.3, prev - 0.1))} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"><ChevronDown size={16} /></button>
            <span className="px-2 text-[10px] font-black text-white w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(prev => Math.min(2, prev + 0.1))} className="p-2 hover:bg-white/10 rounded-lg text-white transition-colors"><ChevronRight className="-rotate-90" size={16} /></button>
          </div>

          <button 
            onClick={downloadPdf}
            disabled={isDownloading}
            className="px-4 sm:px-8 py-2 sm:py-4 bg-emerald-600 text-white font-black rounded-xl sm:rounded-2xl hover:bg-emerald-500 flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/20 active:scale-95 transition-all text-[10px] sm:text-sm disabled:opacity-50"
          >
            {isDownloading ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />} 
            <span className="hidden xs:inline">{isDownloading ? 'Memproses...' : 'Unduh KK PDF'}</span>
            <span className="xs:hidden">{isDownloading ? '...' : 'PDF'}</span>
          </button>
          
          <button onClick={onClose} className="p-2 sm:p-4 bg-white/10 text-white rounded-xl sm:rounded-2xl hover:bg-white/20 transition-all active:scale-95 border border-white/10">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Document Area */}
      <div className="flex-1 overflow-auto p-4 sm:p-10 flex justify-center items-start scrollbar-hide bg-slate-900/40">
        <div 
          style={{ 
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            transition: 'transform 0.2s ease-out'
          }}
          className="shadow-2xl mb-20 origin-top"
        >
          <div ref={printAreaRef} className="bg-white p-12 text-black print:shadow-none print:m-0 print:w-full print:p-8 print-area relative" style={{ width: '297mm', minHeight: '210mm', fontFamily: '"Times New Roman", serif' }}>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold uppercase tracking-widest">KARTU KELUARGA</h2>
            <p className="text-xl font-bold mt-1">No. {family.no_kk}</p>
          </div>

          <div className="grid grid-cols-2 gap-12 text-sm font-bold mb-8">
            <div className="space-y-1">
              <div className="flex"><span className="w-32 uppercase">Nama Kepala Keluarga</span><span>: {family.anggota.find(a => a.hubungan === 'Kepala Keluarga')?.nama || '-'}</span></div>
              <div className="flex"><span className="w-32 uppercase">Alamat</span><span>: {family.alamat}</span></div>
              <div className="flex"><span className="w-32 uppercase">RT/RW</span><span>: {family.rt_rw}</span></div>
              <div className="flex"><span className="w-32 uppercase">Desa/Kelurahan</span><span>: {family.Desa}</span></div>
            </div>
            <div className="space-y-1">
              <div className="flex"><span className="w-32 uppercase">Kecamatan</span><span>: {family.Kecamatan}</span></div>
              <div className="flex"><span className="w-32 uppercase">Kabupaten/Kota</span><span>: {family.Kabupaten}</span></div>
              <div className="flex"><span className="w-32 uppercase">Kode Pos</span><span>: -</span></div>
              <div className="flex"><span className="w-32 uppercase">Provinsi</span><span>: {family.Provinsi}</span></div>
            </div>
          </div>

          <table className="w-full border-collapse border-2 border-black text-xs">
            <thead className="bg-slate-100">
              <tr>
                <th className="border-2 border-black p-1 text-center font-bold">No</th>
                <th className="border-2 border-black p-1 text-center font-bold">Nama Lengkap</th>
                <th className="border-2 border-black p-1 text-center font-bold">NIK</th>
                <th className="border-2 border-black p-1 text-center font-bold">Jenis Kelamin</th>
                <th className="border-2 border-black p-1 text-center font-bold">Tempat Lahir</th>
                <th className="border-2 border-black p-1 text-center font-bold">Tanggal Lahir</th>
                <th className="border-2 border-black p-1 text-center font-bold">Agama</th>
                <th className="border-2 border-black p-1 text-center font-bold">Pendidikan</th>
                <th className="border-2 border-black p-1 text-center font-bold">Jenis Pekerjaan</th>
              </tr>
            </thead>
            <tbody>
              {family.anggota.map((a, i) => (
                <tr key={i}>
                  <td className="border-2 border-black p-1 text-center">{i + 1}</td>
                  <td className="border-2 border-black p-1 font-bold">{a.nama}</td>
                  <td className="border-2 border-black p-1 text-center">{a.nik}</td>
                  <td className="border-2 border-black p-1 text-center">{a.jk}</td>
                  <td className="border-2 border-black p-1 text-center">{a.tempat_lahir}</td>
                  <td className="border-2 border-black p-1 text-center">{formatTanggalIndonesia(a.tgl)}</td>
                  <td className="border-2 border-black p-1 text-center">{a.agama}</td>
                  <td className="border-2 border-black p-1 text-center">{a.pendidikan}</td>
                  <td className="border-2 border-black p-1 text-center">{a.pekerjaan}</td>
                </tr>
              ))}
              {Array.from({ length: Math.max(0, 10 - family.anggota.length) }).map((_, i) => (
                <tr key={`empty-${i}`}>
                   <td className="border-2 border-black p-1 text-center">{family.anggota.length + i + 1}</td>
                   <td className="border-2 border-black p-1">&nbsp;</td>
                   <td className="border-2 border-black p-1">&nbsp;</td>
                   <td className="border-2 border-black p-1">&nbsp;</td>
                   <td className="border-2 border-black p-1">&nbsp;</td>
                   <td className="border-2 border-black p-1">&nbsp;</td>
                   <td className="border-2 border-black p-1">&nbsp;</td>
                   <td className="border-2 border-black p-1">&nbsp;</td>
                   <td className="border-2 border-black p-1">&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-8 flex justify-between text-sm px-10">
            <div className="text-center">
              <p>&nbsp;</p>
              <p>KEPALA KELUARGA</p>
              <div className="h-20"></div>
              <p className="font-bold underline uppercase">{family.anggota.find(a => a.hubungan === 'Kepala Keluarga')?.nama || '-'}</p>
            </div>
            <div className="text-center">
              <p>DIKELUARKAN DI : Amaholu Losy</p>
              <p>PADA TANGGAL : {formatTanggalIndonesia(new Date().toISOString())}</p>
              <p>KEPALA DUSUN AMAHOLU LOSY</p>
              <div className="h-16"></div>
              <p className="font-bold underline uppercase">FAUJI ALI</p>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .no-print-bg { background: white !important; }
          body { background: white !important; margin: 0 !important; }
          .fixed { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: auto !important; background: white !important; display: block !important; overflow: visible !important; }
          .shadow-2xl { box-shadow: none !important; }
          .mx-auto { margin: 0 !important; }
          @page { size: landscape; margin: 0; }
          .print-area { width: 100% !important; padding: 15mm !important; box-shadow: none !important; margin: 0 !important; }
          .print-root > *:not(.print-area) { display: none !important; }
        }
      `}</style>
    </div>
  </div>
);
}
