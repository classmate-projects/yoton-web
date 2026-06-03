import React from "react";

interface BuildingIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
}

const BuildingIcon = ({
  size = 24,
  color = "currentColor",
  ...props
}: BuildingIconProps) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M8.42169 15.3618H2.25133C1.40126 15.3618 0.705078 14.6802 0.705078 13.8448V2.96975C0.705078 1.04976 2.13408 0.177703 3.88552 1.0351L7.13925 2.63265C7.84276 2.97708 8.42169 3.89311 8.42169 4.6699V15.3618Z"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M15.3616 10.2753V13.0454C15.3616 14.6282 14.6288 15.3611 13.0459 15.3611H8.42178V6.875L8.76621 6.94828L12.0639 7.68843L13.5515 8.0182C14.5189 8.23072 15.3103 8.72904 15.3543 10.1361C15.3616 10.18 15.3616 10.224 15.3616 10.2753Z"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M3.29166 5.83459H5.83455"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M3.29166 8.76562H5.83455"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M12.0633 7.68888V10.0486C12.0633 10.9573 11.3232 11.6974 10.4145 11.6974C9.50577 11.6974 8.76562 10.9573 8.76562 10.0486V6.94873L12.0633 7.68888Z"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M15.3538 10.1368C15.3099 11.0016 14.5917 11.6977 13.7123 11.6977C12.8036 11.6977 12.0635 10.9576 12.0635 10.0489V7.68921L13.5511 8.01898C14.5184 8.2315 15.3099 8.72982 15.3538 10.1368Z"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default BuildingIcon;
