const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

/**
 * Two plain <select>s (hour, minute) instead of a native <input type="time">.
 * Andy hit a real bug on this: in Safari, typing a 24-hour time like
 * "02:00" or "15:00" into the native time picker doesn't reliably register
 * before the form submits, so it silently resubmits whatever value was
 * already there - confirmed via Railway's request logs, every save came
 * back a normal 200 with no server error, so the server side was always
 * fine, it was the browser's own picker losing the keystrokes. Two
 * ordinary selects have no typing or locale ambiguity to get wrong, so
 * this sidesteps the bug rather than working around one browser's picker.
 *
 * Submits as `${name}-hour` and `${name}-minute`, composed back into a
 * single "HH:mm" string server-side (see saveWeeklyHours/addOverride in
 * hours/actions.ts) - the form-field contract with the server actions is
 * unchanged apart from that split.
 *
 * `optional` adds a blank leading option to the hour select for a field
 * that can be left empty (e.g. an override's start/end time, where blank
 * means "not entered" rather than midnight) - server-side, an empty hour
 * value is the signal that nothing was picked, the minute is ignored in
 * that case.
 */
export function TimeFieldSelect({
  name,
  defaultValue,
  optional,
}: {
  name: string;
  defaultValue?: string;
  optional?: boolean;
}) {
  const [defaultHour, defaultMinute] = (defaultValue ?? "").split(":");
  return (
    <span className="inline-flex items-center gap-1">
      <select
        name={`${name}-hour`}
        defaultValue={defaultHour ?? ""}
        className="rounded-md border border-zinc-300 px-1.5 py-2 text-sm"
      >
        {optional && <option value="">--</option>}
        {HOURS.map((hour) => (
          <option key={hour} value={hour}>
            {hour}
          </option>
        ))}
      </select>
      <span className="text-zinc-400">:</span>
      <select
        name={`${name}-minute`}
        defaultValue={defaultMinute ?? "00"}
        className="rounded-md border border-zinc-300 px-1.5 py-2 text-sm"
      >
        {MINUTES.map((minute) => (
          <option key={minute} value={minute}>
            {minute}
          </option>
        ))}
      </select>
    </span>
  );
}
