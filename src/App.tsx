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
              className="mb-6 w-[22rem] md:w-[26rem] h-[600px] bg-white rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.25)] border border-white/20 flex flex-col overflow-hidden relative"
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
          {!showChat && (
             <motion.div 
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               className="px-4 py-2 bg-white rounded-xl shadow-xl border border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500 pointer-events-none whitespace-nowrap"
             >
               Punya pertanyaan? 👇
             </motion.div>
          )}
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
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-6xl bg-white rounded-[3.5rem] overflow-hidden shadow-[0_50px_150px_rgba(0,0,0,0.5)] flex flex-col md:flex-row relative z-10 border border-white/20"
      >
        <div className="w-full md:w-[45%] p-12 md:p-16 text-white flex flex-col justify-center bg-slate-900 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
          
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center p-4 mb-10 shadow-2xl relative z-10"
          >
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Garuda_Pancasila_Coat_of_Arms_of_Indonesia.svg/800px-Garuda_Pancasila_Coat_of_Arms_of_Indonesia.svg.png" 
              alt="Logo Garuda" 
              className="w-full h-full object-contain brightness-0"
            />
          </motion.div>

          <div className="relative z-10 mt-auto">
            <h1 className="text-4xl md:text-5xl font-black leading-tight mb-4 tracking-tighter uppercase">
              SIAK <span className="text-blue-500">PORTAL</span>
            </h1>
            <div className="h-1.5 w-20 bg-amber-500 rounded-full mb-8"></div>
            <p className="text-slate-400 text-lg font-bold uppercase tracking-[0.2em] mb-4">Negeri Luhu</p>
            <p className="text-slate-500 text-sm leading-relaxed max-w-sm mb-12">
              Sistem Informasi Administrasi Kependudukan Terpadu untuk Dusun Amaholu Losy. Berdedikasi untuk pelayanan terbaik dan integritas data.
            </p>

            <div className="space-y-4">
               <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white/5 p-4 rounded-2xl border border-white/5">
                  <Shield size={16} className="text-blue-500" /> Sesi Terenkripsi Aman
               </div>
               <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white/5 p-4 rounded-2xl border border-white/5">
                  <Info size={16} className="text-amber-500" /> Identitas Digital Terverifikasi
               </div>
            </div>
          </div>
        </div>

        <div className="w-full md:w-[55%] bg-white p-12 md:p-20 flex flex-col justify-center">
          <div className="mb-12">
             <p className="text-blue-600 text-xs font-black uppercase tracking-[0.4em] mb-2 leading-none">Otentikasi Diperlukan</p>
             <h2 className="text-4xl font-black text-slate-900 tracking-tight">Kontrol Akses</h2>
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

            <button type="submit" className="w-full py-6 bg-slate-900 text-white font-black uppercase tracking-[0.2em] rounded-[1.5rem] shadow-[0_20px_50px_rgba(15,23,42,0.3)] hover:bg-slate-800 hover:-translate-y-1 active:translate-y-0 transition-all duration-300 group">
              Otorisasi Masuk
            </button>
          </form>

          <div className="mt-16 flex items-center justify-between">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-loose max-w-[200px]">
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
      <header className="bg-slate-950 border-b-2 md:border-b-4 border-amber-500 py-1.5 md:py-2 px-3 md:px-8 flex items-center justify-between sticky top-0 z-40 no-print shadow-2xl relative overflow-hidden">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]"></div>
        
        <div className="flex items-center gap-2 md:gap-4 group cursor-pointer relative z-10">
          <div className="w-8 h-8 md:w-11 md:h-11 bg-white rounded-lg md:rounded-xl flex items-center justify-center p-1 md:p-1.5 shadow-[0_0_20px_rgba(255,255,255,0.1)] ring-1 ring-white/20 transition-transform duration-500 group-hover:rotate-6">
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Garuda_Pancasila_Coat_of_Arms_of_Indonesia.svg/800px-Garuda_Pancasila_Coat_of_Arms_of_Indonesia.svg.png" 
              alt="Logo Indonesia" 
              className="w-full h-full object-contain brightness-0"
            />
          </div>
          <div className="block">
            <h1 className="font-black text-xs md:text-xl text-white leading-none tracking-tighter uppercase">SIAK <span className="hidden xs:inline">PROFESSIONAL</span></h1>
            <div className="flex items-center gap-1.5 mt-0.5 md:mt-1.5">
              <span className="text-[7px] md:text-[9px] bg-amber-500 text-slate-900 px-1 md:px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest">AMAHOLU</span>
              <span className="text-[7px] md:text-[9px] text-slate-400 font-bold uppercase tracking-widest opacity-80 border-l border-slate-700 pl-1.5 md:pl-2 hidden xs:block">MALUKU</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 relative z-10">
          <div className="hidden sm:flex items-center gap-3 px-4 py-1.5 bg-white/5 border border-white/10 rounded-xl shadow-inner backdrop-blur-md">
            <div className="relative">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-lg flex items-center justify-center text-blue-400 ring-1 ring-white/10">
                {session.role === 'admin' ? <Shield size={16} /> : <UserIcon size={16} />}
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-[3px] border-slate-950"></div>
            </div>
            <div className="text-right">
              <p className="text-xs font-black text-white leading-none">{session.nama}</p>
              <p className="text-[8px] text-blue-400 font-black uppercase mt-1 tracking-[0.2em]">{session.role}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="group flex items-center justify-center h-8 md:h-10 px-3 md:px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg md:rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-red-900/40 hover:scale-105 active:scale-95"
            title="Keluar Sistem"
          >
            <LogOut size={14} className="group-hover:-translate-x-1 transition-transform md:w-4 md:h-4" />
            <span className="hidden sm:inline ml-2">Selesai</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden no-print">
        {/* Sidebar Mini Ungu */}
        <aside className="hidden md:flex w-16 lg:w-20 bg-purple-950 flex-col items-center py-8 gap-8 border-r border-white/5 overflow-y-auto scrollbar-none shadow-2xl relative z-30 shrink-0">
          <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-purple-400 border border-white/5 hover:bg-white/10 transition-all cursor-pointer group tooltip-trigger relative" title="Data Induk">
            <Users size={20} className="group-hover:scale-110 transition-transform" />
          </div>
          <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-purple-400 border border-white/5 hover:bg-white/10 transition-all cursor-pointer group" title="Layanan Surat">
            <FileText size={20} className="group-hover:scale-110 transition-transform" />
          </div>
          <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-purple-400 border border-white/5 hover:bg-white/10 transition-all cursor-pointer group" title="Statistik">
            <BarChart3 size={20} className="group-hover:scale-110 transition-transform" />
          </div>
          <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-purple-400 border border-white/5 hover:bg-white/10 transition-all cursor-pointer group" title="Registrasi">
            <PlusCircle size={20} className="group-hover:scale-110 transition-transform" />
          </div>
          
          <div className="mt-auto flex flex-col gap-6">
            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-purple-400 border border-white/5 hover:bg-white/10 transition-all cursor-pointer group" title="Bantuan">
              <MessageSquare size={18} />
            </div>
            <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-400 border border-red-500/10 hover:bg-red-500/20 transition-all cursor-pointer group" onClick={onLogout} title="Keluar">
              <LogOut size={18} />
            </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto scrollbar-official">
            <div className="bg-slate-900 pt-8 pb-14 relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-blue-600/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px]"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-600/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-[80px]"></div>
              </div>
              
              <div className="container mx-auto px-6 relative z-10">
                {/* Menu Navigasi di Atas */}
                <nav className="flex flex-wrap items-stretch justify-center gap-1.5 md:gap-2 bg-white/5 p-1.5 md:p-2 rounded-2xl md:rounded-[2rem] border border-white/10 backdrop-blur-xl shadow-2xl mb-12">
                  <button 
                    onClick={() => {
                      const el = document.getElementById('database-section');
                      el?.scrollIntoView({ behavior: 'smooth' });
                      setAdminMenuOpen(false);
                    }}
                    className="group flex-1 min-w-[70px] md:min-w-[120px] py-1.5 md:py-2.5 px-2 md:px-5 rounded-lg md:rounded-2xl text-slate-300 font-black text-[8px] md:text-[10px] uppercase tracking-widest hover:bg-white hover:text-slate-900 transition-all flex flex-col items-center justify-center gap-1 md:gap-1.5 border border-transparent hover:border-white/20"
                  >
                    <Users size={14} className="md:w-[18px] md:h-[18px] group-hover:scale-110 transition-transform" /> 
                    <span>Data</span>
                  </button>

                  <div className="relative group flex-1 min-w-[70px] md:min-w-[120px]">
                    <button 
                      onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                      className={`w-full h-full py-1.5 md:py-2.5 px-2 md:px-5 rounded-lg md:rounded-2xl font-black text-[8px] md:text-[10px] uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-1 md:gap-1.5 border ${
                        adminMenuOpen ? 'bg-white text-slate-900 border-white' : 'text-slate-300 hover:bg-white hover:text-slate-900 border-transparent hover:border-white/20'
                      }`}
                    >
                      <FileText size={14} className="md:w-[18px] md:h-[18px] group-hover:scale-110 transition-transform" /> 
                      <span className="flex items-center gap-1 md:gap-2 whitespace-nowrap">Surat <ChevronDown size={10} className={`transition-all duration-500 ${adminMenuOpen ? 'rotate-180' : ''}`} /></span>
                    </button>
                    
                    <AnimatePresence>
                      {adminMenuOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-[4px] md:hidden"
                            onClick={() => setAdminMenuOpen(false)}
                          />
                          <motion.div 
                            initial={{ opacity: 0, y: 15, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 15, scale: 0.95 }}
                            className="fixed inset-x-8 top-1/2 -translate-y-1/2 md:absolute md:inset-x-auto md:top-full md:left-1/2 md:-translate-x-1/2 md:translate-y-0 mt-0 md:mt-4 w-auto md:w-80 bg-white rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.4)] border border-slate-100 z-50 p-4 ring-1 ring-slate-200"
                          >
                            <div className="px-4 py-3 border-b border-slate-50 mb-2 text-center md:text-left">
                              <p className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] mb-1">Administrasi Digital</p>
                              <h4 className="text-base font-black text-slate-900 tracking-tight">Dokumen Kedinasan</h4>
                            </div>
                            <div className="grid grid-cols-1 gap-1">
                              {[
                                { name: "Surat Keterangan Usaha", icon: "💼", color: "bg-amber-50 text-amber-600" },
                                { name: "Surat Keterangan Tidak Mampu", icon: "🤝", color: "bg-blue-50 text-blue-600" },
                                { name: "Surat Keterangan Kematian", icon: "🕊️", color: "bg-slate-50 text-slate-600" },
                                { name: "Surat Keterangan Domisili", icon: "🏠", color: "bg-emerald-50 text-emerald-600" }
                              ].map((item) => (
                                <button 
                                  key={item.name}
                                  onClick={() => {
                                    openLetter(item.name as LetterType);
                                    setAdminMenuOpen(false);
                                  }}
                                  className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-blue-600 transition-all flex items-center gap-3 group"
                                >
                                  <div className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform shadow-sm`}>{item.icon}</div>
                                  <div className="flex-1 overflow-hidden">
                                    <span className="text-[11px] font-black tracking-tight block truncate uppercase">{item.name.replace('Surat Keterangan ', '')}</span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Templat Digital</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  <button 
                    onClick={() => {
                      openStats();
                      setAdminMenuOpen(false);
                    }}
                    className="group flex-1 min-w-[70px] md:min-w-[120px] py-1.5 md:py-2.5 px-2 md:px-5 rounded-lg md:rounded-2xl text-slate-300 font-black text-[8px] md:text-[10px] uppercase tracking-widest hover:bg-white hover:text-slate-900 transition-all flex flex-col items-center justify-center gap-1 md:gap-1.5 border border-transparent hover:border-white/20"
                  >
                    <BarChart3 size={14} className="md:w-[18px] md:h-[18px] group-hover:scale-110 transition-transform" /> 
                    <span>Grafik</span>
                  </button>

                  {session.role === 'admin' && (
                    <button 
                      onClick={() => {
                        openNewFamilyModal();
                        setAdminMenuOpen(false);
                      }}
                      className="group flex-1 min-w-[80px] md:min-w-[140px] py-1.5 md:py-2.5 px-2 md:px-5 rounded-lg md:rounded-2xl bg-blue-600 text-white font-black text-[8px] md:text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all flex flex-col items-center justify-center gap-1 md:gap-1.5 shadow-2xl shadow-blue-500/30 border border-blue-500/50"
                    >
                      <PlusCircle size={14} className="md:w-[18px] md:h-[18px] group-hover:scale-110 transition-transform" /> 
                      <span>Baru</span>
                    </button>
                  )}
                </nav>

                <div className="flex flex-col lg:flex-row items-center justify-between gap-8 mb-4">
                  <div className="flex items-center gap-6">
                    <div className="w-2 h-16 bg-amber-500 rounded-full hidden md:block shadow-[0_0_15px_rgba(245,158,11,0.5)]"></div>
                    <div>
                      <h2 className="text-white font-black text-3xl md:text-4xl tracking-tighter leading-tight uppercase">Sensus Digital</h2>
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.3em] mt-2 flex items-center gap-3">
                         <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> Basis Data Terpadu
                      </p>
                    </div>
                  </div>
                  <div className="relative w-full lg:w-[450px] group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={20} />
                    <input 
                      type="text" 
                      placeholder="Cari Warga atau NIK..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-14 pr-8 py-4 rounded-2xl bg-slate-800/50 border-2 border-slate-700/50 backdrop-blur-xl text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:bg-slate-800 transition-all shadow-2xl font-bold text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <main className="p-4 md:p-8 container mx-auto">
        <div className="max-w-6xl mx-auto space-y-8">
          {session.role === 'warga' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 sm:p-12 rounded-[3.5rem] shadow-[0_20px_80px_rgba(0,0,0,0.06)] border border-slate-200 relative overflow-hidden group mb-12"
            >
              <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-[100px]"></div>
              
              <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 bg-blue-600/10 blur-3xl rounded-full scale-150"></div>
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-blue-800 rounded-[2rem] flex items-center justify-center shadow-2xl relative z-10 border-[3px] border-white">
                    <UserIcon size={44} className="text-white drop-shadow-lg" />
                  </div>
                </div>
                <div className="text-center md:text-left flex-1">
                  <div className="inline-flex items-center gap-2 px-3 py-0.5 bg-blue-50 border border-blue-100 rounded-full text-[9px] font-black text-blue-600 uppercase tracking-widest mb-3">
                    <Shield size={10} /> Otentikasi Berhasil
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 mb-3 tracking-tighter">Selamat Datang, {session.nama}</h3>
                  <p className="text-slate-500 text-base leading-relaxed max-w-2xl font-medium">
                    Akses portal digital kependudukan diaktifkan. Anda dapat memeriksa validitas data keluarga, mencetak simulasi Kartu Keluarga, dan mengajukan surat administrasi secara mandiri.
                  </p>
                </div>
                <div className="hidden xl:flex flex-col gap-3">
                   <div className="px-6 py-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status Kependudukan</p>
                      <p className="font-black text-emerald-600 text-sm">Terdaftar Aktif</p>
                   </div>
                   <div className="px-6 py-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Verifikasi System</p>
                      <p className="font-black text-blue-600 text-sm">SIAK Terpadu</p>
                   </div>
                </div>
              </div>
            </motion.div>
          )}

          <motion.div 
            id="database-section" 
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-white border-2 border-slate-200 rounded-[3.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.08)] overflow-hidden scroll-mt-32 relative"
          >
            {/* Table Watermark Pattern */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Garuda_Pancasila_Coat_of_Arms_of_Indonesia.svg/800px-Garuda_Pancasila_Coat_of_Arms_of_Indonesia.svg.png')] bg-no-repeat bg-center bg-[length:600px]"></div>

            <div className="p-8 border-b flex flex-col sm:flex-row items-center justify-between gap-6 bg-slate-50/50 backdrop-blur-xl relative z-10">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
                  <Users size={24} />
                </div>
                <div>
                  <h3 className="font-black text-2xl text-slate-900 tracking-tight">Registrasi Kependudukan</h3>
                  <div className="flex items-center gap-2.5 mt-1.5">
                    <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase tracking-widest border border-emerald-100">
                      <Shield size={10} /> Data Terenkripsi
                    </span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total: {families.length} Berkas</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto relative z-10 scrollbar-official">
              <table className="w-full text-left border-collapse min-w-[700px] md:min-w-full">
                  <thead className="bg-slate-50/80 border-b border-slate-100">
                  <tr>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-[8px] md:text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Idx</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-[8px] md:text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Nomor KK</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-[8px] md:text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">NIK PJ</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-[8px] md:text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Kepala Keluarga</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-[8px] md:text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Wilayah</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-[8px] md:text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Status</th>
                    <th className="px-3 md:px-6 py-3 md:py-4 text-[8px] md:text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] text-center">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {families.map((f, i) => {
                    const kepalaObj = f.anggota.find(a => a.hubungan === 'Kepala Keluarga');
                    const kepala = kepalaObj?.nama || '-';
                    const nikKepala = kepalaObj?.nik || '-';
                    return (
                      <tr key={f.no_kk} className="hover:bg-blue-50/30 transition-all group">
                        <td className="px-3 md:px-6 py-3 md:py-4 text-[10px] md:text-xs text-slate-300 font-black tracking-widest">{String(i + 1).padStart(2, '0')}</td>
                        <td className="px-3 md:px-6 py-3 md:py-4">
                           <div 
                             className="inline-flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 bg-white border border-slate-100 rounded-lg md:rounded-xl group-hover:border-blue-500/30 transition-all cursor-pointer shadow-sm group-hover:shadow-md"
                             onClick={() => openPrintKK(f)}
                           >
                             <span className="text-blue-600 font-black text-[10px] md:text-xs tracking-widest">{f.no_kk}</span>
                             <Printer size={10} className="text-slate-300 group-hover:text-blue-400" />
                           </div>
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 text-[9px] md:text-[11px] font-mono font-bold text-slate-400 group-hover:text-slate-600 tracking-wider">
                          {nikKepala}
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4">
                          <p className="font-black text-slate-800 text-[11px] md:text-[13px] uppercase tracking-tight group-hover:text-blue-900">{kepala}</p>
                          <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5 md:mt-1 tracking-widest">Kepala Keluarga</p>
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4">
                          <div className="flex flex-col">
                            <span className="text-[11px] md:text-[13px] font-black text-slate-700 leading-none">{f.alamat}</span>
                            <span className="text-[8px] uppercase font-black text-slate-400 mt-1 md:mt-1.5 tracking-widest bg-slate-100 w-fit px-1 md:px-1.5 py-0.5 rounded border border-slate-200">RT {f.rt_rw}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.4)]"></span>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Valid</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-2">
                            <button 
                              onClick={() => openEditModal(allFamilies.findIndex(it => it.no_kk === f.no_kk))}
                              className="w-9 h-9 bg-white border-2 border-slate-100 hover:border-blue-500 text-slate-400 hover:text-blue-600 rounded-xl transition-all shadow-sm flex items-center justify-center hover:scale-110 active:scale-95 group/btn"
                              title="Detail / Edit"
                            >
                              {session.role === 'admin' ? <Edit size={16} className="group-hover/btn:scale-110 transition-transform" /> : <ChevronRight size={16} />}
                            </button>
                            {session.role === 'admin' && (
                              <button 
                                onClick={() => onDelete(allFamilies.findIndex(it => it.no_kk === f.no_kk))}
                                className="w-9 h-9 bg-white border-2 border-slate-100 hover:border-rose-500 text-slate-400 hover:text-rose-500 rounded-xl transition-all shadow-sm flex items-center justify-center hover:scale-110 active:scale-95 group/del"
                                title="Hapus"
                              >
                                <Trash2 size={16} className="group-hover/del:scale-110 transition-transform" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      </main>

      <footer className="bg-slate-900 text-slate-500 py-6 px-8 border-t border-slate-800 text-center text-xs font-medium no-print">
        <p>Pemerintah Dusun Amaholu Losy © 2026 | SIAK Professional Kependudukan</p>
      </footer>
          </div>
        </div>
      </div>
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
        className="relative w-full max-w-7xl h-[94vh] bg-white rounded-[3.5rem] shadow-[0_50px_150px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col border border-white/20"
      >
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between border-b-4 border-amber-500 relative overflow-hidden">
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-amber-500 border border-white/10 shadow-inner">
              <Users size={32} />
            </div>
            <div>
              <h3 className="text-white text-2xl font-black tracking-tighter uppercase">
                {isReadOnly ? 'Detail Berkas Kependudukan' : (data.no_kk ? 'Mutasi Data Keluarga' : 'Registrasi Berkas Baru')}
              </h3>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1.5 flex items-center gap-2">
                <Shield size={12} className="text-blue-500" /> Sertifikat Otoritas Sensus
              </p>
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
                className="w-full px-5 md:px-7 py-3 md:py-5 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-3xl font-black text-slate-800 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm text-sm md:text-base"
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
                className="w-full px-5 md:px-7 py-3 md:py-5 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-3xl font-black text-slate-800 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm text-sm md:text-base"
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
                className="w-full px-5 md:px-7 py-3 md:py-5 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-3xl font-black text-slate-800 placeholder:text-slate-300 outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm text-center text-sm md:text-base"
              />
            </div>
          </div>

          <div className="space-y-6 md:space-y-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-10">
              <div className="flex items-center gap-3 md:gap-4">
                 <div className="w-1.5 h-8 md:w-2.5 md:h-10 bg-blue-600 rounded-full"></div>
                 <h4 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Anggota Keluarga</h4>
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
                  className="p-5 md:p-10 bg-slate-50/50 border-2 border-slate-100 rounded-2xl md:rounded-[3rem] relative group hover:border-blue-200 transition-all hover:bg-white hover:shadow-[0_20px_50px_rgba(0,0,0,0.05)]"
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
                        className="w-full px-4 md:px-6 py-2.5 md:py-4 bg-white border-2 border-slate-100 rounded-xl md:rounded-2xl font-black text-slate-800 text-xs md:text-sm focus:border-blue-600 focus:bg-white outline-none transition-all shadow-sm"
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
                        className="w-full px-4 md:px-6 py-2.5 md:py-4 bg-white border-2 border-slate-100 rounded-xl md:rounded-2xl font-mono font-bold text-slate-800 text-xs md:text-sm focus:border-blue-600 outline-none transition-all shadow-sm"
                      />
                    </div>
                    <div>
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 md:mb-3 block">Hubungan</label>
                       <select 
                        value={ag.hubungan} 
                        onChange={e => updateMember(i, 'hubungan', e.target.value)}
                        disabled={isReadOnly}
                        required
                        className="w-full px-4 md:px-6 py-2.5 md:py-4 bg-white border-2 border-slate-100 rounded-xl md:rounded-2xl font-black text-slate-800 text-xs md:text-sm focus:border-blue-600 outline-none transition-all shadow-sm"
                      >
                        <option value="">Pilih</option>
                        <option value="Kepala Keluarga">Kepala Keluarga</option>
                        <option value="Istri">Istri</option>
                        <option value="Anak">Anak</option>
                        <option value="Lainnya">Lainnya</option>
                      </select>
                    </div>
                    <div>
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 md:mb-3 block">JK</label>
                       <select 
                        value={ag.jk} 
                        onChange={e => updateMember(i, 'jk', e.target.value)}
                        disabled={isReadOnly}
                        required
                        className="w-full px-4 md:px-6 py-2.5 md:py-4 bg-white border-2 border-slate-100 rounded-xl md:rounded-2xl font-black text-slate-800 text-xs md:text-sm focus:border-blue-600 outline-none transition-all shadow-sm"
                      >
                        <option value="">Pilih</option>
                        <option value="Laki-laki">Laki-laki</option>
                        <option value="Perempuan">Perempuan</option>
                      </select>
                    </div>
                    
                    <div>
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 md:mb-3 block">Tempat Lahir</label>
                       <input 
                        value={ag.tempat_lahir} 
                        onChange={e => updateMember(i, 'tempat_lahir', e.target.value)}
                        disabled={isReadOnly}
                        required
                        className="w-full px-4 md:px-6 py-2.5 md:py-4 bg-white border-2 border-slate-100 rounded-xl md:rounded-2xl font-bold text-slate-800 text-xs md:text-sm"
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
                        className="w-full px-4 md:px-6 py-2.5 md:py-4 bg-white border-2 border-slate-100 rounded-xl md:rounded-2xl font-bold text-slate-800 text-xs md:text-sm"
                      />
                    </div>
                    <div>
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 md:mb-3 block">Pendidikan</label>
                       <input 
                        value={ag.pendidikan} 
                        onChange={e => updateMember(i, 'pendidikan', e.target.value)}
                        disabled={isReadOnly}
                        required
                        className="w-full px-4 md:px-6 py-2.5 md:py-4 bg-white border-2 border-slate-100 rounded-xl md:rounded-2xl font-bold text-slate-800 text-xs md:text-sm"
                      />
                    </div>
                    <div>
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 md:mb-3 block">Pekerjaan</label>
                       <input 
                        value={ag.pekerjaan} 
                        onChange={e => updateMember(i, 'pekerjaan', e.target.value)}
                        disabled={isReadOnly}
                        required
                        className="w-full px-4 md:px-6 py-2.5 md:py-4 bg-white border-2 border-slate-100 rounded-xl md:rounded-2xl font-bold text-slate-800 text-xs md:text-sm"
                      />
                    </div>

                    <div>
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 md:mb-3 block">Agama</label>
                       <select 
                        value={ag.agama} 
                        onChange={e => updateMember(i, 'agama', e.target.value)}
                        disabled={isReadOnly}
                        required
                        className="w-full px-4 md:px-6 py-2.5 md:py-4 bg-white border-2 border-slate-100 rounded-xl md:rounded-2xl font-black text-slate-800 text-xs md:text-sm"
                      >
                        <option value="">Pilih</option>
                        <option value="Islam">Islam</option>
                        <option value="Kristen">Kristen</option>
                        <option value="Katolik">Katolik</option>
                        <option value="Hindu">Hindu</option>
                        <option value="Budha">Budha</option>
                      </select>
                    </div>
                    <div>
                       <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 md:mb-3 block">Bansos</label>
                       <select 
                        value={ag.bansos} 
                        onChange={e => updateMember(i, 'bansos', e.target.value)}
                        disabled={isReadOnly}
                        className="w-full px-4 md:px-6 py-2.5 md:py-4 bg-blue-50 border-2 border-blue-100 rounded-xl md:rounded-2xl font-black text-blue-700 text-xs md:text-sm focus:border-blue-600 outline-none transition-all shadow-inner"
                      >
                        <option value="">Tidak Ada</option>
                        <option value="PKH">PKH</option>
                        <option value="BPNT">BPNT</option>
                        <option value="BLT">BLT</option>
                        <option value="BPJS">BPJS</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </form>

        <div className="bg-slate-50 px-6 py-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center border-2 border-blue-100">
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
              className="flex-1 sm:flex-none px-8 py-3 bg-white border-2 border-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-all font-sans"
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
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-6xl h-[94vh] bg-white rounded-3xl md:rounded-[3.5rem] shadow-[0_50px_150px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col border border-white/20"
      >
        <div className="bg-slate-900 px-5 md:px-6 py-3 md:py-4 flex items-center justify-between border-b-4 border-blue-600 relative overflow-hidden">
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
          <div className="flex items-center gap-3 md:gap-4 relative z-10 overflow-hidden">
            <div className="w-9 h-9 md:w-11 md:h-11 bg-white/10 rounded-xl flex items-center justify-center text-blue-500 border border-white/10 shadow-inner shrink-0">
              <BarChart3 size={20} className="md:w-6 md:h-6" />
            </div>
            <div className="flex-1 overflow-hidden">
              <h3 className="text-white text-base md:text-lg font-black tracking-tighter uppercase whitespace-nowrap">Statistik</h3>
              <p className="text-slate-400 text-[7px] md:text-[8px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] mt-0.5 flex items-center gap-2">
                <Shield size={8} className="md:w-2.5 md:h-2.5" /> Dasbor Ringkasan Eksekutif v2.0
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 bg-white/5 hover:bg-white/10 text-white rounded-full flex items-center justify-center transition-all border border-white/10"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 md:p-10 space-y-6 md:space-y-8 scrollbar-official">
          {/* Executive Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {[
              { label: "Penduduk", value: stats.totalResidents, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Keluarga", value: stats.totalFamilies, icon: Shield, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Pria", value: stats.genderMale, icon: UserIcon, color: "text-amber-600", bg: "bg-amber-50" },
              { label: "Wanita", value: stats.genderFemale, icon: UserIcon, color: "text-rose-600", bg: "bg-rose-50" }
            ].map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="p-4 md:p-5 rounded-2xl md:rounded-[2rem] bg-white border-2 border-slate-100 shadow-sm hover:shadow-xl transition-all group"
              >
                <div className={`w-8 h-8 md:w-11 md:h-11 ${item.bg} ${item.color} rounded-lg md:rounded-xl flex items-center justify-center mb-3 md:mb-4 group-hover:scale-110 transition-transform shrink-0`}>
                  <item.icon size={16} className="md:w-5 md:h-5" />
                </div>
                <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 md:mb-1.5 leading-none">{item.label}</p>
                <h4 className="text-lg md:text-2xl font-black text-slate-900 tracking-tighter truncate">{item.value} <span className="text-[10px] md:text-sm text-slate-300 ml-0.5">Jiwa</span></h4>
              </motion.div>
            ))}
          </div>

          <div className="h-px bg-slate-100 w-full"></div>

          {/* Detailed Analytics Area */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            <div className="space-y-3 md:space-y-4">
              <div className="flex items-center gap-2 md:gap-3 mb-1">
                 <div className="w-1 h-4 md:h-5 bg-emerald-500 rounded-full"></div>
                 <h4 className="text-sm md:text-base font-black text-slate-900 tracking-tight">Identitas Gender</h4>
              </div>
              <div className="bg-slate-50/50 p-4 md:p-6 rounded-2xl md:rounded-[2rem] border-2 border-slate-100 space-y-4 md:space-y-6">
                 <div className="space-y-2">
                   <div className="flex justify-between items-end">
                      <span className="text-[9px] md:text-[10px] font-black text-slate-600 uppercase tracking-widest">Pria</span>
                      <span className="text-[11px] md:text-xs font-black text-slate-900">{stats.genderMale}</span>
                   </div>
                   <div className="h-2.5 md:h-3 bg-slate-200 rounded-full overflow-hidden flex">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(stats.genderMale / (stats.totalResidents || 1)) * 100}%` }}
                        className="h-full bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                      />
                   </div>
                 </div>
                 <div className="space-y-2">
                   <div className="flex justify-between items-end">
                      <span className="text-[9px] md:text-[10px] font-black text-slate-600 uppercase tracking-widest">Wanita</span>
                      <span className="text-[11px] md:text-xs font-black text-slate-900">{stats.genderFemale}</span>
                   </div>
                   <div className="h-2.5 md:h-3 bg-slate-200 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(stats.genderFemale / (stats.totalResidents || 1)) * 100}%` }}
                        className="h-full bg-rose-600 rounded-full shadow-[0_0_15px_rgba(225,29,72,0.4)]"
                      />
                   </div>
                 </div>
              </div>
            </div>

            <div className="space-y-3 md:space-y-4">
              <div className="flex items-center gap-2 md:gap-3 mb-1">
                 <div className="w-1 h-4 md:h-5 bg-amber-500 rounded-full"></div>
                 <h4 className="text-sm md:text-base font-black text-slate-900 tracking-tight">Wilayah</h4>
              </div>
              <div className="bg-slate-50/50 p-4 md:p-6 rounded-2xl md:rounded-[2rem] border-2 border-slate-100 max-h-[200px] md:max-h-[250px] overflow-y-auto scrollbar-official space-y-2 md:space-y-3">
                {Object.entries(stats.distribusiAlamat).map(([alamat, count], idx) => (
                  <div key={alamat} className="flex items-center justify-between p-2.5 md:p-3 bg-white rounded-lg md:rounded-xl border border-slate-100 group hover:border-blue-200 transition-all shadow-sm">
                    <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
                       <span className="w-6 h-6 md:w-7 md:h-7 bg-slate-100 rounded md:rounded-lg flex items-center justify-center text-[8px] md:text-[9px] font-black text-slate-400 shrink-0">{idx + 1}</span>
                       <span className="text-[11px] md:text-xs font-black text-slate-800 uppercase tracking-tight truncate">{alamat}</span>
                    </div>
                    <span className="px-2 md:px-3 py-0.5 md:py-1 bg-blue-50 text-blue-600 rounded-full font-black text-[8px] md:text-[9px] uppercase tracking-widest shrink-0">{count} KK</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-6 border-t border-slate-200 text-center">
           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-loose">
              Data terhitung secara real-time berdasarkan basis data kependudukan terbaru.
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
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        className="w-full max-w-xl bg-white rounded-[2.5rem] p-8 sm:p-12 shadow-[0_30px_100px_rgba(0,0,0,0.3)] relative max-h-[95vh] overflow-y-auto border border-slate-200"
      >
        <button onClick={onClose} className="absolute right-6 top-6 p-3 hover:bg-slate-100 rounded-2xl transition-all text-slate-400 hover:text-slate-900 active:scale-90">
          <X size={24} />
        </button>
        
        <div className="flex items-center gap-4 mb-2">
           <div className="w-1.5 h-8 bg-blue-600 rounded-full"></div>
           <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">Drafting Dokumen</h2>
        </div>
        <p className="text-slate-400 text-xs sm:text-sm mb-10 font-black uppercase tracking-widest leading-none">Generate {type}</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Target Warga</label>
            <div className="relative group">
              <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input 
                list="wargaList"
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                className="w-full pl-12 pr-6 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500 focus:bg-white font-black text-slate-700 text-sm transition-all shadow-sm"
                placeholder="Mulai ketik nama..."
                required
              />
              <datalist id="wargaList">
                {residentOptions.map((r, i) => <option key={i} value={r.nama} />)}
              </datalist>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Identifikasi Berkas</label>
            <div className="relative group">
              <FileText className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
              <input 
                value={nomorSurat}
                onChange={(e) => setNomorSurat(e.target.value)}
                className="w-full pl-12 pr-6 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500 focus:bg-white font-bold text-slate-600 text-sm transition-all shadow-sm"
                required
              />
            </div>
          </div>

          {type === 'Surat Keterangan Usaha' && (
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Objek Usaha / Niaga</label>
              <div className="relative group">
                <Shield className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  value={usaha}
                  onChange={(e) => setUsaha(e.target.value)}
                  placeholder="e.g. Toko Kelontong, UMKM"
                  className="w-full pl-12 pr-6 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500 focus:bg-white font-black text-slate-700 text-sm transition-all shadow-sm"
                  required
                />
              </div>
            </div>
          )}

          <div className="pt-4">
             <button type="submit" className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-black uppercase tracking-[0.2em] rounded-xl shadow-2xl shadow-blue-500/30 hover:to-blue-800 hover:-translate-y-1 active:translate-y-0 transition-all duration-300 flex items-center justify-center gap-2.5 text-xs">
              <Printer size={18} /> Pratinjau Dokumen
            </button>
          </div>
        </form>
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
