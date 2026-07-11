# Ant Design UI Structure (Recommended)

This guide defines a consistent AntD-based structure for the current admin dashboard codebase.

## Goals

- Keep all modules visually consistent across pages.
- Reduce duplicated inline styles.
- Make pages easier to maintain and extend.
- Preserve your current visual direction while using AntD as the main UI layer.

## Design Principles

- Use AntD components first: `Layout`, `Card`, `Table`, `Form`, `Modal`, `Tabs`, `Tag`, `Statistic`, `Typography`.
- Keep custom CSS for theme/background/layout utilities, not per-component one-off styling.
- Move repeated page chrome (header, toolbar, hero) into reusable components.
- Standardize loading, empty, and error states.
- Keep all data logic in page-level containers and pass clean props to presentational components.

## Target Folder Structure

```text
app/
  layout.tsx                  # Global AntD theme provider
  globals.css                 # Global tokens/utilities only
  page.tsx                    # Dashboard container page
  fleet/page.tsx              # Feature container page
  trips/page.tsx
  routes/page.tsx
  users/page.tsx
  analytics/page.tsx
  role-requests/page.tsx

components/
  admin/
    layout/
      AdminShell.tsx          # Shared page shell and spacing
      AdminHeader.tsx         # Top header (title, subtitle, actions)
    feedback/
      PageLoader.tsx          # Full-page loading state
      SectionLoader.tsx       # Card/table loading state
      EmptyState.tsx          # Standard no-data state
      ErrorState.tsx          # Standard retry/error state
    data/
      DataToolbar.tsx         # Search/filter/action row
      DataTableCard.tsx       # Card wrapper around tables
      StatusTag.tsx           # Unified status badge mapping
    metrics/
      MetricCard.tsx          # Reusable metric/stat card
      MetricGrid.tsx          # Grid wrapper for metric cards

lib/
  queries.ts                  # Data fetching/mutations
  realtime.ts                 # Realtime subscriptions
  navCache.ts                 # Optional prewarm caching
```

## Page Composition Standard

Use this sequence on every admin page:

1. `AdminShell`
2. `AdminHeader` (title + subtitle + right-side actions)
3. Optional hero/summary section (only if useful)
4. `MetricGrid` (if page has KPI stats)
5. `DataToolbar` (search/filter/primary action)
6. `DataTableCard` or content cards/charts
7. Feature modals/drawers/forms

## Feature Ownership (Current Modules)

- `app/page.tsx` (Dashboard): metrics + quick actions + realtime indicators.
- `app/fleet/page.tsx`: KPI cards + bus assignment table + assignment modal.
- `app/trips/page.tsx`: active/history tabs + trip table + cancel modal.
- `app/routes/page.tsx`: route metrics + routes table + route form modal + map picker.
- `app/users/page.tsx`: role stats + tabs/table + user detail popover.
- `app/analytics/page.tsx`: KPI cards + chart cards + utilization tables.
- `app/role-requests/page.tsx`: request stats + filters + actions + review modals.

## UI Pattern Rules

- Header actions: max 2 primary actions in top-right, remaining actions in table toolbar.
- Cards: always use AntD `Card`; no ad-hoc container divs for card behavior.
- Tables: use one table style across modules (row size, header style, pagination location).
- Forms/modals: consistent spacing, labels, and footer button order (`Cancel`, then primary action).
- Status display: use centralized `StatusTag` mapping instead of inline color logic in each page.

## Styling Rules

- Keep theme tokens in `app/layout.tsx` via `ConfigProvider`.
- Move repeated gradients/colors/radius values into CSS variables in `app/globals.css`.
- Prefer component `className` + shared utility classes over large inline style objects.
- Use inline style only for dynamic values that depend on runtime data.

## Recommended Token Set (Align with Current Theme)

- Brand primary: keep your current `colorPrimary`.
- Radius scale: `8 / 12 / 16`.
- Control heights: `36 / 44 / 52`.
- Surface shadows: one subtle default + one elevated variant.
- Consistent semantic colors for statuses (success/warning/error/info).

## Implementation Order (Low Risk)

1. Create shared admin UI components under `components/admin/*`.
2. Refactor one page first (`app/routes/page.tsx`) to validate patterns.
3. Roll out same structure to `fleet`, `users`, `trips`.
4. Normalize `analytics` and `role-requests`.
5. Remove redundant inline styles after each page migration.

## Definition of Done

- All admin pages share the same shell/header/toolbar structure.
- Repeated loading/error/empty UI is reusable.
- Status tags and table look-and-feel are consistent.
- Inline styling is reduced to page-specific dynamic cases only.
- New pages can be added by following one template.
