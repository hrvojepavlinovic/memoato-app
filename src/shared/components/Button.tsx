import { ClassNameValue, twJoin } from "tailwind-merge";
import { Link } from "wasp/client/router";

type ButtonSize = "md" | "sm" | "xs";
type ButtonVariant = "primary" | "danger" | "ghost";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize;
  variant?: ButtonVariant;
}

export function Button({
  children,
  className,
  type = "button",
  size = "md",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={getButtonClasses({
        size,
        variant,
        className,
      })}
      {...props}
    >
      {children}
    </button>
  );
}

type ButtonLinkProps = React.ComponentProps<typeof Link> & {
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function ButtonLink({
  children,
  className,
  size = "md",
  variant = "primary",
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={getButtonClasses({
        size,
        variant,
        className,
      })}
      {...props}
    >
      {children}
    </Link>
  );
}

function getButtonClasses({
  size,
  variant,
  className,
}: {
  size: ButtonSize;
  variant: ButtonVariant;
  className: ClassNameValue;
}): string {
  return twJoin(
    "inline-flex items-center justify-center rounded-[4px] border border-transparent font-bold leading-none disabled:pointer-events-none disabled:opacity-50",
    variantStyles[variant],
    sizeStyles[size],
    className,
  );
}

const sizeStyles: Record<ButtonSize, ClassNameValue> = {
  md: "min-h-10 px-4 py-2 text-sm",
  sm: "min-h-9 px-3 py-1.5 text-sm",
  xs: "min-h-8 px-2.5 py-1 text-xs",
};

const variantStyles: Record<ButtonVariant, ClassNameValue> = {
  primary:
    "bg-neutral-950 text-white hover:border-[#ff5c35] hover:bg-neutral-950 active:translate-y-px dark:bg-neutral-100 dark:text-neutral-950 dark:hover:border-[#ff6b45] dark:hover:bg-white",
  danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
  ghost:
    "border-neutral-300 bg-transparent text-neutral-900 hover:border-neutral-950 hover:bg-white active:translate-y-px dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-300 dark:hover:bg-neutral-900",
};
