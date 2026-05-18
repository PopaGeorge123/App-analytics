import { type LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export default function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[#d8d8f0] bg-[#ffffff]/60 p-6 backdrop-blur-sm transition-all duration-300 hover:border-[#00d4aa]/30 hover:bg-[#ffffff]/80 hover:shadow-[0_0_30px_rgba(0,212,170,0.06)]">
      {/* Subtle gradient shine on hover */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(ellipse_at_top_left,rgba(0,212,170,0.05)_0%,transparent_60%)]" />

      <div className="relative">
        {/* Icon */}
        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#d8d8f0] bg-[#f8f8fc] text-[#00d4aa] transition-colors group-hover:border-[#00d4aa]/30 group-hover:bg-[#f0f8f4]">
          <Icon size={18} strokeWidth={1.5} />
        </div>

        {/* Title */}
        <h3 className="mb-2 font-mono text-sm font-semibold tracking-wide text-[#2a2a3e] uppercase">
          {title}
        </h3>

        {/* Description */}
        <p className="text-sm leading-relaxed text-[#6666880]" style={{ color: "#66668880" }}>
          <span className="text-[#8888aa]">{description}</span>
        </p>
      </div>
    </div>
  );
}
