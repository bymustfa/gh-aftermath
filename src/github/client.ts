import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "octokit";

export interface Logger {
  info: (message: string) => void;
  warn: (message: string) => void;
}

export const consoleLogger: Logger = {
  info: (message) => console.info(message),
  warn: (message) => console.warn(message),
};

export interface GitHubAuth {
  token?: string;
  appId?: string;
  privateKey?: string;
  installationId?: string;
}

type ThrottleHandler = (
  retryAfter: number,
  options: { method: string; url: string },
  octokit: unknown,
  retryCount: number,
) => boolean;

function throttleHandlers(log: Logger): {
  onRateLimit: ThrottleHandler;
  onSecondaryRateLimit: ThrottleHandler;
} {
  return {
    onRateLimit: (retryAfter, options, _octokit, retryCount) => {
      log.warn(
        `Primary rate limit for ${options.method} ${options.url}. Waiting ${retryAfter}s (retry ${retryCount}).`,
      );
      return retryCount < 3;
    },
    onSecondaryRateLimit: (retryAfter, options, _octokit, retryCount) => {
      log.warn(
        `Secondary rate limit for ${options.method} ${options.url}. Waiting ${retryAfter}s (retry ${retryCount}).`,
      );
      return retryCount < 3;
    },
  };
}

function buildOctokit(auth: { token: string } | { strategy: true; appId: string; privateKey: string; installationId?: string }, log: Logger): Octokit {
  const throttle = throttleHandlers(log);
  if ("token" in auth) {
    return new Octokit({
      auth: auth.token,
      throttle,
      log: {
        debug: () => undefined,
        info: (message: unknown) => log.info(String(message)),
        warn: (message: unknown) => log.warn(String(message)),
        error: (message: unknown) => log.warn(String(message)),
      },
    });
  }
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: auth.appId,
      privateKey: auth.privateKey,
      ...(auth.installationId ? { installationId: auth.installationId } : {}),
    },
    throttle,
    log: {
      debug: () => undefined,
      info: (message: unknown) => log.info(String(message)),
      warn: (message: unknown) => log.warn(String(message)),
      error: (message: unknown) => log.warn(String(message)),
    },
  });
}

export interface GitHubClients {
  /** Repositories, organization hooks, and Actions. */
  user: Octokit | null;
  /** App JWT for `/app/hook` deliveries. */
  app: Octokit | null;
}

export function createGitHubClients(auth: GitHubAuth, log: Logger = consoleLogger): GitHubClients {
  const hasApp = Boolean(auth.appId && auth.privateKey);
  const user = auth.token
    ? buildOctokit({ token: auth.token }, log)
    : hasApp && auth.installationId
      ? buildOctokit(
          {
            strategy: true,
            appId: auth.appId ?? "",
            privateKey: auth.privateKey ?? "",
            installationId: auth.installationId,
          },
          log,
        )
      : null;
  const app = hasApp
    ? buildOctokit(
        {
          strategy: true,
          appId: auth.appId ?? "",
          privateKey: auth.privateKey ?? "",
        },
        log,
      )
    : null;
  if (!user && !app) {
    throw new Error("Set GITHUB_TOKEN or a GitHub App id, private key, and installation id.");
  }
  return { user, app };
}
