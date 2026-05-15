const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Fix buttons that end up with white background but text-sky-950, which doesn't change on hover
content = content.replace(/bg-white rounded-3xl border border-sky-100 shadow-sm text-sky-950 font-black uppercase tracking-\[0\.2em\] rounded-xl shadow-lg hover:bg-blue-700 hover:-translate-y-0\.5 active:translate-y-0 transition-all duration-300 group text-xs/g, 'w-full py-4 bg-blue-600 text-white font-black uppercase tracking-[0.2em] rounded-xl shadow-lg hover:bg-blue-700 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 group text-xs');

content = content.replace(/bg-white rounded-3xl border border-sky-100 shadow-sm text-sky-950 rounded-xl md:rounded-\[1\.5rem\] font-black text-\[10px\] md:text-\[11px\] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-xl shadow-slate-900\/10 active:scale-95 border-b-4 border-slate-700/g, 'bg-blue-600 text-white rounded-xl md:rounded-[1.5rem] font-black text-[10px] md:text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/10 active:scale-95 border-b-4 border-blue-800');

// Fix some bad replacements that made className repeat bg-white
content = content.replace(/bg-white rounded-2xl border border-sky-100 shadow-lg p-2 rounded-2xl border border-white\/60 backdrop-blur-xl/g, 'bg-white rounded-2xl shadow-lg p-2');

// Fix another bad replacement
content = content.replace(/bg-white rounded-2xl border border-sky-100 shadow-sm flex items-center justify-center rounded-2xl/g, 'bg-white border-sky-100 shadow-sm rounded-2xl flex items-center justify-center');

fs.writeFileSync('src/App.tsx', content);
console.log('Update applied 5');
