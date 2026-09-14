"use client";

import type { ReactNode } from "react";
import { Button, type ButtonVariant } from "@/components/ui";

/** Submit button that asks for confirmation before its form submits. */
export function ConfirmButton({
  message,
  children,
  variant = "danger",
  className,
}: {
  message: string;
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
}) {
  return (
    <Button
      type="submit"
      variant={variant}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </Button>
  );
}
