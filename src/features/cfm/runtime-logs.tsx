import { CardDescription } from "@/components/ui/card";

export function RuntimeLogs(props: {
  title?: string;
  subtitle?: string;
  logs: string[];
}) {
  const { title = "Runtime / Logs", subtitle, logs } = props;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-medium">{title}</div>
        {subtitle ? <CardDescription className="truncate">{subtitle}</CardDescription> : null}
      </div>
      <pre className="h-[260px] w-full overflow-auto rounded-md bg-muted p-3 text-xs lg:h-[320px]">
        {logs.length > 0 ? logs.join("\n") : "No logs yet"}
      </pre>
    </div>
  );
}

