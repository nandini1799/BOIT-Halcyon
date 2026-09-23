import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';

/**
 * Radix Collapsible, unstyled by design.
 *
 * It carries "Notes on this answer" — the audit block. Radix gives the real
 * `aria-expanded` button the accessibility pass requires; the height animation
 * lives at the call site, where the reduced-motion decision belongs.
 */
export const Collapsible = CollapsiblePrimitive.Root;
export const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;
export const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;
