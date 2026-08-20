'use client';

import { colors } from '@/lib/theme/colors';

type Props = {
  title: string;
  description: string;
  upcoming: string[];
};

export default function EmployerPlaceholderPage({
  title,
  description,
  upcoming,
}: Props) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#EEF0F8] bg-white p-8 shadow-sm">
        <span
          className="inline-flex rounded-full bg-[#FFF3E0] px-3 py-1 text-xs font-semibold text-[#EF6C00]"
          style={{ fontFamily: 'var(--font-poppins)' }}
        >
          Coming soon
        </span>
        <h2
          className="mt-4 text-xl font-semibold"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          {title}
        </h2>
        <p
          className="mt-3 max-w-2xl text-base leading-relaxed"
          style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
        >
          {description}
        </p>
      </div>

      <div className="rounded-2xl border border-[#EEF0F8] bg-white p-6 shadow-sm">
        <h3
          className="text-base font-semibold"
          style={{ color: colors.navy, fontFamily: 'var(--font-poppins)' }}
        >
          Planned for this section
        </h3>
        <ul
          className="mt-3 list-disc space-y-1.5 pl-5 text-sm"
          style={{ color: colors.body, fontFamily: 'var(--font-poppins)' }}
        >
          {upcoming.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
