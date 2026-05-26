"use client";

import { SessionProvider } from "next-auth/react";
import { usePathname } from "next/navigation";

export function ConditionalSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname === "/" || pathname?.startsWith("/legislativo-chat")) {
    return <>{children}</>;
  }

  return (
    <SessionProvider
      basePath={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/auth`}
    >
      {children}
    </SessionProvider>
  );
}