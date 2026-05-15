const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Global Background
content = content.replace(/bg-sky-50/g, 'bg-gradient-to-br from-indigo-50 via-white to-blue-50');

// Login screen background
content = content.replace(/bg-sky-200\/30/g, 'bg-gradient-to-br from-blue-100 via-white to-indigo-50');

// Panel Backgrounds for glassy effect
// Change bg-white/70 to a nice glassy white with strong blur and border
content = content.replace(/bg-white\/70 backdrop-blur-xl/g, 'bg-white/70 backdrop-blur-3xl border border-white/50 shadow-[0_8px_32px_rgba(31,38,135,0.07)]');

// Also update bg-white/60...
content = content.replace(/bg-white\/60 backdrop-blur-lg/g, 'bg-white/80 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgba(31,38,135,0.05)]');

// Update header to have nice glass
content = content.replace(/bg-white\/60 backdrop-blur-lg border-b border-white\/40/g, 'bg-white/80 backdrop-blur-2xl border-b border-white shadow-sm');

// Buttons and text
// Some headers and footers can be clean white
content = content.replace(/bg-sky-200\/30/g, 'bg-white/40');

// Change standard dark texts to nice blue shades
// text-sky-950 -> text-slate-800
// text-sky-800 -> text-slate-600
// text-sky-700 -> text-slate-500

content = content.replace(/text-sky-950/g, 'text-slate-800');
content = content.replace(/text-sky-800/g, 'text-slate-600');
content = content.replace(/text-sky-700/g, 'text-slate-500');

// Primary buttons
// Make primary buttons an aesthetic blue gradient
content = content.replace(/bg-blue-600 shadow-blue-600\/40/g, 'bg-gradient-to-r from-blue-500 to-indigo-600 shadow-blue-500/30 text-white');
content = content.replace(/bg-blue-600 hover:bg-blue-700/g, 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white');

// Fix text-slate-800 inside primary buttons, these should be text-white
content = content.replace(/text-slate-800 text-white/g, 'text-white');
content = content.replace(/bg-blue-600 text-slate-800/g, 'bg-blue-600 text-white');
content = content.replace(/bg-slate-900/g, 'bg-white/80 backdrop-blur-lg border border-white');

// If there's an instance of text-white inside buttons that was replaced by text-slate-800, let's fix it:
// "bg-gradient-to-br from-blue-600 to-blue-800 text-slate-800"
content = content.replace(/bg-gradient-to-br from-blue-600 to-blue-800 text-slate-800/g, 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white');
content = content.replace(/bg-gradient-to-r from-blue-600 to-blue-700 text-slate-800/g, 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white');

// Dashboard cards
// For example: "bg-white border text-slate-800/10" -> no, just cards
content = content.replace(/bg-white\/40 border border-white\/60/g, 'bg-white/60 backdrop-blur-xl border border-white shadow-sm hover:shadow-md transition-shadow');
content = content.replace(/bg-white\/50 border border-white\/60/g, 'bg-white/70 backdrop-blur-xl border border-white shadow-sm hover:shadow-md transition-shadow');


// Title/Typography
// The user has titles in the document. Let's make sure they use Playfair Display or cool fonts.
// We can add font-serif to some titles.
content = content.replace(/font-black uppercase tracking-widest/g, 'font-bold uppercase tracking-[0.2em] text-blue-900');

// Login modal
content = content.replace(/max-w-\[320px\] bg-white rounded-\[2rem\]/g, 'max-w-[340px] bg-white/80 backdrop-blur-2xl rounded-[2.5rem] border border-white shadow-[0_30px_60px_rgba(31,38,135,0.15)]');

fs.writeFileSync('src/App.tsx', content);
console.log('Done replacement');
