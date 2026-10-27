import { describe, expect, it } from 'vitest';
import { createI18n, enI18n } from '../../i18n/index.ts';
import { paymentFailedCustomerEmail, paymentFailedOwnerEmail, type FailedCheckout } from './paymentFailed';

const checkout: FailedCheckout = {
  items: [
    { name: 'Tee <Black / M>', quantity: 2, priceCents: 2500 },
    { name: 'Ukulele', quantity: 1, priceCents: 9000 },
  ],
  amountCents: 14500,
  currency: 'EUR',
};

describe('paymentFailedCustomerEmail', () => {
  it('lists what was attempted, the total, and where to start again', () => {
    const msg = paymentFailedCustomerEmail('buyer@example.com', checkout, 'Shop', 'https://shop.test/', enI18n);
    expect(msg.to).toBe('buyer@example.com');
    expect(msg.subject).toContain('Shop');
    expect(msg.text).toContain('Ukulele × 1');
    expect(msg.text).toContain('€145.00');
    expect(msg.text).toContain('https://shop.test/');
    expect(msg.html).toContain('href="https://shop.test/"');
  });

  it('escapes item names in the HTML', () => {
    const msg = paymentFailedCustomerEmail('b@example.com', checkout, 'Shop', 'https://shop.test/', enI18n);
    expect(msg.html).not.toContain('<Black / M>');
    expect(msg.html).toContain('&lt;Black / M&gt;');
  });

  it('leaves the total out when the provider did not say it', () => {
    const msg = paymentFailedCustomerEmail(
      'b@example.com',
      { ...checkout, amountCents: null },
      'Shop',
      'https://shop.test/',
      enI18n,
    );
    expect(msg.text).not.toContain('€145.00');
    expect(msg.text).toContain('€50.00');
  });

  it("speaks the buyer's language", () => {
    const en = paymentFailedCustomerEmail('b@example.com', checkout, 'Shop', 'https://shop.test/', enI18n);
    const it = paymentFailedCustomerEmail('b@example.com', checkout, 'Shop', 'https://shop.test/it/', createI18n('it'));
    expect(it.subject).not.toBe(en.subject);
  });
});

describe('paymentFailedOwnerEmail', () => {
  it('names the buyer and the amount, and links the admin list', () => {
    const msg = paymentFailedOwnerEmail(
      'owner@example.com',
      'buyer@example.com',
      checkout,
      'Shop',
      'https://shop.test/admin/orders/unpaid',
      enI18n,
    );
    expect(msg.to).toBe('owner@example.com');
    expect(msg.subject).toContain('buyer@example.com');
    expect(msg.text).toContain('€145.00');
    expect(msg.text).toContain('https://shop.test/admin/orders/unpaid');
  });

  it('still sends without a buyer address', () => {
    const msg = paymentFailedOwnerEmail('owner@example.com', null, checkout, 'Shop', 'https://a/', enI18n);
    expect(msg.subject).not.toContain('null');
  });
});
