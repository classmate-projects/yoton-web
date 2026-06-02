import React from "react";

interface DeleteIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
}

const DeleteIcon = ({
  size = 20,
  color = "currentColor",
  ...props
}: DeleteIconProps) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect
        x="3"
        y="3.40005"
        width="10"
        height="12"
        rx="1"
        stroke={color}
        strokeWidth="1.2"
      />

      <rect
        x="1.5"
        y="1.40005"
        width="13"
        height="2"
        rx="0.5"
        stroke={color}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />

      <path
        d="M6 0.600006L10 0.600006"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      <path
        d="M8 6.00003V13"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      <path
        d="M10.5 6.00003V13"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      <path
        d="M5.5 6.00003V13"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
};

export default DeleteIcon;
