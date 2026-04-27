// components/dashboard/TemplatesCarousel.tsx
"use client";

import Link from "next/link";
import { LOGISTICS_TEMPLATES } from "@/lib/training-utils";

export default function TemplatesCarousel() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {LOGISTICS_TEMPLATES.map((t) => (
        <Link
          key={t.id}
          href={`/train?template=${t.id}`}
          className="cyber-card p-4 hover:border-cyan-neon/25 transition-all group cursor-pointer"
        >
          <div className="text-2xl mb-3">{t.icon}</div>
          <div
            className={`font-display text-xs font-bold mb-2 tracking-wide ${
              t.color === "cyan" ? "text-cyan-neon" : "text-magenta-neon"
            }`}
          >
            {t.name}
          </div>
          <p className="font-body text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
            {t.description}
          </p>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-muted-foreground">
              ~{t.estimatedRows} examples
            </span>
            <span className="font-mono text-[10px] text-cyan-neon opacity-0 group-hover:opacity-100 transition-opacity">
              USE →
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
