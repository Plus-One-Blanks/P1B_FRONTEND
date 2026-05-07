/**
 * Customer Account API: run Hydrogen auth guard before queries.
 * `handleAuthStatus` may be async (token refresh) and can return a Redirect `Response`
 * when the customer must be sent to login — that must be returned from the loader as-is.
 *
 * @param {{ handleAuthStatus: () => unknown }} customerAccount
 * @returns {Promise<Response | undefined>}
 */
export async function guardCustomerAccountAuth(customerAccount) {
  const pending = customerAccount.handleAuthStatus();
  const result = await Promise.resolve(pending);

  if (result instanceof Response) {
    return result;
  }
  return undefined;
}

/**
 * @param {readonly unknown[] | null | undefined} errors
 * @returns {unknown}
 */
export function serializeCustomerAccountErrors(errors) {
  if (!errors?.length) return errors;
  return errors.map((e) => {
    if (e && typeof e === 'object' && 'message' in e) {
      const err = /** @type {Error & {extensions?: unknown}} */ (e);
      return {
        name: err.name,
        message: err.message,
        stack: err.stack,
        ...(err.extensions != null ? {extensions: err.extensions} : {}),
      };
    }
    return e;
  });
}
