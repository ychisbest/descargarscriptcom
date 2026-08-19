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
    blurb: "Documentos, libros, presentaciones",
  },
  {
    id: "slideshare",
    name: "SlideShare",
    href: "/slideshare",
    emoji: "📊",
    blurb: "Presentaciones y diapositivas",
  },
  {
    id: "studocu",
    name: "Studocu",
    href: "/studocu",
    emoji: "📚",
    blurb: "Apuntes, exámenes, resúmenes",
  },
  {
    id: "pdf",
    name: "PDF",
    href: "/pdf",
    emoji: "📑",
    blurb: "Guardar el archivo en PDF",
  },
];
