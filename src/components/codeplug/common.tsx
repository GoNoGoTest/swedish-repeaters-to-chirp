import type { ReactNode } from "react";

export function Section({ title, subtitle, right, children }: {
  title: string; subtitle?: string; right?: ReactNode; children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-1 max-w-3xl">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{children}</div>;
}

export function Stat({ label, value, tooltip }: { label: string; value: number | string; tooltip?: string }) {
  return (
    <div
      className={`rounded border border-border bg-background px-3 py-2 ${tooltip ? "cursor-help" : ""}`}
      title={tooltip}
    >
      <div className="text-xs text-muted-foreground">
        {label}
        {tooltip ? <span aria-hidden className="ml-1 text-muted-foreground/60">ⓘ</span> : null}
      </div>
      <div className="font-mono text-lg">{value}</div>
    </div>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{children}</p>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {children}
      {hint && <Hint>{hint}</Hint>}
    </div>
  );
}

export function NumberField({ label, value, onChange, step = 1, hint }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input type="number" value={value} step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded border border-input bg-background px-2 py-1 text-sm font-mono" />
    </Field>
  );
}

export function MultiSelect({ label, options, value, onChange }: {
  label: string; options: string[]; value: string[]; onChange: (v: string[]) => void;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <button key={o} type="button"
              onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
              className={`rounded border px-2 py-0.5 text-xs font-mono ${on ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background"}`}>
              {o || "(tom)"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LimitChip({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="rounded border border-border bg-muted/40 px-2 py-0.5 font-mono text-[11px]">
      <span className="text-muted-foreground">{label}:</span> {value}
    </span>
  );
}
