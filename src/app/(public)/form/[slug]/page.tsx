import type { Metadata } from "next";
import { getWebformBySlug } from "@/actions/webform.actions";
import { PublicForm } from "./_components/public-form";
import type { WebformField } from "@/schemas/webform.schema";
import { HelpChip } from "@/components/public/help-chip";

// ============================================================
// Public Webform Page (No Auth Required)
// ============================================================

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getWebformBySlug(slug);

  if (!result.success || !result.data) {
    return { title: "Form Not Found" };
  }

  return {
    title: result.data.name,
    description: result.data.description || undefined,
  };
}

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getWebformBySlug(slug);

  if (!result.success || !result.data) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-foreground text-[30px] sm:text-[34px]">
          Form Not Found
        </h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-md text-[15px] leading-relaxed">
          This form does not exist or has been removed.
        </p>
        <HelpChip className="mt-5" />
      </div>
    );
  }

  const webform = result.data;

  if (!webform.isActive) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-foreground text-[30px] sm:text-[34px]">
          Form Closed
        </h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-md text-[15px] leading-relaxed">
          This form is no longer accepting submissions.
        </p>
        <HelpChip className="mt-5" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Form Header */}
      <div className="text-center">
        <h1 className="text-foreground text-[30px] sm:text-[34px]">
          {webform.name}
        </h1>
        {webform.description && (
          <p className="text-muted-foreground mx-auto mt-3 max-w-md text-[15px] leading-relaxed">
            {webform.description}
          </p>
        )}
      </div>

      {/* Form */}
      <PublicForm
        slug={webform.slug}
        fields={webform.fields as WebformField[]}
        honeypotField={webform.honeypotField || undefined}
        thankYouMessage={webform.thankYouMessage || undefined}
        thankYouUrl={webform.thankYouUrl || undefined}
      />
    </div>
  );
}
