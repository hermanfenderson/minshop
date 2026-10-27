import type { Donor } from '../benefit/donor';

/** An invented donor for the admin preview; clearly not a real person or company. */
export function previewDonor(kind: 'person' | 'company'): Donor {
  const address = { line1: 'Via dell’Esempio 1', postal: '00100', city: 'Roma', region: 'RM', country: 'IT' };
  return kind === 'company'
    ? {
        kind,
        name: 'Esempio S.r.l.',
        firstName: null,
        lastName: null,
        taxCode: null,
        vatNumber: '00000000000',
        address,
        listed: false,
        displayName: null,
      }
    : {
        kind,
        name: 'Mario Rossi',
        firstName: 'Mario',
        lastName: 'Rossi',
        taxCode: 'RSSMRA85T10A562S',
        vatNumber: null,
        address,
        listed: false,
        displayName: null,
      };
}
