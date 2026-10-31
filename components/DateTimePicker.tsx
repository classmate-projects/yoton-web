"use client";

import DatePicker from "@/components/DatePicker";

interface DateTimePickerProps {
  value: string; // "yyyy-MM-ddTHH:mm" - the same shape <input type="datetime-local"> gives - or ""
  onChange: (value: string) => void;
  min?: string; // "yyyy-MM-dd"
  max?: string; // "yyyy-MM-dd"
  required?: boolean;
  disabled?: boolean;
  dateClassName?: string;
  timeClassName?: string;
}

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// The app's date + time field (use instead of <input type="datetime-local">): the shared
// DatePicker for the day, and a time box beside it. Picking a day before a time fills in
// the current time, so the value is always a complete date-time.
export default function DateTimePicker({
  value,
  onChange,
  min,
  max,
  required,
  disabled,
  dateClassName,
  timeClassName = "h-11 w-32 shrink-0 rounded-xl border border-input bg-card px-3 text-foreground disabled:cursor-not-allowed disabled:opacity-50",
}: DateTimePickerProps) {
  const [datePart = "", timePart = ""] = value ? value.split("T") : [];
  const time = timePart.slice(0, 5);

  return (
    <div className="flex gap-2">
      <div className="min-w-0 flex-1">
        <DatePicker
          value={datePart}
          onChange={(day) => onChange(day ? `${day}T${time || nowTime()}` : "")}
          min={min}
          max={max}
          required={required}
          disabled={disabled}
          className={dateClassName}
        />
      </div>
      <input
        type="time"
        value={time}
        onChange={(e) => {
          if (datePart && e.target.value) onChange(`${datePart}T${e.target.value}`);
        }}
        required={required}
        disabled={disabled || !datePart}
        aria-label="Time"
        className={timeClassName}
      />
    </div>
  );
}
