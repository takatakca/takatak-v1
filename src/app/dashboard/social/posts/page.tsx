import { PostList } from "@/components/social/post-list";
import { PostStatusBoard } from "@/components/social/post-status-board";
import { SocialEmptyState } from "@/components/social/social-empty-state";
import { SocialHeader } from "@/components/social/social-header";
import { SourceBanner } from "@/components/social/source-banner";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { getSocialOverviewData, getSocialPostsData } from "@/lib/social/social-data";

export const dynamic = "force-dynamic";

export default async function SocialPostsPage() {
  const [data, overview, { access }] = await Promise.all([
    getSocialPostsData(),
    getSocialOverviewData(),
    getServerAccessContext(),
  ]);
  const canPublish =
    data.source === "database" && access.mode === "client_scoped" && hasEffectivePermission(access, "approve_content");
  return (
    <div className="space-y-5">
      <SocialHeader
        title="Publications · Posts"
        subtitle="Brouillons, approbations et reçus de publication. Une publication approuvée sur une page Facebook peut partir tout de suite ou à l’heure choisie ; chacune est vérifiée auprès de Facebook · Drafts, approvals and publication receipts."
        badges={[{ label: "Pages Facebook en marche · Facebook Pages live" }]}
      />
      <SourceBanner source={data.source} label={data.sourceLabel} />
      {data.posts.length ? <PostList posts={data.posts} canPublish={canPublish} /> : (
        <SocialEmptyState title="Aucune publication pour l’instant · No posts yet" description="Les brouillons paraissent ici · Post drafts appear here." />
      )}
      <PostStatusBoard pipeline={overview.pipeline} />
    </div>
  );
}
