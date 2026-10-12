// Anti-spam honeypot (T7g). Real users never see or fill this field; naive bots do.
// Neutral, non-contact name so browsers/password managers do not autofill it.
export const HONEYPOT_FIELD = "hp_field";

export function HoneypotField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", top: "auto", width: "1px", height: "1px", overflow: "hidden" }}>
      <input type="text" name={HONEYPOT_FIELD} id={HONEYPOT_FIELD} autoComplete="off" tabIndex={-1} aria-hidden="true" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
