import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isTrocarSenhaPage = req.nextUrl.pathname === "/trocar-senha";

    if (token?.mustChangePassword && !isTrocarSenhaPage) {
      return NextResponse.redirect(new URL("/trocar-senha", req.url));
    }
  },
  {
    pages: {
      signIn: "/login",
    },
  },
);

export const config = {
  matcher: ["/dashboard/:path*", "/trocar-senha"],
};
