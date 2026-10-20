import {
  ArrowUpRight,
  Heart,
  PackageCheck,
  MessageCircle,
  Leaf,
} from 'lucide-react';
import { Brand } from '../components/Header';
const benefits = [
  {
    icon: Heart,
    title: 'Обираємо з турботою',
    text: 'Форма, фактура й користь. У нашій добірці кожна річ має своє місце.',
  },
  {
    icon: Leaf,
    title: 'Для життя, а не полиці',
    text: 'Речі, якими хочеться користуватися щодня. Прості, приємні та доречні.',
  },
  {
    icon: PackageCheck,
    title: 'Зручне замовлення',
    text: 'Оберіть своє, залиште контакти — і ми узгодимо деталі доставки.',
  },
];
export function BenefitsSection() {
  return (
    <section id="about" className="benefits-wrap">
      <div className="container">
        <div className="benefits-heading">
          <p className="eyebrow">НАША ФІЛОСОФІЯ</p>
          <h2>
            Не просто речі.
            <br />
            <em>Ваше відчуття дому.</em>
          </h2>
          <p>
            Віримо, що затишок не вимірюється кількістю.
            <br />
            Він живе в деталях, які ви обираєте для себе.
          </p>
        </div>
        <div className="benefits-grid">
          {benefits.map(({ icon: Icon, title, text }) => (
            <article key={title}>
              <span className="benefit-icon">
                <Icon size={24} strokeWidth={1.5} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
export function HowItWorksSection() {
  return (
    <section id="how" className="container section-space">
      <div className="section-top">
        <div>
          <p className="eyebrow">КІЛЬКА ПРОСТИХ КРОКІВ</p>
          <h2>
            Від «подобається»
            <br />
            до <em>«вже вдома».</em>
          </h2>
        </div>
        <p className="section-intro">
          Без зайвого клопоту.
          <br />З увагою до кожного замовлення.
        </p>
      </div>
      <div className="steps-grid">
        {[
          ['01', 'Оберіть своє', 'Додайте речі, які сподобалися, до кошика.'],
          [
            '02',
            'Залиште контакти',
            'Заповніть коротку форму та оберіть доставку.',
          ],
          [
            '03',
            'Узгодимо деталі',
            'Зв’яжемося з вами для підтвердження, оплати й доставки.',
          ],
        ].map(([number, title, text]) => (
          <article key={number}>
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
      <p className="delivery-note">
        Вартість доставки — за тарифами перевізника. Оплата та самовивіз — після
        узгодження з менеджером.
      </p>
    </section>
  );
}
export function ContactSection() {
  return (
    <section id="contacts" className="container contact-section">
      <MessageCircle size={32} strokeWidth={1.3} />
      <div>
        <p className="eyebrow">МИ ПОРУЧ</p>
        <h2>
          Знайшли щось <em>своє?</em>
        </h2>
        <p>
          Залиште замовлення — зв’яжемося за вказаним номером.
          <br />
          Запитання чи побажання можна додати в коментарі.
        </p>
      </div>
      <a className="button button-primary" href="#catalog">
        Переглянути колекцію <ArrowUpRight size={18} />
      </a>
    </section>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-top">
          <div>
            <Brand />
            <p>Трохи більше тепла у вашому щодня.</p>
          </div>
          <nav aria-label="Навігація внизу сторінки">
            <a href="#catalog">Колекція</a>
            <a href="#about">Про нас</a>
            <a href="#how">Доставка й оплата</a>
            <a href="#contacts">Зв’язок</a>
          </nav>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} Товарка. З турботою про ваш дім.
          </span>
          <span>
            Речі зі змістом <Heart size={13} />
          </span>
        </div>
      </div>
    </footer>
  );
}
