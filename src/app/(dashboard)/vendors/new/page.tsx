import { redirect } from "next/navigation";

// ============================================================
// "/vendors/new" — retired; kept only as a redirect.
// ------------------------------------------------------------
// This route used to render the legacy VendorForm, whose create path
// (createVendor) writes only the old single `category` field. A vendor made
// here had no `categories`, no vendor type and no venues, so it vanished under
// every category filter and createPackage refused every package for it.
//
// Vendors are created with the "Add vendor" dialog in the /vendors toolbar
// (VendorFormDialog -> createCatalogVendor, which requires a category). The
// URL stays alive as a redirect so an old bookmark or link lands on that list
// instead of /vendors/[vendorId] with the id "new".
//
// Do NOT delete VendorForm or updateVendor with this page: VendorForm still
// powers /vendors/[vendorId]/edit.
// ============================================================

export default function NewVendorPage() {
  redirect("/vendors");
}
