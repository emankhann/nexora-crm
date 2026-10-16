type AvatarProps = {
  name?: string;
  initials?: string;
  size?: "sm" | "md" | "lg" | number;
};

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

export default function Avatar({ name, initials, size = "md" }: AvatarProps) {
  const value = initials ??
    (name
      ? name
          .split(" ")
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : "?");

  const numericSize = typeof size === "number";
  const style = numericSize
    ? {
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${Math.max(10, Math.round(size * 0.38))}px`,
      }
    : undefined;

  return (
    <div
      className={[
        "flex items-center justify-center rounded-full bg-sky-100 font-semibold text-sky-700",
        numericSize ? "" : sizeClasses[size],
      ].join(" ")}
      style={style}
      aria-label={name ?? initials ?? "User avatar"}
    >
      {value}
    </div>
  );
}
