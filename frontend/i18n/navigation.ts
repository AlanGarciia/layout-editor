import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Link, useRouter, usePathname, etc. que respetan el idioma activo.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);