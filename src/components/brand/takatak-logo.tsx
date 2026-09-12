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
        src="/img/imgtak/takicon2.png"
        alt=""
        width={816}
        height={816}
        className="h-9 w-9 shrink-0 object-contain"
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