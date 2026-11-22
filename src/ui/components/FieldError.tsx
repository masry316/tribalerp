import { AlertCircle } from 'lucide-react';

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mt-1 flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400"
    >
      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

export function FormErrorsBanner({
  errors
}: {
  errors: Record<string, string> | null | undefined;
}) {
  if (!errors) return null;
  const entries = Object.entries(errors).filter(([, msg]) => Boolean(msg));
  if (entries.length === 0) return null;

  return (
    <div
      role="alert"
      className="mb-4 rounded-md border border-red-300 bg-red-50 p-3.5 text-xs text-red-900 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
    >
      <div className="mb-1.5 flex items-center gap-1.5 font-bold">
        <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
        <span>يرجى مراجعة الأخطاء التالية قبل الحفظ:</span>
      </div>
      <ul className="list-inside list-disc space-y-1 ps-1">
        {entries.map(([key, msg]) => (
          <li key={key}>{msg}</li>
        ))}
      </ul>
    </div>
  );
}
