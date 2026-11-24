import { registerAs } from "@nestjs/config";

export interface ApiConfiguration {
  host: string;
  port: number;
  origins: string[];
  /** Express "trust proxy" value; 0 (off) unless behind a proxy. */
  trustProxy: number;
}

export const apiConfig = registerAs("api", (): ApiConfiguration => {
  const port = Number(process.env.API_PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("API_PORT must be an integer between 1 and 65535.");
  }
  const trustProxy = Number(process.env.TRUST_PROXY || 0);
  if (!Number.isInteger(trustProxy) || trustProxy < 0) {
    throw new Error("TRUST_PROXY must be the number of proxies (0 if none).");
  }

  return {
    host: process.env.API_HOST ?? "127.0.0.1",
    port,
    origins: (
      process.env.WEB_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000"
    )
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    trustProxy,
  };
});
