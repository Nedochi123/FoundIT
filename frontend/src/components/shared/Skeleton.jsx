// Loading skeletons: soft shapes of what is about to appear (item cards, conversation rows, a chat, a balance) with a slow
// shimmer, instead of a bare "Loading...". Screen readers hear one line (role="status"); the shapes are hidden from them.
// Colours come from the student's look (the slate scale), so every theme, light or dark, gets matching bones. The shimmer
// stands still when the phone asks for less motion (see .fi-bone in index.css).

/** One shape. Size and roundness come from `className` (e.g. "h-4 w-2/3 rounded-full"). */
export const Bone = ({ className = "" }) => <span className={`fi-bone block ${className}`} aria-hidden="true" />;

/** The wrapper every skeleton uses: says `label` to screen readers once, shows the shapes to everyone else.
 *  `className` lays out the shapes (gap, grid, spacing), so it goes on the box that holds them. */
export function SkeletonStatus({ label = "Loading...", className = "", children }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className={className || undefined} aria-hidden="true">
        {children}
      </div>
    </div>
  );
}

const CARD = "rounded-xl border border-white/10 bg-slate-900/85";

/** Items found: two columns of photo cards. */
export function GridSkeleton({ label = "Loading items...", cards = 4 }) {
  return (
    <SkeletonStatus label={label}>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className={`overflow-hidden ${CARD}`}>
            <Bone className="h-44 w-full" />
            <div className="space-y-2 p-3">
              <Bone className={`h-3.5 rounded-full ${i % 2 ? "w-2/3" : "w-4/5"}`} />
              <Bone className="h-3 w-1/2 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonStatus>
  );
}

/** Rows (conversations, lost posts, tags, admin lists): an optional picture and two lines each. */
export function ListSkeleton({ label = "Loading...", rows = 3, thumb = true, className = "" }) {
  return (
    <SkeletonStatus label={label} className={className}>
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className={`flex items-center gap-3 p-3 ${CARD}`}>
            {thumb && <Bone className="h-12 w-12 shrink-0 rounded-lg" />}
            <div className="min-w-0 flex-1 space-y-2">
              <Bone className={`h-3.5 rounded-full ${i % 2 ? "w-1/2" : "w-2/3"}`} />
              <Bone className={`h-3 rounded-full ${i % 2 ? "w-3/4" : "w-2/5"}`} />
            </div>
          </div>
        ))}
      </div>
    </SkeletonStatus>
  );
}

/** A few lines of text (inside a sheet or a small panel). */
export function LinesSkeleton({ label = "Loading...", lines = 3, className = "" }) {
  const widths = ["w-full", "w-5/6", "w-2/3", "w-3/4"];
  return (
    <SkeletonStatus label={label} className={className}>
      <div className="space-y-2.5 py-1">
        {Array.from({ length: lines }, (_, i) => (
          <Bone key={i} className={`h-3.5 rounded-full ${widths[i % widths.length]}`} />
        ))}
      </div>
    </SkeletonStatus>
  );
}

/** A conversation: bubbles taking turns left and right. */
export function ChatSkeleton({ label = "Loading messages..." }) {
  const widths = ["w-3/5", "w-2/5", "w-1/2", "w-1/3"];
  return (
    <SkeletonStatus label={label}>
      <div className="space-y-2.5 py-1">
        {widths.map((w, i) => (
          <div key={i} className={`flex ${i % 2 ? "justify-end" : "justify-start"}`}>
            <Bone className={`h-10 rounded-2xl ${w}`} />
          </div>
        ))}
      </div>
    </SkeletonStatus>
  );
}

/** Tokens: the title, the big balance card and the history rows. */
export function TokensSkeleton() {
  return (
    <SkeletonStatus label="Loading your tokens..." className="flex flex-col gap-6">
      <div className="space-y-2">
        <Bone className="h-6 w-28 rounded-full" />
        <Bone className="h-3.5 w-4/5 rounded-full" />
      </div>
      <Bone className="h-44 rounded-2xl" />
      <ListSkeleton label="" rows={3} thumb={false} />
    </SkeletonStatus>
  );
}

/** The whole app before we know who is signed in: top bar, a welcome card and a few rows. */
export function AppSkeleton() {
  return (
    <SkeletonStatus label="Loading FoundIT..." className="mx-auto flex min-h-app w-full max-w-md flex-col gap-4 px-4 pt-6">
      <div className="flex items-center gap-3">
        <Bone className="h-10 w-10 rounded-xl" />
        <Bone className="h-5 w-28 rounded-full" />
      </div>
      <Bone className="h-36 rounded-2xl" />
      <ListSkeleton label="" rows={3} thumb={false} />
    </SkeletonStatus>
  );
}
