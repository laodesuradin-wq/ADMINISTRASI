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
  Download,
  Baby
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
  generateNomorSurat, 
  isValidNIK, 
  isValidKK, 
  isValidName,
  VALIDATION
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
    { text: "Assalamu'alaikum/Selamat Sejahtera, warga Amaholu Losy! Saya adalah Asisten Digital Dusun. Dengan senang hati saya siap melayani keperluan administrasi Anda. Apa yang bisa saya bantu hari ini?", type: 'ai' }
  ]);

  const [isMobile, setIsMobile] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

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
    if (savedDb) {
      try {
        setDb(JSON.parse(savedDb));
      } catch (e) {
        console.error("Parse error", e);
      }
    }
    setIsInitialized(true);

    const savedSession = sessionStorage.getItem(SESSION_KEY);
    if (savedSession) {
      setSession(JSON.parse(savedSession));
      setView('dashboard');
    }
  }, []);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    }
  }, [db, isInitialized]);

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
    // Check for duplicate KK if it's a new entry or KK is changed
    const duplicateKK = db.some((f, idx) => f.no_kk === family.no_kk && idx !== editingIndex);
    if (duplicateKK) return alert("Peringatan Keamanan: Nomor KK ini sudah terdaftar dalam sistem!");

    // Check for duplicate NIK across all families
    const allNiks = db.flatMap((f, idx) => 
      idx === editingIndex ? [] : f.anggota.map(a => a.nik)
    );
    const hasDuplicateNIK = family.anggota.some(a => allNiks.includes(a.nik));
    if (hasDuplicateNIK) return alert("Peringatan Keamanan: Salah satu NIK sudah terdaftar di keluarga lain!");

    // Check for duplicate NIK within the same family
    const familyNiks = family.anggota.map(a => a.nik);
    const hasDuplicateNIKInFamily = familyNiks.some((nik, idx) => familyNiks.indexOf(nik) !== idx);
    if (hasDuplicateNIKInFamily) return alert("Kesalahan Input: Ada NIK ganda dalam satu KK!");

    // Create a trimmed version of the family data
    const trimmedFamily: Family = {
      ...family,
      no_kk: family.no_kk.trim(),
      alamat: family.alamat.trim(),
      rt_rw: family.rt_rw.trim(),
      Desa: family.Desa.trim(),
      Kecamatan: family.Kecamatan.trim(),
      Kabupaten: family.Kabupaten.trim(),
      Provinsi: family.Provinsi.trim(),
      anggota: family.anggota.map(a => ({
        ...a,
        nama: a.nama.trim(),
        nik: a.nik.trim(),
        tempat_lahir: a.tempat_lahir.trim(),
        pendidikan: a.pendidikan.trim(),
        pekerjaan: a.pekerjaan.trim(),
        agama: a.agama.trim() as Resident['agama'],
        jk: a.jk.trim() as Resident['jk'],
        hubungan: a.hubungan.trim() as Resident['hubungan'],
        bansos: a.bansos.trim()
      })) as Resident[]
    };

    if (editingIndex !== null) {
      const newDb = [...db];
      newDb[editingIndex] = trimmedFamily;
      setDb(newDb);
    } else {
      setDb([...db, trimmedFamily]);
    }
    setActiveModal(null);
  };

  const chatSessionRef = useRef<any>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, isTyping]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    
    // Add user message
    const userMsg = { text, type: 'user' as const };
    setChatMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("API_KEY_MISSING: Silakan hubungi administrator untuk konfigurasi kunci API Gemini di Settings > Secrets.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Initialize chat session if it doesn't exist
      if (!chatSessionRef.current) {
        chatSessionRef.current = ai.chats.create({
          model: "gemini-3-flash-preview",
          config: {
            systemInstruction: `Anda adalah asisten AI resmi bernama 'Sandra' (Asisten SIAK MOBILE) untuk Dusun Amaholu Losy, Negeri Luhu, Kecamatan Huamual, Kabupaten Seram Bagian Barat, Maluku. Dusun ini dipimpin oleh Kepala Dusun Fauji Ali. 
            
            Tugas utama Anda:
            1. Memberikan layanan informasi publik yang ramah, sopan, dan sangat membantu warga Dusun Amaholu Losy.
            2. Menjelaskan persyaratan dan prosedur pembuatan surat (Domisili, Usaha, Tidak Mampu, Kematian).
            3. Memandu cara login ke aplikasi SIAK Mobile (Nomor KK dan NIK Kepala Keluarga).
            4. Menghubungkan warga dengan operator dusun jika ada masalah teknis yang tidak dapat diselesaikan AI.
            
            Konteks Dusun:
            - Dusun: Amaholu Losy
            - Negeri: Luhu
            - Kabupaten: Seram Bagian Barat
            - Kepala Dusun: Bapak Fauji Ali
            
            Gaya Komunikasi:
            - Sapaan Wajib: Selalu awali percakapan baru dengan menyapa: "Halo, beta Sandra asisten SIAK MOBILE yang siap membantu bapak ibu dalam pengurusan administrasi, ada yang bisa beta bantu?".
            - Gunakan bahasa yang santun khas masyarakat Maluku yang ramah.
            - Pastikan warga merasa terbantu dan dihargai.
            - Gunakan kata ganti "beta" untuk menyebut diri sendiri (Sandra).
            
            Keamanan:
            - Jangan meminta data sensitif seperti NIK atau Nomor KK secara langsung dalam chat.
            
            Kontak Penting:
            Operator Dusun (WA): 0821-4636-2670.`,
          },
        });
      }

      // Add placeholder for AI response
      setChatMessages(prev => [...prev, { text: '', type: 'ai' as const }]);
      
      const streamResponse = await chatSessionRef.current.sendMessageStream({ message: text });
      let fullText = "";

      for await (const chunk of streamResponse) {
        fullText += (chunk as any).text || "";
        setChatMessages(prev => {
          const updated = [...prev];
          if (updated.length > 0 && updated[updated.length - 1].type === 'ai') {
            updated[updated.length - 1] = { text: fullText.trim(), type: 'ai' as const };
          }
          return updated;
        });
      }

    } catch (error: any) {
      console.error("AI Error Details:", error);
      
      // Reset session to allow retry on next message
      chatSessionRef.current = null;
      
      let errorMessage = "Maaf, terjadi kesalahan teknis (Model/API). Silakan coba lagi.";
      
      if (error?.message?.includes("API_KEY_MISSING")) {
        errorMessage = "Akses AI belum dikonfigurasi. Mohon periksa pengaturan API Key di panel Settings > Secrets.";
      } else if (error?.message?.includes("PERMISSION_DENIED") || error?.code === 403 || error?.status === "PERMISSION_DENIED") {
        errorMessage = "Akses AI ditolak (403). Silakan periksa apakah API Key Anda valid dan memiliki akses ke model 'gemini-3-flash-preview' di Settings > Secrets.";
      } else if (error?.message?.includes("429") || error?.message?.includes("quota") || error?.status === "RESOURCE_EXHAUSTED") {
        errorMessage = "Kuota layanan harian telah habis. Silakan coba lagi nanti atau hubungi operator.";
      } else if (error?.message) {
        errorMessage = `Kesalahan: ${error.message.substring(0, 100)}`;
      }

      setChatMessages(prev => {
        const filtered = prev.filter(m => m.text !== ''); // Remove placeholder if it exists
        return [...filtered, { text: errorMessage, type: 'ai' as const }];
      });
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
          {activeModal === 'family' && currentFamily && session && (
            <FamilyModal 
              family={currentFamily} 
              session={session}
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
              
              <div 
                ref={chatContainerRef}
                className="flex-1 p-6 overflow-y-auto bg-slate-50/50 space-y-6 scroll-smooth"
              >
              {chatMessages.length === 1 && (
                <div className="grid grid-cols-1 gap-2 mb-4">
                  {[
                    "Bagaimana cara buat SKTM?",
                    "Syarat Surat Domisili apa saja?",
                    "Lupa password login warga",
                    "Info bantuan sosial (Bansos)"
                  ].map(q => (
                    <button 
                      key={q}
                      onClick={() => handleSendMessage(q)}
                      className="px-4 py-2 bg-white border border-blue-100 rounded-xl text-[10px] font-bold text-blue-600 text-left hover:bg-blue-50 transition-colors shadow-sm"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  key={i} 
                  className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[88%] px-5 py-4 rounded-[1.5rem] text-[13px] leading-relaxed relative whitespace-pre-wrap ${
                    msg.type === 'user' 
                      ? 'bg-blue-600 text-white rounded-br-none shadow-xl shadow-blue-500/20 font-medium' 
                      : 'bg-white border border-slate-100 text-slate-700 rounded-bl-none shadow-sm font-semibold'
                  }`}>
                    {msg.text || (msg.type === 'ai' ? '...' : '')}
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
      const family = db.find((f: Family) => f.no_kk === noKK.trim());
      if (!family) return setError("Nomor KK tidak ditemukan.");
      const kepala = family.anggota.find((a: Resident) => a.hubungan === 'Kepala Keluarga');
      if (!kepala) return setError("Data Kepala Keluarga tidak ditemukan.");
      if (kepala.nik.trim() !== password.trim()) return setError("Password (NIK) salah.");
      
      onLogin({ role: 'warga', no_kk: noKK.trim(), nama: kepala.nama });
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
        className="w-full max-w-[320px] bg-white rounded-[2rem] overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.3)] flex flex-col relative z-10 border border-white/10"
      >
        <div className="w-full p-5 text-white flex flex-col justify-center bg-slate-900 relative overflow-hidden h-[160px]">
          <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
          
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-2 mb-3 shadow-xl relative z-10"
          >
            <img 
              src="https://iili.io/BbSYeoB.png" 
              alt="Logo Resmi" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </motion.div>

          <div className="relative z-10">
            <h1 className="text-xl font-black leading-tight mb-1 tracking-tighter uppercase font-sans">
              SIAK <span className="text-blue-500">MOBILE</span>
            </h1>
            <p className="text-slate-400 text-[8px] font-black uppercase tracking-widest leading-none">Dusun Amaholu Losy</p>
          </div>
        </div>

        <div className="w-full bg-white p-5 md:p-6 flex flex-col justify-center">
          <div className="mb-4 text-center sm:text-left">
             <h2 className="text-lg font-black text-slate-900 tracking-tight">Masuk Ke Sistem</h2>
          </div>

          <div className="p-1.5 bg-slate-100 rounded-2xl flex gap-1 mb-8">
            <button 
              onClick={() => setRole('warga')}
              className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all ${role === 'warga' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-500'}`}
            >
              Login Warga
            </button>
            <button 
              onClick={() => setRole('admin')}
              className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all ${role === 'admin' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-500'}`}
            >
              Login Admin
            </button>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 p-3 bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-black uppercase tracking-wider rounded-xl flex items-center gap-3 shadow-sm"
            >
              <X size={14} className="shrink-0" /> <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {role === 'warga' ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Nomor Kartu Keluarga (KK)</label>
                  <div className="relative group">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" size={16} />
                    <input 
                      type="text" 
                      placeholder="16-digit kode KK"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-600/30 focus:bg-white transition-all font-bold text-xs text-slate-900 placeholder:text-slate-300 shadow-sm"
                      value={noKK}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 16);
                        setNoKK(val);
                      }}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Kunci Pribadi (NIK)</label>
                  <div className="relative group">
                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" size={16} />
                    <input 
                      type="password" 
                      placeholder="NIK Kepala Keluarga"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-600/30 focus:bg-white transition-all font-bold text-xs text-slate-900 placeholder:text-slate-300 shadow-sm"
                      value={password}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 16);
                        setPassword(val);
                      }}
                      required
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Identitas Otoritas</label>
                  <div className="relative group">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" size={16} />
                    <input 
                      type="email" 
                      placeholder="Email Kedinasan Resmi"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-600/30 focus:bg-white transition-all font-bold text-xs text-slate-900 placeholder:text-slate-300 shadow-sm"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Kunci Akses Sistem</label>
                  <div className="relative group">
                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors" size={16} />
                    <input 
                      type="password" 
                      placeholder="Masukkan kunci administrator"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-600/30 focus:bg-white transition-all font-bold text-xs text-slate-900 placeholder:text-slate-300 shadow-sm"
                      value={adminPass}
                      onChange={(e) => setAdminPass(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <button type="submit" className="w-full py-4 bg-slate-900 text-white font-black uppercase tracking-[0.2em] rounded-xl shadow-lg hover:bg-slate-800 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 group text-xs">
              Masuk
            </button>
          </form>

          <div className="mt-8 flex items-center justify-center">
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
          <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center p-1.5 shadow-lg overflow-hidden">
            <img 
              src="https://iili.io/BbSYeoB.png" 
              className="w-full h-full object-contain" 
              alt="Logo" 
              referrerPolicy="no-referrer"
            />
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
            {!adminMenuOpen && (
              <div className="pt-6 pb-4 relative z-10 transition-all duration-300">
                <div className="container mx-auto text-center">
                   <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 mb-6">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span> Sistem Digital Terintegrasi
                   </p>
                </div>
              </div>
            )}

            <div className={`grid ${session.role === 'admin' ? 'grid-cols-2' : 'grid-cols-1'} gap-2 bg-white/5 p-2 rounded-2xl border border-white/10 backdrop-blur-xl shadow-2xl mb-6 transition-all duration-300 ${adminMenuOpen ? 'mt-4' : ''}`}>
                  {!adminMenuOpen && [
                    { 
                      label: session.role === 'admin' ? "LIHAT DATA" : "DATA KELUARGA", 
                      sub: session.role === 'admin' ? "DATABASE" : "AKSES DATA", 
                      icon: "📋", 
                      action: () => setIsDatabaseViewOpen(true) 
                    },
                    { 
                      label: "TAMBAH KK", 
                      sub: "OPERASI DATA", 
                      icon: "📝", 
                      action: () => openNewFamilyModal() 
                    },
                    { label: "EKSPOR DATA", sub: "EXCEL", icon: "💾", action: () => exportToExcel(), adminOnly: true },
                    { label: "STATISTIK", sub: "REKAP", icon: "📊", action: () => openStats(), adminOnly: true }
                  ].map((item, idx) => {
                    if (item.adminOnly && session.role !== 'admin') return null;
                    return (
                      <div className="relative group col-span-1" key={idx}>
                        <button 
                          onClick={item.action}
                          className={`w-full p-2 md:p-3.5 rounded-xl md:rounded-2xl transition-all flex flex-col items-center justify-center gap-1 md:gap-2 border-2 bg-[#1b1e28] border-[#2a2e3d] text-slate-300 hover:bg-[#232734] hover:border-[#35394a] hover:text-white shadow-none active:scale-95`}
                        >
                          <div className={`w-7 h-7 md:w-10 md:h-10 rounded-lg md:rounded-xl flex items-center justify-center text-lg md:text-2xl transition-transform bg-white/5`}>{item.icon}</div>
                          <div className="text-center">
                            <span className="block text-[6px] md:text-[8px] font-black uppercase tracking-wider mb-0.5 leading-none">{item.sub}</span>
                            <span className="block text-[8px] md:text-[10px] font-black uppercase tracking-tight opacity-90 leading-tight">{item.label}</span>
                          </div>
                        </button>
                      </div>
                    );
                  })}

                  {/* Administrasi Digital Surat Section */}
                  {session.role === 'admin' && (
                    <div className="col-span-full bg-[#1b1e28] border-2 border-[#2a2e3d] rounded-2xl overflow-hidden transition-all duration-300 shadow-xl shadow-black/20">
                      <button 
                        onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                        className="w-full p-3 md:p-4 flex items-center justify-between text-slate-300 hover:bg-[#232734] hover:text-white transition-all active:scale-95"
                      >
                         <div className="flex items-center gap-3">
                           <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${adminMenuOpen ? 'bg-white/20 scale-110' : 'bg-white/5'}`}>📄</div>
                           <div className="text-left">
                             <span className="block text-[8px] md:text-[10px] font-black uppercase tracking-wider mb-1 leading-none opacity-70">Administrasi</span>
                             <span className="block text-xs md:text-sm font-black uppercase tracking-tight leading-tight">Digital Surat</span>
                           </div>
                         </div>
                         <div className="flex items-center gap-3">
                           <Shield className="w-4 h-4 opacity-30" />
                           <ChevronDown size={16} className={`transition-transform duration-500 ${adminMenuOpen ? 'rotate-180 opacity-100' : 'opacity-30'}`} />
                         </div>
                      </button>

                      <AnimatePresence>
                        {adminMenuOpen && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-slate-900 border-t-2 border-[#2a2e3d]"
                          >
                            <div className="p-3 md:p-4 grid grid-cols-2 gap-2 md:gap-3">
                                {[
                                  { name: "Surat Keterangan Usaha", label: "SK USAHA", sub: "Layanan Usaha", icon: "💼" },
                                  { name: "Surat Keterangan Tidak Mampu", label: "SKTM", sub: "Bantuan Sosial", icon: "🤝" },
                                  { name: "Surat Keterangan Pendidikan", label: "SK PENDIDIKAN", sub: "Layanan Siswa", icon: "🎓" },
                                  { name: "Surat Keterangan Kematian", label: "AKTA MATI", sub: "Saksi Kematian", icon: "🕊️" },
                                  { name: "Surat Keterangan Domisili", label: "DOMISILI", sub: "Bukti Tinggal", icon: "🏠" }
                                ].map((item) => (
                                <button 
                                  key={item.name}
                                  onClick={() => { openLetter(item.name as LetterType); setAdminMenuOpen(false); }}
                                  className="p-3 md:p-4 rounded-xl md:rounded-2xl bg-[#1b1e28] border border-[#2a2e3d] hover:bg-[#232734] hover:border-blue-500/30 flex flex-col items-start group active:scale-95 transition-all text-left h-full shadow-sm relative overflow-hidden"
                                >
                                  <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity text-6xl pointer-events-none">
                                    {item.icon}
                                  </div>
                                  <div className="mb-2 md:mb-3 text-xl md:text-2xl group-hover:scale-110 transition-transform relative z-10">
                                    <span className="opacity-80 grayscale group-hover:grayscale-0 transition-all">{item.icon}</span>
                                  </div>
                                  <p className="text-[6px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none opacity-60 relative z-10">{item.sub}</p>
                                  <h4 className="text-[9px] md:text-xs font-black text-white tracking-tighter uppercase leading-tight relative z-10">{item.label}</h4>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  </div>

            <main className="container mx-auto">
              <div className="max-w-6xl mx-auto">
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

function FamilyModal({ family, session, onSave, onClose }: { family: Family, session: AuthSession, onSave: (f: Family) => void, onClose: () => void }) {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidKK(data.no_kk)) return alert("Data Gagal Simpan: Nomor KK harus tepat 16 digit angka.");
    if (data.anggota.length === 0) return alert("Minimal harus ada 1 anggota keluarga yang terdaftar.");
    
    // Check if there is exactly one head of family
    const headCount = data.anggota.filter(a => a.hubungan === 'Kepala Keluarga').length;
    if (headCount === 0) return alert("Kesalahan: Keluarga harus memiliki minimal satu Kepala Keluarga.");
    if (headCount > 1) return alert("Kesalahan: Dalam satu KK tidak boleh ada lebih dari satu Kepala Keluarga.");

    // Validate each member
    for (const member of data.anggota) {
      if (!isValidName(member.nama)) return alert(`Kesalahan Input: Nama "${member.nama}" mengandung karakter yang tidak diizinkan.`);
      if (!isValidNIK(member.nik)) return alert(`Data Gagal Simpan: NIK untuk "${member.nama}" harus tepat 16 digit angka.`);
      
      const birthDate = new Date(member.tgl);
      if (birthDate > new Date()) return alert(`Kesalahan Tanggal: Tanggal lahir "${member.nama}" tidak boleh di masa depan.`);
    }

    onSave(data);
  };

  const isReadOnly = session.role === 'warga' && family.no_kk !== '';

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
        className="relative w-full max-w-5xl max-h-[95vh] bg-[#0f1423] rounded-2xl md:rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col border border-white/10"
      >
        <div className="bg-[#1b1e28] px-4 py-4 md:px-6 md:py-5 flex items-center justify-between border-b-4 border-amber-500 relative overflow-hidden shrink-0">
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
          <div className="flex items-center gap-3 md:gap-6 relative z-10">
            <div className="w-10 h-10 md:w-14 md:h-14 bg-white/10 rounded-xl md:rounded-2xl flex items-center justify-center text-amber-500 border border-white/10 shadow-inner shrink-0">
              <Users className="w-6 h-6 md:w-8 md:h-8" />
            </div>
            <div className="text-left">
              <h3 className="text-white text-lg md:text-2xl font-black tracking-tighter uppercase leading-tight">
                {isReadOnly ? 'Detail Berkas Kependudukan' : (data.no_kk ? 'Form Kartu Keluarga' : 'Registrasi Kartu Keluarga')}
              </h3>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 md:w-10 md:h-10 bg-white/5 hover:bg-white/10 text-white rounded-full flex items-center justify-center transition-all border border-white/10 hover:rotate-90 shrink-0"
          >
            <X className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 md:p-14 space-y-8 md:space-y-12 scrollbar-official">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
            <div className="space-y-2 md:space-y-3">
               <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] md:tracking-[0.3em] ml-1 md:ml-2">ID Resmi (KK)</label>
               <input 
                value={data.no_kk} 
                onChange={e => setData({...data, no_kk: e.target.value.replace(/\D/g, '').slice(0, 16)})}
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
                onChange={e => setData({...data, rt_rw: e.target.value.replace(/\D/g, '').slice(0, 3)})}
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
                        onChange={e => updateMember(i, 'nik', e.target.value.replace(/\D/g, '').slice(0, 16))}
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
                       <select 
                        value={ag.pendidikan} 
                        onChange={e => updateMember(i, 'pendidikan', e.target.value)}
                        disabled={isReadOnly}
                        required
                        className="w-full px-4 md:px-6 py-2.5 md:py-4 bg-white/5 border-2 border-white/10 rounded-xl md:rounded-2xl font-black text-white text-xs md:text-sm focus:border-blue-600 focus:bg-white/10 outline-none"
                      >
                        <option value="" className="bg-purple-950">Pilih</option>
                        <option value="Tidak/Belum Sekolah" className="bg-purple-950">Tidak/Belum Sekolah</option>
                        <option value="SD / Sederajat" className="bg-purple-950">SD / Sederajat</option>
                        <option value="SMP / Sederajat" className="bg-purple-950">SMP / Sederajat</option>
                        <option value="SMA / Sederajat" className="bg-purple-950">SMA / Sederajat</option>
                        <option value="Diploma I / II" className="bg-purple-950">Diploma I / II</option>
                        <option value="Akademi / Diploma III" className="bg-purple-950">Akademi / Diploma III</option>
                        <option value="Diploma IV / Strata I" className="bg-purple-950">Diploma IV / Strata I</option>
                        <option value="Strata II" className="bg-purple-950">Strata II</option>
                        <option value="Strata III" className="bg-purple-950">Strata III</option>
                      </select>
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
                onClick={handleSubmit} 
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
    const distribusiPendidikan: Record<string, number> = {};
    
    db.forEach(f => {
      totalJiwa += f.anggota.length;
      distribusiAlamat[f.alamat] = (distribusiAlamat[f.alamat] || 0) + 1;
      f.anggota.forEach(a => {
        if (a.jk === 'Laki-laki') l++;
        if (a.jk === 'Perempuan') p++;
        if (a.bansos) bansos++;
        if (a.pendidikan) {
          distribusiPendidikan[a.pendidikan] = (distribusiPendidikan[a.pendidikan] || 0) + 1;
        }
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
      distribusiAlamat,
      distribusiPendidikan
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
        className="relative w-full max-w-5xl max-h-[95vh] bg-[#0f1423] rounded-2xl md:rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col border border-white/10"
      >
        <div className="bg-[#1b1e28] px-4 py-4 md:px-6 md:py-5 flex items-center justify-between border-b-4 border-blue-600 relative overflow-hidden shrink-0">
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
          <div className="flex items-center gap-3 md:gap-6 relative z-10">
            <div className="w-10 h-10 md:w-14 md:h-14 bg-white/10 rounded-xl md:rounded-2xl flex items-center justify-center text-blue-500 border border-white/10 shadow-inner shrink-0">
              <BarChart3 className="w-6 h-6 md:w-8 md:h-8" />
            </div>
            <div className="text-left">
              <h3 className="text-white text-lg md:text-2xl font-black tracking-tighter uppercase leading-tight">Statistik</h3>
              <p className="text-slate-400 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] mt-1.5 flex items-center gap-2">
                <Shield size={10} /> Dasbor Ringkasan Eksekutif v2.0
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 md:w-10 md:h-10 bg-white/5 hover:bg-white/10 text-white rounded-full flex items-center justify-center transition-all border border-white/10 hover:rotate-90 shrink-0"
          >
            <X className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-10 scrollbar-none bg-[#0f1423]">
          {/* Executive Overview - Image Match */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[
              { label: "Penduduk", value: stats.totalResidents, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
              { label: "Keluarga", value: stats.totalFamilies, icon: Shield, color: "text-emerald-500", bg: "bg-emerald-500/10" },
              { label: "Pria", value: stats.genderMale, icon: UserIcon, color: "text-amber-500", bg: "bg-amber-500/10" },
              { label: "Wanita", value: stats.genderFemale, icon: UserIcon, color: "text-rose-500", bg: "bg-rose-500/10" },
              { label: "Lansia", value: stats.elders, icon: UserIcon, color: "text-purple-500", bg: "bg-purple-500/10" },
              { label: "Balita", value: stats.children, icon: Baby, color: "text-teal-500", bg: "bg-teal-500/10" }
            ].map((item, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="p-6 md:p-8 rounded-[2rem] bg-[#1b1e28] border border-white/10 flex flex-col items-start shadow-sm hover:border-blue-500/30 transition-colors"
              >
                <div className={`mb-6 text-2xl`}>
                  <item.icon size={24} className="text-blue-500 opacity-80" />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 leading-none">{item.label}</p>
                <h4 className="text-3xl font-black text-white tracking-tighter flex items-center gap-2">
                  {item.value} 
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Jiwa</span>
                </h4>
              </motion.div>
            ))}
          </div>

          <div className="h-px bg-white/10 w-full"></div>

          {/* Gender Indicator - Image Match style */}
          <div className="space-y-6">
             <div className="flex items-center gap-3">
               <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
               <h4 className="text-[12px] font-black text-white uppercase tracking-tight">Komp. Gender</h4>
             </div>
             
             <div className="space-y-8 px-2 md:px-6">
                <div className="space-y-3">
                   <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Pria</span>
                      <span className="text-xs font-black text-white">{stats.genderMale} Jiwa</span>
                   </div>
                   <div className="h-2.5 bg-white/5 border border-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(stats.genderMale / (stats.totalResidents || 1)) * 100}%` }}
                        className="h-full bg-blue-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                      />
                   </div>
                </div>

                <div className="space-y-3">
                   <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Wanita</span>
                      <span className="text-xs font-black text-white">{stats.genderFemale} Jiwa</span>
                   </div>
                   <div className="h-2.5 bg-white/5 border border-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(stats.genderFemale / (stats.totalResidents || 1)) * 100}%` }}
                        className="h-full bg-rose-500 rounded-full shadow-[0_0_20px_rgba(244,63,94,0.5)]"
                      />
                   </div>
                </div>
             </div>
          </div>

          <div className="h-px bg-white/10 w-full"></div>

          {/* Education Stats */}
          <div className="space-y-6">
             <div className="flex items-center gap-3">
               <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
               <h4 className="text-[12px] font-black text-white uppercase tracking-tight">SDM & Pendidikan</h4>
             </div>
             
             <div className="grid grid-cols-1 gap-3 px-2 md:px-6">
               {Object.entries(stats.distribusiPendidikan)
                 .sort((a, b) => (b[1] as number) - (a[1] as number))
                 .map(([level, count], idx) => (
                 <div key={idx} className="flex items-center justify-between p-4 bg-[#1b1e28] rounded-2xl border border-white/10 hover:border-blue-500/30 transition-all">
                   <div className="flex items-center gap-3">
                     <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center text-blue-500 shadow-sm border border-white/10 font-bold text-xs">
                       {idx + 1}
                     </div>
                     <span className="text-[10px] font-black text-slate-300 uppercase tracking-wider">{level}</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <span className="text-sm font-black text-white">{count}</span>
                     <span className="text-[8px] font-bold text-slate-500 uppercase">Jiwa</span>
                   </div>
                 </div>
               ))}
               {Object.keys(stats.distribusiPendidikan).length === 0 && (
                 <p className="text-center text-[10px] font-bold text-slate-500 uppercase py-4">Belum ada data kependidikan terdaftar</p>
               )}
             </div>
          </div>
        </div>

        <div className="bg-[#1b1e28] p-6 text-center border-t-4 border-amber-500/20 relative overflow-hidden shrink-0">
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
    const resident = residentOptions.find(r => r.nama.trim() === targetName.trim());
    if (!resident) return alert("Kesalahan: Silakan pilih nama warga yang valid dari daftar yang tersedia.");
    
    if (nomorSurat.trim().length < 5) return alert("Peringatan: Format nomor surat tidak valid.");

    onPreview({
      type,
      nomor: nomorSurat.trim(),
      resident,
      usaha: usaha.trim(),
      date: new Date().toISOString()
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        className="relative w-full max-w-5xl max-h-[95vh] bg-[#0f1423] rounded-2xl md:rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col border border-white/10"
      >
        {/* Header */}
        <div className="bg-[#1b1e28] px-4 py-4 md:px-6 md:py-5 flex items-center justify-between border-b-4 border-blue-600 relative overflow-hidden shrink-0">
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
          <div className="flex items-center gap-3 md:gap-6 relative z-10">
            <div className="w-10 h-10 md:w-14 md:h-14 bg-white/10 rounded-xl md:rounded-2xl flex items-center justify-center text-blue-500 border border-white/10 shadow-inner shrink-0">
               <FileText className="w-6 h-6 md:w-8 md:h-8" />
            </div>
            <div className="text-left">
              <h2 className="text-white text-lg md:text-2xl font-black tracking-tighter uppercase leading-tight mb-0.5 md:mb-1">Drafting Surat</h2>
              <p className="text-slate-400 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em]">Administrasi Digital</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 md:w-10 md:h-10 bg-white/5 hover:bg-white/10 text-white rounded-full flex items-center justify-center transition-all border border-white/10 hover:rotate-90 shrink-0">
            <X className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-[#0f1423]">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none">Generate {type}</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Pilih Target Warga</label>
              <div className="relative group">
                <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  list="wargaList"
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-[#1b1e28] border-2 border-white/10 rounded-2xl outline-none focus:border-blue-500 focus:bg-white/5 font-black text-white text-sm transition-all shadow-sm placeholder:text-slate-600"
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
                <FileText className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                <input 
                  value={nomorSurat}
                  onChange={(e) => setNomorSurat(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-[#1b1e28] border-2 border-white/10 rounded-2xl outline-none focus:border-blue-500 focus:bg-white/5 font-bold text-white text-sm transition-all shadow-sm"
                  required
                />
              </div>
            </div>

            {type === 'Surat Keterangan Usaha' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Objek Usaha / Niaga</label>
                <div className="relative group">
                  <Shield className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                  <input 
                    value={usaha}
                    onChange={(e) => setUsaha(e.target.value)}
                    placeholder="e.g. Toko Kelontong, UMKM"
                    className="w-full pl-12 pr-6 py-4 bg-[#1b1e28] border-2 border-white/10 rounded-2xl outline-none focus:border-blue-500 focus:bg-white/5 font-black text-white text-sm transition-all shadow-sm placeholder:text-slate-600"
                    required
                  />
                </div>
              </div>
            )}

            <div className="pt-4 max-w-sm ml-auto">
              <button type="submit" className="w-full py-4 md:py-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-black uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-blue-500/30 hover:scale-[1.02] active:scale-95 transition-all duration-300 flex items-center justify-center gap-3 text-xs">
                <Printer size={20} /> Cetak & Pratinjau
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="bg-[#1b1e28] p-6 text-center border-t-4 border-amber-500/20 relative overflow-hidden shrink-0">
           <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
           <p className="text-blue-400 text-[8px] font-black uppercase tracking-[0.4em] leading-relaxed relative z-10 max-w-xs mx-auto">
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
               <img 
                 src="https://iili.io/BbSYeoB.png" 
                 className="w-full grayscale brightness-0" 
                 alt="Logo" 
                 referrerPolicy="no-referrer"
               />
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

              {data.type === 'Surat Keterangan Pendidikan' && (
                <p>Adalah benar yang bersangkutan adalah warga masyarakat Dusun Amaholu Losy yang saat ini sedang menempuh pendidikan dengan jenjang <b>{data.resident.pendidikan}</b>. Surat ini diberikan untuk keperluan administrasi pendidikan yang bersangkutan.</p>
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
            <div className="absolute top-12 left-12 w-24 h-24 flex items-center justify-center overflow-hidden">
              <img 
                src="https://iili.io/BbSYeoB.png" 
                className="w-full object-contain" 
                alt="Logo KK" 
                referrerPolicy="no-referrer"
              />
            </div>
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
