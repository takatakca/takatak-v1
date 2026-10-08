import type { Metadata } from "next";

import { Link } from "@/lib/website/nav";
import { parseBlogHost } from "@/lib/social/connections/blog-page";
import { loadPublicTakatakBlog } from "@/lib/social/connections/blog-connection";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ host: string }>;
}): Promise<Metadata> {
  const { host: rawHost } = await params;
  const host = parseBlogHost(rawHost);
  const blog = host ? await loadPublicTakatakBlog(host) : null;

  if (!blog) {
    return {
      title: "Blog",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: blog.title,
    description: `Blog page created by TAKATAK for ${blog.host}.`,
  };
}

export default async function ConnectedBlogPage({
  params,
}: {
  params: Promise<{ host: string }>;
}) {
  const { host: rawHost } = await params;
  const host = parseBlogHost(rawHost);
  const blog = host ? await loadPublicTakatakBlog(host) : null;

  if (!blog) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="text-sm font-medium text-muted-foreground">
          <Link to="/blog" className="hover:text-foreground">
            TAKATAK Blog
          </Link>
        </p>
        <h1 className="mt-3 text-4xl font-bold text-foreground">
          This blog page is not available
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          No TAKATAK blog is connected for this website.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-sm font-medium text-muted-foreground">
        <Link to="/blog" className="hover:text-foreground">
          TAKATAK Blog
        </Link>
      </p>
      <h1 className="mt-3 text-4xl font-bold text-foreground">{blog.title}</h1>
      <p className="mt-4 text-lg leading-8 text-muted-foreground">
        This blog page was created by TAKATAK for{" "}
        <a
          href={blog.siteUrl}
          className="font-medium text-foreground underline-offset-4 hover:underline"
          rel="noreferrer"
        >
          {blog.siteUrl}
        </a>
        .
      </p>

      <section className="mt-12 rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
        <h2 className="text-lg font-semibold text-foreground">No posts yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Posts published for this website will appear here. The page is already
          live and linked to the connected site.
        </p>
      </section>
    </div>
  );
}
