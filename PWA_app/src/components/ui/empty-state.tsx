import { SearchX } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void; disabled?: boolean };
}

/** Shared empty/error state block: calm, centered, honest copy, real actions only. */
export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-4 py-10 text-center">
      {icon ?? <SearchX size={28} aria-hidden="true" className="text-muted-foreground" />}
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-semibold leading-6 text-foreground">{title}</p>
        {description && (
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        )}
      </div>
      {(primaryAction || secondaryAction) && (
        <div className="mt-1 grid w-full grid-cols-2 gap-3">
          {secondaryAction ? (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
              className="h-11 rounded-lg border border-border text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
            >
              {secondaryAction.label}
            </button>
          ) : (
            <span aria-hidden="true" />
          )}
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="h-11 rounded-lg bg-action-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-action-primary-hover focus-visible:outline-2 focus-visible:outline-ring active:bg-action-primary-active"
            >
              {primaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
