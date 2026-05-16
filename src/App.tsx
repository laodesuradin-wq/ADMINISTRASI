/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import * as XLSX from "xlsx";
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
  Baby,
  Calendar,
  Mic,
  MicOff,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
// @ts-ignore
import html2pdf from "html2pdf.js";
import { BackgroundIllustration } from "./components/BackgroundIllustration";
import { Family, AuthSession, LetterType, Resident } from "./types";
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
  VALIDATION,
} from "./utils";

// --- COMPONENTS ---

const INITIAL_MESSAGES = [
  {
    id: "1",
    role: "assistant",
    content:
      "Assalamu'alaikum/Selamat Sejahtera, warga Amaholu Losy! Saya adalah Asisten Digital Sandra. Dengan senang hati saya siap melayani keperluan administrasi Anda. Apa yang bisa saya bantu hari ini?",
  },
];

export default function App() {
  const [db, setDb] = useState<Family[]>([]);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [view, setView] = useState<"login" | "dashboard">("login");
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [currentFamily, setCurrentFamily] = useState<Family | null>(null);
  const [activeLetter, setActiveLetter] = useState<LetterType | null>(null);
  const [letterData, setLetterData] = useState<any>(null);
  const [printKKData, setPrintKKData] = useState<Family | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] =
    useState<{ id: string; role: string; content: string }[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");

  // Voice Recognition states
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");
  const [autoSendTrigger, setAutoSendTrigger] = useState("");

  const [isMobile, setIsMobile] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check for mobile device/screen
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsMobile(window.innerWidth < 640);
      }, 150);
    };
    // Initial check without delay
    setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", handleResize);
    };
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
      setView("dashboard");
    }
  }, []);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    }
  }, [db, isInitialized]);

  const handleLogin = useCallback((user: AuthSession) => {
    setSession(user);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    setView("dashboard");
  }, []);

  const handleLogout = useCallback(() => {
    if (window.confirm("Yakin ingin logout?")) {
      setSession(null);
      sessionStorage.removeItem(SESSION_KEY);
      setView("login");
      setActiveModal(null);
    }
  }, []);

  const filteredFamilies = useMemo(() => {
    if (!session) return [];
    let base = db;
    if (session.role === "warga") {
      base = db.filter((f) => f.no_kk === session.no_kk);
    }

    return base.filter((f) => {
      const kepala =
        f.anggota.find((a) => a.hubungan === "Kepala Keluarga")?.nama || "";
      return (
        f.no_kk.includes(searchTerm) ||
        kepala.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [db, session, searchTerm]);

  // Modals Handler
  const openEditModal = useCallback(
    (index: number) => {
      setEditingIndex(index);
      setCurrentFamily(JSON.parse(JSON.stringify(db[index])));
      setActiveModal("family");
    },
    [db],
  );

  const openNewFamilyModal = useCallback(() => {
    setEditingIndex(null);
    setCurrentFamily({
      no_kk: "",
      alamat: "Amaholu Losy",
      rt_rw: "",
      Desa: "Luhu",
      Kecamatan: "Huamual",
      Kabupaten: "Seram Bagian Barat",
      Provinsi: "Maluku",
      anggota: [],
    });
    setActiveModal("family");
  }, []);

  const saveFamily = useCallback(
    (family: Family) => {
      const duplicateKK = db.some(
        (f, idx) => f.no_kk === family.no_kk && idx !== editingIndex,
      );
      if (duplicateKK)
        return alert(
          "Peringatan Keamanan: Nomor KK ini sudah terdaftar dalam sistem!",
        );

      const allNiks = db.flatMap((f, idx) =>
        idx === editingIndex ? [] : f.anggota.map((a) => a.nik),
      );
      const hasDuplicateNIK = family.anggota.some((a) =>
        allNiks.includes(a.nik),
      );
      if (hasDuplicateNIK)
        return alert(
          "Peringatan Keamanan: Salah satu NIK sudah terdaftar di keluarga lain!",
        );

      const familyNiks = family.anggota.map((a) => a.nik);
      const hasDuplicateNIKInFamily = familyNiks.some(
        (nik, idx) => familyNiks.indexOf(nik) !== idx,
      );
      if (hasDuplicateNIKInFamily)
        return alert("Kesalahan Input: Ada NIK ganda dalam satu KK!");

      const trimmedFamily: Family = {
        ...family,
        no_kk: family.no_kk.trim(),
        alamat: family.alamat.trim(),
        rt_rw: family.rt_rw.trim(),
        Desa: family.Desa.trim(),
        Kecamatan: family.Kecamatan.trim(),
        Kabupaten: family.Kabupaten.trim(),
        Provinsi: family.Provinsi.trim(),
        anggota: family.anggota.map((a) => ({
          ...a,
          nama: a.nama.trim(),
          nik: a.nik.trim(),
          tempat_lahir: a.tempat_lahir.trim(),
          pendidikan: a.pendidikan.trim(),
          pekerjaan: a.pekerjaan.trim(),
          agama: a.agama.trim() as Resident["agama"],
          jk: a.jk.trim() as Resident["jk"],
          hubungan: a.hubungan.trim() as Resident["hubungan"],
          bansos: a.bansos.trim(),
        })) as Resident[],
      };

      if (editingIndex !== null) {
        const newDb = [...db];
        newDb[editingIndex] = trimmedFamily;
        setDb(newDb);
      } else {
        setDb([...db, trimmedFamily]);
      }
      setActiveModal(null);
    },
    [db, editingIndex],
  );

  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "id-ID";

      recognition.onstart = () => {
        setIsRecording(true);
        finalTranscriptRef.current = "";
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        setInput(currentTranscript);
        finalTranscriptRef.current = currentTranscript;
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
        if (finalTranscriptRef.current.trim() !== "") {
          setAutoSendTrigger(finalTranscriptRef.current);
          finalTranscriptRef.current = "";
        }
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleRecording = async () => {
    if (!recognitionRef.current) {
      alert(
        "Browser Anda tidak mendukung fitur pengenalan suara (Speech Recognition). Silakan gunakan Google Chrome.",
      );
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      try {
        // Request microphone permission explicitly first
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setInput("");
        recognitionRef.current?.start();
      } catch (err: any) {
        console.error("Mic access error:", err);
        alert(
          `Gagal mengakses mikrofon: ${err.message || "Izin ditolak atau perangkat tidak ditemukan."}`,
        );
        setIsRecording(false);
      }
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg = { id: Date.now().toString(), role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);
    setInput("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Gagal terhubung ke layanan AI.");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString() + "ai", role: "assistant", content: "" },
      ]);

      let assistantMessage = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assistantMessage += decoder.decode(value, { stream: true });

          setMessages((prev) => {
            const updated = [...prev];
            if (
              updated.length > 0 &&
              updated[updated.length - 1].role === "assistant"
            ) {
              updated[updated.length - 1].content = assistantMessage;
            }
            return updated;
          });
        }
      }
    } catch (error: any) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + "err",
          role: "assistant",
          content: `Maaf, terjadi kesalahan: ${error.message || "Kesalahan teknis"}. Silakan coba lagi.`,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    if (autoSendTrigger) {
      handleSendMessage(autoSendTrigger);
      setAutoSendTrigger("");
    }
  }, [autoSendTrigger, messages]);

  return (
    <div className="min-h-screen bg-transparent font-sans text-sky-950 relative">
      <BackgroundIllustration />
      <AnimatePresence mode="wait">
        {view === "login" ? (
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
            openStats={() => setActiveModal("stats")}
            openArticles={() => setActiveModal("articles")}
            openLetter={(type) => {
              setActiveLetter(type);
              setActiveModal("letter");
            }}
            openPrintKK={(f) => {
              setPrintKKData(f);
              setActiveModal("print-kk");
            }}
            onDelete={(index) => {
              if (window.confirm("Hapus data KK ini?")) {
                const newDb = db.filter((_, i) => i !== index);
                setDb(newDb);
              }
            }}
            resetDb={() => {
              const pass = window.prompt(
                "Masukkan password admin untuk reset:",
              );
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
        {activeModal === "family" && currentFamily && session && (
          <FamilyModal
            family={currentFamily}
            session={session}
            onSave={saveFamily}
            onClose={() => setActiveModal(null)}
          />
        )}

        {activeModal === "stats" && (
          <StatsModal db={db} onClose={() => setActiveModal(null)} />
        )}

        {activeModal === "letter" && activeLetter && (
          <LetterModal
            type={activeLetter}
            db={db}
            session={session!}
            onClose={() => setActiveModal(null)}
            onPreview={(data) => {
              setLetterData(data);
              setActiveModal("preview");
            }}
          />
        )}

        {activeModal === "articles" && (
          <ArticleModal onClose={() => setActiveModal(null)} />
        )}

        {activeModal === "preview" && letterData && (
          <div className="print-area-container">
            <PreviewModal
              data={letterData}
              onClose={() => setActiveModal("letter")}
            />
          </div>
        )}

        {activeModal === "print-kk" && printKKData && (
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
              className="mb-6 w-[calc(100vw-48px)] max-w-[400px] h-[75vh] max-h-[600px] bg-white rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.25)] border border-sky-100 flex flex-col overflow-hidden relative"
            >
              <div className="p-6 bg-blue-600 text-white flex justify-between items-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 bg-white rounded-2xl border border-sky-100 shadow-sm flex items-center justify-center">
                    <MessageSquare size={24} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-black text-base leading-none tracking-tight">
                      KONSULTASI DIGITAL
                    </h3>
                    <p className="text-[10px] text-blue-400 font-bold uppercase mt-1.5 flex items-center gap-2 tracking-widest">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>{" "}
                      Asisten AI Aktif
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowChat(false)}
                  className="p-3 hover:bg-white rounded-3xl border border-sky-100 shadow-sm hover:shadow-md transition-all active:scale-90"
                >
                  <X size={20} />
                </button>
              </div>

              <div
                ref={chatContainerRef}
                className="flex-1 p-6 overflow-y-auto bg-sky-50/50 space-y-6 scroll-smooth"
              >
                {messages.length === 1 && (
                  <div className="grid grid-cols-1 gap-2 mb-4">
                    {[
                      "Bagaimana cara buat SKTM?",
                      "Syarat Surat Domisili apa saja?",
                      "Lupa password login warga",
                      "Info bantuan sosial (Bansos)",
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => {
                          setInput(q);
                        }}
                        className="px-4 py-2 bg-white border border-blue-100 rounded-xl text-[10px] font-bold text-blue-600 text-left hover:bg-blue-50 transition-colors shadow-sm"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
                {messages.map((msg) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[88%] px-5 py-4 rounded-[1.5rem] text-[13px] leading-relaxed relative whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white rounded-br-none shadow-xl shadow-blue-500/20 font-medium"
                          : "bg-white border border-sky-100 text-slate-700 rounded-bl-none shadow-sm font-semibold"
                      }`}
                    >
                      {msg.content || (msg.role === "assistant" ? "..." : "")}
                      <div
                        className={`absolute bottom-[-4px] ${msg.role === "user" ? "right-0 border-t-[8px] border-t-blue-600 border-l-[8px] border-l-transparent" : "left-0 border-t-[8px] border-t-white border-r-[8px] border-r-transparent"}`}
                      ></div>
                    </div>
                  </motion.div>
                ))}
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="bg-white border border-sky-100 p-4 rounded-bl-none shadow-sm flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="p-6 bg-white border-t border-sky-100">
                <form
                  className="flex gap-3 relative"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (input) {
                      handleSendMessage(input);
                    }
                  }}
                >
                  <div className="flex-1 relative">
                    <input
                      autoComplete="off"
                      name="message"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      type="text"
                      placeholder="Tanyakan sesuatu..."
                      className="w-full bg-slate-100/80 rounded-2xl pl-6 pr-14 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 ring-blue-500/5 focus:bg-white focus:border-blue-500/20 transition-all border-2 border-transparent"
                      disabled={isTyping}
                    />
                    <button
                      type="button"
                      onClick={toggleRecording}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all ${
                        isRecording
                          ? "bg-red-100 text-red-500 animate-pulse"
                          : "text-sky-600 hover:text-blue-500 hover:bg-blue-50"
                      }`}
                      title={isRecording ? "Hentikan merekam" : "Mulai suara"}
                    >
                      {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={!input.trim() || isTyping}
                    className="bg-blue-600 text-white w-14 h-14 rounded-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 shadow-blue-600/20 flex items-center justify-center p-0 shrink-0"
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
              ease: "easeInOut",
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-[1.5rem] text-sky-950 shadow-2xl flex items-center justify-center transition-all duration-500 group relative ${
              showChat
                ? "bg-white rounded-3xl border border-sky-100 shadow-sm rotate-90 shadow-slate-900/40"
                : "bg-blue-600 shadow-blue-600/20 text-white"
            }`}
          >
            {showChat ? (
              <X size={24} className="md:w-7 md:h-7" />
            ) : (
              <>
                <MessageSquare
                  size={22}
                  className="md:w-7 md:h-7 group-hover:scale-110 transition-transform"
                />
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

const LoginView = React.memo(function LoginView({
  onLogin,
}: {
  onLogin: (u: AuthSession) => void;
  key?: React.Key;
}) {
  const [role, setRole] = useState<"warga" | "admin">("warga");
  const [noKK, setNoKK] = useState("");
  const [password, setPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [error, setError] = useState("");

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const db = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

    if (role === "warga") {
      const family = db.find((f: Family) => f.no_kk === noKK.trim());
      if (!family) return setError("Nomor KK tidak ditemukan.");
      const kepala = family.anggota.find(
        (a: Resident) => a.hubungan === "Kepala Keluarga",
      );
      if (!kepala) return setError("Data Kepala Keluarga tidak ditemukan.");
      if (kepala.nik.trim() !== password.trim())
        return setError("Password (NIK) salah.");

      onLogin({ role: "warga", no_kk: noKK.trim(), nama: kepala.nama });
    } else {
      if (adminEmail === ADMIN_EMAIL && adminPass === ADMIN_PASSWORD) {
        onLogin({ role: "admin", nama: "Administrator", email: adminEmail });
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
      className="min-h-screen flex items-center justify-center p-2 sm:p-4 bg-transparent relative overflow-hidden"
    >
      {/* Official background architecture */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[#faecca] bg-[radial-gradient(#d38736_0.5px,transparent_0.5px)] [background-size:24px_24px] opacity-20"></div>
        <div className="absolute -top-1/4 -right-1/4 w-[80rem] h-[80rem] bg-orange-400/10 rounded-full blur-[140px] animate-pulse"></div>
        <div className="absolute -bottom-1/4 -left-1/4 w-[60rem] h-[60rem] bg-teal-400/10 rounded-full blur-[120px] animate-pulse [animation-delay:2s]"></div>
      </div>

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 120 }}
        className="w-[94%] sm:w-full max-w-[340px] bg-white rounded-[1.75rem] sm:rounded-[2.5rem] border border-sky-100 overflow-hidden shadow-[0_32px_64px_-16px_rgba(153,85,0,0.15)] flex flex-col relative z-10"
      >
        <div className="w-full p-4 md:p-6 text-sky-950 flex flex-col justify-center bg-[#fdfaf5] bg-[radial-gradient(#e5e5e5_1.5px,transparent_1.5px)] [background-size:16px_16px] relative overflow-hidden h-[160px] border-b border-gray-100 border-dashed">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/50"></div>
          <div className="flex flex-col items-center justify-center text-center relative z-10 h-full">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="w-16 h-16 bg-white rounded-[1.25rem] flex items-center justify-center p-2 mb-3 shadow-[0_8px_20px_rgba(0,0,0,0.06)] border border-sky-50"
            >
              <img
                src="https://iili.io/BbSYeoB.png"
                alt="Logo Resmi"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </motion.div>

            <div>
              <h1 className="text-xl md:text-2xl font-black leading-tight mb-1 tracking-tighter uppercase font-sans">
                <span className="text-[#ff8833]">SIAK</span><span className="text-[#67d5ce]">DIGITAL</span>
              </h1>
              <p className="text-[#995500] text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em] leading-none opacity-80">
                Dusun Amaholu Losy
              </p>
            </div>
          </div>
        </div>

        <div className="w-full bg-white p-5 md:p-8 flex flex-col justify-center">
          <div className="mb-5 text-center sm:text-left">
            <h2 className="text-lg font-extrabold text-sky-950 tracking-tight">
              Masuk Ke Sistem
            </h2>
            <p className="text-slate-500 text-[11px] mt-1 font-medium italic">Silahkan pilih metode masuk Anda</p>
          </div>

          <div className="p-1 sm:p-1.5 bg-[#fdfaf5] border border-orange-100/50 rounded-xl flex gap-1 mb-6">
            <button
              onClick={() => setRole("warga")}
              className={`flex-1 py-2.5 px-1 sm:px-2 rounded-lg font-black text-[9px] sm:text-[10px] uppercase tracking-wider transition-all relative group overflow-hidden ${role === "warga" ? "bg-white text-[#67d5ce] shadow-[0_4px_12px_rgba(0,0,0,0.05)] border-b-2 border-[#67d5ce]/10" : "text-[#995500]/60 hover:text-[#995500]"}`}
            >
              Login Warga
            </button>
            <button
              onClick={() => setRole("admin")}
              className={`flex-1 py-2.5 px-1 sm:px-2 rounded-lg font-black text-[9px] sm:text-[10px] uppercase tracking-wider transition-all relative group overflow-hidden ${role === "admin" ? "bg-white text-[#67d5ce] shadow-[0_4px_12px_rgba(0,0,0,0.05)] border-b-2 border-[#67d5ce]/10" : "text-[#995500]/60 hover:text-[#995500]"}`}
            >
              Login Admin
            </button>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-5 p-2.5 bg-rose-50 border border-rose-100 text-rose-600 text-[9px] font-black uppercase tracking-wider rounded-lg flex items-center gap-2 shadow-sm"
            >
              <X size={12} className="shrink-0" /> <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-3">
            {role === "warga" ? (
              <>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-[#995500] uppercase tracking-[0.1em] ml-2">
                    Nomor Kartu Keluarga (KK)
                  </label>
                  <div className="relative group">
                    <Users
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#995500] group-focus-within:text-[#995500] transition-colors"
                      size={16}
                    />
                    <input
                      type="text"
                      placeholder="16-digit kode KK"
                      className="w-full pl-10 pr-3 py-3 bg-[#fdfaf5] border-2 border-[#f9d89b]/30 rounded-xl outline-none focus:border-[#67d5ce] focus:bg-white focus:ring-4 focus:ring-[#67d5ce]/10 transition-all font-bold text-[13px] text-[#995500] placeholder:text-[#995500]/40 shadow-sm"
                      value={noKK}
                      onChange={(e) => {
                        const val = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 16);
                        setNoKK(val);
                      }}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-[#995500] uppercase tracking-[0.1em] ml-2">
                    Kunci Pribadi (NIK)
                  </label>
                  <div className="relative group">
                    <Shield
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#995500] group-focus-within:text-[#995500] transition-colors"
                      size={16}
                    />
                    <input
                      type="password"
                      placeholder="NIK Kepala Keluarga"
                      className="w-full pl-10 pr-3 py-3 bg-[#fdfaf5] border-2 border-[#f9d89b]/30 rounded-xl outline-none focus:border-[#67d5ce] focus:bg-white focus:ring-4 focus:ring-[#67d5ce]/10 transition-all font-bold text-[13px] text-[#995500] placeholder:text-[#995500]/40 shadow-sm"
                      value={password}
                      onChange={(e) => {
                        const val = e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 16);
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
                  <label className="text-[9px] font-bold text-[#995500] uppercase tracking-[0.1em] ml-2">
                    Identitas Otoritas
                  </label>
                  <div className="relative group">
                    <UserIcon
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#995500] group-focus-within:text-[#995500] transition-colors"
                      size={16}
                    />
                    <input
                      type="email"
                      placeholder="Email Kedinasan Resmi"
                      className="w-full pl-10 pr-3 py-3 bg-[#fdfaf5] border-2 border-[#f9d89b]/30 rounded-xl outline-none focus:border-[#67d5ce] focus:bg-white focus:ring-4 focus:ring-[#67d5ce]/10 transition-all font-bold text-[13px] text-[#995500] placeholder:text-[#995500]/40 shadow-sm"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-[#995500] uppercase tracking-[0.1em] ml-2">
                    Kunci Akses Sistem
                  </label>
                  <div className="relative group">
                    <Shield
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#995500] group-focus-within:text-[#995500] transition-colors"
                      size={16}
                    />
                    <input
                      type="password"
                      placeholder="Masukkan kunci administrator"
                      className="w-full pl-10 pr-3 py-3 bg-[#fdfaf5] border-2 border-[#f9d89b]/30 rounded-xl outline-none focus:border-[#67d5ce] focus:bg-white focus:ring-4 focus:ring-[#67d5ce]/10 transition-all font-bold text-[13px] text-[#995500] placeholder:text-[#995500]/40 shadow-sm"
                      value={adminPass}
                      onChange={(e) => setAdminPass(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              className="w-full py-3.5 mt-1 bg-[#67d5ce] text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-[#67d5ce]/30 hover:bg-[#5bc4bd] hover:shadow-xl transition-all active:scale-[0.98]"
            >
              Masuk
            </button>
          </form>

          <div className="mt-8 flex items-center justify-center"></div>
        </div>
      </motion.div>
    </motion.div>
  );
});

const ADMIN_DOC_BUTTONS = [
  {
    name: "Surat Keterangan Usaha",
    label: "SK USAHA",
    sub: "Layanan Usaha",
    icon: "💼",
  },
  {
    name: "Surat Keterangan Tidak Mampu",
    label: "SKTM",
    sub: "Bantuan Sosial",
    icon: "🤝",
  },
  {
    name: "Surat Keterangan Pendidikan",
    label: "SK PENDIDIKAN",
    sub: "Layanan Siswa",
    icon: "🎓",
  },
  {
    name: "Surat Keterangan Kematian",
    label: "AKTA MATI",
    sub: "Saksi Kematian",
    icon: "🕊️",
  },
  {
    name: "Surat Keterangan Domisili",
    label: "DOMISILI",
    sub: "Bukti Tinggal",
    icon: "🏠",
  },
];

const DashboardView = React.memo(function DashboardView({
  session,
  families,
  allFamilies,
  onLogout,
  searchTerm,
  setSearchTerm,
  openEditModal,
  openNewFamilyModal,
  openStats,
  openArticles,
  openLetter,
  openPrintKK,
  onDelete,
  resetDb,
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
  openArticles: () => void;
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
      "Kepala Keluarga":
        f.anggota.find((a) => a.hubungan === "Kepala Keluarga")?.nama || "-",
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(familyData),
      "Data_Keluarga",
    );

    const membersData = allFamilies.flatMap((f) =>
      f.anggota.map((a) => ({
        "No. KK": f.no_kk,
        Nama: a.nama,
        NIK: a.nik,
        "Tgl Lahir": a.tgl,
        JK: a.jk,
        Hubungan: a.hubungan,
        Bansos: a.bansos,
      })),
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(membersData),
      "Data_Penduduk",
    );

    XLSX.writeFile(wb, "SIAK_AMAHOLU_LOSY.xlsx");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex items-center justify-center p-4 bg-transparent relative overflow-hidden no-print-bg"
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -bottom-[200px] -left-[100px] w-[500px] h-[400px] bg-[#995500]/5 rounded-[50%_50%_0_0] rotate-12 blur-[100px]"></div>
        <div className="absolute -top-[100px] -right-[100px] w-[600px] h-[500px] bg-[#67d5ce]/5 rounded-[0_0_50%_50%] -rotate-12 blur-[120px]"></div>
      </div>

      <motion.div
        initial={{ y: 30, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 100 }}
        className="w-full max-w-[440px] md:max-w-4xl lg:max-w-6xl bg-white rounded-[2.5rem] md:rounded-3xl border border-sky-100 overflow-hidden shadow-2xl flex flex-col relative z-20 min-h-[90vh] md:h-auto"
      >
        <div className="w-full px-5 py-4 sm:px-6 sm:py-5 text-sky-950 flex flex-col justify-center bg-[#fdfaf5] bg-[radial-gradient(#e5e5e5_2px,transparent_2px)] [background-size:16px_16px] relative overflow-hidden shrink-0 border-b border-gray-100 border-dashed">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/60"></div>
          <div className="flex justify-between items-center relative z-10 w-full pt-1">
            <div className="flex flex-row items-center justify-start w-full gap-3">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-2 shadow-[0_8px_20px_rgba(0,0,0,0.05)] border border-sky-50 shrink-0"
              >
                <img
                  src="https://iili.io/BbSYeoB.png"
                  className="w-full h-full object-contain"
                  alt="Logo"
                  referrerPolicy="no-referrer"
                />
              </motion.div>
              <div className="text-left flex flex-col justify-center">
                <h1 className="text-lg md:text-xl font-black leading-tight mb-0.5 tracking-tighter uppercase font-sans">
                  <span className="text-[#ff8833]">SIAK</span> <span className="text-[#67d5ce]">MOBILE</span>
                </h1>
                <div className="inline-flex items-center">
                  <p className="text-[#995500] text-[7px] md:text-[8px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] leading-none">
                    Dusun Amaholu Losy
                  </p>
                </div>
              </div>
            </div>
            
            <button
              onClick={onLogout}
              className="absolute right-0 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded-xl flex items-center justify-center shadow-sm active:scale-90 transition-all border border-rose-100"
            >
              <LogOut size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden bg-white relative">
          {/* Decorative mountain shapes from image */}
          <div className="absolute bottom-0 left-0 w-full h-[60%] pointer-events-none opacity-[0.03] z-0 overflow-hidden">
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-[800px] h-[800px] border-[60px] border-[#995500] rotate-45 rounded-[80px]"></div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-none pb-20 px-6 pt-8 relative z-10">
            {!adminMenuOpen && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="pb-8 relative z-10"
              >
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100/50 shadow-sm overflow-hidden relative">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em]">Sistem Digital Terintegrasi</span>
                  </div>
                </div>
              </motion.div>
            )}

            <div
              className={`grid grid-cols-3 gap-4 p-1 mb-6 transition-all duration-300 ${adminMenuOpen ? "mt-4" : ""}`}
            >
              {!adminMenuOpen &&
                [
                  {
                    label:
                      session.role === "admin" ? "LIHAT DATA" : "DATA KELUARGA",
                    sub: session.role === "admin" ? "DATABASE" : "AKSES DATA",
                    icon: "📋",
                    iconBg: "bg-[#67d5ce] text-white",
                    action: () => setIsDatabaseViewOpen(true),
                  },
                  {
                    label: "TAMBAH KK",
                    sub: "OPERASI DATA",
                    icon: "📝",
                    iconBg: "bg-[#ff8833] text-white",
                    action: () => openNewFamilyModal(),
                  },
                  ...(session.role === "admin"
                    ? [
                        {
                          label: "EKSPOR DATA",
                          sub: "EXCEL",
                          icon: "💾",
                          iconBg: "bg-[#f9d89b] text-[#331c00]",
                          action: () => exportToExcel(),
                        },
                        {
                          label: "STATISTIK",
                          sub: "REKAP",
                          icon: "📊",
                          iconBg: "bg-[#67d5ce] text-white",
                          action: () => openStats(),
                        }
                      ]
                    : []),
                ].map((item, idx) => {
                  return (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, scale: 0.8, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: 0.1 + (idx * 0.05), type: "spring", stiffness: 120 }}
                      className="relative group col-span-1"
                    >
                      <button
                        onClick={item.action}
                        className={`w-full p-2 transition-all flex flex-col items-center justify-center gap-3 active:scale-90 group`}
                      >
                        <div
                          className={`w-16 h-16 md:w-20 md:h-20 rounded-[1.75rem] flex items-center justify-center text-3xl md:text-3xl transition-all ${item.iconBg} shadow-[0_8px_20px_-4px_rgba(0,0,0,0.1)] group-hover:shadow-[0_12px_24px_-4px_rgba(0,0,0,0.15)] group-hover:-translate-y-1 font-black`}
                        >
                          {item.icon}
                        </div>
                        <div className="text-center">
                          <span className="block text-[10px] md:text-[11px] font-black text-[#995500] uppercase tracking-tight leading-tight">
                            {item.label}
                          </span>
                        </div>
                      </button>
                    </motion.div>
                  );
                })}

              {/* Administrasi Digital Surat & Artikel Section */}
              {session.role === "admin" && (
                <>
                  {!adminMenuOpen && (
                    <div
                      className="col-span-1 relative group"
                    >
                      <button
                        onClick={() => setAdminMenuOpen(true)}
                        className={`w-full p-2 transition-all flex flex-col items-center justify-center gap-2 active:scale-95 relative`}
                      >
                        <div
                          className={`w-16 h-16 md:w-20 md:h-20 rounded-[1.5rem] flex items-center justify-center text-3xl md:text-4xl transition-transform bg-[#67d5ce] text-white shadow-lg hover:shadow-xl`}
                        >
                          📄
                        </div>
                        <div className="text-center mt-1">
                          <span className="block text-[10px] md:text-[11px] font-black text-[#995500] uppercase tracking-tight leading-tight">
                            Digital Surat
                          </span>
                        </div>
                      </button>
                    </div>
                  )}

                  {!adminMenuOpen && (
                    <div className="col-span-1 relative group">
                      <button
                        onClick={openArticles}
                        className={`w-full p-2 transition-all flex flex-col items-center justify-center gap-2 active:scale-95 group`}
                      >
                        <div
                          className={`w-16 h-16 md:w-20 md:h-20 rounded-[1.5rem] flex items-center justify-center text-3xl md:text-4xl transition-transform bg-[#ff8833] text-white shadow-lg hover:shadow-xl transition-all`}
                        >
                          📰
                        </div>
                        <div className="text-center mt-1">
                          <span className="block text-[10px] md:text-[11px] font-black text-[#995500] uppercase tracking-tight leading-tight">
                            Kegiatan
                          </span>
                        </div>
                      </button>
                    </div>
                  )}

                  <AnimatePresence>
                    {adminMenuOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="col-span-full bg-white rounded-3xl border border-sky-100 border-2 overflow-hidden shadow-inner mt-2 flex flex-col"
                      >
                        <div className="p-3 bg-sky-50/50 border-b border-sky-100 flex items-center justify-between">
                          <h3 className="text-xs font-bold text-sky-900 uppercase tracking-widest pl-2">Menu Surat</h3>
                          <button 
                            onClick={() => setAdminMenuOpen(false)}
                            className="bg-white hover:bg-rose-50 text-sky-900 hover:text-rose-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-colors border border-sky-100 hover:border-rose-200"
                          >
                            Kembali
                          </button>
                        </div>
                        <div className="p-3 md:p-4 grid grid-cols-3 gap-2 md:gap-3">
                          {ADMIN_DOC_BUTTONS.map((item) => (
                            <button
                              key={item.name}
                              onClick={() => {
                                openLetter(item.name as LetterType);
                                setAdminMenuOpen(false);
                              }}
                              className="p-3 md:p-4 md:rounded-2xl bg-white rounded-3xl border border-sky-100 hover:bg-sky-100/50 hover:border-blue-500/30 flex flex-col items-start group active:scale-95 transition-all text-left h-full shadow-sm relative overflow-hidden"
                            >
                              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity text-6xl pointer-events-none">
                                {item.icon}
                              </div>
                              <div className="mb-2 md:mb-3 text-xl md:text-2xl group-hover:scale-110 transition-transform relative z-10">
                                <span className="opacity-80 grayscale group-hover:grayscale-0 transition-all">
                                  {item.icon}
                                </span>
                              </div>
                              <p className="text-[8px] md:text-[10px] font-black text-sky-600 uppercase tracking-widest mb-1 leading-none opacity-60 relative z-10">
                                {item.sub}
                              </p>
                              <h4 className="text-[10px] md:text-sm font-black text-sky-950 tracking-tighter uppercase leading-tight relative z-10">
                                {item.label}
                              </h4>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="bg-[#fcfaf5] border-t border-slate-100 py-4 px-6 text-center shrink-0">
          <p className="text-[#995500] text-[8px] font-bold uppercase tracking-[0.2em] leading-relaxed">
            Sistem Informasi Administrasi Kependudukan
          </p>
        </div>

        <AnimatePresence>
          {isDatabaseViewOpen && (
            <div className="absolute inset-0 z-[120] flex items-center justify-center p-0 no-print">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                onClick={() => setIsDatabaseViewOpen(false)}
              />

              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="relative w-full h-full bg-white rounded-3xl border border-sky-100 shadow-sm overflow-hidden flex flex-col"
              >
                <div className="bg-[#fcfaf5] px-5 py-6 border-b border-[#f9d89b] flex items-center justify-between sticky top-0 z-20 shadow-sm relative overflow-hidden">
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-[#f9d89b] flex items-center justify-center text-[#995500]">
                      <Users size={20} />
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-[#995500] tracking-tight uppercase leading-none">
                        Database Warga
                      </h3>
                      <p className="text-[8px] font-black text-[#d38736] uppercase tracking-[0.3em] mt-1.5">
                        Total: {families.length} Records
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsDatabaseViewOpen(false)}
                    className="w-10 h-10 bg-white border border-[#f9d89b] shadow-sm hover:bg-[#fcfaf5] transition-all text-[#995500] rounded-full flex items-center justify-center active:scale-90 font-bold relative z-10"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-none bg-[#f8f8f8]">
                  <div className="relative group">
                    <Search
                      className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"
                      size={18}
                    />
                    <input
                      type="text"
                      placeholder="Cari NIK atau Nama Kepala Keluarga..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-6 py-4 bg-white rounded-[1.25rem] border-2 border-slate-100 outline-none focus:border-[#67d5ce] focus:ring-4 ring-[#67d5ce]/5 font-black text-[#995500] placeholder:text-slate-300 text-sm transition-all shadow-sm group-hover:shadow-md"
                    />
                  </div>

                  <div className="space-y-4 pb-14">
                    {families.length > 0 ? (
                      families.map((f, i) => {
                        const kepalaObj = f.anggota.find(
                          (a) => a.hubungan === "Kepala Keluarga",
                        );
                        return (
                          <motion.div
                            key={f.no_kk}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.03 }}
                            className="bg-white rounded-[1.75rem] border border-slate-200 p-5 space-y-4 hover:border-[#67d5ce] shadow-[0_4px_12px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.06)] transition-all group relative overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#67d5ce]/5 to-transparent rounded-bl-full pointer-events-none transition-all group-hover:scale-150 group-hover:opacity-100 opacity-0"></div>
                            
                            <div className="flex justify-between items-start relative z-10">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-1.5 h-1.5 bg-[#d38736] rounded-full"></div>
                                  <p className="text-[9px] font-black text-[#d38736] uppercase tracking-widest leading-none">
                                    Kepala Keluarga
                                  </p>
                                </div>
                                <h4 className="text-base font-black text-[#995500] uppercase tracking-tight leading-tight">
                                  {kepalaObj?.nama || "-"}
                                </h4>
                              </div>
                              <div className="px-3 py-1.5 bg-[#fdfaf5] border border-[#f9d89b]/40 rounded-xl text-[10px] font-black text-[#995500] shadow-sm">
                                #{i + 1}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2 relative z-10">
                              <div className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100 group-hover:bg-white transition-colors">
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 leading-none">
                                  No. KK
                                </p>
                                <p className="text-[11px] font-black text-slate-700 tracking-wider">
                                  {f.no_kk}
                                </p>
                              </div>
                              <div className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100 group-hover:bg-white transition-colors">
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1 leading-none">
                                  Wilayah
                                </p>
                                <p className="text-[11px] font-black text-slate-700 truncate">
                                  RT {f.rt_rw}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-2.5 pt-2 relative z-10">
                              <button
                                onClick={() => {
                                  openEditModal(
                                    allFamilies.findIndex(
                                      (it) => it.no_kk === f.no_kk,
                                    ),
                                  );
                                  setIsDatabaseViewOpen(false);
                                }}
                                className="flex-1 py-3.5 bg-[#67d5ce] text-white rounded-[1.25rem] font-black text-[10px] uppercase tracking-widest hover:bg-[#5bc4bd] active:scale-[0.98] transition-all shadow-lg shadow-[#67d5ce]/20 hover:shadow-[#67d5ce]/40"
                              >
                                {session.role === "admin"
                                  ? "Kelola Database"
                                  : "Detail Berkas"}
                              </button>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    openPrintKK(f);
                                    setIsDatabaseViewOpen(false);
                                  }}
                                  className="w-[50px] h-[50px] bg-white rounded-2xl border border-slate-200 text-slate-600 flex items-center justify-center hover:text-[#67d5ce] hover:border-[#67d5ce] hover:shadow-md active:scale-95 transition-all outline-none"
                                >
                                  <Printer size={18} strokeWidth={2.5} />
                                </button>
                                {session.role === "admin" && (
                                  <button
                                    onClick={() =>
                                      onDelete(
                                        allFamilies.findIndex(
                                          (it) => it.no_kk === f.no_kk,
                                        ),
                                      )
                                    }
                                    className="w-[50px] h-[50px] bg-rose-50 text-rose-500 rounded-2xl border border-rose-100 flex items-center justify-center hover:bg-rose-500 hover:text-white hover:border-rose-500 active:scale-95 transition-all outline-none"
                                  >
                                    <Trash2 size={18} strokeWidth={2.5} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4 opacity-50">
                          <Users size={40} />
                        </div>
                        <p className="text-slate-500 font-bold text-sm tracking-tight">Tidak ada data ditemukan</p>
                        <p className="text-slate-400 text-[10px] mt-1 italic">Gunakan kata kunci pencarian lain</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
});

// --- MODALS ---

const FamilyModal = React.memo(function FamilyModal({
  family,
  session,
  onSave,
  onClose,
}: {
  family: Family;
  session: AuthSession;
  onSave: (f: Family) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<Family>(JSON.parse(JSON.stringify(family)));

  const addMember = () => {
    const newMember: Resident = {
      nama: "",
      nik: "",
      tempat_lahir: "",
      tgl: "",
      jk: "",
      hubungan: "",
      agama: "",
      pendidikan: "",
      pekerjaan: "",
      bansos: "",
    };
    setData({ ...data, anggota: [...data.anggota, newMember] });
  };

  const removeMember = (index: number) => {
    const newMembers = data.anggota.filter((_, i) => i !== index);
    setData({ ...data, anggota: newMembers });
  };

  const updateMember = (
    index: number,
    field: keyof Resident,
    value: string,
  ) => {
    const newMembers = [...data.anggota];
    newMembers[index] = { ...newMembers[index], [field]: value };
    setData({ ...data, anggota: newMembers });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidKK(data.no_kk))
      return alert("Data Gagal Simpan: Nomor KK harus tepat 16 digit angka.");
    if (data.anggota.length === 0)
      return alert("Minimal harus ada 1 anggota keluarga yang terdaftar.");

    // Check if there is exactly one head of family
    const headCount = data.anggota.filter(
      (a) => a.hubungan === "Kepala Keluarga",
    ).length;
    if (headCount === 0)
      return alert(
        "Kesalahan: Keluarga harus memiliki minimal satu Kepala Keluarga.",
      );
    if (headCount > 1)
      return alert(
        "Kesalahan: Dalam satu KK tidak boleh ada lebih dari satu Kepala Keluarga.",
      );

    // Validate each member
    for (const member of data.anggota) {
      if (!isValidName(member.nama))
        return alert(
          `Kesalahan Input: Nama "${member.nama}" mengandung karakter yang tidak diizinkan.`,
        );
      if (!isValidNIK(member.nik))
        return alert(
          `Data Gagal Simpan: NIK untuk "${member.nama}" harus tepat 16 digit angka.`,
        );

      const birthDate = new Date(member.tgl);
      if (birthDate > new Date())
        return alert(
          `Kesalahan Tanggal: Tanggal lahir "${member.nama}" tidak boleh di masa depan.`,
        );
    }

    onSave(data);
  };

  const isReadOnly = session.role === "warga" && family.no_kk !== "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 no-print">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 30 }}
        className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-[2.5rem] shadow-[0_32px_80px_-20px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col border border-sky-100"
      >
        <div className="bg-[#fdfaf5] border-b border-[#f9d89b]/40 px-6 py-6 md:px-10 md:py-8 flex items-center justify-between relative overflow-hidden shrink-0">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#995500_2px,transparent_2px)] [background-size:12px_12px]"></div>
          <div className="flex items-center gap-4 md:gap-6 relative z-10">
            <div className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-2xl border border-[#f9d89b]/40 flex items-center justify-center text-[#d38736] shadow-sm shrink-0">
              <Users className="w-6 h-6 md:w-8 md:h-8" />
            </div>
            <div className="text-left">
              <h3 className="text-sky-950 text-xl md:text-2xl font-black tracking-tighter uppercase leading-tight">
                {isReadOnly
                  ? "Detail Berkas Digital"
                  : data.no_kk
                    ? "Formulir Kartu Keluarga"
                    : "Pendaftaran Keluarga Baru"}
              </h3>
              <p className="text-[10px] font-black text-[#d38736]/70 uppercase tracking-[0.2em] mt-1">Sistem Administrasi Kependudukan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 md:w-12 md:h-12 bg-white border border-[#f9d89b]/40 shadow-sm hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 transition-all text-sky-950 rounded-2xl flex items-center justify-center active:scale-90 shrink-0 group"
          >
            <X className="w-5 h-5 md:w-6 md:h-6 group-hover:rotate-90 transition-transform" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 md:p-12 space-y-10 md:space-y-14 scrollbar-none bg-white"
        >
          {/* Header Data KK */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 bg-[#fdfaf5]/50 p-6 md:p-10 rounded-[2rem] border border-orange-100/30">
            <div className="space-y-2.5">
              <label className="text-[10px] font-black text-[#995500] uppercase tracking-[0.2em] ml-2">
                Nomor Kartu Keluarga
              </label>
              <input
                value={data.no_kk}
                onChange={(e) =>
                  setData({
                    ...data,
                    no_kk: e.target.value.replace(/\D/g, "").slice(0, 16),
                  })
                }
                maxLength={16}
                disabled={isReadOnly}
                required
                placeholder="16 DIGIT KODE KK"
                className="w-full px-6 py-4 bg-white border-2 border-[#f9d89b]/30 rounded-2xl outline-none focus:border-[#67d5ce] focus:ring-4 focus:ring-[#67d5ce]/5 transition-all font-black text-[#995500] placeholder:text-[#995500]/30 text-sm md:text-base leading-none shadow-sm"
              />
            </div>
            <div className="space-y-2.5">
              <label className="text-[10px] font-black text-[#995500] uppercase tracking-[0.2em] ml-2">
                Alamat Lengkap
              </label>
              <input
                value={data.alamat}
                onChange={(e) => setData({ ...data, alamat: e.target.value })}
                disabled={isReadOnly}
                required
                placeholder="DUSUN / JALAN"
                className="w-full px-6 py-4 bg-white border-2 border-[#f9d89b]/30 rounded-2xl outline-none focus:border-[#67d5ce] focus:ring-4 focus:ring-[#67d5ce]/5 transition-all font-black text-[#995500] placeholder:text-[#995500]/30 text-sm md:text-base leading-none shadow-sm"
              />
            </div>
            <div className="space-y-2.5">
              <label className="text-[10px] font-black text-[#995500] uppercase tracking-[0.2em] ml-2">
                Wilayah RT/RW
              </label>
              <input
                value={data.rt_rw}
                onChange={(e) =>
                  setData({
                    ...data,
                    rt_rw: e.target.value.replace(/\D/g, "").slice(0, 3),
                  })
                }
                disabled={isReadOnly}
                required
                placeholder="00/00"
                className="w-full px-6 py-4 bg-white border-2 border-[#f9d89b]/30 rounded-2xl outline-none focus:border-[#67d5ce] focus:ring-4 focus:ring-[#67d5ce]/5 transition-all font-black text-[#995500] placeholder:text-[#995500]/30 text-center text-sm md:text-base leading-none shadow-sm"
              />
            </div>
          </div>

          {/* Daftar Anggota */}
          <div className="space-y-8 md:space-y-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-2.5 h-10 bg-[#ff8833] rounded-full shadow-[0_0_15px_rgba(255,136,51,0.3)]"></div>
                <div>
                  <h4 className="text-xl md:text-2xl font-black text-sky-950 tracking-tight leading-none">
                    Daftar Anggota Keluarga
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5 leading-none">Total Terdaftar: {data.anggota.length} Jiwa</p>
                </div>
              </div>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={addMember}
                  className="px-8 py-4 bg-[#67d5ce] text-white rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#5bc4bd] transition-all shadow-lg shadow-[#67d5ce]/20 active:scale-95"
                >
                  <PlusCircle size={18} /> Tambah Anggota
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 md:gap-10">
              {data.anggota.map((ag, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={i}
                  className="p-6 md:p-10 bg-white rounded-[2.5rem] border border-slate-100 shadow-[0_8px_40px_rgba(0,0,0,0.03)] hover:shadow-[0_25px_60px_rgba(0,0,0,0.08)] transition-all relative group overflow-hidden border-2"
                >
                  <div className="absolute top-0 left-0 w-2.5 h-full bg-[#f9d89b]/40 group-hover:bg-[#67d5ce] transition-colors"></div>
                  
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => removeMember(i)}
                      className="absolute top-6 right-6 md:top-8 md:right-8 w-11 h-11 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all border border-rose-100 shadow-sm z-20 group-hover:scale-110 active:scale-90"
                    >
                      <Trash2 size={20} strokeWidth={2.5} />
                    </button>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8 relative z-10">
                    <div className="md:col-span-1 space-y-2.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Nama Lengkap
                      </label>
                      <input
                        value={ag.nama}
                        onChange={(e) => updateMember(i, "nama", e.target.value)}
                        disabled={isReadOnly}
                        required
                        className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-[#67d5ce] focus:bg-white transition-all font-bold text-slate-700 text-sm shadow-sm"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        NIK (16 Digit)
                      </label>
                      <input
                        value={ag.nik}
                        onChange={(e) => updateMember(i, "nik", e.target.value.replace(/\D/g, "").slice(0, 16))}
                        disabled={isReadOnly}
                        required
                        maxLength={16}
                        className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-[#67d5ce] focus:bg-white transition-all font-mono font-bold text-slate-700 text-sm shadow-sm"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Status Hubungan
                      </label>
                      <select
                        value={ag.hubungan}
                        onChange={(e) => updateMember(i, "hubungan", e.target.value)}
                        disabled={isReadOnly}
                        required
                        className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-[#67d5ce] focus:bg-white transition-all font-bold text-slate-700 text-sm appearance-none cursor-pointer shadow-sm"
                      >
                        <option value="">Pilih Hubungan</option>
                        <option value="Kepala Keluarga">Kepala Keluarga</option>
                        <option value="Istri">Istri</option>
                        <option value="Anak">Anak</option>
                        <option value="Lainnya">Lainnya</option>
                      </select>
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Jenis Kelamin
                      </label>
                      <select
                        value={ag.jk}
                        onChange={(e) => updateMember(i, "jk", e.target.value)}
                        disabled={isReadOnly}
                        required
                        className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-[#67d5ce] focus:bg-white transition-all font-bold text-slate-700 text-sm appearance-none cursor-pointer shadow-sm"
                      >
                        <option value="">Pilih JK</option>
                        <option value="Laki-laki">Laki-laki</option>
                        <option value="Perempuan">Perempuan</option>
                      </select>
                    </div>

                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Tempat Lahir
                      </label>
                      <input
                        value={ag.tempat_lahir}
                        onChange={(e) => updateMember(i, "tempat_lahir", e.target.value)}
                        disabled={isReadOnly}
                        required
                        className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-[#67d5ce] focus:bg-white transition-all font-bold text-slate-700 text-sm shadow-sm"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Tanggal Lahir
                      </label>
                      <input
                        type="date"
                        value={ag.tgl}
                        onChange={(e) => updateMember(i, "tgl", e.target.value)}
                        disabled={isReadOnly}
                        required
                        className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-[#67d5ce] focus:bg-white transition-all font-bold text-slate-700 text-sm shadow-sm"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Pendidikan Terakhir
                      </label>
                      <select
                        value={ag.pendidikan}
                        onChange={(e) => updateMember(i, "pendidikan", e.target.value)}
                        disabled={isReadOnly}
                        required
                        className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-[#67d5ce] focus:bg-white transition-all font-bold text-slate-700 text-sm shadow-sm"
                      >
                        <option value="">Pilih Pendidikan</option>
                        <option value="Tidak/Belum Sekolah">Tidak/Belum Sekolah</option>
                        <option value="SD / Sederajat">SD / Sederajat</option>
                        <option value="SMP / Sederajat">SMP / Sederajat</option>
                        <option value="SMA / Sederajat">SMA / Sederajat</option>
                        <option value="Diploma I / II">Diploma I / II</option>
                        <option value="Akademi / Diploma III">Akademi / Diploma III</option>
                        <option value="Diploma IV / Strata I">Diploma IV / Strata I</option>
                        <option value="Strata II">Strata II</option>
                        <option value="Strata III">Strata III</option>
                      </select>
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Pekerjaan Utama
                      </label>
                      <input
                        value={ag.pekerjaan}
                        onChange={(e) => updateMember(i, "pekerjaan", e.target.value)}
                        disabled={isReadOnly}
                        required
                        className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-[#67d5ce] focus:bg-white transition-all font-bold text-slate-700 text-sm shadow-sm"
                      />
                    </div>

                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Agama
                      </label>
                      <select
                        value={ag.agama}
                        onChange={(e) => updateMember(i, "agama", e.target.value)}
                        disabled={isReadOnly}
                        required
                        className="w-full px-5 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-[#67d5ce] focus:bg-white transition-all font-bold text-slate-700 text-sm shadow-sm"
                      >
                        <option value="">Pilih Agama</option>
                        <option value="Islam">Islam</option>
                        <option value="Kristen">Kristen</option>
                        <option value="Katolik">Katolik</option>
                        <option value="Hindu">Hindu</option>
                        <option value="Budha">Budha</option>
                        <option value="Khonghucu">Khonghucu</option>
                      </select>
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Status Bansos
                      </label>
                      <select
                        value={ag.bansos}
                        onChange={(e) => updateMember(i, "bansos", e.target.value)}
                        disabled={isReadOnly}
                        className="w-full px-5 py-3.5 bg-[#fdfaf5] border-2 border-[#f9d89b]/30 rounded-xl outline-none focus:border-[#67d5ce] transition-all font-black text-[#995500] text-sm shadow-sm"
                      >
                        <option value="">Tidak Menerima</option>
                        <option value="PKH">Penerima PKH</option>
                        <option value="BPNT">Penerima BPNT</option>
                        <option value="BLT">Penerima BLT</option>
                        <option value="BPJS">Penerima BPJS</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-6 md:p-10 bg-[#fdfaf5] border-t border-[#f9d89b]/40 flex items-center justify-between gap-4 shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#995500_2px,transparent_2px)] [background-size:12px_12px]"></div>
          <button
            type="button"
            onClick={onClose}
            className="px-8 py-4 bg-white border-2 border-[#f9d89b]/40 text-[#995500] rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-50 active:scale-95 transition-all relative z-10 shadow-sm"
          >
            Batalkan
          </button>
          {!isReadOnly && (
            <button
              onClick={handleSubmit}
              className="px-10 py-5 bg-[#67d5ce] text-white rounded-2xl font-black text-[12px] uppercase tracking-[0.1em] shadow-lg shadow-[#67d5ce]/30 hover:bg-[#5bc4bd] hover:shadow-xl transition-all active:scale-[0.98] relative z-10"
            >
              Simpan Data Berkas
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
});

const ARTICLES_DATA = [
  {
    title: "Aktivitas Jual Beli Ikan Segar di Pesisir Pantai Amaholu Losy",
    date: "14 Mei 2026",
    category: "Dokumentasi",
    image:
      "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?auto=format&fit=crop&q=80",
    desc: "Potret aktivitas jual beli ikan segar hasil tangkapan nelayan di pesisir pantai Dusun Amaholu Losy.",
    content:
      "Pesisir pantai Dusun Amaholu Losy menjadi salah satu pusat perputaran ekonomi warga. Setiap hari, aktivitas jual beli ikan segar hasil tangkapan para nelayan lokal selalu ramai memenuhi pesisir.\n\nPara nelayan yang baru saja bersandar langsung menawarkan hasil tangkapan laut mereka yang masih segar kepada warga maupun pengepul. Suasana tawar-menawar yang hangat dan interaksi akrab antar warga menjadi pemandangan indah yang merepresentasikan denyut nadi kehidupan di wilayah pesisir.\n\nKekayaan laut yang melimpah ini tidak hanya menjadi sumber makanan bagi warga, tetapi juga menjadi penopang kesejahteraan dan mata pencaharian masyarakat. Kelestarian laut pun selalu dijaga agar senantiasa memberikan berkah yang tak terputus bagi warga Dusun Amaholu Losy.",
    videoId: "QVWtQvqMHLk",
  },
  {
    title: "Keseruan Anak-Anak Bermain di Pantai Dusun Amaholu Losy",
    date: "14 Mei 2026",
    category: "Dokumentasi",
    image:
      "https://images.unsplash.com/photo-1512100356356-de1b84283e18?auto=format&fit=crop&q=80",
    desc: "Kegembiraan dan tawa ceria anak-anak saat bermain di pesisir pantai Dusun Amaholu Losy.",
    content:
      "Pesisir pantai Dusun Amaholu Losy tidak hanya menjadi pusat perputaran ekonomi, tetapi juga menjadi tempat bermain yang menyenangkan bagi anak-anak. Hamparan pasir putih dan deburan ombak menjadi saksi bisu keceriaan mereka setiap sore tiba.\n\nDalam video ini, terekam momen kegembiraan dan tawa lepas anak-anak yang sedang asyik bermain pasir dan berenang di laut. Kesederhanaan dalam bermain tanpa beban ini memancarkan kebahagiaan yang murni dari wajah-wajah polos mereka.\n\nMelihat keseruan ini mengingatkan kita akan keindahan masa kecil yang berharga. Kebersamaan mereka di alam terbuka menjadi salah satu pesona tersendiri dari kehidupan di pesisir Dusun Amaholu Losy yang damai.",
    videoId: "2simRC7OgjE",
  },
];

const ArticleModal = React.memo(function ArticleModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const [activeArticle, setActiveArticle] = useState<any>(null);

  return (
    <div className="fixed inset-0 z-50 bg-sky-50/70 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-5xl max-h-[95vh] bg-white rounded-2xl md:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-slate-100"
      >
        {/* Header */}
        <div className="bg-white rounded-3xl border border-sky-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] px-4 py-4 md:px-6 md:py-5 flex items-center justify-between border-b-4 border-purple-600 relative overflow-hidden shrink-0">
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
          <div className="flex items-center gap-3 md:gap-6 relative z-10">
            {activeArticle ? (
              <button
                onClick={() => setActiveArticle(null)}
                className="w-10 h-10 md:w-14 md:h-14 bg-white rounded-3xl border border-sky-100 shadow-sm hover:shadow-md transition-all md:rounded-2xl flex items-center justify-center text-sky-950 shrink-0"
              >
                <ChevronRight className="w-5 h-5 md:w-6 md:h-6 rotate-180" />
              </button>
            ) : (
              <div className="w-10 h-10 md:w-14 md:h-14 bg-white rounded-3xl border border-sky-100 hover:shadow-md transition-all md:rounded-2xl flex items-center justify-center text-purple-500 shadow-inner shrink-0">
                <span className="text-xl md:text-3xl">📰</span>
              </div>
            )}
            <div className="text-left">
              <h2 className="text-sky-950 text-lg md:text-2xl font-black tracking-tighter uppercase leading-tight mb-0.5 md:mb-1">
                {activeArticle ? "Detail Berita" : "Kegiatan Dusun"}
              </h2>
              <p className="text-sky-600 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em]">
                Portal Berita Desa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 md:w-10 md:h-10 bg-white border border-sky-100 shadow-sm hover:shadow-md transition-all text-sky-950 rounded-full flex items-center justify-center hover:rotate-90 shrink-0"
          >
            <X className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 scrollbar-none bg-white">
          {activeArticle ? (
            <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
              <div>
                <div className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-3 flex items-center gap-3">
                  <span className="bg-purple-500/20 px-3 py-1 rounded-full">
                    {activeArticle.category}
                  </span>
                  <span className="flex items-center gap-1.5 opacity-70">
                    <Calendar size={12} /> {activeArticle.date}
                  </span>
                </div>
                <h1 className="text-2xl md:text-4xl font-black text-sky-950 leading-tight mb-6">
                  {activeArticle.title}
                </h1>
              </div>

              {activeArticle.fbLink ? (
                <div className="w-full rounded-2xl md:rounded-[2rem] overflow-hidden border border-sky-100 shadow-2xl bg-white flex justify-center mb-6 py-4">
                  <iframe
                    src={`https://www.facebook.com/plugins/${activeArticle.fbLink.includes("/v/") || activeArticle.fbLink.includes("/video") ? "video.php" : "post.php"}?href=${encodeURIComponent(activeArticle.fbLink)}&show_text=false&width=500`}
                    width="500"
                    height="600"
                    style={{ border: "none", overflow: "hidden" }}
                    scrolling="no"
                    frameBorder="0"
                    allowFullScreen={true}
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                  ></iframe>
                </div>
              ) : activeArticle.videoId ? (
                <div className="aspect-video w-full rounded-2xl md:rounded-[2rem] overflow-hidden border border-sky-100 bg-slate-900 relative shadow-blue-900/20">
                  <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${activeArticle.videoId}?autoplay=1&mute=0`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                    className="absolute inset-0 object-cover"
                  ></iframe>
                </div>
              ) : (
                <div className="aspect-video w-full rounded-2xl md:rounded-[2rem] overflow-hidden border border-sky-100 relative shadow-purple-900/20">
                  <img
                    src={activeArticle.image}
                    alt={activeArticle.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="prose prose-invert prose-slate prose-lg md:prose-xl max-w-none pb-6">
                {activeArticle.content
                  .split("\n\n")
                  .map((paragraph: string, idx: number) => (
                    <p
                      key={idx}
                      className="text-sky-600 leading-relaxed tracking-wide text-sm md:text-base"
                    >
                      {paragraph}
                    </p>
                  ))}
                {activeArticle.fbLink && (
                  <div className="pt-4">
                    <a
                      href={activeArticle.fbLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-3 bg-[#1877F2] hover:bg-blue-600 text-white font-bold rounded-xl transition-all shadow-md text-sm"
                    >
                      Buka di Aplikasi Facebook <ChevronRight size={16} />
                    </a>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {ARTICLES_DATA.map((article, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveArticle(article)}
                  className="text-left bg-white rounded-3xl border border-sky-100 md:rounded-[2rem] overflow-hidden group hover:border-purple-500/30 transition-all flex flex-col shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  <div className="h-40 md:h-56 overflow-hidden relative w-full">
                    <div className="absolute top-4 left-4 z-10 bg-purple-600 text-sky-950 text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em] text-blue-700 px-3 py-1.5 rounded-full shadow-lg">
                      {article.category}
                    </div>
                    <img
                      src={article.image}
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-blue-900/80 via-blue-900/40 to-transparent z-0"></div>
                  </div>
                  <div className="p-5 md:p-6 flex-1 flex flex-col relative z-20 -mt-8 md:-mt-10 w-full">
                    <div className="text-[10px] font-black text-sky-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Calendar size={12} /> {article.date}
                    </div>
                    <h3 className="text-sm md:text-lg font-black text-sky-950 leading-tight mb-3 line-clamp-2 drop-shadow-md group-hover:text-purple-300 transition-colors">
                      {article.title}
                    </h3>
                    <p className="text-xs text-sky-600/80 leading-relaxed mb-4 flex-1 line-clamp-3 md:line-clamp-none">
                      {article.desc}
                    </p>
                    <div className="text-left text-[10px] font-bold uppercase tracking-[0.2em] text-blue-700 text-purple-400 group-hover:text-purple-300 transition-colors flex items-center gap-2">
                      Baca Selengkapnya <ChevronRight size={14} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
});

const StatsModal = React.memo(function StatsModal({
  db,
  onClose,
}: {
  db: Family[];
  onClose: () => void;
}) {
  const stats = useMemo(() => {
    let totalJiwa = 0,
      l = 0,
      p = 0,
      bansos = 0,
      balita = 0,
      lansia = 0;
    const distribusiAlamat: Record<string, number> = {};
    const distribusiPendidikan: Record<string, number> = {};

    db.forEach((f) => {
      totalJiwa += f.anggota.length;
      distribusiAlamat[f.alamat] = (distribusiAlamat[f.alamat] || 0) + 1;
      f.anggota.forEach((a) => {
        if (a.jk === "Laki-laki") l++;
        if (a.jk === "Perempuan") p++;
        if (a.bansos) bansos++;
        if (a.pendidikan) {
          distribusiPendidikan[a.pendidikan] =
            (distribusiPendidikan[a.pendidikan] || 0) + 1;
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
      distribusiPendidikan,
    };
  }, [db]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 no-print">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl md:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-slate-100"
      >
        <div className="bg-white rounded-3xl border border-sky-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] px-4 py-4 md:px-6 md:py-5 flex items-center justify-between border-b-4 relative overflow-hidden shrink-0">
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
          <div className="flex items-center gap-3 md:gap-6 relative z-10">
            <div className="w-10 h-10 md:w-14 md:h-14 bg-white rounded-3xl border border-sky-100 hover:shadow-md transition-all md:rounded-2xl flex items-center justify-center text-blue-500 shadow-inner shrink-0">
              <BarChart3 className="w-6 h-6 md:w-8 md:h-8" />
            </div>
            <div className="text-left">
              <h3 className="text-sky-950 text-lg md:text-2xl font-black tracking-tighter uppercase leading-tight">
                Statistik
              </h3>
              <p className="text-sky-600 text-[8px] md:text-[10px] font-black uppercase tracking-[0.1em] md:tracking-[0.3em] mt-1 flex items-center gap-1.5 md:gap-2">
                <Shield size={10} className="shrink-0" /> <span className="truncate">Dasbor Ringkasan Eksekutif</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 md:w-10 md:h-10 bg-white border border-sky-100 shadow-sm hover:shadow-md transition-all text-sky-950 rounded-full flex items-center justify-center hover:rotate-90 shrink-0"
          >
            <X className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-10 scrollbar-none bg-white">
          {/* Executive Overview - Image Match */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
            {[
              {
                label: "Penduduk",
                value: stats.totalResidents,
                icon: Users,
                color: "text-blue-500",
                bg: "bg-blue-500/10",
              },
              {
                label: "Keluarga",
                value: stats.totalFamilies,
                icon: Shield,
                color: "text-emerald-500",
                bg: "bg-emerald-500/10",
              },
              {
                label: "Pria",
                value: stats.genderMale,
                icon: UserIcon,
                color: "text-amber-500",
                bg: "bg-blue-100 text-blue-700/10",
              },
              {
                label: "Wanita",
                value: stats.genderFemale,
                icon: UserIcon,
                color: "text-rose-500",
                bg: "bg-rose-500/10",
              },
              {
                label: "Lansia",
                value: stats.elders,
                icon: UserIcon,
                color: "text-purple-500",
                bg: "bg-purple-500/10",
              },
              {
                label: "Balita",
                value: stats.children,
                icon: Baby,
                color: "text-teal-500",
                bg: "bg-teal-500/10",
              },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="p-4 md:p-6 rounded-3xl bg-white border border-sky-100 flex flex-col items-start shadow-sm hover:border-blue-500/30 transition-colors"
              >
                <div className={`mb-3 md:mb-4 text-2xl`}>
                  <item.icon size={24} className="text-blue-500 opacity-80" />
                </div>
                <p className="text-[10px] font-black text-sky-600 uppercase tracking-widest mb-1.5 leading-none">
                  {item.label}
                </p>
                <h4 className="text-2xl md:text-3xl font-black text-sky-950 tracking-tighter flex items-center gap-1.5">
                  {item.value}
                  <span className="text-[10px] font-black text-sky-600 uppercase tracking-widest mt-1 md:mt-2">
                    Jiwa
                  </span>
                </h4>
              </motion.div>
            ))}
          </div>

          <div className="h-px bg-white rounded-3xl border border-sky-100 shadow-sm hover:shadow-md transition-all w-full"></div>

          {/* Gender Indicator - Image Match style */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
              <h4 className="text-[12px] font-black text-sky-950 uppercase tracking-tight">
                Komp. Gender
              </h4>
            </div>

            <div className="space-y-8 px-2 md:px-6">
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black text-sky-600 uppercase tracking-[0.2em]">
                    Pria
                  </span>
                  <span className="text-xs font-black text-sky-950">
                    {stats.genderMale} Jiwa
                  </span>
                </div>
                <div className="h-2.5 bg-white border border-sky-100 shadow-sm hover:shadow-md transition-all rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(stats.genderMale / (stats.totalResidents || 1)) * 100}%`,
                    }}
                    className="h-full bg-blue-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black text-sky-600 uppercase tracking-[0.2em]">
                    Wanita
                  </span>
                  <span className="text-xs font-black text-sky-950">
                    {stats.genderFemale} Jiwa
                  </span>
                </div>
                <div className="h-2.5 bg-white border border-sky-100 shadow-sm hover:shadow-md transition-all rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(stats.genderFemale / (stats.totalResidents || 1)) * 100}%`,
                    }}
                    className="h-full bg-rose-500 rounded-full shadow-[0_0_20px_rgba(244,63,94,0.5)]"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-white rounded-3xl border border-sky-100 shadow-sm hover:shadow-md transition-all w-full"></div>

          {/* Education Stats */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
              <h4 className="text-[12px] font-black text-sky-950 uppercase tracking-tight">
                SDM & Pendidikan
              </h4>
            </div>

            <div className="grid grid-cols-1 gap-3 px-2 md:px-6">
              {Object.entries(stats.distribusiPendidikan)
                .sort((a, b) => (b[1] as number) - (a[1] as number))
                .map(([level, count], idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 bg-white rounded-3xl border border-sky-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-blue-500/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white rounded-3xl border border-sky-100 shadow-sm hover:shadow-md transition-all flex items-center justify-center text-blue-500 font-bold text-xs">
                        {idx + 1}
                      </div>
                      <span className="text-[10px] font-black text-sky-600 uppercase tracking-wider">
                        {level}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-sky-950">
                        {count}
                      </span>
                      <span className="text-[8px] font-bold text-sky-600 uppercase">
                        Jiwa
                      </span>
                    </div>
                  </div>
                ))}
              {Object.keys(stats.distribusiPendidikan).length === 0 && (
                <p className="text-center text-[10px] font-bold text-sky-600 uppercase py-4">
                  Belum ada data kependidikan terdaftar
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-sky-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 text-center border-t-4 border-amber-500/20 relative overflow-hidden shrink-0">
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
          <p className="text-blue-400 text-[8px] font-black uppercase tracking-[0.4em] leading-relaxed relative z-10 max-w-xs mx-auto">
            Data terhitung secara real-time berdasarkan pembaruan data
            kependudukan terbaru.
          </p>
        </div>
      </motion.div>
    </div>
  );
});

const LetterModal = React.memo(function LetterModal({
  type,
  db,
  session,
  onClose,
  onPreview,
}: {
  type: LetterType;
  db: Family[];
  session: AuthSession;
  onClose: () => void;
  onPreview: (d: any) => void;
}) {
  const [targetName, setTargetName] = useState("");
  const [nomorSurat, setNomorSurat] = useState(generateNomorSurat());
  const [usaha, setUsaha] = useState("");

  const residentOptions = useMemo(() => {
    let source = db;
    if (session.role === "warga")
      source = db.filter((f) => f.no_kk === session.no_kk);
    return source.flatMap((f) => f.anggota.map((a) => ({ ...a, family: f })));
  }, [db, session]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const resident = residentOptions.find(
      (r) => r.nama.trim() === targetName.trim(),
    );
    if (!resident)
      return alert(
        "Kesalahan: Silakan pilih nama warga yang valid dari daftar yang tersedia.",
      );

    onPreview({
      type,
      nomor: nomorSurat.trim(),
      resident,
      usaha: usaha.trim(),
      date: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-sky-50/70 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-5xl max-h-[95vh] bg-white rounded-2xl md:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-slate-100"
      >
        {/* Header */}
        <div className="bg-white rounded-3xl border border-sky-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] px-4 py-4 md:px-6 md:py-5 flex items-center justify-between border-b-4 relative overflow-hidden shrink-0">
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
          <div className="flex items-center gap-3 md:gap-6 relative z-10">
            <div className="w-10 h-10 md:w-14 md:h-14 bg-white rounded-3xl border border-sky-100 hover:shadow-md transition-all md:rounded-2xl flex items-center justify-center text-blue-500 shadow-inner shrink-0">
              <FileText className="w-6 h-6 md:w-8 md:h-8" />
            </div>
            <div className="text-left">
              <h2 className="text-sky-950 text-lg md:text-2xl font-black tracking-tighter uppercase leading-tight mb-0.5 md:mb-1">
                Drafting Surat
              </h2>
              <p className="text-sky-600 text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em]">
                Administrasi Digital
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 md:w-10 md:h-10 bg-white border border-sky-100 shadow-sm hover:shadow-md transition-all text-sky-950 rounded-full flex items-center justify-center hover:rotate-90 shrink-0"
          >
            <X className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-white">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none">
              Generate {type}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-sky-600 uppercase tracking-[0.2em] ml-1">
                Pilih Target Warga
              </label>
              <div className="relative group">
                <UserIcon
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-sky-600 group-focus-within:text-blue-500 transition-colors"
                  size={18}
                />
                <input
                  list="wargaList"
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-white rounded-3xl border border-sky-100 border-2 outline-none focus:border-blue-500 focus:bg-white focus:shadow-md font-black text-sky-950 text-sm transition-all shadow-sm placeholder:text-sky-600"
                  placeholder="Mulai ketik nama..."
                  required
                />
                <datalist id="wargaList">
                  {residentOptions.map((r, i) => (
                    <option key={i} value={r.nama} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-sky-600 uppercase tracking-[0.2em] ml-1">
                Identifikasi Berkas
              </label>
              <div className="relative group">
                <FileText
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-sky-600 group-focus-within:text-blue-500 transition-colors"
                  size={18}
                />
                <input
                  value={nomorSurat}
                  onChange={(e) => setNomorSurat(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-white rounded-3xl border border-sky-100 border-2 outline-none focus:border-blue-500 focus:bg-white focus:shadow-md font-bold text-sky-950 text-sm transition-all shadow-sm"
                />
              </div>
            </div>

            {type === "Surat Keterangan Usaha" && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-sky-600 uppercase tracking-[0.2em] ml-1">
                  Objek Usaha / Niaga
                </label>
                <div className="relative group">
                  <Shield
                    className="absolute left-5 top-1/2 -translate-y-1/2 text-sky-600 group-focus-within:text-blue-500 transition-colors"
                    size={18}
                  />
                  <input
                    value={usaha}
                    onChange={(e) => setUsaha(e.target.value)}
                    placeholder="e.g. Toko Kelontong, UMKM"
                    className="w-full pl-12 pr-6 py-4 bg-white rounded-3xl border border-sky-100 border-2 outline-none focus:border-blue-500 focus:bg-white focus:shadow-md font-black text-sky-950 text-sm transition-all shadow-sm placeholder:text-sky-600"
                    required
                  />
                </div>
              </div>
            )}

            <div className="pt-4 max-w-sm ml-auto">
              <button
                type="submit"
                className="w-full py-4 md:py-5 bg-blue-600 text-white font-black uppercase tracking-[0.3em] rounded-2xl shadow-blue-600/20 hover:scale-[1.02] active:scale-95 transition-all duration-300 flex items-center justify-center gap-3 text-xs"
              >
                <Printer size={20} /> Cetak & Pratinjau
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="bg-white rounded-3xl border border-sky-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 text-center border-t-4 border-amber-500/20 relative overflow-hidden shrink-0">
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
          <p className="text-blue-400 text-[8px] font-black uppercase tracking-[0.4em] leading-relaxed relative z-10 max-w-xs mx-auto">
            Data terhitung secara real-time berdasarkan basis data kependudukan
            terbaru.
          </p>
        </div>
      </motion.div>
    </div>
  );
});

const PreviewModal = React.memo(function PreviewModal({
  data,
  onClose,
}: {
  data: any;
  onClose: () => void;
}) {
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
    window.addEventListener("resize", autoScale);
    return () => window.removeEventListener("resize", autoScale);
  }, []);

  const downloadPdf = () => {
    if (!printAreaRef.current) return;
    setIsDownloading(true);

    const element = printAreaRef.current;
    const opt = {
      margin: 0,
      filename: `${data.type}-${data.resident.nama}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: {
        unit: "mm" as const,
        format: "a4" as const,
        orientation: "portrait" as const,
      },
    };

    html2pdf()
      .from(element)
      .set(opt)
      .save()
      .then(() => {
        setIsDownloading(false);
      })
      .catch((err: any) => {
        console.error(err);
        setIsDownloading(false);
        alert("Gagal mengunduh PDF.");
      });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-sky-50 flex flex-col overflow-hidden">
      {/* Header - Compact on Mobile */}
      <div className="no-print bg-white border-b border-sky-200 shadow-sm p-3 sm:p-5 flex items-center justify-between gap-4 z-50">
        <div className="flex items-center gap-3 text-sky-950 overflow-hidden">
          <div className="w-8 h-8 sm:w-12 sm:h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shrink-0">
            <FileText className="text-sky-950" size={18} />
          </div>
          <div className="overflow-hidden">
            <p className="font-black text-xs sm:text-base uppercase tracking-widest leading-none mb-0.5 sm:mb-1">
              Pratinjau
            </p>
            <p className="text-[9px] sm:text-xs opacity-60 font-bold uppercase truncate">
              {data.type}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Controls for Mobile */}
          <div className="hidden sm:flex items-center bg-white rounded-3xl border border-sky-100 shadow-sm hover:shadow-md transition-all p-1 mr-2">
            <button
              onClick={() => setZoom((prev) => Math.max(0.5, prev - 0.1))}
              className="p-2 hover:bg-white border border-sky-100 shadow-sm hover:shadow-md transition-all rounded-lg text-sky-950 transition-colors"
            >
              <ChevronDown size={16} />
            </button>
            <span className="px-2 text-[10px] font-black text-sky-950 w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((prev) => Math.min(2, prev + 0.1))}
              className="p-2 hover:bg-white border border-sky-100 shadow-sm hover:shadow-md transition-all rounded-lg text-sky-950 transition-colors"
            >
              <ChevronRight className="-rotate-90" size={16} />
            </button>
          </div>

          <button
            onClick={downloadPdf}
            disabled={isDownloading}
            className="px-4 sm:px-8 py-2 sm:py-4 bg-blue-600 text-white font-black rounded-xl sm:rounded-2xl hover:bg-blue-500 flex items-center justify-center gap-2 shadow-blue-600/20 active:scale-95 transition-all text-[10px] sm:text-sm disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Download size={14} />
            )}
            <span className="hidden xs:inline">
              {isDownloading ? "Memproses..." : "Unduh PDF"}
            </span>
            <span className="xs:hidden">{isDownloading ? "..." : "PDF"}</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 sm:p-4 bg-white rounded-3xl border border-sky-100 shadow-sm hover:shadow-md transition-all text-sky-950 sm:rounded-2xl hover:bg-white/20 active:scale-95"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Document Area - Centered and Scalable */}
      <div className="flex-1 overflow-auto p-4 sm:p-10 flex justify-center items-start scrollbar-hide bg-white rounded-3xl border border-sky-100 shadow-sm">
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
            transition: "transform 0.2s ease-out",
          }}
          className="shadow-2xl mb-20 origin-top"
        >
          <div
            ref={printAreaRef}
            className="bg-white p-8 sm:p-20 text-black print:shadow-none print:m-0 print:w-full print:p-[15mm] text-[12pt] print-area relative"
            style={{
              width: "210mm",
              minHeight: "297mm",
              fontFamily: '"Times New Roman", Times, serif',
            }}
          >
            <div className="flex items-start gap-4 pb-4 mb-4 border-b-4 border-black">
              <div className="w-24 h-24 flex items-center justify-center overflow-hidden shrink-0">
                <img
                  src="https://iili.io/BbSYeoB.png"
                  className="w-full object-contain"
                  alt="Logo"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex-1 text-center font-bold">
                <p className="text-[12pt] leading-tight mb-1">
                  PEMERINTAH KABUPATEN SERAM BAGIAN BARAT
                </p>
                <p className="text-[12pt] leading-tight mb-1">
                  KECAMATAN HUAMUAL
                </p>
                <p className="text-[12pt] leading-tight mb-1">NEGERI LUHU</p>
                <p className="text-[12pt] leading-none mt-2">
                  DUSUN AMAHOLU LOSY
                </p>
              </div>
            </div>

            <div className="text-center mt-8 mb-10 leading-none space-y-1">
              <h3 className="text-[12pt] font-bold uppercase underline inline-block">
                {data.type}
              </h3>
              <p className="text-[12pt]">Nomor : {data.nomor}</p>
            </div>

            <div className="text-[12pt] leading-relaxed text-justify space-y-6">
              <p>
                Yang bertanda tangan di bawah ini Kepala Dusun Amaholu Losy,
                Kecamatan Huamual, Kabupaten Seram Bagian Barat, dengan ini
                menerangkan bahwa :
              </p>

              <table className="w-full border-collapse">
                <tbody>
                  <tr>
                    <td className="w-56 py-1 align-top">Nama Lengkap</td>
                    <td className="w-4 align-top">:</td>
                    <td className="font-bold py-1 uppercase">
                      {data.resident.nama}
                    </td>
                  </tr>
                  <tr>
                    <td className="w-56 py-1 align-top">NIK</td>
                    <td className="align-top">:</td>
                    <td className="py-1">{data.resident.nik}</td>
                  </tr>
                  <tr>
                    <td className="w-56 py-1 align-top">Tempat, Tgl Lahir</td>
                    <td className="align-top">:</td>
                    <td className="py-1">
                      {data.resident.tempat_lahir},{" "}
                      {formatTanggalIndonesia(data.resident.tgl)}
                    </td>
                  </tr>
                  <tr>
                    <td className="w-56 py-1 align-top">Alamat</td>
                    <td className="align-top">:</td>
                    <td className="py-1 leading-snug">
                      Dusun {data.resident.family.alamat}, RT/RW{" "}
                      {data.resident.family.rt_rw}, Desa{" "}
                      {data.resident.family.Desa}, Kec.{" "}
                      {data.resident.family.Kecamatan}, Kab.{" "}
                      {data.resident.family.Kabupaten}, Prov.{" "}
                      {data.resident.family.Provinsi}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="pt-4">
                {data.type === "Surat Keterangan Usaha" && (
                  <p>
                    Adalah benar yang bersangkutan adalah warga masyarakat Dusun
                    Amaholu Losy yang memiliki usaha aktif berupa{" "}
                    <b>{data.usaha}</b>.
                  </p>
                )}

                {data.type === "Surat Keterangan Domisili" && (
                  <p>
                    Adalah benar yang bersangkutan adalah warga masyarakat yang
                    berdomisili menetap di Dusun Amaholu Losy.
                  </p>
                )}

                {data.type === "Surat Keterangan Tidak Mampu" && (
                  <p>
                    Adalah benar yang bersangkutan merupakan warga masyarakat
                    Dusun Amaholu Losy yang tergolong dalam keluarga ekonomi
                    kurang mampu / rentan miskin.
                  </p>
                )}

                {data.type === "Surat Keterangan Kematian" && (
                  <p>
                    Adalah benar almarhum/almarhumah tercatat sebagai warga
                    masyarakat Dusun Amaholu Losy yang telah dinyatakan
                    meninggal dunia.
                  </p>
                )}

                {data.type === "Surat Keterangan Pendidikan" && (
                  <p>
                    Adalah benar yang bersangkutan adalah warga masyarakat Dusun
                    Amaholu Losy yang saat ini sedang menempuh pendidikan dengan
                    jenjang <b>{data.resident.pendidikan}</b>. Surat ini
                    diberikan untuk keperluan administrasi pendidikan yang
                    bersangkutan.
                  </p>
                )}

                <p className="mt-4">
                  Demikian surat keterangan ini kami berikan kepada yang
                  bersangkutan untuk dapat dipergunakan sebagaimana mestinya.
                </p>
              </div>
            </div>

            <div className="mt-16 ml-auto w-80 text-center text-[12pt]">
              <p>
                Amaholu Losy, {formatTanggalIndonesia(new Date().toISOString())}
              </p>
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
});

const PrintKKModal = React.memo(function PrintKKModal({
  family,
  onClose,
}: {
  family: Family;
  onClose: () => void;
}) {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const autoScale = () => {
      if (window.innerWidth < 1024) {
        // KK is landscape (297mm), needs more scale
        const padding = 20;
        const availableWidth = window.innerWidth - padding;
        const docWidth = 1122; // approx 297mm
        setZoom(Math.min(availableWidth / docWidth, 1));
      } else {
        setZoom(1);
      }
    };
    autoScale();
    window.addEventListener("resize", autoScale);
    return () => window.removeEventListener("resize", autoScale);
  }, []);

  const downloadPdf = () => {
    if (!printAreaRef.current) return;
    setIsDownloading(true);

    const element = printAreaRef.current;
    const opt = {
      margin: 0,
      filename: `Kartu-Keluarga-${family.no_kk}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: {
        unit: "mm" as const,
        format: "a4" as const,
        orientation: "landscape" as const,
      },
    };

    html2pdf()
      .from(element)
      .set(opt)
      .save()
      .then(() => {
        setIsDownloading(false);
      })
      .catch((err: any) => {
        console.error(err);
        setIsDownloading(false);
        alert("Gagal mengunduh PDF.");
      });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-sky-50 flex flex-col overflow-hidden">
      {/* Header - Compact on Mobile */}
      <div className="no-print bg-white border-b border-sky-200 shadow-sm p-3 sm:p-5 flex items-center justify-between gap-4 z-50">
        <div className="flex items-center gap-3 text-sky-950 overflow-hidden">
          <div className="w-8 h-8 sm:w-12 sm:h-12 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shrink-0">
            <Printer className="text-sky-950" size={18} />
          </div>
          <div className="overflow-hidden">
            <p className="font-black text-xs sm:text-base uppercase tracking-widest leading-none mb-0.5 sm:mb-1">
              Kartu Keluarga
            </p>
            <p className="text-[9px] sm:text-xs opacity-60 font-bold uppercase truncate">
              KK: {family.no_kk}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="hidden md:flex items-center bg-white rounded-3xl border border-sky-100 shadow-sm hover:shadow-md transition-all p-1 mr-2">
            <button
              onClick={() => setZoom((prev) => Math.max(0.3, prev - 0.1))}
              className="p-2 hover:bg-white border border-sky-100 shadow-sm hover:shadow-md transition-all rounded-lg text-sky-950 transition-colors"
            >
              <ChevronDown size={16} />
            </button>
            <span className="px-2 text-[10px] font-black text-sky-950 w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((prev) => Math.min(2, prev + 0.1))}
              className="p-2 hover:bg-white border border-sky-100 shadow-sm hover:shadow-md transition-all rounded-lg text-sky-950 transition-colors"
            >
              <ChevronRight className="-rotate-90" size={16} />
            </button>
          </div>

          <button
            onClick={downloadPdf}
            disabled={isDownloading}
            className="px-4 sm:px-8 py-2 sm:py-4 bg-emerald-600 text-white font-black rounded-xl sm:rounded-2xl hover:bg-emerald-500 flex items-center justify-center gap-2 shadow-emerald-600/20 active:scale-95 transition-all text-[10px] sm:text-sm disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Download size={14} />
            )}
            <span className="hidden xs:inline">
              {isDownloading ? "Memproses..." : "Unduh KK PDF"}
            </span>
            <span className="xs:hidden">{isDownloading ? "..." : "PDF"}</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 sm:p-4 bg-white rounded-3xl border border-sky-100 shadow-sm hover:shadow-md transition-all text-sky-950 sm:rounded-2xl hover:bg-white/20 active:scale-95"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Document Area */}
      <div className="flex-1 overflow-auto p-4 sm:p-10 flex justify-center items-start scrollbar-hide bg-white rounded-3xl border border-sky-100 shadow-sm">
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
            transition: "transform 0.2s ease-out",
          }}
          className="shadow-2xl mb-20 origin-top"
        >
          <div
            ref={printAreaRef}
            className="bg-white p-12 text-black print:shadow-none print:m-0 print:w-full print:p-8 print-area relative"
            style={{
              width: "297mm",
              minHeight: "210mm",
              fontFamily: '"Times New Roman", serif',
            }}
          >
            <div className="absolute top-12 left-12 w-24 h-24 flex items-center justify-center overflow-hidden">
              <img
                src="https://iili.io/BbSYeoB.png"
                className="w-full object-contain"
                alt="Logo KK"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold uppercase tracking-widest">
                KARTU KELUARGA
              </h2>
              <p className="text-xl font-bold mt-1">No. {family.no_kk}</p>
            </div>

            <div className="grid grid-cols-2 gap-12 text-sm font-bold mb-8">
              <div className="space-y-1">
                <div className="flex">
                  <span className="w-32 uppercase">Nama Kepala Keluarga</span>
                  <span>
                    :{" "}
                    {family.anggota.find(
                      (a) => a.hubungan === "Kepala Keluarga",
                    )?.nama || "-"}
                  </span>
                </div>
                <div className="flex">
                  <span className="w-32 uppercase">Alamat</span>
                  <span>: {family.alamat}</span>
                </div>
                <div className="flex">
                  <span className="w-32 uppercase">RT/RW</span>
                  <span>: {family.rt_rw}</span>
                </div>
                <div className="flex">
                  <span className="w-32 uppercase">Desa/Kelurahan</span>
                  <span>: {family.Desa}</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex">
                  <span className="w-32 uppercase">Kecamatan</span>
                  <span>: {family.Kecamatan}</span>
                </div>
                <div className="flex">
                  <span className="w-32 uppercase">Kabupaten/Kota</span>
                  <span>: {family.Kabupaten}</span>
                </div>
                <div className="flex">
                  <span className="w-32 uppercase">Kode Pos</span>
                  <span>: -</span>
                </div>
                <div className="flex">
                  <span className="w-32 uppercase">Provinsi</span>
                  <span>: {family.Provinsi}</span>
                </div>
              </div>
            </div>

            <table className="w-full border-collapse border-2 border-black text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border-2 border-black p-1 text-center font-bold">
                    No
                  </th>
                  <th className="border-2 border-black p-1 text-center font-bold">
                    Nama Lengkap
                  </th>
                  <th className="border-2 border-black p-1 text-center font-bold">
                    NIK
                  </th>
                  <th className="border-2 border-black p-1 text-center font-bold">
                    Jenis Kelamin
                  </th>
                  <th className="border-2 border-black p-1 text-center font-bold">
                    Tempat Lahir
                  </th>
                  <th className="border-2 border-black p-1 text-center font-bold">
                    Tanggal Lahir
                  </th>
                  <th className="border-2 border-black p-1 text-center font-bold">
                    Agama
                  </th>
                  <th className="border-2 border-black p-1 text-center font-bold">
                    Pendidikan
                  </th>
                  <th className="border-2 border-black p-1 text-center font-bold">
                    Jenis Pekerjaan
                  </th>
                </tr>
              </thead>
              <tbody>
                {family.anggota.map((a, i) => (
                  <tr key={i}>
                    <td className="border-2 border-black p-1 text-center">
                      {i + 1}
                    </td>
                    <td className="border-2 border-black p-1 font-bold">
                      {a.nama}
                    </td>
                    <td className="border-2 border-black p-1 text-center">
                      {a.nik}
                    </td>
                    <td className="border-2 border-black p-1 text-center">
                      {a.jk}
                    </td>
                    <td className="border-2 border-black p-1 text-center">
                      {a.tempat_lahir}
                    </td>
                    <td className="border-2 border-black p-1 text-center">
                      {formatTanggalIndonesia(a.tgl)}
                    </td>
                    <td className="border-2 border-black p-1 text-center">
                      {a.agama}
                    </td>
                    <td className="border-2 border-black p-1 text-center">
                      {a.pendidikan}
                    </td>
                    <td className="border-2 border-black p-1 text-center">
                      {a.pekerjaan}
                    </td>
                  </tr>
                ))}
                {Array.from({
                  length: Math.max(0, 10 - family.anggota.length),
                }).map((_, i) => (
                  <tr key={`empty-${i}`}>
                    <td className="border-2 border-black p-1 text-center">
                      {family.anggota.length + i + 1}
                    </td>
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
                <p className="font-bold underline uppercase">
                  {family.anggota.find((a) => a.hubungan === "Kepala Keluarga")
                    ?.nama || "-"}
                </p>
              </div>
              <div className="text-center">
                <p>DIKELUARKAN DI : Amaholu Losy</p>
                <p>
                  PADA TANGGAL :{" "}
                  {formatTanggalIndonesia(new Date().toISOString())}
                </p>
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
});
