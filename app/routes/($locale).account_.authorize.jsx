/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  try {
    return await context.customerAccount.authorize();
  } catch (error) {
    console.error('[account authorize] authorize() failed:', error);
    throw error;
  }
}

/** @typedef {import('./+types/account_.authorize').Route} Route */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
