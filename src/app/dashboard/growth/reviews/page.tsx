import Link from "next/link";
import { ReviewApprovalCenter } from "@/components/reputation/review-approval-center";
import { getReviewApprovals } from "@/lib/reputation/review-approval-service";
import {
  decideReviewDraftAction,
  generateReviewDraftAction,
  publishReviewDraftAction,
  saveReviewDraftAction,
} from "./review-draft-actions";
import { QmapsReviewConnection } from "@/components/reputation/qmaps-review-connection";
import { getQmapsReviewConnections } from "@/lib/qmaps/review-sync";
import { ReviewWorkspaceNavigation } from "@/components/reputation/review-workspace-navigation";
import { ReviewSourceDirectory } from "@/components/reputation/review-source-directory";
import { ReviewImportWorkspace } from "@/components/reputation/review-import-workspace";
import { getReviewImportLocations } from "@/lib/reputation/import-service";
import { ReviewCockpit } from "@/components/reputation/review-cockpit";
import { getReviewCockpit } from "@/lib/reputation/cockpit";
import type { CockpitSnapshot } from "@/lib/reputation/cockpit-model";
import { ConnectorGrid } from "@/components/growth/connector-card";
import { GrowthHeader, HonestyNote } from "@/components/growth/growth-header";
import { ReviewRequestBuilder } from "@/components/growth/review-request-builder";
import { GoogleBusinessPanel } from "@/components/reputation/google-business-panel";
import { ReputationWorkspace } from "@/components/reputation/reputation-workspace";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireGrowthAccess } from "@/lib/growth/access";
import { getConnectorStatuses } from "@/lib/growth/status";
import { publicAppOrigin } from "@/lib/growth/public-origin";
import {
  growthSmsConfigured,
  growthWhatsAppConfigured,
} from "@/lib/messaging/delivery";
import {
  getGoogleBusinessSnapshot,
  type GoogleBusinessSnapshot,
} from "@/lib/integrations/google-business/service";
import {
  getReputationSnapshot,
  type ReputationSnapshot,
} from "@/lib/reputation/service";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";

export const dynamic = "force-dynamic";

function readRecords<T>(
  result: PromiseSettledResult<T>,
  error: string,
): T | null {
  if (result.status === "fulfilled") return result.value;
  console.error(error);
  return null;
}

export default async function ReputationPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const googleNotice = (await searchParams).google ?? null;
  const { access, showSetupDetails } = await requireGrowthAccess(
    "/dashboard/growth/reviews",
  );
  const scoped =
    access.mode === "client_scoped" &&
    hasEffectivePermission(access, "view_reputation");
  const canManage =
    scoped && hasEffectivePermission(access, "manage_reputation");
  let approvals: Awaited<ReturnType<typeof getReviewApprovals>> | null = null;
  let snapshot: ReputationSnapshot | null = null;
  let google: GoogleBusinessSnapshot | null = null;
  let cockpit: CockpitSnapshot | null = null;
  let qmapsConnections: Awaited<
    ReturnType<typeof getQmapsReviewConnections>
  > | null = null;
  let importLocations: Awaited<
    ReturnType<typeof getReviewImportLocations>
  > | null = null;
  let unavailable = false;
  let googleUnavailable = false;
  if (scoped) {
    const [
      approvalResult,
      reputationResult,
      googleResult,
      cockpitResult,
      qmapsResult,
      importResult,
    ] = await Promise.allSettled([
      getReviewApprovals(access.activeClientId),
      getReputationSnapshot(access.activeClientId),
      getGoogleBusinessSnapshot(access.activeClientId),
      getReviewCockpit(access.activeClientId),
      getQmapsReviewConnections(access.activeClientId),
      canManage
        ? getReviewImportLocations(access.activeClientId)
        : Promise.resolve(null),
    ]);
    approvals = readRecords(
      approvalResult,
      "[reputation] approval data unavailable",
    );
    snapshot = readRecords(
      reputationResult,
      "[reputation] request snapshot unavailable",
    );
    google = readRecords(
      googleResult,
      "[reputation] Google snapshot unavailable",
    );
    cockpit = readRecords(cockpitResult, "[reputation] cockpit unavailable");
    qmapsConnections = readRecords(
      qmapsResult,
      "[reputation] QMAPS connections unavailable",
    );
    importLocations = readRecords(
      importResult,
      "[reputation] import locations unavailable",
    );
    unavailable = reputationResult.status === "rejected";
    googleUnavailable = googleResult.status === "rejected";
  }
  const connectors = getConnectorStatuses().filter(
    (c) =>
      c.category === "reviews" ||
      c.key === "twilio_sms" ||
      c.key === "whatsapp",
  );

  return (
    <div className="space-y-6">
      <GrowthHeader
        title="Reputation & Reviews"
        description="Listen to every customer, follow up thoughtfully, and manage your reputation through the TAKATAK ecosystem."
        badges={[
          {
            label: scoped
              ? snapshot || cockpit || google
                ? "Workspace records"
                : "Workspace data unavailable"
              : "Workspace selection required",
            tone: "neutral",
          },
        ]}
        actions={
          <Link
            href="/dashboard/local-listings/reviews"
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:border-indigo-300"
          >
            Tracked reviews →
          </Link>
        }
      />

      <ReviewWorkspaceNavigation
        initialSection={googleNotice ? "connections" : "inbox"}
        inbox={
          <ReviewCockpit
            key={
              access.mode === "client_scoped"
                ? access.activeClientId
                : "unscoped"
            }
            snapshot={cockpit}
            canManage={canManage}
            approvalRuns={approvals || []}
            googleDrafts={Object.fromEntries(
              (google?.reviews || []).flatMap((review) =>
                review.aiDraft ? [[review.id, review.aiDraft]] : [],
              ),
            )}
          />
        }
        approvals={
          scoped ? (
            <ReviewApprovalCenter
              key={access.activeClientId}
              runs={approvals || []}
              canApprove={
                canManage && hasEffectivePermission(access, "approve_content")
              }
              canManage={canManage}
              unavailable={approvals === null}
              decisionAction={decideReviewDraftAction}
              editAction={saveReviewDraftAction}
              generationAction={generateReviewDraftAction}
              publicationAction={publishReviewDraftAction}
            />
          ) : (
            <HonestyNote>
              Sélectionnez un espace client autorisé pour consulter ses réponses
              IA.
            </HonestyNote>
          )
        }
        requests={
          <>
            <div id="first-party-feedback" className="scroll-mt-24" />
            {snapshot ? (
              <ReputationWorkspace
                data={snapshot}
                canManage={canManage}
                smsReady={growthSmsConfigured()}
                whatsappReady={growthWhatsAppConfigured()}
                origin={await publicAppOrigin()}
              />
            ) : (
              <HonestyNote>
                {unavailable
                  ? "The review database is not reachable right now. Tracked requests and feedback are unavailable; the direct-link builder below still works."
                  : "Select an authorized client workspace to manage review pages, tracked requests and feedback. The direct-link builder below works without one."}
              </HonestyNote>
            )}
            <Card>
              <CardHeader
                title="Quick link builder"
                subtitle="Build a direct Google review link to send yourself. Use tracked requests above when you need request activity."
              />
              <CardBody>
                <ReviewRequestBuilder />
              </CardBody>
            </Card>
            <HonestyNote>
              Every rating receives the public review option. Automatic delivery
              requires configured messaging providers; a created link alone does
              not mean a message was sent.
            </HonestyNote>
          </>
        }
        imports={
          canManage ? (
            importLocations !== null ? (
              <ReviewImportWorkspace locations={importLocations} />
            ) : (
              <HonestyNote>
                Import locations could not be loaded. Retry later; no reviews
                have been imported from this form.
              </HonestyNote>
            )
          ) : (
            <HonestyNote>
              {scoped
                ? "Managing reputation is required to import reviews into this workspace."
                : "Select an authorized client workspace to import reviews."}
            </HonestyNote>
          )
        }
        connections={
          <>
            {google ? (
              <GoogleBusinessPanel
                data={google}
                canManage={canManage}
                notice={
                  googleNotice && /^[a-z_0-9]{1,40}$/.test(googleNotice)
                    ? googleNotice
                    : null
                }
              />
            ) : (
              <HonestyNote>
                {googleUnavailable
                  ? "Google Business connection data is temporarily unavailable. Retry before changing its connection."
                  : "Select an authorized client workspace to manage its Google Business connection."}
              </HonestyNote>
            )}
            {qmapsConnections !== null ? (
              <QmapsReviewConnection
                connections={qmapsConnections}
                canManage={canManage}
              />
            ) : (
              <HonestyNote>
                {scoped
                  ? "Les liens QMAPS sont temporairement indisponibles."
                  : "Sélectionnez un espace autorisé pour consulter ses connexions QMAPS."}
              </HonestyNote>
            )}
            <ReviewSourceDirectory />
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Review sources & delivery channels
              </h2>
              <ConnectorGrid
                connectors={connectors}
                showSetupDetails={showSetupDetails}
              />
            </section>
            <HonestyNote>
              Provider publishing requires an authorized connection and source
              approval. Operator imports are separately marked and do not
              establish a live provider connection.
            </HonestyNote>
          </>
        }
      />
    </div>
  );
}
