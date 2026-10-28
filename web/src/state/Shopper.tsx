import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLDClient } from '@launchdarkly/react-sdk';
import { toLDContext, type Persona, type PersonaId, type ShopperAttributes } from '../launchdarkly/contexts';

interface ShopperValue {
  personas: Record<PersonaId, Persona>;
  personaId: PersonaId;
  attributes: ShopperAttributes;
  /** True when the attributes were edited after choosing a persona. */
  edited: boolean;
  /** True while LaunchDarkly is evaluating flags for a new shopper. */
  switching: boolean;
  /** Read synchronously by flag listeners to tell a shopper switch from a release. */
  isSwitchingRef: { readonly current: boolean };
  choosePersona: (id: PersonaId) => Promise<void>;
  updateAttributes: (changes: Partial<ShopperAttributes>) => Promise<void>;
}

const ShopperContext = createContext<ShopperValue | null>(null);

/**
 * Holds who is shopping and keeps LaunchDarkly in sync. Every change calls
 * identify(), which swaps the evaluation context and fetches flag values for the
 * new shopper. Hooks re-render with the new values, with no page reload.
 */
export function ShopperProvider({ personas, children }: { personas: Record<PersonaId, Persona>; children: ReactNode }) {
  const ldClient = useLDClient();
  const [personaId, setPersonaId] = useState<PersonaId>('guest');
  const [attributes, setAttributes] = useState<ShopperAttributes>(personas.guest.attributes);
  const [edited, setEdited] = useState(false);
  const [switching, setSwitching] = useState(false);
  const isSwitchingRef = useRef(false);

  const identify = useCallback(
    async (next: ShopperAttributes) => {
      isSwitchingRef.current = true;
      setSwitching(true);
      try {
        // identify() never rejects; it resolves with a status. Flag change events
        // fire while it is in flight, before this await returns.
        await ldClient.identify(toLDContext(next));
      } finally {
        isSwitchingRef.current = false;
        setSwitching(false);
      }
    },
    [ldClient],
  );

  const choosePersona = useCallback(
    async (id: PersonaId) => {
      const next = personas[id].attributes;
      setPersonaId(id);
      setAttributes(next);
      setEdited(false);
      await identify(next);
    },
    [personas, identify],
  );

  const updateAttributes = useCallback(
    async (changes: Partial<ShopperAttributes>) => {
      const next = { ...attributes, ...changes };
      setAttributes(next);
      setEdited(true);
      await identify(next);
    },
    [attributes, identify],
  );

  const value = useMemo(
    () => ({ personas, personaId, attributes, edited, switching, isSwitchingRef, choosePersona, updateAttributes }),
    [personas, personaId, attributes, edited, switching, choosePersona, updateAttributes],
  );
  return <ShopperContext.Provider value={value}>{children}</ShopperContext.Provider>;
}

// oxlint-disable-next-line react/only-export-components -- hook co-located with its provider
export function useShopper(): ShopperValue {
  const value = useContext(ShopperContext);
  if (!value) throw new Error('useShopper must be used inside ShopperProvider');
  return value;
}
