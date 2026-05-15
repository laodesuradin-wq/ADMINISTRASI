const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Clean up duplicate overlapping classnames
content = content.replace(/bg-white rounded-3xl border border-sky-100 shadow-[a-z0-9/\-]* shadow-[a-z0-9/\-]* hover:shadow-md transition-all/g, 'bg-white rounded-3xl border border-sky-100 shadow-sm hover:shadow-md transition-all');

content = content.replace(/bg-white rounded-3xl border border-sky-100 shadow-sm hover:shadow-md transition-all hover:bg-white rounded-3xl border border-sky-100 shadow-sm hover:shadow-md transition-all/g, 'bg-white rounded-3xl border border-sky-100 shadow-sm hover:shadow-md transition-all');

content = content.replace(/bg-white rounded-\[2rem\] border border-sky-100 shadow-\[0_8px_30px_rgb\(0,0,0,0\.04\)\] border-white\/50/g, 'bg-white rounded-3xl border border-sky-100 shadow-sm');

content = content.replace(/focus:bg-white rounded-3xl border border-sky-100 shadow-sm hover:shadow-md transition-all/g, 'focus:bg-white focus:border-blue-500 focus:shadow-md');

content = content.replace(/bg-emerald-600 text-sky-950/g, 'bg-emerald-600 text-white');

content = content.replace(/bg-white rounded-3xl border border-sky-100 shadow-sm shadow-slate-900\/40/g, 'bg-white rounded-3xl border border-sky-100 shadow-md');

content = content.replace(/bg-white rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-sky-100/g, 'bg-white rounded-2xl md:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-slate-100');

fs.writeFileSync('src/App.tsx', content);
console.log('Update applied 6');
