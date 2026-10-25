"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
const PortalContext = createContext<HTMLDivElement | null>(null);
export const useModernPortal = () => useContext(PortalContext);
export function ModernBoundary({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <div className="ii-modern">
      <PortalContext.Provider value={host}>
        {children}
        <div ref={setHost} />
      </PortalContext.Provider>
    </div>
  );
}
