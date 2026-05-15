const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Global backgrounds (blue-100 to indigo-50 is a bit muddy)
// Let's use pure white and nice sky/blue accents instead.
content = content.replace(/bg-gradient-to-br from-blue-100 via-white to-indigo-50/g, 'bg-slate-50');
content = content.replace(/bg-gradient-to-br from-indigo-50 via-white to-blue-50/g, 'bg-slate-50');

// Header
content = content.replace(
  /bg-gradient-to-br from-blue-100 via-white to-indigo-50 px-4 py-4 flex items-center justify-between sticky top-0 z-40 no-print border-b border-white\/40/g,
  'bg-white px-4 py-4 flex items-center justify-between sticky top-0 z-40 no-print border-b border-slate-200 shadow-sm'
);

// Footer
content = content.replace(
  /bg-white\/80 backdrop-blur-2xl border border-white\/60 shadow-\[0_8px_32px_rgba\(31,38,135,0\.05\)\] border-t border-white\/40 py-6 px-6 text-center no-print shrink-0/g,
  'bg-white border-t border-slate-200 py-6 px-6 text-center no-print shrink-0'
);

// General Cards
content = content.replace(/bg-white\/70 backdrop-blur-3xl border border-white\/50 shadow-\[0_8px_32px_rgba\(31,38,135,0\.07\)\]/g, 'bg-white rounded-[2rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]');
content = content.replace(/bg-white\/80 backdrop-blur-2xl border border-white\/60 shadow-\[0_8px_32px_rgba\(31,38,135,0\.05\)\]/g, 'bg-white rounded-3xl border border-slate-100 shadow-sm');
content = content.replace(/bg-white\/60 backdrop-blur-xl border border-white shadow-sm hover:shadow-md transition-shadow/g, 'bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all');
content = content.replace(/bg-white\/70 backdrop-blur-xl border border-white shadow-sm hover:shadow-md transition-shadow/g, 'bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all');
content = content.replace(/bg-white\/70 backdrop-blur-xl/g, 'bg-white');

// Pill/Badges
content = content.replace(/bg-amber-500/g, 'bg-blue-100 text-blue-700'); 
content = content.replace(/text-blue-900/g, 'text-blue-700');

// Modals/Overlays
content = content.replace(/bg-gradient-to-br from-blue-100 via-white to-indigo-50\/80 backdrop-blur-xl/g, 'bg-slate-900/40 backdrop-blur-sm');
content = content.replace(/bg-gradient-to-br from-blue-100 via-white to-indigo-50\/70 backdrop-blur-md/g, 'bg-slate-900/40 backdrop-blur-sm');

// Login modal container
// Previously it was: max-w-[340px] bg-white/80 backdrop-blur-2xl rounded-[2.5rem] border border-white shadow-[0_30px_60px_rgba(31,38,135,0.15)]
content = content.replace(/max-w-\[340px\] bg-white\/80 backdrop-blur-2xl rounded-\[2\.5rem\] border border-white shadow-\[0_30px_60px_rgba\(31,38,135,0\.15\)\]/g, 'max-w-[340px] bg-white rounded-[2.5rem] shadow-2xl shadow-blue-900/10 border border-slate-100');

// Fix buttons
content = content.replace(/bg-gradient-to-r from-blue-500 to-indigo-600/g, 'bg-blue-600');
content = content.replace(/hover:from-blue-600 hover:to-indigo-700/g, 'hover:bg-blue-700');
content = content.replace(/shadow-blue-500\/30/g, 'shadow-blue-600/20');
content = content.replace(/bg-gradient-to-br from-blue-500 to-indigo-600/g, 'bg-blue-600');

// Typography adjustments
// Slate 800 for headers is good
content = content.replace(/text-slate-800/g, 'text-slate-900');
content = content.replace(/text-slate-600/g, 'text-slate-500');

// Remove extra blur circles
content = content.replace(/<div className="absolute top-0 right-0 w-\[60rem\] h-\[60rem\] bg-blue-600\/20 rounded-full blur-\[150px\] -translate-y-1\/2 translate-x-1\/2"><\/div>/g, '<div className="absolute top-0 right-0 w-[60rem] h-[60rem] bg-blue-400/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>');

fs.writeFileSync('src/App.tsx', content);
console.log('Update applied');
