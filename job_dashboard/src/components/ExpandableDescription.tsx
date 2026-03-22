import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface ExpandableDescriptionProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  previewCount?: number;
}

function renderParagraph(p: string, key: string) {
  return (
    <p key={key} className="leading-relaxed text-zinc-300 text-sm">
      {p.split("\n").map((line, i, arr) => (
        <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
      ))}
    </p>
  );
}

export function ExpandableDescription({ title, description, icon, previewCount = 2 }: ExpandableDescriptionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const paras = description.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const preview = paras.slice(0, previewCount);
  const rest = paras.slice(previewCount);
  const hasMore = rest.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="rounded-2xl border border-zinc-800/50 bg-zinc-900/80 p-6 backdrop-blur-sm"
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400">
          {icon}
        </div>
        <h2 className="text-base font-bold tracking-tight text-zinc-100">{title}</h2>
      </div>

      <div className="space-y-3">
        {preview.map((p, i) => renderParagraph(p, `pre-${i}`))}

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
              className="overflow-hidden space-y-3"
            >
              {rest.map((p, i) => renderParagraph(p, `rest-${i}`))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-600 transition-colors hover:text-zinc-300"
        >
          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="h-3.5 w-3.5" />
          </motion.div>
          {isExpanded ? "Collapse" : `Read more · ${rest.length} more section${rest.length > 1 ? "s" : ""}`}
        </button>
      )}
    </motion.div>
  );
}