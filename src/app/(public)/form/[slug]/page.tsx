import type { Metadata } from "next";
import { getWebformBySlug } from "@/actions/webform.actions";
import { PublicForm } from "./_components/public-form";
import type { WebformField } from "@/schemas/webform.schema";
import { HelpChip } from "@/components/public/help-chip";
import { getPublicContact } from "@/lib/public/business-contact";

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
    // The help buttons use the numbers the team keeps in Settings → Business contact.
    const contact = await getPublicContact();
    return (
      <div className="py-20 text-center">
        <h1 className="text-foreground text-h1 sm:text-h1">
          Form Not Found
        </h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-md text-copy leading-relaxed">
          This form does not exist or has been removed.
        </p>
        <HelpChip className="mt-5" contact={contact} />
      </div>
    );
  }

  const webform = result.data;

  if (!webform.isActive) {
    const contact = await getPublicContact();
    return (
      <div className="py-20 text-center">
        <h1 className="text-foreground text-h1 sm:text-h1">
          Form Closed
        </h1>
        <p className="text-muted-foreground mx-auto mt-3 max-w-md text-copy leading-relaxed">
          This form is no longer accepting submissions.
        </p>
        <HelpChip className="mt-5" contact={contact} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Form Header */}
      <div className="text-center">
        <h1 className="text-foreground text-h1 sm:text-h1">
          {webform.name}
        </h1>
        {webform.description && (
          <p className="text-muted-foreground mx-auto mt-3 max-w-md text-copy leading-relaxed">
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
