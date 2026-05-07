import {redirect} from 'react-router';
import {guardCustomerAccountAuth} from '~/lib/customerAccountAuth';

// fallback wild card for all unauthenticated routes in account section
/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  const authRedirect = await guardCustomerAccountAuth(context.customerAccount);
  if (authRedirect) {
    return authRedirect;
  }

  return redirect('/account');
}

/** @typedef {import('./+types/account.$').Route} Route */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
