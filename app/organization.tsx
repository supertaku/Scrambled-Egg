import { Redirect } from "expo-router";

/**
 * Retired duplicate of the org browser. The interactive chart at /org-chart
 * is the single organization screen now; this route stays one release so
 * stale links keep working, then the file can be deleted.
 */
export default function OrganizationRoute() {
  return <Redirect href="/org-chart" />;
}
