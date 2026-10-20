import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Header } from './components/Header';
import { HeroSection } from './sections/HeroSection';
import { CatalogSection } from './sections/CatalogSection';
import {
  BenefitsSection,
  HowItWorksSection,
  ContactSection,
  Footer,
} from './sections/StorySections';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutForm } from './components/CheckoutForm';
export function App() {
  const [panel, setPanel] = useState<'cart' | 'checkout' | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  return (
    <>
      <a className="skip-link" href="#catalog">
        Перейти до товарів
      </a>
      <Header onCart={() => setPanel('cart')} />
      <main>
        <HeroSection />
        <div className="values-strip">
          <span>Продумані форми</span>
          <span>Природні відтінки</span>
          <span>Маленькі щоденні радощі</span>
          <span>Великі теплі відчуття</span>
        </div>
        <CatalogSection
          onAdded={(name) => setNotice(`«${name}» додано до кошика`)}
        />
        <BenefitsSection />
        <HowItWorksSection />
        <ContactSection />
      </main>
      <Footer />
      {panel === 'cart' && (
        <CartDrawer
          onClose={() => setPanel(null)}
          onCheckout={() => setPanel('checkout')}
        />
      )}{' '}
      {panel === 'checkout' && (
        <CheckoutForm
          onClose={() => setPanel(null)}
          onBack={() => setPanel('cart')}
        />
      )}
      <div
        className={`toast ${notice ? 'visible' : ''}`}
        role="status"
        aria-live="polite"
      >
        {notice && (
          <>
            <Check size={17} />
            <span>{notice}</span>
            <button
              aria-label="Закрити сповіщення"
              onClick={() => setNotice('')}
            >
              <X size={16} />
            </button>
          </>
        )}
      </div>
    </>
  );
}
