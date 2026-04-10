import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../../server/router";

export const trpc = createTRPCReact<AppRouter>();

export function getTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/trpc`,
        headers() {
          const token = localStorage.getItem("cfo_token");
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        transformer: superjson,
      }),
    ],
  });
}
