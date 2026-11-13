import { describe, expect, it } from "vitest";
import { clientSource } from "../src/ui/client.js";

describe("recovery page client", () => {
  it("clears a validation error when the inputs change or a scan is submitted", () => {
    expect(clientSource).toContain("function clearStaleError()");
    expect(clientSource).toContain('node.className.indexOf("error")');
    expect(clientSource).toContain('addEventListener("input", clearStaleError)');
    expect(clientSource).toContain('addEventListener("change", clearStaleError)');
    const scan = clientSource.slice(clientSource.indexOf("async function scan"));
    expect(scan.indexOf("clearStaleError()")).toBeLessThan(scan.indexOf("fetch("));
  });

  it("shows conflicting dry-run plans from this batch", () => {
    expect(clientSource).toContain("body.conflicts");
    expect(clientSource).toContain('typeof summary.planned === "number"');
  });
});
