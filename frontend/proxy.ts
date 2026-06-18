import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // aplica a todas las rutas excepto API, estaticos, etc.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};