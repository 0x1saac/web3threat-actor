import React, { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useOutsideClick } from "../../hooks/use-outside-click";

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
  }[];
}) {
  const [active, setActive] = useState<(typeof cards)[number] | boolean | null>(
    null
  );
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);

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
                      className="w-full h-80 lg:h-80 sm:rounded-tr-lg sm:rounded-tl-lg object-cover object-top"
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

                  {active.ctaLink && (
                    <a
                      href={active.ctaLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 text-sm rounded-full font-bold border border-neutral-600 text-neutral-300 hover:bg-neutral-800 transition-colors flex-shrink-0"
                    >
                      {active.ctaText}
                    </a>
                  )}
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