import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../../server/router";

export const trpc = createTRPCReact<AppRouter>();

export function getTrpcClient() {
  // في الإنتاج نستخدم مسار نسبي — في التطوير نستخدم localhost
  const baseUrl = typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:3001";

  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${baseUrl}/trpc`,
        headers() {
          const token = localStorage.getItem("cfo_token");
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        transformer: superjson,
      }),
    ],
  });
}
