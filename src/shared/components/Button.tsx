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
    "inline-flex items-center justify-center rounded-md font-semibold leading-none",
    variantStyles[variant],
    sizeStyles[size],
    className,
  );
}

const sizeStyles: Record<ButtonSize, ClassNameValue> = {
  md: "px-4 py-2",
  sm: "px-3 py-1.5 text-sm",
  xs: "px-2 py-1 text-xs",
};

const variantStyles: Record<ButtonVariant, ClassNameValue> = {
  primary:
    "bg-neutral-950 text-white hover:bg-neutral-900 active:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200 dark:active:bg-neutral-300",
  danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
  ghost:
    "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 active:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700 dark:active:bg-neutral-600",
};
