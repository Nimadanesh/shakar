import { ThemeSwitch } from "@/components/settings/ThemeSwitch";

export default function ProfilePage() {
  return (
    <main className="flex flex-1 flex-col gap-2 py-6">
      <h1 className="text-xl font-semibold leading-8">پروفایل</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        حساب، وضعیت اشتراک و تنظیمات اینجا می‌آید (P1).
      </p>

      <section
        aria-label="تنظیمات نمایش"
        className="mt-4 rounded-xl border border-border bg-card p-4"
      >
        <h2 className="mb-2 text-sm font-semibold text-foreground">
          تنظیمات نمایش
        </h2>
        <ThemeSwitch />
      </section>
    </main>
  );
}
