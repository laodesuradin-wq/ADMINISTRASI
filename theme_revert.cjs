const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Header
content = content.replace(
  /<header className="bg-blue-600 shadow-lg px-4 py-4 flex items-center justify-between sticky top-0 z-40 no-print">/,
  '<header className="bg-blue-400/20 backdrop-blur-2xl border-b border-white/40 shadow-[0_8px_32px_rgba(14,165,233,0.15)] px-4 py-4 flex items-center justify-between sticky top-0 z-40 no-print">'
);

// Header text SIAK MOBILE
content = content.replace(
  /<h1 className="font-black text-lg text-white leading-none tracking-tighter uppercase">/g,
  '<h1 className="font-black text-lg text-slate-800 leading-none tracking-tighter uppercase">'
);

content = content.replace(
  /SIAK <span className="text-blue-200">MOBILE<\/span>/g,
  'SIAK <span className="text-blue-500">MOBILE</span>'
);

// AMAHOLU LOSY pill
content = content.replace(
  /<span className="text-\[8px\] bg-amber-400 text-amber-950 px-2 py-0\.5 rounded-full font-bold uppercase tracking-\[0\.2em\] leading-none">/g,
  '<span className="text-[8px] bg-amber-500 text-slate-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-[0.2em] text-blue-900 leading-none">'
);

// Footer
content = content.replace(
  /<footer className="bg-blue-600 shadow-\[0_-8px_32px_rgba\(37,99,235,0\.2\)\] py-6 px-6 text-center no-print shrink-0">/,
  '<footer className="bg-blue-400/20 backdrop-blur-2xl border-t border-white/40 shadow-[0_-8px_32px_rgba(14,165,233,0.15)] py-6 px-6 text-center no-print shrink-0">'
);

// Footer text
content = content.replace(
  /<p className="text-blue-50 text-\[8px\] md:text-xs font-black uppercase tracking-\[0\.2em\] leading-relaxed">/,
  '<p className="text-slate-600 text-[8px] md:text-xs font-black uppercase tracking-[0.2em] leading-relaxed">'
);

fs.writeFileSync('src/App.tsx', content);
console.log('Done replacement');
