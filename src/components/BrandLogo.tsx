import React from "react";

type BrandLogoProps = {
  size?: number;
  className?: string;
};

const BrandLogo: React.FC<BrandLogoProps> = ({ size = 24, className }) => {
  const containerSize = `${Math.ceil(size + 8)}px`;
  return (
    <div
      className={`inline-flex items-center justify-center rounded-md shadow-sm bg-gradient-to-r from-slate-900/95 via-blue-900/95 to-slate-900/95 ${className || ""}`}
      style={{ width: containerSize, height: containerSize }}
    >
      <img
        src="/Koch_Metro_Logo.png"
        alt="KochiKonnect"
        style={{ width: `${size}px`, height: `${size}px` }}
        className="object-contain"
      />
    </div>
  );
};

export default BrandLogo;


