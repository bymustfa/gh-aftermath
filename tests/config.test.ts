import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/config.js";

describe("config", () => {
  it("turns on demo mode from the flag or the environment", () => {
    expect(parseConfig({}, ["--demo"]).demo).toBe(true);
    expect(parseConfig({ DEMO: "1" }, []).demo).toBe(true);
    expect(parseConfig({ DEMO: "1" }, []).org).toBe("northwind");
  });

  it("reads the port, org, and escaped app key", () => {
    const config = parseConfig(
      { GITHUB_APP_PRIVATE_KEY: "-----BEGIN RSA PRIVATE KEY-----\\nabc\\n-----END RSA PRIVATE KEY-----" },
      ["--port", "9000", "--org", "acme", "--host", "127.0.0.1"],
    );
    expect(config.port).toBe(9000);
    expect(config.org).toBe("acme");
    expect(config.host).toBe("127.0.0.1");
    expect(config.privateKey).toContain("\nabc\n");
  });

  it("rejects an unknown flag and a bad port", () => {
    expect(() => parseConfig({}, ["--nope"])).toThrow(/Unknown argument/);
    expect(() => parseConfig({}, ["--port", "0"])).toThrow(/positive integer/);
  });
});
