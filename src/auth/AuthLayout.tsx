export function AuthLayout({ children }: React.PropsWithChildren) {
  return (
    <div className="flex justify-center">
      {/* Auth UI has margin-top on title, so we lower the top padding */}
      <div className="card mt-14 h-fit w-full max-w-md px-8 py-10 pt-4 sm:mt-20">
        {children}
      </div>
    </div>
  );
}
