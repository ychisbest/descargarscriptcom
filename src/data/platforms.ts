export type PlatformId = "scribd" | "slideshare" | "studocu" | "pdf";

export interface Platform {
  id: PlatformId;
  name: string;
  href: string;
  emoji: string;
  blurb: string;
}

export const platforms: Platform[] = [
  {
    id: "scribd",
    name: "Scribd",
    href: "/scribd",
    emoji: "📄",
    blurb: "Descargar Scribd gratis — pega el enlace",
  },
  {
    id: "slideshare",
    name: "SlideShare",
    href: "/slideshare",
    emoji: "📊",
    blurb: "SlideShare en PDF o PPT gratis online",
  },
  {
    id: "studocu",
    name: "Studocu",
    href: "/studocu",
    emoji: "📚",
    blurb: "Studocu gratis sin subir documentos",
  },
  {
    id: "pdf",
    name: "PDF",
    href: "/pdf",
    emoji: "📑",
    blurb: "PDF desde Scribd, SlideShare o Studocu",
  },
];
