import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HoneypotField, HONEYPOT_FIELD } from "../honeypot";

describe("HoneypotField", () => {
  const html = renderToStaticMarkup(createElement(HoneypotField, { value: "", onChange: () => {} }));

  it("renders an input browsers will not autofill and keyboard/screen readers skip", () => {
    expect(html).toContain(`name="${HONEYPOT_FIELD}"`);
    expect(html).toMatch(/<input[^>]*autocomplete="off"/i);
    expect(html).toMatch(/<input[^>]*tabindex="-1"/i);
    expect(html).toMatch(/<input[^>]*aria-hidden="true"/i);
    expect(html).toMatch(/<div aria-hidden="true" style="position:absolute;left:-10000px/);
  });

  it("uses a neutral, non-contact field name", () => {
    expect(HONEYPOT_FIELD).not.toMatch(/mail|phone|tel|whats|name|url|address|website/i);
  });

  it("is rendered inside the lead form and sent in the payload", () => {
    const page = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
    expect(page).toContain("<HoneypotField value={hp} onChange={setHp} />");
    expect(page).toContain("[HONEYPOT_FIELD]: hp");
  });
});
