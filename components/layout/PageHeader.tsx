import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
};

export default function PageHeader({
  title,
  subtitle,
  description,
  action,
  children,
}: PageHeaderProps) {
  const supportingText = subtitle ?? description;

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900 sm:text-[26px]">
          {title}
        </h1>
        {supportingText ? (
          <p className="mt-1.5 text-sm text-slate-500">{supportingText}</p>
        ) : null}
      </div>
      {children ? <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2.5">{children}</div> : action ? <div>{action}</div> : null}
    </header>
  );
}
