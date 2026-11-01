import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { ReputationSnapshot } from "@/lib/reputation/service";

const CHANNELS = {
  link: "Shared link",
  sms: "SMS",
  whatsapp: "WhatsApp",
  email: "Email",
} as const;

function Timestamp({ value }: { value: Date | null }) {
  return value ? (
    <time dateTime={value.toISOString()}>
      {value.toLocaleString("en-CA", {
        timeZone: "America/Toronto",
        dateStyle: "medium",
        timeStyle: "short",
      })}
    </time>
  ) : (
    <span aria-label="Not recorded">—</span>
  );
}

/** Read-only trace of actual request records; provider acceptance is not delivery. */
export function ReviewDeliveryHistory({
  requests,
  now = new Date(),
}: {
  requests: ReputationSnapshot["requestHistory"];
  now?: Date;
}) {
  return (
    <Card>
      <CardHeader
        title="Review request activity"
        subtitle="Latest 50 tracked requests in this workspace. Times shown in Eastern Time."
      />
      <CardBody>
        <p className="mb-4 text-xs leading-5 text-slate-500">
          Provider accepted means the send API accepted a request. It does not
          confirm delivery to the customer. Shared links, SMS and email sent
          outside TAKATAK have no automatic sending receipt.
        </p>
        {!requests.length ? (
          <p className="py-4 text-sm text-slate-500">
            No tracked requests yet. Create a request above to start following
            its activity.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <caption className="sr-only">
                Latest review requests, source sending outcomes and first-party
                engagement timestamps
              </caption>
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th scope="col" className="pb-3 pr-4 font-medium">
                    Review page / recipient
                  </th>
                  <th scope="col" className="pb-3 pr-4 font-medium">
                    Channel
                  </th>
                  <th scope="col" className="pb-3 pr-4 font-medium">
                    Send outcome
                  </th>
                  <th scope="col" className="pb-3 pr-4 font-medium">
                    Link activity
                  </th>
                  <th scope="col" className="pb-3 pr-4 font-medium">
                    Created / sent
                  </th>
                  <th scope="col" className="pb-3 pr-4 font-medium">
                    Opened / rated
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const expired =
                    request.expiresAt.getTime() <= now.getTime() &&
                    request.status !== "rated";
                  return (
                    <tr
                      key={request.id}
                      className="border-b border-slate-100 align-top last:border-0"
                    >
                      <th
                        scope="row"
                        className="max-w-56 py-4 pr-4 font-normal"
                      >
                        <span className="block break-words font-semibold text-slate-900">
                          {request.profileName}
                        </span>
                        <span className="mt-1 block text-slate-500">
                          {request.recipientMasked || "Recipient not stored"}
                        </span>
                      </th>
                      <td className="py-4 pr-4 text-slate-600">
                        {CHANNELS[request.channel]}
                      </td>
                      <td className="py-4 pr-4">
                        <Badge
                          tone={
                            request.deliveryStatus === "failed"
                              ? "danger"
                              : request.deliveryStatus === "sent"
                                ? "accent"
                                : "neutral"
                          }
                        >
                          {request.deliveryStatus === "sent"
                            ? "Provider accepted"
                            : request.deliveryStatus === "failed"
                              ? "Send failed"
                              : request.deliveryStatus
                                ? "Unconfirmed outcome"
                                : "No automatic send recorded"}
                        </Badge>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="flex flex-wrap gap-1">
                          <Badge
                            tone={
                              request.status === "rated"
                                ? "success"
                                : request.status === "opened"
                                  ? "accent"
                                  : "neutral"
                            }
                          >
                            {request.status === "rated"
                              ? "First-party rating recorded"
                              : request.status === "opened"
                                ? "Link opened"
                                : "Not opened"}
                          </Badge>
                          {expired && (
                            <Badge tone="warning">Link expired</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-4 pr-4 text-slate-600">
                        <p>
                          Created: <Timestamp value={request.createdAt} />
                        </p>
                        <p className="mt-1">
                          Sent: <Timestamp value={request.sentAt} />
                        </p>
                      </td>
                      <td className="py-4 pr-4 text-slate-600">
                        <p>
                          Opened: <Timestamp value={request.openedAt} />
                        </p>
                        <p className="mt-1">
                          Rated: <Timestamp value={request.ratedAt} />
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-[11px] leading-5 text-slate-500">
          A recorded first-party rating does not confirm that a review was
          published on Google or another provider. No message is resent from
          this activity log.
        </p>
      </CardBody>
    </Card>
  );
}
