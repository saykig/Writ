"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

/**
 * ThemeToggle — flips between the explicit light and dark themes via
 * next-themes. Both icons render server-side and swap purely on the `.dark`
 * class (Tailwind `dark:` variant), so there is no mount flash or hydration
 * mismatch; the click handler reads the resolved theme to decide the flip.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Toggle light and dark theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </Button>
  );
}
