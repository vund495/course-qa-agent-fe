# UI Design — First Load JS Reduction (AI-187)

> **Ticket:** [AI-187](https://ai03.atlassian.net/browse/AI-187) (parent AI-192: Frontend Performance & Resilience)
> **Repo:** `course-qa-agent-fe`
> **Target branch:** `features/Design_WorkspaceHeaderAndHistoryRail`
> **Status:** Implemented

This document records how the frontend's first-load JavaScript was measured and
reduced. The backend is not involved.

---

## 1. Problem

Every route shipped more JavaScript than it used. Two causes:

1. **Barrel imports.** `radix-ui`, `@animate-ui/react` and `lucide-react` are
   barrel files that re-export dozens of primitives from one entry point.
   Importing a single icon or a single Radix primitive pulled the whole barrel
   into the route's first-load bundle.
2. **Eagerly mounted dialogs.** The quiz blueprint dialog and the Markdown
   editor were imported at module scope, so their code — and everything they
   pull in — was downloaded and parsed before the page could paint, even though
   a teacher may never open them.

---

## 2. Measurement

`@next/bundle-analyzer` is wired into `next.config.ts` behind an env flag, so it
costs nothing in a normal build:

```ts
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});
```

```bash
ANALYZE=true npm run build
```

The report opens three treemaps (client, nodejs, edge). The number to watch is
the **First Load JS** column in the build output, per route.

---

## 3. Changes

### 3.1 Package import optimisation

```ts
experimental: {
  optimizePackageImports: ["radix-ui", "@animate-ui/react", "lucide-react"],
}
```

Next rewrites barrel imports into deep imports at compile time, so a route that
uses one icon bundles one icon.

### 3.2 Radix primitives from their own subpaths

The `components/ui/*` primitives now import from the subpath instead of the
barrel:

| File | Before | After |
|---|---|---|
| `avatar.tsx` | `import { Avatar as AvatarPrimitive } from "radix-ui"` | `import * as AvatarPrimitive from "radix-ui/avatar"` |
| `badge.tsx` | `import { Slot } from "radix-ui"` | `import * as SlotPrimitive from "radix-ui/slot"` |
| `button.tsx` | `import { Slot } from "radix-ui"` | `import * as SlotPrimitive from "radix-ui/slot"` |
| `label.tsx` | `import { Label as LabelPrimitive } from "radix-ui"` | `import * as LabelPrimitive from "radix-ui/label"` |
| `separator.tsx` | `import { Separator as SeparatorPrimitive } from "radix-ui"` | `import * as SeparatorPrimitive from "radix-ui/separator"` |

This is belt-and-braces with `optimizePackageImports`: the config handles
packages we do not control, the deep imports handle ours explicitly.

### 3.3 Dialogs and editors load on demand

| Component | Route | Loading |
|---|---|---|
| `QuizBlueprintModal` | `/teacher/class/[id]/quizzes` | `dynamic(..., { ssr: false })` |
| `MarkdownEditor` | `/teacher/class/[id]/settings` | `dynamic(..., { loading: skeleton })` |
| `SkillRadarChart` | student quiz player | `dynamic(..., { ssr: false })` |

The blueprint dialog only mounts after "Generate Quiz" is clicked, the editor
only inside the class-info form, and the radar chart only on the result screen
after submission. None of them is needed for the first paint.

`MarkdownEditor` gets a skeleton placeholder so the form does not jump when the
chunk arrives:

```tsx
{ loading: () => <div className="h-40 animate-pulse rounded-lg bg-[#F4F4F4]" /> }
```

---

## 4. Files changed

| File | Change |
|---|---|
| `next.config.ts` | `optimizePackageImports` + bundle analyzer wrapper |
| `package.json` / `package-lock.json` | `@next/bundle-analyzer` (dev dependency) |
| `components/ui/{avatar,badge,button,label,separator}.tsx` | Deep subpath imports |
| `app/(shell)/teacher/class/[id]/quizzes/page.tsx` | `dynamic` blueprint dialog |
| `app/(shell)/teacher/class/[id]/settings/page.tsx` | `dynamic` Markdown editor |
| `features/quizzes/student-quiz-player.tsx` | `dynamic` skill radar chart |

---

## 5. Acceptance

1. `ANALYZE=true npm run build` produces a report; a normal build does not.
2. First Load JS per route is lower than before the change.
3. The blueprint dialog still opens and generates a quiz.
4. The Markdown editor still renders and saves, with a skeleton while loading.
5. The skill radar chart still renders on the result screen.
6. `npx tsc --noEmit` and `npx eslint` are clean; `npx vitest run` passes.

---

## 6. Risks

- **`ssr: false` on the blueprint dialog.** It is a modal that never renders on
  first paint, so losing SSR costs nothing. If it is ever promoted to a route
  segment, drop `ssr: false`.
- **Analyzer in the dependency tree.** It is a `devDependency` and gated by
  `ANALYZE`, so it is not in the production image.
- **Deep Radix imports.** These pin the subpath names. A Radix major upgrade
  that renames a subpath fails at build time, not silently at runtime.
