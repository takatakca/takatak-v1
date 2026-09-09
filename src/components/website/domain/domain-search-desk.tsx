"use client";

import { useEffect, useState } from "react";
import { FaSearch } from "react-icons/fa";

import { UpmindDac } from "@/components/website/domain/upmind-dac";
import { PlaceholderRow } from "@/components/website/domain/placeholder-row";
import styles from "./domain-search-desk.module.css";

export function DomainSearchDesk({
  clientId = null,
}: {
  clientId?: string | null;
}) {
  const [hasTyped, setHasTyped] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function checkScreen() {
      setIsMobile(window.innerWidth <= 768);
    }

    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  return (
    <div className={styles.desk}>
      <div className={styles.bar}>
        <UpmindDac
          clientId={clientId}
          quiet
          onTyped={setHasTyped}
        />
      </div>

      {!hasTyped ? (
        <div>
          <div className={styles.sv}>
            <PlaceholderRow showRight={!isMobile} />
            <PlaceholderRow
              leftWidths={[300, 220, 180]}
              rightWidths={[84, 128]}
              showRight={!isMobile}
            />
            {!isMobile ? (
              <PlaceholderRow
                leftWidths={[280, 230, 190]}
                rightWidths={[72, 132]}
                showRight
              />
            ) : null}
          </div>

          <div className="relative bottom-[300px] z-10 lg:bottom-[400px]">
            <div className="flex items-center justify-center">
              <div
                className={`${styles.placeh} flex flex-col items-center gap-[15px] rounded-[10px] bg-[#1B076E] text-center text-white`}
              >
                <h2
                  className={`${styles.icon} rounded-full border-2 text-[20px] font-[900]`}
                >
                  <FaSearch />
                </h2>
                <h3>Search & Secure Your Domain Now</h3>
                <p>(Integrated with instant availability check & proceed)</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
