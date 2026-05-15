import React from 'react';

export const BackgroundIllustration = () => (
  <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#faecca] flex justify-center items-center">
    {/* Sun Light Glow */}
    <div className="absolute top-[35%] w-[600px] h-[600px] bg-white opacity-50 rounded-full blur-[80px]"></div>
    
    <svg className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full object-cover" 
         preserveAspectRatio="xMidYMid slice" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="leftCliff" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#d38736"/>
          <stop offset="100%" stopColor="#e3a149"/>
        </linearGradient>
        <linearGradient id="rightCliff" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#e3a149"/>
          <stop offset="100%" stopColor="#d38736"/>
        </linearGradient>
        <linearGradient id="leftCliffDark" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#a75b15"/>
          <stop offset="100%" stopColor="#c5772b"/>
        </linearGradient>
        <linearGradient id="rightCliffDark" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#c5772b"/>
          <stop offset="100%" stopColor="#a75b15"/>
        </linearGradient>
        <linearGradient id="sand" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f3ca7e"/>
          <stop offset="100%" stopColor="#dca851"/>
        </linearGradient>
      </defs>

      {/* Birds */}
      <g fill="#7d3c00" opacity="0.6">
        <path d="M 250 350 Q 260 340 270 350 Q 260 345 250 350 Z" />
        <path d="M 275 340 Q 285 330 295 340 Q 285 335 275 340 Z" />
        <path d="M 160 420 Q 170 410 180 420 Q 170 415 160 420 Z" />
        <path d="M 720 380 Q 730 370 740 380 Q 730 375 720 380 Z" />
        <path d="M 750 390 Q 760 380 770 390 Q 760 385 750 390 Z" />
      </g>

      {/* Background mountains */}
      <path d="M 0 650 L 100 550 L 250 700 L 350 500 L 500 750 L 0 750 Z" fill="#ebbe77" opacity="0.6"/>
      <path d="M 1000 650 L 900 530 L 750 700 L 650 500 L 500 750 L 1000 750 Z" fill="#ebbe77" opacity="0.6"/>

      {/* Left Cliffs layering */}
      <path d="M 0 1000 L 0 100 L 70 250 L 100 220 L 150 400 L 250 350 L 320 600 L 280 620 L 380 900 L 450 1000 Z" fill="url(#leftCliffDark)"/>
      <path d="M 0 1000 L 0 200 L 50 350 L 80 340 L 120 500 L 180 480 L 250 800 L 350 1000 Z" fill="url(#leftCliff)"/>

      {/* Right Cliffs layering */}
      <path d="M 1000 1000 L 1000 100 L 930 250 L 900 220 L 850 400 L 750 350 L 680 600 L 720 620 L 620 900 L 550 1000 Z" fill="url(#rightCliffDark)"/>
      <path d="M 1000 1000 L 1000 200 L 950 350 L 920 340 L 880 500 L 820 480 L 750 800 L 650 1000 Z" fill="url(#rightCliff)"/>

      {/* Ground/Sand */}
      <path d="M 0 1000 Q 500 750 1000 1000 Z" fill="url(#sand)"/>
      
      {/* Distant Center Island */}
      <path d="M 400 710 Q 500 680 600 710 Q 620 720 600 730 L 400 730 Q 380 720 400 710 Z" fill="#ebbe77" opacity="0.8"/>
      <path d="M 430 710 Q 500 660 550 715 Z" fill="#d38736" opacity="0.7"/>
    </svg>
  </div>
);
