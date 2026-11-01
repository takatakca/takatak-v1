import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  sourceLocationGroups,
  type ReviewRecord,
} from "@/lib/reputation/cockpit-model";

export function ReviewInsights({ records }: { records: ReviewRecord[] }) {
  const eligible = records.filter(
    (review) => review.recommended && review.rating !== null,
  );
  const locations = sourceLocationGroups(records)
    .map((group) => {
      const reviews = group.records;
      const rated = reviews.filter(
        (review) => review.recommended && review.rating !== null,
      );
      return {
        key: group.key,
        name: group.label,
        count: reviews.length,
        pending: reviews.filter((review) => review.state === "needs_reply")
          .length,
        average: rated.length
          ? (
              rated.reduce((sum, review) => sum + review.rating!, 0) /
              rated.length
            ).toFixed(1)
          : "—",
      };
    })
    .sort(
      (a, b) =>
        b.pending - a.pending ||
        b.count - a.count ||
        a.name.localeCompare(b.name),
    );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Rating distribution"
          subtitle={`${eligible.length} eligible star-rated reviews in this filtered window`}
        />
        <CardBody>
          <div className="space-y-3">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = eligible.filter(
                (review) => review.rating === rating,
              ).length;
              const percentage = eligible.length
                ? Math.round((count / eligible.length) * 100)
                : 0;
              return (
                <div key={rating} className="flex items-center gap-3 text-xs">
                  <span className="w-12 shrink-0 text-slate-600">
                    {rating} stars
                  </span>
                  <div
                    role="meter"
                    aria-valuemin={0}
                    aria-valuemax={Math.max(eligible.length, 1)}
                    aria-valuenow={count}
                    aria-valuetext={`${count} reviews · ${percentage}%`}
                    aria-label={`${rating} star reviews`}
                    className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100"
                  >
                    <div
                      className="h-full rounded-full bg-[#1565D8]"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="w-20 text-right tabular-nums text-slate-600">
                    {count} · {percentage}%
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[11px] leading-5 text-slate-500">
            Recommendations and source-excluded reviews are excluded from star
            calculations.
          </p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader
          title="Source location performance"
          subtitle="Provider-specific locations; physical branches are not matched across sources"
        />
        <CardBody>
          <div className="max-h-56 overflow-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">
                Review metrics per location for the currently filtered loaded
                window
              </caption>
              <thead>
                <tr className="border-b border-slate-100 text-slate-500">
                  <th scope="col" className="pb-3 pr-3 font-medium">
                    Location
                  </th>
                  <th scope="col" className="pb-3 pr-3 font-medium">
                    Reviews
                  </th>
                  <th scope="col" className="pb-3 pr-3 font-medium">
                    Rating
                  </th>
                  <th scope="col" className="pb-3 font-medium">
                    Pending
                  </th>
                </tr>
              </thead>
              <tbody>
                {locations.map((location) => (
                  <tr
                    key={location.key}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <th
                      scope="row"
                      className="max-w-40 break-words py-3 pr-3 font-medium text-slate-900"
                    >
                      {location.name}
                    </th>
                    <td className="pr-3 tabular-nums">{location.count}</td>
                    <td className="pr-3 tabular-nums">{location.average}</td>
                    <td className="tabular-nums">{location.pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!locations.length && (
              <p className="py-4 text-xs text-slate-500">
                No location data matches these filters.
              </p>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
