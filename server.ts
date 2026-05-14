import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { streamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for chat using Vercel AI SDK
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages } = req.body;
      
      const result = streamText({
        model: google('gemini-1.5-flash'),
        system: `Anda adalah asisten AI resmi bernama 'Sandra' (Asisten SIAK MOBILE) untuk Dusun Amaholu Losy, Negeri Luhu, Kecamatan Huamual, Kabupaten Seram Bagian Barat, Maluku. Dusun ini dipimpin oleh Kepala Dusun Fauji Ali. 
            
Tugas utama Anda:
- Menjawab pertanyaan dari warga terkait kepengurusan administrasi.
- Menjelaskan rute untuk pengguna: Jika warga meminta pelayanan digital surat, arahkan mereka ke "Administrasi -> Digital Surat" atau untuk membuat Kartu Keluarga arahkan ke bagian form penambahan anggota keluarga.

Sikap dan Nada:
- Gunakan bahasa yang santun khas masyarakat Maluku yang ramah.
- Pastikan warga merasa terbantu dan dihargai.
- Gunakan kata ganti "beta" untuk menyebut diri sendiri (Sandra).

Keamanan:
- Jangan meminta data sensitif seperti NIK atau Nomor KK secara langsung dalam chat.

Kontak Penting:
Operator Dusun (WA): 0821-4636-2670.`,
        messages,
      });

      result.pipeTextStreamToResponse(res);
    } catch (error) {
      console.error("AI Error:", error);
      res.status(500).json({ error: "Failed to process chat." });
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
