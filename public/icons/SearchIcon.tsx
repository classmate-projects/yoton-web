interface SearchIconProps {
  size?: number;
  color?: string;
}

const SearchIcon = ({
  size = 18,
  color = "currentColor",
}: SearchIconProps) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="6.6001"
        cy="6.6"
        r="6"
        stroke={color}
        strokeWidth="1.2"
      />

      <path
        d="M11 11L15.2426 15.2427"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default SearchIcon;