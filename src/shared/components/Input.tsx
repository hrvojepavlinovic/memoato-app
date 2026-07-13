import React from "react";
import { ControllerFieldState } from "react-hook-form";
import { twJoin } from "tailwind-merge";

interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "children" | "id"> {
  label: string;
  fieldState: ControllerFieldState;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, label, fieldState, ...props }, ref) {
    const id = React.useId();
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="label">
          {label}
        </label>
        <input
          id={id}
          className={twJoin(
            "min-h-11 w-full rounded-[4px] border border-neutral-300 bg-transparent px-3 py-2 text-neutral-900 shadow-none focus:border-neutral-950 focus:outline-none dark:border-neutral-700 dark:text-neutral-100 dark:focus:border-neutral-200",
            className,
          )}
          {...props}
          ref={ref}
        />
        {fieldState.error && (
          <span className="text-sm text-red-500">
            {fieldState.error.message}
          </span>
        )}
      </div>
    );
  },
);
