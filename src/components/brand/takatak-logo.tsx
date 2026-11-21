import Image from "next/image";

type TakatakLogoProps = {
  iconOnly?: boolean;
  className?: string;
};

export function TakatakLogo({
  iconOnly = false,
  className = "",
}: TakatakLogoProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 ${className}`}
      aria-label={iconOnly ? "TAKATAK" : undefined}
    >
      <Image
        src="/icons/icon-192.png"
        alt=""
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 rounded-full object-contain shadow-[0_0_14px_rgba(31,139,255,0.35)]"
        priority
      />

      {!iconOnly ? (
        <span className="text-xl font-extrabold tracking-tight text-foreground">
          TAKATAK
        </span>
      ) : null}
    </span>
  );
}