import React, { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useOutsideClick } from "../../hooks/use-outside-click";
import { buildShareUrl } from "../../lib/utils";

function severityClasses(tag: string) {
  switch (tag) {
    case "Critical":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "High":
      return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "Medium":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "Low":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    default:
      return "bg-neutral-800 text-neutral-300 border-neutral-700";
  }
}

export function ExpandableCard({
  cards,
}: {
  cards: {
    id: string;
    description: string;
    title: string;
    src?: string | null;
    ctaText: string;
    ctaLink: string;
    content: () => React.ReactNode;
    subtitle?: string;
    tag?: string;
    date?: string;
    attackVector?: string;
    loss?: string | null;
  }[];
}) {
  const [active, setActive] = useState<(typeof cards)[number] | boolean | null>(
    null
  );
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);

  // Deep linking: open the card matching #exploit-{id} on mount,
  // and keep the URL hash in sync as the user opens/closes cards.
  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/^#exploit-(.+)$/);
    if (!match) return;
    const target = cards.find((c) => c.id === match[1]);
    if (target) setActive(target);
    // Run only once on mount; subsequent filter changes shouldn't reopen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (active && typeof active === "object") {
      const newHash = `#exploit-${active.id}`;
      if (window.location.hash !== newHash) {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search + newHash
        );
      }
    } else if (window.location.hash.startsWith("#exploit-")) {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
    }
  }, [active]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActive(false);
      }
    }

    if (active && typeof active === "object") {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active]);

  useOutsideClick(ref as React.RefObject<HTMLDivElement>, () => setActive(null));

  return (
    <>
      <AnimatePresence>
        {active && typeof active === "object" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm h-full w-full z-10"
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {active && typeof active === "object" ? (
          <div className="fixed inset-0 grid place-items-center z-[100] px-4">
            <motion.div
              layoutId={`card-${active.title}-${id}`}
              ref={ref}
              className="w-full max-w-[900px] max-h-[100dvh] md:max-h-[90vh] flex flex-col bg-neutral-900 border border-neutral-800 sm:rounded-3xl overflow-hidden"
            >
              <div className="flex-shrink-0">
                {active.src && (
                  <motion.div layoutId={`image-${active.title}-${id}`}>
                    <img
                      priority="true"
                      width={200}
                      height={200}
                      src={active.src}
                      alt={active.title}
                      className="w-full h-80 lg:h-80 sm:rounded-tr-lg sm:rounded-tl-lg object-contain bg-neutral-950"
                    />
                  </motion.div>
                )}
              </div>

              <div className="p-6 overflow-y-auto min-h-0 flex-1 [scrollbar-width:thin] [scrollbar-color:theme(colors.neutral.700)_transparent]">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <motion.h3
                      layoutId={`title-${active.title}-${id}`}
                      className="font-bold text-neutral-100 text-xl"
                    >
                      {active.title}
                    </motion.h3>
                    <motion.p
                      layoutId={`description-${active.title}-${id}`}
                      className="text-neutral-400 text-base mb-6"
                    >
                      {active.description}
                    </motion.p>
                  </div>

                  <div className="flex items-center flex-shrink-0">
                    {active.ctaLink && (
                      <a
                        href={active.ctaLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 text-sm rounded-full font-bold border border-neutral-600 text-neutral-300 hover:bg-neutral-800 transition-colors"
                      >
                        {active.ctaText}
                      </a>
                    )}
                    <a
                      href={buildShareUrl({
                        title: active.title,
                        loss: active.loss,
                        date: active.date,
                        attackVector: active.attackVector,
                        exploitId: active.id,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Share on X"
                      title="Share on X"
                      className="ml-2 inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-full font-bold border border-neutral-600 text-neutral-300 hover:bg-neutral-800 transition-colors"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 fill-current">
                        <path d="M18.244 2H21l-6.52 7.45L22 22h-6.79l-4.78-6.24L4.8 22H2.04l6.97-7.96L2 2h6.91l4.32 5.71L18.244 2zm-2.38 18h1.88L7.21 4H5.21l10.65 16z" />
                      </svg>
                      Share
                    </a>
                  </div>
                </div>
                <div className="pt-4">
                  <motion.div
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-neutral-300 text-sm pb-10 flex flex-col items-start gap-4"
                  >
                    {typeof active.content === "function"
                      ? active.content()
                      : active.content}
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
      <ul className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 items-start gap-4">
        {cards.map((card, index) => (
          <motion.div
            layoutId={`card-${card.title}-${id}`}
            key={card.title}
            onClick={() => setActive(card)}
            className="p-4 flex flex-col w-full bg-neutral-900 border-neutral-800 rounded-2xl hover:bg-neutral-800 cursor-pointer border transition-colors shadow-none"
          >
            <div className="flex flex-col w-full h-full justify-between">
              {card.src && (
                <motion.div
                  layoutId={`image-${card.title}-${id}`}
                  className="mb-3 -mx-1 -mt-1 overflow-hidden rounded-xl"
                >
                  <img
                    src={card.src}
                    alt={card.title}
                    width={400}
                    height={160}
                    loading="lazy"
                    className="w-full h-28 object-contain bg-neutral-950"
                  />
                </motion.div>
              )}
              <div className="flex flex-col">
                <div className="flex justify-between items-center mb-2">
                  {card.tag && (
                    <motion.span
                      layoutId={`tag-${card.title}-${id}`}
                      className={`inline-block px-2 text-[10px] font-bold py-0.5 rounded-full border tracking-wider ${severityClasses(card.tag)}`}
                    >
                      {card.tag}
                    </motion.span>
                  )}
                </div>
                <motion.h3
                  layoutId={`title-${card.title}-${id}`}
                  className="font-bold text-neutral-100 text-lg mb-1"
                >
                  {card.title}
                </motion.h3>
                <motion.p
                  layoutId={`description-${card.title}-${id}`}
                  className="text-neutral-400 text-xs line-clamp-2"
                >
                  {card.description}
                </motion.p>
                {card.date && (
                  <motion.span
                    layoutId={`date-${card.title}-${id}`}
                    className="text-neutral-500 text-[11px] mt-2"
                  >
                    {new Date(card.date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                  </motion.span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </ul>
    </>
  );
}