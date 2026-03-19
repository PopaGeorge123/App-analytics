interface HowItWorksStepProps {
  step: number;
  title: string;
  description: string;
}

export default function HowItWorksStep({ step, title, description }: HowItWorksStepProps) {
  return (
    <div className="relative flex flex-col gap-4">
      {/* Step number */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#00d4aa]/40 bg-[#00d4aa]/10 font-mono text-xs font-bold text-[#00d4aa]">
          {String(step).padStart(2, "0")}
        </div>
        <div className="h-px flex-1 bg-linear-to-r from-[#00d4aa]/20 to-transparent" />
      </div>

      {/* Content */}
      <div>
        <h3 className="mb-2 font-mono text-sm font-semibold uppercase tracking-wider text-[#f0f0f5]">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-[#8888aa]">{description}</p>
      </div>
    </div>
  );
}
