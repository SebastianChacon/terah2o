"use client";

import { useState, useCallback, useRef } from "react";

interface Toast {
  message: string;
  type: "info" | "error" | "success";
  visible: boolean;
}

export function useToast() {
  const [toast, setToast] = useState<Toast>({
    message: "",
    type: "info",
    visible: false,
  });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback(
    (message: string, type: "info" | "error" | "success" = "info") => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast({ message, type, visible: true });
      timerRef.current = setTimeout(() => {
        setToast((prev) => ({ ...prev, visible: false }));
      }, 5000);
    },
    []
  );

  return { toast, showToast };
}
