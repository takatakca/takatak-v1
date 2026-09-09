"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import styles from "./checkout-domain.module.css";

const SCROLL_THRESHOLD_PX = 160;

export function CheckoutScrollArrow({
  downTargetId,
}: {
  downTargetId: string;
}) {
  const [scrolledDown, setScrolledDown] = useState(false);
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    function update() {
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      setCanScroll(maxScroll > SCROLL_THRESHOLD_PX);
      setScrolledDown(window.scrollY > SCROLL_THRESHOLD_PX);
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  if (!canScroll) {
    return null;
  }

  function handleClick() {
    if (scrolledDown) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const target = document.getElementById(downTargetId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    window.scrollTo({
      top: window.innerHeight,
      behavior: "smooth",
    });
  }

  return (
    <button
      type="button"
      className={`${styles.scrollArrow} ${
        scrolledDown ? styles.scrollArrowUp : styles.scrollArrowDown
      }`}
      onClick={handleClick}
      aria-label={scrolledDown ? "Scroll to top" : "Scroll to hosting plans"}
    >
      <ChevronDown
        size={28}
        strokeWidth={2.4}
        className={`${styles.scrollArrowIcon} ${
          scrolledDown ? styles.scrollArrowIconFlipped : ""
        }`}
      />
    </button>
  );
}
