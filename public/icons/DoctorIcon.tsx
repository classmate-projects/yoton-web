import React from "react";

interface DoctorIconProps {
  size?: number;
  color?: string;
}

const DoctorIcon = ({
  size = 24,
  color = "#51526C",
}: DoctorIconProps) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6.78571 1H7.75C8.93026 1 9.83026 2.05619 9.64297 3.22149L8.98471 7.31736C8.82888 8.28698 7.99211 9 7.01005 9H3.98995C3.00788 9 2.17112 8.28698 2.01529 7.31736L1.35703 3.22149C1.16974 2.05619 2.06974 1 3.25 1H4.21429"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      <path
        d="M5.37378 9.17647V12C5.37378 13.6569 6.71692 15 8.37378 15H9.99994C11.6568 15 12.9999 13.6569 12.9999 12V6"
        stroke={color}
        strokeWidth="1.2"
      />

      <circle
        cx="13"
        cy="5"
        r="1.4"
        stroke={color}
        strokeWidth="1.2"
      />

      <rect
        x="6.18774"
        y="0.237915"
        width="1.42282"
        height="1.5"
        rx="0.711411"
        fill={color}
      />

      <rect
        x="3.40063"
        y="0.237915"
        width="1.42282"
        height="1.5"
        rx="0.711411"
        fill={color}
      />
    </svg>
  );
};

export default DoctorIcon;