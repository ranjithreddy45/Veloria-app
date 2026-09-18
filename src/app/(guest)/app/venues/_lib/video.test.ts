import { describe, expect, it } from "vitest";
import { parseStartSeconds, videoTarget } from "./video";

describe("videoTarget — YouTube", () => {
  it("embeds a watch link on the privacy-enhanced domain", () => {
    expect(videoTarget("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      kind: "youtube",
      id: "dQw4w9WgXcQ",
      embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      href: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
  });

  it("understands short, shorts, live, embed and mobile links", () => {
    expect(videoTarget("https://youtu.be/dQw4w9WgXcQ")?.kind).toBe("youtube");
    expect(videoTarget("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toMatchObject({ id: "dQw4w9WgXcQ" });
    expect(videoTarget("https://www.youtube.com/live/dQw4w9WgXcQ?si=abc")).toMatchObject({ id: "dQw4w9WgXcQ" });
    expect(videoTarget("https://www.youtube.com/embed/dQw4w9WgXcQ")).toMatchObject({ id: "dQw4w9WgXcQ" });
    expect(videoTarget("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toMatchObject({ id: "dQw4w9WgXcQ" });
    expect(videoTarget("www.youtube.com/watch?v=dQw4w9WgXcQ")).toMatchObject({ kind: "youtube" });
  });

  it("keeps a start time", () => {
    expect(videoTarget("https://youtu.be/dQw4w9WgXcQ?t=90")).toMatchObject({ embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90" });
    expect(videoTarget("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s")).toMatchObject({ embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90" });
  });

  it("falls back to a plain link when the video id is not valid", () => {
    expect(videoTarget("https://www.youtube.com/watch?v=short")).toEqual({ kind: "link", href: "https://www.youtube.com/watch?v=short" });
    expect(videoTarget("https://www.youtube.com/@veloriagrand")).toEqual({ kind: "link", href: "https://www.youtube.com/@veloriagrand" });
  });
});

describe("videoTarget — Vimeo", () => {
  it("embeds a public video", () => {
    expect(videoTarget("https://vimeo.com/123456789")).toEqual({
      kind: "vimeo",
      id: "123456789",
      embedUrl: "https://player.vimeo.com/video/123456789",
      href: "https://vimeo.com/123456789",
    });
  });

  it("carries the privacy hash of an unlisted video", () => {
    expect(videoTarget("https://vimeo.com/123456789/0a1b2c3d4e")).toMatchObject({ embedUrl: "https://player.vimeo.com/video/123456789?h=0a1b2c3d4e" });
    expect(videoTarget("https://player.vimeo.com/video/123456789?h=abc123def")).toMatchObject({ embedUrl: "https://player.vimeo.com/video/123456789?h=abc123def" });
  });

  it("finds the video inside channel and showcase links", () => {
    expect(videoTarget("https://vimeo.com/channels/staffpicks/123456789")).toMatchObject({ id: "123456789" });
    expect(videoTarget("https://vimeo.com/showcase/1234567/video/987654321")).toMatchObject({ id: "987654321" });
  });
});

describe("videoTarget — everything else", () => {
  it("offers other web addresses as a plain link", () => {
    expect(videoTarget("https://drive.google.com/file/d/abc/view")).toEqual({ kind: "link", href: "https://drive.google.com/file/d/abc/view" });
    expect(videoTarget("https://www.instagram.com/reel/xyz/")).toMatchObject({ kind: "link" });
  });

  it("ignores values that are not web addresses", () => {
    expect(videoTarget("javascript:alert(1)")).toBeNull();
    expect(videoTarget("our wedding film")).toBeNull();
    expect(videoTarget("")).toBeNull();
    expect(videoTarget(null)).toBeNull();
  });
});

describe("parseStartSeconds", () => {
  it("reads seconds and h/m/s forms", () => {
    expect(parseStartSeconds("75")).toBe(75);
    expect(parseStartSeconds("2m")).toBe(120);
    expect(parseStartSeconds("1h2m3s")).toBe(3723);
  });

  it("ignores zero and junk", () => {
    expect(parseStartSeconds("0")).toBeNull();
    expect(parseStartSeconds("soon")).toBeNull();
    expect(parseStartSeconds(null)).toBeNull();
  });
});
