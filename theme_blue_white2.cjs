const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Fix duplicate classes
content = content.replace(/bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all p-2 rounded-2xl border border-white\/60 backdrop-blur-xl shadow-2xl/g, 'bg-white rounded-2xl border border-slate-100 shadow-lg p-2');

content = content.replace(/bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all backdrop-blur-md rounded-2xl flex items-center justify-center border border-white\/60 shadow-inner/g, 'bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center');

content = content.replace(/bg-white rounded-3xl border border-slate-100 shadow-sm\/80 backdrop-blur-md p-3 sm:p-5 flex items-center justify-between gap-4 z-50 border-b border-white\/60 shadow-2xl/g, 'bg-white border-b border-slate-200 shadow-sm p-3 sm:p-5 flex items-center justify-between gap-4 z-50');

content = content.replace(/bg-slate-50\/80 backdrop-blur-xl/g, 'bg-slate-900/40 backdrop-blur-sm');
content = content.replace(/bg-slate-50\/98 backdrop-blur-xl/g, 'bg-slate-50');

content = content.replace(/bg-white\/90 backdrop-blur-2xl rounded-2xl md:rounded-3xl shadow-\[0_20px_60px_rgba\(0,0,0,0\.5\)\] overflow-hidden flex flex-col border border-white\/60/g, 'bg-white rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-100');

content = content.replace(/bg-white\/90 backdrop-blur-2xl/g, 'bg-white');

// Fix dark background in cards 
// <div className="p-6 bg-gradient-to-r from-slate-900 to-blue-900 text-slate-900 flex justify-between items-center relative overflow-hidden">
content = content.replace(/bg-gradient-to-r from-slate-900 to-blue-900 text-slate-900/g, 'bg-blue-600 text-white');
content = content.replace(/bg-slate-900\/20/g, 'bg-blue-500/20');

// Fix black buttons that should be blue
// active:bg-slate-800 ...
content = content.replace(/bg-slate-900 text-white/g, 'bg-blue-600 text-white');
content = content.replace(/hover:bg-slate-800/g, 'hover:bg-blue-700');
content = content.replace(/bg-slate-800/g, 'bg-blue-700');

fs.writeFileSync('src/App.tsx', content);
console.log('Update applied 2');
