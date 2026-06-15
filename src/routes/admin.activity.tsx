import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { listActivityLogs } from "@/lib/admin-data";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin/activity")({ component: AdminActivity });

function AdminActivity() {
  const { data: logs = [] } = useQuery({
    queryKey: ["activity-logs"],
    queryFn: () => listActivityLogs(),
  });
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const selectedLog = useMemo(
    () => logs.find((log: any) => log.id === selectedLogId) ?? null,
    [logs, selectedLogId],
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Activity Log</h1>
        <p className="text-sm text-muted-foreground">
          Review recent admin and super admin actions across products, orders, billing, inventory,
          suppliers, and settings.
        </p>
      </header>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F8FAFC]">
              <TableHead className="min-w-[160px]">Date</TableHead>
              <TableHead className="min-w-[150px]">Action</TableHead>
              <TableHead className="min-w-[140px]">Module</TableHead>
              <TableHead className="min-w-[220px]">Item</TableHead>
              <TableHead className="min-w-[170px]">Actor</TableHead>
              <TableHead className="w-[110px] text-right">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length > 0 ? (
              logs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="align-top text-sm text-[#475569]">
                    {formatDateTime(log.created_at)}
                  </TableCell>
                  <TableCell className="align-top">
                    <span className="inline-flex rounded-full bg-[#FFF1F2] px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-[#E30613]">
                      {humanize(log.action)}
                    </span>
                  </TableCell>
                  <TableCell className="align-top text-sm font-medium text-foreground">
                    {humanize(log.entity_type)}
                  </TableCell>
                  <TableCell className="align-top text-sm text-[#475569]">
                    {log.entity_label || "Not specified"}
                  </TableCell>
                  <TableCell className="align-top text-sm text-[#475569]">
                    {log.actor_name || "System"}
                  </TableCell>
                  <TableCell className="align-top text-right">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#4B5563] transition hover:text-[#111827]"
                      onClick={() => setSelectedLogId(log.id)}
                      aria-label="View activity log"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="px-5 py-12 text-center text-muted-foreground">
                  No activity has been logged yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLogId(null)}>
        <DialogContent className="max-w-2xl">
          {selectedLog ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-left">
                  {humanize(selectedLog.action)} · {humanize(selectedLog.entity_type)}
                </DialogTitle>
                <DialogDescription className="text-left">
                  {selectedLog.entity_label || "Activity details"}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                <DetailItem label="Date" value={formatDateTime(selectedLog.created_at)} />
                <DetailItem label="Action" value={humanize(selectedLog.action)} />
                <DetailItem label="Module" value={humanize(selectedLog.entity_type)} />
                <DetailItem label="Item" value={selectedLog.entity_label || "Not specified"} />
                <DetailItem label="Who made the action" value={selectedLog.actor_name || "System"} />
                <DetailItem label="Role" value={selectedLog.actor_role ? humanize(selectedLog.actor_role) : "Not specified"} />
                <DetailItem label="Email" value={selectedLog.actor_email || "Not specified"} />
                <DetailItem label="Entity ID" value={selectedLog.entity_id ? String(selectedLog.entity_id) : "Not specified"} />
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Other details</h3>
                <div className="rounded-xl border border-[#d8dee6] bg-[#F8FAFC] p-4">
                  {Object.keys(selectedLog.details ?? {}).length > 0 ? (
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-[#475569]">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-sm text-muted-foreground">No extra details were saved for this activity.</p>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#d8dee6] bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className="mt-1 text-sm text-[#0F172A]">{value}</p>
    </div>
  );
}

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-KE", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
