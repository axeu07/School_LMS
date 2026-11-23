import { registerAs } from "@nestjs/config";

export interface ApiConfiguration {
  host: string;
  port: number;
  origins: string[];
}

export const apiConfig = registerAs("api", (): ApiConfiguration => {
  const port = Number(process.env.API_PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("API_PORT must be an integer between 1 and 65535.");
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
  };
});
