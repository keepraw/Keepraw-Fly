import { useId } from "react";

const FLAME_PATH =
  "M68 10C72 34 102 48 102 80A38 38 0 0 1 26 80C26 62 34 50 44 38C45 48 49 54 56 57C53 40 58 24 68 10Z";
const ARC_PATH = "M12 104Q76 116 111 24";
const NOSE_PATH = "M0 -12L9 9L0 5L-9 9Z";

export function KeeprawFlyMark({ className }: { className?: string }) {
  const maskId = useId();
  return (
    <svg
      className={className}
      viewBox="0 0 128 128"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="128"
          height="128"
        >
          <rect width="128" height="128" fill="#fff" />
          <path
            d={ARC_PATH}
            fill="none"
            stroke="#000"
            strokeWidth="12"
            strokeLinecap="round"
          />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`}>
        <g transform="translate(-4 5) scale(.84)">
          <path fill="currentColor" d={FLAME_PATH} />
          <circle cx="64" cy="82" r="13.5" fill="#c8553d" />
        </g>
      </g>
      <path
        d={ARC_PATH}
        fill="none"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="104" r="4" fill="currentColor" />
      <g transform="translate(113 21) rotate(21)">
        <path fill="currentColor" d={NOSE_PATH} />
      </g>
    </svg>
  );
}
