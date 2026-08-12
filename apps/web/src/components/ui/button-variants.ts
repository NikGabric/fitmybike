import { cva, type VariantProps } from 'class-variance-authority';

/**
 * Exported separately from Button.vue so links can be styled as buttons
 * (`<RouterLink :class="buttonVariants()">`) without nesting an <a> in a <button>.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-card text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Fading the orange toward the sheet would weaken the contrast the
        // palette is verified at; darkening it slightly preserves the ratio.
        default: 'bg-primary text-primary-foreground hover:brightness-95',
        outline: 'border border-input bg-transparent hover:bg-muted',
        ghost: 'hover:bg-muted',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-card px-3 text-xs',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
