"use client";

interface GlowingSearchBarProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

const GlowingSearchBar = ({
  value,
  onChange,
  placeholder = "Search jobs, companies, locations...",
}: GlowingSearchBarProps) => {
  return (
    <div className="relative flex items-center justify-center">
      <div
        id="poda"
        className="relative flex items-center justify-center group"
      >
        {/* Outer glow layer 1 */}
        <div
          className="absolute z-[-1] overflow-hidden h-full w-full max-h-[56px] max-w-[500px] rounded-lg blur-[3px]
                     before:absolute before:content-[''] before:z-[-2] before:w-[999px] before:h-[999px] before:bg-no-repeat
                     before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:rotate-60
                     before:bg-[conic-gradient(#09090b,#f59e0b_5%,#09090b_38%,#09090b_50%,#d97706_60%,#09090b_87%)]
                     before:transition-all before:duration-[2000ms]
                     group-hover:before:rotate-[-120deg]
                     group-focus-within:before:rotate-[420deg] group-focus-within:before:duration-[4000ms]"
        />

        {/* Outer glow layer 2 */}
        <div
          className="absolute z-[-1] overflow-hidden h-full w-full max-h-[54px] max-w-[498px] rounded-lg blur-[3px]
                     before:absolute before:content-[''] before:z-[-2] before:w-[600px] before:h-[600px] before:bg-no-repeat
                     before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:rotate-[82deg]
                     before:bg-[conic-gradient(rgba(0,0,0,0),#78350f,rgba(0,0,0,0)_10%,rgba(0,0,0,0)_50%,#92400e,rgba(0,0,0,0)_60%)]
                     before:transition-all before:duration-[2000ms]
                     group-hover:before:rotate-[-98deg]
                     group-focus-within:before:rotate-[442deg] group-focus-within:before:duration-[4000ms]"
        />

        {/* Inner highlight layer */}
        <div
          className="absolute z-[-1] overflow-hidden h-full w-full max-h-[50px] max-w-[494px] rounded-lg blur-[0.5px]
                     before:absolute before:content-[''] before:z-[-2] before:w-[600px] before:h-[600px] before:bg-no-repeat
                     before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:rotate-70
                     before:bg-[conic-gradient(#09090b,#f59e0b_5%,#09090b_14%,#09090b_50%,#d97706_60%,#09090b_64%)]
                     before:brightness-110
                     before:transition-all before:duration-[2000ms]
                     group-hover:before:rotate-[-110deg]
                     group-focus-within:before:rotate-[430deg] group-focus-within:before:duration-[4000ms]"
        />

        {/* Input wrapper */}
        <div className="relative group">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="bg-zinc-950 border-none w-[480px] h-[48px] rounded-lg text-zinc-200 pl-[52px] pr-[52px] text-sm font-mono focus:outline-none placeholder-zinc-600 tracking-wide"
          />

          {/* Input mask */}
          <div className="pointer-events-none w-[80px] h-[16px] absolute bg-gradient-to-r from-transparent to-zinc-950 top-[16px] left-[60px] group-focus-within:hidden" />

          {/* Amber pink glow */}
          <div className="pointer-events-none w-[24px] h-[16px] absolute bg-amber-500 top-[8px] left-[4px] blur-2xl opacity-60 transition-all duration-[2000ms] group-hover:opacity-0" />

          {/* Spinning right icon */}
          <div
            className="absolute h-[36px] w-[36px] overflow-hidden top-[6px] right-[6px] rounded-md
                        before:absolute before:content-[''] before:w-[600px] before:h-[600px] before:bg-no-repeat
                        before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:rotate-90
                        before:bg-[conic-gradient(rgba(0,0,0,0),#27272a,rgba(0,0,0,0)_50%,rgba(0,0,0,0)_50%,#27272a,rgba(0,0,0,0)_100%)]
                        before:brightness-125 before:animate-[spin_4s_linear_infinite]"
          />
          <div className="absolute top-[6px] right-[6px] flex items-center justify-center z-[2] h-[36px] w-[36px] overflow-hidden rounded-md bg-gradient-to-b from-zinc-900 via-zinc-950 to-zinc-900 border border-zinc-800/60">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-500">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
          </div>

          {/* Search icon */}
          <div className="absolute left-4 top-[13px]">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" fill="none">
              <circle stroke="url(#sg)" r="8" cy="11" cx="11" />
              <line stroke="url(#sl)" y2="16.65" y1="22" x2="16.65" x1="22" />
              <defs>
                <linearGradient gradientTransform="rotate(50)" id="sg">
                  <stop stopColor="#fbbf24" offset="0%" />
                  <stop stopColor="#92400e" offset="100%" />
                </linearGradient>
                <linearGradient id="sl">
                  <stop stopColor="#92400e" offset="0%" />
                  <stop stopColor="#44403c" offset="100%" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlowingSearchBar;