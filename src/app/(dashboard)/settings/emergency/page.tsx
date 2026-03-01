import type { Metadata } from "next";
import { getProtocols, getIncidents } from "@/actions/emergency.actions";
import { getVenues } from "@/actions/booking.actions";
import { PageHeader } from "@/components/layout/page-header";
import { ProtocolList } from "./_components/protocol-list";
import { IncidentList } from "./_components/incident-list";

export const metadata: Metadata = { title: "Emergency Response | Settings" };

// ============================================================
// Emergency Response Settings Page
// ============================================================

export default async function EmergencySettingsPage() {
  const [protocolsResult, incidentsResult, venuesResult] = await Promise.all([
    getProtocols(),
    getIncidents(),
    getVenues(),
  ]);

  const protocols = protocolsResult.success ? protocolsResult.data : [];
  const incidents = incidentsResult.success ? incidentsResult.data : [];
  const venues = venuesResult.success
    ? venuesResult.data.map((v: { id: string; name: string }) => ({
        id: v.id,
        name: v.name,
      }))
    : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Emergency Response"
        description="Manage emergency protocols and track incidents for your venues."
      />

      {/* Protocols Section */}
      <ProtocolList protocols={protocols} venues={venues} />

      {/* Incidents Section */}
      <IncidentList incidents={incidents} protocols={protocols} />
    </div>
  );
}
