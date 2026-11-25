"use client";

/**
 * A task button that opens the household's AI in a new tab. When the AI
 * cannot take the request in its link, the request is copied first so the
 * user only pastes it.
 */
export function OpenChat({
  url,
  request,
  copy,
  title,
  text,
}: {
  url: string;
  request: string;
  copy: boolean;
  title: string;
  text: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        if (copy) navigator.clipboard?.writeText(request).catch(() => {});
      }}
      className="flex flex-col gap-0.5 rounded-lg bg-background px-3 py-2 hover:bg-muted/10"
    >
      <span className="font-medium">{title}</span>
      <span className="text-xs text-muted">{text}</span>
    </a>
  );
}
