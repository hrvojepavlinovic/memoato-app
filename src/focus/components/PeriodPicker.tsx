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
    <div className="flex w-full rounded-xl border border-neutral-200 bg-white p-1 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 sm:inline-flex sm:w-auto">
      {periods.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onChange(p.key)}
          className={[
            "flex-1 px-3 py-1.5 text-sm font-semibold sm:flex-none",
            "rounded-lg transition-colors",
            value === p.key
              ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
              : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800",
          ].join(" ")}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
