import type { Metadata } from "next";

import { Link } from "@/lib/website/nav";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "The TAKATAK blog, and a blog page for every website you connect.",
};

export default function TakatakBlogPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-sm font-medium text-muted-foreground">TAKATAK</p>
      <h1 className="mt-3 text-4xl font-bold text-foreground">Blog</h1>
      <p className="mt-4 text-lg leading-8 text-muted-foreground">
        Notes on websites, hosting, and the services a growing business runs
        from one place.
      </p>

      <article className="mt-12 rounded-2xl border border-border bg-card p-8">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Product
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-foreground">
          A blog page for every connected website
        </h2>
        <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
          <p>
            Verify a website in TAKATAK, then create its blog page. The page
            lives on TAKATAK and stays linked to the site you already proved
            you can publish.
          </p>
          <p>
            The blog page uses the website address as its name. Posts for that
            site will be published here. Until the first post, the page is the
            public home for that blog.
          </p>
        </div>
        <div className="mt-6">
          <Link
            to="/dashboard/social/blog"
            className="inline-flex rounded-md px-4 py-2 text-sm font-medium text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-hero)" }}
          >
            Create a blog page
          </Link>
        </div>
      </article>

      <section className="mt-8 rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
        <h2 className="text-lg font-semibold text-foreground">No posts yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Posts published on the TAKATAK blog will appear here.
        </p>
      </section>
    </div>
  );
}
