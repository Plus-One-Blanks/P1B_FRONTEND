import {Link, useLoaderData} from 'react-router';
import {LayoutGrid, Upload} from 'lucide-react';
import {SolidButton} from '~/components/SolidButton';
import {OutlineButton} from '~/components/OutlineButton';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: 'DTF Sheets | Plus 1 Blanks'}];
};

/**
 * Hub: choose gang sheet builder vs individual transfer-by-size.
 * Inspired by DTFSheet “Choose how to order” paths.
 *
 * @param {Route.LoaderArgs}
 */
export async function loader() {
  return {};
}

export default function DtfSheetsHub() {
  useLoaderData();

  return (
    <div className="dtf-hub">
      <header className="dtf-hub-hero">
        <p className="dtf-hub-eyebrow">DTF transfers</p>
        <h1 className="dtf-hub-title">Choose how to order</h1>
        <p className="dtf-hub-lede">
          Start with individual designs by finished size, or build a full gang
          sheet online and send one print-ready layout.
        </p>
      </header>

      <ul className="dtf-hub-paths" aria-label="Order paths">
        <li>
          <article className="dtf-hub-card">
            <span className="dtf-hub-card-icon" aria-hidden>
              <Upload size={28} strokeWidth={1.75} />
            </span>
            <h2 className="dtf-hub-card-title">Order individual designs</h2>
            <p className="dtf-hub-card-sub">
              Upload each design. Choose its finished size and quantity. No sheet
              layout required.
            </p>
            <SolidButton to="/dtf-sheets/by-size" className="dtf-hub-card-cta">
              Start by size
            </SolidButton>
          </article>
        </li>
        <li>
          <article className="dtf-hub-card dtf-hub-card--featured">
            <span className="dtf-hub-card-icon" aria-hidden>
              <LayoutGrid size={28} strokeWidth={1.75} />
            </span>
            <h2 className="dtf-hub-card-title">Build a gang sheet</h2>
            <p className="dtf-hub-card-sub">
              Arrange separate designs on a 22″ sheet in our builder. Maximize film
              and save on volume.
            </p>
            <SolidButton
              to="/dtf-sheets/builder"
              className="dtf-hub-card-cta"
              variant="pastel-sky"
            >
              Choose size &amp; create
            </SolidButton>
          </article>
        </li>
      </ul>

      <p className="dtf-hub-note">
        Already have a finished layout?{' '}
        <Link to="/dtf-sheets/builder">Open the gang sheet product</Link> and
        choose Upload Now, or go straight to{' '}
        <Link to="/dtf-sheets/studio?mode=upload&size=2ft">upload studio</Link>.
      </p>

      <div className="dtf-hub-secondary">
        <OutlineButton to="/collections/t-shirts">Shop blank apparel</OutlineButton>
      </div>
    </div>
  );
}

/** @typedef {import('./+types/dtf-sheets._index').Route} Route */
