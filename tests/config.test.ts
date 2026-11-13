import { describe, expect, it } from "vitest";
import { hasLiveCredentials, helpText, parseConfig } from "../src/config.js";

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

  it("tells people to run from a checkout until the package is published", () => {
    const help = helpText();
    expect(help).toContain("git clone https://github.com/bymustfa/gh-aftermath.git");
    expect(help).toContain("npm ci");
    expect(help).toContain("npm run build");
    expect(help).toContain("npm start");
    expect(help).toContain("npm start -- --demo");
    expect(help).toContain("docker build -t gh-aftermath .");
    expect(help).toContain("docker run --rm -p 8787:8787 gh-aftermath --demo");
    const coming = help.indexOf("Coming soon");
    const npx = help.indexOf("npx gh-aftermath");
    expect(coming).toBeGreaterThan(-1);
    expect(npx).toBeGreaterThan(coming);
    expect(help.indexOf("git clone")).toBeLessThan(npx);
  });

  it("treats a missing token as a reason to ask in the page", () => {
    expect(hasLiveCredentials(parseConfig({}, []))).toBe(false);
    expect(hasLiveCredentials(parseConfig({ GITHUB_TOKEN: "ghp_exampletoken" }, []))).toBe(true);
    expect(
      hasLiveCredentials(
        parseConfig(
          {
            GITHUB_APP_ID: "1",
            GITHUB_APP_PRIVATE_KEY: "-----BEGIN KEY-----\\nabc\\n-----END KEY-----",
            GITHUB_APP_INSTALLATION_ID: "2",
          },
          [],
        ),
      ),
    ).toBe(true);
    expect(hasLiveCredentials(parseConfig({ GITHUB_APP_ID: "1" }, []))).toBe(false);
  });
});
