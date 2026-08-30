/** Three bouncing dots plus the names of whoever is typing. */
export function TypingIndicator({ names }: { names: string[] }) {
  const label =
    names.length === 1
      ? `${names[0]!.split(' ')[0]} is typing`
      : names.length === 2
        ? `${names[0]!.split(' ')[0]} and ${names[1]!.split(' ')[0]} are typing`
        : `${names.length} people are typing`;

  return (
    <div className="flex items-center gap-2 px-10" aria-live="polite">
      <span className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-card px-3 py-2.5 shadow-sm ring-1 ring-border">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="h-1.5 w-1.5 animate-typing-bounce rounded-full bg-muted-foreground"
            style={{ animationDelay: `${index * 160}ms` }}
          />
        ))}
      </span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}
