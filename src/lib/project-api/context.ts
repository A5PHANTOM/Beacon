import { AsyncLocalStorage } from "node:async_hooks";
import type { Session } from "next-auth";

// Set only by the authenticated API dispatcher, never from action arguments.
export const apiSession = new AsyncLocalStorage<Session>();
