import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'secondary' | 'ghost';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "px-6 py-3 font-bold uppercase tracking-wider transition-all duration-200 clip-path-polygon focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900";
  
  const variants = {
    primary: "bg-yellow-500 hover:bg-yellow-400 text-black focus:ring-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.5)]",
    danger: "bg-red-600 hover:bg-red-500 text-white focus:ring-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]",
    secondary: "bg-slate-700 hover:bg-slate-600 text-white border border-slate-500 focus:ring-slate-500",
    ghost: "bg-transparent text-slate-400 hover:text-white"
  };

  const width = fullWidth ? "w-full" : "";

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${width} ${className}`}
      style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
      {...props}
    >
      {children}
    </button>
  );
};
