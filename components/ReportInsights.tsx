"use client";

import { useEffect } from "react";
import { INDEX_NAME } from "@/lib/article";
import { insightsClient } from "@/lib/insights-client";
import { usingAlgoliaCloud } from "@/lib/search-client";

export function ReportInsights({
  objectID,
  queryID,
}: {
  objectID: string;
  queryID?: string;
}) {
  useEffect(() => {
    if (!usingAlgoliaCloud) return;
    if (queryID) {
      insightsClient("convertedObjectIDsAfterSearch", {
        eventName: "Report Read",
        index: INDEX_NAME,
        queryID,
        objectIDs: [objectID],
      });
      return;
    }
    insightsClient("viewedObjectIDs", {
      eventName: "Report Viewed",
      index: INDEX_NAME,
      objectIDs: [objectID],
    });
  }, [objectID, queryID]);

  return null;
}
