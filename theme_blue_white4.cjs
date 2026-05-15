const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/bg-slate-50/g, 'bg-sky-50');
content = content.replace(/border-slate-200/g, 'border-sky-200');
content = content.replace(/border-slate-100/g, 'border-sky-100');

// Header
content = content.replace(
  /bg-white\/90 backdrop-blur-md px-4 py-4 flex items-center justify-between sticky top-0 z-40 no-print border-b border-sky-200 shadow-sm/g,
  'bg-white px-4 py-4 flex items-center justify-between sticky top-0 z-40 no-print border-b border-sky-100 shadow-[0_4px_20px_rgba(14,165,233,0.05)]'
);

// Footer
content = content.replace(
  /bg-white border-t border-sky-200 py-6 px-6 text-center no-print shrink-0/g,
  'bg-white border-t border-sky-100 shadow-[0_-4px_20px_rgba(14,165,233,0.05)] py-6 px-6 text-center no-print shrink-0'
);

// Text colors
content = content.replace(/text-slate-900/g, 'text-sky-950');
content = content.replace(/text-slate-500/g, 'text-sky-600');
content = content.replace(/text-slate-600/g, 'text-sky-700');

fs.writeFileSync('src/App.tsx', content);
console.log('Update applied 4');
