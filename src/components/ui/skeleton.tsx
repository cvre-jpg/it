import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-[linear-gradient(90deg,#fafafa_0%,#f1f1f1_50%,#fafafa_100%)]",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
