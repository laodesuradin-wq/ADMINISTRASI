import { config } from "dotenv";
config();
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for chat using FAQ database and Gemini
  app.post("/api/chat", async (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    try {
      const { messages } = req.body;
      const lastMessage = messages[messages.length - 1]?.content.toLowerCase() || "";

      let faqData: any[] = [];
      // 1. Try local FAQ database first
      const faqPath = path.join(process.cwd(), 'src', 'faq.json');
      if (fs.existsSync(faqPath)) {
        faqData = JSON.parse(fs.readFileSync(faqPath, 'utf8'));
        
        // Find best match
        let bestMatch = null;
        let maxMatches = 0;
        
        for (const item of faqData) {
          const matches = item.keywords.filter((kw: string) => {
            const regex = new RegExp(`\\b${kw.toLowerCase()}\\b`, 'i');
            return regex.test(lastMessage);
          }).length;
          if (matches > maxMatches) {
            maxMatches = matches;
            bestMatch = item.answer;
          }
        }
        
        if (bestMatch && maxMatches > 0) {
          // Stream the FAQ answer
          res.write(bestMatch);
          res.end();
          return;
        }
      }

      const getRecommendations = () => {
        if (!faqData || faqData.length === 0) return "";
        const recommendList = faqData
          .filter(item => !["halo", "terima kasih", "operator", "lokasi", "kepala dusun"].includes(item.keywords[0]))
          .map(item => `- ${item.keywords[0].toUpperCase()}`)
          .slice(0, 4)
          .join("\n");
        return `\n\nBeberapa layanan yang bisa beta bantu jelaskan antara lain:\n${recommendList}`;
      };

      // 2. Fallback to Gemini AI if API Key exists
      const apiKey = process.env.GEMINI_API_KEY?.trim() || '';
      if (!apiKey) {
        // No AI Key, no FAQ match
        res.write(`Maaf, pertanyaan Bapak/Ibu belum ada di basis data kami, dan saat ini layanan Artificial Intelligence sedang offline karena Kunci API belum diatur. ${getRecommendations()}\n\nSilakan hubungi Bapak Kepala Dusun.`);
        res.end();
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const formattedContents = messages.map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
      
      const faqString = faqData.map((f:any) => `Topik: ${f.keywords.join(", ")}\nInfo: ${f.answer}`).join("\n\n");

      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-1.5-flash',
        contents: formattedContents,
        config: {
            systemInstruction: `Anda adalah asisten AI resmi bernama 'Sandra' (Asisten SIAK MOBILE) untuk Dusun Amaholu Losy, Negeri Luhu, Kecamatan Huamual, Kabupaten Seram Bagian Barat, Maluku. Dusun ini dipimpin oleh Kepala Dusun Fauji Ali. 

Berikut adalah Basis Data (FAQ) yang harus Anda jadikan acuan untuk menjawab dan memberikan rekomendasi layanan kepada warga:
${faqString}
            
Tugas utama Anda:
- Menjawab pertanyaan dari warga terkait kepengurusan administrasi berdasarkan Basis Data FAQ di atas.
- Jika pengguna bertanya sesuatu yang tidak jelas atau topiknya tidak ada, berikan rekomendasi daftar layanan dari Basis Data kepada warga agar mereka tahu apa yang bisa ditanyakan.
- Menjelaskan rute untuk pengguna: Jika warga meminta pelayanan digital surat, arahkan mereka ke "Administrasi -> Digital Surat" atau untuk membuat Kartu Keluarga arahkan ke bagian form penambahan anggota keluarga.

Sikap dan Nada:
- Gunakan bahasa yang santun khas masyarakat Maluku yang ramah.
- Pastikan warga merasa terbantu dan dihargai.
- Gunakan kata ganti "beta" untuk menyebut diri sendiri (Sandra) dan sapa penelepon dengan "Bapak/Ibu" atau sapaan yang sesuai.

Keamanan:
- Jangan meminta data sensitif seperti NIK atau Nomor KK secara langsung dalam chat.

Kontak Penting:
Bapak Kepala Dusun.`
        }
      });

      for await (const chunk of responseStream) {
        if (chunk.text) {
          res.write(chunk.text);
        }
      }
      res.end();
    } catch (error: any) {
      const errorString = error?.message || String(error) || "";
      const isApiKeyError = errorString.includes("API key not valid") || errorString.includes("API_KEY") || errorString.includes("API_KEY_INVALID");
      
      if (!isApiKeyError) {
        console.error("AI Error:", error);
      }

      const getRecommendations = () => {
        let faqData: any[] = [];
        try {
          const faqPath = path.join(process.cwd(), 'src', 'faq.json');
          if (fs.existsSync(faqPath)) {
            faqData = JSON.parse(fs.readFileSync(faqPath, 'utf8'));
          }
        } catch(e) {}
        if (!faqData || faqData.length === 0) return "";
        const recommendList = faqData
          .filter((item: any) => !["halo", "terima kasih", "operator", "lokasi", "kepala dusun"].includes(item.keywords[0]))
          .map((item: any) => `- Pendaftaran ${item.keywords[0].toUpperCase()}`)
          .slice(0, 4)
          .join("\n");
        return `\n\nBeberapa layanan yang bisa beta bantu jelaskan antara lain:\n${recommendList}`;
      };

      if (isApiKeyError) {
        res.write(`Maaf, pertanyaan Bapak/Ibu belum ada di basis data kami, dan saat ini layanan Artificial Intelligence sedang offline karena Kunci API Tidak Valid. ${getRecommendations()}\n\nSilakan hubungi Bapak Kepala Dusun.`);
      } else {
        res.write("\n\n[Maaf, terjadi masalah saat memproses permintaan Anda. Silakan hubungi Bapak Kepala Dusun.]");
      }
      res.end();
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
