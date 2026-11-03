import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Session, User } from "../api/types";

const SessionContext = createContext<User | null>(null);
export function useUser() {
  const user = useContext(SessionContext);
  if (!user) throw new Error("Сессия недоступна");
  return user;
}
export const useSession = () =>
  useQuery({
    queryKey: ["session"],
    queryFn: () => api<Session>("auth/session/"),
    staleTime: 300_000,
    retry: false,
  });
export function SessionProvider({
  user,
  children,
}: {
  user: User;
  children: ReactNode;
}) {
  return (
    <SessionContext.Provider value={user}>{children}</SessionContext.Provider>
  );
}
