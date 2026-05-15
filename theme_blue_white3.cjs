const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Fix dark theme dropdown options
content = content.replace(/className="bg-purple-950"/g, 'className="bg-white text-slate-800"');

// There's a bg-black
// <div className="aspect-video w-full rounded-2xl md:rounded-[2rem] overflow-hidden border border-white/60 shadow-2xl bg-black relative shadow-purple-900/20">
content = content.replace(/bg-black relative shadow-purple-900\/20/g, 'bg-slate-900 relative shadow-blue-900/20');
content = content.replace(/bg-\[#1b1e28\]/g, 'bg-slate-50');

// There's a background element:
// <div className="absolute inset-0 bg-gradient-to-t from-[#1b1e28] via-[#1b1e28]/20 to-transparent z-0"></div>
content = content.replace(/from-\[#1b1e28\] via-\[#1b1e28\]\/20/g, 'from-blue-900/80 via-blue-900/40');

// Header gradient fix if it's there
content = content.replace(/bg-gradient-to-br from-blue-500 to-blue-700/g, 'bg-blue-600');
content = content.replace(/bg-gradient-to-br from-emerald-500 to-emerald-700/g, 'bg-emerald-600');

fs.writeFileSync('src/App.tsx', content);
console.log('Update applied 3');
