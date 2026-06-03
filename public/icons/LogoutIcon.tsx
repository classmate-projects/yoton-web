import React from "react";

interface LogoutIconProps {
  size?: number;
  color?: string;
}

const LogoutIcon = ({
  size = 24,
  color = "currentColor",
}: LogoutIconProps) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6.40006 15.4001H2.20009C1.77574 15.4001 1.36878 15.2268 1.06872 14.9185C0.768667 14.6101 0.600098 14.1918 0.600098 13.7557V2.24454C0.600098 1.80841 0.768667 1.39014 1.06872 1.08174C1.36878 0.773351 1.77574 0.600098 2.20009 0.600098H6.40006"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M11.4004 11.9999L15.4004 7.99997L11.4004 4"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M15.3997 8H5.7998"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default LogoutIcon;