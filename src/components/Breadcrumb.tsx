import Link from "next/link";

export type BreadcrumbItem = { label: string; href?: string };

export default function Breadcrumb({
  items,
  "data-testid": testId,
}: {
  items: BreadcrumbItem[];
  "data-testid"?: string;
}) {
  return (
    <nav
      data-testid={testId}
      className="mb-4 flex flex-wrap items-center gap-1 text-sm text-zinc-500"
    >
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-zinc-300">/</span>}
          {item.href ? (
            <Link
              href={item.href}
              data-testid={testId ? `${testId}-item` : undefined}
              className="hover:text-zinc-900 hover:underline"
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-zinc-900">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
