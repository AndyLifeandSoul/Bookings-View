const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
const MONTHS = [
  { value: "01", label: "Jan" },
  { value: "02", label: "Feb" },
  { value: "03", label: "Mar" },
  { value: "04", label: "Apr" },
  { value: "05", label: "May" },
  { value: "06", label: "Jun" },
  { value: "07", label: "Jul" },
  { value: "08", label: "Aug" },
  { value: "09", label: "Sep" },
  { value: "10", label: "Oct" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dec" },
];

/**
 * Three plain <select>s (day, month, year) instead of a native
 * <input type="date">. Same root cause as TimeFieldSelect: Safari's native
 * date picker can display what looks like a filled-in date (today's date
 * shown as a hint) without the field actually holding a value, so its own
 * `required` check then blocks the submit with "fill out this field" -
 * and because that native validation fires before React/the server action
 * ever sees the submit, the values the user *did* type into the rest of
 * the form were never the problem, but losing them on a blocked submit
 * reads as the whole form being wiped. Three ordinary selects can't be
 * ambiguously "filled", and validation of a genuinely incomplete date
 * happens in the server action instead (an inline error message, not a
 * native popup), which never touches the rest of the form's values.
 *
 * Submits as `${name}-day`, `${name}-month`, `${name}-year`, composed back
 * into a single "YYYY-MM-DD" string server-side.
 */
export function DateFieldSelect({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const [defaultYear, defaultMonth, defaultDay] = (defaultValue ?? "").split("-");
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1, currentYear + 2];

  return (
    <span className="inline-flex items-center gap-1">
      <select
        name={`${name}-day`}
        defaultValue={defaultDay ?? ""}
        className="rounded-md border border-zinc-300 px-1.5 py-2 text-sm"
      >
        <option value="">Day</option>
        {DAYS.map((day) => (
          <option key={day} value={day}>
            {day}
          </option>
        ))}
      </select>
      <select
        name={`${name}-month`}
        defaultValue={defaultMonth ?? ""}
        className="rounded-md border border-zinc-300 px-1.5 py-2 text-sm"
      >
        <option value="">Month</option>
        {MONTHS.map((month) => (
          <option key={month.value} value={month.value}>
            {month.label}
          </option>
        ))}
      </select>
      <select
        name={`${name}-year`}
        defaultValue={defaultYear ?? ""}
        className="rounded-md border border-zinc-300 px-1.5 py-2 text-sm"
      >
        <option value="">Year</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </span>
  );
}
