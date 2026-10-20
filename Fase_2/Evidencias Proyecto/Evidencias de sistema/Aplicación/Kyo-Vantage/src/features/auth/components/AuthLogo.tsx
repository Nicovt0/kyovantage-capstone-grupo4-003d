import React from 'react';

interface AuthLogoProps {
  className?: string;
  imageClassName?: string;
}

export const AuthLogo = ({ className = "w-[230px] h-[46px]", imageClassName = "w-[230px]" }: AuthLogoProps = {}) => (
  <div className={`flex items-center justify-center lg:justify-start relative mx-auto ${className}`}>
    <img
      src="/Logo_1920x1920_white_transparent.png"
      alt="Kyo Vantage Logo"
      width={1920}
      height={1920}
      className={`block dark:hidden absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-auto max-w-none drop-shadow-[0_0_15px_rgba(124,58,237,0.4)] ${imageClassName}`} fetchPriority="high"
    />
    <img
      src="/Logo_1920x1920_clean.png"
      alt="Kyo Vantage Logo"
      width={1920}
      height={1920}
      className={`hidden dark:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-auto max-w-none drop-shadow-[0_0_15px_rgba(124,58,237,0.2)] ${imageClassName}`} fetchPriority="high"
    />
  </div>
);
