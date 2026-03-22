import type { SVGProps } from 'react';

export function JenkinsIcon(props: SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={props.className}
      {...props}
    >
      <text
        x="12"
        y="19"
        textAnchor="middle"
        fontSize="20"
        fontWeight="bold"
        fontFamily="Georgia, serif"
        fill="currentColor"
      >
        J
      </text>
    </svg>
  );
}
