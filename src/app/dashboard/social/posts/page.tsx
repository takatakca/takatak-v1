import { PostList } from "@/components/social/post-list";
import { PostStatusBoard } from "@/components/social/post-status-board";
import { SocialEmptyState } from "@/components/social/social-empty-state";
import { SocialHeader } from "@/components/social/social-header";
import { SourceBanner } from "@/components/social/source-banner";
import { getSocialOverviewData, getSocialPostsData } from "@/lib/social/social-data";

export const dynamic = "force-dynamic";

export default async function SocialPostsPage() {
  const [data, overview] = await Promise.all([getSocialPostsData(), getSocialOverviewData()]);
  return (
    <div className="space-y-5">
      <SocialHeader
        title="Posts"
        subtitle="Internal post drafts and approvals. Editing and real publishing activate in later phases — nothing here is published."
        badges={[{ label: "Foundation" }]}
      />
      <SourceBanner source={data.source} label={data.sourceLabel} />
      {data.posts.length ? <PostList posts={data.posts} /> : (
        <SocialEmptyState title="No posts yet" description="Post drafts appear here." />
      )}
      <PostStatusBoard pipeline={overview.pipeline} />
    </div>
  );
}
