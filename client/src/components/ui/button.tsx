import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * shadcn's Button, rebuilt on Halcyon's tokens.
 *
 * No radius and no drop shadows: this is a ruled-ledger aesthetic and the
 * design forbids both. Salmon is reserved for the primary action, because the
 * accent means "the system is speaking" and cannot also mean "decoration".
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-none font-sans whitespace-nowrap ' +
    'transition-colors duration-150 ease-out-quiet ' +
    'disabled:pointer-events-none disabled:opacity-40 ' +
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-salmon text-bg-deep font-medium hover:bg-salmon-deep hover:text-ink',
        outline: 'border border-rule-hi text-ink-mid hover:bg-paper-hi hover:text-ink',
        ghost: 'text-ink-mid hover:bg-paper hover:text-ink',
        // Uppercase mono, for the copy affordances beside a figure.
        quiet:
          'font-mono text-micro uppercase tracking-wider text-ink-low hover:text-salmon',
        danger: 'border border-danger/40 text-danger hover:bg-danger/10',
      },
      size: {
        sm: 'h-7 px-2.5 text-label',
        md: 'h-9 px-4 text-ui',
        lg: 'h-11 px-6 text-body',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'outline', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  readonly asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = 'button', ...props }, ref) => {
    const Component = asChild ? Slot : 'button';
    return (
      <Component
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...(asChild ? {} : { type })}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
