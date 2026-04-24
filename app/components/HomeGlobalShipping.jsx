/** Reference map asset (Tapstitch). Consider uploading your own to Shopify Files for long-term control. */
const GLOBAL_SHIPPING_MAP_SRC =
  'https://publichk.cdn.ajmall-group.com/tapstitch/site-static/tapstitch/images/home/global.png';

export function HomeGlobalShipping() {
  return (
    <section className="home-shipping" aria-labelledby="home-shipping-heading">
      <div className="home-shipping-inner">
        <h2 id="home-shipping-heading" className="home-shipping-title">
          Fast in. Fast out. Worldwide.
        </h2>
        <p className="home-shipping-lede">
          Get your blanks and DTF prints quickly with dependable fulfillment—so you can produce,
          press, and sell without missing a beat.
        </p>
        <div className="home-shipping-map-wrap">
          <img
            className="home-shipping-map-img"
            src={GLOBAL_SHIPPING_MAP_SRC}
            alt="World map showing U.S. and international shipping and fulfillment locations"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    </section>
  );
}
