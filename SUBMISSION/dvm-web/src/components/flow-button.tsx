'use client';

import { ArrowRight } from 'lucide-react';

/* FlowButton — circle-sweep CTA with sliding arrow.
   Theme-adaptive: uses on-surface/surface tokens (our .dark
   overrides remap them), so it reads correctly on paper and
   on the dark default. NOT for icon-only controls.          */
export function FlowButton({
  text = 'Modern Button',
  size = 'md',
  className = '',
  onClick,
  type = 'button',
  disabled = false,
  ariaLabel,
}: {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const pad =
    size === 'sm' ? 'px-5 py-2.5 text-[13px] gap-1.5' :
    size === 'lg' ? 'px-9 py-4 text-lg gap-2.5' :
                    'px-8 py-3.5 text-base gap-2';
  const icon = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel || text}
      className={`group relative inline-flex items-center overflow-hidden rounded-[100px] border-[1.5px] border-on-surface/40 bg-transparent font-semibold text-on-surface cursor-pointer transition-all duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:border-transparent hover:text-surface hover:rounded-[12px] active:scale-[0.95] disabled:opacity-40 disabled:pointer-events-none ${pad} ${className}`}
    >
      {/* Left arrow (arr-2) */}
      <ArrowRight className={`absolute ${icon} left-[-25%] z-[9] stroke-[currentColor] fill-none group-hover:left-4 transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]`} />

      {/* Text */}
      <span className="relative z-[1] -translate-x-2.5 group-hover:translate-x-2.5 transition-all duration-[800ms] ease-out whitespace-nowrap">
        {text}
      </span>

      {/* Circle */}
      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-on-surface rounded-[50%] opacity-0 group-hover:w-[240px] group-hover:h-[240px] group-hover:opacity-100 transition-all duration-[800ms] ease-[cubic-bezier(0.19,1,0.22,1)]" />

      {/* Right arrow (arr-1) */}
      <ArrowRight className={`absolute ${icon} right-4 z-[9] stroke-[currentColor] fill-none group-hover:right-[-25%] transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]`} />
    </button>
  );
}
