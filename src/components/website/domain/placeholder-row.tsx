import styles from "./domain-search-desk.module.css";

export function PlaceholderRow({
  rightWidths = [80, 140],
  showRight = true,
}: {
  leftWidths?: number[];
  rightWidths?: number[];
  showRight?: boolean;
}) {
  return (
    <div className={styles.row}>
      <svg
        className={`${styles.leftSvg} ${styles.mobileSvg}`}
        viewBox="0 0 420 100"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="20" y="20" width="17" height="17" rx="6" className={styles.shape} />
        <rect x="52" y="8" width="80" height="10" rx="5" className={styles.shape2} />
        <rect x="52" y="23" width="150" height="15" rx="4" className={styles.shape} />
        <rect x="52" y="44" width="120" height="8" rx="5" className={styles.shape} />
        <rect
          className={`${styles.shape} ${styles.mobileOnly}`}
          x="52"
          y="70"
          width="150"
          height="30"
          rx="4"
        />
      </svg>

      {showRight ? (
        <svg
          className={styles.rightSvg}
          viewBox="0 0 300 64"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="0" y="23" width="50" height="20" rx="5" className={styles.shape} />
          <rect
            x={rightWidths[0]}
            y="16"
            width={rightWidths[1]}
            height="32"
            rx="5"
            className={styles.shape2}
          />
          <line
            x1="0"
            x2="300"
            y1="62"
            y2="62"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth="1"
          />
        </svg>
      ) : null}
    </div>
  );
}
