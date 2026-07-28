import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  ImageIcon,
  VideoIcon,
  GlobeIcon,
  TagIcon,
  CalendarCheck,
} from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/../auth";
import { getPortalGallery } from "@/actions/gallery.actions";
import { PageHeader } from "@/components/layout/page-header";
import { MEDIA_TYPE_LABELS } from "@/lib/constants";

export const metadata: Metadata = { title: "My Gallery" };

// ============================================================
// Portal Gallery Page
// ============================================================

export default async function PortalGalleryPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  const result = await getPortalGallery(session.user.id as string);

  const items = result.success ? result.data.items : [];
  const bookings = result.success ? result.data.bookings : [];

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Your account"
        title="My Gallery"
        description="The moments our team captured on the day, kept safe for you to revisit."
      />

      {items.length === 0 ? (
        <Card className="shadow-card rounded-2xl py-0">
          <CardContent className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="bg-muted flex size-16 items-center justify-center rounded-2xl">
              <ImageIcon className="text-muted-foreground/60 size-8" />
            </div>
            <h3 className="font-editorial text-foreground mt-5 text-xl font-semibold">
              Your story starts here
            </h3>
            <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
              Once the celebration is over and our team has sorted through the
              day, the photographs and films will appear right here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Group by booking */}
          {bookings.map((booking) => {
            const bookingItems = items.filter(
              (item: { bookingId: string | null }) =>
                item.bookingId === booking.id
            );

            if (bookingItems.length === 0) return null;

            return (
              <div key={booking.id} className="space-y-4">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="text-primary size-3.5" />
                  <h2 className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
                    {booking.eventName}
                    <span className="numeric text-muted-foreground/60">
                      {bookingItems.length}
                    </span>
                  </h2>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {bookingItems.map(
                    (item: {
                      id: string;
                      title: string | null;
                      description: string | null;
                      mediaType: string;
                      url: string;
                      thumbnailUrl: string | null;
                      tags: string[];
                      createdAt: string;
                    }) => (
                      <Card
                        key={item.id}
                        className="group shadow-card hover:shadow-card-hover overflow-hidden rounded-2xl py-0 transition-all duration-200"
                      >
                        {/* Image / Video Preview */}
                        <div className="bg-muted relative aspect-[4/3] overflow-hidden">
                          {item.mediaType === "VIDEO" ? (
                            <div className="bg-foreground/[0.04] flex size-full items-center justify-center">
                              {item.thumbnailUrl ? (
                                <Image
                                  src={item.thumbnailUrl}
                                  alt={item.title || "Video thumbnail"}
                                  fill
                                  className="object-cover"
                                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                />
                              ) : (
                                <VideoIcon className="text-muted-foreground/50 size-12" />
                              )}
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="flex size-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
                                  <VideoIcon className="size-5" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <Image
                              src={item.thumbnailUrl || item.url}
                              alt={item.title || "Gallery photo"}
                              fill
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            />
                          )}

                          {/* Media Type Badge */}
                          <div className="absolute right-2 top-2">
                            <Badge
                              variant="secondary"
                              className="border-transparent bg-black/55 text-[10px] font-medium tracking-[0.06em] text-white backdrop-blur-sm"
                            >
                              {MEDIA_TYPE_LABELS[item.mediaType] ||
                                item.mediaType}
                            </Badge>
                          </div>
                        </div>

                        {/* Info */}
                        <CardContent className="p-4">
                          <p className="text-foreground truncate text-sm font-medium">
                            {item.title || "Untitled"}
                          </p>
                          {item.description && (
                            <p className="text-muted-foreground mt-0.5 truncate text-xs">
                              {item.description}
                            </p>
                          )}
                          {item.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {item.tags.slice(0, 3).map((tag: string) => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className="text-muted-foreground px-1.5 py-0 text-[10px] font-normal"
                                >
                                  <TagIcon className="mr-0.5 size-2" />
                                  {tag}
                                </Badge>
                              ))}
                              {item.tags.length > 3 && (
                                <Badge
                                  variant="outline"
                                  className="numeric text-muted-foreground/70 px-1.5 py-0 text-[10px] font-normal"
                                >
                                  +{item.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                          <p className="numeric text-muted-foreground/60 mt-2.5 text-[10px]">
                            {new Date(item.createdAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              }
                            )}
                          </p>
                        </CardContent>
                      </Card>
                    )
                  )}
                </div>
              </div>
            );
          })}

          {/* Items without a booking */}
          {(() => {
            const unbookedItems = items.filter(
              (item: { bookingId: string | null }) => !item.bookingId
            );
            if (unbookedItems.length === 0) return null;
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <GlobeIcon className="text-primary size-3.5" />
                  <h2 className="text-muted-foreground flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
                    From the venue
                    <span className="numeric text-muted-foreground/60">
                      {unbookedItems.length}
                    </span>
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {unbookedItems.map(
                    (item: {
                      id: string;
                      title: string | null;
                      description: string | null;
                      mediaType: string;
                      url: string;
                      thumbnailUrl: string | null;
                      tags: string[];
                      createdAt: string;
                    }) => (
                      <Card
                        key={item.id}
                        className="group shadow-card hover:shadow-card-hover overflow-hidden rounded-2xl py-0 transition-all duration-200"
                      >
                        <div className="bg-muted relative aspect-[4/3] overflow-hidden">
                          {item.mediaType === "VIDEO" ? (
                            <div className="bg-foreground/[0.04] flex size-full items-center justify-center">
                              {item.thumbnailUrl ? (
                                <Image
                                  src={item.thumbnailUrl}
                                  alt={item.title || "Video thumbnail"}
                                  fill
                                  className="object-cover"
                                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                />
                              ) : (
                                <VideoIcon className="text-muted-foreground/50 size-12" />
                              )}
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="flex size-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
                                  <VideoIcon className="size-5" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <Image
                              src={item.thumbnailUrl || item.url}
                              alt={item.title || "Gallery photo"}
                              fill
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            />
                          )}
                          <div className="absolute right-2 top-2">
                            <Badge
                              variant="secondary"
                              className="border-transparent bg-black/55 text-[10px] font-medium tracking-[0.06em] text-white backdrop-blur-sm"
                            >
                              {MEDIA_TYPE_LABELS[item.mediaType] ||
                                item.mediaType}
                            </Badge>
                          </div>
                        </div>
                        <CardContent className="p-4">
                          <p className="text-foreground truncate text-sm font-medium">
                            {item.title || "Untitled"}
                          </p>
                          {item.description && (
                            <p className="text-muted-foreground mt-0.5 truncate text-xs">
                              {item.description}
                            </p>
                          )}
                          <p className="numeric text-muted-foreground/60 mt-2.5 text-[10px]">
                            {new Date(item.createdAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              }
                            )}
                          </p>
                        </CardContent>
                      </Card>
                    )
                  )}
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
