"use client";

import { useId } from "react";

/**
 * The Nexora mark: a green neon N on a dark glass tile, with a spark where the line ends.
 * The N rises from deep green to pale mint, like a deal moving towards "won".
 *
 * Gradient and filter ids come from useId, so several logos on one page (the sidebar and
 * the phone header, say) never share or clash.
 */
export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  const ref = (name: string) => `${name}-${id}`;
  const url = (name: string) => `url(#${ref(name)})`;
  // Below ~28 px the glow and core line turn to mush; draw a simpler, bolder N.
  const small = size < 28;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={`shrink-0 ${className}`}>
      <defs>
        <linearGradient id={ref("glass")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#18241D" />
          <stop offset="1" stopColor="#050706" />
        </linearGradient>
        <linearGradient id={ref("sheen")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.1" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={ref("rim")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#A6F4C5" stopOpacity="0.8" />
          <stop offset="0.4" stopColor="#2EE07F" stopOpacity="0.15" />
          <stop offset="0.75" stopColor="#2EE07F" stopOpacity="0.05" />
          <stop offset="1" stopColor="#2EE07F" stopOpacity="0.45" />
        </linearGradient>
        <radialGradient id={ref("bloom")} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#2EE07F" stopOpacity="0.35" />
          <stop offset="1" stopColor="#2EE07F" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ref("rise")} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#14904F" />
          <stop offset="0.5" stopColor="#2EE07F" />
          <stop offset="1" stopColor="#B8FAD3" />
        </linearGradient>
        <filter id={ref("halo")} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
      </defs>

      <rect x="2" y="2" width="60" height="60" rx="16" fill={url("glass")} />
      <circle cx="32" cy="32" r="24" fill={url("bloom")} />
      <rect x="2" y="2" width="60" height="60" rx="16" fill={url("sheen")} />
      <rect x="2.5" y="2.5" width="59" height="59" rx="15.5" fill="none" stroke={url("rim")} strokeWidth={small ? 2 : 1.2} />

      {small ? (
        <path d="M19 45 V19 L45 45 V19" fill="none" stroke={url("rise")} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <>
          <path d="M20 45 V19 L44 45 V19" fill="none" stroke="#2EE07F" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" filter={url("halo")} />
          <path d="M20 45 V19 L44 45 V19" fill="none" stroke={url("rise")} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 45 V19 L44 45 V19" fill="none" stroke="#E9FFF2" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
        </>
      )}
      <circle cx={small ? 45 : 44} cy="19" r={small ? 3.6 : 3} fill="#FFFFFF" />
      {size >= 56 && (
        <path d="M44 12.5 V15.5 M44 22.5 V25.5 M37.5 19 H40.5 M47.5 19 H50.5" stroke="#C9FADB" strokeWidth="1" strokeLinecap="round" opacity="0.85" />
      )}
    </svg>
  );
}

/** The mark plus the "nexora" wordmark in Sora. `size` is the mark's size; the text scales with it. */
export default function Logo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: Math.round(size * 0.3) }}>
      <LogoMark size={size} />
      <span className="font-brand font-semibold tracking-[-0.02em] text-white" style={{ fontSize: Math.round(size * 0.58), lineHeight: 1 }}>
        nexora
      </span>
    </span>
  );
}
