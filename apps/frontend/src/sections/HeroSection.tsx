import { ArrowDown, ArrowUpRight, Sparkles } from 'lucide-react';
export function HeroSection() {
  return (
    <section className="hero container" id="home">
      <div className="hero-copy">
        <p className="eyebrow">
          <span /> ДОБРІ РЕЧІ ДЛЯ ЩОДНЯ
        </p>
        <h1>
          Дім починається
          <br />з <em>теплих</em>
          <br />
          дрібниць.
        </h1>
        <p className="hero-description">
          Кераміка, текстиль і маленькі знахідки,
          <br className="desktop-break" /> що роблять звичайні моменти
          особливими.
        </p>
        <a className="button button-primary" href="#catalog">
          Знайти своє <ArrowUpRight size={19} />
        </a>
        <div className="hero-foot">
          <span className="tiny-leaf">✳</span>
          <p>
            Менше зайвого.
            <br />
            <strong>Більше того, що любиш.</strong>
          </p>
        </div>
      </div>
      <div
        className="hero-art"
        role="img"
        aria-label="Ілюстрація керамічної вази з гілочками, горнятка та свічки у теплому інтер’єрі"
      >
        <div className="art-window" />
        <div className="art-light" />
        <div className="art-shelf" />
        <img className="hero-vase" src="/images/vase.svg" alt="" />
        <img className="hero-cup" src="/images/cup.svg" alt="" />
        <img className="hero-candle" src="/images/candle.svg" alt="" />
        <div className="art-note">
          <Sparkles size={17} />
          <span>
            Затишок —<br />
            <strong>у простих речах</strong>
          </span>
        </div>
        <span className="art-caption">ОБРАНО З ТУРБОТОЮ · ДЛЯ ВАШОГО ДОМУ</span>
        <a
          href="#catalog"
          className="art-arrow"
          aria-label="Перейти до колекції"
        >
          <ArrowDown size={23} />
        </a>
      </div>
    </section>
  );
}
