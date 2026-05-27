"use client";

import { usePathname } from "next/navigation";
import { SessionProvider } from "next-auth/react";

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
