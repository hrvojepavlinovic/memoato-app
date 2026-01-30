import type { Period } from "../types";

const periods: { key: Period; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

export function PeriodPicker({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="flex w-full rounded-xl border border-neutral-200 bg-white p-1 shadow-sm sm:inline-flex sm:w-auto">
      {periods.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onChange(p.key)}
          className={[
            "flex-1 px-3 py-1.5 text-sm font-semibold sm:flex-none",
            "rounded-lg transition-colors",
            value === p.key
              ? "bg-neutral-950 text-white"
              : "text-neutral-700 hover:bg-neutral-100",
          ].join(" ")}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
