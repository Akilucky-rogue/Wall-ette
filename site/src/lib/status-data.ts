// The status page's reports, published by editing this file and deploying
// the site: no live monitoring stands behind them. When something breaks,
// set the component's status, add an incident with dated updates, deploy;
// when it's fixed, mark it resolved and deploy again.

export type ComponentStatus = "operational" | "degraded" | "partial_outage" | "major_outage" | "maintenance";
export type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved";

export interface ServiceStatus {
  components: { slug: string; name: string; description: string; status: ComponentStatus; updated_at: string }[];
  incidents: {
    id: string;
    title: string;
    status: IncidentStatus;
    impact: string;
    summary: string;
    started_at: string;
    resolved_at: string | null;
    updates: { status: IncidentStatus; message: string; created_at: string }[];
  }[];
  refreshedAt: string;
}

const REVIEWED = "2026-11-27T12:00:00+05:30";

export const SERVICE_STATUS: ServiceStatus = {
  components: [
    { slug: "website", name: "Website", description: "wall-ette.com, its guides and its forms.", status: "operational", updated_at: REVIEWED },
    { slug: "web-app", name: "Web app", description: "Wall·ette in the browser, at wall-ette.com/app.", status: "operational", updated_at: REVIEWED },
    { slug: "android", name: "Android app", description: "In testing on Google Play.", status: "operational", updated_at: REVIEWED },
    { slug: "sign-in", name: "Sign-in and accounts", description: "Creating an account, signing in and resetting a password.", status: "operational", updated_at: REVIEWED },
    { slug: "sync", name: "Saving and sync", description: "Saving entries and keeping them the same on every device.", status: "operational", updated_at: REVIEWED },
    { slug: "import", name: "Statement import", description: "Reading statements, on your device.", status: "operational", updated_at: REVIEWED },
  ],
  incidents: [],
  refreshedAt: REVIEWED,
};
